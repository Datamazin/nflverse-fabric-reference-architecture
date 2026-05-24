export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  agentType?: "semantic-model" | "lakehouse";
  feedback?: "positive" | "negative" | null;
  feedbackComment?: string;
  durationMs?: number;
  debugRequest?: Record<string, unknown>;
  debugResponse?: Record<string, unknown>;
}

export interface ChatRequest {
  message: string;
  agentType: "semantic-model" | "lakehouse";
  conversationHistory?: { role: string; content: string }[];
}

export interface ChatResponse {
  reply: string;
  error?: string;
}

export type AgentType = "semantic-model" | "lakehouse";
