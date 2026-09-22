#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 对话流元素覆盖守门(PROJECT_PLAN.md D51 / 验收门 H13)
//
// 单一事实源 = scripts/data/chat-flow-elements.json(已实现锚点 + 声明事件 + 基线)
//            + PROJECT_PLAN.md 第四轮 `- [ ] **Dnn …(G-xx)**` 任务行(planned 元素,实时解析)。
// 三类违规即阻塞:
//   ① 期望元素锚点漂移(已实现元素的文件或关键标识不见 → 说明渲染位被删/改名)
//   ② 元素声明依赖的契约事件在两端契约里找不到(ai-service 与 packages/shared 必须同时有)
//   ③ 清单条目数倒退(低于 entryCountBaseline = 有人删了任务行或删了已实现元素而未说明)
// 设计取向:planned 元素**不**要求锚点(否则入库即恒红),增长只抬基线不拦人。
//
// 用法:node scripts/check-chat-element-coverage.mjs [--self-test] [--json]

import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DATA_FILE = join(ROOT, 'scripts', 'data', 'chat-flow-elements.json')
const CONTRACT_PY = join(ROOT, 'apps', 'ai-service', 'app', 'core', 'sse_contract.py')
const CONTRACT_TS = join(ROOT, 'packages', 'shared', 'src', 'sse', 'contract.ts')
const SKIP_ENV = 'HUSKY_SKIP_CHAT_ELEMENT_COVERAGE'

function loadJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

/** 从 PROJECT_PLAN.md 解析第四轮任务行 → planned 元素与其 G-ID */
export function parsePlanned(planText, taskLinePattern, gapIdPattern) {
  const planned = []
  const lineRe = new RegExp(taskLinePattern, 'mu')
  const gapRe = new RegExp(gapIdPattern, 'gu')
  for (const line of planText.split('\n')) {
    const hit = lineRe.exec(line)
    if (!hit) continue
    const gaps = [...new Set(line.match(gapRe) ?? [])]
    planned.push({ task: hit[2], done: hit[1] === 'x', title: line.slice(hit.index).slice(0, 90), gaps })
  }
  return planned
}

export function checkAnchors(implemented, repoRoot = ROOT) {
  const violations = []
  for (const el of implemented) {
    for (const anchor of el.anchors ?? []) {
      const abs = join(repoRoot, anchor.file)
      if (!existsSync(abs)) {
        violations.push({ kind: 'anchor-missing-file', id: el.id, detail: anchor.file })
        continue
      }
      if (anchor.mustMatch && !readFileSync(abs, 'utf8').includes(anchor.mustMatch)) {
        violations.push({
          kind: 'anchor-missing-marker',
          id: el.id,
          detail: `${anchor.file} 内找不到「${anchor.mustMatch}」`,
        })
      }
    }
  }
  return violations
}

export function checkEvents(implemented, contractPyText, contractTsText) {
  const violations = []
  for (const el of implemented) {
    for (const ev of el.events ?? []) {
      const inPy = contractPyText.includes(`"${ev}"`) || contractPyText.includes(`'${ev}'`)
      const inTs = contractTsText.includes(`"${ev}"`) || contractTsText.includes(`'${ev}'`)
      if (!inPy || !inTs) {
        violations.push({
          kind: 'event-contract-drift',
          id: el.id,
          detail: `${ev}: ai-service=${inPy ? '有' : '无'} shared=${inTs ? '有' : '无'}(两端必须同时声明)`,
        })
      }
    }
  }
  return violations
}

export function checkBaseline(entryCount, baseline) {
  return entryCount < baseline
    ? [
        {
          kind: 'inventory-regression',
          id: '(inventory)',
          detail: `清单条目 ${entryCount} < 基线 ${baseline} —— 删任务行或删已实现元素必须同 PR 说明理由并调基线`,
        },
      ]
    : []
}

export function runChecks({ data, planText, contractPy, contractTs }) {
  const planned = parsePlanned(planText, data.planSource.taskLinePattern, data.planSource.gapIdPattern)
  const gapIds = new Set()
  for (const p of planned) for (const g of p.gaps) gapIds.add(g)
  const anchorViolations = checkAnchors(data.implemented)
  const eventViolations = checkEvents(data.implemented, contractPy, contractTs)
  const entryCount = gapIds.size + data.implemented.length
  const baselineViolations = checkBaseline(entryCount, data.entryCountBaseline)
  return {
    plannedTasks: planned.length,
    gapIds: gapIds.size,
    implemented: data.implemented.length,
    entryCount,
    baseline: data.entryCountBaseline,
    violations: [...anchorViolations, ...eventViolations, ...baselineViolations],
  }
}

