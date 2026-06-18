import { Gauge, Upload, X } from "lucide-react";
import { DragEvent, FormEvent, useMemo, useState } from "react";
import { ConfirmDialog, ImageFrame, ImageThumb, StatusBadge } from "../../components/ui";
import type { ToastKind, UploadReport } from "../../lib/appTypes";
import { formatBytes, IMAGE_COMPRESSION_MAX_BYTES, IMAGE_COMPRESSION_TARGET_BYTES } from "../../lib/imageCompression";
import { compressionSavings } from "../../lib/productUtils";
import { removeImage, saveImageFile } from "../../lib/storage";
import type { Product } from "../../lib/types";

export function ProductEditor({
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
