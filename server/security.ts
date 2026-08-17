import { createHash, randomInt, randomUUID } from "node:crypto";
import { HUMAN_IMAGE_OPTIONS, humanImagePrompt } from "../shared/humanVerification";

export function hashSecurityValue(value: string) {
  return createHash("sha256").update(value.trim()).digest("hex");
}

export function clientIpFromHeaders(headers: Record<string, string | string[] | undefined>) {
  const forwarded = headers["x-forwarded-for"];
  const value = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  return (value?.split(",")[0]?.trim() || "unknown-network").slice(0, 128);
}

export function createHumanChallenge() {
  const selected = HUMAN_IMAGE_OPTIONS[randomInt(0, HUMAN_IMAGE_OPTIONS.length)];
  return {
    id: randomUUID(),
    prompt: humanImagePrompt(selected.id),
    answerHash: hashSecurityValue(selected.id),
    expiresAt: new Date(Date.now() + 5 * 60_000),
  };
}

export function matchesHumanChallenge(answer: string, answerHash: string) {
  return hashSecurityValue(answer) === answerHash;
}
