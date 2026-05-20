"use client";

// Setup banner · 在 /room 顶部显示 · 引导用户去 /settings 配 LLM key + 头像.
// 全部配齐自动隐藏 · 不需要 dismiss 按钮.

import Link from "next/link";
import { useEffect, useState } from "react";
import { isLLMConfigured } from "@/lib/llm-client";
import {
  getOtherPortraitDataURL,
  getSelfPortraitDataURL,
} from "@/lib/portrait-store";

type Status = {
  llm: boolean;
  selfPortrait: boolean;
  otherPortrait: boolean;
};

export function SetupBanner({ accent }: { accent: string }) {
  const [status, setStatus] = useState<Status | null>(null);

  useEffect(() => {
    void (async () => {
      const [selfP, otherP] = await Promise.all([
        getSelfPortraitDataURL().catch(() => null),
        getOtherPortraitDataURL().catch(() => null),
      ]);
      setStatus({
        llm: isLLMConfigured(),
        selfPortrait: !!selfP,
        otherPortrait: !!otherP,
      });
    })();
  }, []);

  if (!status) return null;

  const allConfigured =
    status.llm && status.selfPortrait && status.otherPortrait;
  if (allConfigured) return null;

  const missing: string[] = [];
  if (!status.llm) missing.push("LLM endpoint + API key");
  if (!status.selfPortrait || !status.otherPortrait) missing.push("两张头像");

  return (
    <Link
      href="/backstage/settings"
      style={{
        display: "block",
        marginTop: 14,
        padding: "10px 14px",
        border: `0.6px solid ${accent}`,
        borderRadius: 6,
        background: `${accent}10`,
        textDecoration: "none",
        color: "inherit",
      }}
    >
      <div
        style={{
          fontSize: 10,
          letterSpacing: 3,
          textTransform: "uppercase",
          color: accent,
          fontStyle: "italic",
          marginBottom: 4,
        }}
      >
        ✦ 先配一下
      </div>
      <div style={{ fontSize: 12, lineHeight: 1.6, opacity: 0.85 }}>
        还差 · {missing.join(" · ")}
        <span style={{ marginLeft: 8, color: accent, fontStyle: "italic" }}>
          → /backstage/settings
        </span>
      </div>
      <div
        style={{
          marginTop: 4,
          fontSize: 10,
          opacity: 0.55,
          fontStyle: "italic",
        }}
      >
        一次性配置 · 数据存你浏览器 · 配完这条就消失
      </div>
    </Link>
  );
}
