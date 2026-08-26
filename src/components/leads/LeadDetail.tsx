"use client";

import { useState, useEffect, useCallback } from "react";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { getLeadDetail, respondToLead } from "@/lib/lead-service";
import { getStore } from "@/lib/store";
import { approveQuotation, sendQuotation } from "@/lib/lead-service";

interface LeadDetailData {
  lead: {
    id: string;
    contactName: string;
    contactEmail?: string;
    contactPhone: string;
    source: string;
    status: string;
    subject?: string;
    score?: number;
    intent?: string;
    createdAt: string;
    updatedAt: string;
  };
  company: {
    id: string;
    name: string;
    gstNumber?: string;
    contactPerson: string;
    email?: string;
    phone: string;
    city?: string;
    state?: string;
    industry?: string;
  } | null;
  messages: Array<{
    id: string;
    direction: string;
    content: string;
    channel: string;
    createdAt: string;
  }>;
  rfqs: Array<{
    id: string;
    status: string;
    completenessScore: number;
    productName?: string;
    material?: string;
    quantity?: number;
    size?: string;
    pressureClass?: string;
    application?: string;
    deliveryLocation?: string;
  }>;
  rfqFields: Array<{
    id: string;
    fieldName: string;
    fieldValue?: string;
    isRequired: boolean;
    isExtracted: boolean;
  }>;
  quotations: Array<{
    id: string;
    status: string;
    quotationNumber: string;
    subtotal: number;
    discount?: number;
    taxAmount: number;
    totalAmount: number;
    validityDays: number;
    paymentTerms?: string;
    deliveryTerms?: string;
    notes?: string;
    createdAt: string;
  }>;
  quotationItems: Array<{
    id: string;
    productName: string;
    size?: string;
    quantity: number;
    unitPrice: number;
    discount?: number;
    taxRate: number;
    totalPrice: number;
  }>;
  followUps: Array<{
    id: string;
    status: string;
    type: string;
    scheduledAt: string;
    message?: string;
    createdBy: string;
  }>;
  escalations: Array<{
    id: string;
    priority: string;
    status: string;
    reason: string;
    description?: string;
    createdAt: string;
  }>;
  aiActions: Array<{
    id: string;
    messageType: string;
    output?: string;
    confidence?: number;
    executedAt: string;
  }>;
}

const statusColors: Record<string, string> = {
  NEW: "bg-blue-100 text-blue-700",
  QUALIFYING: "bg-yellow-100 text-yellow-700",
  QUALIFIED: "bg-green-100 text-green-700",
  QUOTATION_DRAFTED: "bg-purple-100 text-purple-700",
  QUOTATION_SENT: "bg-indigo-100 text-indigo-700",
  WON: "bg-emerald-100 text-emerald-700",
  ESCALATED: "bg-red-100 text-red-700",
};

const quoteStatusColors: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-600",
  PENDING_APPROVAL: "bg-yellow-100 text-yellow-700",
  APPROVED: "bg-green-100 text-green-700",
  SENT: "bg-blue-100 text-blue-700",
  ACCEPTED: "bg-emerald-100 text-emerald-700",
  REJECTED: "bg-red-100 text-red-700",
};

const priorityColors: Record<string, string> = {
  LOW: "bg-gray-100 text-gray-600",
  MEDIUM: "bg-yellow-100 text-yellow-700",
  HIGH: "bg-orange-100 text-orange-700",
  URGENT: "bg-red-100 text-red-700",
};

