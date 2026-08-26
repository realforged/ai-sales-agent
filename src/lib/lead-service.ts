import { getStore } from "./store";
import {
  LeadStatus,
  MessageDirection,
  RFQStatus,
  QuotationStatus,
  FollowUpStatus,
  EscalationStatus,
  EscalationPriority,
  CustomerIntent,
  AIActionType,
} from "@/types";

export interface WebhookPayload {
  leadId?: string;
  source?: string;
  contactName: string;
  contactPhone: string;
  contactEmail?: string;
  companyName: string;
  subject?: string;
  message: string;
}

export function processIndiaMARTWebhook(payload: WebhookPayload) {
  const store = getStore();

  let company = store.companies.find(
    (c) => c.name.toLowerCase() === payload.companyName.toLowerCase()
  );
  if (!company) {
    company = store.createCompany({
      name: payload.companyName,
      contactPerson: payload.contactName,
      email: payload.contactEmail,
      phone: payload.contactPhone,
    });
  }

  const lead = store.createLead({
    companyId: company.id,
    contactName: payload.contactName,
    contactEmail: payload.contactEmail,
    contactPhone: payload.contactPhone,
    source: (payload.source as any) || "INDIAMART",
    status: LeadStatus.NEW,
    subject: payload.subject,
    description: payload.message,
    score: 60,
  });

  const conversation = store.createConversation({
    leadId: lead.id,
    channelId: `channel-${lead.id}`,
    channel: payload.source || "INDIAMART",
    subject: payload.subject,
    isActive: true,
    messageCount: 0,
  });

  store.createMessage({
    conversationId: conversation.id,
    leadId: lead.id,
    direction: MessageDirection.INBOUND,
    content: payload.message,
    channel: payload.source || "INDIAMART",
  });

  processEnquiryAI(lead.id, conversation.id);

  return { lead, company, conversation };
}

function processEnquiryAI(leadId: string, conversationId: string) {
  const store = getStore();
  const messages = store.getMessagesByLead(leadId);
  const inboundMessages = messages.filter(
    (m) => m.direction === MessageDirection.INBOUND
  );
  const lastMessage = inboundMessages[inboundMessages.length - 1];

  if (!lastMessage) return;

  const text = lastMessage.content.toLowerCase();

  const requirements = extractRequirements(lastMessage.content);
  const intent = classifyIntent(text);
  const score = calculateScore(requirements, intent);

  const rfq = store.createRFQ({
    leadId,
    conversationId,
    status: requirements.completeness > 60 ? RFQStatus.COMPLETE : RFQStatus.INCOMPLETE,
    productCategory: requirements.productCategory,
    productName: requirements.productName,
    material: requirements.material,
    quantity: requirements.quantity,
    unit: requirements.unit || "nos",
    size: requirements.size,
    pressureClass: requirements.pressureClass,
    application: requirements.application,
    deliveryDate: requirements.deliveryDate,
    deliveryLocation: requirements.deliveryLocation,
    completenessScore: requirements.completeness,
    rawText: lastMessage.content,
  });

  const requiredFields = [
    { name: "Product", value: requirements.productName, required: true },
    { name: "Material", value: requirements.material, required: true },
    { name: "Quantity", value: requirements.quantity?.toString(), required: true },
    { name: "Size", value: requirements.size, required: true },
    { name: "Pressure Class", value: requirements.pressureClass, required: false },
    { name: "Application", value: requirements.application, required: false },
    { name: "Delivery Date", value: requirements.deliveryDate, required: false },
    { name: "Delivery Location", value: requirements.deliveryLocation, required: false },
  ];

  requiredFields.forEach((field) => {
    store.createRFQField({
      rfqId: rfq.id,
      fieldName: field.name,
      fieldValue: field.value,
      isRequired: field.required,
      isExtracted: !!field.value,
      source: "AI_EXTRACTION",
    });
  });

  store.updateLead(leadId, {
    status: requirements.completeness > 60 ? LeadStatus.QUALIFYING : LeadStatus.NEW,
    intent,
    score,
    subject: store.getLead(leadId)?.subject || lastMessage.content.substring(0, 50),
  });

  store.createAIAction({
    leadId,
    conversationId,
    messageType: AIActionType.EXTRACT_REQUIREMENTS,
    input: lastMessage.content,
    output: JSON.stringify(requirements),
    confidence: requirements.completeness / 100,
    metadata: { intent, score },
    executedAt: store.getCurrentTime(),
    duration: 150,
  });

  store.createAIAction({
    leadId,
    conversationId,
    messageType: AIActionType.CLASSIFY_RESPONSE,
    input: lastMessage.content,
    output: intent,
    confidence: 0.85,
    executedAt: store.getCurrentTime(),
    duration: 80,
  });

  if (requirements.completeness > 60) {
    generateQuotation(leadId, rfq.id);
  }
}

