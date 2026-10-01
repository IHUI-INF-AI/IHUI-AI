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

function selfWatermark() {
  const self = fs.readFileSync(fileURLToPath(import.meta.url), 'utf8')
  const end = self.indexOf('-->

# 逐类目对账矩阵:我方 4 清单 ∪ 帧面 × Qoder/Trae/Codex(机器生成,D207)

> 由 `scripts/benchmark-diff-matrix.mjs --per-class` 生成,D160 拆票(D207)的收口产物。
> **本文件任何一格不得手工改** —— 读数变了,说明清单或代码变了:去改清单/代码,然后重新生成,不改这张表。
> 重新生成: `node scripts/benchmark-diff-matrix.mjs --per-class`
> 生成时点: 2026-10-01T15:39:23.079Z · HEAD=4267e30c10
> 输入:我方 = ours-inventory-g1..g4.md(2026-10) ∪ ours/frame-by-end-matrix.md;竞品 = qoder/trae/codex 三份 chat-stream-inventory.md。
> 读法:条目数 = 各清单同名数字节(## N)下的 `- `/* ` 行、表格数据行(表头/分隔行不计)与反引号裸行(codex 主形态;``` 栅栏不计),**按节号精确归类**(非关键词);帧面 = 帧行按帧名粗归(同 CATS 粗判纪律,一条可归多类,未命中单列)。
> 两态纪律:**0 = 该侧清单该节未取证到,不等于该产品没有此能力**;本器只归一并排,不下"该不该做"的结论。

## 16 类并排(条目数;帧面 = 帧数)

| 类 | ours-inventory-g1.md | ours-inventory-g2.md | ours-inventory-g3.md | ours-inventory-g4.md | 我方计 | 帧面 | qoder | trae | codex | 判读 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 32 | 0 | 0 | 0 | 32 | 1 | 274 | 29 | 22 | 两侧都有 |
| 2 | 12 | 0 | 0 | 0 | 12 | 2 | 136 | 14 | 16 | 两侧都有 |
| 3 | 30 | 0 | 0 | 0 | 30 | 0 | 213 | 58 | 22 | 两侧都有 |
| 4 | 24 | 0 | 0 | 0 | 24 | 4 | 75 | 15 | 18 | 两侧都有 |
| 5 | 0 | 60 | 0 | 0 | 60 | 0 | 407 | 17 | 15 | 两侧都有 |
| 6 | 0 | 38 | 0 | 0 | 38 | 3 | 68 | 36 | 18 | 两侧都有 |
| 7 | 0 | 58 | 0 | 0 | 58 | 3 | 154 | 16 | 23 | 两侧都有 |
| 8 | 0 | 50 | 0 | 0 | 50 | 0 | 224 | 38 | 48 | 两侧都有 |
| 9 | 0 | 0 | 47 | 0 | 47 | 1 | 27 | 23 | 21 | 两侧都有 |
| 10 | 0 | 0 | 57 | 0 | 57 | 1 | 430 | 12 | 14 | 两侧都有 |
| 11 | 0 | 0 | 55 | 0 | 55 | 1 | 225 | 17 | 11 | 两侧都有 |
| 12 | 0 | 0 | 49 | 0 | 49 | 3 | 130 | 15 | 20 | 两侧都有 |
| 13 | 0 | 0 | 0 | 45 | 45 | 3 | 55 | 13 | 15 | 两侧都有 |
| 14 | 0 | 0 | 0 | 59 | 59 | 1 | 480 | 19 | 14 | 两侧都有 |
| 15 | 0 | 0 | 0 | 53 | 53 | 0 | 320 | 13 | 29 | 两侧都有 |
| 16 | 0 | 0 | 0 | 54 | 54 | 0 | 158 | 25 | 20 | 两侧都有 |

我方合计 723 条 · 竞品合计 qoder 3376 / trae 360 / codex 326 · 帧面 31 帧(粗归入类见上,未归见下)

## 「竞品也没有」单列(D156 §十二口径 —— 不得列为我方差距)

(无)

## 竞品单侧(我方差距候选 —— 逐条人工判读,不得由本表直接下结论)

(无)

## 两侧都零(覆盖洞,undetermined —— 人工核清单覆盖,不判有无)

(无)

## 骨架外数字节(仅登记,不入 16 类判定;含竞品自报"读不到的面")

- trae ## 17 17. 智能体审查（PR / 变更审查）(条目 10)
- trae ## 18 18. MCP(条目 12)
- trae ## 19 19. 其余对话流可见态（taskTail / 输入区杂项，补录）(条目 3)
- trae ## 20 20. 读不到的面（明确未取证到，不得当结论引用）(条目 0)

## 帧面未归类帧名(粗判没接住的,人工看)

- `cleared`
- `done`
- `form_request`
- `injection_applied`
- `question`
- `resume_from`
- `start`
- `type`

## meta 节条目留痕(不入类,但不得静默丢)

- ours-inventory-g1.md 「0 取证物与读数」 10 条
- ours-inventory-g1.md 「0b 零命中声明的搜索面(逐类「未取证到」共用,照抄竞品清单第 0 节口径)」 4 条
- ours-inventory-g1.md 「收尾读数」 4 条
- ours-inventory-g2.md 「0 逐类「未取证到」核对(先声明缺口,再给清单)」 7 条
- ours-inventory-g2.md 「计数与自检」 10 条
- ours-inventory-g3.md 「0 逐类「未取证到」核对(先声明缺口,再给清单)」 5 条
- ours-inventory-g3.md 「计数与自检」 12 条
- ours-inventory-g4.md 「0 逐类「未取证到」核对」 4 条
- ours-inventory-g4.md 「计数与自检」 11 条
- qoder 「(无节前条目)」 1 条
- qoder 「(无节前条目)」 1 条
- qoder 「(无节前条目)」 1 条
- qoder 「(无节前条目)」 1 条
- qoder 「(无节前条目)」 1 条
- qoder 「(无节前条目)」 1 条
- qoder 「(无节前条目)」 1 条
- qoder 「(无节前条目)」 1 条
- qoder 「(无节前条目)」 1 条
- qoder 「(无节前条目)」 1 条
- qoder 「(无节前条目)」 1 条
- qoder 「(无节前条目)」 1 条
- qoder 「(无节前条目)」 1 条
- qoder 「(无节前条目)」 1 条
- qoder 「(无节前条目)」 1 条
- qoder 「(无节前条目)」 1 条
- qoder 「0 逐类「未取证到」核对（先声明缺口，再给清单）」 29 条
- qoder 「附录 A：仍在对话流命名空间内、但未落进 16 类的条目」 396 条
- qoder 「附录 B：未逐条列入的命名空间（非 AI 对话流主面）」 18 条
- qoder 「附录 D：数值/字符串错误码目录（对话流内的服务端错误卡）」 87 条
- qoder 「附录 E：协作/文件/执行错误目录（第二本）」 72 条
- qoder 「附录 F：`dynamic-text.json`（服务端可下发的模型名与说明，中英对照）」 17 条
- qoder 「附录 G：结构性证据（非文案）」 9 条
- trae 「0. 取证物与版本（报告必写版本）」 17 条
- codex 「取证物与读数（现读，勿照抄派单）」 20 条
- codex 「0. 协议层词汇表（先立底座：下面 16 类的原文都挂在这套键名上）」 70 条
