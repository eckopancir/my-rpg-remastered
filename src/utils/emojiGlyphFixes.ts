/**
 * WA-Emoji глиф-фикс: подмена отдельных эмодзи-глифов собственными SVG.
 *
 * Основа — шрифтовый Twemoji (см. src/styles/global.css @font-face 'WA-Emoji').
 * Но у пака бывают неудобные рисунки (например 🩹 — «сарделька»-пластырь):
 * реестр EMOJI_FIX_REGISTRY перечисляет символы, которые при рендере в DOM
 * подменяются инлайн-SVG в том же плоском стиле. Строки в исходниках не трогаются.
 */

export type EmojiFix = { char: string; svg: string };

/* --- 🩹 аптечка/бинт: кейс с ручкой и белым крестом (плоский Twemoji-стиль) ---
   В наборе Twemoji/Mozilla COLR сам глиф 🩹 читается плохо («сарделька»),
   в игре этот символ означает аптечку — рисуем её как медкейс. */
const BANDAGE_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36">' +
  '<rect x="14.5" y="6" width="7" height="5" rx="1.4" fill="#99AAB5"/>' +
  '<rect x="4.5" y="9.5" width="27" height="19" rx="2.6" fill="#DD2E44"/>' +
  '<rect x="4.5" y="9.5" width="27" height="3.6" rx="2.6" fill="#F4ABBA"/>' +
  '<rect x="16.1" y="13.4" width="3.8" height="9.2" rx="0.7" fill="#FFFFFF"/>' +
  '<rect x="13.4" y="16.1" width="9.2" height="3.8" rx="0.7" fill="#FFFFFF"/>' +
  '</svg>';

/**
 * Реестр замен. Символы не должны пересекаться.
 */
export const EMOJI_FIX_REGISTRY: EmojiFix[] = [
  // 🩹 — в игре это аптечка (расходники, способности «Аптечка/Бинт»), а глиф
  // Twemoji читается плохо; рисуем красный медкейс с белым крестом.
  { char: '🩹', svg: BANDAGE_SVG },
];

const WRAP_ATTR = 'data-wa-egf';

/** кэш объединённого regex по всем символам реестра */
let combinedRe: RegExp | null = null;
function getRe(): RegExp | null {
  if (!combinedRe && EMOJI_FIX_REGISTRY.length > 0) {
    const pattern = EMOJI_FIX_REGISTRY.map((f) => regexEscape(f.char)).join('|');
    combinedRe = new RegExp(pattern, 'g');
  }
  return combinedRe;
}

function regexEscape(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function processTextNode(textNode: Text): void {
  const re = getRe();
  const text = textNode.nodeValue || '';
  if (!re || !text || textNode.parentElement?.hasAttribute(WRAP_ATTR)) return;

  re.lastIndex = 0;
  let m: RegExpExecArray | null;
  let last = 0;
  let frag: DocumentFragment | null = null;
  while ((m = re.exec(text)) !== null) {
    if (!frag) frag = document.createDocumentFragment();
    if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
    const fix = EMOJI_FIX_REGISTRY.find((f) => f.char === m![0])!;
    const span = document.createElement('span');
    span.setAttribute(WRAP_ATTR, '');
    span.style.cssText = 'display:inline-block;width:1em;height:1em;vertical-align:-0.125em;line-height:1;';
    span.innerHTML = fix.svg;
    frag.appendChild(span);
    last = m.index + m[0].length;
  }
  if (!frag) return;
  if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
  textNode.parentNode?.replaceChild(frag, textNode);
}

function sweepElement(root: Node): void {
  const re = getRe();
  if (!re) return;
  const probe = EMOJI_FIX_REGISTRY.map((f) => f.char).join('');
  const targets = (s: string | null): boolean => !!s && probe.split('').some((c) => s.indexOf(c) >= 0);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const toProcess: Text[] = [];
  let cur = walker.nextNode() as Text | null;
  while (cur) {
    if (targets(cur.nodeValue)) toProcess.push(cur);
    cur = walker.nextNode() as Text | null;
  }
  for (const n of toProcess) processTextNode(n);
}

let inited = false;

export function initWaEmojiGlyphFixes(): void {
  if (inited || typeof MutationObserver === 'undefined') return;
  inited = true;

  sweepElement(document.body);

  const observer = new MutationObserver((mutations) => {
    try {
      for (const m of mutations) {
        for (const added of m.addedNodes) {
          if (added.nodeType === Node.TEXT_NODE) {
            processTextNode(added as Text);
          } else if (added.nodeType === Node.ELEMENT_NODE && !(added as Element).hasAttribute?.(WRAP_ATTR)) {
            sweepElement(added as Element);
          }
        }
        if (m.type === 'characterData' && m.target.nodeType === Node.TEXT_NODE) {
          processTextNode(m.target as Text);
        }
      }
    } catch { /* фикс не должен ломать приложение */ }
  });

  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
}
