// Công cụ nội dung cho "30 Ngày Cuối"
//   node scripts/content.mjs validate   → kiểm tra src/data/*.json
//   node scripts/content.mjs merge      → gộp new-content/*.json vào src/data/ (kiểm tra trước, không ghi nếu có lỗi)
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA = join(ROOT, 'src', 'data');
const NEW = join(ROOT, 'new-content');
const FILES = ['zones', 'customers', 'events', 'rumors'];

const EFFECT_KEYS = new Set(['cash', 'sellSlot', 'giveSlot', 'buySlot', 'panic', 'panicNatural', 'suspicion', 'bunker',
  'conscience', 'flag', 'removeFlag', 'schedule', 'zone', 'zoneSentiment', 'zoneIntegrity', 'sentimentAll', 'supplyMul']);
const RUMOR_KEYS = new Set(['id', 'name', 'desc', 'cost', 'target', 'sentimentMul', 'debunk', 'spill', 'dump', 'sentimentAll',
  'panic', 'suspicion', 'headline', 'body']);
const HATS = new Set(['none', 'fedora', 'cap', 'beret', 'helmet', 'bun', 'hood']);
const BUILDS = new Set(['slim', 'broad', 'small']);

function readJson(path) {
  try {
    const v = JSON.parse(readFileSync(path, 'utf8'));
    if (!Array.isArray(v)) throw new Error('phải là một mảng [ ... ]');
    return v;
  } catch (e) {
    throw new Error(`${path}: JSON lỗi — ${e.message}`);
  }
}

