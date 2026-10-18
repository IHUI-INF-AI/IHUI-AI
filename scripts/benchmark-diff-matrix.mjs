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
import { execFileSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { mkScratch, rmScratch } from './lib/scratch-dir.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const USAGE = '用法: benchmark-diff-matrix.mjs [取证目录] | --per-class [输出文件] | --self-test | --help'
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

// ===== 逐类目档(D207,2026-10-01)=====
// D160 拆票收口:我方 4 张清单(2026-10 ours-inventory-g1..g4) ∪ 帧面(frame-by-end-matrix)
// × Qoder/Trae/Codex 三份清单,按 16 类骨架逐类并排。
// 与上面关键词粗判那档不同,清单侧**按节号精确归类**(各清单都用 `## N` 同名节,trae 带点号);
// 帧面无类目列,按帧名粗归(同 CATS 粗判纪律,一条可归多类,未命中单列可见,绝不静默丢弃)。
// 两态纪律沿用:0 = 该侧清单该节未取证到,不等于该产品没有此能力;本档只归一并排,不下"该不该做"结论。
export const CLASS_COUNT = 16
export const OURS_G_DIR = path.resolve(EVIDENCE_DIR, '..', '2026-10')
export const OURS_G_FILES = [1, 2, 3, 4].map((n) => path.join(OURS_G_DIR, `ours-inventory-g${n}.md`))
export const FRAME_MATRIX_FILE = path.join(EVIDENCE_DIR, 'ours', 'frame-by-end-matrix.md')
export const RIVAL_FILES = {
  qoder: path.join(EVIDENCE_DIR, 'qoder', 'chat-stream-inventory.md'),
  trae: path.join(EVIDENCE_DIR, 'trae', 'chat-stream-inventory.md'),
  codex: path.join(EVIDENCE_DIR, 'codex', 'chat-stream-inventory.md'),
}
export const PER_CLASS_DEFAULT_OUT = path.join(OURS_G_DIR, 'per-class-matrix.md')

/**
 * 逐类目档的清单解析:类 = 两级标题 `## N`(N∈1..16,`## 13.` 点号与 `## 13 ` 空格两形都接)。
 * 数字节 >16 → extra(骨架外,如 trae ## 17-19,含竞品自报"读不到的面");其余标题(0/0b/收尾读数/计数与自检…)→ meta,
 * 其下条目**不入类但计数留痕**(不得静默丢)。###/#### 深标题不切类(继承当前类)。
 * 条目形态三种(2026-10-01 实测真语料后扩):① `- ` 或 `* ` 行;② **表格数据行** —— qoder/trae/codex
 * 三份竞品清单大量用 `| 键 | 原文 | 出处 |` 表承载,只认 bullet 会把竞品侧读成 0(把"没判"写成"判过了");
 * ③ **反引号裸行** —— codex 的条目主形态是 `` `键` — 原文 — 出处 `` 单行(405 行),trae 亦有个别行;
 * 代码栅栏(``` 开头)不算条目。
 * 表格纪律:块内首行若紧跟分隔行(`| --- |`)则为表头,不计;分隔行本身不计;无分隔行的孤立表格行按数据计。
 */
export function parseClassSections(file) {
  if (!fs.existsSync(file)) return { missing: true, file }
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/)
  const classes = new Map()
  const extra = []
  const meta = []
  let cur = null
  const isSep = (s) => /^\|[\s:|-]+$/.test(s)
  const isPipe = (s) => s.startsWith('|')
  const push = (item) => {
    if (!cur) {
      meta.push({ title: '(无节前条目)', items: [item] })
      return
    }
    if (cur.kind === 'class') {
      if (!classes.has(cur.num)) classes.set(cur.num, [])
      classes.get(cur.num).push(item)
    } else if (cur.kind === 'extra') extra[cur.idx].items.push(item)
    else meta[cur.idx].items.push(item)
  }
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].trim()
    const hm = l.match(/^##\s+(.+)$/)
    if (hm) {
      const t = hm[1].trim()
      const nm = t.match(/^(\d+)(?:[.、)\s]|$)/)
      const num = nm ? Number(nm[1]) : NaN
      if (num >= 1 && num <= CLASS_COUNT) {
        cur = { kind: 'class', num }
        continue
      }
      if (num > CLASS_COUNT) {
        extra.push({ num, title: t, items: [] })
        cur = { kind: 'extra', idx: extra.length - 1 }
        continue
      }
      meta.push({ title: t, items: [] })
      cur = { kind: 'meta', idx: meta.length - 1 }
      continue
    }
    if (!l) {
      continue
    }
    if (isPipe(l)) {
      if (isSep(l)) continue
      // 块首数据行:若下一非空行是分隔行,则本行是表头,不计
      const nxt = (lines[i + 1] ?? '').trim()
      const atBlockStart = !wasPipeNonBlankBefore(lines, i)
      if (atBlockStart && isSep(nxt)) continue
      push({ text: l.replace(/^\|/, '').replace(/\|$/, '').trim() })
      continue
    }
    if (/^`(?!``)/.test(l)) {
      // 反引号裸行(codex 主形态):`键` — 原文 — 出处;排除 ``` 代码栅栏
      push({ text: l })
      continue
    }
    if (!/^[-*]\s+/.test(l)) continue
    push({ text: l.replace(/^[-*]\s+/, '') })
  }
  return { file, classes, extra, meta }
}

