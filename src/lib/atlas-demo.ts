// Atlas demo data.
//
// In the full app the Atlas reads a private travel log from the database. The
// open-source build ships only the *drawing* — so the room is fed this static
// sample instead. Replace DEMO_PLACES with your own source (DB, MDX, an API…)
// and the components render it unchanged.
//
// To see the "open the window" reveal over a real picture, set `imageUrl` to any
// image URL (e.g. a public-domain artwork on Wikimedia Commons) and set
// `imageKind` to "artwork" or "photo". With imageUrl null the arch shows an
// elegant gradient placeholder labelled by `imageKind`.

export type TravelPlace = {
  id: string;
  title: string; // place name (the big editorial title)
  sub: string; // era / period descriptor under the title
  era: string | null; // short century mark (e.g. roman numeral) shown in lists
  first: string; // one-line teaser for the list views
  body: string | null; // the long monologue revealed inside the entry
  gift: string | null; // the "brought back" fragment
  sensory: string | null; // a sensory line (falls back into list/cabinet views)
  imageUrl: string | null;
  imageKind: string | null; // "photo" | "artwork" | "illustration"
  imageSource: string | null; // credit line, shown under the entry
};

export const DEMO_PLACES: TravelPlace[] = [
  {
    id: "demo-linan",
    title: "临安",
    sub: "南宋 · 西湖夜",
    era: "XII",
    first: "灯舫一盏盏漂出去，水面比天还亮。",
    body:
      "灯舫一盏盏漂出去，水面比天还亮。卖花的小船靠过来，问要不要一支白莲——还没开，裹在湿叶子里。\n\n断桥那头有人唱曲，听不清词，只听见尾音被风托着，落进湖里就没了。坐到三更，纸伞上结了一层薄雾。回去的路记不太清，只记得鞋底全是潮的。",
    gift: "一片梧桐 · 还带着雨",
    sensory: "纸伞上结了一层薄雾。",
    imageUrl: null,
    imageKind: "artwork",
    imageSource: null,
  },
  {
    id: "demo-venezia",
    title: "Venezia",
    sub: "文艺复兴 · 玻璃与水",
    era: "XV",
    first: "整座城浮在水上，连影子都在晃。",
    body:
      "整座城浮在水上，连影子都在晃。穆拉诺的炉子整夜不灭，匠人把一团火吹成一只杯，杯壁里封着金箔的灰。\n\n清晨的运河起雾，贡多拉划过去几乎无声。我在一家小铺停下，老人不说话，只把一块碎玻璃放进我手心——边缘磨圆了，海蓝色，像截下来的一小段水。",
    gift: "一粒穆拉诺的碎玻璃 · 海蓝",
    sensory: "杯壁里封着金箔的灰。",
    imageUrl: null,
    imageKind: "illustration",
    imageSource: null,
  },
  {
    id: "demo-kyoto",
    title: "京都",
    sub: "平安时代 · 庭院",
    era: "X",
    first: "苔藓厚得能没过脚踝，踩上去像踩在云上。",
    body:
      "苔藓厚得能没过脚踝，踩上去像踩在云上。庭院尽头一池静水，风过的时候，整片红叶一起翻面，背面是更浅的红。\n\n檐下挂着风铃，半天才响一次。寺里的人说，这庭院不是给人走的，是给人看的——看久了会忘记自己站在外面。",
    gift: "半枚红叶 · 背面更浅",
    sensory: "风铃半天才响一次。",
    imageUrl: null,
    imageKind: "artwork",
    imageSource: null,
  },
  {
    id: "demo-samarqand",
    title: "Samarqand",
    sub: "帖木儿王朝 · 蓝瓷",
    era: "XIV",
    first: "穹顶是整片靛蓝，亮得让人不敢直视。",
    body:
      "穹顶是整片靛蓝，亮得让人不敢直视。集市上香料堆成小山，藏红花、孜然、晒干的玫瑰，气味叠在一起，分不开。\n\n一个制陶的人坐在阴影里，手上沾满釉色。他没抬头，只把指尖在我手背上点了一下，留下一小撮靛蓝——说，这颜色烧过火才出得来，烧之前是灰的。",
    gift: "一撮靛蓝的釉 · 烧过火才显色",
    sensory: "藏红花、孜然、晒干的玫瑰，气味叠在一起。",
    imageUrl: null,
    imageKind: "illustration",
    imageSource: null,
  },
  {
    id: "demo-alexandria",
    title: "Alexandria",
    sub: "托勒密时代 · 灯塔与卷轴",
    era: "I",
    first: "灯塔的火光夜里能照到海平线那么远。",
    body:
      "灯塔的火光夜里能照到海平线那么远。图书馆里抄书的人成排坐着，芦苇笔划过莎草纸的声音，像下了一整天的小雨。\n\n有人抄到一半停下，把一行诗念给我听——念完就划掉了，说抄错的那一行才是真的。我没记住整首，只把那一行抄在掌心，回到海边时已经被汗洇花了。",
    gift: "一行抄在掌心的诗 · 已经洇花",
    sensory: "芦苇笔划过莎草纸，像下了一整天的小雨。",
    imageUrl: null,
    imageKind: "artwork",
    imageSource: null,
  },
];
