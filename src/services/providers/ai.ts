import { z } from "zod";
import {
  CustomerIntent,
  EscalationPriority,
  FollowUpStatus,
  Lead,
  LeadStatus,
  Message,
  MessageDirection,
  Quotation,
  QuotationStatus,
  RFQ,
  RFQStatus,
} from "@/types";

export interface ExtractionResult {
  product?: string;
  quantity?: number;
  material?: string;
  size?: string;
  pressureClass?: string;
  application?: string;
  deliveryLocation?: string;
  deliveryTimeline?: string;
  confidence: number;
  extractedFields: Record<string, unknown>;
}

export interface ClassificationResult {
  intent: CustomerIntent;
  confidence: number;
  recommendedAction: string;
}

export interface NextActionRecommendation {
  action: string;
  priority: "LOW" | "MEDIUM" | "HIGH";
  reason: string;
  messageTemplate?: string;
}

export interface AIProvider {
  extractRequirements(text: string, productHints?: string[]): Promise<ExtractionResult>;
  identifyMissingFields(extracted: Record<string, unknown>, requiredFields: string[]): Promise<string[]>;
  generateQualificationResponse(customerName: string, extracted: Record<string, unknown>, missingFields: string[]): Promise<string>;
  classifyCustomerIntent(message: string): Promise<ClassificationResult>;
  recommendNextAction(lead: Lead, rfq: RFQ | null, quotation: Quotation | null): Promise<NextActionRecommendation>;
  summarizeConversation(messages: Message[]): Promise<string>;
}

const PRODUCT_KEYWORDS: Record<string, string[]> = {
  valve: ["valve", "ball valve", "butterfly valve", "gate valve", "globe valve", "check valve", "plug valve"],
  pump: ["pump", "centrifugal pump", "submersible pump", "gear pump"],
  flange: ["flange", "slip-on flange", "weld neck flange", "blind flange", "socket weld flange"],
  fitting: ["fitting", "elbow", "tee", "reducer", "coupling", "union"],
  gasket: ["gasket", "spiral wound gasket", "rubber gasket", "ptfe gasket"],
  instrument: ["transmitter", "indicator", "gauge", "switch", "sensor"],
};

const MATERIAL_KEYWORDS: Record<string, string> = {
  ss304: "SS304",
  "stainless steel 304": "SS304",
  "stainless 304": "SS304",
  ss316: "SS316",
  "stainless steel 316": "SS316",
  "stainless 316": "SS316",
  cs: "Carbon Steel",
  "carbon steel": "Carbon Steel",
  "carbon steel a105": "Carbon Steel",
  "alloy steel": "Alloy Steel",
  duplex: "Duplex",
  "super duplex": "Super Duplex",
  hastelloy: "Hastelloy",
  monel: "Monel",
  incoloy: "Incoloy",
};

