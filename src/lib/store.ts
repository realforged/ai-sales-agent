import {
  Company,
  Lead,
  Message,
  Conversation,
  RFQ,
  RFQField,
  Product,
  Quotation,
  QuotationItem,
  FollowUp,
  Escalation,
  AIAction,
  LeadStatus,
  LeadSource,
  RFQStatus,
  QuotationStatus,
  FollowUpStatus,
  EscalationStatus,
} from "@/types";

class DataStore {
  companies: Company[] = [];
  leads: Lead[] = [];
  conversations: Conversation[] = [];
  messages: Message[] = [];
  rfqs: RFQ[] = [];
  rfqFields: RFQField[] = [];
  products: Product[] = [];
  quotations: Quotation[] = [];
  quotationItems: QuotationItem[] = [];
  followUps: FollowUp[] = [];
  escalations: Escalation[] = [];
  aiActions: AIAction[] = [];

  private currentTime: Date;

  constructor() {
    this.currentTime = new Date("2026-08-25T10:00:00+05:30");
  }

  getCurrentTime(): Date {
    return new Date(this.currentTime);
  }

  advanceTime(days: number): Date {
    this.currentTime = new Date(
      this.currentTime.getTime() + days * 24 * 60 * 60 * 1000
    );
    return this.getCurrentTime();
  }

  advanceTimeHours(hours: number): Date {
    this.currentTime = new Date(
      this.currentTime.getTime() + hours * 60 * 60 * 1000
    );
    return this.getCurrentTime();
  }

  resetTime(): void {
    this.currentTime = new Date("2026-08-25T10:00:00+05:30");
  }

  // Company
  createCompany(data: Omit<Company, "id" | "createdAt" | "updatedAt">): Company {
    const now = this.getCurrentTime();
    const company: Company = {
      id: `CO-${String(this.companies.length + 1).padStart(3, "0")}`,
      ...data,
      createdAt: now,
      updatedAt: now,
    };
    this.companies.push(company);
    this.persist();
    return company;
  }

  getCompany(id: string): Company | undefined {
    return this.companies.find((c) => c.id === id);
  }

  updateCompany(id: string, data: Partial<Company>): Company | undefined {
    const idx = this.companies.findIndex((c) => c.id === id);
    if (idx === -1) return undefined;
    this.companies[idx] = {
      ...this.companies[idx],
      ...data,
      id,
      updatedAt: this.getCurrentTime(),
    };
    this.persist();
    return this.companies[idx];
  }

  // Lead
  createLead(data: Omit<Lead, "id" | "createdAt" | "updatedAt">): Lead {
    const now = this.getCurrentTime();
    const lead: Lead = {
      id: `LEAD-${String(this.leads.length + 1).padStart(3, "0")}`,
      ...data,
      createdAt: now,
      updatedAt: now,
    };
    this.leads.push(lead);
    this.persist();
    return lead;
  }

  getLead(id: string): Lead | undefined {
    return this.leads.find((l) => l.id === id);
  }

  getLeadsByStatus(status: LeadStatus): Lead[] {
    return this.leads.filter((l) => l.status === status);
  }

  updateLead(id: string, data: Partial<Lead>): Lead | undefined {
    const idx = this.leads.findIndex((l) => l.id === id);
    if (idx === -1) return undefined;
    this.leads[idx] = {
      ...this.leads[idx],
      ...data,
      id,
      updatedAt: this.getCurrentTime(),
    };
    this.persist();
    return this.leads[idx];
  }

  // Conversation
  createConversation(data: Omit<Conversation, "id" | "createdAt" | "updatedAt">): Conversation {
    const now = this.getCurrentTime();
    const conversation: Conversation = {
      id: `CONV-${String(this.conversations.length + 1).padStart(3, "0")}`,
      ...data,
      createdAt: now,
      updatedAt: now,
    };
    this.conversations.push(conversation);
    this.persist();
    return conversation;
  }

  getConversation(id: string): Conversation | undefined {
    return this.conversations.find((c) => c.id === id);
  }

  getConversationsByLead(leadId: string): Conversation[] {
    return this.conversations.filter((c) => c.leadId === leadId);
  }

