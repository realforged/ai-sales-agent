import { Lead, RFQ } from "@/types";

export interface QualificationScoreBreakdown {
  companyIdentified: number;
  productIdentified: number;
  quantityIdentified: number;
  technicalSpecsComplete: number;
  deliveryTimelineSpecified: number;
  deliveryLocationSpecified: number;
  buyingIntentSignals: number;
}

export interface QualificationResult {
  score: number;
  status: "QUALIFIED" | "UNQUALIFIED" | "PARTIAL";
  breakdown: QualificationScoreBreakdown;
  reasons: string[];
}

export function calculateQualificationScore(
  lead: Lead,
  rfq: RFQ | null
): QualificationResult {
  const breakdown: QualificationScoreBreakdown = {
    companyIdentified: 0,
    productIdentified: 0,
    quantityIdentified: 0,
    technicalSpecsComplete: 0,
    deliveryTimelineSpecified: 0,
    deliveryLocationSpecified: 0,
    buyingIntentSignals: 0,
  };

  const reasons: string[] = [];

  if (lead.companyId) {
    breakdown.companyIdentified = 20;
    reasons.push("Company identified (+20)");
  } else {
    reasons.push("Company not identified (+0)");
  }

  if (rfq?.productCategory) {
    breakdown.productIdentified = 20;
    reasons.push(`Product identified: ${rfq.productCategory} (+20)`);
  } else {
    reasons.push("Product not identified (+0)");
  }

  if (rfq?.quantity && rfq.quantity > 0) {
    breakdown.quantityIdentified = 15;
    reasons.push(`Quantity identified: ${rfq.quantity} (+15)`);
  } else {
    reasons.push("Quantity not identified (+0)");
  }

  const hasMaterial = !!rfq?.material;
  const hasSize = !!rfq?.size;
  const hasPressureClass = !!rfq?.pressureClass;

  if (hasMaterial && hasSize && hasPressureClass) {
    breakdown.technicalSpecsComplete = 20;
    reasons.push(
      `Technical specs complete: ${rfq.material}, ${rfq.size}, ${rfq.pressureClass} (+20)`
    );
  } else {
    const missing: string[] = [];
    if (!hasMaterial) missing.push("material");
    if (!hasSize) missing.push("size");
    if (!hasPressureClass) missing.push("pressure class");
    reasons.push(`Technical specs incomplete (missing: ${missing.join(", ")}) (+0)`);
  }

  if (rfq?.deliveryDate) {
    breakdown.deliveryTimelineSpecified = 10;
    reasons.push(`Delivery timeline specified: ${rfq.deliveryDate} (+10)`);
  } else {
    reasons.push("Delivery timeline not specified (+0)");
  }

  if (rfq?.deliveryLocation) {
    breakdown.deliveryLocationSpecified = 5;
    reasons.push(`Delivery location specified: ${rfq.deliveryLocation} (+5)`);
  } else {
    reasons.push("Delivery location not specified (+0)");
  }

  if (lead.intent) {
    const intentSignals: Record<string, number> = {
      READY_TO_BUY: 10,
      INTERESTED: 7,
      TECHNICAL_QUESTION: 5,
      REVISION_REQUEST: 3,
      PRICE_OBJECTION: 2,
      APPROVAL_PENDING: 4,
      TIMING_DELAY: 2,
      NOT_INTERESTED: 0,
      UNKNOWN: 0,
    };

    const signalScore = intentSignals[lead.intent] || 0;
    breakdown.buyingIntentSignals = signalScore;
    reasons.push(`Intent signal: ${lead.intent} (+${signalScore})`);
  } else {
    reasons.push("No intent signal detected (+0)");
  }

  const totalScore =
    breakdown.companyIdentified +
    breakdown.productIdentified +
    breakdown.quantityIdentified +
    breakdown.technicalSpecsComplete +
    breakdown.deliveryTimelineSpecified +
    breakdown.deliveryLocationSpecified +
    breakdown.buyingIntentSignals;

  const score = Math.min(100, Math.max(0, totalScore));

  let status: "QUALIFIED" | "UNQUALIFIED" | "PARTIAL";
  if (score >= 70) {
    status = "QUALIFIED";
  } else if (score < 30) {
    status = "UNQUALIFIED";
  } else {
    status = "PARTIAL";
  }

  return {
    score,
    status,
    breakdown,
    reasons,
  };
}
