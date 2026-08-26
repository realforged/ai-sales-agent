import { describe, it, expect, beforeEach } from "vitest";
import { processIndiaMARTWebhook, WebhookPayload } from "@/lib/lead-service";
import { getStore } from "@/lib/store";
import {
  LeadStatus,
  MessageDirection,
  RFQStatus,
  QuotationStatus,
} from "@/types";

describe("Lead Extraction & Webhook Processing", () => {
  let store: ReturnType<typeof getStore>;

  beforeEach(() => {
    store = getStore();
    store.reset();
  });

  function makeWebhookPayload(
    overrides: Partial<WebhookPayload> = {}
  ): WebhookPayload {
    return {
      contactName: "Priya Sharma",
      contactPhone: "+91 87654 32109",
      contactEmail: "priya@sharmaindustries.com",
      companyName: "Sharma Industries",
      subject: "Enquiry for SS304 Ball Valves",
      message:
        "We need 50 nos of SS304 Ball Valves, 2 inch, Class 150. For water treatment plant in Pune. Required by end of September.",
      ...overrides,
    };
  }

  it("should create lead, company, conversation, message, and RFQ from webhook", () => {
    const payload = makeWebhookPayload();
    const { lead, company, conversation } = processIndiaMARTWebhook(payload);

    expect(lead).toBeDefined();
    expect(lead.id).toMatch(/^LEAD-/);
    expect(lead.contactName).toBe("Priya Sharma");
    expect(lead.companyId).toBe(company.id);

    expect(company).toBeDefined();
    expect(company.name).toBe("Sharma Industries");

    expect(conversation).toBeDefined();
    expect(conversation.leadId).toBe(lead.id);
    expect(conversation.channel).toBe("INDIAMART");

    const messages = store.getMessagesByLead(lead.id);
    expect(messages.length).toBe(2);
    expect(messages[0].direction).toBe(MessageDirection.INBOUND);
    expect(messages[0].content).toContain("SS304 Ball Valves");
    expect(messages[1].direction).toBe(MessageDirection.OUTBOUND);

    const rfqs = store.getRFQsByLead(lead.id);
    expect(rfqs.length).toBe(1);
  });

  it("should extract requirements from message text", () => {
    const payload = makeWebhookPayload();
    const { lead } = processIndiaMARTWebhook(payload);

    const rfqs = store.getRFQsByLead(lead.id);
    const rfq = rfqs[0];

    expect(rfq.productName).toBe("Ball Valve");
    expect(rfq.material).toBe("SS304");
    expect(rfq.quantity).toBe(50);
    expect(rfq.size).toBe('2"');
    expect(rfq.pressureClass).toBe("Class 150");
    expect(rfq.deliveryLocation).toBe("Pune");
    expect(rfq.completenessScore).toBeGreaterThan(60);
  });

  it("should detect missing fields correctly in sparse messages", () => {
    const payload = makeWebhookPayload({
      message: "I need some valves for my plant.",
    });
    const { lead } = processIndiaMARTWebhook(payload);

    const rfqs = store.getRFQsByLead(lead.id);
    const rfq = rfqs[0];

    expect(rfq.material).toBe("");
    expect(rfq.quantity).toBeUndefined();
    expect(rfq.size).toBe("");
    expect(rfq.pressureClass).toBe("");
    expect(rfq.deliveryLocation).toBe("");
    expect(rfq.completenessScore).toBeLessThanOrEqual(25);
  });

  it("should calculate score and classify intent correctly", () => {
    const payload = makeWebhookPayload({
      message:
        "Ready to order 100 nos of SS316 Butterfly Valves, 4 inch, Class 150. Need them for chemical processing in Mumbai by October.",
    });
    const { lead } = processIndiaMARTWebhook(payload);

    const updatedLead = store.getLead(lead.id)!;
    expect(updatedLead.score).toBeGreaterThan(60);
    expect(updatedLead.status).toBe(LeadStatus.QUOTATION_DRAFTED);

    const rfqs = store.getRFQsByLead(lead.id);
    expect(rfqs[0].productName).toBe("Butterfly Valve");
    expect(rfqs[0].material).toBe("SS316");
    expect(rfqs[0].quantity).toBe(100);
    expect(rfqs[0].deliveryLocation).toBe("Mumbai");
  });

  it("should auto-generate quotation when completeness > 60", () => {
    const payload = makeWebhookPayload();
    const { lead } = processIndiaMARTWebhook(payload);

    const quotations = store.getQuotationsByLead(lead.id);
    expect(quotations.length).toBe(1);
    expect(quotations[0].status).toBe(QuotationStatus.PENDING_APPROVAL);
    expect(quotations[0].totalAmount).toBeGreaterThan(0);
  });

  it("should create RFQ fields for all tracked requirements", () => {
    const payload = makeWebhookPayload();
    const { lead } = processIndiaMARTWebhook(payload);

    const rfqs = store.getRFQsByLead(lead.id);
    const fields = store.getRFQFields(rfqs[0].id);

    expect(fields.length).toBe(8);

    const fieldNames = fields.map((f) => f.fieldName);
    expect(fieldNames).toContain("Product");
    expect(fieldNames).toContain("Material");
    expect(fieldNames).toContain("Quantity");
    expect(fieldNames).toContain("Size");
    expect(fieldNames).toContain("Pressure Class");
    expect(fieldNames).toContain("Application");
    expect(fieldNames).toContain("Delivery Date");
    expect(fieldNames).toContain("Delivery Location");
  });
});
