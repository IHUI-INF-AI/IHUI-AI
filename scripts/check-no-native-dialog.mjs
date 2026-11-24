#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
/**
 * 原生弹窗守门 — 禁止 alert() / confirm() / prompt() 原生浏览器弹窗。
 *
 * 依据 AGENTS.md 第 4 节"禁用原生提示窗(强制)":必须用项目自有的 Tooltip / Dialog 统一交互。
 *
 * 2026-10-23 重写。旧门判**反**了:全量档报的 16 处"违规"16 处全是假阳(8 处是项目自己的
 * `useConfirm()` / `confirmDialog()` 合法出口,8 处是 `apps/web/public/vs/**` 里 Monaco 打包
 * 产物内的 TS 声明),而真原生弹窗 12 处一处没看见 —— 成员式 `window.confirm(...)` 被它自己的
 * `(?<!\.)` 前导守卫排除,箭头体 `() => confirm(...)` 被它 lookbehind 里的 `>` 排除。
 * 两道"防误伤"的守卫同时把真阳杀干净,而门挂 blocking、全量档恒 exit 0 ⇒ 静默了不知多久。
 *
 * 判据(实现在 `./lib/native-dialog-judge.mjs`,本文件只管取材/棘轮/报告):
 *   · member —— `window|globalThis|self|top|parent . alert|confirm|prompt (` ⇒ 无条件违规;
 *   · bare   —— 裸 `alert(|confirm(|prompt (` ⇒ 本文件内**没有**该名字本地绑定时才违规
 *               (有绑定 = 走的是项目自有出口)。绑定识别一律限在单行/单条 import 语句内 ——
 *               跨语句的宽松匹配会把 JSX 里那句真弹窗读成"有绑定",第一版就是这么漏的。
 *
 * 取材面纪律(§0.4):全量判 HEAD blob、`--staged` 判索引 blob、`--worktree` 人工逃生舱;
 * 清单与内容同面同轮,共用 `./lib/face-scan.mjs`。`public/` 下的第三方打包产物按面排除
 * (那是 vendored 资产,不是我们写的界面代码 —— 旧门把它当违规,是纯粹的假阳来源)。
 * 族本身走**差值棘轮**(锚点 = 该文件 HEAD 面自身命中数):存量还没清完,挂绝对红就是 §12e
 * 恒红门;存量归零后再谈升绝对档。
 *
 * 用法:
 *   node scripts/check-no-native-dialog.mjs --staged     pre-commit(新增即拦)
 *   node scripts/check-no-native-dialog.mjs              全量报告(存量只报数, exit 0)
 *   node scripts/check-no-native-dialog.mjs --worktree   人工逃生舱:量盘上清偿进度
 *   node scripts/check-no-native-dialog.mjs --self-test  判据自检
 *
 * 跳过方法(紧急):HUSKY_SKIP_NATIVE_DIALOG=1 git commit ...
 */
import { relative } from 'node:path'
import { pathToFileURL } from 'node:url'
import { COLORS as C } from './lib/logger.mjs'
import { isExcludedDirName } from './lib/exclude-dirs.mjs'
import { Undetermined, assertRepoRoot, selectFace } from './lib/face-reader.mjs'
import { addedLineNumbers, headAnchors, readSources, sourceCandidates } from './lib/face-scan.mjs'
import { countNativeCalls, hasLocalBinding, scanNativeCalls } from './lib/native-dialog-judge.mjs'

const ROOT = process.cwd()
const argv = process.argv.slice(2)
const isStaged = argv.includes('--staged')
const isWorktree = argv.includes('--worktree')
const isSelfTest = argv.includes('--self-test')
const isHelp = argv.includes('--help') || argv.includes('-h')

const SCAN_GLOBS = ['*.ts', '*.tsx', '*.js', '*.jsx']
const PREFILTER_RE = '(alert|confirm|prompt)[[:space:]]*\\('

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun && process.env.HUSKY_SKIP_NATIVE_DIALOG === '1') {
  console.log('⏭  原生弹窗守门(HUSKY_SKIP_NATIVE_DIALOG=1, 跳过)')
  process.exit(0)
}

