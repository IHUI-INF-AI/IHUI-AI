// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// §22c 镜像测试:`scripts/check-bare-decode-uri.mjs`(裸 decodeURIComponent 差值棘轮门)。
//
// 与 `--self-test` 的分工:自检判**判据纯函数**(构造面),本文件判
// **门的形与接线纪律**:真仓双面输入的一致性、注册表成套、遮罩单源、
// 三档面互斥的 exit 2 方向、有牙锁(构造面,不钉会腐烂的 HEAD 读数)。
//
// 硬要求(§22c):至少一条用例的输入逐字取自真实文件 —— 取
// `apps/miniapp-taro/src/pkg-ai/agent-dialogue/index.tsx`(2026-10-25 深挖轮修复点):
// HEAD blob(改造前后随提交演进)与工作树副本双面同判,只断言**单调关系**而非某个计数,
// 免得把"这一轮还没提交"的临时读数钉成永真(§1 完成即删同纪律)。

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { __test__ as gate } from '../check-bare-decode-uri.mjs'
import { maskComments } from '../lib/code-mask.mjs'

const REPO = join(import.meta.dirname, '..', '..')
const RUNNER = join(import.meta.dirname, '..', 'guardian-runner.mjs')
const GATE_SRC = join(import.meta.dirname, '..', 'check-bare-decode-uri.mjs')
const REAL_FILE = 'apps/miniapp-taro/src/pkg-ai/agent-dialogue/index.tsx'

const gitShow = (spec) =>
  execFileSync('git', ['-c', 'core.quotepath=false', 'show', spec], {
    cwd: REPO,
    encoding: 'utf8',
    maxBuffer: 32 << 20,
    stdio: ['ignore', 'pipe', 'pipe'],
  })

test('T1 真仓双面:同一判据判 HEAD 与工作树,工作树(safe 化后)必须判 0,且 HEAD 计数不得少于它', () => {
  const head = gitShow(`HEAD:${REAL_FILE}`)
  const work = readFileSync(join(REPO, REAL_FILE), 'utf8')
  const headBare = gate.classifyDecodes(maskComments(head), head).bare.length
  const workBare = gate.classifyDecodes(maskComments(work), work).bare.length
  assert.ok(
    head.includes('decodeURIComponent(') || work.includes('decodeURIComponent('),
    '两面都不再含任何 decode 调用形态 ⇒ 本例输入前提已消失,该换文件而不是让它假绿',
  )
  assert.equal(workBare, 0, `工作树面判出 ${workBare} 处裸 decode ⇒ 要么修复被回退,要么 safe 出口被误伤`)
  assert.ok(headBare >= workBare, 'HEAD 面比工作树还干净?两面单调关系破了(棘轮锚会跟着漂移)')
})

