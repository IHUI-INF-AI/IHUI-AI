#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 常驻对账矩阵生成器(2026-09-29 由票 D157 从 docs/benchmark-evidence/2026-09/diff-matrix.mjs 升为 scripts/ 常驻)。
// 把四份竞品/我方 inventory 清单归一后按 16 类骨架并排,标出"竞品有而我方无"。
// 全程只读输入;判定不了的一律落 undetermined 并计数(不得把"没解析到"写成"没有")。
//
// 用法:
//   node scripts/benchmark-diff-matrix.mjs                 默认取证面 = docs/benchmark-evidence/2026-09
//   node scripts/benchmark-diff-matrix.mjs <取证目录>      指定别的落点(例如某轮重跑的新快照)
//   node scripts/benchmark-diff-matrix.mjs --self-test     合成两份最小清单,断言矩阵"量得到东西"
//   node scripts/benchmark-diff-matrix.mjs --help
//
// 搬家唯一必须改的路径常量 = 默认取证面:docs 版取"脚本自身所在目录",而本脚本现在住在 scripts/,
// 所以这里显式指回证据目录(清单落在那儿)。归一/归类判据(CATS、小节-条目解析)逐字继承,未改。
//
// 为什么从证据目录搬进 scripts/:它此前和 asar-read.mjs 一样**没有自检** —— 解析器坏了没人喊
// (本仓反复登记的"造好没装车 / 有代码无尺子"那一型)。现在的三把尺子:
//   ① 自检入口 --self-test:真形态最小清单,断言条目数/类别命中**不为 0**,并含反向对照
//      (我方有条目的一类不得出现在"竞品有而我方零"里 —— 判序写反当场红);
//   ② §22c 镜像测试 scripts/tests/benchmark-evidence-tools.test.mjs:除端到端 spawn 外,还拿
//      **真语料**(docs/benchmark-evidence/2026-09 的三份清单)喂判据,防"镜像测试只复读实现";
//   ③ §22d 的 isDirectRun:CLI 入口与模块导出分离,测试 import 本文件不得触发 main()。
// 刻意不接提交链:它判的是竞品清单文档与"我方侧是否已交付",与本次提交内容无关 ⇒ 接进链就是恒红门
// (AGENTS §12e)。文件名不以 check|scan|guard 开头 ⇒ 守门 89 结构上看不见它,不变量只由上面两把尺子钉。
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { mkScratch, rmScratch } from './lib/scratch-dir.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const USAGE = '用法: benchmark-diff-matrix.mjs [取证目录] | --self-test | --help'
/** 缺失侧的读数文案(docs 版逐字继承;镜像测试按字面量钉它,改文案必须同时改那份断言)。 */
const MISSING_NOTE = '文件不在位(未交付或仍在写)'
/** 默认取证面(见文件头注):仓库里的证据目录,**不是**本脚本所在的 scripts/。 */
export const EVIDENCE_DIR = path.resolve(HERE, '..', 'docs', 'benchmark-evidence', '2026-09')

const FILES = {
  ours: 'ours/chat-stream-inventory.md',
  qoder: 'qoder/chat-stream-inventory.md',
  codex: 'codex/chat-stream-inventory.md',
  trae: 'trae/chat-stream-inventory.md',
  opencode: 'opencode/chat-stream-inventory.md',
}
// 16 类骨架的识别词(每类多个别名,防止各代理措辞不同)
const CATS = [
  ['1 消息与内容块', /消息气泡|内容块|气泡|markdown|代码块|表格|图表|mermaid|latex|artifact/i],
  ['2 思考与推理', /思考|推理|reasoning|thinking/i],
  ['3 工具调用卡', /工具调用|工具卡|tool.?call/i],
  ['4 终端与命令', /终端|命令执行|terminal|shell/i],
  ['5 文件与diff', /diff|代码变更|文件变更|accept.?reject|保留.?撤销|view.?changes/i],
  ['6 计划与待办', /计划|待办|todo|plan|checklist/i],
  ['7 子代理与后台', /子代理|subagent|专家|expert|后台任务|agent.?team/i],
  ['8 审批与权限', /审批|权限|approval|permission|沙箱|sandbox/i],
  ['9 上下文与压缩', /上下文|压缩|compact|context/i],
  ['10 引用与来源', /引用|来源|mention|citation|@/i],
  ['11 队列转向中断', /队列|转向|steer|中断|停止|queue/i],
  ['12 错误降级重试', /错误|降级|重试|fallback|error/i],
  ['13 计量与成本', /计量|成本|token|积分|credit|usage|cost/i],
  ['14 会话管理分享导出', /会话管理|分享|导出|fork|重命名|置顶|归档/i],
  ['15 模型与档位', /模型|档位|tier|reasoning.?effort|倍率|参数/i],
  ['16 记忆规则技能', /记忆|规则|memory|rules?|技能|skill|wiki|知识库/i],
]

