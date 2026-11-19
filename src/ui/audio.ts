// Âm thanh tổng hợp bằng Web Audio — không cần file âm thanh.
// Muốn thay bằng file thật sau này: giữ nguyên tên hàm, đổi phần thân sang phát AudioBuffer.

const PREF_KEY = 'ngay-cuoi-muted';

class AudioEngine {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfxBus!: GainNode;
  private ambBus!: GainNode;
  private noise!: AudioBuffer;
  muted = false;

  // nền
  private droneFilter?: BiquadFilterNode;
  private droneOscs: OscillatorNode[] = [];
  private windGain?: GainNode;
  private sirenGain?: GainNode;
  private sirenLfo?: OscillatorNode;
  private heartTimer = 0;
  private panic = 0;
  private sirenMode: 'off' | 'alarm' | 'police' = 'off';

  constructor() {
    try { this.muted = localStorage.getItem(PREF_KEY) === '1'; } catch { /* bỏ qua */ }
  }

  /** Phải gọi trong một thao tác của người dùng (click) — trình duyệt chặn tự phát âm thanh */
  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') void this.ctx.resume(); return; }
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.9;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    this.master.connect(comp).connect(ctx.destination);
    this.sfxBus = ctx.createGain();
    this.sfxBus.gain.value = 0.8;
    this.sfxBus.connect(this.master);
    this.ambBus = ctx.createGain();
    this.ambBus.gain.value = 0;
    this.ambBus.connect(this.master);
    this.ambBus.gain.linearRampToValueAtTime(1, ctx.currentTime + 3);

    // bộ đệm tiếng ồn trắng dùng chung
    this.noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;

