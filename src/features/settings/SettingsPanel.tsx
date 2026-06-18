import { Download, Gauge, Lock, Settings as SettingsIcon, Trash2, Upload } from "lucide-react";
import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { ConfirmDialog, EmptyState, Toggle } from "../../components/ui";
import { isStrongEnoughPassword } from "../../lib/auth";
import { isCloudEnabled } from "../../lib/cloud";
import { defaultSettings } from "../../lib/defaults";
import { formatBytes, IMAGE_COMPRESSION_MAX_BYTES, IMAGE_COMPRESSION_TARGET_BYTES } from "../../lib/imageCompression";
import { fontOptions, themeOptions } from "../../lib/presets";
import type { AdminUpdateInput } from "../../lib/appTypes";
import type { AdminUser, GridDensity, ProductSort, SiteSettings } from "../../lib/types";

export function SettingsPanel({
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
