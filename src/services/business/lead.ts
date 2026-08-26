import {
  AIActionType,
  Lead,
  LeadSource,
  LeadStatus,
  CustomerIntent,
  Message,
  MessageDirection,
  RFQ,
  RFQStatus,
  Conversation,
  Company,
} from "@/types";
import { getStore } from "@/lib/store";
import { getAIProvider } from "@/services/providers/ai";
import { getLeadSourceProvider, ProcessedLead } from "@/services/providers/lead-source";
import { extractRequirements } from "@/services/ai/extraction";
import { classifyIntent } from "@/services/ai/classification";
import { createRFQ, getRequiredFields, updateRFQ } from "@/services/business/rfq";
import { calculateQualificationScore } from "@/services/business/qualification";

export interface ProcessIndiaMARTResult {
  company: Company;
  lead: Lead;
  conversation: Conversation;
  message: Message;
  extracted: Record<string, unknown>;
  missingFields: string[];
  aiResponse: Message;
}

export async function processIndiaMARTWebhook(
  payload: unknown
): Promise<ProcessIndiaMARTResult> {
  const store = getStore();
  const provider = getLeadSourceProvider();
  const ai = getAIProvider();

  const processed = await provider.processInboundLead(payload);

  if (!processed.valid) {
    throw new Error(
      `Invalid lead payload: ${processed.errors?.join(", ") || "Unknown error"}`
    );
  }

  const company = store.createCompany({
    name: processed.companyName,
    contactPerson: processed.contactName,
    phone: processed.phone,
    email: processed.email,
    city: undefined,
    state: undefined,
  });

  const lead = store.createLead({
    companyId: company.id,
    contactName: processed.contactName,
    contactEmail: processed.email,
    contactPhone: processed.phone,
    source: LeadSource.INDIAMART,
    status: LeadStatus.NEW,
    subject: processed.productHint || "IndiaMART Inquiry",
    description: processed.message,
  });

  const conversation = store.createConversation({
    leadId: lead.id,
    channelId: `indiamart-${company.id}`,
    channel: "indiamart",
    subject: processed.productHint || "IndiaMART Inquiry",
    isActive: true,
    messageCount: 0,
  });

  const customerMessage = store.createMessage({
    conversationId: conversation.id,
    leadId: lead.id,
    direction: MessageDirection.INBOUND,
    content: processed.message,
    channel: "indiamart",
    metadata: {
      rawPayload: processed.rawPayload,
    },
  });

  const extraction = await extractRequirements(processed.message);

  const productCategory = extraction.product || "general";
  const requiredFields = getRequiredFields(productCategory);
  const missingFields = await ai.identifyMissingFields(
    extraction.extractedFields,
    requiredFields
  );

  const rfq = createRFQ(lead.id, extraction.extractedFields);
  if (rfq) {
    updateRFQ(rfq.id, extraction.extractedFields);
  }

  const responseText = await ai.generateQualificationResponse(
    processed.contactName,
    extraction.extractedFields,
    missingFields
  );

  const aiResponse = store.createMessage({
    conversationId: conversation.id,
    leadId: lead.id,
    direction: MessageDirection.OUTBOUND,
    content: responseText,
    channel: "indiamart",
    metadata: {
      isAiGenerated: true,
      extractionConfidence: extraction.confidence,
      missingFields,
    },
  });

  const intentResult = await classifyIntent(processed.message);

  store.updateLead(lead.id, {
    status:
      missingFields.length > 0 ? LeadStatus.QUALIFYING : LeadStatus.QUALIFIED,
    intent: intentResult.intent,
    lastContactedAt: store.getCurrentTime(),
  });

  store.createAIAction({
    leadId: lead.id,
    conversationId: conversation.id,
    messageType: AIActionType.EXTRACT_REQUIREMENTS,
    input: processed.message,
    output: JSON.stringify(extraction.extractedFields),
    confidence: extraction.confidence,
    executedAt: store.getCurrentTime(),
  });

  return {
    company,
    lead: store.getLead(lead.id)!,
    conversation,
    message: customerMessage,
    extracted: extraction.extractedFields,
    missingFields,
    aiResponse,
  };
}

export interface RespondToLeadResult {
  lead: Lead;
  messages: Message[];
  extracted: Record<string, unknown>;
  missingFields: string[];
  aiResponse: Message;
  qualificationScore: number;
}