function extractRequirements(text: string) {
  const lower = text.toLowerCase();

  const productPatterns: Record<string, string> = {
    "ball valve": "Ball Valve",
    "butterfly valve": "Butterfly Valve",
    "gate valve": "Gate Valve",
    "globe valve": "Globe Valve",
    "check valve": "Check Valve",
    "control valve": "Control Valve",
  };

  let productName = "";
  for (const [pattern, name] of Object.entries(productPatterns)) {
    if (lower.includes(pattern)) {
      productName = name;
      break;
    }
  }

  const materialPatterns: Record<string, string> = {
    ss304: "SS304",
    ss316: "SS316",
    "stainless steel 304": "SS304",
    "stainless steel 316": "SS316",
    "carbon steel": "Carbon Steel",
    "monel": "Monel",
  };

  let material = "";
  for (const [pattern, name] of Object.entries(materialPatterns)) {
    if (lower.includes(pattern)) {
      material = name;
      break;
    }
  }

  const sizeMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:inch|in|")/i);
  const size = sizeMatch ? `${sizeMatch[1]}"` : "";

  const qtyMatch = text.match(/(\d+)\s*(?:nos|pcs|pieces|units|no\.)/i);
  const quantity = qtyMatch ? parseInt(qtyMatch[1]) : undefined;

  const pressureMatch = text.match(/class\s*(\d+)/i);
  const pressureClass = pressureMatch ? `Class ${pressureMatch[1]}` : "";

  const locationPatterns = [
    "pune", "mumbai", "chennai", "delhi", "bangalore", "hyderabad",
    "kolkata", "ahmedabad", "jaipur", "lucknow",
  ];
  let deliveryLocation = "";
  for (const loc of locationPatterns) {
    if (lower.includes(loc)) {
      deliveryLocation = loc.charAt(0).toUpperCase() + loc.slice(1);
      break;
    }
  }

  const applicationPatterns = [
    "water treatment",
    "chemical processing",
    "food",
    "pharma",
    "oil",
    "gas",
    "power",
    "mining",
  ];
  let application = "";
  for (const app of applicationPatterns) {
    if (lower.includes(app)) {
      application = app.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
      break;
    }
  }

  let completeness = 0;
  if (productName) completeness += 25;
  if (material) completeness += 20;
  if (quantity) completeness += 15;
  if (size) completeness += 15;
  if (pressureClass) completeness += 10;
  if (application) completeness += 8;
  if (deliveryLocation) completeness += 7;

  return {
    productCategory: "valves",
    productName,
    material,
    quantity,
    unit: "nos",
    size,
    pressureClass,
    application,
    deliveryDate: "",
    deliveryLocation,
    completeness,
  };
}

function classifyIntent(text: string): CustomerIntent {
  if (text.includes("price") && (text.includes("high") || text.includes("reduce") || text.includes("discount")))
    return CustomerIntent.PRICE_OBJECTION;
  if (text.includes("ready") || text.includes("confirm") || text.includes("place order"))
    return CustomerIntent.READY_TO_BUY;
  if (text.includes("interested") || text.includes("require") || text.includes("need"))
    return CustomerIntent.INTERESTED;
  if (text.includes("revision") || text.includes("change") || text.includes("modify"))
    return CustomerIntent.REVISION_REQUEST;
  if (text.includes("technical") || text.includes("specification") || text.includes("certificate"))
    return CustomerIntent.TECHNICAL_QUESTION;
  if (text.includes("delay") || text.includes("later") || text.includes("next month"))
    return CustomerIntent.TIMING_DELAY;
  if (text.includes("not interested") || text.includes("cancel") || text.includes("no requirement"))
    return CustomerIntent.NOT_INTERESTED;
  return CustomerIntent.INTERESTED;
}

function calculateScore(requirements: ReturnType<typeof extractRequirements>, intent: CustomerIntent): number {
  let score = requirements.completeness;

  if (intent === CustomerIntent.READY_TO_BUY) score = Math.min(100, score + 20);
  if (intent === CustomerIntent.INTERESTED) score = Math.min(100, score + 10);
  if (intent === CustomerIntent.PRICE_OBJECTION) score = Math.min(100, score + 5);
  if (intent === CustomerIntent.NOT_INTERESTED) score = Math.max(0, score - 30);

  return Math.round(score);
}