const SIZE_REGEX = /(\d+(?:\.\d+)?)\s*(?:"|inch|inches|in|mm|cm|dn\s*\d+)/gi;
const QUANTITY_REGEX = /(\d+(?:,\d{3})*(?:\.\d+)?)\s*(?:nos?|pieces?|pcs?|sets?|units?|pair|pairs|valves?|pumps?|nos)?/gi;
const PRESSURE_REGEX = /class\s*(\d+)|pn\s*(\d+)|(\d+)\s*(?:kg|bar|psi)/gi;

const INTENT_RULES: Array<{ patterns: RegExp[]; intent: CustomerIntent; action: string }> = [
  {
    patterns: [/\b(send|sharing?|attaching?|here\s+is)\b.*\b(po|purchase\s*order)\b/i, /\bconfirmed?\b/i, /\bgo\s*ahead\b/i, /\bplace\s*(the\s*)?order\b/i],
    intent: CustomerIntent.READY_TO_BUY,
    action: "Process the purchase order and confirm order details",
  },
  {
    patterns: [/\b(price|cost|rate|expensive|costly|high|too\s*much|budget|discount|cheaper|lower)\b/i],
    intent: CustomerIntent.PRICE_OBJECTION,
    action: "Address price concerns with value proposition or offer discount",
  },
  {
    patterns: [/\b(revis|chang|modif|alter|instead|can\s+you|could\s+you|would\s+it\s+be\s+possible)\b/i],
    intent: CustomerIntent.REVISION_REQUEST,
    action: "Review revision request and update quotation accordingly",
  },
  {
    patterns: [/\b(what\s+about|how\s+about|tell\s+me\s+about|what\s+is|explain|detail|specification|spec|certif|test\s*report|standard|compliance)\b/i],
    intent: CustomerIntent.TECHNICAL_QUESTION,
    action: "Provide technical specifications and compliance information",
  },
  {
    patterns: [/\b(approval|pending|review|manager|management|committee|discuss|internal)\b/i, /\b(call\s+you\s+later|not\s+now|think\s+about|get\s+back)\b/i],
    intent: CustomerIntent.APPROVAL_PENDING,
    action: "Set follow-up reminder and send summary for internal review",
  },
  {
    patterns: [/\b(delay|later|after|next\s+month|next\s+quarter|not\s+urgent|no\s+hurry|time\s+not\s+sure)\b/i],
    intent: CustomerIntent.TIMING_DELAY,
    action: "Schedule follow-up for the suggested timeline",
  },
  {
    patterns: [/\b(not\s+interested|no\s+need|cancel|drop|forget\s+it|no\s+longer|withdrawn)\b/i],
    intent: CustomerIntent.NOT_INTERESTED,
    action: "Send polite closure message and mark lead appropriately",
  },
  {
    patterns: [/\b(thank|thanks|appreciate|great|good|perfect|excellent|wonderful)\b/i],
    intent: CustomerIntent.INTERESTED,
    action: "Continue engagement and explore requirements further",
  },
];

function extractProduct(text: string): string | undefined {
  const lower = text.toLowerCase();
  for (const [category, keywords] of Object.entries(PRODUCT_KEYWORDS)) {
    for (const kw of keywords) {
      if (lower.includes(kw)) {
        return category;
      }
    }
  }
  return undefined;
}

function extractMaterial(text: string): string | undefined {
  const lower = text.toLowerCase();
  for (const [keyword, material] of Object.entries(MATERIAL_KEYWORDS)) {
    if (lower.includes(keyword)) {
      return material;
    }
  }
  return undefined;
}

function extractQuantity(text: string): number | undefined {
  const match = text.match(QUANTITY_REGEX);
  if (match && match.length > 0) {
    const numStr = match[0].replace(/[^0-9.]/g, "").replace(/,/g, "");
    const num = parseInt(numStr, 10);
    if (!isNaN(num) && num > 0 && num < 100000) {
      return num;
    }
  }
  const numbers = text.match(/\b(\d{1,6})\b/g);
  if (numbers) {
    for (const n of numbers) {
      const val = parseInt(n, 10);
      if (val >= 1 && val <= 50000) {
        return val;
      }
    }
  }
  return undefined;
}

function extractSize(text: string): string | undefined {
  const regex = /(\d+(?:\.\d+)?)\s*(?:"|inch|inches|in\b|mm\b|cm\b|dn\s*\d+)/gi;
  const match = regex.exec(text);
  if (match) {
    const value = match[1];
    const unit = match[0].replace(value, "").trim().toLowerCase();
    if (unit.includes('"') || unit.includes("inch") || unit === "in") {
      return `${value}"`;
    }
    if (unit.includes("mm")) {
      return `${value}mm`;
    }
    if (unit.includes("cm")) {
      return `${value}cm`;
    }
    if (unit.includes("dn")) {
      return `DN${value}`;
    }
    return `${value}"`;
  }
  return undefined;
}

function extractPressureClass(text: string): string | undefined {
  const classMatch = text.match(/class\s*(\d+)/i);
  if (classMatch) {
    return `Class ${classMatch[1]}`;
  }
  const pnMatch = text.match(/pn\s*(\d+)/i);
  if (pnMatch) {
    return `PN${pnMatch[1]}`;
  }
  return undefined;
}

function extractApplication(text: string): string | undefined {
  const applications = [
    "water treatment",
    "food and beverage",
    "food & beverage",
    "pharmaceutical",
    "chemical processing",
    "oil and gas",
    "oil & gas",
    "power generation",
    "hvac",
    "marine",
    "mining",
    "fire protection",
    "desalination",
    "pulp and paper",
    "pulp & paper",
    "refinery",
    "petrochemical",
    "steel plant",
    "cement",
    "fertilizer",
    "textile",
  ];
  const lower = text.toLowerCase();
  for (const app of applications) {
    if (lower.includes(app)) {
      return app;
    }
  }
  return undefined;
}

function extractDeliveryLocation(text: string): string | undefined {
  const locationPatterns = [
    /(?:deliver(?:y)?|ship(?:ping)?|send)\s+(?:to\s+)?(.+?)(?:\.|,|\band\b|$)/i,
    /(?:location|address|site)\s*[:=]\s*(.+?)(?:\.|,|\band\b|$)/i,
    /(?:at|in|to)\s+((?:[A-Z][a-z]+\s*){1,4}(?:,?\s*(?:India|IN))?)/,
  ];
  for (const pattern of locationPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const loc = match[1].trim();
      if (loc.length > 2 && loc.length < 100) {
        return loc;
      }
    }
  }
  const indianCities = [
    "Mumbai", "Delhi", "Bangalore", "Chennai", "Pune", "Hyderabad",
    "Ahmedabad", "Kolkata", "Jaipur", "Lucknow", "Pimpri", "Chinchwad",
    "Nagpur", "Indore", "Vadodara", "Surat", "Rajkot", "Jodhpur",
    "Coimbatore", "Kochi", "Vizag", "Visakhapatnam", "Gurgaon", "Noida",
    "Faridabad", "Ghaziabad", "Thane", "Navi Mumbai", "Bhopal",
  ];
  const lower = text.toLowerCase();
  for (const city of indianCities) {
    if (lower.includes(city.toLowerCase())) {
      return city;
    }
  }
  return undefined;
}

function extractDeliveryTimeline(text: string): string | undefined {
  const patterns = [
    /(\d+)\s*(?:days?|working\s*days?)/i,
    /(\d+)\s*(?:weeks?)/i,
    /(\d+)\s*(?:months?)/i,
    /(urgent|immediate|asap| earliest)/i,
    /(by\s+(?:end\s+of\s+)?(?:this|next)\s+(?:week|month|quarter|year))/i,
    /before\s+(.+?)(?:\.|$)/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return match[0].trim();
    }
  }
  return undefined;
}

