import "server-only";

const MAX_LONG_EDGE = 1568; // Claude Vision downscales to this anyway
const JPEG_QUALITY = 85;

/**
 * Resize and re-encode image to optimal size for Claude Vision.
 * - Resizes to max 1568px on the long edge (Claude's internal limit)
 * - Re-encodes as JPEG quality 85 (strips embedded payloads)
 * - Returns base64-encoded JPEG buffer
 */
export async function prepareImageForVision(buffer: Buffer): Promise<{
  base64: string;
  width: number;
  height: number;
}> {
  const sharp = (await import("sharp")).default;

  const metadata = await sharp(buffer).metadata();
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;

  let processed = sharp(buffer);

  // Resize if either dimension exceeds the limit
  if (width > MAX_LONG_EDGE || height > MAX_LONG_EDGE) {
    processed = processed.resize({
      width: MAX_LONG_EDGE,
      height: MAX_LONG_EDGE,
      fit: "inside", // Maintain aspect ratio, fit within bounds
      withoutEnlargement: true,
    });
  }

  // Re-encode as JPEG (strips any embedded payloads, normalizes format)
  const outputBuffer = await processed
    .jpeg({ quality: JPEG_QUALITY })
    .toBuffer();

  const outputMetadata = await sharp(outputBuffer).metadata();

  return {
    base64: outputBuffer.toString("base64"),
    width: outputMetadata.width ?? 0,
    height: outputMetadata.height ?? 0,
  };
}
