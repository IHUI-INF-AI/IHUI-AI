// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 守门 118 同族的门侧对账(§22c:测试**直接 import 源函数**,不留第二份镜像真相)。
// 判四件事:可达性判据有牙(R1/R2 双向)、宿主清单被削窄必红、取材面纪律在位、装车前置的方向性对照。
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
// Windows 上 import() 不接受反斜杠绝对路径,必须走 file:// URL(否则整文件在收集期失败,
// 表现为"1 test failed / 0 run"—— 那正是本仓记过的"收集期失败静默削掉整批用例"那一型)
const SRC_PATH = resolve(ROOT, 'scripts/check-shared-nonde-node-purity.mjs')
const {
  analyzeCore,
  isBuiltinSpec,
  extractEdges,
  maskComments,
  resolveIntoShared,
  aimsAtShared,
  hasExemption,
  HOST_DIRS,
  BARE_BUILTINS,
  SHARED_ENTRY,
  SELF_SKIP,
} = await import(pathToFileURL(SRC_PATH).href)

const IDX = SHARED_ENTRY
const NODEFILE = 'packages/shared/src/utils/nodey.ts'
const CLEAN = 'packages/shared/src/utils/clean.ts'
const nodeSrc = "import { lookup } from 'node:dns/promises'\nexport const b = lookup\n"

/** 构造一份"barrel 是否导出 nodey"可切换的 shared 面 */
function sharedMap({ reach = true, cleanImportsNode = false, indexExportsClean = true } = {}) {
  const m = new Map()
  const idxText = reach
    ? "export * from './utils/clean'\nexport * from './utils/nodey'\n"
    : indexExportsClean
      ? "export * from './utils/clean'\n"
      : 'export const nothing = 1\n'
  m.set(IDX, idxText)
  m.set(CLEAN, cleanImportsNode ? "import { b } from './nodey'\nexport const a = b\n" : "import { z } from 'zod'\nexport const a = z\n")
  m.set(NODEFILE, nodeSrc)
  return m
}
const core = (sharedFiles, hostFiles = new Map(), hostDirs = HOST_DIRS) =>
  analyzeCore({ sharedFiles, hostFiles, hostDirs })

test('M1 可达性正向:barrel 导出含内建依赖的文件 ⇒ R1 判红且给出链路', () => {
  const r = core(sharedMap())
  assert.equal(r.red.length, 1)
  assert.equal(r.red[0].rule, 'R1')
  assert.equal(r.red[0].file, NODEFILE)
  assert.deepEqual(r.red[0].chain, [IDX, NODEFILE])
  assert.equal(r.exit, 1)
})

test('M2 注入对照(同一夹具两向都验,防"整包一刀切"假严与"可达性判据失效"假绿)', () => {
  assert.equal(core(sharedMap({ reach: false })).red.length, 0, '不可达时必须为 0 —— 判据不是"shared 里有 node:"')
  assert.equal(core(sharedMap({ reach: false })).counts.unreachableNodeFiles, 1, '不可达也要如实报数,否则读报告的人以为 shared 是纯的')
  assert.equal(core(sharedMap({ reach: true })).red.length, 1, '把那条 export 加回来必须立刻红')
})

test('M3 R2:非 Node 宿主直连含内建依赖的 shared 子路径 ⇒ 判红(绕过 barrel 那条路)', () => {
  const hosts = new Map([['apps/miniapp-taro/src/pages/a.tsx', "import { b } from '@ihui/shared/utils/nodey'\nexport const p = b\n"]])
  const r = core(sharedMap({ reach: false }), hosts)
  assert.equal(r.red.filter((x) => x.rule === 'R2').length, 1)
  assert.equal(r.red.find((x) => x.rule === 'R2').file, 'apps/miniapp-taro/src/pages/a.tsx')
  // 反向:宿主直连自身干净、且下游也不含内建的文件 ⇒ 不判红
  const okHosts = new Map([['apps/miniapp-taro/src/pages/b.tsx', "import { a } from '@ihui/shared/utils/clean'\nexport const p = a\n"]])
  assert.equal(core(sharedMap({ reach: false }), okHosts).red.length, 0)
})

test('M4 R2 沿下游闭包(宿主 → 干净文件 → 含内建文件)同样判红', () => {
  const hosts = new Map([['apps/mobile-rn/src/screens/x.tsx', "import { a } from '@ihui/shared/utils/clean'\nexport const p = a\n"]])
  // clean 不经 barrel 导出 ⇒ R1 看不见这条链,只有 R2 抓得到(否则 R1 已红,不算 R2 的证明)
  const r = core(sharedMap({ reach: false, cleanImportsNode: true, indexExportsClean: false }), hosts)
  const hit = r.red.find((x) => x.rule === 'R2')
  assert.ok(hit, '链上的内建依赖必须由 R2 抓到')
  assert.deepEqual(hit.chain, ['apps/mobile-rn/src/screens/x.tsx', CLEAN, NODEFILE])
})

