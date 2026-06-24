import { Cloud, LogIn, LogOut, PackagePlus } from "lucide-react";
import type { View } from "../lib/appTypes";

type CloudStatus = "local" | "syncing" | "synced" | "offline";

export function TopNav({
  brandName,
  view,
  isAuthed,
  cloudEnabled,
  cloudStatus,
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
  cloudStatus: CloudStatus;
  hasAdmin: boolean;
  onNavigate: (view: View) => void;
  onLogin: () => void;
  onLogout: () => void;
  onCreate: () => void;
}) {
  const statusLabel =
    cloudStatus === "syncing"
      ? "云端同步中"
      : cloudStatus === "synced"
        ? "资料已同步"
        : cloudStatus === "offline"
          ? "暂未连接"
          : cloudEnabled
            ? "云端待连接"
            : "本机整理";

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
        <div className={`cloud-status cloud-status-${cloudStatus}`} aria-label={statusLabel}>
          <Cloud size={15} />
          <span>{statusLabel}</span>
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
