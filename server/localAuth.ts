import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { SignJWT, jwtVerify } from "jose";
import { ENV } from "./_core/env";

const scrypt = promisify(scryptCallback);
export const LOCAL_SESSION_COOKIE = "pep_local_session";
const encoder = new TextEncoder();

function secret() {
  if (!ENV.cookieSecret) throw new Error("Session signing is not configured.");
  return encoder.encode(ENV.cookieSecret);
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derived = await scrypt(password, salt, 64) as Buffer;
  return `scrypt$${salt}$${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, savedHash: string | null | undefined) {
  if (!savedHash) return false;
  const [algorithm, salt, expected] = savedHash.split("$");
  if (algorithm !== "scrypt" || !salt || !expected) return false;
  const derived = await scrypt(password, salt, 64) as Buffer;
  const expectedBuffer = Buffer.from(expected, "hex");
  return expectedBuffer.length === derived.length && timingSafeEqual(expectedBuffer, derived);
}

export async function createLocalSession(userId: number) {
  return new SignJWT({ localUserId: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret());
}

export async function readLocalSession(token: string | undefined) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    const userId = payload.localUserId;
    return typeof userId === "number" && Number.isInteger(userId) ? userId : null;
  } catch {
    return null;
  }
}
