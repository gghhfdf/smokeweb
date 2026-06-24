export type ProductStatus = "live" | "draft";
export type AccentTheme =
  | "wenkai-sage"
  | "kuaile-peach"
  | "xiaowei-porcelain"
  | "mashan-amber"
  | "longcang-ink";
export type GridDensity = "editorial" | "compact";
export type FontPreset = "wenkai" | "kuaile" | "xiaowei" | "mashan" | "longcang";
export type HeroLayout = "editorial" | "catalog" | "minimal";
export type ProductSort = "manual" | "updated" | "name" | "price";

export interface AdminUser {
  id: string;
  displayName: string;
  username: string;
  passwordHash: string;
  createdAt: string;
}

export interface Product {
  id: string;
  name: string;
  subtitle: string;
  category: string;
  price: number;
  specs: string;
  stock: number;
  status: ProductStatus;
  featured: boolean;
  description: string;
  imageIds: string[];
  coverImageId?: string;
  tags?: string[];
  sortOrder?: number;
  origin?: string;
  flavorNotes?: string;
  imageMeta?: Record<string, { alt?: string; note?: string }>;
  updatedAt: string;
}

export interface SiteSettings {
  brandName: string;
  heroTitle: string;
  heroBody: string;
  accentTheme: AccentTheme;
  fontPreset: FontPreset;
  requireAgeGate: boolean;
  gridDensity: GridDensity;
  heroLayout: HeroLayout;
  defaultSort: ProductSort;
  showStock: boolean;
  showPrice: boolean;
  showOrigin: boolean;
  showFlavorNotes: boolean;
}

export interface AppState {
  adminUser: AdminUser | null;
  products: Product[];
  settings: SiteSettings;
  ageVerified: boolean;
  sessionUserId: string | null;
}

export interface ImageRecord {
  id: string;
  blob: Blob;
  name: string;
  type: string;
  createdAt: string;
  compression?: ImageCompressionStats;
}

export interface ImageCompressionStats {
  originalBytes: number;
  compressedBytes: number;
  originalWidth: number;
  originalHeight: number;
  width: number;
  height: number;
  type: string;
  quality: number;
  targetBytes: number;
  maxBytes: number;
  iterations: number;
}

export interface CloudCapacity {
  databaseBytes: number;
  databaseLimitBytes: number;
  imageBytes: number;
  decodedImageBytes?: number;
  imageCount: number;
  productCount: number;
  averageImageBytes: number;
  averageDecodedImageBytes?: number;
  largestImageBytes?: number;
  estimatedImageSlots: number;
  updatedAt: string;
  lastCheckedAt?: string;
  quotaWarnings?: string[];
}

export interface ExportPayload {
  version: 1 | 2;
  exportedAt: string;
  adminUser: AdminUser | null;
  products: Product[];
  settings: SiteSettings;
  ageVerified: boolean;
  images: Array<{
    id: string;
    name: string;
    type: string;
    createdAt: string;
    dataUrl: string;
  }>;
}