  updateConversation(id: string, data: Partial<Conversation>): Conversation | undefined {
    const idx = this.conversations.findIndex((c) => c.id === id);
    if (idx === -1) return undefined;
    this.conversations[idx] = {
      ...this.conversations[idx],
      ...data,
      id,
      updatedAt: this.getCurrentTime(),
    };
    this.persist();
    return this.conversations[idx];
  }

  // Message
  createMessage(data: Omit<Message, "id" | "createdAt">): Message {
    const now = this.getCurrentTime();
    const message: Message = {
      id: `MSG-${String(this.messages.length + 1).padStart(3, "0")}`,
      ...data,
      createdAt: now,
    };
    this.messages.push(message);
    this.updateConversation(data.conversationId, {
      lastMessageAt: now,
      messageCount: (this.getConversation(data.conversationId)?.messageCount ?? 0) + 1,
    });
    this.persist();
    return message;
  }

  getMessagesByConversation(conversationId: string): Message[] {
    return this.messages.filter((m) => m.conversationId === conversationId);
  }

  getMessagesByLead(leadId: string): Message[] {
    return this.messages.filter((m) => m.leadId === leadId);
  }

  // RFQ
  createRFQ(data: Omit<RFQ, "id" | "createdAt" | "updatedAt">): RFQ {
    const now = this.getCurrentTime();
    const rfq: RFQ = {
      id: `RFQ-${String(this.rfqs.length + 1).padStart(3, "0")}`,
      ...data,
      createdAt: now,
      updatedAt: now,
    };
    this.rfqs.push(rfq);
    this.persist();
    return rfq;
  }

  getRFQ(id: string): RFQ | undefined {
    return this.rfqs.find((r) => r.id === id);
  }

  getRFQsByLead(leadId: string): RFQ[] {
    return this.rfqs.filter((r) => r.leadId === leadId);
  }

  updateRFQ(id: string, data: Partial<RFQ>): RFQ | undefined {
    const idx = this.rfqs.findIndex((r) => r.id === id);
    if (idx === -1) return undefined;
    this.rfqs[idx] = {
      ...this.rfqs[idx],
      ...data,
      id,
      updatedAt: this.getCurrentTime(),
    };
    this.persist();
    return this.rfqs[idx];
  }

  // RFQ Field
  createRFQField(data: Omit<RFQField, "id" | "createdAt" | "updatedAt">): RFQField {
    const now = this.getCurrentTime();
    const field: RFQField = {
      id: `RFLD-${String(this.rfqFields.length + 1).padStart(3, "0")}`,
      ...data,
      createdAt: now,
      updatedAt: now,
    };
    this.rfqFields.push(field);
    this.persist();
    return field;
  }

  getRFQFields(rfqId: string): RFQField[] {
    return this.rfqFields.filter((f) => f.rfqId === rfqId);
  }

  updateRFQField(id: string, data: Partial<RFQField>): RFQField | undefined {
    const idx = this.rfqFields.findIndex((f) => f.id === id);
    if (idx === -1) return undefined;
    this.rfqFields[idx] = {
      ...this.rfqFields[idx],
      ...data,
      id,
      updatedAt: this.getCurrentTime(),
    };
    this.persist();
    return this.rfqFields[idx];
  }

  // Product
  createProduct(data: Omit<Product, "id" | "createdAt" | "updatedAt">): Product {
    const now = this.getCurrentTime();
    const product: Product = {
      id: `PRD-${String(this.products.length + 1).padStart(3, "0")}`,
      ...data,
      createdAt: now,
      updatedAt: now,
    };
    this.products.push(product);
    this.persist();
    return product;
  }

  getProduct(id: string): Product | undefined {
    return this.products.find((p) => p.id === id);
  }

  getProductBySKU(sku: string): Product | undefined {
    return this.products.find((p) => p.sku === sku);
  }

  searchProducts(query: string): Product[] {
    const lower = query.toLowerCase();
    return this.products.filter(
      (p) =>
        p.isActive &&
        (p.name.toLowerCase().includes(lower) ||
          p.sku.toLowerCase().includes(lower) ||
          p.material.toLowerCase().includes(lower) ||
          p.description.toLowerCase().includes(lower))
    );
  }

  // Quotation
  createQuotation(data: Omit<Quotation, "id" | "createdAt" | "updatedAt">): Quotation {
    const now = this.getCurrentTime();
    const quotation: Quotation = {
      id: `QT-${String(this.quotations.length + 1).padStart(3, "0")}`,
      ...data,
      createdAt: now,
      updatedAt: now,
    };
    this.quotations.push(quotation);
    this.persist();
    return quotation;
  }

