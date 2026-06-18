import { blankProduct } from "./presets";
import type { ImageCompressionStats, Product } from "./types";

export function makeNewProduct(sortOrder = 0): Product {
  return {
    ...blankProduct,
    sortOrder,
    id: `product-${crypto.randomUUID()}`,
    updatedAt: new Date().toISOString(),
  };
}

export function compressionSavings(stats: ImageCompressionStats): number {
  if (!stats.originalBytes) return 0;
  return Math.max(
    0,
    Math.round((1 - stats.compressedBytes / stats.originalBytes) * 100),
  );
}
