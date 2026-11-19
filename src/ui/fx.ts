// Hiệu ứng hình ảnh dùng chung
import { audio } from './audio';

export const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

const tweens = new WeakMap<HTMLElement, number>();

/** Số chạy từ giá trị cũ sang giá trị mới */
export function tweenNumber(el: HTMLElement, to: number, fmt: (n: number) => string, dur = 600) {
  const from = Number(el.dataset.value ?? to);
  el.dataset.value = String(to);
  const prev = tweens.get(el);
  if (prev) cancelAnimationFrame(prev);
  if (from === to) { el.textContent = fmt(to); return; }
  el.classList.remove('tick-up', 'tick-down');
  void el.offsetWidth;
  el.classList.add(to > from ? 'tick-up' : 'tick-down');
  const t0 = performance.now();
  const step = (t: number) => {
    const k = Math.min(1, (t - t0) / dur);
    const e = 1 - Math.pow(1 - k, 3);
    el.textContent = fmt(from + (to - from) * e);
    if (k < 1) tweens.set(el, requestAnimationFrame(step));
  };
  tweens.set(el, requestAnimationFrame(step));
}

/** Gõ chữ từng ký tự. Bấm vào phần tử để hiện ngay. */
export function typewriter(el: HTMLElement, text: string, speed = 22): Promise<void> {
  return new Promise(resolve => {
    let i = 0;
    let done = false;
    el.textContent = '';
    el.classList.add('typing');
    const finish = () => {
      if (done) return;
      done = true;
      el.textContent = text;
      el.classList.remove('typing');
      el.removeEventListener('click', finish);
      resolve();
    };
    el.addEventListener('click', finish);
    const tick = () => {
      if (done) return;
      if (!el.isConnected) { finish(); return; }
      i += 1;
      el.textContent = text.slice(0, i);
      if (i % 2 === 0 && text[i - 1].trim()) audio.type();
      if (i >= text.length) finish();
      else setTimeout(tick, /[.,!?…]/.test(text[i - 1]) ? speed * 8 : speed);
    };
    tick();
  });
}

let fxLayer: HTMLElement;
let toastBox: HTMLElement;

export function initFx(root: HTMLElement) {
  fxLayer = document.createElement('div');
  fxLayer.className = 'fx-layer';
  toastBox = document.createElement('div');
  toastBox.className = 'toasts';
  root.append(fxLayer, toastBox);
}

/** Tiền bay từ nút bấm tới ô tiền mặt */
export function moneyBurst(from: Element | null, to: Element | null, amount: number) {
  if (!from || !to || !amount) return;
  const a = from.getBoundingClientRect();
  const b = to.getBoundingClientRect();
  const gain = amount > 0;
  const n = Math.min(14, 4 + Math.floor(Math.log10(Math.abs(amount) + 1)));
  for (let i = 0; i < n; i++) {
    const p = document.createElement('span');
    p.className = `coin ${gain ? 'gain' : 'loss'}`;
    p.textContent = '$';
    const sx = (gain ? a.left + a.width / 2 : b.left + b.width / 2) + (Math.random() - 0.5) * 30;
    const sy = (gain ? a.top + a.height / 2 : b.top + b.height / 2) + (Math.random() - 0.5) * 20;
    const ex = (gain ? b.left + b.width / 2 : a.left + a.width / 2) + (Math.random() - 0.5) * 20;
    const ey = (gain ? b.top + b.height / 2 : a.top + a.height / 2);
    p.style.left = `${sx}px`;
    p.style.top = `${sy}px`;
    fxLayer.appendChild(p);
    const midX = (sx + ex) / 2 + (Math.random() - 0.5) * 160;
    const midY = Math.min(sy, ey) - 60 - Math.random() * 80;
    p.animate(
      [
        { transform: 'translate(0,0) scale(.6)', opacity: 0 },
        { transform: `translate(${midX - sx}px, ${midY - sy}px) scale(1.2)`, opacity: 1, offset: 0.45 },
        { transform: `translate(${ex - sx}px, ${ey - sy}px) scale(.5)`, opacity: 0.2 },
      ],
      { duration: 700 + Math.random() * 300, delay: i * 35, easing: 'cubic-bezier(.3,.6,.4,1)', fill: 'forwards' },
    ).onfinish = () => p.remove();
  }
}

/** Chữ nổi lên tại một vị trí */
export function floatText(at: Element | null, text: string, tone: 'good' | 'bad' | 'neutral' = 'neutral') {
  if (!at) return;
  const r = at.getBoundingClientRect();
  const el = document.createElement('div');
  el.className = `float-text ${tone}`;
  el.textContent = text;
  el.style.left = `${r.left + r.width / 2}px`;
  el.style.top = `${r.top}px`;
  fxLayer.appendChild(el);
  el.animate(
    [{ transform: 'translate(-50%, 0)', opacity: 1 }, { transform: 'translate(-50%, -48px)', opacity: 0 }],
    { duration: 1100, easing: 'ease-out', fill: 'forwards' },
  ).onfinish = () => el.remove();
}

export function toast(msg: string, tone: 'good' | 'bad' | 'neutral' = 'neutral') {
  const el = document.createElement('div');
  el.className = `toast ${tone}`;
  el.textContent = msg;
  toastBox.appendChild(el);
  setTimeout(() => el.classList.add('out'), 2200);
  setTimeout(() => el.remove(), 2700);
}

export function shake(el: HTMLElement, strength = 1, dur = 450) {
  const frames: Keyframe[] = [];
  for (let i = 0; i < 8; i++) {
    const s = strength * (1 - i / 8) * 8;
    frames.push({ transform: `translate(${(Math.random() - 0.5) * s}px, ${(Math.random() - 0.5) * s}px)` });
  }
  frames.push({ transform: 'translate(0,0)' });
  el.animate(frames, { duration: dur, easing: 'linear' });
}

export function flash(color = '#fff', dur = 600) {
  const el = document.createElement('div');
  el.className = 'flash';
  el.style.background = color;
  fxLayer.appendChild(el);
  el.animate([{ opacity: 0.95 }, { opacity: 0 }], { duration: dur, easing: 'ease-out', fill: 'forwards' }).onfinish = () => el.remove();
}
