import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { EscalationStatus, LeadStatus } from "@/types";
import {
  getDashboardMetrics,
  getAIRecommendations,
  runDemoScenario,
  archiveLead,
  restoreLead,
} from "@/lib/lead-service";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, scenarioId, days } = body;

    switch (action) {
      case "get_metrics": {
        const metrics = getDashboardMetrics();
        const store = getStore();
        return NextResponse.json({
          ...metrics,
          currentTime: store.getCurrentTime().toISOString(),
        });
      }

      case "get_recommendations": {
        const recommendations = getAIRecommendations();
        return NextResponse.json({ recommendations });
      }

      case "run_scenario": {
        if (!scenarioId || typeof scenarioId !== "number") {
          return NextResponse.json(
            { error: "scenarioId is required and must be a number" },
            { status: 400 }
          );
        }
        const result = runDemoScenario(scenarioId);
        const store = getStore();
        return NextResponse.json({
          ...result,
          currentTime: store.getCurrentTime().toISOString(),
        });
      }

      case "advance_time": {
        const store = getStore();
        const advanceDays = days && typeof days === "number" ? days : 1;
        store.advanceTime(advanceDays);
        return NextResponse.json({
          success: true,
          currentTime: store.getCurrentTime().toISOString(),
        });
      }

      case "reset": {
        const store = getStore();
        store.reset();
        return NextResponse.json({
          success: true,
          currentTime: store.getCurrentTime().toISOString(),
        });
      }

      case "resolve_escalation": {
        const store = getStore();
        const { escalationId } = body;
        if (escalationId) {
          store.updateEscalation(escalationId, {
            status: EscalationStatus.RESOLVED,
            resolvedBy: "MANAGER",
            resolvedAt: store.getCurrentTime(),
          });
        }
        return NextResponse.json({ success: true });
      }

      case "archive_lead": {
        const { leadId } = body;
        if (!leadId) {
          return NextResponse.json({ error: "leadId required" }, { status: 400 });
        }
        const result = archiveLead(leadId);
        if (!result) {
          return NextResponse.json({ error: "Lead not found or already archived" }, { status: 404 });
        }
        return NextResponse.json({ success: true, lead: result });
      }

      case "restore_lead": {
        const { leadId } = body;
        if (!leadId) {
          return NextResponse.json({ error: "leadId required" }, { status: 400 });
        }
        const result = restoreLead(leadId);
        if (!result) {
          return NextResponse.json({ error: "Lead not found or not archived" }, { status: 404 });
        }
        return NextResponse.json({ success: true, lead: result });
      }

      case "get_archived": {
        const store = getStore();
        const archived = store.leads
          .filter((l) => l.status === LeadStatus.ARCHIVED)
          .map((lead) => {
            const company = lead.companyId ? store.getCompany(lead.companyId) : null;
            return {
              id: lead.id,
              contactName: lead.contactName,
              companyName: company?.name || "Unknown",
              source: lead.source,
              archivedAt: lead.updatedAt,
            };
          });
        return NextResponse.json({ leads: archived });
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
