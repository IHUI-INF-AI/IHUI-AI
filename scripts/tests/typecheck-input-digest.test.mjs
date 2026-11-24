// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * typecheck-input-digest.test.mjs — v2 回执键(tsc 输入面摘要)镜像测试
 *
 * 立因(2026-11-18 机主实测):typecheck 单门 136s,占一次推送 160s 的 85%;它的回执键是
 * `HEAD^{tree}`,任何文件变化(README/plan/脚本)都会让键变 ⇒ 每次提交后必跑全量。
 * 本测试钉住三件事,防止"收紧键"变成"放宽判据":
 *   ① 输入面口径:TS 输入进集合,非 TS(README/md/mjs)不进;
 *   ② **非 TS 文件变更不改变摘要**(这正是提速的来源),TS 文件变更必须改变摘要(不得假绿);
 *   ③ 真实仓集成:换掉 README 的 blob sha ⇒ 摘要不变;换掉任一 .ts 的 blob sha ⇒ 摘要必变。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gitRaw } from '../lib/face-reader.mjs'
import {
  TS_INPUT_EXT_RE,
  digestEntries,
  envFingerprint,
  isTsInputPath,
  parseLsTree,
} from '../lib/typecheck-input-digest.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..', '..')
const SHA = (c) => c.repeat(40)

/** 造一条 ls-tree 记录(`<mode> <type> <sha>\t<path>`)\0 */
const rec = (path, sha, type = 'blob') => `100644 ${type} ${sha}\t${path}\0`

test('D1 ls-tree 解析:tab 前后切开,非 blob 也保留(摘要侧再过滤)', () => {
  const entries = parseLsTree(rec('apps/web/src/a.ts', SHA('a')) + rec('apps/web/src', SHA('b'), 'tree'))
  assert.equal(entries.length, 2)
  assert.deepEqual(entries[0], { mode: '100644', type: 'blob', sha: SHA('a'), path: 'apps/web/src/a.ts' })
  assert.equal(entries[1].type, 'tree')
  assert.deepEqual(parseLsTree(''), [])
  assert.deepEqual(parseLsTree(null), [])
})

test('D2 输入面口径:TS 与配置进集合,README/脚本/mjs 不进(allowJs 关闭时)', () => {
  const yes = [
    'apps/web/src/a.ts',
    'apps/web/src/a.tsx',
    'packages/types/src/a.mts',
    'packages/types/src/a.cts',
    'tsconfig.json',
    'apps/api/tsconfig.build.json',
    'packages/tsconfig/base.json',
    'apps/web/package.json',
    'pnpm-lock.yaml',
    'pnpm-workspace.yaml',
    '.npmrc',
  ]
  for (const p of yes) assert.equal(isTsInputPath(p), true, `应算输入: ${p}`)
  const no = ['README.md', 'README.en.md', 'PROJECT_PLAN.md', 'scripts/x.mjs', 'scripts/y.js', 'docs/a.md']
  for (const p of no) assert.equal(isTsInputPath(p), false, `不应算输入: ${p}`)
  // allowJs 打开时 .js 家族进集合(本门只在"无 allowJs"时用摘要键,这里钉住口径本身)
  assert.equal(isTsInputPath('scripts/z.js', { allowJs: true }), true)
  assert.equal(TS_INPUT_EXT_RE.test('a.ts'), true)
})

test('D3 非 TS 变更不改摘要(提速来源),TS 变更必改摘要(不许假绿)', () => {
  const base = [
    { type: 'blob', path: 'apps/web/src/a.ts', sha: SHA('a') },
    { type: 'blob', path: 'README.md', sha: SHA('b') },
    { type: 'blob', path: 'PROJECT_PLAN.md', sha: SHA('c') },
    { type: 'blob', path: 'scripts/tool.mjs', sha: SHA('d') },
  ]
  const d0 = digestEntries(base)
  assert.equal(d0.count, 1, '只有 a.ts 算输入')
  // 只改 README / plan / 脚本 ⇒ 摘要必须一模一样(否则提速不成立)
  const onlyDocs = base.map((e) =>
    e.path.match(/\.(md|mjs)$/) ? { ...e, sha: SHA('f') } : e,
  )
  assert.equal(digestEntries(onlyDocs).digest, d0.digest, '非 TS 变更不得改变摘要')
  // 改一个 .ts ⇒ 摘要必须变(否则会拿旧结论冒充新结论)
  const tsChanged = base.map((e) => (e.path.endsWith('.ts') ? { ...e, sha: SHA('e') } : e))
  assert.notEqual(digestEntries(tsChanged).digest, d0.digest, 'TS 变更必须改变摘要')
  // 顺序无影响(排序后拼)
  const reordered = [base[3], base[2], base[0], base[1]]
  assert.equal(digestEntries(reordered).digest, d0.digest)
  // tree 条目不参与(目录本身不是 tsc 输入)
  assert.equal(digestEntries([{ type: 'tree', path: 'apps/web/src', sha: SHA('9') }]).count, 0)
})

