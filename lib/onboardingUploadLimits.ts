export const MAX_EMAIL_ATTACHMENT_BYTES = 20 * 1024 * 1024;
export const BASE64_OVERHEAD_RATIO = 4 / 3;
export const EMAIL_OVERHEAD_BYTES = 512 * 1024;

export const MAX_TOTAL_UPLOAD_BYTES = Math.max(
  Math.floor(MAX_EMAIL_ATTACHMENT_BYTES / BASE64_OVERHEAD_RATIO) -
    EMAIL_OVERHEAD_BYTES,
  5 * 1024 * 1024,
);

export const getBase64Size = (bytes: number) => Math.ceil(bytes / 3) * 4;

export const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const MAX_TOTAL_UPLOAD_LABEL = formatBytes(MAX_TOTAL_UPLOAD_BYTES);