test('M5 反向对照:宿主清单被写空 ⇒ R2 整型隐身(判据必须"改坏就红")', () => {
  const hosts = new Map([['apps/miniapp-taro/src/pages/a.tsx', "import { b } from '@ihui/shared/utils/nodey'\nexport const p = b\n"]])
  const withDirs = core(sharedMap({ reach: false }), hosts, HOST_DIRS).red.filter((x) => x.rule === 'R2').length
  const empty = core(sharedMap({ reach: false }), hosts, []).red.filter((x) => x.rule === 'R2').length
  assert.deepEqual([withDirs, empty], [1, 0])
  // 而清单本身必须仍是那五个宿主 —— 有人删条目时上面两条一起红
  assert.deepEqual(
    [...HOST_DIRS].sort(),
    ['apps/extension', 'apps/miniapp-taro/src', 'apps/mobile-rn/src', 'apps/web', 'packages/app/src'].sort(),
  )
})

test('M6 import type 豁免(类型期导入不进产物),值导入不豁免', () => {
  const typeOnly = new Map([[IDX, "import type { X } from 'node:dns'\nexport type { X }\n"]])
  assert.equal(core(typeOnly).counts.nodeFiles, 0)
  const value = new Map([[IDX, "import { promises } from 'node:dns'\nexport const a = promises\n"]])
  assert.equal(core(value).counts.nodeFiles, 1)
})

test('M7 内建名单逐条正向证明(名单不得是死表 —— 门 120 的教训)', () => {
  for (const name of BARE_BUILTINS) {
    assert.ok(isBuiltinSpec(name), `裸名 ${name} 必须被认出`)
    assert.ok(isBuiltinSpec(`node:${name}`), `node:${name} 必须被认出`)
    assert.ok(isBuiltinSpec(`${name}/promises`), `子路径 ${name}/promises 必须被认出`)
  }
  assert.equal(isBuiltinSpec('zod'), false)
  assert.equal(isBuiltinSpec('path-to-regexp'), false, '同名前缀的 npm 包不得被误判')
})

test('M8 注释里的内建字样不算调用;动态拼接算未判定而非通过', () => {
  const comment = new Map([[IDX, "// 解释一下 node:fs 是什么\nexport const a = 1\n"]])
  assert.equal(core(comment).counts.nodeFiles, 0)
  const dyn = new Map([[IDX, 'const name = "node:fs"\nconst m = require(name)\n']])
  const r = core(dyn)
  assert.ok(r.counts.opaque >= 1, '判不了的形态必须计数')
  assert.ok(r.notices.some((n) => n.includes('未判定')))
})

test('M9 解析不到:明显指向 shared 才算未判定,宿主自己的相对路径不算', () => {
  const bad = core(new Map([[IDX, "export * from './utils/nope'\n"]]))
  assert.equal(bad.counts.unresolved, 1)
  const hostRel = new Map([['apps/extension/entrypoints/background.ts', "import { t } from '../lib/token'\nexport const x = t\n"]])
  assert.equal(core(new Map([[IDX, 'export const a = 1\n']]), hostRel).counts.unresolved, 0)
  assert.equal(aimsAtShared('../lib/token', 'apps/extension/entrypoints/background.ts'), false)
  assert.equal(aimsAtShared('@ihui/shared/utils/x', 'apps/web/a.tsx'), true)
})

test('M10 行内豁免须带原因:有原因放行并计数,裸标记(含注释闭合符冒充)仍判红', () => {
  const ok = sharedMap()
  ok.set(NODEFILE, "// nonde-purity-exempt: 由宿主注入 lookup,平台侧无调用\n" + nodeSrc)
  assert.equal(core(ok).red.length, 0)
  assert.equal(core(ok).counts.exempted, 1)
  const faked = sharedMap()
  faked.set(NODEFILE, '// nonde-purity-exempt: */\n' + nodeSrc)
  assert.equal(core(faked).red.length, 1, '注释闭合符不得冒充"带了原因"')
  assert.equal(hasExemption(['x', 'y'], 1), false)
})

test('M11 空种子 / 空候选一律判死,绝不记绿', () => {
  assert.throws(() => core(new Map([['packages/shared/src/other.ts', 'export const a = 1\n']])), /无法判定|一个都没取到/)
  assert.throws(() => core(new Map()), /无法判定|一个都没取到/)
})

