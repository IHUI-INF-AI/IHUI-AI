#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 凭据在场即豁免对账(gate-presence-exemption)—— 守门编号见 scripts/guardian-runner.mjs 现值,勿照文档派单。
 *
 * 立因(票 #23 的真实现场,不是假想):`apps/api/src/plugins/csrf.ts` 曾写着
 *   if (request.headers['x-internal-service-token']) return
 * —— **头名在场即整块跳过 CSRF**,等于把防线换成一个字符串:任何进程带这个头(值随意)就能免检。
 * 该缺陷已于 6fb790eb70a8 收口为 `if (await isVerifiedInternalMachineCall(request)) return`
 * (出口 apps/api/src/utils/internal-principal.ts,secretsEqual + timingSafeEqual,fail-closed)。
 * 但"下一次有人在任何安全钩子/中间件里再写一遍凭据存在即豁免"这一型**没有任何判据看守** ——
 * typecheck / lint / 单测对它的表现完全同形(都能跑、都不报错),而"凭据存在"与"凭据为真"在
 * 布尔上下文里长得一模一样。本门把这一型钉成尺子:阳性对照直接拿修复前那枚历史 blob 喂同一判据。
 *
 * 判据(安全语义文件面内的 `if (<条件>) <放行>` 站点,三态):
 *  - 命中(判红/报存量):条件对 headers/cookies/getHeader **只做存在性**(无验证调用、无值比较、
 *    无前导 `!`),且分支是裸放行(`return` / `return true` / `return next()` / `continue`)、块内无验证调用;
 *  - 放过:条件里或分支体内出现验证调用(secretsEqual / isVerified* / verify* / timingSafeEqual /
 *    jwt.verify / compare*)—— 这是 #23 修复后的正确形态,必须被认作合法;
 *  - 判不出:条件里混着静态分不开的表达式(helper 调用 / 动态属性名 / 与凭据字段混项的无凭据叶)
 *    ⇒ **逐条点名并计数**,--strict 下有未判定即 exit 2(拒绝出合格证,不把"没判"写成"判过了")。
 *
 * 两条书写形态自本票纳入射程(此前登记在"已知不判",是整型隐身而不只是漏一两处):
 *  A. **凭据先取进变量再判**:`const authToken = req.headers.authorization ?? req.cookies?.auth_token`
 *     之后 `if (authToken) return`。判据把"条件整体是一个标识符(可带前导 `!`)"这一形接进同一套
 *     分类:沿**同文件内**的 `const|let|var NAME [:类型] = 右值`(含解构 `const { a } = …`)取到右值,
 *     仅当右值**确实指向凭据字段或验证调用**时,才把右值当条件喂 classifyCondition ——
 *     于是 hit / passed / undetermined / absence 四档的语义与直接书写形态逐字同规则,没有任何一条
 *     既有放过通道被改动。取不到声明(函数形参 / 外层作用域 / 别文件)或右值与凭据无关 ⇒ **射程外,
 *     既不判红也不计未判定**:这条上界是刻意的,把上百条正当局部量算成债会让 --strict 永远出不了
 *     合格证,而"永远出不了合格证的问责档"与恒红门同罪(§12e)。同名声明出现多处且至少一处指向凭据
 *     ⇒ 判不出(静态分不开是哪一条),不猜。
 *  B. **`continue` 形态放行**:安全钩子的策略循环里 `if (headers['x-foo']) continue` 与 `return`
 *     同义(跳过本条校验),PASS 语句表此前只认 return ⇒ 整型隐身。只扩**放行语句的书写形态**,
 *     **不动豁免方向判序**:前导奇数个 `!`(`if (!headers['x-foo']) continue`)仍落 absence 档
 *     (与 return 形同一条"不适用即继续"的既有合法通道,本票不把它翻成红 —— 那是改写放过通道)。
 *
 * 反向对照(合法形态,不得判红,各由 --self-test 一条用例钉死):
 *  - "不适用即继续":`if (!request.headers['x-foo']) return`(前导取反 ⇒ absence 档,不计红);
 *  - "存在性判断之后紧跟验证":块内含 secretsEqual/verify* 等调用 ⇒ passed 档;
 *  - "变量中转但右值与凭据无关":`const enabled = cfg.csrfEnabled; if (enabled) return` ⇒ 不判也不计未判定
 *    (A 维的噪声上界由这一条钉住,防它日后被"顺手放宽成什么标识符都算");
 *  - "变量中转但右值取过凭据后又验真":`const ok = … ; if (ok) return` 且右值是验证调用 ⇒ passed 档。
 *
 * 口径(照抄本仓 70/77/83/98/101/103/118/135,不得自创):全量判 **HEAD blob**、`--staged` 判
 * **索引 blob**、`--worktree` 仅人工逃生舱;两面旗同给 ⇒ exit 2;取不到 ⇒ "无法判定"且**不回落**
 * 另一个面;枚举到 0 个候选**判死不记绿**。取材走 scripts/lib/face-reader.mjs 的 catBatch(读取入口),
 * 判据面先经 scripts/lib/code-mask.mjs 的 maskCommentsStringsAndRegex 剥注释/字符串/正则体
 * (遮罩唯一实现,禁止在本文件再写一份 —— 两处实现必漂移是本仓记过最多次的失败型)。
 * A 维的声明表**建在同一份遮罩面上**(collectDeclarations(masked)),绝不引第二台分词器。
 *
 * 棘轮:命中存量套**该文件 HEAD 自身违规数**(锚点 = 本门在同一判据下的 HEAD 读数,不是手工清单)。
 * 立项现读 HEAD 已有存量(csrf.ts 的 x-goog-api-key 一处等)⇒ 当场判红就是一台与任何提交都无关的
 * 恒红门,唯一结局是逼人 --no-verify、连带全部守门对该提交作废(§12e)。全量档因此只报数 exit 0;
 * 问责用 --strict(有命中即 exit 1,有判不出即 exit 2)。
 * 本票扩的两维按当次真仓 HEAD 现读**增量为 0**(A 维:105 处"标识符条件 + 裸放行"站点里,右值可追到
 * 凭据字段/验证调用的 0 处;B 维:条件含凭据字段而分支是 continue 的 0 处),所以接线不新增恒红面 ——
 * **数字一律现读,勿照本行派单**;日后 A/B 真量出存量时,它们走的是同一条"该文件 HEAD 自身存量"棘轮,
 * 无需另设基线清单。
 *
 * 行内出口:`presence-exempt: <原因>`(**必须带原因**,裸标记不放行;只救本行或紧邻上一纯注释行)。
 * 如实登记:该豁免族尚未进守门 108 的 FAMILY_LIFETIME_DAYS(该文件在本票文件清单外),当前落
 * 108 的默认存活期档(90 天);给它定一个显式档位另计一票,不得为此顺手改判据。
 *
 * 覆盖面:apps/api/src/plugins/** 与 apps/api/src/middleware/**(若存在),外加 apps/ 与 packages/
 * 里文件名含 csrf|auth|permission|rate.?limit|internal 的 .ts/.tsx/.js/.jsx/.mjs/.cjs。
 * 测试面(tests、__tests__、e2e 目录与 .test./.spec. 文件)与本门自身+镜像测试**显式排除**:本门的 FIXTURES
 * 与说明行逐字含违例形态,判据若扫到自己就是"门把自己立项那一型当仓库违规"的恒红;夹具面排除
 * 的代价如实说 —— 若有人把真豁免写进测试目录,本门看不见(那是刻意取舍,不是疏漏)。
 *
 * 已知不判(宁漏不误报,登记清楚不等于不存在):
 *  1. 变量中转**只在"同文件内有声明且右值指向凭据/验证调用"时纳入**;以下情形仍不判,也不计未判定:
 *     ① 声明不在此文件(形参、外层作用域、别模块导出的 flag);② 等号与值之间夹空行/注释
 *     (只认折到**紧邻下一行**的右值 —— 跨过去抓后面某行等于给一个变量发别人的凭据出处,假账比漏报贵);
 *     ③ 括号在 6 行续行窗口内仍配不平(按已取到的半截判,认不出凭据字段就放过);④ 嵌套解构
 *     (`const { req: { headers } } = …`)整条跳过,形态读不出就不登记也不猜。
 *     这一维的能力上限是"一跳 + 右值可读 + 至多折一行",不是数据流分析;
 *  2. 头值做 `==`/`===` 字面比较而非常数时间比较 —— **本票判定不做,理由三条**:
 *     ① 那一型问的是"比较是否安全",本门问的是"有没有比较就放行",修复动作不同(换 timingSafeEqual
 *     vs 加验真调用),并进门里会让"命中"这一档同时表达两种方向相反的整改;② 要纳管它就必须把
 *     CMP_RE 那条既有放过对凭据字段开小灶 ⇒ 正是本票禁止的"放宽既有放过通道";③ 真仓 HEAD 射程内
 *     "凭据字段 ∧ 值比较"的 if 站点现读 **0 处**(208 文件),既无存量可验就补,属"加守卫前先证明坏
 *     状态可达"的反例(守门 134 的 B2 裸 SQL 那一课同一条);
 *  3. `break` 形态与 `return void 0` / 表达式形式放行不进 PASS 表(`break` 还兼有"正常结束循环"的
 *     正当语义,判它需要在循环体上区分意图,本票未做 ⇒ 由镜像 T12c 钉住"今天不判 break"这一事实,
 *     日后要纳管必须同笔改掉那条反向对照,不得悄悄扩表);
 *  4. Python/ai-service 侧的同类形态不在本 JS 语法判据射程(守门 117 管那一层的另一型)。
 *
 * 用法:node scripts/check-gate-presence-exemption.mjs [--staged|--worktree|--strict|--json|--self-test|--files a b]
 * 紧急跳过:HUSKY_SKIP_GATE_PRESENCE_EXEMPTION=1(注册条目 skipEnv 同名;以本文件末行现读为准)
 */

import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { catBatch, gitRaw, readWorktreeFile, selectFace } from './lib/face-reader.mjs'
import { maskCommentsStringsAndRegex } from './lib/code-mask.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const GIT_TIMEOUT = 120000

/* ----------------------------- 判据常量(判据的字面量;预筛必须覆盖以下全部形态) ----------------------------- */

/** 行内豁免:必须带原因(裸标记不计 —— 守门 102/131/135 同一条收紧)。 */
const EXEMPT = /presence-exempt:\s*\S/
/** 凭据字段引用:headers / cookies / getHeader(遮罩后标识符仍在,串内容已被抹)。 */
const CRED_RE = /\b(?:headers|cookies|getHeader)\b/
/** 验证调用词族(任务书钉死的六个名字;命中任一即认"做了真比较",判放过)。 */
const VERIFY_RE =
  /\b(?:secretsEqual|timingSafeEqual|jwt\.verify|isVerified\w*|verify\w*|compare\w*)\b/
/** 值比较 ⇒ 不是"纯存在性"(该型是否安全属另一维,本门不判)。 */
const CMP_RE = /===|!==|==|!=|>=|<=|\binstanceof\b/
/**
 * 裸放行语句:return / return true / return [await] next() / continue [label]。
 * `continue` 于本票纳入 —— 安全钩子的策略循环里它和 return 同义(跳过本条校验),此前整型隐身。
 * 刻意仍不含:return false(回给框架的语义不是"跳过校验")、break(兼有"正常结束循环"的正当语义,
 * 判它要先区分意图,见头注"已知不判 3")、`return void 0` 之类表达式形态(头注同一句)。
 */
const PASS_STMT_RE =
  /^(?:return(?:\s*(?:true|(?:await\s+)?next\s*\([^()]*\)))?|continue(?:\s+[A-Za-z_$][\w$]*)?)\s*;?$/
/** 动态属性名:headers[ <非空白> ](字面量串遮罩后只剩空白,故"非空白⇒变量")。 */
const DYN_PROP_RE = /\b(?:headers|cookies)\s*(?:\?\.)?\[([^\]]*)\]/g
/** 条件整体只是一个标识符(可带前导 `!`)⇒ 唯一可安全做"一跳变量中转"的形。 */
const IDENT_COND_RE = /^(!*)\s*([A-Za-z_$][\w$]*)\s*$/
/**
 * 同文件内的 `const NAME [:类型] = 右值` 与解构 `const { a, b } = 右值`(遮罩面上找)。
 * `=` 之后**最多跨一个换行**(Prettier 把长右值折到下一行是真写法),且不允许中间夹非空内容:
 * 用贪婪 `\s*` 会跨过空行/注释去抓后面某行的右值 —— 那等于给一个变量发了别人的凭据出处,
 * 假账比漏报贵(本仓记过多次)。所以这里刻意只认 `[ \t]*` + 至多一行 `\r?\n[ \t]*`。
 */
