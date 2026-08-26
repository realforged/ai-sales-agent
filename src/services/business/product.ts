import { Product, RFQ } from "@/types";
import { getStore } from "@/lib/store";

export interface ProductMatchResult {
  product: Product;
  score: number;
  matchDetails: {
    categoryMatch: boolean;
    materialMatch: boolean;
    sizeAvailable: boolean;
    pressureClassAvailable: boolean;
    applicationMatch: boolean;
  };
}

export function findProduct(
  category: string,
  material: string,
  specifications: Record<string, string>
): ProductMatchResult | null {
  const store = getStore();
  const products = store.products.filter((p) => p.isActive);

  let bestMatch: ProductMatchResult | null = null;
  let bestScore = -1;

  for (const product of products) {
    let score = 0;
    const matchDetails = {
      categoryMatch: false,
      materialMatch: false,
      sizeAvailable: false,
      pressureClassAvailable: false,
      applicationMatch: false,
    };

    const catLower = category.toLowerCase();
    const prodCatLower = product.category.toLowerCase();
    if (prodCatLower === catLower || catLower.includes(prodCatLower) || prodCatLower.includes(catLower)) {
      score += 30;
      matchDetails.categoryMatch = true;
    }

    const matLower = material.toLowerCase();
    const prodMatLower = product.material.toLowerCase();
    if (
      prodMatLower === matLower ||
      matLower.includes(prodMatLower) ||
      prodMatLower.includes(matLower)
    ) {
      score += 25;
      matchDetails.materialMatch = true;
    }

    if (specifications.size) {
      if (product.availableSizes.includes(specifications.size)) {
        score += 20;
        matchDetails.sizeAvailable = true;
      }
    }

    if (specifications.pressureClass) {
      if (
        product.availablePressureClasses.includes(specifications.pressureClass)
      ) {
        score += 15;
        matchDetails.pressureClassAvailable = true;
      }
    }

    if (specifications.application) {
      const appLower = specifications.application.toLowerCase();
      if (
        product.applications.some(
          (a) =>
            a.toLowerCase().includes(appLower) || appLower.includes(a.toLowerCase())
        )
      ) {
        score += 10;
        matchDetails.applicationMatch = true;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestMatch = { product, score, matchDetails };
    }
  }

  if (bestScore < 10) {
    return null;
  }

  return bestMatch;
}

export function validateProductMatch(
  product: Product,
  rfq: RFQ
): {
  valid: boolean;
  issues: string[];
  suggestions: string[];
} {
  const issues: string[] = [];
  const suggestions: string[] = [];

  if (
    rfq.size &&
    !product.availableSizes.includes(rfq.size)
  ) {
    issues.push(
      `Size ${rfq.size} is not available for ${product.name}`
    );
    suggestions.push(
      `Available sizes: ${product.availableSizes.join(", ")}`
    );
  }

  if (
    rfq.pressureClass &&
    !product.availablePressureClasses.includes(rfq.pressureClass)
  ) {
    issues.push(
      `Pressure class ${rfq.pressureClass} is not available for ${product.name}`
    );
    suggestions.push(
      `Available pressure classes: ${product.availablePressureClasses.join(", ")}`
    );
  }

  if (rfq.quantity && rfq.quantity < product.moq) {
    issues.push(
      `Quantity ${rfq.quantity} is below MOQ of ${product.moq} for ${product.name}`
    );
    suggestions.push(`Minimum order quantity: ${product.moq} nos`);
  }

  if (
    rfq.material &&
    rfq.material.toLowerCase() !== product.material.toLowerCase() &&
    !rfq.material.toLowerCase().includes(product.material.toLowerCase()) &&
    !product.material.toLowerCase().includes(rfq.material.toLowerCase())
  ) {
    issues.push(
      `Material mismatch: requested ${rfq.material}, product uses ${product.material}`
    );
  }

  return {
    valid: issues.length === 0,
    issues,
    suggestions,
  };
}

export function getProductCatalogue(): Product[] {
  const store = getStore();
  return store.products.filter((p) => p.isActive);
}