test('M12 说明符解析:barrel 目录、.js 后缀、包名子路径、相对路径摸进 shared 都认得', () => {
  const known = new Set([IDX, CLEAN, NODEFILE, 'packages/shared/src/auth/index.ts'])
  assert.equal(resolveIntoShared('./utils/clean', IDX, known), CLEAN)
  assert.equal(resolveIntoShared('./utils/clean.js', IDX, known), CLEAN)
  assert.equal(resolveIntoShared('./auth', IDX, known), 'packages/shared/src/auth/index.ts')
  assert.equal(resolveIntoShared('@ihui/shared/utils/nodey', 'apps/web/a.tsx', known), NODEFILE)
  assert.equal(resolveIntoShared('../../../shared/src/utils/clean', 'packages/app/src/f/x.ts', known), CLEAN)
  assert.equal(resolveIntoShared('zod', IDX, known), null)
})

test('M13 多行 import 与 side-effect / require 三种形态都被提取(值边不漏)', () => {
  const code = maskComments("import {\n  a,\n} from 'node:fs'\nimport 'node:net'\nrequire('os')\n")
  const specs = extractEdges(code).edges.map((e) => e.spec)
  assert.deepEqual(specs.sort(), ['node:fs', 'node:net', 'os'])
})

test('M14 取材面纪律:本门必须经统一取材层读内容,不得按磁盘 readFileSync 判', () => {
  const src = readFileSync(SRC_PATH, 'utf8')
  assert.match(src, /from '\.\/lib\/face-reader\.mjs'/)
  assert.match(src, /catBatch\(/, '内容必须经 catBatch 取(否则门 118 会把本门判成半接线)')
  assert.match(src, /selectFace\(/)
  assert.doesNotMatch(src, /readFileSync\s*\(\s*(?:join|resolve)\s*\(\s*ROOT/, '不得按磁盘读判定面(共享工作树常年滞后 HEAD)')
  assert.match(src, /exit 2|无法判定/, '取不到要显式判无法判定')
})

test('M15 面旗互斥:--staged 与 --worktree 同给必须 exit 2 并点名原因', () => {
  let status = 0
  let text = ''
  try {
    text = execFileSync(process.execPath, [SRC_PATH, '--staged', '--worktree'], {
      cwd: ROOT,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 120000,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  } catch (e) {
    status = e.status
    text = String(e.stdout || '') + String(e.stderr || '')
  }
  assert.equal(status, 2, `两个面旗同给必须 exit 2,实得 ${String(status)}`)
  assert.match(text, /不得同用/)
})

test('M16 全量档真跑不崩且退出码为 0(现状:可达面 0 红,ssrf-guard 以"不可达"报出)', () => {
  let stdout = ''
  let status = 0
  try {
    stdout = execFileSync(process.execPath, [SRC_PATH, '--json'], {
      cwd: ROOT,
      encoding: 'utf8',
      maxBuffer: 1 << 28,
      windowsHide: true,
      timeout: 240000,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  } catch (e) {
    status = e.status
    stdout = String(e.stdout || '')
  }
  assert.equal(status, 0, `HEAD 面应无红(判据本身若坏了这里会是 2)`)
  const obj = JSON.parse(stdout)
  assert.equal(obj.red.length, 0)
  assert.ok(obj.counts.closure > 50, `闭包应覆盖 barrel 下游(实得 ${obj.counts.closure})`)
  assert.ok(obj.counts.hostFiles > 50, `宿主候选必须枚举到(实得 ${obj.counts.hostFiles})`)
  assert.equal(obj.counts.nodeFiles >= 1, true, 'ssrf-guard 这类"含内建但不可达"必须仍被数到')
})

test('装车前置:未注册进 guardian-runner 时本组测试仍绿;注册后必须 blocking + skipEnv', () => {
  const runnerPath = resolve(ROOT, 'scripts/guardian-runner.mjs')
  if (!existsSync(runnerPath)) return
  const src = readFileSync(runnerPath, 'utf8')
  if (!src.includes('check-shared-nonde-node-purity.mjs')) return // 主会话尚未注册(登记属主会话串行动作)
  const hits = [...src.matchAll(/script: 'check-shared-nonde-node-purity\.mjs'/g)]
  assert.equal(hits.length, 1, `注册块出现 ${hits.length} 次(重复登记即撞号)`)
  const block = src.slice(Math.max(0, hits[0].index - 600), hits[0].index + 600)
  assert.match(block, /mode: 'blocking'/)
  assert.match(block, new RegExp(`skipEnv: '${SELF_SKIP}'`))
})

test('全 runner 任何 id 不得出现两次(撞号由机器发现,不靠人记得去查)', () => {
  const src = readFileSync(resolve(ROOT, 'scripts/guardian-runner.mjs'), 'utf8')
  const ids = [...src.matchAll(/^    id: '(\d+)',$/gm)].map((m) => m[1])
  const dup = ids.filter((v, i) => ids.indexOf(v) !== i)
  assert.deepEqual([...new Set(dup)], [], `runner 里出现重复 id:${[...new Set(dup)].join(', ')}`)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
