export interface FabricChatResponse {
  content: string;
}

/**
 * Call the Fabric Data Agent via the MCP (Model Context Protocol) endpoint.
 *
 * The MCP server exposes the Data Agent as a tool. We call:
 * 1. initialize (handshake)
 * 2. tools/call with the user question
 */
export async function queryDataAgent(
  fabricToken: string,
  workspaceId: string,
  agentId: string,
  messages: { role: string; content: string }[]
): Promise<FabricChatResponse> {
  const mcpUrl = `https://api.fabric.microsoft.com/v1/mcp/workspaces/${workspaceId}/dataagents/${agentId}/agent`;
  const headers = {
    Authorization: `Bearer ${fabricToken}`,
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
  };

  // Step 1: Initialize MCP session
  const initResponse = await fetch(mcpUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-03-26",
        capabilities: {},
        clientInfo: { name: "nfl-data-agent-chat", version: "1.0.0" },
      },
    }),
  });

  if (!initResponse.ok) {
    const errorBody = await initResponse.text();
    throw new Error(`MCP initialize failed (${initResponse.status}): ${errorBody}`);
  }

  // Step 2: Discover tool name
  const toolsResponse = await fetch(mcpUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/list",
      params: {},
    }),
  });

  if (!toolsResponse.ok) {
    throw new Error(`MCP tools/list failed (${toolsResponse.status})`);
  }

  const toolsData = await toolsResponse.json();
  const toolName = toolsData?.result?.tools?.[0]?.name;
  if (!toolName) {
    throw new Error("No tools found on the MCP server");
  }

  // Step 3: Call the Data Agent tool with the latest user message
  const lastUserMessage = messages.filter((m) => m.role === "user").pop();
  const userQuestion = lastUserMessage?.content || "";

  const callResponse = await fetch(mcpUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: {
        name: toolName,
        arguments: { userQuestion },
      },
    }),
  });

  if (!callResponse.ok) {
    const errorBody = await callResponse.text();
    throw new Error(`MCP tools/call failed (${callResponse.status}): ${errorBody}`);
  }

  const callData = await callResponse.json();

  if (callData?.result?.isError) {
    throw new Error(`Data Agent error: ${JSON.stringify(callData.result.content)}`);
  }

  // Extract text content from MCP response
  const content =
    callData?.result?.content
      ?.filter((c: { type: string }) => c.type === "text")
      .map((c: { text: string }) => c.text)
      .join("\n") || "No response received.";

  return { content };
}
