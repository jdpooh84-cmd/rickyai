import "server-only";
import type { AIProvider } from "./interface";
import { MockAIProvider } from "./mock";

let _provider: AIProvider | null = null;

export function getAIProvider(): AIProvider {
  if (_provider) return _provider;

  const configured = process.env["AI_PROVIDER"] ?? "mock";

  if (configured === "anthropic" && process.env["ANTHROPIC_API_KEY"]) {
    const { AnthropicProvider } = require("./anthropic") as {
      AnthropicProvider: new () => AIProvider;
    };
    _provider = new AnthropicProvider();
  } else {
    if (configured === "anthropic") {
      console.warn(
        "[AI Factory] AI_PROVIDER=anthropic but ANTHROPIC_API_KEY is absent — falling back to mock",
      );
    }
    _provider = new MockAIProvider();
  }

  return _provider;
}

export function isSingleProvider(): boolean {
  return true;
}
