import { B, CUSTOMERS, Game, RUMORS, ZONES, fmtMoney, zoneDef } from '../game/engine';
import type { Choice } from '../game/types';
import { portraitSVG } from './portrait';
import * as fx from './fx';
import { audio } from './audio';

const q = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector(sel) as T;
const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const pct = (n: number) => `${Math.round(n)}%`;

export class UI {
  game!: Game;
  private root: HTMLElement;
  private scene!: HTMLElement;
  private centerKey = '';
  private result: { text: string } | null = null;
  private shownMorningDay = -1;
  private cityDay = -1;
  private calDay = -1;
  private targetZone = ZONES[0].id;
  private prevPrices = new Map<string, number>();
  private endingShown = false;
  private busy = false;
  onRestart: () => void = () => {};

  constructor(root: HTMLElement) {
    this.root = root;
    this.build();
    fx.initFx(root);
    this.startAmbient();
  }

  attach(game: Game) {
    const fresh = game !== this.game;
    this.game = game;
    this.centerKey = '';
    this.result = null;
    this.shownMorningDay = -1;
    this.endingShown = false;
    this.prevPrices.clear();
    q('.cash-val').removeAttribute('data-value');
    q('.net-val').removeAttribute('data-value');
    this.calDay = -1;
    this.cityDay = -1;
    if (fresh) game.onChange(() => { if (this.game === game) this.render(); });
    this.render();
  }

  // ================= Khung =================
  private build() {
    this.root.innerHTML = `
<div class="scene" id="scene">
  <div class="wall">
    <div class="window">
      <div class="sky"><div class="stars"></div><div class="meteor"><div class="meteor-tail"></div><div class="meteor-core"></div></div></div>
      <svg class="city" viewBox="0 0 1000 160" preserveAspectRatio="none"></svg>
      <div class="window-frame"></div>
    </div>
    <div class="calendar"><div class="cal-rings"></div><div class="cal-page"><span class="cal-top">CÒN</span><span class="cal-num">30</span><span class="cal-sub">NGÀY</span></div></div>
    <div class="title-plate">
      <div class="brand">VĂN PHÒNG MÔI GIỚI <b>TRÚ ẨN</b></div>
      <div class="phase-label"></div>
      <div class="corner-btns">
        <button class="mute-btn" title="Bật/tắt âm thanh"></button>
        <button class="help-btn" title="Cách chơi">?</button>
      </div>
    </div>
  </div>
  <div class="desk">
    <section class="crt">
      <div class="crt-screen">
        <div class="crt-head"><span>▌SÀN GIAO DỊCH SUẤT TRÚ ẨN</span><span class="crt-day"></span></div>
        <div class="market"></div>
        <div class="crt-foot"></div>
      </div>
      <div class="crt-led"></div>
    </section>
    <section class="center"></section>
    <section class="side">
      <div class="paper-mini"></div>
      <div class="card bunker-card">
        <div class="card-h">HẦM RIÊNG</div>
        <div class="bunker-body">
          <div class="ring"><svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="27" class="ring-bg"/><circle cx="32" cy="32" r="27" class="ring-fg"/></svg><b class="bunker-val"></b></div>
          <div class="bunker-info"><small class="survive"></small><button class="btn upgrade"></button></div>
        </div>
      </div>
      <div class="card vip-card">
        <div class="card-h">VÉ CON TÀU · VIP</div>
        <div class="vip-price"></div>
        <div class="vip-cause"></div>
        <canvas class="vip-spark" width="220" height="40"></canvas>
        <button class="btn vip-buy"></button>
        <div class="vip-stamp">ĐÃ CÓ VÉ</div>
      </div>
    </section>
  </div>
  <footer class="ledger">
    <div class="stat"><label>Tiền mặt</label><b class="cash-val">$0</b></div>
    <div class="stat"><label>Tổng tài sản</label><b class="net-val">$0</b></div>
    <div class="stat meter panic"><label>Hoảng loạn <span class="panic-txt"></span></label><div class="bar"><i class="nat"></i><i class="you"></i></div></div>
    <div class="stat meter susp"><label>Nghi ngờ <span class="susp-txt"></span></label><div class="bar"><i class="s"></i></div></div>
  </footer>
</div>
<div class="vignette"></div>
<div class="siren"></div>
<div class="overlay hidden"></div>`;
    this.scene = q('#scene');

    // Bảng thị trường
    const market = q('.market');
    market.innerHTML = `<div class="mrow mhead"><span>KHU</span><span>GIÁ / SUẤT</span><span>7 NGÀY</span><span>TÌNH TRẠNG</span><span></span></div>` +
      ZONES.map(z => `
      <div class="mrow" data-z="${z.id}" title="${esc(z.desc)}">
        <div class="mz"><b>${z.short}</b><small>${esc(z.name)}</small></div>
        <div class="mp"><span class="price"></span><span class="chg"></span></div>
        <canvas class="spark" width="96" height="30"></canvas>
        <div class="mi"><span class="own"></span><span class="sup"></span><span class="integ"></span></div>
        <div class="mb"><button class="tbtn buy" data-act="buy">MUA</button><button class="tbtn sell" data-act="sell">BÁN</button></div>
      </div>`).join('');

    market.addEventListener('click', e => {
      const btn = (e.target as HTMLElement).closest('button');
      const row = btn?.closest<HTMLElement>('.mrow');
      if (!btn || !row?.dataset.z) return;
      const res = btn.dataset.act === 'buy' ? this.game.buy(row.dataset.z) : this.game.sell(row.dataset.z);
      if (res.ok && res.cash) {
        audio.beep(res.cash < 0);
        audio.coin(res.cash > 0);
        fx.moneyBurst(btn, q('.cash-val'), res.cash);
        fx.floatText(btn, `${res.cash > 0 ? '+' : ''}${fmtMoney(res.cash)}`, res.cash > 0 ? 'good' : 'bad');
      } else if (!res.ok) { audio.error(); fx.toast(res.msg, 'bad'); }
    });

    q('.upgrade').addEventListener('click', e => {
      const res = this.game.upgradeBunker();
      if (res.ok) {
        audio.stamp();
        audio.coin(false);
        fx.floatText(e.currentTarget as Element, res.msg, 'good');
        fx.moneyBurst(e.currentTarget as Element, q('.cash-val'), res.cash ?? 0);
      } else { audio.error(); fx.toast(res.msg, 'bad'); }
    });
    q('.vip-buy').addEventListener('click', e => {
      const res = this.game.buyVip();
      if (res.ok) {
        audio.triumph();
        setTimeout(() => audio.stamp(), 380);
        fx.flash('#ffd27a', 700);
        fx.moneyBurst(e.currentTarget as Element, q('.cash-val'), res.cash ?? 0);
        fx.toast(res.msg, 'good');
      } else { audio.error(); fx.toast(res.msg, 'bad'); }
    });
    q('.help-btn').addEventListener('click', () => { audio.click(); this.showHelp(); });

    const mute = q('.mute-btn');
    const paintMute = () => {
      mute.textContent = audio.muted ? '🔇' : '🔊';
      mute.classList.toggle('off', audio.muted);
    };
    paintMute();
    mute.addEventListener('click', () => { audio.unlock(); audio.setMuted(!audio.muted); paintMute(); audio.click(); });
    // Trình duyệt chỉ cho phát âm thanh sau thao tác đầu tiên của người chơi
    document.addEventListener('pointerdown', () => audio.unlock());
    document.addEventListener('keydown', () => audio.unlock());

    q('.center').addEventListener('click', e => this.onCenterClick(e));
  }

