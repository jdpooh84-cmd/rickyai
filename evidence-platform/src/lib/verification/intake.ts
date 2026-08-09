import "server-only";
import crypto from "crypto";
import { z } from "zod";

export const CaseInputTypeSchema = z.enum(["text", "url", "doi_list", "file_upload"]);
export type CaseInputType = z.infer<typeof CaseInputTypeSchema>;

export const CreateCaseInputSchema = z.object({
  title: z.string().min(1).max(500),
  input_type: CaseInputTypeSchema,
  raw_input: z.string().max(500000).optional(),
  source_url: z.string().url().optional(),
  user_context: z.record(z.string(), z.unknown()).optional(),
});

export type CreateCaseInput = z.infer<typeof CreateCaseInputSchema>;

export function hashText(text: string): string {
  return crypto.createHash("sha256").update(text, "utf-8").digest("hex");
}

export function hashBuffer(buffer: Buffer): string {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

export function normalizeText(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trim();
}

export function extractDoiList(text: string): string[] {
  const doiPattern = /\b10\.\d{4,}(?:\.\d+)*\/[^\s,;)\]}>'"]+/gi;
  const matches = text.match(doiPattern) ?? [];
  return [...new Set(matches.map((m) => m.toLowerCase()))];
}

export function sanitizeStoragePath(
  organizationId: string,
  caseId: string,
  filename: string,
): string {
  const safeFilename = filename
    .replace(/\.\./g, "_")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(0, 200);
  return `orgs/${organizationId}/cases/${caseId}/${safeFilename}`;
}
