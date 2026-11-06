// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠
/**
 * check-typecheck-degrade.test.mjs — RP-67 镜像测试
 *
 * 票面两格:
 *   ① `scripts/check-typecheck.mjs` 未消费 import-graph 的 `w.ok===false`:依赖图建图
 *      失败时退回窄 scope,窄面只含原始改动 ⇒ 反而更容易把 importer 的报错判成
 *      「范围外」而 exit 0 放行(fail-open)。修复:消费侧 scopeDegradeAllowed 只在
 *      ok===true 时允许「范围外降级放行」,ok:false / 拿不到 ok 一律 fail-closed,
 *      显式记为未判定、维持原 typecheck 结论。
 *   ② `scripts/lib/push-attempt-triage.mjs` 的 SCOPE_DEGRADE_EVIDENCE_RE 第二半
 *      (`\[IHUI-SCOPE-DEGRADE\]`)一直没有生产者。修复:两个降级块末尾各打一行签名,
 *      格式按该正则(不自创),放块尾保证 `.husky/pre-push` 的 `tail -40` 截不掉。
 *
 * 为什么只能 spawn + 源码形状锁,不能 import 源脚本:
 *   check-typecheck.mjs 顶层就是 CLI 主流程且**无 §22d isDirectRun 守卫**(同
 *   typecheck-scope.test.mjs 头注)—— import 它会真跑一趟全量 typecheck。
 *   ⇒ 判据正反例由源脚本 --self-test 真跑(T1);接线形态由源码形状锁钉死(T2,
 *   本仓最高频失效型是"判据在、主流程没用它");签名行格式由**只读** import
 *   push-attempt-triage 的正则验(T3/T4),格式不自造、生产者必须真实存在。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { SCOPE_DEGRADE_EVIDENCE_RE } from '../lib/push-attempt-triage.mjs'
import { widenFilesOverDependents } from '../lib/import-graph.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..', '..')
const CLI = join(ROOT, 'scripts', 'check-typecheck.mjs')
const SRC = readFileSync(CLI, 'utf8')

/** 起一次 --self-test(不跑 typecheck),返回 {rc, out}。显式 stdio 防 win32 EBUSY(同 typecheck-scope)。 */
function selfTest() {
  const r = spawnSync(process.execPath, [CLI, '--self-test'], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 300000,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  return { rc: r.status, out: `${r.stdout || ''}\n${r.stderr || ''}` }
}

test('T1 行为锁:--self-test 真跑 rc=0 且 RP-67 正反例逐条在输出(摘掉判据即红)', () => {
  const { rc, out } = selfTest()
  assert.equal(rc, 0, `--self-test 应全绿:\n${out}`)
  for (const mark of [
    '样例20b 建图失败(ok:false) ⇒ 关闭「范围外降级放行」',
    '样例21 建图成功(ok:true) ⇒ 允许范围外降级放行',
    '样例22a 病根复现:建图失败退窄面 ⇒ importer 报错被判成范围外',
    '样例22b 但 ok:false 关闭放行 ⇒ 组合判据不得放行',
  ]) {
    assert.ok(out.includes(mark), `--self-test 输出缺 RP-67 断言标记「${mark}」:\n${out}`)
  }
})

test('T2 形状锁:消费侧真的读 widen.ok,且两处降级判定都挂 gate(摘掉接线即红)', () => {
  assert.match(SRC, /function scopeDegradeAllowed\(widen\)/, '缺 scopeDegradeAllowed 纯判据')
  assert.match(
    SRC,
    /widen\.ok === true/,
    'scopeDegradeAllowed 未按 ok===true 放行 —— ok:false / 未判定必须 fail-closed',
  )
  assert.match(
    SRC,
    /const scopeDegradeOk = scopeDegradeAllowed\(_widen\)/,
    '主流程未把 _widen 喂给开关(判据在、主流程没用它)',
  )
  // 两处降级判定(定向快通道 / 全量分支)都必须挂 gate;只挂一处 = 另一条路径仍 fail-open。
  const gated = SRC.match(/scopeDegradeOk && scopeEnabled && [^\n]*shouldDegrade\(/g) || []
  assert.equal(gated.length, 2, `两处降级判定都必须挂 scopeDegradeOk,实测 ${gated.length} 处`)
})

test('T3 签名行生产者:两个降级块末尾各打一行 [IHUI-SCOPE-DEGRADE] 且格式命中正则', () => {
  // 从源码抽真实字面量(不自造),逐条喂给只读 import 来的正则验格式。
  const sigLines = [...SRC.matchAll(/console\.log\('(\[IHUI-SCOPE-DEGRADE\][^']*)'\)/g)].map(
    (m) => m[1],
  )
  assert.equal(sigLines.length, 2, `两个降级块应各有 1 处签名行(第二半的生产者),实测 ${sigLines.length}`)
  for (const line of sigLines) {
    assert.ok(line.startsWith('[IHUI-SCOPE-DEGRADE]'), `签名行必须以标记开头: ${line}`)
    assert.ok(
      SCOPE_DEGRADE_EVIDENCE_RE.test(line),
      `签名行必须命中 SCOPE_DEGRADE_EVIDENCE_RE(格式不得自创): ${line}`,
    )
  }
  // 必须落在降级块**末尾**:紧随「判定:本次 push 放行」之后、exit 0 之前
  // (push-attempt-triage 注释:放末尾保证 .husky/pre-push 的 tail -40 不把它截掉)。
  const inBlock =
    SRC.match(
      /判定:本次 push 放行[^\n]*\n[\s\S]{0,260}?\[IHUI-SCOPE-DEGRADE\][^\n]*\n\s*process\.exit\(0\)/g,
    ) || []
  assert.equal(inBlock.length, 2, `签名行必须落在两处降级块末尾(exit 0 前),实测 ${inBlock.length}`)
})

test('T4 反向对照:证据正则有选择性,签名行不是恒真守卫', () => {
  assert.equal(SCOPE_DEGRADE_EVIDENCE_RE.test('本任务代码已自验通过'), false, '无证据自述不得命中')
  assert.equal(
    SCOPE_DEGRADE_EVIDENCE_RE.test('报错文件在本次改动范围内,维持失败'),
    false,
    '只提「范围」而没「均在范围外…降级为警告」不构成证据',
  )
  assert.equal(
    SCOPE_DEGRADE_EVIDENCE_RE.test('[IHUI-SCOPE-DEGRADE] 降级为警告'),
    true,
    '第二半必须认 [IHUI-SCOPE-DEGRADE] 签名行(给生产者留的输入)',
  )
})

test('T5 lib 真信号:建图失败确实返回 ok:false,可用档仍 ok:true(消费侧有信号可消费)', () => {
  const wFail = widenFilesOverDependents(['apps/web/src/a.ts'], {
    buildGraph: () => {
      throw new Error('RP-67 镜像测试模拟建图失败')
    },
  })
  assert.equal(wFail.ok, false, '建图失败必须 ok:false')
  const wOk = widenFilesOverDependents(['apps/web/src/solo.ts'], {
    buildGraph: () => ({ reverse: new Map() }),
  })
  assert.equal(wOk.ok, true, '建图成功(闭包为空)仍 ok:true —— 两档区分得开')
})
