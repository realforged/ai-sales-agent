export enum LeadStatus {
  NEW = "NEW",
  QUALIFYING = "QUALIFYING",
  QUALIFIED = "QUALIFIED",
  UNQUALIFIED = "UNQUALIFIED",
  QUOTATION_DRAFTED = "QUOTATION_DRAFTED",
  QUOTATION_SENT = "QUOTATION_SENT",
  NEGOTIATION = "NEGOTIATION",
  WON = "WON",
  LOST = "LOST",
  ESCALATED = "ESCALATED",
  FOLLOW_UP = "FOLLOW_UP",
  ARCHIVED = "ARCHIVED",
}

export enum LeadSource {
  INDIAMART = "INDIAMART",
  WEBSITE = "WEBSITE",
  WHATSAPP = "WHATSAPP",
  EMAIL = "EMAIL",
  CRM = "CRM",
  MANUAL = "MANUAL",
}

export enum MessageDirection {
  INBOUND = "INBOUND",
  OUTBOUND = "OUTBOUND",
}

export enum RFQStatus {
  DRAFT = "DRAFT",
  INCOMPLETE = "INCOMPLETE",
  COMPLETE = "COMPLETE",
  EXPIRED = "EXPIRED",
}

export enum QuotationStatus {
  DRAFT = "DRAFT",
  PENDING_APPROVAL = "PENDING_APPROVAL",
  APPROVED = "APPROVED",
  SENT = "SENT",
  ACCEPTED = "ACCEPTED",
  REJECTED = "REJECTED",
  EXPIRED = "EXPIRED",
}

export enum CustomerIntent {
  INTERESTED = "INTERESTED",
  READY_TO_BUY = "READY_TO_BUY",
  PRICE_OBJECTION = "PRICE_OBJECTION",
  REVISION_REQUEST = "REVISION_REQUEST",
  TECHNICAL_QUESTION = "TECHNICAL_QUESTION",
  APPROVAL_PENDING = "APPROVAL_PENDING",
  TIMING_DELAY = "TIMING_DELAY",
  NOT_INTERESTED = "NOT_INTERESTED",
  UNKNOWN = "UNKNOWN",
}

export enum EscalationPriority {
  LOW = "LOW",
  MEDIUM = "MEDIUM",
  HIGH = "HIGH",
  URGENT = "URGENT",
}

export enum EscalationStatus {
  OPEN = "OPEN",
  ACKNOWLEDGED = "ACKNOWLEDGED",
  RESOLVED = "RESOLVED",
  DISMISSED = "DISMISSED",
}

export enum FollowUpStatus {
  PENDING = "PENDING",
  SENT = "SENT",
  RESPONSE_RECEIVED = "RESPONSE_RECEIVED",
  OVERDUE = "OVERDUE",
  CANCELLED = "CANCELLED",
}

export enum AIActionType {
  EXTRACT_REQUIREMENTS = "EXTRACT_REQUIREMENTS",
  ASK_MISSING_INFO = "ASK_MISSING_INFO",
  CLASSIFY_RESPONSE = "CLASSIFY_RESPONSE",
  RECOMMEND_ACTION = "RECOMMEND_ACTION",
  GENERATE_QUOTE = "GENERATE_QUOTE",
  SUMMARIZE = "SUMMARIZE",
}

export interface Company {
  id: string;
  name: string;
  gstNumber?: string;
  contactPerson: string;
  email?: string;
  phone: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  industry?: string;
  website?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Lead {
  id: string;
  companyId?: string;
  contactName: string;
  contactEmail?: string;
  contactPhone: string;
  source: LeadSource;
  status: LeadStatus;
  subject?: string;
  description?: string;
  assignedTo?: string;
  intent?: CustomerIntent;
  score?: number;
  tags?: string[];
  createdAt: Date;
  updatedAt: Date;
  lastContactedAt?: Date;
  nextFollowUpAt?: Date;
}

export interface Message {
  id: string;
  conversationId: string;
  leadId: string;
  direction: MessageDirection;
  content: string;
  rawContent?: string;
  channel: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

export interface Conversation {
  id: string;
  leadId: string;
  channelId: string;
  channel: string;
  subject?: string;
  isActive: boolean;
  lastMessageAt?: Date;
  messageCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface RFQField {
  id: string;
  rfqId: string;
  fieldName: string;
  fieldValue?: string;
  isRequired: boolean;
  isExtracted: boolean;
  source?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface RFQ {
  id: string;
  leadId: string;
  conversationId?: string;
  status: RFQStatus;
  productCategory?: string;
  productName?: string;
  material?: string;
  quantity?: number;
  unit?: string;
  size?: string;
  pressureClass?: string;
  application?: string;
  deliveryDate?: string;
  deliveryLocation?: string;
  specialRequirements?: string;
  rawText?: string;
  completenessScore: number;
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  description: string;
  category: string;
  material: string;
  availableSizes: string[];
  availablePressureClasses: string[];
  applications: string[];
  basePrice: number;
  leadTimeDays: number;
  moq: number;
  specifications: Record<string, string>;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface QuotationItem {
  id: string;
  quotationId: string;
  productId?: string;
  productName: string;
  description?: string;
  size?: string;
  pressureClass?: string;
  quantity: number;
  unitPrice: number;
  discount?: number;
  discountType?: "PERCENTAGE" | "FIXED";
  taxRate: number;
  totalPrice: number;
  leadTimeDays?: number;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Quotation {
  id: string;
  leadId: string;
  rfqId?: string;
  companyId?: string;
  status: QuotationStatus;
  quotationNumber: string;
  version: number;
  subtotal: number;
  discount?: number;
  taxAmount: number;
  totalAmount: number;
  currency: string;
  validityDays: number;
  paymentTerms?: string;
  deliveryTerms?: string;
  notes?: string;
  internalNotes?: string;
  approvedBy?: string;
  approvedAt?: Date;
  sentAt?: Date;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface FollowUp {
  id: string;
  leadId: string;
  quotationId?: string;
  status: FollowUpStatus;
  type: "EMAIL" | "WHATSAPP" | "PHONE" | "SMS";
  scheduledAt: Date;
  message?: string;
  sentAt?: Date;
  responseAt?: Date;
  responseContent?: string;
  createdBy: "AI" | "HUMAN";
  createdAt: Date;
  updatedAt: Date;
}

export interface Escalation {
  id: string;
  leadId: string;
  quotationId?: string;
  conversationId?: string;
  priority: EscalationPriority;
  status: EscalationStatus;
  reason: string;
  description?: string;
  assignedTo?: string;
  resolvedBy?: string;
  resolvedAt?: Date;
  resolutionNotes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AIAction {
  id: string;
  leadId: string;
  conversationId?: string;
  messageType: AIActionType;
  input?: string;
  output?: string;
  confidence?: number;
  metadata?: Record<string, unknown>;
  executedAt: Date;
  duration?: number;
}
