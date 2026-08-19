import { afterEach, describe, expect, it, vi } from "vitest";
import { sendTelegramAlert } from "./telegram";

describe("sendTelegramAlert", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("posts a server-only message to the configured Telegram recipient", async () => {
    vi.stubEnv("BOT_TOKEN", "test-bot-token");
    vi.stubEnv("CHAT_ID", "12345");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(sendTelegramAlert("New request")).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.telegram.org/bottest-bot-token/sendMessage",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ chat_id: "12345", text: "New request" }),
      })
    );
  });

  it("fails safely when Telegram is unavailable so member actions can continue", async () => {
    vi.stubEnv("BOT_TOKEN", "test-bot-token");
    vi.stubEnv("CHAT_ID", "12345");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    await expect(sendTelegramAlert("New request")).resolves.toBe(false);
  });
});
