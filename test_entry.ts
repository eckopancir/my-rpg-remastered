import { getItemImage } from './src/assets/index';

let fail = 0;
const eq = (n: string, g: any, w: any) => {
  const ok = g === w; if (!ok) fail++;
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${n}: got=${JSON.stringify(g)} want=${JSON.stringify(w)}`);
};
const names: [string, string][] = [
  ['Капюшон призрака', 'ghost_head'],
  ['Плащ призрака', 'ghost_armor'],
  ['Штаны призрака', 'ghost_pants'],
  ['Наручи призрака', 'ghost_gloves'],
  ['Башмаки призрака', 'ghost_boots'],
];
for (const [name, file] of names) {
  const url = getItemImage(name, name, 'head', undefined) || '';
  eq(name, url.includes(file), true);
}
if (fail) { console.log('FAILURES: ' + fail); process.exit(1); }
console.log('ALL OK');
