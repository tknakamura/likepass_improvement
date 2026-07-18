import type { TagCategory } from "@prisma/client";

export const SEED_TAGS: { slug: string; displayName: string; category: TagCategory }[] = [
  { slug: "street", displayName: "Street", category: "SCENE" },
  { slug: "night", displayName: "Night", category: "ATTRIBUTE" },
  { slug: "tokyo", displayName: "Tokyo", category: "LOCATION" },
  { slug: "dog", displayName: "Dog", category: "SUBJECT" },
  { slug: "cat", displayName: "Cat", category: "SUBJECT" },
  { slug: "sunset", displayName: "Sunset", category: "ATTRIBUTE" },
  { slug: "beach", displayName: "Beach", category: "SCENE" },
  { slug: "cafe", displayName: "Cafe", category: "SCENE" },
  { slug: "minimal", displayName: "Minimal", category: "STYLE" },
  { slug: "architecture", displayName: "Architecture", category: "SUBJECT" },
  { slug: "ramen", displayName: "Ramen", category: "SUBJECT" },
  { slug: "mountain", displayName: "Mountain", category: "SCENE" },
  { slug: "portrait", displayName: "Portrait", category: "SUBJECT" },
  { slug: "people", displayName: "People", category: "SUBJECT" },
  { slug: "child", displayName: "Child", category: "SUBJECT" },
  { slug: "family", displayName: "Family", category: "SUBJECT" },
];

export const DEFAULT_CONFIG = {
  dormant: {
    earlyStopMinVotes: 20,
    earlyStopMaxLikeRate: 0.15,
    standardStopMinVotes: 50,
    standardStopMaxLikeRate: 0.25,
    wilsonStopMinVotes: 30,
    wilsonStopUpperBound: 0.35,
  },
  ranking: {
    minVotes: 20,
    minLikes: 5,
    targetVotes: 100,
  },
};

/** Fixed world panel of NPC judges (photo taste lenses, not cultural stereotypes). */
export const SEED_NPC_JUDGES: {
  id: string;
  slug: string;
  displayName: string;
  countryCode: string;
  countryNameJa: string;
  personaJa: string;
  viewingLensJa: string;
  initials: string;
  sortOrder: number;
}[] = [
  {
    id: "npc_us_morgan",
    slug: "us-morgan",
    displayName: "Morgan Hale",
    countryCode: "US",
    countryNameJa: "アメリカ",
    personaJa: "率直でテンポ重視。一目で刺さる瞬間を好む。",
    viewingLensJa: "インパクト、物語の一コマ感、感情の即時伝達",
    initials: "MH",
    sortOrder: 1,
  },
  {
    id: "npc_cn_lin",
    slug: "cn-lin",
    displayName: "Lin Wei",
    countryCode: "CN",
    countryNameJa: "中国",
    personaJa: "構図とバランスに厳格。余白と対称を丁寧に見る。",
    viewingLensJa: "構図の均衡、線の流れ、空間の整理",
    initials: "LW",
    sortOrder: 2,
  },
  {
    id: "npc_in_arjun",
    slug: "in-arjun",
    displayName: "Arjun Mehta",
    countryCode: "IN",
    countryNameJa: "インド",
    personaJa: "色彩と生命感を重視。日常の躍動を探す。",
    viewingLensJa: "色の豊かさ、人の気配、活気のある瞬間",
    initials: "AM",
    sortOrder: 3,
  },
  {
    id: "npc_jp_sora",
    slug: "jp-sora",
    displayName: "青葉 そら",
    countryCode: "JP",
    countryNameJa: "日本",
    personaJa: "静けさと細部へのこだわりが強い。控えめな美を好む。",
    viewingLensJa: "空気感、質感、細部の丁寧さ",
    initials: "青",
    sortOrder: 4,
  },
  {
    id: "npc_de_lena",
    slug: "de-lena",
    displayName: "Lena Vogt",
    countryCode: "DE",
    countryNameJa: "ドイツ",
    personaJa: "技術的完成度を冷静に評価する。曖昧さを嫌う。",
    viewingLensJa: "ピント、露出、技術的な一貫性",
    initials: "LV",
    sortOrder: 5,
  },
  {
    id: "npc_gb_oliver",
    slug: "gb-oliver",
    displayName: "Oliver Grant",
    countryCode: "GB",
    countryNameJa: "イギリス",
    personaJa: "ウィットと空気感を楽しむ。乾いたユーモアも歓迎。",
    viewingLensJa: "雰囲気、意外性、控えめな皮肉やユーモア",
    initials: "OG",
    sortOrder: 6,
  },
  {
    id: "npc_fr_camille",
    slug: "fr-camille",
    displayName: "Camille Moreau",
    countryCode: "FR",
    countryNameJa: "フランス",
    personaJa: "詩的な光と情緒を重視。説明過多を好まない。",
    viewingLensJa: "光の質、情緒、余韻の残る一枚",
    initials: "CM",
    sortOrder: 7,
  },
  {
    id: "npc_br_rafa",
    slug: "br-rafa",
    displayName: "Rafa Oliveira",
    countryCode: "BR",
    countryNameJa: "ブラジル",
    personaJa: "エネルギーと温かさを求める。孤独すぎる画は苦手。",
    viewingLensJa: "躍動感、温かみ、人や場所のエネルギー",
    initials: "RO",
    sortOrder: 8,
  },
  {
    id: "npc_id_dewi",
    slug: "id-dewi",
    displayName: "Dewi Santoso",
    countryCode: "ID",
    countryNameJa: "インドネシア",
    personaJa: "自然の豊かさと日常の美しさを大切にする。",
    viewingLensJa: "自然の質感、日常の優しさ、穏やかな調和",
    initials: "DS",
    sortOrder: 9,
  },
  {
    id: "npc_mx_diego",
    slug: "mx-diego",
    displayName: "Diego Vargas",
    countryCode: "MX",
    countryNameJa: "メキシコ",
    personaJa: "大胆な対比と物語性を好む。平坦な印象は減点。",
    viewingLensJa: "コントラスト、物語性、強いモチーフ",
    initials: "DV",
    sortOrder: 10,
  },
];

export const NPC_JUDGE_COUNT = SEED_NPC_JUDGES.length;