export function generateQuotation(leadId: string, rfqId: string) {
  const store = getStore();
  const lead = store.getLead(leadId);
  const rfq = store.getRFQ(rfqId);
  if (!lead || !rfq) return null;

  const products = store.products;
  let matchedProduct = products.find(
    (p) =>
      p.name.toLowerCase().includes((rfq.productName || "").toLowerCase()) &&
      p.material.toLowerCase() === (rfq.material || "").toLowerCase()
  );

  if (!matchedProduct && products.length > 0) {
    matchedProduct = products[0];
  }

  if (!matchedProduct) return null;

  const quantity = rfq.quantity || matchedProduct.moq;
  const unitPrice = matchedProduct.basePrice;
  const subtotal = unitPrice * quantity;
  const taxAmount = Math.round(subtotal * 0.18);
  const totalAmount = subtotal + taxAmount;

  const quotation = store.createQuotation({
    leadId,
    rfqId,
    companyId: lead.companyId,
    status: QuotationStatus.PENDING_APPROVAL,
    quotationNumber: `QT-${store.quotations.length + 1}-${Date.now().toString(36).toUpperCase()}`,
    version: 1,
    subtotal,
    discount: 0,
    taxAmount,
    totalAmount,
    currency: "INR",
    validityDays: 15,
    paymentTerms: "50% advance, 50% before dispatch",
    deliveryTerms: "Ex-Works Pune, freight extra",
    notes: "Auto-generated by AI based on RFQ requirements.",
  });

  store.createQuotationItem({
    quotationId: quotation.id,
    productId: matchedProduct.id,
    productName: matchedProduct.name,
    description: `${matchedProduct.material} ${rfq.productName || matchedProduct.name} ${rfq.size || ""}`,
    size: rfq.size,
    pressureClass: rfq.pressureClass,
    quantity,
    unitPrice,
    discount: 0,
    taxRate: 18,
    totalPrice: totalAmount,
    leadTimeDays: matchedProduct.leadTimeDays,
  });

  store.updateLead(leadId, {
    status: LeadStatus.QUOTATION_DRAFTED,
  });

  store.createAIAction({
    leadId,
    messageType: AIActionType.GENERATE_QUOTE,
    input: JSON.stringify({ rfqId, productId: matchedProduct.id }),
    output: JSON.stringify({ quotationId: quotation.id, totalAmount }),
    confidence: 0.9,
    executedAt: store.getCurrentTime(),
    duration: 200,
  });

  return quotation;
}

export function approveQuotation(quotationId: string) {
  const store = getStore();
  const quotation = store.getQuotation(quotationId);
  if (!quotation) return null;
  if (quotation.status !== QuotationStatus.PENDING_APPROVAL) return null;

  const updated = store.updateQuotation(quotationId, {
    status: QuotationStatus.APPROVED,
    approvedBy: "MANAGER",
    approvedAt: store.getCurrentTime(),
  });

  return updated;
}

export function sendQuotation(quotationId: string) {
  const store = getStore();
  const quotation = store.getQuotation(quotationId);
  if (!quotation) return null;
  if (quotation.status !== QuotationStatus.APPROVED) return null;

  const updated = store.updateQuotation(quotationId, {
    status: QuotationStatus.SENT,
    sentAt: store.getCurrentTime(),
  });

  store.updateLead(quotation.leadId, {
    status: LeadStatus.QUOTATION_SENT,
  });

  return updated;
}

