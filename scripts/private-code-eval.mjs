#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * private-code-eval.mjs —— 代码面私有尺子(2026-11-26 立,RP-45 后续)
 *
 * 和模型轴的 `private_eval_run.py` 分工:
 *   - 模型轴:候选模型在固定题面上的成对胜率(测"模型换得好不好");
 *   - 代码轴:候选工作树在**仓外隐藏用例**上的通过数(测"这版代码有没有把别处弄坏");
 * 本器只做代码轴;用例文件不进 git、不向会话暴露,换 main 快照即可做基线对比。
 *
 * 契约:
 *   node scripts/private-code-eval.mjs --target <repo> [--cases <file>] [--json]
 *   node scripts/private-code-eval.mjs --self-test
 * 退出码:0=全过 / 1=有用例失败 / 2=未判定(取不到结果)。
 */
import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DEFAULT_CASES = process.env.IHUI_CODE_CASES || 'D:/DevEnv/private-eval/code-cases/code-cases.mjs'

export function parseEvalOutput(text = '') {
  const lines = String(text).split('\n').map((l) => l.trim()).filter(Boolean)
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    if (!lines[i].startsWith('{')) continue
    try {
      const obj = JSON.parse(lines[i])
      if (obj && Number.isInteger(obj.total) && Number.isInteger(obj.passed) && Number.isInteger(obj.failed)) return obj
    } catch {
      // 不是汇总行就继续往前找,不猜。
    }
  }
  return null
}

export function runCodeEval({ target, casesFile = DEFAULT_CASES, timeoutMs = 120_000 } = {}) {
  const t = String(target ?? '').trim()
  if (!t || !existsSync(t)) {
    return { state: 'undetermined', target: t, total: 0, passed: 0, failed: 0, cases: [], why: `被测仓根不在位:${t}` }
  }
  const c = String(casesFile ?? '').trim()
  if (!c || !existsSync(c)) {
    return { state: 'undetermined', target: t, total: 0, passed: 0, failed: 0, cases: [], why: `隐藏用例文件不在位:${c}` }
  }
  const r = spawnSync(process.execPath, [c], {
    cwd: t,
    env: { ...process.env, IHUI_EVAL_TARGET: t },
    timeout: Number.isInteger(timeoutMs) && timeoutMs > 0 ? timeoutMs : 120_000,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    windowsHide: true,
  })
  const out = `${String(r.stdout ?? '')}\n${String(r.stderr ?? '')}`.trim()
  if (r.error) {
    return { state: 'undetermined', target: t, total: 0, passed: 0, failed: 0, cases: [], why: `起用例进程失败:${r.error.code || r.error.message}` }
  }
  const summary = parseEvalOutput(out)
  if (!summary) {
    return { state: 'undetermined', target: t, total: 0, passed: 0, failed: 0, cases: [], why: `用例进程未产出可解析汇总(status=${r.status})` }
  }
  return {
    state: summary.failed === 0 ? 'ok' : 'cases-failed',
    target: t,
    total: summary.total,
    passed: summary.passed,
    failed: summary.failed,
    cases: summary.cases ?? [],
    why: summary.failed === 0 ? '' : `${summary.failed}/${summary.total} 条隐藏用例失败`,
  }
}

/**
 * 只比较通过数,不做加权:候选通过数少于基线 / 失败数多于基线 ⇒ regression。
 * 两侧题数必须一致;任一侧未判定 ⇒ undetermined(不拿"没跑"冒充"没退化")。
 */
