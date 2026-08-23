import { trpc } from "@/lib/trpc";
import { shouldAutoClaimAd } from "@/lib/adTimer";
import { friendlyMessages } from "@/lib/formValidation";
import { CheckCircle2, Clock3, ExternalLink, Loader2, LockKeyhole, Play } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

function formatCountdown(totalSeconds: number) {
  const seconds = Math.max(0, totalSeconds);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${String(minutes).padStart(2, "0")}m ${String(seconds % 60).padStart(2, "0")}s`;
}

function adDestination(ad: any) {
  return ad.targetUrl || (["link", "app", "video", "image"].includes(ad.contentType) ? ad.mediaData || ad.content : null);
}

function AdVisual({ ad }: { ad: any }) {
  const mediaSource = ad.mediaData || ad.content;
  if (ad.contentType === "image") return <img src={mediaSource} alt={ad.title} className="mt-2 h-12 w-full rounded-lg object-cover" />;
  if (ad.contentType === "video") return <video controls src={mediaSource} className="mt-2 h-12 w-full rounded-lg bg-slate-950/40 object-cover" />;
  return <p className="mt-1 line-clamp-1 text-[11px] leading-4 text-slate-300">{ad.content}</p>;
}

export function AdsTasks({ t, onDone }: { t: (key: any) => string; onDone: () => void }) {
  const ads = trpc.earning.ads.useQuery();
  const [session, setSession] = useState<any>(null);
  const [seconds, setSeconds] = useState(0);
  const [resetSeconds, setResetSeconds] = useState(0);
  const [autoClaimAttempted, setAutoClaimAttempted] = useState(false);
  const start = trpc.earning.startAd.useMutation({ onSuccess: data => { setSession(data); setSeconds(data.timerSeconds); setAutoClaimAttempted(false); }, onError: () => toast.error(friendlyMessages.requestFailed) });
  const claim = trpc.earning.claimAd.useMutation({ onSuccess: () => { toast.success(t("saved")); setSession(null); setAutoClaimAttempted(false); ads.refetch(); onDone(); }, onError: () => { toast.error(friendlyMessages.requestFailed); setAutoClaimAttempted(true); } });

  useEffect(() => {
    const tick = () => {
      const resetAt = ads.data?.resetAt ? new Date(ads.data.resetAt).getTime() : Date.now();
      const remaining = Math.max(0, Math.ceil((resetAt - Date.now()) / 1000));
      setResetSeconds(remaining);
      if (remaining === 0) ads.refetch();
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

  const manuallyClaim = () => {
    if (session && !claim.isPending) {
      setAutoClaimAttempted(true);
      claim.mutate({ sessionId: session.sessionId });
    }
  };

  const begin = (ad: any) => {
    const destination = adDestination(ad);
    if (destination) window.open(destination, "_blank", "noopener,noreferrer");
    start.mutate({ adId: ad.id });
  };

  if (ads.isLoading || !ads.data) return <div className="panel"><Loader2 className="size-5 animate-spin text-amber-300" /></div>;
  return <><div className="mb-4 flex flex-wrap items-end justify-between gap-3"><div><p className="eyebrow">{t("earn")}</p><h1 className="mt-1 text-2xl font-bold tracking-tight md:text-3xl">{t("earnTitle")}</h1><p className="mt-1 text-xs leading-5 text-slate-300">{t("earnSubtitle")}</p></div><div className="rounded-xl border border-amber-300/20 bg-amber-300/10 px-3 py-2"><p className="flex items-center gap-1.5 text-[11px] font-bold text-amber-100"><Clock3 className="size-3.5" />{t("resetsIn")}: {formatCountdown(resetSeconds)}</p><p className="mt-0.5 text-[10px] text-amber-100/70">{t("adsResetDaily")}</p></div></div>
    {!ads.data.activePackage && <div className="mb-4 rounded-xl border border-amber-300/15 bg-amber-300/10 p-3 text-xs leading-5 text-amber-100">{t("noActive")}</div>}
    {ads.data.ads.length ? <div className="grid grid-cols-2 gap-3">{ads.data.ads.map((ad: any, index: number) => { const locked = ad.state === "locked"; const watched = ad.state === "watched"; const active = session?.ad?.id === ad.id; return <article key={ad.id} className={`panel flex h-[140px] flex-col overflow-hidden p-3 ${locked ? "opacity-70" : ""}`}><div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="eyebrow text-[9px]">{t(ad.contentType as any)} · #{index + 1}</p><h2 className="mt-0.5 truncate text-sm font-bold">{ad.title}</h2></div>{locked ? <LockKeyhole className="size-4 shrink-0 text-slate-400" /> : watched ? <CheckCircle2 className="size-4 shrink-0 text-emerald-300" /> : active ? <Clock3 className="size-4 shrink-0 text-amber-300" /> : <Play className="size-4 shrink-0 text-amber-300" />}</div><AdVisual ad={ad}/><div className="mt-auto pt-2">{locked ? <div className="flex h-8 items-center justify-center gap-1 rounded-lg border border-white/10 bg-slate-950/25 text-[10px] font-bold text-slate-400"><LockKeyhole className="size-3" />{t("lockedAd")}</div> : watched ? <div className="flex h-8 items-center justify-center gap-1 rounded-lg bg-emerald-400/15 text-[10px] font-bold text-emerald-200"><CheckCircle2 className="size-3" />{t("watched")}</div> : active ? <div className="rounded-lg border border-amber-300/30 bg-amber-300/10 px-2 py-1.5 text-center"><p className="text-sm font-bold text-amber-300">{seconds > 0 ? `Wait ${seconds}s…` : t("claimReward")}</p>{seconds === 0 && <button disabled={claim.isPending} onClick={manuallyClaim} className="mt-1 h-7 rounded-md bg-amber-300 px-2 text-[10px] font-bold text-slate-950 disabled:opacity-50">{t("claimReward")}</button>}</div> : <button disabled={Boolean(session) || start.isPending} onClick={() => begin(ad)} className="flex h-8 w-full items-center justify-center gap-1 rounded-lg bg-amber-300 text-[10px] font-bold text-slate-950 disabled:opacity-50"><ExternalLink className="size-3" />{t("watchAd")}</button>}</div></article>; })}</div> : <div className="panel text-center text-sm text-slate-400">{t("noAds")}</div>}
  </>;
}
