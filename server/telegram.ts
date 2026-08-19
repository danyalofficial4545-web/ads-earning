const TELEGRAM_MESSAGE_LIMIT = 4_096;

/**
 * Delivers an administrator alert without allowing an unavailable third-party
 * service to interrupt a completed member action.
 */
export async function sendTelegramAlert(message: string): Promise<boolean> {
  const token = process.env.BOT_TOKEN;
  const chatId = process.env.CHAT_ID;

  if (!token || !chatId) {
    console.warn("[Telegram] Alert skipped because Telegram credentials are not configured.");
    return false;
  }

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: message.slice(0, TELEGRAM_MESSAGE_LIMIT),
        }),
        signal: AbortSignal.timeout(10_000),
      }
    );

    if (!response.ok) {
      console.error(`[Telegram] Alert delivery failed with status ${response.status}.`);
      return false;
    }

    const payload = (await response.json().catch(() => null)) as
      | { ok?: boolean }
      | null;
    return payload?.ok === true;
  } catch (error) {
    console.error("[Telegram] Alert delivery failed.", error);
    return false;
  }
}