export function compareCodeEval(candidate, baseline) {
  if (!candidate || !baseline) return { state: 'undetermined', why: '候选或基线结果缺失' }
  if (candidate.state === 'undetermined' || baseline.state === 'undetermined') {
    return { state: 'undetermined', why: `两侧未判定:候选=${candidate.state} 基线=${baseline.state}` }
  }
  if (candidate.total !== baseline.total) {
    return { state: 'undetermined', why: `两侧题数不一致(候选 ${candidate.total} / 基线 ${baseline.total})` }
  }
  if (candidate.failed > baseline.failed || candidate.passed < baseline.passed) {
    return {
      state: 'regression',
      why: `候选 ${candidate.passed}/${candidate.total} 低于基线 ${baseline.passed}/${baseline.total}`,
      delta: candidate.passed - baseline.passed,
    }
  }
  return {
    state: 'ok',
    why: `候选 ${candidate.passed}/${candidate.total} ≥ 基线 ${baseline.passed}/${baseline.total}`,
    delta: candidate.passed - baseline.passed,
  }
}

function selfTest() {
  const dir = mkdtempSync(path.join(tmpdir(), 'ihui-code-eval-'))
  const cases = path.join(dir, 'cases.mjs')
  writeFileSync(
    cases,
    `const ok = true; console.log('CASE ok a'); console.log(JSON.stringify({total:2,passed:1,failed:1,cases:[{id:'a',ok:true},{id:'b',ok:false}]})); process.exit(1)\n`,
    'utf8',
  )
  const r = runCodeEval({ target: ROOT, casesFile: cases, timeoutMs: 30_000 })
  const checks = [
    [r.state === 'cases-failed', `应识别 cases-failed,实得 ${r.state}`],
    [r.total === 2 && r.passed === 1 && r.failed === 1, `汇总解析错:${JSON.stringify({ total: r.total, passed: r.passed, failed: r.failed })}`],
  ]
  const okCmp = compareCodeEval(
    { state: 'ok', total: 2, passed: 2, failed: 0 },
    { state: 'ok', total: 2, passed: 2, failed: 0 },
  )
  const badCmp = compareCodeEval(
    { state: 'ok', total: 2, passed: 1, failed: 1 },
    { state: 'ok', total: 2, passed: 2, failed: 0 },
  )
  checks.push([okCmp.state === 'ok', `同分应 ok,实得 ${okCmp.state}`])
  checks.push([badCmp.state === 'regression', `少过一题应 regression,实得 ${badCmp.state}`])
  checks.push([
    compareCodeEval({ state: 'undetermined', total: 0 }, { state: 'ok', total: 2, passed: 2 }).state === 'undetermined',
    '一侧未判定不得判 ok',
  ])
  rmSync(dir, { recursive: true, force: true })
  const bad = checks.filter(([ok]) => !ok)
  if (bad.length) {
    console.error(`self-test 失败:${bad.map(([, m]) => m).join('; ')}`)
    return 1
  }
  console.log('private-code-eval self-test ok')
  return 0
}

function parseArgs(argv) {
  const out = { target: '', casesFile: DEFAULT_CASES, json: false, selfTest: false }
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]
    if (a === '--self-test') out.selfTest = true
    else if (a === '--json') out.json = true
    else if (a === '--target') out.target = argv[++i] ?? ''
    else if (a.startsWith('--target=')) out.target = a.slice('--target='.length)
    else if (a === '--cases') out.casesFile = argv[++i] ?? ''
    else if (a.startsWith('--cases=')) out.casesFile = a.slice('--cases='.length)
    else {
      console.error(`未知参数:${a}`)
      process.exit(2)
    }
  }
  return out
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const args = parseArgs(process.argv.slice(2))
  if (args.selfTest) process.exit(selfTest())
  const r = runCodeEval({ target: args.target || ROOT, casesFile: args.casesFile })
  if (args.json) console.log(JSON.stringify(r))
  else {
    console.log(`代码面私有尺子:${r.state}  ${r.passed}/${r.total} 过  target=${r.target}`)
    for (const c of r.cases) if (!c.ok) console.log(`  ✗ ${c.id}: ${c.error ?? ''}`)
    if (r.why) console.log(`  ${r.why}`)
  }
  process.exit(r.state === 'ok' ? 0 : r.state === 'cases-failed' ? 1 : 2)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