if (isDirectRun && isHelp) {
  console.log(`
check-no-native-dialog.mjs — 原生弹窗守门(alert / confirm / prompt)

  --staged      pre-commit 档(判索引 blob;超出该文件 HEAD 基线即拦提交)
  --worktree    人工逃生舱:量盘上清偿进度(读磁盘,恒 exit 0,不作提交门禁)
  --self-test   判据自检
  不带参数      全量档(判 HEAD blob,存量只报数, exit 0)

判定:
  - window./globalThis./self./top./parent. + alert|confirm|prompt(  ⇒ 违规(无条件)
  - 裸 alert(/confirm(/prompt( 且本文件内没有该名字的本地绑定        ⇒ 违规
    (有本地绑定 = 项目自有出口,如 const { confirm } = useConfirm())
  - 注释、字符串字面量、类型签名位、public/ 下的第三方打包产物 ⇒ 不判
`)
  process.exit(0)
}

export async function run({ staged, worktree }) {
  const top = assertRepoRoot(ROOT, '原生弹窗守门')
  const picked = selectFace({ staged, worktree, def: 'head' })
  if (picked.error) {
    console.log(`${C.red}❌ ${picked.error}${C.reset}`)
    return 2
  }
  const face = picked.face

  console.log(`${C.cyan}${C.bold}[原生弹窗守门] 扫描 alert / confirm / prompt 调用...${C.reset}`)
  console.log(
    `${C.dim}规则: AGENTS.md 第 4 节 — 禁原生弹窗,必须走项目自有 Tooltip / Dialog(useConfirm / confirmDialog)${C.reset}`,
  )
  console.log(
    `${C.dim}取材面: ${face === 'staged' ? '索引 blob' : face === 'worktree' ? '工作树(人工逃生舱,不作提交门禁)' : 'HEAD blob'};按「该文件 HEAD 自身命中数」做差值棘轮${C.reset}`,
  )
  console.log('')

  const addedLines = staged ? addedLineNumbers(top) : null
  const listed = sourceCandidates(top, face, {
    prefilterRe: PREFILTER_RE,
    pathspecs: SCAN_GLOBS,
    skipSegmentTest: isExcludedDirName,
    excludePublic: true,
  })
  const candidates0 = staged ? listed.filter((rel) => addedLines.has(rel)) : listed
  if (candidates0.length === 0) {
    console.log(
      `${C.green}✅ ${staged ? '暂存区无含 alert/confirm/prompt 调用的源码变更,跳过' : '被审面无含 alert/confirm/prompt 调用的源码文件,跳过'}${C.reset}`,
    )
    return 0
  }
  const { texts: contents } = readSources(top, face, candidates0)
  const candidates = candidates0.filter((rel) => contents.has(rel))
  const anchor = staged
    ? headAnchors(top, candidates, (rel, src) => countNativeCalls(src))
    : new Map()

  let newHits = 0
  let stock = 0
  const reports = []
  for (const rel of candidates) {
    const hits = scanNativeCalls(contents.get(rel))
    const base = staged ? (anchor.get(rel) ?? 0) : hits.length
    const over = Math.max(0, hits.length - base)
    newHits += over
    stock += hits.length - over
    if (hits.length === 0) continue
    reports.push({
      file: relative(top, rel).split('\\').join('/'),
      over,
      base,
      items: hits.map((h) => ({ ...h, level: over > 0 ? 'blocking' : 'stock' })),
    })
  }

  console.log(`${C.bold}扫描结果:${C.reset}`)
  console.log(`  扫描文件: ${candidates.length} 个`)
  console.log(`  拦截数:   ${newHits} 处 (BLOCKING,超出该文件 HEAD 基线)`)
  console.log(`  存量:     ${stock} 处 (只报数,§12e 恒红门禁令)`)
  console.log('')

  if (reports.length === 0) {
    console.log(`${C.green}${C.bold}✅ 原生弹窗守门通过${C.reset}`)
    return 0
  }
  if (newHits > 0) {
    console.log(`${C.red}${C.bold}❌ 发现 ${newHits} 处新增原生弹窗:${C.reset}\n`)
  } else {
    console.log(
      `${C.yellow}${C.bold}⚠️  本次提交无新增;下列 ${stock} 处存量待清偿(出路见每行下方)${C.reset}\n`,
    )
  }
  for (const r of reports) {
    console.log(`${r.over > 0 ? C.red : C.yellow}${r.file}${C.reset}  ${r.over > 0 ? `超出 HEAD 基线 ${r.base}` : `存量 ${r.items.length}`}`)
    for (const h of r.items) {
      console.log(
        `  ${C.dim}行 ${h.line}:${h.col}${C.reset} ${h.level === 'blocking' ? C.red : C.dim}[${h.level === 'blocking' ? 'BLOCKING' : '存量'}] [${h.form}:${h.name}]${C.reset} ${h.snippet}`,
      )
    }
    console.log('')
  }
  console.log(`${C.dim}修复方法:${C.reset}`)
  console.log(`  1. 确认框:web 用 useConfirm() 的 confirm({title, description, variant}) 或 confirmDialog();`)
  console.log(`     小程序/RN 用项目自有 Dialog 组件,不得引 window.confirm。`)
  console.log(`  2. 输入框:用自有 Dialog + TextField;提示用 Tooltip(§4 同时禁 title 原生提示)。`)
  console.log(`  3. 详细规则见 AGENTS.md 第 4 节"禁用原生提示窗(强制)"。`)
  console.log('')

  if (staged && newHits > 0) {
    console.log(`${C.red}${C.bold}❌ 原生弹窗守门失败 — 提交已阻止${C.reset}`)
    console.log(`${C.dim}跳过方法:HUSKY_SKIP_NATIVE_DIALOG=1 git commit ...(会留痕)${C.reset}`)
    return 1
  }
  if (!staged) {
    console.log(
      `${C.yellow}${C.bold}⚠️  ${face === 'worktree' ? '工作树档只供人工量进度(exit 0)' : '全量模式仅报数(exit 0)'}${C.reset}`,
    )
  }
  return 0
}

