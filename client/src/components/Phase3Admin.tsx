import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useState } from "react";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";

const blank = {
  title: "",
  description: "",
  rewardCoins: 1200,
  hiddenProfit: 5000,
  playstoreLink: "https://play.google.com/",
  isActive: true,
  imageData: "",
};
const readDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
const moneyCoins = (n: number) => `${n.toLocaleString()} coins`;

export function AdminTasks({ t }: { t: (key: string) => string }) {
  const list = trpc.admin.tasks.useQuery();
  const [form, setForm] = useState<any>(blank);
  const save = trpc.admin.saveTask.useMutation({
    onSuccess: () => {
      toast.success("Task saved");
      void list.refetch();
      setForm(blank);
    },
    onError: error => toast.error(error.message),
  });
  const remove = trpc.admin.deleteTask.useMutation({
    onSuccess: () => void list.refetch(),
    onError: error => toast.error(error.message),
  });
  return (
    <div className="space-y-5">
      <div>
        <p className="eyebrow">Manual task management</p>
        <h2 className="mt-2 text-2xl font-bold">Tasks</h2>
        <p className="mt-2 text-sm text-slate-300">
          Create tasks with a description, link, image, or video.
        </p>
      </div>
      <form
        className="panel grid gap-3 md:grid-cols-2"
        onSubmit={event => {
          event.preventDefault();
          save.mutate({
            ...form,
            rewardCoins: Number(form.rewardCoins),
            hiddenProfit: Number(form.hiddenProfit),
            imageData: form.imageData || undefined,
          });
        }}
      >
        <label>
          <span className="field-label">Title</span>
          <input
            className="field"
            required
            value={form.title}
            onChange={e => setForm({ ...form, title: e.target.value })}
          />
        </label>
        <label>
          <span className="field-label">Play Store link</span>
          <input
            className="field"
            required
            type="url"
            value={form.playstoreLink}
            onChange={e => setForm({ ...form, playstoreLink: e.target.value })}
          />
        </label>
        <label className="md:col-span-2">
          <span className="field-label">Description / steps</span>
          <textarea
            className="field min-h-32"
            required
            value={form.description}
            onChange={e => setForm({ ...form, description: e.target.value })}
          />
        </label>
        <label>
          <span className="field-label">Reward coins for user</span>
          <input
            className="field"
            type="number"
            min="1"
            value={form.rewardCoins}
            onChange={e => setForm({ ...form, rewardCoins: e.target.value })}
          />
        </label>
        <label>
          <span className="field-label">Hidden profit coins</span>
          <input
            className="field"
            type="number"
            min="0"
            value={form.hiddenProfit}
            onChange={e => setForm({ ...form, hiddenProfit: e.target.value })}
          />
        </label>
        <label className="md:col-span-2">
          <span className="field-label">Task image or video</span>
          <input
            className="field"
            type="file"
            accept="image/*,video/*"
            onChange={async e => {
              const file = e.target.files?.[0];
              if (file)
                setForm({ ...form, imageData: await readDataUrl(file) });
            }}
          />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={e => setForm({ ...form, isActive: e.target.checked })}
          />
          Active
        </label>
        <div className="md:col-span-2">
          <button
            disabled={save.isPending}
            className="inline-flex items-center gap-2 rounded-xl bg-amber-300 px-4 py-2 text-sm font-bold text-slate-950"
          >
            <Plus className="size-4" />
            {form.id ? "Update task" : "Create task"}
          </button>
          {form.id && (
            <button
              type="button"
              className="ml-2 rounded-xl border border-white/10 px-4 py-2 text-sm"
              onClick={() => setForm(blank)}
            >
              Cancel
            </button>
          )}
        </div>
      </form>
      <div className="space-y-3">
        {list.data?.map(task => (
          <div
            key={task.id}
            className="panel flex flex-wrap items-center justify-between gap-4"
          >
            <div className="min-w-0">
              <p className="text-lg font-bold">
                {task.title}{" "}
                <span className="ml-2 rounded-full bg-white/10 px-2 py-1 text-[10px]">
                  {task.isActive ? "Active" : "Inactive"}
                </span>
              </p>
              <p className="mt-1 text-sm text-slate-300">
                User: {moneyCoins(task.rewardCoins)} · Net:{" "}
                {moneyCoins(task.profitCoins)}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                className="rounded-lg bg-white/10 p-2"
                onClick={() =>
                  setForm({ ...task, imageData: task.imageUrl ?? "" })
                }
              >
                <Pencil className="size-4" />
              </button>
              <button
                type="button"
                className="rounded-lg bg-red-400/15 p-2 text-red-200"
                onClick={() => remove.mutate({ id: task.id })}
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AdminTaskProofs() {
  const list = trpc.admin.taskProofs.useQuery();
  const review = trpc.admin.reviewTaskProof.useMutation({
    onSuccess: () => {
      toast.success("Proof reviewed");
      void list.refetch();
    },
    onError: error => toast.error(error.message),
  });
  return (
    <div>
      <p className="eyebrow">Manual task proofs</p>
      <h2 className="mt-2 text-2xl font-bold">Proof Review</h2>
      <div className="mt-5 space-y-4">
        {list.data?.length ? (
          list.data.map(proof => (
            <div key={proof.id} className="panel">
              <div className="flex flex-wrap justify-between gap-3">
                <div>
                  <p className="text-lg font-bold">
                    {proof.task?.title ?? `Task #${proof.taskId}`}
                  </p>
                  <p className="mt-1 text-sm text-slate-300">
                    {proof.member?.username ?? `User #${proof.userId}`} · Game
                    ID: {proof.gameUserId}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {new Date(proof.createdAt).toLocaleString()}
                  </p>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-bold ${proof.status === "approved" ? "bg-emerald-400/15 text-emerald-200" : proof.status === "rejected" ? "bg-red-400/15 text-red-200" : "bg-amber-300/15 text-amber-200"}`}
                >
                  {proof.status}
                </span>
              </div>
              <a href={proof.screenshotUrl} target="_blank" rel="noreferrer">
                <img
                  src={proof.screenshotUrl}
                  alt="Task proof"
                  className="mt-4 max-h-80 rounded-xl border border-white/10 object-contain"
                />
              </a>
              {proof.status === "pending" && (
                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      review.mutate({ id: proof.id, approved: true })
                    }
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-400 px-4 py-2 text-sm font-bold text-slate-950"
                  >
                    <Check className="size-4" />
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      review.mutate({
                        id: proof.id,
                        approved: false,
                        rejectReason:
                          window.prompt("Reason for rejection") || undefined,
                      })
                    }
                    className="inline-flex items-center gap-2 rounded-xl bg-red-400/15 px-4 py-2 text-sm font-bold text-red-200"
                  >
                    <X className="size-4" />
                    Reject
                  </button>
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="panel text-sm text-slate-400">
            No task proofs found.
          </div>
        )}
      </div>
    </div>
  );
}
