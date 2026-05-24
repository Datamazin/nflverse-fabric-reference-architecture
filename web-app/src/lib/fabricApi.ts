export interface FabricChatResponse {
  content: string;
}

/**
 * Call the Fabric Data Agent OpenAI-compatible chat endpoint.
 *
 * The published URL is used as the base, with /chat/completions appended
 * per Azure OpenAI conventions. Includes api-version query parameter.
 */
export async function queryDataAgent(
  fabricToken: string,
  workspaceId: string,
  agentId: string,
  messages: { role: string; content: string }[]
): Promise<FabricChatResponse> {
  // Use the published URL directly as the endpoint
  const url = `https://api.fabric.microsoft.com/v1/workspaces/${workspaceId}/dataagents/${agentId}/aiassistant/openai`;

  console.log("[fabricApi] Calling:", url);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${fabricToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messages,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error("[fabricApi] Error response:", response.status, errorBody);
    throw new Error(
      `Fabric Data Agent API error (${response.status}): ${errorBody}`
    );
  }

  const data = await response.json();
  console.log("[fabricApi] Response keys:", Object.keys(data));

  // OpenAI-compatible response format
  const content =
    data?.choices?.[0]?.message?.content ||
    data?.content ||
    JSON.stringify(data);

  return { content };
}
