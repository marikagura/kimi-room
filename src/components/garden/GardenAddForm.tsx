"use client";

import { useRef, useState } from "react";
import { chatStore } from "@/lib/stores";
import { isLLMConfigured, llmGenerateWithImage } from "@/lib/llm-client";

// 手动 paste 一段 chat 进 disc — 用 "我:" / "他:" / "user:" / "assistant:"
// 前缀划分 message. 不要前缀的行会贴到前一条上.

type Msg = { role: "user" | "assistant"; content: string; imageDataUrl?: string };

function parseRawChat(text: string): Msg[] {
  const lines = text.split(/\r?\n/);
  const out: Msg[] = [];
  let current: Msg | null = null;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      if (current) current.content += "\n";
      continue;
    }
    const m = /^(我|他|她|user|assistant|me|her|him|claude|cc)[:：]\s*(.*)$/i.exec(line);
    if (m) {
      if (current) out.push(current);
      const tag = m[1].toLowerCase();
      // user-like → user;  assistant-like → assistant
      const isUser = ["我", "user", "me"].includes(tag);
      current = { role: isUser ? "user" : "assistant", content: m[2] };
    } else if (current) {
      current.content += (current.content ? "\n" : "") + line;
    } else {
      // first line with no prefix → assume user
      current = { role: "user", content: line };
    }
  }
  if (current) out.push(current);
  return out.filter((m) => m.content.trim().length > 0);
}

