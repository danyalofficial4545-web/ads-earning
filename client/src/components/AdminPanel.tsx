import { trpc } from "@/lib/trpc";
import { translate, type Language, type TranslationKey } from "@/lib/i18n";
import { toast } from "sonner";
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import {
  Check,
  Copy,
  ClipboardCheck,
  CreditCard,
  FileText,
  Loader2,
  LifeBuoy,
  Megaphone,
  Pencil,
  PlaySquare,
  Settings2,
  ShieldCheck,
  TicketCheck,
  Trash2,
  Users,
  X,
} from "lucide-react";

type Tab =
  | "depositHistory"
  | "withdrawalHistory"
  | "ads"
  | "packages"
  | "payments"
  | "broadcasts"
  | "users"
  | "settings"
  | "tickets"
  | "supportChats";
const tabItems: Array<{ id: Tab; label: string; icon: typeof ClipboardCheck }> =
  [
    { id: "depositHistory", label: "depositHistory", icon: CreditCard },
    { id: "withdrawalHistory", label: "withdrawalHistory", icon: ClipboardCheck },
    { id: "ads", label: "adSettings", icon: PlaySquare },
    { id: "packages", label: "packages", icon: ClipboardCheck },
    { id: "payments", label: "paymentAccounts", icon: CreditCard },
    { id: "broadcasts", label: "broadcast", icon: Megaphone },
    { id: "users", label: "users", icon: Users },
    { id: "settings", label: "settings", icon: Settings2 },
    { id: "tickets", label: "tickets", icon: TicketCheck },
    { id: "supportChats", label: "supportChats", icon: LifeBuoy },
  ];
const adminRoutes: Record<Tab, string> = {
  users: "/admin/users",
  depositHistory: "/admin/deposits",
  withdrawalHistory: "/admin/withdraws",
  ads: "/admin/ads",
  packages: "/admin/packages",
  payments: "/admin/payments",
  broadcasts: "/admin/broadcasts",
  settings: "/admin/settings",
  tickets: "/admin/tickets",
  supportChats: "/admin/support",
};
const routeTabs: Record<string, Tab> = {
  "/admin/users": "users",
  "/admin/deposits": "depositHistory",
  "/admin/withdraws": "withdrawalHistory",
  "/admin/withdrawals": "withdrawalHistory",
  "/admin/ads": "ads",
  "/admin/packages": "packages",
  "/admin/payments": "payments",
  "/admin/broadcasts": "broadcasts",
  "/admin/settings": "settings",
  "/admin/tickets": "tickets",
  "/admin/support": "supportChats",
};
const money = (amount: number) => `PKR ${amount.toLocaleString()}`;
const dateTime = (value: Date | string) =>
  new Date(value).toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short",
  });
const toDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
const statusClass = (value: string) =>
  value === "approved" || value === "completed" || value === "resolved"
    ? "bg-emerald-400/15 text-emerald-300"
    : value === "rejected"
      ? "bg-red-400/15 text-red-300"
      : "bg-amber-300/15 text-amber-200";
const statusKeys: Record<string, TranslationKey> = {
  pending: "pending",
  approved: "approved",
  rejected: "rejected",
  completed: "completed",
  open: "open",
  in_review: "inReview",
  resolved: "resolved",
};