function selfTest() {
  // 判据 pattern 只有一份真相:优先取数据文件里的,读不到才用等价内联值(并显式告警)
  let planSource
  try {
    planSource = loadJson(DATA_FILE).planSource
  } catch {
    console.warn('⚠️ self-test 读不到数据文件,回退内联 pattern(可能与实际判据漂移)')
    planSource = {
      taskLinePattern: '^- \\[([ x])\\]\\s*(?:✅[^*]*)?\\*\\*(D[0-9]+)',
      gapIdPattern: 'G-[0-9]{2,3}',
    }
  }
  const base = {
    planSource,
    entryCountBaseline: 1,
    implemented: [{ id: 'ok', anchors: [{ file: 'package.json', mustMatch: '"name"' }], events: [] }],
  }
  const plan = '- [ ] **D90 示例元素(G-140)**:x\n- [x] ✅(2026-09-20)**D27 交付审查(G-29)**:y\n'
  const cases = [
    ['正常态', { ...base, implemented: [{ id: 'ok', anchors: [{ file: 'package.json' }] }] }, plan, 0],
    [
      '① 锚点文件不见',
      { ...base, implemented: [{ id: 'bad', anchors: [{ file: 'nope/nothere.tsx' }] }] },
      plan,
      1,
    ],
    [
      '① 锚点标识漂移',
      { ...base, implemented: [{ id: 'bad', anchors: [{ file: 'package.json', mustMatch: 'ZZZ_不存在' }] }] },
      plan,
      1,
    ],
    [
      '② 事件单端缺失',
      {
        ...base,
        implemented: [{ id: 'ev', anchors: [], events: ['brand_new_event'] }],
      },
      plan,
      1,
    ],
    ['③ 条目数倒退', { ...base, entryCountBaseline: 999 }, plan, 1],
  ]
  let bad = 0
  for (const [label, data, planText, expectedMin] of cases) {
    const res = runChecks({ data, planText, contractPy: '', contractTs: '' })
    const got = Math.min(res.violations.length, 1)
    const ok = got === Math.min(expectedMin, 1) && (expectedMin === 0 ? res.violations.length === 0 : true)
    if (!ok) bad++
    console.log(`${ok ? '✓' : '✗'} ${label} → ${res.violations.length} 违规(期望 ${expectedMin === 0 ? '0' : '≥1'})`)
  }
  // 事件双端齐备的正例:必须不报违规
  const evOk = runChecks({
    data: { ...base, implemented: [{ id: 'ev', anchors: [], events: ['usage'] }] },
    planText: plan,
    contractPy: 'EVENTS = ["usage"]',
    contractTs: 'export const E = ["usage"]',
  })
  const evOkPass = evOk.violations.length === 0
  if (!evOkPass) bad++
  console.log(`${evOkPass ? '✓' : '✗'} ② 正例(双端都有)→ ${evOk.violations.length} 违规(期望 0)`)
  const parsed = runChecks({ data: base, planText: plan, contractPy: '', contractTs: '' })
  const parseOk = parsed.plannedTasks === 2 && parsed.gapIds === 2 && parsed.violations.length === 0
  if (!parseOk) bad++
  console.log(
    `${parseOk ? '✓' : '✗'} 解析判据:任务 ${parsed.plannedTasks}(期望 2)、G-ID ${parsed.gapIds}(期望 2)、违规 ${parsed.violations.length}(期望 0)`,
  )
  console.log(bad === 0 ? '✅ self-test 全过' : `❌ self-test 失败 ${bad} 例`)
  return bad === 0 ? 0 : 1
}

function main(argv) {
  if (argv.includes('--self-test')) return selfTest()
  if (process.env[SKIP_ENV] === '1') {
    console.warn(`⚠️  [chat-element-coverage] 已用 ${SKIP_ENV}=1 跳过(紧急通道,须在 PROJECT_PLAN.md 说明)`)
    return 0
  }
  const data = loadJson(DATA_FILE)
  const planText = readFileSync(join(ROOT, 'PROJECT_PLAN.md'), 'utf8')
  const readOpt = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : '')
  const res = runChecks({
    data,
    planText,
    contractPy: readOpt(CONTRACT_PY),
    contractTs: readOpt(CONTRACT_TS),
  })
  if (argv.includes('--json')) {
    console.log(JSON.stringify({ ...res, violations: res.violations }, null, 2))
  }
  if (res.violations.length === 0) {
    console.log(
      `✅ [chat-element-coverage] 清单 ${res.entryCount} 条(G-ID ${res.gapIds} + 已实现锚点 ${res.implemented})、planned 任务 ${res.plannedTasks} 行,锚点与契约均一致`,
    )
    return 0
  }
  console.error(`❌ [chat-element-coverage] ${res.violations.length} 处违规(清单 ${res.entryCount} 条):`)
  for (const v of res.violations) console.error(`  ${v.kind} :: ${v.id} :: ${v.detail}`)
  console.error(
    `\n  💡 修复:渲染位被删/改名 → 恢复或同 PR 更新 scripts/data/chat-flow-elements.json 并说明理由;\n     事件单端缺 → 补 sse_contract.py 与 packages/shared/src/sse/contract.ts 两处;\n     条目倒退 → 恢复任务行或说明为何撤销。\n     自检:node scripts/check-chat-element-coverage.mjs --self-test\n     紧急跳过(不推荐):${SKIP_ENV}=1 git commit ...`,
  )
  return 1
}

export const __test__ = { parsePlanned, checkAnchors, checkEvents, checkBaseline, runChecks }

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main(process.argv.slice(2)))
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
