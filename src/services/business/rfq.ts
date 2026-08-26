import { RFQ, RFQField, RFQStatus } from "@/types";
import { getStore } from "@/lib/store";
import { generateId } from "@/lib/utils";

const REQUIRED_FIELDS: Record<string, string[]> = {
  valves: [
    "product",
    "quantity",
    "material",
    "size",
    "pressureClass",
    "application",
    "deliveryLocation",
    "deliveryTimeline",
  ],
  pumps: [
    "product",
    "quantity",
    "material",
    "size",
    "application",
    "deliveryLocation",
    "deliveryTimeline",
  ],
  flanges: [
    "product",
    "quantity",
    "material",
    "size",
    "pressureClass",
    "deliveryLocation",
    "deliveryTimeline",
  ],
  fitting: [
    "product",
    "quantity",
    "material",
    "size",
    "deliveryLocation",
    "deliveryTimeline",
  ],
  general: [
    "product",
    "quantity",
    "deliveryLocation",
    "deliveryTimeline",
  ],
};

export function getRequiredFields(productCategory: string): string[] {
  const key = productCategory.toLowerCase();
  return REQUIRED_FIELDS[key] || REQUIRED_FIELDS.general;
}

export function createRFQ(
  leadId: string,
  extractedData: Record<string, unknown>
): RFQ | null {
  const store = getStore();

  const productCategory =
    (extractedData.product as string) || "general";

  const rfq = store.createRFQ({
    leadId,
    status: RFQStatus.DRAFT,
    productCategory: productCategory,
    productName: (extractedData.product as string) || undefined,
    material: (extractedData.material as string) || undefined,
    quantity: (extractedData.quantity as number) || undefined,
    unit: "nos",
    size: (extractedData.size as string) || undefined,
    pressureClass: (extractedData.pressureClass as string) || undefined,
    application: (extractedData.application as string) || undefined,
    deliveryDate: (extractedData.deliveryTimeline as string) || undefined,
    deliveryLocation: (extractedData.deliveryLocation as string) || undefined,
    rawText: JSON.stringify(extractedData),
    completenessScore: 0,
  });

  const requiredFields = getRequiredFields(productCategory);
  let filledCount = 0;

  for (const field of requiredFields) {
    const value = extractedData[field];
    const isExtracted = value !== undefined && value !== null && value !== "";

    store.createRFQField({
      rfqId: rfq.id,
      fieldName: field,
      fieldValue: isExtracted ? String(value) : undefined,
      isRequired: true,
      isExtracted,
      source: isExtracted ? "ai_extraction" : undefined,
    });

    if (isExtracted) filledCount++;
  }

  const completenessScore =
    requiredFields.length > 0
      ? Math.round((filledCount / requiredFields.length) * 100)
      : 0;

  const newStatus =
    completenessScore === 100
      ? RFQStatus.COMPLETE
      : completenessScore > 0
        ? RFQStatus.INCOMPLETE
        : RFQStatus.DRAFT;

  store.updateRFQ(rfq.id, {
    completenessScore,
    status: newStatus,
  });

  return store.getRFQ(rfq.id) || null;
}

export function updateRFQ(
  rfqId: string,
  newFieldData: Record<string, unknown>
): RFQ | null {
  const store = getStore();
  const rfq = store.getRFQ(rfqId);
  if (!rfq) return null;

  const updates: Partial<RFQ> = {};

  if (newFieldData.product !== undefined)
    updates.productCategory = String(newFieldData.product);
  if (newFieldData.quantity !== undefined)
    updates.quantity = Number(newFieldData.quantity);
  if (newFieldData.material !== undefined)
    updates.material = String(newFieldData.material);
  if (newFieldData.size !== undefined)
    updates.size = String(newFieldData.size);
  if (newFieldData.pressureClass !== undefined)
    updates.pressureClass = String(newFieldData.pressureClass);
  if (newFieldData.application !== undefined)
    updates.application = String(newFieldData.application);
  if (newFieldData.deliveryLocation !== undefined)
    updates.deliveryLocation = String(newFieldData.deliveryLocation);
  if (newFieldData.deliveryTimeline !== undefined)
    updates.deliveryDate = String(newFieldData.deliveryTimeline);

  store.updateRFQ(rfqId, updates);

  const existingFields = store.getRFQFields(rfqId);
  for (const field of existingFields) {
    if (newFieldData[field.fieldName] !== undefined) {
      const newVal = newFieldData[field.fieldName];
      const isFilled = newVal !== undefined && newVal !== null && newVal !== "";
      store.updateRFQField(field.id, {
        fieldValue: isFilled ? String(newVal) : undefined,
        isExtracted: isFilled,
        source: isFilled ? "ai_extraction" : field.source,
      });
    }
  }

  return checkCompleteness(rfqId);
}

export function checkCompleteness(rfqId: string): RFQ | null {
  const store = getStore();
  const rfq = store.getRFQ(rfqId);
  if (!rfq) return null;

  const fields = store.getRFQFields(rfqId);
  const required = fields.filter((f) => f.isRequired);
  const filled = required.filter(
    (f) => f.fieldValue !== undefined && f.fieldValue !== null && f.fieldValue !== ""
  );

  const completenessScore =
    required.length > 0
      ? Math.round((filled.length / required.length) * 100)
      : 0;

  const newStatus =
    completenessScore === 100
      ? RFQStatus.COMPLETE
      : completenessScore > 0
        ? RFQStatus.INCOMPLETE
        : RFQStatus.DRAFT;

  store.updateRFQ(rfqId, {
    completenessScore,
    status: newStatus,
  });

  return store.getRFQ(rfqId) || null;
}