/** 行 i 是否处于一个表格块的块首(前一个非空行不是表格行)。 */
function wasPipeNonBlankBefore(lines, i) {
  for (let j = i - 1; j >= 0; j--) {
    const p = lines[j].trim()
    if (!p) continue
    return p.startsWith('|')
  }
  return false
}

/** 帧名 → 类 的粗判词表(帧面无类目列,只能按名归;未命中必须单列可见,不许静默丢)。 */
export const FRAME_CLASS_TOKENS = [
  [1, /chunk|message|part|markdown|bubble|block/i],
  [2, /think|reason|thought|secret/i],
  [3, /tool|card/i],
  [4, /terminal|shell|command|exec/i],
  [5, /diff|file|patch|checkpoint|edit|review/i],
  [6, /plan|todo|goal|spec|task|milestone/i],
  [7, /subagent|agent|team|background|spawn|expert/i],
  [8, /approval|permission|confirm|sandbox/i],
  [9, /compact|context|summar/i],
  [10, /citation|source|reference|attachment|mention/i],
  [11, /queue|steer|interrupt|stop|turn|pause/i],
  [12, /error|fallback|retry|degrade|fail/i],
  [13, /budget|usage|cost|credit|token|quota|billing|price/i],
  [14, /session|fork|share|export|title|rename|pin/i],
  [15, /model|tier|effort|route/i],
  [16, /memory|rule|skill|knowledge|wiki/i],
]
export function frameClassesOf(name) {
  return FRAME_CLASS_TOKENS.filter(([, re]) => re.test(name)).map(([c]) => c)
}
export function loadFrameRows(file) {
  if (!fs.existsSync(file)) return { missing: true, file }
  const rows = []
  for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = raw.trim().match(/^\|\s*`([^`]+)`\s*\|/)
    if (!m) continue
    const name = m[1]
    const classes = frameClassesOf(name)
    rows.push({ name, classes, unmatched: classes.length === 0 })
  }
  return { file, rows }
}

/**
 * 逐类目档矩阵。验收(票面硬条件,违反即抛):
 * ① 输入七件(4 清单+帧面+3 竞品)任何一件缺失 → 抛;
 * ② 我方合计条目 0 或任一竞品合计条目 0 → 抛(矩阵两侧都有条目,不得一侧空着下结论)。
 */
export function buildPerClass(inputs = {}) {
  const oursFiles = inputs.oursFiles ?? OURS_G_FILES
  const frameFile = inputs.frameFile ?? FRAME_MATRIX_FILE
  const rivalFiles = inputs.rivalFiles ?? RIVAL_FILES
  const frames = loadFrameRows(frameFile)
  const missing = [
    ...oursFiles.filter((f) => !fs.existsSync(f)),
    ...(frames.missing ? [frameFile] : []),
    ...Object.entries(rivalFiles).filter(([, f]) => !fs.existsSync(f)).map(([, f]) => f),
  ]
  if (missing.length) throw new Error('逐类目档输入缺文件: ' + missing.join(' ; '))
  const ours = oursFiles.map((f) => ({ name: path.basename(f), p: parseClassSections(f) }))
  const rivals = Object.entries(rivalFiles).map(([k, f]) => [k, parseClassSections(f)])
  const rows = []
  for (let c = 1; c <= CLASS_COUNT; c++) {
    const oursCell = ours.map((x) => (x.p.classes.get(c) || []).length)
    const framesN = frames.rows.filter((r) => r.classes.includes(c)).length
    const rivalCell = Object.fromEntries(rivals.map(([k, p]) => [k, (p.classes.get(c) || []).length]))
    const oursTotal = oursCell.reduce((a, b) => a + b, 0)
    const rivalTotal = Object.values(rivalCell).reduce((a, b) => a + b, 0)
    let verdict
    if (oursTotal > 0 && rivalTotal > 0) verdict = '两侧都有'
    else if (oursTotal > 0) verdict = '我方单侧(竞品清单该节未取证到)'
    else if (rivalTotal > 0) verdict = '竞品单侧(我方清单该节未取证到)'
    else verdict = '两侧都零(undetermined)'
    rows.push({ c, oursNames: ours.map((x) => x.name), oursCell, oursTotal, framesN, rivalCell, rivalTotal, verdict })
  }
  const oursGrand = rows.reduce((a, r) => a + r.oursTotal, 0)
  const rivalGrand = Object.fromEntries(rivals.map(([k]) => [k, rows.reduce((a, r) => a + r.rivalCell[k], 0)]))
  if (oursGrand === 0) throw new Error('我方四清单在 16 类下合计 0 条 —— 一侧空着,拒绝出矩阵(两态纪律)')
  for (const [k, n] of Object.entries(rivalGrand)) {
    if (n === 0) throw new Error(`竞品 ${k} 在 16 类下合计 0 条 —— 一侧空着,拒绝出矩阵(两态纪律)`)
  }
  return {
    rows,
    oursGrand,
    rivalGrand,
    framesAll: frames.rows.length,
    extraSections: [
      ...rivals.map(([k, p]) => p.extra.map((e) => ({ side: k, ...e, n: e.items.length }))).flat(),
      ...ours.map((x) => x.p.extra.map((e) => ({ side: x.name, ...e, n: e.items.length }))).flat(),
    ],
    unmatchedFrames: frames.rows.filter((r) => r.unmatched).map((r) => r.name),
    metaLines: [
      ...ours.map((x) => x.p.meta.filter((m) => m.items.length).map((m) => ({ side: x.name, title: m.title, n: m.items.length }))).flat(),
      ...rivals.map(([k, p]) => p.meta.filter((m) => m.items.length).map((m) => ({ side: k, title: m.title, n: m.items.length }))).flat(),
    ],
  }
}

function headStamp() {
  try {
    return execFileSync('git', ['rev-parse', '--short=10', 'HEAD'], { encoding: 'utf8', windowsHide: true }).trim()
  } catch {
    return 'unknown'
  }
}

/**
 * 溯源水印注入唯一出口(§5c 生成器契约):产物是 git 跟踪文件,受 check-watermark-coverage 约束。
 * 失败一律向上抛 —— 不抛就是"产出一个让门禁必红的文件"而账面报成功。
 */
export function injectWatermark(outFile) {
  const watermarkScript = path.join(HERE, 'watermark.mjs') // HERE 就是 <root>/scripts
  execFileSync(process.execPath, [watermarkScript, 'inject', outFile], {
    stdio: 'inherit',
    windowsHide: true,
  })
}

/** 机器产物全文。格式纪律同 frame-by-end-matrix:头注声明"任何一格不得手工改"+ 复现命令。 */
export function renderPerClassMarkdown(m, stamp = {}) {
  const L = []
  // 横幅不在这里手抄:.md 的合法注释是 <!-- -->,而本脚本自身是 // 式 → 抄过来必被守门 95 判"未注释包裹";
  // 唯一出口 = runPerClass 写盘后调 scripts/watermark.mjs inject(§5c 生成器契约)。
  L.push('# 逐类目对账矩阵:我方 4 清单 ∪ 帧面 × Qoder/Trae/Codex(机器生成,D207)', '')
  L.push('> 由 `scripts/benchmark-diff-matrix.mjs --per-class` 生成,D160 拆票(D207)的收口产物。')
  L.push('> **本文件任何一格不得手工改** —— 读数变了,说明清单或代码变了:去改清单/代码,然后重新生成,不改这张表。')
  L.push('> 重新生成: `node scripts/benchmark-diff-matrix.mjs --per-class`')
  L.push(`> 生成时点: ${stamp.when ?? 'unknown'} · HEAD=${stamp.head ?? 'unknown'}`)
  L.push('> 输入:我方 = ours-inventory-g1..g4.md(2026-10) ∪ ours/frame-by-end-matrix.md;竞品 = qoder/trae/codex 三份 chat-stream-inventory.md。')
  L.push('> 读法:条目数 = 各清单同名数字节(## N)下的 `- `/* ` 行、表格数据行(表头/分隔行不计)与反引号裸行(codex 主形态;``` 栅栏不计),**按节号精确归类**(非关键词);帧面 = 帧行按帧名粗归(同 CATS 粗判纪律,一条可归多类,未命中单列)。')
  L.push('> 两态纪律:**0 = 该侧清单该节未取证到,不等于该产品没有此能力**;本器只归一并排,不下"该不该做"的结论。', '')
  L.push('## 16 类并排(条目数;帧面 = 帧数)', '')
  L.push('| 类 | ' + m.rows[0].oursNames.join(' | ') + ' | 我方计 | 帧面 | qoder | trae | codex | 判读 |')
  L.push('| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |')
  for (const r of m.rows) {
    L.push(`| ${r.c} | ${r.oursCell.join(' | ')} | ${r.oursTotal} | ${r.framesN} | ${r.rivalCell.qoder} | ${r.rivalCell.trae} | ${r.rivalCell.codex} | ${r.verdict} |`)
  }
  L.push('')
  L.push(`我方合计 ${m.oursGrand} 条 · 竞品合计 qoder ${m.rivalGrand.qoder} / trae ${m.rivalGrand.trae} / codex ${m.rivalGrand.codex} · 帧面 ${m.framesAll} 帧(粗归入类见上,未归见下)`, '')
  const oursOnly = m.rows.filter((r) => r.verdict.startsWith('我方单侧'))
  L.push('## 「竞品也没有」单列(D156 §十二口径 —— 不得列为我方差距)', '')
  if (oursOnly.length) {
    for (const r of oursOnly) {
      L.push(`- 类 ${r.c}:三份竞品清单该节均未取证到(0 条),我方有条目 ${r.oursTotal} 条。竞品侧是"未取证到",不是"竞品没有",更不构成我方过度建设;按 D156 §十二单列于此,不入差距清单。`)
    }
  } else {
    L.push('(无)')
  }
  L.push('')
  const rivalOnly = m.rows.filter((r) => r.verdict.startsWith('竞品单侧'))
  L.push('## 竞品单侧(我方差距候选 —— 逐条人工判读,不得由本表直接下结论)', '')
  if (rivalOnly.length) {
    for (const r of rivalOnly) {
      L.push(`- 类 ${r.c}:qoder ${r.rivalCell.qoder} 条 / trae ${r.rivalCell.trae} 条 / codex ${r.rivalCell.codex} 条,我方清单该节未取证到。`)
    }
  } else {
    L.push('(无)')
  }
  L.push('')
  const bothZero = m.rows.filter((r) => r.verdict.startsWith('两侧都零'))
  L.push('## 两侧都零(覆盖洞,undetermined —— 人工核清单覆盖,不判有无)', '')
  L.push(bothZero.length ? bothZero.map((r) => `- 类 ${r.c}`).join('\n') : '(无)')
  L.push('')
  L.push('## 骨架外数字节(仅登记,不入 16 类判定;含竞品自报"读不到的面")', '')
  L.push(m.extraSections.length ? m.extraSections.map((e) => `- ${e.side} ## ${e.num} ${e.title}(条目 ${e.n})`).join('\n') : '(无)')
  L.push('')
  L.push('## 帧面未归类帧名(粗判没接住的,人工看)', '')
  L.push(m.unmatchedFrames.length ? m.unmatchedFrames.map((n) => `- \`${n}\``).join('\n') : '(无)')
  L.push('')
  L.push('## meta 节条目留痕(不入类,但不得静默丢)', '')
  L.push(m.metaLines.length ? m.metaLines.map((x) => `- ${x.side} 「${x.title}」 ${x.n} 条`).join('\n') : '(无)')
  L.push('')
  return L.join('\n')
}

