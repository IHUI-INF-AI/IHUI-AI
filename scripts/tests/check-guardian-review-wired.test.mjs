// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

// 镜像测试(§22c):scripts/check-guardian-review-wired.mjs 的判据锚点同步与
// 装车方向性证明。判据本体一律 import 源脚本的 __test__ 导出 —— 本文件禁止再抄
// 一份 decide/mask(§22c:镜像常量漂移 = 测试替缺陷背书)。
//
// 必含的三类证明(任务书钉死):
//  - 装配证明:runner 里没有本门时,不得把本门读成"已装车"(头注也不得声称已接线);
//    若 runner 已含本门,则注册必须成套(mode blocking + skipEnv),防"接了但接错";
//  - 阳性对照:把生产调用点摘掉 ⇒ decide 必红;
//  - 反向对照:调用形态只出现在注释/文档字符串/测试面 ⇒ 不算装车,仍红。
//
// 另加:真仓端到端(--worktree exit 0)与取材面形状锁(内容必须走 face-reader)。

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { __test__ as G } from '../check-guardian-review-wired.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..', '..')
const GATE_SRC = path.join(ROOT, 'scripts', 'check-guardian-review-wired.mjs')
const RUNNER_SRC = path.join(ROOT, 'scripts', 'guardian-runner.mjs')

const MODULE_OK = `
GUARDIAN_REVIEW_STATUS_NOT_REVIEWED = "not_reviewed"
GUARDIAN_REVIEW_STATUS_NO_ALTERNATIVE = "reviewed_no_alternative"
GUARDIAN_REVIEW_STATUS_ALTERNATIVE_FOUND = "reviewed_alternative_found"
class GuardianReviewResult:
    def to_event_payload(self):
        payload = {
            "status": self.status,
            "unavailable_reason": self.unavailable_reason,
        }
        return payload
def request_guardian_review(tool, args): ...
`
const CONSUMER_OK = `
from .guardian_review import request_guardian_review
class Loop:
    async def _request_approval(self, tc):
        review = await request_guardian_review(tc.name, tc.args)
        await self.emit(guardian_review=review.to_event_payload())
`
const files = (a, b) => [
  { path: G.MODULE_REL, text: a },
  { path: 'apps/ai-service/app/services/agent_loop_v2.py', text: b },
]

test('T1 装配证明:runner 未含本门时,门自身不得声称已接入提交链', () => {
  const runner = readFileSync(RUNNER_SRC, 'utf8')
  const gate = readFileSync(GATE_SRC, 'utf8')
  const wired = runner.includes('check-guardian-review-wired')
  if (!wired) {
    // 未接线是本交付的既定事实:头注若出现肯定式"已接/已注册/pre-commit 必跑"
    // 即为谎报(守门 89 R1 的立项型),这里用源码锁把方向钉死。
    assert.ok(
      !/已接(入)?\s*(pre-commit|提交链)|pre-commit\s*必跑|已注册进\s*guardian-runner/.test(gate),
      '本门未注册进 runner 时,脚本头注不得声称已接入提交链',
    )
    assert.ok(
      gate.includes('未') && gate.includes('主会话'),
      '头注必须如实写明接线归属(当前:未接入,由主会话接线)',
    )
  } else {
    // 已接线 ⇒ 注册必须成套:blocking + 与本门脚本一致的 skipEnv(成套性形状锁)。
    const entry = runner.slice(runner.indexOf('check-guardian-review-wired'))
    assert.ok(/mode:\s*'blocking'/.test(entry.slice(0, 2000)), '接线后本门必须是 blocking')
    assert.ok(
      entry.slice(0, 2000).includes('HUSKY_SKIP_GUARDIAN_REVIEW_WIRED'),
      '接线后注册块的 skipEnv 必须与本门实际读取的环境变量同名',
    )
  }
  // 本门声称的应急出口必须是真读到的(仓内多道门登记过"文档写了跑不通的出路")。
  const gateText = readFileSync(GATE_SRC, 'utf8')
  assert.ok(
    gateText.includes("process.env.HUSKY_SKIP_GUARDIAN_REVIEW_WIRED"),
    '声称 HUSKY_SKIP_GUARDIAN_REVIEW_WIRED 可跳过,脚本必须真的读它',
  )
})

test('T2 判据 import 锚点在位(§22d:import 不得触发 CLI main)', () => {
  const gate = readFileSync(GATE_SRC, 'utf8')
  assert.ok(gate.includes('export const __test__'), '源脚本必须 export __test__')
  assert.ok(gate.includes('isDirectRun'), '源脚本必须有 isDirectRun 入口守护')
  assert.equal(typeof G.decide, 'function')
  assert.equal(typeof G.maskPythonSurface, 'function')
  assert.equal(typeof G.extractResultPayloadBody, 'function')
})