test('D4 环境指纹:只留 node/ts 两维;依赖解析面由摘要承担(2026-11-18 改)', () => {
  const a = envFingerprint({ nodeVersion: 'v22.0.0', tsVersion: '5.7.2' })
  assert.equal(a, envFingerprint({ nodeVersion: 'v22.0.0', tsVersion: '5.7.2' }))
  assert.notEqual(a, envFingerprint({ nodeVersion: 'v22.0.0', tsVersion: '5.8.0' }), 'ts 变必须失效')
  assert.notEqual(a, envFingerprint({ nodeVersion: 'v24.0.0', tsVersion: '5.7.2' }), 'node 变必须失效')
  assert.match(a, /^node=v22\.0\.0;ts=5\.7\.2$/)
  // 反例:旧的 `nm`(node_modules/.modules.yaml 字节数)不再参与 —— 它在多会话下每轮都变,
  // 曾让回执恒定失效(typecheck 每次全量 126~145s)。依赖真变化的信号改由摘要承担,见下一条断言。
  assert.equal(a, envFingerprint({ nodeVersion: 'v22.0.0', tsVersion: '5.7.2', nodeModulesLayoutSize: 101 }), a)
  // 取不到也必须有值(不得产出空串冒充"一致")
  const unknown = envFingerprint({ nodeVersion: null, tsVersion: null })
  assert.equal(unknown, 'node=unknown;ts=unknown')
  // 「依赖变了」这个信号不许丢:pnpm-lock.yaml 的 blob 一变,输入面摘要必变(等价于旧 nm 维的本意,但更准)
  const deps = [
    { type: 'blob', path: 'apps/web/src/a.ts', sha: SHA('a') },
    { type: 'blob', path: 'pnpm-lock.yaml', sha: SHA('1') },
  ]
  const d0 = digestEntries(deps)
  const lockChanged = deps.map((e) => (e.path === 'pnpm-lock.yaml' ? { ...e, sha: SHA('2') } : e))
  assert.notEqual(digestEntries(lockChanged).digest, d0.digest, 'lock 变更必须改变摘要')
  assert.equal(d0.count, 2, 'lock 与 ts 都算输入')
})

test('D5 真实仓集成:换 README 不变 / 换任一 .ts 必变(端到端证提速点)', (t) => {
  let raw
  try {
    // 与生产同源:走 face-reader 的 gitRaw(本机 PATH 可能丢 git,该实现自带解析)
    raw = gitRaw(['ls-tree', '-r', '-z', 'HEAD'], ROOT, { timeout: 120_000 })
  } catch {
    t.skip('本机 git 取不到 HEAD 树 → 跳过集成格(不记绿)')
    return
  }
  const entries = parseLsTree(raw)
  assert.ok(entries.length > 1000, `真实树条目过少: ${entries.length}`)
  const d0 = digestEntries(entries)
  assert.ok(d0.count > 100, `真实仓 TS 输入条目过少: ${d0.count}`)

  const readme = entries.find((e) => e.path === 'README.md')
  assert.ok(readme, 'HEAD 应含 README.md')
  const readmeChanged = entries.map((e) => (e.path === 'README.md' ? { ...e, sha: SHA('1') } : e))
  assert.equal(digestEntries(readmeChanged).digest, d0.digest, 'README 变更不得改变摘要')

  const firstTs = entries.find((e) => e.type === 'blob' && /\.(ts|tsx)$/.test(e.path))
  assert.ok(firstTs, 'HEAD 应含 .ts')
  const tsChanged = entries.map((e) => (e.path === firstTs.path ? { ...e, sha: SHA('2') } : e))
  assert.notEqual(digestEntries(tsChanged).digest, d0.digest, '任一 .ts 变更必须改变摘要')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
