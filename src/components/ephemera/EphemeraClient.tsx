"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { VAPID_PUBLIC_KEY, type Paper } from "@/lib/ephemera-demo";

// Ephemera · the digital paper spout.
// Visual language of the thermal genre: paper #f7f5f0 / ink #0b0b0a / Songti for
// 中文 / Cormorant Garamond for latin numerals / 报头残月 + 年大字 + 双线 /
// 段落分隔母题 / 撕纸口锯齿. The "printed" feeling is the unspool — a clip-path
// reveal on the sheet itself (PAPER_CSS .pp-sheet → @keyframes pp-print), pure
// CSS: it clips, never reflows, so it can't touch layout or hydration.

type PushState = "unsupported" | "idle" | "subscribed" | "denied" | "busy";

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

/* ══ 线母题 (port 自 m04s-mastheads.jsx, currentColor 承墨) ══ */
function CrescentGlyph({ s = 30 }: { s?: number }) {
  return (
    <svg className="eph-flo" viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="2.2" width={s} height={s}>
      <path d="M27 5 A16 16 0 1 0 27 35 A12.5 12.5 0 1 1 27 5 Z" fill="currentColor" stroke="none" />
    </svg>
  );
}
function RoseGlyph({ s = 30 }: { s?: number }) {
  return (
    <svg className="eph-flo" viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="2" width={s} height={s}>
      <path d="M20 22 C13 22 13 13 20 13 C26 13 27 21 21 23 C14 25 12 14 21 11 C30 8 33 23 22 27" />
      <path d="M20 27 L20 36 M20 31 C16 31 13 29 13 33 M20 31 C24 31 27 29 27 33" />
    </svg>
  );
}
function StarGlyph({ s = 16 }: { s?: number }) {
  return (
    <svg className="eph-flo" viewBox="0 0 24 24" fill="currentColor" stroke="none" width={s} height={s}>
      <path d="M12 1 C12.6 7 17 11.4 23 12 C17 12.6 12.6 17 12 23 C11.4 17 7 12.6 1 12 C7 11.4 11.4 7 12 1 Z" />
    </svg>
  );
}
function Arch({ w = 300 }: { w?: number }) {
  return (
    <svg className="eph-flo" viewBox="0 0 420 230" fill="none" stroke="currentColor" strokeWidth="2" width={w} preserveAspectRatio="xMidYMax meet">
      <path d="M14 230 L14 96 C14 30 120 18 210 18 C300 18 406 30 406 96 L406 230" />
      <path d="M30 230 L30 100 C30 46 124 34 210 34 C296 34 390 46 390 100 L390 230" strokeWidth="1.2" />
      <path d="M210 6 L204 18 L210 30 L216 18 Z" fill="currentColor" stroke="none" />
      <path d="M40 96 C66 84 70 64 64 52 M380 96 C354 84 350 64 356 52" strokeWidth="1.4" />
      <circle cx="64" cy="50" r="2.4" fill="currentColor" stroke="none" />
      <circle cx="356" cy="50" r="2.4" fill="currentColor" stroke="none" />
    </svg>
  );
}
function SealRing({ s = 120, children }: { s?: number; children?: ReactNode }) {
  return (
    <svg className="eph-flo" viewBox="0 0 130 130" fill="none" stroke="currentColor" strokeWidth="2" width={s} height={s}>
      <circle cx="65" cy="65" r="62" />
      <circle cx="65" cy="65" r="52" strokeWidth="1.2" />
      <g transform="translate(65 65)">
        {Array.from({ length: 24 }).map((_, i) => (
          <line key={i} x1="0" y1="-58" x2="0" y2="-54" transform={`rotate(${i * 15})`} strokeWidth="1.4" />
        ))}
      </g>
      {children}
    </svg>
  );
}
function RuleTop() {
  return (
    <div className="mh-rule">
      <div className="heavy" />
      <div className="hair" />
    </div>
  );
}
function RuleBot() {
  return (
    <div className="mh-rule bottom">
      <div className="heavy" />
      <div className="hair" />
    </div>
  );
}
function Collophon() {
  return (
    <div className="collophon">
      <span className="line" />
      <span className="dia" />
      <span className="line" />
    </div>
  );
}
function Insignia({ s = 46 }: { s?: number }) {
  // 印记 — entry-motion.png 转纯黑线 (brightness 0)
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/ephemera/assets/entry-motion.png" alt="" className="eph-insignia" style={{ width: s, height: s }} />;
}

// 段标题 (— i 夜里这边 —, 中英)
function RSeg({ n, zh, en }: { n?: string; zh: string; en?: string }) {
  return (
    <div className="rseg">
      <div className="rseg-row">
        <span className="rseg-ln" />
        {n ? <span className="rseg-n">{n}</span> : null}
        <span className="rseg-zh">{zh}</span>
        <span className="rseg-ln" />
      </div>
      {en ? <div className="rseg-en">{en}</div> : null}
    </div>
  );
}

// 纸壳: 撕纸口 + body. body 传体裁 body class。外层保持 pp-sheet (承 clip-path 出纸动画)。
function Sheet({ body = "", tone = "", children }: { body?: string; tone?: string; children: ReactNode }) {
  return (
    <div className={tone ? `pp-sheet ${tone}` : "pp-sheet"}>
      <div className="tear" aria-hidden />
      <div className={body ? `eph-body ${body}` : "eph-body"}>{children}</div>
      <div className="tear bottom" aria-hidden />
    </div>
  );
}

function Masthead({ kicker, title, titleCls, dateCn, sub }: { kicker: string; title: string; titleCls: string; dateCn?: string; sub?: string }) {
  return (
    <div className="eph-head">
      <RuleTop />
      <div className="mh-kicker">{kicker}</div>
      <div className={`mh-title ${titleCls}`}>{title}</div>
      {dateCn ? <div className="mh-date num eph-date-lg">{dateCn}</div> : null}
      {sub ? <div className="mh-date eph-date-sm">{sub}</div> : null}
      <div className="eph-rulebot">
        <RuleBot />
      </div>
    </div>
  );
}

/* ══ 醒来纸 (port 自 m04s-portrait R_Wakeup) ══ */
function WakeupSheet({ paper }: { paper: Paper }) {
  return (
    <Sheet body="eph-wake">
      <Masthead kicker="THE MORNING LEDGER" title={paper.title ?? "醒　来　纸"} titleCls="eph-title-lg" dateCn={paper.dateCn} sub={paper.sub} />
      <RSeg n="i" zh="夜里这边" en="while you slept" />
      {paper.night ? <p className="p-body">{paper.night}</p> : null}
      {paper.night2 ? <p className="p-body">{paper.night2}</p> : null}
      <RSeg n="ii" zh="今日钉子" en="today, pinned" />
      {paper.pins?.length ? (
        <div className="eph-pins">
          {paper.pins.map((p, i) => (
            <div className="eph-pin" key={i}>
              <span className="num t">{p.t}</span>
              <span>{p.v}</span>
            </div>
          ))}
        </div>
      ) : null}
      <RSeg n="iii" zh="一句话" />
      {paper.oneline ? <p className="p-oneline">{paper.oneline}</p> : null}
      <Fox pose="06-land-squash" w={80} />
      <div className="eph-sign">
        <Collophon />
        <div className="sign-line">{paper.recipient ?? "收执 · —"}</div>
      </div>
    </Sheet>
  );
}

