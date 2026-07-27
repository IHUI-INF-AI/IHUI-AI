import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'

// ─── 路径推导(AGENTS.md §15:用 import.meta.url,不硬编码) ───
const __dirname = fileURLToPath(new URL('.', import.meta.url))
const SCRIPT_PATH = join(__dirname, '..', 'check-stale-dist.mjs')

// ─── 辅助:创建临时项目根目录 ─────────────────────────────
function createTempRoot() {
  return mkdtempSync(join(tmpdir(), 'ihui-stale-dist-'))
}

// 辅助:在临时项目下创建一个 package(含 package.json + src/index.ts)
// opts: { name, build: true, src, dist }
function createPackage(root, opts) {
  const pkgDir = join(root, 'packages', opts.name)
  const pkgJson = {
    name: opts.pkgName || `@ihui/${opts.name}`,
    version: '0.0.0',
    scripts: opts.build === false ? {} : { build: 'tsc' },
  }
  mkdirSync(join(pkgDir, 'src'), { recursive: true })
  writeFileSync(join(pkgDir, 'package.json'), JSON.stringify(pkgJson, null, 2))
  if (opts.src !== undefined) {
    writeFileSync(join(pkgDir, 'src', 'index.ts'), opts.src)
  }
  if (opts.dist !== undefined) {
    mkdirSync(join(pkgDir, 'dist'), { recursive: true })
    writeFileSync(join(pkgDir, 'dist', 'index.js'), opts.dist)
  }
  return pkgDir
}

