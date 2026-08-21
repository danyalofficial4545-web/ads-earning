import { describe, expect, it } from "vitest";
import { resolveForgeClientConfig } from "./forgeConfig";

describe("Forge client configuration", () => {
  it("prefers Vite-prefixed Forge variables for browser builds", () => {
    expect(
      resolveForgeClientConfig({
        VITE_BUILT_IN_FORGE_API_URL: "https://vite.example",
        VITE_BUILT_IN_FORGE_API_KEY: "vite-key",
        BUILT_IN_FORGE_API_URL: "https://legacy.example",
        BUILT_IN_FORGE_API_KEY: "legacy-key",
      }),
    ).toEqual({ apiUrl: "https://vite.example", apiKey: "vite-key" });
  });

  it("retains the legacy built-in variables as a fallback", () => {
    expect(
      resolveForgeClientConfig({
        BUILT_IN_FORGE_API_URL: "https://legacy.example",
        BUILT_IN_FORGE_API_KEY: "legacy-key",
      }),
    ).toEqual({ apiUrl: "https://legacy.example", apiKey: "legacy-key" });
  });
});
