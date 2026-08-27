import { useAuth } from "@/_core/hooks/useAuth";
import { LanguageToggle } from "@/components/LanguageToggle";
import { startLogin } from "@/const";
import { AdminPanel } from "@/components/AdminPanel";
import { GoogleOnboarding, PublicAuth } from "@/components/PublicAuth";
import { WorkspaceAccessGate } from "@/components/WorkspaceAccessGate";
import { AdsTasks } from "@/components/AdsTasks";
import { SupportChat } from "@/components/SupportChat";
import { BrandLogo } from "@/components/BrandLogo";
import { trpc } from "@/lib/trpc";
import { resolveWorkspaceGate } from "@/lib/authOnboarding";
import { resolvePublicBranding } from "@/lib/publicBranding";
import { groupHistoryRows, historyDateLabel } from "@/lib/groupedHistory";
import { isMemberBottomNavigationId } from "@/lib/memberNavigation";
import { buildInviteSummary } from "@/lib/inviteSummary";
import {
  type FormErrors,
  friendlyMessages,
  friendlyServerError,
  firstWithdrawalFailure,
  isValidPakistanMobileNumber,
  validateDepositAmount,
  validateTransactionId,
} from "@/lib/formValidation";
import { FieldError } from "@/components/ui/field";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  dashboardMetricKeys,
  type DashboardMetricKey,
} from "@/lib/dashboardMetrics";
import { translate, type Language, type TranslationKey } from "@/lib/i18n";
import { toast } from "sonner";
import { useLocation } from "wouter";
import {
  ArrowDownToLine,
  ArrowUpRight,
  BadgeCheck,
  Bell,
  Boxes,
  CircleHelp,
  ClipboardList,
  Copy,
  CreditCard,
  Eye,
  EyeOff,
  Gem,
  Gift,
  History,
  Home as HomeIcon,
  Landmark,
  LayoutDashboard,
  Loader2,
  LogOut,
  MessageCircle,
  Menu,
  PackageCheck,
  PiggyBank,
  Play,
  Plus,
  Send,
  Settings2,
  ShieldCheck,
  Sparkles,
  Users,
  WalletCards,
  X,
} from "lucide-react";
import { type ReactNode, useEffect, useMemo, useState } from "react";

type Page =
  | "dashboard"
  | "packages"
  | "profile"
  | "deposit"
  | "withdrawal"
  | "earn"
  | "history"
  | "invite"
  | "support"
  | "ticketSupport"
  | "admin";

const nav: Array<{
  id: Page;
  icon: typeof LayoutDashboard;
  label: TranslationKey;
}> = [
  { id: "dashboard", icon: LayoutDashboard, label: "dashboard" },
  { id: "packages", icon: Boxes, label: "packages" },
  { id: "profile", icon: WalletCards, label: "profile" },
  { id: "invite", icon: Users, label: "invite" },
  { id: "earn", icon: Play, label: "earn" },
  { id: "history", icon: History, label: "history" },
  { id: "support", icon: CircleHelp, label: "support" },
];

const AUTHENTICATED_ADSTERRA_SCRIPTS = [
  "https://pl31018972.profitableratecpmnetwork.com/c3/93/94/c39394501da20cecb09000e829b5b01d.js",
  "https://pl31018973.profitableratecpmnetwork.com/b0/f7/85/b0f7854db95a963d43c8aa42ca3332f3.js",
] as const;

function loadAuthenticatedAdsterraScripts() {
  for (const source of AUTHENTICATED_ADSTERRA_SCRIPTS) {
    if (document.querySelector(`script[data-authenticated-adsterra="${source}"]`))
      continue;
    const script = document.createElement("script");
    script.async = true;
    script.src = source;
    script.dataset.authenticatedAdsterra = source;
    document.head.appendChild(script);
  }
}

const typeLabels: Record<string, TranslationKey> = {
  deposit: "deposit",
  package: "packages",
  ad_reward: "adRewardMessage",
  withdrawal: "withdrawal",
  referral_limit: "withdrawalLimit",
  adjustment: "settings",
};
const statusLabels: Record<string, TranslationKey> = {
  pending: "pending",
  approved: "approved",
  rejected: "rejected",
  completed: "completed",
  open: "open",
  in_review: "inReview",
  resolved: "resolved",
};