export function AdminPanel({ t }: { t: (key: any) => string }) {
  const [tab, setTab] = useState<Tab>("depositHistory");
  const [location, navigate] = useLocation();
  const routeTab = routeTabs[location];
  const activeTab = routeTab ?? tab;
  useEffect(() => {
    if (routeTab) setTab(routeTab);
  }, [routeTab]);
  const selectTab = (next: Tab) => {
    setTab(next);
    navigate(adminRoutes[next] ?? "/admin");
  };
  const dashboard = trpc.admin.dashboard.useQuery();
  const metrics = [
    {
      key: "pendingDeposits",
      value: dashboard.data?.pendingDeposits ?? 0,
      icon: CreditCard,
    },
    {
      key: "pendingWithdrawals",
      value: dashboard.data?.pendingWithdrawals ?? 0,
      icon: ClipboardCheck,
    },
    {
      key: "openTickets",
      value: dashboard.data?.openTickets ?? 0,
      icon: TicketCheck,
    },
    { key: "members", value: dashboard.data?.userCount ?? 0, icon: Users },
  ];
  return (
    <>
      <div className="mb-6">
        <p className="eyebrow">{t("restrictedOperations")}</p>
        <h1 className="mt-2 flex items-center gap-2 text-3xl font-bold">
          <ShieldCheck className="size-7 text-amber-300" />
          {t("admin")}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
          {t("adminIntro")}
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map(({ key, value, icon: Icon }) => (
          <div className="panel" key={key}>
            <Icon className="size-4 text-amber-300" />
            <p className="mt-5 text-xs text-slate-400">{t(key)}</p>
            <p className="mt-1 text-2xl font-bold">{value}</p>
          </div>
        ))}
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {tabItems.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => selectTab(id)} className="panel flex items-center gap-3 p-4 text-left transition hover:-translate-y-0.5 hover:border-red-400/40">
            <span className="grid size-10 place-items-center rounded-xl bg-red-600 text-white"><Icon className="size-5" /></span>
            <span className="font-bold">{t(label)}</span>
          </button>
        ))}
      </div>
      <div className="mt-5 grid gap-5 xl:grid-cols-[210px_1fr]">
        <aside className="panel h-fit p-2">
          <nav>
            {tabItems.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => selectTab(id)}
                className={`nav-item mb-1 w-full text-left ${activeTab === id ? "nav-item-active" : ""}`}
              >
                <Icon className="size-4" />
                {t(label)}
              </button>
            ))}
          </nav>
        </aside>
        <section className="min-w-0">
          {activeTab === "depositHistory" && (
            <Approvals t={t} mode="deposits" onChange={() => dashboard.refetch()} />
          )}
          {activeTab === "withdrawalHistory" && (
            <Approvals t={t} mode="withdrawals" onChange={() => dashboard.refetch()} />
          )}
          {activeTab === "ads" && <Ads t={t} />}
          {activeTab === "packages" && <PackageCatalog t={t} />}
          {activeTab === "payments" && <Payments t={t} />}
          {activeTab === "broadcasts" && <Broadcasts t={t} />}
          {activeTab === "users" && <UserManagement t={t} />}
          {activeTab === "settings" && <GlobalSettings t={t} />}
          {activeTab === "tickets" && <Tickets t={t} />}
          {activeTab === "supportChats" && <SupportChats t={t} />}
        </section>
      </div>
    </>
  );
}

function PackageCatalog({ t }: any) {
  const list = trpc.package.list.useQuery();
  const packages = [...(list.data ?? [])].sort((a, b) => a.pricePkr - b.pricePkr);
  return (
    <>
      <Heading title={t("packages")} description={t("packageSubtitle")} />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {packages.map(plan => (
          <div key={plan.id} className="panel border-t-4 border-red-600 p-4">
            <p className="text-sm font-bold">{plan.name}</p>
            <p className="mt-2 text-2xl font-black text-red-600">{money(plan.pricePkr)}</p>
            <p className="mt-3 text-sm font-bold">
              {plan.dailyAds} {plan.dailyAds === 1 ? t("ad") : t("ads")} · {money(plan.adRewardPkr)} / {t("ad")}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              {t("totalDailyEarning")}: {money(plan.dailyAds * plan.adRewardPkr)}
            </p>
          </div>
        ))}
      </div>
    </>
  );
}