export class MockAIProvider implements AIProvider {
  async extractRequirements(text: string, _productHints?: string[]): Promise<ExtractionResult> {
    const extractedFields: Record<string, unknown> = {};
    const product = extractProduct(text);
    const quantity = extractQuantity(text);
    const material = extractMaterial(text);
    const size = extractSize(text);
    const pressureClass = extractPressureClass(text);
    const application = extractApplication(text);
    const deliveryLocation = extractDeliveryLocation(text);
    const deliveryTimeline = extractDeliveryTimeline(text);

    if (product) extractedFields.product = product;
    if (quantity) extractedFields.quantity = quantity;
    if (material) extractedFields.material = material;
    if (size) extractedFields.size = size;
    if (pressureClass) extractedFields.pressureClass = pressureClass;
    if (application) extractedFields.application = application;
    if (deliveryLocation) extractedFields.deliveryLocation = deliveryLocation;
    if (deliveryTimeline) extractedFields.deliveryTimeline = deliveryTimeline;

    const fieldsFound = Object.keys(extractedFields).length;
    const totalPossibleFields = 8;
    const confidence = Math.min(0.95, Math.max(0.1, fieldsFound / totalPossibleFields));

    return {
      product,
      quantity,
      material,
      size,
      pressureClass,
      application,
      deliveryLocation,
      deliveryTimeline,
      confidence,
      extractedFields,
    };
  }

  async identifyMissingFields(
    extracted: Record<string, unknown>,
    requiredFields: string[]
  ): Promise<string[]> {
    return requiredFields.filter((field) => {
      const val = extracted[field];
      return val === undefined || val === null || val === "";
    });
  }

  async generateQualificationResponse(
    customerName: string,
    extracted: Record<string, unknown>,
    missingFields: string[]
  ): Promise<string> {
    const knownParts: string[] = [];
    if (extracted.product) knownParts.push(`product type (${extracted.product})`);
    if (extracted.quantity) knownParts.push(`quantity (${extracted.quantity})`);
    if (extracted.material) knownParts.push(`material (${extracted.material})`);
    if (extracted.size) knownParts.push(`size (${extracted.size})`);
    if (extracted.pressureClass) knownParts.push(`pressure class (${extracted.pressureClass})`);
    if (extracted.application) knownParts.push(`application (${extracted.application})`);
    if (extracted.deliveryLocation) knownParts.push(`delivery location (${extracted.deliveryLocation})`);
    if (extracted.deliveryTimeline) knownParts.push(`delivery timeline (${extracted.deliveryTimeline})`);

    const friendlyFieldNames: Record<string, string> = {
      product: "product type",
      quantity: "required quantity",
      material: "material grade",
      size: "size",
      pressureClass: "pressure class",
      application: "application",
      deliveryLocation: "delivery location",
      deliveryTimeline: "delivery timeline",
    };

    let response: string;

    if (knownParts.length > 0) {
      response = `Thanks ${customerName}! I have noted ${knownParts.join(", ")}.`;
    } else {
      response = `Thanks ${customerName} for your interest!`;
    }

    if (missingFields.length > 0) {
      const friendlyNames = missingFields.map(
        (f) => friendlyFieldNames[f] || f.replace(/([A-Z])/g, " $1").toLowerCase()
      );

      if (missingFields.length === 1) {
        response += ` Could you please confirm the ${friendlyNames[0]}?`;
      } else if (missingFields.length === 2) {
        response += ` Could you please confirm the ${friendlyNames[0]} and ${friendlyNames[1]}?`;
      } else {
        const last = friendlyNames.pop()!;
        response += ` Could you please confirm the ${friendlyNames.join(", ")}, and ${last}?`;
      }
    } else {
      response += " I have all the details needed. Let me prepare a quotation for you.";
    }

    return response;
  }

