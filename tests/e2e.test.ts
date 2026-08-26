import { describe, it, expect, beforeEach } from "vitest";
import {
  processIndiaMARTWebhook,
  approveQuotation,
  sendQuotation,
  respondToLead,
} from "@/lib/lead-service";
import { getStore } from "@/lib/store";
import {
  LeadStatus,
  QuotationStatus,
  CustomerIntent,
  EscalationStatus,
} from "@/types";

describe("End-to-End Sales Flow", () => {
  let store: ReturnType<typeof getStore>;

  beforeEach(() => {
    store = getStore();
    store.reset();
  });

  it("should complete the full sales cycle from webhook to escalation", () => {
    // Step 1: Process IndiaMART webhook
    const { lead } = processIndiaMARTWebhook({
      contactName: "Amit Patel",
      contactPhone: "+91 77777 77777",
      contactEmail: "amit@patelengg.com",
      companyName: "Patel Engineering Works",
      subject: "SS304 Ball Valve Enquiry",
      message:
        "We need 50 nos of SS304 Ball Valves, 2 inch, Class 150 for water treatment in Pune.",
    });

    // Step 2: Verify lead is created with correct status
    expect(lead).toBeDefined();
    const updatedLead = store.getLead(lead.id)!;
    expect(updatedLead.status).toBe(LeadStatus.QUOTATION_DRAFTED);

    // Step 3: Verify RFQ is created
    const rfqs = store.getRFQsByLead(lead.id);
    expect(rfqs.length).toBe(1);
    expect(rfqs[0].material).toBe("SS304");
    expect(rfqs[0].quantity).toBe(50);

    // Step 4: Verify quotation is generated automatically (completeness > 60)
    const quotations = store.getQuotationsByLead(lead.id);
    expect(quotations.length).toBe(1);

    const quotation = quotations[0];
    expect(quotation.status).toBe(QuotationStatus.PENDING_APPROVAL);
    expect(quotation.totalAmount).toBeGreaterThan(0);
    const leadAfterQuote = store.getLead(lead.id)!;
    expect(leadAfterQuote.status).toBe(LeadStatus.QUOTATION_DRAFTED);

    // Step 5: Approve quotation
    const approved = approveQuotation(quotation.id);
    expect(approved).toBeDefined();
    expect(approved!.status).toBe(QuotationStatus.APPROVED);

    // Step 6: Send quotation
    const sent = sendQuotation(quotation.id);
    expect(sent).toBeDefined();
    expect(sent!.status).toBe(QuotationStatus.SENT);

    const sentLead = store.getLead(lead.id);
    expect(sentLead!.status).toBe(LeadStatus.QUOTATION_SENT);

    // Step 7: Customer sends price objection
    const response = respondToLead(
      lead.id,
      "Your price is too high. Can you reduce the price?"
    );

    expect(response).not.toBeNull();
    expect(response!.intent).toBe(CustomerIntent.PRICE_OBJECTION);

    // Step 8: Verify escalation is created
    const escalations = store.getEscalationsByLead(lead.id);
    expect(escalations.length).toBe(1);
    expect(escalations[0].status).toBe(EscalationStatus.OPEN);
    expect(escalations[0].reason).toContain("price objection");

    const finalLead = store.getLead(lead.id);
    expect(finalLead!.status).toBe(LeadStatus.ESCALATED);
  });

  it("should handle a lead that is not interested", () => {
    const { lead } = processIndiaMARTWebhook({
      contactName: "Ravi Kumar",
      contactPhone: "+91 66666 66666",
      companyName: "Ravi Corp",
      message: "I want to cancel the order.",
    });

    const result = respondToLead(lead.id, "I want to cancel the order.");

    expect(result!.intent).toBe(CustomerIntent.NOT_INTERESTED);
    expect(result!.aiResponse).toContain("Thank you for your time");
  });

  it("should handle a lead that confirms order", () => {
    const { lead } = processIndiaMARTWebhook({
      contactName: "Sunita Devi",
      contactPhone: "+91 55555 55555",
      companyName: "Sunita Manufacturing",
      message:
        "We need 100 nos SS316 Ball Valves, 3 inch, Class 300 for chemical processing in Chennai.",
    });

    const response = respondToLead(
      lead.id,
      "Ready to place order. Please confirm."
    );

    expect(response!.intent).toBe(CustomerIntent.READY_TO_BUY);
    expect(response!.aiResponse).toContain("order confirmation");
  });

  it("should track all AI actions through the flow", () => {
    const { lead } = processIndiaMARTWebhook({
      contactName: "Test User",
      contactPhone: "+91 44444 44444",
      companyName: "Test Corp",
      message:
        "Require 20 nos SS304 Butterfly Valves, 4 inch for HVAC in Bangalore.",
    });

    const actions = store.getAIActionsByLead(lead.id);
    expect(actions.length).toBeGreaterThanOrEqual(2);

    const actionTypes = actions.map((a) => a.messageType);
    expect(actionTypes).toContain("EXTRACT_REQUIREMENTS");
    expect(actionTypes).toContain("CLASSIFY_RESPONSE");
  });
});
