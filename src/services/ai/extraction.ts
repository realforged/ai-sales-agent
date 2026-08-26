import { getAIProvider, ExtractionResult } from "@/services/providers/ai";

export async function extractRequirements(text: string): Promise<ExtractionResult> {
  const provider = getAIProvider();
  return provider.extractRequirements(text);
}
