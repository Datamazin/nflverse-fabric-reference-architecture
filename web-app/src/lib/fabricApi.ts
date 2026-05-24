export interface FabricChatResponse {
  content: string;
}

/**
 * Call the Fabric Data Agent OpenAI-compatible chat endpoint.
 *
 * Endpoint format:
 * POST https://api.fabric.microsoft.com/v1/workspaces/{workspaceId}/dataagents/{agentId}/aiassistant/openai/chat/completions
 */
export async function queryDataAgent(
  fabricToken: string,
  workspaceId: string,
  agentId: string,
  messages: { role: string; content: string }[]
): Promise<FabricChatResponse> {
  const url = `https://api.fabric.microsoft.com/v1/workspaces/${workspaceId}/dataagents/${agentId}/aiassistant/openai/chat/completions`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${fabricToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messages,
      temperature: 0,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `Fabric Data Agent API error (${response.status}): ${errorBody}`
    );
  }

  const data = await response.json();

  // OpenAI-compatible response format
  const content =
    data?.choices?.[0]?.message?.content ||
    data?.content ||
    JSON.stringify(data);

  return { content };
}
