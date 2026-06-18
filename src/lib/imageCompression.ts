import type { ImageCompressionStats } from "./types";

export const IMAGE_COMPRESSION_TARGET_BYTES = 25 * 1024;
export const IMAGE_COMPRESSION_MAX_BYTES = 30 * 1024;
export const IMAGE_COMPRESSION_MAX_SOURCE_BYTES = 12 * 1024 * 1024;

interface CompressionOptions {
  targetBytes?: number;
  maxBytes?: number;
  maxLongEdge?: number;
  minLongEdge?: number;
  initialQuality?: number;
  minQuality?: number;
}

interface DrawableImage {
  source: CanvasImageSource;
  width: number;
  height: number;
  dispose: () => void;
}

let webpSupported: boolean | null = null;

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const [meta, base64] = dataUrl.split(",");
  const mime = meta.match(/data:(.*);base64/)?.[1] ?? "image/jpeg";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type: mime });
}

function supportsWebpEncoding(): boolean {
  if (webpSupported !== null) return webpSupported;
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  webpSupported = canvas.toDataURL("image/webp").startsWith("data:image/webp");
  return webpSupported;
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
          return;
        }
        reject(new Error("图片压缩失败，请换一张图片后重试。"));
      },
      type,
      quality,
    );
  });
}

async function loadImage(file: File): Promise<DrawableImage> {
  if ("createImageBitmap" in window) {
    const bitmap = await createImageBitmap(file);
    return {
      source: bitmap,
      width: bitmap.width,
      height: bitmap.height,
      dispose: () => bitmap.close(),
    };
  }

  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      resolve({
        source: image,
        width: image.naturalWidth,
        height: image.naturalHeight,
        dispose: () => URL.revokeObjectURL(url),
      });
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("图片读取失败，请确认文件格式正确。"));
    };
    image.src = url;
  });
}

function scaledSize(width: number, height: number, longEdge: number) {
  const sourceLongEdge = Math.max(width, height);
  const ratio = Math.min(1, longEdge / sourceLongEdge);
  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio)),
  };
}

function withExtension(name: string, mimeType: string): string {
  const extension = mimeType === "image/webp" ? "webp" : "jpg";
  const base = name.replace(/\.[^.]+$/, "") || "product-image";
  return `${base}-compressed.${extension}`;
}

export async function compressImageFile(
  file: File,
  options: CompressionOptions = {},
): Promise<{ file: File; stats: ImageCompressionStats }> {
  if (!file.type.startsWith("image/")) {
    throw new Error("请上传图片文件。");
  }
  if (file.size > IMAGE_COMPRESSION_MAX_SOURCE_BYTES) {
    throw new Error(
      `原图不能超过 ${formatBytes(IMAGE_COMPRESSION_MAX_SOURCE_BYTES)}。`,
    );
  }

  const targetBytes = options.targetBytes ?? IMAGE_COMPRESSION_TARGET_BYTES;
  const maxBytes = options.maxBytes ?? IMAGE_COMPRESSION_MAX_BYTES;
  const maxLongEdge = options.maxLongEdge ?? 960;
  const minLongEdge = options.minLongEdge ?? 640;
  const initialQuality = options.initialQuality ?? 0.82;
  const minQuality = options.minQuality ?? 0.45;
  const mimeType = supportsWebpEncoding() ? "image/webp" : "image/jpeg";
  const image = await loadImage(file);
  const originalWidth = image.width;
  const originalHeight = image.height;
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { alpha: mimeType === "image/webp" });

  if (!context) {
    image.dispose();
    throw new Error("当前设备暂不支持图片处理，请换用新版浏览器。");
  }

  let best:
    | {
        blob: Blob;
        width: number;
        height: number;
        quality: number;
        iterations: number;
      }
    | null = null;
  let iterations = 0;

  try {
    const sourceLongEdge = Math.max(originalWidth, originalHeight);
    const startLongEdge = Math.max(
      minLongEdge,
      Math.min(maxLongEdge, sourceLongEdge),
    );

    for (
      let longEdge = startLongEdge;
      longEdge >= minLongEdge;
      longEdge = Math.max(minLongEdge, Math.floor(longEdge * 0.84))
    ) {
      const size = scaledSize(originalWidth, originalHeight, longEdge);
      canvas.width = size.width;
      canvas.height = size.height;
      context.clearRect(0, 0, size.width, size.height);
      context.drawImage(image.source, 0, 0, size.width, size.height);

      for (
        let quality = initialQuality;
        quality >= minQuality;
        quality = Math.round((quality - 0.07) * 100) / 100
      ) {
        iterations += 1;
        const blob = await canvasToBlob(canvas, mimeType, quality);
        if (!best || blob.size < best.blob.size) {
          best = { blob, width: size.width, height: size.height, quality, iterations };
        }
        if (blob.size <= targetBytes) {
          best = { blob, width: size.width, height: size.height, quality, iterations };
          break;
        }
      }

      if (best && best.blob.size <= targetBytes) break;
      if (longEdge === minLongEdge) break;
    }
  } finally {
    image.dispose();
  }

  if (!best || best.blob.size > maxBytes) {
    throw new Error(
      `图片压缩后仍超过 ${formatBytes(maxBytes)}，请裁切主体或换一张更简洁的图片。`,
    );
  }

  const compressedFile = new File([best.blob], withExtension(file.name, mimeType), {
    type: mimeType,
    lastModified: Date.now(),
  });

  return {
    file: compressedFile,
    stats: {
      originalBytes: file.size,
      compressedBytes: compressedFile.size,
      originalWidth,
      originalHeight,
      width: best.width,
      height: best.height,
      type: mimeType,
      quality: best.quality,
      targetBytes,
      maxBytes,
      iterations: best.iterations,
    },
  };
}
