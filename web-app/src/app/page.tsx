"use client";

import React, { useState } from "react";
import { AuthProvider } from "@/components/AuthProvider";
import { Header } from "@/components/Header";
import { ChatWindow } from "@/components/ChatWindow";
import type { AgentType } from "@/types/chat";

function AppContent() {
  const [agentType, setAgentType] = useState<AgentType>("semantic-model");

  const handleNewChat = () => {
    const clearFn = (window as unknown as Record<string, () => void>).__clearChat;
    if (clearFn) clearFn();
  };

  return (
    <div className="flex flex-col h-screen bg-white dark:bg-gray-950">
      <Header
        agentType={agentType}
        onAgentChange={setAgentType}
        onNewChat={handleNewChat}
      />
      <ChatWindow agentType={agentType} />
    </div>
  );
}

export default function Home() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
