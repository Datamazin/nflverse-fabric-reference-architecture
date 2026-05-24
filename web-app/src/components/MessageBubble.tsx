"use client";

import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import type { ChatMessage } from "@/types/chat";

interface MessageBubbleProps {
  message: ChatMessage;
  onFeedback?: (
    messageId: string,
    rating: "positive" | "negative",
    comment?: string
  ) => void;
}

export function MessageBubble({ message, onFeedback }: MessageBubbleProps) {
  const [showFeedbackInput, setShowFeedbackInput] = useState(false);
  const [feedbackComment, setFeedbackComment] = useState("");

  const isUser = message.role === "user";

  if (isUser) {
    return (
      <div className="flex justify-end mb-4">
        <div className="max-w-[75%] rounded-2xl rounded-br-md bg-blue-600 text-white px-4 py-3 text-sm leading-relaxed shadow-sm">
          {message.content}
        </div>
      </div>
    );
  }

  // Assistant message: full width, with feedback controls
  return (
    <div className="mb-6">
      <div className="prose prose-sm dark:prose-invert max-w-none px-1 py-3 text-gray-900 dark:text-gray-100 leading-relaxed">
        <ReactMarkdown
          components={{
            table: ({ children }) => (
              <div className="overflow-x-auto my-3 rounded-lg border border-gray-200 dark:border-gray-700">
                <table className="min-w-full text-xs">{children}</table>
              </div>
            ),
            th: ({ children }) => (
              <th className="px-3 py-2 bg-gray-100 dark:bg-gray-800 text-left font-semibold text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700">
                {children}
              </th>
            ),
            td: ({ children }) => (
              <td className="px-3 py-2 border-b border-gray-100 dark:border-gray-800 text-gray-700 dark:text-gray-300">
                {children}
              </td>
            ),
          }}
        >
          {message.content}
        </ReactMarkdown>
      </div>

      {/* Feedback controls */}
      {onFeedback && (
        <div className="flex items-center gap-2 px-1 mt-1">
          <button
            onClick={() => onFeedback(message.id, "positive")}
            className={`p-1.5 rounded-md transition-colors ${
              message.feedback === "positive"
                ? "text-green-600 bg-green-50 dark:bg-green-950"
                : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
            }`}
            title="Good response"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path d="M1 8.25a1.25 1.25 0 1 1 2.5 0v7.5a1.25 1.25 0 1 1-2.5 0v-7.5ZM11 3V1.7c0-.268.14-.526.395-.607A2 2 0 0 1 14 3c0 .995-.182 1.948-.514 2.826-.204.54.166 1.174.744 1.174h2.52c1.243 0 2.261 1.01 2.146 2.247a23.864 23.864 0 0 1-1.341 5.974 1.999 1.999 0 0 1-1.89 1.279H6.5a1 1 0 0 1-1-1V7.5a1 1 0 0 1 .514-.874A23.96 23.96 0 0 0 11 3Z" />
            </svg>
          </button>
          <button
            onClick={() => {
              if (message.feedback !== "negative") {
                setShowFeedbackInput(true);
                onFeedback(message.id, "negative");
              }
            }}
            className={`p-1.5 rounded-md transition-colors ${
              message.feedback === "negative"
                ? "text-red-600 bg-red-50 dark:bg-red-950"
                : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
            }`}
            title="Bad response"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path d="M19 11.75a1.25 1.25 0 1 1-2.5 0v-7.5a1.25 1.25 0 1 1 2.5 0v7.5ZM9 17v1.3c0 .268-.14.526-.395.607A2 2 0 0 1 6 17c0-.995.182-1.948.514-2.826.204-.54-.166-1.174-.744-1.174h-2.52c-1.243 0-2.261-1.01-2.146-2.247.193-2.08.651-4.082 1.341-5.974A1.999 1.999 0 0 1 4.335 3.5H13.5a1 1 0 0 1 1 1v8a1 1 0 0 1-.514.874A23.96 23.96 0 0 0 9 17Z" />
            </svg>
          </button>

          {showFeedbackInput && (
            <div className="flex-1 flex items-center gap-2 ml-2">
              <input
                type="text"
                value={feedbackComment}
                onChange={(e) => setFeedbackComment(e.target.value)}
                placeholder="What was wrong? (optional)"
                className="flex-1 text-xs border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    onFeedback(message.id, "negative", feedbackComment);
                    setShowFeedbackInput(false);
                    setFeedbackComment("");
                  }
                }}
              />
              <button
                onClick={() => {
                  onFeedback(message.id, "negative", feedbackComment);
                  setShowFeedbackInput(false);
                  setFeedbackComment("");
                }}
                className="text-xs px-2 py-1 rounded bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
              >
                Send
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
