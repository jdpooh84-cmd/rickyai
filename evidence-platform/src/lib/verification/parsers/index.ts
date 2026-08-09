import "server-only";

export type ParsedFile = {
  text: string;
  mimeType: string;
  pageCount?: number;
};

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/markdown",
]);

const MAX_FILE_SIZE = parseInt(process.env["MAX_FILE_SIZE_BYTES"] ?? "15728640", 10);

export function validateMimeType(mimeType: string): boolean {
  const base = mimeType.split(";")[0]?.trim() ?? "";
  return ALLOWED_MIME_TYPES.has(base);
}

export function validateFileSize(bytes: number): boolean {
  return bytes <= MAX_FILE_SIZE;
}

export async function parseFile(buffer: Buffer, mimeType: string): Promise<ParsedFile> {
  const base = mimeType.split(";")[0]?.trim() ?? "";

  if (!validateMimeType(base)) {
    throw new Error(`Unsupported MIME type: ${base}`);
  }

  if (base === "application/pdf") {
    return parsePdf(buffer);
  }

  if (base === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    return parseDocx(buffer);
  }

  return {
    text: buffer.toString("utf-8"),
    mimeType: base,
  };
}

async function parsePdf(buffer: Buffer): Promise<ParsedFile> {
  type PdfParseResult = { text: string; numpages: number };
  type PdfParseFn = (buf: Buffer) => Promise<PdfParseResult>;
  // pdf-parse uses export= syntax; the default export is the function
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mod = (await import("pdf-parse")) as any;
  const pdfParse = (mod.default ?? mod) as PdfParseFn;
  const result = await pdfParse(buffer);
  return {
    text: result.text,
    mimeType: "application/pdf",
    pageCount: result.numpages,
  };
}

async function parseDocx(buffer: Buffer): Promise<ParsedFile> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ buffer });
  return {
    text: result.value,
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  };
}