  getQuotation(id: string): Quotation | undefined {
    return this.quotations.find((q) => q.id === id);
  }

  getQuotationsByLead(leadId: string): Quotation[] {
    return this.quotations.filter((q) => q.leadId === leadId);
  }

  updateQuotation(id: string, data: Partial<Quotation>): Quotation | undefined {
    const idx = this.quotations.findIndex((q) => q.id === id);
    if (idx === -1) return undefined;
    this.quotations[idx] = {
      ...this.quotations[idx],
      ...data,
      id,
      updatedAt: this.getCurrentTime(),
    };
    this.persist();
    return this.quotations[idx];
  }

  // Quotation Item
  createQuotationItem(data: Omit<QuotationItem, "id" | "createdAt" | "updatedAt">): QuotationItem {
    const now = this.getCurrentTime();
    const item: QuotationItem = {
      id: `QTI-${String(this.quotationItems.length + 1).padStart(3, "0")}`,
      ...data,
      createdAt: now,
      updatedAt: now,
    };
    this.quotationItems.push(item);
    this.persist();
    return item;
  }

  getQuotationItems(quotationId: string): QuotationItem[] {
    return this.quotationItems.filter((i) => i.quotationId === quotationId);
  }

  // Follow-up
  createFollowUp(data: Omit<FollowUp, "id" | "createdAt" | "updatedAt">): FollowUp {
    const now = this.getCurrentTime();
    const followUp: FollowUp = {
      id: `FU-${String(this.followUps.length + 1).padStart(3, "0")}`,
      ...data,
      createdAt: now,
      updatedAt: now,
    };
    this.followUps.push(followUp);
    this.persist();
    return followUp;
  }

  getFollowUpsByLead(leadId: string): FollowUp[] {
    return this.followUps.filter((f) => f.leadId === leadId);
  }

  getPendingFollowUps(): FollowUp[] {
    return this.followUps.filter((f) => f.status === FollowUpStatus.PENDING);
  }

  updateFollowUp(id: string, data: Partial<FollowUp>): FollowUp | undefined {
    const idx = this.followUps.findIndex((f) => f.id === id);
    if (idx === -1) return undefined;
    this.followUps[idx] = {
      ...this.followUps[idx],
      ...data,
      id,
      updatedAt: this.getCurrentTime(),
    };
    this.persist();
    return this.followUps[idx];
  }

  // Escalation
  createEscalation(data: Omit<Escalation, "id" | "createdAt" | "updatedAt">): Escalation {
    const now = this.getCurrentTime();
    const escalation: Escalation = {
      id: `ESC-${String(this.escalations.length + 1).padStart(3, "0")}`,
      ...data,
      createdAt: now,
      updatedAt: now,
    };
    this.escalations.push(escalation);
    this.persist();
    return escalation;
  }

  getEscalationsByLead(leadId: string): Escalation[] {
    return this.escalations.filter((e) => e.leadId === leadId);
  }

  getOpenEscalations(): Escalation[] {
    return this.escalations.filter((e) => e.status === EscalationStatus.OPEN);
  }

  updateEscalation(id: string, data: Partial<Escalation>): Escalation | undefined {
    const idx = this.escalations.findIndex((e) => e.id === id);
    if (idx === -1) return undefined;
    this.escalations[idx] = {
      ...this.escalations[idx],
      ...data,
      id,
      updatedAt: this.getCurrentTime(),
    };
    this.persist();
    return this.escalations[idx];
  }

  // AI Action
  createAIAction(data: Omit<AIAction, "id">): AIAction {
    const action: AIAction = {
      id: `AIA-${String(this.aiActions.length + 1).padStart(3, "0")}`,
      ...data,
    };
    this.aiActions.push(action);
    this.persist();
    return action;
  }

  getAIActionsByLead(leadId: string): AIAction[] {
    return this.aiActions.filter((a) => a.leadId === leadId);
  }

  // Reset
  reset(): void {
    this.companies = [];
    this.leads = [];
    this.conversations = [];
    this.messages = [];
    this.rfqs = [];
    this.rfqFields = [];
    this.products = [];
    this.quotations = [];
    this.quotationItems = [];
    this.followUps = [];
    this.escalations = [];
    this.aiActions = [];
    this.resetTime();
    this.seed();
    this.persist();
  }

