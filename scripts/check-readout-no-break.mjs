#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
/**
 * check-readout-no-break.mjs(门 240)— 大屏「一格一读数」网格的读数不得断行
 *
 * 立因(机主 2026-10-24 指认):运维大屏「AI 号池」面板里「6天19小时」被切成
 * 「6天19小 / 时」,并把同排卡片撑高留出空白。机器成因是两层常数脱钩:
 *   ① StatCell 的读数 div 没有 white-space:nowrap ⇒ 列宽一窄就折行;
 *   ② .wb-cells 列宽下限(96)小于读数单行需求(实测五语言最坏 143)⇒ 折行是必然;
 *   ③ .wb-split 开两栏的容器阈值(620)没跟着列宽走 ⇒ 两栏后每栏只剩 333,3 格各 107。
 * 只补 ① 会把「折行」变成「溢出压到邻格」(实测最多 61px),比折行更糟 —— 三者必须同批。
 *
 * 判据(全部纯源码,零浏览器依赖,每次提交都真跑):
 *   R1 凡「wb-num + 大字号(≥16px / lg|xl|2xl|3xl)」的读数 class 串必须含 whitespace-nowrap。
 *      原判据只正则 StatCell 原语函数体 ⇒ 大屏另有 3 处手写 26px 读数在射程外(2026-10-24 补)。
 *   R2 --wb-cell-min 必须定义,且至少被一条 minmax() 消费(悬空常数=没上车)。
 *   R3 长读数档 .wb-cells-c3 的 minmax 下限必须引用 var(--wb-cell-min),不得另写数字。
 *   R4 凡 bodyClassName 带 wb-split-c3 的面板,其内每组 .wb-cells 必须同时带 wb-cells-c3
 *      (栏数与列宽必须同源;只改一边就会回到"两栏×3格=107px"那一档)。
 *   R5 wb-split-c3 的 @container 阈值必须逐字等于按源码自身常数复算的值:
 *      阈值 = 2×(每栏格数×列宽下限 + (格数-1)×列间距) + 栏间距,全部从被审面解析。
 *   R6 fmtDuration 的时长读数所在网格不得停在裸 auto-fit 档(下限 96 < 单行需求)。
 *      本门**不判**「够不够宽」—— 那取决于运行时值的长度,静态判必出假红
 *      (曾把 unit 槽的 11px 小字也算成复合读数,24 枚误红)。那一维靠真机/真浏览器
 *      截图核验(AGENTS §17),纯源码写不出不失真的判据,故不留脚本名。
 *   R8 把 R1 那条形态判据推广到 **apps/web + packages/ui-react + apps/extension 全仓**:
 *      凡「大字号(≥16px / lg|xl|2xl|3xl)+ 数值排版(tabular-nums|font-mono|wb-num)」的 class 串
 *      缺 whitespace-nowrap ⇒ 净增即红。锚点 = 该文件 HEAD 自身的违规数(§0.5 差值棘轮);
 *      存量实测 75 处 / 50 文件,升绝对零容忍就是逼人 --no-verify 的恒红门(§12e)⇒ 只拦新增。
 *      只在 --staged 档生效(全量档无「本次改动」可言),其余档打印一行说明而非静默跳过(§0.3)。
 *
 * 档位:blocking;stagedTriggers = 大屏该页 + R8 三个前缀(能造出该状态的那一面)。
 * 应急放行:HUSKY_SKIP_READOUT_NO_BREAK=1 + HUSKY_SKIP_READOUT_NO_BREAK_REASON。
 *
 * 用法:
 *   node scripts/check-readout-no-break.mjs            # 全量档:判 HEAD blob
 *   node scripts/check-readout-no-break.mjs --staged   # 提交链:判索引 blob
 *   node scripts/check-readout-no-break.mjs --worktree # 仅人工逃生舱
 *   node scripts/check-readout-no-break.mjs --self-test
 * 退出码:0 通过 / 1 判出缺口 / 2 未判定(取不到被审面、两面旗同给、常数解析不出)。
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { gitRaw } from './lib/face-reader.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
export const REPO_ROOT = resolve(__dirname, '..')
export const TARGET_REL = 'apps/web/app/(main)/admin/monitor/wallboard/page.tsx'
/** 每栏格数:号池面板两组各 3 格(实测形态,不是拍的)。 */
export const CELLS_PER_GROUP = 3

