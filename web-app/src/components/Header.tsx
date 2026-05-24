"use client";

import React from "react";
import { useAuth } from "./AuthProvider";
import type { AgentType } from "@/types/chat";

interface HeaderProps {
  agentType: AgentType;
  onAgentChange: (agent: AgentType) => void;
  onNewChat: () => void;
}

export function Header({ agentType, onAgentChange, onNewChat }: HeaderProps) {
  const { account, signOut } = useAuth();

  return (
    <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 py-2.5 shrink-0">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xl">🏈</span>
          <h1 className="text-base font-semibold text-gray-900 dark:text-white">
            NFL Data Agent
          </h1>
          <div className="h-5 w-px bg-gray-300 dark:bg-gray-700" />
          <select
            value={agentType}
            onChange={(e) => onAgentChange(e.target.value as AgentType)}
            className="text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-2.5 py-1 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
          >
            <option value="semantic-model">Semantic Model Agent</option>
            <option value="lakehouse">Lakehouse Agent</option>
          </select>
          <button
            onClick={onNewChat}
            className="text-sm px-3 py-1 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 transition-colors"
          >
            + New Chat
          </button>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {account?.name || account?.username}
          </span>
          <button
            onClick={signOut}
            className="text-sm px-3 py-1 rounded-lg text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            Sign Out
          </button>
        </div>
      </div>
    </header>
  );
}
