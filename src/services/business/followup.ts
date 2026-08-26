import {
  FollowUp,
  FollowUpStatus,
  LeadStatus,
  QuotationStatus,
} from "@/types";
import { getStore } from "@/lib/store";
import { daysBetween } from "@/lib/utils";

export interface FollowUpRecommendation {
  quotationId: string;
  leadId: string;
  daysSinceSent: number;
  followUpType: "FIRST" | "SECOND" | "ESCALATION";
  recommendedMessage: string;
  priority: "LOW" | "MEDIUM" | "HIGH";
}

export function checkFollowUps(): FollowUpRecommendation[] {
  const store = getStore();
  const now = store.getCurrentTime();
  const recommendations: FollowUpRecommendation[] = [];

  const sentQuotations = store.quotations.filter(
    (q) => q.status === QuotationStatus.SENT && q.sentAt
  );

  for (const quotation of sentQuotations) {
    const daysSinceSent = daysBetween(quotation.sentAt!, now);

    const existingFollowUps = store.getFollowUpsByLead(quotation.leadId);
    const hasResponse = existingFollowUps.some(
      (f) =>
        f.quotationId === quotation.id &&
        f.status === FollowUpStatus.RESPONSE_RECEIVED
    );

    if (hasResponse) continue;

    const pendingFollowUps = existingFollowUps.filter(
      (f) =>
        f.quotationId === quotation.id &&
        f.status === FollowUpStatus.PENDING
    );

    if (daysSinceSent >= 14) {
      const hasEscalationFollowUp = pendingFollowUps.some(
        (f) => f.type === "PHONE"
      );
      if (!hasEscalationFollowUp) {
        recommendations.push({
          quotationId: quotation.id,
          leadId: quotation.leadId,
          daysSinceSent,
          followUpType: "ESCALATION",
          recommendedMessage: `It has been ${daysSinceSent} days since we sent you quotation ${quotation.quotationNumber}. We haven't heard back and would like to understand if there are any concerns we can address. Could we schedule a brief call?`,
          priority: "HIGH",
        });
      }
    } else if (daysSinceSent >= 7) {
      const hasSecondFollowUp = pendingFollowUps.some(
        (f) => f.type === "WHATSAPP"
      );
      if (!hasSecondFollowUp) {
        recommendations.push({
          quotationId: quotation.id,
          leadId: quotation.leadId,
          daysSinceSent,
          followUpType: "SECOND",
          recommendedMessage: `Following up on our quotation ${quotation.quotationNumber}. Please let us know if you need any changes or have questions. We are happy to assist.`,
          priority: "MEDIUM",
        });
      }
    } else if (daysSinceSent >= 3) {
      const hasFirstFollowUp = pendingFollowUps.some(
        (f) => f.type === "EMAIL"
      );
      if (!hasFirstFollowUp) {
        recommendations.push({
          quotationId: quotation.id,
          leadId: quotation.leadId,
          daysSinceSent,
          followUpType: "FIRST",
          recommendedMessage: `Just checking in on the quotation ${quotation.quotationNumber} we shared. Do you have any questions or need clarifications?`,
          priority: "LOW",
        });
      }
    }
  }

  return recommendations;
}

export function createFollowUp(
  quotationId: string,
  type: "EMAIL" | "WHATSAPP" | "PHONE" | "SMS",
  message?: string
): FollowUp | null {
  const store = getStore();
  const quotation = store.getQuotation(quotationId);
  if (!quotation) return null;

  const now = store.getCurrentTime();

  const followUp = store.createFollowUp({
    leadId: quotation.leadId,
    quotationId,
    status: FollowUpStatus.PENDING,
    type,
    scheduledAt: now,
    message,
    createdBy: "AI",
  });

  store.updateLead(quotation.leadId, {
    status: LeadStatus.FOLLOW_UP,
    nextFollowUpAt: now,
  });

  return followUp;
}

export function getPendingFollowUps(): FollowUp[] {
  const store = getStore();
  return store.getPendingFollowUps();
}

export function markFollowUpSent(followUpId: string): FollowUp | null {
  const store = getStore();
  const followUp = store.followUps.find((f) => f.id === followUpId);
  if (!followUp) return null;

  const now = store.getCurrentTime();
  return store.updateFollowUp(followUpId, {
    status: FollowUpStatus.SENT,
    sentAt: now,
  }) || null;
}

export function markFollowUpResponse(
  followUpId: string,
  responseContent: string
): FollowUp | null {
  const store = getStore();
  const followUp = store.followUps.find((f) => f.id === followUpId);
  if (!followUp) return null;

  const now = store.getCurrentTime();
  return store.updateFollowUp(followUpId, {
    status: FollowUpStatus.RESPONSE_RECEIVED,
    responseAt: now,
    responseContent,
  }) || null;
}
