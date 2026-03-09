"use client";

type OptimizeUploadFilesOptions = {
  maxDimension?: number;
  jpegQuality?: number;
  minBytesToOptimize?: number;
};

const DEFAULT_MAX_DIMENSION = 1600;
const DEFAULT_JPEG_QUALITY = 0.8;
const DEFAULT_MIN_BYTES_TO_OPTIMIZE = 300 * 1024;

const isImageFile = (file: File) => file.type?.startsWith("image/");

const withJpgExtension = (name: string) => {
  const trimmed = name?.trim() ?? "";
  if (!trimmed) return "archivo.jpg";
  const next = trimmed.replace(/\.[^/.]+$/, "");
  return `${next || "archivo"}.jpg`;
};

const blobFromCanvas = (
  canvas: HTMLCanvasElement,
  quality: number,
): Promise<Blob | null> =>
  new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/jpeg", quality);
  });

type LoadedImage = ImageBitmap | HTMLImageElement;

const loadImage = (file: File): Promise<{ source: LoadedImage; objectUrl?: string }> => {
  if (typeof createImageBitmap === "function") {
    return createImageBitmap(file, {
      imageOrientation: "from-image",
    } as ImageBitmapOptions).then((source) => ({ source }));
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => resolve({ source: img, objectUrl });
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("No se pudo leer la imagen"));
    };
    img.src = objectUrl;
  });
};

export const optimizeUploadFiles = async (
  files: File[],
  options: OptimizeUploadFilesOptions = {},
) => {
  const maxDimension = options.maxDimension ?? DEFAULT_MAX_DIMENSION;
  const jpegQuality = options.jpegQuality ?? DEFAULT_JPEG_QUALITY;
  const minBytesToOptimize =
    options.minBytesToOptimize ?? DEFAULT_MIN_BYTES_TO_OPTIMIZE;

  const optimized = await Promise.all(
    files.map(async (file) => {
      if (!isImageFile(file)) return file;
      if (file.size < minBytesToOptimize) return file;

      let loaded: { source: LoadedImage; objectUrl?: string } | null = null;
      try {
        loaded = await loadImage(file);
        const { source } = loaded;

        const width =
          source instanceof ImageBitmap
            ? source.width
            : source.naturalWidth || source.width;
        const height =
          source instanceof ImageBitmap
            ? source.height
            : source.naturalHeight || source.height;

        if (!width || !height) return file;

        const scale = Math.min(1, maxDimension / Math.max(width, height));
        const targetWidth = Math.max(1, Math.round(width * scale));
        const targetHeight = Math.max(1, Math.round(height * scale));

        const canvas = document.createElement("canvas");
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) return file;

        ctx.drawImage(source, 0, 0, targetWidth, targetHeight);

        const blob = await blobFromCanvas(canvas, jpegQuality);
        if (!blob) return file;

        if (blob.size >= Math.round(file.size * 0.95)) return file;

        return new File([blob], withJpgExtension(file.name), {
          type: "image/jpeg",
          lastModified: file.lastModified,
        });
      } catch {
        return file;
      } finally {
        if (loaded?.objectUrl) URL.revokeObjectURL(loaded.objectUrl);
        if (loaded?.source instanceof ImageBitmap) {
          try {
            loaded.source.close();
          } catch {
            // ignore
          }
        }
      }
    }),
  );

  return optimized;
};
