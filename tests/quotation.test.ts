import { describe, it, expect, beforeEach } from "vitest";
import {
  calculatePrice,
  applyDiscount,
  calculateTax,
} from "@/services/business/quotation";
import { getStore } from "@/lib/store";
import { Product } from "@/types";

describe("Quotation Engine", () => {
  let store: ReturnType<typeof getStore>;

  beforeEach(() => {
    store = getStore();
    store.reset();
  });

  function makeProduct(overrides: Partial<Product> = {}): Product {
    return {
      id: "PRD-TEST",
      sku: "TEST-001",
      name: "Test Product",
      description: "A test product",
      category: "valves",
      material: "SS304",
      availableSizes: ['2"'],
      availablePressureClasses: ["Class 150"],
      applications: ["Water Treatment"],
      basePrice: 1850,
      leadTimeDays: 7,
      moq: 10,
      specifications: {},
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };
  }

  describe("calculatePrice", () => {
    it("should calculate 50 units at ₹1850 = ₹92,500", () => {
      const product = makeProduct({ basePrice: 1850 });
      const result = calculatePrice(product, 50);

      expect(result.unitPrice).toBe(1850);
      expect(result.subtotal).toBe(92500);
    });

    it("should return basePrice as unitPrice", () => {
      const product = makeProduct({ basePrice: 3200 });
      const result = calculatePrice(product, 10);

      expect(result.unitPrice).toBe(3200);
    });

    it("should handle quantity of 1", () => {
      const product = makeProduct({ basePrice: 5000 });
      const result = calculatePrice(product, 1);

      expect(result.subtotal).toBe(5000);
    });
  });

  describe("applyDiscount", () => {
    it("should apply 5% discount for subtotal > ₹5,00,000", () => {
      const result = applyDiscount(600000);

      expect(result.discountPercentage).toBe(5);
      expect(result.discount).toBe(30000);
      expect(result.reason).toContain("Volume discount");
    });

    it("should apply 8% discount for subtotal > ₹10,00,000", () => {
      const result = applyDiscount(1200000);

      expect(result.discountPercentage).toBe(8);
      expect(result.discount).toBe(96000);
      expect(result.reason).toContain("High value order");
    });

    it("should cap discount at 10%", () => {
      const result = applyDiscount(5000000, { name: "Big Corp", id: "CO-001" });

      expect(result.discountPercentage).toBeLessThanOrEqual(10);
    });

    it("should apply no discount for small subtotals", () => {
      const result = applyDiscount(100000);

      expect(result.discountPercentage).toBe(0);
      expect(result.discount).toBe(0);
      expect(result.reason).toBe("No discount applicable");
    });
  });

  describe("calculateTax", () => {
    it("should calculate 18% GST", () => {
      const tax = calculateTax(100000);

      expect(tax).toBe(18000);
    });

    it("should round tax to nearest integer", () => {
      const tax = calculateTax(55555);

      expect(Number.isInteger(tax)).toBe(true);
      expect(tax).toBe(10000);
    });

    it("should return 0 for zero amount", () => {
      expect(calculateTax(0)).toBe(0);
    });
  });

  describe("full calculation flow", () => {
    it("should calculate price → discount → tax → total correctly", () => {
      const product = makeProduct({ basePrice: 1850 });

      const { unitPrice, subtotal } = calculatePrice(product, 50);
      expect(subtotal).toBe(92500);

      const { discount, discountPercentage } = applyDiscount(subtotal);
      expect(discountPercentage).toBe(0);
      expect(discount).toBe(0);

      const amountAfterDiscount = subtotal - discount;
      const tax = calculateTax(amountAfterDiscount);
      const total = amountAfterDiscount + tax;

      expect(total).toBe(subtotal + Math.round(subtotal * 0.18));
    });

    it("should apply discount and tax on a large order", () => {
      const product = makeProduct({ basePrice: 1850 });

      const { subtotal } = calculatePrice(product, 500);
      expect(subtotal).toBe(925000);

      const { discount } = applyDiscount(subtotal);
      const amountAfterDiscount = subtotal - discount;
      const tax = calculateTax(amountAfterDiscount);
      const total = amountAfterDiscount + tax;

      expect(discount).toBeGreaterThan(0);
      expect(total).toBeLessThan(subtotal + Math.round(subtotal * 0.18));
      expect(total).toBe(amountAfterDiscount + tax);
    });
  });
});
