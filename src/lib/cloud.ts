import { createClient } from "@supabase/supabase-js";
import { normalizeProducts, normalizeSettings } from "./defaults";
import {
  blobToDataUrl,
  compressImageFile,
  dataUrlToBlob,
} from "./imageCompression";
import type {
  AdminUser,
  AppState,
  CloudCapacity,
  ExportPayload,
  ImageRecord,
  Product,
  SiteSettings,
} from "./types";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL?.replace(/\/rest\/v1\/?$/, "");
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const CLOUD_SESSION_KEY = "cabinet:v1:cloudSession";

export const isCloudEnabled = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

const supabase = isCloudEnabled
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })
  : null;

interface CloudRpcResult {
  sessionToken?: string;
  state?: AppState;
}

interface CloudImagePayload {
  id: string;
  name: string;
  type: string;
  dataUrl: string;
  createdAt: string;
}

function getClient() {
  if (!supabase) {
    throw new Error("资料同步暂未启用。");
  }
  return supabase;
}

export function getCloudSessionToken(): string | null {
  try {
    return localStorage.getItem(CLOUD_SESSION_KEY);
  } catch {
    return null;
  }
}

function setCloudSessionToken(token: string | null) {
  try {
    if (token) {
      localStorage.setItem(CLOUD_SESSION_KEY, token);
    } else {
      localStorage.removeItem(CLOUD_SESSION_KEY);
    }
  } catch {
    // Session persistence failure falls back to the current in-memory state.
  }
}

function normalizeState(state: AppState): AppState {
  return {
    ...state,
    products: normalizeProducts(state.products),
    settings: normalizeSettings(state.settings),
    ageVerified: false,
  };
}

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await getClient().rpc(fn, args);
  if (error) {
    throw new Error(error.message);
  }
  return data as T;
}

function applySessionResult(result: CloudRpcResult): AppState {
  setCloudSessionToken(result.sessionToken ?? null);
  if (!result.state) {
    throw new Error("资料暂时无法读取。");
  }
  return normalizeState(result.state);
}

export async function loadCloudState(): Promise<AppState> {
  return normalizeState(
    await rpc<AppState>("cabinet_get_state", {
      p_session_token: getCloudSessionToken(),
    }),
  );
}

export async function loadCloudCapacity(): Promise<CloudCapacity> {
  return rpc<CloudCapacity>("cabinet_get_capacity", {
    p_session_token: getCloudSessionToken(),
  });
}

export async function createCloudAdmin(admin: AdminUser): Promise<AppState> {
  return applySessionResult(
    await rpc<CloudRpcResult>("cabinet_create_admin", {
      p_display_name: admin.displayName,
      p_username: admin.username,
      p_password_hash: admin.passwordHash,
    }),
  );
}

export async function loginCloudAdmin(
  username: string,
  passwordHash: string,
): Promise<AppState> {
  return applySessionResult(
    await rpc<CloudRpcResult>("cabinet_login", {
      p_username: username,
      p_password_hash: passwordHash,
    }),
  );
}

export async function logoutCloudAdmin(): Promise<AppState> {
  const state = await rpc<AppState>("cabinet_logout", {
    p_session_token: getCloudSessionToken(),
  });
  setCloudSessionToken(null);
  return normalizeState(state);
}

export async function saveCloudProduct(product: Product): Promise<AppState> {
  return normalizeState(
    await rpc<AppState>("cabinet_save_product", {
      p_session_token: getCloudSessionToken(),
      p_product: product,
    }),
  );
}

export async function setCloudProductStatus(
  productId: string,
  status?: Product["status"],
): Promise<AppState> {
  return normalizeState(
    await rpc<AppState>("cabinet_set_product_status", {
      p_session_token: getCloudSessionToken(),
      p_product_id: productId,
      p_status: status ?? "",
    }),
  );
}

export async function bulkCloudProductStatus(
  status: Product["status"],
  productIds?: string[],
): Promise<AppState> {
  return normalizeState(
    await rpc<AppState>("cabinet_bulk_status", {
      p_session_token: getCloudSessionToken(),
      p_status: status,
      p_product_ids: productIds?.length ? productIds : null,
    }),
  );
}

export async function deleteCloudProduct(productId: string): Promise<AppState> {
  return normalizeState(
    await rpc<AppState>("cabinet_delete_product", {
      p_session_token: getCloudSessionToken(),
      p_product_id: productId,
    }),
  );
}

export async function saveCloudSettings(
  settings: SiteSettings,
): Promise<AppState> {
  return normalizeState(
    await rpc<AppState>("cabinet_save_settings", {
      p_session_token: getCloudSessionToken(),
      p_settings: settings,
    }),
  );
}

export async function updateCloudAdmin({
  displayName,
  username,
  currentPasswordHash,
  newPasswordHash,
}: {
  displayName: string;
  username: string;
  currentPasswordHash: string;
  newPasswordHash?: string | null;
}): Promise<AppState> {
  return normalizeState(
    await rpc<AppState>("cabinet_update_admin", {
      p_session_token: getCloudSessionToken(),
      p_display_name: displayName,
      p_username: username,
      p_current_password_hash: currentPasswordHash,
      p_new_password_hash: newPasswordHash,
    }),
  );
}

export async function clearCloudAll(): Promise<AppState> {
  const state = await rpc<AppState>("cabinet_clear_all", {
    p_session_token: getCloudSessionToken(),
  });
  setCloudSessionToken(null);
  return normalizeState(state);
}

export async function saveCloudImageFile(file: File): Promise<ImageRecord> {
  const compressed = await compressImageFile(file);
  const dataUrl = await blobToDataUrl(compressed.file);
  const id = `image-${crypto.randomUUID()}`;
  const record = await rpc<CloudImagePayload>("cabinet_save_image", {
    p_session_token: getCloudSessionToken(),
    p_id: id,
    p_name: compressed.file.name,
    p_type: compressed.file.type || "image/jpeg",
    p_data_url: dataUrl,
  });

  return {
    id: record.id,
    name: record.name,
    type: record.type,
    blob: compressed.file,
    createdAt: record.createdAt,
    compression: compressed.stats,
  };
}

export async function getCloudImageDataUrl(
  imageId?: string,
): Promise<string | null> {
  if (!imageId) return null;
  const image = await rpc<CloudImagePayload | null>("cabinet_get_image", {
    p_image_id: imageId,
  });
  return image?.dataUrl ?? null;
}

export async function removeCloudImage(imageId: string): Promise<void> {
  await rpc("cabinet_delete_image", {
    p_session_token: getCloudSessionToken(),
    p_image_id: imageId,
  });
}

export async function listCloudImageRecords(): Promise<ImageRecord[]> {
  const images = await rpc<CloudImagePayload[]>("cabinet_list_images", {
    p_session_token: getCloudSessionToken(),
  });

  return images.map((image) => ({
    id: image.id,
    name: image.name,
    type: image.type,
    createdAt: image.createdAt,
    blob: dataUrlToBlob(image.dataUrl),
  }));
}

export async function importCloudPayload(
  payload: ExportPayload,
): Promise<AppState> {
  return normalizeState(
    await rpc<AppState>("cabinet_import_payload", {
      p_session_token: getCloudSessionToken(),
      p_payload: payload,
    }),
  );
}