// 辅助:运行脚本(stdout/stderr 去除 ANSI 颜色码,便于正则断言)
const ANSI_RE = /\x1b\[[0-9;]*m/g
function runScript(cwd) {
  const r = spawnSync('node', [SCRIPT_PATH], {
    cwd: cwd || process.cwd(),
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  })
  if (r.stdout) r.stdout = r.stdout.replace(ANSI_RE, '')
  if (r.stderr) r.stderr = r.stderr.replace(ANSI_RE, '')
  return r
}

// ─── 1. CLI --help 不崩溃(脚本未实现 --help,按默认模式运行) ───
test('CLI: --help 不崩溃(脚本未实现 --help,直接走默认扫描)', () => {
  const root = createTempRoot()
  try {
    const r = runScript(root)
    assert.ok(
      r.status === 0 || r.status === 1,
      `不应 crash,实际 exit ${r.status}\nstderr: ${r.stderr}`,
    )
    assert.ok(!r.stderr.includes('Error:'), `不应产生未捕获 Error`)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 2. 无 packages/ 目录 → exit 0 + 警告"未找到任何 packages/*" ───
test('无 packages/ 目录 → exit 0 + 警告"未找到任何 packages/*"', () => {
  const root = createTempRoot()
  try {
    const r = runScript(root)
    assert.equal(r.status, 0, `无 packages 应 exit 0\nstdout: ${r.stdout}`)
    assert.match(r.stdout, /未找到任何 packages/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 3. packages/ 存在但无符合条件的包(无 build 脚本)→ exit 0 + 警告 ─
test('packages/ 存在但无 build 脚本 → 跳过 → exit 0 + 警告', () => {
  const root = createTempRoot()
  try {
    createPackage(root, { name: 'no-build', build: false, src: 'export const a = 1\n' })
    const r = runScript(root)
    assert.equal(r.status, 0, `无 build 脚本应跳过 → exit 0\nstdout: ${r.stdout}`)
    assert.match(r.stdout, /未找到任何 packages/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 4. 包有 build 脚本但无 src/index.ts → 跳过 → exit 0 + 警告 ───
test('包有 build 脚本但无 src/index.ts → 跳过 → exit 0 + 警告', () => {
  const root = createTempRoot()
  try {
    // 不写 src/index.ts
    const pkgDir = join(root, 'packages', 'no-src')
    mkdirSync(join(pkgDir, 'src'), { recursive: true })
    writeFileSync(
      join(pkgDir, 'package.json'),
      JSON.stringify({ name: '@ihui/no-src', scripts: { build: 'tsc' } }, null, 2),
    )
    const r = runScript(root)
    assert.equal(r.status, 0, `无 src/index.ts 应跳过 → exit 0\nstdout: ${r.stdout}`)
    assert.match(r.stdout, /未找到任何 packages/)
    // 验证确实没被算进去(src/index.ts 不存在)
    assert.ok(!existsSync(join(pkgDir, 'src', 'index.ts')))
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 5. dist/index.js 不存在 → exit 1 + 报告"dist/index.js 不存在" ──
test('dist/index.js 不存在 → exit 1(完全陈旧,报告"未构建")', () => {
  const root = createTempRoot()
  try {
    createPackage(root, {
      name: 'missing-dist',
      src: 'export const foo = 1\n',
      // 不写 dist
    })
    const r = runScript(root)
    assert.equal(r.status, 1, `dist 不存在应 exit 1\nstdout: ${r.stdout}`)
    assert.match(r.stdout, /dist\/index\.js 不存在/)
    assert.match(r.stdout, /pnpm --filter @ihui\/missing-dist build/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 6. dist 完全同步(function/const/class/enum)→ exit 0 ─────────
test('dist 完全同步(ESM value exports: function/const/class/enum)→ exit 0', () => {
  const root = createTempRoot()
  try {
    createPackage(root, {
      name: 'sync-pkg',
      src: [
        'export function foo() { return 1 }',
        'export const bar = 2',
        'export class Baz {}',
        'export enum Qux { A, B }',
      ].join('\n') + '\n',
      dist: [
        'export function foo() { return 1 }',
        'export const bar = 2;',
        'export class Baz {}',
        'var Qux;',
        '(function (Qux)(Qux || (Qux = {})))(Qux);',
        'export { Qux };',
      ].join('\n') + '\n',
    })
    const r = runScript(root)
    assert.equal(r.status, 0, `同步应 exit 0\nstdout: ${r.stdout}`)
    assert.match(r.stdout, /所有 dist 与源码同步/)
    assert.match(r.stdout, /@ihui\/sync-pkg/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 7. dist 缺失某个 export(陈旧)→ exit 1 ──────────────────────
test('dist 缺失某个 export(陈旧场景)→ exit 1 + 报告缺失 export 名', () => {
  const root = createTempRoot()
  try {
    createPackage(root, {
      name: 'stale-pkg',
      src: [
        'export const a = 1',
        'export const b = 2', // dist 缺这个
        'export const c = 3',
      ].join('\n') + '\n',
      dist: ['export const a = 1;', 'export const c = 3;'].join('\n') + '\n',
    })
    const r = runScript(root)
    assert.equal(r.status, 1, `陈旧应 exit 1\nstdout: ${r.stdout}`)
    assert.match(r.stdout, /dist 缺失 export: b/)
    assert.match(r.stdout, /pnpm --filter @ihui\/stale-pkg build/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 8. wildcard re-export (`export * from`) → 跳过 → exit 0 ──────
test('wildcard re-export (`export * from`) → 跳过(skip: wildcard)→ exit 0', () => {
  const root = createTempRoot()
  try {
    createPackage(root, {
      name: 'wildcard-pkg',
      src: "export * from './foo'\n",
      // 不写 dist 也能通过(因为 wildcard 直接跳过)
    })
    const r = runScript(root)
    assert.equal(r.status, 0, `wildcard 应跳过 → exit 0\nstdout: ${r.stdout}`)
    assert.match(r.stdout, /skip: wildcard re-export/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 9. 纯类型 export (`export type T` / `export interface I`) 不算 → exit 0 ─
test('纯类型 export (type/interface) 不算 value export → dist 无需包含 → exit 0', () => {
  const root = createTempRoot()
  try {
    createPackage(root, {
      name: 'type-only',
      src: [
        'export interface IUser { id: number }',
        'export type TStatus = "active" | "inactive"',
        'export const defaultValue = 0',
      ].join('\n') + '\n',
      // dist 只有 defaultValue(类型被擦除)
      dist: 'export const defaultValue = 0;\n',
    })
    const r = runScript(root)
    assert.equal(r.status, 0, `纯类型不算 → exit 0\nstdout: ${r.stdout}`)
    assert.match(r.stdout, /所有 dist 与源码同步/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 10. `export type { ... }` 纯类型 re-export 不算 → exit 0 ─────
test('export type { ... } 纯类型 re-export 不算 → exit 0', () => {
  const root = createTempRoot()
  try {
    createPackage(root, {
      name: 'type-reexport',
      src: [
        "export type { Foo } from './types'",
        "export { bar } from './values'",
      ].join('\n') + '\n',
      // dist 只有 bar(Foo 是纯类型被擦除)
      dist: "export { bar } from './values.js';\n",
    })
    const r = runScript(root)
    assert.equal(r.status, 0, `export type {} 不算 → exit 0\nstdout: ${r.stdout}`)
    assert.match(r.stdout, /所有 dist 与源码同步/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 11. inline type 修饰符 `export { type T, value }` → 只算 value ─
test('inline type 修饰符 export { type T, value } → 只算 value → exit 0', () => {
  const root = createTempRoot()
  try {
    createPackage(root, {
      name: 'inline-type',
      // ES2024 inline type 修饰符:type T 是纯类型(编译擦除),value 是 value
      src: "export { type T, value } from './mixed'\n",
      // dist 只有 value(T 被擦除)
      dist: "export { value } from './mixed.js';\n",
    })
    const r = runScript(root)
    assert.equal(r.status, 0, `inline type 只算 value → exit 0\nstdout: ${r.stdout}`)
    assert.match(r.stdout, /所有 dist 与源码同步/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 12. `export default` 检测 → dist 同步 → exit 0 ───────────────
test('export default 检测 → dist 同步 → exit 0', () => {
  const root = createTempRoot()
  try {
    createPackage(root, {
      name: 'default-export',
      src: ['export const foo = 1', 'export default function main() {}'].join('\n') + '\n',
      dist: [
        'export const foo = 1;',
        'export default function main() {}',
      ].join('\n') + '\n',
    })
    const r = runScript(root)
    assert.equal(r.status, 0, `default 同步 → exit 0\nstdout: ${r.stdout}`)
    assert.match(r.stdout, /所有 dist 与源码同步/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 13. CommonJS dist (`exports.a = ...`) 解析 → exit 0 ──────────
test('CommonJS dist (exports.a = ... / Object.defineProperty) → exit 0', () => {
  const root = createTempRoot()
  try {
    createPackage(root, {
      name: 'cjs-pkg',
      src: [
        'export const foo = 1',
        'export const bar = 2',
        'export const baz = 3',
      ].join('\n') + '\n',
      dist: [
        '"use strict";',
        'exports.foo = 1;',
        'exports.bar = 2;',
        'Object.defineProperty(exports, "baz", { value: 3 });',
      ].join('\n') + '\n',
    })
    const r = runScript(root)
    assert.equal(r.status, 0, `CJS dist 同步 → exit 0\nstdout: ${r.stdout}`)
    assert.match(r.stdout, /所有 dist 与源码同步/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 14. ESM dist (`export { a, b }`) 解析 → exit 0 ───────────────
test('ESM dist re-export (export { a, b }) → exit 0', () => {
  const root = createTempRoot()
  try {
    createPackage(root, {
      name: 'esm-pkg',
      src: "export { foo, bar } from './values'\n",
      dist: "export { foo, bar } from './values.js';\n",
    })
    const r = runScript(root)
    assert.equal(r.status, 0, `ESM dist 同步 → exit 0\nstdout: ${r.stdout}`)
    assert.match(r.stdout, /所有 dist 与源码同步/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 15. 多包混合(1 个同步 + 1 个陈旧)→ exit 1 + 报告陈旧包 ────
test('多包混合: 1 同步 + 1 陈旧 + 1 wildcard 跳过 → exit 1 + 只报告陈旧包', () => {
  const root = createTempRoot()
  try {
    // 同步包
    createPackage(root, {
      name: 'good',
      src: 'export const a = 1\n',
      dist: 'export const a = 1;\n',
    })
    // 陈旧包(dist 缺失 export)
    createPackage(root, {
      name: 'bad',
      src: 'export const x = 1\nexport const y = 2\n',
      dist: 'export const x = 1;\n',
    })
    // wildcard 跳过包
    createPackage(root, {
      name: 'wild',
      src: "export * from './all'\n",
    })
    const r = runScript(root)
    assert.equal(r.status, 1, `有陈旧应 exit 1\nstdout: ${r.stdout}`)
    // 应报告 bad 包陈旧
    assert.match(r.stdout, /@ihui\/bad/)
    assert.match(r.stdout, /dist 缺失 export: y/)
    // 应在 ok 列表中出现 good 和 wild
    assert.match(r.stdout, /@ihui\/good/)
    assert.match(r.stdout, /@ihui\/wild/)
    assert.match(r.stdout, /skip: wildcard re-export/)
    // 检测 3 个包
    assert.match(r.stdout, /检测 3 个 packages/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
