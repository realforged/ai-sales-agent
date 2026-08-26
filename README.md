# AI Sales Agent — Manufacturing Lead Management

## What This Is

An AI-powered sales automation system for Indian B2B manufacturers that converts unstructured enquiries from IndiaMART, website forms, and WhatsApp into qualified RFQs (Request for Quotation) and sales-ready quotations — with automatic follow-up tracking and intelligent escalation to human salespeople. Built as a full-stack application demonstrating how AI can augment (not replace) a manufacturing sales team, keeping humans in control of commercial commitments while automating repetitive qualification and documentation work.

## The Problem

Indian manufacturers receive dozens to hundreds of enquiries daily — primarily from IndiaMART, but also from website contact forms, WhatsApp messages, and emails. Each enquiry must be manually read, parsed for technical requirements (product type, material, size, quantity, pressure class, application, delivery location), matched against a product catalogue, qualified, quoted, and followed up on.

This creates several critical pain points:

- **Slow response time**: Salespeople manually process each enquiry, often taking hours or days to respond. In manufacturing B2B, the first supplier to respond wins the deal ~50% of the time.
- **Inconsistent qualification**: Different salespeople ask different questions, apply different scoring criteria, and miss important technical details.
- **Missed follow-ups**: Without automated tracking, quotations are sent and forgotten. Studies show 80% of sales require 5+ follow-ups, but most salespeople stop after 1-2.
- **Repetitive work**: Salespeople spend 60-70% of their time on data entry, formatting quotations, and asking standard qualification questions — not on building relationships or closing deals.
- **Lost institutional knowledge**: When a salesperson leaves, their pipeline, customer context, and follow-up history leave with them.

## Who Would Pay

Small-to-medium Indian manufacturers and suppliers with 5-50 salespeople, processing 50-500 enquiries per month. Companies in industrial sectors like valves, pipes, fittings, pumps, compressors, electrical components, and other engineered products where:

- Orders are high-value (₹50,000 to ₹50,00,000+)
- Sales cycles are long (1-8 weeks)
- Technical qualification is repetitive (same 8-10 questions for every enquiry)
- Multiple follow-ups are needed to close a deal
- IndiaMART is the primary lead source

Typical buyer personas: Sales managers, VP Sales, and business owners at manufacturing companies who want their sales team to respond faster and close more deals without hiring additional headcount.

## How It Works (Workflow)

```
IndiaMART enquiry arrives
    ↓
Webhook receives enquiry
    ↓
AI extracts structured requirements (product, material, size, qty, application)
    ↓
System identifies missing information
    ↓
AI asks customer for missing info (natural language)
    ↓
RFQ becomes complete
    ↓
Qualification score calculated (deterministic, 0-100)
    ↓
Product matched from catalogue (scored against RFQ fields)
    ↓
Quotation generated (pricing, discounts, GST — all deterministic)
    ↓
Human reviews and approves (AI never sends without approval)
    ↓
Quotation sent to customer
    ↓
AI classifies customer response (interested, price objection, not interested, etc.)
    ↓
AI recommends next action
    ↓
Escalates to human when needed (price objection, custom requirement, at-risk deal)
    ↓
Lead → WON / LOST / FOLLOW-UP / ESCALATED
```

## Architecture

The system follows a **service-oriented architecture** with clear separation of concerns:

- **API Layer**: Next.js API routes handle HTTP requests and webhook ingestion
- **Business Services**: Domain-specific modules for qualification, quotation, escalation, and follow-up logic
- **AI Services**: Mock AI providers for requirement extraction, intent classification, and response generation — designed with a provider interface so real LLMs can be swapped in
- **Data Layer**: In-memory data store (globalThis singleton that survives Next.js HMR) with a clean CRUD interface per entity
- **Provider Pattern**: Pluggable interfaces for AI, messaging, and lead sources — mock implementations in demo, real implementations in production

