import type { Language } from "@/lib/i18n";
import { Languages } from "lucide-react";

export function LanguageToggle({ language, onChange }: { language: Language; onChange: (language: Language) => void }) {
  return (
    <div className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 p-1 text-xs font-semibold" aria-label="Language switcher">
      <Languages className="mx-1 size-3.5 text-amber-300" aria-hidden="true" />
      <button onClick={() => onChange("en")} className={`rounded-full px-2.5 py-1.5 transition ${language === "en" ? "bg-amber-300 text-slate-950" : "text-slate-300 hover:text-white"}`}>EN</button>
      <button onClick={() => onChange("ur")} className={`rounded-full px-2.5 py-1.5 transition ${language === "ur" ? "bg-amber-300 text-slate-950" : "text-slate-300 hover:text-white"}`}>اردو</button>
    </div>
  );
}
