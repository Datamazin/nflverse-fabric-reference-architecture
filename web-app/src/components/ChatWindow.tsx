"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import { useAuth } from "./AuthProvider";
import { MessageBubble } from "./MessageBubble";
import { ChatInput } from "./ChatInput";
import type { ChatMessage, AgentType } from "@/types/chat";

interface ChatWindowProps {
  agentType: AgentType;
}

export function ChatWindow({ agentType }: ChatWindowProps) {
  const { isAuthenticated, getAccessToken } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  // Expose clearMessages via ref pattern using a stable callback
  useEffect(() => {
    (window as unknown as Record<string, () => void>).__clearChat = clearMessages;
    return () => {
      delete (window as unknown as Record<string, unknown>).__clearChat;
    };
  }, [clearMessages]);

  const sendMessage = async (content: string) => {
    if (!isAuthenticated) return;

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

      // Build conversation history for context
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

  if (!isAuthenticated) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center p-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            🏈 NFL Data Agent Chat
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Ask natural language questions about NFL play-by-play data, team
            stats, player performance, and more.
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-500">
            Sign in to get started.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-3xl mx-auto">
          {messages.length === 0 && (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              <p className="text-lg mb-2">Ask a question about NFL data</p>
              <p className="text-sm">
                Try: &quot;Which team had the best red zone touchdown rate in the
                2025 regular season?&quot;
              </p>
            </div>
          )}
          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}
          {isLoading && (
            <div className="flex justify-start mb-4">
              <div className="bg-gray-100 dark:bg-gray-800 rounded-lg px-4 py-3">
                <div className="flex items-center gap-2 text-gray-500">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0.1s]" />
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                  </div>
                  <span className="text-sm">Agent is thinking...</span>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>
      <ChatInput onSend={sendMessage} disabled={isLoading} />
    </div>
  );
}
