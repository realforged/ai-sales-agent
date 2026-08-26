import { NextResponse } from "next/server";
import { approveQuotation } from "@/lib/lead-service";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const result = approveQuotation(id);

    if (!result) {
      return NextResponse.json(
        { error: "Quotation not found or cannot be approved" },
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