function ok(cond, msg) {
  if (!cond) throw new Error(msg || '断言不成立')
}

/**
 * 判据自检。每一型"放过"都必须配一型"照判"——旧门的病就是防误伤的守卫把真阳也防掉了,
 * 只测不误伤会测出一道永远绿的空门。
 */
export function selfTest() {
  const cases = []
  const t = (name, fn) => cases.push({ name, fn })
  const linesOf = (text) => scanNativeCalls(text).map((h) => `${h.form}:${h.name}@${h.line}`)

  t('N01 window.confirm / window.prompt ⇒ member 违规', () => {
    const src = `export function P() {\n  if (!window.confirm('删?')) return\n  const x = window.prompt('备注')\n  return x\n}\n`
    const got = linesOf(src)
    ok(got.length === 2 && got.every((g) => g.startsWith('member:')), JSON.stringify(got))
  })
  t('N02 箭头体裸 confirm 且文件无绑定 ⇒ 违规(旧门正是漏在这一型)', () => {
    const src = `export function T() {\n  return <button onClick={() => confirm('确认删除?') && del()} />\n}\n`
    ok(linesOf(src).includes('bare:confirm@2'), JSON.stringify(linesOf(src)))
  })
  t('N03 本地绑定(useConfirm 解构)⇒ 放过,且**不跨语句**误认绑定', () => {
    const bound = `import { useConfirm } from '@/hooks/use-confirm'\nexport function P() {\n  const { confirm, ConfirmDialogRenderer } = useConfirm()\n  return <button onClick={() => { void confirm({ title: 'x' }) }}>{ConfirmDialogRenderer}</button>\n}\n`
    ok(linesOf(bound).length === 0, JSON.stringify(linesOf(bound)))
    // 关键反例:文件里只有 JSX 的 `() => confirm(...)`,没有任何绑定 ⇒ 必须判红
    const unbound = `import { Button } from '@ihui/ui-react'\nexport function P() {\n  return <button onClick={() => confirm('x')} />\n}\n`
    ok(linesOf(unbound).length === 1, JSON.stringify(linesOf(unbound)))
  })
  t('N04 形参绑定 ⇒ 放过(CLI 测试里的 confirm 是注入的假函数)', () => {
    const src = `function makeCtx(confirm: (a: unknown) => Promise<boolean>) {\n  return { run: async (args: unknown) => confirm(args) }\n}\n`
    ok(linesOf(src).length === 0, JSON.stringify(linesOf(src)))
  })
  t('N05 注释与字符串 ⇒ 放过', () => {
    const src = `// 这里曾写 window.confirm(...)\nconst doc = '用 confirm() 确认'\nexport const z = 1\n`
    ok(linesOf(src).length === 0, JSON.stringify(linesOf(src)))
  })
  t('N06 类型签名位不算调用', () => {
    const src = `interface S {\n  confirm(opts: { title: string }): Promise<boolean>\n}\nexport type Q = S\n`
    ok(linesOf(src).length === 0, JSON.stringify(linesOf(src)))
  })
  t('N07 成员式优先于裸调用(同一处不重复计)', () => {
    const src = `export function P() {\n  window.alert('hi')\n}\n`
    const got = linesOf(src)
    ok(got.length === 1 && got[0].startsWith('member:alert'), JSON.stringify(got))
  })
  t('N08 计数口径与命中清单同尺(棘轮锚点用的就是它)', () => {
    const src = `export function P() {\n  if (!window.confirm('a')) return\n  if (!window.confirm('b')) return\n}\n`
    ok(countNativeCalls(src) === scanNativeCalls(src).length && countNativeCalls(src) === 2)
  })
  t('N09 形状锁:import 别名不构成本地绑定(改名救不了红)', () => {
    const src = `import { confirm as myConfirm } from '@/lib/x'\nexport function P() {\n  return myConfirm('a') || confirm('b')\n}\n`
    ok(hasLocalBinding(src, 'myConfirm'), '别名应算 myConfirm 的绑定')
    ok(!hasLocalBinding(src, 'confirm'), '`confirm as x` 之后 confirm 不是本地名')
    ok(linesOf(src).length === 1, JSON.stringify(linesOf(src)))
  })

  let pass = 0
  const out = []
  for (const c of cases) {
    try {
      c.fn()
      pass++
      out.push(`  ✅ ${c.name}`)
    } catch (e) {
      out.push(`  ❌ ${c.name} — ${e?.message ?? e}`)
    }
  }
  console.log(out.join('\n'))
  console.log(`\n原生弹窗守门自检: ${pass}/${cases.length} 通过`)
  if (pass !== cases.length) {
    console.log(`${C.red}❌ 自检未过 — 判据本身坏了${C.reset}`)
    return 1
  }
  console.log(`${C.green}✅ 原生弹窗守门自检通过${C.reset}`)
  return 0
}

if (isDirectRun) {
  try {
    const code = isSelfTest ? selfTest() : await run({ staged: isStaged, worktree: isWorktree })
    process.exit(code)
  } catch (e) {
    const undetermined = e instanceof Undetermined
    console.log(
      `${undetermined ? C.yellow : C.red}${undetermined ? '⚠️  无法判定(取材失败,既不记绿也不冒红)' : '❌ 原生弹窗守门异常'}: ${e?.message ?? e}${C.reset}`,
    )
    process.exit(2)
  }
}

export const __test__ = { scanNativeCalls, countNativeCalls, hasLocalBinding, selfTest, PREFILTER_RE }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
