export type ForgeClientEnvironment = Record<string, string | undefined>;

export function resolveForgeClientConfig(env: ForgeClientEnvironment) {
  return {
    apiUrl:
      env.VITE_BUILT_IN_FORGE_API_URL ||
      env.BUILT_IN_FORGE_API_URL ||
      env.VITE_FRONTEND_FORGE_API_URL ||
      "https://forge.manus.ai",
    apiKey:
      env.VITE_BUILT_IN_FORGE_API_KEY ||
      env.BUILT_IN_FORGE_API_KEY ||
      env.VITE_FRONTEND_FORGE_API_KEY ||
      "",
  };
}

export const forgeClientConfig = resolveForgeClientConfig(import.meta.env);