function money(amount: number, currency = "PKR") {
  return currency === "USD"
    ? `$${(amount / 280).toFixed(2)}`
    : `PKR ${amount.toLocaleString()}`;
}
function dateTime(value: Date | string) {
  return new Date(value).toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short",
  });
}
function statusClass(status: string) {
  return status === "approved" || status === "completed"
    ? "bg-emerald-400/15 text-emerald-300"
    : status === "rejected"
      ? "bg-red-400/15 text-red-300"
      : "bg-amber-300/15 text-amber-200";
}
function toDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function Home() {
  const { isAuthenticated, loading, logout, user, refresh } = useAuth();
  const [language, setLanguage] = useState<Language>(
    () => (localStorage.getItem("pep-language") as Language) || "en"
  );
  const [page, setPage] = useState<Page>("dashboard");
  const [location, navigate] = useLocation();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const t = (key: TranslationKey) => translate(language, key);
  const utils = trpc.useUtils();
  const session = trpc.account.bootstrap.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const publicData = trpc.platform.publicData.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const branding = resolvePublicBranding(publicData.data?.branding);
  const overview = trpc.platform.overview.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const announcements = trpc.platform.announcements.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const wallet = trpc.wallet.get.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  useEffect(() => {
    localStorage.setItem("pep-language", language);
    document.documentElement.lang = language === "ur" ? "ur" : "en";
    document.documentElement.dir = language === "ur" ? "rtl" : "ltr";
  }, [language]);
  useEffect(() => {
    if (location === "/admin" || location.startsWith("/admin/")) setPage("admin");
    else if (location === "/support") setPage("support");
  }, [location]);

  if (loading || (isAuthenticated && session.isLoading))
    return <LoadingScreen text={t("loading")} />;
  if (!isAuthenticated)
    return <PublicAuth language={language} setLanguage={setLanguage} t={t} />;
  if (session.error) return <LoadingScreen text={t("operationFailed")} />;
  if (!session.data?.profile) return <LoadingScreen text={t("loading")} />;
  const profile = session.data.profile;
  const workspaceGate = resolveWorkspaceGate(
    user?.hasPassword,
    profile.username
  );
  if (workspaceGate === "google-onboarding")
    return (
      <WorkspaceAccessGate
        hasPassword={user?.hasPassword}
        username={profile.username}
        onboarding={
          <GoogleOnboarding
            language={language}
            t={t}
            profile={profile}
            onDone={async () => {
              await utils.auth.me.invalidate();
              await utils.account.bootstrap.invalidate();
              await refresh();
            }}
          />
        }
        profileSetup={null}
        workspace={null}
      />
    );
  const isAdmin = session.data.isAdmin;
  const needsProfile = workspaceGate === "profile-setup";
  const selectPage = (next: Page) => {
    setPage(next);
    if (next === "admin" && !location.startsWith("/admin")) navigate("/admin");
    else if (next === "support" && location !== "/support") navigate("/support");
    else if (next !== "admin" && next !== "support" && (location.startsWith("/admin") || location === "/support")) navigate("/");
    setMobileNavOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const invalidateCore = () => {
    utils.platform.overview.invalidate();
    utils.wallet.get.invalidate();
    utils.account.bootstrap.invalidate();
    utils.wallet.transactions.invalidate();
  };

  return (
    <div
      className="pep-page min-h-screen bg-[#102621] text-white"
      data-pep-theme={branding.themeName}
      dir={language === "ur" ? "rtl" : "ltr"}
    >
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 right-[-6rem] size-[30rem] rounded-full bg-amber-300/10 blur-3xl" />
        <div className="absolute bottom-0 left-[-12rem] size-[30rem] rounded-full bg-emerald-400/10 blur-3xl" />
      </div>
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#102621]/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1600px] items-center justify-between gap-3 px-4 md:px-6">
          <button
            onClick={() => selectPage("dashboard")}
            className="flex min-w-0 items-center gap-2 text-left"
          >
            <BrandMark src={branding.logoUrl} name={branding.websiteName} />
            <div className="hidden sm:block">
              <p className="text-sm font-bold tracking-tight">{branding.websiteName}</p>
              <p className="text-[10px] text-amber-300">{t("tagline")}</p>
            </div>
          </button>
          <div className="flex items-center gap-2">
            <LanguageToggle language={language} onChange={setLanguage} />
            <button
              aria-label={t("profile")}
              onClick={() => selectPage("profile")}
              className="grid size-9 place-items-center rounded-xl border border-white/10 bg-white/5 text-slate-200"
            >
              <Settings2 className="size-4" />
            </button>
            <button
              aria-label="Open navigation"
              onClick={() => setMobileNavOpen(true)}
              className="grid size-9 place-items-center rounded-xl border border-white/10 bg-white/5 text-slate-200 lg:hidden"
            >
              <Menu className="size-4" />
            </button>
            <button
              onClick={() => selectPage("profile")}
              className="hidden items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-emerald-200 md:flex"
            >
              <WalletCards className="size-4" />
              {money(overview.data?.profile.balancePkr ?? 0)}
            </button>
          </div>
        </div>
      </header>
      <div className="relative mx-auto flex max-w-[1600px] gap-6 px-4 py-5 md:px-6">
        <aside className="hidden w-[235px] shrink-0 lg:block">
          <nav className="sticky top-24 panel p-3">
            {nav.map(item => (
              <NavButton
                key={item.id}
                item={item}
                active={page === item.id}
                onClick={() => selectPage(item.id)}
                label={t(item.label)}
              />
            ))}
            {isAdmin && (
              <NavButton
                item={{ id: "admin", icon: ShieldCheck, label: "admin" }}
                active={page === "admin"}
                onClick={() => selectPage("admin")}
                label={t("admin")}
              />
            )}
            <div className="my-3 border-t border-white/10" />
            <button
              onClick={() => logout()}
              className="nav-item w-full text-left text-red-200 hover:bg-red-400/10 hover:text-red-100"
            >
              <LogOut className="size-4" />
              {t("logout")}
            </button>
          </nav>
        </aside>
        <main className="min-w-0 flex-1 pb-24 lg:pb-8">
          <WorkspaceAccessGate
            hasPassword={user?.hasPassword}
            username={profile.username}
            onboarding={null}
            profileSetup={
              <ProfileSetup profile={profile} t={t} onDone={invalidateCore} />
            }
            workspace={
              <Workspace
                page={page}
                setPage={selectPage}
                t={t}
                language={language}
                user={user}
                isAdmin={isAdmin}
                profile={profile}
                overview={overview.data}
                overviewLoading={overview.isLoading}
                packages={publicData.data?.packages ?? []}
                settings={overview.data?.settings}
                announcements={announcements.data ?? []}
                wallet={wallet.data}
                invalidateCore={invalidateCore}
              />
            }
          />
        </main>
      </div>
      <MobileNavigation
        nav={nav}
        active={page}
        t={t}
        onSelect={selectPage}
        isAdmin={isAdmin}
      />
      {mobileNavOpen && (
        <MobileDrawer
          nav={nav}
          active={page}
          t={t}
          isAdmin={isAdmin}
          onSelect={selectPage}
          onClose={() => setMobileNavOpen(false)}
          onLogout={logout}
        />
      )}
    </div>
  );
}

function BrandMark({ src, name }: { src?: string | null; name?: string | null } = {}) {
  return <BrandLogo src={src} name={name} className="size-11" />;
}
function LoadingScreen({ text }: { text: string }) {
  return (
    <div className="grid min-h-screen place-items-center bg-[#102621]">
      <div className="flex flex-col items-center gap-4 text-slate-200">
        <BrandMark />
        <Loader2 className="size-5 animate-spin text-amber-300" />
        <p className="text-sm">{text}</p>
      </div>
    </div>
  );
}
function NavButton({
  item,
  active,
  onClick,
  label,
}: {
  item: { id?: string; icon: typeof LayoutDashboard; label?: TranslationKey };
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  const Icon = item.icon;
  return (
    <button
      onClick={onClick}
      className={`nav-item mb-1 w-full text-left ${active ? "nav-item-active" : ""}`}
    >
      <Icon className="size-4" />
      {label}
    </button>
  );
}

function Landing({
  language,
  setLanguage,
  t,
}: {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: TranslationKey) => string;
}) {
  const [mode, setMode] = useState<"signIn" | "signUp">("signIn");
  const [signIn, setSignIn] = useState({ email: "", password: "" });
  const [signUp, setSignUp] = useState(() => ({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
    referralCode: new URLSearchParams(window.location.search).get("ref") ?? "",
  }));
  const utils = trpc.useUtils();
  const complete = async (message: string) => {
    toast.success(message);
    await utils.auth.me.invalidate();
    await utils.account.bootstrap.invalidate();
  };
  const register = trpc.auth.register.useMutation({
    onSuccess: () => {
      void complete(t("accountCreated"));
    },
    onError: error => {
      toast.error(
        error.data?.code === "CONFLICT"
          ? `${error.message} ${t("duplicateRecovery")}`
          : error.message
      );
      if (error.data?.code === "CONFLICT")
        toast(t("googleAccountHelp"), {
          action: { label: t("googleContinue"), onClick: () => startLogin() },
        });
    },
  });
  const login = trpc.auth.signIn.useMutation({
    onSuccess: () => complete(t("signedIn")),
    onError: () => toast.error(friendlyMessages.requestFailed),
  });
  const submitSignUp = (event: React.FormEvent) => {
    event.preventDefault();
    if (signUp.password !== signUp.confirmPassword)
      return toast.error(t("passwordMismatch"));
    register.mutate({
      username: signUp.username,
      email: signUp.email,
      password: signUp.password,
      referralCode: signUp.referralCode || undefined,
    } as never);
  };
  const submitSignIn = (event: React.FormEvent) => {
    event.preventDefault();
    login.mutate(signIn as never);
  };
  const busy = register.isPending || login.isPending;
  return (
    <div
      className="min-h-screen overflow-hidden bg-[#102621] text-white"
      dir={language === "ur" ? "rtl" : "ltr"}
    >
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-36 left-[10%] size-[32rem] rounded-full bg-amber-300/10 blur-3xl" />
        <div className="absolute bottom-[-12rem] right-[4%] size-[35rem] rounded-full bg-emerald-400/10 blur-3xl" />
      </div>
      <header className="relative mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <div className="flex items-center gap-2">
          <BrandMark />
          <span className="text-sm font-bold">{t("brand")}</span>
        </div>
        <div className="flex items-center gap-3">
          <LanguageToggle language={language} onChange={setLanguage} />
          <div className="hidden rounded-xl border border-white/10 bg-white/5 p-1 sm:flex">
            <button
              onClick={() => setMode("signIn")}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold ${mode === "signIn" ? "bg-amber-300 text-slate-950" : "text-slate-300"}`}
            >
              {t("signIn")}
            </button>
            <button
              onClick={() => setMode("signUp")}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold ${mode === "signUp" ? "bg-amber-300 text-slate-950" : "text-slate-300"}`}
            >
              {t("signUp")}
            </button>
          </div>
        </div>
      </header>
      <main className="relative mx-auto grid max-w-6xl gap-12 px-5 pb-16 pt-14 lg:grid-cols-[1.05fr_.95fr] lg:items-center lg:pt-20">
        <section>
          <p className="eyebrow">{t("tagline")}</p>
          <h1 className="mt-4 max-w-2xl text-5xl font-bold leading-[1.03] tracking-tight md:text-7xl">
            {t("secureTitle")}
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-slate-300">
            {t("secureSubtitle")}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <button
              onClick={() => setMode("signUp")}
              className="inline-flex items-center gap-2 rounded-xl bg-amber-300 px-5 py-3 text-sm font-bold text-slate-950 transition active:scale-[.97]"
            >
              <Sparkles className="size-4" />
              {t("secureSignIn")}
            </button>
            <p className="max-w-xs self-center text-xs leading-5 text-slate-400">
              {t("authNote")}
            </p>
          </div>
          <div className="mt-10 grid gap-3 sm:grid-cols-3">
            {[
              [PackageCheck, "featureOne"],
              [BadgeCheck, "featureTwo"],
              [Users, "featureThree"],
            ].map(([Icon, key]) => {
              const FeatureIcon = Icon as typeof PackageCheck;
              return (
                <div className="glass rounded-2xl p-4" key={String(key)}>
                  <FeatureIcon className="size-5 text-amber-300" />
                  <p className="mt-3 text-sm font-semibold text-slate-100">
                    {t(key as TranslationKey)}
                  </p>
                </div>
              );
            })}
          </div>
        </section>
        <section className="panel relative overflow-hidden p-6 md:p-8">
          <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-amber-300/10 blur-2xl" />
          <div className="relative">
            <div className="flex rounded-xl border border-white/10 bg-slate-950/20 p-1">
              <button
                onClick={() => setMode("signIn")}
                className={`flex-1 rounded-lg py-2 text-sm font-bold ${mode === "signIn" ? "bg-amber-300 text-slate-950" : "text-slate-300"}`}
              >
                {t("signIn")}
              </button>
              <button
                onClick={() => setMode("signUp")}
                className={`flex-1 rounded-lg py-2 text-sm font-bold ${mode === "signUp" ? "bg-amber-300 text-slate-950" : "text-slate-300"}`}
              >
                {t("signUp")}
              </button>
            </div>
            {mode === "signIn" ? (
              <form className="mt-6 space-y-4" onSubmit={submitSignIn}>
                <p className="eyebrow">{t("signIn")}</p>
                <h2 className="text-2xl font-bold">{t("welcome")}</h2>
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
                <p className="text-center text-xs text-slate-400">
                  {t("needAccount")}{" "}
                  <button
                    type="button"
                    onClick={() => setMode("signUp")}
                    className="font-bold text-amber-300"
                  >
                    {t("switchToSignUp")}
                  </button>
                </p>
              </form>
            ) : (
              <form className="mt-6 space-y-3" onSubmit={submitSignUp}>
                <p className="eyebrow">{t("signUp")}</p>
                <h2 className="text-2xl font-bold">{t("createAccount")}</h2>
                <label>
                  <span className="field-label">{t("username")}</span>
                  <input
                    required
                    minLength={3}
                    autoComplete="username"
                    className="field"
                    value={signUp.username}
                    onChange={event =>
                      setSignUp({ ...signUp, username: event.target.value })
                    }
                  />
                </label>
                <label>
                  <span className="field-label">{t("email")}</span>
                  <input
                    required
                    type="email"
                    autoComplete="email"
                    className="field"
                    value={signUp.email}
                    onChange={event =>
                      setSignUp({ ...signUp, email: event.target.value })
                    }
                  />
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label>
                    <span className="field-label">{t("password")}</span>
                    <input
                      required
                      minLength={8}
                      type="password"
                      autoComplete="new-password"
                      className="field"
                      value={signUp.password}
                      onChange={event =>
                        setSignUp({ ...signUp, password: event.target.value })
                      }
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
                      value={signUp.confirmPassword}
                      onChange={event =>
                        setSignUp({
                          ...signUp,
                          confirmPassword: event.target.value,
                        })
                      }
                    />
                  </label>
                </div>
                <label>
                  <span className="field-label">{t("referralInvite")}</span>
                  <input
                    className="field"
                    value={signUp.referralCode}
                    onChange={event =>
                      setSignUp({
                        ...signUp,
                        referralCode: event.target.value.toUpperCase(),
                      })
                    }
                    placeholder="PEP…"
                  />
                </label>
                <button
                  disabled={busy}
                  className="flex h-11 w-full items-center justify-center rounded-xl bg-amber-300 text-sm font-bold text-slate-950 disabled:opacity-60"
                >
                  {busy ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    t("createAccount")
                  )}
                </button>
                <p className="text-center text-xs text-slate-400">
                  {t("alreadyHaveAccount")}{" "}
                  <button
                    type="button"
                    onClick={() => setMode("signIn")}
                    className="font-bold text-amber-300"
                  >
                    {t("switchToSignIn")}
                  </button>
                </p>
              </form>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

function GoogleEntry({
  language,
  t,
}: {
  language: Language;
  t: (key: TranslationKey) => string;
}) {
  return (
    <div
      dir={language === "ur" ? "rtl" : "ltr"}
      className="fixed inset-x-4 bottom-4 z-40 mx-auto max-w-sm rounded-2xl border border-white/15 bg-[#17342d]/95 p-3 shadow-2xl shadow-black/30 backdrop-blur-xl"
    >
      <p className="px-1 text-center text-xs leading-5 text-slate-300">
        {t("googleAccountHelp")}
      </p>
      <button
        onClick={() => startLogin()}
        className="mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-white text-sm font-bold text-slate-800 transition active:scale-[.97]"
      >
        <span className="grid size-5 place-items-center rounded-full bg-[#4285F4] text-[11px] font-black text-white">
          G
        </span>
        {t("googleContinue")}
      </button>
    </div>
  );
}

function PasswordSetup({
  language,
  t,
  onDone,
}: {
  language: Language;
  t: (key: TranslationKey) => string;
  onDone: () => Promise<unknown>;
}) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const setup = trpc.auth.setPassword.useMutation({
    onSuccess: async () => {
      toast.success(t("passwordSaved"));
      await onDone();
    },
    onError: () => toast.error(friendlyMessages.requestFailed),
  });
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (password !== confirmPassword) return toast.error(t("passwordMismatch"));
    setup.mutate({ password });
  };
  return (
    <div
      className="grid min-h-screen place-items-center bg-[#102621] p-5 text-white"
      dir={language === "ur" ? "rtl" : "ltr"}
    >
      <div className="panel w-full max-w-md p-6 md:p-8">
        <div className="flex items-center gap-3">
          <BrandMark />
          <div>
            <p className="eyebrow">Ads Earning</p>
            <h1 className="mt-1 text-xl font-bold">{t("setPasswordTitle")}</h1>
          </div>
        </div>
        <p className="mt-5 text-sm leading-6 text-slate-300">
          {t("setPasswordText")}
        </p>
        <form className="mt-6 space-y-4" onSubmit={submit}>
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
            disabled={setup.isPending}
            className="flex h-11 w-full items-center justify-center rounded-xl bg-amber-300 text-sm font-bold text-slate-950 disabled:opacity-60"
          >
            {setup.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              t("setPassword")
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof WalletCards;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/15 p-4">
      <Icon className="size-4 text-amber-300" />
      <p className="mt-4 text-xs text-slate-400">{label}</p>
      <p className="mt-1 text-lg font-bold">{value}</p>
    </div>
  );
}

function WhatsAppJoinPrompt({ t, onJoin, onClose, joining }: any) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/75 p-4 backdrop-blur-sm">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="whatsapp-join-title"
        className="relative w-full max-w-md overflow-hidden rounded-[2rem] border border-emerald-200/30 bg-[#133c31] p-6 shadow-2xl shadow-emerald-950/50"
      >
        <div className="pointer-events-none absolute -right-12 -top-12 size-44 rounded-full bg-emerald-300/20 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-16 -left-12 size-44 rounded-full bg-amber-300/15 blur-2xl" />
        <button
          type="button"
          onClick={onClose}
          aria-label={t("close")}
          className="absolute right-4 top-4 grid size-8 place-items-center rounded-full border border-white/10 bg-white/10 text-slate-100 transition hover:bg-white/15"
        >
          <X className="size-4" />
        </button>
        <div className="relative">
          <div className="grid size-16 place-items-center rounded-2xl bg-emerald-400 text-[#063524] shadow-lg shadow-emerald-950/30">
            <MessageCircle className="size-9" strokeWidth={2.4} />
          </div>
          <p className="mt-6 text-xs font-bold uppercase tracking-[0.18em] text-emerald-200">
            WhatsApp Channel
          </p>
          <h2 id="whatsapp-join-title" className="mt-2 text-2xl font-extrabold leading-8 text-white">
            {t("whatsappPromptTitle")}
          </h2>
          <p className="mt-3 text-sm leading-6 text-emerald-50/80">
            {t("whatsappPromptSubtitle")}
          </p>
          <div className="mt-6 flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-950/20 p-3 text-xs text-emerald-100/90">
            <BadgeCheck className="size-4 shrink-0 text-amber-300" />
            <span>{t("whatsappPromptBenefit")}</span>
          </div>
          <button
            type="button"
            disabled={joining}
            onClick={onJoin}
            className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 text-sm font-extrabold text-[#073524] transition hover:bg-[#47df7e] active:scale-[.97] disabled:opacity-60"
          >
            {joining ? <Loader2 className="size-4 animate-spin" /> : <MessageCircle className="size-4" />}
            {t("joinNow")}
          </button>
        </div>
      </section>
    </div>
  );
}
function ProfilePage({ t, user, profile, activePackage, totalEarnedPkr }: any) {
  const [showPassword, setShowPassword] = useState(false);
  const referral = trpc.referral.get.useQuery();
  return (
    <>
      <PageHeading
        eyebrow={t("profile")}
        title={t("profile")}
        description={t("profileEmail")}
      />
      <div className="grid gap-5 md:grid-cols-2">
        <div className="panel space-y-4">
          <div>
            <p className="field-label">{t("profileEmail")}</p>
            <p className="mt-1 font-semibold">{user?.email ?? "—"}</p>
          </div>
          <div>
            <p className="field-label">{t("profileUsername")}</p>
            <p className="mt-1 font-semibold">{profile.username}</p>
          </div>
          <div>
            <p className="field-label">{t("profilePassword")}</p>
            <div className="mt-1 flex items-center justify-between rounded-xl border border-white/10 bg-slate-950/20 px-3 py-2 text-sm">
              <span>{showPassword ? t("passwordSaved") : "••••••••"}</span>
              <button
                type="button"
                aria-label={
                  showPassword ? t("hidePassword") : t("showPassword")
                }
                onClick={() => setShowPassword(!showPassword)}
                className="text-amber-300"
              >
                {showPassword ? (
                  <EyeOff className="size-4" />
                ) : (
                  <Eye className="size-4" />
                )}
              </button>
            </div>
          </div>
        </div>
        <div className="panel space-y-4">
          <div>
            <p className="field-label">{t("activePackage")}</p>
            <p className="mt-1 font-semibold">
              {activePackage
                ? `${activePackage.icon} ${activePackage.name}`
                : t("noActivePackageProfile")}
            </p>
          </div>
          <div>
            <p className="field-label">{t("totalReferrals")}</p>
            <p className="mt-1 text-2xl font-bold">
              {referral.data?.totalReferrals ?? 0}
            </p>
          </div>
          <div>
            <p className="field-label">{t("totalEarnings")}</p>
            <p className="mt-1 text-2xl font-bold text-amber-300">
              {money(totalEarnedPkr)}
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

function ProfileSetup({
  profile,
  t,
  onDone,
}: {
  profile: { username: string; preferredCurrency: "PKR" | "USD" };
  t: (key: TranslationKey) => string;
  onDone: () => void;
}) {
  const [username, setUsername] = useState(
    profile.username.startsWith("member") ? "" : profile.username
  );
  const [referralCode, setReferralCode] = useState("");
  const [currency, setCurrency] = useState<"PKR" | "USD">(
    profile.preferredCurrency
  );
  const save = trpc.account.saveProfile.useMutation({
    onSuccess: () => {
      toast.success(t("saved"));
      onDone();
    },
    onError: () => toast.error(friendlyMessages.requestFailed),
  });
  return (
    <div className="mx-auto max-w-xl pt-8">
      <div className="panel">
        <div className="grid size-12 place-items-center rounded-2xl bg-amber-300 text-slate-950">
          <Settings2 className="size-5" />
        </div>
        <p className="eyebrow mt-6">Ads Earning</p>
        <h1 className="mt-2 text-3xl font-bold">{t("setupTitle")}</h1>
        <p className="mt-3 leading-6 text-slate-300">{t("setupText")}</p>
        <form
          className="mt-7 space-y-4"
          onSubmit={event => {
            event.preventDefault();
            save.mutate({
              username,
              referralCode: referralCode || undefined,
              preferredCurrency: currency,
            });
          }}
        >
          <label>
            <span className="field-label">{t("username")}</span>
            <input
              required
              value={username}
              onChange={e => setUsername(e.target.value)}
              className="field"
              placeholder="your_username"
            />
          </label>
          <label>
            <span className="field-label">{t("referralCode")}</span>
            <input
              value={referralCode}
              onChange={e => setReferralCode(e.target.value.toUpperCase())}
              className="field"
              placeholder="PEP…"
            />
          </label>
          <label>
            <span className="field-label">{t("preferredCurrency")}</span>
            <select
              value={currency}
              onChange={e => setCurrency(e.target.value as "PKR" | "USD")}
              className="field"
            >
              <option value="PKR">PKR</option>
              <option value="USD">USD</option>
            </select>
          </label>
          <button
            disabled={save.isPending}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-amber-300 text-sm font-bold text-slate-950 transition active:scale-[.97] disabled:opacity-60"
          >
            {save.isPending && <Loader2 className="size-4 animate-spin" />}
            {t("saveProfile")}
          </button>
        </form>
      </div>
    </div>
  );
}

function Workspace({
  page,
  setPage,
  t,
  language,
  user,
  isAdmin,
  profile,
  overview,
  overviewLoading,
  packages,
  settings,
  announcements,
  wallet,
  invalidateCore,
}: any) {
  const [depositPackageId, setDepositPackageId] = useState("");
  const [depositAmount, setDepositAmount] = useState("");
  const [showChannelPrompt, setShowChannelPrompt] = useState(false);
  const [rewardWithdrawalSubmittedLocally, setRewardWithdrawalSubmittedLocally] = useState(false);
  useEffect(() => {
    const loadTimer = window.setTimeout(loadAuthenticatedAdsterraScripts, 750);
    return () => window.clearTimeout(loadTimer);
  }, []);
  useEffect(() => {
    if (
      overview &&
      profile.whatsappRewardEligible &&
      !profile.whatsappJoined
    )
      setShowChannelPrompt(true);
  }, [overview, profile.whatsappRewardEligible, profile.whatsappJoined]);
  const joinWhatsApp = trpc.platform.joinWhatsApp.useMutation({
    onSuccess: data => {
      if (data.bonusPkr) {
        toast.success(t("whatsappRewardClaimed"));
        setPage("withdrawal");
        invalidateCore();
      } else {
        invalidateCore();
      }
      setShowChannelPrompt(false);
    },
    onError: () => toast.error(friendlyMessages.requestFailed),
  });
  const handleJoinWhatsApp = () => {
    window.open(
      "https://whatsapp.com/channel/0029VbDB4LpDZ4LhbhGZsJ10",
      "_blank",
      "noopener,noreferrer"
    );
    joinWhatsApp.mutate();
  };
  if (overviewLoading || !overview)
    return <LoadingScreen text={t("loading")} />;
  const memberProfile = overview.profile;
  const rewardWithdrawalRequested = Boolean(
    overview.rewardWithdrawalRequested || rewardWithdrawalSubmittedLocally
  );
  const showRewardWithdrawalPrompt = Boolean(
    memberProfile.whatsappRewardEligible &&
      memberProfile.whatsappBonusClaimed &&
      !rewardWithdrawalRequested
  );
  const hasPendingChannelReward =
    memberProfile.whatsappRewardEligible &&
    memberProfile.whatsappBonusClaimed &&
      !rewardWithdrawalRequested;
  const openWithdrawal = () => setPage("withdrawal");
  const purchasePackage = trpc.package.buy.useMutation({
    onSuccess: () => {
      toast.success(language === "ur" ? "پیکیج کامیابی سے فعال ہو گیا ہے۔" : "Package activated successfully.");
      invalidateCore();
      setPage("dashboard");
    },
    onError: error =>
      toast.error(friendlyServerError(error, "amount").amount || friendlyMessages.requestFailed),
  });
  const openPackagePayment = (packageId: number, requiredAmount: number) => {
    setDepositPackageId(String(packageId));
    setDepositAmount(String(requiredAmount));
    setPage("deposit");
  };
  const content: Record<Page, ReactNode> = {
    dashboard: (
      <Dashboard
        t={t}
        overview={overview}
        announcements={announcements}
        setPage={setPage}
        onRequestWithdrawal={openWithdrawal}
      />
    ),
    packages: (
      <Packages
        t={t}
        language={language}
        plans={packages}
        balance={profile.balancePkr}
        active={overview.activePackage}
        onDone={invalidateCore}
        onPurchase={(plan: any) => purchasePackage.mutate({ packageId: plan.id })}
        onRequestDeposit={(plan: any, shortfall: number) =>
          openPackagePayment(plan.id, Math.max(100, shortfall))
        }
      />
    ),
    profile: (
      <ProfileWallet
        t={t}
        wallet={wallet}
        setPage={setPage}
        user={user}
        profile={profile}
        activePackage={overview.activePackage}
        totalEarnedPkr={overview.totalEarnedPkr}
        totalDepositsPkr={overview.totalDepositsPkr}
        onRequestWithdrawal={openWithdrawal}
      />
    ),
    deposit: <Deposit t={t} settings={settings} packages={packages} onDone={invalidateCore} initialRequestedPackageId={depositPackageId} initialAmount={depositAmount} />,
    withdrawal: (
      <Withdrawal
        t={t}
        profile={memberProfile}
        showRewardWithdrawalPrompt={showRewardWithdrawalPrompt}
        activePackage={overview.activePackage}
        hasPendingChannelReward={hasPendingChannelReward}
        rewardWithdrawalCompleted={
          memberProfile.whatsappRewardEligible && rewardWithdrawalRequested
        }
        onRewardWithdrawalSubmitted={() => setRewardWithdrawalSubmittedLocally(true)}
        onDone={invalidateCore}
      />
    ),
    earn: <AdsTasks t={t} onDone={invalidateCore} language={language} />,
    history: <TransactionHistory t={t} />,
    invite: <Referral t={t} />,
    support: <SupportChat t={t} onOpenTickets={() => setPage("ticketSupport")} />,
    ticketSupport: <Support t={t} />,
    admin: isAdmin ? <AdminPanel t={t} /> : <Empty text={language === "ur" ? "یہ صفحہ صرف ایڈمن کے لیے ہے۔" : "This page is restricted to administrators."} />,
  };
  return (
    <>
      {showChannelPrompt && (
        <WhatsAppJoinPrompt
          t={t}
          joining={joinWhatsApp.isPending}
          onJoin={handleJoinWhatsApp}
          onClose={() => setShowChannelPrompt(false)}
        />
      )}
      <div className="mt-4">{content[page as Page]}</div>
      <div className="pointer-events-none fixed bottom-20 right-4 z-40 flex flex-col items-end gap-2 lg:bottom-6 lg:right-6">
        <button type="button" onClick={() => setPage("support")} className="pointer-events-auto inline-flex items-center gap-2 rounded-full bg-red-600 px-4 py-3 text-sm font-black text-white shadow-xl shadow-red-950/40 transition hover:bg-red-500 active:scale-95" aria-label={t("help")}><CircleHelp className="size-5" />{t("help")}</button>
        <a href="https://t.me/EADSEARNPRO" target="_blank" rel="noreferrer" className="pointer-events-auto inline-flex items-center gap-2 rounded-full bg-sky-500 px-4 py-3 text-sm font-black text-white shadow-xl shadow-sky-950/40 transition hover:bg-sky-400 active:scale-95" aria-label={t("telegramSupport")}><Send className="size-5" />{t("telegramSupport")}</a>
      </div>
      <p className="mt-8 text-center text-[11px] text-slate-500">
        {t("brand")} ·{" "}
        {language === "ur" ? "محفوظ ورک اسپیس" : "Secure member workspace"}
      </p>
    </>
  );
}

function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">
          {title}
        </h1>
        {description && (
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
            {description}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}

function Dashboard({ t, overview, announcements, setPage, onRequestWithdrawal }: any) {
  const active = overview.activePackage;
  const canWithdraw = Boolean(active) ||
    (overview.profile.whatsappRewardEligible &&
      overview.profile.whatsappBonusClaimed &&
      !overview.profile.whatsappRewardWithdrawn);
  const dashboardCards: Record<DashboardMetricKey, ReactNode> = {
    balance: (
      <StatCard
        icon={WalletCards}
        label={t("balance")}
        value={money(overview.profile.balancePkr)}
        accent="emerald"
      />
    ),
    adsToday: (
      <StatCard
        icon={Play}
        label={t("adsToday")}
        value={`${overview.todayAds.watched} / ${overview.todayAds.total}`}
        accent="blue"
      />
    ),
    totalEarned: (
      <StatCard
        icon={Sparkles}
        label={t("totalEarned")}
        value={money(overview.totalEarnedPkr)}
        accent="violet"
      />
    ),
  };
  return (
    <>
      <PageHeading
        eyebrow={t("welcome")}
        title={t("overview")}
        description={
          active
            ? `${active.icon} ${active.name} · ${active.daysRemaining} ${t("daysLeft")}`
            : t("noActive")
        }
        action={
          <button
            onClick={() => setPage("profile")}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-slate-100 transition hover:bg-white/10"
          >
            {t("wallet")}
          </button>
        }
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {dashboardMetricKeys.map(key => (
          <div key={key}>{dashboardCards[key]}</div>
        ))}
      </div>
      <div className="mt-5 grid gap-5 xl:grid-cols-[1.2fr_.8fr]">
        <div className="panel">
          <div className="flex items-center justify-between">
            <div>
              <p className="eyebrow">{t("activePackage")}</p>
              <h2 className="mt-1 text-xl font-bold">
                {active ? `${active.icon} ${active.name}` : t("noPackage")}
              </h2>
            </div>
            <PackageCheck className="size-8 text-amber-300" />
          </div>
          {active ? (
            <>
              <div className="mt-6 flex items-end justify-between">
                <div>
                  <p className="text-xs text-slate-400">{t("adsToday")}</p>
                  <p className="mt-1 text-2xl font-bold">
                    {overview.todayAds.watched}
                    <span className="text-slate-500">
                      {" "}
                      / {overview.todayAds.total}
                    </span>
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-400">{t("daysLeft")}</p>
                  <p className="mt-1 text-2xl font-bold text-amber-300">
                    {active.daysRemaining}
                  </p>
                </div>
              </div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-amber-300"
                  style={{
                    width: `${Math.max(0, Math.min(100, (active.daysRemaining / 30) * 100))}%`,
                  }}
                />
              </div>
              <button
                onClick={() => setPage("earn")}
                className="mt-6 inline-flex h-11 items-center gap-2 rounded-xl bg-amber-300 px-4 text-sm font-bold text-slate-950 transition active:scale-[.97]"
              >
                <Play className="size-4" />
                {t("watchAd")}
              </button>
            </>
          ) : (
            <button
              onClick={() => setPage("packages")}
              className="mt-6 inline-flex h-11 items-center gap-2 rounded-xl bg-amber-300 px-4 text-sm font-bold text-slate-950 transition active:scale-[.97]"
            >
              <Boxes className="size-4" />
              {t("viewPackages")}
            </button>
          )}
        </div>
        <div className="panel">
          <p className="eyebrow">{t("quickActions")}</p>
          <div className="mt-4 grid gap-2">
            <QuickAction
              icon={CreditCard}
              label={t("makeDeposit")}
              onClick={() => setPage("deposit")}
            />
            <QuickAction
              icon={ArrowUpRight}
              label={t("requestWithdrawal")}
              onClick={onRequestWithdrawal}
              disabled={!canWithdraw}
            />
            {!canWithdraw && <p className="px-1 text-xs font-semibold text-amber-200">{t("noPackageBalanceMessage")}</p>}
            <QuickAction
              icon={Users}
              label={t("inviteFriends")}
              onClick={() => setPage("invite")}
            />
          </div>
        </div>
      </div>
      {announcements.length > 0 && (
        <div className="panel mt-5">
          <div className="flex items-center gap-2">
            <Bell className="size-4 text-amber-300" />
            <p className="font-bold">{t("announcements")}</p>
          </div>
          <div className="mt-4 space-y-3">
            {announcements.map((item: any) => (
              <div
                key={item.id}
                className="rounded-xl border border-white/10 bg-slate-950/15 p-4"
              >
                <p className="text-sm font-bold">{item.title}</p>
                <p className="mt-1 text-sm leading-6 text-slate-300">
                  {item.body}
                </p>
                {item.mediaUrl && (
                  <a
                    target="_blank"
                    rel="noreferrer"
                    href={item.mediaUrl}
                    className="mt-2 inline-block text-xs font-bold text-amber-300 underline"
                  >
                    Open attachment
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
function StatCard({ icon: Icon, label, value, accent }: any) {
  const colors: Record<string, string> = {
    emerald: "text-emerald-300 bg-emerald-300/10",
    amber: "text-amber-300 bg-amber-300/10",
    blue: "text-sky-300 bg-sky-300/10",
    violet: "text-violet-300 bg-violet-300/10",
  };
  return (
    <div className="panel">
      <div
        className={`grid size-9 place-items-center rounded-xl ${colors[accent]}`}
      >
        <Icon className="size-4" />
      </div>
      <p className="mt-6 text-xs text-slate-400">{label}</p>
      <p className="mt-1 text-xl font-bold">{value}</p>
    </div>
  );
}
function QuickAction({ icon: Icon, label, onClick, disabled = false }: any) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex items-center justify-between rounded-xl border border-white/10 bg-slate-950/15 px-3 py-3 text-left text-sm font-semibold text-slate-200 transition hover:border-amber-300/30 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <span className="flex items-center gap-2">
        <Icon className="size-4 text-amber-300" />
        {label}
      </span>
      <ArrowUpRight className="size-4 text-slate-500" />
    </button>
  );
}

function Packages({ t, language, plans, balance, active, onPurchase, onRequestDeposit }: any) {
  const [shortfallPlan, setShortfallPlan] = useState<any>(null);
  const orderedPlans = [...plans].sort((a, b) => a.pricePkr - b.pricePkr);
  const shortfall = shortfallPlan
    ? Math.max(0, shortfallPlan.pricePkr - balance)
    : 0;
  const handlePurchase = (plan: any) => {
    if (balance >= plan.pricePkr) {
      onPurchase(plan);
      return;
    }
    if (balance <= 0) {
      onRequestDeposit(plan, plan.pricePkr);
      return;
    }
    setShortfallPlan(plan);
  };
  return (
    <>
      <PageHeading
        eyebrow={t("purchase")}
        title={t("packageTitle")}
        description={t("packageSubtitle")}
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {orderedPlans.map((plan: any) => {
          const isActive = active?.id === plan.id;
          return (
            <div
              key={plan.id}
              className={`panel premium-package-card relative overflow-hidden ${isActive ? "border-red-600/45" : ""}`}
            >
              <div className="absolute right-4 top-4 text-3xl opacity-70">
                {plan.icon}
              </div>
              <p className="eyebrow">{plan.tier}</p>
              <h2 className="mt-1 text-2xl font-bold">{plan.name}</h2>
              <p className="mt-5 text-3xl font-bold text-amber-300">
                {money(plan.pricePkr)}
              </p>
              <p className="mt-3 text-lg font-extrabold text-emerald-200">
                {plan.dailyAds} {plan.dailyAds === 1 ? t("ad") : t("ads")} - {plan.adRewardPkr} PKR / {t("ad")}
              </p>
              <p className="mt-1 text-sm font-semibold text-amber-100">
                {t("totalDailyEarning")}: {money(plan.dailyAds * plan.adRewardPkr)}
              </p>
              <div className="mt-5 space-y-2 text-sm text-slate-300">
                <p className="flex items-center gap-2">
                  <Play className="size-4 text-emerald-300" />
                  {plan.dailyAds} {t("dailyAds")}
                </p>
                <p className="flex items-center gap-2">
                  <History className="size-4 text-emerald-300" />
                  {t("validity")}
                </p>
              </div>
              <button
                disabled={isActive}
                onClick={() => handlePurchase(plan)}
                className={`mt-6 h-11 w-full rounded-xl text-sm font-bold transition active:scale-[.97] disabled:opacity-60 ${isActive ? "bg-emerald-400/15 text-emerald-200" : "bg-amber-300 text-slate-950"}`}
              >
                {isActive ? t("currentPackage") : t("buyPackage")}
              </button>
              {!isActive && balance < plan.pricePkr && (
                <p className="mt-2 text-center text-[11px] text-amber-200/70">
                  {t("insufficient")}
                </p>
              )}
            </div>
          );
        })}
      </div>
      <AlertDialog
        open={Boolean(shortfallPlan)}
        onOpenChange={open => !open && setShortfallPlan(null)}
      >
        <AlertDialogContent className="border-red-500/30 bg-slate-950 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {language === "ur" ? "والٹ بیلنس ناکافی ہے" : "Wallet balance is short"}
            </AlertDialogTitle>
            <AlertDialogDescription className="leading-6 text-slate-300">
              {shortfallPlan && (language === "ur"
                ? `آپ کے والٹ میں ${money(balance)} ہے۔ ${shortfallPlan.name} کے لیے مزید ${money(shortfall)} درکار ہیں۔ براہِ کرم ڈپازٹ کریں۔`
                : `Apke wallet me ${money(balance)} hai, is package ke liye ${money(shortfall)} aur chahiye. Please Deposit ${money(Math.max(100, shortfall))}.`)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 text-white hover:bg-red-500"
              onClick={() => {
                if (shortfallPlan) onRequestDeposit(shortfallPlan, shortfall);
                setShortfallPlan(null);
              }}
            >
              {language === "ur" ? `${money(Math.max(100, shortfall))} ڈپازٹ کریں` : `Deposit ${money(Math.max(100, shortfall))}`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function ProfileWallet({
  t,
  wallet,
  setPage,
  user,
  profile,
  activePackage,
  totalEarnedPkr,
  totalDepositsPkr,
  onRequestWithdrawal,
}: any) {
  if (!wallet) return <LoadingScreen text={t("loading")} />;
  const [showPassword, setShowPassword] = useState(false);
  const referral = trpc.referral.get.useQuery();
  const canWithdraw = Boolean(activePackage) ||
    (profile.whatsappRewardEligible &&
      profile.whatsappBonusClaimed &&
      !profile.whatsappRewardWithdrawn);
  return (
    <>
      <PageHeading
        eyebrow={t("profile")}
        title={t("profile")}
        description={t("walletBalance")}
        action={
          <div className="flex gap-2">
            <button
              onClick={() => setPage("deposit")}
              className="rounded-xl bg-amber-300 px-4 py-2 text-sm font-bold text-slate-950"
            >
              {t("deposit")}
            </button>
            <button
              disabled={!canWithdraw}
              onClick={onRequestWithdrawal}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t("withdrawal")}
            </button>
          </div>
        }
      />
      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <StatCard
          icon={WalletCards}
          label={t("depositWallet")}
          value={money(wallet.profile.balancePkr)}
          accent="emerald"
        />
        <StatCard
          icon={Landmark}
          label={t("totalDeposits")}
          value={money(totalDepositsPkr)}
          accent="amber"
        />
        <StatCard
          icon={Landmark}
          label={t("usd")}
          value={`$${wallet.balanceUsd.toFixed(2)}`}
          accent="blue"
        />
      </div>
      {!canWithdraw && wallet.profile.balancePkr <= 0 && <p className="mt-4 rounded-xl border border-amber-300/25 bg-amber-300/10 p-4 text-sm font-semibold text-amber-50">{t("noPackageBalanceMessage")}</p>}
      <div className="mt-5 grid gap-5 xl:grid-cols-[1.05fr_.95fr]">
        <div className="panel space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="eyebrow">{t("personalInfo")}</p>
              <h2 className="mt-1 text-xl font-bold">{t("profile")}</h2>
            </div>
            <Settings2 className="size-5 text-amber-300" />
          </div>
          <div>
            <p className="field-label">{t("profileEmail")}</p>
            <p className="mt-1 font-semibold">{user?.email ?? "—"}</p>
          </div>
          <div>
            <p className="field-label">{t("profileUsername")}</p>
            <p className="mt-1 font-semibold">{profile.username}</p>
          </div>
          <div>
            <p className="field-label">{t("profilePassword")}</p>
            <div className="mt-1 flex items-center justify-between rounded-xl border border-white/10 bg-slate-950/20 px-3 py-2 text-sm">
              <span>{showPassword ? t("passwordSaved") : "••••••••"}</span>
              <button type="button" aria-label={showPassword ? t("hidePassword") : t("showPassword")} onClick={() => setShowPassword(!showPassword)} className="text-amber-300">
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>
        </div>
        <div className="panel space-y-4">
          <div>
            <p className="field-label">{t("activePackage")}</p>
            <p className="mt-1 font-semibold">{activePackage ? `${activePackage.icon} ${activePackage.name}` : t("noActivePackageProfile")}</p>
          </div>
          <div>
            <p className="field-label">{t("totalReferrals")}</p>
            <p className="mt-1 text-2xl font-bold">{referral.data?.totalReferrals ?? 0}</p>
          </div>
          <div>
            <p className="field-label">{t("totalEarnings")}</p>
            <p className="mt-1 text-2xl font-bold text-amber-300">{money(totalEarnedPkr)}</p>
          </div>
        </div>
      </div>
      <div className="mt-5 panel">
        <div className="flex items-center justify-between">
          <div>
            <p className="eyebrow">{t("history")}</p>
            <h2 className="mt-1 text-xl font-bold">{t("transactions")}</h2>
          </div>
          <button
            onClick={() => setPage("history")}
            className="text-sm font-bold text-amber-300"
          >
            {t("history")}
          </button>
        </div>
        {wallet.recent.length ? (
          <div className="mt-4 divide-y divide-white/10">
            {wallet.recent.map((row: any) => (
              <TransactionRow key={row.id} row={row} />
            ))}
          </div>
        ) : (
          <Empty text={t("noTransactions")} />
        )}
      </div>
    </>
  );
}
function TransactionRow({ row }: { row: any }) {
  const language =
    typeof window === "undefined"
      ? "en"
      : (localStorage.getItem("pep-language") as Language) || "en";
  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <div className="grid size-9 place-items-center rounded-xl bg-white/5">
          <ClipboardList className="size-4 text-amber-300" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">
            {translate(language, typeLabels[row.type] ?? "type")}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            {dateTime(row.createdAt)}
          </p>
        </div>
      </div>
      <div className="text-right">
        <p
          className={`${row.direction === "credit" ? "text-emerald-300" : row.direction === "debit" ? "text-red-300" : "text-slate-200"} text-sm font-bold`}
        >
          {row.direction === "credit"
            ? "+"
            : row.direction === "debit"
              ? "−"
              : ""}
          {money(row.amountPkr)}
        </p>
        <span
          className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${statusClass(row.status)}`}
        >
          {translate(language, statusLabels[row.status] ?? "status")}
        </span>
      </div>
    </div>
  );
}
function Empty({ text }: { text: string }) {
  return (
    <div className="mt-5 rounded-2xl border border-dashed border-white/15 px-5 py-12 text-center text-sm text-slate-400">
      {text}
    </div>
  );
}

function GroupedFinancialHistory({ rows, t, kind }: { rows: any[]; t: (key: TranslationKey) => string; kind: "deposit" | "withdrawal" }) {
  const groups = groupHistoryRows(rows ?? []);
  return (
    <div className="mt-5 space-y-5">
      {groups.map(group => {
        const label = historyDateLabel(group.key);
        const groupTitle = label === "date" ? new Date(`${group.key}T12:00:00`).toLocaleDateString() : t(label);
        return (
          <section key={group.key} className="rounded-2xl border border-white/10 bg-slate-950/10 p-4">
            <p className="text-xs font-bold uppercase tracking-[.16em] text-amber-300">{groupTitle}</p>
            <div className="mt-2 divide-y divide-white/10">
              {group.items.map((item: any) => (
                <div key={item.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                  <div className="min-w-0">
                    <p className="font-bold">{money(item.amountPkr)} {t(kind)}</p>
                    <p className="mt-1 text-xs text-slate-500">{kind === "deposit" ? `${item.method} · ` : ""}{dateTime(item.createdAt)}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {kind === "deposit" && item.senderAccountName && <CopyValue value={item.senderAccountName} label={t("senderAccountName")} />}
                      {kind === "deposit" && item.senderAccountNumber && <CopyValue value={item.senderAccountNumber} label={t("senderAccountNumber")} />}
                      {kind === "deposit" && item.transactionId && <CopyValue value={item.transactionId} label={t("transactionId")} />}
                      {kind === "withdrawal" && item.accountName && <CopyValue value={item.accountName} label={t("walletAccountName")} />}
                      {kind === "withdrawal" && item.accountDetails && <CopyValue value={item.accountDetails} label={t("walletNumber")} />}
                    </div>
                  </div>
                  <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${statusClass(item.status)}`}>{t(statusLabels[item.status] ?? "status")}</span>
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function CopyValue({ value, label }: { value: string; label: string }) {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success("Copied");
    } catch {
      toast.error(friendlyMessages.requestFailed);
    }
  };
  return (
    <button
      type="button"
      onClick={copy}
      className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-red-500/20 bg-red-50 px-2.5 py-1.5 text-left text-[11px] font-bold text-red-700 transition hover:bg-red-100"
      aria-label={`Copy ${label}`}
    >
      <Copy className="size-3.5 shrink-0" />
      <span className="truncate">{label}: {value}</span>
    </button>
  );
}

function Deposit({ t, settings, packages, onDone, initialRequestedPackageId = "", initialAmount = "" }: any) {
  const [currency, setCurrency] = useState<"PKR" | "USD">("PKR");
  const [amount, setAmount] = useState(initialAmount);
  const [method, setMethod] = useState("");
  const [senderAccountNumber, setSenderAccountNumber] = useState("");
  const [senderAccountName, setSenderAccountName] = useState("");
  const [transactionId, setTransactionId] = useState("");
  const [requestedPackageId, setRequestedPackageId] = useState(initialRequestedPackageId);
  const [proof, setProof] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});
  const [showHistory, setShowHistory] = useState(false);
  const utils = trpc.useUtils();
  const accounts = trpc.deposit.accounts.useQuery({ currency });
  const create = trpc.deposit.create.useMutation({
    onSuccess: () => {
      toast.success(t("submitted"));
      setProof("");
      setAmount("");
      setSenderAccountNumber("");
      setSenderAccountName("");
      setTransactionId("");
      setRequestedPackageId("");
      setShowHistory(true);
      void utils.deposit.list.invalidate();
      onDone();
    },
    onError: error => {
      setErrors(friendlyServerError(error, "transactionId"));
    },
  });
  const list = trpc.deposit.list.useQuery();
  return (
    <>
      <PageHeading
        eyebrow={t("deposit")}
        title={t("makeDeposit")}
        description={t("officialAccounts")}
        action={<button onClick={() => setShowHistory(!showHistory)} className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-amber-300">{showHistory ? t("hideHistory") : t("viewDepositHistory")}</button>}
      />
      <div className="grid gap-5 xl:grid-cols-[.85fr_1.15fr]">
        <div className="panel">
          <p className="eyebrow">{t("officialAccounts")}</p>
          <div className="mt-4 flex gap-2">
            <CurrencyTabs value={currency} onChange={setCurrency} t={t} />
          </div>
          <div className="mt-4 space-y-3">
            {accounts.data?.map((account: any) => (
              <div
                key={account.id}
                className="rounded-2xl border border-white/10 bg-slate-950/15 p-4"
              >
                <p className="font-bold">{account.provider}</p>
                <p className="mt-1 text-sm text-slate-300">
                  {account.accountName}
                </p>
                <p className="mt-2 font-mono text-sm text-amber-300">
                  {account.accountDetails}
                </p>
              </div>
            ))}
          </div>
        </div>
        <div className="panel">
          <p className="mb-5 rounded-xl border border-amber-300/25 bg-amber-300/10 p-4 text-sm leading-6 text-amber-50">
            {t("depositTransferInstruction")}
          </p>
          <form
            onSubmit={event => {
              event.preventDefault();
              const nextErrors: FormErrors = {
                amount: validateDepositAmount(amount, currency),
                transactionId: validateTransactionId(transactionId),
                senderAccountNumber: isValidPakistanMobileNumber(senderAccountNumber)
                  ? undefined
                  : friendlyMessages.paymentNumber,
                proof: !proof ? friendlyMessages.proofRequired : undefined,
              };
              if (
                nextErrors.amount ||
                nextErrors.transactionId ||
                nextErrors.senderAccountNumber ||
                nextErrors.proof
              ) {
                setErrors(nextErrors);
                return;
              }
              setErrors({});
              const numeric = Number(amount);
              create.mutate({
                currency,
                amount: numeric,
                method,
                senderAccountNumber,
                senderAccountName,
                transactionId,
                requestedPackageId: requestedPackageId
                  ? Number(requestedPackageId)
                  : undefined,
                proofData: proof,
              });
            }}
          >
            <div className="grid gap-4 md:grid-cols-2">
              <label>
                <span className="field-label">
                  {t("amount")} ({currency})
                </span>
                <input
                  className="field"
                  type="number"
                  step="0.01"
                  value={amount}
                  aria-invalid={Boolean(errors.amount)}
                  onChange={e => {
                    setAmount(e.target.value);
                    setErrors(current => ({ ...current, amount: undefined }));
                  }}
                />
                <FieldError>{errors.amount}</FieldError>
              </label>
              <p className="mb-4 rounded-xl border border-amber-300/15 bg-amber-300/10 p-3 text-xs text-amber-100">
                {currency === "PKR" ? t("depositLimit") : t("depositLimitUsd")}
              </p>
              <label>
                <span className="field-label">{t("paymentMethod")}</span>
                <select
                  required
                  value={method}
                  onChange={e => setMethod(e.target.value)}
                  className="field"
                >
                  <option value="">{t("selectCurrency")}</option>
                  {accounts.data?.map((account: any) => (
                    <option key={account.id} value={account.provider}>
                      {account.provider}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="field-label">{t("senderAccountName")}</span>
                <input required className="field" value={senderAccountName} onChange={e => setSenderAccountName(e.target.value)} />
              </label>
              <label>
                <span className="field-label">{t("senderAccountNumber")}</span>
                <input required className="field" inputMode="numeric" aria-invalid={Boolean(errors.senderAccountNumber)} value={senderAccountNumber} onChange={e => { setSenderAccountNumber(e.target.value); setErrors(current => ({ ...current, senderAccountNumber: undefined })); }} />
                <FieldError>{errors.senderAccountNumber}</FieldError>
              </label>
              <label>
                <span className="field-label">{t("transactionId")}</span>
                <input required className="field" aria-invalid={Boolean(errors.transactionId)} value={transactionId} onChange={e => { setTransactionId(e.target.value); setErrors(current => ({ ...current, transactionId: undefined })); }} />
                <FieldError>{errors.transactionId}</FieldError>
              </label>
              <label>
                <span className="field-label">{t("requestedPackage")}</span>
                <select className="field" value={requestedPackageId} onChange={e => setRequestedPackageId(e.target.value)}>
                  <option value="">{t("walletDeposit")}</option>
                  {packages.map((plan: any) => <option key={plan.id} value={plan.id}>{plan.name} · {money(plan.pricePkr)}</option>)}
                </select>
              </label>
            </div>
            <label className="mt-4 block">
              <span className="field-label">{t("proof")}</span>
              <input
                className="field h-auto py-2"
                type="file"
                accept="image/*"
                onChange={async e => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setErrors(current => ({ ...current, proof: undefined }));
                  try {
                    setProof(await toDataUrl(file));
                  } catch {
                    setProof("");
                    setErrors(current => ({
                      ...current,
                      proof: friendlyMessages.proofRequired,
                    }));
                  }
                }}
              />
              <FieldError>{errors.proof}</FieldError>
            </label>
            <button
              disabled={create.isPending}
              className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-amber-300 text-sm font-bold text-slate-950 disabled:opacity-60"
            >
              <ArrowDownToLine className="size-4" />
              {t("submitDeposit")}
            </button>
          </form>
        </div>
      </div>
      {showHistory && <div className="panel mt-5"><p className="eyebrow">{t("viewDepositHistory")}</p>{list.data?.length ? <GroupedFinancialHistory rows={list.data} t={t} kind="deposit" /> : <Empty text={t("noTransactions")} />}</div>}
    </>
  );
}
function CurrencyTabs({ value, onChange, t }: any) {
  return (
    <div className="flex rounded-xl border border-white/10 bg-slate-950/20 p-1">
      <button
        onClick={() => onChange("PKR")}
        type="button"
        className={`rounded-lg px-3 py-1.5 text-xs font-bold ${value === "PKR" ? "bg-amber-300 text-slate-950" : "text-slate-300"}`}
      >
        {t("pkr")}
      </button>
      <button
        onClick={() => onChange("USD")}
        type="button"
        className={`rounded-lg px-3 py-1.5 text-xs font-bold ${value === "USD" ? "bg-amber-300 text-slate-950" : "text-slate-300"}`}
      >
        {t("usd")}
      </button>
    </div>
  );
}

function Withdrawal({ t, profile, showRewardWithdrawalPrompt, activePackage, hasPendingChannelReward, rewardWithdrawalCompleted, onRewardWithdrawalSubmitted, onDone }: any) {
  const [currency, setCurrency] = useState<"PKR" | "USD">("PKR");
  const [walletType, setWalletType] = useState("");
  const walletTypes = currency === "PKR"
    ? ["JazzCash", "Easypaisa", "SadaPay", "NayaPay", "Other"]
    : ["Skrill", "Payoneer", "Binance", "Other"];
  const [amount, setAmount] = useState("");
  const [accountName, setAccountName] = useState("");
  const [accountDetails, setAccountDetails] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});
  const [showHistory, setShowHistory] = useState(false);
  const [showInviteTicker, setShowInviteTicker] = useState(
    () => Boolean(activePackage && profile.withdrawalLimitPkr <= 0)
  );
  const utils = trpc.useUtils();
  useEffect(() => {
    const shouldShowInviteTicker = Boolean(
      activePackage && profile.withdrawalLimitPkr <= 0
    );
    setShowInviteTicker(shouldShowInviteTicker);
    if (!shouldShowInviteTicker) return;
    const tickerTimer = window.setTimeout(() => setShowInviteTicker(false), 6_000);
    return () => window.clearTimeout(tickerTimer);
  }, [activePackage?.ownershipId, profile.withdrawalLimitPkr]);
  const create = trpc.withdrawal.create.useMutation({
    onSuccess: data => {
      toast.success(t("submitted"));
      setWalletType("");
      setAmount("");
      setShowHistory(true);
      if (data.rewardWithdrawalSubmitted) onRewardWithdrawalSubmitted();
      void utils.withdrawal.list.invalidate();
      onDone();
    },
    onError: error => {
      const serverErrors = friendlyServerError(error, "amount");
      const firstMessage = Object.values(serverErrors)[0] ?? friendlyMessages.requestFailed;
      setErrors(serverErrors);
      toast.error(firstMessage);
    },
  });
  const list = trpc.withdrawal.list.useQuery();
  return (
    <>
      <PageHeading
        eyebrow={t("withdrawal")}
        title={t("requestWithdrawal")}
        description={t("withdrawalNote")}
        action={<button onClick={() => setShowHistory(!showHistory)} className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-amber-300">{showHistory ? t("hideHistory") : t("viewWithdrawalHistory")}</button>}
      />
      <div className="max-w-2xl panel">
        {rewardWithdrawalCompleted && !activePackage ? (
          <p className="rounded-xl border border-emerald-300/25 bg-emerald-300/10 p-4 text-sm font-semibold leading-6 text-emerald-50">
            {t("postRewardBalanceMessage")}
          </p>
        ) : !activePackage && !hasPendingChannelReward ? (
          <p className="rounded-xl border border-amber-300/25 bg-amber-300/10 p-4 text-sm font-semibold text-amber-50">
            {t("noPackageBalanceMessage")}
          </p>
        ) : (
          <>
        {activePackage && (
          <div className="mb-5 flex items-center justify-between gap-4 rounded-xl border border-amber-300/30 bg-amber-300/10 p-4">
            <p className="text-sm font-bold text-amber-100">{t("yourWithdrawalLimit")}</p>
            <strong className="text-lg font-black text-amber-300">PKR {Number(profile.withdrawalLimitPkr ?? 0).toLocaleString()}</strong>
          </div>
        )}
        {showRewardWithdrawalPrompt && (
          <p className="mb-5 flex items-center gap-2 rounded-xl border border-emerald-300/25 bg-emerald-300/10 p-3 text-sm font-semibold text-emerald-50">
            <Gift className="size-4 shrink-0 text-amber-300" />
            {t("whatsappWithdrawalPrompt")}
          </p>
        )}
        {showInviteTicker && !showRewardWithdrawalPrompt && (
          <div className="withdrawal-invite-ticker mb-5 rounded-xl border border-emerald-300/25 bg-emerald-300/10 py-3 text-sm font-semibold text-emerald-50" role="status">
            <p className="withdrawal-invite-ticker__text">{t("withdrawalInviteTicker")}</p>
          </div>
        )}
          <form
            onSubmit={event => {
              event.preventDefault();
              const failure = firstWithdrawalFailure({
                amount,
                currency,
                withdrawalLimitPkr: profile.withdrawalLimitPkr,
                activePackage: Boolean(activePackage),
                pendingChannelReward: Boolean(hasPendingChannelReward),
                freeWithdrawalCompleted: Boolean(rewardWithdrawalCompleted),
                walletType,
                accountName,
                accountDetails,
              });
              if (failure) {
                setErrors({ [failure.field]: failure.message });
                toast.error(failure.message);
                return;
              }
              setErrors({});
              const numeric = Number(amount);
              create.mutate({
                currency,
                amount: numeric,
                walletType: walletType as "JazzCash" | "Easypaisa" | "SadaPay" | "NayaPay" | "Other",
                accountName,
                accountDetails,
              });
            }}
          >
            <div className="mb-4">
              <CurrencyTabs value={currency} onChange={(nextCurrency: "PKR" | "USD") => {
                setCurrency(nextCurrency);
                setWalletType("");
                setErrors(current => ({ ...current, walletType: undefined, accountDetails: undefined }));
              }} t={t} />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <label>
                <span className="field-label">{t("walletType")}</span>
                <select
                  className="field"
                  value={walletType}
                  aria-invalid={Boolean(errors.walletType)}
                  onChange={e => {
                    setWalletType(e.target.value);
                    setErrors(current => ({ ...current, walletType: undefined }));
                  }}
                >
                  <option value="">{t("selectWalletType")}</option>
                  {walletTypes.map(type => <option key={type} value={type}>{type}</option>)}
                </select>
                <FieldError>{errors.walletType}</FieldError>
              </label>
              <label>
                <span className="field-label">{t("walletAccountName")}</span>
                <input
                  className="field"
                  value={accountName}
                  aria-invalid={Boolean(errors.accountName)}
                  onChange={e => {
                    setAccountName(e.target.value);
                    setErrors(current => ({ ...current, accountName: undefined }));
                  }}
                />
                <FieldError>{errors.accountName}</FieldError>
              </label>
              <label>
                <span className="field-label">{t("walletNumber")}</span>
                <input
                  className="field"
                  value={accountDetails}
                  inputMode={currency === "PKR" ? "numeric" : undefined}
                  aria-invalid={Boolean(errors.accountDetails)}
                  onChange={e => {
                    setAccountDetails(e.target.value);
                    setErrors(current => ({ ...current, accountDetails: undefined }));
                  }}
                />
                <FieldError>{errors.accountDetails}</FieldError>
              </label>
              <label>
                <span className="field-label">
                  {t("amount")} ({currency})
                </span>
                <input
                  className="field"
                  type="number"
                  step="0.01"
                  value={amount}
                  aria-invalid={Boolean(errors.amount)}
                  onChange={e => {
                    setAmount(e.target.value);
                    setErrors(current => ({ ...current, amount: undefined }));
                  }}
                />
                <FieldError>{errors.amount}</FieldError>
              </label>
            </div>
            <button
              disabled={create.isPending}
              className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-amber-300 text-sm font-bold text-slate-950 disabled:opacity-60"
            >
              <ArrowUpRight className="size-4" />
              {t("submitWithdrawal")}
            </button>
          </form>
          </>
        )}
      </div>
      {showHistory && <div className="panel mt-5"><p className="eyebrow">{t("viewWithdrawalHistory")}</p>{list.data?.length ? <GroupedFinancialHistory rows={list.data} t={t} kind="withdrawal" /> : <Empty text={t("noTransactions")} />}</div>}
    </>
  );
}

function TransactionHistory({ t }: any) {
  const [type, setType] = useState<any>("all");
  const [status, setStatus] = useState<any>("all");
  const input = useMemo(() => ({ type, status }), [type, status]);
  const history = trpc.wallet.transactions.useQuery(input);
  return (
    <>
      <PageHeading
        eyebrow={t("history")}
        title={t("transactions")}
        description={t("allTypes")}
      />
      <div className="panel">
        <div className="grid gap-3 sm:grid-cols-2">
          <select
            className="field"
            value={type}
            onChange={e => setType(e.target.value)}
          >
            <option value="all">{t("allTypes")}</option>
            {Object.entries(typeLabels).map(([value, label]) => (
              <option value={value} key={value}>
                {label}
              </option>
            ))}
          </select>
          <select
            className="field"
            value={status}
            onChange={e => setStatus(e.target.value)}
          >
            <option value="all">{t("allStatuses")}</option>
            {["pending", "approved", "rejected", "completed"].map(value => (
              <option value={value} key={value}>
                {value}
              </option>
            ))}
          </select>
        </div>
        {history.data?.length ? (
          <div className="mt-4 divide-y divide-white/10">
            {history.data.map((row: any) => (
              <TransactionRow key={row.id} row={row} />
            ))}
          </div>
        ) : (
          <Empty text={t("noTransactions")} />
        )}
      </div>
    </>
  );
}

function Referral({ t }: any) {
  const referral = trpc.referral.get.useQuery();
  const [copied, setCopied] = useState(false);
  if (!referral.data) return <LoadingScreen text={t("loading")} />;
  const invite = buildInviteSummary(referral.data, window.location.origin);
  const link = invite.link;
  const copy = async () => {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    toast.success(t("copied"));
    window.setTimeout(() => setCopied(false), 1500);
  };
  const share = async () => {
    if (navigator.share)
      await navigator.share({
        title: t("brand"),
        text: t("referralTitle"),
        url: link,
      });
    else copy();
  };
  return (
    <>
      <PageHeading
        eyebrow={t("invite")}
        title={t("invite")}
      />
      <div className="grid gap-5 xl:grid-cols-[1.15fr_.85fr]">
        <div className="panel">
          <p className="eyebrow">{t("yourLink")}</p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <input
              readOnly
              className="field flex-1 font-mono text-xs"
              value={link}
            />
            <button
              onClick={copy}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 text-sm font-bold"
            >
              <Copy className="size-4" />
              {copied ? "✓" : t("copy")}
            </button>
            <button
              onClick={share}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-amber-300 px-4 text-sm font-bold text-slate-950"
            >
              <Send className="size-4" />
              {t("share")}
            </button>
          </div>
        </div>
        <div className="panel">
          <p className="eyebrow">{t("referralEarnings")}</p>
          <p className="mt-2 text-3xl font-bold text-amber-300">
            {money(invite.referralEarningsPkr)}
          </p>
          <p className="mt-4 text-xs font-bold text-slate-400">{t("referralCode")}</p>
          <p className="mt-1 font-mono text-sm text-amber-300">{referral.data.referralCode}</p>
        </div>
      </div>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <StatCard
          icon={Users}
          label={t("totalReferrals")}
          value={String(invite.totalInvites)}
          accent="blue"
        />
        <StatCard
          icon={PackageCheck}
          label={t("friendsPurchased")}
          value={String(referral.data.purchasedReferrals)}
          accent="emerald"
        />
      </div>
    </>
  );
}

function Support({ t }: any) {
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [screenshot, setScreenshot] = useState("");
  const create = trpc.support.create.useMutation({
    onSuccess: () => {
      toast.success(t("submitted"));
      setSubject("");
      setDescription("");
      setScreenshot("");
      tickets.refetch();
    },
    onError: () => toast.error(t("operationFailed")),
  });
  const tickets = trpc.support.list.useQuery();
  return (
    <>
      <PageHeading
        eyebrow={t("support")}
        title={t("supportTitle")}
        description={t("supportSubtitle")}
      />
      <div className="grid gap-5 xl:grid-cols-[.9fr_1.1fr]">
        <div className="panel">
          <form
            onSubmit={e => {
              e.preventDefault();
              create.mutate({
                subject,
                description,
                screenshotData: screenshot || undefined,
              });
            }}
          >
            <label>
              <span className="field-label">{t("subject")}</span>
              <input
                required
                className="field"
                value={subject}
                onChange={e => setSubject(e.target.value)}
              />
            </label>
            <label className="mt-4 block">
              <span className="field-label">{t("description")}</span>
              <textarea
                required
                className="field min-h-32 py-3"
                value={description}
                onChange={e => setDescription(e.target.value)}
              />
            </label>
            <label className="mt-4 block">
              <span className="field-label">{t("proof")}</span>
              <input
                className="field h-auto py-2"
                type="file"
                accept="image/*"
                onChange={async e => {
                  const file = e.target.files?.[0];
                  if (file) setScreenshot(await toDataUrl(file));
                }}
              />
            </label>
            <button
              disabled={create.isPending}
              className="mt-5 h-11 w-full rounded-xl bg-amber-300 text-sm font-bold text-slate-950"
            >
              {t("submitTicket")}
            </button>
          </form>
        </div>
        <div className="panel">
          <p className="eyebrow">{t("ticketStatus")}</p>
          {tickets.data?.length ? (
            <div className="mt-3 space-y-3">
              {tickets.data.map((ticket: any) => (
                <div
                  className="rounded-2xl border border-white/10 bg-slate-950/15 p-4"
                  key={ticket.id}
                >
                  <div className="flex justify-between gap-3">
                    <p className="font-bold">{ticket.subject}</p>
                    <span
                      className={`h-fit rounded-full px-2 py-1 text-[10px] font-bold ${statusClass(ticket.status)}`}
                    >
                      {ticket.status}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-300">
                    {ticket.description}
                  </p>
                  {ticket.adminResponse && (
                    <div className="mt-3 rounded-xl bg-emerald-400/10 p-3 text-sm text-emerald-100">
                      <p className="text-xs font-bold text-emerald-300">
                        {t("response")}
                      </p>
                      {ticket.adminResponse}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <Empty text={t("noTickets")} />
          )}
        </div>
      </div>
    </>
  );
}

function MobileNavigation({ nav, active, t, onSelect, isAdmin }: any) {
  const items = [
    ...nav.filter((item: any) => isMemberBottomNavigationId(item.id)),
    ...(isAdmin ? [{ id: "admin", icon: ShieldCheck, label: "admin" }] : []),
  ];
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-white/10 bg-[#102621]/95 px-1 pb-[max(env(safe-area-inset-bottom),.3rem)] pt-1 backdrop-blur-xl lg:hidden">
      {items.map((item: any) => {
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            onClick={() => onSelect(item.id)}
            className={`flex min-w-0 flex-1 flex-col items-center gap-1 rounded-lg px-1 py-2 text-[9px] font-bold ${active === item.id ? "text-amber-300" : "text-slate-500"}`}
          >
            <Icon className="size-4" />
            <span className="truncate">{t(item.label)}</span>
          </button>
        );
      })}
    </nav>
  );
}
function MobileDrawer({
  nav,
  active,
  t,
  isAdmin,
  onSelect,
  onClose,
  onLogout,
}: any) {
  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm lg:hidden">
      <div className="ml-auto flex h-full w-[min(20rem,88vw)] flex-col bg-[#15332b] p-4 shadow-2xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BrandMark />
            <p className="font-bold">{t("brand")}</p>
          </div>
          <button
            onClick={onClose}
            className="grid size-9 place-items-center rounded-xl bg-white/5"
          >
            <X className="size-4" />
          </button>
        </div>
        <nav className="mt-6">
          {nav.map((item: any) => (
            <NavButton
              key={item.id}
              item={item}
              active={active === item.id}
              onClick={() => onSelect(item.id)}
              label={t(item.label)}
            />
          ))}
          {isAdmin && (
            <NavButton
              item={{ id: "admin", icon: ShieldCheck }}
              active={active === "admin"}
              onClick={() => onSelect("admin")}
              label={t("admin")}
            />
          )}
        </nav>
        <button onClick={onLogout} className="mt-auto nav-item text-red-200">
          <LogOut className="size-4" />
          {t("logout")}
        </button>
      </div>
    </div>
  );
}
