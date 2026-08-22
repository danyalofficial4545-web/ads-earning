import { startLogin } from "@/const";
import { LanguageToggle } from "@/components/LanguageToggle";
import { BrandLogo } from "@/components/BrandLogo";
import { trpc } from "@/lib/trpc";
import { getDeviceMarker } from "@/lib/deviceMarker";
import { resolvePublicBranding } from "@/lib/publicBranding";
import type { Language, TranslationKey } from "@/lib/i18n";
import { HUMAN_IMAGE_OPTIONS } from "../../../shared/humanVerification";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type Translate = (key: TranslationKey) => string;

function Brand({ src, name }: { src?: string | null; name?: string | null }) {
  return <BrandLogo src={src} name={name} className="size-12" />;
}

function GoogleMark({ compact = false }: { compact?: boolean }) {
  return (
    <svg
      aria-label="Google"
      role="img"
      viewBox="0 0 24 24"
      className={compact ? "size-5" : "size-12"}
    >
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.4c-.23 1.25-.93 2.31-1.98 3.03l3.2 2.48C20.48 17.89 21.6 15.16 21.6 12c0-.82-.07-1.61-.2-2.35H12z"
      />
      <path
        fill="#4285F4"
        d="M12 22c2.9 0 5.33-.96 7.1-2.61l-3.2-2.48c-.89.6-2.03.95-3.9.95-2.99 0-5.52-2.02-6.42-4.73l-3.31 2.55C3.98 19.07 7.7 22 12 22z"
      />
      <path
        fill="#FBBC05"
        d="M5.58 13.13A5.99 5.99 0 0 1 5.22 11c0-.74.13-1.45.36-2.13L2.27 6.32A10 10 0 0 0 1.2 11c0 1.69.4 3.29 1.07 4.68l3.31-2.55z"
      />
      <path
        fill="#34A853"
        d="M12 4.14c1.58 0 3 .54 4.12 1.61l3.09-3.09C17.32.91 14.89 0 12 0 7.7 0 3.98 2.93 2.27 6.32l3.31 2.55C6.48 6.16 9.01 4.14 12 4.14z"
      />
    </svg>
  );
}

function HumanCheck({ t, prompt, answer, onAnswer, onRefresh }: { t: Translate; prompt?: string; answer: string; onAnswer: (value: string) => void; onRefresh: () => void }) {
  return <div className="rounded-xl border border-emerald-300/20 bg-emerald-300/10 p-3"><div className="flex items-center justify-between gap-3"><p className="text-xs font-bold text-emerald-100">{t("humanVerification")}</p><button type="button" onClick={onRefresh} className="text-xs font-bold text-amber-300">{t("refreshCheck")}</button></div><p className="mt-2 text-sm font-semibold text-white">{prompt ?? t("loading")}</p><div className="mt-3 grid grid-cols-4 gap-2">{HUMAN_IMAGE_OPTIONS.map(option => <button key={option.id} type="button" aria-label={option.label} aria-pressed={answer === option.id} onClick={() => onAnswer(option.id)} className={`rounded-xl border p-2 text-center transition ${answer === option.id ? "border-amber-300 bg-amber-300/20 ring-1 ring-amber-300" : "border-white/10 bg-slate-950/20 hover:border-emerald-200/60"}`}><span className="block text-2xl" aria-hidden="true">{option.emoji}</span><span className="mt-1 block text-[10px] font-bold text-slate-200">{option.label}</span></button>)}</div></div>;
}

