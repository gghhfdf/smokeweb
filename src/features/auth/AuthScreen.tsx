import { Eye, EyeOff, Image as ImageIcon, Lock, ShieldCheck } from "lucide-react";
import { FormEvent, useState } from "react";
import { hashPassword, isStrongEnoughPassword } from "../../lib/auth";
import type { AdminUser } from "../../lib/types";

export function AgeGate({
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

export function AuthScreen({
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
