'use strict';

/**
 * Multer / Busboy: omitting limits.fileSize means no size cap (Infinity in busboy).
 * Set UPLOAD_MAX_FILE_BYTES to enforce a maximum (bytes) on small hosts.
 * @returns { { fileSize: number } | undefined }
 */
function getMulterFileSizeLimit() {
  const raw = process.env.UPLOAD_MAX_FILE_BYTES?.trim();
  if (raw === undefined || raw === '') return undefined;
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) return undefined;
  return { fileSize: n };
}

module.exports = { getMulterFileSizeLimit };
