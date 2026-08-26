import {
  Lead,
  Product,
  Quotation,
  QuotationItem,
  QuotationStatus,
  RFQ,
} from "@/types";
import { getStore } from "@/lib/store";
import { formatCurrency } from "@/lib/utils";

export interface QuotationSummary {
  quotation: Quotation;
  items: QuotationItem[];
  company: { name: string; contactPerson: string } | null;
  lead: Lead;
  formattedSubtotal: string;
  formattedDiscount: string;
  formattedTax: string;
  formattedTotal: string;
}

export function calculatePrice(
  product: Product,
  quantity: number
): { unitPrice: number; subtotal: number } {
  const unitPrice = product.basePrice;
  const subtotal = unitPrice * quantity;
  return { unitPrice, subtotal };
}

export function applyDiscount(
  subtotal: number,
  customerCompany?: { name?: string; id?: string }
): { discount: number; discountPercentage: number; reason: string } {
  const store = getStore();
  let discountPercentage = 0;
  let reason = "";

  if (subtotal > 1000000) {
    discountPercentage = 8;
    reason = "High value order (>₹10,00,000)";
  } else if (subtotal > 500000) {
    discountPercentage = 5;
    reason = "Volume discount (>₹5,00,000)";
  }

  const isRepeatCustomer = customerCompany?.id
    ? store.getQuotationsByLead("").length > 1
    : false;

  if (isRepeatCustomer) {
    discountPercentage = Math.min(discountPercentage + 2, 10);
    reason = reason
      ? `${reason} + repeat customer discount`
      : "Repeat customer discount";
  }

  if (!reason) {
    reason = "No discount applicable";
  }

  const maxDiscountPercentage = 10;
  const finalPercentage = Math.min(discountPercentage, maxDiscountPercentage);
  const discount = Math.round(subtotal * (finalPercentage / 100));

  return {
    discount,
    discountPercentage: finalPercentage,
    reason,
  };
}

export function calculateTax(amountAfterDiscount: number): number {
  const GST_RATE = 0.18;
  return Math.round(amountAfterDiscount * GST_RATE);
}

export function createQuotation(
  leadId: string,
  rfqId: string
): Quotation | null {
  const store = getStore();
  const lead = store.getLead(leadId);
  if (!lead) return null;

  const rfq = store.getRFQ(rfqId);
  if (!rfq) return null;

  const productMatch = findMatchingProduct(rfq);
  if (!productMatch) return null;

  const quantity = rfq.quantity || productMatch.moq;
  const { unitPrice, subtotal } = calculatePrice(productMatch, quantity);

  const company = lead.companyId
    ? store.getCompany(lead.companyId)
    : undefined;

  const { discount, discountPercentage, reason } = applyDiscount(subtotal, {
    name: company?.name,
    id: company?.id,
  });

  const amountAfterDiscount = subtotal - discount;
  const taxAmount = calculateTax(amountAfterDiscount);
  const totalAmount = amountAfterDiscount + taxAmount;

  const quotationNumber = `QUO-${String(store.quotations.length + 1).padStart(4, "0")}`;

  const quotation = store.createQuotation({
    leadId,
    rfqId,
    companyId: lead.companyId,
    status: QuotationStatus.DRAFT,
    quotationNumber,
    version: 1,
    subtotal,
    discount,
    taxAmount,
    totalAmount,
    currency: "INR",
    validityDays: 15,
    paymentTerms: "100% advance against proforma invoice",
    deliveryTerms: `Ex-works, Lead time: ${productMatch.leadTimeDays} working days`,
    notes: `Discount applied: ${reason} (${discountPercentage}%)`,
    internalNotes: `Product: ${productMatch.sku} | Base price: ₹${productMatch.basePrice}/nos`,
  });

  store.createQuotationItem({
    quotationId: quotation.id,
    productId: productMatch.id,
    productName: productMatch.name,
    description: productMatch.description,
    size: rfq.size || undefined,
    pressureClass: rfq.pressureClass || undefined,
    quantity,
    unitPrice,
    discount: discountPercentage,
    discountType: "PERCENTAGE",
    taxRate: 18,
    totalPrice: Math.round(unitPrice * quantity * (1 - discountPercentage / 100) * 1.18),
    leadTimeDays: productMatch.leadTimeDays,
  });

  return store.getQuotation(quotation.id) || null;
}

function findMatchingProduct(rfq: RFQ): Product | null {
  const store = getStore();
  const category = rfq.productCategory?.toLowerCase() || "";
  const material = rfq.material || "";

  const products = store.products.filter((p) => p.isActive);

  let bestMatch: Product | null = null;
  let bestScore = -1;

  for (const product of products) {
    let score = 0;

    if (
      product.category.toLowerCase() === category ||
      category.includes(product.category.toLowerCase()) ||
      product.category.toLowerCase().includes(category)
    ) {
      score += 30;
    }

    const productMaterialLower = product.material.toLowerCase();
    const rfqMaterialLower = material.toLowerCase();
    if (
      productMaterialLower === rfqMaterialLower ||
      rfqMaterialLower.includes(productMaterialLower) ||
      productMaterialLower.includes(rfqMaterialLower)
    ) {
      score += 25;
    }

    if (rfq.size && product.availableSizes.includes(rfq.size)) {
      score += 20;
    }

    if (
      rfq.pressureClass &&
      product.availablePressureClasses.includes(rfq.pressureClass)
    ) {
      score += 15;
    }

    if (
      rfq.application &&
      product.applications.some(
        (a) =>
          a.toLowerCase().includes(rfq.application!.toLowerCase()) ||
          rfq.application!.toLowerCase().includes(a.toLowerCase())
      )
    ) {
      score += 10;
    }

    if (score > bestScore) {
      bestScore = score;
      bestMatch = product;
    }
  }

  if (bestScore < 10) {
    return products.length > 0 ? products[0] : null;
  }

  return bestMatch;
}

export function generateQuotationSummary(
  quotationId: string
): QuotationSummary | null {
  const store = getStore();
  const quotation = store.getQuotation(quotationId);
  if (!quotation) return null;

  const items = store.getQuotationItems(quotationId);
  const lead = store.getLead(quotation.leadId);
  const company = quotation.companyId
    ? store.getCompany(quotation.companyId)
    : null;

  if (!lead) return null;

  return {
    quotation,
    items,
    company: company
      ? { name: company.name, contactPerson: company.contactPerson }
      : null,
    lead,
    formattedSubtotal: formatCurrency(quotation.subtotal),
    formattedDiscount: quotation.discount
      ? formatCurrency(quotation.discount)
      : "₹0",
    formattedTax: formatCurrency(quotation.taxAmount),
    formattedTotal: formatCurrency(quotation.totalAmount),
  };
}
