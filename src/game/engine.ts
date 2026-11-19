import balance from '../data/balance.json';
import zonesData from '../data/zones.json';
import customersData from '../data/customers.json';
import eventsData from '../data/events.json';
import rumorsData from '../data/rumors.json';
import type {
  Choice, CustomerDef, Effects, Ending, EventDef, GameState, NewsItem, RumorDef, ZoneDef, ZoneState,
} from './types';

export const B = balance;
export const ZONES = zonesData as ZoneDef[];
export const CUSTOMERS = customersData as unknown as CustomerDef[];
export const EVENTS = eventsData as unknown as EventDef[];
export const RUMORS = rumorsData as unknown as RumorDef[];

const SAVE_KEY = 'ngay-cuoi-save-v1';

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const zoneDef = (id: string) => ZONES.find(z => z.id === id)!;

function weightedPick<T extends { weight?: number }>(list: T[]): T | undefined {
  const total = list.reduce((s, x) => s + (x.weight ?? 1), 0);
  let r = Math.random() * total;
  for (const x of list) {
    r -= x.weight ?? 1;
    if (r <= 0) return x;
  }
  return list[list.length - 1];
}

export interface ActionResult {
  ok: boolean;
  msg: string;
  cash?: number;
}

export interface EffectChip {
  text: string;
  tone: 'good' | 'bad' | 'neutral';
}

const FLAVOR: NewsItem[] = [
  { kind: 'flavor', headline: 'Thành phố chìm trong im lặng lạ thường', body: 'Quán xá vẫn mở cửa, nhưng chẳng ai nói chuyện lớn tiếng.' },
  { kind: 'flavor', headline: 'Giáo phái "Đón Sao Băng" tổ chức cầu nguyện tập thể', body: 'Hàng trăm người mặc áo trắng tụ tập trên sân thượng các tòa nhà.' },
  { kind: 'flavor', headline: 'Giá mì gói tăng gấp 10 lần', body: 'Chợ đen nhộn nhịp hơn bao giờ hết.' },
  { kind: 'flavor', headline: 'Học sinh vẫn đến trường: "Thi cử thì vẫn phải thi"', body: 'Bộ Giáo dục chưa có thông báo hoãn kỳ thi cuối kỳ.' },
];

export class Game {
  s: GameState;
  private listeners: (() => void)[] = [];

  constructor(state: GameState) {
    this.s = state;
  }

  // ---------- Khởi tạo / lưu ----------
  static newGame(): Game {
    const zones: ZoneState[] = ZONES.map(z => ({
      id: z.id, sentiment: 1, noise: 1, price: 0, history: [], owned: 0, avgCost: 0,
      integrity: z.integrity, supplyLeft: z.supply, dumped: false, supplyMul: 1,
    }));
    const g = new Game({
      day: 1, cash: B.startCash, panicNatural: B.naturalPanicStart, panicPlayer: 0, suspicion: 0,
      bunker: B.bunkerStart, conscience: 0, vip: false, vipPaid: 0, flags: [], zones, phase: 'morning',
      visitorQueue: [], visitorIndex: 0, rumorsUsed: 0, rumorCount: 0, news: [], nightNews: [],
      scheduled: [], usedVisitors: [], usedEvents: [], lastInvestigationDay: -99, vipHistory: [],
      peakNetWorth: B.startCash,
    });
    g.startDay();
    return g;
  }