```
┌─────────────────────────────────────────────────────┐
│                 Lead Sources                         │
│         (IndiaMART / Website / WhatsApp)             │
└──────────────────────┬──────────────────────────────┘
                       ↓
┌──────────────────────────────────────────────────────┐
│              API Layer (Next.js Routes)               │
│  /api/webhooks/indiamart │ /api/leads │ /api/demo    │
└──────────────────────┬───────────────────────────────┘
                       ↓
┌──────────────────────────────────────────────────────┐
│                Lead Service                           │
│  Create lead → Create conversation → Store message    │
└──────────────────────┬───────────────────────────────┘
                       ↓
┌──────────────────────────────────────────────────────┐
│          AI Extraction (Mock Provider)                │
│  Extract requirements → Classify intent → Score lead  │
└──────────────────────┬───────────────────────────────┘
                       ↓
┌──────────────────────────────────────────────────────┐
│            RFQ Service + Qualification Engine          │
│  Build RFQ fields → Calculate completeness → Score    │
│  (100% deterministic — no LLM involved)               │
└──────────────────────┬───────────────────────────────┘
                       ↓
┌──────────────────────────────────────────────────────┐
│       Product Matching + Pricing Engine               │
│  Match RFQ to catalogue → Apply volume discounts      │
│  → Calculate GST → Generate quotation                 │
│  (100% deterministic — never trust LLM with money)    │
└──────────────────────┬───────────────────────────────┘
                       ↓
┌──────────────────────────────────────────────────────┐
│              Human Approval Gate                       │
│  AI drafts quotation → Human reviews → Clicks Approve │
│  → System sends                                        │
└──────────────────────┬───────────────────────────────┘
                       ↓
┌──────────────────────────────────────────────────────┐
│         Messaging Adapter (Simulated)                  │
│  Email / WhatsApp / SMS — simulated in demo            │
└──────────────────────┬───────────────────────────────┘
                       ↓
┌──────────────────────────────────────────────────────┐
│     Follow-up Engine → Escalation Engine               │
│  Track response time → Recommend follow-ups            │
│  → Escalate price objections / custom requirements     │
└──────────────────────┬───────────────────────────────┘
                       ↓
┌──────────────────────────────────────────────────────┐
│                Dashboard (React)                       │
│  Pipeline metrics → AI recommendations → Lead detail   │
│  → One-click demo scenarios                            │
└──────────────────────────────────────────────────────┘
```

## AI vs Deterministic Logic

This is a critical design decision. The system intentionally splits responsibilities between AI and deterministic logic based on the nature of each task:

| Component | AI or Deterministic | Why |
|-----------|-------------------|-----|
| Requirement extraction | AI (mock) | Needs to understand natural language ("50 nos SS304 Ball Valves 2 inch" → structured fields) |
| Intent classification | AI (mock) | Needs to understand customer sentiment and buying signals from unstructured text |
| Response generation | AI (mock) | Needs natural language to communicate with customers conversationally |
| Qualification scoring | Deterministic | Reliability, transparency, auditability — every salesperson must see exactly how a score was calculated |
| Product matching | Deterministic | Exact matching against catalogue on category, material, size, pressure class — no room for hallucination |
| Pricing / discounts / tax | Deterministic | **Never trust an LLM with money.** Pricing involves business rules (volume brackets, repeat customer discounts, GST at 18%) that must be mathematically correct |
| State transitions | Deterministic | Business rules must be reliable — a lead can't randomly jump from NEW to WON without going through qualification |
| Escalation rules | Deterministic | Thresholds (14 days no response, price objection, unknown product) must be consistent and auditable |
| Follow-up scheduling | Deterministic | Time calculations (3 days, 7 days, 14 days) must be exact — no LLM rounding or approximation |

**The principle**: AI handles natural language understanding and generation where some variability is acceptable. Deterministic logic handles all business-critical decisions where correctness, consistency, and auditability are non-negotiable.

## Tech Stack

| Technology | Purpose |
|-----------|---------|
| Next.js 16 (App Router) | Full-stack framework — API routes + React frontend |
| TypeScript | Type safety across the entire codebase |
| Tailwind CSS v4 | Professional B2B dashboard styling |
| Zod | Runtime validation for API payloads |
| In-memory data store | GlobalThis singleton — no external DB required for demo |
| vitest | Unit and integration testing |

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### Installation

```bash
npm install
```

### Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Run Tests

```bash
npm test
```

### Environment Variables

None required for demo. The app uses mock AI providers and simulated messaging.

For production, you would configure:

```env
OPENAI_API_KEY=your-key           # For real LLM-based extraction and response generation
WHATSAPP_API_TOKEN=your-token     # WhatsApp Cloud API for real message delivery
INDIAMART_WEBHOOK_SECRET=secret   # Webhook signature verification
DATABASE_URL=postgresql://...     # PostgreSQL for persistent storage
REDIS_URL=redis://...             # Background job queues
```

## Demo Scenarios

The dashboard includes 5 pre-built demo scenarios that showcase the complete lead lifecycle. Each scenario is accessible with a single click from the demo control panel.

### Scenario 1: Complete Enquiry

