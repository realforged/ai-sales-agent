import { NextResponse } from "next/server";
import { respondToLead } from "@/lib/lead-service";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await request.json();

    if (!body.message || typeof body.message !== "string") {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    const result = respondToLead(id, body.message);

    if (!result) {
      return NextResponse.json(
        { error: "Lead not found or unable to respond" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      lead: result.lead,
      aiResponse: result.aiResponse,
      intent: result.intent,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
