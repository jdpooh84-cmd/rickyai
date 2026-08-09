import type { ZodSchema } from "zod";

export interface ProviderRunOptions<T> {
  promptVersion: string;
  systemPrompt: string;
  userContent: string;
  schema: ZodSchema<T>;
  maxRetries?: number;
}

export interface ProviderRunResult<T> {
  output: T;
  modelName: string;
  provider: string;
  promptVersion: string;
  inputHash: string;
  latencyMs: number;
  costUsd: number;
}

export interface AIProvider {
  readonly name: string;
  run<T>(options: ProviderRunOptions<T>): Promise<ProviderRunResult<T>>;
}
