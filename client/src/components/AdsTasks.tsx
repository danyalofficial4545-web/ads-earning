import { trpc } from "@/lib/trpc";
import { shouldAutoClaimAd } from "@/lib/adTimer";
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
  if (ad.contentType === "image") return <img src={mediaSource} alt={ad.title} className="mt-3 aspect-video w-full rounded-xl object-cover" />;
  if (ad.contentType === "video") return <video controls src={mediaSource} className="mt-3 aspect-video w-full rounded-xl bg-slate-950/40" />;
  return <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-300">{ad.content}</p>;
}

export function AdsTasks({ t, onDone }: { t: (key: any) => string; onDone: () => void }) {
  const ads = trpc.earning.ads.useQuery();
  const [session, setSession] = useState<any>(null);
  const [seconds, setSeconds] = useState(0);
  const [resetSeconds, setResetSeconds] = useState(0);
  const [autoClaimAttempted, setAutoClaimAttempted] = useState(false);
  const start = trpc.earning.startAd.useMutation({ onSuccess: data => { setSession(data); setSeconds(data.timerSeconds); setAutoClaimAttempted(false); }, onError: error => toast.error(error.message) });
  const claim = trpc.earning.claimAd.useMutation({ onSuccess: () => { toast.success(t("saved")); setSession(null); setAutoClaimAttempted(false); ads.refetch(); onDone(); }, onError: error => { toast.error(error.message); setAutoClaimAttempted(true); } });

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
  return <><div className="mb-6 flex flex-wrap items-end justify-between gap-4"><div><p className="eyebrow">{t("earn")}</p><h1 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">{t("earnTitle")}</h1><p className="mt-2 text-sm leading-6 text-slate-300">{t("earnSubtitle")}</p></div><div className="rounded-2xl border border-amber-300/20 bg-amber-300/10 px-4 py-3"><p className="flex items-center gap-2 text-xs font-bold text-amber-100"><Clock3 className="size-4" />{t("resetsIn")}: {formatCountdown(resetSeconds)}</p><p className="mt-1 text-[11px] text-amber-100/70">{t("adsResetDaily")}</p></div></div>
    {!ads.data.activePackage && <div className="mb-5 rounded-2xl border border-amber-300/15 bg-amber-300/10 p-4 text-sm leading-6 text-amber-100">{t("noActive")}</div>}
    {ads.data.ads.length ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{ads.data.ads.map((ad: any, index: number) => { const locked = ad.state === "locked"; const watched = ad.state === "watched"; const active = session?.ad?.id === ad.id; return <article key={ad.id} className={`panel relative overflow-hidden ${locked ? "opacity-70" : ""}`}><div className="flex items-start justify-between gap-3"><div><p className="eyebrow">{t(ad.contentType as any)} · #{index + 1}</p><h2 className="mt-1 text-lg font-bold">{ad.title}</h2></div>{locked ? <LockKeyhole className="size-5 text-slate-400" /> : watched ? <CheckCircle2 className="size-5 text-emerald-300" /> : active ? <Clock3 className="size-5 text-amber-300" /> : <Play className="size-5 text-amber-300" />}</div><AdVisual ad={ad}/><p className="mt-3 text-[11px] text-slate-500">{t("adsResetDaily")}</p><div className="mt-4">{locked ? <div className="flex h-10 items-center justify-center gap-2 rounded-xl border border-white/10 bg-slate-950/25 text-xs font-bold text-slate-400"><LockKeyhole className="size-3.5" />{t("lockedAd")}</div> : watched ? <div className="flex h-10 items-center justify-center gap-2 rounded-xl bg-emerald-400/15 text-xs font-bold text-emerald-200"><CheckCircle2 className="size-3.5" />{t("watched")}</div> : active ? <div className="rounded-xl border border-amber-300/30 bg-amber-300/10 p-3 text-center"><p className="text-xl font-bold text-amber-300">{seconds > 0 ? `Wait ${seconds}s…` : t("claimReward")}</p><p className="mt-1 text-[11px] leading-4 text-amber-100">{t("adWatchWarning")}</p>{seconds === 0 && <button disabled={claim.isPending} onClick={manuallyClaim} className="mt-3 h-9 rounded-lg bg-amber-300 px-3 text-xs font-bold text-slate-950 disabled:opacity-50">{t("claimReward")}</button>}</div> : <button disabled={Boolean(session) || start.isPending} onClick={() => begin(ad)} className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-amber-300 text-xs font-bold text-slate-950 disabled:opacity-50"><ExternalLink className="size-3.5" />{t("watchAd")}</button>}</div></article>; })}</div> : <div className="panel text-center text-sm text-slate-400">{t("noAds")}</div>}
  </>;
}
