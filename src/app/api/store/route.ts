import { NextResponse } from "next/server";
import {
  applyFilter,
  blobToRow,
  entryToRow,
  importToRows,
  mergeEntry,
  newId,
  nowISO,
  rowToBlob,
  rowToEntry,
  rowsToExport,
  searchRows,
  type StoreRow,
} from "@/lib/stores/shared";
import { isAuthed } from "@/lib/stores/owner-session";
import type { BlobEntry, Filter, StoreEntry } from "@/lib/stores/types";

// Server-side CRUD for the Prisma backend. The browser's prisma-adapter POSTs
// { op, ... } here; every request must carry the owner session cookie. Prisma is
// loaded with a runtime dynamic import (variable specifier) so it stays an
// OPTIONAL dependency — a deployment that never selects this backend needs
// neither @prisma/client nor DATABASE_URL, and tsc does not require its generated
// types. See docs/SELF-HOST.md.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DbRow = {
  id: string;
  collection: string;
  createdAt: Date;
  updatedAt: Date;
  data: unknown;
};
type DbInput = {
  id: string;
  collection: string;
  createdAt: Date;
  updatedAt: Date;
  data: unknown;
};

interface PrismaLike {
  storeRow: {
    findMany(args?: { where?: { collection?: string } }): Promise<DbRow[]>;
    findUnique(args: { where: { id: string } }): Promise<DbRow | null>;
    upsert(args: {
      where: { id: string };
      create: DbInput;
      update: DbInput;
    }): Promise<DbRow>;
    deleteMany(args?: { where?: Record<string, unknown> }): Promise<{
      count: number;
    }>;
  };
}

let _db: PrismaLike | null = null;
async function db(): Promise<PrismaLike> {
  if (_db) return _db;
  if (!process.env.DATABASE_URL) {
    throw new Error("prisma adapter: set DATABASE_URL (see docs/SELF-HOST.md)");
  }
  // Optional dep, loaded only when the prisma backend is actually used. The
  // turbopackIgnore comment stops the bundler resolving it at build (it isn't
  // installed unless you opt into this backend); the variable specifier keeps it
  // out of the type-check too. Resolved natively at runtime from node_modules.
  const pkg = "@prisma/client";
  const mod = (await import(/* turbopackIgnore: true */ pkg)) as {
    PrismaClient: new () => unknown;
  };
  _db = new mod.PrismaClient() as PrismaLike;
  return _db;
}

function toStoreRow(r: DbRow): StoreRow {
  return {
    id: r.id,
    collection: r.collection,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    data: (r.data ?? {}) as Record<string, unknown>,
  };
}

function toInput(row: StoreRow): DbInput {
  return {
    id: row.id,
    collection: row.collection,
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
    data: row.data,
  };
}

async function upsertRow(prisma: PrismaLike, row: StoreRow): Promise<void> {
  const input = toInput(row);
  await prisma.storeRow.upsert({
    where: { id: input.id },
    create: input,
    update: input,
  });
}

export async function POST(req: Request) {
  if (!isAuthed(req)) {
    return NextResponse.json(
      { error: "unauthorized — sign in via POST /api/auth (see docs/SELF-HOST.md)" },
      { status: 401 },
    );
  }

  let body: {
    op?: string;
    collection?: string;
    id?: string;
    entry?: Partial<StoreEntry> & { id?: string };
    blob?: Omit<BlobEntry, "id" | "createdAt"> & { id?: string };
    query?: string;
    filter?: Filter;
    kind?: BlobEntry["kind"];
    json?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const collection = body.collection ?? "";

  try {
    const prisma = await db();
    switch (body.op) {
      case "list": {
        const rows = await prisma.storeRow.findMany({ where: { collection } });
        const entries = rows.map((r) => rowToEntry<StoreEntry>(toStoreRow(r)));
        return NextResponse.json({ result: applyFilter(entries, body.filter) });
      }
      case "get": {
        const row = body.id
          ? await prisma.storeRow.findUnique({ where: { id: body.id } })
          : null;
        const result =
          row && row.collection === collection
            ? rowToEntry<StoreEntry>(toStoreRow(row))
            : null;
        return NextResponse.json({ result });
      }
      case "put": {
        const entry = body.entry ?? {};
        const prev = entry.id
          ? await prisma.storeRow.findUnique({ where: { id: entry.id } })
          : null;
        const existing =
          prev && prev.collection === collection
            ? rowToEntry<StoreEntry>(toStoreRow(prev))
            : null;
        const merged = mergeEntry<StoreEntry>(existing, entry, nowISO());
        await upsertRow(prisma, entryToRow(collection, merged));
        return NextResponse.json({ result: merged });
      }
      case "delete": {
        await prisma.storeRow.deleteMany({ where: { id: body.id, collection } });
        return NextResponse.json({ result: null });
      }
      case "search": {
        const rows = await prisma.storeRow.findMany({ where: { collection } });
        const entries = rows.map((r) => rowToEntry<StoreEntry>(toStoreRow(r)));
        return NextResponse.json({ result: searchRows(entries, body.query ?? "") });
      }
      case "blobList": {
        const rows = await prisma.storeRow.findMany({ where: { collection: "blob" } });
        let blobs = rows.map((r) => rowToBlob(toStoreRow(r)));
        if (body.kind) blobs = blobs.filter((b) => b.kind === body.kind);
        return NextResponse.json({ result: blobs });
      }
      case "blobGet": {
        const row = body.id
          ? await prisma.storeRow.findUnique({ where: { id: body.id } })
          : null;
        const result =
          row && row.collection === "blob" ? rowToBlob(toStoreRow(row)) : null;
        return NextResponse.json({ result });
      }
      case "blobPut": {
        if (!body.blob) {
          return NextResponse.json({ error: "missing blob" }, { status: 400 });
        }
        const full: BlobEntry = {
          id: body.blob.id ?? newId(),
          kind: body.blob.kind,
          contentType: body.blob.contentType,
          base64: body.blob.base64,
          createdAt: nowISO(),
        };
        await upsertRow(prisma, blobToRow(full));
        return NextResponse.json({ result: full });
      }
      case "blobDelete": {
        await prisma.storeRow.deleteMany({
          where: { id: body.id, collection: "blob" },
        });
        return NextResponse.json({ result: null });
      }
      case "export": {
        const rows = await prisma.storeRow.findMany();
        const result = JSON.stringify(rowsToExport(rows.map(toStoreRow)), null, 2);
        return NextResponse.json({ result });
      }
      case "import": {
        const rows = importToRows(
          JSON.parse(body.json ?? "{}") as Record<string, unknown[]>,
        );
        for (const row of rows) await upsertRow(prisma, row);
        return NextResponse.json({ result: { added: rows.length } });
      }
      case "empty": {
        await prisma.storeRow.deleteMany({});
        return NextResponse.json({ result: null });
      }
      default:
        return NextResponse.json(
          { error: `unknown op ${body.op}` },
          { status: 400 },
        );
    }
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