  seed(): void {
    this.seedProducts();
    this.seedCompany();
  }

  // Persistence for client-side (localStorage)
  persist(): void {
    if (typeof window === "undefined") return;
    try {
      const data = {
        companies: this.companies,
        leads: this.leads,
        conversations: this.conversations,
        messages: this.messages,
        rfqs: this.rfqs,
        rfqFields: this.rfqFields,
        products: this.products,
        quotations: this.quotations,
        quotationItems: this.quotationItems,
        followUps: this.followUps,
        escalations: this.escalations,
        aiActions: this.aiActions,
        currentTime: this.currentTime.toISOString(),
      };
      window.localStorage.setItem("ai-sales-agent-store", JSON.stringify(data));
    } catch {
      // localStorage full or unavailable — silent fail
    }
  }

  hydrate(): void {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem("ai-sales-agent-store");
      if (!raw) return;
      const data = JSON.parse(raw);
      this.companies = data.companies || [];
      this.leads = data.leads || [];
      this.conversations = data.conversations || [];
      this.messages = data.messages || [];
      this.rfqs = data.rfqs || [];
      this.rfqFields = data.rfqFields || [];
      this.products = data.products || [];
      this.quotations = data.quotations || [];
      this.quotationItems = data.quotationItems || [];
      this.followUps = data.followUps || [];
      this.escalations = data.escalations || [];
      this.aiActions = data.aiActions || [];
      if (data.currentTime) this.currentTime = new Date(data.currentTime);
    } catch {
      // Corrupted data — start fresh
    }
  }

  private seedCompany(): void {
    this.createCompany({
      name: "ABC Engineering Pvt Ltd",
      gstNumber: "27AABCA1234M1Z5",
      contactPerson: "Rajesh Kumar",
      email: "rajesh@abcengineering.in",
      phone: "+91 98765 43210",
      address: "Plot No. 42, MIDC Industrial Area",
      city: "Pune",
      state: "Maharashtra",
      pincode: "411018",
      industry: "Manufacturing",
      website: "https://abcengineering.in",
    });
  }

  private seedProducts(): void {
    const now = this.getCurrentTime();

    const products: Omit<Product, "id" | "createdAt" | "updatedAt">[] = [
      {
        sku: "VLV-BV-304",
        name: "SS304 Ball Valve",
        description:
          "Stainless Steel 304 Ball Valve for general purpose fluid control applications. Full bore design with blowout-proof stem.",
        category: "valves",
        material: "SS304",
        availableSizes: ['1"', '1.5"', '2"', '3"', '4"'],
        availablePressureClasses: ["Class 150", "Class 300"],
        applications: [
          "Water Treatment",
          "Food & Beverage",
          "Pharmaceutical",
          "Chemical Processing",
          "HVAC Systems",
        ],
        basePrice: 1850,
        leadTimeDays: 7,
        moq: 10,
        specifications: {
          "Body Material": "SS304 (ASTM A351 CF8)",
          "Ball Material": "SS304",
          "Seat Material": "PTFE",
          "Stem Material": "SS304",
          "End Connection": "Socket Weld / Threaded / Flanged",
          "Temperature Range": "-20°C to 180°C",
          "Operation": "Lever / Actuated",
          Standard: "API 608 / BS 5351",
        },
        isActive: true,
      },
      {
        sku: "VLV-BV-316",
        name: "SS316 Ball Valve",
        description:
          "Stainless Steel 316 Ball Valve for corrosive environments. Superior chemical resistance with molybdenum content.",
        category: "valves",
        material: "SS316",
        availableSizes: ['1"', '1.5"', '2"', '3"', '4"'],
        availablePressureClasses: ["Class 150", "Class 300"],
        applications: [
          "Chemical Processing",
          "Marine Applications",
          "Pharmaceutical",
          "Pulp & Paper",
          "Oil & Gas",
        ],
        basePrice: 2650,
        leadTimeDays: 10,
        moq: 10,
        specifications: {
          "Body Material": "SS316 (ASTM A351 CF8M)",
          "Ball Material": "SS316",
          "Seat Material": "PTFE / RPTFE",
          "Stem Material": "SS316",
          "End Connection": "Socket Weld / Threaded / Flanged",
          "Temperature Range": "-20°C to 200°C",
          "Operation": "Lever / Actuated",
          Standard: "API 608 / BS 5351",
        },
        isActive: true,
      },
      {
        sku: "VLV-BF-304",
        name: "SS304 Butterfly Valve",
        description:
          "Stainless Steel 304 Butterfly Valve with wafer-style body design. Suitable for flow regulation in large-diameter piping.",
        category: "valves",
        material: "SS304",
        availableSizes: ['2"', '3"', '4"', '6"', '8"'],
        availablePressureClasses: ["Class 150"],
        applications: [
          "Water Treatment",
          "HVAC Systems",
          "Fire Protection",
          "Chemical Processing",
          "Food & Beverage",
        ],
        basePrice: 3200,
        leadTimeDays: 10,
        moq: 5,
        specifications: {
          "Body Material": "SS304 (ASTM A351 CF8)",
          "Disc Material": "SS304",
          "Seat Material": "EPDM / PTFE",
          "Stem Material": "SS410",
          "Design": "Wafer / Lug",
          "Temperature Range": "-10°C to 150°C",
          "Operation": "Lever / Gear / Actuated",
          Standard: "API 609 / BS EN 593",
        },
        isActive: true,
      },
      {
        sku: "VLV-BF-316",
        name: "SS316 Butterfly Valve",
        description:
          "Stainless Steel 316 Butterfly Valve for aggressive chemical service. Enhanced corrosion resistance.",
        category: "valves",
        material: "SS316",
        availableSizes: ['2"', '3"', '4"', '6"', '8"'],
        availablePressureClasses: ["Class 150"],
        applications: [
          "Chemical Processing",
          "Marine Applications",
          "Pharmaceutical",
          "Desalination",
          "Pulp & Paper",
        ],
        basePrice: 4800,
        leadTimeDays: 14,
        moq: 5,
        specifications: {
          "Body Material": "SS316 (ASTM A351 CF8M)",
          "Disc Material": "SS316",
          "Seat Material": "EPDM / PTFE",
          "Stem Material": "SS316",
          "Design": "Wafer / Lug",
          "Temperature Range": "-10°C to 180°C",
          "Operation": "Lever / Gear / Actuated",
          Standard: "API 609 / BS EN 593",
        },
        isActive: true,
      },
      {
        sku: "VLV-GT-CS",
        name: "Carbon Steel Gate Valve",
        description:
          "Carbon Steel Gate Valve for high-pressure and high-temperature applications. Rising stem design with bolted bonnet.",
        category: "valves",
        material: "Carbon Steel",
        availableSizes: ['2"', '3"', '4"', '6"', '8"', '10"'],
        availablePressureClasses: ["Class 150", "Class 300"],
        applications: [
          "Oil & Gas",
          "Power Generation",
          "Water Distribution",
          "Fire Protection",
          "Mining",
        ],
        basePrice: 1200,
        leadTimeDays: 5,
        moq: 20,
        specifications: {
          "Body Material": "Carbon Steel (ASTM A216 WCB)",
          "Disc Material": "Carbon Steel",
          "Seat Material": "13% Cr Steel",
          "Stem Material": "13% Cr Steel",
          "Bonnet": "Bolted",
          "End Connection": "Flanged RF",
          "Temperature Range": "-29°C to 425°C",
          "Operation": "Handwheel / Actuated",
          Standard: "API 600 / BS EN 12834",
        },
        isActive: true,
      },
    ];

    products.forEach((p) => {
      const product: Product = {
        id: `PRD-${String(this.products.length + 1).padStart(3, "0")}`,
        ...p,
        createdAt: now,
        updatedAt: now,
      };
      this.products.push(product);
    });
  }
}

const globalForStore = globalThis as unknown as {
  __dataStore: DataStore | undefined;
};

export function getStore(): DataStore {
  if (!globalForStore.__dataStore) {
    globalForStore.__dataStore = new DataStore();
    if (typeof window !== "undefined") {
      const raw = window.localStorage.getItem("ai-sales-agent-store");
      if (raw) {
        globalForStore.__dataStore.hydrate();
      } else {
        globalForStore.__dataStore.seed();
        globalForStore.__dataStore.persist();
      }
    } else {
      globalForStore.__dataStore.seed();
    }
  }
  return globalForStore.__dataStore;
}
