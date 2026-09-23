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
//   runner 下发的 --staged 不参与收窄:锚点/契约/清单条目都是"整仓属性",
//   按暂存集收范围恰好会放过"删掉别处锚点"这一类(与守门 78 同取向)。

import { existsSync, readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
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

/**
 * 判的是**仓库内容**,不是共享工作区里某个人未提交的缓冲区(与守门 77 同一取向,2026-09-24 补)。
 *
 * 原实现一律 `readFileSync`,于是并行会话的半截草稿会把无关提交钉红:2026-09-24 实测
 * `AiAssistantN8nScreen.tsx` 的 5 个锚点在 HEAD 里全在、在别人的未提交重写里全没了 →
 * [57] 恒红,而本会话只改了守门脚本。恒红的唯一结局是人人 --no-verify,连带把真正防回归的
 * 判据一起关掉(见 AGENTS §12)。
 *
 * 取内容规则:
 *   该路径已在暂存区(≠ HEAD)→ 取**索引 blob** = 这次提交会带走什么;
 *   该路径只有工作树改动(未暂存)→ 取 **HEAD blob** = 别人没提交的东西不算本仓状态;
 *   与 HEAD 一致 → 直读磁盘(三者等价,免为 66 个锚定文件逐个开进程)。
 */
const GIT_BIN = process.env.GIT_BIN || (process.platform === 'win32' ? 'C:/Program Files/Git/bin/git.exe' : 'git')
let repoUsable = true
function gitAt(args) {
  if (!repoUsable) return null
  try {
    return execFileSync(GIT_BIN, ['-c', 'safe.directory=*', ...args], {
      cwd: ROOT,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      windowsHide: true,
      timeout: 30_000,
      stdio: ['ignore', 'pipe', 'ignore'],
    })
  } catch {
    return null
  }
}
const nameSet = (args) => {
  const out = gitAt(args)
  if (out === null) {
    repoUsable = false
    return null
  }
  return new Set(out.split('\n').filter(Boolean).map((l) => l.replaceAll('\\', '/')))
}
const STAGED = nameSet(['diff', '--name-only', '--cached'])
const WORKTREE_DIRTY = nameSet(['diff', '--name-only'])

/**
 * 纯决策(自检直接复用):给一个路径的三种"是否偏离"布尔,返回该读哪一份内容。
 *   staged            → 'index'(= 这次提交会带走的内容)
 *   仅工作树脏        → 'head'(别人没提交的缓冲区不算本仓状态)
 *   干净              → 'disk'(与 index/HEAD 等价,免开进程)
 */
export function pickSource({ staged, worktreeDirty }) {
  if (staged) return 'index'
  if (worktreeDirty) return 'head'
  return 'disk'
}

export function contentAt(rel, repoRoot = ROOT) {
  const norm = rel.replaceAll('\\', '/')
  const abs = join(repoRoot, norm)
  const readDisk = () => (existsSync(abs) ? readFileSync(abs, 'utf8') : '')
  if (resolve(repoRoot) !== resolve(ROOT) || !repoUsable) return readDisk()
  const src = pickSource({ staged: !!STAGED?.has(norm), worktreeDirty: !!WORKTREE_DIRTY?.has(norm) })
  if (src === 'disk') return readDisk()
  const blob = gitAt(['show', src === 'index' ? `:${norm}` : `HEAD:${norm}`])
  return blob !== null ? blob : readDisk()
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
      const text = contentAt(anchor.file, repoRoot)
      if (!text) {
        violations.push({ kind: 'anchor-missing-file', id: el.id, detail: anchor.file })
        continue
      }
      if (anchor.mustMatch && !text.includes(anchor.mustMatch)) {
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
  // 内容来源决策(2026-09-24 补):判仓库内容而非共享工作区快照,四个方向都要钉住
  const srcCases = [
    [{ staged: true, worktreeDirty: true }, 'index', '已暂存 → 判索引(这次提交会带走的内容)'],
    [{ staged: false, worktreeDirty: true }, 'head', '只有工作树脏 → 判 HEAD(别人未提交的缓冲区不算本仓状态)'],
    [{ staged: false, worktreeDirty: false }, 'disk', '干净文件 → 直读磁盘(与 index/HEAD 等价,免开进程)'],
    [{ staged: true, worktreeDirty: false }, 'index', '只暂存未再改 → 仍判索引'],
  ]
  for (const [inp, want, label] of srcCases) {
    const got = pickSource(inp)
    const ok = got === want
    if (!ok) bad++
    console.log(`${ok ? '✓' : '✗'} 内容来源 ${label} → ${got}(期望 ${want})`)
  }
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
  // 计划文本与两份契约同样按**仓库内容**判(见 contentAt 注释):PROJECT_PLAN.md 是共享工作区里
  // 最容易被并发会话按旧基线整文件覆写的一份,按磁盘读会把"别人没提交的旧副本"当成本仓清单。
  const planText = contentAt('PROJECT_PLAN.md')
  const relOpt = (p) => (p.startsWith(ROOT) ? p.slice(ROOT.length + 1).replaceAll('\\', '/') : null)
  const readOpt = (p) => {
    const rel = relOpt(resolve(p))
    return rel ? contentAt(rel) : existsSync(p) ? readFileSync(p, 'utf8') : ''
  }
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
