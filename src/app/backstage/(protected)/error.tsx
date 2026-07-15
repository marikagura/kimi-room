"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function BackstageError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[backstage]", error);
  }, [error]);

  return (
    <main
      className="flex-1 flex flex-col items-center justify-center text-center px-6 py-24"
      style={{
        fontFamily: 'var(--font-serif)',
        color: "#f0dcb8",
        background: "#0a0506",
        minHeight: "100svh",
      }}
    >
      <p style={{ fontSize: 11, letterSpacing: 4, color: "rgba(240,220,184,0.5)", fontStyle: "italic" }}>
        backstage
      </p>
      <h1 style={{ marginTop: 16, fontSize: 28, letterSpacing: 3, fontStyle: "italic", color: "#d4b886" }}>
        database napped
      </h1>
      <p style={{ marginTop: 20, maxWidth: 340, fontSize: 11, color: "rgba(240,220,184,0.6)", lineHeight: 1.7 }}>
        连接池可能被用满了（pgbouncer 限 15）。等几秒再试。若持续，检查 Vercel env 里
        <code style={{ color: "#d4b886", padding: "0 4px" }}>DATABASE_URL</code>
        有没有 <code style={{ color: "#d4b886", padding: "0 4px" }}>?pgbouncer=true&amp;connection_limit=1</code>。
      </p>
      {error.digest && (
        <p style={{ marginTop: 16, fontSize: 9, color: "rgba(240,220,184,0.35)", fontFamily: "var(--font-mono)" }}>
          digest: {error.digest}
        </p>
      )}
      <div style={{ display: "flex", gap: 20, marginTop: 32 }}>
        <button
          type="button"
          onClick={() => reset()}
          style={{
            fontSize: 10,
            letterSpacing: 3,
            padding: "8px 20px",
            border: "0.6px solid #d4b886",
            color: "#d4b886",
            background: "transparent",
            cursor: "pointer",
            fontFamily: 'var(--font-serif)',
            textTransform: "uppercase",
          }}
        >
          retry
        </button>
        <Link
          href="/backstage"
          style={{ fontSize: 10, letterSpacing: 3, color: "rgba(240,220,184,0.55)", alignSelf: "center" }}
        >
          ← home
        </Link>
      </div>
    </main>
  );
}
