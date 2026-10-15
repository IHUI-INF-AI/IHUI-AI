// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 守门「共享类型端内重声明对账」的 §22c 镜像测试。
 *
 * 判据本体一律从门导出的 `__test__` 取(禁止在本文件复制第二份正则/清单 —— 漂开的测试
 * 只是复读机,AGENTS §22c)。这里钉的是**门自己会怎么坏**:未接线却自称已接线、取材面退化、
 * 两面旗不同给判死、看不见真仓存量、把正当的别名写法判成违规。
 */
import { execFileSync } from 'node:child_process'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..', '..')
const GATE_REL = 'scripts/check-shared-type-not-redeclared.mjs'
const GATE = join(ROOT, GATE_REL)
const GATE_MOD = await import(
  new URL(`../${GATE_REL.split('/').pop()}`, import.meta.url).href
)
// 判据走门的生产出口;`keep` 这类内部工具只从 `__test__` 取(门刻意不把内部形态做成公共导出)
const { judge, sharedTypeNames, listConsumerPaths } = GATE_MOD
const { keep } = GATE_MOD.__test__

const src = readFileSync(GATE, 'utf8')
const headShow = (p) =>
  execFileSync('git', ['-c', 'safe.directory=*', 'show', `HEAD:${p}`], {
    encoding: 'utf8',
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    cwd: ROOT,
    maxBuffer: 1 << 26,
  })

const runGate = (args) => {
  try {
    const out = execFileSync(process.execPath, [GATE, ...args], {
      encoding: 'utf8',
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd: ROOT,
      timeout: 240_000,
      maxBuffer: 1 << 26,
    })
    return { rc: 0, out }
  } catch (e) {
    return { rc: e.status ?? -1, out: `${e.stdout ?? ''}${e.stderr ?? ''}` }
  }
}

test('T1 方向锁:未接进提交链时,门体与测试都不得自称已接线', () => {
  const wired = /已接进提交链|已接入提交链|pre-commit 第 \d+ 项/.test(src)
  // 从被审面问"runner 里有没有这条注册",而不是从磁盘 —— 磁盘那份此刻是他人 UU 合并现场。
  const inRunner = /\bcheck-shared-type-not-redeclared\.mjs\b/.test(
    headShow('scripts/guardian-runner.mjs'),
  )
  assert.equal(wired, inRunner, '头注的接线声称必须与 runner 注册同真同假')
  if (!inRunner) assert.match(src, /尚未|未接提交链|零调度|不在提交链/, '未接线要如实写明')
})

test('T2 取材面形状锁:内容必须走 face-reader 的读取入口', () => {
  assert.match(src, /from '\.\/lib\/face-reader\.mjs'/, '必须引共用层')
  assert.match(src, /catBatch\(/, '正文必须由 catBatch 统一取(散写 git show = 半接线)')
  assert.doesNotMatch(src, /readFileSync\([^)]*apps/, '端内内容不得按磁盘读')
})

test('T3 两面旗同给 ⇒ exit 2(不得静默退回某一个面)', () => {
  const { rc } = runGate(['--staged', '--worktree'])
  assert.equal(rc, 2, `两旗同给必须判死,实得 rc=${rc}`)
})

test('T4 真仓阳性对照:HEAD 面必须量到存量,看不见存量不算通过', () => {
  const { rc, out } = runGate([])
  assert.equal(rc, 0, `全量档不得因存量判红(恒红门同罪),实得:\n${out.slice(0, 400)}`)
  const m = /端内重声明命中 (\d+) 处/.exec(out)
  assert.ok(m, `报告行解析不出:\n${out.slice(0, 300)}`)
  assert.ok(Number(m[1]) > 0, '真仓 HEAD 面命中 0 ⇒ 先怀疑判据,再相信世界')
})

test('T5 别名收回单源是正当写法:cli 那份落 passed,且拆掉别名必读到 hit', () => {
  // 这一例问的是"工作树上这份改动是否正当",不是被审面读数 ⇒ 允许读磁盘副本
  // (门自己的判据仍只走 face-reader;这里是夹具取材,别把两件事混成一件)。
  const p = 'apps/cli/src/commands/memory.ts'
  const cur = readFileSync(join(ROOT, p), 'utf8')
  const shared = sharedTypeNames({
    'packages/types/src/agent-runtime-memory.ts': readFileSync(
      join(ROOT, 'packages/types/src/agent-runtime-memory.ts'),
      'utf8',
    ),
  })
  const r = judge({ [p]: cur }, shared)
  const memoryHits = r.hits.filter((h) => /^Memory/.test(h.name))
  assert.equal(memoryHits.length, 0, `cli 已改别名,仍被判命中:${JSON.stringify(memoryHits)}`)
  // 现读事实:cli 那份四个本地名里只有 `MemoryListQuery` 与 `MemoryCreateInput` 与共享同名
  // (`MemoryListData`/`MemoryDeleteData` 是端内改名,天然不在射程)⇒ 别名通道应恰好认下 2 条。
  // 钉死确切值而不是 `>0`:后者在"共享名集合解析变窄"时会跟着退化而无牙。
  assert.equal(r.passed.length, 2, `别名通道实得 ${r.passed.length}:${JSON.stringify(r.passed.map((x) => x.name))}`)
  // 牙:把别名换成手写 interface,同一条判据必须立刻读到命中
  const mutated = cur.replace(
    /^type MemoryListQuery = SharedMemoryListQuery;$/m,
    'interface MemoryListQuery {\n  scope?: string\n  sessionId?: string\n  projectKey?: string\n}',
  )
  assert.notEqual(mutated, cur, '变异夹具没命中源文本 ⇒ 这一例无牙')
  const back = judge({ [p]: mutated }, shared)
  assert.equal(
    back.hits.filter((h) => h.name === 'MemoryListQuery').length,
    1,
    '拆掉别名后必须读成命中',
  )
})

test('T6 判据不得在测试里重写:本文件不出现门内正则字面量', () => {
  const t = readFileSync(join(HERE, 'check-shared-type-not-redeclared.test.mjs'), 'utf8')
  assert.ok(!/TOP_DECL_RE\s*=\s*\//.test(t), '测试里不得另立声明正则')
  assert.match(t, /await import\(/, '必须直接 import 门导出的判据')
})

test('T7 路径过滤三态:测试面/`.d.ts` 出射程,`.tsx` 在射程', () => {
  assert.equal(keep('apps/web/x.test.ts'), false)
  assert.equal(keep('apps/web/tests/x.ts'), false)
  assert.equal(keep('apps/web/x.d.ts'), false)
  assert.equal(keep('apps/web/x.tsx'), true)
})

test('T8 `--staged` 档射面跟着变更走(不得整树重读)', () => {
  const staged = listConsumerPaths('staged')
  const head = listConsumerPaths('head')
  assert.ok(staged.length <= head.length, `staged(${staged.length}) 不得多于全量(${head.length})`)
})

test('T9 --json 档的 stdout 必须可 JSON.parse(尾随人类读语会砸碎解析)', () => {
  const out = execFileSync(process.execPath, [GATE, '--json'], {
    encoding: 'utf8',
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    cwd: ROOT,
    timeout: 240_000,
    maxBuffer: 1 << 26,
  })
  const j = JSON.parse(out)
  assert.ok(['head', 'staged', 'worktree'].includes(j.face), 'face 字段必须是面名')
  assert.ok(typeof j.hits === 'number' && Array.isArray(j.red), 'hits 计数与 red 清单都要在')
  assert.ok(!out.includes('✅'), '合格结论只由退出码与 JSON 字段承载,stdout 不得再打 ✅')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
