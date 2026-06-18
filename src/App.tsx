import { useEffect, useState } from "react";
import { hashPassword } from "./lib/auth";
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
import { TopNav } from "./components/AppChrome";
import { ConfirmDialog, ToastStack } from "./components/ui";
import { AgeGate, AuthScreen } from "./features/auth/AuthScreen";
import { ProductAdmin } from "./features/admin/ProductAdmin";
import { ProductEditor } from "./features/admin/ProductEditor";
import { SettingsPanel } from "./features/settings/SettingsPanel";
import { Storefront } from "./features/storefront/Storefront";
import type { AdminUpdateInput, ToastKind, ToastMessage, View } from "./lib/appTypes";
import { makeNewProduct } from "./lib/productUtils";
import {
  buildExportPayload,
  clearImages,
  clearJsonState,
  importPayload,
  initialAppState,
  loadAppState,
  removeImage,
  saveAdmin,
  saveAgeVerified,
  saveProducts,
  saveSession,
  saveSettings,
} from "./lib/storage";
import type { AdminUser, AppState, ExportPayload, Product, ProductStatus, SiteSettings } from "./lib/types";

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

