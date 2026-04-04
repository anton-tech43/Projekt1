import "server-only";
import { fileTypeFromBuffer } from "file-type";

const ALLOWED_TYPES = new Map([
  ["image/jpeg", { maxSize: 10 * 1024 * 1024 }], // 10MB
  ["image/png", { maxSize: 10 * 1024 * 1024 }],
  ["application/pdf", { maxSize: 20 * 1024 * 1024 }], // 20MB
]);

const MAX_IMAGE_DIMENSION = 8000; // Claude Vision limit

export interface ValidationResult {
  valid: boolean;
  mimeType?: string;
  error?: string;
}

/**
 * Validate uploaded file using magic bytes (not extension or Content-Type header).
 * Returns the detected MIME type if valid.
 */
export async function validateFile(buffer: Buffer): Promise<ValidationResult> {
  // Check magic bytes
  const fileType = await fileTypeFromBuffer(buffer);
  if (!fileType) {
    return { valid: false, error: "Kunde inte identifiera filtypen. Ladda upp en JPEG, PNG eller PDF." };
  }

  const config = ALLOWED_TYPES.get(fileType.mime);
  if (!config) {
    return {
      valid: false,
      error: `Filtypen ${fileType.mime} stöds inte. Använd JPEG, PNG eller PDF.`,
    };
  }

  // Check file size
  if (buffer.length > config.maxSize) {
    const maxMB = config.maxSize / (1024 * 1024);
    return {
      valid: false,
      error: `Filen är för stor. Max ${maxMB}MB för ${fileType.mime}.`,
    };
  }

  return { valid: true, mimeType: fileType.mime };
}

/**
 * Validate image dimensions using sharp.
 * Must be called after validateFile confirms it's an image.
 */
export async function validateImageDimensions(
  buffer: Buffer
): Promise<ValidationResult> {
  // Dynamic import to avoid loading sharp when not needed
  const sharp = (await import("sharp")).default;
  const metadata = await sharp(buffer).metadata();

  if (!metadata.width || !metadata.height) {
    return { valid: false, error: "Kunde inte läsa bildens dimensioner." };
  }

  if (
    metadata.width > MAX_IMAGE_DIMENSION ||
    metadata.height > MAX_IMAGE_DIMENSION
  ) {
    return {
      valid: false,
      error: `Bilden är för stor (${metadata.width}x${metadata.height}). Max ${MAX_IMAGE_DIMENSION}x${MAX_IMAGE_DIMENSION} pixlar.`,
    };
  }

  return { valid: true, mimeType: "image/jpeg" };
}
