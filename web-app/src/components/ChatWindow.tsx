"use client";

import React, { useRef, useEffect, useState } from "react";
import { useAuth } from "./AuthProvider";
import { MessageBubble } from "./MessageBubble";
import { ChatInput } from "./ChatInput";
import type { ChatMessage, AgentType } from "@/types/chat";

interface ChatWindowProps {
  agentType: AgentType;
}

const sampleQuestions = [
  process.env.NEXT_PUBLIC_SAMPLE_QUESTION_1 || "How many regular season games were played in 2025?",
  process.env.NEXT_PUBLIC_SAMPLE_QUESTION_2 || "Which team had the best red zone touchdown rate in the 2025 regular season?",
  process.env.NEXT_PUBLIC_SAMPLE_QUESTION_3 || "List the top 5 quarterbacks by passing yards in the 2025 regular season.",
];

export function ChatWindow({ agentType }: ChatWindowProps) {
  const { getAccessToken } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const sendMessage = async (content: string) => {
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content,
      timestamp: new Date(),
      agentType,
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const token = await getAccessToken();

      const conversationHistory = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: content,
          agentType,
          conversationHistory,
        }),
      });

      const data = await response.json();

      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data.error
          ? `⚠️ Error: ${data.error}`
          : data.reply || "No response received.",
        timestamp: new Date(),
        agentType,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      const errorMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: `⚠️ Failed to get a response. ${error instanceof Error ? error.message : "Please try again."}`,
        timestamp: new Date(),
        agentType,
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFeedback = async (
    messageId: string,
    rating: "positive" | "negative",
    comment?: string
  ) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId ? { ...m, feedback: rating, feedbackComment: comment } : m
      )
    );

    const message = messages.find((m) => m.id === messageId);
    const prevUserMsg = messages
      .slice(0, messages.indexOf(message!))
      .filter((m) => m.role === "user")
      .pop();

    try {
      await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messageId,
          question: prevUserMsg?.content || "",
          answer: message?.content || "",
          rating,
          comment,
          agentType,
          timestamp: new Date().toISOString(),
        }),
      });
    } catch {
      // Feedback is best-effort
    }
  };

  // Empty state: centered input with sample questions
  if (messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-2xl">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
              What would you like to know?
            </h2>
            <p className="text-gray-500 dark:text-gray-400">
              Ask questions about NFL play-by-play data, team stats, and player performance.
            </p>
          </div>

          <ChatInput onSend={sendMessage} disabled={isLoading} centered />

          <div className="mt-6 grid gap-2">
            <p className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">
              Try asking
            </p>
            {sampleQuestions.map((q, i) => (
              <button
                key={i}
                onClick={() => sendMessage(q)}
                className="text-left px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-sm text-gray-700 dark:text-gray-300 hover:border-blue-300 dark:hover:border-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Active conversation
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-4xl mx-auto space-y-1">
          {messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              onFeedback={handleFeedback}
            />
          ))}
          {isLoading && (
            <div className="py-4 px-1">
              <div className="flex items-center gap-2 text-gray-400 dark:text-gray-500">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" />
                  <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce [animation-delay:0.15s]" />
                  <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce [animation-delay:0.3s]" />
                </div>
                <span className="text-sm">Thinking...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>
      <div className="shrink-0 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-3">
        <div className="max-w-4xl mx-auto">
          <ChatInput onSend={sendMessage} disabled={isLoading} />
        </div>
      </div>
    </div>
  );
}
