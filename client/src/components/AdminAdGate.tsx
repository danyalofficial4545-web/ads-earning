import { trpc } from "@/lib/trpc";
import { type TranslationKey } from "@/lib/i18n";
import { Loader2, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export type AutomaticAdRequest = {
  id: number;
  placement:
    | "signup"
    | "whatsapp_reward"
    | "package_entry"
    | "withdrawal_entry"
    | "rewarded_break";
  sequence?: number;
  onComplete: () => void;
};

export function AdminAdGate({
  request,
  t,
  onFinished,
}: {
  request: AutomaticAdRequest | null;
  t: (key: TranslationKey) => string;
  onFinished: () => void;
}) {
  const [impressionId, setImpressionId] = useState<number | null>(null);
  const [seconds, setSeconds] = useState(5);
  const complete = trpc.earning.completeAdminAd.useMutation({
    onSuccess: () => {
      request?.onComplete();
      onFinished();
    },
    onError: () => toast.error(t("operationFailed")),
  });
  const start = trpc.earning.startAdminAd.useMutation({
    onSuccess: result => {
      if (!result.show) {
        request?.onComplete();
        onFinished();
        return;
      }
      setImpressionId(result.impressionId ?? null);
      setSeconds(5);
    },
    onError: () => toast.error(t("operationFailed")),
  });

  useEffect(() => {
    setImpressionId(null);
    if (!request) return;
    start.mutate({
      placement: request.placement,
      sequence: request.sequence ?? 0,
    });
  }, [request?.id]);

  useEffect(() => {
    if (!impressionId || seconds <= 0) return;
    const timer = window.setInterval(
      () => setSeconds(current => Math.max(0, current - 1)),
      1000
    );
    return () => window.clearInterval(timer);
  }, [impressionId, seconds]);

  if (!request || (!impressionId && !start.isPending)) return null;
  return (
    <div
      className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/90 p-5 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sponsored-continuation-title"
    >
      <div className="w-full max-w-sm rounded-3xl border border-amber-300/30 bg-[#14322b] p-7 text-center shadow-2xl shadow-black/50">
        <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-amber-300/15 text-amber-300">
          <ShieldCheck className="size-7" />
        </div>
        <p className="eyebrow mt-5">{t("sponsoredContinuation")}</p>
        <h2 id="sponsored-continuation-title" className="mt-2 text-2xl font-bold">
          {t("sponsoredAdLoading")}
        </h2>
        <p className="mt-3 text-sm leading-6 text-slate-300">
          {t("sponsoredContinuationText")}
        </p>
        {start.isPending ? (
          <Loader2 className="mx-auto mt-7 size-6 animate-spin text-amber-300" />
        ) : (
          <>
            <p className="mt-6 text-4xl font-bold text-amber-300">
              {seconds > 0 ? `${seconds}s` : t("sponsoredReady")}
            </p>
            <button
              disabled={seconds > 0 || complete.isPending}
              onClick={() => impressionId && complete.mutate({ impressionId })}
              className="mt-6 h-11 w-full rounded-xl bg-amber-300 text-sm font-bold text-slate-950 transition active:scale-[.97] disabled:cursor-not-allowed disabled:opacity-45"
            >
              {complete.isPending ? <Loader2 className="mx-auto size-4 animate-spin" /> : t("continue")}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
