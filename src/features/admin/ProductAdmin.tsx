import { Cloud, Copy, Database, Eye, EyeOff, Filter, HardDrive, LayoutDashboard, Lock, PackagePlus, Pencil, RefreshCw, Search, SlidersHorizontal, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { EmptyState, ImageFrame, StatCard, StatusBadge } from "../../components/ui";
import { formatBytes } from "../../lib/imageCompression";
import type { CloudCapacity, Product, ProductSort, ProductStatus } from "../../lib/types";

export function ProductAdmin({
  products,
  isAuthed,
  onCreate,
  onEdit,
  onToggleStatus,
  onDelete,
  onBulkStatus,
  onBulkDelete,
  onDuplicate,
  capacity,
  capacityLoading,
  cloudEnabled,
  onRefreshCapacity,
}: {
  products: Product[];
  isAuthed: boolean;
  capacity: CloudCapacity | null;
  capacityLoading: boolean;
  cloudEnabled: boolean;
  onRefreshCapacity: () => void | Promise<void>;
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
  const bulkIds = selectedVisibleIds;
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
      <CapacityPanel
        capacity={capacity}
        loading={capacityLoading}
        cloudEnabled={cloudEnabled}
        onRefresh={onRefreshCapacity}
      />
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
          已选 {selectedVisibleIds.length} 个商品
        </div>
        <div>
          <button
            className="button secondary"
            type="button"
            disabled={!bulkIds.length}
            onClick={() => onBulkStatus("live", bulkIds)}
          >
            批量上架
          </button>
          <button
            className="button secondary"
            type="button"
            disabled={!bulkIds.length}
            onClick={() => onBulkStatus("draft", bulkIds)}
          >
            批量下架
          </button>
          <button
            className="button danger ghost"
            type="button"
            disabled={!bulkIds.length}
            onClick={() => onBulkDelete(bulkIds)}
          >
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
              <ImageFrame imageId={product.coverImageId} alt={product.name} size="thumb" priority />
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

function CapacityPanel({
  capacity,
  loading,
  cloudEnabled,
  onRefresh,
}: {
  capacity: CloudCapacity | null;
  loading: boolean;
  cloudEnabled: boolean;
  onRefresh: () => void | Promise<void>;
}) {
  const usageRatio =
    capacity && capacity.databaseLimitBytes > 0
      ? Math.min(capacity.databaseBytes / capacity.databaseLimitBytes, 1)
      : 0;
  const usagePercent = Math.round(usageRatio * 100);
  const remainingBytes = capacity
    ? Math.max(capacity.databaseLimitBytes - capacity.databaseBytes, 0)
    : 0;
  const decodedImageBytes = capacity?.decodedImageBytes ?? capacity?.imageBytes ?? 0;
  const averageDecodedImageBytes =
    capacity?.averageDecodedImageBytes ?? capacity?.averageImageBytes ?? 0;
  const largestImageBytes = capacity?.largestImageBytes ?? 0;
  const lastCheckedAt = capacity?.lastCheckedAt ?? capacity?.updatedAt;
  const warnings = capacity?.quotaWarnings ?? [];

  return (
    <section className="capacity-panel" aria-label="云端容量">
      <div className="capacity-summary">
        <div className="section-label">
          <Cloud size={15} />
          云端余量
        </div>
        <h2>资料容量概况</h2>
        <p>
          按当前商品图体积估算剩余空间，帮助控制上传数量与图片大小。
        </p>
      </div>
      <div className="capacity-meter">
        <div className="capacity-meter-top">
          <span>数据库空间</span>
          <strong>
            {capacity ? `${formatBytes(capacity.databaseBytes)} / ${formatBytes(capacity.databaseLimitBytes)}` : "等待同步"}
          </strong>
        </div>
        <div className="capacity-bar" aria-hidden="true">
          <i style={{ width: `${usagePercent}%` }} />
        </div>
        <div className="capacity-meter-bottom">
          <span>已用 {capacity ? `${usagePercent}%` : "--"}</span>
          <span>剩余 {capacity ? formatBytes(remainingBytes) : "--"}</span>
        </div>
      </div>
      <div className="capacity-facts">
        <article>
          <Database size={16} />
          <span>数据占用</span>
          <strong>{capacity ? formatBytes(capacity.imageBytes) : "--"}</strong>
        </article>
        <article>
          <HardDrive size={16} />
          <span>图片 / 商品</span>
          <strong>{capacity ? `${capacity.imageCount} / ${capacity.productCount}` : "--"}</strong>
        </article>
        <article>
          <PackagePlus size={16} />
          <span>约可再传</span>
          <strong>{capacity ? `${capacity.estimatedImageSlots.toLocaleString("zh-Hans-CN")} 张` : "--"}</strong>
        </article>
        <article>
          <Database size={16} />
          <span>原图体积</span>
          <strong>{capacity ? formatBytes(decodedImageBytes) : "--"}</strong>
        </article>
        <article>
          <HardDrive size={16} />
          <span>平均 / 最大</span>
          <strong>
            {capacity ? `${formatBytes(averageDecodedImageBytes)} / ${formatBytes(largestImageBytes)}` : "--"}
          </strong>
        </article>
        <article>
          <RefreshCw size={16} />
          <span>最近刷新</span>
          <strong>
            {lastCheckedAt
              ? new Date(lastCheckedAt).toLocaleTimeString("zh-Hans-CN", {
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "--"}
          </strong>
        </article>
      </div>
      {warnings.length ? (
        <div className="capacity-warnings">
          {warnings.map((warning) => (
            <span key={warning}>{warning}</span>
          ))}
        </div>
      ) : null}
      <button
        className="button secondary capacity-refresh"
        type="button"
        onClick={onRefresh}
        disabled={!cloudEnabled || loading}
      >
        <RefreshCw size={15} className={loading ? "spinning" : ""} />
        {loading ? "刷新中" : "刷新容量"}
      </button>
    </section>
  );
}
