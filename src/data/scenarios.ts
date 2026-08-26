import {
  LeadSource,
  LeadStatus,
  RFQStatus,
  QuotationStatus,
  CustomerIntent,
  EscalationPriority,
  FollowUpStatus,
} from "@/types";

export interface ScenarioStep {
  type: "WEBHOOK" | "CUSTOMER_MESSAGE" | "ADVANCE_TIME" | "APPROVE_QUOTE" | "SEND_QUOTE";
  payload: Record<string, unknown>;
  description: string;
}

export interface Scenario {
  id: string;
  name: string;
  description: string;
  steps: ScenarioStep[];
}

export const scenarios: Scenario[] = [
  {
    id: "scenario-1",
    name: "Complete Enquiry",
    description:
      "Full IndiaMART enquiry with all required information. AI extracts requirements, classifies intent as ready-to-buy, matches product, and generates quotation.",
    steps: [
      {
        type: "WEBHOOK",
        payload: {
          source: LeadSource.INDIAMART,
          contactName: "Vikram Patel",
          contactPhone: "+91 99887 76655",
          contactEmail: "vikram@stellartech.in",
          companyName: "Stellar Technologies",
          subject: "Enquiry for SS304 Ball Valves",
          message:
            "We need 50 nos SS304 Ball Valves size 2 inch Class 150 for our water treatment plant. Need delivery in 2 weeks to Chennai. Please share best price.",
        },
        description: "IndiaMART webhook receives complete enquiry with all details",
      },
      {
        type: "ADVANCE_TIME",
        payload: { hours: 0.5 },
        description: "AI processes and extracts requirements from the enquiry",
      },
      {
        type: "SEND_QUOTE",
        payload: {
          leadId: "LEAD-001",
          items: [
            {
              productId: "PRD-001",
              productName: "SS304 Ball Valve",
              size: '2"',
              pressureClass: "Class 150",
              quantity: 50,
              unitPrice: 1750,
              discount: 5,
              discountType: "PERCENTAGE",
            },
          ],
          notes: "Price inclusive of standard packaging. GST additional.",
          paymentTerms: "50% advance, 50% before dispatch",
          deliveryTerms: "Ex-Works Pune, freight extra",
          validityDays: 15,
        },
        description: "AI drafts quotation with competitive pricing",
      },
    ],
  },
  {
    id: "scenario-2",
    name: "Missing Technical Info",
    description:
      "Enquiry received without application details and expected delivery date. AI asks clarifying questions to complete the RFQ.",
    steps: [
      {
        type: "WEBHOOK",
        payload: {
          source: LeadSource.WEBSITE,
          contactName: "Anita Sharma",
          contactPhone: "+91 88776 65544",
          contactEmail: "anita@pumpcraft.in",
          companyName: "PumpCraft Industries",
          subject: "Butterfly Valve Enquiry",
          message:
            "Hi, we are looking for SS316 Butterfly Valves. Can you share pricing for sizes 4 inch and 6 inch?",
        },
        description: "Website form submission with incomplete information",
      },
      {
        type: "ADVANCE_TIME",
        payload: { hours: 0.5 },
        description: "AI processes enquiry and identifies missing information",
      },
      {
        type: "CUSTOMER_MESSAGE",
        payload: {
          leadId: "LEAD-002",
          message: "Thank you for your enquiry, Anita. To provide you with an accurate quotation, I need a few more details:\n\n1. What is the intended application? (e.g., chemical processing, water treatment)\n2. What quantity do you require for each size?\n3. What is your expected delivery date and location?\n4. Do you need a specific pressure class?",
          direction: "OUTBOUND",
          isAI: true,
        },
        description: "AI asks missing information",
      },
      {
        type: "ADVANCE_TIME",
        payload: { days: 1 },
        description: "Customer takes time to respond",
      },
      {
        type: "CUSTOMER_MESSAGE",
        payload: {
          leadId: "LEAD-002",
          message:
            "Application is chemical processing (dilute acids). Need 20 pcs of 4 inch and 10 pcs of 6 inch. Delivery within 3 weeks to Mumbai. Class 150 is fine.",
          direction: "INBOUND",
        },
        description: "Customer provides the missing details",
      },
      {
        type: "ADVANCE_TIME",
        payload: { hours: 0.5 },
        description: "AI updates RFQ and prepares quotation",
      },
      {
        type: "SEND_QUOTE",
        payload: {
          leadId: "LEAD-002",
          items: [
            {
              productId: "PRD-004",
              productName: "SS316 Butterfly Valve",
              size: '4"',
              pressureClass: "Class 150",
              quantity: 20,
              unitPrice: 4600,
              discount: 5,
              discountType: "PERCENTAGE",
            },
            {
              productId: "PRD-004",
              productName: "SS316 Butterfly Valve",
              size: '6"',
              pressureClass: "Class 150",
              quantity: 10,
              unitPrice: 5200,
              discount: 5,
              discountType: "PERCENTAGE",
            },
          ],
          notes: "Suitable for dilute acid service. Seats available in PTFE for chemical compatibility.",
          paymentTerms: "100% advance for first order",
          deliveryTerms: "FOB Mumbai",
          validityDays: 15,
        },
        description: "AI generates quotation with complete information",
      },
    ],
  },
  {
    id: "scenario-3",
    name: "Price Objection",
    description:
      "Customer receives a quotation but objects to the pricing. AI attempts to address the concern and then escalates to a human sales manager.",
    steps: [
      {
        type: "WEBHOOK",
        payload: {
          source: LeadSource.INDIAMART,
          contactName: "Sanjay Mehta",
          contactPhone: "+91 77665 54433",
          contactEmail: "sanjay@mehtarail.in",
          companyName: "Mehta Rail Components",
          subject: "Gate Valve Bulk Order",
          message:
            "Required 200 nos Carbon Steel Gate Valves 4 inch Class 300. Immediate requirement. Please send quotation urgently.",
        },
        description: "IndiaMART enquiry for bulk gate valves",
      },
      {
        type: "ADVANCE_TIME",
        payload: { hours: 1 },
        description: "AI processes, qualifies lead, and generates quotation",
      },
      {
        type: "SEND_QUOTE",
        payload: {
          leadId: "LEAD-003",
          items: [
            {
              productId: "PRD-005",
              productName: "Carbon Steel Gate Valve",
              size: '4"',
              pressureClass: "Class 300",
              quantity: 200,
              unitPrice: 1800,
              discount: 0,
            },
          ],
          notes: "Bulk order pricing. Delivery schedule to be confirmed.",
          paymentTerms: "30% advance, balance on delivery",
          validityDays: 10,
        },
        description: "AI generates quotation for bulk order",
      },
      {
        type: "ADVANCE_TIME",
        payload: { hours: 2 },
        description: "Time for customer to review quote",
      },
      {
        type: "CUSTOMER_MESSAGE",
        payload: {
          leadId: "LEAD-003",
          message:
            "Your price is too high. We are getting Rs 1500 per piece from another vendor. Can you reduce the price? This is a repeat order and we expect better rates.",
          direction: "INBOUND",
        },
        description: "Customer objects to pricing, references competitor quote",
      },
      {
        type: "ADVANCE_TIME",
        payload: { hours: 0.5 },
        description: "AI classifies intent as price objection",
      },
      {
        type: "CUSTOMER_MESSAGE",
        payload: {
          leadId: "LEAD-003",
          message:
            "Thank you for the feedback, Sanjay. I understand price is an important factor. Our valves come with API 600 certification and carry a 2-year warranty which ensures reliability.\n\nHowever, for a bulk order of 200 units, I would like to connect you with our sales manager who can discuss special pricing. Shall I arrange a call?",
          direction: "OUTBOUND",
          isAI: true,
        },
        description: "AI attempts to address objection and escalates",
      },
      {
        type: "ADVANCE_TIME",
        payload: { hours: 0.5 },
        description: "AI creates escalation to sales manager",
      },
    ],
  },
  {
    id: "scenario-4",
    name: "No Response Follow-up",
    description:
      "Quotation is sent but customer does not respond. AI recommends and schedules follow-ups. Time is advanced to show overdue status.",
    steps: [
      {
        type: "WEBHOOK",
        payload: {
          source: LeadSource.WHATSAPP,
          contactName: "Priya Nair",
          contactPhone: "+91 66554 43322",
          contactEmail: "priya@nairengg.com",
          companyName: "Nair Engineering Works",
          subject: "Ball Valve Enquiry via WhatsApp",
          message:
            "Hello, we need 30 SS316 Ball Valves 1.5 inch for our pharma plant. Can you send quotation?",
        },
        description: "WhatsApp enquiry received",
      },
      {
        type: "ADVANCE_TIME",
        payload: { hours: 1 },
        description: "AI processes and prepares quotation",
      },
      {
        type: "SEND_QUOTE",
        payload: {
          leadId: "LEAD-004",
          items: [
            {
              productId: "PRD-002",
              productName: "SS316 Ball Valve",
              size: '1.5"',
              pressureClass: "Class 150",
              quantity: 30,
              unitPrice: 2500,
              discount: 0,
            },
          ],
          notes: "Pharma grade. Certificate of Material Test Report provided.",
          paymentTerms: "100% advance",
          validityDays: 15,
        },
        description: "AI sends quotation via WhatsApp",
      },
      {
        type: "ADVANCE_TIME",
        payload: { days: 3 },
        description: "3 days pass without any response from customer",
      },
      {
        type: "CUSTOMER_MESSAGE",
        payload: {
          leadId: "LEAD-004",
          message:
            "Hi Priya, this is a follow-up on the quotation we shared on [date] for 30 nos SS316 Ball Valves (1.5 inch). The offer is valid till [date]. Please let us know if you have any questions or need any modifications. We are happy to assist!",
          direction: "OUTBOUND",
          isAI: true,
        },
        description: "AI sends first follow-up message",
      },
      {
        type: "ADVANCE_TIME",
        payload: { days: 4 },
        description: "4 more days pass, still no response",
      },
      {
        type: "CUSTOMER_MESSAGE",
        payload: {
          leadId: "LEAD-004",
          message:
            "Hello Priya, just a gentle reminder about our quotation for SS316 Ball Valves. The offer expires in 2 days. If you have any concerns or if the requirements have changed, please do let us know. We can also arrange a call with our technical team if needed.",
          direction: "OUTBOUND",
          isAI: true,
        },
        description: "AI sends second follow-up with urgency",
      },
    ],
  },
  {
    id: "scenario-5",
    name: "Custom Requirement Escalation",
    description:
      "Customer asks for a product not in the catalogue (monel alloy valve with special coating). AI cannot fulfill from product list and escalates to human for custom sourcing.",
    steps: [
      {
        type: "WEBHOOK",
        payload: {
          source: LeadSource.EMAIL,
          contactName: "Dr. Amit Joshi",
          contactPhone: "+91 55443 32211",
          contactEmail: "amit.joshi@deepseacorp.in",
          companyName: "Deep Sea Corporation",
          subject: "Special Alloy Valve Requirement - Urgent",
          message:
            "We need 5 pcs Monel K500 Ball Valves 3 inch Class 600 with special PEEK seats for subsea application. Also need NACE MR0175 certification. Delivery to Hazira port within 6 weeks.",
        },
        description: "Email enquiry for non-catalogue special alloy valves",
      },
      {
        type: "ADVANCE_TIME",
        payload: { hours: 0.5 },
        description: "AI processes enquiry and identifies non-catalogue product",
      },
      {
        type: "CUSTOMER_MESSAGE",
        payload: {
          leadId: "LEAD-005",
          message:
            "Thank you for your enquiry, Dr. Joshi. I see you are looking for Monel K500 Ball Valves with PEEK seats and NACE certification. This is a specialized requirement outside our standard catalogue.\n\nI am escalating this to our senior technical sales team who can assist with:\n- Custom sourcing for Monel K500 material\n- PEEK seat compatibility\n- NACE MR0175 certification\n\nOur team will reach out to you within 24 hours with a detailed response.",
          direction: "OUTBOUND",
          isAI: true,
        },
        description: "AI acknowledges and informs about escalation",
      },
      {
        type: "ADVANCE_TIME",
        payload: { hours: 0.5 },
        description: "AI creates escalation to technical sales team",
      },
    ],
  },
];
