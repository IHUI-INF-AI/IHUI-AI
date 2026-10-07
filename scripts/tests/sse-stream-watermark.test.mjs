// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 守门测试:b76-08a 票3「流式摄入的 ACK≠base 与缺口恢复分级」。
//
// 断言打在生产判据出口(apps/ai-service/app/core/sse_contract.py 的
// StreamWatermark / apply_frame)上 —— 经 python 驱动器现读生产模块,不是平行导出。
// 跑法:`node --test scripts/tests/sse-stream-watermark.test.mjs`
// (EBUSY 环境:子进程不消费 stdin,stdio 一律 ['ignore','pipe','pipe'],
//  根治记录见技能 ihui-spawn-ebusy-fix)。

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

// node --test 下 import.meta.url 的目录解析在本环境不可靠,改为从 cwd 向上找仓根
// (判据:存在 apps/ai-service/.venv 的最近祖先)。
function findRepoRoot() {
  let dir = process.cwd()
  for (;;) {
    if (existsSync(resolve(dir, 'apps/ai-service/.venv'))) return dir
    const parent = resolve(dir, '..')
    if (parent === dir) throw new Error('找不到仓根(含 apps/ai-service/.venv 的祖先目录)')
    dir = parent
  }
}

const REPO_ROOT = findRepoRoot()
const AI_SERVICE_DIR = resolve(REPO_ROOT, 'apps/ai-service')
const PY = resolve(AI_SERVICE_DIR, '.venv/Scripts/python.exe')

// 驱动器:按文件路径加载生产模块(绕开 app 包 __init__ 的重依赖),按场景跑一条
// 判据链,输出 JSON。三个场景与票面验收草案 ①②③ 同族。
const DRIVER = `
import importlib.util, json, sys
scenario = sys.argv[1]
spec = importlib.util.spec_from_file_location("sse_contract", "app/core/sse_contract.py")
sc = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sc)
st = sc.StreamWatermark(subscription_id="sub-1")
out = {}
if scenario == "gap-resync":
    sc.apply_frame(st, frame_kind=sc.FRAME_KIND_SNAPSHOT, log_epoch=1, from_seq=0, to_seq=5)
    d = sc.apply_frame(st, frame_kind=sc.FRAME_KIND_DELTA, log_epoch=1, from_seq=9, to_seq=10)
    out = {"action": d.action, "applied": d.applied, "lastSeq": st.last_seq}
elif scenario == "ack-not-base":
    sc.mark_admission_acked(st)
    d = sc.apply_frame(st, frame_kind=sc.FRAME_KIND_DELTA, log_epoch=1, from_seq=0, to_seq=2)
    out = {"acked": st.admission_acked, "hasAppliedBase": st.has_applied_base, "action": d.action, "lastSeq": st.last_seq}
elif scenario == "recovery-online-delta":
    sc.apply_frame(st, frame_kind=sc.FRAME_KIND_SNAPSHOT, log_epoch=1, from_seq=0, to_seq=5)
    sc.begin_recovery(st, deadline_ms=300000)
    d = sc.apply_frame(st, frame_kind=sc.FRAME_KIND_DELTA, log_epoch=1, from_seq=5, to_seq=6)
    out = {"action": d.action, "pending": st.post_recovery_gap_pending, "lastSeq": st.last_seq}
else:
    raise SystemExit("unknown scenario: " + scenario)
print(json.dumps(out))
`

function runDriver(scenario) {
  if (!existsSync(PY)) throw new Error(`python 解释器缺失: ${PY}`)
  const stdout = execFileSync(PY, ['-c', DRIVER, scenario], {
    cwd: AI_SERVICE_DIR,
    encoding: 'utf8',
    // 本机交互会话下 node 给子进程建 stdin 管道会 EBUSY:本调用不消费 stdin,ignore 掉
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  return JSON.parse(stdout.trim().split('\n').pop())
}

test('① fromSeq != 本地 seq 的 delta ⇒ resync 且不写入水位', () => {
  const r = runDriver('gap-resync')
  assert.equal(r.action, 'resync')
  assert.equal(r.applied, false)
  assert.equal(r.lastSeq, 5) // 该 delta 不写入 summaries/水位
})

test('② ACK 已到但首帧未齐 ⇒ hasAppliedBase=false,任何 delta 都走 gap 分支', () => {
  const r = runDriver('ack-not-base')
  assert.equal(r.acked, true) // ACK 已到
  assert.equal(r.hasAppliedBase, false) // 但不是 base
  assert.equal(r.action, 'reject-no-base') // delta 不得当成基线
  assert.equal(r.lastSeq, null)
})

test('③ 恢复期注入 online delta ⇒ 只置 postRecoveryGapPending、不推进 seq', () => {
  const r = runDriver('recovery-online-delta')
  assert.equal(r.action, 'defer-recovery')
  assert.equal(r.pending, true)
  assert.equal(r.lastSeq, 5) // 水位不推进
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
