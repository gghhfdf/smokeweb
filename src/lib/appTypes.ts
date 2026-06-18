import type { ImageCompressionStats } from "./types";

export type View = "storefront" | "login" | "admin" | "settings";
export type ToastKind = "success" | "warning" | "danger";

export interface ToastMessage {
  id: string;
  kind: ToastKind;
  text: string;
}

export interface UploadReport {
  id: string;
  fileName: string;
  stats: ImageCompressionStats;
}

export interface AdminUpdateInput {
  displayName: string;
  username: string;
  currentPassword: string;
  newPassword: string;
}
