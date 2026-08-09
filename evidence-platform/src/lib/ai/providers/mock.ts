import "server-only";
import crypto from "crypto";
import type { AIProvider, ProviderRunOptions, ProviderRunResult } from "./interface";
import type { ZodSchema } from "zod";

function hashInput(content: string): string {
  return crypto.createHash("sha256").update(content).digest("hex");
}

function mockOutputForSchema<T>(schema: ZodSchema<T>): T {
  const shape = (schema as unknown as { _def?: { typeName?: string } })._def;
  if (!shape) {
    throw new Error("Mock provider: cannot introspect schema shape");
  }
  return {} as T;
}

export class MockAIProvider implements AIProvider {
  readonly name = "mock";

  async run<T>(options: ProviderRunOptions<T>): Promise<ProviderRunResult<T>> {
    const start = Date.now();

    const parsed = options.schema.safeParse(mockOutputForSchema(options.schema));
    if (!parsed.success) {
      throw new Error(`Mock provider: could not produce valid output: ${parsed.error.message}`);
    }

    return {
      output: parsed.data,
      modelName: "mock-deterministic-v1",
      provider: "mock",
      promptVersion: options.promptVersion,
      inputHash: hashInput(options.userContent),
      latencyMs: Date.now() - start,
      costUsd: 0,
    };
  }
}
