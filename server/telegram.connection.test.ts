import { describe, expect, it } from "vitest";

describe.runIf(process.env.TELEGRAM_CONNECTION_TEST === "true")(
  "Telegram connection",
  () => {
  it(
    "sends the requested Bot Connected Successfully confirmation through configured server secrets",
    async () => {
      const token = process.env.BOT_TOKEN;
      const chatId = process.env.CHAT_ID;

      expect(token).toBeTruthy();
      expect(chatId).toBeTruthy();

      const response = await fetch(
        `https://api.telegram.org/bot${token}/sendMessage`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: "Bot Connected Successfully ✅",
          }),
        }
      );
      const payload = (await response.json()) as { ok?: boolean };

      expect(response.ok).toBe(true);
      expect(payload.ok).toBe(true);
    },
    15_000
  );
  }
);
