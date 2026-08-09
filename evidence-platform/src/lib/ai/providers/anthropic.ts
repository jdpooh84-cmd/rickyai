import "server-only";
import crypto from "crypto";
import Anthropic from "@anthropic-ai/sdk";
import type { AIProvider, ProviderRunOptions, ProviderRunResult } from "./interface";
import type { ZodSchema } from "zod";

const MODEL = "claude-sonnet-4-5" as const;
const INPUT_COST_PER_TOKEN = 0.000003;
const OUTPUT_COST_PER_TOKEN = 0.000015;

function hashInput(content: string): string {
  return crypto.createHash("sha256").update(content).digest("hex");
}

function estimateCost(inputTokens: number, outputTokens: number): number {
  return inputTokens * INPUT_COST_PER_TOKEN + outputTokens * OUTPUT_COST_PER_TOKEN;
}

export class AnthropicProvider implements AIProvider {
  readonly name = "anthropic";
  private client: Anthropic;

  constructor() {
    const apiKey = process.env["ANTHROPIC_API_KEY"];
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY is required for the Anthropic provider");
    }
    this.client = new Anthropic({ apiKey });
  }

  async run<T>(options: ProviderRunOptions<T>): Promise<ProviderRunResult<T>> {
    const start = Date.now();
    const maxRetries = options.maxRetries ?? 1;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await this.client.messages.create({
          model: MODEL,
          max_tokens: 4096,
          system: options.systemPrompt,
          messages: [{ role: "user", content: options.userContent }],
        });

        const text =
          response.content[0]?.type === "text" ? response.content[0].text : "";

        let parsed: ReturnType<ZodSchema<T>["safeParse"]>;
        try {
          const json = JSON.parse(text) as unknown;
          parsed = options.schema.safeParse(json);
        } catch {
          parsed = { success: false, error: new Error("JSON parse failed") } as never;
        }

        if (!parsed.success) {
          if (attempt < maxRetries) {
            lastError = new Error(`Schema validation failed: ${parsed.error}`);
            continue;
          }
          throw new Error(
            `Anthropic provider: schema validation failed after ${maxRetries + 1} attempts`,
          );
        }

        const inputTokens = response.usage?.input_tokens ?? 0;
        const outputTokens = response.usage?.output_tokens ?? 0;

        return {
          output: parsed.data,
          modelName: MODEL,
          provider: "anthropic",
          promptVersion: options.promptVersion,
          inputHash: hashInput(options.userContent),
          latencyMs: Date.now() - start,
          costUsd: estimateCost(inputTokens, outputTokens),
        };
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (attempt >= maxRetries) break;
      }
    }

    throw lastError ?? new Error("Anthropic provider: unknown error");
  }
}