test('T3 阳性对照:生产调用点在 ⇒ 绿;把调用点摘掉(import 仍在)⇒ 必红并点名 W1', () => {
  const ok = G.decide({ files: files(MODULE_OK, CONSUMER_OK) })
  assert.equal(ok.problems.length, 0, `happy 面不应有红:${JSON.stringify(ok.problems)}`)
  const unwired = G.decide({
    files: files(
      MODULE_OK,
      `
from .guardian_review import request_guardian_review
class Loop:
    async def x(self):
        return None
`,
    ),
  })
  assert.ok(
    unwired.problems.some((p) => p.startsWith('W1')),
    '摘掉调用点后本门必须红 —— 这条不红,阳性对照就是假的',
  )
})

test('T4 反向对照:注释/文档字符串/测试面的调用形态一律不算装车', () => {
  const comment = G.decide({
    files: files(
      MODULE_OK,
      `
# request_guardian_review(tc.name, tc.args) —— 说明性注释
class Loop:
    """文档字符串里也写 request_guardian_review( 一遍"""
`,
    ),
  })
  assert.ok(comment.problems.some((p) => p.startsWith('W1')), '注释/文档串提及不得被算作装车')
  const testOnly = G.decide({
    files: [
      { path: G.MODULE_REL, text: MODULE_OK },
      { path: 'apps/ai-service/tests/test_guardian_review.py', text: CONSUMER_OK },
    ],
  })
  assert.ok(testOnly.problems.some((p) => p.startsWith('W1')), '只有测试面调用不得算生产装车')
})

test('T5 折叠防线:出口模块之外手写 reviewed_* 字面量 ⇒ 红;只写在注释里 ⇒ 不红', () => {
  const forged = G.decide({
    files: files(
      MODULE_OK,
      CONSUMER_OK + '\ndef lie():\n    return {"status": "reviewed_no_alternative"}\n',
    ),
  })
  assert.ok(forged.problems.some((p) => p.startsWith('W3')), '"未复核"被别处冒充成通过必须判红')
  const explained = G.decide({
    files: files(MODULE_OK, CONSUMER_OK + '\n# 别处不得写 "reviewed_alternative_found"\n'),
  })
  assert.ok(
    !explained.problems.some((p) => p.startsWith('W3')),
    '判据不得把自己的解释文字判成违规(守门 131/70 同型)',
  )
})

test('T6 形状锁与空扫:载荷缺 unavailable_reason 键 / 出口模块缺失 / 0 枚举,各有确定红态', () => {
  const brokenShape = G.decide({
    files: files(MODULE_OK.replace('            "unavailable_reason": self.unavailable_reason,\n', ''), CONSUMER_OK),
  })
  assert.ok(brokenShape.problems.some((p) => p.startsWith('W2')), '三态形状键丢失必须判红')
  const gone = G.decide({ files: files('', CONSUMER_OK).filter((f) => f.path !== G.MODULE_REL) })
  assert.ok(gone.problems.some((p) => p.startsWith('W2')), '出口模块整体消失(摘线)必须判红')
  const empty = G.decide({ files: [] })
  assert.equal(empty.problems.length, 0)
  assert.ok(empty.undetermined.length > 0, '空枚举判"未判定",绝不记绿')
})

test('T7 真仓端到端:当前工作树(含本交付)喂 --worktree 面必须 exit 0', () => {
  const r = spawnSync(
    process.execPath,
    [path.join(ROOT, 'scripts', 'check-guardian-review-wired.mjs'), '--worktree'],
    { cwd: ROOT, encoding: 'utf8', windowsHide: true, timeout: 180_000 },
  )
  assert.equal(r.status, 0, `worktree 面应绿,实际 rc=${r.status}\n${r.stdout}\n${r.stderr}`)
  assert.ok(r.stdout.includes('已装车'))
})

test('T8 取材面形状锁:内容一律经 face-reader,门不得自己散写 git 读正文(守门 118 型)', () => {
  const gate = readFileSync(GATE_SRC, 'utf8')
  assert.ok(gate.includes("from './lib/face-reader.mjs'"), '必须引 face-reader')
  assert.ok(gate.includes('catBatch('), 'head/staged 面内容必须走 catBatch(层读取口)')
  assert.ok(!/\bgit show\b/.test(gate), '不得自己 `git show` 取被审内容')
  assert.ok(!gate.includes('execSync('), '不得用 execSync 拼 git 读内容')
  assert.ok(gate.includes('readWorktreeFile('), 'worktree 面必须走层的 readWorktreeFile')
})

test('T9 遮罩边界:多行三引号串与串内 # 号不得把状态机带偏', () => {
  const src = [
    'a = "值里带 # 号不是注释"',
    "b = '''",
    'request_guardian_review(在 docstring 里不算)',
    "'''",
    'c = request_guardian_review(1)  # 真调用',
  ].join('\n')
  const masked = G.maskPythonSurface(src)
  const lines = masked.split('\n')
  assert.ok(!lines[0].includes('值里带'), '普通串内容要被抹掉')
  assert.ok(lines[0].includes('# 号') === false, '串内 # 不得被当注释起点(整行后半不得被吞)')
  assert.ok(!lines[2].includes('request_guardian_review'), 'docstring 内的调用形态必须被抹')
  assert.ok(lines[4].includes('request_guardian_review('), '真调用必须保留')
  assert.ok(!lines[4].includes('真调用'), '行尾注释必须被抹')
  assert.equal(lines.length, 5, '遮罩必须等行(行号不变)')
})