  static load(): Game | null {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      const s = JSON.parse(raw) as GameState;
      if (!s || s.phase === 'ended') return null;
      return new Game(s);
    } catch { return null; }
  }

  static clearSave() {
    try { localStorage.removeItem(SAVE_KEY); } catch { /* bỏ qua */ }
  }

  save() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.s)); } catch { /* bỏ qua */ }
  }

  onChange(fn: () => void) { this.listeners.push(fn); }
  private emit() {
    this.s.peakNetWorth = Math.max(this.s.peakNetWorth, this.netWorth);
    if (this.s.phase === 'ended') Game.clearSave(); else this.save();
    this.listeners.forEach(f => f());
  }

  // ---------- Chỉ số ----------
  get panic() { return clamp(this.s.panicNatural + this.s.panicPlayer, 0, 100); }
  get panicNaturalClamped() { return clamp(this.s.panicNatural, 0, 100); }
  get daysLeft() { return B.days - this.s.day + 1; }
  has(flag: string) { return this.s.flags.includes(flag); }
  zone(id: string) { return this.s.zones.find(z => z.id === id)!; }
  get totalOwned() { return this.s.zones.reduce((n, z) => n + z.owned, 0); }
  get netWorth() { return this.s.cash + this.s.zones.reduce((n, z) => n + z.owned * z.price, 0); }

  /** Chỉ số lạm phát chung — mọi giá trị tiền trong dữ liệu được nhân với số này */
  infl(panic = this.panic) {
    return (1 + this.s.day * B.dayGrowth) * (1 + panic / B.panicDiv);
  }

  vipPrice(panic = this.panic) {
    return Math.round(B.vipBase * (1 + this.s.day * B.vipDayGrowth) * Math.pow(1 + panic / B.vipPanicDiv, B.vipPanicExp));
  }
  /** Giá vé VIP nếu bạn chưa từng gây hoảng loạn */
  get vipNatural() { return this.vipPrice(this.panicNaturalClamped); }
  /** Chỉ số chi phí: chỉ tăng theo thời gian, không theo hoảng loạn (dùng cho chi phí dịch vụ & tiền của khách) */
  get costIndex() { return 1 + this.s.day * B.dayGrowth; }
  get bunkerUpgradeCost() { return Math.round(B.bunkerUpgradeCost * this.costIndex); }

  rumorCost(r: RumorDef) { return Math.round(r.cost * this.costIndex); }

  recompute(z: ZoneState) {
    const d = zoneDef(z.id);
    z.price = Math.max(500, Math.round(d.basePrice * this.infl() * z.sentiment * z.noise));
  }
  private recomputeAll() { this.s.zones.forEach(z => this.recompute(z)); }

  // ---------- Vòng lặp ngày ----------
  private startDay() {
    const s = this.s;
    s.zones.forEach(z => { z.supplyMul = 1; });
    s.news = [...s.nightNews];
    s.nightNews = [];

    // Sự kiện đã lên lịch
    const dueEvents = s.scheduled.filter(x => x.type === 'event' && x.day <= s.day);
    s.scheduled = s.scheduled.filter(x => !(x.type === 'event' && x.day <= s.day));
    for (const d of dueEvents) {
      const ev = EVENTS.find(e => e.id === d.id);
      if (ev) this.applyEvent(ev);
    }
    // Sự kiện ngẫu nhiên
    if (Math.random() < B.eventChance) {
      const pool = EVENTS.filter(e => !e.scripted && s.day >= e.minDay && s.day <= e.maxDay && !s.usedEvents.includes(e.id));
      const ev = weightedPick(pool);
      if (ev) this.applyEvent(ev);
    }
    if (s.news.length === 0) s.news.push(FLAVOR[Math.floor(Math.random() * FLAVOR.length)]);

    // Nguồn cung trong ngày
    s.zones.forEach(z => {
      const d = zoneDef(z.id);
      z.supplyLeft = Math.round(d.supply * (z.dumped ? 2 : 1) * z.supplyMul);
      z.dumped = false;
    });

    // Khách
    const queue: string[] = [];
    const dueVisitors = s.scheduled.filter(x => x.type === 'visitor' && x.day <= s.day);
    s.scheduled = s.scheduled.filter(x => !(x.type === 'visitor' && x.day <= s.day));
    dueVisitors.forEach(v => queue.push(v.id));
    if (s.suspicion >= B.investigationThreshold && s.day - s.lastInvestigationDay >= 5) {
      queue.push('thanh_tra');
      s.lastInvestigationDay = s.day;
    }
    const pool = CUSTOMERS.filter(c =>
      !c.scripted && s.day >= c.minDay && s.day <= c.maxDay && !s.usedVisitors.includes(c.id) &&
      (!c.requiresFlag || this.has(c.requiresFlag)) && (!c.forbidFlag || !this.has(c.forbidFlag)));
    while (queue.length < B.visitorsPerDay && pool.length) {
      const c = weightedPick(pool)!;
      pool.splice(pool.indexOf(c), 1);
      queue.push(c.id);
      s.usedVisitors.push(c.id);
    }
    s.visitorQueue = queue;
    s.visitorIndex = 0;
    s.rumorsUsed = 0;
    s.phase = 'morning';
    this.recomputeAll();
    // Lưu giá mở cửa mỗi ngày để vẽ biểu đồ
    s.zones.forEach(z => { z.history.push(z.price); if (z.history.length > 31) z.history.shift(); });
    s.vipHistory.push(this.vipPrice());
    this.checkArrest();
  }

  private applyEvent(ev: EventDef) {
    this.s.usedEvents.push(ev.id);
    this.s.news.push({ kind: 'event', headline: ev.headline, body: ev.body });
    this.applyEffects(ev.effects);
  }

  goOffice() {
    if (this.s.phase !== 'morning') return;
    this.s.phase = 'office';
    this.emit();
  }

  goNight() {
    if (this.s.phase !== 'office') return;
    this.s.phase = 'night';
    this.emit();
  }

  sleep() {
    if (this.s.phase !== 'night') return;
    const s = this.s;
    s.zones.forEach(z => {
      z.sentiment += (1 - z.sentiment) * B.sentimentRevert;
      z.noise = 1 + (Math.random() * 2 - 1) * B.priceNoise;
    });
    s.panicNatural = clamp(s.panicNatural + B.naturalPanicPerDay * (1 + s.day / 30), 0, 100);
    s.suspicion = clamp(s.suspicion - B.suspicionDecay, 0, 100);
    s.day += 1;
    if (s.day > B.days) {
      this.finish();
    } else {
      this.startDay();
    }
    this.emit();
  }

  // ---------- Giao dịch ----------
  buy(id: string): ActionResult {
    const z = this.zone(id);
    if (this.s.phase === 'morning' || this.s.phase === 'ended') return { ok: false, msg: 'Sàn chưa mở cửa.' };
    if (z.supplyLeft <= 0) return { ok: false, msg: 'Không còn ai rao bán suất ở khu này hôm nay.' };
    if (this.s.cash < z.price) return { ok: false, msg: 'Không đủ tiền.' };
    const price = z.price;
    this.s.cash -= price;
    z.avgCost = (z.avgCost * z.owned + price) / (z.owned + 1);
    z.owned += 1;
    z.supplyLeft -= 1;
    z.sentiment *= 1 + B.tradeImpact;
    this.recompute(z);
    this.emit();
    return { ok: true, msg: `Mua 1 suất ${zoneDef(id).short}`, cash: -price };
  }

  sell(id: string): ActionResult {
    const z = this.zone(id);
    if (this.s.phase === 'morning' || this.s.phase === 'ended') return { ok: false, msg: 'Sàn chưa mở cửa.' };
    if (z.owned <= 0) return { ok: false, msg: 'Bạn không giữ suất nào ở khu này.' };
    const price = z.price;
    this.s.cash += price;
    z.owned -= 1;
    if (z.owned === 0) z.avgCost = 0;
    z.sentiment *= 1 - B.tradeImpact;
    this.recompute(z);
    this.emit();
    return { ok: true, msg: `Bán 1 suất ${zoneDef(id).short}`, cash: price };
  }

  buyVip(): ActionResult {
    if (this.s.vip) return { ok: false, msg: 'Bạn đã có vé.' };
    if (this.s.phase === 'morning' || this.s.phase === 'ended') return { ok: false, msg: 'Chưa thể giao dịch lúc này.' };
    const p = this.vipPrice();
    if (this.s.cash < p) return { ok: false, msg: 'Không đủ tiền mua vé VIP.' };
    this.s.cash -= p;
    this.s.vip = true;
    this.s.vipPaid = p;
    this.emit();
    return { ok: true, msg: 'Bạn đã có một chỗ trên Con Tàu.', cash: -p };
  }

  upgradeBunker(): ActionResult {
    if (this.s.phase === 'morning' || this.s.phase === 'ended') return { ok: false, msg: 'Chưa thể giao dịch lúc này.' };
    if (this.s.bunker >= B.bunkerMoneyCap) return { ok: false, msg: `Tiền chỉ gia cố được tới ${B.bunkerMoneyCap}%. Cần kỹ sư giỏi.` };
    const c = this.bunkerUpgradeCost;
    if (this.s.cash < c) return { ok: false, msg: 'Không đủ tiền mua vật liệu.' };
    this.s.cash -= c;
    this.s.bunker = Math.min(B.bunkerMoneyCap, this.s.bunker + B.bunkerUpgradeGain);
    this.emit();
    return { ok: true, msg: `Gia cố hầm riêng +${B.bunkerUpgradeGain}%`, cash: -c };
  }

  // ---------- Tin đồn ----------
  useRumor(rid: string, zid?: string): ActionResult {
    const r = RUMORS.find(x => x.id === rid)!;
    const s = this.s;
    if (s.phase !== 'night') return { ok: false, msg: 'Tin đồn chỉ tung ra vào ban đêm.' };
    if (s.rumorsUsed >= B.rumorsPerNight) return { ok: false, msg: 'Đêm nay đã đủ lệnh. Đừng để lộ.' };
    const cost = this.rumorCost(r);
    if (s.cash < cost) return { ok: false, msg: 'Không đủ tiền chi cho truyền thông.' };
    if (r.target === 'zone' && !zid) return { ok: false, msg: 'Chọn khu mục tiêu trước.' };

    const amp = this.has('cartel') ? 1.5 : 1;
    const scale = (m: number) => m < 1 ? Math.max(0.25, 1 - (1 - m) * amp) : 1 + (m - 1) * amp;

    s.cash -= cost;
    s.rumorsUsed += 1;
    if (r.id !== 'lawyer') s.rumorCount += 1;

    if (r.target === 'zone' && zid) {
      const z = this.zone(zid);
      if (r.sentimentMul) z.sentiment *= scale(r.sentimentMul);
      if (r.debunk) z.sentiment = Math.max(z.sentiment, 1) * scale(r.debunk);
      if (r.spill) s.zones.forEach(o => { if (o !== z) o.sentiment *= r.spill!; });
      if (r.dump) z.dumped = true;
    }
    if (r.sentimentAll) s.zones.forEach(z => { z.sentiment *= scale(r.sentimentAll!); });
    if (r.panic) s.panicPlayer = clamp(s.panicPlayer + r.panic * amp, -20, 100);
    if (r.suspicion) {
      const k = r.suspicion > 0 && this.has('co_bot') ? 0.6 : 1;
      s.suspicion = clamp(s.suspicion + r.suspicion * k, 0, 100);
    }
    if (r.headline) {
      const name = zid ? zoneDef(zid).name : '';
      s.nightNews.push({ kind: 'rumor', headline: r.headline.replace('{zone}', name), body: r.body });
    }
    this.recomputeAll();
    this.checkArrest();
    this.emit();
    return { ok: true, msg: r.name, cash: -cost };
  }

  // ---------- Khách ----------
  get currentVisitor(): CustomerDef | null {
    const id = this.s.visitorQueue[this.s.visitorIndex];
    return id ? CUSTOMERS.find(c => c.id === id) ?? null : null;
  }

  private cashCost(e: Effects): number {
    let c = 0;
    if (e.cash && e.cash < 0) c += -e.cash * this.costIndex;
    if (e.buySlot) c += this.zone(e.zone ?? ZONES[0].id).price * e.buySlot;
    return Math.round(c);
  }

  canChoose(ch: Choice): { ok: boolean; why?: string } {
    for (const r of ch.requires ?? []) {
      if (r === 'slot' && this.totalOwned === 0) return { ok: false, why: 'Bạn không giữ suất nào' };
      if (r.startsWith('flag:') && !this.has(r.slice(5))) return { ok: false, why: 'Không khả dụng' };
    }
    if (this.cashCost(ch.effects) > this.s.cash) return { ok: false, why: 'Không đủ tiền' };
    return { ok: true };
  }

  private bestOwned() {
    return this.s.zones.filter(z => z.owned > 0).sort((a, b) => b.price - a.price)[0];
  }
  private cheapestOwned() {
    return this.s.zones.filter(z => z.owned > 0).sort((a, b) => a.price - b.price)[0];
  }

  /** Mô tả hiệu ứng của một lựa chọn để hiển thị cho người chơi */
  preview(e: Effects): EffectChip[] {
    const chips: EffectChip[] = [];
    const k = this.costIndex;
    if (e.sellSlot) {
      const z = this.bestOwned();
      if (z) chips.push({ text: `+${fmtMoney(z.price * e.sellSlot)} · −1 suất ${zoneDef(z.id).short}`, tone: 'good' });
    }
    if (e.buySlot) {
      const z = this.zone(e.zone ?? ZONES[0].id);
      chips.push({ text: `−${fmtMoney(z.price * e.buySlot)} · +1 suất ${zoneDef(z.id).short}`, tone: 'neutral' });
    }
    if (e.giveSlot) {
      const z = this.cheapestOwned();
      chips.push({ text: `−1 suất${z ? ' ' + zoneDef(z.id).short : ''}`, tone: 'bad' });
    }
    if (e.cash) chips.push({ text: `${e.cash > 0 ? '+' : '−'}${fmtMoney(Math.abs(e.cash * k))}`, tone: e.cash > 0 ? 'good' : 'bad' });
    if (e.suspicion) chips.push({ text: `Nghi ngờ ${e.suspicion > 0 ? '+' : ''}${e.suspicion}`, tone: e.suspicion > 0 ? 'bad' : 'good' });
    if (e.panic) chips.push({ text: `Hoảng loạn ${e.panic > 0 ? '+' : ''}${e.panic}`, tone: e.panic > 0 ? 'bad' : 'good' });
    if (e.bunker) chips.push({ text: `Hầm riêng +${e.bunker}%`, tone: 'good' });
    if (e.sentimentAll) chips.push({ text: `Giá mọi khu ×${e.sentimentAll}`, tone: 'neutral' });
    return chips;
  }

  choose(index: number): { ok: boolean; result: string; cash: number } {
    const c = this.currentVisitor;
    if (!c || this.s.phase !== 'office') return { ok: false, result: '', cash: 0 };
    const ch = c.choices[index];
    if (!ch || !this.canChoose(ch).ok) return { ok: false, result: '', cash: 0 };
    const before = this.s.cash;
    this.applyEffects(ch.effects);
    this.s.visitorIndex += 1;
    this.recomputeAll();
    this.emit();
    return { ok: true, result: ch.result, cash: this.s.cash - before };
  }

  private applyEffects(e: Effects) {
    const s = this.s;
    const k = this.costIndex;
    if (e.sellSlot) {
      const z = this.bestOwned();
      if (z) { s.cash += Math.round(z.price * e.sellSlot); z.owned -= 1; if (!z.owned) z.avgCost = 0; }
    }
    if (e.giveSlot) {
      const z = this.cheapestOwned();
      if (z) { z.owned -= 1; if (!z.owned) z.avgCost = 0; }
    }
    if (e.buySlot) {
      const z = this.zone(e.zone ?? ZONES[0].id);
      const p = Math.round(z.price * e.buySlot);
      s.cash -= p;
      z.avgCost = (z.avgCost * z.owned + p) / (z.owned + 1);
      z.owned += 1;
    }
    if (e.cash) s.cash += Math.round(e.cash * k);
    if (e.panic) s.panicPlayer = clamp(s.panicPlayer + e.panic, -20, 100);
    if (e.panicNatural) s.panicNatural = clamp(s.panicNatural + e.panicNatural, 0, 100);
    if (e.suspicion) s.suspicion = clamp(s.suspicion + e.suspicion, 0, 100);
    if (e.bunker) s.bunker = clamp(s.bunker + e.bunker, 0, 95);
    if (e.conscience) s.conscience += e.conscience;
    if (e.flag && !this.has(e.flag)) s.flags.push(e.flag);
    if (e.removeFlag) s.flags = s.flags.filter(f => f !== e.removeFlag);
    if (e.schedule) s.scheduled.push({ type: e.schedule.type, id: e.schedule.id, day: s.day + e.schedule.inDays });
    if (e.zone && !e.buySlot) {
      const z = this.zone(e.zone);
      if (e.zoneSentiment) z.sentiment *= e.zoneSentiment;
      if (e.zoneIntegrity) z.integrity = clamp(z.integrity + e.zoneIntegrity, 0, 100);
      if (e.supplyMul !== undefined) z.supplyMul = e.supplyMul;
    }
    if (e.sentimentAll) s.zones.forEach(z => { z.sentiment *= e.sentimentAll!; });
    this.checkArrest();
  }

  // ---------- Kết thúc ----------
  private checkArrest() {
    const s = this.s;
    if (s.suspicion < 100 || s.phase === 'ended') return;
    if (this.has('quan_che')) {
      s.flags = s.flags.filter(f => f !== 'quan_che');
      s.suspicion = 60;
      s.nightNews.push({ kind: 'event', headline: 'Hồ sơ điều tra môi giới tự do bất ngờ bị "thất lạc"', body: 'Một nguồn tin cho biết lệnh bắt đã được rút lại vào phút chót.' });
      return;
    }
    s.phase = 'ended';
    s.ending = {
      kind: 'arrested',
      title: 'CÒNG TAY',
      text: `Sáng ngày ${s.day}, cảnh sát phá cửa văn phòng. Toàn bộ tài sản bị phong tỏa. Phòng giam không phải là hầm trú ẩn.`,
      epilogue: this.epilogue(),
    };
  }

  private finish() {
    const s = this.s;
    s.day = B.days;
    s.phase = 'ended';
    if (s.vip) {
      s.ending = {
        kind: 'vip',
        title: 'CON TÀU CẤT CÁNH',
        text: 'Bạn nhìn thành phố nhỏ dần qua ô cửa kính. Phía dưới, hàng triệu ánh đèn tắt cùng lúc.',
        epilogue: this.epilogue(),
        chance: 100,
      };
      return;
    }
    const owned = s.zones.filter(z => z.owned > 0);
    const bestZone = owned.length ? Math.max(...owned.map(z => z.integrity)) : 0;
    const chance = Math.max(s.bunker, bestZone);
    const survived = Math.random() * 100 < chance;
    const where = bestZone > s.bunker ? `một suất ở ${zoneDef(owned.find(z => z.integrity === bestZone)!.id).name}` : 'căn hầm riêng của bạn';
    s.ending = survived
      ? { kind: 'survived', title: 'BẠN VẪN CÒN THỞ', text: `Mặt đất rung chuyển suốt ba ngày. Khi bụi lắng xuống, ${where} vẫn đứng vững.`, epilogue: this.epilogue(), chance }
      : { kind: 'died', title: 'BÓNG TỐI', text: `Bạn đã đặt cược vào ${where}. Vách hầm nứt toác từ giây thứ mười bảy.`, epilogue: this.epilogue(), chance };
  }

  private epilogue(): string[] {
    const s = this.s;
    const lines: string[] = [];
    const extra = this.vipPrice() - this.vipNatural;
    lines.push(`Bạn đã tung ${s.rumorCount} tin đồn. Hoảng loạn do bạn gây ra: ${Math.round(Math.max(0, s.panicPlayer))} điểm.`);
    if (extra > 0) lines.push(`Vì chính bạn, vé VIP đắt hơn ${fmtMoney(extra)}.`);
    lines.push(`Tài sản cao nhất từng đạt: ${fmtMoney(s.peakNetWorth)}.`);
    if (this.has('bo_cho') || this.has('bo_mua')) lines.push('Con gái ông Hòa sống sót. Nhiều năm sau, cô bé trở thành bác sĩ.');
    else if (this.has('bo_bi_ep')) lines.push('Ông Hòa trả giá gấp ba. Ông ở lại trên mặt đất để con gái có chỗ dưới hầm.');
    else if (this.has('bo_tuchoi') || this.has('bo_duoi')) lines.push('Không ai biết hai cha con ông Hòa đã đi đâu.');
    if (this.has('cuu_me_con')) lines.push('Ở đâu đó dưới lòng đất, một đứa trẻ hai tuổi vẫn còn sống.');
    if (this.has('co_ky_su')) lines.push('Chị Mai là người cuối cùng rời công trường hầm của bạn.');
    if (this.has('cartel')) lines.push('Hắc Long bán đứng bạn ngay ngày đầu tiên sau thảm họa. Thói quen khó bỏ.');
    if (s.conscience >= 6) lines.push('Người ta sẽ nhớ về bạn như một kẻ buôn bán... nhưng vẫn còn trái tim.');
    else if (s.conscience <= -6) lines.push('Lịch sử, nếu còn ai viết, sẽ gọi bạn là "Kẻ buôn mạng người".');
    return lines;
  }
}

export function fmtMoney(n: number): string {
  const v = Math.round(n);
  const a = Math.abs(v);
  const sign = v < 0 ? '−' : '';
  if (a >= 1e9) return `${sign}$${(a / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `${sign}$${(a / 1e6).toFixed(2)}M`;
  if (a >= 1e4) return `${sign}$${(a / 1e3).toFixed(1)}K`;
  return `${sign}$${a.toLocaleString('en-US')}`;
}

export { zoneDef };
