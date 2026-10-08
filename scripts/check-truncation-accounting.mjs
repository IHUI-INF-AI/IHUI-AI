#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
/**
 * check-truncation-accounting.mjs — 有界列表截断诚实 + 投递档位收口绊线(票 G-998100/G-998101,观察票的落地形态)
 *
 * 这是什么 / 不是什么:
 *   两张票都是「观察」档,票面自述落地形态就是一把**只读普查尺 + 绊线**,不是 blocking 判据:
 *   G-998101 的机械判据(票面验收草案原话):「对前端消费的 DTO 列表键,断言其类型声明里
 *   `truncated` 出现处必伴随数值键,否则非零退出并列出文件」—— 即 (a) `truncated` 不得裸奔
 *   (只说"有东西没进来",说不出多少);同块必须有计数/总量型数值兄弟键。
 *   G-998100 的可执行判据:我方**目前没有档位过滤概念**(票面现读:有 Last-Event-ID 续传
 *   重放通道,无 profile/tier 砍字段)。本门装一条**绊线**:一旦面上出现投递档位/流过滤形态
 *   (deliveryProfile/streamProfile/…词表),即视为"决定砍"已发生 ⇒ 收口不变量(被 profile
 *   过滤的事件必须最终被某个不可过滤的事件收口 + 两路终态逐字节一致测试)必须同期落地;
 *   全量档只报数,--staged 咬到 ⇒ 判红交人核对收口断言在不在。没有档位形态 ⇒ 绊线静默,
 *   账面如实报 0。
 *
 * 判据(三态分开,绝不并桶):
 *   站点(site)   = 类型/对象声明块(interface / type alias / z.object)同时声明
 *                  **数组成员 + `truncated` 成员**却**没有任何计数/总量型数值兄弟键**
 *                  (词表:total/count/unlisted/omitted/dropped/excluded/hidden/appliedLimit/
 *                  bytes/chars/items/entries 结尾,且类型是 number/bigint/z.number)。
 *                  只认**声明块**——函数体/if 块里的局部 `truncated` 用法不在射程(防误报)。
 *   合成读点     = `X.length + <计数名>` 形态(「已裁列表长度 + 未列计数」的合成)。
 *                  票面 G-998101:「同一数值只允许一个读函数」。是否同源静态判不了 ⇒
 *                  **只报数**,由人对账;判 0 处不冒绿(尺子看得见这格)。
 *   绊线(tripwire)= 档位/流过滤词表命中(只咬**代码标识符**:viewA 上注释/字符串全遮 ——
 *                  存量 b76-08a 的连接级能力位 `deliveryProfile` 是字符串槽位+注释提及,
 *                  不是已落地的砍字段实现,不得咬;真把档位过滤写成代码才进 --staged 判红面)。
 *                  --staged 咬到 ⇒ 1;全量 ⇒ 报数。**不是**"出现即违规",是"出现即须核对"。
 *   设计提及       = 同一词表在**原文**(含注释/字符串)上的命中,是绊线的**超集**,只报数 ——
 *   (mentions)      "先有产品决策"的前兆观察位;提及永不判红。
 *   Python 面    = apps/ai-service/app 的 `truncated` 裸计数(票面:缺"是否出到前端"的证据
 *                  步骤,专项盘点未做)⇒ 只报数,永不判红,绝不折进 TS 结论。
 *
 * 棘轮方向(与守门 167/121 同族):全量档(HEAD 面)只报数恒 exit 0;`--staged` 只咬本次
 *   改动动过的文件 —— 改到带裸 `truncated` 声明块的那一刻必须顺手补计数键。
 *
 * 为什么不与既有门重复(现读确认,非"看起来不像"):
 *   守门 178(check-list-cap-honesty)判 **UI 展示层**的截断帽交代;本门判**类型声明层**的
 *   计数伴随 —— 谓词位置不同(UI 渲染 vs DTO 形状),票面验收草案点名的就是后者。
 *   `packages/types/src/api-contracts.ts` 的 BoundedListProjection 已是**正型**(truncated +
 *   total + zod refine 强制)—— 本门对它放行,阳性对照是"少写 total 的同型块"。
 *
 * 已知判不了格(如实登记,不得读成"已确认没有"):
 *   ① 计数为零时整键缺席(G-998101 (b))是**运行时**语义,静态声明层看不见 ⇒ 不判;
 *   ② 「同一数值只允许一个读函数」(c) 的同源性判不了 ⇒ 合成读点只报数;
 *   ③ zod `.refine` 运行时强制(truncated ⇒ total)在声明层看不见 ⇒ 有 refine 无静态 total
 *      兄弟仍会点站 —— 按票面字面判,宁报不漏,人工核销;
 *   ④ Python 面不判(见上)。
 *
 * 手动:
 *   node scripts/check-truncation-accounting.mjs               # 全量档(HEAD blob):只报数
 *   node scripts/check-truncation-accounting.mjs --staged      # 提交链:改到的文件里站点/绊线 ⇒ exit 1
 *   node scripts/check-truncation-accounting.mjs --json
 *   node scripts/check-truncation-accounting.mjs --self-test   # 构造面正反对照,零 git、零写盘
 * 退出码:0 过(全量档红只报数)/ 1 判红(--staged)/ 2 判不了(面取不到/空扫/括号配不平)。
 */

