import { defaultSettings, initialProducts } from "./defaults";
import {
  getCloudImageDataUrl,
  importCloudPayload,
  isCloudEnabled,
  listCloudImageRecords,
  removeCloudImage,
  saveCloudImageFile,
} from "./cloud";
import type {
  AdminUser,
  AppState,
  ExportPayload,
  ImageRecord,
  Product,
  SiteSettings,
} from "./types";

const PREFIX = "cabinet:v1";
const DB_NAME = "cabinet-images-v1";
const STORE_NAME = "images";
const DB_VERSION = 1;

const keys = {
  admin: `${PREFIX}:admin`,
  products: `${PREFIX}:products`,
  settings: `${PREFIX}:settings`,
  ageVerified: `${PREFIX}:ageVerified`,
  session: `${PREFIX}:session`,
};

export const initialAppState: AppState = {
  adminUser: null,
  products: initialProducts,
  settings: defaultSettings,
  ageVerified: false,
  sessionUserId: null,
};

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error("本地存储写入失败", error);
  }
}

export function loadAppState(): AppState {
  return {
    adminUser: readJson<AdminUser | null>(keys.admin, null),
    products: readJson<Product[]>(keys.products, initialProducts),
    settings: {
      ...defaultSettings,
      ...readJson<Partial<SiteSettings>>(keys.settings, defaultSettings),
    },
    ageVerified: readJson<boolean>(keys.ageVerified, false),
    sessionUserId: readJson<string | null>(keys.session, null),
  };
}

export function saveAdmin(admin: AdminUser | null): void {
  writeJson(keys.admin, admin);
}

export function saveProducts(products: Product[]): void {
  writeJson(keys.products, products);
}

export function saveSettings(settings: SiteSettings): void {
  writeJson(keys.settings, settings);
}

export function saveAgeVerified(value: boolean): void {
  writeJson(keys.ageVerified, value);
}

export function saveSession(userId: string | null): void {
  writeJson(keys.session, userId);
}

export function clearJsonState(): void {
  Object.values(keys).forEach((key) => {
    try {
      localStorage.removeItem(key);
    } catch {
      // Ignore storage reset failures; the UI reports the resulting state.
    }
  });
}

function openImageDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function withImageStore<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openImageDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, mode);
        const store = transaction.objectStore(STORE_NAME);
        const request = action(store);

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
        transaction.oncomplete = () => db.close();
        transaction.onerror = () => {
          db.close();
          reject(transaction.error);
        };
      }),
  );
}

export async function saveImageFile(file: File): Promise<ImageRecord> {
  if (isCloudEnabled) {
    return saveCloudImageFile(file);
  }

  if (file.size > 5 * 1024 * 1024) {
    throw new Error("图片不能超过 5MB。");
  }

  const record: ImageRecord = {
    id: `image-${crypto.randomUUID()}`,
    blob: file,
    name: file.name,
    type: file.type || "image/jpeg",
    createdAt: new Date().toISOString(),
  };

  await withImageStore("readwrite", (store) => store.put(record));
  return record;
}

export async function getImageRecord(
  id: string,
): Promise<ImageRecord | undefined> {
  return withImageStore<ImageRecord | undefined>("readonly", (store) =>
    store.get(id),
  );
}

export async function removeImage(id: string): Promise<void> {
  if (isCloudEnabled) {
    await removeCloudImage(id);
    return;
  }

  await withImageStore("readwrite", (store) => store.delete(id));
}

export async function clearImages(): Promise<void> {
  await withImageStore("readwrite", (store) => store.clear());
}

export async function listImageRecords(): Promise<ImageRecord[]> {
  if (isCloudEnabled) {
    return listCloudImageRecords();
  }

  return withImageStore<ImageRecord[]>("readonly", (store) => store.getAll());
}

export async function imageRecordToObjectUrl(
  id?: string,
): Promise<string | null> {
  if (isCloudEnabled) {
    return getCloudImageDataUrl(id);
  }

  if (!id) return null;
  const record = await getImageRecord(id);
  return record ? URL.createObjectURL(record.blob) : null;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [meta, base64] = dataUrl.split(",");
  const mime = meta.match(/data:(.*);base64/)?.[1] ?? "image/jpeg";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type: mime });
}

export async function buildExportPayload(
  state: AppState,
): Promise<ExportPayload> {
  const images = await Promise.all(
    (await listImageRecords()).map(async (record) => ({
      id: record.id,
      name: record.name,
      type: record.type,
      createdAt: record.createdAt,
      dataUrl: await blobToDataUrl(record.blob),
    })),
  );

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    adminUser: state.adminUser,
    products: state.products,
    settings: state.settings,
    ageVerified: state.ageVerified,
    images,
  };
}

export async function importPayload(payload: ExportPayload): Promise<AppState> {
  if (payload.version !== 1) {
    throw new Error("不支持的数据版本。");
  }

  if (isCloudEnabled) {
    return importCloudPayload(payload);
  }

  await clearImages();
  await Promise.all(
    payload.images.map((image) =>
      withImageStore("readwrite", (store) =>
        store.put({
          id: image.id,
          name: image.name,
          type: image.type,
          createdAt: image.createdAt,
          blob: dataUrlToBlob(image.dataUrl),
        } satisfies ImageRecord),
      ),
    ),
  );

  saveAdmin(payload.adminUser);
  saveProducts(payload.products);
  const settings = {
    ...defaultSettings,
    ...payload.settings,
  };

  saveSettings(settings);
  saveAgeVerified(payload.ageVerified);
  saveSession(null);

  return {
    adminUser: payload.adminUser,
    products: payload.products,
    settings,
    ageVerified: payload.ageVerified,
    sessionUserId: null,
  };
}
