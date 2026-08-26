import { describe, it, expect, beforeEach } from "vitest";
import { calculateQualificationScore } from "@/services/business/qualification";
import { getStore } from "@/lib/store";
import {
  Lead,
  RFQ,
  LeadStatus,
  LeadSource,
  RFQStatus,
  CustomerIntent,
} from "@/types";

describe("Qualification Scoring Engine", () => {
  let store: ReturnType<typeof getStore>;

  beforeEach(() => {
    store = getStore();
    store.reset();
  });

  function makeLead(overrides: Partial<Lead> = {}): Lead {
    return {
      id: "LEAD-TEST",
      contactName: "Test Contact",
      contactPhone: "+91 99999 99999",
      source: LeadSource.INDIAMART,
      status: LeadStatus.NEW,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };
  }

  function makeRFQ(overrides: Partial<RFQ> = {}): RFQ {
    return {
      id: "RFQ-TEST",
      leadId: "LEAD-TEST",
      status: RFQStatus.COMPLETE,
      completenessScore: 100,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };
  }

  it("should score a fully qualified lead >= 80 with READY_TO_BUY intent", () => {
    const company = store.createCompany({
      name: "Test Corp",
      contactPerson: "John",
      phone: "+91 12345 67890",
    });

    const lead = makeLead({
      companyId: company.id,
      intent: CustomerIntent.READY_TO_BUY,
    });

    const rfq = makeRFQ({
      productCategory: "valves",
      productName: "Ball Valve",
      material: "SS304",
      quantity: 50,
      size: '2"',
      pressureClass: "Class 150",
      deliveryDate: "2026-09-15",
      deliveryLocation: "Pune",
    });

    const result = calculateQualificationScore(lead, rfq);

    expect(result.score).toBeGreaterThanOrEqual(80);
    expect(result.status).toBe("QUALIFIED");
    expect(result.breakdown.companyIdentified).toBe(20);
    expect(result.breakdown.productIdentified).toBe(20);
    expect(result.breakdown.quantityIdentified).toBe(15);
    expect(result.breakdown.technicalSpecsComplete).toBe(20);
    expect(result.breakdown.deliveryTimelineSpecified).toBe(10);
    expect(result.breakdown.deliveryLocationSpecified).toBe(5);
    expect(result.breakdown.buyingIntentSignals).toBe(10);
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it("should score lower when technical specs are incomplete", () => {
    const company = store.createCompany({
      name: "Test Corp",
      contactPerson: "John",
      phone: "+91 12345 67890",
    });

    const lead = makeLead({
      companyId: company.id,
      intent: CustomerIntent.INTERESTED,
    });

    const rfqWithSpecs = makeRFQ({
      productCategory: "valves",
      material: "SS304",
      quantity: 50,
      size: '2"',
      pressureClass: "Class 150",
    });

    const rfqWithoutSpecs = makeRFQ({
      productCategory: "valves",
      material: "SS304",
      quantity: 50,
      size: "",
      pressureClass: "",
    });

    const resultWith = calculateQualificationScore(lead, rfqWithSpecs);
    const resultWithout = calculateQualificationScore(lead, rfqWithoutSpecs);

    expect(resultWith.breakdown.technicalSpecsComplete).toBe(20);
    expect(resultWithout.breakdown.technicalSpecsComplete).toBe(0);
    expect(resultWith.score).toBeGreaterThan(resultWithout.score);
  });

  it("should lose 20 points when company is not identified", () => {
    const lead = makeLead({
      companyId: undefined,
      intent: CustomerIntent.READY_TO_BUY,
    });

    const rfq = makeRFQ({
      productCategory: "valves",
      material: "SS304",
      quantity: 50,
      size: '2"',
      pressureClass: "Class 150",
      deliveryDate: "2026-09-15",
      deliveryLocation: "Pune",
    });

    const result = calculateQualificationScore(lead, rfq);

    expect(result.breakdown.companyIdentified).toBe(0);
    expect(result.reasons).toEqual(
      expect.arrayContaining([expect.stringContaining("Company not identified")])
    );
  });

  it("should return UNQUALIFIED status when no RFQ is provided", () => {
    const lead = makeLead({
      intent: CustomerIntent.INTERESTED,
    });

    const result = calculateQualificationScore(lead, null);

    expect(result.score).toBeLessThan(30);
    expect(result.status).toBe("UNQUALIFIED");
    expect(result.breakdown.productIdentified).toBe(0);
    expect(result.breakdown.quantityIdentified).toBe(0);
    expect(result.breakdown.technicalSpecsComplete).toBe(0);
    expect(result.breakdown.deliveryTimelineSpecified).toBe(0);
    expect(result.breakdown.deliveryLocationSpecified).toBe(0);
  });

  it("should never exceed a score of 100", () => {
    const company = store.createCompany({
      name: "Max Corp",
      contactPerson: "Max",
      phone: "+91 00000 00000",
    });

    const lead = makeLead({
      companyId: company.id,
      intent: CustomerIntent.READY_TO_BUY,
    });

    const rfq = makeRFQ({
      productCategory: "valves",
      productName: "Ball Valve",
      material: "SS304",
      quantity: 100,
      size: '4"',
      pressureClass: "Class 300",
      deliveryDate: "2026-10-01",
      deliveryLocation: "Mumbai",
    });

    const result = calculateQualificationScore(lead, rfq);

    expect(result.score).toBeLessThanOrEqual(100);
  });

  it("should return PARTIAL status for mid-range scores", () => {
    const company = store.createCompany({
      name: "Partial Corp",
      contactPerson: "P",
      phone: "+91 22222 22222",
    });

    const lead = makeLead({
      companyId: company.id,
      intent: CustomerIntent.INTERESTED,
    });

    const rfq = makeRFQ({
      productCategory: "valves",
      material: "SS304",
    });

    const result = calculateQualificationScore(lead, rfq);

    expect(result.score).toBeGreaterThanOrEqual(30);
    expect(result.score).toBeLessThan(70);
    expect(result.status).toBe("PARTIAL");
  });

  it("should weight intent signals correctly", () => {
    const company = store.createCompany({
      name: "Intent Corp",
      contactPerson: "I",
      phone: "+91 11111 11111",
    });

    const rfq = makeRFQ({
      productCategory: "valves",
      material: "SS304",
    });

    const intentScores: Record<string, number> = {
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

    for (const [intent, expectedScore] of Object.entries(intentScores)) {
      const lead = makeLead({
        companyId: company.id,
        intent: intent as CustomerIntent,
      });

      const result = calculateQualificationScore(lead, rfq);
      expect(result.breakdown.buyingIntentSignals).toBe(expectedScore);
    }
  });
});
