import { CustomerIntent, Lead } from "@/types";
import { getAIProvider } from "@/services/providers/ai";

export interface CustomerIntentResult {
  intent: CustomerIntent;
  confidence: number;
  recommendedAction: string;
}

export async function classifyIntent(message: string): Promise<CustomerIntentResult> {
  const provider = getAIProvider();
  const result = await provider.classifyCustomerIntent(message);
  return {
    intent: result.intent,
    confidence: result.confidence,
    recommendedAction: result.recommendedAction,
  };
}

export interface NextAction {
  action: string;
  priority: "LOW" | "MEDIUM" | "HIGH";
  reason: string;
  messageTemplate?: string;
}

export async function recommendAction(lead: Lead): Promise<NextAction> {
  const provider = getAIProvider();
  const result = await provider.recommendNextAction(lead, null, null);
  return {
    action: result.action,
    priority: result.priority,
    reason: result.reason,
    messageTemplate: result.messageTemplate,
  };
}
