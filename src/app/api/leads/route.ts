import { NextResponse } from "next/server";
import { getAllLeadsSummary } from "@/lib/lead-service";

export async function GET() {
  try {
    const leads = getAllLeadsSummary();
    return NextResponse.json({ leads });
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