A full IndiaMART enquiry arrives with all required information — product (SS304 Ball Valve), material, quantity (50 nos), size (2 inch), pressure class (Class 150), application (water treatment), and delivery location (Chennai). The AI extracts all requirements, classifies the intent as "ready to buy," matches the product from the catalogue, and generates a quotation with competitive pricing. The lead progresses through the pipeline without any manual intervention needed.

### Scenario 2: Missing Technical Info

An enquiry arrives from a website form without application details or delivery information. The AI identifies the missing fields and generates a natural clarification request asking for: intended application, quantity per size, delivery timeline, and pressure class requirements. After the customer responds with the missing details, the RFQ completeness score increases above the threshold, and a quotation is generated.

### Scenario 3: Price Objection

After a quotation is sent for 200 Carbon Steel Gate Valves (₹3,60,000 total), the customer responds that the price is too high and references a competitor's quote of ₹1,500/piece. The AI classifies this as a price objection, generates an empathetic response acknowledging the concern while highlighting product quality (API 600 certification, 2-year warranty), and escalates to a human sales manager for negotiation — because pricing decisions above certain thresholds require human judgment.

### Scenario 4: No Response Follow-up

A quotation for 30 SS316 Ball Valves is sent via WhatsApp to a pharmaceutical company. The customer doesn't respond. The system tracks elapsed time and recommends follow-ups: a gentle check-in at 3 days, a reminder with urgency at 7 days, and flags the deal as at-risk with escalation recommendation at 14 days. Each follow-up includes a suggested message template.

### Scenario 5: Custom Requirement Escalation

A customer requests Monel K500 Ball Valves with PEEK seats and NACE MR0175 certification for subsea application — products not in the standard catalogue. The AI recognizes this needs custom sourcing and engineering input. It acknowledges the enquiry professionally, informs the customer about the escalation to the senior technical sales team, and creates a high-priority escalation ticket with all context preserved.

## Database Schema

The system manages 12 interconnected entities:

| Entity | Description |
|--------|-------------|
| **Company** | Customer organization — name, GST number, contact details, address |
| **Lead** | Sales lead — contact info, source, status, qualification score, intent |
| **Conversation** | Communication thread tied to a lead — channel, message count, active status |
| **Message** | Individual message — direction (inbound/outbound), content, channel, metadata |
| **RFQ** | Request for Quotation — extracted requirements, completeness score, raw text |
| **RFQField** | Individual RFQ field — name, value, required flag, extraction status |
| **Product** | Product catalogue — SKU, material, sizes, pressure classes, base price, MOQ |
| **Quotation** | Sales quotation — line items, subtotal, discount, GST (18%), total, status |
| **QuotationItem** | Quotation line item — product, quantity, unit price, discount, tax |
| **FollowUp** | Follow-up tracking — type (email/WhatsApp/phone/SMS), schedule, status |
| **Escalation** | Escalation ticket — reason, priority, status, resolution notes |
| **AIAction** | AI audit log — action type, input, output, confidence, duration |

### Lead Status Flow

```
NEW → QUALIFYING → QUALIFIED → QUOTATION_DRAFTED → QUOTATION_SENT
                         ↓              ↓                 ↓
                    UNQUALIFIED    NEGOTIATION        FOLLOW_UP
                                                    ESCALATED
                                              ↓         ↓
                                            WON       LOST
```

## API Endpoints

```
POST   /api/webhooks/indiamart          Receive IndiaMART webhook enquiries
GET    /api/leads                       List all leads with summary data
GET    /api/leads/[id]                  Get full lead detail (messages, RFQ, quotation, escalations)
POST   /api/leads/[id]/respond          Simulate customer response (triggers AI classification)
POST   /api/quotation/[id]/approve      Approve a pending quotation (human gate)
POST   /api/quotation/[id]/send         Send an approved quotation to customer
POST   /api/demo                        Demo controls — run scenarios, advance time, reset
```

### Example: Webhook Payload

```json
{
  "source": "INDIAMART",
  "contactName": "Vikram Patel",
  "contactPhone": "+91 99887 76655",
  "contactEmail": "vikram@stellartech.in",
  "companyName": "Stellar Technologies",
  "subject": "Enquiry for SS304 Ball Valves",
  "message": "We need 50 nos SS304 Ball Valves size 2 inch Class 150 for our water treatment plant."
}
```

## Why Would a Manufacturing Company Pay for This?

### Problem

A typical 20-person sales team at an Indian manufacturer processes 200 enquiries/month. Each enquiry takes 15-30 minutes to manually read, extract requirements, check product catalogue, prepare a quotation, and send. That's 50-100 hours/month spent on repetitive qualification work — time not spent on relationship building, negotiation, or closing deals.

