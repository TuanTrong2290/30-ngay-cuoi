// Kiểu dữ liệu dùng chung. Nội dung game (khách, sự kiện, tin đồn...) nằm trong src/data/*.json

export interface ZoneDef {
  id: string;
  name: string;
  short: string;
  desc: string;
  basePrice: number;
  /** Độ bền THẬT (0-100) — quyết định khả năng sống sót nếu bạn trú ở khu này */
  integrity: number;
  /** Số suất người khác rao bán mỗi ngày */
  supply: number;
}

/** Hiệu ứng dùng chung cho lựa chọn của khách và sự kiện tin tức */
export interface Effects {
  /** Tiền (sẽ nhân với chỉ số lạm phát hiện tại). Âm = chi phí */
  cash?: number;
  /** Bán 1 suất bạn đang giữ, giá = giá thị trường × hệ số */
  sellSlot?: number;
  /** Cho đi 1 suất (khu rẻ nhất bạn đang giữ) */
  giveSlot?: boolean;
  /** Mua 1 suất, giá = giá thị trường × hệ số */
  buySlot?: number;
  /** Hoảng loạn do BẠN gây ra */
  panic?: number;
  /** Hoảng loạn tự nhiên (không phải do bạn) */
  panicNatural?: number;
  suspicion?: number;
  /** Độ bền hầm riêng (+%) */
  bunker?: number;
  conscience?: number;
  flag?: string;
  removeFlag?: string;
  schedule?: { type: 'visitor' | 'event'; id: string; inDays: number };
  zone?: string;
  zoneSentiment?: number;
  zoneIntegrity?: number;
  sentimentAll?: number;
  supplyMul?: number;
}

export interface Choice {
  label: string;
  hint?: string;
  /** "slot" = cần có ít nhất 1 suất; "flag:xxx" = cần cờ xxx */
  requires?: string[];
  effects: Effects;
  result: string;
}

export interface Portrait {
  color: string;
  hat?: 'none' | 'fedora' | 'cap' | 'beret' | 'helmet' | 'bun' | 'hood';
  glasses?: boolean;
  build?: 'slim' | 'broad' | 'small';
  /** Đường dẫn ảnh (tùy chọn) — nếu có sẽ thay cho bóng đen */
  image?: string;
}

export interface CustomerDef {
  id: string;
  name: string;
  role: string;
  portrait: Portrait;
  minDay: number;
  maxDay: number;
  weight?: number;
  scripted?: boolean;
  requiresFlag?: string;
  forbidFlag?: string;
  lines: string[];
  choices: Choice[];
}

export interface EventDef {
  id: string;
  minDay: number;
  maxDay: number;
  weight?: number;
  scripted?: boolean;
  headline: string;
  body: string;
  effects: Effects;
}

export interface RumorDef {
  id: string;
  name: string;
  desc: string;
  cost: number;
  target: 'zone' | 'none';
  sentimentMul?: number;
  debunk?: number;
  spill?: number;
  dump?: boolean;
  sentimentAll?: number;
  panic?: number;
  suspicion?: number;
  headline: string;
  body: string;
}

export interface ZoneState {
  id: string;
  sentiment: number;
  noise: number;
  price: number;
  history: number[];
  owned: number;
  avgCost: number;
  integrity: number;
  supplyLeft: number;
  dumped: boolean;
  supplyMul: number;
}

export type Phase = 'morning' | 'office' | 'night' | 'ended';

export interface NewsItem {
  headline: string;
  body: string;
  kind: 'event' | 'rumor' | 'flavor';
}

export interface Ending {
  kind: 'vip' | 'survived' | 'died' | 'arrested';
  title: string;
  text: string;
  epilogue: string[];
  chance?: number;
}

export interface GameState {
  day: number;
  cash: number;
  panicNatural: number;
  panicPlayer: number;
  suspicion: number;
  bunker: number;
  conscience: number;
  vip: boolean;
  vipPaid: number;
  flags: string[];
  zones: ZoneState[];
  phase: Phase;
  visitorQueue: string[];
  visitorIndex: number;
  rumorsUsed: number;
  rumorCount: number;
  news: NewsItem[];
  nightNews: NewsItem[];
  scheduled: { type: 'visitor' | 'event'; id: string; day: number }[];
  usedVisitors: string[];
  usedEvents: string[];
  lastInvestigationDay: number;
  vipHistory: number[];
  peakNetWorth: number;
  ending?: Ending;
}
