"use client";

// /chat/history · 列出所有过往 chat session · 单条 download / summarize → memory.
// 进入路径: /chat ⋯ 抽屉 → "↶ 过往 sessions" link.

import Link from "next/link";
import { useEffect, useState } from "react";
import { chatStore, memoryStore } from "@/lib/stores";
import {
  friendlyLLMError,
  isLLMConfigured,
  llmGenerate,
} from "@/lib/llm-client";
import type { ChatEntry } from "@/lib/stores/types";

function fmtDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString("zh-CN", { hour12: false }).slice(0, 16);
  } catch {
    return iso.slice(0, 16);
  }
}

function download(filename: string, text: string) {
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function sessionToText(session: ChatEntry): string {
  return session.messages
    .map((m) => `[${m.role}] ${m.content}`)
    .join("\n\n");
}

export default function ChatHistoryPage() {
  const [sessions, setSessions] = useState<ChatEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ text: string; tone: "ok" | "err" } | null>(null);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const all = await chatStore().list();
      const sorted = [...all].sort((a, b) =>
        b.createdAt.localeCompare(a.createdAt),
      );
      setSessions(sorted);
    } finally {
      setLoading(false);
    }
  }

  function flash(text: string, tone: "ok" | "err" = "ok") {
    setMsg({ text, tone });
    setTimeout(() => setMsg(null), 4000);
  }

  function onDownload(session: ChatEntry) {
    const safe = (session.title ?? "session").replace(/[^\w一-龥-]+/g, "-").slice(0, 40);
    const date = session.createdAt.slice(0, 10);
    download(
      `kimi-chat-${safe}-${date}.json`,
      JSON.stringify(session, null, 2),
    );
    flash("downloaded");
  }

  async function onSummarize(session: ChatEntry) {
    if (!isLLMConfigured()) {
      flash("没填 LLM key · 去 /backstage/settings", "err");
      return;
    }
    setBusyId(session.id);
    try {
      const transcript = sessionToText(session).slice(0, 6000);
      const summary = await llmGenerate(
        `请用中文 3-5 句话总结以下对话, 抓住关键情节、决定、情感. 不超过 200 字:\n\n${transcript}`,
        "你 summarize 一段对话 · 3-5 句 ≤200 字 · 用中文 · 抓关键 · 不解释.",
        { temperature: 0.3, maxTokens: 400 },
      );
      const trimmed = summary.trim();
      if (!trimmed) {
        flash("LLM 返回空", "err");
        return;
      }
      await memoryStore().put({
        key: session.title ?? `chat-${session.createdAt.slice(0, 10)}`,
        content: trimmed,
        order: 0,
        active: true,
        tags: ["chat-summary"],
        reviewStatus: "pending",
      });
      flash("写入 memory · 去 /room/memory-review 看 pending 队列");
    } catch (e) {
      const fe = friendlyLLMError(e);
      flash(`${fe.title} · ${fe.hint}`, "err");
    } finally {
      setBusyId(null);
    }
  }

  async function onDelete(session: ChatEntry) {
    if (!confirm(`删 "${session.title ?? "(无标题)"}"? 不可逆.`)) return;
    await chatStore().delete(session.id);
    await load();
    flash("deleted");
  }

  return (
    <main className="flex-1 px-4 md:px-12 py-16 max-w-3xl mx-auto text-muted-grey">
      <div className="flex items-baseline justify-between mb-2">
        <h1 className="font-serif text-3xl tracking-widest text-muted-gold">
          chat history
        </h1>
        <Link
          href="/chat"
          className="text-[10px] tracking-[0.3em] uppercase text-muted-grey hover:text-muted-gold"
        >
          ← chat
        </Link>
      </div>
      <p className="text-[10px] italic text-muted-grey/70 mb-12">
        过往 sessions · 每条可 download 原始 json · 或 LLM 总结 → memory (pending)
      </p>

      {loading ? (
        <div className="text-[11px] italic text-muted-grey/60">loading…</div>
      ) : sessions.length === 0 ? (
        <div className="text-[11px] italic text-muted-grey/60">
          还没 session · 去{" "}
          <Link href="/chat" className="underline-offset-4 hover:underline">
            /chat
          </Link>{" "}
          开始第一段对话
        </div>
      ) : (
        <ul className="space-y-3">
          {sessions.map((s) => {
            const busy = busyId === s.id;
            return (
              <li
                key={s.id}
                className="border border-muted-gold/20 rounded p-4 bg-black/20"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] text-muted-gold/90 truncate">
                      {s.title ?? "(无标题 session)"}
                    </div>
                    <div className="mt-1 text-[10px] text-muted-grey/60 flex gap-3">
                      <span>{fmtDate(s.createdAt)}</span>
                      <span>·</span>
                      <span>{s.messages.length} 条消息</span>
                      <span>·</span>
                      <span>{s.theme}</span>
                    </div>
                    {s.note && (
                      <div className="mt-2 text-[11px] text-muted-grey/70 italic line-clamp-2">
                        {s.note}
                      </div>
                    )}
                    {s.messages[0]?.content && (
                      <div className="mt-2 text-[11px] text-muted-grey/50 line-clamp-2">
                        {s.messages[0].content.slice(0, 160)}
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => onDownload(s)}
                    disabled={busy}
                    className="px-3 py-1 border border-muted-gold/30 text-[10px] tracking-[0.2em] uppercase text-muted-grey hover:text-muted-gold hover:border-muted-gold/60 rounded disabled:opacity-40"
                  >
                    ↓ download
                  </button>
                  <button
                    type="button"
                    onClick={() => onSummarize(s)}
                    disabled={busy || s.messages.length < 2}
                    className="px-3 py-1 border border-muted-gold/30 text-[10px] tracking-[0.2em] uppercase text-muted-grey hover:text-muted-gold hover:border-muted-gold/60 rounded disabled:opacity-40"
                  >
                    {busy ? "…" : "✦ summarize → memory"}
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(s)}
                    disabled={busy}
                    className="px-3 py-1 border border-red-500/30 text-[10px] tracking-[0.2em] uppercase text-red-400/70 hover:text-red-400 hover:border-red-500/60 rounded disabled:opacity-40"
                  >
                    × delete
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {msg && (
        <div
          className={`fixed bottom-8 left-1/2 -translate-x-1/2 px-5 py-2 text-[10px] tracking-widest uppercase border rounded bg-black/70 ${
            msg.tone === "ok"
              ? "border-muted-gold/40 text-muted-gold"
              : "border-red-500/60 text-red-400"
          }`}
        >
          {msg.text}
        </div>
      )}
    </main>
  );
}