function Heading({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="mb-4">
      <h2 className="mt-1 text-2xl font-bold">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-300">{description}</p>
    </div>
  );
}
function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/15 p-8 text-center text-sm text-slate-400">
      {children}
    </div>
  );
}
function CopyRecordValue({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          toast.success("Copied");
        } catch {
          toast.error("Copy failed");
        }
      }}
      className="inline-flex h-10 items-center gap-2 rounded-lg border border-red-400/25 bg-red-50 px-3 text-xs font-bold text-red-700 transition hover:bg-red-100"
    >
      <Copy className="size-4" />
      {label}
    </button>
  );
}
function Button({
  onClick,
  children,
  danger,
  disabled,
}: {
  onClick: () => void;
  children: React.ReactNode;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-bold disabled:opacity-50 ${danger ? "bg-red-400/15 text-red-200" : "bg-amber-300 text-slate-950"}`}
    >
      {children}
    </button>
  );
}
function Pill({
  children,
  status,
}: {
  children: React.ReactNode;
  status: string;
}) {
  const language =
    typeof window === "undefined"
      ? "en"
      : (localStorage.getItem("pep-language") as Language) || "en";
  const label =
    typeof children === "string" && statusKeys[children]
      ? translate(language, statusKeys[children])
      : children;
  return (
    <span
      className={`rounded-full px-2 py-1 text-[10px] font-bold ${statusClass(status)}`}
    >
      {label}
    </span>
  );
}

function Approvals({ t, onChange, mode }: any) {
  const data = trpc.admin.financialRequests.useQuery();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const utils = trpc.useUtils();
  const refresh = () => {
    data.refetch();
    onChange();
    utils.wallet.transactions.invalidate();
  };
  const deposit = trpc.admin.reviewDeposit.useMutation({
    onSuccess: refresh,
    onError: e => toast.error(e.message),
  });
  const withdrawal = trpc.admin.reviewWithdrawal.useMutation({
    onSuccess: refresh,
    onError: e => toast.error(e.message),
  });
  const deleteDeposit = trpc.admin.deleteDepositHistory.useMutation({
    onSuccess: refresh,
    onError: e => toast.error(e.message),
  });
  const deleteWithdrawal = trpc.admin.deleteWithdrawalHistory.useMutation({
    onSuccess: refresh,
    onError: e => toast.error(e.message),
  });
  const filteredRows = (rows: any[]) => {
    const query = search.trim().toLowerCase();
    return rows.filter(row => {
      const searchable = [
        row.member?.username,
        row.member?.email,
        row.senderAccountNumber,
        row.accountDetails,
        row.transactionId,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return (statusFilter === "all" || row.status === statusFilter) &&
        (!query || searchable.includes(query));
    });
  };
  const rows = mode === "deposits"
    ? filteredRows(data.data?.deposits ?? [])
    : filteredRows(data.data?.withdrawals ?? []);
  return (
    <>
      <Heading
        title={mode === "deposits" ? t("depositHistory") : t("withdrawalHistory")}
        description={mode === "deposits" ? t("depositHistoryText") : t("withdrawalHistoryText")}
      />
      <div className="space-y-5">
        <div className="panel flex flex-col gap-3 sm:flex-row">
          <input className="field" value={search} onChange={event => setSearch(event.target.value)} placeholder={mode === "deposits" ? "Search username, phone, or transaction ID" : "Search username or wallet number"} />
          <select className="field sm:max-w-44" value={statusFilter} onChange={event => setStatusFilter(event.target.value)}>
            <option value="all">All statuses</option><option value="pending">{t("pending")}</option><option value="approved">{t("approved")}</option><option value="rejected">{t("rejected")}</option>
          </select>
        </div>
        <div className={mode === "deposits" ? "panel" : "hidden"}>
          <h3 className="font-bold">{t("depositHistory")}</h3>
          {rows.length ? (
            <div className="mt-4 space-y-3">
              {rows.map(row => (
                <div
                  key={row.id}
                  className="rounded-2xl border border-white/10 bg-slate-950/15 p-4"
                >
                  <div className="flex flex-wrap justify-between gap-3">
                    <div>
                      <p className="font-bold">
                        {money(row.amountPkr)} · {row.method}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        {row.member?.username ?? t("member")} · {row.member?.email ?? `#${row.userId}`} · {dateTime(row.createdAt)}
                      </p>
                      <p className="mt-2 text-xs leading-5 text-slate-300">
                        {t("senderAccountName")}: {row.senderAccountName ?? "—"} · {t("senderAccountNumber")}: {row.senderAccountNumber ?? "—"}<br />
                        {t("transactionId")}: {row.transactionId ?? "—"} · {t("requestedPackage")}: {row.requestedPackageName ?? t("walletDeposit")}<br />
                        {t("activePackage")}: {row.member?.activePackageName ?? t("noPackage")}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <CopyRecordValue label={t("senderAccountName")} value={row.senderAccountName} />
                        <CopyRecordValue label={t("senderAccountNumber")} value={row.senderAccountNumber} />
                        <CopyRecordValue label={t("transactionId")} value={row.transactionId} />
                      </div>
                    </div>
                    <Pill status={row.status}>{row.status}</Pill>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(row.proofData || row.proofUrl) && (
                      <a
                        href={row.proofData || row.proofUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 text-xs font-bold"
                      >
                        <FileText className="size-3.5" />
                        {t("viewProof")}
                      </a>
                    )}
                    {row.status === "pending" && (
                      <>
                        <Button
                          onClick={() =>
                            deposit.mutate({ id: row.id, approved: true })
                          }
                        >
                          <Check className="size-3.5" />
                          {t("approve")}
                        </Button>
                        <Button
                          danger
                          onClick={() =>
                            deposit.mutate({ id: row.id, approved: false })
                          }
                        >
                          <X className="size-3.5" />
                          {t("reject")}
                        </Button>
                      </>
                    )}
                    {row.status !== "pending" && (
                      <Button
                        danger
                        onClick={() => {
                          if (window.confirm(t("confirmDeleteHistory")))
                            deleteDeposit.mutate({ id: row.id });
                        }}
                        disabled={deleteDeposit.isPending}
                      >
                        <Trash2 className="size-3.5" />
                        {t("deleteRecord")}
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Empty>{t("noDepositRequests")}</Empty>
          )}
        </div>
        <div className={mode === "withdrawals" ? "panel" : "hidden"}>
          <h3 className="font-bold">{t("withdrawalHistory")}</h3>
          {rows.length ? (
            <div className="mt-4 space-y-3">
              {rows.map(row => (
                <div
                  key={row.id}
                  className="rounded-2xl border border-white/10 bg-slate-950/15 p-4"
                >
                  <div className="flex flex-wrap justify-between gap-3">
                    <div>
                      <p className="font-bold">
                        {money(row.amountPkr)} · {row.currency}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        {row.member?.username ?? t("member")} · {row.member?.email ?? `#${row.userId}`} · {t("paymentMethod")}: {row.currency} · {dateTime(row.createdAt)}
                      </p>
                      <p className="mt-2 text-xs leading-5 text-slate-300">
                        {t("walletType")}: {row.walletType} · {t("walletAccountName")}: {row.accountName} · {t("walletNumber")}: {row.accountDetails}<br />
                        {t("balance")}: {money(row.member?.balancePkr ?? 0)} · {t("referralCount")}: {row.member?.referralCount ?? 0}<br />
                        {t("withdrawalLimit")}: {money(row.member?.withdrawalLimitPkr ?? 0)} · {t("activePackage")}: {row.member?.activePackageName ?? t("noPackage")}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <CopyRecordValue label={t("walletAccountName")} value={row.accountName} />
                        <CopyRecordValue label={t("copyNumber")} value={row.accountDetails} />
                        <CopyRecordValue
                          label={t("copyDetails")}
                          value={[row.walletType, row.accountName, row.accountDetails, `${row.amountPkr} ${row.currency}`].filter(Boolean).join("\n")}
                        />
                      </div>
                    </div>
                    <Pill status={row.status}>{row.status}</Pill>
                  </div>
                  {row.status === "pending" && (
                    <div className="mt-3 flex gap-2">
                      <Button
                        onClick={() =>
                          withdrawal.mutate({ id: row.id, approved: true })
                        }
                      >
                        <Check className="size-3.5" />
                        {t("approve")}
                      </Button>
                      <Button
                        danger
                        onClick={() =>
                          withdrawal.mutate({ id: row.id, approved: false })
                        }
                      >
                        <X className="size-3.5" />
                        {t("reject")}
                      </Button>
                    </div>
                  )}
                  {row.status !== "pending" && (
                    <div className="mt-3">
                      <Button
                        danger
                        onClick={() => {
                          if (window.confirm(t("confirmDeleteHistory")))
                            deleteWithdrawal.mutate({ id: row.id });
                        }}
                        disabled={deleteWithdrawal.isPending}
                      >
                        <Trash2 className="size-3.5" />
                        {t("deleteRecord")}
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <Empty>{t("noWithdrawalRequests")}</Empty>
          )}
        </div>
      </div>
    </>
  );
}

function Ads({ t }: any) {
  return (
    <>
      <Heading
        title={t("adSettings")}
        description={t("adsterraCodeNote")}
      />
      <div className="panel">
          <p className="font-bold">{t("adsterraCodes")}</p>
          <p className="mt-2 text-xs leading-5 text-slate-400">{t("adsterraCodeNote")}</p>
          <div className="mt-4 space-y-2 text-xs text-slate-300">
            <code className="block break-all rounded-xl bg-slate-950/35 p-3">pl31018972.profitableratecpmnetwork.com/c3/93/94/c39394501da20cecb09000e829b5b01d.js</code>
            <code className="block break-all rounded-xl bg-slate-950/35 p-3">pl31018973.profitableratecpmnetwork.com/b0/f7/85/b0f7854db95a963d43c8aa42ca3332f3.js</code>
          </div>
      </div>
    </>
  );
}

function Payments({ t }: any) {
  const list = trpc.admin.paymentAccounts.useQuery();
  const blank = {
    currency: "PKR" as "PKR" | "USD",
    provider: "",
    accountName: "",
    accountDetails: "",
    isActive: true,
  };
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState(blank);
  const save = trpc.admin.savePaymentAccount.useMutation({
    onSuccess: () => {
      toast.success(t("saved"));
      list.refetch();
      setEditing(null);
      setForm(blank);
    },
    onError: e => toast.error(e.message),
  });
  const remove = trpc.admin.deletePaymentAccount.useMutation({
    onSuccess: () => list.refetch(),
    onError: e => toast.error(e.message),
  });
  return (
    <>
      <Heading
        title={t("paymentAccounts")}
        description={t("paymentAccountsText")}
      />
      <div className="grid gap-5 xl:grid-cols-[.85fr_1.15fr]">
        <form
          className="panel space-y-3"
          onSubmit={e => {
            e.preventDefault();
            save.mutate({ ...(editing ? { id: editing.id } : {}), ...form });
          }}
        >
          <p className="font-bold">
            {editing ? t("editPaymentAccount") : t("addPaymentAccount")}
          </p>
          <Field label={t("currency")}>
            <select
              className="field"
              value={form.currency}
              onChange={e =>
                setForm({ ...form, currency: e.target.value as any })
              }
            >
              <option value="PKR">PKR</option>
              <option value="USD">USD</option>
            </select>
          </Field>
          <Field label={t("paymentMethodName")}>
            <input
              required
              className="field"
              value={form.provider}
              onChange={e => setForm({ ...form, provider: e.target.value })}
            />
          </Field>
          <Field label={t("paymentAccountHolder")}>
            <input
              required
              className="field"
              value={form.accountName}
              onChange={e => setForm({ ...form, accountName: e.target.value })}
            />
          </Field>
          <Field label={t("paymentAccountCode")}>
            <input
              required
              className="field"
              value={form.accountDetails}
              onChange={e =>
                setForm({ ...form, accountDetails: e.target.value })
              }
            />
          </Field>
          <label className="flex gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={e => setForm({ ...form, isActive: e.target.checked })}
            />
            {t("active")}
          </label>
          <button
            disabled={save.isPending}
            className="h-9 rounded-lg bg-amber-300 px-3 text-xs font-bold text-slate-950"
          >
            {editing ? t("updateAccount") : t("saveAccount")}
          </button>
        </form>
        <div className="panel">
          <p className="font-bold">{t("configuredAccounts")}</p>
          <div className="mt-4 space-y-3">
            {list.data?.map(row => (
              <div
                key={row.id}
                className="flex justify-between gap-3 rounded-2xl border border-white/10 bg-slate-950/15 p-4"
              >
                <div>
                  <p className="font-bold">
                    {row.provider}{" "}
                    <span className="text-xs text-amber-300">
                      {row.currency}
                    </span>
                  </p>
                  <p className="mt-1 text-sm text-slate-300">
                    {row.accountName} · {row.accountDetails}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(row);
                      setForm({
                        currency: row.currency,
                        provider: row.provider,
                        accountName: row.accountName,
                        accountDetails: row.accountDetails,
                        isActive: row.isActive,
                      });
                    }}
                    className="grid size-8 place-items-center rounded-lg bg-white/5"
                  >
                    <Pencil className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => remove.mutate({ id: row.id })}
                    className="grid size-8 place-items-center rounded-lg bg-red-400/15 text-red-200"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

function Broadcasts({ t }: any) {
  const list = trpc.admin.broadcasts.useQuery();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const send = trpc.admin.createBroadcast.useMutation({
    onSuccess: () => {
      toast.success(t("saved"));
      list.refetch();
      setTitle("");
      setBody("");
      setMediaUrl("");
    },
    onError: e => toast.error(e.message),
  });
  return (
    <>
      <Heading title={t("broadcast")} description={t("broadcastText")} />
      <div className="grid gap-5 xl:grid-cols-[.85fr_1.15fr]">
        <form
          className="panel space-y-3"
          onSubmit={e => {
            e.preventDefault();
            send.mutate({ title, body, mediaUrl: mediaUrl || undefined });
          }}
        >
          <Field label={t("title")}>
            <input
              required
              className="field"
              value={title}
              onChange={e => setTitle(e.target.value)}
            />
          </Field>
          <Field label={t("message")}>
            <textarea
              required
              className="field min-h-36 py-3"
              value={body}
              onChange={e => setBody(e.target.value)}
            />
          </Field>
          <Field label={t("mediaUrl")}>
            <input
              className="field"
              value={mediaUrl}
              onChange={e => setMediaUrl(e.target.value)}
            />
          </Field>
          <button
            disabled={send.isPending}
            className="h-9 rounded-lg bg-amber-300 px-3 text-xs font-bold text-slate-950"
          >
            {t("publishBroadcast")}
          </button>
        </form>
        <div className="panel">
          <p className="font-bold">{t("publishedMessages")}</p>
          {list.data?.length ? (
            <div className="mt-4 space-y-3">
              {list.data.map(row => (
                <div
                  key={row.id}
                  className="rounded-2xl border border-white/10 bg-slate-950/15 p-4"
                >
                  <p className="font-bold">{row.title}</p>
                  <p className="mt-2 text-sm text-slate-300">{row.body}</p>
                  <p className="mt-3 text-xs text-slate-500">
                    {dateTime(row.createdAt)}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <Empty>{t("noBroadcasts")}</Empty>
          )}
        </div>
      </div>
    </>
  );
}

function UserManagement({ t }: any) {
  const list = trpc.admin.users.useQuery();
  const [search, setSearch] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const detail = trpc.admin.userDetail.useQuery(
    { userId: selectedUserId ?? 0 },
    { enabled: selectedUserId !== null }
  );
  const block = trpc.admin.setBlocked.useMutation({
    onSuccess: () => list.refetch(),
    onError: e => toast.error(e.message),
  });
  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return list.data ?? [];
    return (list.data ?? []).filter(row =>
      [row.profile.username, row.email, String(row.id)]
        .filter(Boolean)
        .some(value => String(value).toLowerCase().includes(query))
    );
  }, [list.data, search]);
  return (
    <>
      <Heading
        title={t("memberMonitoring")}
        description={t("memberMonitoringText")}
      />
      <div className="panel overflow-x-auto">
        <div className="mb-4 max-w-md">
          <input
            className="field"
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder="Search username, Gmail, or user ID"
            aria-label="Search users"
          />
        </div>
        <table className="w-full min-w-[700px] text-left text-sm">
          <thead className="border-b border-white/10 text-xs text-slate-400">
            <tr>
              <th className="pb-3">{t("member")}</th>
              <th className="pb-3">{t("wallet")}</th>
              <th className="pb-3">{t("withdrawalLimit")}</th>
              <th className="pb-3">{t("referral")}</th>
              <th className="pb-3">{t("access")}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map(row => (
              <tr key={row.id} className="border-b border-white/5">
                <td className="py-4">
                  <p className="font-bold">{row.profile.username}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {row.email ?? "—"} · #{row.id}
                  </p>
                </td>
                <td>{money(row.profile.balancePkr)}</td>
                <td>{money(row.profile.withdrawalLimitPkr)}</td>
                <td>{row.profile.referralCode}</td>
                <td>
                  <Pill
                    status={row.profile.isBlocked ? "rejected" : "approved"}
                  >
                    {row.profile.isBlocked ? t("block") : t("active")}
                  </Pill>
                </td>
                <td className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button onClick={() => setSelectedUserId(row.id)}>{t("viewDetails")}</Button>
                    <Button danger={!row.profile.isBlocked} onClick={() => block.mutate({ userId: row.id, blocked: !row.profile.isBlocked })}>
                      {row.profile.isBlocked ? t("unblock") : t("block")}
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {selectedUserId && <div className="panel mt-5">
        {detail.isLoading ? <Loader2 className="animate-spin text-amber-300" /> : detail.data ? <>
          <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="eyebrow">{t("viewDetails")}</p><h3 className="mt-1 text-xl font-bold">{detail.data.member.profile.username}</h3><p className="mt-1 text-sm text-slate-400">{detail.data.member.email ?? "—"}</p></div><Button onClick={() => setSelectedUserId(null)}>{t("close")}</Button></div>
          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4"><div className="rounded-xl bg-slate-950/15 p-3 text-sm"><p className="text-xs text-slate-400">{t("balance")}</p><p className="mt-1 font-bold">{money(detail.data.member.profile.balancePkr)}</p></div><div className="rounded-xl bg-slate-950/15 p-3 text-sm"><p className="text-xs text-slate-400">{t("accountPasswordStatus")}</p><p className="mt-1 font-bold">{detail.data.member.passwordStatus === "set" ? t("setPassword") : "—"}</p></div><div className="rounded-xl bg-slate-950/15 p-3 text-sm"><p className="text-xs text-slate-400">{t("activePackage")}</p><p className="mt-1 font-bold">{detail.data.activePackage?.name ?? t("noPackage")}</p></div><div className="rounded-xl bg-slate-950/15 p-3 text-sm"><p className="text-xs text-slate-400">{t("referralCount")}</p><p className="mt-1 font-bold">{detail.data.totals.referralCount}</p></div></div>
          <div className="mt-5 grid gap-4 lg:grid-cols-3"><HistorySummary title={t("totalDeposits")} amount={detail.data.totals.depositAmountPkr} count={detail.data.totals.depositCount} rows={detail.data.deposits} /><HistorySummary title={t("totalWithdrawals")} amount={detail.data.totals.withdrawalAmountPkr} count={detail.data.totals.withdrawalCount} rows={detail.data.withdrawals} /><HistorySummary title={t("referral")} amount={detail.data.referralEarnings.reduce((sum: number, row: any) => sum + row.amountPkr, 0)} count={detail.data.referralEarnings.length} rows={detail.data.referralEarnings} /></div>
        </> : <Empty>{t("noTransactions")}</Empty>}
      </div>}
    </>
  );
}

function HistorySummary({ title, amount, count, rows }: { title: string; amount: number; count: number; rows: any[] }) {
  return <div className="rounded-2xl border border-white/10 bg-slate-950/15 p-4"><p className="text-xs text-slate-400">{title}</p><p className="mt-1 text-lg font-bold">{money(amount)} · {count}</p><div className="mt-3 max-h-36 space-y-2 overflow-y-auto text-xs text-slate-300">{rows.length ? rows.map((row: any) => <p key={row.id}>{money(row.amountPkr)} · {dateTime(row.createdAt)} · {row.status ?? row.type}</p>) : <p className="text-slate-500">—</p>}</div></div>;
}

function GlobalSettings({ t }: any) {
  const query = trpc.admin.settings.useQuery();
  const [form, setForm] = useState<any>(null);
  const [logoData, setLogoData] = useState("");
  const values = form ?? query.data;
  const saveText = trpc.admin.saveSettings.useMutation({
    onSuccess: () => {
      toast.success(t("saved"));
      query.refetch();
    },
    onError: e => toast.error(e.message),
  });
  const saveLogo = trpc.admin.saveBrandLogo.useMutation({
    onSuccess: () => {
      setLogoData("");
      toast.success(t("saved"));
      query.refetch();
    },
    onError: e => toast.error(e.message),
  });
  if (!values)
    return (
      <div className="panel">
        <Loader2 className="animate-spin text-amber-300" />
      </div>
    );
  const field = (label: string, key: string) => (
    <Field label={label} key={key}>
      <input
        className="field"
        type="number"
        value={values[key]}
        onChange={e => setForm({ ...values, [key]: Number(e.target.value) })}
      />
    </Field>
  );
  return (
    <>
      <Heading
        title={t("globalEarningSettings")}
        description={t("globalEarningSettingsText")}
      />
      <form
        className="panel"
        onSubmit={e => {
          e.preventDefault();
          saveText.mutate(values);
        }}
      >
        <div className="mb-5 rounded-2xl border border-amber-300/15 bg-amber-300/10 p-4">
          <p className="font-bold">{t("websiteSettings")}</p>
          <div className="mt-3 grid gap-4 md:grid-cols-2">
            <Field label={t("websiteName")}>
              <input className="field" value={values.websiteName ?? "Ads Earning"} onChange={e => setForm({ ...values, websiteName: e.target.value })} />
            </Field>
            <Field label={t("themeSettings")}>
              <select className="field" value={values.themeName ?? "green"} onChange={e => setForm({ ...values, themeName: e.target.value })}>
                <option value="green">{t("greenTheme")}</option>
                <option value="blue">{t("blueTheme")}</option>
                <option value="dark">{t("darkTheme")}</option>
                <option value="white">{t("whiteTheme")}</option>
                <option value="black">{t("blackTheme")}</option>
                <option value="red">{t("redTheme")}</option>
                <option value="yellow">{t("yellowTheme")}</option>
              </select>
            </Field>
          </div>
        </div>
        <div className="mb-5 rounded-2xl border border-white/10 bg-slate-950/15 p-4">
          <p className="font-bold">{t("websiteLogo")}</p>
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <input className="field h-auto max-w-md py-2" type="file" accept="image/*" onChange={async e => { const file = e.target.files?.[0]; if (file) setLogoData(await toDataUrl(file)); }} />
            <button type="button" disabled={!logoData || saveLogo.isPending} onClick={() => saveLogo.mutate({ logoData })} className="inline-flex h-10 items-center gap-2 rounded-xl bg-amber-300 px-4 text-sm font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-50"><Settings2 className="size-4" />{t("save")}</button>
            {(values.logoData || values.logoUrl) && <a className="self-end pb-2 text-sm font-bold text-amber-300" href={values.logoData || values.logoUrl} target="_blank" rel="noreferrer">{t("viewProof")}</a>}
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {field(t("pkrPerUsd"), "exchangeRatePkrPerUsd")}
          {field(t("referralCommission"), "referralCommissionPercent")}
        </div>
        <button
          disabled={saveText.isPending}
          className="mt-5 inline-flex h-10 items-center gap-2 rounded-xl bg-amber-300 px-4 text-sm font-bold text-slate-950"
        >
          <Settings2 className="size-4" />
          {t("saveGlobalSettings")}
        </button>
      </form>
    </>
  );
}

function Tickets({ t }: any) {
  const list = trpc.admin.tickets.useQuery();
  const [selected, setSelected] = useState<any>(null);
  const [response, setResponse] = useState("");
  const [status, setStatus] = useState<"open" | "in_review" | "resolved">(
    "in_review"
  );
  const save = trpc.admin.respondTicket.useMutation({
    onSuccess: () => {
      toast.success(t("saved"));
      list.refetch();
      setSelected(null);
    },
    onError: e => toast.error(e.message),
  });
  return (
    <>
      <Heading
        title={t("supportTickets")}
        description={t("supportTicketsText")}
      />
      <div className="grid gap-5 xl:grid-cols-[1.05fr_.95fr]">
        <div className="panel space-y-3">
          {list.data?.map(row => (
            <button
              key={row.id}
              type="button"
              onClick={() => {
                setSelected(row);
                setResponse(row.adminResponse ?? "");
                setStatus(row.status);
              }}
              className={`w-full rounded-2xl border p-4 text-left ${selected?.id === row.id ? "border-amber-300/60 bg-amber-300/10" : "border-white/10 bg-slate-950/15"}`}
            >
              <div className="flex justify-between gap-3">
                <p className="font-bold">{row.subject}</p>
                <Pill status={row.status}>{row.status}</Pill>
              </div>
              <p className="mt-2 line-clamp-2 text-sm text-slate-300">
                {row.description}
              </p>
            </button>
          ))}
        </div>
        <div className="panel">
          {selected ? (
            <form
              className="space-y-3"
              onSubmit={e => {
                e.preventDefault();
                save.mutate({
                  id: selected.id,
                  status,
                  response: response || undefined,
                });
              }}
            >
              <p className="font-bold">{selected.subject}</p>
              <p className="text-sm text-slate-300">{selected.description}</p>
              {(selected.screenshotData || selected.screenshotUrl) && (
                <a
                  target="_blank"
                  rel="noreferrer"
                  href={selected.screenshotData || selected.screenshotUrl}
                  className="text-sm font-bold text-amber-300 underline"
                >
                  {t("viewScreenshot")}
                </a>
              )}
              <Field label={t("ticketStatus")}>
                <select
                  className="field"
                  value={status}
                  onChange={e => setStatus(e.target.value as any)}
                >
                  <option value="open">{t("open")}</option>
                  <option value="in_review">{t("inReview")}</option>
                  <option value="resolved">{t("resolved")}</option>
                </select>
              </Field>
              <Field label={t("adminResponse")}>
                <textarea
                  className="field min-h-32 py-3"
                  value={response}
                  onChange={e => setResponse(e.target.value)}
                />
              </Field>
              <button
                disabled={save.isPending}
                className="h-9 rounded-lg bg-amber-300 px-3 text-xs font-bold text-slate-950"
              >
                {t("saveTicketResponse")}
              </button>
            </form>
          ) : (
            <Empty>{t("selectTicket")}</Empty>
          )}
        </div>
      </div>
    </>
  );
}

function SupportChats({ t }: any) {
  const [search, setSearch] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [reply, setReply] = useState("");
  const queryInput = useMemo(() => ({ search: search.trim() || undefined }), [search]);
  const list = trpc.admin.supportChats.useQuery(queryInput);
  const send = trpc.admin.supportChatReply.useMutation({
    onSuccess: () => {
      toast.success(t("saved"));
      setReply("");
      list.refetch();
    },
    onError: () => toast.error(t("operationFailed")),
  });
  const selected = list.data?.find((chat: any) => chat.userId === selectedUserId) ?? list.data?.[0];
  return (
    <>
      <Heading title={t("supportChats")} description={t("supportChatsText")} />
      <div className="mb-4 flex gap-2">
        <input className="field" value={search} onChange={e => setSearch(e.target.value)} placeholder={t("searchSupportChats")} aria-label={t("searchSupportChats")} />
      </div>
      <div className="grid gap-4 xl:grid-cols-[.75fr_1.25fr]">
        <div className="panel space-y-2">
          {list.isLoading ? <Loader2 className="size-5 animate-spin text-amber-300" /> : list.data?.length ? list.data.map((chat: any) => {
            const last = chat.messages[chat.messages.length - 1];
            return <button type="button" key={chat.userId} onClick={() => setSelectedUserId(chat.userId)} className={`w-full rounded-xl border p-3 text-left transition ${selected?.userId === chat.userId ? "border-red-400/60 bg-red-400/10" : "border-white/10 bg-white/5 hover:border-red-400/30"}`}>
              <div className="flex items-center justify-between gap-2"><span className="font-bold">{chat.username ?? chat.email ?? `User ${chat.userId}`}</span><span className="text-[10px] text-slate-400">{chat.messages.length}</span></div>
              <p className="mt-1 truncate text-xs text-slate-400">{last?.content}</p>
            </button>;
          }) : <Empty>{t("noSupportChats")}</Empty>}
        </div>
        {selected ? <div className="panel">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3"><div><p className="font-bold">{selected.username ?? selected.email}</p><p className="text-xs text-slate-400">{selected.email ?? ""}</p></div><div className="text-right text-xs text-slate-300"><p>{t("balance")}: {money(selected.balancePkr)}</p><p>{t("activePackage")}: {selected.activePackage ?? t("noPackage")}</p></div></div>
          <div className="mt-4 max-h-[420px] space-y-3 overflow-y-auto pr-1">{selected.messages.map((message: any) => <div key={message.id} className={`rounded-xl p-3 text-sm ${message.role === "user" ? "ml-6 bg-red-600/20 text-red-50" : message.role === "admin" ? "mr-6 bg-amber-300/10 text-amber-50" : "mr-6 bg-white/10 text-slate-100"}`}><p className="mb-1 text-[10px] font-bold uppercase text-slate-400">{message.role === "user" ? t("member") : message.role === "admin" ? t("administrator") : "AI Support"}</p>{message.content}</div>)}</div>
          <form className="mt-4 flex gap-2" onSubmit={e => { e.preventDefault(); if (reply.trim()) send.mutate({ userId: selected.userId, content: reply.trim() }); }}><input className="field" value={reply} onChange={e => setReply(e.target.value)} placeholder={t("adminSupportReply")} /><button type="submit" disabled={send.isPending || !reply.trim()} className="rounded-xl bg-red-600 px-4 text-sm font-bold text-white disabled:opacity-50">{t("sendReply")}</button></form>
        </div> : <Empty>{t("selectSupportChat")}</Empty>}
      </div>
    </>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="field-label">{label}</span>
      {children}
    </label>
  );
}