export default function LeadDetail({ leadId }: { leadId: string }) {
  const [data, setData] = useState<LeadDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [responseMessage, setResponseMessage] = useState("");
  const [sendingResponse, setSendingResponse] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const result = getLeadDetail(leadId);
      if (result) {
        setData(result as unknown as LeadDetailData);
      }
    } catch (error) {
      console.error("Failed to fetch lead detail:", error);
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const sendResponse = async () => {
    if (!responseMessage.trim()) return;
    setSendingResponse(true);
    try {
      respondToLead(leadId, responseMessage);
      setResponseMessage("");
      await fetchData();
    } catch (error) {
      console.error("Failed to send response:", error);
    } finally {
      setSendingResponse(false);
    }
  };

  const handleApproveQuotation = async (quotationId: string) => {
    try {
      approveQuotation(quotationId);
      await fetchData();
    } catch (error) {
      console.error("Failed to approve quotation:", error);
    }
  };

  const handleSendQuotation = async (quotationId: string) => {
    try {
      sendQuotation(quotationId);
      await fetchData();
    } catch (error) {
      console.error("Failed to send quotation:", error);
    }
  };

  const resolveEscalation = async (escalationId: string) => {
    try {
      const store = getStore();
      store.updateEscalation(escalationId, {
        status: "RESOLVED" as any,
        resolvedBy: "MANAGER",
        resolvedAt: store.getCurrentTime(),
      });
      await fetchData();
    } catch (error) {
      console.error("Failed to resolve escalation:", error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-slate-500 text-sm">Loading lead details...</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-red-500 text-sm">Lead not found</div>
      </div>
    );
  }

  const { lead, company, messages, rfqs, rfqFields, quotations, quotationItems, followUps, escalations } = data;
  const latestRfq = rfqs[0];
  const latestQuotation = quotations[0];
  const latestQuotationItem = quotationItems[0];
  const openEscalation = escalations.find((e) => e.status === "OPEN");

  const aiSummary = data.aiActions.find((a) => a.messageType === "EXTRACT_REQUIREMENTS");

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-4">
          <a href="/" className="text-sm text-slate-500 hover:text-slate-700">
            ← Dashboard
          </a>
          <div className="h-4 w-px bg-slate-200" />
          <div className="flex-1">
            <h1 className="text-lg font-semibold text-slate-900">{lead.contactName}</h1>
            <p className="text-xs text-slate-500">{company?.name || "Unknown Company"} · {lead.source}</p>
          </div>
          <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusColors[lead.status] || "bg-gray-100 text-gray-600"}`}>
            {lead.status.replace(/_/g, " ")}
          </span>
          {lead.score !== undefined && (
            <div className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full ${
                lead.score > 80 ? "bg-emerald-500" : lead.score >= 50 ? "bg-yellow-500" : "bg-red-500"
              }`} />
              <span className="text-sm font-medium text-slate-700">Score: {lead.score}</span>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <section className="bg-white rounded-lg border border-slate-200 p-5">
              <h2 className="text-sm font-medium text-slate-700 mb-4">Conversation</h2>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {messages.length === 0 ? (
                  <p className="text-sm text-slate-400">No messages yet</p>
                ) : (
                  messages.map((msg) => (
                    <div key={msg.id} className={`flex ${msg.direction === "OUTBOUND" ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[80%] rounded-lg px-4 py-2.5 ${
                        msg.direction === "OUTBOUND"
                          ? "bg-slate-900 text-white"
                          : "bg-slate-100 text-slate-800"
                      }`}>
                        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                        <div className={`text-[10px] mt-1 ${msg.direction === "OUTBOUND" ? "text-slate-400" : "text-slate-400"}`}>
                          {formatDateTime(new Date(msg.createdAt))}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>

            {aiSummary && (
              <section className="bg-white rounded-lg border border-slate-200 p-5">
                <h2 className="text-sm font-medium text-slate-700 mb-3">AI Summary</h2>
                <div className="text-sm text-slate-600 leading-relaxed">
                  {aiSummary.output ? (
                    <pre className="whitespace-pre-wrap font-sans">{(() => {
                      try {
                        const parsed = JSON.parse(aiSummary.output);
                        return `Product: ${parsed.productName || "N/A"}\nMaterial: ${parsed.material || "N/A"}\nQuantity: ${parsed.quantity || "N/A"}\nSize: ${parsed.size || "N/A"}\nApplication: ${parsed.application || "N/A"}\nDelivery Location: ${parsed.deliveryLocation || "N/A"}\nCompleteness: ${parsed.completeness || 0}%`;
                      } catch {
                        return aiSummary.output;
                      }
                    })()}</pre>
                  ) : (
                    "Processing..."
                  )}
                </div>
                <div className="mt-2 text-xs text-slate-400">
                  Confidence: {aiSummary.confidence ? `${(aiSummary.confidence * 100).toFixed(0)}%` : "N/A"}
                </div>
              </section>
            )}

            {rfqFields.length > 0 && (
              <section className="bg-white rounded-lg border border-slate-200 p-5">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-medium text-slate-700">RFQ Requirements</h2>
                  {latestRfq && (
                    <div className="flex items-center gap-2">
                      <div className="w-24 bg-slate-100 rounded-full h-1.5">
                        <div
                          className="bg-slate-700 h-1.5 rounded-full transition-all"
                          style={{ width: `${latestRfq.completenessScore}%` }}
                        />
                      </div>
                      <span className="text-xs text-slate-500">{latestRfq.completenessScore}%</span>
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  {rfqFields.map((field) => (
                    <div key={field.id} className="flex items-center justify-between py-1.5 border-b border-slate-50 last:border-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs ${field.isExtracted ? "text-emerald-600" : "text-slate-400"}`}>
                          {field.isExtracted ? "✓" : "✗"}
                        </span>
                        <span className="text-sm text-slate-600">{field.fieldName}</span>
                        {field.isRequired && <span className="text-[10px] text-red-400">*</span>}
                      </div>
                      <span className="text-sm text-slate-900 font-medium">
                        {field.fieldValue || <span className="text-slate-300">—</span>}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {openEscalation && (
              <section className="bg-red-50 rounded-lg border border-red-200 p-5">
                <h2 className="text-sm font-medium text-red-700 mb-2">Escalation</h2>
                <p className="text-sm text-red-600 mb-2">{openEscalation.reason}</p>
                {openEscalation.description && (
                  <p className="text-xs text-red-500 mb-3">{openEscalation.description}</p>
                )}
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${priorityColors[openEscalation.priority] || ""}`}>
                    {openEscalation.priority}
                  </span>
                  <button
                    onClick={() => resolveEscalation(openEscalation.id)}
                    className="text-xs font-medium bg-red-600 text-white px-3 py-1 rounded-md hover:bg-red-700 transition-colors"
                  >
                    Resolve
                  </button>
                </div>
              </section>
            )}
          </div>

          <div className="space-y-6">
            <section className="bg-white rounded-lg border border-slate-200 p-5">
              <h2 className="text-sm font-medium text-slate-700 mb-4">Details</h2>
              <div className="space-y-3">
                <div>
                  <div className="text-xs text-slate-500">Contact</div>
                  <div className="text-sm font-medium text-slate-900">{lead.contactName}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Email</div>
                  <div className="text-sm text-slate-700">{lead.contactEmail || "—"}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Phone</div>
                  <div className="text-sm text-slate-700">{lead.contactPhone}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Company</div>
                  <div className="text-sm text-slate-700">{company?.name || "—"}</div>
                </div>
                {company?.city && (
                  <div>
                    <div className="text-xs text-slate-500">Location</div>
                    <div className="text-sm text-slate-700">{company.city}{company.state ? `, ${company.state}` : ""}</div>
                  </div>
                )}
                {company?.industry && (
                  <div>
                    <div className="text-xs text-slate-500">Industry</div>
                    <div className="text-sm text-slate-700">{company.industry}</div>
                  </div>
                )}
                <div>
                  <div className="text-xs text-slate-500">Intent</div>
                  <div className="text-sm text-slate-700">{lead.intent?.replace(/_/g, " ") || "—"}</div>
                </div>
              </div>
            </section>

            {latestQuotation && (
              <section className="bg-white rounded-lg border border-slate-200 p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-medium text-slate-700">Quotation</h2>
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${quoteStatusColors[latestQuotation.status] || ""}`}>
                    {latestQuotation.status.replace(/_/g, " ")}
                  </span>
                </div>
                <div className="text-xs text-slate-500 mb-3">{latestQuotation.quotationNumber}</div>
                {latestQuotationItem && (
                  <div className="space-y-2 mb-4">
                    <div className="text-sm font-medium text-slate-900">{latestQuotationItem.productName}</div>
                    {latestQuotationItem.size && (
                      <div className="text-xs text-slate-500">Size: {latestQuotationItem.size}</div>
                    )}
                    <div className="text-xs text-slate-500">
                      {latestQuotationItem.quantity} × {formatCurrency(latestQuotationItem.unitPrice)}
                    </div>
                  </div>
                )}
                <div className="border-t border-slate-100 pt-3 space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Subtotal</span>
                    <span className="text-slate-700">{formatCurrency(latestQuotation.subtotal)}</span>
                  </div>
                  {latestQuotation.discount ? (
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500">Discount</span>
                      <span className="text-green-600">-{formatCurrency(latestQuotation.discount)}</span>
                    </div>
                  ) : null}
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">GST (18%)</span>
                    <span className="text-slate-700">{formatCurrency(latestQuotation.taxAmount)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-semibold border-t border-slate-100 pt-1.5">
                    <span className="text-slate-900">Total</span>
                    <span className="text-slate-900">{formatCurrency(latestQuotation.totalAmount)}</span>
                  </div>
                </div>
                {latestQuotation.paymentTerms && (
                  <div className="mt-3 text-xs text-slate-500">
                    <span className="font-medium">Payment:</span> {latestQuotation.paymentTerms}
                  </div>
                )}
                {latestQuotation.deliveryTerms && (
                  <div className="mt-1 text-xs text-slate-500">
                    <span className="font-medium">Delivery:</span> {latestQuotation.deliveryTerms}
                  </div>
                )}
                {latestQuotation.status === "PENDING_APPROVAL" && (
                  <div className="mt-4 flex gap-2">
                    <button
                      onClick={() => handleApproveQuotation(latestQuotation.id)}
                      className="flex-1 text-xs font-medium bg-emerald-600 text-white px-3 py-1.5 rounded-md hover:bg-emerald-700 transition-colors"
                    >
                      Approve
                    </button>
                    <button className="flex-1 text-xs font-medium bg-white border border-slate-200 text-slate-600 px-3 py-1.5 rounded-md hover:bg-slate-50 transition-colors">
                      Edit
                    </button>
                    <button className="flex-1 text-xs font-medium bg-white border border-red-200 text-red-600 px-3 py-1.5 rounded-md hover:bg-red-50 transition-colors">
                      Reject
                    </button>
                  </div>
                )}
                {latestQuotation.status === "APPROVED" && (
                  <div className="mt-4">
                    <button
                      onClick={() => handleSendQuotation(latestQuotation.id)}
                      className="w-full text-xs font-medium bg-slate-900 text-white px-3 py-1.5 rounded-md hover:bg-slate-800 transition-colors"
                    >
                      Send Quotation
                    </button>
                  </div>
                )}
              </section>
            )}

            {followUps.length > 0 && (
              <section className="bg-white rounded-lg border border-slate-200 p-5">
                <h2 className="text-sm font-medium text-slate-700 mb-3">Follow-ups</h2>
                <div className="space-y-2">
                  {followUps.map((fu) => (
                    <div key={fu.id} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                      <div>
                        <div className="text-xs text-slate-500">{fu.type} · {fu.createdBy}</div>
                        <div className="text-sm text-slate-700">{formatDateTime(new Date(fu.scheduledAt))}</div>
                      </div>
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                        fu.status === "PENDING" ? "bg-yellow-100 text-yellow-700"
                          : fu.status === "SENT" ? "bg-blue-100 text-blue-700"
                          : fu.status === "OVERDUE" ? "bg-red-100 text-red-700"
                          : "bg-gray-100 text-gray-600"
                      }`}>
                        {fu.status}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>

        {(lead.status !== "WON" && lead.status !== "LOST") && (
          <div className="mt-6 bg-white rounded-lg border border-slate-200 p-4">
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <label className="block text-xs text-slate-500 mb-1">Send Customer Response</label>
                <textarea
                  value={responseMessage}
                  onChange={(e) => setResponseMessage(e.target.value)}
                  placeholder="Type a message to simulate customer response..."
                  className="w-full text-sm border border-slate-200 rounded-md px-3 py-2 bg-white text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400 resize-none"
                  rows={2}
                />
              </div>
              <button
                onClick={sendResponse}
                disabled={sendingResponse || !responseMessage.trim()}
                className="text-sm font-medium bg-slate-900 text-white px-4 py-2 rounded-md hover:bg-slate-800 disabled:opacity-50 transition-colors whitespace-nowrap"
              >
                {sendingResponse ? "Sending..." : "Send"}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
