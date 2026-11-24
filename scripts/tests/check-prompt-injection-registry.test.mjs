// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// §22c 镜像测试:直接 import 源脚本的 __test__,不在本文件复制任何判据实现。
// 立论同守门 103/77:证明判据有牙与取材面行为只能靠**构造面**,不得依赖仓库瞬时状态。
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

import { __test__ as G } from '../check-prompt-injection-registry.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const read = (rel) => readFileSync(path.join(ROOT, rel), 'utf8')

const REGISTRY_TEXT = `
export const PROMPT_INJECTION_KINDS = ['reference_data', 'host_reminder', 'host_directive'] as const;
export const PROMPT_INJECTION_ENTRIES: readonly PromptInjectionEntry[] = [
  { id: 'alpha', kind: 'host_reminder', producer: 'apps/cli/src/x.ts#doA', consumer: 'apps/cli/src/y.ts#build', title: 'A 段' },
];
export function renderInjectionNotice(): string { return ''; }
`
const PRODUCER = `import { recordInjectionSkipped } from './utils/prompt-injection-registry.js';
export function doA() { return recordInjectionSkipped('alpha', '本轮无内容'); }
`
const CONSUMER = `import { renderInjectionNotice } from './utils/prompt-injection-registry.js';
export function build() { return renderInjectionNotice(); }
`
const greenFiles = () =>
  new Map([
    ['apps/cli/src/x.ts', { text: PRODUCER }],
    ['apps/cli/src/y.ts', { text: CONSUMER }],
  ])
const green = () => ({
  registryText: REGISTRY_TEXT,
  boundaryText: 'export function f(){}',
  files: greenFiles(),
  headCounts: new Map(),
})

test('T1 合规构造面必绿(反向对照:证明其余各例的红不是恒红)', () => {
  const r = G.decide(green())
  assert.deepEqual([...r.red.R1, ...r.red.R2, ...r.red.R3], [])
  assert.equal(r.counted.entries, 1)
})

test('T2 阳性对照:登记了却没人生产 ⇒ R1 必红', () => {
  const files = new Map([
    ['apps/cli/src/x.ts', { text: 'export const ID = "alpha"; export function doA() { return ID }' }],
    ['apps/cli/src/y.ts', { text: CONSUMER }],
  ])
  const r = G.decide({ ...green(), files })
  assert.ok(r.red.R1.some((s) => s.includes('没有任何记账出口调用')), JSON.stringify(r.red.R1))
})

test('T3 阳性对照:裸 [系统提示] 旁路 ⇒ R3 必红,且 HEAD 存量同样形态不得判红', () => {
  const bare = { text: 'export const s = `[系统提示] 别的东西`;\nexport const t = `[系统提醒] 又一段`;\n' }
  const files = new Map([...greenFiles(), ['apps/cli/src/commands/z.ts', bare]])
  const r = G.decide({ ...green(), files, headCounts: new Map([['apps/cli/src/commands/z.ts', 0]]) })
  assert.equal(r.red.R3.length, 1, JSON.stringify(r.red.R3))
  assert.match(r.red.R3[0], /commands\/z\.ts/)
  // 反向:同样两处但 HEAD 自身已有两处 ⇒ 只报数(把存量判红就是恒红门 ⇒ 逼人 --no-verify)
  const r2 = G.decide({ ...green(), files, headCounts: new Map([['apps/cli/src/commands/z.ts', 2]]) })
  assert.equal(r2.red.R3.length, 0)
  assert.equal(r2.counted.legacyHits, 2)
})

test('T4 注释里的提及不得算产出(本仓最高频失效型:看起来有、其实没装车)', () => {
  const files = new Map([
    [
      'apps/cli/src/x.ts',
      { text: `// recordInjectionInjected('alpha', '旧实现')\nexport function doA() { return recordInjectionSkipped('other','x') }\n` },
    ],
    ['apps/cli/src/y.ts', { text: CONSUMER }],
  ])
  const r = G.decide({ ...green(), files })
  assert.ok(r.red.R1.some((s) => s.includes('未出现该 id')), JSON.stringify(r.red.R1))
})

test('T5 出口调用被包在字符串里不算装车(字符串遮罩必须真的有牙)', () => {
  const files = new Map([
    ['apps/cli/src/x.ts', { text: `export const doc = "recordInjectionSkipped('alpha','x')"` }],
    ['apps/cli/src/y.ts', { text: CONSUMER }],
  ])
  const r = G.decide({ ...green(), files })
  assert.ok(r.red.R1.some((s) => s.includes('没有任何记账出口调用')), JSON.stringify(r.red.R1))
})

test('T6 可见行无人调用 / 出口被摘线 ⇒ R2 必红(拦"造好没装车")', () => {
  const noCaller = G.decide({ ...green(), files: new Map([['apps/cli/src/x.ts', { text: PRODUCER }]]) })
  assert.ok(noCaller.red.R2.some((s) => s.includes('零调用点')), JSON.stringify(noCaller.red.R2))
  const flipped = G.decide({
    ...green(),
    registryText: REGISTRY_TEXT.replace('export function renderInjectionNotice', 'function renderInjectionNotice'),
  })
  assert.ok(flipped.red.R2.some((s) => s.includes('不再导出')), JSON.stringify(flipped.red.R2))
  // 测试面的调用点不得算装车
  const testOnly = G.decide({
    ...green(),
    files: new Map([
      ['apps/cli/src/x.ts', { text: PRODUCER }],
      ['apps/cli/tests/consumer.test.ts', { text: CONSUMER }],
    ]),
  })
  assert.ok(testOnly.red.R2.some((s) => s.includes('零调用点')))
})

