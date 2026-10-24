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
 *   R1 StatCell 原语的读数 class 串必须含 whitespace-nowrap。
 *   R2 --wb-cell-min 必须定义,且至少被一条 minmax() 消费(悬空常数=没上车)。
 *   R3 长读数档 .wb-cells-c3 的 minmax 下限必须引用 var(--wb-cell-min),不得另写数字。
 *   R4 凡 bodyClassName 带 wb-split-c3 的面板,其内每组 .wb-cells 必须同时带 wb-cells-c3
 *      (栏数与列宽必须同源;只改一边就会回到"两栏×3格=107px"那一档)。
 *   R5 wb-split-c3 的 @container 阈值必须逐字等于按源码自身常数复算的值:
 *      阈值 = 2×(每栏格数×列宽下限 + (格数-1)×列间距) + 栏间距,全部从被审面解析。
 *
 * 档位:blocking;stagedTriggers 限定该 page.tsx(能造出该状态的那一面)。
 * 应急放行:HUSKY_SKIP_READOUT_NO_BREAK=1 + HUSKY_SKIP_READOUT_NO_BREAK_REASON。
 *
 * 用法:
 *   node scripts/check-readout-no-break.mjs            # 全量档:判 HEAD blob
 *   node scripts/check-readout-no-break.mjs --staged   # 提交链:判索引 blob
 *   node scripts/check-readout-no-break.mjs --worktree # 仅人工逃生舱
 *   node scripts/check-readout-no-break.mjs --self-test
 * 退出码:0 通过 / 1 判出缺口 / 2 未判定(取不到被审面、两面旗同给、常数解析不出)。
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

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

export function judge(text) {
  const v = []
  const u = []

  // R1 StatCell 读数必须 nowrap
  const stat = text.match(/function StatCell\([\s\S]*?\n\}\n/)
  if (!stat) {
    u.push('R1 找不到 StatCell 原语定义 ⇒ 未判定(原语被搬走要显式改这条判据)')
  } else {
    const readout = [...stat[0].matchAll(/'(wb-num[^']*)'/g)].map((m) => m[1])
    if (readout.length === 0) {
      u.push('R1 StatCell 内找不到 wb-num 读数 class 串 ⇒ 未判定')
    } else if (!readout.every((c) => c.includes('whitespace-nowrap'))) {
      v.push({
        rule: 'R1',
        msg: `StatCell 读数缺 whitespace-nowrap ⇒ 列宽一窄就把数字切成两半(现值 "${readout.join('" / "')}"）`,
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
      const plain = [...body.matchAll(/className="wb-cells grid/g)].length
      const fitted = [...body.matchAll(/className="wb-cells wb-cells-c3 grid/g)].length
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

  return { violations: v, unjudged: u }
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
    return execFileSync('git', ['show', `${rev}:${TARGET_REL}`], {
      encoding: 'utf8',
      cwd: REPO_ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 64 * 1024 * 1024,
    })
  } catch {
    return null
  }
}

// §22c 镜像常量出口:测试 import 这些判据单元,不得在测试里重抄一份。
export const __test__ = {
  REPO_ROOT,
  TARGET_REL,
  CELLS_PER_GROUP,
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
  const base = judge(real)
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
    ['摘掉 wb-split-c3 ⇒ R4 未判定不冒绿', real.replace(/bodyClassName="wb-split wb-split-c3"/, 'bodyClassName="wb-split"'), (r) => r.unjudged.some((x) => x.startsWith('R4'))],
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
  const prefix = `[读数不断行 240]`
  for (const m of unjudged) console.log(`⚠️  ${prefix} 未判定:${m}`)
  if (violations.length === 0) {
    if (unjudged.length > 0) {
      // §0.3:判据的输入集空了 ⇒ 既不记绿也不冒红(修复被整块删掉时不得静默通过)
      console.log(`⚪ ${prefix} ${face} 面未判定(${unjudged.length} 条判据无输入)`)
      process.exit(2)
    }
    console.log(`✅ ${prefix} ${face} 面通过(R1-R5 全绿)`)
    process.exit(0)
  }
  console.error(`\n❌ ${prefix} ${face} 面判出 ${violations.length} 处缺口:`)
  for (const x of violations) console.error(`   · ${x.rule} ${x.msg}`)
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