const DECL_RE =
  /(?:^|[^\w$.])(?:const|let|var)\s*\{\s*([^}\n]*?)\s*\}\s*(?::[^=;{]*)?=[ \t]*(?:\r?\n[ \t]*)?([^\n;]*)/g
const DECL_PLAIN_RE =
  /(?:^|[^\w$.])(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*(?::[^=;{]*)?=[ \t]*(?:\r?\n[ \t]*)?([^\n;]*)/g
/** 解构清单里只取**局部名**(`a: b` 取 b、带默认值的取名字、`...rest` 与嵌套形态一律不取)。 */
const DESTRUCT_NAME_RE = /(?:^|,)\s*(?:[\w$]+\s*:\s*)?([A-Za-z_$][\w$]*)\s*(?:=[^,]*)?(?=,|$)/g
/** 右值跨行时的续行上限:配不平就按已取到的半截判(宁少判,绝不误吞后文)。 */
const RHS_CONTINUATION_LINES = 6

const SCAN_ROOTS = ['apps/', 'packages/']
const ALWAYS_DIRS = ['apps/api/src/plugins/', 'apps/api/src/middleware/']
const SCAN_EXT = /\.(tsx|ts|jsx|js|mjs|cjs)$/
const NAME_RE = /csrf|auth|permission|rate.?limit|internal/i
/** 测试面/夹具:本门 FIXTURES 与镜像测试逐字含违例形态,不得被当成仓库违规(排除面已在头注说明代价)。 */
const TEST_NOISE = /(^|\/)(tests?|__tests__|e2e|__mocks__)(\/|$)|\.(test|spec)\.[mc]?[jt]sx?$/
const SELF_EXEMPT = [
  'scripts/check-gate-presence-exemption.mjs',
  'scripts/tests/check-gate-presence-exemption.test.mjs',
]

/* ------------------------------- 阳性/反向对照锚(历史 blob,不依赖工作树) ------------------------------- */

/** 票 #23 的修复提交;其父版本的 csrf.ts 就是"凭据存在即豁免"的现场(判据必须点名它)。 */
const FIX_COMMIT = '6fb790eb70a8ea7dd337bc9905f7bebe6a15b6ab'
const CSRF_PATH = 'apps/api/src/plugins/csrf.ts'
const PREFIX_NEEDLE = 'x-internal-service-token'
const HEAD_NEEDLE = 'x-goog-api-key'
const FIXED_NEEDLE = 'isVerifiedInternalMachineCall'

/* ------------------------------- 单站点三态分类(纯函数) ------------------------------- */

/**
 * 条件文本(遮罩面)⇒ 分类。
 * @returns {{cls:'hit'|'passed'|'absence'|'undetermined'|'none', reason?:string}}
 * 判序刻意固定:VERIFY 先于存在性("存在+验证"是 #23 修复后的正确形态,一眼放过);
 * 前导奇数个 `!` 判 absence(不适用即继续,合法);`!!` 是取反抵消 ⇒ 仍按存在性判。
 */
export function classifyCondition(condRaw) {
  const cond = String(condRaw || '').trim()
  if (!CRED_RE.test(cond)) return { cls: 'none' }
  if (VERIFY_RE.test(cond)) return { cls: 'passed', reason: '条件含验证调用' }
  const bangLead = /^!+/.exec(cond)
  let body = cond
  if (bangLead) {
    if (bangLead[0].length % 2 === 1) return { cls: 'absence', reason: '取反守卫(不适用即继续)' }
    body = cond.slice(bangLead[0].length).trim()
  }
  if (CMP_RE.test(body)) return { cls: 'none', reason: '含值比较,不是纯存在性' }
  if (/(^|[^\w$])!\s*[\w$?.[\]\s]*\b(?:headers|cookies|getHeader)\b/.test(body))
    return { cls: 'undetermined', reason: '凭据引用旁混有取反,静态分不开豁免方向' }
  const callRe = /([A-Za-z_$][\w$]*)\s*\(/g
  let cm
  while ((cm = callRe.exec(body))) {
    if (cm[1] === 'getHeader') continue // 取头器自身不是 helper,视同 headers[...] 访问
    return { cls: 'undetermined', reason: `条件含解析不了的调用:${cm[1]}(` }
  }
  DYN_PROP_RE.lastIndex = 0
  let dm
  while ((dm = DYN_PROP_RE.exec(body))) {
    if (dm[1].trim() !== '') return { cls: 'undetermined', reason: '动态属性名(方括号内是变量)' }
  }
  const leaves = body
    .split(/&&|\|\|/)
    .map((s) => s.trim())
    .filter(Boolean)
  if (!leaves.length) return { cls: 'undetermined', reason: '条件为空' }
  const credLeaves = leaves.filter((l) => CRED_RE.test(l))
  if (credLeaves.length === leaves.length) return { cls: 'hit', reason: '纯存在性即放行' }
  return { cls: 'undetermined', reason: '条件混有不含凭据字段的叶,无法静态判定' }
}

/** 块体是否"整块都是裸放行"(空块也算:if (presence) {} 同样跳过了后续校验)。 */
function blockAllPass(frag) {
  const stmts = String(frag || '')
    .split(/[;\n]/)
    .map((s) => s.trim())
    .filter(Boolean)
  return stmts.every((s) => PASS_STMT_RE.test(s))
}

/**
 * 在遮罩文本上扫 `if (` 站点:括号/花括号配平取条件与分支(遮罩面里字符串/注释/正则体已抹,
 * 配平只会被真代码打断 —— 配平失败(超 40 行窗口)一律落 undetermined 点名,绝不静默跳过。
 * @returns {{sites:Array, malformed:number}} site: {condIdx,cond,closeIdx,block:boolean,frag,lineIdx}
 */
export function scanIfSites(masked, opts = {}) {
  const windowLines = opts.windowLines ?? 40
  const sites = []
  let malformed = 0
  // 行首偏移表(行号 = 命中行在原文/遮罩文里同位 —— mask 是等长的)
  const lineStarts = [0]
  for (let i = 0; i < masked.length; i++) if (masked[i] === '\n') lineStarts.push(i + 1)
  const lineOf = (idx) => {
    let lo = 0
    let hi = lineStarts.length - 1
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1
      if (lineStarts[mid] <= idx) lo = mid
      else hi = mid - 1
    }
    return lo
  }
  const re = /(?:^|[^\w$.])if\s*\(/g
  let m
  while ((m = re.exec(masked))) {
    const open = m.index + m[0].length - 1
    let depth = 0
    let close = -1
    for (let i = open; i < masked.length; i++) {
      const ch = masked[i]
      if (ch === '(') depth++
      else if (ch === ')') {
        depth--
        if (depth === 0) {
          close = i
          break
        }
      }
    }
    if (close < 0) continue
    const cond = masked.slice(open + 1, close)
    if (lineOf(close) - lineOf(open) > windowLines) {
      if (CRED_RE.test(cond) || VERIFY_RE.test(cond)) malformed++
      continue
    }
    // 跳过空白找分支
    let p = close + 1
    while (p < masked.length && /\s/.test(masked[p])) p++
    if (p >= masked.length) continue
    let block = false
    let frag = ''
    if (masked[p] === '{') {
      block = true
      let d2 = 0
      let q = -1
      for (let i = p; i < masked.length; i++) {
        const ch = masked[i]
        if (ch === '{') d2++
        else if (ch === '}') {
          d2--
          if (d2 === 0) {
            q = i
            break
          }
        }
      }
      if (q < 0) {
        if (CRED_RE.test(cond) || VERIFY_RE.test(cond)) malformed++
        continue
      }
      frag = masked.slice(p + 1, q)
      re.lastIndex = q // 分支体不再嵌扫(嵌套 if 单独成站点的价值低,且会把 return 计重)
    } else {
      let e = p
      while (e < masked.length && masked[e] !== '\n' && masked[e] !== ';') e++
      frag = masked.slice(p, e)
    }
    sites.push({ cond, closeIdx: close, block, frag, lineIdx: lineOf(m.index) })
  }
  return { sites, malformed }
}

/** 括号配平深度(在遮罩面上算:串/注释/正则体已抹,剩下的括号都是结构性的)。 */
function depthOf(text) {
  let d = 0
  for (const ch of text) {
    if (ch === '(' || ch === '[' || ch === '{') d++
    else if (ch === ')' || ch === ']' || ch === '}') d--
  }
  return d
}

/**
 * 同文件内的"变量 → 右值"表(A 维的一跳回溯用),**建在同一份遮罩面上** —— 绝不再引第二台分词器。
 * 认两种声明形态:普通 `const NAME [:类型] = 右值` 与解构 `const { a, b } = 右值`;
 * 右值跨行时按括号配平往下续吃(上限 RHS_CONTINUATION_LINES 行),配不平就按已取到的半截判(宁少判)。
 * 嵌套解构(`const { req: { headers } } = …`)整条跳过 —— 猜它就是在给别的环境发合格证。
 * @returns {Map<string, string[]>} 一个名字可有多条(同名多处由调用方判"分不开",不猜)
 */
export function collectDeclarations(masked) {
  const decls = new Map()
  if (typeof masked !== 'string') return decls
  const push = (name, rhs) => {
    if (!name) return
    if (!decls.has(name)) decls.set(name, [])
    decls.get(name).push(rhs)
  }
  const takeRhs = (startIdx, firstRhs) => {
    let rhs = String(firstRhs || '').trim()
    let idx = startIdx
    let taken = 0
    while (depthOf(rhs) > 0 && taken < RHS_CONTINUATION_LINES) {
      const nl = masked.indexOf('\n', idx)
      if (nl < 0) break
      rhs = `${rhs} ${masked.slice(idx, nl)}`.trim()
      idx = nl + 1
      taken += 1
    }
    return rhs
  }
  for (const re of [DECL_PLAIN_RE, DECL_RE]) {
    re.lastIndex = 0
    let m
    while ((m = re.exec(masked))) {
      const rhs = takeRhs(m.index + m[0].length, m[2])
      if (re === DECL_PLAIN_RE) {
        push(m[1], rhs)
        continue
      }
      const inner = String(m[1] || '')
      if (/[{[]/.test(inner)) continue // 嵌套解构:形态读不出 ⇒ 不登记也不猜
      DESTRUCT_NAME_RE.lastIndex = 0
      let dm
      while ((dm = DESTRUCT_NAME_RE.exec(inner))) push(dm[1], rhs)
    }
  }
  return decls
}

/**
 * 条件整体只是一个标识符时,沿同文件声明表把它中转成右值(遮罩面上找,判据面与直接书写同一套)。
 * 只有**右值确实指向凭据字段或验证调用**才纳入射程 —— 这条上界防的是"把上百条正当局部量算成债"
 * (那会让 --strict 永远出不了合格证,而"永远出不了合格证的问责档"与恒红门同罪,§12e)。
 * @returns {null|{kind:'single',cond:string,via:string}|{kind:'ambiguous',n:number,cond:string}}
 */
export function traceIdentifierCondition(cond, decls) {
  const m = IDENT_COND_RE.exec(String(cond || '').trim())
  if (!m) return null
  const [, bangs, name] = m
  const list = decls instanceof Map ? decls.get(name) : null
  if (!list || !list.length) return null
  const tied = list.filter((rhs) => CRED_RE.test(rhs) || VERIFY_RE.test(rhs))
  if (!tied.length) return null
  const joined = `${bangs}${tied.join(' || ')}`
  if (tied.length > 1) return { kind: 'ambiguous', n: tied.length, cond: joined }
  return { kind: 'single', cond: joined, via: '变量中转' }
}

/**
 * 主判据:对一段源码文本做三态分类。
 * @returns {{hits:Array,passed:Array,undetermined:Array,absent:number,exempted:Array,malformed:number}}
 */
export function findPresenceExemptions(text) {
  const out = { hits: [], passed: [], undetermined: [], absent: 0, exempted: [], malformed: 0 }
  if (typeof text !== 'string') return out
  const rawLines = text.split('\n')
  const masked = maskCommentsStringsAndRegex(text)
  const { sites, malformed } = scanIfSites(masked)
  const decls = collectDeclarations(masked)
  out.malformed = malformed
  for (const s of sites) {
    let cond = s.cond
    let via = ''
    let ambiguous = 0
    const hasCred = CRED_RE.test(cond)
    let hasVerify = VERIFY_RE.test(cond)
    // 候选 = 条件提到凭据字段,**或**条件本身就是验证调用(#23 修复后的正确形态必须被数进 passed,
    // 而不是"看不见" —— isVerifiedInternalMachineCall(request) 连 headers 字样都没有;若把它当射程外,
    // 交付报告里的"放过数"就永远为 0,而 0 读起来像"仓里没有验过才免的写法" —— 那是假账)。
    // 两者都不是时再问一次 A 维:条件整体是个标识符,而它的右值在同文件里指向凭据/验证调用。
    if (!hasCred && !hasVerify) {
      const traced = traceIdentifierCondition(cond, decls)
      if (!traced) continue
      cond = traced.cond
      if (traced.kind === 'ambiguous') ambiguous = traced.n
      else via = traced.via
      hasVerify = VERIFY_RE.test(cond)
    }

    // 先问"分支是不是放行":不放行的站点(如 if (!verify) return reply.status(403))与本型无关
    let bypass = false
    let passedInBlock = false
    if (s.block) {
      if (VERIFY_RE.test(s.frag)) passedInBlock = true
      else if (blockAllPass(s.frag)) bypass = true
    } else {
      bypass = PASS_STMT_RE.test(s.frag.trim())
    }
    if (!bypass && !passedInBlock) continue
    const line = s.lineIdx + 1
    const raw = (rawLines[s.lineIdx] ?? '').trim()
    const prev = s.lineIdx > 0 ? (rawLines[s.lineIdx - 1] ?? '') : ''
    const prevIsPureComment = /^\s*(?:\/\/|\/\*|\*)/.test(prev)
    if (EXEMPT.test(raw) || (prevIsPureComment && EXEMPT.test(prev))) {
      out.exempted.push({ line, text: raw.slice(0, 160) })
      continue
    }
    // 验证调用被**前导取反**(`if (!isVerified(...)) return`)时豁免方向静态判不了 ——
    // 既可能是"未登录则本钩子无事可做"(路由侧还有闸,合法),也可能是反转的逻辑漏洞 ⇒ 判不出,不猜。
    const bangLead = /^!+/.exec(cond.trim())
    const oddBang = !!bangLead && bangLead[0].length % 2 === 1
    const tag = via ? `(${via})` : ''
    // 同名声明多于一处而至少一条指向凭据 ⇒ 静态分不开是哪一条,既不冒红也不记绿(逐条点名)。
    if (ambiguous) {
      out.undetermined.push({
        line,
        text: raw.slice(0, 160),
        reason: `标识符条件经变量中转,同名声明 ${ambiguous} 处,静态分不开是哪一条${tag}`,
        via,
      })
      continue
    }
    if (hasVerify) {
      if (oddBang)
        out.undetermined.push({
          line,
          text: raw.slice(0, 160),
          reason: `验证调用被前导取反,豁免方向判不了${tag}`,
          via,
        })
      else out.passed.push({ line, text: raw.slice(0, 160), reason: `条件即验证调用${tag}`, via })
      continue
    }
    if (passedInBlock) {
      out.passed.push({ line, text: raw.slice(0, 160), reason: '存在性判断后分支内做了验证' })
      continue
    }
    const c = classifyCondition(cond)
    if (c.cls === 'hit')
      out.hits.push({ line, text: raw.slice(0, 160), reason: `${c.reason}${tag}`, via })
    else if (c.cls === 'passed')
      out.passed.push({ line, text: raw.slice(0, 160), reason: `${c.reason}${tag}`, via })
    else if (c.cls === 'undetermined')
      out.undetermined.push({ line, text: raw.slice(0, 160), reason: `${c.reason}${tag}`, via })
    else if (c.cls === 'absence') out.absent++
  }
  return out
}

/* ------------------------------- 覆盖面 / 取材 ------------------------------- */

export function inScope(p) {
  if (typeof p !== 'string' || !p) return false
  if (!SCAN_EXT.test(p)) return false
  if (!SCAN_ROOTS.some((d) => p.startsWith(d))) return false
  if (TEST_NOISE.test(p)) return false
  if (SELF_EXEMPT.includes(p)) return false
  const base = p.slice(p.lastIndexOf('/') + 1)
  if (ALWAYS_DIRS.some((d) => p.startsWith(d))) return true
  return NAME_RE.test(base)
}

function listFacePaths(face) {
  if (face === 'head')
    return gitRaw(['ls-tree', '-r', '--name-only', 'HEAD', '-z'], ROOT, { timeout: GIT_TIMEOUT })
      .split('\0')
      .filter(Boolean)
  if (face === 'staged')
    return gitRaw(['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z'], ROOT, {
      timeout: GIT_TIMEOUT,
    })
      .split('\0')
      .filter(Boolean)
  return gitRaw(['ls-files', '-z'], ROOT, { timeout: GIT_TIMEOUT }).split('\0').filter(Boolean)
}

function readFace(paths, face) {
  const map = new Map()
  if (!paths.length) return map
  if (face === 'worktree') {
    for (const p of paths) map.set(p, readWorktreeFile(ROOT, p))
    return map
  }
  const rev = face === 'staged' ? '' : 'HEAD'
  const specs = paths.map((p) => `${rev}:${p}`)
  const got = catBatch(ROOT, specs, { maxBuffer: 1 << 29, timeout: GIT_TIMEOUT })
  for (let i = 0; i < paths.length; i++) map.set(paths[i], got.get(specs[i]) ?? null)
  return map
}

/** 与守门 135 同一条兜底:文档类提交结构上没有射程内文件 ⇒ 回退全量,不判"无法判定"(否则恒挡)。 */
export function shouldRetreatToHead({ face, hasOnlyFiles, stagedInScopeCount }) {
  return face === 'staged' && !hasOnlyFiles && stagedInScopeCount === 0
}

/* ------------------------------- 汇总判定 ------------------------------- */

export function analyze(face, onlyFiles = null, strict = false) {
  let effFace = face
  let retreatReason = null
  if (
    shouldRetreatToHead({
      face,
      hasOnlyFiles: onlyFiles !== null,
      stagedInScopeCount: face === 'staged' ? listFacePaths('staged').filter(inScope).length : -1,
    })
  ) {
    effFace = 'head'
    retreatReason = '本次暂存集里没有本门射程内的文件 ⇒ 回退 HEAD 全量面(不是"没判")'
  }
  const all = onlyFiles ?? listFacePaths(effFace)
  const files = all.filter(inScope)
  const contents = readFace(files, effFace)

  const unreadable = []
  const red = []
  const hitsSites = []
  const undSites = []
  const exempted = []
  let passed = 0
  let absent = 0
  let malformed = 0
  let hitTotal = 0
  for (const f of files) {
    const text = contents.get(f)
    if (typeof text !== 'string') {
      unreadable.push(f)
      continue
    }
    const r = findPresenceExemptions(text)
    hitTotal += r.hits.length
    malformed += r.malformed
    absent += r.absent
    passed += r.passed.length
    for (const h of r.hits) hitsSites.push({ file: f, ...h })
    for (const u of r.undetermined) undSites.push({ file: f, ...u })
    for (const e of r.exempted) exempted.push({ file: f, ...e })
    if (!r.hits.length) continue
    if (effFace === 'staged' || effFace === 'worktree') {
      // 棘轮:锚点 = 该文件在 HEAD 面、同一判据下的自身存量数(不是手工清单,也不是 0)
      const headText = readFace([f], 'head').get(f)
      const cap = typeof headText === 'string' ? findPresenceExemptions(headText).hits.length : 0
      if (r.hits.length > cap)
        red.push({ file: f, n: r.hits.length, cap, sites: r.hits.slice(0, 3) })
    }
  }
  const emptyScan = files.length === 0
  let exit = 0
  if (unreadable.length || emptyScan) exit = 2
  else if (strict && undSites.length + malformed > 0) exit = 2
  else if (red.length || (strict && hitTotal > 0)) exit = 1
  return {
    face: effFace,
    retreatReason,
    scannedFiles: files.length,
    hits: hitTotal,
    passed,
    undetermined: undSites.length,
    malformed,
    absent,
    exempted: exempted.length,
    hitSites: hitsSites,
    undSites,
    exemptSites: exempted,
    red,
    unreadable,
    emptyScan,
    exit,
  }
}

/* ------------------------------- 自检 ------------------------------- */

const FIXTURES = {
  presenceBare: `server.addHook('onRequest', async (request, reply) => {
  if (request.headers['x-internal-service-token']) return
  await verify(request)
})`,
  presenceBrace: `  if (request.headers['x-a']) {
    return
  }`,
  presenceNext: `function mw(req, res, next) {
  if (req.headers['x-trusted-proxy']) return next()
}`,
  presenceTrue: `  if (request.headers['x-admin-bypass']) return true`,
  absenceGuard: `  if (!request.headers['x-webhook-signature']) return
  await verifySignature(request)`,
  verifyInCond: `  if (await isVerifiedInternalMachineCall(request)) return`,
  verifyInBlock: `  if (request.headers['x-a']) {
    if (!secretsEqual(got, want)) return reply.status(401).send()
    return
  }`,
  valueCompare: `  if (request.headers.upgrade === 'websocket') return`,
  helperUnknown: `  if (checkBearerToken(request.headers.authorization)) return`,
  dynamicProp: `  if (request.headers[credHeaderName]) return`,
  inComment: `  // 旧写法曾是这样: if (request.headers['x-foo']) return —— 已收口
  doSomething()`,
  inString: `  const doc = "if (request.headers['x-foo']) return"
  doSomething()`,
  exemptReason: `  if (request.headers['x-a']) return // presence-exempt: 机器投递无 CSRF 可带,签名验签在路由层`,
  bareMarker: `  if (request.headers['x-a']) return // presence-exempt:`,
  identifierOnly: `  if (authToken) return`,
  orTwoPresence: `  if (request.headers['x-a'] || request.headers['x-b']) return`,
  mixedLeaf: `  if (isAdmin && request.headers['x-a']) return`,
  dotAccess: `  if (request.headers.authorization) return`,
  doubleBang: `  if (!!request.headers['x-a']) return`,
  notPassConsequent: `  if (request.headers['x-a']) return false`,
  // ── A 维:凭据先取进变量再判(本票新纳管)──
  varStashPresence: `  const authToken = request.headers.authorization ?? request.cookies?.auth_token
  if (authToken) return`,
  varStashDestructure: `  const { authorization } = request.headers
  if (authorization) {
    return
  }`,
  varStashVerify: `  const ok = await isVerifiedInternalMachineCall(request)
  if (ok) return`,
  varStashHelperOpaque: `  const bearer = extractBearer(request.headers.authorization)
  if (bearer) return next()`,
  varStashAbsenceGuard: `  const authToken = request.headers.authorization
  if (!authToken) return`,
  varStashNotCred: `  const enabled = cfg.csrfEnabled
  if (enabled) return`,
  varStashNotPassReply: `  const authToken = request.headers.authorization
  if (!authToken) return reply.status(401).send()`,
  varStashWrapped: `  const authToken =
    request.headers.authorization
  if (authToken) return`,
  varStashBlankSep: `  const flag =

  const other = request.headers.authorization
  if (flag) return`,
  varStashMultiDecl: `async function handle(req, reply) {
  if (req.headers['x-nonce']) { const token = req.headers['x-nonce'] }
  const token = req.headers.authorization
  if (token) return
}`,
  // ── B 维:continue 形态放行(本票新纳管)──
  continuePresence: `  for (const p of policies) {
    if (request.headers['x-internal-service-token']) continue
    await check(p)
  }`,
  continueBrace: `  for (const p of policies) {
    if (req.headers['x-a']) {
      continue
    }
    await check(p)
  }`,
  continueLabeled: `  outer: for (const p of policies) {
    if (request.headers['x-a']) continue outer
    await check(p)
  }`,
  continueVerifyBlock: `  for (const p of policies) {
    if (request.headers['x-a']) {
      if (!secretsEqual(got, want)) continue
      await check(p)
    }
  }`,
  continueAbsence: `  for (const p of policies) {
    if (!request.headers['x-webhook-signature']) continue
    await check(p)
  }`,
  continueNotPassOnly: `  for (const p of policies) {
    if (request.headers['x-a']) { logSkip(); continue }
    await check(p)
  }`,
  breakNotPass: `  for (const p of policies) {
    if (request.headers['x-a']) break
    await check(p)
  }`,
}

function fixture(name) {
  return findPresenceExemptions(FIXTURES[name])
}

function readHistoricalCsrf() {
  const spec = `${FIX_COMMIT}^:${CSRF_PATH}`
  const got = catBatch(ROOT, [spec], { maxBuffer: 1 << 29, timeout: GIT_TIMEOUT })
  return got.get(spec) ?? null
}

function runSelfTest() {
  let okAll = true
  const ok = (name, pass, note = '') => {
    console.log(`${pass ? '✅' : '❌'} ${name}${note ? ` ${note}` : ''}`)
    if (!pass) okAll = false
  }
  ok('P1 命中:裸 return 的存在性豁免(#23 原形)', fixture('presenceBare').hits.length === 1)
  ok('P2 命中:大括号块内只有 return', fixture('presenceBrace').hits.length === 1)
  ok('P3 命中:return next() 同样算放行(Express 形态)', fixture('presenceNext').hits.length === 1)
  ok('P4 命中:return true', fixture('presenceTrue').hits.length === 1)
  ok(
    'P5 反向:前导取反 = 不适用即继续,合法(absence 档不计红)',
    (() => {
      const r = fixture('absenceGuard')
      return (
        r.hits.length === 0 &&
        r.passed.length === 0 &&
        r.undetermined.length === 0 &&
        r.absent === 1
      )
    })(),
  )
  ok(
    'P6 反向:条件里就是验证调用 ⇒ passed(#23 修复后的正确形态)',
    (() => {
      const r = fixture('verifyInCond')
      return r.hits.length === 0 && r.passed.length === 1
    })(),
  )
  ok(
    'P7 反向:存在性判断后分支内做验证 ⇒ passed(存在+验证不得当豁免判)',
    (() => {
      const r = fixture('verifyInBlock')
      return r.hits.length === 0 && r.passed.length === 1
    })(),
  )
  ok(
    'P8 放过:值比较不是纯存在性(是否"安全比较"属另一维,不判)',
    fixture('valueCompare').hits.length === 0,
  )
  ok(
    'P9 判不出:条件里的 helper 调用要逐条点名,既不冒红也不静默放过',
    (() => {
      const r = fixture('helperUnknown')
      return r.hits.length === 0 && r.undetermined.length === 1
    })(),
  )
  ok(
    'P10 判不出:动态属性名(headers[变量])',
    (() => {
      const r = fixture('dynamicProp')
      return r.hits.length === 0 && r.undetermined.length === 1
    })(),
  )
  ok('P11 遮噪:注释里的该形态不得计入(判据面先剥注释)', fixture('inComment').hits.length === 0)
  ok('P12 遮噪:字符串字面量里的该形态不得计入', fixture('inString').hits.length === 0)
  ok(
    'P13 豁免:带原因才放行,且进 exempted 只报数',
    (() => {
      const r = fixture('exemptReason')
      return r.hits.length === 0 && r.exempted.length === 1
    })(),
  )
  ok('P14 裸标记(presence-exempt: 后无原因)不得放行', fixture('bareMarker').hits.length === 1)
  ok(
    'P15 边界(如实登记):声明不在此文件可见时仍不判 —— A 维只做"同文件一跳",不猜外层/形参',
    fixture('identifierOnly').hits.length === 0,
  )
  ok('P16 命中:两个头存在性 || 组合仍算纯存在性', fixture('orTwoPresence').hits.length === 1)
  ok(
    'P17 判不出:叶里混了不含凭据字段的项(isAdmin &&)⇒ 不猜',
    (() => {
      const r = fixture('mixedLeaf')
      return r.hits.length === 0 && r.undetermined.length === 1
    })(),
  )
  ok('P18 命中:点号访问头(request.headers.authorization)', fixture('dotAccess').hits.length === 1)
  ok('P19 命中:!! 取反抵消后仍是存在判断', fixture('doubleBang').hits.length === 1)
  ok(
    'P20 放过:分支是 return false(回给框架的语义不是"跳过校验"),不猜成放行',
    fixture('notPassConsequent').hits.length === 0,
  )
  // ── A 维:凭据先取进变量再判(本票新纳管;每条都有成对反例)──
  ok(
    'A1 命中:const authToken = headers.authorization ?? cookies.auth_token 后 if (authToken) return',
    (() => {
      const r = fixture('varStashPresence')
      return r.hits.length === 1 && r.undetermined.length === 0 && /变量中转/.test(r.hits[0].reason)
    })(),
  )
  ok(
    'A2 命中:解构 const { authorization } = request.headers 后 if (authorization) { return }',
    (() => {
      const r = fixture('varStashDestructure')
      return r.hits.length === 1 && /变量中转/.test(r.hits[0].reason)
    })(),
  )
  ok(
    'A3 放过:右值是验证调用(const ok = await isVerified…(request))⇒ 落 passed,不得落 hits',
    (() => {
      const r = fixture('varStashVerify')
      return r.hits.length === 0 && r.passed.length === 1
    })(),
  )
  ok(
    'A4 判不出:右值是看不懂的取头 helper(extractBearer(headers.authorization))⇒ 点名,不冒红也不静默放过',
    (() => {
      const r = fixture('varStashHelperOpaque')
      return r.hits.length === 0 && r.undetermined.length === 1
    })(),
  )
  ok(
    'A5 反向:前导取反的中转仍是"不适用即继续"(absent 档)—— B/A 两维都不得改动豁免方向判序',
    (() => {
      const r = fixture('varStashAbsenceGuard')
      return (
        r.hits.length === 0 &&
        r.passed.length === 0 &&
        r.undetermined.length === 0 &&
        r.absent === 1
      )
    })(),
  )
  ok(
    'A6 噪声上界:右值与凭据无关的局部量(const enabled = cfg.csrfEnabled)⇒ 不判也不计未判定',
    (() => {
      const r = fixture('varStashNotCred')
      return (
        r.hits.length === 0 &&
        r.passed.length === 0 &&
        r.undetermined.length === 0 &&
        r.absent === 0
      )
    })(),
  )
  ok(
    'A7 放过:中转变量 + 拒绝路径(if (!authToken) return reply.status(401))与本型无关,四档全空',
    (() => {
      const r = fixture('varStashNotPassReply')
      return (
        r.hits.length === 0 &&
        r.passed.length === 0 &&
        r.undetermined.length === 0 &&
        r.absent === 0
      )
    })(),
  )
  ok(
    'A8 判不出:同名声明两处且都指向凭据 ⇒ 静态分不开是哪一条(点名,不猜第一条)',
    (() => {
      const r = fixture('varStashMultiDecl')
      return (
        r.hits.length === 0 &&
        r.undetermined.length === 1 &&
        /同名声明 2 处/.test(r.undetermined[0].reason)
      )
    })(),
  )
  ok(
    'A9 命中:右值被 Prettier 折到下一行(`const x =` 换行 `request.headers…`)仍要看得见',
    (() => {
      const r = fixture('varStashWrapped')
      return r.hits.length === 1 && /变量中转/.test(r.hits[0].reason)
    })(),
  )
  ok(
    'A10 防越界:等号与值之间夹空行 ⇒ 不去抓后面某行的凭据出处(假账比漏报贵)',
    (() => {
      const r = fixture('varStashBlankSep')
      return (
        r.hits.length === 0 &&
        r.passed.length === 0 &&
        r.undetermined.length === 0 &&
        r.absent === 0
      )
    })(),
  )
  // ── B 维:continue 形态放行(只扩放行语句书写形态,不动放过通道)──
  ok(
    'B1 命中:策略循环里 if (headers["x-internal-service-token"]) continue = 跳过本条校验',
    (() => {
      const r = fixture('continuePresence')
      return r.hits.length === 1 && r.hits[0].text.includes(PREFIX_NEEDLE)
    })(),
  )
  ok(
    'B2 命中:大括号块里只有 continue 也算放行',
    (() => {
      const r = fixture('continueBrace')
      return r.hits.length === 1
    })(),
  )
  ok(
    'B3 命中:带标签的 continue outer 同样跳过本条校验',
    fixture('continueLabeled').hits.length === 1,
  )
  ok(
    'B4 放过:continue 块里做了真比较(secretsEqual)⇒ passed(#23 修复形态的循环版本)',
    (() => {
      const r = fixture('continueVerifyBlock')
      return r.hits.length === 0 && r.passed.length === 1
    })(),
  )
  ok(
    'B5 反向:前导取反的 continue(不适用即继续)仍落 absent,不得被翻成红',
    (() => {
      const r = fixture('continueAbsence')
      return (
        r.hits.length === 0 &&
        r.passed.length === 0 &&
        r.undetermined.length === 0 &&
        r.absent === 1
      )
    })(),
  )
  ok(
    'B6 放过:块里除 continue 还有别的语句(logSkip(); continue)⇒ 不是"整块裸放行",不猜',
    (() => {
      const r = fixture('continueNotPassOnly')
      return r.hits.length === 0 && r.undetermined.length === 0
    })(),
  )
  ok(
    'B7 边界(如实登记):break 今天不进 PASS 表 —— 要纳管必须同笔改掉这条与头注"已知不判 3"',
    fixture('breakNotPass').hits.length === 0,
  )
  // 阳性对照 —— 本门的存在理由:修复前那版 csrf.ts 必须被点名
  const old = readHistoricalCsrf()
  ok(
    '阳性对照前置:历史 blob 取到(' + FIX_COMMIT.slice(0, 10) + '^:' + CSRF_PATH + ')',
    typeof old === 'string',
  )
  if (typeof old === 'string') {
    const r = findPresenceExemptions(old)
    const named = r.hits.find((h) => h.text.includes(PREFIX_NEEDLE))
    ok(`阳性对照:修复前的「凭据存在即豁免」被点名(line ${named ? named.line : '—'})`, !!named)
    if (named) console.log(`   ↳ 命中输出行:${named.line}: ${named.text}`)
  }
  // 反向对照:当前 HEAD 的 csrf.ts —— 注释里的旧写法不计红,验证调用行记 passed;
  // x-goog-api-key 那处存量已于 c824c12070(G-1018280/G-373)改为查库验真路径 ⇒ 现读不再是命中,
  // 反向对照随之翻成"不得再呈存在性豁免命中"(判据的牙由夹具 P1-P20 与历史 blob 阳性对照承担,不靠这一条)。
  const headCsrf = readFace([CSRF_PATH], 'head').get(CSRF_PATH)
  if (typeof headCsrf === 'string') {
    const r = findPresenceExemptions(headCsrf)
    ok(
      '反向对照:HEAD csrf.ts 不得把注释里的 x-internal-service-token 判成命中',
      !r.hits.some((h) => h.text.includes(PREFIX_NEEDLE)),
    )
    ok(
      '反向对照:HEAD csrf.ts 的 isVerifiedInternalMachineCall 行进 passed(放过)',
      r.passed.some((p) => p.text.includes(FIXED_NEEDLE)),
    )
    ok(
      '反向对照:HEAD csrf.ts 的 x-goog-api-key 已改验真路径(c824c12070),不得再呈存在性豁免命中',
      !r.hits.some((h) => h.text.includes(HEAD_NEEDLE)),
    )
  } else {
    ok('反向对照:HEAD csrf.ts 取不到 ⇒ 无法取证(判失败,不静默)', false)
  }
  // 覆盖面成对:安全语义文件进射程,测试/夹具面与无关键名文件不进
  ok(
    '覆盖面:plugins/csrf 与 *auth* 路由进射程;测试面与本门自身不进',
    inScope('apps/api/src/plugins/csrf.ts') &&
      inScope('apps/api/src/routes/admin/auth-role.ts') &&
      inScope('apps/api/src/utils/internal-principal.ts') &&
      !inScope('apps/api/tests/x.test.ts') &&
      !inScope('apps/web/e2e/y.ts') &&
      !inScope('scripts/tests/check-gate-presence-exemption.test.mjs') &&
      !inScope('scripts/check-gate-presence-exemption.mjs') &&
      !inScope('apps/web/app/page.tsx'),
  )
  ok(
    '覆盖面(oauth 含 auth 子串按"文件名含"入库,刻意保留并登记)',
    inScope('apps/api/src/routes/oauth-tokens.ts'),
  )
  // 回退判定四路(同门 135 的教训:端到端那例依赖共享索引此刻有什么,只能用构造面)
  ok(
    '暂存档 + 无 --files + 射程内 0 个 ⇒ 回退全量',
    shouldRetreatToHead({ face: 'staged', hasOnlyFiles: false, stagedInScopeCount: 0 }),
  )
  ok(
    '暂存档里有射程内文件 ⇒ 绝不回退(回退=把本次改动放过去)',
    !shouldRetreatToHead({ face: 'staged', hasOnlyFiles: false, stagedInScopeCount: 1 }),
  )
  ok(
    '显式 --files ⇒ 不回退',
    !shouldRetreatToHead({ face: 'staged', hasOnlyFiles: true, stagedInScopeCount: 0 }),
  )
  ok(
    '全量档 0 候选仍是判死,不是改判成别的面',
    !shouldRetreatToHead({ face: 'head', hasOnlyFiles: false, stagedInScopeCount: -1 }),
  )
  // 真仓 HEAD 端到端:存量清零(c824c12070 修掉 5 处真漏洞后现读为 0)+ 不因存量判红(恒红防线);
  // 存量回潮(新增无标记的存在性豁免)会让这一条变红 —— 端到端 tripwire,牙与夹具同源。
  const head = analyze('head')
  ok(
    `真仓 HEAD 对照:存量清零、回潮即红(实得命中 ${head.hits} / 放过 ${head.passed} / 判不出 ${head.undetermined})`,
    head.hits === 0,
  )
  ok('HEAD 全量档不得因存量判红(锚点=该文件自身;当场判红就是恒红门,§12e)', head.exit === 0)
  ok(
    'strict 档语义:有命中即 1、有判不出优先落 2(拒绝出合格证)',
    (() => {
      const s = analyze('head', null, true)
      const wantExit = s.undetermined + s.malformed > 0 ? 2 : s.hits > 0 ? 1 : 0
      return s.exit === wantExit && (wantExit !== 0 || s.hits === 0)
    })(),
  )
  ok(
    '空枚举判死:--files 指到无射程内文件 ⇒ exit 2,绝不记绿',
    (() => {
      const e = analyze('head', ['does/not/exist.ts'])
      return e.emptyScan && e.exit === 2
    })(),
  )
  // 夹具期望表:每个夹具落在哪一档写在一处,读数由它算出 —— 旧版把这行写死成"命中 8 / 放过 3 …",
  // 用例一加就变成假账(而假账的表现形式是"数字看着合理")。表与逐条 ok() 是两把尺子:
  // 逐条 ok() 钉语义,这张表钉"覆盖面没漏项"(新增夹具若没进表,这里当场红)。
  const EXPECT = {
    presenceBare: 'hit',
    presenceBrace: 'hit',
    presenceNext: 'hit',
    presenceTrue: 'hit',
    absenceGuard: 'absence',
    verifyInCond: 'passed',
    verifyInBlock: 'passed',
    valueCompare: 'neutral',
    helperUnknown: 'undetermined',
    dynamicProp: 'undetermined',
    inComment: 'neutral',
    inString: 'neutral',
    exemptReason: 'exempted',
    bareMarker: 'hit',
    identifierOnly: 'neutral',
    orTwoPresence: 'hit',
    mixedLeaf: 'undetermined',
    dotAccess: 'hit',
    doubleBang: 'hit',
    notPassConsequent: 'neutral',
    varStashPresence: 'hit',
    varStashDestructure: 'hit',
    varStashVerify: 'passed',
    varStashHelperOpaque: 'undetermined',
    varStashAbsenceGuard: 'absence',
    varStashNotCred: 'neutral',
    varStashNotPassReply: 'neutral',
    varStashMultiDecl: 'undetermined',
    varStashWrapped: 'hit',
    varStashBlankSep: 'neutral',
    continuePresence: 'hit',
    continueBrace: 'hit',
    continueLabeled: 'hit',
    continueVerifyBlock: 'passed',
    continueAbsence: 'absence',
    continueNotPassOnly: 'neutral',
    breakNotPass: 'neutral',
  }
  const bucketOf = (r) => {
    if (r.hits.length) return 'hit'
    if (r.exempted.length) return 'exempted'
    if (r.undetermined.length) return 'undetermined'
    if (r.passed.length) return 'passed'
    if (r.absent) return 'absence'
    return 'neutral'
  }
  const tableMisses = []
  for (const name of Object.keys(FIXTURES)) {
    if (!(name in EXPECT)) {
      tableMisses.push(`${name}:夹具没进期望表`)
      continue
    }
    const got = bucketOf(fixture(name))
    if (got !== EXPECT[name]) tableMisses.push(`${name}:期望 ${EXPECT[name]} 实得 ${got}`)
  }
  for (const name of Object.keys(EXPECT))
    if (!(name in FIXTURES)) tableMisses.push(`${name}:期望表引用了不存在的夹具`)
  ok(
    '夹具期望表自洽:每个夹具都落进预期的档,表里没有悬空条目',
    tableMisses.length === 0,
    tableMisses.join(' / '),
  )
  const tally = { hit: 0, passed: 0, undetermined: 0, absence: 0, exempted: 0, neutral: 0 }
  for (const n of Object.keys(EXPECT)) tally[EXPECT[n]]++
  console.log(
    `--self-test 读数:夹具 ${Object.keys(EXPECT).length} 例(命中 ${tally.hit} / 放过 ${tally.passed} / 判不出 ${tally.undetermined} / absence ${tally.absence} / 豁免 ${tally.exempted} / 四档全空 ${tally.neutral};由期望表算出,非手写)+ 真仓 HEAD(命中 ${head.hits} / 放过 ${head.passed} / 判不出 ${head.undetermined})`,
  )
  console.log(okAll ? '--self-test: 全部通过' : '--self-test: 有失败')
  process.exitCode = okAll ? 0 : 1
}

/* ------------------------------- CLI ------------------------------- */

function main() {
  const argv = process.argv.slice(2)
  if (argv.includes('--self-test')) return runSelfTest()
  const picked = selectFace({
    staged: argv.includes('--staged'),
    worktree: argv.includes('--worktree'),
    def: 'head',
  })
  if (picked.error) {
    console.error(`❌ ${picked.error}`)
    process.exitCode = 2
    return
  }
  const strict = argv.includes('--strict')
  const fi = argv.indexOf('--files')
  const only = fi >= 0 ? argv.slice(fi + 1).filter((a) => !a.startsWith('--')) : null
  const r = analyze(picked.face, only && only.length ? only : null, strict)
  if (argv.includes('--json')) {
    console.log(JSON.stringify(r, null, 2))
    process.exitCode = r.exit
    return
  }
  console.log(
    `[gate-presence-exemption] 面:${r.face} · 扫描 ${r.scannedFiles} 文件 · 命中 ${r.hits} / 放过 ${r.passed} / 判不出 ${r.undetermined} · 不适用即继续 ${r.absent} · 带豁免 ${r.exempted} · 配平失败 ${r.malformed}`,
  )
  if (r.retreatReason) console.log(`↩️ ${r.retreatReason}`)
  for (const h of r.hitSites.slice(0, 15)) console.log(`  ⚠ 命中 ${h.file}:${h.line} — ${h.text}`)
  if (r.hitSites.length > 15) console.log(`  … 其余 ${r.hitSites.length - 15} 处见 --json`)
  for (const u of r.undSites.slice(0, 15))
    console.log(`  ？判不出 ${u.file}:${u.line} — ${u.reason}(${u.text})`)
  if (r.undSites.length > 15) console.log(`  … 其余 ${r.undSites.length - 15} 处见 --json`)
  if (r.malformed)
    console.log(
      `  ？条件/分支括号配平超出 40 行窗口:${r.malformed} 处含凭据字段而本门未判 —— --json 之外逐条需人工`,
    )
  if (r.exempted)
    console.log(
      `  ⚠ 带 presence-exempt 豁免 ${r.exempted} 处(只报数;到期账归守门 108 默认档,族定档另计一票)`,
    )
  if (r.unreadable.length)
    console.log(`❌ 无法判定:${r.unreadable.length} 个候选在本面取不到内容,首个:${r.unreadable[0]}`)
  if (r.emptyScan) console.log('❌ 本面枚举到 0 个射程内候选 —— 判"无法判定",绝不记绿')
  if (r.red.length) {
    console.log(`❌ 新增(超出该文件 HEAD 自身存量)${r.red.length} 个文件:`)
    for (const x of r.red.slice(0, 12))
      console.log(`   - ${x.file}: 命中 ${x.n} 处(HEAD 存量 ${x.cap}) 例:${x.sites[0]?.text ?? ''}`)
    console.log(
      '   出口:把豁免改成"验过才免"(如 isVerifiedInternalMachineCall),或确属有意时写 presence-exempt: <原因>',
    )
  } else if (r.exit === 0 && !strict) {
    console.log(
      `✅ 无新增。存量命中 ${r.hits} 处按"该文件 HEAD 自身存量"棘轮只报数(现值以本行为准,勿引用文档旧数)`,
    )
  }
  process.exitCode = r.exit
}

export const __test__ = {
  findPresenceExemptions,
  classifyCondition,
  scanIfSites,
  collectDeclarations,
  traceIdentifierCondition,
  inScope,
  shouldRetreatToHead,
  analyze,
  readHistoricalCsrf,
  FIXTURES,
  EXEMPT,
  CRED_RE,
  VERIFY_RE,
  PASS_STMT_RE,
  IDENT_COND_RE,
  FIX_COMMIT,
  CSRF_PATH,
  PREFIX_NEEDLE,
  HEAD_NEEDLE,
  FIXED_NEEDLE,
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  try {
    main()
  } catch (e) {
    console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