test('T7 kind 越出封闭集必红;封闭集解析为空则记"无牙"而非通过', () => {
  const bad = G.decide({ ...green(), registryText: REGISTRY_TEXT.replace("kind: 'host_reminder'", "kind: 'host_whisper'") })
  assert.ok(bad.red.R1.some((s) => s.includes('不在封闭集')), JSON.stringify(bad.red.R1))
  const noKinds = G.decide({
    ...green(),
    registryText: REGISTRY_TEXT.replace(/^export const PROMPT_INJECTION_KINDS.*$/m, ''),
  })
  assert.ok(noKinds.undetermined.some((s) => s.includes('无牙')), JSON.stringify(noKinds.undetermined))
})

test('T8 锚文件取不到 ⇒ 一律"无法判定",既不冒红也不记绿', () => {
  const r = G.decide({ registryText: null, boundaryText: '', files: greenFiles(), headCounts: new Map() })
  assert.ok(r.undetermined.length > 0)
  assert.deepEqual([...r.red.R1, ...r.red.R2, ...r.red.R3], [])
  const empty = G.decide({
    ...green(),
    registryText: REGISTRY_TEXT.replace(/\{\s*id: 'alpha'[\s\S]*?\},/, ''),
  })
  assert.ok(empty.undetermined.some((s) => s.includes('枚举到 0 条')), JSON.stringify(empty.undetermined))
})

test('T9 遮罩两档方向不得混用:注释恒遮、字符串按开关', () => {
  const src = `const id = 'alpha'; // 'alpha' 在注释里\n`
  assert.ok(G.maskCode(src, { strings: false }).includes(`'alpha'`))
  assert.ok(!G.maskCode(src, { strings: true }).includes(`'alpha'`))
  assert.equal(G.maskCode('a\nb\nc').split('\n').length, 3, '遮罩后行数必须不漂(逐行计数依赖它)')
  assert.equal(G.countBarePrefix('x [系统提示] y\nz [系统提醒] w'), 2)
})

test('T10 真登记表必须解析得到条目与 kind 封闭集(判据不得对真实形态全盲)', () => {
  const { entries, kinds } = G.parseRegistry(read(G.REGISTRY))
  assert.ok(entries.length >= 1, '真登记表解析到 0 条 ⇒ 判据对表自身的形态全盲')
  assert.deepEqual(kinds, ['reference_data', 'host_reminder', 'host_directive'])
  for (const e of entries) {
    const spec = G.splitSpec(e.producer)
    assert.ok(spec, `${e.id} 的 producer 不是 <路径>#<符号>`)
    assert.ok(!spec.file.startsWith('/'), `${e.id} 的 producer 必须写仓库相对路径`)
  }
})

test('T11 取材面形状锁:必须走 face-reader 的批量读,不得散写 git 或按磁盘判', () => {
  const src = read('scripts/check-prompt-injection-registry.mjs')
  assert.match(src, /from '\.\/lib\/face-reader\.mjs'/, '未引 face-reader ⇒ 守门 118 判半接线')
  assert.match(src, /catBatch\(/, '正文未经 catBatch ⇒ "import 了层却自己取内容"')
  assert.match(src, /selectFace\(/, '未走统一面选择 ⇒ 两面旗同给的判死会缺失')
  assert.ok(!/execSync\s*\(/.test(src), '不得用 execSync 拼 git 命令串')
  assert.ok(!/readFileSync\s*\(\s*path\.join\(\s*ROOT/.test(src), '全量判据不得按磁盘读被审内容')
  assert.match(src, /pathToFileURL\(process\.argv\[1\]\)\.href/, '§22d isDirectRun 必须经 pathToFileURL 归一(否则 Windows 下恒不触发 ⇒ 一台恒绿尺子)')
})

test('T12 装车成套性:runner 注册 + 文档点名必须同时在位(守门 89 R4 的理由)', () => {
  const runner = read('scripts/guardian-runner.mjs')
  const mine = runner.match(/\{\s*\n\s*id: '128',[\s\S]*?\n  \},/)
  assert.ok(mine, 'runner 里没有本门的注册块 ⇒ 判据存在而永不调用 = 没有')
  assert.ok(/script: 'check-prompt-injection-registry\.mjs'/.test(mine[0]))
  assert.ok(/mode: 'blocking'/.test(mine[0]), '本门必须 blocking')
  assert.ok(/skipEnv: 'HUSKY_SKIP_PROMPT_INJECTION_REGISTRY'/.test(mine[0]))
  assert.ok(/stagedTriggers:\s*\[\s*'apps\/cli\/src\/',?\s*\]/.test(mine[0]), 'stagedTriggers 必须收窄到 apps/cli/src/')
  const ids = [...runner.matchAll(/^    id: '([0-9]+[a-z]*)',$/gm)].map((m) => m[1])
  assert.equal(ids.filter((x) => x === '128').length, 1, '本门编号在 runner 中必须恰好出现一次')
  assert.equal(new Set(ids).size, ids.length, 'runner 存在重复编号(串 skipEnv 与失败归属)')
  for (const doc of ['AGENTS.md', 'README.md']) {
    assert.ok(read(doc).includes('check-prompt-injection-registry'), `${doc} 未点名本门 ⇒ R4 会拦下这枚提交`)
  }
})

test('T13 扫描面必须排除 .d.ts(纯声明文件产假阳是真事故,不是审美)', () => {
  const src = read('scripts/check-prompt-injection-registry.mjs')
  assert.match(src, /\.d\.ts/, '清单里没有 .d.ts 排除 ⇒ 会被 src/prompts/*.d.ts 的文档文本误判')
  assert.ok(G.isTestPath('apps/cli/tests/a.test.ts') && G.isTestPath('packages/context-compaction/test/b.ts'))
  assert.ok(!G.isTestPath('apps/cli/src/commands/agent.ts'))
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
