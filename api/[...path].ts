import "dotenv/config";
import { createApp } from "../server/app";

/** Vercel catch-all Function for the existing relative /api/* routes. */
export default createApp();
