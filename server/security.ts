import { createHash, randomInt, randomUUID } from "node:crypto";

export function hashSecurityValue(value: string) {
  return createHash("sha256").update(value.trim()).digest("hex");
}

export function clientIpFromHeaders(headers: Record<string, string | string[] | undefined>) {
  const forwarded = headers["x-forwarded-for"];
  const value = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  return (value?.split(",")[0]?.trim() || "unknown-network").slice(0, 128);
}

const CAPTCHA_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function createVisualCode() {
  return Array.from({ length: 5 }, () =>
    CAPTCHA_ALPHABET[randomInt(0, CAPTCHA_ALPHABET.length)]
  ).join("");
}

function createVisualCodeImage(code: string) {
  const glyphs = Array.from(code)
    .map((character, index) => {
      const x = 28 + index * 42 + randomInt(-3, 4);
      const y = 49 + randomInt(-6, 7);
      const rotation = randomInt(-17, 18);
      const color = ["#FDE68A", "#A7F3D0", "#BAE6FD", "#FBCFE8"][index % 4];
      return `<text x="${x}" y="${y}" fill="${color}" font-family="Arial, sans-serif" font-size="33" font-weight="700" transform="rotate(${rotation} ${x} ${y})">${character}</text>`;
    })
    .join("");
  const lines = Array.from({ length: 4 }, (_, index) => {
    const y1 = 10 + index * 14 + randomInt(-3, 4);
    const y2 = 12 + index * 12 + randomInt(-4, 5);
    return `<path d="M 8 ${y1} Q 110 ${y2 - 9} 232 ${y2}" stroke="#ffffff" stroke-opacity=".18" stroke-width="1.5" fill="none"/>`;
  }).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="70" viewBox="0 0 240 70"><rect width="240" height="70" rx="12" fill="#132f2a"/>${lines}${glyphs}</svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

export function createHumanChallenge() {
  const code = createVisualCode();
  return {
    id: randomUUID(),
    prompt: "Enter the characters shown in the verification image.",
    imageData: createVisualCodeImage(code),
    answerHash: hashSecurityValue(code),
    expiresAt: new Date(Date.now() + 5 * 60_000),
  };
}

export function matchesHumanChallenge(answer: string, answerHash: string) {
  return hashSecurityValue(answer.toUpperCase()) === answerHash;
}