function loadInventory(base, rel) {
  const p = path.join(base, rel)
  if (!fs.existsSync(p)) return { missing: true, p }
  const lines = fs.readFileSync(p, 'utf8').split(/\r?\n/)
  const items = []
  let section = ''
  for (const raw of lines) {
    const l = raw.trim()
    if (!l) continue
    const hm = l.match(/^#{1,4}\s+(.+)$/)
    if (hm) {
      section = hm[1].trim()
      continue
    }
    if (/^[-*]\s+/.test(l)) items.push({ section, text: l.replace(/^[-*]\s+/, '') })
  }
  return { p, lines: lines.length, items }
}

function catOf(item) {
  const hay = `${item.section} ${item.text}`
  const hits = CATS.filter(([, re]) => re.test(hay)).map(([n]) => n)
  return hits
}

/** 逐侧读数:缺失侧明写"文件不在位",绝不静默当成空清单(那是把"没判"写成"判过了")。 */
function collectSides(base) {
  const sides = {}
  const status = {}
  for (const [k, rel] of Object.entries(FILES)) {
    const r = loadInventory(base, rel)
    if (r.missing) {
      status[k] = MISSING_NOTE
      sides[k] = null
      continue
    }
    sides[k] = r.items
    status[k] = `${r.items.length} 条 / ${r.lines} 行`
  }
  const present = Object.entries(sides).filter(([, v]) => v)
  return { sides, status, present }
}

function buildRows(present) {
  const rows = []
  for (const [catName] of CATS) {
    const cell = {}
    for (const [k, items] of present) {
      const inCat = items.filter((i) => catOf(i).includes(catName))
      cell[k] = inCat
    }
    rows.push({ catName, cell })
  }
  return rows
}

export function buildMatrix(base) {
  const { sides, status, present } = collectSides(base)
  const oursIn = !!present.find(([k]) => k === 'ours')
  const rows = oursIn ? buildRows(present) : []
  return { sides, status, present, oursIn, rows }
}

/** 我方零条目的类别(需人工确认是"无对应物"还是"清单未覆盖")。 */
export function zeroOursCats(rows) {
  const out = []
  for (const { catName, cell } of rows) if ((cell.ours || []).length === 0) out.push(catName)
  return out
}

/** 竞品有、我方零条目的类别 —— 这条判序一旦写反,矩阵就会把"我方已覆盖"的类报成差距。 */
export function rivalOnlyCats(rows, present) {
  const out = []
  for (const { catName, cell } of rows) {
    const rivals = present.filter(([k]) => k !== 'ours').filter(([k]) => (cell[k] || []).length > 0)
    if ((cell.ours || []).length === 0 && rivals.length) out.push({ catName, rivals, cell })
  }
  return out
}

const SELF = {
  ours: [
    '# 2 思考与推理',
    '- 思考块展示推理摘要(thinking)',
    '# 6 计划与待办',
    '* 待办清单条目会随进度勾选',
    '# 99 小节继承与深标题',
    '##### 五级标题不该成为小节',
    '- 这一条仍应挂在上一节之下',
    '纯 prose 行不是条目',
    '> 引用行也不是条目',
    '',
  ].join('\n'),
  qoder: [
    '# 16 记忆规则技能',
    '- 记忆 memory 与规则 rules 面板',
    '- 技能 skill 市场入口',
    '# 13 计量与成本',
    '- 每条回答显示 token 用量与积分倍率',
    '',
  ].join('\n'),
}

/**
 * 自检(2026-09-29 补,docs 版原本没有 --self-test):造两份最小真形态清单,把归一/归类/
 * 两条零条目判据喂到底。含**反向对照**:我方有条目的一类不得进"竞品有而我方零"。
 */
function runSelfTest() {
  const dir = mkScratch('benchmark-diff-matrix-selftest')
  const failures = []
  let pass = 0
  const eq = (name, actual, expected) => {
    if (actual !== expected)
      throw new Error(`${name}: 期望 ${JSON.stringify(expected)},实得 ${JSON.stringify(actual)}`)
  }
  const has = (name, arr, needle) => {
    if (!arr.includes(needle)) throw new Error(`${name}: ${JSON.stringify(arr)} 里找不到 ${needle}`)
  }
  const lacks = (name, arr, needle) => {
    if (arr.includes(needle))
      throw new Error(`${name}: ${needle} 不该出现在 ${JSON.stringify(arr)}`)
  }
  const ok = (name, fn) => {
    try {
      fn()
      pass++
      console.log(`  ✅ ${name}`)
    } catch (e) {
      failures.push(name)
      console.log(`  ❌ ${name} :: ${(e && e.message) || String(e)}`)
    }
  }
  console.log('# diff-matrix 自检(合成最小清单,零副作用越出 scratch 目录)')
  try {
    fs.mkdirSync(path.join(dir, 'ours'), { recursive: true })
    fs.mkdirSync(path.join(dir, 'qoder'), { recursive: true })
    fs.writeFileSync(path.join(dir, 'ours', 'chat-stream-inventory.md'), SELF.ours)
    fs.writeFileSync(path.join(dir, 'qoder', 'chat-stream-inventory.md'), SELF.qoder)

    const loaded = loadInventory(dir, FILES.ours)
    const matrix = buildMatrix(dir)
    const zeros = zeroOursCats(matrix.rows)
    const rivalOnly = rivalOnlyCats(matrix.rows, matrix.present)
    const rivalNames = rivalOnly.map((r) => r.catName)

    ok('条目解析量得到东西(不接受恒 0)', () => {
      eq('ours 条目数', loaded.items.length, 3)
      eq('qoder 条目数', loadInventory(dir, FILES.qoder).items.length, 3)
      if (!(loaded.lines > 0)) throw new Error('行数没量到')
    })

    ok('* 号条目与 - 号条目同算,prose/引用行不算条目', () => {
      eq('第二条来自 * 号', loaded.items[1].text.startsWith('待办清单'), true)
      eq(
        'prose 行未被收进条目',
        loaded.items.some((i) => i.text.includes('纯 prose 行')),
        false,
      )
      eq(
        '引用行未被收进条目',
        loaded.items.some((i) => i.text.includes('引用行')),
        false,
      )
    })

    ok('##### 五级标题不得成为小节(小节判序写歪时这里红)', () => {
      eq('第三条挂在上一节', loaded.items[2].section, '99 小节继承与深标题')
    })

    ok('一条可归多类(CATS 用 filter 不是 find)', () => {
      const cats = catOf(loadInventory(dir, FILES.qoder).items[2])
      has('13 计量与成本', cats, '13 计量与成本')
      has('15 模型与档位', cats, '15 模型与档位')
    })

    ok('缺失侧明写"文件不在位",不静默当空清单', () => {
      eq('codex 状态', matrix.status.codex, '文件不在位(未交付或仍在写)')
      eq('在场侧数', matrix.present.length, 2)
    })

    ok('零条目/竞品独有两条判据双向都对', () => {
      has('我方零条目含 16', zeros, '16 记忆规则技能')
      lacks('我方零条目不含 2', zeros, '2 思考与推理')
      lacks('我方零条目不含 6', zeros, '6 计划与待办')
      has('竞品独有含 16', rivalNames, '16 记忆规则技能')
      lacks('竞品独有不含 2', rivalNames, '2 思考与推理')
      const r16 = rivalOnly.find((r) => r.catName === '16 记忆规则技能')
      eq('16 类竞品命中侧', r16.rivals.map(([k]) => k).join(','), 'qoder')
      eq('16 类竞品命中数', r16.cell.qoder.length, 2)
    })

    ok('我方清单缺失 ⇒ 判"无法生成",不产出矩阵(不得把没判写成判过了)', () => {
      const noOurs = path.join(dir, 'no-ours')
      fs.mkdirSync(path.join(noOurs, 'qoder'), { recursive: true })
      fs.writeFileSync(path.join(noOurs, 'qoder', 'chat-stream-inventory.md'), SELF.qoder)
      const m2 = buildMatrix(noOurs)
      eq('oursIn', m2.oursIn, false)
      eq('rows 未生成', m2.rows.length, 0)
      eq('零条目清单为空', zeroOursCats(m2.rows).length, 0)
    })
  } finally {
    rmScratch(dir)
  }
  const total = pass + failures.length
  console.log(
    `# 自检 ${total} 条,通过 ${pass},失败 ${failures.length}${failures.length ? ': ' + failures.join(' | ') : ''}`,
  )
  return failures.length ? 1 : 0
}

async function main() {
  if (process.argv[2] === '--help') {
    console.log(USAGE)
    return
  }
  if (process.argv[2] === '--self-test') {
    process.exit(runSelfTest())
  }
  const BASE = process.argv[2] || EVIDENCE_DIR
  const { status, present, oursIn, rows } = buildMatrix(BASE)

  console.log('# 取证物到位情况')
  for (const [k, s] of Object.entries(status)) console.log(`  ${k.padEnd(9)} ${s}`)

  if (!oursIn) {
    console.log('\n# 我方清单缺失 ⇒ 无法生成对账矩阵(这是"判不出",不是"无差距")')
    process.exit(0)
  }

  console.log('\n# 分桶计数(每类各侧条目数;0 表示该份清单里没搜到该类,不等于该产品没有此能力)')
  console.log('类别'.padEnd(22), present.map(([k]) => k).join('\t'))
  for (const { catName, cell } of rows) {
    console.log(catName.padEnd(20), present.map(([k]) => String(cell[k].length)).join('\t\t'))
  }

  // 我方完全没有任何条目落入的类(强信号:该维我方无对应物)
  console.log('\n# 我方清单里零条目的类别(需人工确认是"无对应物"还是"清单未覆盖")')
  for (const c of zeroOursCats(rows)) console.log('  · ' + c)

  console.log('\n# 竞品有、我方零条目的类别(逐类展开竞品原文供人工判读)')
  for (const { catName, rivals, cell } of rivalOnlyCats(rows, present)) {
    console.log(
      `\n## ${catName} —— 竞品侧命中: ${rivals.map(([k]) => `${k}(${cell[k].length})`).join(', ')}`,
    )
    for (const [k] of rivals.slice(0, 3))
      for (const it of cell[k].slice(0, 6)) console.log(`   [${k}] ${it.text.slice(0, 190)}`)
  }
  console.log('\n# 注:本器只做归一与并排,不下"该不该做"的结论;类别归属按关键词粗判,一条可归多类。')
}

// §22d:CLI 入口与模块导出双形态分离 —— 被 import 时不得触发 main()(否则测试一 import 就
// 跑去 process.exit,把 node --test 的进程打死)。
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  main().catch((e) => {
    console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  })
}

export const __test__ = {
  USAGE,
  EVIDENCE_DIR,
  FILES,
  CATS,
  MISSING_NOTE,
  loadInventory,
  catOf,
  collectSides,
  buildRows,
  buildMatrix,
  zeroOursCats,
  rivalOnlyCats,
  SELF,
  runSelfTest,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
