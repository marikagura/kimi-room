// V2 Store interfaces · 11 structured store + blob · 抽象 backend (IDB / Supabase / Prisma / core).
//
// 设计原则:
// - 每 store entry 含 `id` (uuid) + `createdAt` + `updatedAt` (ISO timestamp)
// - binary (照片 / PNG) 单独 BlobStore (portrait / keepsake photo / char card PNG)
// - 全 store 都支持 exportJSON / importJSON · 跨 device migrate / backup
// - search() 是 plain text search · 后续 community embedding adapter PR
//
// canon mode wires CanonPrismaAdapter (existing canon DB), V2 mode wires
// IndexedDBAdapter (default) · settings 切 NotionAdapter / SupabaseAdapter.

export type ISODate = string;

export type StoreEntry = {
  id: string;
  createdAt: ISODate;
  updatedAt: ISODate;
};

// ── Module II · Keepsakes (canon postcard · photo + commentary)
// canon V1 fields (店名 / 地点·日期 / 一句话 / {{char}} note).
export type KeepsakeEntry = StoreEntry & {
  title?: string;            // 店名 (canon shop / place name)
  place?: string;            // 地点 · 日期 (location · date)
  record?: string;           // 一句话 (user's one-line)
  note?: string;             // {{char}} note · LLM-gen 300-500 token commentary (owner 0525 Q1)
  photo?: string;            // dataURL OR public URL (canon stored both; V2 default dataURL via BlobStore)
  photoBlobId?: string;      // optional ref to BlobStore (V2 binary path)
  tags?: string[];
};

// ── Module III · Study sub-pages
export type PieceEntry = StoreEntry & {
  // short-pieces · char own essays / writings
  title: string;
  body: string;
  tags: string[];
  // optional LLM "{{char}} 读后感" (owner 0518 共读 · 触发 from category fox)
  aiReflection?: string;
};

export type BookEntry = StoreEntry & {
  // reading list
  title: string;
  author?: string;
  status: "want" | "reading" | "read" | "abandoned";
  rating?: number;            // 1-5
  notes?: string;
  // 书架 visual fields (study /room/study bookshelf 自由编辑)
  spineColor?: string;
  spineLabel?: string;
  height?: number;            // 96-140 px
  // LLM "{{char}} 读后感" per-page (owner 0518 共读) · sparse map page-idx → text
  aiReflections?: Record<string, string>;
};

export type ConceptEntry = StoreEntry & {
  // philosophy / concept anchors
  term: string;
  definition: string;
  sources: string[];
};

export type MemoEntry = StoreEntry & {
  // memo / notes / observations
  title?: string;
  body: string;
  mood?: string;
};

// ── Module IV · Calendar + Finance
export type CalendarEvent = StoreEntry & {
  date: ISODate;              // YYYY-MM-DD (JST)
  title: string;
  body?: string;
  location?: string;
  amount?: number;            // optional · 联动 finance aggregate
  financeCategory?: string;   // user-defined slot id (e.g. "food" / "coffee")
};

// ── Module V · Memory (world book / lorebook / 长期 memory)
export type MemoryEntry = StoreEntry & {
  key: string;                // trigger keyword
  content: string;
  order: number;
  active: boolean;            // on/off toggle
  tags: string[];
  reviewStatus?: "pending" | "approved" | "rejected"; // manual review per owner 0525
  // V2 Heartbeat sky · owner 0519 · valence tag (manual or LLM auto-set)
  valence?: "brooding" | "calm" | "warmth" | "towardHer";
  pinned?: boolean;           // pole star anchor candidate
};

// ── Module VI · Disc (chat shuffle archive + playlist tracks)
export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  ts?: string;
  // Inline image (dataURL) · owner 0518 disc paste 加 screenshot import.
  // 渲染时 bubble 内 <img> 替 text. content 仍可保留 caption.
  imageDataUrl?: string;
};

// canon GardenCardData shape · chat session archive snapshot (disc shuffle source)
export type ChatEntry = StoreEntry & {
  source: string;              // "cc-chat" / "wechat" / "tg" / "manual" / etc
  title: string | null;
  messages: ChatMessage[];     // structured msg array (canon iOS-style render)
  note: string | null;
  theme: "night" | "day";      // rendering theme stored w/ snapshot
  scene?: string;
  participants?: string[];
};

export type TrackEntry = StoreEntry & {
  // playlist track
  title: string;
  artist?: string;
  url?: string;               // 网易云 / Spotify / YouTube share link
  cover?: string;             // image URL or BlobId
  tag?: string;               // playlist category
};

// ── Binary store (photos / portraits / char card PNG)
export type BlobEntry = {
  id: string;
  kind: "portrait-self" | "portrait-other" | "keepsake" | "char-card" | "track-cover" | "misc";
  contentType: string;        // mime
  base64: string;             // data sans `data:image/...;base64,` prefix
  createdAt: ISODate;
};

// ── Active state (user mood / schedule / health)
export type ActiveStateEntry = StoreEntry & {
  stateType: "HEALTH" | "MOOD" | "PROJECT" | "STRESS" | "SCHEDULE";
  title: string;
  summary: string;
  body?: string;
};

// ── Sleep window · manual entry (V2 没 APP_OPEN inference, 全手工)
// id = JST end date "YYYY-MM-DD" (1 entry per night, 跨日 算 end-date 起夜).
export type SleepEntry = StoreEntry & {
  date: ISODate;              // YYYY-MM-DD JST · same as id
  startISO: ISODate;          // 入睡时刻 UTC ISO
  durationHrs: number;        // 0 < n <= 24
};

// ── Store contracts
export type Filter = {
  ids?: string[];
  tags?: string[];
  status?: string;
  activeOnly?: boolean;
  dateRange?: { from: ISODate; to: ISODate };
  limit?: number;
};

export type StoreContract<T extends StoreEntry> = {
  list(filter?: Filter): Promise<T[]>;
  get(id: string): Promise<T | null>;
  put(entry: Partial<T> & { id?: string }): Promise<T>;
  delete(id: string): Promise<void>;
  search?(query: string, k?: number): Promise<T[]>;
};

export type BlobContract = {
  list(kind?: BlobEntry["kind"]): Promise<BlobEntry[]>;
  get(id: string): Promise<BlobEntry | null>;
  put(blob: Omit<BlobEntry, "id" | "createdAt"> & { id?: string }): Promise<BlobEntry>;
  delete(id: string): Promise<void>;
};

export type AdapterBundle = {
  keepsake: StoreContract<KeepsakeEntry>;
  piece: StoreContract<PieceEntry>;
  book: StoreContract<BookEntry>;
  concept: StoreContract<ConceptEntry>;
  memo: StoreContract<MemoEntry>;
  calendar: StoreContract<CalendarEvent>;
  memory: StoreContract<MemoryEntry>;
  chat: StoreContract<ChatEntry>;
  track: StoreContract<TrackEntry>;
  activeState: StoreContract<ActiveStateEntry>;
  sleep: StoreContract<SleepEntry>;
  blob: BlobContract;
  exportJSON(): Promise<string>;
  importJSON(json: string): Promise<{ added: number }>;
  empty(): Promise<void>;
};