test('T2 注册表成套:单引号 id 241 + script + blocking + skipEnv + 非空 stagedTriggers', () => {
  const norm = readFileSync(RUNNER, 'utf8').replace(/\r\n/g, '\n')
  assert.match(norm, /^\s*id: '241',$/m, "id 行必须是单引号形态(双引号对守门 89 的撞号检测隐身)")
  const i = norm.indexOf("id: '241'")
  const block = norm.slice(i, norm.indexOf('\n    },', i))
  assert.match(block, /script: 'check-bare-decode-uri\.mjs',/)
  assert.match(block, /mode: 'blocking',/)
  assert.match(block, /skipEnv: 'HUSKY_SKIP_BARE_DECODE_URI',/)
  assert.match(block, /stagedTriggers: \[\s*'apps\/miniapp-taro'/)
  assert.doesNotMatch(block, /stagedTriggers: \[\]/, '空数组会让 guardian-triggers 归一当场抛(守门 89 R8)')
})

test('T3 遮罩单源:门体只引 code-mask,不得自带注释剥离(第二份真相必漂移)', () => {
  const src = readFileSync(GATE_SRC, 'utf8')
  assert.match(src, /from '\.\/lib\/code-mask\.mjs'/)
  assert.ok(
    (src.match(/maskComments/g) || []).length >= 1,
    'maskComments 未实际调用 ⇒ 遮罩形同虚设',
  )
})

test('T4 三档面互斥与判死方向:两面旗同给 exit 2 并显式「未判定」;枚举到 0 判死不记绿', () => {
  const runCli = (args) => {
    try {
      const out = execFileSync(process.execPath, [GATE_SRC, ...args], {
        cwd: REPO,
        encoding: 'utf8',
        maxBuffer: 16 << 20,
        stdio: ['ignore', 'pipe', 'pipe'],
      })
      return { rc: 0, out }
    } catch (e) {
      return { rc: e.status ?? -1, out: String(e.stdout ?? '') + String(e.stderr ?? '') }
    }
  }
  const both = runCli(['--staged', '--worktree'])
  assert.equal(both.rc, 2, `--staged 与 --worktree 同给必须 exit 2(实得 ${both.rc}:${both.out})`)
  assert.match(both.out, /未判定/)
  const none = runCli(['--worktree', '--files', 'scripts/__no_such_file__.tsx'])
  assert.equal(none.rc, 2, `不存在的 --files 目标必须走「未判定/判死」而不是记绿(实得 ${none.rc}:${none.out})`)
  assert.match(none.out, /未判定|枚举到 0/)
  // 阳性对照:同一 CLI 判真实存在且含修复的文件必须 rc=0(证明"红是判出来的,不是恒红门")
  const real = runCli(['--worktree', '--files', REAL_FILE])
  assert.equal(real.rc, 0, `真实文件被恒红判住即 §12e 恒红门:${real.out}`)
})

test('T5 构造面有牙锁(不钉真仓读数):裸形必判红、safe 必判 0、豁免须带原因', () => {
  const BARE = 'function f(p: string) {\n  return decodeURIComponent(p)\n}\n'
  const SAFE = 'function f(p: string) {\n  return safeDecodeURIComponent(p)\n}\n'
  const TRY = 'function f(p: string) {\n  try { return decodeURIComponent(p) } catch { return p }\n}\n'
  const EXEMPT_OK = 'function f(p: string) {\n  return decodeURIComponent(p) // bare-decode-uri-exempt: 上游保证无孤立%\n}\n'
  const EXEMPT_EMPTY = 'function f(p: string) {\n  return decodeURIComponent(p) // bare-decode-uri-exempt:\n}\n'
  const COMMENT = '// decodeURIComponent(p) 仅是注释里的示例\nfunction f(p: number) {\n  return p\n}\n'
  assert.equal(gate.classifyDecodes(maskComments(BARE), BARE).bare.length, 1)
  assert.equal(gate.classifyDecodes(maskComments(SAFE), SAFE).bare.length, 0)
  assert.equal(gate.classifyDecodes(maskComments(TRY), TRY).bare.length, 0)
  assert.equal(gate.classifyDecodes(maskComments(TRY), TRY).triedWrapped, 1)
  assert.equal(gate.classifyDecodes(maskComments(EXEMPT_OK), EXEMPT_OK).bare.length, 0)
  assert.equal(gate.classifyDecodes(maskComments(EXEMPT_EMPTY), EXEMPT_EMPTY).bare.length, 1, '空原因豁免不生效(§0.7 验过才免)')
  assert.equal(gate.classifyDecodes(maskComments(COMMENT), COMMENT).bare.length, 0, '注释命中被遮')
  // 恒绿对照(手写"什么都不判")对本类必判 0 —— 真判据必须判 1,差值即"牙"
  const fakeAlwaysGreen = () => ({ bare: [], triedWrapped: 0 })
  assert.equal(fakeAlwaysGreen(BARE).bare.length, 0)
})

test('T6 self-test 全绿', () => {
  for (const c of gate.selfTestCases()) assert.ok(c.ok, `self-test 失败:${c.name}`)
})

test('T7 全量档 HEAD 面现读 pass:棘轮对 HEAD 自身恒 delta≤0', () => {
  const rep = gate.runAudit({ face: 'head' })
  assert.notEqual(rep.status, 'undetermined', `全量档未判定:${rep.reason ?? JSON.stringify(rep.unjudged?.slice(0, 2))}`)
  assert.equal(rep.fails.length, 0, `自面对自身锚判出新增 = 棘轮错位:${JSON.stringify(rep.fails.slice(0, 3))}`)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