/** --per-class 入口:真语料构建 + 写盘 + 摘要;任何验收失败向上抛(main 转 exit 2)。 */
export function runPerClass(outFile = PER_CLASS_DEFAULT_OUT) {
  const m = buildPerClass()
  const md = renderPerClassMarkdown(m, { when: new Date().toISOString(), head: headStamp() })
  fs.mkdirSync(path.dirname(outFile), { recursive: true })
  fs.writeFileSync(outFile, md, 'utf8')
  injectWatermark(outFile)
  const mine = m.rows.filter((r) => r.verdict.startsWith('我方单侧')).map((r) => r.c)
  const theirs = m.rows.filter((r) => r.verdict.startsWith('竞品单侧')).map((r) => r.c)
  console.log(`# 逐类目档已生成: ${outFile}`)
  console.log(`  我方 ${m.oursGrand} 条 · qoder ${m.rivalGrand.qoder} / trae ${m.rivalGrand.trae} / codex ${m.rivalGrand.codex} · 帧面 ${m.framesAll}`)
  console.log(`  我方单侧(竞品也没有单列): 类 ${mine.join(',') || '无'}`)
  console.log(`  竞品单侧(差距候选): 类 ${theirs.join(',') || '无'}`)
  console.log(`  两侧都零: 类 ${m.rows.filter((r) => r.verdict.startsWith('两侧都零')).map((r) => r.c).join(',') || '无'}`)
  return 0
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

  // ---- 逐类目档(D207)自检:合成最小七件套,节号精确归类/帧名粗归/三态判读/验收拒绝 ----
  console.log('# 逐类目档自检(合成最小语料)')
  let d2 = ''
  try {
    d2 = mkScratch('benchmark-diff-matrix-selftest-perclass')
    const w = (rel, txt) => {
      fs.mkdirSync(path.join(d2, path.dirname(rel)), { recursive: true })
      fs.writeFileSync(path.join(d2, rel), txt)
    }
    w('ours/g1.md', [
      '## 0 取证物与读数',
      '- meta 条目 A(不入类)',
      '## 1 消息气泡与内容块',
      '- g1 类1 条目',
      '## 4 终端与命令',
      '- g1 类4 条目',
      '## 收尾读数',
      '- meta 条目 B(不入类)',
      '',
    ].join('\n'))
    w('ours/g2.md', '## 5 文件与 diff\n- g2 类5 条目\n')
    w('ours/g3.md', '## 9 上下文与压缩\n- g3 类9 条目\n')
    w('ours/g4.md', ['## 16 记忆·规则', '- g4 类16 条目 A', '- g4 类16 条目 B', ''].join('\n'))
    w('frames.md', ['| 帧名 | web |', '| --- | --- |', '| `budget` | 有·compare |', '| `citations` | — |', '| `zzzq` | — |', ''].join('\n'))
    w('rivals/qoder.md', '## 13. 计量与成本\n- qoder 类13 条目 A\n- qoder 类13 条目 B\n## 16. 规则与记忆\n- qoder 类16 条目\n')
    w('rivals/trae.md', '## 13 计量与成本\n- trae 类13 条目\n## 17. 智能体审查\n- trae 骨架外条目\n')
    // codex 用**表格 + 反引号裸行**双形态(真语料形态:qoder/trae/codex 三家条目主体是 `| 键 | 原文 |`
    // 表,codex 另以 `` `键` — 原文 — 出处 `` 单行为主形态)—— 钉住"表格数据行计入、表头与分隔行不计、
    // 反引号裸行计入、``` 栅栏不计"这几条行为;只认 bullet 的旧版解析器会把表格/裸行侧读成 0。
    w('rivals/codex.md', [
      '## 13 计量与成本',
      '| 键路径 | 原文 | 出处 |',
      '| --- | --- | --- |',
      '| `codex.k1` | 类13 表格条目一 | dist:1 |',
      '| `codex.k2` | 类13 表格条目二 | dist:2 |',
      '`codex.tick` — 类13 反引号条目 — dist:3',
      '```',
      'fence 内的普通行不算条目',
      '```',
      '',
    ].join('\n'))

    ok('节号精确归类:点号/空格两形都接,meta 不入类但留痕', () => {
      const p = parseClassSections(path.join(d2, 'ours/g1.md'))
      eq('g1 类1', (p.classes.get(1) || []).length, 1)
      eq('g1 类4', (p.classes.get(4) || []).length, 1)
      const metaN = p.meta.reduce((a, m) => a + m.items.length, 0)
      eq('g1 meta 条目留痕', metaN, 2)
      eq('g1 无骨架外', p.extra.length, 0)
      const q = parseClassSections(path.join(d2, 'rivals/qoder.md'))
      eq('qoder 点号节 13', (q.classes.get(13) || []).length, 2)
      eq('qoder 点号节 16', (q.classes.get(16) || []).length, 1)
    })
    ok('>16 数字节入骨架外(trae ## 17)', () => {
      const t = parseClassSections(path.join(d2, 'rivals/trae.md'))
      eq('trae 骨架外节数', t.extra.length, 1)
      eq('trae 骨架外号', t.extra[0].num, 17)
      eq('trae 骨架外条目', t.extra[0].items.length, 1)
    })
    ok('表格/反引号形态计入:表头/分隔行/```栅栏不计,数据行按节归类(竞品真语料形态)', () => {
      const c = parseClassSections(path.join(d2, 'rivals/codex.md'))
      eq('codex 类13 条目=3(表格2+裸行1;表头+分隔行+栅栏已剔除)', (c.classes.get(13) || []).length, 3)
      eq('表格条目文本保留键与原文', c.classes.get(13)[0].text.includes('codex.k1'), true)
      eq('反引号条目整行保留', c.classes.get(13)[2].text.includes('codex.tick'), true)
    })
    ok('帧名粗归:budget→13、citations→10、未命中单列', () => {
      const fr = loadFrameRows(path.join(d2, 'frames.md'))
      eq('帧行数', fr.rows.length, 3)
      has('budget→13', frameClassesOf('budget'), 13)
      has('citations→10', frameClassesOf('citations'), 10)
      const un = fr.rows.filter((r) => r.unmatched).map((r) => r.name)
      eq('未归类帧', un.join(','), 'zzzq')
    })
    ok('逐类目矩阵:三态判读逐格正确', () => {
      const m = buildPerClass({
        oursFiles: [1, 2, 3, 4].map((n) => path.join(d2, `ours/g${n}.md`)),
        frameFile: path.join(d2, 'frames.md'),
        rivalFiles: { qoder: path.join(d2, 'rivals/qoder.md'), trae: path.join(d2, 'rivals/trae.md'), codex: path.join(d2, 'rivals/codex.md') },
      })
      const r13 = m.rows.find((r) => r.c === 13)
      eq('13 竞品单侧', r13.verdict.startsWith('竞品单侧'), true)
      eq('13 qoder', r13.rivalCell.qoder, 2)
      eq('13 codex(表格+裸行)', r13.rivalCell.codex, 3)
      const r16 = m.rows.find((r) => r.c === 16)
      eq('16 两侧都有', r16.verdict, '两侧都有')
      const r5 = m.rows.find((r) => r.c === 5)
      eq('5 我方单侧', r5.verdict.startsWith('我方单侧'), true)
      const r1 = m.rows.find((r) => r.c === 1)
      eq('1 我方单侧', r1.verdict.startsWith('我方单侧'), true)
      const r2 = m.rows.find((r) => r.c === 2)
      eq('2 两侧都零', r2.verdict.startsWith('两侧都零'), true)
      eq('我方合计', m.oursGrand, 6)
      eq('帧面入类 13', r13.framesN >= 1, true)
      has('骨架外登记含 trae 17', m.extraSections.map((e) => `${e.side} ${e.num}`).join(','), 'trae 17')
      has('未归类帧登记', m.unmatchedFrames, 'zzzq')
    })
    ok('机器产物可渲染且四块单列齐备', () => {
      const m = buildPerClass({
        oursFiles: [1, 2, 3, 4].map((n) => path.join(d2, `ours/g${n}.md`)),
        frameFile: path.join(d2, 'frames.md'),
        rivalFiles: { qoder: path.join(d2, 'rivals/qoder.md'), trae: path.join(d2, 'rivals/trae.md'), codex: path.join(d2, 'rivals/codex.md') },
      })
      const md = renderPerClassMarkdown(m, { when: 'test', head: 'test' })
      eq('竞品也没有块', md.includes('「竞品也没有」单列'), true)
      eq('竞品单侧块', md.includes('竞品单侧(我方差距候选'), true)
      eq('两侧都零块', md.includes('两侧都零(覆盖洞'), true)
      eq('meta 留痕块(节标题+计数,条目原文不入产物)', md.includes('meta 节条目留痕') && md.includes('「0 取证物与读数」'), true)
    })
    ok('产物头不得是脚本自身源码(旧 selfWatermark 用 indexOf(\'-->\') 自切,把整份源码写进 .md)', () => {
      const m = buildPerClass({
        oursFiles: [1, 2, 3, 4].map((n) => path.join(d2, `ours/g${n}.md`)),
        frameFile: path.join(d2, 'frames.md'),
        rivalFiles: { qoder: path.join(d2, 'rivals/qoder.md'), trae: path.join(d2, 'rivals/trae.md'), codex: path.join(d2, 'rivals/codex.md') },
      })
      const md = renderPerClassMarkdown(m, { when: 'test', head: 'test' })
      // 反向对照:这三条都是本脚本自身才有的形态,出现在产物里就是旧 bug 回来了
      for (const marker of ['#!/usr/bin/env node', 'export function renderPerClassMarkdown', "import fs from 'node:fs'"]) {
        eq('产物不得含脚本源码片段 ' + marker, md.includes(marker), false)
      }
      eq('渲染阶段不产出横幅(横幅只由 inject 写)', md.startsWith('# 逐类目对账矩阵'), true)
    })
    ok('写盘后 inject 出的是 .md 合法注释横幅(守门 95 的判据形态)', () => {
      const outFile = path.join(d2, 'product-head-check.md')
      fs.writeFileSync(outFile, ['# 逐类目对账矩阵:测试', '', '| 类 | 判读 |', '| --- | --- |', '| 1 | 两侧都有 |', ''].join('\n'), 'utf8')
      injectWatermark(outFile)
      const after = fs.readFileSync(outFile, 'utf8')
      eq('首行是 HTML 注释 opener', after.split('\n')[0].trim(), '<!--')
      eq('横幅块以 --> 闭合', after.includes('-->'), true)
      eq('标题未被挤掉', after.includes('# 逐类目对账矩阵:测试'), true)
    })
    ok('验收①:输入缺件即抛,拒绝出矩阵', () => {
      let threw = false
      try {
        buildPerClass({
          oursFiles: [1, 2, 3, 4].map((n) => path.join(d2, `ours/g${n}.md`)),
          frameFile: path.join(d2, 'frames.md'),
          rivalFiles: { qoder: path.join(d2, 'rivals/qoder.md'), trae: path.join(d2, 'rivals/trae.md'), codex: path.join(d2, 'rivals/不存在.md') },
        })
      } catch {
        threw = true
      }
      eq('缺 codex 抛', threw, true)
    })
    ok('验收②:单侧合计 0 拒绝出矩阵(不得一侧空着下结论)', () => {
      w('rivals/empty.md', '## 0 只有 meta\n- meta 条目\n')
      let threw = false
      try {
        buildPerClass({
          oursFiles: [1, 2, 3, 4].map((n) => path.join(d2, `ours/g${n}.md`)),
          frameFile: path.join(d2, 'frames.md'),
          rivalFiles: { qoder: path.join(d2, 'rivals/qoder.md'), trae: path.join(d2, 'rivals/trae.md'), codex: path.join(d2, 'rivals/empty.md') },
        })
      } catch {
        threw = true
      }
      eq('codex 全零抛', threw, true)
    })
  } finally {
    if (d2) rmScratch(d2)
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
  if (process.argv[2] === '--per-class') {
    return runPerClass(process.argv[3] || PER_CLASS_DEFAULT_OUT)
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
  CLASS_COUNT,
  OURS_G_FILES,
  FRAME_MATRIX_FILE,
  RIVAL_FILES,
  PER_CLASS_DEFAULT_OUT,
  parseClassSections,
  frameClassesOf,
  loadFrameRows,
  buildPerClass,
  renderPerClassMarkdown,
  runPerClass,
  injectWatermark,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
