import { Archive, ChevronRight, Filter, Image as ImageIcon, Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import { EmptyState, ImageFrame, StatCard, StatusBadge } from "../../components/ui";
import type { Product, ProductStatus, SiteSettings } from "../../lib/types";

export function Storefront({
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
