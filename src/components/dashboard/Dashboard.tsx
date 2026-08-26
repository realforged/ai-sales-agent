"use client";

import { useState, useEffect, useCallback } from "react";
import { formatCurrency } from "@/lib/utils";

interface MetricCard {
  label: string;
  value: string | number;
}

interface LeadSummary {
  id: string;
  contactName: string;
  companyName: string;
  source: string;
  status: string;
  score: number;
  rfq: { id: string; status: string; completeness: number } | null;
  quotation: { id: string; status: string; totalAmount: number } | null;
  createdAt: string;
}

interface ArchivedLead {
  id: string;
  contactName: string;
  companyName: string;
  source: string;
  archivedAt: string;
}

interface Recommendation {
  leadId: string;
  leadName: string;
  companyName: string;
  dealValue: number;
  status: string;
  priority: string;
  recommendedAction: string;
}

interface DashboardData {
  metrics: {
    totalLeads: number;
    qualifiedLeads: number;
    openRfqs: number;
    pendingApproval: number;
    pipelineValue: number;
    wonValue: number;
  };
  leads: LeadSummary[];
  recommendations: Recommendation[];
  currentTime: string;
}

const statusColors: Record<string, string> = {
  NEW: "bg-blue-100 text-blue-700",
  QUALIFYING: "bg-yellow-100 text-yellow-700",
  QUALIFIED: "bg-green-100 text-green-700",
  UNQUALIFIED: "bg-red-100 text-red-700",
  QUOTATION_DRAFTED: "bg-purple-100 text-purple-700",
  QUOTATION_SENT: "bg-indigo-100 text-indigo-700",
  NEGOTIATION: "bg-orange-100 text-orange-700",
  WON: "bg-emerald-100 text-emerald-700",
  LOST: "bg-gray-100 text-gray-600",
  ESCALATED: "bg-red-100 text-red-700",
  FOLLOW_UP: "bg-cyan-100 text-cyan-700",
};

