import type {
  AccentTheme,
  FontPreset,
  GridDensity,
  HeroLayout,
  Product,
  ProductSort,
  SiteSettings,
} from "./types";

export const defaultSettings: SiteSettings = {
  brandName: "Cabinet Ops",
  heroTitle: "白金典藏系列",
  heroBody: "精选成人烟草产品目录，呈现规格、风味线索与陈列状态。",
  accentTheme: "wenkai-sage",
  fontPreset: "wenkai",
  requireAgeGate: true,
  gridDensity: "editorial",
  heroLayout: "editorial",
  defaultSort: "manual",
  showStock: true,
  showPrice: true,
  showOrigin: true,
  showFlavorNotes: true,
};

const themeAliases: Record<string, AccentTheme> = {
  sage: "wenkai-sage",
  champagne: "mashan-amber",
  graphite: "xiaowei-porcelain",
};

const fontAliases: Record<string, FontPreset> = {
  heritage: "wenkai",
  modern: "kuaile",
  editorial: "xiaowei",
};

const themeValues = new Set<AccentTheme>([
  "wenkai-sage",
  "kuaile-peach",
  "xiaowei-porcelain",
  "mashan-amber",
  "longcang-ink",
]);

const fontValues = new Set<FontPreset>([
  "wenkai",
  "kuaile",
  "xiaowei",
  "mashan",
  "longcang",
]);

const densityValues = new Set<GridDensity>(["editorial", "compact"]);
const heroLayoutValues = new Set<HeroLayout>(["editorial", "catalog", "minimal"]);
const productSortValues = new Set<ProductSort>(["manual", "updated", "name", "price"]);

function normalizeAccentTheme(value: unknown): AccentTheme {
  if (typeof value !== "string") return defaultSettings.accentTheme;
  if (themeValues.has(value as AccentTheme)) return value as AccentTheme;
  return themeAliases[value] ?? defaultSettings.accentTheme;
}

function normalizeFontPreset(value: unknown): FontPreset {
  if (typeof value !== "string") return defaultSettings.fontPreset;
  if (fontValues.has(value as FontPreset)) return value as FontPreset;
  return fontAliases[value] ?? defaultSettings.fontPreset;
}

function normalizeGridDensity(value: unknown): GridDensity {
  return densityValues.has(value as GridDensity)
    ? (value as GridDensity)
    : defaultSettings.gridDensity;
}

function normalizeHeroLayout(value: unknown): HeroLayout {
  return heroLayoutValues.has(value as HeroLayout)
    ? (value as HeroLayout)
    : defaultSettings.heroLayout;
}

function normalizeProductSort(value: unknown): ProductSort {
  return productSortValues.has(value as ProductSort)
    ? (value as ProductSort)
    : defaultSettings.defaultSort;
}

export function normalizeSettings(
  settings?: Partial<SiteSettings> | null,
): SiteSettings {
  const merged = {
    ...defaultSettings,
    ...(settings ?? {}),
  };

  return {
    ...merged,
    accentTheme: normalizeAccentTheme(merged.accentTheme),
    fontPreset: normalizeFontPreset(merged.fontPreset),
    gridDensity: normalizeGridDensity(merged.gridDensity),
    heroLayout: normalizeHeroLayout(merged.heroLayout),
    defaultSort: normalizeProductSort(merged.defaultSort),
    showOrigin: Boolean(merged.showOrigin),
    showFlavorNotes: Boolean(merged.showFlavorNotes),
  };
}

export function normalizeProduct(product: Partial<Product>, index = 0): Product {
  const imageIds = Array.isArray(product.imageIds)
    ? product.imageIds.filter((id): id is string => typeof id === "string")
    : [];

  return {
    id: product.id || `product-${crypto.randomUUID()}`,
    name: product.name?.trim() || "未命名商品",
    subtitle: product.subtitle ?? "",
    category: product.category?.trim() || "经典",
    price: Number.isFinite(Number(product.price)) ? Number(product.price) : 0,
    specs: product.specs?.trim() || "20 支 / 包",
    stock: Number.isFinite(Number(product.stock)) ? Number(product.stock) : 0,
    status: product.status === "live" ? "live" : "draft",
    featured: Boolean(product.featured),
    description: product.description ?? "",
    imageIds,
    coverImageId: product.coverImageId ?? imageIds[0],
    tags: Array.isArray(product.tags)
      ? product.tags.filter((tag): tag is string => typeof tag === "string" && tag.trim().length > 0)
      : [],
    sortOrder: Number.isFinite(Number(product.sortOrder))
      ? Number(product.sortOrder)
      : index,
    origin: product.origin ?? "",
    flavorNotes: product.flavorNotes ?? "",
    imageMeta:
      product.imageMeta && typeof product.imageMeta === "object"
        ? product.imageMeta
        : {},
    updatedAt: product.updatedAt || new Date().toISOString(),
  };
}

export function normalizeProducts(products?: Partial<Product>[] | null): Product[] {
  if (!Array.isArray(products)) return [];
  return products.map((product, index) => normalizeProduct(product, index));
}

export const initialProducts: Product[] = [
  {
    id: "product-platinum",
    name: "白金典藏",
    subtitle: "柔和白金调 · 精选陈列",
    category: "经典",
    price: 58,
    specs: "20 支 / 包",
    stock: 84,
    status: "live",
    featured: true,
    description:
      "适合首屏主推的高端陈列款，柔和白金调带来干净、克制的视觉印象。",
    imageIds: [],
    updatedAt: new Date().toISOString(),
  },
  {
    id: "product-silver",
    name: "冷杉银标",
    subtitle: "清冷银灰调 · 稳定在售",
    category: "经典",
    price: 46,
    specs: "20 支 / 包",
    stock: 126,
    status: "live",
    featured: false,
    description: "清冷银灰调适合日常陈列，规格与库存信息清晰易读。",
    imageIds: [],
    updatedAt: new Date().toISOString(),
  },
  {
    id: "product-rose",
    name: "玫瑰金限定",
    subtitle: "限量礼盒调 · 待补充图片",
    category: "限量",
    price: 68,
    specs: "20 支 / 包",
    stock: 18,
    status: "draft",
    featured: false,
    description: "限量礼盒调适合重点陈列，补充主图后可加入公开橱窗。",
    imageIds: [],
    updatedAt: new Date().toISOString(),
  },
];