  // ================= Vẽ lại =================
  render() {
    const g = this.game;
    const s = g.s;
    this.renderAtmosphere();
    this.renderWall();
    this.renderMarket();
    this.renderCenter();
    this.renderSide();
    this.renderLedger();

    if (s.phase === 'morning' && this.shownMorningDay !== s.day && !this.busy) {
      this.shownMorningDay = s.day;
      void this.showMorning();
    }
    if (s.phase === 'ended' && !this.endingShown) {
      this.endingShown = true;
      void this.showEnding();
    }
  }

  private renderAtmosphere() {
    const g = this.game;
    const p = g.panic / 100;
    const r = document.documentElement.style;
    r.setProperty('--panic', p.toFixed(3));
    r.setProperty('--susp', (g.s.suspicion / 100).toFixed(3));
    r.setProperty('--doom', ((g.s.day - 1) / (B.days - 1)).toFixed(3));
    this.scene.classList.toggle('night', g.s.phase === 'night');
    this.scene.classList.toggle('tremor', g.panic >= 70);
    document.body.classList.toggle('alarm', g.s.suspicion >= 75);
    audio.setMood(g.panic, g.s.phase === 'night', g.s.suspicion >= 75 && g.s.phase !== 'ended');
  }

  private renderWall() {
    const s = this.game.s;
    const left = Math.max(0, this.game.daysLeft);
    if (this.calDay !== s.day) {
      const page = q('.cal-page');
      if (this.calDay !== -1) { page.classList.remove('flip'); void page.offsetWidth; page.classList.add('flip'); }
      this.calDay = s.day;
      setTimeout(() => { q('.cal-num').textContent = String(left); }, this.calDay === -1 ? 0 : 250);
      q('.cal-num').textContent = String(left);
    }
    const phaseTxt = { morning: '☀ SÁNG', office: '◐ GIỜ LÀM VIỆC', night: '☾ ĐÊM', ended: '✕' }[s.phase];
    q('.phase-label').textContent = `NGÀY ${s.day}/${B.days} · ${phaseTxt}`;
    q('.crt-day').textContent = `D-${left}`;

    // Thiên thạch to dần
    const k = (s.day - 1) / (B.days - 1);
    const m = q('.meteor');
    m.style.setProperty('--size', `${8 + Math.pow(k, 1.8) * 120}px`);
    m.style.left = `${78 - k * 28}%`;
    m.style.top = `${18 + k * 14}%`;

    if (this.cityDay !== s.day) {
      this.cityDay = s.day;
      this.drawCity(k);
    }
  }

