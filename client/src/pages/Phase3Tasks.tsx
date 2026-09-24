import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useLocation } from "wouter";
import {
  ArrowLeft,
  ExternalLink,
  FileImage,
  Loader2,
  UploadCloud,
} from "lucide-react";
import { useState } from "react";

const coins = (value: number) => `${Math.max(0, value).toLocaleString()} Coins`;
const readDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

export function TimewallPage({ onGoTasks }: { onGoTasks: () => void }) {
  const config = trpc.timewall.config.useQuery();
  if (config.isLoading)
    return (
      <div className="panel">
        <Loader2 className="size-5 animate-spin text-amber-300" />
      </div>
    );
  if (config.error)
    return (
      <div className="panel text-red-200">
        Unable to load Timewall right now.
      </div>
    );
  const data = config.data!;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Earn Coins</p>
          <h1 className="mt-2 text-3xl font-black">Timewall Tasks</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
            Complete tasks in the wall below. Eligible rewards are credited to
            your Earning Wallet automatically.
          </p>
        </div>
        <div className="rounded-2xl border border-emerald-300/20 bg-emerald-300/10 px-5 py-4">
          <p className="text-xs text-emerald-200">Earning Wallet</p>
          <p className="mt-1 text-2xl font-black text-emerald-100">
            {coins(data.earningWalletBalance)}
          </p>
        </div>
      </div>
      {!data.hasActivePackage ? (
        <div className="panel border-amber-300/30 bg-amber-300/10">
          <h2 className="text-xl font-bold text-amber-100">
            Please Deposit &amp; Buy Package to Unlock Tasks
          </h2>
          <p className="mt-2 text-sm text-slate-300">
            Activate a package first, then Timewall will be available in this
            earning area.
          </p>
          <button
            onClick={onGoTasks}
            className="mt-4 rounded-xl bg-amber-300 px-4 py-2 text-sm font-bold text-slate-950"
          >
            View Manual Tasks
          </button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-900/70">
          <iframe
            title="Timewall"
            src={`https://timewall.io/wall/${encodeURIComponent(data.wallId)}?uid=${data.userId}`}
            className="h-[680px] w-full border-0"
            loading="lazy"
          />
        </div>
      )}
    </div>
  );
}

