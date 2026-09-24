import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { parse } from "cookie";
import type { User } from "../../drizzle/schema";
import { getUserById } from "../db";
import { LEGACY_LOCAL_SESSION_COOKIE, LOCAL_SESSION_COOKIE, readLocalSession } from "../localAuth";
import { sdk } from "./sdk";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    user = null;
  }

  if (!user) {
    const cookies = parse(opts.req.headers.cookie ?? "");
    const localUserId = await readLocalSession(
      cookies[LOCAL_SESSION_COOKIE] ?? cookies[LEGACY_LOCAL_SESSION_COOKIE]
    );
    user = localUserId ? (await getUserById(localUserId)) ?? null : null;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
