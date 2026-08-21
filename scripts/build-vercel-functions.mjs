import { build } from "esbuild";

await build({
  entryPoints: {
    "[...path]": "server/vercel-api.ts",
    storage: "server/vercel-storage.ts",
  },
  outdir: "api",
  bundle: true,
  format: "esm",
  platform: "node",
  target: "node22",
  packages: "external",
  sourcemap: false,
  logLevel: "info",
});
