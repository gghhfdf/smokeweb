import {
  AlertTriangle,
  Archive,
  Check,
  ChevronRight,
  Download,
  Eye,
  EyeOff,
  Filter,
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
} from "./lib/cloud";
import { defaultSettings } from "./lib/defaults";
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
  Product,
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
};

const themeOptions: Array<{
  value: AccentTheme;
  label: string;
  body: string;
  swatches: string[];
}> = [
  {
    value: "sage",
    label: "鼠尾草绿",
    body: "暖白底色、深绿主按钮，适合高级橱窗展示。",
    swatches: ["#f6f4ee", "#1f2b27", "#b68a42"],
  },
  {
    value: "champagne",
    label: "香槟金",
    body: "更明亮的米金光感，突出礼盒和限量系列。",
    swatches: ["#fbf7ee", "#3a2c1c", "#c99a4a"],
  },
  {
    value: "graphite",
    label: "石墨白",
    body: "偏冷静的白灰秩序感，适合运营后台和大表格。",
    swatches: ["#f3f5f4", "#181c1d", "#8e9895"],
  },
];

const fontOptions: Array<{
  value: FontPreset;
  label: string;
  sample: string;
  body: string;
}> = [
  {
    value: "heritage",
    label: "典藏宋体",
    sample: "白金典藏",
    body: "标题更有东方陈列感，适合高端品牌橱窗。",
  },
  {
    value: "modern",
    label: "现代无衬线",
    sample: "Cabinet Ops",
    body: "信息密度更高，适合日常商品运营维护。",
  },
  {
    value: "editorial",
    label: "杂志衬线",
    sample: "Premium",
    body: "更偏编辑画册气质，适合礼盒和系列故事展示。",
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
          error instanceof Error ? error.message : "云端数据读取失败。",
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
        pushToast("云端设置已保存。");
      } catch (error) {
        pushToast(error instanceof Error ? error.message : "云端设置保存失败。", "danger");
      }
      return;
    }

    setState((current) => ({ ...current, settings }));
    saveSettings(settings);
  }

  function requireAdmin(nextView: View = "admin"): boolean {
    if (!isAuthed) {
      setView("login");
      pushToast("请先登录管理员账号。", "warning");
      return false;
    }
    setView(nextView);
    return true;
  }

  function checkAdmin(): boolean {
    if (!isAuthed) {
      setView("login");
      pushToast("请先登录管理员账号。", "warning");
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
        pushToast("云端管理员已创建，商品编辑权限已开启。");
      } catch (error) {
        pushToast(error instanceof Error ? error.message : "云端管理员创建失败。", "danger");
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
    pushToast("管理员已创建，商品编辑权限已开启。");
  }

  async function handleLogin(username: string, password: string) {
    if (!state.adminUser) return;
    const passwordHash = await hashPassword(password);
    if (isCloudEnabled) {
      try {
        const cloudState = await loginCloudAdmin(username.trim(), passwordHash);
        applyCloudState(cloudState);
        setView("storefront");
        pushToast("云端管理员已登录。");
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
      pushToast("管理员已登录。");
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
      pushToast("已退出云端管理员模式。", "warning");
      return;
    }

    setState((current) => ({ ...current, sessionUserId: null }));
    saveSession(null);
    setView("storefront");
    pushToast("已退出管理员模式。", "warning");
  }

  function handleAgeVerified() {
    setState((current) => ({ ...current, ageVerified: true }));
    saveAgeVerified(true);
    if (!state.adminUser) {
      setView("login");
    }
  }

  function handleAgeDeclined() {
    pushToast("未确认法定年龄前无法浏览该展示页。", "danger");
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
        pushToast(exists ? "云端商品信息已更新。" : "云端商品已新增。");
      } catch (error) {
        pushToast(error instanceof Error ? error.message : "云端商品保存失败。", "danger");
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
    pushToast(exists ? "商品信息已更新。" : "商品已新增。");
  }

  async function handleToggleStatus(productId: string, status?: ProductStatus) {
    if (!checkAdmin()) return;
    if (isCloudEnabled) {
      try {
        applyCloudState(await setCloudProductStatus(productId, status));
        pushToast("云端商品上下架状态已更新。");
      } catch (error) {
        pushToast(error instanceof Error ? error.message : "云端上下架失败。", "danger");
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
    pushToast("商品上下架状态已更新。");
  }

  function handleDeleteProduct(product: Product) {
    if (!checkAdmin()) return;
    setConfirmAction({
      title: `删除「${product.name}」？`,
      body: "删除商品会同时移除它关联的本地图片，操作不可撤销。",
      action: async () => {
        if (isCloudEnabled) {
          applyCloudState(await deleteCloudProduct(product.id));
          pushToast("云端商品已删除。", "warning");
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
      title: "清空全部本地数据？",
      body: "这会删除管理员、商品、设置、年龄确认和所有上传图片。请先导出备份。",
      action: async () => {
        if (isCloudEnabled) {
          applyCloudState(await clearCloudAll());
          setView("login");
          pushToast("云端数据已清空。", "warning");
          return;
        }

        clearJsonState();
        await clearImages();
        setState(initialAppState);
        setView("login");
        setSelectedProductId(initialAppState.products[0]?.id ?? null);
        pushToast("本地数据已清空。", "warning");
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
    pushToast("本地数据已导出。");
  }

  async function handleImportData(file: File) {
    if (!requireAdmin("settings")) return;
    const text = await file.text();
    const payload = JSON.parse(text) as ExportPayload;
    const importedState = await importPayload(payload);
    if (isCloudEnabled) {
      applyCloudState(importedState);
      setView("storefront");
      pushToast("云端数据已导入。");
      return;
    }

    setState(importedState);
    setSelectedProductId(importedState.products[0]?.id ?? null);
    setView("storefront");
    pushToast("数据已导入。");
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
          setEditingProduct(makeNewProduct());
        }}
      />

      {view === "login" ? (
        <AuthScreen
          adminUser={state.adminUser}
          onAdminCreated={handleAdminCreated}
          onLogin={handleLogin}
          onBrowse={() => setView("storefront")}
        />
      ) : null}

      {view === "storefront" ? (
        <Storefront
          products={state.products}
          settings={state.settings}
          selectedProductId={selectedProductId}
          isAuthed={isAuthed}
          onSelectProduct={setSelectedProductId}
          onEdit={(product) => {
            if (!checkAdmin()) return;
            setEditingProduct(product);
          }}
          onManage={() => requireAdmin("admin")}
        />
      ) : null}

      {view === "admin" ? (
        <ProductAdmin
          products={state.products}
          isAuthed={isAuthed}
          onCreate={() => setEditingProduct(makeNewProduct())}
          onEdit={setEditingProduct}
          onToggleStatus={handleToggleStatus}
          onDelete={handleDeleteProduct}
          onBulkStatus={async (status) => {
            if (!checkAdmin()) return;
            if (isCloudEnabled) {
              try {
                applyCloudState(await bulkCloudProductStatus(status));
                pushToast(status === "live" ? "云端商品已批量上架。" : "云端商品已批量下架。");
              } catch (error) {
                pushToast(error instanceof Error ? error.message : "云端批量操作失败。", "danger");
              }
              return;
            }

            updateProducts(
              state.products.map((product) => ({
                ...product,
                status,
                updatedAt: new Date().toISOString(),
              })),
            );
            pushToast(status === "live" ? "全部商品已上架。" : "全部商品已下架。");
          }}
        />
      ) : null}

      {view === "settings" ? (
        <SettingsPanel
          settings={state.settings}
          isAuthed={isAuthed}
          onSave={updateSettings}
          onResetAge={() => {
            setState((current) => ({ ...current, ageVerified: false }));
            saveAgeVerified(false);
            pushToast("年龄确认状态已重置。", "warning");
          }}
          onExport={handleExportData}
          onImport={handleImportData}
          onClearAll={handleClearAllData}
        />
      ) : null}

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

function makeNewProduct(): Product {
  return {
    ...blankProduct,
    id: `product-${crypto.randomUUID()}`,
    updatedAt: new Date().toISOString(),
  };
}

function TopNav({
  brandName,
  view,
  isAuthed,
  hasAdmin,
  onNavigate,
  onLogin,
  onLogout,
  onCreate,
}: {
  brandName: string;
  view: View;
  isAuthed: boolean;
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
      </nav>
      <div className="nav-actions">
        {isAuthed ? (
          <button className="button secondary" type="button" onClick={onLogout}>
            <LogOut size={16} />
            退出
          </button>
        ) : (
          <button className="button secondary" type="button" onClick={onLogin}>
            <LogIn size={16} />
            {hasAdmin ? "管理员登录" : "设置管理员"}
          </button>
        )}
        <button className="button primary" type="button" onClick={onCreate}>
          <PackagePlus size={16} />
          新增商品
        </button>
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
          <p>成人烟草产品展示</p>
          <h1>请先确认您已达到所在地法定年龄。</h1>
          <span>
            本网站仅用于商品信息展示与本地库存维护，不提供在线下单、支付或配送流程。
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
          <span>Cabinet Ops</span>
          <strong>Premium Display</strong>
        </div>
        <p>高端明色调商品展示 · 本地管理员后台 · 无下单流程</p>
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
  const [displayName, setDisplayName] = useState("店铺管理员");
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
        displayName: displayName.trim() || "店铺管理员",
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
          {adminUser ? "管理员登录" : "首次设置管理员"}
        </div>
        <h1>{adminUser ? "进入商品管理后台" : "先创建本地管理员账号"}</h1>
        <p>
          管理员权限仅用于本机演示。商品新增、编辑、上下架、设置保存和数据清空都需要登录。
        </p>
        <form className="auth-form" onSubmit={handleSubmit}>
          {!adminUser ? (
            <label>
              <span>显示名称</span>
              <input
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="例如：门店管理员"
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
            {adminUser ? "登录管理员" : "创建并进入"}
          </button>
          {!adminUser ? (
            <button className="button ghost wide" type="button" onClick={onBrowse}>
              先浏览展示页
            </button>
          ) : null}
        </form>
      </section>
      <section className="auth-preview">
        <div className="preview-window">
          <div className="preview-toolbar">
            <span>展示页</span>
            <button type="button">预览</button>
          </div>
          <div className="preview-hero">
            <ImageIcon size={40} />
            <div>
              <h2>真实商品图上传后呈现在这里</h2>
              <p>后台会保留图片封面、状态、价格、规格和库存信息。</p>
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
  onEdit,
  onManage,
}: {
  products: Product[];
  settings: SiteSettings;
  selectedProductId: string | null;
  isAuthed: boolean;
  onSelectProduct: (id: string) => void;
  onEdit: (product: Product) => void;
  onManage: () => void;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("全部");
  const [status, setStatus] = useState<"all" | ProductStatus>("all");

  const categories = useMemo(
    () => ["全部", ...Array.from(new Set(products.map((item) => item.category)))],
    [products],
  );
  const liveCount = products.filter((item) => item.status === "live").length;
  const draftCount = products.length - liveCount;
  const selectedProduct =
    products.find((product) => product.id === selectedProductId) ?? products[0];

  const filteredProducts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return products.filter((product) => {
      const matchesQuery = normalizedQuery
        ? [product.name, product.subtitle, product.category, product.description]
            .join(" ")
            .toLowerCase()
            .includes(normalizedQuery)
        : true;
      const matchesCategory =
        category === "全部" ? true : product.category === category;
      const matchesStatus = status === "all" ? true : product.status === status;
      return matchesQuery && matchesCategory && matchesStatus;
    });
  }, [category, products, query, status]);

  return (
    <main className={`storefront density-${settings.gridDensity}`}>
      <section className="store-hero">
        <div className="hero-copy">
          <div className="section-label">
            <Archive size={15} />
            Premium Operations
          </div>
          <h1>{settings.heroTitle}</h1>
          <p>{settings.heroBody}</p>
          <div className="hero-actions">
            <button className="button primary" type="button" onClick={onManage}>
              <LayoutDashboard size={16} />
              商品管理
            </button>
            <button
              className="button secondary"
              type="button"
              onClick={() => selectedProduct && onSelectProduct(selectedProduct.id)}
            >
              查看精选
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
        <div className="showcase-panel">
          <div className="showcase-toolbar">
            <span>当前展示页</span>
            <span>{isAuthed ? "管理员模式" : "访客模式"}</span>
          </div>
          <div className="showcase-body">
            <ImageFrame
              imageId={selectedProduct?.coverImageId}
              alt={selectedProduct?.name ?? "商品图"}
              size="hero"
            />
            <div>
              <h2>{selectedProduct?.name ?? "暂无商品"}</h2>
              <p>{selectedProduct?.subtitle ?? "请在后台添加商品。"}</p>
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
        <aside className="hero-stats" aria-label="展示概况">
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
                isAuthed={isAuthed}
                onSelect={() => onSelectProduct(product.id)}
                onEdit={() => onEdit(product)}
              />
            ))
          ) : (
            <EmptyState
              icon={<Filter size={26} />}
              title="没有符合条件的商品"
              body="调整搜索、分类或上下架状态后再查看。"
            />
          )}
        </div>
        <ProductDetail
          product={selectedProduct}
          settings={settings}
          isAuthed={isAuthed}
          onEdit={onEdit}
        />
      </section>
    </main>
  );
}

function ProductCard({
  product,
  settings,
  selected,
  isAuthed,
  onSelect,
  onEdit,
}: {
  product: Product;
  settings: SiteSettings;
  selected: boolean;
  isAuthed: boolean;
  onSelect: () => void;
  onEdit: () => void;
}) {
  return (
    <article className={`product-card ${selected ? "selected" : ""}`}>
      <button className="product-media-button" type="button" onClick={onSelect}>
        <ImageFrame imageId={product.coverImageId} alt={product.name} />
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
        {isAuthed ? (
          <button className="button quiet" type="button" onClick={onEdit}>
            <Pencil size={15} />
            编辑
          </button>
        ) : null}
      </div>
    </article>
  );
}

function ProductDetail({
  product,
  settings,
  isAuthed,
  onEdit,
}: {
  product?: Product;
  settings: SiteSettings;
  isAuthed: boolean;
  onEdit: (product: Product) => void;
}) {
  if (!product) {
    return (
      <aside className="detail-panel">
        <EmptyState
          icon={<ImageIcon size={24} />}
          title="暂无商品详情"
          body="新增商品后会在这里显示完整信息。"
        />
      </aside>
    );
  }

  return (
    <aside className="detail-panel">
      <div className="detail-header">
        <span>当前选中</span>
        <StatusBadge status={product.status} />
      </div>
      <ImageFrame imageId={product.coverImageId} alt={product.name} size="detail" />
      <h2>{product.name}</h2>
      <p>{product.description}</p>
      <dl className="detail-list">
        <div>
          <dt>分类</dt>
          <dd>{product.category}</dd>
        </div>
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
      {isAuthed ? (
        <button className="button primary wide" type="button" onClick={() => onEdit(product)}>
          <Pencil size={16} />
          编辑商品
        </button>
      ) : (
        <p className="permission-note">登录管理员后可编辑、上架或下架商品。</p>
      )}
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
}: {
  products: Product[];
  isAuthed: boolean;
  onCreate: () => void;
  onEdit: (product: Product) => void;
  onToggleStatus: (id: string) => void;
  onDelete: (product: Product) => void;
  onBulkStatus: (status: ProductStatus) => void | Promise<void>;
}) {
  const liveCount = products.filter((product) => product.status === "live").length;
  const missingImageCount = products.filter((product) => !product.coverImageId).length;

  if (!isAuthed) {
    return (
      <main className="page-panel">
        <EmptyState
          icon={<Lock size={28} />}
          title="需要管理员权限"
          body="请先登录管理员账号，再维护商品。"
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
          <h1>展示与运营一体化控制台</h1>
          <p>维护商品图、规格、价格、库存和上下架状态。这里没有下单流程。</p>
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
      <section className="admin-toolbar">
        <div className="section-label">
          <SlidersHorizontal size={15} />
          批量操作
        </div>
        <div>
          <button className="button secondary" type="button" onClick={() => onBulkStatus("live")}>
            批量上架
          </button>
          <button className="button secondary" type="button" onClick={() => onBulkStatus("draft")}>
            批量下架
          </button>
        </div>
      </section>
      <section className="product-table">
        <div className="table-head">
          <span>商品</span>
          <span>分类</span>
          <span>价格</span>
          <span>库存</span>
          <span>状态</span>
          <span>操作</span>
        </div>
        {products.map((product) => (
          <article key={product.id} className="table-row">
            <div className="table-product">
              <ImageFrame imageId={product.coverImageId} alt={product.name} size="thumb" />
              <div>
                <strong>{product.name}</strong>
                <span>{product.subtitle || "未填写副标题"}</span>
              </div>
            </div>
            <span>{product.category}</span>
            <span>¥ {product.price}</span>
            <span>{product.stock}</span>
            <StatusBadge status={product.status} />
            <div className="row-actions">
              <button className="icon-button" type="button" aria-label="编辑商品" onClick={() => onEdit(product)}>
                <Pencil size={16} />
              </button>
              <button
                className="icon-button"
                type="button"
                aria-label={product.status === "live" ? "下架商品" : "上架商品"}
                onClick={() => onToggleStatus(product.id)}
              >
                {product.status === "live" ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
              <button className="icon-button danger" type="button" aria-label="删除商品" onClick={() => onDelete(product)}>
                <Trash2 size={16} />
              </button>
            </div>
          </article>
        ))}
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

  function update<K extends keyof Product>(key: K, value: Product[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  async function handleFiles(files: FileList | null) {
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
      onToast("图片已上传。");
    } catch (error) {
      onToast(error instanceof Error ? error.message : "图片上传失败。", "danger");
    } finally {
      setIsUploading(false);
    }
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
      };
    });
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!draft.name.trim()) {
      onToast("请输入商品名称。", "danger");
      return;
    }
    await onSave({
      ...draft,
      name: draft.name.trim(),
      subtitle: draft.subtitle.trim(),
      category: draft.category.trim() || "未分类",
      specs: draft.specs.trim() || "20 支 / 包",
      description: draft.description.trim(),
    });
  }

  return (
    <div className="drawer-backdrop" role="presentation">
      <aside className="drawer" aria-label="编辑商品">
        <div className="drawer-header">
          <div>
            <span>商品档案</span>
            <h2>{product.name ? "编辑商品" : "新增商品"}</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="关闭">
            <X size={18} />
          </button>
        </div>
        <form className="editor-form" onSubmit={handleSubmit}>
          <div className="image-uploader">
            <div className="image-uploader-main">
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
            {draft.imageIds.length ? (
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
            <label>
              <span>状态</span>
              <select
                value={draft.status}
                onChange={(event) =>
                  update("status", event.target.value as ProductStatus)
                }
              >
                <option value="live">已上架</option>
                <option value="draft">未上架</option>
              </select>
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
          <div className="drawer-actions">
            <button className="button secondary" type="button" onClick={onClose}>
              取消
            </button>
            <button className="button primary" type="submit">
              保存商品
            </button>
          </div>
        </form>
      </aside>
    </div>
  );
}

function SettingsPanel({
  settings,
  isAuthed,
  onSave,
  onResetAge,
  onExport,
  onImport,
  onClearAll,
}: {
  settings: SiteSettings;
  isAuthed: boolean;
  onSave: (settings: SiteSettings) => void | Promise<void>;
  onResetAge: () => void;
  onExport: () => void;
  onImport: (file: File) => void;
  onClearAll: () => void;
}) {
  const [draft, setDraft] = useState(settings);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    if (!isDirty) {
      setDraft(settings);
    }
  }, [isDirty, settings]);

  function update<K extends keyof SiteSettings>(key: K, value: SiteSettings[K]) {
    setIsDirty(true);
    setDraft((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    await onSave(draft);
    setIsDirty(false);
  }

  if (!isAuthed) {
    return (
      <main className="page-panel">
        <EmptyState
          icon={<Lock size={28} />}
          title="需要管理员权限"
          body="设置页包含数据导入导出和展示开关，请先登录管理员账号。"
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
        <h1>品牌展示与本地数据设置</h1>
        <p>统一控制展示页文案、筛选显示、年龄确认和本地数据备份。</p>
      </section>
      <form className="settings-grid" onSubmit={handleSubmit}>
        <section className="settings-card">
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
        <section className="settings-card">
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
            checked={draft.requireAgeGate}
            label="进入前年龄确认"
            onChange={(value) => update("requireAgeGate", value)}
          />
        </section>
        <section className="settings-card danger-zone">
          <h2>本地数据</h2>
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
            清空全部数据
          </button>
        </section>
        <div className="settings-actions">
          <button className="button secondary" type="button" onClick={() => setDraft(defaultSettings)}>
            恢复默认展示
          </button>
          <button className="button primary" type="submit">
            保存设置
          </button>
        </div>
      </form>
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
}: {
  icon: ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="empty-state">
      <div>{icon}</div>
      <h2>{title}</h2>
      <p>{body}</p>
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
  onConfirm: () => void;
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
