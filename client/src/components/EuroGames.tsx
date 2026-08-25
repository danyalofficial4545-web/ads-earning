import { trpc } from "@/lib/trpc";
import type { TranslationKey } from "@/lib/i18n";
import {
  ArrowDownLeft,
  ArrowUpRight,
  CircleDollarSign,
  Gamepad2,
  History,
  Landmark,
  Loader2,
  Plus,
  Plane,
  Rocket,
  Trophy,
  WalletCards,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

const quickAmounts = [16, 32, 64, 640, 1600, 3200, 20000];
const futureGames = ["Slots", "Mines", "Ludo Dice", "Plinko", "Wheel", "Crash", "Color", "Lucky Number"];

function pkr(amount: number) {
  return `PKR ${Math.max(0, amount ?? 0).toLocaleString()}`;
}

function readError(error: unknown) {
  return error instanceof Error ? error.message : "Please try again.";
}

function liveMultiplier(round: any, now: number) {
  if (!round) return 1;
  const startsAt = new Date(round.startsAt).getTime();
  const elapsed = Math.max(0, now - startsAt - 3000);
  return Math.max(1, Math.exp(elapsed / 7500));
}

function ExchangeDialog({
  mode,
  open,
  onClose,
  t,
  mainBalancePkr,
  gameBalancePkr,
  onDone,
}: any) {
  const [amount, setAmount] = useState("");
  const utils = trpc.useUtils();
  const fromMain = trpc.euro.exchangeFromMain.useMutation({
    onSuccess: async () => {
      toast.success(t("saved"));
      setAmount("");
      onClose();
      await onDone();
    },
    onError: error => toast.error(readError(error)),
  });
  const toMain = trpc.euro.exchangeToMain.useMutation({
    onSuccess: async () => {
      toast.success(t("saved"));
      setAmount("");
      onClose();
      await onDone();
    },
    onError: error => toast.error(readError(error)),
  });
  const mutation = mode === "to-game" ? fromMain : toMain;
  const available = mode === "to-game" ? mainBalancePkr : gameBalancePkr;
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/75 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-3xl border border-amber-300/20 bg-[#113129] p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="eyebrow">{mode === "to-game" ? t("exchangeToGame") : t("exchangeToMain")}</p>
            <h2 className="mt-1 text-xl font-bold">{t("transferAmount")}</h2>
          </div>
          <button onClick={onClose} className="grid size-9 place-items-center rounded-xl bg-white/5 text-slate-200"><X className="size-4" /></button>
        </div>
        <p className="mt-3 text-sm leading-6 text-slate-300">
          {mode === "to-game" ? t("transferToGameHint") : t("transferToMainHint")}
        </p>
        <p className="mt-3 text-sm font-bold text-amber-300">{t("balance")}: {pkr(available)}</p>
        <input
          className="field mt-4"
          type="number"
          min="1"
          step="1"
          inputMode="numeric"
          value={amount}
          onChange={event => setAmount(event.target.value)}
          placeholder="PKR"
        />
        <button
          disabled={mutation.isPending}
          onClick={() => mutation.mutate({ amountPkr: Number(amount) })}
          className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-amber-300 font-bold text-slate-950 disabled:opacity-60"
        >
          {mutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <ArrowUpRight className="size-4" />}
          {t("transfer")}
        </button>
      </div>
    </div>
  );
}

function AviatorBoard({ data, t, refresh }: any) {
  const [primaryBet, setPrimaryBet] = useState("16");
  const [secondBet, setSecondBet] = useState("");
  const [now, setNow] = useState(Date.now());
  const [showSecondBet, setShowSecondBet] = useState(false);
  const utils = trpc.useUtils();
  const state = trpc.euro.aviatorState.useQuery(undefined, {
    refetchInterval: data?.round?.status === "active" ? 750 : false,
  });
  const round = state.data?.round ?? data?.round;
  const bets = state.data?.bets ?? data?.activeBets ?? [];
  const multiplier = round?.status === "active" ? liveMultiplier(round, now) : (round?.crashMultiplierX100 ?? 100) / 100;
  const startsAt = round ? new Date(round.startsAt).getTime() : 0;
  const isPreflight = round?.status === "active" && now < startsAt + 3000;
  const isCrashed = round?.status === "crashed";
  const canStart = data?.settings?.aviatorEnabled && !round?.id;
  const start = trpc.euro.startAviator.useMutation({
    onSuccess: async () => {
      await Promise.all([utils.euro.bootstrap.invalidate(), utils.euro.aviatorState.invalidate()]);
    },
    onError: error => toast.error(readError(error)),
  });
  const cashOut = trpc.euro.cashOutAviator.useMutation({
    onSuccess: async result => {
      toast.success(`${t("cashOutAt")} ${(result.multiplierX100 / 100).toFixed(2)}x · ${pkr(result.payoutPkr)}`);
      await Promise.all([utils.euro.bootstrap.invalidate(), utils.euro.aviatorState.invalidate()]);
    },
    onError: error => toast.error(readError(error)),
  });

  useEffect(() => {
    if (round?.status !== "active") return;
    const interval = window.setInterval(() => {
      setNow(Date.now());
      if (Date.now() >= new Date(round.crashesAt).getTime()) void refresh();
    }, 120);
    return () => window.clearInterval(interval);
  }, [refresh, round?.crashesAt, round?.status]);

  const stakeValues = [Number(primaryBet), ...(showSecondBet ? [Number(secondBet)] : [])].filter(value => Number.isFinite(value) && value > 0);
  const maxX = Math.max(2, Math.min(100, isCrashed ? multiplier : multiplier + 0.8));
  const markerX = Math.min(94, Math.max(8, (Math.log(Math.max(1, multiplier)) / Math.log(maxX)) * 86 + 5));
  const markerY = Math.max(10, 86 - ((Math.log(Math.max(1, multiplier)) / Math.log(maxX)) * 72));

  return (
    <section className="panel overflow-hidden p-0">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/10 px-5 py-4">
        <div className="flex items-center gap-3"><div className="grid size-10 place-items-center rounded-xl bg-amber-300 text-slate-950"><Plane className="size-5" /></div><div><p className="eyebrow">{t("aviator")}</p><h2 className="mt-1 text-xl font-bold">{t("aviatorSubtitle")}</h2></div></div>
        <span className={`rounded-full px-3 py-1 text-xs font-bold ${isCrashed ? "bg-red-400/15 text-red-200" : round ? "bg-emerald-400/15 text-emerald-200" : "bg-white/10 text-slate-300"}`}>{isCrashed ? t("crashed") : isPreflight ? t("waitingForFlight") : round ? "LIVE" : "READY"}</span>
      </div>
      <div className="relative min-h-[290px] overflow-hidden bg-[radial-gradient(circle_at_65%_25%,rgba(251,191,36,.17),transparent_33%),linear-gradient(140deg,#08251f,#07130f)] p-5">
        <img src="/manus-storage/euro-aviator-reference_5642a3dd.png" alt="" className="pointer-events-none absolute inset-0 size-full object-cover opacity-[.07]" />
        <div className="relative flex h-[250px] flex-col items-center justify-center rounded-2xl border border-white/10 bg-slate-950/25">
          <div className="absolute inset-x-8 bottom-7 top-7 opacity-30 [background-image:linear-gradient(rgba(255,255,255,.14)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.14)_1px,transparent_1px)] [background-size:32px_32px]" />
          <svg className="absolute inset-8 size-[calc(100%-4rem)]" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path d="M5,88 C18,84 30,78 45,62 S73,34 95,12" fill="none" stroke="#fbbf24" strokeWidth="1.5" vectorEffect="non-scaling-stroke" /></svg>
          {round && <div className="absolute z-10 transition-all duration-100" style={{ left: `${markerX}%`, top: `${markerY}%` }}><Rocket className="size-8 -translate-x-1/2 -translate-y-1/2 rotate-[-32deg] text-amber-300 drop-shadow-[0_0_16px_rgba(251,191,36,.8)]" /></div>}
          <p className="relative text-6xl font-black tracking-tighter text-white md:text-7xl">{multiplier.toFixed(2)}<span className="text-amber-300">x</span></p>
          <p className="relative mt-2 text-xs font-bold uppercase tracking-[.2em] text-slate-400">{isCrashed ? t("crashed") : isPreflight ? t("waitingForFlight") : round ? t("cashOut") : t("placeBet")}</p>
        </div>
      </div>
      <div className="grid gap-4 p-5 md:grid-cols-2">
        {[0, 1].map(index => {
          const enabled = index === 0 || showSecondBet;
          const value = index === 0 ? primaryBet : secondBet;
          const setValue = index === 0 ? setPrimaryBet : setSecondBet;
          const activeBet = bets[index];
          return (
            <div key={index} className={`rounded-2xl border p-4 ${enabled ? "border-white/10 bg-slate-950/25" : "border-dashed border-white/10 bg-white/[.02] opacity-80"}`}>
              <div className="mb-3 flex items-center justify-between gap-3"><p className="text-sm font-bold">{t("betAmount")} {index + 1}</p>{index === 1 && <button onClick={() => { setShowSecondBet(!showSecondBet); setSecondBet(""); }} className="text-xs font-bold text-amber-300">{showSecondBet ? t("removeSecondBet") : t("addSecondBet")}</button>}</div>
              {enabled ? <><input className="field" type="number" min={data.settings.minimumBetPkr} max={data.settings.maximumBetPkr} value={value} onChange={event => setValue(event.target.value)} disabled={Boolean(round?.id)} />
              <div className="mt-3 flex flex-wrap gap-2">{quickAmounts.map(amount => <button key={amount} disabled={Boolean(round?.id)} onClick={() => setValue(String(amount))} className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-bold text-slate-200 disabled:opacity-40">{amount}</button>)}</div>
              {activeBet?.status === "active" && round?.status === "active" ? <button disabled={cashOut.isPending || isPreflight} onClick={() => cashOut.mutate({ betId: activeBet.id })} className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-400 font-bold text-slate-950 disabled:opacity-50"><ArrowDownLeft className="size-4" />{t("cashOut")} · {(Number(activeBet.stakePkr) * multiplier).toFixed(0)} PKR</button> : index === 0 ? <button disabled={!canStart || start.isPending || stakeValues.length === 0} onClick={() => start.mutate({ stakesPkr: stakeValues })} className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-amber-300 font-bold text-slate-950 disabled:opacity-50">{start.isPending ? <Loader2 className="size-4 animate-spin" /> : <Plane className="size-4" />}{t("placeBet")}</button> : null}</> : <button onClick={() => setShowSecondBet(true)} className="grid h-[108px] w-full place-items-center rounded-xl border border-dashed border-white/10 text-sm font-bold text-amber-300"><Plus className="mr-2 inline size-4" />{t("addSecondBet")}</button>}
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function EuroGames({ t }: { t: (key: TranslationKey) => string }) {
  const utils = trpc.useUtils();
  const data = trpc.euro.bootstrap.useQuery();
  const [exchangeMode, setExchangeMode] = useState<"to-game" | "to-main" | null>(null);
  const claimBonus = trpc.euro.claimFirstVisitBonus.useMutation({
    onSuccess: async result => {
      if (result.bonusPkr) toast.success(`${t("claimBonus")}: ${pkr(result.bonusPkr)}`);
      await utils.euro.bootstrap.invalidate();
    },
    onError: error => toast.error(readError(error)),
  });
  const refresh = async () => {
    await Promise.all([utils.euro.bootstrap.invalidate(), utils.euro.aviatorState.invalidate(), utils.wallet.get.invalidate(), utils.platform.overview.invalidate()]);
  };

  useEffect(() => {
    if (data.data?.canClaimBonus && !claimBonus.isPending) claimBonus.mutate();
  }, [claimBonus, data.data?.canClaimBonus]);

  if (data.isLoading || !data.data) return <div className="panel"><Loader2 className="mx-auto size-6 animate-spin text-amber-300" /></div>;
  const euro = data.data;
  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4"><div><p className="eyebrow">€ {t("euro")}</p><h1 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">{t("euroTitle")}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">{t("euroSubtitle")}</p></div><div className="flex items-center gap-2 rounded-xl border border-amber-300/20 bg-amber-300/10 px-3 py-2 text-sm font-bold text-amber-100"><Trophy className="size-4 text-amber-300" />{t("dailyGameProfit")}: {pkr(euro.dailyProfitPkr)} / {pkr(euro.dailyProfitLimitPkr)}</div></div>
      <section className="mb-5 grid gap-4 lg:grid-cols-[1.15fr_.85fr]">
        <div className="relative overflow-hidden rounded-3xl border border-amber-300/20 bg-[linear-gradient(120deg,#143c31,#0b1c18)] p-5 shadow-xl"><div className="absolute -right-8 -top-8 size-40 rounded-full bg-amber-300/10 blur-3xl" /><div className="relative flex flex-wrap items-center justify-between gap-4"><div className="flex items-center gap-3"><div className="grid size-12 place-items-center rounded-2xl bg-amber-300 text-slate-950"><Gamepad2 className="size-6" /></div><div><p className="text-sm font-bold text-amber-200">{t("gameWallet")}</p><p className="mt-1 text-3xl font-black">{pkr(euro.gameBalancePkr)}</p></div></div><button onClick={() => setExchangeMode("to-game")} className="grid size-11 place-items-center rounded-2xl border border-amber-300/30 bg-amber-300/15 text-amber-200"><Plus className="size-5" /></button></div><div className="relative mt-5 grid gap-2 sm:grid-cols-2"><button onClick={() => setExchangeMode("to-main")} className="flex h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 text-sm font-bold"><Landmark className="size-4" />{t("exchangeToMain")}</button><button onClick={() => setExchangeMode("to-game")} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-amber-300 text-sm font-bold text-slate-950"><WalletCards className="size-4" />{t("exchangeToGame")}</button></div></div>
        <div className="panel flex flex-col justify-between"><div><p className="eyebrow">{t("mainWallet")}</p><p className="mt-2 text-3xl font-black">{pkr(euro.mainBalancePkr)}</p><p className="mt-3 text-sm leading-6 text-slate-400">{euro.canExchangeToMain ? t("transferToMainHint") : t("euroPackageRequired")}</p></div><button onClick={() => setExchangeMode("to-game")} className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-amber-300/30 bg-amber-300/10 text-sm font-bold text-amber-200"><CircleDollarSign className="size-4" />{t("addToGameWallet")}</button></div>
      </section>
      {euro.gameBalancePkr === 0 && <section className="mb-5 rounded-3xl border border-dashed border-amber-300/40 bg-amber-300/[.04] px-5 py-10 text-center"><Gamepad2 className="mx-auto size-8 text-amber-300" /><p className="mx-auto mt-4 max-w-md text-sm font-semibold leading-6 text-amber-50">{t("gameWalletEmpty")}</p><button onClick={() => setExchangeMode("to-game")} className="mx-auto mt-5 grid size-12 place-items-center rounded-2xl bg-amber-300 text-slate-950"><Plus className="size-6" /></button></section>}
      <AviatorBoard data={euro} t={t} refresh={refresh} />
      <section className="mt-5 grid gap-5 xl:grid-cols-[1.1fr_.9fr]"><div className="panel"><div className="flex items-center justify-between"><div><p className="eyebrow">{t("gameTasks")}</p><h2 className="mt-1 text-xl font-bold">{t("gameTasks")}</h2></div><Gamepad2 className="size-5 text-amber-300" /></div>{euro.tasks.length ? <div className="mt-4 grid gap-3 sm:grid-cols-2">{euro.tasks.map((task: any) => <a key={task.id} href={task.targetUrl} target="_blank" rel="noreferrer" className="rounded-2xl border border-white/10 bg-slate-950/20 p-3 transition hover:border-amber-300/30"><div className="flex items-center gap-3">{task.imageData ? <img src={task.imageData} alt="" className="size-10 rounded-xl object-cover" /> : <div className="grid size-10 place-items-center rounded-xl bg-amber-300/10 text-amber-300"><Gamepad2 className="size-4" /></div>}<div className="min-w-0"><p className="truncate text-sm font-bold">{task.title}</p><p className="mt-1 text-xs text-amber-300">{pkr(task.rewardPkr)}</p></div></div></a>)}</div> : <p className="mt-5 text-sm text-slate-400">{t("noGameTasks")}</p>}</div><div className="panel"><div className="flex items-center gap-3"><div className="grid size-10 place-items-center rounded-xl bg-white/5"><History className="size-5 text-amber-300" /></div><div><p className="eyebrow">{t("gameWalletHistory")}</p><h2 className="mt-1 text-xl font-bold">{t("transactions")}</h2></div></div><div className="mt-4 divide-y divide-white/10">{euro.recent.length ? euro.recent.map((row: any) => <div key={row.id} className="flex items-center justify-between gap-4 py-3"><div><p className="text-sm font-bold">{row.note}</p><p className="mt-1 text-xs text-slate-500">{new Date(row.createdAt).toLocaleString()}</p></div><p className={`text-sm font-black ${row.direction === "credit" ? "text-emerald-300" : "text-red-300"}`}>{row.direction === "credit" ? "+" : "−"}{pkr(row.amountPkr)}</p></div>) : <p className="py-5 text-sm text-slate-400">{t("noTransactions")}</p>}</div></div></section>
      <section className="mt-5"><p className="eyebrow">{t("euro")}</p><div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">{futureGames.map(game => <div key={game} className="rounded-2xl border border-white/10 bg-white/[.03] p-4 text-center"><Gamepad2 className="mx-auto size-5 text-slate-500" /><p className="mt-2 text-sm font-bold text-slate-300">{game}</p><p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">Next</p></div>)}</div></section>
      <ExchangeDialog mode={exchangeMode ?? "to-game"} open={Boolean(exchangeMode)} onClose={() => setExchangeMode(null)} t={t} mainBalancePkr={euro.mainBalancePkr} gameBalancePkr={euro.gameBalancePkr} onDone={refresh} />
    </>
  );
}
