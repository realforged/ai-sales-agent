import { NextResponse } from "next/server";
import { z } from "zod";
import { processIndiaMARTWebhook } from "@/lib/lead-service";

const webhookSchema = z.object({
  leadId: z.string().optional(),
  contactName: z.string().min(1),
  contactPhone: z.string().min(1),
  contactEmail: z.string().email().optional(),
  companyName: z.string().min(1),
  message: z.string().min(1),
  source: z.string().optional(),
  subject: z.string().optional(),
});

export async function GET() {
  return NextResponse.json({ status: "IndiaMART webhook endpoint is active" });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = webhookSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const result = processIndiaMARTWebhook(parsed.data);

    return NextResponse.json({
      success: true,
      lead: {
        id: result.lead.id,
        contactName: result.lead.contactName,
        status: result.lead.status,
        source: result.lead.source,
      },
      company: {
        id: result.company.id,
        name: result.company.name,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