  private drawCity(doom: number) {
    let x = 0;
    let svg = '';
    let seed = 7;
    const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    while (x < 1000) {
      const w = 30 + rnd() * 60;
      const h = 40 + rnd() * 110;
      svg += `<rect x="${x.toFixed(0)}" y="${(160 - h).toFixed(0)}" width="${(w - 3).toFixed(0)}" height="${h.toFixed(0)}" class="bld"/>`;
      for (let wy = 160 - h + 8; wy < 152; wy += 11) {
        for (let wx = x + 5; wx < x + w - 10; wx += 9) {
          const r = rnd();
          if (r < 0.32 * (1 - doom * 0.85) || (r > 0.985)) svg += `<rect x="${wx.toFixed(0)}" y="${wy.toFixed(0)}" width="4" height="5" class="win ${r > 0.985 ? 'red' : ''}"/>`;
        }
      }
      x += w;
    }
    q('.city').innerHTML = svg;
  }

  private renderMarket() {
    const g = this.game;
    const s = g.s;
    const tradeable = s.phase === 'office' || s.phase === 'night';
    const knows = g.has('biet_su_that');
    for (const z of s.zones) {
      const row = q(`.mrow[data-z="${z.id}"]`);
      const priceEl = q('.price', row);
      priceEl.textContent = fmtMoney(z.price);
      const prev = this.prevPrices.get(z.id);
      if (prev !== undefined && prev !== z.price) {
        row.classList.remove('flash-up', 'flash-down');
        void row.offsetWidth;
        row.classList.add(z.price > prev ? 'flash-up' : 'flash-down');
      }
      this.prevPrices.set(z.id, z.price);
      const ref = z.history.length >= 2 ? z.history[z.history.length - 2] : z.history[0] ?? z.price;
      const chg = (z.price / ref - 1) * 100;
      const chgEl = q('.chg', row);
      chgEl.textContent = `${chg >= 0 ? '▲' : '▼'} ${Math.abs(chg).toFixed(1)}%`;
      chgEl.className = `chg ${chg >= 0 ? 'up' : 'down'}`;
      q('.own', row).innerHTML = z.owned ? `<b>Giữ ${z.owned}</b> · vốn ${fmtMoney(z.avgCost)}` : '<i>Chưa giữ</i>';
      q('.sup', row).textContent = `Rao bán: ${z.supplyLeft}`;
      const integ = q('.integ', row);
      integ.textContent = knows ? `Bền thật: ${z.integrity}%` : 'Bền thật: ??';
      integ.className = `integ ${knows ? (z.integrity >= 70 ? 'ok' : z.integrity >= 45 ? 'mid' : 'low') : ''}`;
      q<HTMLButtonElement>('.buy', row).disabled = !tradeable || z.supplyLeft <= 0 || s.cash < z.price;
      q<HTMLButtonElement>('.sell', row).disabled = !tradeable || z.owned <= 0;
      this.drawSpark(q<HTMLCanvasElement>('.spark', row), [...z.history.slice(-7), z.price]);
    }
    q('.crt-foot').textContent = tradeable
      ? `> Lạm phát chung ×${g.infl().toFixed(2)}  ·  Đang giữ ${g.totalOwned} suất`
      : '> SÀN ĐÓNG CỬA';
  }