export function respondToLead(leadId: string, message: string) {
  const store = getStore();
  const lead = store.getLead(leadId);
  if (!lead) return null;

  const conversations = store.getConversationsByLead(leadId);
  const conversation = conversations[0];
  if (!conversation) return null;

  store.createMessage({
    conversationId: conversation.id,
    leadId,
    direction: MessageDirection.INBOUND,
    content: message,
    channel: conversation.channel,
  });

  const text = message.toLowerCase();
  const intent = classifyIntent(text);

  store.updateLead(leadId, { intent });

  let aiResponse = "";
  if (intent === CustomerIntent.PRICE_OBJECTION) {
    aiResponse =
      "Thank you for the feedback on pricing. I understand price is important. Our products come with quality certifications and warranty. Let me connect you with our sales manager who can discuss special pricing for your requirement.";
  } else if (intent === CustomerIntent.INTERESTED) {
    aiResponse =
      "Thank you for your interest. I have noted your requirements. Let me prepare a detailed quotation for you. Could you also confirm the delivery location and expected timeline?";
  } else if (intent === CustomerIntent.READY_TO_BUY) {
    aiResponse =
      "Great! I will prepare the order confirmation. Let me generate the final quotation with your confirmed requirements.";
  } else if (intent === CustomerIntent.NOT_INTERESTED) {
    aiResponse =
      "I understand. Thank you for your time. Please feel free to reach out if you have any future requirements. We are always happy to assist.";
  } else {
    aiResponse =
      "Thank you for your message. I am processing your request and will get back to you shortly with the relevant information.";
  }

  store.createMessage({
    conversationId: conversation.id,
    leadId,
    direction: MessageDirection.OUTBOUND,
    content: aiResponse,
    channel: conversation.channel,
  });

  if (intent === CustomerIntent.PRICE_OBJECTION) {
    store.createEscalation({
      leadId,
      priority: EscalationPriority.HIGH,
      status: EscalationStatus.OPEN,
      reason: "Customer raised price objection. Needs human sales manager intervention for special pricing.",
      description: `Customer message: "${message}"`,
    });

    store.updateLead(leadId, { status: LeadStatus.ESCALATED });
  }

  store.createAIAction({
    leadId,
    conversationId: conversation.id,
    messageType: AIActionType.CLASSIFY_RESPONSE,
    input: message,
    output: intent,
    confidence: 0.85,
    executedAt: store.getCurrentTime(),
    duration: 80,
  });

  store.createAIAction({
    leadId,
    conversationId: conversation.id,
    messageType: AIActionType.RECOMMEND_ACTION,
    input: JSON.stringify({ intent, leadStatus: lead.status }),
    output: aiResponse,
    confidence: 0.8,
    executedAt: store.getCurrentTime(),
    duration: 120,
  });

  const updatedLead = store.getLead(leadId);
  return { lead: updatedLead, aiResponse, intent };
}

export function getLeadDetail(leadId: string) {
  const store = getStore();
  const lead = store.getLead(leadId);
  if (!lead) return null;

  const company = lead.companyId ? store.getCompany(lead.companyId) : null;
  const conversations = store.getConversationsByLead(leadId);
  const messages = store.getMessagesByLead(leadId);
  const rfqs = store.getRFQsByLead(leadId);
  const quotations = store.getQuotationsByLead(leadId);
  const followUps = store.getFollowUpsByLead(leadId);
  const escalations = store.getEscalationsByLead(leadId);
  const aiActions = store.getAIActionsByLead(leadId);

  let rfqFields: any[] = [];
  if (rfqs.length > 0) {
    rfqFields = store.getRFQFields(rfqs[0].id);
  }

  let quotationItems: any[] = [];
  if (quotations.length > 0) {
    quotationItems = store.getQuotationItems(quotations[0].id);
  }

  return {
    lead,
    company,
    conversations,
    messages: messages.sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    ),
    rfqs,
    rfqFields,
    quotations,
    quotationItems,
    followUps,
    escalations,
    aiActions,
  };
}

export function archiveLead(leadId: string) {
  const store = getStore();
  const lead = store.getLead(leadId);
  if (!lead) return null;
  if (lead.status === LeadStatus.ARCHIVED) return null;

  return store.updateLead(leadId, { status: LeadStatus.ARCHIVED });
}

export function restoreLead(leadId: string) {
  const store = getStore();
  const lead = store.getLead(leadId);
  if (!lead) return null;
  if (lead.status !== LeadStatus.ARCHIVED) return null;

  return store.updateLead(leadId, { status: LeadStatus.NEW });
}

export function getAllLeadsSummary() {
  const store = getStore();
  const leads = store.leads.filter((l) => l.status !== LeadStatus.ARCHIVED);

  return leads.map((lead) => {
    const company = lead.companyId ? store.getCompany(lead.companyId) : null;
    const rfqs = store.getRFQsByLead(lead.id);
    const quotations = store.getQuotationsByLead(lead.id);
    const latestRfq = rfqs[0];
    const latestQuotation = quotations[0];

    return {
      id: lead.id,
      contactName: lead.contactName,
      companyName: company?.name || "Unknown",
      source: lead.source,
      status: lead.status,
      score: lead.score || 0,
      subject: lead.subject,
      rfq: latestRfq
        ? {
            id: latestRfq.id,
            status: latestRfq.status,
            completeness: latestRfq.completenessScore,
          }
        : null,
      quotation: latestQuotation
        ? {
            id: latestQuotation.id,
            status: latestQuotation.status,
            totalAmount: latestQuotation.totalAmount,
          }
        : null,
      createdAt: lead.createdAt,
      updatedAt: lead.updatedAt,
    };
  });
}