    this.startAmbient();
    this.scheduleHeart();
  }

  setMuted(m: boolean) {
    this.muted = m;
    try { localStorage.setItem(PREF_KEY, m ? '1' : '0'); } catch { /* bỏ qua */ }
    if (this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.9, this.ctx.currentTime, 0.05);
  }

  // ---------- tiện ích ----------
  private get t() { return this.ctx!.currentTime; }

  private env(g: GainNode, at: number, peak: number, attack: number, decay: number) {
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(peak, at + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, at + attack + decay);
  }

  private tone(freq: number, type: OscillatorType, peak: number, decay: number, at = 0, attack = 0.005, slideTo?: number, dest?: AudioNode) {
    if (!this.ctx) return;
    const t0 = this.t + at;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + attack + decay);
    this.env(g, t0, peak, attack, decay);
    o.connect(g).connect(dest ?? this.sfxBus);
    o.start(t0);
    o.stop(t0 + attack + decay + 0.05);
  }

  private burst(peak: number, decay: number, filterType: BiquadFilterType, freq: number, q = 1, at = 0, attack = 0.002, freqTo?: number) {
    if (!this.ctx) return;
    const t0 = this.t + at;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const f = this.ctx.createBiquadFilter();
    f.type = filterType;
    f.frequency.setValueAtTime(freq, t0);
    if (freqTo) f.frequency.exponentialRampToValueAtTime(freqTo, t0 + attack + decay);
    f.Q.value = q;
    const g = this.ctx.createGain();
    this.env(g, t0, peak, attack, decay);
    src.connect(f).connect(g).connect(this.sfxBus);
    src.start(t0, Math.random());
    src.stop(t0 + attack + decay + 0.05);
  }

  // ---------- hiệu ứng ----------
  /** Phím máy đánh chữ */
  type() {
    if (!this.ctx || this.muted) return;
    this.burst(0.05 + Math.random() * 0.03, 0.025, 'bandpass', 2200 + Math.random() * 1600, 3);
    this.tone(180 + Math.random() * 60, 'square', 0.012, 0.02);
  }

  click() {
    this.burst(0.08, 0.03, 'highpass', 3000, 1);
  }

  /** Bíp trên màn hình CRT */
  beep(up = true) {
    this.tone(up ? 880 : 620, 'square', 0.05, 0.07);
    this.tone(up ? 1320 : 520, 'square', 0.04, 0.07, 0.07);
  }

  /** Tiền vào (ding két tiền) hoặc tiền ra */
  coin(gain: boolean) {
    if (gain) {
      this.tone(1568, 'triangle', 0.12, 0.25);
      this.tone(2349, 'triangle', 0.1, 0.4, 0.07);
      this.burst(0.05, 0.08, 'highpass', 6000, 1, 0.02);
    } else {
      this.tone(740, 'triangle', 0.08, 0.15, 0, 0.005, 520);
      this.burst(0.04, 0.06, 'bandpass', 2500, 2);
    }
  }

  error() {
    this.tone(196, 'square', 0.06, 0.09);
    this.tone(164, 'square', 0.06, 0.14, 0.11);
  }

  /** Tiếng gõ cửa */
  knock() {
    for (const at of [0, 0.18, 0.36]) {
      this.tone(140, 'sine', 0.35, 0.12, at, 0.002, 70);
      this.burst(0.12, 0.06, 'lowpass', 900, 1, at);
    }
  }

  /** Lật / ném tờ báo */
  paper() {
    this.burst(0.18, 0.5, 'bandpass', 500, 0.8, 0, 0.08, 3500);
    this.burst(0.2, 0.08, 'highpass', 1800, 0.7, 0.62);
  }

  /** Tiếng chuông trầm chuyển ngày */
  gong() {
    this.tone(55, 'sine', 0.35, 2.6, 0, 0.01);
    this.tone(110.5, 'sine', 0.15, 2.0, 0, 0.01);
    this.tone(164, 'sine', 0.06, 1.4, 0, 0.01);
    // tiếng tích tắc đồng hồ
    for (let i = 0; i < 4; i++) this.burst(0.06, 0.02, 'bandpass', i % 2 ? 2600 : 3200, 6, 0.4 + i * 0.32);
  }

  /** Lệnh tung tin đồn — tiếng điện thoại + hợp âm u ám */
  rumor() {
    for (let i = 0; i < 5; i++) this.burst(0.07, 0.015, 'bandpass', 1800, 4, i * 0.06);
    const chord = [73.4, 87.3, 103.8];
    chord.forEach(f => {
      this.tone(f, 'sawtooth', 0.05, 1.6, 0.35, 0.15);
      this.tone(f * 1.006, 'sawtooth', 0.04, 1.6, 0.35, 0.15);
    });
    this.tone(50, 'sine', 0.25, 1.2, 0.35, 0.05, 38);
  }

  /** Đóng dấu / mua vé VIP */
  triumph() {
    [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 'triangle', 0.1, 0.5, i * 0.09));
    this.tone(1047, 'sine', 0.06, 1.4, 0.36);
  }

  stamp() {
    this.tone(90, 'sine', 0.4, 0.15, 0, 0.002, 50);
    this.burst(0.2, 0.08, 'lowpass', 1200, 1);
  }

  /** Thiên thạch lao tới rồi va chạm */
  impact() {
    if (!this.ctx) return;
    // tiếng rít tăng dần 1.8s
    this.burst(0.25, 1.8, 'bandpass', 200, 2, 0, 1.6, 4000);
    this.tone(60, 'sawtooth', 0.12, 1.8, 0, 1.6, 240);
    // va chạm
    this.tone(48, 'sine', 0.9, 3.5, 1.8, 0.005, 25);
    this.burst(0.9, 4, 'lowpass', 2500, 0.7, 1.8, 0.005, 60);
    this.burst(0.3, 6, 'lowpass', 300, 1, 2.2, 0.5, 40);
  }

  /** Còi cảnh sát khi bị bắt */
  arrest() {
    for (let i = 0; i < 6; i++) {
      this.tone(i % 2 ? 960 : 720, 'square', 0.05, 0.22, i * 0.25, 0.01);
    }
    this.burst(0.5, 0.25, 'lowpass', 700, 1, 1.6);
    this.tone(70, 'sine', 0.4, 0.3, 1.6, 0.002, 40);
  }

  ending(good: boolean) {
    const notes = good ? [261.6, 329.6, 392, 523.3] : [220, 207.7, 174.6, 146.8];
    notes.forEach((f, i) => {
      this.tone(f, 'sine', 0.12, 2.5, 0.2 + i * 0.6, 0.3);
      this.tone(f / 2, 'triangle', 0.06, 2.5, 0.2 + i * 0.6, 0.3);
    });
  }

  // ---------- âm nền ----------
  private startAmbient() {
    const ctx = this.ctx!;
    // drone trầm
    this.droneFilter = ctx.createBiquadFilter();
    this.droneFilter.type = 'lowpass';
    this.droneFilter.frequency.value = 180;
    this.droneFilter.Q.value = 4;
    const dg = ctx.createGain();
    dg.gain.value = 0.05;
    this.droneFilter.connect(dg).connect(this.ambBus);
    for (const [f, type] of [[55, 'sawtooth'], [55.4, 'sawtooth'], [82.4, 'triangle']] as [number, OscillatorType][]) {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = f;
      o.connect(this.droneFilter);
      o.start();
      this.droneOscs.push(o);
    }
    // gió / tiếng ồn thành phố
    const wind = ctx.createBufferSource();
    wind.buffer = this.noise;
    wind.loop = true;
    const wf = ctx.createBiquadFilter();
    wf.type = 'lowpass';
    wf.frequency.value = 420;
    this.windGain = ctx.createGain();
    this.windGain.gain.value = 0.025;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 220;
    lfo.connect(lfoGain).connect(wf.frequency);
    lfo.start();
    wind.connect(wf).connect(this.windGain).connect(this.ambBus);
    wind.start();
    // còi báo động (tắt sẵn)
    const siren = ctx.createOscillator();
    siren.type = 'sine';
    siren.frequency.value = 700;
    this.sirenLfo = ctx.createOscillator();
    this.sirenLfo.frequency.value = 0.5;
    const sl = ctx.createGain();
    sl.gain.value = 180;
    this.sirenLfo.connect(sl).connect(siren.frequency);
    this.sirenGain = ctx.createGain();
    this.sirenGain.gain.value = 0;
    siren.connect(this.sirenGain).connect(this.ambBus);
    siren.start();
    this.sirenLfo.start();
  }

  /** Cập nhật âm nền theo không khí game */
  setMood(panic: number, night: boolean, alarm: boolean) {
    this.panic = panic;
    if (!this.ctx || !this.droneFilter) return;
    const t = this.t;
    this.droneFilter.frequency.setTargetAtTime(150 + panic * 5.5 + (night ? -40 : 0), t, 1.2);
    // hoảng loạn càng cao, các dao động càng lệch nhau → tiếng "rung" khó chịu
    this.droneOscs[1].frequency.setTargetAtTime(55.4 + panic * 0.04, t, 2);
    this.windGain!.gain.setTargetAtTime(night ? 0.045 : 0.025, t, 1.5);
    if (this.sirenMode !== 'police') this.setSiren(alarm ? 'alarm' : 'off');
  }

  setSiren(mode: 'off' | 'alarm' | 'police') {
    this.sirenMode = mode;
    if (!this.ctx || !this.sirenGain) return;
    const t = this.t;
    this.sirenGain.gain.setTargetAtTime(mode === 'off' ? 0 : mode === 'alarm' ? 0.012 : 0.05, t, 0.4);
    this.sirenLfo!.frequency.setTargetAtTime(mode === 'police' ? 2.2 : 0.5, t, 0.1);
  }

  /** Tiếng tim đập khi hoảng loạn trên 55% — nhanh dần theo hoảng loạn */
  private scheduleHeart() {
    clearTimeout(this.heartTimer);
    const p = this.panic;
    const interval = p > 55 ? 1100 - (p - 55) * 10 : 1500;
    this.heartTimer = window.setTimeout(() => {
      if (this.ctx && !this.muted && this.panic > 55) {
        const v = 0.12 + (this.panic - 55) / 300;
        this.tone(62, 'sine', v, 0.14, 0, 0.004, 40, this.ambBus);
        this.tone(58, 'sine', v * 0.7, 0.16, 0.2, 0.004, 38, this.ambBus);
      }
      this.scheduleHeart();
    }, interval);
  }
}

export const audio = new AudioEngine();
