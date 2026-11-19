import type { Portrait } from '../game/types';

let uid = 0;

/** Vẽ chân dung dạng bóng đen ngược sáng. Có thể thay bằng ảnh qua portrait.image */
export function portraitSVG(p: Portrait): string {
  if (p.image) return `<img class="portrait-img" src="${p.image}" alt="" />`;
  const id = `pg${uid++}`;
  const w = p.build === 'broad' ? 1.18 : p.build === 'small' ? 0.86 : 1;
  const sx = 100 - 74 * w;
  const ex = 100 + 74 * w;
  const headR = p.build === 'small' ? 30 : 33;
  const dark = '#0c0a09';

  let behind = '';
  let hat = '';
  switch (p.hat) {
    case 'fedora':
      hat = `<path d="M64 70 Q66 36 100 33 Q134 36 136 70 Z" fill="url(#${id})"/>
             <ellipse cx="100" cy="70" rx="60" ry="9" fill="url(#${id})"/>
             <rect x="66" y="58" width="68" height="7" fill="${p.color}" opacity=".55"/>`;
      break;
    case 'cap':
      hat = `<path d="M67 80 Q68 50 100 48 Q132 50 133 80 Z" fill="url(#${id})"/>
             <ellipse cx="124" cy="80" rx="30" ry="6" fill="url(#${id})"/>`;
      break;
    case 'beret':
      hat = `<ellipse cx="94" cy="66" rx="42" ry="15" fill="url(#${id})"/><circle cx="96" cy="51" r="4" fill="${dark}"/>`;
      break;
    case 'helmet':
      hat = `<path d="M63 84 Q63 44 100 42 Q137 44 137 84 Z" fill="#8a6d1e"/>
             <rect x="56" y="80" width="88" height="8" rx="4" fill="#6e5615"/>
             <path d="M96 44 L104 44 L104 82 L96 82 Z" fill="#a8862a" opacity=".6"/>`;
      break;
    case 'bun':
      hat = `<circle cx="100" cy="52" r="15" fill="url(#${id})"/>`;
      break;
    case 'hood':
      behind = `<path d="M54 150 Q48 58 100 50 Q152 58 146 150 Z" fill="url(#${id})"/>`;
      break;
  }
  const glasses = p.glasses
    ? `<g stroke="#ffcf8a" stroke-width="2" fill="rgba(255,207,138,.18)" opacity=".85">
         <circle cx="88" cy="98" r="9"/><circle cx="114" cy="98" r="9"/><path d="M97 98 L105 98" />
       </g>`
    : `<g fill="#ffcf8a" opacity=".55"><circle cx="89" cy="99" r="2"/><circle cx="113" cy="99" r="2"/></g>`;

  return `
<svg class="portrait-svg" viewBox="0 0 200 220" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <defs>
    <linearGradient id="${id}" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="${p.color}"/>
      <stop offset=".45" stop-color="${dark}"/>
      <stop offset="1" stop-color="${dark}"/>
    </linearGradient>
  </defs>
  ${behind}
  <path d="M${sx} 222 Q${sx + 4} 150 100 142 Q${ex - 4} 150 ${ex} 222 Z" fill="url(#${id})"/>
  <rect x="88" y="120" width="24" height="30" fill="${dark}"/>
  <ellipse cx="100" cy="98" rx="${headR}" ry="${headR + 6}" fill="url(#${id})"/>
  ${hat}
  ${glasses}
</svg>`;
}