export function getDashboardMetrics() {
  const store = getStore();
  const leads = store.leads;
  const quotations = store.quotations;

  const totalLeads = leads.length;
  const qualifiedLeads = leads.filter(
    (l) =>
      l.status === LeadStatus.QUALIFIED ||
      l.status === LeadStatus.QUOTATION_DRAFTED ||
      l.status === LeadStatus.QUOTATION_SENT ||
      l.status === LeadStatus.NEGOTIATION ||
      l.status === LeadStatus.WON
  ).length;

  const openRfqs = store.rfqs.filter(
    (r) => r.status === RFQStatus.INCOMPLETE || r.status === RFQStatus.COMPLETE
  ).length;

  const pendingApproval = quotations.filter(
    (q) => q.status === QuotationStatus.PENDING_APPROVAL
  ).length;

  const pipelineValue = quotations
    .filter(
      (q) =>
        q.status !== QuotationStatus.REJECTED &&
        q.status !== QuotationStatus.EXPIRED
    )
    .reduce((sum, q) => sum + q.totalAmount, 0);

  const wonValue = quotations
    .filter((q) => q.status === QuotationStatus.ACCEPTED)
    .reduce((sum, q) => sum + q.totalAmount, 0);

  return {
    totalLeads,
    qualifiedLeads,
    openRfqs,
    pendingApproval,
    pipelineValue,
    wonValue,
  };
}

export function getAIRecommendations() {
  const store = getStore();
  const leads = store.leads;

  const recommendations: Array<{
    leadId: string;
    leadName: string;
    companyName: string;
    dealValue: number;
    status: string;
    priority: string;
    recommendedAction: string;
  }> = [];

  for (const lead of leads) {
    const company = lead.companyId ? store.getCompany(lead.companyId) : null;
    const quotations = store.getQuotationsByLead(lead.id);
    const latestQuotation = quotations[0];
    const escalations = store.getEscalationsByLead(lead.id);
    const openEscalation = escalations.find((e) => e.status === "OPEN");

    if (openEscalation) {
      recommendations.push({
        leadId: lead.id,
        leadName: lead.contactName,
        companyName: company?.name || "Unknown",
        dealValue: latestQuotation?.totalAmount || 0,
        status: lead.status,
        priority: openEscalation.priority,
        recommendedAction: `Escalation: ${openEscalation.reason}`,
      });
    } else if (lead.status === LeadStatus.QUOTATION_DRAFTED) {
      recommendations.push({
        leadId: lead.id,
        leadName: lead.contactName,
        companyName: company?.name || "Unknown",
        dealValue: latestQuotation?.totalAmount || 0,
        status: lead.status,
        priority: "MEDIUM",
        recommendedAction: "Quotation ready for approval. Review and approve to send to customer.",
      });
    } else if (lead.status === LeadStatus.NEW || lead.status === LeadStatus.QUALIFYING) {
      recommendations.push({
        leadId: lead.id,
        leadName: lead.contactName,
        companyName: company?.name || "Unknown",
        dealValue: 0,
        status: lead.status,
        priority: "HIGH",
        recommendedAction: "New lead requires qualification. AI is processing the enquiry.",
      });
    }
  }

  return recommendations;
}