export async function respondToLead(
  leadId: string,
  customerMessage: string
): Promise<RespondToLeadResult> {
  const store = getStore();
  const ai = getAIProvider();

  const lead = store.getLead(leadId);
  if (!lead) {
    throw new Error(`Lead not found: ${leadId}`);
  }

  const conversations = store.getConversationsByLead(leadId);
  if (conversations.length === 0) {
    throw new Error(`No conversation found for lead: ${leadId}`);
  }
  const conversation = conversations[0];

  const inboundMsg = store.createMessage({
    conversationId: conversation.id,
    leadId: lead.id,
    direction: MessageDirection.INBOUND,
    content: customerMessage,
    channel: conversation.channel,
  });

  const allMessages = store.getMessagesByLead(leadId);
  const allText = allMessages.map((m) => m.content).join("\n");

  const extraction = await extractRequirements(allText);

  const existingRfqs = store.getRFQsByLead(leadId);
  const existingRfq = existingRfqs.length > 0 ? existingRfqs[0] : null;

  if (existingRfq) {
    updateRFQ(existingRfq.id, extraction.extractedFields);
  }

  const intentResult = await classifyIntent(customerMessage);

  const productCategory = extraction.product || "general";
  const requiredFields = getRequiredFields(productCategory);
  const missingFields = await ai.identifyMissingFields(
    extraction.extractedFields,
    requiredFields
  );

  let responseText: string;

  if (intentResult.confidence > 0.8 && missingFields.length === 0) {
    responseText =
      "I have all the information needed. Let me generate a quotation for you right away.";
  } else {
    responseText = await ai.generateQualificationResponse(
      lead.contactName,
      extraction.extractedFields,
      missingFields
    );
  }

  const aiResponseMsg = store.createMessage({
    conversationId: conversation.id,
    leadId: lead.id,
    direction: MessageDirection.OUTBOUND,
    content: responseText,
    channel: conversation.channel,
    metadata: {
      isAiGenerated: true,
      extractionConfidence: extraction.confidence,
      missingFields,
      intent: intentResult.intent,
    },
  });

  const qualification = calculateQualificationScore(lead, existingRfq);

  let newStatus = lead.status;
  if (
    lead.status === LeadStatus.NEW ||
    lead.status === LeadStatus.QUALIFYING
  ) {
    newStatus =
      missingFields.length > 0 ? LeadStatus.QUALIFYING : LeadStatus.QUALIFIED;
  }

  store.updateLead(lead.id, {
    status: newStatus,
    intent: intentResult.intent,
    score: qualification.score,
    lastContactedAt: store.getCurrentTime(),
  });

  store.createAIAction({
    leadId: lead.id,
    conversationId: conversation.id,
    messageType: AIActionType.CLASSIFY_RESPONSE,
    input: customerMessage,
    output: intentResult.intent,
    confidence: intentResult.confidence,
    executedAt: store.getCurrentTime(),
  });

  return {
    lead: store.getLead(leadId)!,
    messages: [inboundMsg, aiResponseMsg],
    extracted: extraction.extractedFields,
    missingFields,
    aiResponse: aiResponseMsg,
    qualificationScore: qualification.score,
  };
}

export function getLead(leadId: string) {
  const store = getStore();
  const lead = store.getLead(leadId);
  if (!lead) return null;

  const company = lead.companyId
    ? store.getCompany(lead.companyId)
    : null;
  const conversations = store.getConversationsByLead(leadId);
  const messages = store.getMessagesByLead(leadId);
  const rfqs = store.getRFQsByLead(leadId);
  const quotations = store.getQuotationsByLead(leadId);
  const followUps = store.getFollowUpsByLead(leadId);
  const escalations = store.getEscalationsByLead(leadId);

  return {
    lead,
    company,
    conversations,
    messages,
    rfqs,
    quotations,
    followUps,
    escalations,
  };
}

export function getAllLeads() {
  const store = getStore();
  return store.leads.map((lead) => {
    const company = lead.companyId
      ? store.getCompany(lead.companyId)
      : null;
    const messages = store.getMessagesByLead(lead.id);
    const rfqs = store.getRFQsByLead(lead.id);
    const quotations = store.getQuotationsByLead(lead.id);
    const latestMessage = messages.length > 0 ? messages[messages.length - 1] : null;

    return {
      lead,
      company,
      messageCount: messages.length,
      rfqCount: rfqs.length,
      quotationCount: quotations.length,
      latestMessage,
    };
  });
}

export function advanceTime(days: number) {
  const store = getStore();
  return store.advanceTime(days);
}
