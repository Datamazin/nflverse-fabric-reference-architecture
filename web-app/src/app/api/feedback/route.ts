import { NextRequest, NextResponse } from "next/server";

export interface FeedbackPayload {
  messageId: string;
  question: string;
  answer: string;
  rating: "positive" | "negative";
  comment?: string;
  agentType: string;
  timestamp: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: FeedbackPayload = await request.json();

    if (!body.messageId || !body.rating) {
      return NextResponse.json(
        { error: "messageId and rating are required" },
        { status: 400 }
      );
    }

    // TODO: Write feedback to Fabric Lakehouse table using app identity.
    // For now, log it server-side.
    console.log("[Feedback]", JSON.stringify(body, null, 2));

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("Feedback API error:", error);
    return NextResponse.json(
      { error: "Failed to save feedback" },
      { status: 500 }
    );
  }
}