// ─── 判据(纯函数:文本进,违规出)────────────────────────────
export function parseCellMin(text) {
  const m = text.match(/--wb-cell-min:\s*(\d+(?:\.\d+)?)px/)
  return m ? Number(m[1]) : null
}

/** Tailwind gap-N ⇒ N×4px(gap-1.5=6);CSS `gap: Npx` 直接取数。解析不出返回 null。 */
export function parseGapPx(text, kind) {
  if (kind === 'split') {
    const m = text.match(/\.wb-split\s*\{[^}]*?gap:\s*(\d+(?:\.\d+)?)px/)
    return m ? Number(m[1]) : null
  }
  const m = text.match(/wb-cells wb-cells-c3 grid gap-(\d+(?:\.\d+)?)/)
  return m ? Number(m[1]) * 4 : null
}

/** 从被审面自身复算 wb-split-c3 应有的容器阈值(content-box 语义,与 @container 一致)。 */
export function expectedSplitThreshold(text) {
  const cellMin = parseCellMin(text)
  const gapCells = parseGapPx(text, 'cells')
  const gapSplit = parseGapPx(text, 'split')
  if (cellMin === null || gapCells === null || gapSplit === null) return null
  const perGroup = CELLS_PER_GROUP * cellMin + (CELLS_PER_GROUP - 1) * gapCells
  return { value: 2 * perGroup + gapSplit, cellMin, gapCells, gapSplit, perGroup }
}

/** 时长读数 = fmtDuration 的「N天N小时」形态(单行需求实测 133-143px,裸档 96 放不下)。 */
export const DURATION_RE = /fmtDuration/
const BIG_NUM_RE = /['"`]([^'"`]*wb-num[^'"`]*)['"`]/g
const BIG_FONT_RE = /(?:text-(?:lg|xl|2xl|3xl|4xl)\b|text-\[(?:1[6-9]|[2-9]\d)(?:\.\d+)?px\])/

/** 某位置所属的网格 class 串(向上找最近的 className="…wb-cells…";必须允许 `mt-2 wb-cells` 这类前缀,
 *  否则带 margin 的网格会整组从射程里静默消失 —— 2026-10-24 实测漏掉 5 枚)。 */
function gridClassBefore(text, idx) {
  const back = text.slice(0, idx)
  const m = [...back.matchAll(/className="([^"]*\bwb-cells\b[^"]*)"/g)].pop()
  return m ? m[1] : null
}

