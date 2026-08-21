import "dotenv/config";
import { createApp } from "../server/app";

// Vercel's Node runtime invokes this Function for existing relative /api/* routes.
export default createApp();