Meanwhile, response time averages 4-8 hours. Industry data shows that responding within 5 minutes makes you 21x more likely to qualify a lead. Most manufacturers lose deals simply because they're slow.

### Value

- **Faster response time**: From hours/days to minutes. AI extracts requirements and drafts quotations immediately upon enquiry receipt.
- **Consistent qualification**: Same scoring criteria (0-100) applied to every lead, every time. No human bias, no missed questions.
- **No missed follow-ups**: Automated tracking ensures every sent quotation gets followed up at 3, 7, and 14 days. Deals stop falling through the cracks.
- **Faster quotations**: AI-drafted quotations with product matching, volume discounts, and GST computation — human-reviewed and approved before sending.
- **Better visibility**: Dashboard shows pipeline value, at-risk deals, pending approvals, and AI-recommended actions. Sales managers get a real-time view without asking for status updates.
- **Human control**: AI never sends commercial commitments without human approval. The approval gate ensures a sales manager reviews every quotation before it reaches the customer.

### Potential KPIs to Measure (after deployment)

| KPI | Baseline (Manual) | Target (With AI Agent) |
|-----|-------------------|----------------------|
| Average response time to new enquiry | 4-8 hours | < 30 minutes |
| RFQ completion rate | 60% (incomplete RFQs dropped) | 85%+ (AI asks for missing info) |
| Quotation turnaround time | 2-4 hours | < 15 minutes |
| Follow-up coverage rate | 30% (most forgotten) | 100% (automated) |
| Qualified lead rate | 40% | 65%+ (consistent scoring) |
| Pipeline conversion rate | 8-12% | 15-20% (faster follow-up) |

## Production Roadmap

> **Note**: The items below are future improvements, not implemented in this demo. They represent what would be needed to take this from a portfolio project to a production SaaS product.

- **IndiaMART Integration**: Real IndiaMART Buyer-Seller API integration with webhook signature verification, retry logic, and payload normalization
- **WhatsApp Cloud API**: Real WhatsApp Business API integration for two-way messaging, template messages, and media sharing
- **PostgreSQL + Prisma**: Persistent database with proper migrations, relations, and query optimization
- **Redis + BullMQ**: Background job queues for AI processing, follow-up scheduling, and retry mechanisms
- **Authentication & RBAC**: NextAuth.js with role-based access (Admin, Sales Manager, Salesperson, Viewer)
- **Audit Logging**: Complete audit trail for all actions — who approved what, when, and why
- **Webhook Retry Mechanisms**: Exponential backoff retry for failed webhook deliveries
- **Rate Limiting**: Per-tenant rate limiting to prevent abuse and ensure fair usage
- **LLM Observability**: Integration with LangSmith or Helicone for tracking AI extraction accuracy, latency, and costs
- **Multi-Tenant Architecture**: Company-level data isolation, subscription tiers, and usage tracking
- **ERP / Tally Integration**: Sync quotations and orders with popular Indian accounting software
- **CRM Integration**: Bi-directional sync with Salesforce, HubSpot, or Zoho CRM
- **AI Evaluation Datasets**: Curated test sets for measuring extraction accuracy, intent classification F1 scores, and response quality
- **A/B Testing for AI Responses**: Framework to test different AI response templates and measure conversion impact
- **Encrypted Secrets Management**: AWS Secrets Manager or HashiCorp Vault for production credential storage
- **Observability Stack**: Grafana dashboards, Prometheus metrics, and PagerDuty alerting for production monitoring

## Limitations

This is a portfolio demo, not a production system. Key limitations to be transparent about:

- **Mock AI uses keyword matching**, not actual LLM calls. The extraction and classification logic is rule-based with hardcoded patterns. In production, this would use GPT-4 or Claude for significantly better accuracy.
- **In-memory data store** means all data is lost on server restart. No persistence layer.
- **No real IndiaMART or WhatsApp integration.** Webhook payloads are manually constructed or triggered via the demo panel.
- **No authentication.** Anyone with access to the URL can view and interact with all data.
- **Single-user demo.** No multi-tenant isolation, no role-based access control.
- **Limited product catalogue.** Only 5 demo products (valves). A real deployment would need hundreds or thousands of SKUs.
- **Simulated time advancement.** Follow-up and escalation timing is demonstrated through manual time control, not real cron jobs.

## Interview Talking Points

### Why did you build this?