export function PublicAuth({
  language,
  setLanguage,
  t,
}: {
  language: Language;
  setLanguage: (language: Language) => void;
  t: Translate;
}) {
  const [signIn, setSignIn] = useState({ email: "", password: "" });
  const [challengeAnswer, setChallengeAnswer] = useState("");
  const [deviceId] = useState(() => getDeviceMarker());
  const branding = trpc.platform.publicData.useQuery();
  const brandSettings = resolvePublicBranding(branding.data?.branding);
  const utils = trpc.useUtils();
  const captcha = trpc.auth.captcha.useQuery(
    { purpose: "sign_in", deviceId },
    { staleTime: 0, refetchOnWindowFocus: false }
  );
  const complete = async (message: string) => {
    toast.success(message);
    await utils.auth.me.invalidate();
    await utils.account.bootstrap.invalidate();
  };
  const login = trpc.auth.signIn.useMutation({
    onSuccess: () => complete(t("signedIn")),
    onError: error => {
      toast.error(error.message);
      setChallengeAnswer("");
      captcha.refetch();
    },
  });
  const busy = login.isPending;
  const submitSignIn = (event: React.FormEvent) => {
    event.preventDefault();
    if (!captcha.data || !challengeAnswer.trim())
      return toast.error(t("verificationRequired"));
    login.mutate({
      ...signIn,
      challengeId: captcha.data.id,
      challengeAnswer,
      deviceId,
    });
  };

  return (
    <div
      className="pep-page min-h-screen bg-[#102621] p-4 text-white"
      data-pep-theme={brandSettings.themeName}
      dir={language === "ur" ? "rtl" : "ltr"}
    >
      <div className="mx-auto flex max-w-4xl items-center justify-between py-3 sm:py-6">
        <div className="flex items-center gap-3">
          <Brand src={brandSettings.logoUrl} name={brandSettings.websiteName} />
          <span className="text-base font-bold">{brandSettings.websiteName}</span>
        </div>
        <LanguageToggle language={language} onChange={setLanguage} />
      </div>
      <main className="mx-auto grid max-w-4xl overflow-hidden rounded-3xl border border-white/10 bg-[#17342d]/90 shadow-2xl shadow-black/25 md:grid-cols-[1fr_.62fr]">
        <section className="p-5 sm:p-8">
          <p className="eyebrow">{t("signIn")}</p>
          <form className="mt-6 space-y-4" onSubmit={submitSignIn}>
              <label>
                <span className="field-label">{t("email")}</span>
                <input
                  required
                  type="email"
                  autoComplete="email"
                  className="field"
                  value={signIn.email}
                  onChange={event =>
                    setSignIn({ ...signIn, email: event.target.value })
                  }
                />
              </label>
              <label>
                <span className="field-label">{t("password")}</span>
                <input
                  required
                  type="password"
                  autoComplete="current-password"
                  className="field"
                  value={signIn.password}
                  onChange={event =>
                    setSignIn({ ...signIn, password: event.target.value })
                  }
                />
              </label>
              <HumanCheck t={t} prompt={captcha.data?.prompt} answer={challengeAnswer} onAnswer={setChallengeAnswer} onRefresh={() => { setChallengeAnswer(""); captcha.refetch(); }} />
              <button
                disabled={busy}
                className="flex h-11 w-full items-center justify-center rounded-xl bg-amber-300 text-sm font-bold text-slate-950 disabled:opacity-60"
              >
                {busy ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  t("signIn")
                )}
              </button>
          </form>
        </section>
        <aside className="flex flex-col items-center justify-center border-t border-white/10 bg-slate-950/20 p-7 text-center md:border-l md:border-t-0">
          <GoogleMark />
          <p className="mt-5 text-sm font-bold text-white">
            {t("googleContinue")}
          </p>
          <p className="mt-2 max-w-xs text-xs leading-5 text-slate-400">
            {t("googleAccountHelp")}
          </p>
          <button
            onClick={startLogin}
            className="mt-6 flex h-11 w-full max-w-xs items-center justify-center gap-2 rounded-xl bg-white text-sm font-bold text-slate-800 transition active:scale-[.97]"
          >
            <GoogleMark compact />
            {t("googleContinue")}
          </button>
        </aside>
      </main>
    </div>
  );
}

export function GoogleOnboarding({
  language,
  t,
  profile,
  onDone,
}: {
  language: Language;
  t: Translate;
  profile: { username: string; preferredCurrency: "PKR" | "USD" };
  onDone: () => Promise<unknown>;
}) {
  const [username, setUsername] = useState(
    profile.username.startsWith("member") ? "" : profile.username
  );
  const [referralCode, setReferralCode] = useState(
    () => new URLSearchParams(window.location.search).get("ref") ?? ""
  );
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const saveProfile = trpc.account.saveProfile.useMutation();
  const setLocalPassword = trpc.auth.setPassword.useMutation();
  const busy = saveProfile.isPending || setLocalPassword.isPending;
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (password !== confirmPassword) return toast.error(t("passwordMismatch"));
    try {
      await saveProfile.mutateAsync({
        username,
        referralCode: referralCode || undefined,
        preferredCurrency: profile.preferredCurrency,
      });
      await setLocalPassword.mutateAsync({ password });
      toast.success(t("saved"));
      await onDone();
    } catch (error: any) {
      toast.error(error?.message ?? t("operationFailed"));
    }
  };
  return (
    <div
      className="grid min-h-screen place-items-center bg-[#102621] p-5 text-white"
      dir={language === "ur" ? "rtl" : "ltr"}
    >
      <div className="panel w-full max-w-md p-6 md:p-8">
        <div className="flex items-center gap-3">
          <Brand />
          <div>
            <p className="eyebrow">Ads Earning</p>
            <h1 className="mt-1 text-xl font-bold">{t("setupTitle")}</h1>
          </div>
        </div>
        <p className="mt-5 text-sm leading-6 text-slate-300">
          {t("setPasswordText")}
        </p>
        <form className="mt-6 space-y-4" onSubmit={submit}>
          <label>
            <span className="field-label">{t("username")}</span>
            <input
              required
              minLength={3}
              autoComplete="username"
              className="field"
              value={username}
              onChange={event => setUsername(event.target.value)}
            />
          </label>
          <label>
            <span className="field-label">{t("referralInvite")}</span>
            <input
              className="field"
              value={referralCode}
              onChange={event =>
                setReferralCode(event.target.value.toUpperCase())
              }
              placeholder="PEP…"
            />
          </label>
          <label>
            <span className="field-label">{t("password")}</span>
            <input
              required
              minLength={8}
              type="password"
              autoComplete="new-password"
              className="field"
              value={password}
              onChange={event => setPassword(event.target.value)}
            />
          </label>
          <label>
            <span className="field-label">{t("confirmPassword")}</span>
            <input
              required
              minLength={8}
              type="password"
              autoComplete="new-password"
              className="field"
              value={confirmPassword}
              onChange={event => setConfirmPassword(event.target.value)}
            />
          </label>
          <button
            disabled={busy}
            className="flex h-11 w-full items-center justify-center rounded-xl bg-amber-300 text-sm font-bold text-slate-950 disabled:opacity-60"
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              t("saveProfile")
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
