import { AlertTriangle, Check, Image as ImageIcon, X } from "lucide-react";
import { ReactNode, useEffect, useState } from "react";
import type { ToastMessage } from "../lib/appTypes";
import { imageRecordToObjectUrl } from "../lib/storage";
import type { ProductStatus } from "../lib/types";

export function ImageFrame({
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
    let nextObjectUrl: string | null = null;
    let alive = true;

    setUrl(null);
    imageRecordToObjectUrl(imageId)
      .then((nextUrl) => {
        if (!alive) {
          if (nextUrl?.startsWith("blob:")) URL.revokeObjectURL(nextUrl);
          return;
        }
        nextObjectUrl = nextUrl;
        setUrl(nextUrl);
      })
      .catch(() => {
        if (alive) setUrl(null);
      });

    return () => {
      alive = false;
      if (nextObjectUrl?.startsWith("blob:")) URL.revokeObjectURL(nextObjectUrl);
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

export function ImageThumb({
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

export function StatusBadge({ status }: { status: ProductStatus }) {
  return (
    <span className={`status-badge status-${status}`}>
      {status === "live" ? "已上架" : "未上架"}
    </span>
  );
}

export function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="stat-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

export function EmptyState({
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

export function Toggle({
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

export function ConfirmDialog({
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

export function ToastStack({ toasts }: { toasts: ToastMessage[] }) {
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