  private drawSpark(c: HTMLCanvasElement, vals: number[]) {
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const W = c.width, H = c.height;
    ctx.clearRect(0, 0, W, H);
    if (vals.length < 2) return;
    const min = Math.min(...vals), max = Math.max(...vals);
    const span = max - min || 1;
    const up = vals[vals.length - 1] >= vals[vals.length - 2];
    const col = up ? '#7dffa8' : '#ff6b5e';
    ctx.strokeStyle = col;
    ctx.lineWidth = 1.6;
    ctx.shadowColor = col;
    ctx.shadowBlur = 6;
    ctx.beginPath();
    vals.forEach((v, i) => {
      const x = 3 + (i / (vals.length - 1)) * (W - 8);
      const y = H - 4 - ((v - min) / span) * (H - 8);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();
    const lx = W - 5, ly = H - 4 - ((vals[vals.length - 1] - min) / span) * (H - 8);
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(lx, ly, 2.4, 0, Math.PI * 2); ctx.fill();
  }

  // ================= Khu giữa: khách / sổ đen =================
  private renderCenter() {
    const g = this.game;
    const s = g.s;
    const key = `${s.phase}|${s.day}|${s.visitorIndex}|${this.result ? 'r' : ''}`;
    const center = q('.center');
    if (key === this.centerKey) {
      if (s.phase === 'office' && !this.result) this.renderChoices();
      if (s.phase === 'night') center.innerHTML = this.blackbookHTML();
      return;
    }
    this.centerKey = key;

    if (s.phase === 'night') { center.innerHTML = this.blackbookHTML(); return; }
    if (s.phase !== 'office') { center.innerHTML = `<div class="empty-office"><p class="muted">Văn phòng chưa mở cửa...</p></div>`; return; }

    const v = g.currentVisitor;
    if (this.result) {
      const prev = g.s.visitorQueue[s.visitorIndex - 1];
      const pv = prev ? CUSTOMER(prev) : null;
      center.innerHTML = `
        <div class="stage">
          <div class="portrait-wrap leaving">${pv ? portraitSVG(pv.portrait) : ''}</div>
          <div class="dialog">
            <div class="who"><b>${pv ? esc(pv.name) : ''}</b><span>${pv ? esc(pv.role) : ''}</span></div>
            <p class="result-text"></p>
            <div class="choices"><button class="big-btn next" data-go="next" hidden>${v ? 'Mời khách tiếp theo →' : 'Tiễn khách'}</button></div>
          </div>
        </div>`;
      void fx.typewriter(q('.result-text', center), this.result.text, 18).then(() => {
        const b = center.querySelector<HTMLElement>('.next');
        if (b) b.hidden = false;
      });
      return;
    }
    if (!v) {
      center.innerHTML = `
        <div class="empty-office">
          <div class="empty-chair"></div>
          <p>Hành lang vắng tanh. Chỉ còn tiếng điều hòa rè rè.</p>
          <p class="muted">Bạn vẫn có thể giao dịch trên sàn. Khi trời tối, cuốn <b>Sổ Đen</b> sẽ mở ra.</p>
          <button class="big-btn" data-go="night">☾ Lên đèn — Bắt đầu đêm</button>
        </div>`;
      return;
    }
    const remaining = s.visitorQueue.length - s.visitorIndex;
    center.innerHTML = `
      <div class="stage">
        <div class="knock">Cốc cốc... <small>${remaining} khách đang chờ</small></div>
        <div class="portrait-wrap entering">${portraitSVG(v.portrait)}</div>
        <div class="dialog">
          <div class="who"><b>${esc(v.name)}</b><span>${esc(v.role)}</span></div>
          <div class="lines"></div>
          <div class="choices" hidden></div>
        </div>
      </div>`;
    const lines = q('.lines', center);
    const choices = q('.choices', center);
    const key2 = key;
    audio.knock();
    void (async () => {
      await fx.sleep(500);
      for (const line of v.lines) {
        if (this.centerKey !== key2) return;
        const p = document.createElement('p');
        lines.appendChild(p);
        await fx.typewriter(p, `“${line}”`, 20);
        await fx.sleep(180);
      }
      if (this.centerKey !== key2) return;
      choices.hidden = false;
      this.renderChoices();
    })();
  }

  private renderChoices() {
    const box = document.querySelector<HTMLElement>('.center .choices');
    const v = this.game.currentVisitor;
    if (!box || box.hidden || !v) return;
    box.innerHTML = v.choices.map((c: Choice, i) => {
      const can = this.game.canChoose(c);
      const chips = this.game.preview(c.effects).map(ch => `<span class="chip ${ch.tone}">${esc(ch.text)}</span>`).join('');
      return `<button class="choice" data-choice="${i}" ${can.ok ? '' : 'disabled'}>
        <span class="c-label">${esc(c.label)}</span>
        ${c.hint ? `<span class="c-hint">${esc(c.hint)}</span>` : ''}
        <span class="c-chips">${chips}${can.ok ? '' : `<span class="chip lock">🔒 ${esc(can.why ?? '')}</span>`}</span>
      </button>`;
    }).join('');
  }

  private blackbookHTML(): string {
    const g = this.game;
    const s = g.s;
    const left = B.rumorsPerNight - s.rumorsUsed;
    const zoneChips = ZONES.map(z => `<button class="zchip ${z.id === this.targetZone ? 'on' : ''}" data-target="${z.id}">${z.short}</button>`).join('');
    const items = RUMORS.map(r => {
      const cost = g.rumorCost(r);
      const susp = r.suspicion ? Math.round(r.suspicion * (r.suspicion > 0 && g.has('co_bot') ? 0.6 : 1)) : 0;
      const dis = left <= 0 || s.cash < cost;
      const tgt = r.target === 'zone' ? `<span class="tgt">→ ${zoneDef(this.targetZone).short}</span>` : '';
      return `<button class="rumor" data-rumor="${r.id}" ${dis ? 'disabled' : ''}>
        <span class="r-top"><b>${esc(r.name)}</b>${tgt}</span>
        <small>${esc(r.desc)}</small>
        <span class="r-foot"><span class="cost">${fmtMoney(cost)}</span>
          ${susp ? `<span class="chip ${susp > 0 ? 'bad' : 'good'}">Nghi ngờ ${susp > 0 ? '+' : ''}${susp}</span>` : ''}
          ${r.panic ? `<span class="chip bad">Hoảng loạn +${Math.round(r.panic * (g.has('cartel') ? 1.5 : 1))}</span>` : ''}</span>
      </button>`;
    }).join('');
    return `
      <div class="blackbook">
        <div class="bb-head"><h3>SỔ ĐEN</h3><span class="bb-left">Còn <b>${left}</b>/${B.rumorsPerNight} lệnh đêm nay</span></div>
        <div class="bb-target"><span>Khu mục tiêu:</span>${zoneChips}</div>
        <div class="bb-list">${items}</div>
        <div class="bb-foot">
          <small class="muted">Tin đồn sẽ lên báo sáng mai. Giá phản ứng ngay lập tức.</small>
          <button class="big-btn" data-go="sleep">Đi ngủ →</button>
        </div>
      </div>`;
  }

  private onCenterClick(e: Event) {
    const t = e.target as HTMLElement;
    const g = this.game;
    const choice = t.closest<HTMLElement>('[data-choice]');
    if (choice && !(choice as HTMLButtonElement).disabled) {
      const res = g.choose(Number(choice.dataset.choice));
      if (res.ok) {
        audio.click();
        if (res.cash) { audio.coin(res.cash > 0); fx.moneyBurst(choice, q('.cash-val'), res.cash); }
        this.result = { text: res.result };
        this.centerKey = '';
        this.render();
      }
      return;
    }
    const go = t.closest<HTMLElement>('[data-go]')?.dataset.go;
    if (go === 'next') { audio.click(); this.result = null; this.centerKey = ''; this.render(); return; }
    if (go === 'night') { audio.click(); g.goNight(); return; }
    if (go === 'sleep') { audio.click(); void this.goSleep(); return; }
    const tgt = t.closest<HTMLElement>('[data-target]')?.dataset.target;
    if (tgt) { audio.beep(true); this.targetZone = tgt; this.render(); return; }
    const rumor = t.closest<HTMLButtonElement>('[data-rumor]');
    if (rumor && !rumor.disabled) {
      const res = g.useRumor(rumor.dataset.rumor!, this.targetZone);
      if (res.ok) {
        audio.rumor();
        fx.shake(this.scene, 1.2);
        fx.toast(`Đã ra lệnh: ${res.msg}`, 'neutral');
      } else { audio.error(); fx.toast(res.msg, 'bad'); }
    }
  }

  private async goSleep() {
    if (this.busy) return;
    this.busy = true;
    const ov = q('.overlay');
    ov.className = 'overlay fade-black';
    ov.innerHTML = '';
    await fx.sleep(700);
    this.game.sleep();
    this.busy = false;
    if (this.game.s.phase === 'morning') {
      this.shownMorningDay = this.game.s.day;
      await this.showMorning();
    }
  }

  // ================= Cột phải =================
  private renderSide() {
    const g = this.game;
    const s = g.s;
    const main = s.news[0];
    q('.paper-mini').innerHTML = main
      ? `<div class="pm-name">TIN NHANH TẬN THẾ · số ${s.day}</div><div class="pm-head">${esc(main.headline)}</div>${s.news.length > 1 ? `<div class="pm-more">+${s.news.length - 1} tin khác</div>` : ''}`
      : '';

    // Hầm riêng
    q('.bunker-val').textContent = pct(s.bunker);
    const ring = q<SVGCircleElement>('.ring-fg');
    const C = 2 * Math.PI * 27;
    ring.style.strokeDasharray = `${C}`;
    ring.style.strokeDashoffset = `${C * (1 - s.bunker / 100)}`;
    const up = q<HTMLButtonElement>('.upgrade');
    const capped = s.bunker >= B.bunkerMoneyCap;
    up.textContent = capped ? `Đã tới giới hạn ${B.bunkerMoneyCap}% — cần kỹ sư` : `Gia cố +${B.bunkerUpgradeGain}% · ${fmtMoney(g.bunkerUpgradeCost)}`;
    up.disabled = capped || s.cash < g.bunkerUpgradeCost || s.phase === 'morning' || s.phase === 'ended';
    const owned = s.zones.filter(z => z.owned > 0);
    let survive: string;
    if (s.vip) survive = 'Sống sót: 100% (có vé VIP)';
    else if (g.has('biet_su_that') && owned.length) survive = `Sống sót ước tính: ${pct(Math.max(s.bunker, ...owned.map(z => z.integrity)))}`;
    else if (owned.length) survive = `Sống sót: ≥ ${pct(s.bunker)} (độ bền các khu: ??)`;
    else survive = `Sống sót ước tính: ${pct(s.bunker)}`;
    q('.survive').textContent = survive;

    // VIP
    const price = g.vipPrice();
    const extra = price - g.vipNatural;
    q('.vip-price').textContent = s.vip ? fmtMoney(s.vipPaid) : fmtMoney(price);
    q('.vip-cause').innerHTML = extra > 0
      ? `<span class="you">Do chính bạn: +${fmtMoney(extra)} (+${Math.round((extra / g.vipNatural) * 100)}%)</span>`
      : `<span class="muted">Giá bị đẩy lên bởi hoảng loạn toàn cầu</span>`;
    const vb = q<HTMLButtonElement>('.vip-buy');
    vb.textContent = s.vip ? 'Bạn đã có chỗ' : s.cash >= price ? 'MUA VÉ NGAY' : `Thiếu ${fmtMoney(price - s.cash)}`;
    vb.disabled = s.vip || s.cash < price || s.phase === 'morning' || s.phase === 'ended';
    vb.classList.toggle('ready', !vb.disabled);
    q('.vip-card').classList.toggle('owned', s.vip);
    this.drawVipSpark(q<HTMLCanvasElement>('.vip-spark'), [...s.vipHistory.slice(0, -1), price]);
  }

  private drawVipSpark(c: HTMLCanvasElement, vals: number[]) {
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const W = c.width, H = c.height;
    ctx.clearRect(0, 0, W, H);
    if (vals.length < 2) return;
    const max = Math.max(...vals) * 1.05;
    const grd = ctx.createLinearGradient(0, 0, 0, H);
    grd.addColorStop(0, 'rgba(255,179,71,.45)');
    grd.addColorStop(1, 'rgba(255,179,71,0)');
    ctx.beginPath();
    vals.forEach((v, i) => {
      const x = (i / (vals.length - 1)) * W;
      const y = H - (v / max) * (H - 2);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = '#ffb347';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath();
    ctx.fillStyle = grd;
    ctx.fill();
  }

  private renderLedger() {
    const g = this.game;
    const s = g.s;
    fx.tweenNumber(q('.cash-val'), s.cash, fmtMoney);
    fx.tweenNumber(q('.net-val'), g.netWorth, fmtMoney);
    const nat = Math.min(100, g.panicNaturalClamped);
    const total = g.panic;
    const you = Math.max(0, total - nat);
    q('.panic .nat').style.width = `${Math.min(nat, total)}%`;
    q('.panic .you').style.width = `${you}%`;
    q('.panic-txt').innerHTML = `${Math.round(total)}% ${you > 0 ? `<em>· bạn gây ra ${Math.round(you)}</em>` : ''}`;
    q('.susp .s').style.width = `${s.suspicion}%`;
    q('.susp-txt').textContent = `${Math.round(s.suspicion)}%${s.suspicion >= 75 ? ' · NGUY HIỂM' : ''}`;
    q('.susp').classList.toggle('danger', s.suspicion >= 75);
  }

  // ================= Màn phủ =================
  private async showMorning() {
    const g = this.game;
    const s = g.s;
    this.busy = true;
    const ov = q('.overlay');
    ov.className = 'overlay fade-black';
    ov.innerHTML = `<div class="daycard"><div class="dc-num">NGÀY ${s.day}</div><div class="dc-sub">CÒN ${g.daysLeft} NGÀY</div></div>`;
    audio.gong();
    const day = s.day;
    await fx.sleep(1500);
    if (this.game !== g || g.s.phase !== 'morning' || g.s.day !== day) {
      // Ván/ngày đã thay đổi trong lúc chờ — bỏ qua báo sáng cũ
      if (this.game !== g || g.s.phase !== 'morning') { ov.className = 'overlay hidden'; ov.innerHTML = ''; this.busy = false; }
      return;
    }
    const [main, ...rest] = s.news;
    const movers = [...s.zones]
      .map(z => ({ z, c: z.history.length >= 2 ? z.price / z.history[z.history.length - 2] - 1 : 0 }))
      .sort((a, b) => Math.abs(b.c) - Math.abs(a.c))
      .slice(0, 3);
    ov.className = 'overlay dim';
    ov.innerHTML = `
      <article class="newspaper">
        <header>
          <div class="np-rule"></div>
          <div class="np-name">TIN NHANH TẬN THẾ</div>
          <div class="np-meta"><span>Số ${s.day}</span><span>Còn ${g.daysLeft} ngày</span><span>Vé VIP: ${fmtMoney(g.vipPrice())}</span></div>
        </header>
        <h1 class="${main?.kind === 'rumor' ? 'rumor' : ''}">${esc(main?.headline ?? '')}</h1>
        <p class="lead">${esc(main?.body ?? '')}</p>
        <div class="np-cols">
          ${rest.map(n => `<div class="np-item"><h4>${esc(n.headline)}</h4><p>${esc(n.body)}</p></div>`).join('')}
          <div class="np-item np-market"><h4>Thị trường trú ẩn</h4>
            ${movers.map(m => `<div class="np-mv"><span>${zoneDef(m.z.id).short}</span><span class="${m.c >= 0 ? 'up' : 'down'}">${m.c >= 0 ? '▲' : '▼'} ${Math.abs(m.c * 100).toFixed(1)}%</span></div>`).join('')}
          </div>
        </div>
        <button class="big-btn np-go">Vào văn phòng →</button>
      </article>`;
    audio.paper();
    if (g.panic >= 60) fx.shake(q('.newspaper', ov), 1.5, 600);
    q('.np-go', ov).addEventListener('click', () => {
      audio.click();
      ov.className = 'overlay hidden';
      ov.innerHTML = '';
      this.busy = false;
      g.goOffice();
    }, { once: true });
  }

  private async showEnding() {
    const g = this.game;
    const e = g.s.ending!;
    const ov = q('.overlay');
    this.busy = true;
    if (e.kind === 'arrested') {
      document.body.classList.add('alarm', 'arrest');
      audio.setSiren('police');
      audio.arrest();
      await fx.sleep(1600);
      document.body.classList.remove('arrest');
    } else {
      ov.className = 'overlay impact';
      ov.innerHTML = `<div class="impact-meteor"></div>`;
      audio.impact();
      await fx.sleep(1800);
      fx.flash('#fff', 1600);
      fx.shake(document.body, 4, 1400);
      await fx.sleep(1400);
    }
    const tone = e.kind === 'died' || e.kind === 'arrested' ? 'bad' : 'good';
    audio.setSiren('off');
    audio.ending(tone === 'good');
    ov.className = `overlay ending ${tone}`;
    ov.innerHTML = `
      <div class="end-card">
        <div class="end-kicker">NGÀY ${g.s.day} · KẾT THÚC</div>
        <h1>${esc(e.title)}</h1>
        <p class="end-text">${esc(e.text)}</p>
        ${e.chance !== undefined ? `<div class="end-chance">Xác suất sống sót của bạn: <b>${Math.round(e.chance)}%</b></div>` : ''}
        <ul class="epilogue">${e.epilogue.map((l, i) => `<li style="animation-delay:${1.2 + i * 0.7}s">${esc(l)}</li>`).join('')}</ul>
        <button class="big-btn restart" style="animation-delay:${1.6 + e.epilogue.length * 0.7}s">Chơi lại từ đầu</button>
      </div>`;
    q('.restart', ov).addEventListener('click', () => {
      document.body.classList.remove('alarm');
      ov.className = 'overlay hidden';
      this.busy = false;
      this.onRestart();
    }, { once: true });
  }

  showIntro(hasSave: boolean, onNew: () => void, onContinue: () => void) {
    const ov = q('.overlay');
    this.busy = true;
    ov.className = 'overlay intro';
    ov.innerHTML = `
      <div class="intro-card">
        <div class="intro-meteor"></div>
        <div class="intro-kicker">MỘT GAME KINH DOANH VỀ LÒNG THAM</div>
        <h1>30 NGÀY CUỐI</h1>
        <p>Thiên thạch sẽ rơi xuống trong 30 ngày. Bạn là một môi giới hầm trú ẩn.</p>
        <p>Mua rẻ. Bán đắt. Tung tin đồn. Và hy vọng rằng đến ngày cuối, bạn vẫn còn đủ tiền để mua cho <b>chính mình</b> một chỗ.</p>
        <div class="intro-btns">
          ${hasSave ? '<button class="big-btn cont">Chơi tiếp</button>' : ''}
          <button class="big-btn ${hasSave ? 'ghost' : ''} newg">Ván mới</button>
          <button class="big-btn ghost how">Cách chơi</button>
        </div>
      </div>`;
    const close = () => { ov.className = 'overlay hidden'; ov.innerHTML = ''; this.busy = false; };
    q('.newg', ov).addEventListener('click', () => { close(); onNew(); });
    ov.querySelector('.cont')?.addEventListener('click', () => { close(); onContinue(); });
    q('.how', ov).addEventListener('click', () => this.showHelp(() => this.showIntro(hasSave, onNew, onContinue)));
  }

  showHelp(back?: () => void) {
    const ov = q('.overlay');
    const prevClass = ov.className;
    const prevHTML = ov.innerHTML;
    ov.className = 'overlay dim';
    ov.innerHTML = `
      <div class="help-card">
        <h2>Cách chơi</h2>
        <ol>
          <li><b>Sáng:</b> Đọc báo. Tin tức (và tin đồn của bạn) làm giá các khu hầm thay đổi.</li>
          <li><b>Ban ngày:</b> Mua bán suất trú ẩn trên màn hình bên trái. Tiếp từng vị khách — mỗi lựa chọn đều có cái giá.</li>
          <li><b>Ban đêm:</b> Mở <b>Sổ Đen</b>: tung tin "nứt kết cấu" để ép giá, rồi "đính chính" để thổi giá. Mỗi lệnh làm tăng <b>Nghi ngờ</b>.</li>
          <li><b>Nghi ngờ 100%</b> = bị bắt. Thua.</li>
          <li><b>Hoảng loạn</b> làm mọi thứ đắt lên — kể cả <b>vé VIP</b> của bạn. Phần màu đỏ là do chính bạn gây ra.</li>
          <li><b>Ngày 30:</b> Có vé VIP = chắc chắn sống. Không có thì số phận phụ thuộc vào độ bền hầm riêng hoặc khu hầm bạn đang giữ suất.</li>
        </ol>
        <button class="big-btn close-help">Đã hiểu</button>
      </div>`;
    q('.close-help', ov).addEventListener('click', () => {
      if (back) { back(); return; }
      ov.className = prevClass;
      ov.innerHTML = prevHTML;
      // khôi phục nút báo sáng nếu đang mở
      ov.querySelector('.np-go')?.addEventListener('click', () => {
        ov.className = 'overlay hidden'; ov.innerHTML = ''; this.busy = false; this.game.goOffice();
      }, { once: true });
    }, { once: true });
  }

  // ================= Không khí =================
  private startAmbient() {
    const stars = q('.stars');
    let html = '';
    for (let i = 0; i < 70; i++) {
      html += `<i style="left:${Math.random() * 100}%;top:${Math.random() * 75}%;animation-delay:${(Math.random() * 4).toFixed(2)}s;opacity:${(0.3 + Math.random() * 0.7).toFixed(2)}"></i>`;
    }
    stars.innerHTML = html;
    // nhiễu sóng ngẫu nhiên khi hoảng loạn cao
    setInterval(() => {
      if (!this.game) return;
      const p = this.game.panic;
      if (p > 40 && Math.random() < (p - 30) / 90) {
        this.scene.classList.add('glitch');
        setTimeout(() => this.scene.classList.remove('glitch'), 140 + Math.random() * 160);
      }
    }, 1800);
  }
}

// tra cứu nhanh khách theo id
const CUSTOMER = (id: string) => CUSTOMERS.find(c => c.id === id) ?? null;
