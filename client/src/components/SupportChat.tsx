import { AIChatBox, type Message } from "@/components/AIChatBox";
import { trpc } from "@/lib/trpc";
import { LifeBuoy, MessageCircle, Sparkles } from "lucide-react";
import { useMemo } from "react";

const QUICK_REPLIES = [
  { key: "withdrawIssue", text: "Withdrawal issue" },
  { key: "depositIssue", text: "Deposit issue" },
  { key: "packageHelp", text: "Package help" },
  { key: "adWatchingHelp", text: "Ad watching help" },
] as const;

export function SupportChat({ t, onOpenTickets }: { t: (key: any) => string; onOpenTickets: () => void }) {
  const history = trpc.support.chatHistory.useQuery();
  const utils = trpc.useUtils();
  const ask = trpc.support.ask.useMutation({
    onSuccess: () => utils.support.chatHistory.invalidate(),
  });
  const messages = useMemo<Message[]>(() => (history.data ?? []).map(message => ({
    role: message.role === "admin" ? "assistant" : message.role,
    content: message.content,
  })), [history.data]);
  const askQuestion = (message: string) => {
    if (!ask.isPending && message.trim()) ask.mutate({ message });
  };
  return (
    <section className="mx-auto max-w-4xl">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="eyebrow flex items-center gap-2"><LifeBuoy className="size-4 text-red-300" />{t("support")}</p>
          <h1 className="mt-1 text-3xl font-black tracking-tight">{t("aiSupportTitle")}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">{t("aiSupportSubtitle")}</p>
        </div>
        <button type="button" onClick={onOpenTickets} className="inline-flex items-center gap-2 rounded-xl border border-red-300/25 bg-white/5 px-3 py-2 text-xs font-bold text-red-100 hover:bg-red-400/10"><MessageCircle className="size-4" />{t("openSupportTicket")}</button>
      </div>
      <div className="mb-3 flex flex-wrap gap-2">
        {QUICK_REPLIES.map(reply => <button type="button" key={reply.key} onClick={() => askQuestion(t(reply.key))} disabled={ask.isPending} className="rounded-full border border-red-300/25 bg-red-600/15 px-3 py-2 text-xs font-bold text-red-100 transition hover:bg-red-600/30 disabled:opacity-50">{t(reply.key)}</button>)}
      </div>
      <AIChatBox
        messages={messages}
        onSendMessage={askQuestion}
        isLoading={ask.isPending || history.isLoading}
        placeholder={t("aiSupportPlaceholder")}
        emptyStateMessage={t("aiSupportWelcome")}
        suggestedPrompts={[]}
        height="min(68vh, 620px)"
        className="border-red-500/20 bg-[#160b0d] shadow-2xl shadow-red-950/30 [&_form]:border-red-500/20 [&_form]:bg-black/20 [&_button]:bg-red-600 [&_button]:text-white [&_textarea]:border-red-500/20"
      />
      <p className="mt-3 flex items-center justify-center gap-2 text-center text-[11px] text-slate-500"><Sparkles className="size-3" />{t("aiSupportNote")}</p>
    </section>
  );
}
