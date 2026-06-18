import type { AccentTheme, FontPreset, Product, SiteSettings } from "./types";

export const defaultSettings: SiteSettings = {
  brandName: "Cabinet Ops",
  heroTitle: "白金典藏系列",
  heroBody: "精选成人烟草产品展示，统一维护规格、状态、库存和商品图片。",
  accentTheme: "wenkai-sage",
  fontPreset: "wenkai",
  requireAgeGate: true,
  gridDensity: "editorial",
  showStock: true,
  showPrice: true,
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
  };
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
      "用于首屏主推的高端陈列款。上传真实商品图后会自动用于橱窗封面。",
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
    description: "适合列表中部展示的稳定在售商品，强调规格、库存和上下架状态。",
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
    description: "默认未上架，用于验证管理员上架、编辑和封面上传流程。",
    imageIds: [],
    updatedAt: new Date().toISOString(),
  },
];
