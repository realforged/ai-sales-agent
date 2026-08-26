import {
  CustomerIntent,
  Escalation,
  EscalationPriority,
  EscalationStatus,
  Lead,
  LeadStatus,
  Quotation,
  QuotationStatus,
  RFQ,
  RFQStatus,
} from "@/types";
import { getStore } from "@/lib/store";

export interface EscalationResult {
  needed: boolean;
  escalations: Array<{
    reason: string;
    priority: EscalationPriority;
    context: string;
  }>;
}

export function checkEscalationNeeded(
  lead: Lead,
  rfq: RFQ | null,
  quotation: Quotation | null,
  intentClassification?: { intent: CustomerIntent; confidence: number }
): EscalationResult {
  const store = getStore();
  const escalations: EscalationResult["escalations"] = [];

  if (rfq?.productCategory) {
    const products = store.products.filter((p) => p.isActive);
    const knownCategories = new Set(products.map((p) => p.category.toLowerCase()));
    const isKnown = [...knownCategories].some(
      (cat) =>
        cat === rfq.productCategory!.toLowerCase() ||
        rfq.productCategory!.toLowerCase().includes(cat) ||
        cat.includes(rfq.productCategory!.toLowerCase())
    );
    if (!isKnown) {
      escalations.push({
        reason: "Unknown product - not in catalogue",
        priority: EscalationPriority.HIGH,
        context: `Product category "${rfq.productCategory}" not found in product catalogue`,
      });
    }
  }

  if (quotation && quotation.status === QuotationStatus.SENT) {
    const now = store.getCurrentTime();
    if (quotation.sentAt) {
      const daysSinceSent = Math.floor(
        (now.getTime() - quotation.sentAt.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysSinceSent >= 14) {
        escalations.push({
          reason: "No response after 14 days",
          priority: EscalationPriority.HIGH,
          context: `Quotation ${quotation.quotationNumber} sent ${daysSinceSent} days ago with no response`,
        });
      }
    }
  }

  if (rfq) {
    const fields = store.getRFQFields(rfq.id);
    const totalRequired = fields.filter((f) => f.isRequired).length;
    const extractedCount = fields.filter((f) => f.isExtracted).length;
    const confidence =
      totalRequired > 0 ? extractedCount / totalRequired : 0;

    if (confidence < 0.5 && totalRequired > 0) {
      escalations.push({
        reason: "Low extraction confidence",
        priority: EscalationPriority.HIGH,
        context: `Only ${extractedCount}/${totalRequired} fields could be extracted from customer messages`,
      });
    }
  }

  if (quotation && quotation.totalAmount > 1000000) {
    escalations.push({
      reason: "High value quotation",
      priority: EscalationPriority.MEDIUM,
      context: `Quotation total ₹${quotation.totalAmount.toLocaleString("en-IN")} exceeds ₹10,00,000`,
    });
  }

  if (intentClassification) {
    if (intentClassification.intent === CustomerIntent.PRICE_OBJECTION) {
      escalations.push({
        reason: "Price objection from customer",
        priority: EscalationPriority.MEDIUM,
        context: `Customer expressed price concerns (confidence: ${intentClassification.confidence})`,
      });
    }

    if (intentClassification.intent === CustomerIntent.NOT_INTERESTED) {
      const hasSentQuotation = quotation?.status === QuotationStatus.SENT;
      if (hasSentQuotation) {
        escalations.push({
          reason: "Customer not interested after quotation",
          priority: EscalationPriority.HIGH,
          context: "Customer expressed disinterest after quotation was sent",
        });
      }
    }
  }

  const needsCustomEngineering =
    rfq?.specialRequirements &&
    rfq.specialRequirements.toLowerCase().includes("custom");
  if (needsCustomEngineering) {
    escalations.push({
      reason: "Custom engineering required",
      priority: EscalationPriority.HIGH,
      context: `Special requirements: ${rfq.specialRequirements}`,
    });
  }

  return {
    needed: escalations.length > 0,
    escalations,
  };
}

export function createEscalation(
  leadId: string,
  reason: string,
  priority: EscalationPriority,
  context: string,
  quotationId?: string
): Escalation {
  const store = getStore();

  const escalation = store.createEscalation({
    leadId,
    quotationId,
    priority,
    status: EscalationStatus.OPEN,
    reason,
    description: context,
  });

  store.updateLead(leadId, {
    status: LeadStatus.ESCALATED,
  });

  return escalation;
}

export function getOpenEscalations(): Escalation[] {
  const store = getStore();
  return store.getOpenEscalations();
}

export function acknowledgeEscalation(
  escalationId: string
): Escalation | null {
  const store = getStore();
  return (
    store.updateEscalation(escalationId, {
      status: EscalationStatus.ACKNOWLEDGED,
    }) || null
  );
}

export function resolveEscalation(
  escalationId: string,
  resolutionNotes: string
): Escalation | null {
  const store = getStore();
  const now = store.getCurrentTime();
  return (
    store.updateEscalation(escalationId, {
      status: EscalationStatus.RESOLVED,
      resolvedAt: now,
      resolutionNotes,
    }) || null
  );
}