import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { maskCommentsAndStrings } from './lib/code-mask.mjs'
import { Undetermined, assertRepoRoot, catBatch, gitRaw, readWorktreeFile, selectFace } from './lib/face-reader.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
/** ROOT 由脚本自身位置推导(§15,不得写死盘符) */
const ROOT = resolve(HERE, '..')

export const GATE = 'check-truncation-accounting'
/** TS 判据射程:前端消费的 DTO/类型声明面(票面建议落点域的对账面)。 */
export const TS_ROOTS = ['packages/', 'apps/api/src/']
/** Python 普查面(只报数,不判)。 */
export const PY_ROOT = 'apps/ai-service/app/'
const TS_FILE_RE = /\.(ts|mts|cts)$/
const PY_FILE_RE = /\.py$/
const TEST_RE = /(^|\/)(?:tests?|__tests__|e2e|test)\//
const GIT_TIMEOUT = 120000

/** 计数/总量型兄弟键词表(G-998101 (a)):名字以这些词结尾 + 数值型才算"伴随计数"。 */
export const COUNT_NAME_RE =
  /(?:total|count|unlisted|omitted|dropped|excluded|hidden|appliedlimit|bytes|chars|items|entries)$/i
export const NUMERIC_TYPE_RE = /\bnumber\b|\bbigint\b|(^|[^.\w])z\s*\.\s*number/
export const ARRAY_TYPE_RE = /\[\s*\]|\bArray<|\bReadonlyArray<|\bz\s*\.\s*array\b/
/** 声明块头(interface / type alias / z.object / object({)—— 函数体与 if 块不在射程。 */
export const BLOCK_HEADER_RE =
  /(?:\binterface\s+[A-Za-z_$][\w$]*|\btype\s+[A-Za-z_$][\w$]*\s*=|\bz\s*\.\s*object\s*\(\s*|\bobject\s*\(\s*\{\s*)$/
/** 成员声明:`name?: type`(TS 与 zod 两型同吃)。 */
const MEMBER_RE = /(?:^|[;,{\n])\s*(?:readonly\s+)?([A-Za-z_$][\w$]*)\s*\??\s*:\s*([^,;\n}]+)/g
/** G-998100 绊线词表:投递档位/流过滤形态(原文含注释,设计意图先出现在注释里)。 */
export const PROFILE_TIER_RE =
  /\b(?:deliveryProfile|deliveryTier|streamProfile|streamTier|sseProfile|profileFilter|replayProfile|liveProfile|bandwidthTier)\b/
/** 合成读点:`.length + <计数名>`(G-998101 (c),只报数)。 */
export const SYNTH_RE = /\.length\s*\+\s*([A-Za-z_$][\w$]*)/g
const SYNTH_NAME_RE = /(?:unlisted|count|total|omitted|dropped|hidden|excluded)/i

/** 行号(1 起)。两视图等长 ⇒ 直通原文件行号。 */
function lineOf(view, idx) {
  let line = 1
  for (let i = 0; i < idx && i < view.length; i++) if (view[i] === '\n') line++
  return line
}

/**
 * 纯判据核心(镜像主战场):对一个 TS 源文件判"truncated 声明块有没有计数兄弟"。
 * 返回 { sites, unbalanced, synthesis, tripwire, tripwireMentions };
 * tripwire 咬**代码标识符**(viewA),tripwireMentions 在**原文**(含注释/字符串)上扫、只报数。
 */
export function judgeSource(src) {
  if (typeof src !== 'string') return { sites: [], unbalanced: false, synthesis: [], tripwire: [], tripwireMentions: [] }
  const viewA = maskCommentsAndStrings(src)
  const out = { sites: [], unbalanced: false, synthesis: [], tripwire: [], tripwireMentions: [] }
  const stack = []
  for (let i = 0; i < viewA.length; i++) {
    const ch = viewA[i]
    if (ch === '{') stack.push(i)
    else if (ch === '}') {
      const open = stack.pop()
      if (open === undefined) {
        out.unbalanced = true
        return out
      }
      const interior = viewA.slice(open + 1, i)
      // 廉价预筛:块内根本没有 truncated 声明就不解析成员(大文件性能 + 判据只咬这一型)
      if (!/\btruncated\s*\??\s*:/.test(interior)) continue
      const prefix = viewA.slice(Math.max(0, open - 140), open).replace(/\s+/g, ' ').trim()
      if (!BLOCK_HEADER_RE.test(prefix)) continue // 函数体/if 块里的同名局部不判
      const members = []
      MEMBER_RE.lastIndex = 0
      let m
      while ((m = MEMBER_RE.exec(interior)) !== null)
        members.push({ name: m[1], type: (m[2] || '').trim() })
      const hasTruncated = members.some((x) => x.name === 'truncated')
      if (!hasTruncated) continue
      const hasArray = members.some((x) => ARRAY_TYPE_RE.test(x.type))
      const hasCount = members.some(
        (x) => x.name !== 'truncated' && COUNT_NAME_RE.test(x.name) && NUMERIC_TYPE_RE.test(x.type),
      )
      if (hasArray && !hasCount)
        out.sites.push({
          line: lineOf(viewA, open),
          excerpt: prefix.replace(/\s+/g, ' ').trim().slice(-56),
        })
    }
  }
  if (stack.length) out.unbalanced = true // 栈尾未闭合:与多出 '}' 同判,不猜不记绿
  SYNTH_RE.lastIndex = 0
  let s
  while ((s = SYNTH_RE.exec(viewA)) !== null)
    if (SYNTH_NAME_RE.test(s[1]))
      out.synthesis.push({ line: lineOf(viewA, s.index), name: s[1] })
  let t
  // 绊线咬**代码标识符**(viewA:注释/字符串/模板全遮)—— 存量里 b76-08a 的连接级能力位
  // `deliveryProfile` 是字符串槽位 + 注释提及("宿主暂无等值生产点"),不是已落地的砍字段
  // 实现,不得咬;只有真把档位过滤写成代码才进 --staged 判红面。
  const TRIP_GLOBAL = new RegExp(PROFILE_TIER_RE.source, 'g')
  while ((t = TRIP_GLOBAL.exec(viewA)) !== null)
    out.tripwire.push({ line: lineOf(viewA, t.index), word: t[0] })
  // 设计提及(原文含注释/字符串,是绊线的超集):只报数 —— 票面"先有产品决策"的前兆观察位。
  const MENTION_GLOBAL = new RegExp(PROFILE_TIER_RE.source, 'g')
  while ((t = MENTION_GLOBAL.exec(src)) !== null)
    out.tripwireMentions.push({ line: lineOf(viewA, t.index), word: t[0] })
  return out
}

/** Python 面裸计数(纯函数,只报数):`truncated` 出现次数。 */
export function countTruncatedPy(src) {
  if (typeof src !== 'string') return 0
  return (String(src).match(/\btruncated\b/g) || []).length
}

export function inTsRoots(p) {
  return TS_ROOTS.some((r) => p.startsWith(r)) && TS_FILE_RE.test(p) && !TEST_RE.test(p)
}
export function inPyRoots(p) {
  return p.startsWith(PY_ROOT) && PY_FILE_RE.test(p) && !TEST_RE.test(p)
}

/** 各面的文件清单(head=ls-tree / staged=ls-files;内容一律 catBatch)。 */
export function listFace(root, face) {
  if (face === 'head')
    return gitRaw(['ls-tree', '-r', '--name-only', 'HEAD', '-z'], root, { timeout: GIT_TIMEOUT })
      .split('\0')
      .filter((p) => inTsRoots(p) || inPyRoots(p))
  return gitRaw(['ls-files', '-z'], root, { timeout: GIT_TIMEOUT }).split('\0').filter((p) => inTsRoots(p) || inPyRoots(p))
}

export function readFace(root, face, paths) {
  const map = new Map()
  if (!paths.length) return map
  if (face === 'worktree') {
    for (const p of paths) map.set(p, readWorktreeFile(root, p))
    return map
  }
  const rev = face === 'staged' ? '' : 'HEAD'
  const specs = paths.map((p) => `${rev}:${p}`)
  const got = catBatch(root, specs, { maxBuffer: 1 << 29, timeout: GIT_TIMEOUT })
  for (let i = 0; i < paths.length; i++) map.set(paths[i], got.get(specs[i]) ?? null)
  return map
}

/** 汇总判定:--staged 咬到的文件里有站点/绊线 ⇒ 1;未判定 ⇒ 2;全量只报数 ⇒ 0。 */
export function decide({ perFile, undetermined, mode, filesScanned }) {
  const sites = []
  const tripwire = []
  const mentions = []
  const counts = { files: 0, tsFiles: 0, pyFiles: 0, pyTruncated: 0, synthesis: 0, mentions: 0 }
  for (const [file, r] of perFile) {
    counts.files++
    if (inPyRoots(file)) {
      counts.pyFiles++
      counts.pyTruncated += r.pyTruncated
      continue
    }
    counts.tsFiles++
    counts.synthesis += r.synthesis.length
    for (const s of r.sites) sites.push({ file, line: s.line, excerpt: s.excerpt })
    for (const t of r.tripwire) tripwire.push({ file, line: t.line, word: t.word })
    const ms = r.tripwireMentions || []
    counts.mentions += ms.length
    for (const t of ms) mentions.push({ file, line: t.line, word: t.word })
  }
  let exit = 0
  if (undetermined.length) exit = 2
  else if (filesScanned === 0) exit = 2 // 空扫不记绿(尺子失明那一族)
  else if (mode === 'staged' && (sites.length || tripwire.length)) exit = 1
  return { exit, sites, tripwire, mentions, undetermined, mode, counts }
}

export function analyze(root, face) {
  let effFace = face
  let targets = null
  let fellBack = false
  if (face === 'staged') {
    targets = gitRaw(
      ['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z'],
      root,
      { timeout: GIT_TIMEOUT },
    )
      .split('\0')
      .filter((p) => inTsRoots(p) || inPyRoots(p))
    if (targets.length === 0) {
      effFace = 'head'
      targets = null
      fellBack = true
    }
  }
  const paths = targets ?? listFace(root, effFace)
  if (paths.length === 0)
    throw new Undetermined(`${effFace} 面枚举到 0 个射程内源文件 —— 空扫不记绿`)
  const sources = readFace(root, effFace, paths)
  const perFile = new Map()
  const undetermined = []
  for (const [file, code] of sources) {
    if (code === null) {
      undetermined.push(file)
      continue
    }
    if (inPyRoots(file)) {
      perFile.set(file, { pyTruncated: countTruncatedPy(code), sites: [], synthesis: [], tripwire: [], unbalanced: false })
      continue
    }
    perFile.set(file, judgeSource(code))
  }
  return {
    ...decide({ perFile, undetermined, mode: fellBack ? 'full' : effFace, filesScanned: perFile.size }),
    face: effFace,
    fellBack,
  }
}

/** 自检:构造面成对正反例,零副作用、零 git、零写盘。cond 一律是已求值布尔(IIFE)。 */
function selfTest() {
  let ran = 0
  let fail = 0
  const eq = (label, got, want) => {
    ran++
    const g = JSON.stringify(got)
    const w = JSON.stringify(want)
    if (g !== w) {
      fail++
      console.log(`  ❌ ${label}\n      got  ${g}\n      want ${w}`)
    } else console.log(`  ✅ ${label}`)
  }
  // P1 阳性对照:数组 + truncated 裸奔、无计数兄弟 ⇒ 站点(票面验收草案的那一型)
  const BARE =
    'export interface ActivityPage {\n' +
    '  items: ActivityItem[]\n' +
    '  truncated?: boolean\n' +
    '}\n'
  eq('P1 数组+truncated 无计数 ⇒ 站点', judgeSource(BARE).sites.length, 1)
  eq('P1b 站点行=声明块行', judgeSource(BARE).sites[0]?.line, 1)
  // P2 反向对照:BoundedListProjection 正型(truncated + total)⇒ 放行
  const WITH_TOTAL =
    'export const BoundedListProjection = z.object({\n' +
    '  list: z.array(Item),\n' +
    '  truncated: z.boolean(),\n' +
    '  total: z.number().optional(),\n' +
    '  appliedLimit: z.number(),\n' +
    '})\n'
  eq('P2 有 total 兄弟 ⇒ 放行', judgeSource(WITH_TOTAL).sites.length, 0)
  // P3 无数组成员的 truncated(error-serialize 的 DeepValue 形态)不构成站点
  const DEEP =
    'export interface DeepValue {\n' +
    '  name: string\n' +
    '  truncated?: true\n' +
    '  cause?: DeepValue\n' +
    '}\n'
  eq('P3 无数组 ⇒ 非站点', judgeSource(DEEP).sites.length, 0)
  // P4 字节计数兄弟也算伴随(tool-contract 的 ToolResultTruncationRecord 形态)
  const BYTES =
    'export interface ToolResultTruncationRecord {\n' +
    '  chunks: readonly string[]\n' +
    '  originalBytes: number\n' +
    '  returnedBytes: number\n' +
    '  readonly truncated?: true\n' +
    '}\n'
  eq('P4 bytes 兄弟 ⇒ 放行', judgeSource(BYTES).sites.length, 0)
  // P5 函数体/if 块里的同名局部不在射程(防误报)
  const IN_FN =
    'export function f(list: string[]) {\n' +
    '  const truncated: boolean = list.length > 10\n' +
    '  return { truncated }\n' +
    '}\n'
  eq('P5 函数体内不判', judgeSource(IN_FN).sites.length, 0)
  // P6 计数名不在词表 ⇒ 仍是站点(totalChars 这种带单位的算,randomName 不算)
  const WRONG_NAME =
    'export interface Page2 {\n' +
    '  rows: Row[]\n' +
    '  truncated?: boolean\n' +
    '  marker?: string\n' +
    '}\n'
  eq('P6 词表外兄弟不顶账', judgeSource(WRONG_NAME).sites.length, 1)
  // P7 合成读点(G-998101 (c),只报数):计数名命中 / 非计数名不命中
  eq('P7 length+unlisted 命中', judgeSource('const all = list.length + unlistedCount\n').synthesis.length, 1)
  eq('P7b length+1 不算合成', judgeSource('const n = list.length + 1\n').synthesis.length, 0)
  // P8 G-998100 绊线:咬**代码标识符**(viewA);注释/字符串槽位只进提及桶(只报数)
  eq('P8 代码标识符 ⇒ 绊线红', judgeSource('const p = req.deliveryProfile\n').tripwire.length, 1)
  eq('P8b 注释提及只报数', judgeSource('// deliveryProfile: 移动端不订 thinking 增量\n').tripwireMentions.length, 1)
  eq('P8c 注释不进绊线红桶', judgeSource('// deliveryProfile: x\n').tripwire.length, 0)
  eq('P8d 字符串槽位不进绊线红桶', judgeSource("const f = obj['deliveryProfile']\n").tripwire.length, 0)
  eq('P8e 干净面零命中', judgeSource(BARE).tripwire.length, 0)
  // P9 括号配平失败 ⇒ unbounded 未判定(不猜不记绿)
  eq('P9 配不平 ⇒ unbalanced', judgeSource('export interface X {\n  truncated?: boolean\n').unbalanced, true)
  // P10 Python 面裸计数(只报数)
  eq('P10 python 计数', countTruncatedPy('x = {"truncated": True}\ny = truncated\n'), 2)
  // P11 退出码三臂(纯函数)
  const PF = new Map([['packages/types/src/a.ts', judgeSource(BARE)]])
  eq('P11 --staged 站点 ⇒ 1', decide({ perFile: PF, undetermined: [], mode: 'staged', filesScanned: 1 }).exit, 1)
  eq('P11b 全量档只报数 ⇒ 0', decide({ perFile: PF, undetermined: [], mode: 'full', filesScanned: 1 }).exit, 0)
  eq('P11c 未判定 ⇒ 2', decide({ perFile: PF, undetermined: ['x'], mode: 'staged', filesScanned: 1 }).exit, 2)
  eq('P11d 空扫判死 ⇒ 2', decide({ perFile: new Map(), undetermined: [], mode: 'full', filesScanned: 0 }).exit, 2)
  eq('P11e --staged 绊线 ⇒ 1', (() => {
    const pf = new Map([['packages/types/src/a.ts', judgeSource('const p = req.deliveryProfile\n')]])
    return decide({ perFile: pf, undetermined: [], mode: 'staged', filesScanned: 1 }).exit
  })(), 1)
  eq('P11f --staged 仅提及不判红 ⇒ 0', (() => {
    const pf = new Map([['packages/types/src/a.ts', judgeSource('// deliveryProfile: x\n')]])
    return decide({ perFile: pf, undetermined: [], mode: 'staged', filesScanned: 1 }).exit
  })(), 0)
  // P12 射程边界
  eq(
    'P12 只咬 DTO 面',
    (() => [inTsRoots('packages/types/src/a.ts'), inTsRoots('apps/api/src/services/a.ts'), inTsRoots('apps/web/src/a.ts'), inPyRoots('apps/ai-service/app/core/x.py')])(),
    [true, true, false, true],
  )

  console.log(`自检:${ran - fail}/${ran} 通过`)
  return fail === 0 ? 0 : 1
}

function main(argv) {
  if (argv.includes('--self-test')) return selfTest()
  const root = ROOT
  try {
    assertRepoRoot(root, GATE)
  } catch (e) {
    console.error(`❌ 无法判定(exit 2): ${e instanceof Undetermined ? e.message : String(e?.message ?? e)}`)
    return 2
  }
  const { face, error } = selectFace({ staged: argv.includes('--staged'), worktree: argv.includes('--worktree'), def: 'head' })
  if (error) {
    console.error(`❌ 无法判定: ${error}`)
    return 2
  }
  let out
  try {
    out = analyze(root, face)
  } catch (e) {
    console.error(`❌ 无法判定(exit 2): ${e instanceof Undetermined ? e.message : e?.message ?? String(e)}`)
    if (!(e instanceof Undetermined)) console.error(e?.stack ?? '')
    return 2
  }
  if (argv.includes('--json')) {
    console.log(JSON.stringify(out, null, 2))
    return out.exit
  }
  if (out.sites.length) {
    const tag = out.mode === 'staged' ? '本次改动动过的文件里' : '存量(全量档只报数,不判红)'
    console.error(`❌ 检出 ${out.sites.length} 处 truncated 声明块裸奔(数组成员在场、无计数/总量型数值兄弟)(${tag}):`)
    for (const s of out.sites.slice(0, 40))
      console.error(`   ${s.file}:${s.line} ${s.excerpt}`)
    console.error(
      '   出路:同块补计数/总量键(total/unlisted/omitted/…,票 G-998101 (a));零计数整键缺席属运行时语义,',
      '由消费侧对账(判据格 (b) 静态看不见)。参照正型 packages/types/src/api-contracts.ts BoundedListProjection。',
    )
  }
  if (out.tripwire.length) {
    const tag = out.mode === 'staged' ? '本次改动动过的文件里' : '存量(只报数)'
    console.error(`⚠️ 档位/流过滤形态词表命中 ${out.tripwire.length} 处(${tag})—— 票 G-998100:`)
    for (const t of out.tripwire.slice(0, 20)) console.error(`   ${t.file}:${t.line} ${t.word}`)
    console.error(
      '   "决定砍"若已发生 ⇒ 收口不变量必须同期落地:被 profile 过滤的事件必须最终被某个不可过滤',
      '事件收口,且 live 直连与 Last-Event-ID 重放两路终态逐字节一致测试在位;未落地前本绊线在',
      ' --staged 档保持判红。',
    )
  }
  if (out.mentions.length) {
    console.error(`ℹ️ 设计提及(原文含注释/字符串,只报数 —— 绊线咬代码,提及不判)${out.mentions.length} 处:`)
    for (const t of out.mentions.slice(0, 10)) console.error(`   ${t.file}:${t.line} ${t.word}`)
  }
  const c = out.counts
  console.log(
    `${out.exit === 0 ? '✅' : out.exit === 2 ? '❌ 无法判定' : '❌ 判红'} [${out.face}]${out.fellBack ? '(改动集未触及射程 ⇒ 回落全量只报数)' : ''}` +
      ` 文件 ${c.files}(TS ${c.tsFiles} / PY ${c.pyFiles})/ 站点 ${out.sites.length} / 合成读点 ${c.synthesis} / 绊线 ${out.tripwire.length} / 设计提及 ${out.mentions.length} / PY·truncated ${c.pyTruncated} / 取不到 ${out.undetermined.length}`,
  )
  return out.exit
}

// §22d 双形态入口:被 import(镜像测试/同族门)时不跑 main
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  try {
    process.exit(main(process.argv.slice(2)))
  } catch (e) {
    console.error(`❌ 脚本自身异常(exit 2): ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  }
}

export const __test__ = {
  GATE,
  TS_ROOTS,
  PY_ROOT,
  COUNT_NAME_RE,
  NUMERIC_TYPE_RE,
  ARRAY_TYPE_RE,
  BLOCK_HEADER_RE,
  PROFILE_TIER_RE,
  SYNTH_RE,
  judgeSource,
  countTruncatedPy,
  inTsRoots,
  inPyRoots,
  listFace,
  readFace,
  decide,
  analyze,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
