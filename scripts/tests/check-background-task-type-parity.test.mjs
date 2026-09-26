// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * §22c 镜像测试 —— scripts/check-background-task-type-parity.mjs(V3 #51 判据 6)
 *
 * 这里刻意**不重跑判据本体的正反成对用例**(那些住在 `--self-test`,现测例数以该命令末行为准;
 * 在本文件再抄一遍就是"测试只复读实现"的复读机型)。本文件只管四件 self-test 结构上做不到的事:
 *   T1 判据确实从**真仓**读到东西(阳性对照)——只活在夹具里的判据等于没有判据
 *   T2 接线成套性:注册进提交链就必须 blocking + skipEnv 齐备;没注册就不许自称已接
 *   T3 CLI 端到端三种退出码(self-test / 两面旗同给 / --root 越档)
 *   T4 取材面与实现唯一性(源码级反向锁):必须走 face-reader 的读取入口,
 *      不得按磁盘 `readFileSync(join(ROOT…))` 判被审内容,也不得在测试里出现第二份判据正则
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

import { __test__ as parity } from '../check-background-task-type-parity.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const SCRIPTS_DIR = resolve(HERE, '..')
const ROOT = resolve(SCRIPTS_DIR, '..')
const GATE = join(SCRIPTS_DIR, 'check-background-task-type-parity.mjs')
const GATE_SRC = readFileSync(GATE, 'utf8')
const RUNNER_SRC = readFileSync(join(SCRIPTS_DIR, 'guardian-runner.mjs'), 'utf8')

function runGate(argv) {
  return execFileSync(process.execPath, [GATE, ...argv], {
    cwd: ROOT,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 120000,
  })
}

function runGateStatus(argv) {
  try {
    const out = runGate(argv)
    return { code: 0, out }
  } catch (e) {
    return { code: e.status === undefined ? -1 : e.status, out: String(e.stdout || '') + String(e.stderr || '') }
  }
}

test('T1 真仓阳性对照:判据必须看得见本仓实际产出的形态,且现读为零违规', () => {
  const inputs = parity.readInputs(ROOT, 'worktree')
  const out = parity.judge(inputs)
  const real = out.reg.implemented
  for (const t of ['long_running_command', 'test_suite', 'code_index', 'batch_llm', 'web_batch', 'patrol']) {
    if (!real.includes(t)) throw new Error(`真实 executor 未被判据看见:${t} —— 判据对着一份假想结构打分`)
  }
  if (out.violations.length > 0) {
    throw new Error(`真仓现读不应为红(红就是恒红门,唯一结局是逼人跳门):${out.violations.join(' | ')}`)
  }
  if (!['own-whitelist', 'delegated'].includes(out.advertisedKind)) {
    throw new Error(`广告面形态未认出:${out.advertisedKind}(两种合法形态之外就是判据失明)`)
  }
})

test('T1b P4 欠账账必须与真仓现读的未接线集合逐字相等', () => {
  const inputs = parity.readInputs(ROOT, 'worktree')
  const out = parity.judge(inputs)
  if (out.advertisedKind === 'delegated') {
    // 工具层已整体委托:未接线集合按定义为空,账本必须已被清空
    if (parity.EXPECTED_UNWIRED_IN_MCP_SERVER.length !== 0) {
      throw new Error('mcp_server 已委托,但账本还有行 —— 删掉 EXPECTED_UNWIRED_IN_MCP_SERVER 的条目')
    }
    return
  }
  const unwired = out.reg.implemented.filter((t) => !out.advertised.includes(t)).sort()
  const ledger = [...parity.EXPECTED_UNWIRED_IN_MCP_SERVER].sort()
  if (JSON.stringify(unwired) !== JSON.stringify(ledger)) {
    throw new Error(
      `账本与实态分叉:实读未接线 [${unwired.join(', ')}] vs 账本 [${ledger.join(', ')}]` +
        ' —— 接线完成后必须删掉对应行(守门 107/118 的清单腐烂同型)',
    )
  }
})

