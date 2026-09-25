// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 守门 118 的门侧对账(§22c:测试**直接 import 源函数**,不留第二份镜像真相)。
 * 判三件事:判据有牙、编号在 runner 里恰好一次且 blocking、文档点名。
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
// Windows 上 import() 不接受反斜杠绝对路径,必须走 file:// URL(否则整文件在收集期失败,
// 表现为"1 test failed / 0 run"—— 那正是本仓记过的"收集期失败静默削掉整批用例"那一型)
const { classify, decide, GATE_GLOB } = await import(pathToFileURL(resolve(ROOT, 'scripts/check-gate-face-discipline.mjs')).href)

const g = (a) => execFileSync('git', ['-c', 'safe.directory=*', ...a], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28, windowsHide: true })

test('T1 散写 git 的门必判红(正向证明:名单不是死表)', () => {
  const r = classify('scripts/check-x.mjs', "import { execFileSync } from 'node:child_process'\nexecFileSync('git', ['cat-file', 'blob', h])\n")
  assert.equal(r.kind, 'loose-git')
})

test('T2 经取材层的门必判绿(反向对照,否则本门自己就是恒红源)', () => {
  const r = classify('scripts/check-y.mjs', "import { catBatch } from './lib/face-reader.mjs'\n")
  assert.equal(r.kind, 'face')
})

test('T3 全量档对同一份散写只报数;暂存档判红(方向锁)', () => {
  const v = [{ file: 'scripts/check-z.mjs', kind: 'loose-fs', why: 'x' }]
  assert.equal(decide({ verdicts: v, mode: 'full' }).exit, 0)
  assert.equal(decide({ verdicts: v, mode: 'staged' }).exit, 1)
})

test('T4 本门编号在 runner 里恰好一次,且 blocking + skipEnv + stagedTriggers 齐备', () => {
  const src = readFileSync(resolve(ROOT, 'scripts/guardian-runner.mjs'), 'utf8')
  const mine = [...src.matchAll(/^    id: '(118)',$/gm)]
  assert.equal(mine.length, 1, 'id 118 必须出现恰好一次(重复会串 skipEnv 与失败归属)')
  const at = src.indexOf("    id: '118',")
  const blk = src.slice(at, at + 900)
  assert.match(blk, /script: 'check-gate-face-discipline\.mjs'/)
  assert.match(blk, /mode: 'blocking'/)
  assert.match(blk, /skipEnv: 'HUSKY_SKIP_GATE_FACE_DISCIPLINE'/)
  assert.match(blk, /stagedTriggers: 'scripts\/'/)
})

test('T5 全 runner 任何 id 不得出现两次(撞号由机器发现,不靠人记得去查)', () => {
  const ids = [...readFileSync(resolve(ROOT, 'scripts/guardian-runner.mjs'), 'utf8').matchAll(/^    id: '(\d+)',$/gm)].map((m) => m[1])
  const dup = ids.filter((v, i) => ids.indexOf(v) !== i)
  assert.deepEqual(dup, [], `重复号:${dup.join(',')}`)
})

test('T6 AGENTS.md 点名本门(判据存在而通篇不提 = 没有)', () => {
  assert.match(readFileSync(resolve(ROOT, 'AGENTS.md'), 'utf8'), /check-gate-face-discipline\.mjs/)
})

test('T7 扫描面只认门脚本,不误咬端内代码', () => {
  assert.equal(GATE_GLOB.test('scripts/check-a.mjs'), true)
  assert.equal(GATE_GLOB.test('scripts/tests/check-a.test.mjs'), false)
  assert.equal(GATE_GLOB.test('apps/cli/src/tools/index.ts'), false)
})

test('T8 真仓 HEAD 面本门必须 exit 0(全量档只报数;红了就说明存量被当成债)', () => {
  const r = (() => {
    try {
      execFileSync(process.execPath, [resolve(ROOT, 'scripts/check-gate-face-discipline.mjs')], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28, windowsHide: true })
      return 0
    } catch (e) {
      return e.status ?? -1
    }
  })()
  assert.equal(r, 0)
  assert.ok(g(['--version']).length > 0)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
