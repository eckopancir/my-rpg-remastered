import { rolldown } from 'rolldown';
const NUL = String.fromCharCode(0);
const build = await rolldown({ input: 'test_entry.ts', plugins: [{ name: 's', resolveId(id) {
  if (/\.(png|jpe?g|gif|svg|mp3|ogg|wav|mp4|css|jfif)$/i.test(id)) return NUL + 'a';
  if (id.endsWith('hooks/useSound') || id.endsWith('hooks/useSound.ts')) return NUL + 's';
  return null;
}, load(id) {
  if (id === NUL + 'a') return 'export default "";';
  if (id === NUL + 's') return 'export const playCombatSound = () => {}; export const stopCombatSound = () => {}; export const useSound = () => ({});';
  return null;
}, transform(code) {
  return code.replaceAll('import.meta.glob', '__GLOB__');
} }] });
await build.write({ file: 'test_bundle.mjs', format: 'esm', banner: 'const __GLOB__ = () => ({});' });
