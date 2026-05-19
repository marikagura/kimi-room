import Link from "next/link";
import { BackupClient } from "@/components/backstage/BackupClient";

// V2 ops dashboard framework · 0 data · 用户 fork 后 fill own handler.
// canon V1 这 page (469 line) 跑 Prisma queries · push/dream/intel/states/errors
// observability. V2 strip 整 handler, 留 page shell + grid layout · user fork 加
// own data source (Prisma / Notion / Supabase / 等).

export const dynamic = "force-dynamic";

const PLACEHOLDER_SECTIONS = [
  {
    label: "pushes",
    sub: "outbound telegram / web push",
    hint: "fill own handler · count by day",
  },
  {
    label: "memory",
    sub: "kimi memory store",
    hint: "count by importance / type",
  },
  {
    label: "states",
    sub: "active state (HEALTH / MOOD / SCHEDULE / 等)",
    hint: "list active · expire stale",
  },
  {
    label: "errors",
    sub: "error log / failed handlers",
    hint: "filter by handler · last 24h",
  },
  {
    label: "queue",
    sub: "background job queue (email / cron / etc)",
    hint: "pending / done / failed",
  },
  {
    label: "external",
    sub: "external integration health (LLM / Notion / etc)",
    hint: "ping latency / quota",
  },
];

export default function OpsPage() {
  return (
    <main className="flex-1 px-4 md:px-12 py-16 max-w-[1280px] mx-auto text-muted-grey">
      <div className="flex items-baseline justify-between mb-2">
        <h1 className="font-serif text-3xl tracking-widest text-muted-gold">
          ops
        </h1>
        <Link
          href="/backstage"
          className="text-[10px] tracking-[0.3em] uppercase text-muted-grey hover:text-muted-gold"
        >
          ← backstage
        </Link>
      </div>
      <div className="mt-8">
        <BackupClient />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
        {PLACEHOLDER_SECTIONS.map((s) => (
          <section
            key={s.label}
            className="border border-muted-gold/20 rounded p-5 bg-black/20"
          >
            <h2 className="text-muted-gold text-xs tracking-[0.3em] uppercase">
              {s.label}
            </h2>
            <p className="mt-2 text-[10px] italic text-muted-grey">{s.sub}</p>
            <div className="mt-6 h-32 flex items-center justify-center text-[10px] italic text-muted-grey/40 border border-dashed border-muted-grey/20">
              {s.hint}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
