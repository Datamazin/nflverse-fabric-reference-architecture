"use client";

import React, { useState } from "react";
import { AuthProvider, useAuth } from "@/components/AuthProvider";
import { Header } from "@/components/Header";
import { ChatWindow } from "@/components/ChatWindow";
import { SplashScreen } from "@/components/SplashScreen";
import type { AgentType } from "@/types/chat";

function AppContent() {
  const { isAuthenticated } = useAuth();
  const [agentType, setAgentType] = useState<AgentType>("semantic-model");
  const [chatKey, setChatKey] = useState(0);

  const handleNewChat = () => {
    setChatKey((k) => k + 1);
  };

  if (!isAuthenticated) {
    return <SplashScreen />;
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-950">
      <Header
        agentType={agentType}
        onAgentChange={setAgentType}
        onNewChat={handleNewChat}
      />
      <ChatWindow key={chatKey} agentType={agentType} />
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
