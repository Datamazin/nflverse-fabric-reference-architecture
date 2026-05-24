export interface FabricChatResponse {
  content: string;
}

/**
 * Call the Fabric Data Agent chat REST API.
 */
export async function queryDataAgent(
  fabricToken: string,
  workspaceId: string,
  agentId: string,
  messages: { role: string; content: string }[]
): Promise<FabricChatResponse> {
  const url = `https://api.fabric.microsoft.com/v1/workspaces/${workspaceId}/items/${agentId}/chat`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${fabricToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ messages }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `Fabric Data Agent API error (${response.status}): ${errorBody}`
    );
  }

  const data = await response.json();

  // The response structure may vary — extract the assistant content
  const content =
    data?.choices?.[0]?.message?.content ||
    data?.content ||
    data?.reply ||
    JSON.stringify(data);

  return { content };
}
