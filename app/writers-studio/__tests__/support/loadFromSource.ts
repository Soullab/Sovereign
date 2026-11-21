/**
 * Test support: load a source file as a module, optionally after a textual mutation.
 *
 * This is how a DEFEAT CANDIDATE is made executable. A candidate is the real file with one
 * plausible, competent, WRONG change (an enabled chooser, a generic retry message, a
 * dropped table). The same checks that pass on the file as written must FAIL on the
 * candidate, otherwise the checks would pass for any implementation and prove nothing.
 *
 * A mutation that changes nothing is refused: a candidate identical to the real file
 * would "survive" for the wrong reason and make the lethality claim vacuous.
 *
 * Relative imports resolve against the ORIGINAL file's directory; every other import goes
 * through the test's own module registry, so `jest.mock(...)` doubles apply to candidates
 * exactly as they apply to the real file.
 */
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

export function mutateSource(file: string, mutate: (src: string) => string): string {
  const original = fs.readFileSync(file, 'utf8');
  const mutated = mutate(original);
  if (mutated === original) {
    throw new Error(`defeat candidate changed nothing in ${path.basename(file)}; it cannot be lethal`);
  }
  return mutated;
}

export function loadFromSource(file: string, mutate?: (src: string) => string): Record<string, any> {
  const src = mutate ? mutateSource(file, mutate) : fs.readFileSync(file, 'utf8');
  const out = ts.transpileModule(src, {
    fileName: file,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
      allowSyntheticDefaultImports: true,
    },
  }).outputText;
  const dir = path.dirname(file);
  const mod: { exports: Record<string, any> } = { exports: {} };
  const req = (id: string) => (id.startsWith('.') ? require(path.resolve(dir, id)) : require(id));
  new Function('module', 'exports', 'require', out)(mod, mod.exports, req);
  return mod.exports;
}
