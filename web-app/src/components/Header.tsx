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
  const { isAuthenticated, account, signIn, signOut } = useAuth();

  return (
    <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-4 py-3">
      <div className="max-w-5xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
            🏈 NFL Data Agent
          </h1>

          {isAuthenticated && (
            <>
              <select
                value={agentType}
                onChange={(e) => onAgentChange(e.target.value as AgentType)}
                className="text-sm border border-gray-300 dark:border-gray-600 rounded-md px-2 py-1 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200"
              >
                <option value="semantic-model">Semantic Model Agent</option>
                <option value="lakehouse">Lakehouse Agent</option>
              </select>

              <button
                onClick={onNewChat}
                className="text-sm px-3 py-1 rounded-md border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200"
              >
                New Chat
              </button>
            </>
          )}
        </div>

        <div className="flex items-center gap-3">
          {isAuthenticated && account ? (
            <>
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {account.name || account.username}
              </span>
              <button
                onClick={signOut}
                className="text-sm px-3 py-1 rounded-md bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200"
              >
                Sign Out
              </button>
            </>
          ) : (
            <button
              onClick={signIn}
              className="text-sm px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-medium"
            >
              Sign In
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
