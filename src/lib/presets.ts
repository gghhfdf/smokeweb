import type { AccentTheme, FontPreset, Product } from "./types";

export const blankProduct: Omit<Product, "id" | "updatedAt"> = {
  name: "",
  subtitle: "",
  category: "经典",
  price: 0,
  specs: "20 支 / 包",
  stock: 0,
  status: "draft",
  featured: false,
  description: "",
  imageIds: [],
  tags: [],
  sortOrder: 0,
  origin: "",
  flavorNotes: "",
  imageMeta: {},
};

export const themeOptions: Array<{
  value: AccentTheme;
  label: string;
  body: string;
  swatches: string[];
}> = [
  {
    value: "wenkai-sage",
    label: "文楷鼠尾草",
    body: "暖白、深绿、浅金，适合文艺高级的品牌橱窗。",
    swatches: ["#f7f4ec", "#1f2b27", "#b68a42"],
  },
  {
    value: "kuaile-peach",
    label: "快乐蜜桃",
    body: "蜜桃、奶白、浆果红，适合更亲和灵动的展示氛围。",
    swatches: ["#fff3ed", "#913f4f", "#f0a88f"],
  },
  {
    value: "xiaowei-porcelain",
    label: "小薇瓷白",
    body: "瓷白、青蓝、淡墨，适合东方杂志感和陈列秩序。",
    swatches: ["#f8f7f2", "#163f52", "#8aa9a7"],
  },
  {
    value: "mashan-amber",
    label: "马善政琥珀",
    body: "宣纸、琥珀、朱砂，适合古风礼盒和限量陈列。",
    swatches: ["#fbf1dc", "#6b2f24", "#d59b4a"],
  },
  {
    value: "longcang-ink",
    label: "龙藏墨青",
    body: "月白、墨青、青铜，适合书卷气和收藏感展示。",
    swatches: ["#f2f5f1", "#142d2d", "#7f936c"],
  },
];

export const fontOptions: Array<{
  value: FontPreset;
  label: string;
  sample: string;
  body: string;
}> = [
  {
    value: "wenkai",
    label: "霞鹜文楷",
    sample: "白金典藏",
    body: "楷意轻柔，中文正文和标题都更温润耐看。",
  },
  {
    value: "kuaile",
    label: "站酷快乐体",
    sample: "暖白橱窗",
    body: "可爱、圆润、有识别度，用于标题时更有亲和力。",
  },
  {
    value: "xiaowei",
    label: "站酷小薇",
    sample: "东方礼盒",
    body: "细长宋意，适合高端画册、分类标题和品牌名。",
  },
  {
    value: "mashan",
    label: "马善政毛笔",
    sample: "雅集典藏",
    body: "书法感强，适合古风主标题和限量款氛围。",
  },
  {
    value: "longcang",
    label: "龙藏手书",
    sample: "山月烟岚",
    body: "笔势飘逸，适合更传统、更有收藏感的展示页。",
  },
];
