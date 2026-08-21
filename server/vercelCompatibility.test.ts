import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Vercel deployment configuration", () => {
  it("builds the Vite client, preserves API functions, storage URLs, and SPA routes", () => {
    const root = resolve(import.meta.dirname, "..");
    const packageJson = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
    const config = JSON.parse(readFileSync(resolve(root, "vercel.json"), "utf8"));

    expect(packageJson.scripts["build:vercel"]).toContain("build:vercel:functions");
    expect(config.outputDirectory).toBe("dist/public");
    expect(config.functions["api/[...path].js"].maxDuration).toBe(30);
    expect(config.routes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ handle: "filesystem" }),
        expect.objectContaining({ src: "/api/(.*)", dest: "/api/[...path].js" }),
        expect.objectContaining({ src: "/manus-storage/(.*)", dest: "/api/storage?key=$1" }),
        expect.objectContaining({ src: "/(.*)", dest: "/index.html" }),
      ])
    );
  });
});
