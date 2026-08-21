import "dotenv/config";
import type { Request, Response } from "express";
import { createApp } from "./app";

const app = createApp();

/** Bundled by the Vercel build into api/storage.js. */
export default function storageHandler(req: Request, res: Response) {
  const rawKey = req.query.key;
  const key = Array.isArray(rawKey) ? rawKey[0] : rawKey;
  if (!key || typeof key !== "string") {
    res.status(400).send("Missing storage key");
    return;
  }
  req.url = `/manus-storage/${key}`;
  app(req, res);
}
