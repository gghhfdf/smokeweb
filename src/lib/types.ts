export type ProductStatus = "live" | "draft";
export type AccentTheme = "sage" | "champagne" | "graphite";
export type GridDensity = "editorial" | "compact";
export type FontPreset = "heritage" | "modern" | "editorial";

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
  showStock: boolean;
  showPrice: boolean;
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
}

export interface ExportPayload {
  version: 1;
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
