"use client";

// V2 backstage settings · system prompt + memory injection toggle.
// Set-once-and-forget power-user surface · chat reads from here.

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  getSystemPrompt,
  setSystemPrompt,
  isMemoryInjectOn,
  setMemoryInject,
  getSystemContextStats,
} from "@/lib/system-prompt";

const MEM_BUDGET = 5000;

export default function BackstageSettings() {
  const [sp, setSp] = useState("");
  const [inject, setInject] = useState(true);
  const [stats, setStats] = useState<{
    spChars: number;
    memInjectOn: boolean;
    memTotalActive: number;
  } | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    setSp(getSystemPrompt());
    setInject(isMemoryInjectOn());
    void refreshStats();
  }, []);

  async function refreshStats() {
    const s = await getSystemContextStats();
    setStats(s);
  }

  function onSave() {
    setSystemPrompt(sp);
    setMemoryInject(inject);
    flash("saved");
    void refreshStats();
  }

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2400);
  }

  const labelCls = "text-[10px] tracking-[0.3em] uppercase text-muted-gold";
  const helpCls = "text-[10px] text-muted-grey leading-relaxed";
  const inputBg = "bg-black/20 border border-muted-gold/20";

  return (
    <main className="flex-1 px-4 md:px-12 py-16 max-w-[1280px] mx-auto text-muted-grey">
      <div className="flex items-baseline justify-between mb-2">
        <h1 className="font-serif text-3xl tracking-widest text-muted-gold">
          settings
        </h1>
        <Link
          href="/backstage"
          className="text-[10px] tracking-[0.3em] uppercase text-muted-grey hover:text-muted-gold"
        >
          ← backstage
        </Link>
      </div>
      <p className="text-[10px] italic text-muted-grey/70 mb-12">
        chat 的系统提示 + memory 注入 · 配置 /chat 用的 context
      </p>

      {/* ── System prompt ──────────────────────────────── */}
      <section className="mb-12 max-w-2xl">
        <h2 className={labelCls}>system prompt</h2>
        <p className={`${helpCls} mt-2`}>
          chat 调 LLM 时塞为第一条 system message. 支持{" "}
          <code className="text-muted-gold/80">{`{{char}}`}</code> /{" "}
          <code className="text-muted-gold/80">{`{{user}}`}</code> /{" "}
          <code className="text-muted-gold/80">{`{{scenario}}`}</code> 模板替换
          (在 /backstage/settings 配 char/user 名字).
        </p>
        <textarea
          value={sp}
          onChange={(e) => setSp(e.target.value)}
          placeholder={`例: 你是 {{char}}, {{user}} 的恋人 / 助手. 性格温柔, 喜欢看月亮.\n保持对话亲密 · 用简短中文回复.\n...`}
          rows={16}
          className={`${inputBg} w-full mt-4 p-4 text-[12px] text-muted-grey font-mono leading-relaxed rounded resize-y focus:outline-none focus:border-muted-gold/60`}
          style={{ fontFamily: "ui-monospace, monospace" }}
        />
        <div className="mt-2 text-[10px] text-muted-grey/60">
          {sp.length} 字 · 留空 = 不注入 system prompt
        </div>
      </section>

      {/* ── Memory injection ───────────────────────────── */}
      <section className="mb-12 max-w-2xl">
        <h2 className={labelCls}>memory injection</h2>
        <p className={`${helpCls} mt-2`}>
          开启后 chat 会把{" "}
          <Link
            href="/room/memory-review"
            className="underline-offset-4 hover:underline text-muted-gold/80"
          >
            /room/memory-review
          </Link>{" "}
          里 active=true 的 memory 按 order 排序拼接到 system prompt 末尾.
          上限 {MEM_BUDGET} 字 · 超了按 order 截.
        </p>
        <div className="mt-4 flex items-center gap-4">
          <button
            type="button"
            onClick={() => setInject((v) => !v)}
            className={`px-4 py-2 border text-[11px] tracking-[0.25em] uppercase rounded ${
              inject
                ? "border-muted-gold text-muted-gold bg-muted-gold/10"
                : "border-muted-grey/40 text-muted-grey"
            }`}
          >
            {inject ? "ON" : "OFF"}
          </button>
          {stats && (
            <span className="text-[10px] text-muted-grey/70">
              {stats.memTotalActive} 条 active memory · 当前 {stats.memInjectOn ? "注入中" : "未注入"}
            </span>
          )}
        </div>
      </section>

      {/* ── Save ───────────────────────────────────────── */}
      <section className="max-w-2xl">
        <button
          type="button"
          onClick={onSave}
          className="px-6 py-2 border border-muted-gold text-[11px] tracking-[0.25em] uppercase text-muted-gold hover:bg-muted-gold/10 rounded"
        >
          save
        </button>
      </section>

      {toast && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 px-5 py-2 text-[10px] tracking-widest uppercase border border-muted-gold/40 text-muted-gold bg-black/60 rounded">
          {toast}
        </div>
      )}
    </main>
  );
}
