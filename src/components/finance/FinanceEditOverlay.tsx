"use client";

import { useEffect, useState } from "react";
import type { KimiPalette } from "@/lib/kimi-palettes";

// V2 finance · owner 0518: tap-to-edit 玫瑰 / 信封 category / 邮戳 inline.
// 第一版 minimal · ✎ button top-right → single modal edit ALL roses +
// envelopes (cat name + amt + color · envelope label + kind + amount).
// localStorage 持久, page 下次 read 自动 hydrate. Per-row inline-tap 是
// future iter (需 server → client conversion 整 697-line page).

export type EditableCat = { cat: string; amt: number; color: string };
export type EditableEnvelope = {
  kind: "bank" | "jpy" | "usd" | "cny" | "card";
  label: string;
  amount: string;
};

const CATS_KEY = "kimi-finance-cats";
const ENVS_KEY = "kimi-finance-envs";

const KIND_OPTIONS: EditableEnvelope["kind"][] = ["bank", "cny", "jpy", "usd"];

export function loadCats(): EditableCat[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(CATS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function loadEnvelopes(): EditableEnvelope[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(ENVS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function FinanceEditOverlay({
  P,
  seedCats,
  seedEnvelopes,
}: {
  P: KimiPalette;
  seedCats: EditableCat[];
  seedEnvelopes: EditableEnvelope[];
}) {
  const [open, setOpen] = useState(false);
  const [cats, setCats] = useState<EditableCat[]>(seedCats);
  const [envs, setEnvs] = useState<EditableEnvelope[]>(seedEnvelopes);

  useEffect(() => {
    const c = loadCats();
    if (c && c.length) setCats(c);
    const e = loadEnvelopes();
    if (e && e.length) setEnvs(e);
  }, []);

  function save() {
    try {
      localStorage.setItem(CATS_KEY, JSON.stringify(cats));
      localStorage.setItem(ENVS_KEY, JSON.stringify(envs));
    } catch {}
    setOpen(false);
    // 触发 page 重 read 数据 (server fetch 不走, IDB / localStorage 不 trigger
    // SSR re-render · 用 reload 兜底).
    if (typeof window !== "undefined") window.location.reload();
  }

  function patchCat(i: number, p: Partial<EditableCat>) {
    setCats((prev) => prev.map((c, idx) => (idx === i ? { ...c, ...p } : c)));
  }

  function patchEnv(i: number, p: Partial<EditableEnvelope>) {
    setEnvs((prev) => prev.map((e, idx) => (idx === i ? { ...e, ...p } : e)));
  }

  function cycleKind(i: number) {
    const cur = envs[i];
    const idx = KIND_OPTIONS.indexOf(cur.kind);
    const next = KIND_OPTIONS[(idx + 1) % KIND_OPTIONS.length];
    patchEnv(i, { kind: next });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="edit finance data"
        style={{
          position: "fixed",
          bottom: 22,
          right: 22,
          width: 38,
          height: 38,
          borderRadius: 99,
          border: `0.6px solid ${P.accent}`,
          background: P.paper,
          color: P.accent,
          fontSize: 15,
          cursor: "pointer",
          fontFamily: 'var(--font-serif)',
          boxShadow: "0 6px 16px rgba(0,0,0,0.18)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          zIndex: 50,
        }}
      >
        ✎
      </button>

      {open && (
        <div
          role="dialog"
          onClick={() => setOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 480,
              maxHeight: "90vh",
              overflowY: "auto",
              background: P.paper,
              color: P.ink,
              padding: "22px 22px 24px",
              borderRadius: 12,
              fontFamily: 'var(--font-serif)',
            }}
          >
            <div
              style={{
                fontSize: 11,
                letterSpacing: 4,
                color: P.accent,
                marginBottom: 16,
                fontStyle: "italic",
              }}
            >
              FINANCE · edit
            </div>

            <Section title="玫瑰 · category" P={P}>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {cats.map((c, i) => (
                  <div
                    key={i}
                    style={{ display: "flex", gap: 6, alignItems: "center" }}
                  >
                    <input
                      type="color"
                      value={c.color}
                      onChange={(e) => patchCat(i, { color: e.target.value })}
                      style={{
                        width: 28,
                        height: 28,
                        border: `0.5px solid ${P.hair}`,
                        background: "transparent",
                        cursor: "pointer",
                        padding: 0,
                      }}
                    />
                    <input
                      value={c.cat}
                      onChange={(e) => patchCat(i, { cat: e.target.value })}
                      placeholder="category"
                      style={fieldStyle(P, 1)}
                    />
                    <input
                      type="number"
                      value={c.amt}
                      onChange={(e) =>
                        patchCat(i, { amt: parseInt(e.target.value, 10) || 0 })
                      }
                      placeholder="amt"
                      style={{ ...fieldStyle(P, 0), width: 70 }}
                    />
                  </div>
                ))}
              </div>
            </Section>

            <Section title="信封 · envelope" P={P}>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {envs.map((e, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 4,
                      padding: 8,
                      border: `0.4px solid ${P.hair}`,
                    }}
                  >
                    <div style={{ display: "flex", gap: 6 }}>
                      <input
                        value={e.label}
                        onChange={(ev) => patchEnv(i, { label: ev.target.value })}
                        placeholder="label · e.g. 信用卡 · 自动扣款"
                        style={fieldStyle(P, 1)}
                      />
                      <input
                        value={e.amount}
                        onChange={(ev) => patchEnv(i, { amount: ev.target.value })}
                        placeholder="¥0,000"
                        style={{ ...fieldStyle(P, 0), width: 90 }}
                      />
                    </div>
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <span
                        style={{
                          fontSize: 9,
                          letterSpacing: 2,
                          color: P.mute,
                          fontStyle: "italic",
                        }}
                      >
                        邮戳:
                      </span>
                      <button
                        type="button"
                        onClick={() => cycleKind(i)}
                        style={{
                          fontSize: 9,
                          letterSpacing: 2,
                          padding: "4px 12px",
                          border: `0.5px solid ${P.accent}`,
                          background: "transparent",
                          color: P.accent,
                          cursor: "pointer",
                          fontFamily: "inherit",
                          textTransform: "uppercase",
                        }}
                      >
                        {e.kind} · tap cycle
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </Section>

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 10,
                marginTop: 16,
              }}
            >
              <button
                type="button"
                onClick={() => setOpen(false)}
                style={ghostBtn(P)}
              >
                取消
              </button>
              <button type="button" onClick={save} style={primaryBtn(P)}>
                存 + 刷新
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Section({
  title,
  P,
  children,
}: {
  title: string;
  P: KimiPalette;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div
        style={{
          fontSize: 9,
          letterSpacing: 3,
          color: P.mute,
          marginBottom: 8,
          fontStyle: "italic",
        }}
      >
        · {title}
      </div>
      {children}
    </div>
  );
}

function fieldStyle(P: KimiPalette, flex: number): React.CSSProperties {
  return {
    flex,
    background: "transparent",
    border: "none",
    borderBottom: `0.5px solid ${P.hair}`,
    padding: "4px 2px",
    color: P.ink,
    fontSize: 13,
    fontFamily: "inherit",
    outline: "none",
  };
}

function primaryBtn(P: KimiPalette): React.CSSProperties {
  return {
    fontSize: 10,
    letterSpacing: 3,
    padding: "8px 16px",
    border: `0.5px solid ${P.accent}`,
    background: `${P.accent}1a`,
    color: P.accent,
    cursor: "pointer",
    fontFamily: 'var(--font-serif)',
    fontStyle: "italic",
  };
}

function ghostBtn(P: KimiPalette): React.CSSProperties {
  return {
    fontSize: 10,
    letterSpacing: 3,
    padding: "8px 16px",
    border: `0.4px solid ${P.hair}`,
    background: "transparent",
    color: P.mute,
    cursor: "pointer",
    fontFamily: 'var(--font-serif)',
    fontStyle: "italic",
  };
}