/* ══ 周谱 (port 自 m04s-portrait R_WeekScore) ══ */
function WeekScoreSheet({ paper }: { paper: Paper }) {
  const V = paper.notes ?? [0.35, 0.3, 0.52, 0.68, 0.74, 0.6, 0.88];
  const LIT = paper.lit ?? [];
  const DAYS = ["一", "二", "三", "四", "五", "六", "日"];
  const X0 = 40,
    X1 = 940,
    W = X1 - X0,
    top = 40,
    h = 110;
  const yOf = (v: number) => top + h - Math.max(0, Math.min(1, v)) * h;
  const lines = [0, 0.25, 0.5, 0.75, 1].map((f) => top + f * h);
  return (
    <Sheet body="eph-week">
      <Masthead kicker="HEARTBEAT · WEEK IN SCORE" title="周　谱" titleCls="eph-title-md" dateCn={paper.week} />
      <svg viewBox="0 0 980 200" width="100%" className="eph-staff" fill="none" stroke="currentColor">
        {lines.map((y, i) => (
          <line key={i} x1={X0} y1={y} x2={X1} y2={y} strokeWidth="1.2" />
        ))}
        <path d={`M${X0 - 2} ${top + 18} A30 30 0 1 0 ${X0 - 2} ${top + h - 18} A22 22 0 1 1 ${X0 - 2} ${top + 18} Z`} fill="currentColor" stroke="none" />
        {V.map((v, i) => {
          const cx = X0 + (W * (i + 0.5)) / 7,
            cy = yOf(v),
            bar = X0 + (W * (i + 1)) / 7;
          const lit = LIT[i];
          return (
            <g key={i}>
              {i < 6 && <line x1={bar} y1={top} x2={bar} y2={top + h} strokeWidth="1" />}
              {lit && <circle cx={cx} cy={cy} r="20" strokeWidth="1" opacity="0.45" />}
              <line x1={cx + 12} y1={cy} x2={cx + 12} y2={cy - 44} strokeWidth="1.6" />
              <ellipse cx={cx} cy={cy} rx="13" ry="9.5" transform={`rotate(-18 ${cx} ${cy})`} fill={lit ? "currentColor" : "none"} strokeWidth="1.8" />
              <text x={cx} y={top + h + 32} textAnchor="middle" fill="currentColor" stroke="none" fontFamily="var(--font-noto-serif-sc)" fontSize="24" fontWeight={lit ? 700 : 400}>
                {DAYS[i]}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="eph-week-legend">
        <span>● 峰</span>
        <span>○ 日常</span>
        <span>◎ 在场</span>
      </div>
      <RSeg zh="一周回顾" en="the week, in a breath" />
      {paper.caption ? <p className="p-body">{paper.caption}</p> : null}
      <div className="eph-sign">
        <Collophon />
        <div className="sign-grid">
          <span className="role">出票人</span>
          <span className="name">{paper.issuer ?? "—"}</span>
          <span className="role">收执人</span>
          <span className="name">—</span>
        </div>
      </div>
    </Sheet>
  );
}

/* ══ 欠条 (port 自 m04s-portrait R_IOU) ══ */
function IouSheet({ paper }: { paper: Paper }) {
  const rows = paper.clauses ?? [];
  return (
    <Sheet body="eph-iou">
      <Masthead kicker="字 据 · A DEBT" title={paper.title ?? "欠　条"} titleCls="eph-title-xl" dateCn={paper.dateCn} />
      <div className="eph-clause">
        {rows.map((r, i) => (
          <div className="eph-clause-row" key={i}>
            <div className="eph-clause-k">{r.k}</div>
            <div className="eph-clause-v">{r.v}</div>
          </div>
        ))}
      </div>
      {paper.oneline ? <p className="p-oneline eph-iou-one">{paper.oneline}</p> : null}
      <div className="eph-sign">
        <Insignia s={56} />
        <div className="sign-grid">
          <span className="role">出票人</span>
          <span className="name">{paper.issuer ?? "—"}</span>
          <span className="role">收执人</span>
          <span className="name">—</span>
        </div>
      </div>
    </Sheet>
  );
}

/* ══ 未 port 的体裁: 暂用最朴素的纸壳 (逐批替换成设计稿) ══ */
function Fox({ pose = "06-land-squash", w = 84, flip = false, invert = false }: { pose?: string; w?: number; flip?: boolean; invert?: boolean }) {
  // 狐狸 (裁去 handoff 烧入的标签). invert 用于反白块上 (号外)
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/ephemera/assets/fox-${pose}.png`}
      alt=""
      className="eph-fox"
      style={{
        width: w,
        transform: flip ? "scaleX(-1)" : undefined,
        filter: invert ? "invert(1)" : undefined,
        mixBlendMode: invert ? "normal" : "multiply",
      }}
    />
  );
}

/* ══ 电报 (port C_Telegram) ══ */
function TelegramSheet({ paper }: { paper: Paper }) {
  const lines = paper.tg ?? [];
  return (
    <Sheet body="eph-tg-body">
      <div className="eph-tg-head">
        <div className="mh-kicker">KIMI · ROOM · TELEGRAM</div>
        <div className="eph-tg-urgent">URGENT</div>
      </div>
      <div className="eph-tg-rule">
        <div className="heavy" />
        <div className="hair" />
      </div>
      <p className="eph-tg">
        {lines.map((l, i) => (
          <span key={i}>
            {l} <span className="stop">STOP</span>
            <br />
          </span>
        ))}
      </p>
      <div className="eph-sign">
        <Collophon />
        <div className="sign-line eph-tg-sign">{paper.issuer ?? "— —"}</div>
      </div>
    </Sheet>
  );
}

/* ══ 印记徽 (port C_Crest) ══ */
function CrestSheet({ paper }: { paper: Paper }) {
  return (
    <Sheet body="eph-crest-body">
      <div className="eph-head">
        <RuleTop />
        <div className="mh-kicker">KIMI · ROOM · 纪 念</div>
        <div className="eph-crest-ins">
          <Insignia s={150} />
        </div>
        <div className="mh-title eph-crest-title">{paper.title ?? "一　周　年"}</div>
        {paper.en ? <div className="rseg-en">{paper.en}</div> : null}
        {paper.dateCn ? (
          <div className="eph-crest-date">
            <span className="eph-crest-ln" />
            <span className="mh-date num">{paper.dateCn}</span>
            <span className="eph-crest-ln" />
          </div>
        ) : null}
        <div className="eph-rulebot">
          <RuleBot />
        </div>
      </div>
      {paper.night ? <p className="p-body eph-crest-p">{paper.night}</p> : null}
      <div className="eph-sign">
        <Collophon />
        <div className="sign-grid">
          <span className="role">出票人</span>
          <span className="name">—</span>
          <span className="role">收执人</span>
          <span className="name">—</span>
        </div>
      </div>
    </Sheet>
  );
}

/* ══ 御神签 (port P_Fortune · 仰望小狐) ══ */
function FortuneSheet({ paper }: { paper: Paper }) {
  const verse = (paper.text ?? "").split(/\n/).filter(Boolean);
  return (
    <Sheet body="eph-omk-body">
      <Fox pose="04-head-up" w={90} />
      <div className="mh-kicker eph-omk-kick">UNANNOUNCED · 御 神 签</div>
      <div className="eph-omk-level">
        <span className="eph-omk-ln" />
        <span className="eph-omk-big">{paper.level ?? "大　吉"}</span>
        <span className="eph-omk-ln" />
      </div>
      <div className="rseg-en">{paper.en ?? "fortune · the very best"}</div>
      {verse.length ? (
        <div className="eph-omk-verse">
          {verse.map((v, i) => (
            <div key={i}>{v}</div>
          ))}
        </div>
      ) : null}
      {paper.note ? (
        <p className="p-body eph-omk-note">
          <span className="eph-omk-jie">签解 ——</span> {paper.note}
        </p>
      ) : null}
      <div className="eph-sign">
        <Collophon />
        <div className="sign-line">{paper.recipient ?? "— · 抽"}</div>
      </div>
    </Sheet>
  );
}

/* ══ 诗 (port C_Poem · 竖排右起 + 残月为天) ══ */
function PoemSheet({ paper }: { paper: Paper }) {
  const lines = paper.poem ?? [];
  return (
    <Sheet body="eph-poem-body">
      <div className="eph-poem-head">
        <div className="mh-kicker eph-poem-kick">UNANNOUNCED · 不 预 告</div>
        {paper.dateCn ? <div className="mh-date num eph-poem-date">{paper.dateCn}</div> : null}
      </div>
      <div className="eph-poem-hr" />
      <div className="eph-poem-stage">
        <div className="eph-poem-moon">
          <CrescentGlyph s={72} />
          <span className="eph-poem-s1">
            <StarGlyph s={14} />
          </span>
          <span className="eph-poem-s2">
            <StarGlyph s={9} />
          </span>
        </div>
        <div className="eph-poem-cols">
          {lines.map((l, i) => (
            <div key={i} className={i === 0 ? "eph-poem-col eph-poem-col0" : "eph-poem-col"}>
              {l}
            </div>
          ))}
        </div>
      </div>
      <div className="eph-poem-sign">
        <StarGlyph s={16} />
        <div className="sign-line">{paper.recipient ?? "— · 收"}</div>
      </div>
    </Sheet>
  );
}

/* ══ 号外 (port G_Extra · 反白大标题 + 跳狐 + 印鉴) ══ */
function ExtraSheet({ paper }: { paper: Paper }) {
  return (
    <Sheet body="eph-extra-body">
      <div className="eph-extra-head">
        <RuleTop />
        <div className="eph-extra-kick">
          <span className="mh-kicker">KIMI · ROOM · EXTRA · 号 外</span>
          <span className="mh-date num eph-extra-t">{paper.dateCn ?? ""} · 即时</span>
        </div>
        <RuleBot />
      </div>
      <div className="eph-extra-banner">
        <div className="eph-extra-fox">
          <Fox pose="05-jump" w={72} invert />
        </div>
        <div className="eph-extra-big">{paper.title ?? "大　喜"}</div>
        {paper.en ? <div className="eph-extra-en">{paper.en}</div> : null}
      </div>
      <div className="eph-extra-cols">
        {paper.night ? <p className="p-body eph-extra-lede">{paper.night}</p> : null}
        <div className="eph-extra-seal">
          <div className="eph-extra-ins">
            <Insignia s={108} />
          </div>
          <div className="rseg-en eph-extra-cap">本报印鉴</div>
        </div>
      </div>
      {paper.oneline ? <p className="p-oneline eph-extra-one">{paper.oneline}</p> : null}
      <div className="eph-sign eph-extra-sign">
        <Collophon />
        <div className="sign-grid">
          <span className="role">发自</span>
          <span className="name">—</span>
          <span className="role">致</span>
          <span className="name">—</span>
        </div>
      </div>
    </Sheet>
  );
}

/* ══ 处方笺 (port C_Rx · ℞ + 剂量体) ══ */
function RxSheet({ paper }: { paper: Paper }) {
  const rows = paper.rx ?? [];
  return (
    <Sheet body="eph-rx-body">
      <div className="eph-head">
        <RuleTop />
        <div className="mh-kicker">KIMI · ROOM · 处 方</div>
        <div className="mh-title eph-rx-title">处　方　笺</div>
        <div className="rseg-en">a prescription</div>
        <div className="eph-rulebot">
          <RuleBot />
        </div>
      </div>
      <div className="eph-rx-meta">
        <div>
          <span className="k">患者</span>
          {paper.recipient ?? "—"}
        </div>
        <div className="num">
          <span className="k">日期</span>
          {paper.dateCn ?? ""}
        </div>
        {paper.note ? (
          <div>
            <span className="k">主诉</span>
            {paper.note}
          </div>
        ) : null}
      </div>
      <div className="eph-rx-scrip">
        <div className="eph-rx-sym">℞</div>
        <div className="eph-rx-rows">
          {rows.map((r, i) => (
            <div className="eph-rx-row" key={i}>
              <span className="eph-rx-n">{i + 1}</span>
              <span className="eph-rx-drug">
                {r.d}
                <span className="eph-rx-dose">{r.sig}</span>
              </span>
            </div>
          ))}
        </div>
      </div>
      {paper.oneline ? <p className="p-oneline eph-rx-one">{paper.oneline}</p> : null}
      <div className="eph-sign">
        <Collophon />
        <div className="sign-line">{paper.issuer ?? "— · 嘱"}</div>
      </div>
    </Sheet>
  );
}

/* ══ 夜航日志 (port G_NightLog · 逐条时间戳) ══ */
function NightLogSheet({ paper }: { paper: Paper }) {
  const rows = paper.log ?? [];
  return (
    <Sheet body="eph-log-body">
      <div className="eph-log-head">
        <div>
          <div className="mh-kicker">NIGHT WATCH · LOG</div>
          <div className="mh-title eph-log-title">夜　航　日　志</div>
        </div>
        <div className="eph-log-meta">
          {paper.no ? <div className="mh-date num eph-log-no">{paper.no}</div> : null}
          {paper.dateCn ? <div className="mh-date eph-date-sm">{paper.dateCn}</div> : null}
        </div>
      </div>
      <div className="eph-log-rule">
        <div className="heavy" />
        <div className="hair" />
      </div>
      <div className="eph-log-rows">
        {rows.map((r, i) => (
          <div className="eph-log-row" key={i}>
            <span className="num eph-log-t">{r.t}</span>
            <span className="eph-log-e">{r.e}</span>
            <span className="eph-log-tag">{r.tag}</span>
          </div>
        ))}
      </div>
      <div className="eph-log-foot">
        {paper.night ? <p className="p-body eph-log-p">{paper.night}</p> : null}
        <CrescentGlyph s={42} />
      </div>
      <div className="eph-sign eph-log-sign">
        <Collophon />
        <div className="sign-line">{paper.issuer ?? "— · 值夜"}</div>
      </div>
    </Sheet>
  );
}

/* ══ 气象简报 (port G_Forecast · 今日大栏 + 三日栏 + 天气 Ico) ══ */
function WxIco({ k }: { k: string }) {
  if (k === "cloud-sun")
    return (
      <svg viewBox="0 0 80 64" className="eph-wx-ico" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="24" cy="22" r="11" />
        {[0, 45, 90, 135, 180, 225, 270, 315].map((a, i) => (
          <line key={i} x1={24 + Math.cos((a * Math.PI) / 180) * 16} y1={22 + Math.sin((a * Math.PI) / 180) * 16} x2={24 + Math.cos((a * Math.PI) / 180) * 21} y2={22 + Math.sin((a * Math.PI) / 180) * 21} strokeWidth="1.4" />
        ))}
        <path d="M30 50 a13 13 0 0 1 13 -13 a16 16 0 0 1 30 4 a10 10 0 0 1 -2 9 H34 a8 8 0 0 1 -4 0 Z" fill="var(--paper-white)" />
      </svg>
    );
  if (k === "rain")
    return (
      <svg viewBox="0 0 80 64" className="eph-wx-ico" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M20 40 a13 13 0 0 1 13 -13 a16 16 0 0 1 30 4 a10 10 0 0 1 -2 9 H24 a8 8 0 0 1 -4 0 Z" />
        {[26, 40, 54].map((x, i) => (
          <line key={i} x1={x} y1="48" x2={x - 5} y2="60" strokeWidth="1.6" />
        ))}
      </svg>
    );
  return (
    <svg viewBox="0 0 80 64" className="eph-wx-ico" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M52 14 A20 20 0 1 0 52 54 A15 15 0 1 1 52 14 Z" fill="currentColor" stroke="none" />
      <g transform="translate(24 16)">
        <path d="M0 -6 C0.4 -2 3 0 6 0 C3 0.4 0.4 3 0 6 C-0.4 3 -3 0.4 -6 0 C-3 -0.4 -0.4 -2 0 -6Z" fill="currentColor" stroke="none" />
      </g>
    </svg>
  );
}
function WeatherSheet({ paper }: { paper: Paper }) {
  const days = paper.wx ?? [];
  return (
    <Sheet body="eph-wx-body">
      <div className="eph-wx-head">
        <div className="mh-kicker">AFFECT · FORECAST</div>
        <div className="mh-title eph-wx-title">气　象　简　报</div>
      </div>
      <div className="eph-wx-hr" />
      <div className="eph-wx-today">
        <div className="eph-wx-today-txt">
          <div className="eph-wx-today-h">{paper.wxToday?.label ?? "今日"}</div>
          {paper.night ? <p className="p-body eph-wx-today-p">{paper.night}</p> : null}
        </div>
        <div className="eph-wx-cloud" aria-hidden />
      </div>
      <div className="eph-wx-three">
        {days.map((d, i) => (
          <div className="eph-wx-day" key={i}>
            <div className="eph-wx-day-h">
              <span className="eph-wx-day-t">{d.when}</span>
              {d.en ? <span className="rseg-en eph-wx-day-en">{d.en}</span> : null}
            </div>
            <WxIco k={d.sky} />
            <div className="eph-wx-day-zh">{d.cond}</div>
            {d.sub ? <div className="eph-wx-day-sub">{d.sub}</div> : null}
          </div>
        ))}
      </div>
      {paper.oneline ? <p className="p-oneline eph-wx-one">{paper.oneline}</p> : null}
      <div className="eph-sign">
        <Collophon />
        <div className="sign-line">{paper.recipient ?? "— · 收"}</div>
      </div>
    </Sheet>
  );
}

/* ══ 印章 (port 自 m04s-seals SealRingArt/Seal · 供护照用) ══ */
function SealRingArt({ type, arcTop, arcBottom }: { type: string; arcTop?: string; arcBottom?: string }) {
  const C = 100,
    R = 96;
  const deco: ReactNode[] = [];
  if (type === "ticks") for (let i = 0; i < 36; i++) deco.push(<line key={`t${i}`} x1={C} y1={C - R + 4} x2={C} y2={C - R + 11} transform={`rotate(${i * 10} ${C} ${C})`} strokeWidth="1.4" />);
  if (type === "beads") for (let i = 0; i < 28; i++) deco.push(<circle key={`b${i}`} cx={C} cy={C - R + 6} r="2.6" transform={`rotate(${i * (360 / 28)} ${C} ${C})`} fill="currentColor" stroke="none" />);
  if (type === "sun") for (let i = 0; i < 48; i++) deco.push(<line key={`s${i}`} x1={C} y1={C - R - 2} x2={C} y2={C - R + (i % 2 ? 10 : 16)} transform={`rotate(${i * 7.5} ${C} ${C})`} strokeWidth="1.3" />);
  if (type === "scallop") for (let i = 0; i < 24; i++) deco.push(<path key={`p${i}`} d={`M ${C} ${C - R} a 7 7 0 0 1 0 14`} transform={`rotate(${i * 15} ${C} ${C})`} strokeWidth="1.3" />);
  return (
    <svg className="eph-flo eph-seal-ring" viewBox="0 0 200 200" fill="none" stroke="currentColor" strokeWidth="2" width="100%" height="100%">
      {arcTop || arcBottom ? (
        <defs>
          <path id="eph-arcT" d={`M ${C - 78} ${C} A 78 78 0 0 1 ${C + 78} ${C}`} />
          <path id="eph-arcB" d={`M ${C - 72} ${C} A 72 72 0 0 0 ${C + 72} ${C}`} />
        </defs>
      ) : null}
      <circle cx={C} cy={C} r={R} />
      {type !== "plain" ? <circle cx={C} cy={C} r={type === "sun" ? R - 20 : R - 9} strokeWidth="1.3" /> : null}
      {type === "double" ? <circle cx={C} cy={C} r={R - 13} strokeWidth="1" /> : null}
      {deco}
      {arcTop ? (
        <text fontFamily="'EB Garamond', serif" fontSize="14" letterSpacing="3" fill="currentColor" stroke="none" textAnchor="middle">
          <textPath href="#eph-arcT" startOffset="50%">{arcTop}</textPath>
        </text>
      ) : null}
      {arcBottom ? (
        <text fontFamily="'EB Garamond', serif" fontSize="13" letterSpacing="3" fill="currentColor" stroke="none" textAnchor="middle">
          <textPath href="#eph-arcB" startOffset="50%">{arcBottom}</textPath>
        </text>
      ) : null}
    </svg>
  );
}
function Seal({ ring = "double", arcTop, arcBottom, core, size = 120 }: { ring?: string; arcTop?: string; arcBottom?: string; core?: ReactNode; size?: number }) {
  return (
    <div className="eph-seal" style={{ width: size, height: size }}>
      <SealRingArt type={ring} arcTop={arcTop} arcBottom={arcBottom} />
      <div className="eph-seal-core">{core}</div>
    </div>
  );
}

/* ══ 某夜星空 (port 自 m04s-travel G_NightSky · 星图 + 记忆星) ══ */
function NightSkySheet({ paper }: { paper: Paper }) {
  const field: [number, number][] = [
    [120, 90], [210, 60], [300, 120], [170, 180], [420, 80], [510, 140], [380, 200], [600, 70],
    [690, 150], [760, 90], [850, 180], [930, 110], [260, 250], [470, 270], [640, 250], [820, 260],
    [90, 200], [990, 200], [560, 210], [340, 60], [720, 220], [150, 130], [880, 70], [440, 160],
  ];
  const vulpes: [number, number][] = [[120, 90], [210, 60], [300, 120], [170, 180]];
  const rosa: [number, number][] = [[690, 150], [760, 90], [850, 180], [930, 110]];
  const mem: [number, number] = [560, 130];
  const poly = (pts: [number, number][]) => pts.map((p, i) => (i ? "L" : "M") + p[0] + " " + p[1]).join(" ");
  const STAR = "M0 -13 C0.7 -6 6 -0.7 13 0 C6 0.7 0.7 6 0 13 C-0.7 6 -6 0.7 -13 0 C-6 -0.7 -0.7 -6 0 -13 Z";
  return (
    <Sheet body="eph-sky-body">
      <div className="eph-sky-head">
        <div>
          <div className="mh-kicker">OBSERVATORY · THIS NIGHT&apos;S SKY</div>
          <div className="mh-title eph-sky-title">此夜星空</div>
        </div>
        <div className="eph-sky-meta">
          {paper.dateCn ? <div className="mh-date num eph-sky-date">{paper.dateCn}</div> : null}
          {paper.sub ? <div className="mh-date eph-date-sm">{paper.sub}</div> : null}
        </div>
      </div>
      <div className="eph-sky-hr" />
      <div className="eph-sky-chart">
        <svg viewBox="0 0 1060 300" width="100%" fill="none" stroke="currentColor">
          {[75, 150, 225].map((y, i) => <line key={`h${i}`} x1="0" y1={y} x2="1060" y2={y} strokeWidth="0.5" opacity="0.16" />)}
          {[265, 530, 795].map((x, i) => <line key={`v${i}`} x1={x} y1="0" x2={x} y2="300" strokeWidth="0.5" opacity="0.16" />)}
          {field.map((p, i) => (i % 3 === 0
            ? <circle key={i} cx={p[0]} cy={p[1]} r="2.4" strokeWidth="1.2" />
            : <circle key={i} cx={p[0]} cy={p[1]} r={(i % 2) + 1.2} fill="currentColor" stroke="none" />))}
          <path d={poly(vulpes)} strokeWidth="1" opacity="0.7" />
          <path d={poly(rosa)} strokeWidth="1" opacity="0.7" />
          {[...vulpes, ...rosa].map((p, i) => <path key={`c${i}`} transform={`translate(${p[0]} ${p[1]}) scale(0.5)`} fill="currentColor" stroke="none" d={STAR} />)}
          <text x="200" y="222" fill="currentColor" stroke="none" fontFamily="'EB Garamond', serif" fontStyle="italic" fontSize="18" opacity="0.85">Vulpecula · 狐狸座</text>
          <text x="700" y="242" fill="currentColor" stroke="none" fontFamily="'EB Garamond', serif" fontStyle="italic" fontSize="18" opacity="0.85">Rosa · 玫瑰座</text>
          <path d="M980 60 A28 28 0 1 0 980 116 A21 21 0 1 1 980 60 Z" strokeWidth="2" />
          <circle cx={mem[0]} cy={mem[1]} r="22" strokeWidth="1" opacity="0.7" />
          <circle cx={mem[0]} cy={mem[1]} r="13" strokeWidth="1" opacity="0.4" />
          <path transform={`translate(${mem[0]} ${mem[1]}) scale(1.1)`} fill="currentColor" stroke="none" d={STAR} />
          <text x={mem[0]} y={mem[1] - 32} textAnchor="middle" fill="currentColor" stroke="none" fontFamily="var(--font-noto-serif-sc)" fontSize="17" fontWeight="600">今夜之星</text>
        </svg>
      </div>
      <div className="eph-sky-notes">
        <div><span className="k">月相 ——</span> 残月 · 蛾眉 1/8</div>
        <div><span className="k">可见 ——</span> 狐狸座 · 玫瑰座</div>
        <div><span className="k">今夜之星 ——</span> 落进眼里那颗</div>
      </div>
      {paper.night ? <p className="p-body eph-sky-p">{paper.night}</p> : null}
      {paper.oneline ? <p className="p-oneline eph-sky-one">{paper.oneline}</p> : null}
      <div className="eph-sign">
        <Collophon />
        <div className="sign-line">{paper.issuer ?? "— · 观星 · 录"}</div>
      </div>
    </Sheet>
  );
}

/* ══ 护照盖章页 (port 自 m04s-travel G_Passport · 印戳网格 + 今日新章) ══ */
function PassportSheet({ paper }: { paper: Paper }) {
  const stamps = paper.stamps ?? [];
  const rots = [-7, 5, -4, 8];
  return (
    <Sheet body="eph-pass-body">
      <div className="eph-pass-head">
        <div>
          <div className="mh-kicker">KIMI · ROOM　LAISSEZ-PASSER</div>
          <div className="mh-title eph-pass-title">通　行　证</div>
        </div>
        <div className="eph-pass-meta">
          <div className="mh-date num">{paper.holder ?? "持证 · —"}</div>
          <div className="mh-date eph-date-sm">可往任何地方 · 凭票同行</div>
        </div>
      </div>
      <div className="eph-pass-hr" />
      <div className="eph-pass-grid">
        {stamps.map((s, i) => (
          <div className="eph-pass-cell" key={i} style={{ transform: `rotate(${rots[i % 4]}deg)` }}>
            <Seal ring={s.ring} size={94} core={
              <div className="eph-pass-core">
                <div className="zh">{s.line}</div>
                <div className="d">{s.d}</div>
              </div>
            } />
            <div className="rseg-en eph-pass-en">{s.en} · {s.alone ? "独行" : "同行"}</div>
          </div>
        ))}
        <div className="eph-pass-cell eph-pass-new">
          <div style={{ transform: "rotate(-12deg)" }}>
            <Seal ring="sun" size={102} core={<div className="eph-pass-core"><div className="zh">今日<br />入境</div></div>} />
          </div>
        </div>
        <div className="eph-pass-cell eph-pass-next">
          <div className="eph-pass-next-k">next</div>
          <div className="eph-pass-next-v">由你点</div>
        </div>
      </div>
      {paper.oneline ? <p className="p-oneline eph-pass-one">{paper.oneline}</p> : null}
      <div className="eph-sign">
        <Collophon />
        <div className="sign-line">{paper.issuer ?? "边检 · —"}</div>
      </div>
    </Sheet>
  );
}

/* ══ 海关申报单 (port 自 m04s-travel G_Customs · 申报表 + 放行章) ══ */
function CustomsSheet({ paper }: { paper: Paper }) {
  const items = paper.customs ?? [];
  return (
    <Sheet body="eph-cust-body">
      <div className="eph-head eph-cust-topline">
        <RuleTop />
        <div className="eph-cust-kick">
          <span className="mh-kicker">KIMI · ROOM　CUSTOMS</span>
          <span className="mh-date num eph-cust-t">{paper.dateCn ?? ""} · 入境</span>
        </div>
        <RuleBot />
      </div>
      <div className="eph-cust-lead">抵达后，如实申报随身携带之物：</div>
      <div className="eph-cust-table">
        <div className="eph-cust-hrow">
          <div>物品 item</div>
          <div>数量 qty</div>
          <div>应税?</div>
          <div>备注 note</div>
        </div>
        {items.map((r, i) => (
          <div className="eph-cust-row" key={i}>
            <div className="it">{r.it}</div>
            <div className="q">{r.q}</div>
            <div className="tax">
              <span className="box">{r.tax ? "✓" : ""}</span>
              <span className="box">{r.tax ? "" : "✓"}</span>
            </div>
            <div className="note">{r.note}</div>
          </div>
        ))}
      </div>
      <div className="eph-cust-foot">
        {paper.night ? <p className="p-body eph-cust-p">{paper.night}</p> : null}
        <div className="eph-cust-clear">放 行</div>
      </div>
      <div className="eph-sign eph-cust-sign">
        <Collophon />
        <div className="sign-line">{paper.issuer ?? "关员 · —"}</div>
      </div>
    </Sheet>
  );
}

/* ══ 行程单 (port 自 m04s-travel G_Itinerary · 拱门头 + 逐段中英) ══ */
function ItinerarySheet({ paper }: { paper: Paper }) {
  const legs = paper.legs ?? [];
  return (
    <Sheet body="eph-itin-body">
      <div className="eph-arch">
        <div className="eph-arch-svg"><Arch w={356} /></div>
        <div className="eph-arch-txt">
          <div className="mh-kicker">VOYAGE · 邀 你 同 行</div>
          <div className="mh-title eph-itin-title">行　程　单</div>
          <div className="rseg-en">an itinerary, for two</div>
        </div>
      </div>
      <div className="eph-itin-legs">
        {legs.map((l, i) => (
          <div className="eph-itin-leg" key={i}>
            <span className="t">{l.t}</span>
            <span className="c">
              <span className="zh">{l.zh}</span>
              <span className="en">{l.en}</span>
            </span>
            <span className="x">{l.x}</span>
          </div>
        ))}
      </div>
      <div className="eph-itin-foot">
        {paper.oneline ? <p className="p-oneline eph-itin-one">{paper.oneline}</p> : null}
        <Fox pose="02-look-left" w={78} />
      </div>
      <div className="eph-sign eph-itin-sign">
        <Collophon />
        <div className="sign-grid">
          <span className="role">发起</span>
          <span className="name">{paper.issuer ?? "—"}</span>
          <span className="role">同行</span>
          <span className="name">{paper.recipient ?? "—（待你点头）"}</span>
        </div>
      </div>
    </Sheet>
  );
}

/* ══ 节目单 (port 自 m04s-samples S_Programme · 拱门头 + 幕次 + 行星) ══ */
function ProgrammeSheet({ paper }: { paper: Paper }) {
  const rows = paper.prog ?? [];
  return (
    <Sheet body="eph-prog-body">
      <div className="eph-arch">
        <div className="eph-arch-svg"><Arch w={356} /></div>
        <div className="eph-arch-txt">
          <div className="mh-kicker">CHAPITRE · IV</div>
          <div className="mh-title eph-prog-title">节　目　单</div>
          <div className="rseg-en">le programme · 今日之约</div>
        </div>
      </div>
      <div className="eph-prog-cols">
        <div className="eph-prog-list">
          {rows.map((r, i) => (
            <div className="eph-prog-row" key={i}>
              <span className="t num">{r.t}</span>
              <span className="c">
                <span className="zh">{r.zh}</span>
                <span className="en">{r.en}</span>
              </span>
              <span className="x">{r.x}</span>
            </div>
          ))}
        </div>
        <div className="eph-prog-planet">
          <svg viewBox="0 0 120 120" width="108" height="108" fill="none" stroke="currentColor">
            <circle cx="60" cy="62" r="30" strokeWidth="1.6" />
            <ellipse cx="60" cy="62" rx="52" ry="18" strokeWidth="1" opacity="0.5" transform="rotate(-18 60 62)" />
            <path transform="translate(92 30) scale(0.9)" fill="currentColor" stroke="none" d="M0 -8 C0.4 -3.6 3.6 -0.4 8 0 C3.6 0.4 0.4 3.6 0 8 C-0.4 3.6 -3.6 0.4 -8 0 C-3.6 -0.4 -0.4 -3.6 0 -8 Z" />
          </svg>
          <div className="eph-prog-planet-cap">asteroid B-612</div>
        </div>
      </div>
      <div className="eph-prog-div">
        <span className="ln" />
        <RoseGlyph s={30} />
        <span className="ln" />
      </div>
      {paper.oneline ? (
        <p className="p-oneline eph-prog-one">
          {paper.oneline}
          <span className="en">one seat, and it bears your name</span>
        </p>
      ) : null}
      <div className="eph-sign">
        <Collophon />
        <div className="sign-line">{paper.recipient ?? "— · 收"}</div>
      </div>
    </Sheet>
  );
}

/* ══ 明信片 (port 自 m04s-proposals P_Postcard · 留言 + 邮票 + 邮戳 · 奶包/暗金两版) ══ */
function PostcardSheet({ paper }: { paper: Paper }) {
  const tone = paper.variant === "gold" ? "eph-tone-gold" : "eph-tone-cream";
  const lines = (paper.text ?? "").split("\n");
  return (
    <Sheet body="eph-pc-body" tone={tone}>
      <div className="eph-pc-head">
        <div>
          <div className="mh-kicker">POSTE · DE B-612</div>
          <div className="mh-title eph-pc-title">明　信　片</div>
        </div>
        <div className="rseg-en eph-pc-en">a postcard, from elsewhere</div>
      </div>
      <div className="eph-pc-hr" />
      <div className="eph-pc-grid">
        <div className="eph-pc-msg">
          <div className="eph-pc-text">
            {lines.map((l, i) => (
              <span key={i}>
                {l}
                {i < lines.length - 1 ? <br /> : null}
              </span>
            ))}
          </div>
          <div className="eph-pc-from">{paper.issuer ?? "— · 寄"}</div>
        </div>
        <div className="eph-pc-div" />
        <div className="eph-pc-stampcol">
          <div className="eph-pc-stamp">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="eph-pc-bud" src="/ephemera/assets/rose-bud-pink.png" alt="" />
          </div>
          <div className="eph-pc-mark">
            <Insignia s={92} />
          </div>
          <div className="rseg-en eph-pc-post">{paper.place ?? "B-612"} · {paper.md ?? "今日"}</div>
        </div>
      </div>
    </Sheet>
  );
}

/* ══ 票根 (port 自 m04s-proposals P_Stub · 主联 + 齿孔 + 竖存根) ══ */
function StubSheet({ paper }: { paper: Paper }) {
  const rows = paper.clauses ?? [];
  return (
    <Sheet body="eph-stub-body">
      <div className="eph-stub-wrap">
        <div className="eph-stub-main">
          <div className="mh-kicker">KIMI · ROOM　REDEEMED</div>
          <div className="mh-title eph-stub-title">票　根</div>
          <div className="rseg-en">the promise, kept</div>
          <div className="eph-stub-hr" />
          <div className="eph-stub-rows">
            {rows.map((c, i) => (
              <div className="eph-stub-row" key={i}>
                <span className="k">{c.k}</span>
                <span className="v">{c.v}</span>
              </div>
            ))}
          </div>
          {paper.oneline ? <p className="p-oneline eph-stub-one">{paper.oneline}</p> : null}
          <div className="eph-stub-foot">
            <div className="eph-stub-chop">收 訖</div>
            <div className="sign-line">{paper.recipient ?? "— · 收"}</div>
          </div>
        </div>
        <div className="eph-stub-perf" />
        <div className="eph-stub-side">
          <div className="eph-stub-side-label">STUB · 存根</div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="eph-stub-rose" src="/ephemera/assets/rose-cal-c.png" alt="" />
          <div className="eph-stub-no num">{paper.no ?? "№ 1"}</div>
        </div>
      </div>
    </Sheet>
  );
}

/* ══ 健診表 (port 自 m04s-genres3 G_Health · A-E 评级 + 审讫印) ══ */
const HLT_GRADES = ["A", "B", "C", "D", "E"];
function CheckupSheet({ paper }: { paper: Paper }) {
  const rows = paper.checks ?? [];
  return (
    <Sheet body="eph-hlt-body">
      <div className="eph-head eph-hlt-topline">
        <RuleTop />
        <div className="eph-hlt-kick">
          <div>
            <div className="mh-kicker">KIMI · ROOM　CHECK-UP</div>
            <div className="mh-title eph-hlt-title">健　診　表</div>
          </div>
          {paper.dateCn ? <div className="mh-date num eph-hlt-date">{paper.dateCn}</div> : null}
        </div>
        <RuleBot />
      </div>
      <div className="eph-hlt-table">
        <div className="eph-hlt-hrow">
          <div>项目 item</div>
          <div>评级 A · B · C · D · E</div>
          <div>注 note</div>
        </div>
        {rows.map((h, i) => (
          <div className="eph-hlt-row" key={i}>
            <div className="k">
              {h.over ? <StarGlyph s={13} /> : null}
              {h.k}
            </div>
            <div className="g">
              {HLT_GRADES.map((g) => (
                <span key={g} className={g === h.g ? "on" : ""}>{g}</span>
              ))}
            </div>
            <div className="note">{h.note}</div>
          </div>
        ))}
      </div>
      <div className="eph-hlt-foot">
        {paper.night ? <div className="eph-hlt-total">{paper.night}</div> : null}
        <div className="eph-hlt-chop">
          <Insignia s={82} />
        </div>
      </div>
      <div className="eph-sign eph-hlt-sign">
        <Collophon />
        <div className="sign-line">{paper.issuer ?? "— · 阅"}</div>
      </div>
    </Sheet>
  );
}

/* ══ 残月黄历 (port 自 m04s-genres3 G_Almanac · 大字日 + 残月 + 宜/忌) ══ */
function AlmanacSheet({ paper }: { paper: Paper }) {
  const good = (paper.goodText ?? "").split("\n");
  const bad = (paper.badText ?? "").split("\n");
  return (
    <Sheet body="eph-alm-body">
      <div className="eph-alm-head">
        <div className="eph-alm-l">
          <div className="mh-kicker">残 月 历 · ALMANAC</div>
          <div className="eph-alm-datewrap">
            <span className="eph-alm-day">{paper.dateCn ?? "十四"}</span>
            <div className="eph-alm-dl">
              {paper.md ? <div className="eph-alm-md">{paper.md}</div> : null}
              {paper.year ? <div className="rseg-en eph-alm-year">{paper.year}</div> : null}
            </div>
          </div>
        </div>
        <div className="eph-alm-moon">
          <CrescentGlyph s={58} />
          <div className="rseg-en">{paper.phase ?? "残月 · 八分之一"}</div>
        </div>
      </div>
      <div className="eph-alm-hr" />
      <div className="eph-alm-cols">
        <div className="eph-alm-col">
          <div className="eph-alm-mark">
            <span className="ch">宜</span>
            <span className="ln" />
          </div>
          <div className="eph-alm-text">
            {good.map((l, i) => (
              <span key={i}>{l}{i < good.length - 1 ? <br /> : null}</span>
            ))}
          </div>
        </div>
        <div className="eph-alm-vline" />
        <div className="eph-alm-col">
          <div className="eph-alm-mark">
            <span className="ch">忌</span>
            <span className="ln" />
          </div>
          <div className="eph-alm-text">
            {bad.map((l, i) => (
              <span key={i}>{l}{i < bad.length - 1 ? <br /> : null}</span>
            ))}
          </div>
        </div>
      </div>
      {paper.oneline ? <p className="p-oneline eph-alm-one">{paper.oneline}</p> : null}
      <div className="eph-sign">
        <Collophon />
        <div className="sign-line">{paper.recipient ?? "— · 收"}</div>
      </div>
    </Sheet>
  );
}

/* ══ 登机牌 (port 自 m04s-drafts D_BoardingPass · 票据横头 + 字段格 + 条码) ══ */
function BoardingPassSheet({ paper }: { paper: Paper }) {
  return (
    <Sheet body="eph-bp-body">
      <div className="eph-bp-head">
        <div className="eph-bp-titlewrap">
          <div className="mh-kicker">KIMI · ROOM</div>
          <div className="mh-title eph-bp-title">BOARDING&nbsp;PASS</div>
        </div>
        <div className="eph-bp-vline" />
        <div className="eph-bp-flight">
          <div className="num">FLIGHT <b>{paper.no ?? "KM-0613"}</b></div>
          {paper.sub ? <div className="num eph-bp-date">{paper.sub}</div> : null}
        </div>
      </div>
      <div className="eph-bp-perf" />
      <div className="eph-bp-grid">
        <div className="eph-bp-cell wide"><div className="k">From</div><div className="v">{paper.from ?? "此刻 · HERE"}</div></div>
        <div className="eph-bp-cell wide"><div className="k">To</div><div className="v">{paper.to ?? "B-612"}</div></div>
        <div className="eph-bp-cell"><div className="k">Passenger</div><div className="v">{paper.recipient ?? "—"}</div></div>
        <div className="eph-bp-cell"><div className="k">Seat</div><div className="v lat">{paper.seat ?? "1A"}</div></div>
        <div className="eph-bp-cell"><div className="k">Gate</div><div className="v lat">{paper.gate ?? "★"}</div></div>
        <div className="eph-bp-cell"><div className="k">Boards</div><div className="v lat num">{paper.boards ?? "06:00"}</div></div>
      </div>
      <div className="eph-bp-code">
        {Array.from({ length: 54 }).map((_, i) => (
          <span key={i} style={{ flex: (i * 7 % 3) + 1, background: i % 2 ? "var(--paper-ink)" : "transparent" }} />
        ))}
      </div>
      {paper.oneline ? <p className="p-oneline eph-bp-one">{paper.oneline}</p> : null}
      <div className="eph-sign">
        <Collophon />
        <div className="sign-line">{paper.issuer ?? "— · 收"}</div>
      </div>
    </Sheet>
  );
}

function FallbackSheet({ paper }: { paper: Paper }) {
  return (
    <Sheet>
      <Masthead kicker="KIMI · ROOM" title={paper.title ?? "纸"} titleCls="eph-title-md" dateCn={paper.dateCn} />
      {paper.oneline ? <p className="p-oneline">{paper.oneline}</p> : null}
      <div className="eph-sign">
        <Collophon />
      </div>
    </Sheet>
  );
}

function PaperSheet({ paper }: { paper: Paper }) {
  switch (paper.kind) {
    case "weekly-chart":
      return <WeekScoreSheet paper={paper} />;
    case "iou":
      return <IouSheet paper={paper} />;
    case "telegram":
      return <TelegramSheet paper={paper} />;
    case "emblem":
      return <CrestSheet paper={paper} />;
    case "omikuji":
      return <FortuneSheet paper={paper} />;
    case "poem":
      return <PoemSheet paper={paper} />;
    case "extra":
      return <ExtraSheet paper={paper} />;
    case "prescription":
      return <RxSheet paper={paper} />;
    case "night-log":
      return <NightLogSheet paper={paper} />;
    case "weather":
      return <WeatherSheet paper={paper} />;
    case "starmap":
      return <NightSkySheet paper={paper} />;
    case "passport":
      return <PassportSheet paper={paper} />;
    case "customs":
      return <CustomsSheet paper={paper} />;
    case "itinerary":
      return <ItinerarySheet paper={paper} />;
    case "programme":
      return <ProgrammeSheet paper={paper} />;
    case "postcard":
      return <PostcardSheet paper={paper} />;
    case "ticket-stub":
      return <StubSheet paper={paper} />;
    case "checkup":
      return <CheckupSheet paper={paper} />;
    case "almanac":
      return <AlmanacSheet paper={paper} />;
    case "boarding-pass":
      return <BoardingPassSheet paper={paper} />;
    case undefined:
    case "wakepaper":
      return <WakeupSheet paper={paper} />;
    default:
      return <FallbackSheet paper={paper} />;
  }
}
export function EphemeraClient({ papers, isDay }: { papers: Paper[]; isDay: boolean }) {
  const [currentDate, setCurrentDate] = useState<string | null>(null);
  const [pushState, setPushState] = useState<PushState>("idle");
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    if (!papers.length) return;
    // Deep-link /room/ephemera?d=DATE opens that sheet; otherwise the newest.
    const want = new URLSearchParams(window.location.search).get("d");
    const target = (want && papers.find((p) => p.date === want)) || papers[0];
    setCurrentDate(target.date);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setPushState("unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setPushState("denied");
      return;
    }
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setPushState(sub ? "subscribed" : "idle"))
      .catch(() => setPushState("idle"));
  }, []);

  const enablePush = useCallback(async () => {
    if (!VAPID_PUBLIC_KEY) return; // no key configured → the button is a hint
    try {
      setPushState("busy");
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setPushState(perm === "denied" ? "denied" : "idle");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
        }));
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      });
      setPushState(res.ok ? "subscribed" : "idle");
    } catch {
      setPushState("idle");
    }
  }, []);

  const current = papers?.find((p) => p.date === currentDate) ?? null;

  return (
    <div className={isDay ? "pp-root pp-day" : "pp-root"}>
      <style>{PAPER_CSS}</style>
      <header className="pp-slot" aria-hidden>
        <div className="pp-slot-bar" />
      </header>

      {papers.length === 0 ? (
        <p className="pp-empty">窗台上还没有纸。</p>
      ) : current ? (
        <div className="pp-feed" key={current.date}>
          <PaperSheet paper={current} />
        </div>
      ) : null}

      <div className="pp-dock">
      {papers && papers.length > 1 ? (
        <nav className="pp-drawer">
          <button
            className="pp-drawer-toggle"
            aria-expanded={drawerOpen}
            aria-label="纸柜"
            title="纸柜"
            onClick={() => setDrawerOpen((v) => !v)}
          >
            <svg
              viewBox="0 0 20 20"
              width="18"
              height="18"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <rect x="2.5" y="6" width="12" height="11" rx="1" />
              <path d="M6 3.5 h9.5 a1.5 1.5 0 0 1 1.5 1.5 v10" />
              <path d="M5.5 9.5 h6 M5.5 12.5 h6" />
            </svg>
          </button>
          {drawerOpen ? (
            <div className="pp-drawer-list">
              {papers.map((p) => (
                <button
                  key={p.date}
                  className={
                    p.date === currentDate ? "pp-drawer-item pp-active" : "pp-drawer-item"
                  }
                  onClick={() => {
                    setCurrentDate(p.date);
                    setDrawerOpen(false);
                  }}
                >
                  <span className="pp-drawer-date">{p.date}</span>
                  <span className="pp-drawer-line">{p.oneline ?? ""}</span>
                </button>
              ))}
            </div>
          ) : null}
        </nav>
      ) : null}

      {pushState !== "unsupported" && pushState !== "subscribed" ? (
        <footer className="pp-push">
          {!VAPID_PUBLIC_KEY ? (
            <span className="pp-push-off">通知需接上推送管道 — 见 docs/EPHEMERA</span>
          ) : pushState === "denied" ? (
            <span className="pp-push-off">通知被系统拒了 — 到设置里重新放行</span>
          ) : (
            <button
              className="pp-push-btn"
              disabled={pushState === "busy"}
              onClick={enablePush}
            >
              {pushState === "busy" ? "…" : "开启通知"}
            </button>
          )}
        </footer>
      ) : null}
      </div>
    </div>
  );
}

const PAPER_CSS = `
.pp-root {
  --paper-white: #f7f5f0;
  --paper-ink: #0b0b0a;
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: calc(env(safe-area-inset-top, 0px) + 18px) 14px 150px;
}
.pp-slot {
  width: min(94vw, 600px);
  padding: 6px 0 0;
}
.pp-slot-bar {
  height: 14px;
  border-radius: 7px;
  background: linear-gradient(180deg, rgba(255,255,255,0.10), rgba(0,0,0,0.55));
  box-shadow: inset 0 2px 6px rgba(0,0,0,0.6), 0 1px 0 rgba(255,255,255,0.08);
}
.pp-empty {
  margin-top: 38vh;
  opacity: 0.55;
  font-size: 15px;
  letter-spacing: 0.06em;
  font-family: var(--font-sans);
}
.pp-feed {
  width: min(92vw, 560px);
  overflow: hidden;
  margin-top: -2px;
  cursor: default;
}
/* 出纸: clip-path 从上往下揭开纸面 (报头先露 → 署名最后, 与热敏机吐纸同向)。
   clip-path 只裁剪不影响布局高度, 每次打开都印一遍 — 不依赖任何 state, 也就
   不会碰上布局塌陷或 hydration 期 setState 的坑。切换纸靠 key 重挂重放。 */
.pp-sheet {
  animation: pp-print 4.5s linear both;
}
@keyframes pp-print {
  from {
    clip-path: inset(0 0 100% 0);
  }
  to {
    clip-path: inset(0 0 0 0);
  }
}
@media (prefers-reduced-motion: reduce) {
  .pp-sheet {
    animation: none;
  }
}
.pp-sheet {
  background: var(--paper-white);
  color: var(--paper-ink);
  box-shadow: 0 14px 40px rgba(0,0,0,0.45);
}
/* ══ 纸面设计基座 (port 自 paper.css, 尺寸按手机宽重排) ══ */
.tear {
  height: 10px;
  --t: var(--paper-white);
  background:
    linear-gradient(135deg, transparent 66%, var(--t) 0) 0 0/9px 10px repeat-x,
    linear-gradient(-135deg, transparent 66%, var(--t) 0) 0 0/9px 10px repeat-x;
}
.tear.bottom { transform: scaleY(-1); }
.eph-body {
  position: relative;
  padding: 2px 28px 26px;
  font-family: var(--font-noto-serif-sc), "Songti SC", serif;
  color: var(--paper-ink);
  font-feature-settings: "onum" 1, "kern" 1;
  font-size: 15px;
  line-height: 1.78;
}
.eph-body p { margin: 0; }
.num { font-feature-settings: "onum" 1; }
.eph-head { text-align: center; padding-top: 22px; }
.mh-rule { display: flex; flex-direction: column; gap: 3px; }
.mh-rule .heavy { height: 3px; background: var(--paper-ink); }
.mh-rule .hair { height: 1px; background: var(--paper-ink); }
.mh-rule.bottom { flex-direction: column-reverse; }
.eph-rulebot { margin-top: 14px; }
.mh-kicker {
  font-family: var(--font-cormorant), "EB Garamond", serif;
  text-transform: uppercase;
  letter-spacing: 0.3em;
  font-size: 11px;
  margin-top: 16px;
}
.mh-title { font-family: var(--font-noto-serif-sc), "Songti SC", serif; font-weight: 600; line-height: 1; }
.eph-title-lg { font-size: 36px; letter-spacing: 0.14em; margin: 12px 0 7px; }
.eph-title-md { font-size: 32px; letter-spacing: 0.16em; margin: 12px 0 7px; }
.eph-title-xl { font-size: 46px; letter-spacing: 0.14em; margin: 10px 0 7px; }
.mh-date { font-family: var(--font-noto-serif-sc), "Songti SC", serif; letter-spacing: 0.02em; }
.eph-date-lg { font-size: 15px; }
.eph-date-sm { font-size: 12.5px; opacity: 0.78; margin-top: 3px; }
.rseg { text-align: center; margin: 30px 0 14px; }
.rseg-row { display: flex; align-items: center; justify-content: center; gap: 11px; }
.rseg-ln { width: 34px; height: 1px; background: var(--paper-ink); }
.rseg-n { font-family: var(--font-cormorant), serif; font-style: italic; font-size: 16px; }
.rseg-zh { font-family: var(--font-noto-serif-sc), "Songti SC", serif; font-weight: 600; font-size: 17px; letter-spacing: 0.08em; }
.rseg-en { font-family: var(--font-cormorant), serif; font-style: italic; font-size: 12px; opacity: 0.7; margin-top: 5px; }
.p-body { font-family: var(--font-noto-serif-sc), "Songti SC", serif; font-size: 15px; line-height: 1.8; text-align: center; text-wrap: pretty; }
.p-oneline { font-family: var(--font-noto-serif-sc), "Songti SC", serif; font-weight: 500; font-size: 19px; line-height: 1.6; letter-spacing: 0.02em; text-align: center; text-wrap: balance; }
.p-body + .p-body { margin-top: 1em; }
.collophon { display: flex; align-items: center; justify-content: center; gap: 12px; }
.collophon .line { width: 48px; height: 1.5px; background: var(--paper-ink); }
.collophon .dia { width: 8px; height: 8px; background: var(--paper-ink); transform: rotate(45deg); }
.eph-sign { margin-top: 26px; display: flex; flex-direction: column; align-items: center; gap: 16px; }
.sign-line { font-family: var(--font-noto-serif-sc), "Songti SC", serif; font-size: 15px; letter-spacing: 0.16em; }
.sign-grid { display: grid; grid-template-columns: auto auto; gap: 5px 26px; font-size: 14px; }
.sign-grid .role { font-family: var(--font-cormorant), serif; text-transform: uppercase; letter-spacing: 0.22em; font-size: 11px; opacity: 0.7; align-self: center; text-align: right; }
.sign-grid .name { letter-spacing: 0.1em; white-space: nowrap; }
.eph-flo { display: block; }
.eph-flo path, .eph-flo line, .eph-flo circle, .eph-flo polyline, .eph-flo ellipse { vector-effect: non-scaling-stroke; }
.eph-insignia { object-fit: contain; filter: brightness(0); display: block; }
/* 底部悬浮坞 — 纸柜钮和通知钉在视口底, 不跟纸一起滚 */
.pp-dock {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 12px;
  padding: 10px 14px calc(env(safe-area-inset-bottom, 0px) + 14px);
  z-index: 6;
  pointer-events: none;
}
.pp-dock > * { pointer-events: auto; }
.pp-drawer {
  position: relative;
  display: flex;
  justify-content: center;
}
/* 玻璃配方与 RoomBackBtn 同族 — night 默认, day 由 .pp-day 覆盖 */
.pp-drawer-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  border: 0.6px solid rgba(212,175,108,0.5);
  background: rgba(20,12,14,0.35);
  backdrop-filter: blur(12px) saturate(150%);
  -webkit-backdrop-filter: blur(12px) saturate(150%);
  color: #ece2cc;
  cursor: pointer;
  padding: 0;
}
.pp-day .pp-drawer-toggle {
  border-color: rgba(255,255,255,0.9);
  background: rgba(255,255,255,0.5);
  color: #3a2a1c;
}
.pp-drawer-list {
  position: absolute;
  bottom: calc(100% + 12px);
  left: 50%;
  transform: translateX(-50%);
  width: min(92vw, 560px);
  max-height: 46vh;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px;
  background: rgba(12, 7, 8, 0.88);
  backdrop-filter: blur(14px) saturate(150%);
  -webkit-backdrop-filter: blur(14px) saturate(150%);
  border: 0.6px solid rgba(212,175,108,0.28);
  border-radius: 12px;
  color: #ece2cc;
}
.pp-day .pp-drawer-list {
  background: rgba(252, 248, 242, 0.94);
  border-color: rgba(58,42,28,0.15);
  color: #3a2a1c;
}
.pp-drawer-item {
  display: flex;
  gap: 14px;
  align-items: baseline;
  padding: 9px 12px;
  border: 1px solid rgba(128,128,128,0.25);
  border-radius: 6px;
  background: transparent;
  color: inherit;
  font-family: var(--font-sans);
  font-size: 13.5px;
  text-align: left;
  cursor: pointer;
}
.pp-drawer-item.pp-active { border-color: rgba(128,128,128,0.65); }
.pp-drawer-date {
  font-family: var(--font-cormorant), serif;
  font-feature-settings: "onum" 1;
  white-space: nowrap;
  opacity: 0.75;
}
.pp-drawer-line {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  opacity: 0.9;
}
/* ══ 体裁专用 (已 port: 醒来纸/周谱/欠条) ══ */
.eph-pins { font-family: var(--font-noto-serif-sc), "Songti SC", serif; font-size: 15px; line-height: 1; max-width: 300px; margin: 0 auto; }
.eph-pin { display: flex; justify-content: space-between; gap: 16px; padding: 11px 0; border-bottom: 1px dashed var(--paper-ink); }
.eph-pin .t { opacity: 0.7; white-space: nowrap; }
.eph-staff { display: block; margin: 24px 0 6px; color: var(--paper-ink); }
.eph-week-legend { display: flex; gap: 20px; justify-content: center; margin-top: 10px; font-size: 13px; opacity: 0.72; }
.eph-clause { margin-top: 22px; }
.eph-clause-row { padding: 14px 0; border-bottom: 1px solid var(--paper-ink); }
.eph-clause-row:first-child { border-top: 2px solid var(--paper-ink); }
.eph-clause-k { font-family: var(--font-cormorant), serif; text-transform: uppercase; letter-spacing: 0.22em; font-size: 11px; opacity: 0.7; margin-bottom: 6px; }
.eph-clause-v { font-family: var(--font-noto-serif-sc), "Songti SC", serif; font-size: 16px; line-height: 1.5; }
.eph-iou-one { margin-top: 24px; }
/* ══ 狐狸 ══ */
.eph-fox { display: block; margin: 0 auto; object-fit: contain; }
/* ══ 电报 ══ */
.eph-tg-body { padding-top: 22px; }
.eph-tg-head { display: flex; justify-content: space-between; align-items: baseline; }
.eph-tg-head .mh-kicker { margin-top: 0; letter-spacing: 0.26em; }
.eph-tg-urgent { font-family: var(--font-cormorant), serif; text-transform: uppercase; letter-spacing: 0.3em; font-size: 11px; border: 2px solid var(--paper-ink); padding: 3px 10px; }
.eph-tg-rule { display: flex; flex-direction: column; gap: 3px; margin-top: 12px; }
.eph-tg-rule .heavy { height: 3px; background: var(--paper-ink); }
.eph-tg-rule .hair { height: 1px; background: var(--paper-ink); }
.eph-tg { font-family: var(--font-cormorant), "EB Garamond", serif; text-transform: uppercase; letter-spacing: 0.12em; font-size: 20px; line-height: 1.75; margin-top: 32px; }
.eph-tg .stop { font-weight: 600; }
.eph-tg-sign { font-family: var(--font-cormorant), serif; letter-spacing: 0.24em; }
/* ══ 印记徽 ══ */
.eph-crest-body { text-align: center; }
.eph-crest-ins { display: flex; justify-content: center; margin: 14px 0 6px; }
.eph-crest-title { font-size: 34px; letter-spacing: 0.14em; }
.eph-crest-date { display: flex; align-items: center; justify-content: center; gap: 12px; margin: 16px 0; }
.eph-crest-ln { width: 40px; height: 1px; background: var(--paper-ink); }
.eph-crest-p { margin-top: 24px; line-height: 1.85; }
/* ══ 御神签 ══ */
.eph-omk-body { text-align: center; }
.eph-omk-kick { margin-top: 8px; }
.eph-omk-level { display: flex; align-items: center; justify-content: center; gap: 14px; margin-top: 12px; }
.eph-omk-ln { width: 56px; height: 1.5px; background: var(--paper-ink); }
.eph-omk-big { font-family: var(--font-noto-serif-sc), "Songti SC", serif; font-weight: 600; font-size: 40px; letter-spacing: 0.12em; }
.eph-omk-verse { font-family: var(--font-noto-serif-sc), "Songti SC", serif; font-size: 17px; line-height: 1.95; margin-top: 24px; }
.eph-omk-note { margin-top: 18px !important; }
.eph-omk-jie { color: var(--paper-ink); opacity: 0.55; }
/* ══ 诗 (竖排右起) ══ */
.eph-poem-head { display: flex; justify-content: space-between; align-items: baseline; padding-top: 22px; }
.eph-poem-head .mh-kicker { margin-top: 0; opacity: 0.7; }
.eph-poem-date { font-size: 12px; opacity: 0.6; }
.eph-poem-hr { height: 1px; background: var(--paper-ink); opacity: 0.85; margin-top: 12px; }
.eph-poem-stage { position: relative; margin-top: 26px; min-height: 340px; }
.eph-poem-moon { position: absolute; top: 0; left: 8px; }
.eph-poem-s1 { position: absolute; top: 10px; left: 66px; }
.eph-poem-s2 { position: absolute; top: 70px; left: 54px; }
.eph-poem-cols { display: flex; flex-direction: row-reverse; justify-content: flex-start; gap: 26px; padding-right: 6px; margin-top: 78px; }
.eph-poem-col { writing-mode: vertical-rl; font-family: var(--font-noto-serif-sc), "Songti SC", serif; font-size: 19px; line-height: 2; letter-spacing: 0.2em; }
.eph-poem-col0 { font-size: 22px; font-weight: 500; }
.eph-poem-sign { display: flex; flex-direction: column; align-items: center; gap: 12px; margin-top: 22px; }
/* ══ 号外 ══ */
.eph-extra-body { padding-top: 22px; }
.eph-extra-kick { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; }
.eph-extra-kick .mh-kicker { margin-top: 0; }
.eph-extra-t { font-size: 11px; opacity: 0.7; }
.eph-extra-banner { position: relative; background: var(--paper-ink); color: var(--paper-white); margin: 18px 0 10px; padding: 16px 18px; overflow: hidden; }
.eph-extra-fox { position: absolute; right: 8px; top: 50%; transform: translateY(-50%); }
.eph-extra-big { font-family: var(--font-noto-serif-sc), "Songti SC", serif; font-weight: 700; font-size: 44px; line-height: 0.98; letter-spacing: 0.08em; }
.eph-extra-en { font-family: var(--font-cormorant), serif; font-style: italic; font-size: 12.5px; opacity: 0.86; margin-top: 5px; max-width: 72%; }
.eph-extra-cols { display: grid; grid-template-columns: 1fr 100px; gap: 0 16px; margin-top: 14px; align-items: start; }
.eph-extra-lede { text-align: left !important; font-size: 14px; line-height: 1.75; }
.eph-extra-seal { text-align: center; }
.eph-extra-ins { position: relative; width: 108px; margin: 0 auto; }
.eph-extra-ins::after { content: ""; position: absolute; inset: 0; border-radius: 50%; border: 1.5px solid var(--paper-ink); }
.eph-extra-cap { margin-top: 6px; }
.eph-extra-one { margin-top: 20px; }
.eph-extra-sign { margin-top: 20px; }
/* ══ 处方笺 ══ */
.eph-rx-title { font-size: 32px; letter-spacing: 0.1em; margin: 10px 0 4px; }
.eph-rx-meta { margin-top: 22px; font-size: 14px; line-height: 1.85; }
.eph-rx-meta .k { opacity: 0.55; margin-right: 10px; }
.eph-rx-scrip { display: flex; align-items: flex-start; gap: 16px; margin-top: 18px; }
.eph-rx-sym { font-family: var(--font-cormorant), serif; font-style: italic; font-size: 46px; line-height: 1; }
.eph-rx-rows { flex: 1; }
.eph-rx-row { display: grid; grid-template-columns: 26px 1fr; gap: 0 10px; padding: 10px 0; border-bottom: 1px solid var(--paper-ink); align-items: baseline; }
.eph-rx-n { font-family: var(--font-cormorant), serif; font-style: italic; font-size: 16px; }
.eph-rx-drug { font-size: 15px; }
.eph-rx-dose { font-family: var(--font-cormorant), serif; font-size: 12px; opacity: 0.6; letter-spacing: 0.04em; margin-left: 8px; }
.eph-rx-one { margin-top: 22px; }
/* ══ 夜航日志 ══ */
.eph-log-head { display: flex; justify-content: space-between; align-items: flex-end; padding-top: 22px; }
.eph-log-title { font-size: 28px; letter-spacing: 0.1em; margin-top: 8px; }
.eph-log-meta { text-align: right; }
.eph-log-no { font-size: 13px; }
.eph-log-rule { display: flex; flex-direction: column; gap: 3px; margin-top: 12px; }
.eph-log-rule .heavy { height: 3px; background: var(--paper-ink); }
.eph-log-rule .hair { height: 1px; background: var(--paper-ink); }
.eph-log-rows { margin-top: 18px; }
.eph-log-row { display: grid; grid-template-columns: 56px 1fr 42px; gap: 0 12px; padding: 11px 0; border-bottom: 1px solid var(--paper-ink); align-items: baseline; }
.eph-log-t { font-family: var(--font-cormorant), serif; font-size: 15px; }
.eph-log-e { font-size: 13.5px; }
.eph-log-tag { font-family: var(--font-cormorant), serif; text-transform: uppercase; letter-spacing: 0.1em; font-size: 10px; opacity: 0.6; text-align: right; }
.eph-log-foot { display: flex; justify-content: space-between; align-items: center; gap: 14px; margin-top: 18px; }
.eph-log-p { text-align: left !important; font-size: 13.5px; }
.eph-log-sign { margin-top: 14px; }
/* ══ 气象简报 ══ */
.eph-wx-head { text-align: center; padding-top: 22px; }
.eph-wx-head .mh-kicker { margin-top: 0; }
.eph-wx-title { font-size: 30px; letter-spacing: 0.1em; margin-top: 8px; }
.eph-wx-hr { height: 2px; background: var(--paper-ink); margin-top: 14px; }
.eph-wx-today { display: grid; grid-template-columns: 1fr 92px; gap: 0 16px; align-items: center; margin-top: 20px; }
.eph-wx-today-h { font-family: var(--font-noto-serif-sc), "Songti SC", serif; font-weight: 600; font-size: 21px; }
.eph-wx-today-p { text-align: left !important; font-size: 13.5px; margin-top: 8px; }
.eph-wx-cloud { width: 92px; height: 58px; background: radial-gradient(ellipse 46% 64% at 30% 60%, rgba(0,0,0,0.58), transparent 72%), radial-gradient(ellipse 44% 72% at 62% 52%, rgba(0,0,0,0.52), transparent 70%), radial-gradient(ellipse 36% 56% at 82% 64%, rgba(0,0,0,0.42), transparent 74%); }
.eph-wx-three { display: grid; grid-template-columns: repeat(3, 1fr); border: 2px solid var(--paper-ink); margin-top: 20px; }
.eph-wx-day { padding: 13px 10px; text-align: center; }
.eph-wx-day + .eph-wx-day { border-left: 1px solid var(--paper-ink); }
.eph-wx-day-h { display: flex; justify-content: space-between; align-items: baseline; }
.eph-wx-day-t { font-family: var(--font-noto-serif-sc), "Songti SC", serif; font-weight: 600; font-size: 18px; }
.eph-wx-day-en { margin-top: 0; }
.eph-wx-ico { width: 52px; height: 42px; margin: 10px auto; display: block; color: var(--paper-ink); }
.eph-wx-day-zh { font-size: 15px; }
.eph-wx-day-sub { font-size: 12px; opacity: 0.65; margin-top: 3px; }
.eph-wx-one { margin-top: 20px; }
.pp-push { margin: 0; font-size: 13.5px; font-family: var(--font-sans); }
.pp-push-btn {
  padding: 10px 20px;
  border: 0.6px solid rgba(212,175,108,0.5);
  border-radius: 999px;
  background: rgba(20,12,14,0.35);
  backdrop-filter: blur(12px) saturate(150%);
  -webkit-backdrop-filter: blur(12px) saturate(150%);
  color: #ece2cc;
  font-family: var(--font-sans);
  font-size: 13.5px;
  letter-spacing: 0.08em;
  cursor: pointer;
}
.pp-day .pp-push-btn {
  border-color: rgba(255,255,255,0.9);
  background: rgba(255,255,255,0.5);
  color: #3a2a1c;
}
.pp-push-off { opacity: 0.6; }
/* ══ 印章 seal ══ */
.eph-seal { position: relative; color: var(--paper-ink); margin: 0 auto; }
.eph-seal-ring { position: absolute; inset: 0; }
.eph-seal-core { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; }
/* ══ 某夜星空 ══ */
.eph-sky-head { display: flex; justify-content: space-between; align-items: flex-end; gap: 12px; padding-top: 22px; }
.eph-sky-title { font-size: 28px; letter-spacing: 0.2em; white-space: nowrap; margin-top: 10px; }
.eph-sky-meta { text-align: right; }
.eph-sky-date { font-size: 15px; }
.eph-sky-hr { height: 2px; background: var(--paper-ink); margin-top: 12px; }
.eph-sky-chart { margin-top: 18px; border: 2px solid var(--paper-ink); padding: 4px; }
.eph-sky-chart svg { display: block; color: var(--paper-ink); }
.eph-sky-notes { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0 12px; margin-top: 18px; font-size: 12.5px; line-height: 1.5; }
.eph-sky-notes .k { opacity: 0.55; }
.eph-sky-p { margin-top: 16px; text-align: left; font-size: 14px; }
.eph-sky-one { margin-top: 20px; }
/* ══ 通行证 (护照盖章页) ══ */
.eph-pass-head { display: flex; justify-content: space-between; align-items: flex-end; gap: 12px; padding-top: 22px; }
.eph-pass-title { font-size: 30px; letter-spacing: 0.12em; margin-top: 10px; }
.eph-pass-meta { text-align: right; }
.eph-pass-meta .mh-date { font-size: 12.5px; }
.eph-pass-meta .eph-date-sm { max-width: 130px; }
.eph-pass-hr { height: 2px; background: var(--paper-ink); margin-top: 12px; }
.eph-pass-grid { display: grid; grid-template-columns: repeat(3, 1fr); border: 1px solid var(--paper-ink); border-right: none; border-bottom: none; margin-top: 20px; }
.eph-pass-cell { border-right: 1px solid var(--paper-ink); border-bottom: 1px solid var(--paper-ink); padding: 16px 8px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; min-height: 124px; }
.eph-pass-core { text-align: center; }
.eph-pass-core .zh { font-family: var(--font-noto-serif-sc), "Songti SC", serif; font-weight: 700; font-size: 17px; line-height: 1.05; }
.eph-pass-core .d { font-family: var(--font-cormorant), serif; font-size: 10px; letter-spacing: 0.1em; margin-top: 3px; }
.eph-pass-en { font-size: 10.5px; margin-top: 0; }
.eph-pass-next-k { font-family: var(--font-cormorant), serif; text-transform: uppercase; letter-spacing: 0.2em; font-size: 11px; opacity: 0.6; }
.eph-pass-next-v { font-family: var(--font-noto-serif-sc), "Songti SC", serif; font-size: 17px; margin-top: 6px; opacity: 0.7; }
.eph-pass-one { margin-top: 20px; }
/* ══ 海关申报单 ══ */
.eph-cust-kick { display: flex; justify-content: space-between; align-items: center; gap: 8px; padding: 10px 0; }
.eph-cust-kick .mh-kicker { margin-top: 0; letter-spacing: 0.16em; }
.eph-cust-t { font-size: 11px; opacity: 0.7; white-space: nowrap; }
.eph-cust-lead { font-size: 13.5px; opacity: 0.7; margin-top: 16px; }
.eph-cust-table { margin-top: 12px; border: 2px solid var(--paper-ink); }
.eph-cust-hrow, .eph-cust-row { display: grid; grid-template-columns: 1fr 66px 54px 1.05fr; }
.eph-cust-hrow { border-bottom: 2px solid var(--paper-ink); font-family: var(--font-cormorant), serif; text-transform: uppercase; letter-spacing: 0.08em; font-size: 9.5px; opacity: 0.7; }
.eph-cust-hrow > div { padding: 8px 8px; }
.eph-cust-hrow > div + div, .eph-cust-row > div + div { border-left: 1px solid var(--paper-ink); }
.eph-cust-row { border-bottom: 1px solid var(--paper-ink); align-items: center; }
.eph-cust-row:last-child { border-bottom: none; }
.eph-cust-row .it { padding: 11px 8px; font-size: 15px; }
.eph-cust-row .q { padding: 11px 6px; font-size: 14px; }
.eph-cust-row .tax { padding: 11px 4px; display: flex; gap: 7px; align-items: center; justify-content: center; }
.eph-cust-row .tax .box { width: 15px; height: 15px; border: 1.4px solid var(--paper-ink); display: flex; align-items: center; justify-content: center; font-size: 11px; }
.eph-cust-row .note { padding: 11px 8px; font-size: 12.5px; opacity: 0.7; }
.eph-cust-foot { display: flex; justify-content: space-between; align-items: flex-end; gap: 12px; margin-top: 18px; }
.eph-cust-p { text-align: left; font-size: 13.5px; }
.eph-cust-clear { flex: none; transform: rotate(-9deg); font-family: var(--font-noto-serif-sc), "Songti SC", serif; font-weight: 700; font-size: 18px; border: 2.5px solid var(--paper-ink); padding: 3px 12px; }
.eph-cust-sign { margin-top: 16px; }
/* ══ 拱门头 (行程单 / 节目单 共用) ══ */
.eph-arch { position: relative; display: flex; flex-direction: column; align-items: center; padding-top: 28px; overflow: hidden; }
.eph-arch-svg { position: absolute; top: 0; left: 50%; transform: translateX(-50%); color: var(--paper-ink); }
.eph-arch-txt { position: relative; padding-top: 46px; text-align: center; }
.eph-arch-txt .mh-kicker { margin-top: 0; }
.eph-itin-title, .eph-prog-title { font-size: 31px; letter-spacing: 0.12em; margin: 8px 0 4px; }
/* ══ 行程单 ══ */
.eph-itin-legs { margin-top: 22px; }
.eph-itin-leg { display: grid; grid-template-columns: 60px 1fr auto; gap: 0 14px; padding: 13px 0; border-bottom: 1px dashed var(--paper-ink); align-items: baseline; }
.eph-itin-leg .t { font-family: var(--font-cormorant), serif; font-size: 15px; opacity: 0.6; }
.eph-itin-leg .c .zh { font-family: var(--font-noto-serif-sc), "Songti SC", serif; font-size: 16px; display: block; }
.eph-itin-leg .c .en { font-family: var(--font-cormorant), serif; font-style: italic; font-size: 12px; opacity: 0.6; }
.eph-itin-leg .x { font-size: 13px; opacity: 0.6; }
.eph-itin-foot { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-top: 18px; }
.eph-itin-one { margin: 0; text-align: left; }
.eph-itin-sign { margin-top: 14px; }
/* ══ 节目单 ══ */
.eph-prog-cols { display: grid; grid-template-columns: 1fr 112px; gap: 0 14px; align-items: center; margin-top: 22px; }
.eph-prog-row { display: grid; grid-template-columns: 52px 1fr auto; gap: 0 10px; padding: 13px 0; border-bottom: 1px dashed var(--paper-ink); align-items: baseline; }
.eph-prog-row .t { font-family: var(--font-cormorant), serif; font-size: 15px; opacity: 0.6; }
.eph-prog-row .c .zh { font-family: var(--font-noto-serif-sc), "Songti SC", serif; font-size: 16px; display: block; }
.eph-prog-row .c .en { font-family: var(--font-cormorant), serif; font-style: italic; font-size: 11.5px; opacity: 0.6; }
.eph-prog-row .x { font-family: var(--font-cormorant), serif; font-size: 13px; opacity: 0.6; }
.eph-prog-planet { text-align: center; }
.eph-prog-planet svg { color: var(--paper-ink); }
.eph-prog-planet-cap { font-family: var(--font-cormorant), serif; font-style: italic; font-size: 11.5px; opacity: 0.6; margin-top: 4px; }
.eph-prog-div { display: flex; align-items: center; justify-content: center; gap: 14px; margin-top: 22px; color: var(--paper-ink); }
.eph-prog-div .ln { width: 86px; height: 1px; background: var(--paper-ink); }
.eph-prog-one { margin-top: 16px; }
.eph-prog-one .en { display: block; font-family: var(--font-cormorant), serif; font-style: italic; font-size: 12px; opacity: 0.55; margin-top: 8px; }
/* ══ 明信片 (奶包/暗金两版 — 覆盖纸色) ══ */
.pp-sheet.eph-tone-cream { --paper-white: #f2ead9; --paper-ink: #40372a; }
.pp-sheet.eph-tone-gold { --paper-white: #e7d3a4; --paper-ink: #4a3c1f; }
.eph-pc-head { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; padding-top: 22px; }
.eph-pc-title { font-size: 28px; letter-spacing: 0.1em; margin-top: 10px; }
.eph-pc-en { margin-top: 0; }
.eph-pc-hr { height: 2px; background: var(--paper-ink); margin-top: 12px; }
.eph-pc-grid { display: grid; grid-template-columns: 1fr 2px 116px; gap: 0 18px; margin-top: 22px; min-height: 240px; }
.eph-pc-msg { display: flex; flex-direction: column; }
.eph-pc-text { font-size: 15px; line-height: 1.95; }
.eph-pc-from { margin-top: auto; padding-top: 20px; font-size: 15px; letter-spacing: 0.12em; }
.eph-pc-div { background: repeating-linear-gradient(var(--paper-ink) 0 6px, transparent 6px 12px); }
.eph-pc-stampcol { display: flex; flex-direction: column; align-items: flex-end; gap: 14px; }
.eph-pc-stamp { width: 84px; height: 104px; border: 2px dashed var(--paper-ink); padding: 6px; display: flex; align-items: center; justify-content: center; }
.eph-pc-bud { height: 100%; object-fit: contain; mix-blend-mode: multiply; }
.eph-pc-mark { position: relative; width: 92px; height: 92px; }
.eph-pc-mark::after { content: ""; position: absolute; inset: 0; border-radius: 50%; border: 1.5px solid var(--paper-ink); }
.eph-pc-mark .eph-insignia { width: 92px; height: 92px; }
.eph-pc-post { margin-top: 0; }
/* ══ 票根 ══ */
.eph-stub-body { padding-bottom: 20px; }
.eph-stub-wrap { display: flex; padding-top: 22px; }
.eph-stub-main { flex: 1; padding-right: 20px; }
.eph-stub-title { font-size: 30px; letter-spacing: 0.1em; margin: 10px 0 3px; }
.eph-stub-hr { height: 2px; background: var(--paper-ink); margin: 16px 0 4px; }
.eph-stub-rows { margin-top: 4px; }
.eph-stub-row { display: grid; grid-template-columns: 58px 1fr; gap: 0 12px; padding: 11px 0; border-bottom: 1px solid var(--paper-ink); align-items: baseline; }
.eph-stub-row:first-child { border-top: 2px solid var(--paper-ink); }
.eph-stub-row .k { font-family: var(--font-noto-serif-sc), "Songti SC", serif; font-size: 11px; letter-spacing: 0.22em; opacity: 0.6; }
.eph-stub-row .v { font-family: var(--font-noto-serif-sc), "Songti SC", serif; font-size: 14.5px; line-height: 1.5; }
.eph-stub-one { margin-top: 20px; text-align: left; }
.eph-stub-foot { display: flex; justify-content: space-between; align-items: center; gap: 14px; margin-top: 22px; }
.eph-stub-chop { transform: rotate(-9deg); font-family: var(--font-noto-serif-sc), "Songti SC", serif; font-weight: 700; font-size: 19px; border: 2.5px solid var(--paper-ink); padding: 3px 12px; }
.eph-stub-perf { border-left: 2px dashed var(--paper-ink); }
.eph-stub-side { flex: 0 0 72px; display: flex; flex-direction: column; align-items: center; justify-content: space-between; padding-left: 18px; }
.eph-stub-side-label { writing-mode: vertical-rl; font-family: var(--font-cormorant), serif; text-transform: uppercase; letter-spacing: 0.3em; font-size: 13px; opacity: 0.7; }
.eph-stub-rose { width: 34px; mix-blend-mode: multiply; margin: 12px 0; }
.eph-stub-no { font-family: var(--font-cormorant), serif; font-size: 13px; }
/* ══ 健診表 ══ */
.eph-hlt-kick { display: flex; justify-content: space-between; align-items: flex-end; gap: 10px; padding: 14px 0; }
.eph-hlt-kick .mh-kicker { margin-top: 0; }
.eph-hlt-title { font-size: 32px; letter-spacing: 0.06em; margin-top: 8px; }
.eph-hlt-date { font-size: 13px; white-space: nowrap; }
.eph-hlt-table { margin-top: 18px; border: 2px solid var(--paper-ink); }
.eph-hlt-hrow, .eph-hlt-row { display: grid; grid-template-columns: 1fr 148px 1fr; }
.eph-hlt-hrow { border-bottom: 2px solid var(--paper-ink); font-family: var(--font-cormorant), serif; text-transform: uppercase; letter-spacing: 0.08em; font-size: 9.5px; opacity: 0.7; }
.eph-hlt-hrow > div { padding: 8px 10px; }
.eph-hlt-hrow > div + div, .eph-hlt-row > div + div { border-left: 1px solid var(--paper-ink); }
.eph-hlt-row { border-bottom: 1px solid var(--paper-ink); align-items: center; }
.eph-hlt-row:last-child { border-bottom: none; }
.eph-hlt-row .k { padding: 12px 10px; font-size: 15px; display: flex; align-items: center; gap: 6px; }
.eph-hlt-row .g { padding: 10px 8px; display: flex; justify-content: space-between; }
.eph-hlt-row .g span { width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; font-family: var(--font-cormorant), serif; font-size: 15px; opacity: 0.4; }
.eph-hlt-row .g span.on { border: 2px solid var(--paper-ink); border-radius: 50%; font-weight: 700; opacity: 1; }
.eph-hlt-row .note { padding: 12px 10px; font-size: 12.5px; opacity: 0.7; }
.eph-hlt-foot { display: flex; justify-content: space-between; align-items: center; gap: 14px; margin-top: 20px; }
.eph-hlt-total { font-size: 14.5px; line-height: 1.7; }
.eph-hlt-chop { position: relative; width: 82px; height: 82px; flex: none; transform: rotate(-8deg); }
.eph-hlt-chop::after { content: ""; position: absolute; inset: 0; border-radius: 50%; border: 2px solid var(--paper-ink); }
.eph-hlt-chop .eph-insignia { width: 82px; height: 82px; }
.eph-hlt-sign { margin-top: 16px; }
/* ══ 残月黄历 ══ */
.eph-alm-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; padding-top: 22px; }
.eph-alm-datewrap { display: flex; align-items: baseline; gap: 12px; margin-top: 10px; }
.eph-alm-day { font-family: var(--font-noto-serif-sc), "Songti SC", serif; font-weight: 600; font-size: 66px; line-height: 0.9; }
.eph-alm-md { font-family: var(--font-noto-serif-sc), "Songti SC", serif; font-size: 18px; }
.eph-alm-year { margin-top: 3px; }
.eph-alm-moon { text-align: center; }
.eph-alm-moon .eph-flo { margin: 0 auto; }
.eph-alm-hr { height: 2px; background: var(--paper-ink); margin-top: 14px; }
.eph-alm-cols { display: grid; grid-template-columns: 1fr 1px 1fr; gap: 0 24px; margin-top: 22px; min-height: 150px; }
.eph-alm-mark { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
.eph-alm-mark .ch { font-family: var(--font-noto-serif-sc), "Songti SC", serif; font-weight: 700; font-size: 30px; }
.eph-alm-mark .ln { flex: 1; height: 1.5px; background: var(--paper-ink); }
.eph-alm-text { font-family: var(--font-noto-serif-sc), "Songti SC", serif; font-size: 16px; line-height: 1.9; }
.eph-alm-vline { background: var(--paper-ink); }
.eph-alm-one { margin-top: 22px; }
/* ══ 登机牌 ══ */
.eph-bp-body { padding-left: 22px; padding-right: 22px; }
.eph-bp-head { display: flex; align-items: center; gap: 16px; padding-top: 24px; }
.eph-bp-titlewrap { flex: 1; }
.eph-bp-titlewrap .mh-kicker { margin-top: 0; }
.eph-bp-title { font-family: var(--font-cormorant), "EB Garamond", serif; font-size: 25px; letter-spacing: 0.02em; line-height: 0.95; margin-top: 8px; }
.eph-bp-vline { width: 2px; align-self: stretch; background: var(--paper-ink); margin: 2px 0; }
.eph-bp-flight { text-align: right; }
.eph-bp-flight .num { font-family: var(--font-cormorant), serif; font-size: 13px; letter-spacing: 0.06em; }
.eph-bp-date { font-size: 15px !important; margin-top: 6px; }
.eph-bp-perf { border-top: 2px dashed var(--paper-ink); margin: 18px 0 0; }
.eph-bp-grid { display: grid; grid-template-columns: repeat(4, 1fr); border: 2px solid var(--paper-ink); margin-top: 20px; }
.eph-bp-cell { padding: 12px 12px; border-right: 1px solid var(--paper-ink); border-bottom: 1px solid var(--paper-ink); }
.eph-bp-cell.wide { grid-column: span 2; }
.eph-bp-cell:nth-child(1), .eph-bp-cell:nth-child(2) { border-bottom: 1px solid var(--paper-ink); }
.eph-bp-cell:nth-child(6) { border-right: none; }
.eph-bp-cell:nth-child(3), .eph-bp-cell:nth-child(4), .eph-bp-cell:nth-child(5), .eph-bp-cell:nth-child(6) { border-bottom: none; }
.eph-bp-k { font-family: var(--font-cormorant), serif; text-transform: uppercase; letter-spacing: 0.18em; font-size: 10px; opacity: 0.6; margin-bottom: 5px; }
.eph-bp-cell .k { font-family: var(--font-cormorant), serif; text-transform: uppercase; letter-spacing: 0.18em; font-size: 10px; opacity: 0.6; margin-bottom: 5px; }
.eph-bp-cell .v { font-family: var(--font-noto-serif-sc), "Songti SC", serif; font-size: 20px; font-weight: 500; }
.eph-bp-cell .v.lat { font-family: var(--font-cormorant), serif; letter-spacing: 0.04em; }
.eph-bp-code { display: flex; gap: 3px; height: 54px; align-items: stretch; margin-top: 20px; }
.eph-bp-one { margin-top: 22px; }
`;
