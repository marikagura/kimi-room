"use client";

// V2 settings · runtime config + portrait upload + IDB JSON export/import/empty.
//
// Phase 1 stub (Day 1): app_title + LLM api key
// Phase 2 (Day 2 owner 0525 ack): + LLM endpoint/model + portrait upload (p2) +
//          IDB export/import/empty buttons + adapter picker stub
// Phase 3 (later): adapter picker real wire (Notion / Supabase form), 6 finance
//          category editor, NSFW level, 21+ self-attest

import { useEffect, useState } from "react";
import Link from "next/link";
import { KIMI_MODE } from "@/lib/kimi-mode";
import { APP_TITLE_DEFAULT, getAppTitle, setAppTitle } from "@/lib/app-title";
import {
  DEFAULT_PARAMS,
  fetchModels,
  guessProviderName,
  loadLLMSettings,
  newProfileId,
  saveLLMSettings,
  type LLMSettings,
  type ProviderProfile,
} from "@/lib/llm-client";
import {
  clearOtherPortrait,
  clearSelfPortrait,
  fileToBase64,
  getOtherPortraitDataURL,
  getSelfPortraitDataURL,
  setOtherPortrait,
  setSelfPortrait,
} from "@/lib/portrait-store";
import { isDemoOn, removeDemo, seedDemo } from "@/lib/demo-seed";
import {
  CHAR_NAME_DEFAULT,
  getCharName,
  getUserName,
  setCharName,
  setUserName,
} from "@/lib/template";
import { RoomLayoutEditor } from "@/components/backstage/RoomLayoutEditor";

type Toast = { msg: string; tone: "ok" | "err" } | null;

type MedButton = { key: string; label: string };

const MED_BUTTONS_KEY = "kimi-med-buttons";