export function runDemoScenario(scenarioId: number) {
  const { scenarios } = require("@/data/scenarios");
  const store = getStore();
  const scenario = scenarios[scenarioId - 1];
  if (!scenario) return { error: "Invalid scenario" };

  const results: string[] = [];
  let currentLeadId: string | null = null;

  for (const step of scenario.steps) {
    switch (step.type) {
      case "WEBHOOK": {
        const result = processIndiaMARTWebhook(step.payload as WebhookPayload);
        currentLeadId = result.lead.id;
        results.push(`Created lead ${result.lead.id} from ${result.lead.source}`);
        break;
      }
      case "CUSTOMER_MESSAGE": {
        const payload = step.payload as any;
        const leadId = payload.leadId || currentLeadId;
        if (!leadId) break;
        const conversations = store.getConversationsByLead(leadId);
        if (conversations.length > 0) {
          const direction = payload.direction === "OUTBOUND"
            ? MessageDirection.OUTBOUND
            : MessageDirection.INBOUND;
          store.createMessage({
            conversationId: conversations[0].id,
            leadId,
            direction,
            content: payload.message,
            channel: conversations[0].channel,
          });

          if (direction === MessageDirection.INBOUND) {
            const text = payload.message.toLowerCase();
            const intent = classifyIntent(text);
            store.updateLead(leadId, { intent });

            const rfqs = store.getRFQsByLead(leadId);
            if (rfqs.length > 0) {
              const rfq = rfqs[0];
              const updated = extractRequirements(payload.message);
              store.updateRFQ(rfq.id, {
                material: updated.material || rfq.material,
                quantity: updated.quantity || rfq.quantity,
                size: updated.size || rfq.size,
                pressureClass: updated.pressureClass || rfq.pressureClass,
                application: updated.application || rfq.application,
                deliveryLocation: updated.deliveryLocation || rfq.deliveryLocation,
                completenessScore: updated.completeness,
              });
            }
          }

          results.push(`Message ${payload.direction} for ${leadId}`);
        }
        break;
      }
      case "ADVANCE_TIME": {
        const payload = step.payload as any;
        if (payload.hours) {
          store.advanceTimeHours(payload.hours);
          results.push(`Advanced time by ${payload.hours} hours`);
        } else if (payload.days) {
          store.advanceTime(payload.days);
          results.push(`Advanced time by ${payload.days} days`);
        }
        break;
      }
      case "SEND_QUOTE": {
        const payload = step.payload as any;
        const leadId = payload.leadId || currentLeadId;
        if (!leadId) break;
        const lead = store.getLead(leadId);
        if (lead) {
          const rfqs = store.getRFQsByLead(leadId);
          let rfqId = rfqs.length > 0 ? rfqs[0].id : undefined;

          if (!rfqId) {
            const rfq = store.createRFQ({
              leadId,
              status: RFQStatus.COMPLETE,
              completenessScore: 100,
              rawText: "",
            });
            rfqId = rfq.id;
          }

          const quotation = store.createQuotation({
            leadId,
            rfqId,
            status: QuotationStatus.PENDING_APPROVAL,
            quotationNumber: `QT-${store.quotations.length + 1}-DEMO`,
            version: 1,
            subtotal: 0,
            taxAmount: 0,
            totalAmount: 0,
            currency: "INR",
            validityDays: payload.validityDays || 15,
            paymentTerms: payload.paymentTerms,
            deliveryTerms: payload.deliveryTerms,
            notes: payload.notes,
          });

          let totalAmount = 0;
          for (const item of payload.items || []) {
            const subtotal = item.unitPrice * item.quantity;
            const discountAmount = item.discount
              ? item.discountType === "PERCENTAGE"
                ? subtotal * (item.discount / 100)
                : item.discount
              : 0;
            const taxableAmount = subtotal - discountAmount;
            const taxAmount = Math.round(taxableAmount * 0.18);
            const itemTotal = taxableAmount + taxAmount;
            totalAmount += itemTotal;

            store.createQuotationItem({
              quotationId: quotation.id,
              productId: item.productId,
              productName: item.productName,
              size: item.size,
              pressureClass: item.pressureClass,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              discount: item.discount || 0,
              discountType: item.discountType,
              taxRate: 18,
              totalPrice: itemTotal,
            });
          }

          store.updateQuotation(quotation.id, {
            subtotal: totalAmount,
            taxAmount: Math.round(totalAmount * 0.18 / 1.18),
            totalAmount: totalAmount,
          });

          store.updateLead(leadId, {
            status: LeadStatus.QUOTATION_DRAFTED,
          });

          results.push(`Created quotation ${quotation.id} for ${leadId}`);
        }
        break;
      }
      case "APPROVE_QUOTE": {
        const payload = step.payload as any;
        const leadId = payload.leadId || currentLeadId;
        if (!leadId) break;
        const quotations = store.getQuotationsByLead(leadId);
        if (quotations.length > 0) {
          store.updateQuotation(quotations[0].id, {
            status: QuotationStatus.APPROVED,
            approvedBy: "MANAGER",
            approvedAt: store.getCurrentTime(),
          });
          results.push(`Approved quotation for ${leadId}`);
        }
        break;
      }
    }
  }

  return { scenario: scenario.name, steps: results };
}