export function GardenAddForm({ onAdded }: { onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [raw, setRaw] = useState("");
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [source, setSource] = useState("manual");
  const [imgRole, setImgRole] = useState<"user" | "assistant">("assistant");
  const [imgPreview, setImgPreview] = useState<string | null>(null);
  const [autoBusy, setAutoBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const imgRef = useRef<HTMLInputElement>(null);

  const parsed = parseRawChat(raw);
  const hasContent = parsed.length > 0 || !!imgPreview;

  async function autoParseScreenshot() {
    if (!imgPreview || autoBusy) return;
    if (!isLLMConfigured()) {
      setErr("LLM 未配 · /backstage/settings 填 vision-capable endpoint + key");
      return;
    }
    setAutoBusy(true);
    setErr(null);
    try {
      const system =
        "你是一个 chat screenshot OCR · 看这张聊天截图, extract 全部 messages. 返回 strict JSON · 不带 markdown fence · 不加任何解释 · shape: [{\"role\":\"user\"|\"assistant\",\"content\":\"...\"}]. 'user' = 用户自己 (通常右侧/蓝色气泡), 'assistant' = 对方 (通常左侧). 保留原文不翻译.";
      const prompt = "Extract messages JSON.";
      const text = await llmGenerateWithImage(prompt, imgPreview, system, {
        temperature: 0.2,
        maxTokens: 4096,
      });
      const cleaned = text
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/```\s*$/i, "")
        .trim();
      const parsed = JSON.parse(cleaned) as { role: string; content: string }[];
      if (!Array.isArray(parsed) || parsed.length === 0) {
        throw new Error("LLM 返回 empty array");
      }
      const lines = parsed
        .filter((m) => m.content?.trim())
        .map((m) => {
          const tag = m.role === "user" ? "我" : "他";
          return `${tag}: ${m.content.trim()}`;
        })
        .join("\n");
      setRaw(lines);
      setImgPreview(null);
    } catch (e) {
      setErr(`auto-parse 失败 · ${(e as Error).message.slice(0, 100)}`);
    } finally {
      setAutoBusy(false);
    }
  }

  async function onPickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setErr("不是 image · 选 PNG/JPG screenshot");
      return;
    }
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result));
        r.onerror = () => reject(new Error("read failed"));
        r.readAsDataURL(file);
      });
      setImgPreview(dataUrl);
      setErr(null);
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  async function submit() {
    if (busy) return;
    if (!hasContent) {
      setErr("没读出对话 · 加 '我:' / '他:' 前缀 或 import screenshot");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const messages = [...parsed];
      if (imgPreview) {
        messages.push({
          role: imgRole,
          content: "",
          imageDataUrl: imgPreview,
        });
      }
      await chatStore().put({
        source,
        title: title || null,
        messages,
        note: note || null,
        theme: "night",
      });
      setRaw("");
      setTitle("");
      setNote("");
      setImgPreview(null);
      setOpen(false);
      onAdded();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const gold = "#b8a070";
  const mute = "rgba(232,230,224,0.55)";

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="kimi-btn-anim"
        style={{
          background: "transparent",
          border: `0.6px solid ${gold}`,
          color: gold,
          padding: "10px 22px",
          fontSize: 12,
          fontStyle: "italic",
          letterSpacing: 3,
          fontFamily: 'var(--font-serif)',
          cursor: "pointer",
          borderRadius: 0,
        }}
      >
        + paste chat
      </button>
    );
  }

  return (
    <div
      style={{
        background: "#1a1a1a",
        border: `0.6px solid ${gold}40`,
        padding: 16,
        marginBottom: 20,
      }}
    >
      <div
        style={{
          fontSize: 10,
          letterSpacing: 3,
          color: gold,
          fontStyle: "italic",
          marginBottom: 12,
          fontFamily: 'var(--font-serif)',
        }}
      >
        · paste raw chat (前缀: 我: / 他: / user: / assistant:)
      </div>
      <textarea
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        rows={8}
        placeholder={"我: ...\n他: ...\n我: ..."}
        style={{
          width: "100%",
          background: "rgba(0,0,0,0.4)",
          color: "#e8e6e0",
          border: `0.4px solid ${gold}30`,
          padding: 12,
          fontSize: 13,
          fontFamily: "inherit",
          lineHeight: 1.6,
          resize: "vertical",
          outline: "none",
          borderRadius: 0,
        }}
      />
      <div
        style={{
          fontSize: 10,
          color: mute,
          marginTop: 6,
          fontStyle: "italic",
        }}
      >
        读到 {parsed.length} 条 message
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="标题 (optional)"
          style={inputStyle(gold)}
        />
        <select
          value={source}
          onChange={(e) => setSource(e.target.value)}
          style={inputStyle(gold)}
        >
          <option value="manual">手记</option>
          <option value="cc-chat">cc</option>
          <option value="wechat">wechat</option>
          <option value="tg">telegram</option>
        </select>
      </div>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={2}
        placeholder="一句话备注 (optional)"
        style={{
          ...inputStyle(gold),
          width: "100%",
          marginTop: 8,
          resize: "vertical",
        }}
      />

      {/* screenshot import · owner 0518 disc paste 加 image · 渲为 bubble */}
      <div style={{ marginTop: 12, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={() => imgRef.current?.click()}
          style={{
            background: "transparent",
            border: `0.4px solid ${gold}`,
            color: gold,
            padding: "6px 12px",
            fontSize: 10,
            fontStyle: "italic",
            letterSpacing: 2,
            fontFamily: 'var(--font-serif)',
            cursor: "pointer",
            borderRadius: 0,
          }}
        >
          {imgPreview ? "↻ 换图" : "↑ import screenshot"}
        </button>
        <input
          ref={imgRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={onPickImage}
        />
        {imgPreview && (
          <>
            <button
              type="button"
              onClick={autoParseScreenshot}
              disabled={autoBusy}
              style={{
                background: "transparent",
                border: `0.4px solid ${gold}`,
                color: gold,
                padding: "6px 12px",
                fontSize: 10,
                fontStyle: "italic",
                letterSpacing: 2,
                fontFamily: 'var(--font-serif)',
                cursor: autoBusy ? "wait" : "pointer",
                borderRadius: 0,
                opacity: autoBusy ? 0.5 : 1,
              }}
            >
              {autoBusy ? "· OCR 中 ..." : "✨ auto-parse"}
            </button>
            <span style={{ fontSize: 10, color: mute, fontStyle: "italic" }}>by</span>
            <button
              type="button"
              onClick={() => setImgRole("user")}
              style={roleBtn(gold, mute, imgRole === "user")}
            >
              我
            </button>
            <button
              type="button"
              onClick={() => setImgRole("assistant")}
              style={roleBtn(gold, mute, imgRole === "assistant")}
            >
              他
            </button>
            <button
              type="button"
              onClick={() => setImgPreview(null)}
              style={{
                background: "transparent",
                border: "none",
                color: mute,
                fontSize: 10,
                fontStyle: "italic",
                cursor: "pointer",
                marginLeft: 4,
              }}
            >
              ×
            </button>
          </>
        )}
      </div>
      {imgPreview && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imgPreview}
          alt="screenshot preview"
          style={{
            display: "block",
            marginTop: 8,
            maxWidth: 200,
            maxHeight: 160,
            objectFit: "contain",
            border: `0.4px solid ${gold}40`,
          }}
        />
      )}

      {err && (
        <div
          style={{
            color: "#c47878",
            fontSize: 11,
            fontStyle: "italic",
            marginTop: 8,
          }}
        >
          {err}
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button
          type="button"
          onClick={submit}
          disabled={busy || !hasContent}
          className="kimi-btn-anim"
          style={{
            background: "transparent",
            border: `0.6px solid ${gold}`,
            color: gold,
            padding: "8px 18px",
            fontSize: 11,
            fontStyle: "italic",
            letterSpacing: 3,
            fontFamily: 'var(--font-serif)',
            cursor: busy ? "wait" : "pointer",
            borderRadius: 0,
            opacity: !hasContent ? 0.4 : 1,
          }}
        >
          {busy ? "..." : "save"}
        </button>
        <button
          type="button"
          onClick={() => {
            setRaw("");
            setTitle("");
            setNote("");
            setOpen(false);
            setErr(null);
          }}
          className="kimi-btn-anim"
          style={{
            background: "transparent",
            border: `0.4px solid ${mute}`,
            color: mute,
            padding: "8px 18px",
            fontSize: 11,
            fontStyle: "italic",
            letterSpacing: 3,
            fontFamily: 'var(--font-serif)',
            cursor: "pointer",
            borderRadius: 0,
          }}
        >
          cancel
        </button>
      </div>
    </div>
  );
}

function inputStyle(gold: string): React.CSSProperties {
  return {
    background: "rgba(0,0,0,0.4)",
    border: `0.4px solid ${gold}30`,
    color: "#e8e6e0",
    padding: "6px 10px",
    fontSize: 12,
    fontFamily: "inherit",
    fontStyle: "italic",
    outline: "none",
    borderRadius: 0,
  };
}

function roleBtn(gold: string, mute: string, sel: boolean): React.CSSProperties {
  return {
    background: "transparent",
    border: `0.4px solid ${sel ? gold : mute}`,
    color: sel ? gold : mute,
    padding: "3px 10px",
    fontSize: 10,
    fontStyle: "italic",
    cursor: "pointer",
    fontFamily: "inherit",
    borderRadius: 0,
  };
}