export function ManualTasksPage() {
  const [, navigate] = useLocation();
  const tasks = trpc.task.list.useQuery();
  const proofs = trpc.task.myProofs.useQuery();
  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow">Manual Tasks</p>
        <h1 className="mt-2 text-3xl font-black">High Profit Tasks</h1>
        <p className="mt-2 text-sm leading-6 text-slate-300">
          Complete the listed steps and submit a screenshot proof for admin
          review.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {tasks.isLoading ? (
          <Loader2 className="size-5 animate-spin text-amber-300" />
        ) : tasks.data?.length ? (
          tasks.data.map(task => (
            <button
              key={task.id}
              type="button"
              onClick={() => navigate(`/task/${task.id}`)}
              className="panel text-left transition hover:-translate-y-0.5 hover:border-amber-300/40"
            >
              {task.imageUrl &&
                (task.mediaType === "video" ? (
                  <video
                    src={task.imageUrl}
                    muted
                    autoPlay
                    loop
                    playsInline
                    className="mb-4 h-40 w-full rounded-xl object-cover"
                  />
                ) : (
                  <img
                    src={task.imageUrl}
                    alt=""
                    className="mb-4 h-40 w-full rounded-xl object-cover"
                  />
                ))}
              <p className="text-xs font-bold uppercase tracking-[.18em] text-amber-300">
                {coins(task.rewardCoins)}
              </p>
              <h2 className="mt-2 text-xl font-bold">{task.title}</h2>
              <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-300">
                {task.description}
              </p>
              <span className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-amber-200">
                View task <ExternalLink className="size-4" />
              </span>
            </button>
          ))
        ) : (
          <div className="panel text-sm text-slate-400">
            No manual tasks are active right now.
          </div>
        )}
      </div>
      <div className="panel">
        <h2 className="text-xl font-bold">My Proof History</h2>
        <div className="mt-4 space-y-3">
          {proofs.data?.length ? (
            proofs.data.map(proof => (
              <div
                key={proof.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 p-3"
              >
                <div>
                  <p className="font-bold">
                    {proof.task?.title ?? `Task #${proof.taskId}`}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    Game ID: {proof.gameUserId} ·{" "}
                    {new Date(proof.createdAt).toLocaleString()}
                  </p>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-bold ${proof.status === "approved" ? "bg-emerald-400/15 text-emerald-200" : proof.status === "rejected" ? "bg-red-400/15 text-red-200" : "bg-amber-300/15 text-amber-200"}`}
                >
                  {proof.status}
                </span>
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-400">No proofs submitted yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}

export function TaskDetailPage({
  taskId,
  onBack,
}: {
  taskId: number;
  onBack: () => void;
}) {
  const task = trpc.task.get.useQuery({ id: taskId });
  const utils = trpc.useUtils();
  const [gameUserId, setGameUserId] = useState("");
  const [screenshotData, setScreenshotData] = useState("");
  const submit = trpc.task.submitProof.useMutation({
    onSuccess: () => {
      toast.success("Proof submitted for admin review.");
      setGameUserId("");
      setScreenshotData("");
      void utils.task.myProofs.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  if (task.isLoading)
    return (
      <div className="panel">
        <Loader2 className="size-5 animate-spin text-amber-300" />
      </div>
    );
  if (!task.data)
    return <div className="panel text-red-200">Task was not found.</div>;
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-2 text-sm font-bold text-amber-200"
      >
        <ArrowLeft className="size-4" />
        Back to tasks
      </button>
      <article className="panel">
        {task.data.imageUrl &&
          (task.data.mediaType === "video" ? (
            <video
              src={task.data.imageUrl}
              controls
              autoPlay
              loop
              playsInline
              className="mb-5 max-h-80 w-full rounded-2xl object-contain"
            />
          ) : (
            <img
              src={task.data.imageUrl}
              alt=""
              className="mb-5 max-h-80 w-full rounded-2xl object-cover"
            />
          ))}
        <p className="eyebrow">Reward · {coins(task.data.rewardCoins)}</p>
        <h1 className="mt-2 text-3xl font-black">{task.data.title}</h1>
        <p className="mt-5 whitespace-pre-wrap text-sm leading-7 text-slate-200">
          {task.data.description}
        </p>
        <a
          href={task.data.playstoreLink}
          target="_blank"
          rel="noreferrer"
          className="mt-5 inline-flex items-center gap-2 rounded-xl border border-amber-300/30 bg-amber-300/10 px-4 py-3 text-sm font-bold text-amber-100"
        >
          <ExternalLink className="size-4" />
          Download / Open Task
        </a>
        <form
          className="mt-8 space-y-4 border-t border-white/10 pt-6"
          onSubmit={event => {
            event.preventDefault();
            if (!screenshotData) {
              toast.error("Upload a screenshot proof.");
              return;
            }
            submit.mutate({ taskId, gameUserId, screenshotData });
          }}
        >
          <label>
            <span className="field-label">Game User ID</span>
            <input
              className="field"
              required
              value={gameUserId}
              onChange={event => setGameUserId(event.target.value)}
              placeholder="Enter your game/app user ID"
            />
          </label>
          <label className="block">
            <span className="field-label">Screenshot proof</span>
            <span className="mt-2 flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-white/20 bg-white/5 p-4 text-sm text-slate-300">
              <FileImage className="size-5 text-amber-300" />
              {screenshotData ? "Screenshot selected" : "Choose screenshot"}
              <input
                className="hidden"
                type="file"
                accept="image/*"
                required
                onChange={async event => {
                  const file = event.target.files?.[0];
                  if (file) setScreenshotData(await readDataUrl(file));
                }}
              />
            </span>
          </label>
          <button
            disabled={submit.isPending}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-amber-300 text-sm font-bold text-slate-950 disabled:opacity-60"
          >
            <UploadCloud className="size-4" />
            Submit Proof
          </button>
        </form>
      </article>
    </div>
  );
}

export function ManualTasksAdminPreview() {
  return null;
}