function validate(data) {
  const errors = [];
  const warns = [];
  const err = (where, msg) => errors.push(`✖ ${where}: ${msg}`);
  const warn = (where, msg) => warns.push(`! ${where}: ${msg}`);

  const zoneIds = new Set(data.zones.map(z => z.id));
  const custIds = new Set(data.customers.map(c => c.id));
  const eventIds = new Set(data.events.map(e => e.id));

  // id trùng
  for (const f of FILES) {
    const seen = new Set();
    for (const item of data[f]) {
      if (!item.id) err(f, `mục thiếu "id": ${JSON.stringify(item).slice(0, 60)}`);
      else if (seen.has(item.id)) err(f, `id trùng "${item.id}"`);
      seen.add(item.id);
    }
  }

  // cờ được đặt ở đâu đó
  const setFlags = new Set(['biet_su_that', 'co_bot', 'cartel', 'quan_che']);
  const collectFlags = e => { if (e?.flag) setFlags.add(e.flag); };
  data.customers.forEach(c => c.choices?.forEach(ch => collectFlags(ch.effects)));
  data.events.forEach(ev => collectFlags(ev.effects));

  const checkDay = (where, o) => {
    if (!Number.isInteger(o.minDay) || !Number.isInteger(o.maxDay)) err(where, 'minDay/maxDay phải là số nguyên');
    else if (o.minDay < 1 || o.maxDay > 30 || o.minDay > o.maxDay) err(where, `khoảng ngày ${o.minDay}–${o.maxDay} không hợp lệ (1–30)`);
  };

  const checkEffects = (where, e) => {
    if (!e || typeof e !== 'object') { err(where, 'thiếu "effects" (dùng {} nếu không có)'); return; }
    for (const k of Object.keys(e)) if (!EFFECT_KEYS.has(k)) err(where, `khoá hiệu ứng lạ "${k}"`);
    if (e.zone !== undefined && !zoneIds.has(e.zone)) err(where, `khu "${e.zone}" không tồn tại`);
    if ((e.zoneSentiment || e.zoneIntegrity || e.supplyMul !== undefined) && !e.zone) err(where, 'zoneSentiment/zoneIntegrity/supplyMul cần có "zone"');
    if (e.schedule) {
      const s = e.schedule;
      if (!['event', 'visitor'].includes(s.type)) err(where, 'schedule.type phải là "event" hoặc "visitor"');
      else if (s.type === 'event' && !eventIds.has(s.id)) err(where, `schedule tới sự kiện không tồn tại "${s.id}"`);
      else if (s.type === 'visitor' && !custIds.has(s.id)) err(where, `schedule tới khách không tồn tại "${s.id}"`);
      if (!Number.isInteger(s.inDays) || s.inDays < 0) err(where, 'schedule.inDays phải là số nguyên ≥ 0');
    }
    const range = (k, a, b) => { if (typeof e[k] === 'number' && (e[k] < a || e[k] > b)) warn(where, `${k}=${e[k]} ngoài khoảng gợi ý ${a}…${b}`); };
    range('cash', -80000, 50000); range('suspicion', -40, 20); range('panic', -20, 15); range('conscience', -4, 5);
    range('bunker', 0, 30); range('sellSlot', 0.3, 5); range('buySlot', 0.2, 2);
  };

  for (const z of data.zones) {
    const w = `zones/${z.id}`;
    for (const k of ['name', 'short', 'desc']) if (typeof z[k] !== 'string' || !z[k]) err(w, `thiếu "${k}"`);
    if (!(z.basePrice > 0)) err(w, 'basePrice phải > 0');
    if (!(z.integrity >= 0 && z.integrity <= 100)) err(w, 'integrity phải 0–100');
    if (!(z.supply >= 0)) err(w, 'supply phải ≥ 0');
  }
  if (data.zones.length > 7) warn('zones', `${data.zones.length} khu — giao diện thiết kế cho tối đa 7`);

  for (const c of data.customers) {
    const w = `customers/${c.id}`;
    for (const k of ['name', 'role']) if (typeof c[k] !== 'string' || !c[k]) err(w, `thiếu "${k}"`);
    checkDay(w, c);
    if (!c.portrait || !/^#[0-9a-fA-F]{6}$/.test(c.portrait.color ?? '')) err(w, 'portrait.color phải là mã hex dạng #rrggbb');
    if (c.portrait?.hat && !HATS.has(c.portrait.hat)) err(w, `portrait.hat "${c.portrait.hat}" không hợp lệ`);
    if (c.portrait?.build && !BUILDS.has(c.portrait.build)) err(w, `portrait.build "${c.portrait.build}" không hợp lệ`);
    if (!Array.isArray(c.lines) || !c.lines.length) err(w, 'cần ít nhất 1 câu trong "lines"');
    if (!Array.isArray(c.choices) || c.choices.length < 2 || c.choices.length > 4) err(w, 'cần 2–4 lựa chọn');
    if (c.requiresFlag && !setFlags.has(c.requiresFlag)) warn(w, `requiresFlag "${c.requiresFlag}" không được đặt ở đâu cả`);
    let hasFree = false;
    (c.choices ?? []).forEach((ch, i) => {
      const cw = `${w}#${i + 1}`;
      if (!ch.label) err(cw, 'thiếu "label"');
      if (!ch.result) err(cw, 'thiếu "result"');
      checkEffects(cw, ch.effects);
      const req = ch.requires ?? [];
      for (const r of req) {
        if (r !== 'slot' && !r.startsWith('flag:')) err(cw, `requires "${r}" không hợp lệ`);
        if (r.startsWith('flag:') && !setFlags.has(r.slice(5))) warn(cw, `requires cờ "${r.slice(5)}" không được đặt ở đâu cả`);
      }
      if ((ch.effects?.sellSlot || ch.effects?.giveSlot) && !req.includes('slot')) err(cw, 'sellSlot/giveSlot cần requires: ["slot"]');
      const costs = (ch.effects?.cash ?? 0) < 0 || ch.effects?.buySlot;
      if (!req.length && !costs) hasFree = true;
    });
    if (!hasFree) err(w, 'cần ít nhất 1 lựa chọn không yêu cầu gì và không tốn tiền');
    if (c.scripted) {
      const referenced = [...data.customers, ...data.events].some(o =>
        (o.choices ?? [{ effects: o.effects }]).some(ch => ch.effects?.schedule?.type === 'visitor' && ch.effects.schedule.id === c.id));
      if (!referenced && c.id !== 'thanh_tra') warn(w, 'khách scripted nhưng không có gì hẹn tới');
    }
  }

  for (const ev of data.events) {
    const w = `events/${ev.id}`;
    checkDay(w, ev);
    if (!ev.headline) err(w, 'thiếu "headline"');
    if (!ev.body) err(w, 'thiếu "body"');
    checkEffects(w, ev.effects);
    if (ev.scripted) {
      const referenced = [...data.customers, ...data.events].some(o =>
        (o.choices ?? [{ effects: o.effects }]).some(ch => ch.effects?.schedule?.type === 'event' && ch.effects.schedule.id === ev.id));
      if (!referenced) warn(w, 'sự kiện scripted nhưng không có gì hẹn tới');
    }
  }

  for (const r of data.rumors) {
    const w = `rumors/${r.id}`;
    for (const k of Object.keys(r)) if (!RUMOR_KEYS.has(k)) err(w, `khoá lạ "${k}"`);
    if (!r.name || !r.desc) err(w, 'thiếu "name" hoặc "desc"');
    if (!(r.cost > 0)) err(w, 'cost phải > 0');
    if (!['zone', 'none'].includes(r.target)) err(w, 'target phải là "zone" hoặc "none"');
    if (typeof r.headline !== 'string' || typeof r.body !== 'string') err(w, 'cần "headline" và "body" (dùng "" nếu không lên báo)');
  }

  return { errors, warns };
}

function loadData(extra = {}) {
  const data = {};
  for (const f of FILES) data[f] = [...readJson(join(DATA, `${f}.json`)), ...(extra[f] ?? [])];
  return data;
}

function report({ errors, warns }) {
  warns.forEach(w => console.log(w));
  errors.forEach(e => console.log(e));
  console.log(`\n${errors.length} lỗi, ${warns.length} cảnh báo.`);
}

const cmd = process.argv[2] ?? 'validate';
try {
  if (cmd === 'validate') {
    const data = loadData();
    const res = validate(data);
    report(res);
    console.log(`Tổng: ${data.zones.length} khu, ${data.customers.length} khách, ${data.events.length} sự kiện, ${data.rumors.length} lệnh.`);
    process.exit(res.errors.length ? 1 : 0);
  } else if (cmd === 'merge') {
    const extra = {};
    let found = 0;
    for (const f of FILES) {
      const p = join(NEW, `${f}.json`);
      if (existsSync(p)) { extra[f] = readJson(p); found += extra[f].length; console.log(`• ${f}.json: ${extra[f].length} mục mới`); }
    }
    if (!found) { console.log('Không tìm thấy nội dung mới trong thư mục new-content/'); process.exit(1); }
    const res = validate(loadData(extra));
    report(res);
    if (res.errors.length) { console.log('\nKHÔNG gộp vì còn lỗi. Sửa new-content/ rồi chạy lại.'); process.exit(1); }
    for (const f of FILES) {
      if (!extra[f]) continue;
      const merged = [...readJson(join(DATA, `${f}.json`)), ...extra[f]];
      writeFileSync(join(DATA, `${f}.json`), JSON.stringify(merged, null, 2) + '\n', 'utf8');
    }
    console.log('\n✔ Đã gộp vào src/data/. Có thể xoá các file trong new-content/.');
  } else {
    console.log('Dùng: node scripts/content.mjs validate | merge');
  }
} catch (e) {
  console.log(`✖ ${e.message}`);
  process.exit(1);
}