function loadMedButtons(): MedButton[] {
  try {
    const raw = localStorage.getItem(MED_BUTTONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((m): m is MedButton => !!m?.key && !!m?.label)
      : [];
  } catch {
    return [];
  }
}

function saveMedButtons(list: MedButton[]) {
  try {
    localStorage.setItem(MED_BUTTONS_KEY, JSON.stringify(list));
  } catch {}
}

export default function SettingsPage() {
  const [title, setTitle] = useState(APP_TITLE_DEFAULT);
  const [charName, setCharNameState] = useState(CHAR_NAME_DEFAULT);
  const [userName, setUserNameState] = useState("you");
  const [llm, setLLM] = useState<LLMSettings>({
    profiles: [],
    activeProfileId: "",
    activeModel: "",
    params: { ...DEFAULT_PARAMS },
  });
  const [expandedProfile, setExpandedProfile] = useState<string | null>(null);
  const [modelsBusy, setModelsBusy] = useState<string | null>(null);
  const [selfPreview, setSelfPreview] = useState<string | null>(null);
  const [otherPreview, setOtherPreview] = useState<string | null>(null);
  const [meds, setMeds] = useState<MedButton[]>([]);
  const [medDraft, setMedDraft] = useState("");
  const [toast, setToast] = useState<Toast>(null);
  const [demoOn, setDemoOn] = useState(false);
  const [demoBusy, setDemoBusy] = useState(false);

  useEffect(() => {
    setTitle(getAppTitle());
    setCharNameState(getCharName());
    setUserNameState(getUserName());
    setLLM(loadLLMSettings());
    setMeds(loadMedButtons());
    setDemoOn(isDemoOn());
    refreshPortraits();
  }, []);

  function addMed() {
    const label = medDraft.trim();
    if (!label) return;
    const key = label.toLowerCase();
    if (meds.some((m) => m.key === key)) {
      flash(`「${label}」已存在`, "err");
      return;
    }
    const next = [...meds, { key, label }];
    setMeds(next);
    saveMedButtons(next);
    setMedDraft("");
  }

  function removeMed(key: string) {
    const next = meds.filter((m) => m.key !== key);
    setMeds(next);
    saveMedButtons(next);
  }

  function flash(msg: string, tone: "ok" | "err" = "ok") {
    setToast({ msg, tone });
    setTimeout(() => setToast(null), 2400);
  }

  async function refreshPortraits() {
    const [s, o] = await Promise.all([
      getSelfPortraitDataURL(),
      getOtherPortraitDataURL(),
    ]);
    setSelfPreview(s);
    setOtherPreview(o);
  }

  function onSaveGeneral(e: React.FormEvent) {
    e.preventDefault();
    setAppTitle(title);
    setCharName(charName);
    setUserName(userName);
    saveLLMSettings(llm);
    flash("保存了");
  }

  // ── LLM profiles helpers ─────────────────────

  function updateProfile(id: string, patch: Partial<ProviderProfile>) {
    setLLM((s) => ({
      ...s,
      profiles: s.profiles.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    }));
  }

  function addProfile() {
    const p: ProviderProfile = {
      id: newProfileId(),
      name: "",
      format: "openai",
      endpoint: "",
      apiKey: "",
      models: [],
    };
    setLLM((s) => ({
      ...s,
      profiles: [...s.profiles, p],
      // 第一条档案自动设为默认
      activeProfileId: s.activeProfileId || p.id,
    }));
    setExpandedProfile(p.id);
  }

  function removeProfile(id: string) {
    const pf = llm.profiles.find((p) => p.id === id);
    if (!confirm(`删档案「${pf?.name || "未命名"}」? 它的 key 和模型列表一起删.`)) return;
    setLLM((s) => {
      const profiles = s.profiles.filter((p) => p.id !== id);
      const next = { ...s, profiles };
      if (s.activeProfileId === id) {
        next.activeProfileId = profiles[0]?.id ?? "";
        next.activeModel = profiles[0]?.models[0] ?? "";
      }
      return next;
    });
  }

  async function onFetchModels(id: string) {
    const pf = llm.profiles.find((p) => p.id === id);
    if (!pf) return;
    if (!pf.endpoint.trim() || !pf.apiKey.trim()) {
      flash("先填 endpoint + key 再拉模型", "err");
      return;
    }
    setModelsBusy(id);
    try {
      const ids = await fetchModels(pf);
      if (!ids.length) {
        flash("端点返回了空列表", "err");
        return;
      }
      updateProfile(id, { models: ids });
      flash(`拉到 ${ids.length} 个模型 · 记得保存`);
    } catch (err) {
      flash(`拉取失败: ${(err as Error).message.slice(0, 80)}`, "err");
    } finally {
      setModelsBusy(null);
    }
  }

  // 默认档案+模型的 select 值 (option 不够时附加当前值)
  const modelOptions = llm.profiles.flatMap((pf) =>
    pf.models.map((m) => ({ pid: pf.id, model: m, label: `${pf.name || "未命名"} · ${m}` })),
  );
  const activeKey = `${llm.activeProfileId}::${llm.activeModel}`;
  if (
    llm.activeProfileId &&
    llm.activeModel &&
    !modelOptions.some((o) => `${o.pid}::${o.model}` === activeKey)
  ) {
    const pf = llm.profiles.find((p) => p.id === llm.activeProfileId);
    if (pf) {
      modelOptions.push({
        pid: pf.id,
        model: llm.activeModel,
        label: `${pf.name || "未命名"} · ${llm.activeModel}`,
      });
    }
  }

  async function onPickPortrait(
    e: React.ChangeEvent<HTMLInputElement>,
    target: "self" | "other",
  ) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const { base64, contentType } = await fileToBase64(file);
      if (target === "self") await setSelfPortrait(base64, contentType);
      else await setOtherPortrait(base64, contentType);
      await refreshPortraits();
      flash(`${target === "self" ? "你" : "TA"} 的头像上传了`);
    } catch (err) {
      flash(`上传失败: ${(err as Error).message}`, "err");
    }
  }

  async function onClearPortrait(target: "self" | "other") {
    const cn = target === "self" ? "你" : "TA";
    if (!confirm(`删 ${cn} 的头像?`)) return;
    if (target === "self") await clearSelfPortrait();
    else await clearOtherPortrait();
    await refreshPortraits();
    flash(`${cn} 的头像删了`);
  }

  async function onToggleDemo() {
    setDemoBusy(true);
    try {
      if (demoOn) {
        const r = await removeDemo();
        setDemoOn(false);
        flash(`示例清了 · ${r.removed} 条`);
      } else {
        const r = await seedDemo();
        setDemoOn(true);
        flash(`示例塞好了 · ${r.added} 条`);
      }
    } catch (err) {
      flash(`示例切换失败 · ${(err as Error).message}`, "err");
    } finally {
      setDemoBusy(false);
    }
  }

  const inputCls =
    "bg-transparent border-b border-current/30 px-1 py-2 focus:outline-none focus:border-current";
  const labelCls = "text-xs tracking-widest uppercase text-muted-grey";
  const helpCls = "text-xs text-muted-grey";
  const buttonCls =
    "px-4 py-1.5 border border-current/40 text-[11px] tracking-widest uppercase hover:border-current";

  return (
    <main className="flex-1 px-6 md:px-16 py-32">
      <h1 className="font-serif text-5xl tracking-widest text-center">设置</h1>
      <p className={`mt-6 text-center ${helpCls}`}>
        实例配置 · {KIMI_MODE} 版
      </p>

      <form
        onSubmit={onSaveGeneral}
        className="mt-16 max-w-md mx-auto flex flex-col gap-10"
      >
        {/* ── App title ─────────────────────────────────── */}
        <label className="flex flex-col gap-2">
          <span className={labelCls}>应用名</span>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={APP_TITLE_DEFAULT}
            className={`${inputCls} font-serif text-lg`}
          />
          <span className={helpCls}>
            顶栏显示用 · 仅本地浏览器存. PWA 主屏幕名仍走{" "}
            <code>manifest.webmanifest</code> 里的 ({"name"} / {"short_name"}).
          </span>
        </label>

        {/* ── Char name (template sub) ──────────────────── */}
        <label className="flex flex-col gap-2">
          <span className={labelCls}>TA 的名字</span>
          <input
            type="text"
            value={charName}
            onChange={(e) => setCharNameState(e.target.value)}
            placeholder={CHAR_NAME_DEFAULT}
            className={`${inputCls} font-serif text-lg`}
          />
          <span className={helpCls}>
            在 <code>{"{{char}}"}</code> / <code>{"{{char name}}"}</code> 占位符里被替换
            · 用在 keepsake note 占位、chat 人设、LLM prompt.
          </span>
        </label>

        {/* ── User name ─────────────────────────────────── */}
        <label className="flex flex-col gap-2">
          <span className={labelCls}>你的名字</span>
          <input
            type="text"
            value={userName}
            onChange={(e) => setUserNameState(e.target.value)}
            placeholder="you"
            className={`${inputCls} font-serif text-lg`}
          />
          <span className={helpCls}>
            在 <code>{"{{user}}"}</code> 占位符里被替换 · LLM 在 scenario / RP 里称呼你时用.
          </span>
        </label>

        {/* ── LLM profiles ─────────────────────────────── */}
        <fieldset className="flex flex-col gap-4">
          <legend className={labelCls}>LLM 档案</legend>
          <p className={helpCls}>
            每个 provider 一条档案 (DeepSeek / OpenRouter / Claude …) · key 仅存你
            本地浏览器 · 对话页输入框上方可随时切档案和模型, 不用回这里.
          </p>

          {llm.profiles.map((pf) => {
            const expanded = expandedProfile === pf.id;
            return (
              <div
                key={pf.id}
                className="border border-current/20 px-4 py-3 flex flex-col gap-3"
              >
                <button
                  type="button"
                  onClick={() => setExpandedProfile(expanded ? null : pf.id)}
                  className="flex items-center justify-between text-left"
                >
                  <span className="font-serif text-base">
                    {pf.name || "未命名"}
                    <span className="ml-3 text-[10px] tracking-widest uppercase text-muted-grey">
                      {pf.format}
                      {pf.models.length > 0 && ` · ${pf.models.length} models`}
                      {llm.activeProfileId === pf.id && " · 默认"}
                    </span>
                  </span>
                  <span className="text-muted-grey">{expanded ? "−" : "+"}</span>
                </button>

                {expanded && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <label className="flex flex-col gap-1">
                        <span className={helpCls}>名字</span>
                        <input
                          type="text"
                          value={pf.name}
                          onChange={(e) => updateProfile(pf.id, { name: e.target.value })}
                          onBlur={() => {
                            if (!pf.name.trim() && pf.endpoint.trim()) {
                              updateProfile(pf.id, { name: guessProviderName(pf.endpoint) });
                            }
                          }}
                          placeholder="DeepSeek"
                          className={`${inputCls} font-serif text-sm`}
                        />
                      </label>
                      <label className="flex flex-col gap-1">
                        <span className={helpCls}>格式</span>
                        <select
                          value={pf.format}
                          onChange={(e) =>
                            updateProfile(pf.id, {
                              format: e.target.value as ProviderProfile["format"],
                            })
                          }
                          className={`${inputCls} font-mono text-sm bg-transparent`}
                        >
                          <option value="openai">openai compat</option>
                          <option value="anthropic">anthropic 原生</option>
                        </select>
                      </label>
                    </div>
                    <label className="flex flex-col gap-1">
                      <span className={helpCls}>
                        endpoint · base URL 即可 (
                        {pf.format === "anthropic"
                          ? "例: https://api.anthropic.com"
                          : "例: https://api.deepseek.com / https://openrouter.ai/api/v1"}
                        )
                      </span>
                      <input
                        type="url"
                        value={pf.endpoint}
                        onChange={(e) => updateProfile(pf.id, { endpoint: e.target.value })}
                        placeholder={
                          pf.format === "anthropic"
                            ? "https://api.anthropic.com"
                            : "https://api.openai.com/v1"
                        }
                        className={`${inputCls} font-mono text-sm`}
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className={helpCls}>API key · 仅存你本地浏览器</span>
                      <input
                        type="password"
                        value={pf.apiKey}
                        onChange={(e) => updateProfile(pf.id, { apiKey: e.target.value })}
                        placeholder="sk-…"
                        autoComplete="off"
                        className={`${inputCls} font-mono text-sm`}
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className={helpCls}>模型 · 一行一个 (或右下「拉取」自动填)</span>
                      <textarea
                        value={pf.models.join("\n")}
                        onChange={(e) =>
                          updateProfile(pf.id, {
                            models: e.target.value
                              .split("\n")
                              .map((s) => s.trim())
                              .filter(Boolean),
                          })
                        }
                        rows={Math.min(6, Math.max(2, pf.models.length + 1))}
                        placeholder={"deepseek-chat\ndeepseek-reasoner"}
                        className={`${inputCls} font-mono text-sm resize-y`}
                      />
                    </label>
                    <div className="flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => removeProfile(pf.id)}
                        className="text-[10px] tracking-widest uppercase text-current/40 hover:text-current"
                      >
                        删档案
                      </button>
                      <button
                        type="button"
                        onClick={() => onFetchModels(pf.id)}
                        disabled={modelsBusy === pf.id}
                        className={buttonCls}
                        style={{ opacity: modelsBusy === pf.id ? 0.4 : 1 }}
                      >
                        {modelsBusy === pf.id ? "拉取中…" : "拉取模型列表"}
                      </button>
                    </div>
                  </>
                )}
              </div>
            );
          })}

          <button type="button" onClick={addProfile} className={`${buttonCls} self-start`}>
            ＋ 加档案
          </button>

          {modelOptions.length > 0 && (
            <label className="flex flex-col gap-1">
              <span className={helpCls}>默认档案 · 模型 (对话页里也能切)</span>
              <select
                value={activeKey}
                onChange={(e) => {
                  const [pid, ...rest] = e.target.value.split("::");
                  setLLM((s) => ({ ...s, activeProfileId: pid, activeModel: rest.join("::") }));
                }}
                className={`${inputCls} font-mono text-sm bg-transparent`}
              >
                {modelOptions.map((o) => (
                  <option key={`${o.pid}::${o.model}`} value={`${o.pid}::${o.model}`}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          )}

          {/* ── sampling params ── */}
          <div className="grid grid-cols-3 gap-4">
            <label className="flex flex-col gap-1">
              <span className={helpCls}>temperature</span>
              <input
                type="number"
                step={0.1}
                min={0}
                max={2}
                value={llm.params.temperature}
                onChange={(e) =>
                  setLLM((s) => ({
                    ...s,
                    params: { ...s.params, temperature: Number(e.target.value) },
                  }))
                }
                className={`${inputCls} font-mono text-sm`}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className={helpCls}>max tokens</span>
              <input
                type="number"
                step={128}
                min={1}
                value={llm.params.maxTokens}
                onChange={(e) =>
                  setLLM((s) => ({
                    ...s,
                    params: { ...s.params, maxTokens: Number(e.target.value) },
                  }))
                }
                className={`${inputCls} font-mono text-sm`}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className={helpCls}>top p · 空=不发</span>
              <input
                type="number"
                step={0.05}
                min={0}
                max={1}
                value={llm.params.topP ?? ""}
                onChange={(e) =>
                  setLLM((s) => ({
                    ...s,
                    params: {
                      ...s.params,
                      topP: e.target.value === "" ? undefined : Number(e.target.value),
                    },
                  }))
                }
                className={`${inputCls} font-mono text-sm`}
              />
            </label>
          </div>
        </fieldset>

        <button type="submit" className={`${buttonCls} self-start`}>
          保存
        </button>
      </form>

      {/* ── Portraits ───────────────────────────────── */}
      <section className="mt-24 max-w-md mx-auto flex flex-col gap-4">
        <h2 className={labelCls}>头像</h2>
        <p className={helpCls}>
          /room 落地页头像 · 走 IDB blob · 跨设备同步等 Notion / Supabase adapter
          · 默认空 · 内嵌 SVG ring 占位.
        </p>
        <div className="grid grid-cols-2 gap-6 mt-2">
          {(["self", "other"] as const).map((kind) => {
            const preview = kind === "self" ? selfPreview : otherPreview;
            const cnLabel = kind === "self" ? "你" : "TA";
            return (
              <div key={kind} className="flex flex-col items-center gap-2">
                <span className={helpCls}>{cnLabel}</span>
                <div
                  className="w-24 h-24 rounded-full overflow-hidden border border-current/30"
                  style={{
                    backgroundImage: preview ? `url(${preview})` : undefined,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }}
                />
                <label className={`${buttonCls} cursor-pointer`}>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => onPickPortrait(e, kind)}
                    className="hidden"
                  />
                  上传
                </label>
                {preview && (
                  <button
                    type="button"
                    onClick={() => onClearPortrait(kind)}
                    className={`${buttonCls} text-current/60`}
                  >
                    删除
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Calendar meds preset ──────────────────── */}
      <section className="mt-24 max-w-md mx-auto flex flex-col gap-4">
        <h2 className={labelCls}>日历 · 用药预设</h2>
        <p className={helpCls}>
          在这里加你常吃的药 · /room/calendar 点某天会出现这些药做 tap 加量.
          0 个 = 不显示用药区.
        </p>
        <div className="flex flex-col gap-2">
          {meds.map((m) => (
            <div
              key={m.key}
              className="flex items-center justify-between border-b border-current/10 py-1.5"
            >
              <span className="font-serif text-sm">{m.label}</span>
              <button
                type="button"
                onClick={() => removeMed(m.key)}
                className="text-[10px] tracking-widest uppercase text-current/40 hover:text-current"
              >
                删除
              </button>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={medDraft}
            onChange={(e) => setMedDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addMed();
              }
            }}
            placeholder="加一个"
            className={`${inputCls} flex-1 font-serif text-sm`}
          />
          <button
            type="button"
            onClick={addMed}
            disabled={!medDraft.trim()}
            className={buttonCls}
            style={{ opacity: medDraft.trim() ? 1 : 0.4 }}
          >
            ＋ 加
          </button>
        </div>
      </section>

      {/* ── Demo seed data ──────────────────────────────── */}
      <section className="mt-24 max-w-md mx-auto flex flex-col gap-4">
        <h2 className={labelCls}>示例数据</h2>
        <p className={helpCls}>
          塞一份示例 keepsake / memory / book / calendar / 对话 进 IDB ·
          看 6 个模块长什么样. 关掉就清示例 · 你自己加的数据不动.
        </p>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={onToggleDemo}
            disabled={demoBusy}
            className={buttonCls}
          >
            {demoOn ? "关闭示例" : "塞入示例"}
          </button>
          <span className="text-[10px] tracking-widest uppercase text-muted-grey">
            {demoOn ? "ON" : "OFF"}
          </span>
        </div>
      </section>

      {/* ── Data backup ─────────────────────────────────── */}
      <section className="mt-24 max-w-md mx-auto flex flex-col gap-4">
        <h2 className={labelCls}>备份</h2>
        <p className={helpCls}>
          全量导出 / 导入 / 清空 在:{" "}
          <Link href="/backstage/ops" className="underline-offset-4 hover:underline">
            /backstage/ops
          </Link>
        </p>
      </section>

      {/* ── Adapter picker (stub) ─────────────────────── */}
      <section className="mt-24 max-w-md mx-auto flex flex-col gap-4">
        <h2 className={labelCls}>记忆后端</h2>
        <p className={helpCls}>
          现用 IndexedDB · 本地 · 0 配置. NotionAdapter / SupabaseAdapter 后续 ·
          在这里切到云同步.
        </p>
        <div className="text-xs text-current/40 italic">
          Notion · Supabase · custom adapter · TBD
        </div>
      </section>

      {/* ── Room layout (assemble landing blocks) ────── */}
      <RoomLayoutEditor />

      {/* ── footer ────────────────────────────── */}
      <p className={`mt-24 text-center ${helpCls}`}>
        <Link href="/backstage" className="underline-offset-4 hover:underline">
          ← backstage
        </Link>
        <span className="mx-3 opacity-30">·</span>
        <Link href="/room" className="underline-offset-4 hover:underline">
          /room
        </Link>
      </p>

      {toast && (
        <div
          className={`fixed bottom-8 left-1/2 -translate-x-1/2 px-5 py-2 text-xs tracking-widest uppercase border ${
            toast.tone === "ok"
              ? "border-current/40"
              : "border-red-500/60 text-red-500"
          }`}
        >
          {toast.msg}
        </div>
      )}
    </main>
  );
}
