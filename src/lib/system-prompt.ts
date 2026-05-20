// V2 system prompt + memory injection · 给 /chat 用.
// SP 存 localStorage `kimi-system-prompt`.
// Memory inject toggle 存 `kimi-memory-inject` (default ON).
// Built context: sp (template substituted) + all active memories joined, capped at MEM_BUDGET.

import { memoryStore } from "@/lib/stores";
import { tmpl } from "@/lib/template";

const SP_KEY = "kimi-system-prompt";
const INJECT_KEY = "kimi-memory-inject";
const MEM_BUDGET = 5000; // 字 cap on injected memory text

export function getSystemPrompt(): string {
  if (typeof localStorage === "undefined") return "";
  return localStorage.getItem(SP_KEY) ?? "";
}

export function setSystemPrompt(s: string): void {
  if (typeof localStorage === "undefined") return;
  if (s.trim()) localStorage.setItem(SP_KEY, s);
  else localStorage.removeItem(SP_KEY);
}

export function isMemoryInjectOn(): boolean {
  if (typeof localStorage === "undefined") return true;
  return localStorage.getItem(INJECT_KEY) !== "0";
}

export function setMemoryInject(on: boolean): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(INJECT_KEY, on ? "1" : "0");
}

export type SystemMessageBundle = {
  text: string; // full assembled system message · empty string if nothing to inject
  spChars: number; // SP length (post-template-sub)
  memCount: number; // count of memories actually injected (after budget cap)
  memChars: number; // total chars of injected memory text
  memTotalActive: number; // total active memory count (before budget cap)
};

export async function buildSystemMessage(): Promise<SystemMessageBundle> {
  const rawSP = getSystemPrompt();
  const sp = rawSP.trim() ? tmpl(rawSP) : "";
  const spChars = sp.length;

  let memText = "";
  let memCount = 0;
  let memChars = 0;
  let memTotalActive = 0;

  if (isMemoryInjectOn()) {
    const all = await memoryStore().list();
    const active = all
      .filter((m) => m.active !== false && (m.content?.length ?? 0) > 0)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    memTotalActive = active.length;

    const parts: string[] = [];
    for (const m of active) {
      const next = memChars + m.content.length + 2;
      if (next > MEM_BUDGET) break;
      parts.push(m.content);
      memCount++;
      memChars = next;
    }
    if (parts.length > 0) {
      memText = `\n\n## 背景记忆\n${parts.join("\n\n")}`;
    }
  }

  const text = sp + memText;
  return { text, spChars, memCount, memChars, memTotalActive };
}

// Helper for any "AI speaks in character" LLM call (chat / calendar fox /
// study 共读 / etc.). Returns SP (template-substituted) + memory injection
// + optional per-call instruction. Use as system message.
//
// Pattern:
//   const sys = await buildCharacterContext("你看看 {{user}} 今天的日历, 给一句话评价...");
//   const text = await llmGenerate(prompt, sys, opts);
export async function buildCharacterContext(
  extraInstruction?: string,
): Promise<string> {
  const sys = await buildSystemMessage();
  if (!extraInstruction) return sys.text;
  const trimmed = extraInstruction.trim();
  if (!trimmed) return sys.text;
  if (!sys.text) return trimmed;
  return `${sys.text}\n\n---\n\n${trimmed}`;
}

// Lightweight stats for status display (drawer) — same numbers as
// buildSystemMessage but without producing the full text payload.
export async function getSystemContextStats(): Promise<{
  spChars: number;
  memInjectOn: boolean;
  memTotalActive: number;
}> {
  const sp = getSystemPrompt();
  const memInjectOn = isMemoryInjectOn();
  let memTotalActive = 0;
  if (memInjectOn) {
    const all = await memoryStore().list();
    memTotalActive = all.filter(
      (m) => m.active !== false && (m.content?.length ?? 0) > 0,
    ).length;
  }
  return { spChars: sp.length, memInjectOn, memTotalActive };
}
