import { trpc } from "@/lib/trpc";
import { shouldAutoClaimAd } from "@/lib/adTimer";
import { friendlyMessages } from "@/lib/formValidation";
import { UNAUTHED_ERR_MSG } from "@shared/const";
import { CheckCircle2, Clock3, Loader2, Play } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

function formatCountdown(totalSeconds: number) {
  const seconds = Math.max(0, totalSeconds);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${String(minutes).padStart(2, "0")}m ${String(seconds % 60).padStart(2, "0")}s`;
}

export function AdsTasks({
  t,
  onDone,
  language,
  onGoDeposit,
}: {
  t: (key: any) => string;
  onDone: () => void;
  language: "en" | "ur";
  onGoDeposit: () => void;
}) {
  const ads = trpc.earning.ads.useQuery();
  const [session, setSession] = useState<any>(null);
  const [seconds, setSeconds] = useState(0);
  const [autoClaimAttempted, setAutoClaimAttempted] = useState(false);
  const retryMessage = language === "ur"
    ? "براہِ کرم پورا 5 سیکنڈ کا اشتہار دیکھیں، پھر دوبارہ کوشش کریں۔"
    : "Please watch full ad, Please try again";
  const expiredSessionMessage = language === "ur"
    ? "آپ کا سائن اِن سیشن ختم ہو گیا ہے۔ براہِ کرم دوبارہ سائن اِن کریں۔"
    : "Your sign-in session has ended. Please sign in again.";
  const start = trpc.earning.startAd.useMutation({
    onSuccess: data => {
      setSession(data);
      setSeconds(data.timerSeconds);
      setAutoClaimAttempted(false);
      if (data.restarted) toast.error(retryMessage);
    },
    onError: error => {
      if (error.message === UNAUTHED_ERR_MSG) {
        toast.error(expiredSessionMessage);
        return;
      }
      toast.error(error.message || friendlyMessages.requestFailed);
    },
  });
  const claim = trpc.earning.claimAd.useMutation({
    onSuccess: data => {
      toast.success(t("saved"));
      setSession(null);
      setAutoClaimAttempted(false);
      ads.refetch();
      onDone();
    },
    onError: error => {
      toast.error(error.message === UNAUTHED_ERR_MSG ? expiredSessionMessage : error.message || friendlyMessages.requestFailed);
      setAutoClaimAttempted(true);
    },
  });

  useEffect(() => {
    const tick = () => {
      const resetAt = ads.data?.resetAt ? new Date(ads.data.resetAt).getTime() : Date.now();
      if (Math.max(0, Math.ceil((resetAt - Date.now()) / 1000)) === 0) ads.refetch();
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [ads.data?.resetAt]);

  useEffect(() => {
    if (!session) return;
    const tick = () => setSeconds(Math.max(0, Math.ceil((new Date(session.availableAt).getTime() - Date.now()) / 1000)));
    tick();
    const timer = window.setInterval(tick, 300);
    return () => window.clearInterval(timer);
  }, [session]);

  useEffect(() => {
    if (shouldAutoClaimAd({ hasSession: Boolean(session), secondsRemaining: seconds, autoClaimAttempted, claimPending: claim.isPending })) {
      setAutoClaimAttempted(true);
      claim.mutate({ sessionId: session.sessionId });
    }
  }, [session, seconds, autoClaimAttempted, claim.isPending]);

  if (ads.isLoading || !ads.data) return <div className="panel"><Loader2 className="size-5 animate-spin text-amber-300" /></div>;
  if (!ads.data.activePackage) return <div className="relative overflow-hidden rounded-2xl border border-amber-300/30 bg-slate-900/80 p-8 text-center"><div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(251,191,36,.16),transparent_60%)] blur-sm" /><div className="relative"><p className="eyebrow text-amber-300">{t("earn")}</p><h1 className="mt-2 text-2xl font-black text-white">Please Deposit &amp; Buy Package to Unlock Tasks</h1><p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-slate-300">Deposit funds into your Deposit Wallet, then activate a package to unlock verified daily earning tasks.</p><button type="button" onClick={onGoDeposit} className="mt-6 rounded-xl bg-amber-300 px-5 py-3 text-sm font-black text-slate-950 transition active:scale-[.97]">Deposit &amp; Buy Package</button></div></div>;
  return <>
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3"><div><p className="eyebrow">{t("earn")}</p><h1 className="mt-1 text-2xl font-bold tracking-tight md:text-3xl">{t("earnPageTitle")}</h1><p className="mt-1 text-xs leading-5 text-slate-300">{t("earnSubtitle")}</p></div><div className="rounded-xl border border-amber-300/20 bg-amber-300/10 px-3 py-2"><p className="flex items-center gap-1.5 text-[11px] font-bold text-amber-100"><Clock3 className="size-3.5" />{t("resetsIn")}: {formatCountdown(Math.max(0, Math.ceil((new Date(ads.data.resetAt).getTime() - Date.now()) / 1000)))}</p><p className="mt-0.5 text-[10px] text-amber-100/70">{t("adsResetDaily")}</p></div></div>
    <div className="grid grid-cols-2 gap-3">{ads.data.ads.map((ad: any) => { const watched = ad.state === "watched"; const active = session?.ad?.id === ad.id; return <article key={ad.id} className="panel flex h-[140px] flex-col overflow-hidden p-3"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="eyebrow text-[9px]">{t("rewardedAd")} · #{ad.id}</p><h2 className="mt-0.5 truncate text-sm font-bold">{`${ad.title} - ${ad.timerSeconds} Sec - ${t("reward")} ${ad.rewardPkr} PKR`}</h2></div>{watched ? <CheckCircle2 className="size-4 shrink-0 text-emerald-300" /> : active ? <Clock3 className="size-4 shrink-0 text-amber-300" /> : <Play className="size-4 shrink-0 text-amber-300" />}</div><p className="mt-4 line-clamp-2 text-[11px] leading-4 text-slate-300">{`${ad.timerSeconds} Sec · ${t("reward")} ${ad.rewardPkr} PKR`}</p><div className="mt-auto pt-2">{watched ? <div className="flex h-8 items-center justify-center gap-1 rounded-lg bg-emerald-400/15 text-[10px] font-bold text-emerald-200"><CheckCircle2 className="size-3" />{t("watched")}</div> : active ? <div className="rounded-lg border border-amber-300/30 bg-amber-300/10 px-2 py-1.5 text-center"><p className="text-sm font-bold text-amber-300">{seconds > 0 ? `Wait ${seconds}s…` : t("claimReward")}</p>{seconds === 0 && <button type="button" disabled={claim.isPending} onClick={() => claim.mutate({ sessionId: session.sessionId })} className="mt-1 h-7 rounded-md bg-amber-300 px-2 text-[10px] font-bold text-slate-950 disabled:opacity-50">{t("claimReward")}</button>}</div> : <button type="button" disabled={Boolean(session) || start.isPending} onClick={() => start.mutate({ slot: ad.id })} className="flex h-8 w-full items-center justify-center gap-1 rounded-lg bg-amber-300 text-[10px] font-bold text-slate-950 disabled:opacity-50"><Play className="size-3" />{t("watchAd")}</button>}</div></article>; })}</div>
  </>;
}
