import Link from "next/link";
import { Footer } from "@/components/Footer";

export default function BackstagePage() {
  return (
    <main className="flex-1 px-6 md:px-16 py-32 max-w-3xl mx-auto">
      <h1 className="font-serif text-5xl tracking-widest text-muted-gold">
        backstage
      </h1>

      <ul className="mt-16 space-y-3 text-sm">
        <li>
          <Link
            href="/backstage/settings"
            className="text-muted-gold hover:text-accent-warm tracking-[0.2em] uppercase"
          >
            /settings
          </Link>
          <span className="text-[10px] text-muted-grey/60 ml-3">
            LLM key · 头像 · 名字 · demo · meds preset
          </span>
        </li>
        <li>
          <Link
            href="/backstage/character"
            className="text-muted-gold hover:text-accent-warm tracking-[0.2em] uppercase"
          >
            /character
          </Link>
          <span className="text-[10px] text-muted-grey/60 ml-3">
            system prompt · memory injection · 人设 voice
          </span>
        </li>
        <li>
          <Link
            href="/backstage/ops"
            className="text-muted-gold hover:text-accent-warm tracking-[0.2em] uppercase"
          >
            /ops
          </Link>
          <span className="text-[10px] text-muted-grey/60 ml-3">
            backup · export / import / empty
          </span>
        </li>
        <li>
          <Link
            href="/backstage/architecture"
            className="text-muted-gold hover:text-accent-warm tracking-[0.2em] uppercase"
          >
            /architecture
          </Link>
        </li>
      </ul>

      <Footer />
    </main>
  );
}