"Indian manufacturers lose leads because their sales process is manual and slow. I wanted to build something that could genuinely help a 20-person sales team respond faster and never miss a follow-up. The core insight is that most of the sales qualification work is repetitive — same questions, same product matching, same quotation format — and AI can handle that while humans focus on relationship building and negotiation."

### Why manufacturing?

"Manufacturing B2B has high-value orders, long sales cycles, and repetitive qualification questions. A typical valve enquiry always needs the same information: product type, material, size, quantity, pressure class, application, and delivery. It's a perfect use case for AI automation with human oversight because the qualification pattern is consistent but the input is unstructured."

### Why IndiaMART?

"IndiaMART is the primary lead source for Indian manufacturers. Over 80% of B2B enquiries in India start there. It's the natural integration point. If you can automate the IndiaMART enquiry → quotation pipeline, you've solved the biggest bottleneck in Indian manufacturing sales."

### Why use an LLM (in production)?

"Because enquiry messages are unstructured. Customers write in Hinglish, mix units (kg, nos, pieces, metres), skip important fields, and use industry jargon. An LLM can extract structured data from messy natural language better than any regex-based approach. The mock implementation proves the concept; a real LLM would handle the long tail of variations."

### Why not let the LLM make pricing decisions?

"Because pricing involves business logic — volume discounts, repeat customer rates, GST computation at 18%, minimum order quantities — that must be deterministic. An LLM might hallucinate a price, apply wrong math, or give inconsistent quotes to different customers. Pricing must come from the database and business rules, period. The AI drafts the quotation; the engine calculates the numbers."

### How does human-in-the-loop work?

"The AI generates the quotation draft, but a human must click Approve before it can be sent. The system clearly shows what the AI drafted and what needs human review. The approval gate is the critical control point — AI handles 90% of the work (extraction, matching, formatting) but humans make the final commercial commitment."

### How do you prevent hallucinations?

"By keeping critical decisions deterministic: pricing, qualification scoring, state transitions, escalation thresholds. The AI only handles natural language tasks where some variability is acceptable — extracting requirements, classifying intent, generating response text. If the AI isn't confident (low extraction score), it escalates to a human rather than guessing."

### How would you integrate real IndiaMART?

"IndiaMART provides a buyer-seller API. I'd set up webhook endpoints with HMAC signature verification to ensure payload authenticity, implement retry logic with exponential backoff for failed deliveries, normalize the incoming payload format into our lead schema, and add rate limiting. The provider pattern in the codebase makes this a clean swap — replace the mock provider with a real IndiaMART adapter."

### How would you scale to 1,000 companies?

"Multi-tenant architecture with company-level data isolation, PostgreSQL for persistence, background job queues (Redis + BullMQ) for AI processing so webhook responses aren't blocked by LLM latency, Redis caching for hot data like product catalogues, horizontal scaling of API servers behind a load balancer, and rate limiting per tenant to ensure fair resource usage."

### What would you build next?

"Real WhatsApp integration (biggest impact for Indian B2B), ERP sync for order status tracking, multi-language support for regional languages (Hindi, Tamil, Telugu), and an AI evaluation pipeline to measure extraction accuracy over time with ground-truth datasets."

### What would you change after talking to customers?

"Interview sales teams to understand their exact pain points — which questions they ask most often, which ones customers hate answering, what information they wish they had before the first call. Learn their pricing negotiation patterns. Understand which follow-up cadence actually works vs. which annoys customers. Prioritize features based on actual usage data, not assumptions."

## Resume Bullets

- Designed and built an end-to-end AI sales automation system for Indian B2B manufacturers, processing enquiries from webhook ingestion through RFQ qualification to quotation generation and human approval
- Implemented deterministic qualification scoring engine (0-100) with weighted breakdown across 7 dimensions (company identification, product match, quantity, technical specs, delivery timeline, location, buying intent)
- Built quotation calculation system with product matching (scored across category, material, size, pressure class, and application), volume-based discount tiers, and GST computation at 18%
- Created multi-turn AI conversation system that identifies missing RFQ fields and generates natural clarification requests, reducing manual qualification effort
- Developed escalation engine with rule-based triggers for price objections, custom requirements, low extraction confidence, and at-risk deals (14+ days no response), ensuring human oversight on critical decisions
- Built professional B2B SaaS dashboard with real-time pipeline metrics, AI-recommended actions, lead pipeline visualization, and one-click demo scenarios showcasing 5 complete lead lifecycle paths
- Designed pluggable provider architecture (AI, messaging, lead sources) with mock implementations ready for real providers — demonstrating production-aware design in a demo context
