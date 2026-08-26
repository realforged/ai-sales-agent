import { NextResponse } from "next/server";
import { sendQuotation } from "@/lib/lead-service";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const result = sendQuotation(id);

    if (!result) {
      return NextResponse.json(
        { error: "Quotation not found or must be approved before sending" },
        { status: 404 }
      );
    }

    return NextResponse.json({ quotation: result });
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