const priorityColors: Record<string, string> = {
  LOW: "bg-gray-100 text-gray-600",
  MEDIUM: "bg-yellow-100 text-yellow-700",
  HIGH: "bg-orange-100 text-orange-700",
  URGENT: "bg-red-100 text-red-700",
};

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedScenario, setSelectedScenario] = useState("1");
  const [statusMessage, setStatusMessage] = useState("");
  const [isRunning, setIsRunning] = useState(false);

  const [archivedLeads, setArchivedLeads] = useState<ArchivedLead[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [archiveConfirm, setArchiveConfirm] = useState<{ leadId: string; name: string } | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [leadsRes, metricsRes, recsRes] = await Promise.all([
        fetch("/api/leads"),
        fetch("/api/demo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "get_metrics" }),
        }),
        fetch("/api/demo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "get_recommendations" }),
        }),
      ]);

      const leadsData = await leadsRes.json();
      const metricsData = await metricsRes.json();
      const recsData = await recsRes.json();

      setData({
        metrics: metricsData,
        leads: leadsData.leads || [],
        recommendations: recsData.recommendations || [],
        currentTime: metricsData.currentTime || new Date().toISOString(),
      });
    } catch (error) {
      console.error("Failed to fetch dashboard data:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchArchived = useCallback(async () => {
    try {
      const res = await fetch("/api/demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "get_archived" }),
      });
      const result = await res.json();
      setArchivedLeads(result.leads || []);
    } catch {}
  }, []);

  useEffect(() => {
    fetchData();
    fetchArchived();
    const interval = setInterval(() => {
      fetchData();
      if (showArchived) fetchArchived();
    }, 2000);
    return () => clearInterval(interval);
  }, [fetchData, fetchArchived, showArchived]);

  const runScenario = async () => {
    setIsRunning(true);
    setStatusMessage("Running scenario...");
    try {
      const res = await fetch("/api/demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "run_scenario", scenarioId: parseInt(selectedScenario) }),
      });
      const result = await res.json();
      setStatusMessage(`Scenario completed: ${result.scenario} (${result.steps?.length || 0} steps)`);
      await fetchData();
    } catch {
      setStatusMessage("Failed to run scenario");
    } finally {
      setIsRunning(false);
    }
  };

  const advanceTime = async (days: number = 1) => {
    setIsRunning(true);
    setStatusMessage(`Advancing time by ${days} day(s)...`);
    try {
      const res = await fetch("/api/demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "advance_time", days }),
      });
      const result = await res.json();
      setStatusMessage(`Time advanced. Current: ${new Date(result.currentTime).toLocaleDateString("en-IN")}`);
      await fetchData();
    } catch {
      setStatusMessage("Failed to advance time");
    } finally {
      setIsRunning(false);
    }
  };

  const resetData = async () => {
    setIsRunning(true);
    setStatusMessage("Resetting all data...");
    try {
      await fetch("/api/demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset" }),
      });
      setStatusMessage("Data reset complete");
      setArchivedLeads([]);
      setShowArchived(false);
      await fetchData();
    } catch {
      setStatusMessage("Failed to reset data");
    } finally {
      setIsRunning(false);
    }
  };

  const archiveLead = async (leadId: string) => {
    try {
      await fetch("/api/demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "archive_lead", leadId }),
      });
      setArchiveConfirm(null);
      setStatusMessage("Lead archived");
      await fetchData();
      await fetchArchived();
    } catch {
      setStatusMessage("Failed to archive lead");
    }
  };

  const restoreLead = async (leadId: string) => {
    try {
      await fetch("/api/demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "restore_lead", leadId }),
      });
      setStatusMessage("Lead restored to active pipeline");
      await fetchData();
      await fetchArchived();
    } catch {
      setStatusMessage("Failed to restore lead");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-slate-500 text-sm">Loading dashboard...</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-red-500 text-sm">Failed to load dashboard</div>
      </div>
    );
  }

  const metrics: MetricCard[] = [
    { label: "Total Leads", value: data.metrics.totalLeads },
    { label: "Qualified Leads", value: data.metrics.qualifiedLeads },
    { label: "Open RFQs", value: data.metrics.openRfqs },
    { label: "Quotes Pending", value: data.metrics.pendingApproval },
    { label: "Pipeline Value", value: formatCurrency(data.metrics.pipelineValue) },
    { label: "Won Value", value: formatCurrency(data.metrics.wonValue) },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center">
              <span className="text-white text-xs font-bold">AI</span>
            </div>
            <div>
              <h1 className="text-lg font-semibold text-slate-900">Sales Agent</h1>
              <p className="text-xs text-slate-500">Manufacturing Lead Management</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-xs text-slate-500">
              {new Date(data.currentTime).toLocaleDateString("en-IN", {
                weekday: "short",
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </div>
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" title="System Active" />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {metrics.map((m) => (
            <div key={m.label} className="bg-white rounded-lg border border-slate-200 p-4">
              <div className="text-xs text-slate-500 mb-1">{m.label}</div>
              <div className="text-xl font-semibold text-slate-900">{m.value}</div>
            </div>
          ))}
        </section>

        {data.recommendations.length > 0 && (
          <section>
            <h2 className="text-sm font-medium text-slate-700 mb-3">AI Recommended Actions</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {data.recommendations.map((rec) => (
                <div key={rec.leadId} className="bg-white rounded-lg border border-slate-200 p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="text-sm font-medium text-slate-900">{rec.leadName}</div>
                      <div className="text-xs text-slate-500">{rec.companyName}</div>
                    </div>
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${priorityColors[rec.priority] || "bg-gray-100 text-gray-600"}`}>
                      {rec.priority}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 mb-2">
                    {rec.dealValue > 0 ? formatCurrency(rec.dealValue) : "No quote yet"}
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">{rec.recommendedAction}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-medium text-slate-700">Leads</h2>
            <button
              onClick={() => { setShowArchived(!showArchived); if (!showArchived) fetchArchived(); }}
              className="text-xs font-medium text-slate-500 hover:text-slate-700 bg-white border border-slate-200 px-3 py-1 rounded-md hover:bg-slate-50 transition-colors"
            >
              {showArchived ? "Hide Archived" : `Archived (${archivedLeads.length})`}
            </button>
          </div>
          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Customer</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Company</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Source</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Score</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">RFQ</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Quote</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-600">Value</th>
                    <th className="text-center px-4 py-3 font-medium text-slate-600">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {data.leads.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-slate-400 text-sm">
                        No leads yet. Run a demo scenario to get started.
                      </td>
                    </tr>
                  ) : (
                    data.leads.map((lead) => (
                      <tr key={lead.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-900">{lead.contactName}</div>
                        </td>
                        <td className="px-4 py-3 text-slate-600">{lead.companyName}</td>
                        <td className="px-4 py-3">
                          <span className="text-xs font-medium bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                            {lead.source}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusColors[lead.status] || "bg-gray-100 text-gray-600"}`}>
                            {lead.status.replace(/_/g, " ")}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${
                              lead.score > 80 ? "bg-emerald-500" : lead.score >= 50 ? "bg-yellow-500" : "bg-red-500"
                            }`} />
                            <span className="text-slate-700">{lead.score}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {lead.rfq ? (
                            <div className="flex items-center gap-2">
                              <div className="w-16 bg-slate-100 rounded-full h-1.5">
                                <div
                                  className="bg-slate-600 h-1.5 rounded-full"
                                  style={{ width: `${lead.rfq.completeness}%` }}
                                />
                              </div>
                              <span className="text-xs">{lead.rfq.completeness}%</span>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {lead.quotation ? (
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                              lead.quotation.status === "PENDING_APPROVAL"
                                ? "bg-yellow-100 text-yellow-700"
                                : lead.quotation.status === "APPROVED"
                                ? "bg-green-100 text-green-700"
                                : lead.quotation.status === "SENT"
                                ? "bg-blue-100 text-blue-700"
                                : "bg-slate-100 text-slate-600"
                            }`}>
                              {lead.quotation.status.replace(/_/g, " ")}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-slate-900">
                          {lead.quotation ? formatCurrency(lead.quotation.totalAmount) : "—"}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <a
                              href={`/leads/${lead.id}`}
                              className="text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3 py-1 rounded transition-colors"
                            >
                              View
                            </a>
                            <button
                              onClick={() => setArchiveConfirm({ leadId: lead.id, name: lead.contactName })}
                              className="text-xs font-medium text-slate-400 hover:text-red-600 bg-slate-100 hover:bg-red-50 px-2 py-1 rounded transition-colors"
                              title="Archive lead"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {showArchived && (
          <section>
            <h2 className="text-sm font-medium text-slate-700 mb-3">Archived Leads</h2>
            <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
              {archivedLeads.length === 0 ? (
                <div className="px-4 py-8 text-center text-slate-400 text-sm">
                  No archived leads.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50">
                        <th className="text-left px-4 py-3 font-medium text-slate-600">Customer</th>
                        <th className="text-left px-4 py-3 font-medium text-slate-600">Company</th>
                        <th className="text-left px-4 py-3 font-medium text-slate-600">Source</th>
                        <th className="text-left px-4 py-3 font-medium text-slate-600">Archived</th>
                        <th className="text-center px-4 py-3 font-medium text-slate-600">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {archivedLeads.map((lead) => (
                        <tr key={lead.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3 font-medium text-slate-900">{lead.contactName}</td>
                          <td className="px-4 py-3 text-slate-600">{lead.companyName}</td>
                          <td className="px-4 py-3">
                            <span className="text-xs font-medium bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                              {lead.source}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-500">
                            {new Date(lead.archivedAt).toLocaleDateString("en-IN")}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() => restoreLead(lead.id)}
                              className="text-xs font-medium text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-1 rounded transition-colors"
                            >
                              Restore
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        )}

        <section className="bg-white rounded-lg border border-slate-200 p-4">
          <h2 className="text-sm font-medium text-slate-700 mb-3">Demo Controls</h2>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Scenario</label>
              <select
                value={selectedScenario}
                onChange={(e) => setSelectedScenario(e.target.value)}
                className="text-sm border border-slate-200 rounded-md px-3 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-400"
              >
                <option value="1">1 - Complete Enquiry</option>
                <option value="2">2 - Missing Technical Info</option>
                <option value="3">3 - Price Objection</option>
                <option value="4">4 - No Response Follow-up</option>
                <option value="5">5 - Custom Requirement Escalation</option>
              </select>
            </div>
            <button
              onClick={runScenario}
              disabled={isRunning}
              className="text-sm font-medium bg-slate-900 text-white px-4 py-1.5 rounded-md hover:bg-slate-800 disabled:opacity-50 transition-colors"
            >
              Run Scenario
            </button>
            <button
              onClick={() => advanceTime(1)}
              disabled={isRunning}
              className="text-sm font-medium bg-white border border-slate-200 text-slate-700 px-4 py-1.5 rounded-md hover:bg-slate-50 disabled:opacity-50 transition-colors"
            >
              +1 Day
            </button>
            <button
              onClick={() => advanceTime(3)}
              disabled={isRunning}
              className="text-sm font-medium bg-white border border-slate-200 text-slate-700 px-4 py-1.5 rounded-md hover:bg-slate-50 disabled:opacity-50 transition-colors"
            >
              +3 Days
            </button>
            <button
              onClick={() => setShowResetConfirm(true)}
              disabled={isRunning}
              className="text-sm font-medium bg-white border border-red-200 text-red-600 px-4 py-1.5 rounded-md hover:bg-red-50 disabled:opacity-50 transition-colors"
            >
              Reset
            </button>
          </div>
          {statusMessage && (
            <div className="mt-3 text-xs text-slate-500 bg-slate-50 rounded-md px-3 py-2">
              {statusMessage}
            </div>
          )}
        </section>
      </main>

      {archiveConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg border border-slate-200 shadow-xl p-6 w-full max-w-sm">
            <h3 className="text-sm font-semibold text-slate-900 mb-2">Archive Lead</h3>
            <p className="text-sm text-slate-600 mb-1">
              Are you sure you want to archive <span className="font-medium">{archiveConfirm.name}</span>?
            </p>
            <p className="text-xs text-slate-400 mb-5">
              This lead will be removed from the active pipeline. You can restore it later from Archived Leads.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setArchiveConfirm(null)}
                className="text-xs font-medium bg-white border border-slate-200 text-slate-600 px-4 py-1.5 rounded-md hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => archiveLead(archiveConfirm.leadId)}
                className="text-xs font-medium bg-red-600 text-white px-4 py-1.5 rounded-md hover:bg-red-700 transition-colors"
              >
                Archive
              </button>
            </div>
          </div>
        </div>
      )}

      {showResetConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg border border-slate-200 shadow-xl p-6 w-full max-w-sm">
            <h3 className="text-sm font-semibold text-slate-900 mb-2">Reset All Data</h3>
            <p className="text-sm text-slate-600 mb-1">
              This will delete all leads, conversations, quotations, and archived data.
            </p>
            <p className="text-xs text-slate-400 mb-5">
              The product catalogue and sample company will be restored. This cannot be undone.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="text-xs font-medium bg-white border border-slate-200 text-slate-600 px-4 py-1.5 rounded-md hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => { setShowResetConfirm(false); resetData(); }}
                className="text-xs font-medium bg-red-600 text-white px-4 py-1.5 rounded-md hover:bg-red-700 transition-colors"
              >
                Reset Everything
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