test('T2 接线成套性:注册进提交链必须 blocking + skipEnv;未注册不得自称已接', () => {
  const at = RUNNER_SRC.indexOf('check-background-task-type-parity.mjs')
  const registered = at >= 0
  if (registered) {
    // 按大括号配对取出**本门自己那条**注册项。
    // 上一版取"脚本名前后各 400 字符",会跨进相邻门那一条 ⇒ 别人有 blocking 就算我有(§装车证明要问结构位)。
    const open = RUNNER_SRC.lastIndexOf('{', at)
    let depth = 0
    let end = -1
    for (let i = open; i < RUNNER_SRC.length; i++) {
      const c = RUNNER_SRC[i]
      if (c === '{') depth++
      else if (c === '}') {
        depth--
        if (depth === 0) {
          end = i + 1
          break
        }
      }
    }
    if (end < 0) throw new Error('注册项花括号不配对 ⇒ 取不到本门条目,不猜')
    const block = RUNNER_SRC.slice(open, end)
    // 本仓 runner 的定级字段是 `mode: 'blocking'`(现读 167 处均此形),不存在 `blocking: true` 这种写法。
    if (!/mode:\s*'blocking'/.test(block)) {
      throw new Error('已注册但条目不是 mode: blocking —— 判据存在却不拦提交等于没有')
    }
    if (!block.includes('HUSKY_SKIP_BG_TASK_TYPE_PARITY')) {
      throw new Error('已注册但缺 skipEnv 应急出口(§12e:无出口的 blocking 门只会逼人跳全部门)')
    }
    if (!/stagedTriggers:\s*\[[^\]]*apps\/ai-service/.test(block)) {
      throw new Error('已注册但 stagedTriggers 不含 apps/ai-service ⇒ 改执行器的那枚提交根本不唤起本门(判据存在而永不调用 = 没有)')
    }
  } else if (/集成位置[^\n]*pre-commit|已接 pre-commit/.test(GATE_SRC)) {
    throw new Error('头注自称已接 pre-commit,而 guardian-runner 里没有它 —— 造好没装车(守门 89 R1 同型)')
  }
})

test('T3 CLI 端到端:self-test 退 0、两面旗同给退 2、--root 越档退 2', () => {
  const st = runGateStatus(['--self-test'])
  if (st.code !== 0) throw new Error(`--self-test 必须整绿,实得 exit=${st.code}\n${st.out}`)
  const both = runGateStatus(['--staged', '--worktree'])
  if (both.code !== 2) throw new Error(`两面旗同给必须判死(2),实得 ${both.code}`)
  const rootMis = runGateStatus(['--root', ROOT])
  if (rootMis.code !== 2) throw new Error('--root 只允许配 --worktree,否则必须判死,实得 ' + rootMis.code)
  const wt = runGateStatus(['--worktree'])
  if (wt.code !== 0) throw new Error(`--worktree 面必须绿,实得 ${wt.code}\n${wt.out}`)
  const json = runGate(['--worktree', '--json'])
  const parsed = JSON.parse(json)
  if (!Array.isArray(parsed.implemented) || parsed.implemented.length < 6) {
    throw new Error('--json 结论必须含实现面且不得空')
  }
})

test('T4 取材面与实现唯一性(源码级反向锁)', () => {
  if (!/from '\.\/lib\/face-reader\.mjs'/.test(GATE_SRC)) throw new Error('未走统一取材层 face-reader(守门 118 的半接线同型)')
  if (!GATE_SRC.includes('catBatch(')) throw new Error('未调用层的读取入口 catBatch( ⇒ 内容可能仍按磁盘/自派生 git 取')
  if (/readFileSync\(\s*join\(\s*ROOT/.test(GATE_SRC)) throw new Error('不得按磁盘读被审内容(共享工作树滞后 HEAD,会把恒红与假绿来回抛)')
  if (!/export const __test__ = \{/.test(GATE_SRC)) throw new Error('缺 __test__ 导出 ⇒ 测试只能复制判据(§22c 明令禁止)')
  // 导出面按**运行时对象**核(按 `key:` 正则核会漏 shorthand 写法 —— 那是我自己第一次踩到的假红)
  const exported = Object.keys(parity)
  for (const key of ['judge', 'parseRegistryTypes', 'parseAdvertised', 'maskPyNoise', 'readInputs', 'fixtureInputs', 'pickFace', 'EXPECTED_UNWIRED_IN_MCP_SERVER', 'FIXTURE_LEDGER']) {
    if (!exported.includes(key)) throw new Error(`__test__ 少了 ${key} —— 导出漂了,测试会退化成复制`)
  }
  // 反向锁:本测试文件自己**不得**再抄一份判据正则(判据只住源脚本)
  const selfSrc = readFileSync(join(HERE, 'check-background-task-type-parity.test.mjs'), 'utf8')
  if (/task_type\\s\*=/.test(selfSrc)) throw new Error('镜像测试里出现了第二份 task_type 解析判据(§22c 镜像常量漂移)')
})

test('T5 干净构造面必须零违规(正向证明:名单/判据不是死表)', () => {
  const clean = parity.judge(parity.fixtureInputs(), parity.FIXTURE_LEDGER)
  if (clean.violations.length !== 0) {
    throw new Error(`连自造的正确形状都被判红 ⇒ 本门一出生即恒红:${clean.violations.join(' | ')}`)
  }
  // 遮噪正向证明:注释里的形态不得计入,代码里的必须计入
  const masked = parity.maskPyNoise('# task_type="ghost"\nS = ExecutorSpec(task_type="real", stub=True)\n')
  if (masked.includes('ghost')) throw new Error('注释未被遮罩:门会把"解释自己的散文"判成违规(守门 70/131 同型)')
  if (!masked.includes('task_type="real"')) throw new Error('代码里的 task_type 被一起抹掉了 ⇒ 判据失明')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
