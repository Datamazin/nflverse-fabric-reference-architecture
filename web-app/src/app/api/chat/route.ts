import { NextRequest, NextResponse } from "next/server";
import { queryDataAgent } from "@/lib/fabricApi";

export async function POST(request: NextRequest) {
  try {
    // Extract the Fabric access token from the Authorization header
    // In this flow, the frontend acquires the Fabric token directly
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Missing or invalid authorization header" },
        { status: 401 }
      );
    }
    const fabricToken = authHeader.slice(7);

    const body = await request.json();
    const { message, agentType, conversationHistory } = body;

    if (!message) {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    // Determine which agent to use
    const agentId =
      agentType === "lakehouse"
        ? process.env.FABRIC_LAKEHOUSE_AGENT_ID
        : process.env.FABRIC_SM_AGENT_ID;

    const workspaceId = process.env.FABRIC_WORKSPACE_ID;

    if (!agentId || !workspaceId) {
      return NextResponse.json(
        { error: "Fabric configuration missing. Check server environment variables." },
        { status: 500 }
      );
    }

    // Build messages array for the Data Agent
    const messages = [
      ...(conversationHistory || []),
      { role: "user", content: message },
    ];

    // Call the Fabric Data Agent directly with the user's Fabric token
    const result = await queryDataAgent(
      fabricToken,
      workspaceId,
      agentId,
      messages
    );

    return NextResponse.json({ reply: result.content });
  } catch (error: unknown) {
    console.error("Chat API error:", error);
    const message =
      error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
