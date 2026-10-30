#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 守门 274:RN 字号可读地板对账(blocking;T1 绝对零容忍,T2「有档不取档」只报数)
 *
 * 为什么必须有门(2026-10-31 实测):
 *  - `TYPE_STEPS`(packages/design-tokens/src/typography.ts)是全端字号唯一真相源,最小档此前是
 *    `caption: 11`。RN 面现读却有 **97 处写字面量字号低于 11**(86 处 10 + 11 处 9):
 *    9px 在手机上是"看得出有字、读不出写什么"的级别,而作者名、文件类型、封面标题都在用它 ——
 *    这是可读性缺陷,不是审美问题。
 *  - 更根本的成因:**web 早已强制 10px 计数徽章模板(AGENTS §4),而字号表里从来没有这一档**。
 *    端内想写一个比 11 小的字,唯一去处就是不写(或写死数字)。所以本票先在表里落 `badge: 10`,
 *    再把 11 枚 9px 收进档(badge/caption),地板才既守得住可读性、又不至于逼人写回裸数字。
 *
 * 判据:
 *  T1 字面量 `fontSize: N` 且 N < 地板(地板 = 被审面 TYPE_STEPS 里最小的 size,**不写死 10**)
 *     ⇒ 违规。立门当轮存量已归零 ⇒ 本维用绝对零容忍(§0.2:升 blocking 的前置 = 存量归零)。
 *  T2 字面量 `fontSize: N` 恰等于某档 size(如裸写 10/12/14)⇒ 只在结论行报数,不判红:
 *     那是"有档不取档"的第二真相维度,存量按 §12e 不做成恒红门;要清它得逐屏看观感,另计。
 *
 * 盲区(不判,也不记通过):
 *  · 字符串/带单位形态('9px' / `rpx(18)`)、计算式(fontSize: n * 1.2)、`{...rnType.x}` 展开
 *    —— 本门只认**数字字面量**,其余形态静态判不了;
 *  · `allowFontScaling={false}` 关掉系统字号放大那一类可读性问题(要读运行时行为);
 *  · 小程序/web 两腿不射程内(小程序另有字号对账,跨端一致性由守门 128/93 管)。
 *
 * 口径:全量档 = 审计报告;--staged 判索引 blob vs HEAD blob;取不到内容 ⇒ exit 2 未判定(§0.3/§0.4)。
 * 用法:node scripts/check-rn-type-floor.mjs [--staged|--worktree|--strict|--self-test|--quiet|--json]
 * 紧急跳过:HUSKY_SKIP_RN_TYPE_FLOOR=1 git commit ...(须留痕,§0.10)
 */
import { existsSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import {
  FACE_LABEL,
  catBatch,
  gitRaw,
  readWorktreeFile,
  selectFace,
} from './lib/face-reader.mjs'
import { maskComments } from './lib/code-mask.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC_RELS = ['apps/mobile-rn/src', 'packages/app/src', 'packages/ui-native/src']
const TYPE_REL = 'packages/design-tokens/src/typography.ts'
const SKIP_ENV = 'HUSKY_SKIP_RN_TYPE_FLOOR'

const argv = process.argv.slice(2)
const quiet = argv.includes('--quiet')
const json = argv.includes('--json')
const strict = argv.includes('--strict')
const selfTest = argv.includes('--self-test')
const { face, error: faceErr } = selectFace({
  staged: argv.includes('--staged'),
  worktree: argv.includes('--worktree'),
})

/**
 * 字号表 → 档位 size 集合(纯函数,自检与主流程共用)。读不出表 ⇒ null(调用方落未判定)。
 * 只认 `key: { size: N, … }` 这一种形状;写不出这张表就是表本身改了形状,该由人来对齐判据。
 */
function stepsFromSource(src) {
  if (typeof src !== 'string') return null
  const body = /TYPE_STEPS\s*=\s*\{([\s\S]*?)\n\}/.exec(maskComments(src))
  if (!body) return null
  const steps = [...body[1].matchAll(/^\s*([A-Za-z_$][\w$]*)\s*:\s*\{[^{}]*?size:\s*(\d+(?:\.\d+)?)/gm)]
    .map((m) => ({ name: m[1], size: Number(m[2]) }))
  return steps.length ? steps : null
}

/**
 * 纯判据:T1 低于地板的字面量 + T2 有档不取档的字面量。
 * @returns {{t1:{line:number,size:number}[],t2:{line:number,size:number}[],unparsed:number}}
 */
function scanText(text, steps) {
  const code = maskComments(String(text ?? ''))
  const floor = Math.min(...steps.map((s) => s.size))
  const tiered = new Set(steps.map((s) => s.size))
  const t1 = []
  const t2 = []
  for (const m of code.matchAll(/\bfontSize\s*:\s*(\d+(?:\.\d+)?)(?![\w.])/g)) {
    const n = Number(m[1])
    const line = code.slice(0, m.index).split('\n').length
    if (n < floor) t1.push({ line, size: n })
    else if (tiered.has(n)) t2.push({ line, size: n })
  }
  return { t1, t2 }
}

function listFiles(f) {
  const scoped = (p) => SRC_RELS.some((r) => p.startsWith(`${r}/`)) && /\.(tsx|ts)$/.test(p)
  if (f === 'worktree') {
    const prefix = ROOT.split(sep).join('/').length + 1
    const out = []
    const walk = (dir) => {
      for (const e of readdirSync(dir)) {
        if (e === 'node_modules' || e.startsWith('.')) continue
        const full = join(dir, e)
        if (statSync(full).isDirectory()) walk(full)
        else if (/\.(tsx|ts)$/.test(full)) out.push(full.split(sep).join('/').slice(prefix))
      }
    }
    for (const r of SRC_RELS) if (existsSync(join(ROOT, r))) walk(join(ROOT, r))
    return out.filter(scoped)
  }
  if (f === 'staged')
    return gitRaw(['diff', '--cached', '--name-only', '--diff-filter=ACM', '--', ...SRC_RELS], ROOT)
      .split('\n')
      .map((s) => s.trim())
      .filter(scoped)
  return gitRaw(['ls-tree', '-r', '--name-only', 'HEAD', '--', ...SRC_RELS], ROOT)
    .split('\n')
    .map((s) => s.trim())
    .filter(scoped)
}

const FIXTURE = `export const TYPE_STEPS = {
  /** 徽章 */
  badge: { size: 10, lineHeight: 12, weight: 600 },
  caption: { size: 11, lineHeight: 16, weight: 400 },
  body: { size: 14, lineHeight: 20, weight: 400 },
  displayLg: { size: 30, lineHeight: 38, weight: 700 },
}
`

function runSelfTest() {
  const fails = []
  let asserted = 0
  const ok = (c, m) => {
    asserted += 1
    if (!c) fails.push(m)
  }
  const steps = stepsFromSource(FIXTURE)
  ok(!!steps && steps.length === 4, '档位表解析失效(夹具应按四档解析)')
  ok(Math.min(...steps.map((s) => s.size)) === 10, '地板必须取表里最小档')
  ok(stepsFromSource('export const A = 1') === null, '读不出表必须 null ⇒ 落未判定,不得猜地板')
  // 注释里的形状不算表(遮罩后仍命中就是坏尺子)
  ok(
    stepsFromSource('/* TYPE_STEPS = {\n  ghost: { size: 99 },\n}\n */') === null,
    '注释里的 TYPE_STEPS 不得被当成表',
  )
  const below = scanText('<Text style={{ fontSize: 9 }} />', steps)
  ok(below.t1.length === 1 && below.t1[0].size === 9, 'T1 失效:低于地板的字面量必须点名')
  const atFloor = scanText('<Text style={{ fontSize: 10 }} />', steps)
  ok(atFloor.t1.length === 0 && atFloor.t2.length === 1, 'T2 失效:恰等于档位 ⇒ 只进"有档不取档"报数')
  const tiered = scanText('<Text style={{ fontSize: rnType.badge.size }} />', steps)
  ok(tiered.t1.length === 0 && tiered.t2.length === 0, '取档写法不该进任何一维')
  const str = scanText("<Text style={{ fontSize: '9px' }} />", steps)
  ok(str.t1.length === 0, '字符串形态落盲区(头注已点名),不得当违规')
  const commented = scanText('// fontSize: 8\n<Text style={{ fontSize: 14 }} />', steps)
  ok(commented.t1.length === 0, '注释里的字号被当成了违规')
  const big = scanText('<Text style={{ fontSize: 30, lineHeight: 38 }} />', steps)
  ok(big.t2.length === 1, '30 是 displayLg 档 ⇒ 应进 T2 报数(档位集取的是整张表,不是硬编码三五个)')
  if (fails.length) {
    for (const f of fails) console.error(`[SELF-TEST FAIL] ${f}`)
    return 1
  }
  console.log(`[SELF-TEST OK] 字号地板判据自检 ${asserted} 组通过(地板取自档位表最小 size,夹具档 10)`)
  return 0
}

function main() {
  if (selfTest) return runSelfTest()
  if (faceErr) {
    console.error(`❌ ${faceErr}`)
    return 2
  }
  if (process.env[SKIP_ENV]) {
    console.error(`⚠️ 已跳过(${SKIP_ENV}=1)—— 按 §0.10 计入跳门留痕,不得读成已通过`)
    return 0
  }
  const files = listFiles(face)
  if (files.length === 0) {
    console.error('❌ 射程内一个文件都没枚举到 ⇒ 判死(枚举到 0 不等于没有,§0.3)')
    return 2
  }
  const rev = face === 'staged' ? ':' : face === 'head' ? 'HEAD:' : ''
  const keyOf = (rel) => (face === 'worktree' ? rel : rev + rel)
  let texts
  try {
    if (face === 'worktree') {
      texts = new Map(files.map((r) => [r, readWorktreeFile(ROOT, r)]))
      texts.set(TYPE_REL, readWorktreeFile(ROOT, TYPE_REL))
    } else {
      texts = catBatch(ROOT, [...files.map((r) => rev + r), rev + TYPE_REL], {
        maxBuffer: 1 << 29,
        timeout: 180000,
      })
    }
  } catch (e) {
    console.error(`❌ 无法判定:${e?.message ?? e}`)
    return 2
  }
  const get = (rel) => texts.get(keyOf(rel)) ?? null
  const steps = stepsFromSource(get(TYPE_REL))
  if (!steps) {
    console.error(
      `❌ 未判定:取不到 ${FACE_LABEL[face]} 面 ${TYPE_REL} 的 TYPE_STEPS ⇒ 地板无从确定,不猜(§0.3)`,
    )
    return 2
  }
  const floor = Math.min(...steps.map((s) => s.size))
  const perFile = new Map()
  let undetermined = 0
  let t2Total = 0
  for (const rel of files) {
    const text = get(rel)
    if (text === null) {
      undetermined += 1
      continue
    }
    const r = scanText(text, steps)
    t2Total += r.t2.length
    if (r.t1.length) perFile.set(rel, r)
  }
  const totalT1 = [...perFile.values()].reduce((s, r) => s + r.t1.length, 0)

  if (!quiet) {
    console.log(
      `[check-rn-type-floor] 面=${FACE_LABEL[face]} | ${files.length} 文件 | 地板 ${floor}(现读 ${TYPE_REL} 最小档,共 ${steps.length} 档) | 低于地板: ${totalT1} 处;有档不取档(T2,只报数): ${t2Total} 处`,
    )
    for (const [rel, r] of perFile)
      for (const v of r.t1) console.log(`   T1 ${rel}:${v.line} fontSize:${v.size} < 地板 ${floor}`)
    if (undetermined > 0)
      console.error(`⚠️ ${undetermined} 个文件取不到 ${FACE_LABEL[face]} 内容 ⇒ 未判定,不记绿`)
  }
  if (json)
    console.log(
      JSON.stringify({
        face,
        files: files.length,
        floor,
        steps: steps.length,
        t1: totalT1,
        t2: t2Total,
        undetermined,
      }),
    )

  if (face !== 'staged') {
    if (strict && totalT1) {
      console.error(`❌ --strict 问责存量:${totalT1} 处低于地板 ${floor}`)
      return 1
    }
    console.log(
      `ℹ️ 全量档:T1 绝对零容忍在提交链上判(--strict 才在这里问责);T2 有档不取档 ${t2Total} 处属第二真相维度,清它须逐屏看观感,本门不判红`,
    )
    return undetermined > 0 ? 2 : 0
  }
  if (totalT1) {
    console.error(
      `❌ T1 字号地板(绝对零容忍):${addedPreview(perFile, floor)}`,
    )
    console.error(
      `   改法:取档 \`rnType.<档>.size\`(表内最小档 = ${floor},对应 web 既成事实的 10px 徽章模板);` +
        '需要更小的字**不是**豁免理由 —— 先回答"这行字用户能不能读"。',
    )
    console.error('   确属非文字元素(如 SVG 内部字号不在此列,本门只看 style 里的 fontSize):写行内说明并登记豁免,不要跳门。')
    return 1
  }
  console.log('✅ 提交链口径无低于地板的字面量字号')
  return undetermined > 0 ? 2 : 0
}

function addedPreview(perFile, floor) {
  const bits = []
  for (const [rel, r] of perFile)
    bits.push(`${rel}(${r.t1.map((v) => `L${v.line}:${v.size}`).slice(0, 3).join(',')},地板 ${floor})`)
  return bits.slice(0, 8).join(' / ')
}

export const __test__ = { scanText, stepsFromSource, runSelfTest, FIXTURE, SKIP_ENV, SRC_RELS, TYPE_REL }

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  try {
    process.exit(main())
  } catch (e) {
    console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