  async classifyCustomerIntent(message: string): Promise<ClassificationResult> {
    const lower = message.toLowerCase();

    for (const rule of INTENT_RULES) {
      for (const pattern of rule.patterns) {
        if (pattern.test(lower) || pattern.test(message)) {
          return {
            intent: rule.intent,
            confidence: 0.85,
            recommendedAction: rule.action,
          };
        }
      }
    }

    return {
      intent: CustomerIntent.UNKNOWN,
      confidence: 0.3,
      recommendedAction: "Ask clarifying questions to understand customer needs",
    };
  }

  async recommendNextAction(
    lead: Lead,
    rfq: RFQ | null,
    quotation: Quotation | null
  ): Promise<NextActionRecommendation> {
    if (lead.status === LeadStatus.NEW || lead.status === LeadStatus.QUALIFYING) {
      if (!rfq || rfq.status === RFQStatus.DRAFT || rfq.status === RFQStatus.INCOMPLETE) {
        return {
          action: "GATHER_REQUIREMENTS",
          priority: "HIGH",
          reason: "Lead is new and RFQ is incomplete",
          messageTemplate: "Let me help you with the requirements. Could you share more details?",
        };
      }
    }

    if (rfq && rfq.status === RFQStatus.COMPLETE && !quotation) {
      return {
        action: "GENERATE_QUOTATION",
        priority: "HIGH",
        reason: "RFQ is complete but no quotation has been generated",
        messageTemplate: "Great, I have all the details! Let me prepare a quotation for you.",
      };
    }

    if (quotation && quotation.status === QuotationStatus.SENT) {
      return {
        action: "FOLLOW_UP",
        priority: "MEDIUM",
        reason: "Quotation has been sent, follow up for response",
        messageTemplate: "Just checking if you had a chance to review the quotation we sent.",
      };
    }

    if (lead.status === LeadStatus.QUOTATION_SENT || lead.status === LeadStatus.NEGOTIATION) {
      return {
        action: "FOLLOW_UP",
        priority: "MEDIUM",
        reason: "Lead is in negotiation stage, needs follow-up",
        messageTemplate: "Following up on our previous discussion. Any updates from your end?",
      };
    }

    if (lead.status === LeadStatus.WON) {
      return {
        action: "CONFIRM_ORDER",
        priority: "LOW",
        reason: "Lead has been won, confirm order details",
        messageTemplate: "Excellent! Let us proceed with order confirmation.",
      };
    }

    if (lead.status === LeadStatus.ESCALATED) {
      return {
        action: "RESOLVE_ESCALATION",
        priority: "HIGH",
        reason: "Lead has been escalated and needs resolution",
        messageTemplate: "Our team is reviewing your case and will get back to you shortly.",
      };
    }

    return {
      action: "CONTINUE_ENGAGEMENT",
      priority: "LOW",
      reason: "Continue the conversation naturally",
      messageTemplate: "Is there anything else I can help you with?",
    };
  }

  async summarizeConversation(messages: Message[]): Promise<string> {
    if (messages.length === 0) {
      return "No messages in this conversation.";
    }

    const inbound = messages.filter((m) => m.direction === MessageDirection.INBOUND);
    const outbound = messages.filter((m) => m.direction === MessageDirection.OUTBOUND);

    const topics = new Set<string>();
    for (const msg of messages) {
      const lower = msg.content.toLowerCase();
      if (/valve|pump|flange|fitting/i.test(lower)) topics.add("product inquiry");
      if (/price|cost|rate|quotation|quote/i.test(lower)) topics.add("pricing");
      if (/delivery|ship|dispatch/i.test(lower)) topics.add("delivery");
      if (/material|ss304|ss316|carbon\s*steel/i.test(lower)) topics.add("material specification");
      if (/quality|test|certif|standard/i.test(lower)) topics.add("quality/certification");
    }

    const topicStr = topics.size > 0 ? ` Topics discussed: ${Array.from(topics).join(", ")}.` : "";

    return `Conversation with ${inbound.length} customer messages and ${outbound.length} agent responses.${topicStr} ${messages.length} total messages exchanged.`;
  }
}

let instance: MockAIProvider | null = null;

export function getAIProvider(): AIProvider {
  if (!instance) {
    instance = new MockAIProvider();
  }
  return instance;
}
