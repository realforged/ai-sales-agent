import { z } from "zod";
import { LeadSource } from "@/types";

const IndiaMARTPayloadSchema = z.object({
  company_name: z.string().min(1),
  contact_person: z.string().min(1),
  mobile: z.string().min(1),
  email: z.string().email().optional().or(z.literal("")),
  query_product: z.string().optional(),
  query_message: z.string().optional(),
  sender_name: z.string().optional(),
  inquiry_id: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
});

export interface ProcessedLead {
  companyName: string;
  contactName: string;
  phone: string;
  email?: string;
  productHint?: string;
  message: string;
  source: LeadSource;
  rawPayload: unknown;
  valid: boolean;
  errors?: string[];
}

export interface LeadSourceProvider {
  processInboundLead(payload: unknown): Promise<ProcessedLead>;
}

export class MockIndiaMARTProvider implements LeadSourceProvider {
  async processInboundLead(payload: unknown): Promise<ProcessedLead> {
    const result = IndiaMARTPayloadSchema.safeParse(payload);

    if (!result.success) {
      const errors = result.error.issues.map(
        (issue) => `${issue.path.join(".")}: ${issue.message}`
      );
      return {
        companyName: "",
        contactName: "",
        phone: "",
        message: "",
        source: LeadSource.INDIAMART,
        rawPayload: payload,
        valid: false,
        errors,
      };
    }

    const data = result.data;

    return {
      companyName: data.company_name,
      contactName: data.contact_person,
      phone: data.mobile,
      email: data.email || undefined,
      productHint: data.query_product || undefined,
      message: data.query_message || `Inquiry from ${data.contact_person} at ${data.company_name}`,
      source: LeadSource.INDIAMART,
      rawPayload: payload,
      valid: true,
    };
  }
}

let instance: MockIndiaMARTProvider | null = null;

export function getLeadSourceProvider(): LeadSourceProvider {
  if (!instance) {
    instance = new MockIndiaMARTProvider();
  }
  return instance;
}
