import {
  AlertTriangle,
  Archive,
  Check,
  ChevronRight,
  Cloud,
  Copy,
  Download,
  Eye,
  EyeOff,
  Filter,
  Gauge,
  Image as ImageIcon,
  LayoutDashboard,
  Lock,
  LogIn,
  LogOut,
  PackagePlus,
  Pencil,
  Search,
  Settings as SettingsIcon,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import {
  ChangeEvent,
  DragEvent,
  FormEvent,
  ReactNode,
  useEffect,
  useMemo,
  useState,
} from "react";
import { hashPassword, isStrongEnoughPassword } from "./lib/auth";
import {
  bulkCloudProductStatus,
  clearCloudAll,
  createCloudAdmin,
  deleteCloudProduct,
  isCloudEnabled,
  loadCloudState,
  loginCloudAdmin,
  logoutCloudAdmin,
  saveCloudProduct,
  saveCloudSettings,
  setCloudProductStatus,
  updateCloudAdmin,
} from "./lib/cloud";
import { defaultSettings } from "./lib/defaults";
import {
  formatBytes,
  IMAGE_COMPRESSION_MAX_BYTES,
  IMAGE_COMPRESSION_TARGET_BYTES,
} from "./lib/imageCompression";
import {
  buildExportPayload,
  clearImages,
  clearJsonState,
  imageRecordToObjectUrl,
  importPayload,
  initialAppState,
  loadAppState,
  removeImage,
  saveAdmin,
  saveAgeVerified,
  saveImageFile,
  saveProducts,
  saveSession,
  saveSettings,
} from "./lib/storage";
import type {
  AdminUser,
  AccentTheme,
  AppState,
  ExportPayload,
  FontPreset,
  GridDensity,
  ImageCompressionStats,
  Product,
  ProductSort,
  ProductStatus,
  SiteSettings,
} from "./lib/types";

type View = "storefront" | "login" | "admin" | "settings";
type ToastKind = "success" | "warning" | "danger";

interface ToastMessage {
  id: string;
  kind: ToastKind;
  text: string;
}

interface UploadReport {
  id: string;
  fileName: string;
  stats: ImageCompressionStats;
}

interface AdminUpdateInput {
  displayName: string;
  username: string;
  currentPassword: string;
  newPassword: string;
}

const blankProduct: Omit<Product, "id" | "updatedAt"> = {
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

const themeOptions: Array<{
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

const fontOptions: Array<{
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

export function App() {
  const [state, setState] = useState<AppState>(() => {
    try {
      return loadAppState();
    } catch {
      return initialAppState;
    }
  });
  const [view, setView] = useState<View>(() =>
    state.adminUser ? "storefront" : "login",
  );
  const [selectedProductId, setSelectedProductId] = useState<string | null>(
    state.products[0]?.id ?? null,
  );
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    title: string;
    body: string;
    action: () => void | Promise<void>;
  } | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const isAuthed = Boolean(
    state.adminUser && state.sessionUserId === state.adminUser.id,
  );
  const shellStyleClass = `theme-${
    state.settings.accentTheme ?? defaultSettings.accentTheme
  } font-${state.settings.fontPreset ?? defaultSettings.fontPreset}`;

  useEffect(() => {
    if (!isCloudEnabled) return;

    let alive = true;
    loadCloudState()
      .then((cloudState) => {
        if (!alive) return;
        setState((current) => ({
          ...cloudState,
          ageVerified: current.ageVerified,
        }));
        setSelectedProductId(cloudState.products[0]?.id ?? null);
        if (!cloudState.adminUser) {
          setView("login");
        } else if (cloudState.sessionUserId) {
          setView("storefront");
        }
      })
      .catch((error) => {
        pushToast(
          error instanceof Error ? error.message : "资料暂时无法读取。",
          "danger",
        );
      });

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (state.settings.requireAgeGate && !state.ageVerified) {
      return;
    }
    if (!isAuthed && (view === "admin" || view === "settings")) {
      setView("login");
      return;
    }
    if (!state.adminUser && view !== "login") {
      return;
    }
    if (state.adminUser && view === "login" && isAuthed) {
      setView("storefront");
    }
  }, [isAuthed, state.adminUser, state.ageVerified, state.settings.requireAgeGate, view]);

  function pushToast(text: string, kind: ToastKind = "success") {
    const id = crypto.randomUUID();
    setToasts((current) => [...current, { id, kind, text }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 3200);
  }

  function applyCloudState(cloudState: AppState) {
    setState((current) => ({
      ...cloudState,
      ageVerified: current.ageVerified,
    }));
    setSelectedProductId((current) =>
      current && cloudState.products.some((product) => product.id === current)
        ? current
        : cloudState.products[0]?.id ?? null,
    );
  }

  function updateProducts(products: Product[]) {
    setState((current) => ({ ...current, products }));
    saveProducts(products);
  }

  async function updateSettings(settings: SiteSettings) {
    if (isCloudEnabled) {
      try {
        applyCloudState(await saveCloudSettings(settings));
        pushToast("展示设置已保存。");
      } catch (error) {
        pushToast(error instanceof Error ? error.message : "展示设置保存失败。", "danger");
      }
      return;
    }

    setState((current) => ({ ...current, settings }));
    saveSettings(settings);
  }

  function adminUpdateErrorMessage(error: unknown): string {
    const message = error instanceof Error ? error.message.toLowerCase() : "";
    if (message.includes("current password")) return "当前密码不正确。";
    if (message.includes("username")) return "用户名已被使用。";
    if (message.includes("session")) return "登录已过期，请重新登录。";
    return "管理员账号保存失败。";
  }

  async function handleUpdateAdmin(input: AdminUpdateInput): Promise<boolean> {
    if (!state.adminUser || !checkAdmin()) return false;

    const username = input.username.trim();
    const displayName = input.displayName.trim() || "陈列管理员";
    const currentPasswordHash = await hashPassword(input.currentPassword);
    const newPasswordHash = input.newPassword
      ? await hashPassword(input.newPassword)
      : null;

    if (isCloudEnabled) {
      try {
        applyCloudState(
          await updateCloudAdmin({
            displayName,
            username,
            currentPasswordHash,
            newPasswordHash,
          }),
        );
        pushToast("管理员账号已更新。");
        return true;
      } catch (error) {
        pushToast(adminUpdateErrorMessage(error), "danger");
        return false;
      }
    }

    if (currentPasswordHash !== state.adminUser.passwordHash) {
      pushToast("当前密码不正确。", "danger");
      return false;
    }

    const updatedAdmin: AdminUser = {
      ...state.adminUser,
      displayName,
      username,
      passwordHash: newPasswordHash ?? state.adminUser.passwordHash,
    };

    setState((current) => ({
      ...current,
      adminUser: updatedAdmin,
      sessionUserId: updatedAdmin.id,
    }));
    saveAdmin(updatedAdmin);
    saveSession(updatedAdmin.id);
    pushToast("管理员账号已更新。");
    return true;
  }

  function requireAdmin(nextView: View = "admin"): boolean {
    if (!isAuthed) {
      setView("login");
      pushToast("请先登录管理员。", "warning");
      return false;
    }
    setView(nextView);
    return true;
  }

  function checkAdmin(): boolean {
    if (!isAuthed) {
      setView("login");
      pushToast("请先登录管理员。", "warning");
      return false;
    }
    return true;
  }

  async function handleAdminCreated(admin: AdminUser) {
    if (isCloudEnabled) {
      try {
        const cloudState = await createCloudAdmin(admin);
        applyCloudState(cloudState);
        setView("storefront");
        pushToast("管理员已创建。");
      } catch (error) {
        pushToast(error instanceof Error ? error.message : "管理员创建失败。", "danger");
      }
      return;
    }

    setState((current) => ({
      ...current,
      adminUser: admin,
      sessionUserId: admin.id,
    }));
    saveAdmin(admin);
    saveSession(admin.id);
    setView("storefront");
    pushToast("管理员已创建。");
  }

  async function handleLogin(username: string, password: string) {
    if (!state.adminUser) return;
    const passwordHash = await hashPassword(password);
    if (isCloudEnabled) {
      try {
        const cloudState = await loginCloudAdmin(username.trim(), passwordHash);
        applyCloudState(cloudState);
        setView("storefront");
        pushToast("已进入管理员。");
      } catch {
        pushToast("用户名或密码不正确。", "danger");
      }
      return;
    }

    if (
      username.trim() === state.adminUser.username &&
      passwordHash === state.adminUser.passwordHash
    ) {
      setState((current) => ({ ...current, sessionUserId: state.adminUser!.id }));
      saveSession(state.adminUser.id);
      setView("storefront");
    pushToast("已进入管理员。");
      return;
    }
    pushToast("用户名或密码不正确。", "danger");
  }

  async function handleLogout() {
    if (isCloudEnabled) {
      try {
        applyCloudState(await logoutCloudAdmin());
      } catch {
        setState((current) => ({ ...current, sessionUserId: null }));
      }
      setView("storefront");
      pushToast("已退出管理员。", "warning");
      return;
    }

    setState((current) => ({ ...current, sessionUserId: null }));
    saveSession(null);
    setView("storefront");
    pushToast("已退出管理员。", "warning");
  }

  function handleAgeVerified() {
    setState((current) => ({ ...current, ageVerified: true }));
    saveAgeVerified(true);
    if (!state.adminUser) {
      setView("login");
    }
  }

  function handleAgeDeclined() {
    pushToast("需要确认法定年龄后才能进入。", "danger");
  }

  async function handleSaveProduct(product: Product) {
    if (!checkAdmin()) return;
    const exists = state.products.some((item) => item.id === product.id);
    const updatedProduct = {
      ...product,
      updatedAt: new Date().toISOString(),
      coverImageId: product.coverImageId ?? product.imageIds[0],
    };

    if (isCloudEnabled) {
      try {
        applyCloudState(await saveCloudProduct(updatedProduct));
        setEditingProduct(null);
        setSelectedProductId(updatedProduct.id);
        pushToast(exists ? "商品档案已更新。" : "商品已加入陈列。");
      } catch (error) {
        pushToast(error instanceof Error ? error.message : "商品保存失败。", "danger");
      }
      return;
    }

    const products = exists
      ? state.products.map((item) =>
          item.id === product.id ? updatedProduct : item,
        )
      : [updatedProduct, ...state.products];
    updateProducts(products);
    setEditingProduct(null);
    setSelectedProductId(updatedProduct.id);
    pushToast(exists ? "商品档案已更新。" : "商品已加入陈列。");
  }

  async function handleToggleStatus(productId: string, status?: ProductStatus) {
    if (!checkAdmin()) return;
    if (isCloudEnabled) {
      try {
        applyCloudState(await setCloudProductStatus(productId, status));
        pushToast("展示状态已更新。");
      } catch (error) {
        pushToast(error instanceof Error ? error.message : "状态切换失败。", "danger");
      }
      return;
    }

    const products = state.products.map((product) => {
      if (product.id !== productId) return product;
      const nextStatus = status ?? (product.status === "live" ? "draft" : "live");
      return {
        ...product,
        status: nextStatus,
        updatedAt: new Date().toISOString(),
      };
    });
    updateProducts(products);
    pushToast("展示状态已更新。");
  }

  async function performBulkStatus(status: ProductStatus, productIds?: string[]) {
    const targetIds = productIds?.length ? productIds : undefined;
    if (isCloudEnabled) {
      try {
        applyCloudState(await bulkCloudProductStatus(status, targetIds));
        pushToast(status === "live" ? "已批量上架。" : "已批量下架。");
      } catch (error) {
        pushToast(error instanceof Error ? error.message : "批量操作失败。", "danger");
      }
      return;
    }

    updateProducts(
      state.products.map((product) =>
        !targetIds || targetIds.includes(product.id)
          ? {
              ...product,
              status,
              updatedAt: new Date().toISOString(),
            }
          : product,
      ),
    );
    pushToast(status === "live" ? "全部商品已上架。" : "全部商品已下架。");
  }

  function handleBulkStatus(status: ProductStatus, productIds?: string[]) {
    if (!checkAdmin()) return;
    const targetCount = productIds?.length ?? state.products.length;
    if (!targetCount) {
      pushToast("没有可操作的商品。", "warning");
      return;
    }
    const actionText = status === "live" ? "批量上架" : "批量下架";
    setConfirmAction({
      title: `${actionText}全部商品？`,
      body: `这会把当前商品列表全部切换为${status === "live" ? "已上架" : "未上架"}状态，确认后立即生效。`,
      action: () => performBulkStatus(status, productIds),
    });
  }

  async function performBulkDelete(productIds: string[]) {
    if (!productIds.length) return;
    if (isCloudEnabled) {
      try {
        let nextState: AppState | null = null;
        for (const productId of productIds) {
          nextState = await deleteCloudProduct(productId);
        }
        if (nextState) applyCloudState(nextState);
        pushToast(`已删除 ${productIds.length} 个商品。`, "warning");
      } catch (error) {
        pushToast(error instanceof Error ? error.message : "批量删除失败。", "danger");
      }
      return;
    }

    const deleting = state.products.filter((product) => productIds.includes(product.id));
    await Promise.all(deleting.flatMap((product) => product.imageIds.map((id) => removeImage(id))));
    const products = state.products.filter((product) => !productIds.includes(product.id));
    updateProducts(products);
    setSelectedProductId(products[0]?.id ?? null);
    pushToast(`已删除 ${productIds.length} 个商品。`, "warning");
  }

  function handleBulkDelete(productIds: string[]) {
    if (!checkAdmin()) return;
    if (!productIds.length) {
      pushToast("请先选择要删除的商品。", "warning");
      return;
    }
    setConfirmAction({
      title: `删除 ${productIds.length} 个商品？`,
      body: "删除后会同时移除关联图片，操作不可撤销。建议先导出备份。",
      action: () => performBulkDelete(productIds),
    });
  }

  async function handleDuplicateProduct(product: Product) {
    if (!checkAdmin()) return;
    const copy: Product = {
      ...product,
      id: `product-${crypto.randomUUID()}`,
      name: `${product.name} 副本`,
      status: "draft",
      featured: false,
      sortOrder: state.products.length,
      updatedAt: new Date().toISOString(),
    };
    await handleSaveProduct(copy);
  }

  function handleDeleteProduct(product: Product) {
    if (!checkAdmin()) return;
    setConfirmAction({
      title: `删除「${product.name}」？`,
      body: "删除商品会同时移除它关联的图片，操作不可撤销。",
      action: async () => {
        if (isCloudEnabled) {
          applyCloudState(await deleteCloudProduct(product.id));
          pushToast("商品已删除。", "warning");
          return;
        }

        await Promise.all(product.imageIds.map((id) => removeImage(id)));
        const products = state.products.filter((item) => item.id !== product.id);
        updateProducts(products);
        setSelectedProductId(products[0]?.id ?? null);
        pushToast("商品已删除。", "warning");
      },
    });
  }

  async function handleClearAllData() {
    if (!checkAdmin()) return;
    setConfirmAction({
      title: "清空全部资料？",
      body: "这会删除管理员、商品、设置和所有上传图片。请先导出备份。",
      action: async () => {
        if (isCloudEnabled) {
          applyCloudState(await clearCloudAll());
          setView("login");
          pushToast("全部资料已清空。", "warning");
          return;
        }

        clearJsonState();
        await clearImages();
        setState(initialAppState);
        setView("login");
        setSelectedProductId(initialAppState.products[0]?.id ?? null);
        pushToast("全部资料已清空。", "warning");
      },
    });
  }

  async function handleExportData() {
    const payload = await buildExportPayload(state);
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `cabinet-ops-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    pushToast("备份已导出。");
  }

  async function handleImportData(file: File) {
    if (!requireAdmin("settings")) return;
    let payload: ExportPayload;
    try {
      payload = JSON.parse(await file.text()) as ExportPayload;
      if (payload.version !== 1 && payload.version !== 2) {
        throw new Error("不支持的备份版本。");
      }
    } catch (error) {
      pushToast(error instanceof Error ? error.message : "备份文件无法读取。", "danger");
      return;
    }
    const productCount = Array.isArray(payload.products) ? payload.products.length : 0;
    const imageCount = Array.isArray(payload.images) ? payload.images.length : 0;
    setConfirmAction({
      title: "导入并覆盖现有资料？",
      body: `将导入 ${productCount} 个商品、${imageCount} 张图片，并覆盖当前商品、图片、设置和管理员资料。图片会先压缩到 30KB 内。`,
      action: async () => {
        try {
          const importedState = await importPayload(payload);
          if (isCloudEnabled) {
            applyCloudState(importedState);
            setView("storefront");
            pushToast("备份已导入，图片已重新压缩。");
            return;
          }

          setState(importedState);
          setSelectedProductId(importedState.products[0]?.id ?? null);
          setView("storefront");
          pushToast("备份已导入，图片已重新压缩。");
        } catch (error) {
          pushToast(error instanceof Error ? error.message : "导入失败，请检查备份文件。", "danger");
        }
      },
    });
  }

  if (state.settings.requireAgeGate && !state.ageVerified) {
    return (
      <div className={shellStyleClass}>
        <AgeGate
          brandName={state.settings.brandName}
          onAccept={handleAgeVerified}
          onDecline={handleAgeDeclined}
        />
        <ToastStack toasts={toasts} />
      </div>
    );
  }

  return (
    <div className={`app-shell ${shellStyleClass}`}>
      <TopNav
        brandName={state.settings.brandName}
        view={view}
        isAuthed={isAuthed}
        cloudEnabled={isCloudEnabled}
        hasAdmin={Boolean(state.adminUser)}
        onNavigate={(nextView) => {
          if (nextView === "admin" || nextView === "settings") {
            requireAdmin(nextView);
            return;
          }
          setView(nextView);
        }}
        onLogin={() => setView("login")}
        onLogout={handleLogout}
        onCreate={() => {
          if (!requireAdmin("admin")) return;
          setEditingProduct(makeNewProduct(state.products.length));
        }}
      />

      <div className="view-stack">
        {view === "login" ? (
          <div className="view-page">
            <AuthScreen
              adminUser={state.adminUser}
              onAdminCreated={handleAdminCreated}
              onLogin={handleLogin}
              onBrowse={() => setView("storefront")}
            />
          </div>
        ) : null}

        {view === "storefront" ? (
          <div className="view-page">
            <Storefront
              products={state.products}
              settings={state.settings}
              selectedProductId={selectedProductId}
              isAuthed={isAuthed}
              onSelectProduct={setSelectedProductId}
            />
          </div>
        ) : null}

        {view === "admin" ? (
          <div className="view-page">
            <ProductAdmin
              products={state.products}
              isAuthed={isAuthed}
              onCreate={() => setEditingProduct(makeNewProduct(state.products.length))}
              onEdit={setEditingProduct}
              onToggleStatus={handleToggleStatus}
              onDelete={handleDeleteProduct}
              onBulkStatus={handleBulkStatus}
              onBulkDelete={handleBulkDelete}
              onDuplicate={handleDuplicateProduct}
            />
          </div>
        ) : null}

        {view === "settings" && isAuthed ? (
          <div className="view-page">
            <SettingsPanel
              adminUser={state.adminUser}
              settings={state.settings}
              isAuthed={isAuthed}
              onSave={updateSettings}
              onUpdateAdmin={handleUpdateAdmin}
              onResetAge={() => {
                setState((current) => ({ ...current, ageVerified: false }));
                saveAgeVerified(false);
                pushToast("年龄确认已重置。", "warning");
              }}
              onExport={handleExportData}
              onImport={handleImportData}
              onClearAll={handleClearAllData}
            />
          </div>
        ) : null}
      </div>

      {editingProduct ? (
        <ProductEditor
          product={editingProduct}
          onSave={handleSaveProduct}
          onClose={() => setEditingProduct(null)}
          onToast={pushToast}
        />
      ) : null}

      {confirmAction ? (
        <ConfirmDialog
          title={confirmAction.title}
          body={confirmAction.body}
          onCancel={() => setConfirmAction(null)}
          onConfirm={async () => {
            await confirmAction.action();
            setConfirmAction(null);
          }}
        />
      ) : null}

      <ToastStack toasts={toasts} />
    </div>
  );
}

function makeNewProduct(sortOrder = 0): Product {
  return {
    ...blankProduct,
    sortOrder,
    id: `product-${crypto.randomUUID()}`,
    updatedAt: new Date().toISOString(),
  };
}

function compressionSavings(stats: ImageCompressionStats): number {
  if (!stats.originalBytes) return 0;
  return Math.max(
    0,
    Math.round((1 - stats.compressedBytes / stats.originalBytes) * 100),
  );
}

function TopNav({
  brandName,
  view,
  isAuthed,
  cloudEnabled,
  hasAdmin,
  onNavigate,
  onLogin,
  onLogout,
  onCreate,
}: {
  brandName: string;
  view: View;
  isAuthed: boolean;
  cloudEnabled: boolean;
  hasAdmin: boolean;
  onNavigate: (view: View) => void;
  onLogin: () => void;
  onLogout: () => void;
  onCreate: () => void;
}) {
  return (
    <header className="top-nav">
      <button
        className="brand-lockup"
        type="button"
        onClick={() => onNavigate("storefront")}
        aria-label="返回展示页"
      >
        <span>C</span>
        <strong>{brandName}</strong>
      </button>
      <nav aria-label="主导航">
        <button
          className={view === "storefront" ? "active" : ""}
          type="button"
          onClick={() => onNavigate("storefront")}
        >
          展示页
        </button>
        {isAuthed ? (
          <>
            <button
              className={view === "admin" ? "active" : ""}
              type="button"
              onClick={() => onNavigate("admin")}
            >
              商品
            </button>
            <button
              className={view === "settings" ? "active" : ""}
              type="button"
              onClick={() => onNavigate("settings")}
            >
              设置
            </button>
          </>
        ) : null}
      </nav>
      <div className="nav-actions">
        <div className="cloud-status" aria-label={cloudEnabled ? "资料已同步" : "离线预览"}>
          <Cloud size={15} />
          <span>{cloudEnabled ? "资料已同步" : "离线预览"}</span>
          <i>{isAuthed ? "管理员" : "游客模式"}</i>
        </div>
        {isAuthed ? (
          <button className="button secondary" type="button" onClick={onLogout}>
            <LogOut size={16} />
            退出
          </button>
        ) : (
          <button className="button secondary" type="button" onClick={onLogin}>
            <LogIn size={16} />
            {hasAdmin ? "管理员登录" : "创建管理员"}
          </button>
        )}
        {isAuthed && view === "admin" ? (
          <button className="button primary" type="button" onClick={onCreate}>
            <PackagePlus size={16} />
            新增商品
          </button>
        ) : null}
      </div>
    </header>
  );
}

function AgeGate({
  brandName,
  onAccept,
  onDecline,
}: {
  brandName: string;
  onAccept: () => void;
  onDecline: () => void;
}) {
  return (
    <main className="age-gate">
      <section className="age-panel">
        <div className="age-brand">
          <span>C</span>
          <strong>{brandName}</strong>
        </div>
        <div className="age-copy">
          <p>成人精选目录</p>
          <h1>请先确认您已达到所在地法定年龄。</h1>
          <span>
            精选系列仅向达到法定年龄的访客开放，内容用于品牌陈列与产品识别。
          </span>
        </div>
        <div className="age-actions">
          <button className="button primary" type="button" onClick={onAccept}>
            <ShieldCheck size={17} />
            我已达到法定年龄
          </button>
          <button className="button secondary" type="button" onClick={onDecline}>
            暂不进入
          </button>
        </div>
      </section>
      <aside className="age-side">
        <div>
          <span>Bright Collection</span>
          <strong>Mature Taste</strong>
        </div>
        <p>明色东方 · 精选陈列 · 从容浏览</p>
      </aside>
    </main>
  );
}

function AuthScreen({
  adminUser,
  onAdminCreated,
  onLogin,
  onBrowse,
}: {
  adminUser: AdminUser | null;
  onAdminCreated: (admin: AdminUser) => Promise<void>;
  onLogin: (username: string, password: string) => Promise<void>;
  onBrowse: () => void;
}) {
  const [displayName, setDisplayName] = useState("陈列管理员");
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (!username.trim()) {
      setError("请输入管理员用户名。");
      return;
    }
    if (!isStrongEnoughPassword(password)) {
      setError("密码至少需要 6 位。");
      return;
    }

    if (!adminUser) {
      await onAdminCreated({
        id: `admin-${crypto.randomUUID()}`,
        displayName: displayName.trim() || "陈列管理员",
        username: username.trim(),
        passwordHash: await hashPassword(password),
        createdAt: new Date().toISOString(),
      });
      return;
    }

    await onLogin(username.trim(), password);
  }

  return (
    <main className="auth-screen">
      <section className="auth-card">
        <div className="section-label">
          <Lock size={15} />
          {adminUser ? "管理员登录" : "首次创建管理员"}
        </div>
        <h1>{adminUser ? "登录管理员" : "创建管理员"}</h1>
        <p>
          登录后可整理商品档案、展示状态与品牌风格。游客可直接进入橱窗浏览。
        </p>
        <form className="auth-form" onSubmit={handleSubmit}>
          {!adminUser ? (
            <label>
              <span>显示名称</span>
              <input
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="例如：陈列管理员"
              />
            </label>
          ) : null}
          <label>
            <span>用户名</span>
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="admin"
              autoComplete="username"
            />
          </label>
          <label>
            <span>密码</span>
            <div className="password-field">
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                type={showPassword ? "text" : "password"}
                placeholder="至少 6 位"
                autoComplete={
                  adminUser ? "current-password" : "new-password"
                }
              />
              <button
                type="button"
                aria-label={showPassword ? "隐藏密码" : "显示密码"}
                onClick={() => setShowPassword((value) => !value)}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </label>
          {error ? <p className="field-error">{error}</p> : null}
          <button className="button primary wide" type="submit">
            {adminUser ? "登录管理员" : "创建管理员"}
          </button>
          <button className="button ghost wide" type="button" onClick={onBrowse}>
            <Eye size={16} />
            游客模式
          </button>
        </form>
      </section>
      <section className="auth-preview">
        <div className="preview-window">
          <div className="preview-toolbar">
            <span>精选橱窗</span>
            <button type="button">浏览</button>
          </div>
          <div className="preview-hero">
            <ImageIcon size={40} />
            <div>
              <h2>商品封面将在这里呈现</h2>
              <p>封面、规格、价格与库存会以统一版式展示。</p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function Storefront({
  products,
  settings,
  selectedProductId,
  isAuthed,
  onSelectProduct,
}: {
  products: Product[];
  settings: SiteSettings;
  selectedProductId: string | null;
  isAuthed: boolean;
  onSelectProduct: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("全部");
  const [status, setStatus] = useState<"all" | ProductStatus>("all");
  const [detailOpen, setDetailOpen] = useState(false);

  const catalogProducts = useMemo(() => {
    return [...products].sort((a, b) => {
      if (settings.defaultSort === "manual") return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
      if (settings.defaultSort === "name") return a.name.localeCompare(b.name, "zh-Hans-CN");
      if (settings.defaultSort === "price") return Number(a.price) - Number(b.price);
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }, [products, settings.defaultSort]);

  const categories = useMemo(
    () => ["全部", ...Array.from(new Set(catalogProducts.map((item) => item.category)))],
    [catalogProducts],
  );
  const liveCount = products.filter((item) => item.status === "live").length;
  const draftCount = products.length - liveCount;
  const selectedProduct =
    catalogProducts.find((product) => product.id === selectedProductId) ??
    catalogProducts[0];

  const filteredProducts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return catalogProducts.filter((product) => {
      const matchesQuery = normalizedQuery
        ? [
            product.name,
            product.subtitle,
            product.category,
            product.description,
            product.origin,
            product.flavorNotes,
            ...(product.tags ?? []),
          ]
            .join(" ")
            .toLowerCase()
            .includes(normalizedQuery)
        : true;
      const matchesCategory =
        category === "全部" ? true : product.category === category;
      const matchesStatus = status === "all" ? true : product.status === status;
      return matchesQuery && matchesCategory && matchesStatus;
    });
  }, [catalogProducts, category, query, status]);

  function resetFilters() {
    setQuery("");
    setCategory("全部");
    setStatus("all");
  }

  function selectProduct(productId: string) {
    onSelectProduct(productId);
    setDetailOpen(true);
  }

  return (
    <main className={`storefront density-${settings.gridDensity} hero-${settings.heroLayout}`}>
      <section className="store-hero">
        <div className="hero-copy">
          <div className="section-label">
            <Archive size={15} />
            精选目录
          </div>
          <h1>{settings.heroTitle}</h1>
          <p>{settings.heroBody}</p>
          <div className="hero-actions">
            <button
              className="button primary"
              type="button"
              onClick={() => selectedProduct && selectProduct(selectedProduct.id)}
            >
              查看精选
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
        <div className="showcase-panel">
          <div className="showcase-toolbar">
            <span>今日陈列</span>
            <span>{isAuthed ? "管理视图" : "游客浏览"}</span>
          </div>
          <div className="showcase-body">
            <ImageFrame
              imageId={selectedProduct?.coverImageId}
              alt={selectedProduct?.name ?? "商品图"}
              size="hero"
            />
            <div>
              <h2>{selectedProduct?.name ?? "暂无商品"}</h2>
              <p>{selectedProduct?.subtitle ?? "精选商品正在整理。"}</p>
              {selectedProduct ? (
                <div className="hero-meta">
                  {settings.showPrice ? <span>¥ {selectedProduct.price}</span> : null}
                  <span>{selectedProduct.specs}</span>
                  {settings.showStock ? (
                    <span>库存 {selectedProduct.stock}</span>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </div>
        <aside className="hero-stats" aria-label="陈列概况">
          <StatCard label="在售" value={String(liveCount)} />
          <StatCard label="未上架" value={String(draftCount)} />
          <StatCard
            label="图片完整"
            value={`${Math.round(
              (products.filter((item) => item.coverImageId).length /
                Math.max(products.length, 1)) *
                100,
            )}%`}
          />
        </aside>
      </section>

      <section className="store-controls" aria-label="商品筛选">
        <div className="search-box">
          <Search size={16} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索商品、分类、说明"
          />
        </div>
        <div className="segmented">
          {categories.map((item) => (
            <button
              key={item}
              className={category === item ? "active" : ""}
              type="button"
              onClick={() => setCategory(item)}
            >
              {item}
            </button>
          ))}
        </div>
        <div className="segmented compact" aria-label="状态筛选">
          <button
            className={status === "all" ? "active" : ""}
            type="button"
            onClick={() => setStatus("all")}
          >
            全部
          </button>
          <button
            className={status === "live" ? "active" : ""}
            type="button"
            onClick={() => setStatus("live")}
          >
            已上架
          </button>
          <button
            className={status === "draft" ? "active" : ""}
            type="button"
            onClick={() => setStatus("draft")}
          >
            未上架
          </button>
        </div>
      </section>

      <section className="store-grid-wrap">
        <div className="product-grid" aria-live="polite">
          {filteredProducts.length ? (
            filteredProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                settings={settings}
                selected={selectedProduct?.id === product.id}
                onSelect={() => selectProduct(product.id)}
              />
            ))
          ) : (
            <EmptyState
              icon={<Filter size={26} />}
              title="没有符合条件的商品"
              body="换个关键词或分类看看。"
              actionLabel="恢复全部商品"
              onAction={resetFilters}
            />
          )}
        </div>
        <ProductDetail
          product={selectedProduct}
          settings={settings}
          open={detailOpen}
          onClose={() => setDetailOpen(false)}
        />
      </section>
    </main>
  );
}

function ProductCard({
  product,
  settings,
  selected,
  onSelect,
}: {
  product: Product;
  settings: SiteSettings;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <article className={`product-card ${selected ? "selected" : ""}`}>
      <button className="product-media-button" type="button" onClick={onSelect}>
        <ImageFrame
          imageId={product.coverImageId}
          alt={product.imageMeta?.[product.coverImageId ?? ""]?.alt || product.name}
        />
      </button>
      <div className="product-card-body">
        <StatusBadge status={product.status} />
        <button className="product-title-button" type="button" onClick={onSelect}>
          <h2>{product.name}</h2>
          <p>{product.subtitle}</p>
        </button>
        <div className="product-facts">
          {settings.showPrice ? <span>¥ {product.price}</span> : null}
          <span>{product.specs}</span>
          {settings.showStock ? <span>库存 {product.stock}</span> : null}
        </div>
        {(settings.showOrigin && product.origin) ||
        (settings.showFlavorNotes && product.flavorNotes) ? (
          <p className="product-notes">
            {[settings.showOrigin ? product.origin : "", settings.showFlavorNotes ? product.flavorNotes : ""]
              .filter(Boolean)
              .join(" / ")}
          </p>
        ) : null}
        {product.tags?.length ? (
          <div className="tag-row">
            {product.tags.slice(0, 3).map((tag, index) => (
              <span key={`${tag}-${index}`}>{tag}</span>
            ))}
          </div>
        ) : null}
      </div>
    </article>
  );
}

function ProductDetail({
  product,
  settings,
  open,
  onClose,
}: {
  product?: Product;
  settings: SiteSettings;
  open: boolean;
  onClose: () => void;
}) {
  if (!product) {
    return (
      <aside className={`detail-panel ${open ? "open" : ""}`}>
        <EmptyState
          icon={<ImageIcon size={24} />}
          title="暂无商品详情"
          body="挑选商品后会在这里显示完整信息。"
        />
      </aside>
    );
  }

  return (
    <aside className={`detail-panel ${open ? "open" : ""}`}>
      <div className="detail-header">
        <span>当前选中</span>
        <StatusBadge status={product.status} />
        <button className="icon-button mobile-only" type="button" onClick={onClose} aria-label="关闭详情">
          <X size={16} />
        </button>
      </div>
      <ImageFrame imageId={product.coverImageId} alt={product.name} size="detail" />
      <h2>{product.name}</h2>
      <p>{product.description}</p>
      <dl className="detail-list">
        <div>
          <dt>分类</dt>
          <dd>{product.category}</dd>
        </div>
        {settings.showOrigin && product.origin ? (
          <div>
            <dt>产地</dt>
            <dd>{product.origin}</dd>
          </div>
        ) : null}
        {settings.showFlavorNotes && product.flavorNotes ? (
          <div>
            <dt>风味</dt>
            <dd>{product.flavorNotes}</dd>
          </div>
        ) : null}
        {settings.showPrice ? (
          <div>
            <dt>价格</dt>
            <dd>¥ {product.price}</dd>
          </div>
        ) : null}
        <div>
          <dt>规格</dt>
          <dd>{product.specs}</dd>
        </div>
        {settings.showStock ? (
          <div>
            <dt>库存</dt>
            <dd>{product.stock}</dd>
          </div>
        ) : null}
      </dl>
      {product.tags?.length ? (
        <div className="tag-row">
          {product.tags.map((tag, index) => (
            <span key={`${tag}-${index}`}>{tag}</span>
          ))}
        </div>
      ) : null}
    </aside>
  );
}

function ProductAdmin({
  products,
  isAuthed,
  onCreate,
  onEdit,
  onToggleStatus,
  onDelete,
  onBulkStatus,
  onBulkDelete,
  onDuplicate,
}: {
  products: Product[];
  isAuthed: boolean;
  onCreate: () => void;
  onEdit: (product: Product) => void;
  onToggleStatus: (id: string) => void;
  onDelete: (product: Product) => void;
  onBulkStatus: (status: ProductStatus, productIds?: string[]) => void | Promise<void>;
  onBulkDelete: (productIds: string[]) => void | Promise<void>;
  onDuplicate: (product: Product) => void | Promise<void>;
}) {
  const liveCount = products.filter((product) => product.status === "live").length;
  const missingImageCount = products.filter((product) => !product.coverImageId).length;
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("全部");
  const [status, setStatus] = useState<"all" | ProductStatus>("all");
  const [imageFilter, setImageFilter] = useState<"all" | "missing" | "ready">("all");
  const [sortBy, setSortBy] = useState<ProductSort | "stock">("updated");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const categories = useMemo(
    () => ["全部", ...Array.from(new Set(products.map((product) => product.category).filter(Boolean)))],
    [products],
  );
  const filteredProducts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const matches = products.filter((product) => {
      const searchText = [
        product.name,
        product.subtitle,
        product.category,
        product.description,
        product.origin,
        product.flavorNotes,
        ...(product.tags ?? []),
      ]
        .join(" ")
        .toLowerCase();
      const matchesQuery = normalizedQuery ? searchText.includes(normalizedQuery) : true;
      const matchesCategory = category === "全部" ? true : product.category === category;
      const matchesStatus = status === "all" ? true : product.status === status;
      const matchesImages =
        imageFilter === "all"
          ? true
          : imageFilter === "missing"
            ? !product.coverImageId
            : Boolean(product.coverImageId);
      return matchesQuery && matchesCategory && matchesStatus && matchesImages;
    });

    return [...matches].sort((a, b) => {
      if (sortBy === "manual") return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
      if (sortBy === "name") return a.name.localeCompare(b.name, "zh-Hans-CN");
      if (sortBy === "price") return Number(a.price) - Number(b.price);
      if (sortBy === "stock") return Number(a.stock) - Number(b.stock);
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }, [category, imageFilter, products, query, sortBy, status]);
  const visibleIds = filteredProducts.map((product) => product.id);
  const selectedVisibleIds = selectedIds.filter((id) => visibleIds.includes(id));
  const bulkIds = selectedVisibleIds.length ? selectedVisibleIds : visibleIds;
  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));

  useEffect(() => {
    setSelectedIds((current) =>
      current.filter((id) => products.some((product) => product.id === id)),
    );
  }, [products]);

  function toggleSelected(productId: string) {
    setSelectedIds((current) =>
      current.includes(productId)
        ? current.filter((id) => id !== productId)
        : [...current, productId],
    );
  }

  function toggleAllVisible() {
    setSelectedIds((current) =>
      allVisibleSelected
        ? current.filter((id) => !visibleIds.includes(id))
        : Array.from(new Set([...current, ...visibleIds])),
    );
  }

  if (!isAuthed) {
    return (
      <main className="page-panel">
        <EmptyState
          icon={<Lock size={28} />}
          title="需要管理员权限"
          body="请先登录管理员。"
        />
      </main>
    );
  }

  return (
    <main className="admin-page">
      <section className="admin-intro">
        <div>
          <div className="section-label">
            <LayoutDashboard size={15} />
            商品管理
          </div>
          <h1>商品陈列管理</h1>
          <p>集中调整商品图、规格、价格、库存与展示状态。</p>
        </div>
        <button className="button primary" type="button" onClick={onCreate}>
          <PackagePlus size={16} />
          新增商品
        </button>
      </section>
      <section className="admin-stats">
        <StatCard label="商品总数" value={String(products.length)} />
        <StatCard label="在售" value={String(liveCount)} />
        <StatCard label="待补图" value={String(missingImageCount)} />
      </section>
      <section className="admin-filterbar">
        <div className="search-box">
          <Search size={16} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索商品、分类、说明、标签"
          />
        </div>
        <select value={category} onChange={(event) => setCategory(event.target.value)}>
          {categories.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value as "all" | ProductStatus)}
        >
          <option value="all">全部状态</option>
          <option value="live">已上架</option>
          <option value="draft">未上架</option>
        </select>
        <select
          value={imageFilter}
          onChange={(event) => setImageFilter(event.target.value as "all" | "missing" | "ready")}
        >
          <option value="all">全部图片</option>
          <option value="ready">有封面</option>
          <option value="missing">缺少封面</option>
        </select>
        <select
          value={sortBy}
          onChange={(event) => setSortBy(event.target.value as ProductSort | "stock")}
        >
          <option value="updated">最近更新</option>
          <option value="manual">手动顺序</option>
          <option value="name">名称</option>
          <option value="price">价格</option>
          <option value="stock">库存</option>
        </select>
      </section>
      <section className="admin-toolbar">
        <div className="section-label">
          <SlidersHorizontal size={15} />
          展示状态
        </div>
        <div>
          <button className="button secondary" type="button" onClick={() => onBulkStatus("live", bulkIds)}>
            批量上架
          </button>
          <button className="button secondary" type="button" onClick={() => onBulkStatus("draft", bulkIds)}>
            批量下架
          </button>
          <button className="button danger ghost" type="button" onClick={() => onBulkDelete(bulkIds)}>
            批量删除
          </button>
        </div>
      </section>
      <section className="product-table">
        <div className="table-head">
          <label className="check-cell" aria-label="选择当前筛选结果">
            <input
              type="checkbox"
              checked={allVisibleSelected}
              disabled={!visibleIds.length}
              onChange={toggleAllVisible}
            />
          </label>
          <span>商品</span>
          <span>分类</span>
          <span>价格</span>
          <span>库存</span>
          <span>状态</span>
          <span>操作</span>
        </div>
        {filteredProducts.map((product) => (
          <article
            key={product.id}
            className={`table-row ${selectedIds.includes(product.id) ? "selected" : ""}`}
          >
            <label className="check-cell" aria-label={`选择 ${product.name}`}>
              <input
                type="checkbox"
                checked={selectedIds.includes(product.id)}
                onChange={() => toggleSelected(product.id)}
              />
            </label>
            <div className="table-product">
              <ImageFrame imageId={product.coverImageId} alt={product.name} size="thumb" />
              <div>
                <strong>{product.name}</strong>
                <span>{product.subtitle || "未填写副标题"}</span>
              </div>
            </div>
            <span data-label="分类">{product.category}</span>
            <span data-label="价格">¥ {product.price}</span>
            <span data-label="库存">{product.stock}</span>
            <div className="table-status" data-label="状态">
              <StatusBadge status={product.status} />
            </div>
            <div className="row-actions">
              <button
                className={`button status-action ${
                  product.status === "live" ? "unpublish" : "publish"
                }`}
                type="button"
                aria-label={product.status === "live" ? "下架商品" : "上架商品"}
                onClick={() => onToggleStatus(product.id)}
              >
                {product.status === "live" ? <EyeOff size={16} /> : <Eye size={16} />}
                {product.status === "live" ? "下架" : "上架"}
              </button>
              <button
                className="icon-button"
                type="button"
                aria-label="复制商品"
                onClick={() => onDuplicate(product)}
              >
                <Copy size={16} />
              </button>
              <button className="icon-button" type="button" aria-label="编辑商品" onClick={() => onEdit(product)}>
                <Pencil size={16} />
              </button>
              <button className="icon-button danger" type="button" aria-label="删除商品" onClick={() => onDelete(product)}>
                <Trash2 size={16} />
              </button>
            </div>
          </article>
        ))}
        {!filteredProducts.length ? (
          <EmptyState
            icon={<Filter size={24} />}
            title="没有符合条件的商品"
            body="清空搜索或切换筛选条件后再查看。"
          />
        ) : null}
      </section>
    </main>
  );
}

function ProductEditor({
  product,
  onSave,
  onClose,
  onToast,
}: {
  product: Product;
  onSave: (product: Product) => void | Promise<void>;
  onClose: () => void;
  onToast: (text: string, kind?: ToastKind) => void;
}) {
  const [draft, setDraft] = useState<Product>(product);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [validationError, setValidationError] = useState("");
  const [uploadReports, setUploadReports] = useState<UploadReport[]>([]);
  const baseline = useMemo(() => JSON.stringify(product), [product]);
  const isDirty = useMemo(() => JSON.stringify(draft) !== baseline, [baseline, draft]);

  function update<K extends keyof Product>(key: K, value: Product[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function requestClose() {
    if (isDirty || uploadReports.length) {
      setShowCloseConfirm(true);
      return;
    }
    onClose();
  }

  function updateImageMeta(
    imageId: string,
    key: "alt" | "note",
    value: string,
  ) {
    setDraft((current) => ({
      ...current,
      imageMeta: {
        ...(current.imageMeta ?? {}),
        [imageId]: {
          ...(current.imageMeta?.[imageId] ?? {}),
          [key]: value,
        },
      },
    }));
  }

  async function handleFiles(files: FileList | File[] | null) {
    if (!files?.length) return;
    setIsUploading(true);
    try {
      const records = await Promise.all(
        Array.from(files).map((file) => saveImageFile(file)),
      );
      setDraft((current) => {
        const imageIds = [...current.imageIds, ...records.map((record) => record.id)];
        return {
          ...current,
          imageIds,
          coverImageId: current.coverImageId ?? imageIds[0],
        };
      });
      const reports = records.flatMap((record) =>
        record.compression
          ? [
              {
                id: record.id,
                fileName: record.name,
                stats: record.compression,
              },
            ]
          : [],
      );
      setUploadReports(reports);
      onToast(
        reports.length
          ? `图片已压缩上传，单张不超过 ${formatBytes(IMAGE_COMPRESSION_MAX_BYTES)}。`
          : "图片已上传。",
      );
    } catch (error) {
      onToast(error instanceof Error ? error.message : "图片上传失败。", "danger");
    } finally {
      setIsDragging(false);
      setIsUploading(false);
    }
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    void handleFiles(Array.from(event.dataTransfer.files));
  }

  async function handleRemoveImage(imageId: string) {
    await removeImage(imageId);
    setDraft((current) => {
      const imageIds = current.imageIds.filter((id) => id !== imageId);
      return {
        ...current,
        imageIds,
        coverImageId:
          current.coverImageId === imageId ? imageIds[0] : current.coverImageId,
        imageMeta: Object.fromEntries(
          Object.entries(current.imageMeta ?? {}).filter(([id]) => id !== imageId),
        ),
      };
    });
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setValidationError("");
    if (!draft.name.trim()) {
      setValidationError("请输入商品名称。");
      onToast("请输入商品名称。", "danger");
      return;
    }
    if (!Number.isFinite(Number(draft.price)) || Number(draft.price) < 0) {
      setValidationError("价格不能为负数。");
      return;
    }
    if (!Number.isFinite(Number(draft.stock)) || Number(draft.stock) < 0) {
      setValidationError("库存不能为负数。");
      return;
    }
    setIsSaving(true);
    try {
      await onSave({
        ...draft,
        name: draft.name.trim(),
        subtitle: draft.subtitle.trim(),
        category: draft.category.trim() || "未分类",
        specs: draft.specs.trim() || "20 支 / 包",
        description: draft.description.trim(),
        origin: draft.origin?.trim() ?? "",
        flavorNotes: draft.flavorNotes?.trim() ?? "",
        tags: (draft.tags ?? []).map((tag) => tag.trim()).filter(Boolean),
        price: Number(draft.price),
        stock: Number(draft.stock),
      });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="drawer-backdrop" role="presentation">
      <aside className="drawer" aria-label="编辑商品">
        <div className="drawer-header">
          <div>
            <span>商品档案</span>
            <div className="drawer-title-line">
              <h2>{product.name ? "编辑商品" : "新增商品"}</h2>
              <StatusBadge status={draft.status} />
            </div>
          </div>
          <button className="icon-button" type="button" onClick={requestClose} aria-label="关闭">
            <X size={18} />
          </button>
        </div>
        <form className="editor-form" onSubmit={handleSubmit}>
          <div className="image-uploader">
            <div
              className={`image-uploader-main ${isDragging ? "dragging" : ""}`}
              onDragOver={(event) => {
                event.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
            >
              <ImageFrame imageId={draft.coverImageId} alt={draft.name || "商品图"} size="editor" />
              <label className="upload-button">
                <Upload size={16} />
                {isUploading ? "上传中..." : "上传商品图片"}
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(event) => handleFiles(event.target.files)}
                />
              </label>
            </div>
            <div className="compression-panel">
              <div className="compression-panel-header">
                <Gauge size={17} />
                <div>
                  <strong>上传前自动压缩</strong>
                  <span>
                    目标 {formatBytes(IMAGE_COMPRESSION_TARGET_BYTES)}，硬上限 {formatBytes(IMAGE_COMPRESSION_MAX_BYTES)}
                  </span>
                </div>
              </div>
              {uploadReports.length ? (
                <div className="compression-results">
                  {uploadReports.map((report) => (
                    <article key={report.id}>
                      <strong>{report.fileName}</strong>
                      <span>
                        {formatBytes(report.stats.originalBytes)} → {formatBytes(report.stats.compressedBytes)}
                      </span>
                      <span>
                        {report.stats.originalWidth}×{report.stats.originalHeight} → {report.stats.width}×{report.stats.height}
                      </span>
                      <span>
                        {report.stats.type.replace("image/", "").toUpperCase()} · 节省 {compressionSavings(report.stats)}%
                      </span>
                    </article>
                  ))}
                </div>
              ) : (
                <p>
                  上传图片会自动压缩成轻量版本，保持不同设备打开顺滑。
                </p>
              )}
            </div>
            {draft.imageIds.length ? (
              <>
                <div className="image-strip">
                  {draft.imageIds.map((imageId) => (
                    <ImageThumb
                      key={imageId}
                      imageId={imageId}
                      selected={draft.coverImageId === imageId}
                      onCover={() => update("coverImageId", imageId)}
                      onRemove={() => handleRemoveImage(imageId)}
                    />
                  ))}
                </div>
                <div className="image-meta-list">
                  {draft.imageIds.map((imageId, index) => (
                    <div key={imageId} className="image-meta-row">
                      <span>图片 {index + 1}</span>
                      <input
                        value={draft.imageMeta?.[imageId]?.alt ?? ""}
                        onChange={(event) => updateImageMeta(imageId, "alt", event.target.value)}
                        placeholder="图片说明"
                      />
                      <input
                        value={draft.imageMeta?.[imageId]?.note ?? ""}
                        onChange={(event) => updateImageMeta(imageId, "note", event.target.value)}
                        placeholder="内部备注"
                      />
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="helper-text">建议上传明亮棚拍图，页面会自动裁切为统一比例。</p>
            )}
          </div>

          <div className="form-grid">
            <label>
              <span>商品名称</span>
              <input
                value={draft.name}
                onChange={(event) => update("name", event.target.value)}
                placeholder="例如：白金典藏"
              />
            </label>
            <label>
              <span>副标题</span>
              <input
                value={draft.subtitle}
                onChange={(event) => update("subtitle", event.target.value)}
                placeholder="例如：柔和白金调"
              />
            </label>
            <label>
              <span>分类</span>
              <input
                value={draft.category}
                onChange={(event) => update("category", event.target.value)}
                placeholder="经典 / 礼盒 / 限量"
              />
            </label>
            <label>
              <span>产地</span>
              <input
                value={draft.origin ?? ""}
                onChange={(event) => update("origin", event.target.value)}
                placeholder="例如：云南 / 浙江 / 海外"
              />
            </label>
            <label>
              <span>风味</span>
              <input
                value={draft.flavorNotes ?? ""}
                onChange={(event) => update("flavorNotes", event.target.value)}
                placeholder="例如：清雅、木质、微甜"
              />
            </label>
            <label>
              <span>标签</span>
              <input
                value={(draft.tags ?? []).join("，")}
                onChange={(event) =>
                  update(
                    "tags",
                    event.target.value
                      .split(/[，,]/)
                      .map((tag) => tag.trim())
                      .filter(Boolean),
                  )
                }
                placeholder="新品，礼盒，柔和"
              />
            </label>
            <label>
              <span>排序</span>
              <input
                value={draft.sortOrder ?? 0}
                type="number"
                min={0}
                onChange={(event) => update("sortOrder", Number(event.target.value))}
              />
            </label>
            <label>
              <span>规格</span>
              <input
                value={draft.specs}
                onChange={(event) => update("specs", event.target.value)}
              />
            </label>
            <label>
              <span>价格</span>
              <input
                value={draft.price}
                type="number"
                min={0}
                onChange={(event) => update("price", Number(event.target.value))}
              />
            </label>
            <label>
              <span>库存</span>
              <input
                value={draft.stock}
                type="number"
                min={0}
                onChange={(event) => update("stock", Number(event.target.value))}
              />
            </label>
            <label className="toggle-row">
              <input
                type="checkbox"
                checked={draft.featured}
                onChange={(event) => update("featured", event.target.checked)}
              />
              <span>设为精选展示</span>
            </label>
          </div>
          <label>
            <span>商品说明</span>
            <textarea
              value={draft.description}
              onChange={(event) => update("description", event.target.value)}
              rows={4}
              placeholder="填写展示页中可见的产品说明"
            />
          </label>
          {validationError ? <p className="form-error">{validationError}</p> : null}
          <div className="drawer-actions">
            <button className="button secondary" type="button" onClick={requestClose}>
              取消
            </button>
            <button className="button primary" type="submit" disabled={isSaving || isUploading}>
              {isSaving ? "保存中..." : "保存商品"}
            </button>
          </div>
        </form>
      </aside>
      {showCloseConfirm ? (
        <ConfirmDialog
          title="放弃未保存修改？"
          body="当前商品信息还没有保存，关闭后本次修改不会保留。"
          onCancel={() => setShowCloseConfirm(false)}
          onConfirm={() => {
            setShowCloseConfirm(false);
            onClose();
          }}
        />
      ) : null}
    </div>
  );
}

function SettingsPanel({
  adminUser,
  settings,
  isAuthed,
  onSave,
  onUpdateAdmin,
  onResetAge,
  onExport,
  onImport,
  onClearAll,
}: {
  adminUser: AdminUser | null;
  settings: SiteSettings;
  isAuthed: boolean;
  onSave: (settings: SiteSettings) => void | Promise<void>;
  onUpdateAdmin: (input: AdminUpdateInput) => Promise<boolean>;
  onResetAge: () => void;
  onExport: () => void;
  onImport: (file: File) => void;
  onClearAll: () => void;
}) {
  const [draft, setDraft] = useState(settings);
  const [isDirty, setIsDirty] = useState(false);
  const [adminDraft, setAdminDraft] = useState({
    displayName: adminUser?.displayName ?? "",
    username: adminUser?.username ?? "",
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [adminDirty, setAdminDirty] = useState(false);
  const [adminError, setAdminError] = useState("");
  const [confirmDefault, setConfirmDefault] = useState(false);

  useEffect(() => {
    if (!isDirty) {
      setDraft(settings);
    }
  }, [isDirty, settings]);

  useEffect(() => {
    if (!adminDirty) {
      setAdminDraft({
        displayName: adminUser?.displayName ?? "",
        username: adminUser?.username ?? "",
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
    }
  }, [adminDirty, adminUser]);

  function update<K extends keyof SiteSettings>(key: K, value: SiteSettings[K]) {
    setIsDirty(true);
    setDraft((current) => ({ ...current, [key]: value }));
  }

  async function handleSaveSettings() {
    await onSave(draft);
    setIsDirty(false);
  }

  function restoreDefaultSettings() {
    setConfirmDefault(true);
  }

  function applyDefaultSettings() {
    setDraft(defaultSettings);
    setIsDirty(true);
    setConfirmDefault(false);
  }

  function updateAdminDraft(
    key: keyof typeof adminDraft,
    value: string,
  ) {
    setAdminDirty(true);
    setAdminError("");
    setAdminDraft((current) => ({ ...current, [key]: value }));
  }

  async function handleAdminSubmit(event: FormEvent) {
    event.preventDefault();
    const username = adminDraft.username.trim();
    const displayName = adminDraft.displayName.trim();

    if (!username) {
      setAdminError("请输入新的管理员用户名。");
      return;
    }

    if (!adminDraft.currentPassword) {
      setAdminError("请输入当前密码确认身份。");
      return;
    }

    if (adminDraft.newPassword || adminDraft.confirmPassword) {
      if (!isStrongEnoughPassword(adminDraft.newPassword)) {
        setAdminError("新密码至少需要 6 位。");
        return;
      }

      if (adminDraft.newPassword !== adminDraft.confirmPassword) {
        setAdminError("两次输入的新密码不一致。");
        return;
      }
    }

    const saved = await onUpdateAdmin({
      displayName,
      username,
      currentPassword: adminDraft.currentPassword,
      newPassword: adminDraft.newPassword,
    });

    if (saved) {
      setAdminDraft((current) => ({
        ...current,
        displayName: displayName || "陈列管理员",
        username,
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      }));
      setAdminDirty(false);
    }
  }

  if (!isAuthed) {
    return (
      <main className="page-panel">
        <EmptyState
          icon={<Lock size={28} />}
          title="需要管理员权限"
          body="请先登录管理员。"
        />
      </main>
    );
  }

  return (
    <main className="settings-page">
      <section className="settings-intro">
        <div className="section-label">
          <SettingsIcon size={15} />
          设置
        </div>
        <h1>品牌橱窗设置</h1>
        <p>调整首页文案、陈列风格、字体主题与资料备份。</p>
      </section>
      <section className="settings-grid">
        <div className="settings-column settings-primary-column">
          <section className="settings-card brand-settings-card">
            <h2>品牌展示</h2>
            <label>
              <span>品牌名称</span>
              <input
                value={draft.brandName}
                onChange={(event) => update("brandName", event.target.value)}
              />
            </label>
            <label>
              <span>首页标题</span>
              <input
                value={draft.heroTitle}
                onChange={(event) => update("heroTitle", event.target.value)}
              />
            </label>
            <label>
              <span>首页说明</span>
              <textarea
                value={draft.heroBody}
                onChange={(event) => update("heroBody", event.target.value)}
                rows={4}
              />
            </label>
          </section>
          {adminUser ? (
            <form className="settings-card admin-account-card" onSubmit={handleAdminSubmit}>
              <div>
                <h2>管理员账号</h2>
                <p className="settings-note">
                  修改用户名或密码前，需要输入当前密码确认身份。
                </p>
              </div>
              <div className="form-grid admin-account-grid">
                <label>
                  <span>显示名称</span>
                  <input
                    value={adminDraft.displayName}
                    onChange={(event) =>
                      updateAdminDraft("displayName", event.target.value)
                    }
                    placeholder="陈列管理员"
                  />
                </label>
                <label>
                  <span>管理员用户名</span>
                  <input
                    value={adminDraft.username}
                    onChange={(event) =>
                      updateAdminDraft("username", event.target.value)
                    }
                    autoComplete="username"
                  />
                </label>
                <label>
                  <span>当前密码</span>
                  <input
                    type="password"
                    value={adminDraft.currentPassword}
                    onChange={(event) =>
                      updateAdminDraft("currentPassword", event.target.value)
                    }
                    autoComplete="current-password"
                  />
                </label>
                <label>
                  <span>新密码</span>
                  <input
                    type="password"
                    value={adminDraft.newPassword}
                    onChange={(event) =>
                      updateAdminDraft("newPassword", event.target.value)
                    }
                    autoComplete="new-password"
                    placeholder="留空则不修改"
                  />
                </label>
                <label>
                  <span>确认新密码</span>
                  <input
                    type="password"
                    value={adminDraft.confirmPassword}
                    onChange={(event) =>
                      updateAdminDraft("confirmPassword", event.target.value)
                    }
                    autoComplete="new-password"
                    placeholder="再次输入新密码"
                  />
                </label>
              </div>
              {adminError ? <p className="field-error">{adminError}</p> : null}
              <div className="admin-account-actions">
                <button className="button primary" type="submit">
                  保存管理员账号
                </button>
              </div>
            </form>
          ) : null}
        </div>
        <div className="settings-column settings-display-column">
          <section className="settings-card display-settings-card">
            <h2>显示偏好</h2>
          <div className="setting-group">
            <span className="field-label">主题风格</span>
            <div className="choice-grid theme-choice-grid">
              {themeOptions.map((option) => (
                <button
                  key={option.value}
                  className={
                    draft.accentTheme === option.value
                      ? "choice-card selected"
                      : "choice-card"
                  }
                  type="button"
                  onClick={() => update("accentTheme", option.value)}
                >
                  <span className="swatch-row" aria-hidden="true">
                    {option.swatches.map((color) => (
                      <i key={color} style={{ background: color }} />
                    ))}
                  </span>
                  <strong>{option.label}</strong>
                  <small>{option.body}</small>
                </button>
              ))}
            </div>
          </div>
          <div className="setting-group">
            <span className="field-label">内置字体</span>
            <div className="choice-grid font-choice-grid">
              {fontOptions.map((option) => (
                <button
                  key={option.value}
                  className={
                    draft.fontPreset === option.value
                      ? `choice-card selected font-sample-${option.value}`
                      : `choice-card font-sample-${option.value}`
                  }
                  type="button"
                  onClick={() => update("fontPreset", option.value)}
                >
                  <strong>{option.label}</strong>
                  <b>{option.sample}</b>
                  <small>{option.body}</small>
                </button>
              ))}
            </div>
          </div>
          <div className={`settings-preview theme-${draft.accentTheme} font-${draft.fontPreset}`}>
            <span>橱窗预览</span>
            <strong>{draft.heroTitle || "精选陈列"}</strong>
            <p>{draft.heroBody || "品牌介绍会在这里呈现。"}</p>
            <div className="product-facts">
              {draft.showPrice ? <span>¥ 58</span> : null}
              <span>20 支 / 包</span>
              {draft.showStock ? <span>库存 84</span> : null}
            </div>
          </div>
          <label>
            <span>商品密度</span>
            <select
              value={draft.gridDensity}
              onChange={(event) =>
                update("gridDensity", event.target.value as GridDensity)
              }
            >
              <option value="editorial">编辑感</option>
              <option value="compact">紧凑</option>
            </select>
          </label>
          <label>
            <span>首屏布局</span>
            <select
              value={draft.heroLayout}
              onChange={(event) =>
                update("heroLayout", event.target.value as SiteSettings["heroLayout"])
              }
            >
              <option value="editorial">编辑精选</option>
              <option value="catalog">目录陈列</option>
              <option value="minimal">留白橱窗</option>
            </select>
          </label>
          <label>
            <span>默认排序</span>
            <select
              value={draft.defaultSort}
              onChange={(event) => update("defaultSort", event.target.value as ProductSort)}
            >
              <option value="manual">手动顺序</option>
              <option value="updated">最近更新</option>
              <option value="name">名称</option>
              <option value="price">价格</option>
            </select>
          </label>
          <Toggle
            checked={draft.showPrice}
            label="展示价格"
            onChange={(value) => update("showPrice", value)}
          />
          <Toggle
            checked={draft.showStock}
            label="展示库存"
            onChange={(value) => update("showStock", value)}
          />
          <Toggle
            checked={draft.showOrigin}
            label="显示产地"
            onChange={(value) => update("showOrigin", value)}
          />
          <Toggle
            checked={draft.showFlavorNotes}
            label="显示风味"
            onChange={(value) => update("showFlavorNotes", value)}
          />
          <Toggle
            checked={draft.requireAgeGate}
            label="进入前年龄确认"
            onChange={(value) => update("requireAgeGate", value)}
          />
          </section>
          <div className="settings-actions">
            <button className="button secondary" type="button" onClick={restoreDefaultSettings}>
              恢复默认展示
            </button>
            <button className="button primary" type="button" onClick={handleSaveSettings}>
              保存设置
            </button>
          </div>
        </div>
        <section className="settings-card backup-settings-card danger-zone">
          <h2>资料备份</h2>
          <p className="settings-note">
            {isCloudEnabled
              ? "商品、图片与展示设置会保持同步；年龄确认会按访客环境记住。"
              : "当前为离线预览，适合临时整理陈列内容。"}
          </p>
          <div className="compression-summary">
            <Gauge size={17} />
            <div>
              <strong>图片自动压缩</strong>
              <span>
                目标 {formatBytes(IMAGE_COMPRESSION_TARGET_BYTES)}，最高 {formatBytes(IMAGE_COMPRESSION_MAX_BYTES)}
              </span>
            </div>
          </div>
          <button className="button secondary wide" type="button" onClick={onExport}>
            <Download size={16} />
            导出备份
          </button>
          <label className="upload-data">
            <Upload size={16} />
            导入备份
            <input
              type="file"
              accept="application/json"
              onChange={(event: ChangeEvent<HTMLInputElement>) => {
                const file = event.target.files?.[0];
                if (file) onImport(file);
              }}
            />
          </label>
          <button className="button secondary wide" type="button" onClick={onResetAge}>
            重置年龄确认
          </button>
          <button className="button danger wide" type="button" onClick={onClearAll}>
            <Trash2 size={16} />
            清空全部资料
          </button>
        </section>
      </section>
      {confirmDefault ? (
        <ConfirmDialog
          title="恢复默认展示？"
          body="品牌文案、主题、字体和展示字段会回到默认方案，保存后才会同步到网页。"
          onCancel={() => setConfirmDefault(false)}
          onConfirm={applyDefaultSettings}
        />
      ) : null}
    </main>
  );
}

function ImageFrame({
  imageId,
  alt,
  size = "card",
}: {
  imageId?: string;
  alt: string;
  size?: "card" | "hero" | "detail" | "thumb" | "editor";
}) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let objectUrl: string | null = null;
    let alive = true;

    imageRecordToObjectUrl(imageId).then((nextUrl) => {
      if (!alive) {
        if (nextUrl) URL.revokeObjectURL(nextUrl);
        return;
      }
      objectUrl = nextUrl;
      setUrl(nextUrl);
    });

    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [imageId]);

  return (
    <div className={`image-frame image-${size}`}>
      {url ? (
        <img src={url} alt={alt} />
      ) : (
        <div className="image-empty">
          <ImageIcon size={size === "thumb" ? 18 : 26} />
          <span>{size === "thumb" ? "待传" : "待上传商品图"}</span>
        </div>
      )}
    </div>
  );
}

function ImageThumb({
  imageId,
  selected,
  onCover,
  onRemove,
}: {
  imageId: string;
  selected: boolean;
  onCover: () => void;
  onRemove: () => void;
}) {
  return (
    <div className={`image-thumb ${selected ? "selected" : ""}`}>
      <ImageFrame imageId={imageId} alt="商品缩略图" size="thumb" />
      <button type="button" onClick={onCover}>
        {selected ? "封面" : "设封面"}
      </button>
      <button type="button" onClick={onRemove} aria-label="移除图片">
        <X size={13} />
      </button>
    </div>
  );
}

function StatusBadge({ status }: { status: ProductStatus }) {
  return (
    <span className={`status-badge status-${status}`}>
      {status === "live" ? "已上架" : "未上架"}
    </span>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="stat-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function EmptyState({
  icon,
  title,
  body,
  actionLabel,
  onAction,
}: {
  icon: ReactNode;
  title: string;
  body: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="empty-state">
      <div>{icon}</div>
      <h2>{title}</h2>
      <p>{body}</p>
      {actionLabel && onAction ? (
        <button className="button secondary" type="button" onClick={onAction}>
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}

function Toggle({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="switch-row">
      <span>{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        className={checked ? "switch on" : "switch"}
        onClick={() => onChange(!checked)}
      >
        <i />
      </button>
    </label>
  );
}

function ConfirmDialog({
  title,
  body,
  onCancel,
  onConfirm,
}: {
  title: string;
  body: string;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
}) {
  return (
    <div className="modal-backdrop" role="presentation">
      <section className="confirm-dialog" role="dialog" aria-modal="true">
        <div className="dialog-icon">
          <AlertTriangle size={22} />
        </div>
        <h2>{title}</h2>
        <p>{body}</p>
        <div className="dialog-actions">
          <button className="button secondary" type="button" onClick={onCancel}>
            取消
          </button>
          <button className="button danger" type="button" onClick={onConfirm}>
            确认
          </button>
        </div>
      </section>
    </div>
  );
}

function ToastStack({ toasts }: { toasts: ToastMessage[] }) {
  return (
    <div className="toast-stack" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast toast-${toast.kind}`}>
          {toast.kind === "success" ? <Check size={16} /> : <AlertTriangle size={16} />}
          {toast.text}
        </div>
      ))}
    </div>
  );
}