export function judge(text) {
  const v = []
  const u = []

  // R1 凡「wb-num + 大字号」的读数 class 串必须 nowrap(不再只认 StatCell 原语 ——
  //    大屏另有 3 处手写 26px 读数,原判据结构上打不到)
  const bigNums = [...text.matchAll(BIG_NUM_RE)].filter((m) => BIG_FONT_RE.test(m[1]))
  if (bigNums.length === 0) {
    u.push('R1 射程内一枚大字号 wb-num 读数都没枚举到 ⇒ 未判定(原语被搬走/改名要显式改这条判据)')
  } else {
    const bare = bigNums.filter((m) => !m[1].includes('whitespace-nowrap'))
    if (bare.length > 0) {
      v.push({
        rule: 'R1',
        msg: `${bare.length}/${bigNums.length} 枚大字号读数 class 串缺 whitespace-nowrap ⇒ 列宽一窄就把数字切成两半:① ${bare[0][1].slice(0, 90)}`,
      })
    }
  }

  // R2 常数必须定义且被消费
  const cellMin = parseCellMin(text)
  if (cellMin === null) {
    v.push({ rule: 'R2', msg: '未定义 --wb-cell-min(读数单行列宽下限的唯一源头)' })
  } else {
    const consumers = [...text.matchAll(/minmax\(\s*var\(--wb-cell-min\)/g)].length
    if (consumers === 0) {
      v.push({ rule: 'R2', msg: `--wb-cell-min:${cellMin}px 定义了却没有任何 minmax() 消费(悬空常数=没上车)` })
    }
  }

  // R3 长读数档必须引用常数,不得另写数字
  const c3 = text.match(/\.wb-cells-c3\s*\{[^}]*\}/)
  if (!c3) {
    v.push({ rule: 'R3', msg: '缺少 .wb-cells-c3(长读数组的列宽档)' })
  } else if (/minmax\(\s*\d/.test(c3[0])) {
    v.push({ rule: 'R3', msg: `.wb-cells-c3 写死了数字下限 ⇒ 与 --wb-cell-min 必然漂移:${c3[0].replace(/\s+/g, ' ')}` })
  } else if (!c3[0].includes('var(--wb-cell-min)')) {
    v.push({ rule: 'R3', msg: `.wb-cells-c3 没引用 var(--wb-cell-min):${c3[0].replace(/\s+/g, ' ')}` })
  }

  // R4 用了 wb-split-c3 的面板,其内每组网格必须同用 wb-cells-c3
  const splitPanels = [...text.matchAll(/bodyClassName="([^"]*wb-split-c3[^"]*)"/g)]
  if (splitPanels.length === 0) {
    u.push('R4 没有任何面板带 wb-split-c3 ⇒ 未判定(被删掉了要显式改这条判据)')
  } else {
    for (const p of splitPanels) {
      const start = p.index
      const next = text.indexOf('bodyClassName=', start + 1)
      const body = text.slice(start, next < 0 ? text.length : next)
      const grids = [...body.matchAll(/className="([^"]*\bwb-cells\b[^"]*)"/g)].map((m) => m[1])
      const plain = grids.filter((g) => !/\bwb-cells-(?:c3|wide|6|4)\b/.test(g)).length
      const fitted = grids.length - plain
      if (plain > 0) {
        v.push({
          rule: 'R4',
          msg: `wb-split-c3 面板内有 ${plain} 组用裸 wb-cells(下限 96 < 读数需求)⇒ 两栏后必然断行;应为 wb-cells wb-cells-c3(该面板内已配 ${fitted} 组)`,
        })
      }
    }
  }

  // R5 栏阈值必须由同一批常数复算得出
  const exp = expectedSplitThreshold(text)
  const actual = text.match(/@container\s*\(\s*min-width:\s*(\d+(?:\.\d+)?)px\s*\)\s*\{\s*\.wb-split-c3/)
  if (exp === null) {
    u.push('R5 列宽下限/列间距/栏间距三者有解析不出的 ⇒ 未判定(不得凭记忆放行)')
  } else if (!actual) {
    v.push({ rule: 'R5', msg: `缺少 .wb-split-c3 的 @container 阈值(应为 ${exp.value}px)` })
  } else if (Number(actual[1]) !== exp.value) {
    v.push({
      rule: 'R5',
      msg: `wb-split-c3 阈值 ${actual[1]}px ≠ 按源码常数复算的 ${exp.value}px` +
        `(=2×(${CELLS_PER_GROUP}×${exp.cellMin}+${CELLS_PER_GROUP - 1}×${exp.gapCells})+${exp.gapSplit})` +
        ` ⇒ 改了下限忘了改栏数档,两栏后每格会窄于读数单行需求`,
    })
  }

  // R6 长读数所在网格必须离开裸 auto-fit 档。
  //    只判「fmtDuration 的中文双单位读数住在裸 wb-cells(下限 96)里」这一型 ——
  //    它是实测确认会断的;至于「够不够宽」取决于运行时值的长度,静态判必出假红
  //    (曾把 unit 槽的 11px 小字也算成复合读数,24 枚误红)。那一维靠真机/真浏览器
  //    截图核验(AGENTS §17),纯源码写不出不失真的判据,故不留脚本名。
  const statCells = [...text.matchAll(/<StatCell\b/g)]
  if (statCells.length === 0) {
    u.push('R6 一枚 StatCell 都没枚举到 ⇒ 未判定(组件改名或被搬走要显式改这条判据)')
  } else {
    const badDuration = []
    for (let i = 0; i < statCells.length; i++) {
      const c = statCells[i]
      const end = i + 1 < statCells.length ? statCells[i + 1].index : c.index + 400
      const blk = text.slice(c.index, Math.min(end, c.index + 400))
      const valueM = blk.match(/value=\{([\s\S]*?)\n?\s*(?:tone|unit=|\/>)/)
      const valueExpr = valueM ? valueM[1] : ''
      if (!DURATION_RE.test(valueExpr)) continue
      const grid = gridClassBefore(text, c.index) ?? ''
      // 固定列档(3/4 列)与 c3/wide 都算合格;不合格的只有裸 auto-fit 96 档
      if (!/wb-cells-(?:c3|wide|6|4)/.test(grid)) badDuration.push({ grid, value: valueExpr.replace(/\s+/g, ' ').slice(0, 60) })
    }
    for (const x of badDuration) {
      v.push({
        rule: 'R6',
        msg: `时长读数(fmtDuration 的「N天N小时」形态)住在「${x.grid || '找不到所属网格'}」里 ⇒ 裸档下限 96 < 单行需求,该网格须用 .wb-cells-c3。值 = ${x.value}`,
      })
    }
  }

  return { violations: v, unjudged: u }
}

// ─── R8:全仓(web 家族)大字号数值读数必须 nowrap,差值棘轮只拦新增 ───
/** 射程前缀(§12e:存量 75 处升绝对零容忍 = 恒红门,所以只拦"本次加回来的")。 */
export const R8_SCOPE_PREFIXES = ['apps/web/', 'packages/ui-react/', 'apps/extension/']
const R8_FILE_RE = /\.(tsx|jsx)$/
const R8_EXCLUDE = /(\.next|node_modules|\/dist\/|\/build\/|\.test\.|\.spec\.|__tests__)/
const R8_NUM = /tabular-nums|font-mono|wb-num/
const R8_BIG_FONT = /(?:text-(?:lg|xl|2xl|3xl|4xl)\b|text-\[(?:1[6-9]|[2-9]\d)(?:\.\d+)?px\])/

export function inR8Scope(p) {
  const f = p.replace(/\\/g, '/')
  return R8_FILE_RE.test(f) && !R8_EXCLUDE.test(f) && R8_SCOPE_PREFIXES.some((s) => f.startsWith(s))
}

/** 一枚文件文本里「大字号 + 数值排版」却缺 nowrap 的 class 串(返回行号与原文)。 */
export function scanClassReadouts(text) {
  const out = []
  const lines = String(text).split('\n')
  for (let i = 0; i < lines.length; i++) {
    const L = lines[i]
    if (/^\s*(?:\/\/|\*|\/\*)/.test(L)) continue
    for (const m of L.matchAll(/['"`]([^'"`\n]{4,160})['"`]/g)) {
      const cls = m[1]
      if (!R8_NUM.test(cls) || !R8_BIG_FONT.test(cls)) continue
      if (cls.includes('whitespace-nowrap')) continue
      out.push({ line: i + 1, cls, truncatedOnly: cls.includes('truncate') })
    }
  }
  return out
}

/**
 * 差值棘轮:锚点 = 该文件基线(HEAD)自身的违规数。
 * 只拦"本次把违规加回来";存量逐条报数不判红(§0.5 / §12e)。
 * 基线读不到 ⇒ 未判定(不猜 0,否则等于给下一个改这文件的人判红)。
 */
export function r8Delta(baselineText, faceText) {
  if (baselineText === null || baselineText === undefined) return { status: 'unjudged' }
  const before = scanClassReadouts(baselineText).length
  const after = scanClassReadouts(faceText).length
  if (after <= before) return { status: 'ok', before, after }
  return { status: 'red', before, after, added: after - before }
}

function gitShow(rev, p) {
  try {
    return gitRaw(['show', `${rev}:${p}`], REPO_ROOT, { maxBuffer: 64 * 1024 * 1024 })
  } catch {
    return null
  }
}
function existsAt(rev, p) {
  try {
    gitRaw(['cat-file', '-e', `${rev}:${p}`], REPO_ROOT)
    return true
  } catch {
    return false
  }
}
function stagedChanged() {
  try {
    return gitRaw(['diff', '--cached', '--name-only', '--diff-filter=ACMR'], REPO_ROOT, {
      maxBuffer: 64 * 1024 * 1024,
    })
      .split('\n')
      .filter(Boolean)
  } catch {
    return null
  }
}

/** R8:只在 --staged 档生效(差值棘轮的"本次"只存在于提交链);其余档显式说明而非静默跳过。 */
export function runR8(face, readAt) {
  if (face !== 'staged') return { violations: [], notes: ['R8 差值棘轮只在 --staged 档生效(全量档无「本次改动」可言)'] }
  const changed = stagedChanged()
  if (changed === null) return { violations: [], unjudged: ['R8 取不到索引改动清单 ⇒ 未判定'] }
  const inScope = changed.filter(inR8Scope)
  const violations = []
  const unjudged = []
  for (const p of inScope) {
    const faceText = readAt(':!0', p)
    if (faceText === null) {
      unjudged.push(`R8 取不到 ${p} 的索引面 ⇒ 未判定`)
      continue
    }
    // 新文件 HEAD 里没有 ⇒ 基线取空串,文件里的违规按"新增"计
    const baseline = existsAt('HEAD', p) ? gitShow('HEAD', p) : ''
    if (baseline === null) {
      unjudged.push(`R8 取不到 ${p} 的 HEAD 基线 ⇒ 未判定`)
      continue
    }
    const d = r8Delta(baseline, faceText)
    if (d.status === 'unjudged') unjudged.push(`R8 ${p} 基线读不到 ⇒ 未判定`)
    else if (d.status === 'red')
      violations.push({
        rule: 'R8',
        msg:
          `${p} 把「大字号 + 数值排版」读数的无-nowrap 从 ${d.before} 处改到 ${d.after} 处(净增 ${d.added})` +
          ` ⇒ 列宽一不足就把数字切成两半。补 whitespace-nowrap,并确认该格列宽 ≥ 读数单行需求` +
          `(只补 nowrap 会把折行变成溢出压邻格 —— 大屏实测 51px)。`,
      })
  }
  return { violations, unjudged, notes: [`R8 已按差值棘轮复核射程内改动的 ${inScope.length} 枚文件`] }
}

// ─── 取材面(§0.4 同面同轮)──────────────────────────────────
function readFace(face) {
  if (face === 'worktree') {
    try {
      return readFileSync(resolve(REPO_ROOT, TARGET_REL), 'utf8')
    } catch {
      return null
    }
  }
  const rev = face === 'staged' ? ':!0' : 'HEAD'
  try {
    return gitRaw(['show', `${rev}:${TARGET_REL}`], REPO_ROOT, { maxBuffer: 64 * 1024 * 1024 })
  } catch {
    return null
  }
}

// §22c 镜像常量出口:测试 import 这些判据单元,不得在测试里重抄一份。
export const __test__ = {
  REPO_ROOT,
  TARGET_REL,
  CELLS_PER_GROUP,
  DURATION_RE,
  gridClassBefore,
  R8_SCOPE_PREFIXES,
  inR8Scope,
  scanClassReadouts,
  r8Delta,
  parseCellMin,
  parseGapPx,
  expectedSplitThreshold,
  judge,
}

// ─── 自检:每条判据都要能单独翻红(摘掉新字段即红),且真文件必须绿 ───
function selfTest() {
  const real = readFace('worktree')
  if (real === null) {
    console.error('❌ 自检拿不到工作区文件 ⇒ 未判定')
    return 2
  }
  const cases = [
    ['基准:当前文件应全绿', real, (r) => r.violations.length === 0 && r.unjudged.length === 0],
    [
      '摘掉读数 nowrap ⇒ R1',
      real.replace(/(wb-num[^']*)whitespace-nowrap/, '$1'),
      (r) => r.violations.some((x) => x.rule === 'R1'),
    ],
    ['删掉 --wb-cell-min 定义 ⇒ R2', real.replace(/--wb-cell-min:\s*\d+px;?/, ''), (r) => r.violations.some((x) => x.rule === 'R2')],
    ['minmax 写死数字 ⇒ R3', real.replace('minmax(var(--wb-cell-min), 1fr)', 'minmax(143px, 1fr)'), (r) => r.violations.some((x) => x.rule === 'R3')],
    ['面板组退回裸 wb-cells ⇒ R4', real.replace(/className="wb-cells wb-cells-c3 grid/g, 'className="wb-cells grid'), (r) => r.violations.some((x) => x.rule === 'R4')],
    ['只改下限不改栏阈值 ⇒ R5', real.replace(/--wb-cell-min:\s*\d+px/, '--wb-cell-min: 160px'), (r) => r.violations.some((x) => x.rule === 'R5')],
    [
      '时长读数组退回裸 auto-fit ⇒ R6',
      real.replace('className="wb-cells wb-cells-6 grid gap-1.5"', 'className="wb-cells grid gap-1.5"'),
      (r) => r.violations.some((x) => x.rule === 'R6'),
    ],
    [
      '大字号读数被摘掉 nowrap ⇒ R1(手写 26px 那三处也在射程内)',
      real.replace(/(wb-num mt-[0-9.]+ text-\[26px\] leading-none font-bold) whitespace-nowrap/, '$1'),
      (r) => r.violations.some((x) => x.rule === 'R1'),
    ],
    // 必须把**所有**面板的 wb-split-c3 一起摘掉:大屏现在有三块用该档,只替第一处时
    // splitPanels 仍非空 ⇒ R4 照判,这条反向锁会假报「未判定没生效」。
    [
      '摘掉 wb-split-c3 ⇒ R4 未判定不冒绿',
      real.replace(/bodyClassName="([^"]*?)wb-split-c3 ?([^"]*)"/g, 'bodyClassName="$1$2"'),
      (r) => r.unjudged.some((x) => x.startsWith('R4')),
    ],
  ]
  let fail = 0
  for (const [name, text, assert] of cases) {
    const r = judge(text)
    const ok = assert(r)
    if (!ok) fail += 1
    console.log(`${ok ? '✓' : '✗'} ${name}${ok ? '' : ` → violations=${r.violations.map((x) => x.rule).join(',')} unjudged=${r.unjudged.length}`}`)
  }
  console.log(`自检 ${cases.length - fail}/${cases.length} 通过`)
  return fail === 0 ? 0 : 1
}

async function main() {
  const args = process.argv.slice(2)
  if (args.includes('--self-test')) {
    process.exit(selfTest())
  }
  const staged = args.includes('--staged')
  const worktree = args.includes('--worktree')
  if (staged && worktree) {
    console.error('❌ --staged 与 --worktree 不得同给(两面旗 = 未判定)')
    process.exit(2)
  }
  const face = staged ? 'staged' : worktree ? 'worktree' : 'head'
  const text = readFace(face)
  if (text === null) {
    console.log(`⚪ [读数不断行] 取不到被审面(${face}:${TARGET_REL})⇒ 未判定,不记绿也不冒红`)
    process.exit(2)
  }
  const { violations, unjudged } = judge(text)
  const r8 = runR8(face, (rev, p) => (rev === ':!0' ? gitShow(':!0', p) : gitShow('HEAD', p)))
  const all = [...violations, ...r8.violations]
  const allU = [...unjudged, ...(r8.unjudged ?? [])]
  const prefix = `[读数不断行 240]`
  for (const n of r8.notes ?? []) console.log(`   ${prefix} ${n}`)
  for (const m of allU) console.log(`⚠️  ${prefix} 未判定:${m}`)
  if (all.length === 0) {
    if (allU.length > 0) {
      // §0.3:判据的输入集空了 ⇒ 既不记绿也不冒红(修复被整块删掉时不得静默通过)
      console.log(`⚪ ${prefix} ${face} 面未判定(${allU.length} 条判据无输入)`)
      process.exit(2)
    }
    console.log(`✅ ${prefix} ${face} 面通过(R1-R8 全绿)`)
    process.exit(0)
  }
  console.error(`\n❌ ${prefix} ${face} 面判出 ${all.length} 处缺口:`)
  for (const x of all) console.error(`   · ${x.rule} ${x.msg}`)
  console.error(`   修法见 docs/UI_GUIDELINES.md「读数不得断行」与门体头注:列宽不足时该减的是栏数/列数,不是把读数折断。`)
  process.exit(1)
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main().catch((e) => {
    console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
