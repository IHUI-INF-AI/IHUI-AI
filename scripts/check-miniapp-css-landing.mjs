#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * check-miniapp-css-landing.mjs —— 小程序端「源码用到的 Tailwind utility ↔ 产物里真产出规则」对账
 *
 * 为什么要有这一道(2026-09-25 立):跨端"同源对账"已有五道(36 / 37 / 93 / style-parity / radius),
 * 它们**全部只核源码与 token 源头,没有一道看产物**。实测一次真实 weapp 构建(exit 0)之后,
 * dist 的 154 个 wxss 里源码用到的 Tailwind utility **0 个产出规则**,而五道门同时全绿。
 * "写的同源"与"生效的同源"是两件事,后者此前无人看守 —— 本门补的就是这一面。
 *
 * ⚠️ 定级:**当前为手动 / CI 门,刻意不接进提交链**。它判的是构建产物,而产物在提交者机器上
 *   结构上未必存在(dist 被 .gitignore 忽略,且会被同端另一次构建整目录换掉 —— 立因当天本机 dist
 *   就在取证中途被一次 h5 构建覆盖)。接成 blocking 只会逼人 --no-verify,连带废掉全部守门
 *   (§12e 同型,本仓最高频反面教训)。镜像测试锁住「声明的接线态与实际接线态必须一致」。
 *
 * 三条判据:
 *   C1 落地覆盖率 = |源码用到 ∩ utility 参考层 ∩ dist 里真有规则| / |源码用到 ∩ utility 参考层|。
 *      低于 --min-coverage(默认 100%)即判红,并给若干缺失样例。
 *      **命中判据按 weapp 转写名比对**(2026-09-25 收紧):weapp-tailwindcss 产出 wxss 时把类名
 *      里的标点按固定表转写(`top-1/2` → `.top-1_f2`,表见 weappMangleClassName),旧判据只拿
 *      源文件里的原始类名去比,于是**所有含标点的档(arbitrary value、分数、任意属性)整片被误判
 *      "没落地"** —— 实测同一份 dist 上 `.bg-muted`/`.top-1_f2` 声明体都在,而覆盖率报 34.5%、
 *      505 条缺项绝大多数是这把尺的噪声。收紧后:命中 = 原名直中 或 转写后中,**两态分开计数**
 *      (只报合计会把"表漏了一条"藏起来);缺项里含**表外标点**(`! * % # @ > ~` 等未实证转写)的
 *      单独归 unmangledPunctMisses **只报数、绝不并入 hit** 并把字符列出来 —— 判不出是"真没落地"
 *      还是"表漏一条",把字符交给下一次实测,而不是继续把它们算成"没落地"或猜进表。
 *      缺项样例/归族只统计"确定缺"(definite):上一轮正是靠"缺项恰好成族(项目色档整族)"
 *      定位到真缺陷,这个信号不能再被噪声埋掉。
 *      **命中形态必须等于产出形态**(2026-09-25 补形状盲区,§4 守门 77 B6 同一条规矩):
 *      "落地"只认**裸类规则**(isBareUtilitySelector —— 防手写复合规则冒充 utility,那次把
 *      92.49% 虚报成 99.89%)。但 v4 有一族 utility **从来就不产出裸类规则**(真产物实测
 *      `.space-x-2>view+view,…`),space-x-2/space-x-3/space-y-2 因此被整族误判"没落地"。
 *      修法不是放松,而是让**参考层自己的产出形状**决定产物该长成什么样:v4 参考层额外算出
 *      "裸类产出子集"(bareNames,复用同一把 isBareUtilitySelector,不写第二份判据);
 *      对"参考层就只有复合形态"的名字,产物侧改问"有没有一条规则的选择器以 `.<名字>` 开头
 *      (**首族**)",单独记第三态 hitCompoundKinds(三态分开计数,与两态同理:合计会藏漏判)。
 *      `.card-list .space-x-2{}` 这类**后代手写提及仍判缺** —— 那是原 bug 的锁,不许为绿而松;
 *      `.space-x-2.own{}`(多类紧随)与 `.space-x-20`(前缀名)同样不吃第三态。
 *      **参考层的引擎由产物决定**(见下「引擎同源」):拿 v3 的可选集去量 v4 的产物,
 *      报出来的"还剩 N 条没落地"不是缺陷计数,是一把量错东西的尺子的读数。
 *   C2 同名双义 = 源码用到的 utility 名同时被端内自有 CSS 定义为同名类。逐条列出并分类,
 *      其中 white-on-white 那一型不是"样式没生效"而是**观感事故**(白底白字),必须点名。
 *   C3 体积预算 = 按 app.json 声明的 subpackage roots 切主包量字节,对 2 MiB 上限报余量。
 *      utilities 链**已于 2026-09-25 开链落地**(实测主包 C1 覆盖 0.79% → 32.15%,主包体积反瘦 61KB),
 *      所以这里报的是**含 utilities 落地量的实测现值** —— 旧的"若开启…装不装得下"假设算术已作废。
 *      **只报数不判红** —— 体积是决策输入,不是本门的对错。
 *   C4 可达性 = 转写名进了 wxss,还得在产物 js/wxml/wxs 那一侧**挂得上**才算到端可用。
 *      运行时维自 2026-09-26 起是**三态**而非两态(修口,起因是实测把三条正当落地判成死规则):
 *        · `hitMangledKinds` —— `collectRuntimeFace().tokens` 看得见(class/className 紧邻字面量)
 *        · `hitSightedKinds` —— 抽取器看不见、但**全文子串搜索**目击得到
 *          (实测形态 `".concat(v===t?"font-bold border-_blength_c14rpx_B border-transparent":"")"`:
 *           类名在 `.concat()` / 三元的**参数**里,`CLASS_ATTR_RE` 那种"属性紧邻字面量"的抽取结构上看不见,
 *           于是 `border-[length:14rpx]` / `from-[var(--color-brand-accent)]` / `to-[var(--color-danger)]`
 *           三条被高估成死规则 —— 死规则维度对拼接 class 会**虚报**);
 *        · `deadRuleKinds` —— 两侧都看不见 ⇒ 规则产出了但谁也没挂上(第 3 桶)。
 *      三态分开报数,合计必须等于「CSS 侧只有转写名」那一集(镜像测试钉死)。**第 2 态不是放水**:
 *      它由同一个 `findMangledSightings` 判据给,而该判据的反向锁(全文真一个字都没有 ⇒ 仍判 dead)
 *      与 C5 共用 —— 反向证明在 `--self-test` / 镜像测试里都做了。
 *   C5 转写腿结构性对账(2026-09-26 立,**结构判据,不是量级判据**)。
 *      起因(实测,已定论):同一份仓库配置,一次构建 JS 侧**一个转写名都没有**(死规则 485、
 *      C1 掉到 34.89%),另一次全转写(死规则 34),而 `apps/miniapp-taro/config/index.ts`
 *      两次之间**一字未改** ⇒ weapp 的 JS/WXML 改名腿会**整轮空转**,而当时没有任何一条判据
 *      能在"腿整轮没跑"时必然翻红:它只是让 pct 变小,而 `--min-coverage 0` 的观测档下 pct 根本不判红
 *      —— 那是拿"量级判据"冒充"结构判据"。现口径(两维职责不互吞):
 *        面 1 = mangledOnly 集(demanded ∧ 原名在 wxss 无规则 ∧ 转写名在 wxss 有规则)= 命中(两态)+ 死规则;
 *        面 2 = 对面 1 每个名字取 `weappMangleClassName(名)` 到产物 js/wxml/wxs **全文**做子串搜索
 *               (刻意不用 tokens 抽取集 —— 见 C4 第 2 态,抽取器看不见拼接串),数"至少命中一次"的名字;
 *        面 1 > 0 ∧ 面 2 == 0 ⇒ **必红**(结论行点名"本轮 JS/WXML 转写腿空转",样例 ≤5);
 *        面 1 == 0 ⇒ 这一维写**「未判定(本轮无可观测转写需求)」,绝不记为通过**(空扫报绿是本仓最高频失效型);
 *        **部分偏跳不触发 C5**,仍归 C4 计数 —— C5 只判"整轮没跑"这一型结构性失效,量级偏跳是 C4 的地盘。
 *      C5 与 C1 的 pct **互不遮蔽**:它不受 `--min-coverage` 影响(观测档照样判红),C1 判不判红也不决定 C5。
 *
 * 引擎同源(2026-09-25 换档,本门从"报一个错引擎的数"改成"同引擎或弃权"):
 *   端 `apps/miniapp-taro/package.json` 声明 Tailwind v3,但真实 weapp 构建跑的是 **v4.3.3**
 *   (weapp-tailwindcss@5.2.9 引 `@tailwindcss/postcss`)。参考层此前恒用端内解析到的 v3 直出。
 *   现在 `auto` 档按产物 base 层指纹选引擎,选不到同引擎就 **exit 2 且一个覆盖率都不给**;
 *   v4 档的输入是实测出来的三件套(少一样分母就是错的):
 *     1. `@config '<端内 tailwind.config.ts>'` —— 缺它则 `bg-muted` / `text-card` 这类命名档整类不产出;
 *     2. `@import 'tailwindcss/theme.css'` —— 只导 utilities.css 时 `px-4` / `text-sm` 全部产不出
 *        (实测参考层可选集 762 → 599,而产物里明明有 `.px-4`);
 *     3. **候选由本门显式喂进** `compile().build(candidates)`,不用 `@source` 扫盘 ——
 *        实测 `@tailwindcss/postcss` + `@source "<端内源码>"` 在本进程里一条候选都没扫到
 *        (v4 直出 `px-4=false`),拿它当分母等于把缺陷洗成"不在可选集";显式喂候选还顺带让
 *        参考层与源码**同一个面**,消掉了原来"参考层只能判磁盘、HEAD 面在量的却是另一把尺"的缺陷。
 *   `--reference-engine v3|v4` / `--legacy-reference-v3` 是人工对比档:出数但 C1 不判红。
 *
 * 口径(与守门 70/77/83/98/101 一致):
 *   **单一判定面**:源码与参考层在同一轮取自**同一个面** ——
 *     源码面:全量判 **HEAD blob** / `--staged` 判**索引 blob** / `--worktree` 仅人工逃生舱。
 *     参考面:v4 = 与源码同面(候选由源码面 harvest 后显式喂进 compile().build());
 *             v3 = 生成器只能读 content globs(磁盘)⇒ 仅当源码面也是 worktree 才算同面;
 *                  auto 档遇到「v3 参考层 + 非 worktree 源码面」直接判「无法判定」,
 *                  **不再允许"参考层取材=磁盘、源码面=head —— 两把不同面"还照样出判定结论**
 *                  (异面读数是自洽但基准错位的假结论,本仓在守门 77/83/101 各记过一次同型)。
 *   产物面:**恒为磁盘** —— dist 被 gitignore,HEAD 与索引里根本没有它,不存在第二个 git 面;
 *     它是"产物事实"而不是第二把判定尺。
 *   任一面取不到输入 ⇒ **exit 2「无法判定」**,既不冒红也不记绿。尤其不得把"产物不存在"
 *   报成"0% 覆盖" —— 那是把工具失效冒充成业务结论。同样不得把"参考层引擎/取材面与判定不同"
 *   报成一个百分比 —— 那是把量错东西冒充成量到了东西。
 *
 * 用法见 --help。镜像测试:node --test scripts/tests/check-miniapp-css-landing.test.mjs
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { createRequire } from 'node:module'
import { basename, dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { Undetermined, catBatch, gitRaw, readWorktreeFile, selectFace } from './lib/face-reader.mjs'

const DEFAULT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const APP_REL = 'apps/miniapp-taro'
const SRC_PREFIX = `${APP_REL}/src/`
/**
 * 本门的接线态**唯一真相源**,由镜像测试与 guardian-runner 实际内容对账。
 * 为什么要有这个常量而不是让人读注释:「手动门」和「已接提交链」都可能是真的,
 * 而漂移(改了没登记 / 登记了没改)必须被机器发现 —— 否则"刻意不接线"这件事
 * 会在某次改动后悄悄变成"忘了接线",或反过来有人把它接成 blocking 而无人知。
 *   'manual' = 刻意不进提交链(当前):判据依赖构建产物,提交者结构上未必满足。
 *   'commit' = 已接提交链:此时 runner 必须真有它,且必须带 skipEnv 应急出口。
 */
export const WIRING_MODE = 'manual'

/**
 * 接线态对账,**做成纯函数 + 可注入 runnerText**:「声明 manual 而实际被接进了提交链」与
 * 「声明 commit 而实际被摘线」两个方向都必须能红。若这段判断写在测试里,测试就只能观察到
 * 当前真值(manual + 未接线 = 绿)那一格,另外两格永远没被证明过 —— 那等于没锁。
 */
export function auditWiring({
  declared,
  runnerText,
  scriptName = 'check-miniapp-css-landing.mjs',
}) {
  if (!['manual', 'commit'].includes(declared))
    return { ok: false, reason: `WIRING_MODE 取值非法:${declared}` }
  if (typeof runnerText !== 'string')
    return { ok: false, reason: 'runner 文本取不到,无法判定接线态' }
  const wired = runnerText.includes(scriptName)
  if (declared === 'manual' && wired) {
    return {
      ok: false,
      reason: `声明为手动/CI 门,但 runner 里出现了 ${scriptName} —— 被接进提交链而没改声明`,
    }
  }
  if (declared === 'commit' && !wired) {
    return { ok: false, reason: `声明已接提交链,但 runner 里没有 ${scriptName} —— 本门被静默摘线` }
  }
  if (declared === 'commit') {
    const i = runnerText.indexOf(scriptName)
    const block = runnerText.slice(Math.max(0, i - 600), i + 600)
    if (!/skipEnv/.test(block))
      return {
        ok: false,
        reason: '接进提交链的门必须留 skipEnv 应急出口,否则恒红只会逼人 --no-verify',
      }
  }
  return { ok: true, reason: '', wired }
}
/** 微信小程序主包硬上限(字节)。是决策算术的分母,不是本门可调参数。 */
const MAIN_PACKAGE_LIMIT = 2 * 1024 * 1024
const MISSING_SAMPLES = 5
/** 只认 className/class 后紧跟的三种字面量形态;其余写法一律不猜。 */
const CLASS_ATTR_RE = /(?:className|class)\s*=\s*(?:"([^"]*)"|'([^']*)'|\{`([^`]*)`\})/g
/**
 * 类名体允许 CSS 转义对 `\X`(Tailwind 会把 `!visible` / `-right-[12rpx]` 里的 `!`、`[`、`]`
 * 逐个转义)。首字符仍是数字的不算类名(`.2xl` 不是合法选择器)。
 * 这条不是洁癖:本端 dist 历史上光任意值类就有 541 条规则,漏了转义等于整类隐身。
 */
const CLASS_NAME_IN_SELECTOR = /\.(-?(?![0-9])(?:\\.|[A-Za-z0-9_-])+)/g

/** `.\!visible` → `!visible`;`.-right-\[12rpx\]` → `-right-[12rpx]` */
function unescapeClassName(s) {
  return s.replace(/\\(.)/g, '$1')
}
/** 注释里的假规则不得参与判定(建门时同类假阳记过多次) */
function stripComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, '')
}

/* ─────────── weapp-tailwindcss 类名转写:源名 → 产物名的唯一正向表 ─────────── */

/**
 * 标点 → 转写。**转写方向 = 构建方向**,一对一、无歧义;不得反向解产物名(会把端内本来就含
 * `_b`/`_d` 的自有类名误改)。条目取证(2026-09-25,真 weapp 构建 dist 逐条对账):
 *   `[ → _b  ] → _B  / → _f  : → _c  ( → _p  ) → _P  , → _m  . → _d`
 *   实测样本:`-top-[8rpx]`→`.-top-_b8rpx_B`、`top-1/2`→`.top-1_f2`、
 *   `bg-[var(--color-black-50)]`→`.bg-_bvar_p--color-black-50_P_B`、
 *   `bg-[rgba(0,0,0,0.4)]`→`.bg-_brgba_p0_m0_m0_m0_d4_P_B`(证明 arbitrary value **内部**的
 *   `(`/`,`/`.`/`)` 与外层走同一张表)、`dark:text-foreground`→`.dark_ctext-foreground`
 *   (证明变体前缀的 `:` 同样转写)。
 *   `+ → _u` 在立票时标"未观测";本轮在同一次构建产物里观测到了 ——
 *   `pb-[calc(20rpx+env(safe-area-inset-bottom,0))]`→
 *   `.pb-_bcalc_p20rpx_uenv_psafe-area-inset-bottom_m0_P_P_B`,九条现全部有真产物依据。
 * `! * % # @ > ~` 等**不在表内**:未在真产物里实测到转写形态(本 dist 里连 `\!` 形态的落地都
 * 是零),给它们猜一条转写就是把猜测装进判据 —— 猜错的方向是"把真没落地的判成落地"。
 * 这些字符参与的缺项由 unmappedPunctIn 归入"表外标点桶",把字符如实报出来留给下一次实测。
 * ⚠ 不得把 mangle(mangle(x)) 当不动点用:现表替换只引入 [A-Za-z0-9_] 所以二次应用恰好不变,
 *   但那是这张表现值的巧合,判据不依赖它(将来若加入输出含标点的条目,该假设立刻失效)。
 */
export const WEAPP_CLASS_MANGLE_TABLE = new Map([
  ['[', '_b'],
  [']', '_B'],
  ['/', '_f'],
  [':', '_c'],
  ['(', '_p'],
  [')', '_P'],
  [',', '_m'],
  ['.', '_d'],
  ['+', '_u'],
  // `!`(important 前缀)→ `_e`。**本轮在同一次真产物里逐字取到三条证**:
  // `._ebg-muted{background-color:var(--color-muted)!important}`、`._ebg-cta{…}`、`._ebg-primary{…}`。
  // 立票时按 `\!`(CSS 反斜杠转义)去找 ⇒ 零命中,于是这一族 11 条被留在"表外标点"桶里判不出
  // "真没落地 vs 表还缺一条"。教训同 P53:**取证要按构建方真实产出的形态查,不是按 CSS 规范里"应该"的形态查**。
  ['!', '_e'],
])

/** ASCII 标点全集(用于识别"表外标点");字母/数字/-/_ 不在其内,不是标点。 */
const ASCII_PUNCT = /[!-/:-@[-`{-~]/

export function weappMangleClassName(name) {
  let out = ''
  for (const ch of String(name)) out += WEAPP_CLASS_MANGLE_TABLE.get(ch) || ch
  return out
}

/** 该名字里出现、且不在转写表内的 ASCII 标点(去重)。空数组 = 该名字可被表完整转写。
 *  `-` 与 `_` 不算:它们构建前后原样(真产物里 `--color-black-50`、`_b` 段都带连字符),
 *  把连字符当"表外标点"会让每个普通类名都误进桶 —— 写第一版时 P53 当场抓到这个。 */
export function unmappedPunctIn(name) {
  const out = []
  for (const ch of String(name)) {
    if (/[A-Za-z0-9\-_]/.test(ch) || !ASCII_PUNCT.test(ch) || WEAPP_CLASS_MANGLE_TABLE.has(ch))
      continue
    if (!out.includes(ch)) out.push(ch)
  }
  return out
}

/**
 * 缺项归族:变体前缀(最后一个 `:` 之后)→ 剥负号 → 取首个连字符段。
 * `hover:bg-muted`→bg、`-top-[8rpx]`→top、`text-cta-foreground`→text、`flex`→flex。
 * 族是"整族缺失"那类真信号(立项定位靠的就是项目色档整族)的人读单位。
 */
export function missFamily(name) {
  const s = String(name)
  const base = s.slice(s.lastIndexOf(':') + 1).replace(/^-+/, '')
  const seg = base.split('-')[0]
  return seg || '∅'
}

/* ───────────────────────── 源码侧:用量与自有类 ───────────────────────── */

/** className 字面量 token。模板串里的 `${}` 段切出来多半不是类名,由 C1 的分母自然滤掉。 */
export function harvestClassNameTokens(text) {
  const tokens = []
  let m
  CLASS_ATTR_RE.lastIndex = 0
  while ((m = CLASS_ATTR_RE.exec(text))) {
    for (const tok of (m[1] ?? m[2] ?? m[3] ?? '').split(/\s+/)) if (tok) tokens.push(tok)
  }
  return tokens
}

/**
 * 花括号树切分。**这一层是两侧(参考层 / 产物)共用的唯一解析器。**
 *
 * 为什么不能用扁平的 `[^{}]+{[^{}]*}`(它是本门立项时的写法):v4 产出的类规则常常把
 * `@supports` / `@media` **嵌在自己身上**,例如实测形态
 * `.bg-primary\/10 { background-color: var(--color-primary); @supports (color: color-mix(in lab, red, red)) { … } }`
 * —— 规则体里有 `{`,扁平式整条匹配不上 ⇒ 这些 utility 从参考层里**隐身**,表现为
 * C1 的分母悄悄变小(实测 11 个真 utility 走这条形态,全是 `/alpha` 档)。**一把会藏东西的
 * 尺子比一把偏严的尺子危险得多**,所以改成逐块解析。
 *
 * 三条语义(都由 --self-test 钉住):
 *  - at-rule 块(`@media (...) {` / `@layer x {`)的头部 **不参与类名抽取** ——
 *    里面出现的 `.25rem` 之类是数值不是类;只有"选择器规则"节点 contributes 类名。
 *  - 一个类名"有规则" = 选中它的规则块**自己或任一后代块**至少有一条声明;空块不算落地
 *    (立项语义 P5「裸类名不算落地」在此保持不变)。
 *  - 引号内的 `;` / `{` / `}` 不作分隔符(`content:'{'`、`url("a;b")` 不得把解析器打断)。
 */
function ruleNodes(cssText) {
  const src = stripComments(cssText)
  const nodes = []
  let pos = 0
  function block(selector, isSelectorRule) {
    const node = { selector, isSelectorRule, decls: [], children: [] }
    nodes.push(node)
    let buf = ''
    let quote = ''
    while (pos < src.length) {
      const ch = src[pos]
      if (quote) {
        buf += ch
        pos++
        if (ch === '\\') {
          if (pos < src.length) {
            buf += src[pos]
            pos++
          }
          continue
        }
        if (ch === quote) quote = ''
        continue
      }
      if (ch === '"' || ch === "'" || ch === '`') {
        quote = ch
        buf += ch
        pos++
        continue
      }
      if (ch === ';' || ch === '{' || ch === '}') {
        const head = buf.trim()
        buf = ''
        pos++
        if (ch === ';') {
          if (head) node.decls.push(head)
          continue
        }
        if (ch === '}') {
          if (head) node.decls.push(head)
          break
        }
        node.children.push(block(head, !head.startsWith('@')))
        continue
      }
      buf += ch
      pos++
    }
    return node
  }
  const root = block('', false)
  nodes.shift()
  return { root, nodes }
}

function declarationsOf(node) {
  const out = []
  const walk = (n) => {
    for (const d of n.decls) if (!out.includes(d)) out.push(d)
    n.children.forEach(walk)
  }
  walk(node)
  return out
}

function classNamesIn(selector) {
  const names = []
  CLASS_NAME_IN_SELECTOR.lastIndex = 0
  let c
  while ((c = CLASS_NAME_IN_SELECTOR.exec(selector))) names.push(unescapeClassName(c[1]))
  return names
}

/**
 * CSS 里"某个类名被定义了哪些声明"。多规则同名时并集。
 * 只吃"选择器规则"节点(含嵌套),at-rule 头部 不参与。
 */
export function harvestClassDeclarations(cssText) {
  const map = new Map()
  const { nodes } = ruleNodes(cssText)
  for (const node of nodes) {
    if (!node.isSelectorRule) continue
    const decls = declarationsOf(node)
    if (!decls.length) continue
    for (const name of classNamesIn(node.selector)) {
      if (!map.has(name)) map.set(name, [])
      const bag = map.get(name)
      for (const d of decls) if (!bag.includes(d)) bag.push(d)
    }
  }
  return map
}

/** 产物侧"真产出规则"的类名集合:必须带规则体(自己或后代块里有声明)才算落地,裸出现在文本里不算。 */
/**
 * 只有"整条选择器就是一个裸类(可再带伪类)"才算该 utility 真落地。
 *
 * 为什么必须是这条判据(2026-09-25 实测抓到本门最大的一个洞):旧实现把选择器里**任何位置**的
 * 类名都算落地,于是端内手写的后代规则 `.vip-page .border-border{border-color:var(--vip-border)}`
 * 会让 `border-border` 被判成"已落地" —— 而元素只挂 `class="border-border"` 时那条规则根本不生效。
 * 后果不是数字难看一点:项目色档整族(实测 12 档 / 1,313 处裸用法)在产物里 **0 条裸类规则**,
 * 而 C1 照样报 99.89%。一把"复合规则也算数"的尺,恰好把本门立项要防的那一格量没了。
 *
 * 允许伪类/伪元素(`.hover\:bg-primary:hover`、`.focus\:outline-none:focus`)—— 那仍是单类;
 * 排除组合器与第二个类(`.a .b`、`.w-full.rounded-b-\[30rpx\]`、`.a>.b`)。
 */
const BARE_SINGLE_CLASS =
  /^\.-?(?![0-9])(?:\\.|[A-Za-z0-9_\u00a0-\uffff-])+(?::{1,2}[-\w]+(?:\([^)]*\))?)*$/
export function isBareUtilitySelector(sel) {
  return BARE_SINGLE_CLASS.test(String(sel).trim())
}

export function harvestLandedSelectors(cssText) {
  const names = new Set()
  const { nodes } = ruleNodes(cssText)
  for (const node of nodes) {
    if (!node.isSelectorRule) continue
    if (!declarationsOf(node).length) continue
    // 逗号组里逐条判:任一"裸类"分支成立才算这个类名落地
    for (const part of node.selector.split(',')) {
      if (isBareUtilitySelector(part)) for (const name of classNamesIn(part)) names.add(name)
    }
  }
  return names
}

/**
 * 复合选择器的"首族类名"(2026-09-25 补 C1 的形状盲区)。
 *
 * 为什么需要它:v4 有一族 utility **从不产出裸类规则** —— `space-x-2` 在真产物里实测是
 * `.space-x-2>view+view,.space-x-2>view+text,…`(压缩成一行)。裸类判据把它们整族判成
 * "没落地",而它们**确实落地了**。方向不是放松裸类判据(那会回到"手写复合规则冒充
 * utility"的原 bug),而是**由参考层自己的产出形状决定产物该长成什么样**:
 * 参考层就只有复合形态的名字(见 buildUtilityReferenceV4 的 bareNames 分流),产物侧
 * 要求某条选择器**以 `.<名字>` 开头**(首族)才算命中,单列第三态计数。
 * 刻意不接受的形态:
 *  - `.card-list .space-x-2{}`(后代手写)—— 名字不是首族 ⇒ 这正是原 bug 的冒充形态;
 *  - `.space-x-2.own{}`(第二个类紧随)—— 与 BARE 判据排除 `.w-full.rounded-b-*` 同一条理由;
 *  - `.space-x-20>view` 不得救 `space-x-2` —— 正则取**最大类名串**,名字必须整串相等。
 * 裸类分支不进这里(由 harvestLandedSelectors 负责)—— 三态各记各的,合计会把漏判藏起来。
 */
const COMPOUND_LEAD_RE = /^\.-?(?![0-9])(?:\\.|[A-Za-z0-9_-])+/
export function leadingClassNameOfSelectorPart(part) {
  const s = String(part).trim()
  const m = s.match(COMPOUND_LEAD_RE)
  if (!m) return null
  if (s[m[0].length] === '.') return null // 紧随的是第二个类 ⇒ 多类复合,不是 utility 的复合产出形态
  return unescapeClassName(m[0].slice(1))
}

export function harvestCompoundLeadNames(cssText) {
  const names = new Set()
  const { nodes } = ruleNodes(cssText)
  for (const node of nodes) {
    if (!node.isSelectorRule) continue
    if (!declarationsOf(node).length) continue
    for (const part of node.selector.split(',')) {
      if (isBareUtilitySelector(part)) continue
      const lead = leadingClassNameOfSelectorPart(part)
      if (lead) names.add(lead)
    }
  }
  return names
}

/* ───────── 产物形态判别:这是不是"一次 weapp 构建的 dist" ───────── */

function walkFiles(dir, out = []) {
  let items
  try {
    items = readdirSync(dir, { withFileTypes: true })
  } catch {
    return out
  }
  for (const e of items) {
    const p = join(dir, e.name)
    if (e.isDirectory()) {
      // 不穿重解析点(§26:递归枚举穿过 junction 会把别人工具态误记成本仓产物)
      if (e.isSymbolicLink()) continue
      walkFiles(p, out)
    } else out.push(p)
  }
  return out
}

function countFilesWithExt(dir, ext) {
  return walkFiles(dir).filter((p) => p.endsWith(ext)).length
}

/**
 * 这一步是整个门的生命线。本端 `outputRoot` 对 weapp 与 h5 **都**解析成 `dist/`
 * (config/index.ts 只在 alipay 时切 `dist-alipay`),所以一次 `taro build --type h5`
 * 会把 weapp 产物整目录换掉(立因当天本机就是这样:取证跑到一半 154 个 wxss 全没了)。
 * 不做这层判别,门会把"h5 的 dist"读成"weapp 产物里 0 条规则",产出与真实改动无关的假红。
 */
export function classifyDist(distDir) {
  if (!existsSync(distDir))
    return { kind: 'absent', reason: `产物目录不存在:${distDir}`, wxssCount: 0 }
  let entries
  try {
    entries = readdirSync(distDir)
  } catch (e) {
    return {
      kind: 'undetermined',
      reason: `产物目录读不出来:${distDir}(${e.message})`,
      wxssCount: 0,
    }
  }
  const wxssCount = countFilesWithExt(distDir, '.wxss')
  const wxmlCount = countFilesWithExt(distDir, '.wxml')
  if (entries.includes('index.html') && wxmlCount === 0) {
    return {
      kind: 'wrong-platform',
      reason:
        'dist 顶层有 index.html 且一个 .wxml 都没有 —— 这是 h5 构建的产物;weapp 与 h5 共用 outputRoot,dist 已被覆盖,需重跑 weapp 构建',
      wxssCount,
    }
  }
  if (wxmlCount === 0) {
    return {
      kind: 'wrong-platform',
      reason: 'dist 下没有任何 .wxml,不是一次 weapp 构建产物',
      wxssCount,
    }
  }
  if (wxssCount === 0) {
    return {
      kind: 'wrong-platform',
      reason: 'dist 有 .wxml 但 .wxss 计数为 0,产物不完整',
      wxssCount,
    }
  }
  return { kind: 'weapp', reason: '', wxssCount, wxmlCount }
}

/**
 * C6 —— **weapp-tailwindcss 的 CSS 腿本轮到底跑没跑**(结构性判据,不是量级)。
 *
 * 立项依据是同一天三连构建的实测对照(同一份 `config/index.ts`):
 *  - A:CSS 腿在(产物有 321 个 `_b…_B` 转写名)、JS 腿不在 ⇒ C4 死规则 485、C1 34.89%、C5=idle;
 *  - B:两腿都在 ⇒ 死规则 31、C1 93.77%、C5=in;
 *  - C:**CSS 腿整个没跑** —— `--spacing` 停在 `0.25rem`(没做 rem2rpx)、`_b` 形态 0 个,
 *       此时 CSS 用的是 Tailwind 自己的转义选择器 `.z-\[1001\]`,与运行时源名**字面相同**,
 *       于是 C1 读到 **99.35% / 死规则 0 / C5=in** —— 一门"看产物"的门,把最坏的一档读成了最好的一档。
 *
 * 为什么不能让 C1/C4 顺带抓住它:C4/C5 问的是"两侧名字对不对得上",而 C 档两侧确实对得上(都源名);
 * 它答不了"**这个平台的 CSS 引擎该不该看到这些名字**"。微信 WXSS 对反斜杠转义类名的支持就是
 * weapp-tailwindcss 存在的理由(它做 `_b` 改名正是为了绕开转义),所以"没改名 + 留转义/rem"
 * 只能由一条**独立的机制判据**接住 —— 这就是 C6。
 *
 * 两面见证(取不到即 undetermined,**绝不记为通过**):
 *  - `mangledRuleKinds`  产物 landed 里含转写痕迹(`_x` 形态)的类名数;
 *  - `arbitraryDemand`   源码里含表内标点、因此**本应被改名**的 class token 数。
 * 判据:`arbitraryDemand > 0 ∧ mangledRuleKinds == 0` ⇒ CSS 腿整条没跑。
 * 刻意不用"产物还剩多少 rem":主题变量本身就带 rem,健康产物也留 29 处,那是假红源。
 */
export function auditCssLeg({ mangledRuleKinds, arbitraryDemand }) {
  if (typeof mangledRuleKinds !== 'number' || typeof arbitraryDemand !== 'number')
    return { verdict: 'undetermined', reason: 'CSS 腿见证面没量到 ⇒ 不判通过' }
  if (arbitraryDemand > 0 && mangledRuleKinds === 0)
    return {
      verdict: 'off',
      reason: `源码有 ${arbitraryDemand} 个含标点档(按规矩该被 weapp 改名),产物里却是 **0 个** 转写形态类名 ⇒ CSS 腿整条未跑;此时 CSS 用的是转义选择器,与运行时源名字面相同,C1/C4/C5 会一致报好 —— 这一维就是为那种假绿存在的`,
    }
  if (arbitraryDemand === 0)
    return {
      verdict: 'undetermined',
      reason: '本轮源码无含标点档 ⇒ CSS 腿在不在这一维判不出(空扫不记绿)',
      mangledRuleKinds,
      arbitraryDemand,
    }
  return { verdict: 'in', reason: '', mangledRuleKinds, arbitraryDemand }
}

/** 产物 wxss 里 weapp 转写形态的类名计数(从**已解析的 landed 集**数,不扫原始文本)。
 *  ⚠ 刻意**不**用"产物里还剩多少 rem"当见证:Tailwind 的主题变量本身就带 rem
 *  (`--text-sm: 0.875rem`),健康产物实测稳定留有 29 处 rem —— 那会把好构建判成坏构建。
 *  rem2rpx 真正的、唯一的必要见证就是"该被改名的类名有没有被改名"。 */
export function countMangledRuleKinds(landedNames) {
  let n = 0
  for (const name of landedNames) if (/_\S/.test(name)) n++
  return n
}

/** dist 下全部 wxss 的落地选择器并集(恒判磁盘:HEAD/索引里没有产物)。
 *  landed = 裸类形态;compoundLeads = 复合选择器的首族类名(2026-09-25 补第三态的产物侧输入)。 */
export function collectLandedFromDist(distDir) {
  const landed = new Set()
  const compoundLeads = new Set()
  const wxss = walkFiles(distDir).filter((p) => p.endsWith('.wxss'))
  if (wxss.length === 0) throw new Undetermined(`遍历 ${distDir} 一个 .wxss 也没读到,无法判定`)
  for (const p of wxss) {
    const text = readFileSync(p, 'utf8')
    for (const n of harvestLandedSelectors(text)) landed.add(n)
    for (const n of harvestCompoundLeadNames(text)) compoundLeads.add(n)
  }
  return { landed, compoundLeads, wxssFiles: wxss.length }
}

/**
 * 产物**运行时**那一面的语料 —— class token 抽取维与全文子串维**共用同一份取材**。
 *
 * 为什么必须有这一维(2026-09-25 深夜实测逼出来的):
 * weapp-tailwindcss 把 wxss 选择器里的标点转写(`z-[1001]` → `.z-_b1001_B`),但本端这次真构建里
 * **JS 侧的 className 字面量仍是 `z-[1001]`**(实测 `dist/pages/**.js` 逐字可见),
 * 而渲染出来的 DOM class 实测是 `sticky top-0 left-0 right-0 z-  1001 flex flex-col`
 * —— 方括号被当空白吃掉,token 被拆成 `z-` 与 `1001`。
 * ⇒ "wxss 里有 `.z-_b1001_B` 这条规则"**不等于**"这个 utility 到端可用":没有任何元素会挂上那个名字。
 * 只比 CSS 会把 485 个**死规则**计成落地,把 34.5% 刷成 97.4% —— 那正是本仓反复记的
 * "判据只覆盖产出形态的一半"的反面案例:**规则产出了,名字接不上**。
 *
 * 返回两份**不同粒度**的读数,因为要问的问题不同:
 *  - `tokens` —— 从 `class` / `className` 的**紧邻字面量**里抽出的 token 集(C4 第 1 态用)。
 *    抽取器有结构上的盲区:拼接串 / 三元参数里的类名它**看不见**(实测三条,见文件头 C4 条目),
 *    所以"不在 tokens 里"**不能**直接推出"产物里没有那个名字" —— 那是 C4 修口前的第二个洞。
 *  - `haystack` —— 同一批文件的**全文**,给 `findMangledSightings` 做子串搜索用。
 *
 * 两个维度必须读同一批文件:各自 `walkFiles` 一遍就会一端跟着构建走、另一端停在旧快照上,
 * 而本仓记过太多次"两处算同一件事必须共用一份实现"。
 *
 * 这一函数不判对错,只把"运行时到底有什么"量出来给判据用;
 * 一旦 weapp 的 JS/WXML 改名侧被接通(运行时也变成 `_b…_B`),第 2/3 态自然翻成可达,判据不用改。
 */
export function collectRuntimeFace(distDir) {
  const files = walkFiles(distDir).filter((p) => /\.(js|wxml|wxs)$/.test(p))
  if (files.length === 0)
    throw new Undetermined(`遍历 ${distDir} 一个 js/wxml/wxs 也没读到,运行时类名面判不出`)
  const tokens = new Set()
  let haystack = ''
  let unreadable = 0
  for (const p of files) {
    let text
    try {
      text = readFileSync(p, 'utf8')
    } catch {
      unreadable++
      continue
    }
    haystack += text + '\n'
    // 两种落点:wxml 的 class="…" 属性,以及 js bundle 里 className:"…" / 模板串里的整段 class
    for (const m of text.matchAll(/(?:class|className)\s*[=:]\s*["'`]([^"'`\n]{1,600})["'`]/g))
      for (const t of m[1].split(/[\s,]+/)) if (t) tokens.add(t)
  }
  if (tokens.size === 0)
    throw new Undetermined(
      `扫了 ${files.length} 个运行时文件,一个 class token 也没抽到 —— 抽取失效,不得当"没有名字可用"`,
    )
  // 全文面为空 = 整层没有可读内容 ⇒ 「谁都没被目击」这个结论不成立,不得让 C5 拿它判"腿空转"。
  if (haystack.trim() === '')
    throw new Undetermined(
      `扫了 ${files.length} 个运行时文件,全文一个字符也没有 —— 抽取失效,不得当"转写名都没出现"`,
    )
  return { tokens, haystack, files: files.length, unreadable }
}

/** 兼容出口:只要 token 维的调用方(镜像测试与旧口径)。取材恒经 `collectRuntimeFace`,不另走一遍。 */
export function collectRuntimeClassTokens(distDir) {
  const { tokens, files, unreadable } = collectRuntimeFace(distDir)
  return { tokens, files, unreadable }
}

/**
 * 全文子串搜索:**C5 的面 2 与 C4 的第 2 态共用这一份实现**(2026-09-26 立)。
 * 两个判据问的是同一件事("产物运行时全文里有没有出现过这个转写名"),各写一遍必然漂移 ——
 * 而漂移的代价不对称:抽取器那一份偏严(把拼接 class 判成死规则),这一份偏松(什么子串都认),
 * 两边不同形时"死规则"这个数就说不清是谁给的。
 *
 * **反向锁(不得被"全文搜索"洗白的部分)**:只搜 `weappMangleClassName(名)`,不搜原名,也不做
 * 模糊/大小写/去下划线归一 —— 产物 JS 里那个转写名**真的一个字都没有**时必不命中,该名字仍判 dead。
 * 这条由 `--self-test` 与镜像测试各钉一次(镜像那次用真临时 dist 端到端)。
 *
 * 结构性安全:C5 的面 1 恒满足 `mangle(n) !== n`(原名不在 landed 而转写名在 ⇒ 两者必不同 ⇒ 名字里
 * 至少有一个表内标点),所以本函数的命中不可能被"任何代码里都出现的裸词"白送 —— 面 2 为 0 就真的是
 * "全文里没有过任何一个转写名"。判据不依赖这条也成立,但 C5 的判别力靠它(否则 `flex` 这类名字
 * 会让面 2 恒 > 0,空转的腿照样绿)。
 */
export function findMangledSightings(haystack, names) {
  if (typeof haystack !== 'string')
    throw new Undetermined('运行时全文语料没取到 ⇒ 转写名目击维判不出,不得当"一个都没被看见"')
  const seen = new Set()
  for (const n of names ?? []) {
    const m = weappMangleClassName(n)
    if (m && haystack.includes(m)) seen.add(n)
  }
  return seen
}

/**
 * 产物实际跑的 Tailwind 大版本 —— 由 base 层指纹判,**不看 package.json**。
 *
 * 为什么必须有这一条(2026-09-25 O62附⑦):本门的 C1 判据与 C3 的"装不装得下"算术都建立在
 * "utility 参考层"上,而参考层是拿**端内解析到的** tailwind 直出的(现值 3.4.19)。可产物 base 层
 * 带的是 **v4** 指纹,且端 config 明写 `corePlugins.preflight:false` 而产物**照样有 preflight**
 * ⇒ 那份 config 根本没进链。用 v3 参考层去算 v4 构建的体积预算,算的是**错引擎的数**,
 * 而它打印的是"(装得下)"—— 一个会让人据此开链的结论。
 *
 * 两版独有的自定义属性各列一把,**必须成组用**:单看一条会误判(`--tw-ring-offset-shadow` 两版都有)。
 * 命中数只作方向,取"独有指纹谁更全"的那个版本。
 */
const V4_ONLY_PROPS = [
  '--tw-leading',
  '--tw-tracking',
  '--tw-gradient-position',
  '--tw-drop-shadow-size',
  '--tw-duration',
  '--tw-ease',
]
const V3_ONLY_PROPS = ['--tw-bg-opacity', '--tw-text-opacity', '--tw-border-opacity']

export function detectProductTailwindMajor(distDir) {
  const wxss = walkFiles(distDir).filter((p) => p.endsWith('.wxss'))
  if (wxss.length === 0)
    throw new Undetermined(`遍历 ${distDir} 一个 .wxss 也没读到,无法判定产物引擎`)
  // base 层只可能出现在 app 级 wxss(及其 @import 的 origin 件),不必拼 154 个文件
  const base = wxss
    .filter((p) => /(^|[\\/])app[^\\/]*\.wxss$/.test(p))
    .map((p) => readFileSync(p, 'utf8'))
    .join('\n')
  if (!base) throw new Undetermined('产物里没有 app 级 wxss,判不出 base 层指纹')
  const hit = (list) => list.filter((k) => base.includes(k))
  const v4 = hit(V4_ONLY_PROPS)
  const v3 = hit(V3_ONLY_PROPS)
  return {
    major:
      v4.length > 0 && v3.length === 0 ? 'v4' : v3.length > 0 && v4.length === 0 ? 'v3' : 'unknown',
    v4Hits: v4.length,
    v4Total: V4_ONLY_PROPS.length,
    v3Hits: v3.length,
    v3Total: V3_ONLY_PROPS.length,
    preflight: /box-sizing:\s*border-box/.test(base) && /border:\s*0\s+solid/.test(base),
  }
}

/* ───────────────────────── 主包体积(C3,只报数) ───────────────────────── */

/**
 * 按 **app.json 声明的 subpackage roots** 切主包,而不是按"不在 pkg-* 下"。
 * 立因:本端有 7 个分包根长在 `pages/` 里(pages/circle、pages/member、pages/exam …),
 * 按 pkg-* 粗切会把它们错算进主包,把余量直接报成负数(实测差 665,519 B)。
 */
export function measureMainPackage(distDir) {
  const appJsonPath = join(distDir, 'app.json')
  if (!existsSync(appJsonPath)) throw new Undetermined(`产物里没有 app.json:${appJsonPath}`)
  let app
  try {
    app = JSON.parse(readFileSync(appJsonPath, 'utf8'))
  } catch (e) {
    throw new Undetermined(`app.json 解析失败:${e.message}`)
  }
  const roots = [...(app.subpackages || []), ...(app.subPackages || [])]
    .map((s) =>
      String(s.root || '')
        .replace(/^\/+|\/+$/g, '')
        .replace(/\//g, sep),
    )
    .filter(Boolean)
  let mainBytes = 0
  let subBytes = 0
  let fileCount = 0
  for (const p of walkFiles(distDir)) {
    const rel = relative(distDir, p)
    fileCount++
    const size = statSync(p).size
    if (roots.some((r) => rel === r || rel.startsWith(r + sep))) subBytes += size
    else mainBytes += size
  }
  if (fileCount === 0) throw new Undetermined(`产物目录为空:${distDir}`)
  return {
    subpackageRootCount: roots.length,
    fileCount,
    mainBytes,
    subBytes,
    totalBytes: mainBytes + subBytes,
    limitBytes: MAIN_PACKAGE_LIMIT,
    headroomBytes: MAIN_PACKAGE_LIMIT - mainBytes,
  }
}

/* ───────────────── utility 参考层:唯一一处跑 tailwind ───────────────── */

/**
 * 参考层必须**与产物同一个引擎**,否则 C1 的分母是"错引擎的可选集"。
 *
 * 为什么这是一道判据而不是一个日志(2026-09-25 换档):此前参考层恒用**端内解析到的 v3**
 * (3.4.19)直出,而端 `apps/miniapp-taro` 的真实 weapp 构建跑的是 **v4.3.3**
 * (由 weapp-tailwindcss@5.2.9 自带 `@tailwindcss/postcss` 引入,产物 base 层指纹可判)。
 * 用 v3 清单量 v4 产物,报出来的 "还剩 N 条没落地" 不是缺陷计数,是一把量错东西的尺子的读数。
 *
 * `auto` 档只有两种结局:**同引擎**,或**弃权(exit 2 且不给覆盖率数字)**。
 * `v3`/`v4` 是人工指定的对比档 —— 它照样出数,但 C1 不判红,输出行明写"对比档,只是读数"。
 * 这条口径来自本仓反复付过学费的一条禁令:宁可说"判不出",绝不用自信的语气报一个错的数。
 */
export function pickReferenceEngine({ productMajor, requested = 'auto' }) {
  if (requested !== 'auto' && requested !== 'v3' && requested !== 'v4')
    return {
      engine: null,
      explicit: false,
      reason: `--reference-engine 取值非法:${requested}(只认 auto/v3/v4)`,
    }
  if (requested !== 'auto') return { engine: requested, explicit: true, reason: '' }
  if (productMajor === 'v3' || productMajor === 'v4')
    return { engine: productMajor, explicit: false, reason: '' }
  return {
    engine: null,
    explicit: false,
    reason: `产物引擎判不出(major = ${productMajor || '未知'}),无法保证参考层与产物同引擎 ⇒ 不出覆盖率`,
  }
}

/**
 * 参考层与源码面**同面**判据(2026-09-25 立,与引擎同档并列的第二把锁)。
 *
 * 为什么单独成函数:C1 是这门唯一的判红量,而"判红"的前提除了同引擎,还必须**同取材面** ——
 * 参考层由谁的材料生成,决定这把尺量的是哪一轮的世界。三条实测形态:
 *  - v4 档候选由本门从**被审的源码面** harvest 后显式喂进 ⇒ 天然同面,可判。
 *  - v3 档由 tailwind 自己读 content globs(磁盘)⇒ 只有源码面也是 worktree 时才同面;
 *    auto 档碰到「v3 + head/staged」必须**拒绝出判定数**(旧写法只挂一条"两把不同面"的
 *    notice 照样判红 —— 那是把基准错位的读数当结论,守门 77/83/101 都记过同型)。
 *  - 人工指定档(--reference-engine / --legacy-reference-v3)异面时仍可出**读数**,
 *    但 judged=false,报告行明写"对比档,不计红"。
 * 形状判据只能用纯函数 + 构造面证明(§"prove-shape-rulers"),所以面与档的分流全在这里,
 * runCheck 只消费它的结论。
 */
export function planReferenceFace({ face, engine, explicit = false }) {
  if (engine === 'v4') return { sameFace: true, judged: true, action: 'build', reason: '' }
  if (engine === 'v3') {
    if (face === 'worktree') return { sameFace: true, judged: true, action: 'build', reason: '' }
    if (explicit)
      return {
        sameFace: false,
        judged: false,
        action: 'build',
        reason: `人工对比档:参考层只能判磁盘,与 ${face} 面不同面 ⇒ 本行只是读数,不计红`,
      }
    return {
      sameFace: false,
      judged: false,
      action: 'abstain',
      reason: `v3 参考层由生成器读磁盘产出,与 ${face} 源码面天然异面 ⇒ 拒绝出判定覆盖率;要同面对账请跑 --worktree(人工档)`,
    }
  }
  return {
    sameFace: false,
    judged: false,
    action: 'abstain',
    reason: `未知参考层引擎:${String(engine)}`,
  }
}

function majorOf(version) {
  return `v${String(version || '').split('.')[0]}`
}

function readJson(p) {
  return JSON.parse(readFileSync(p, 'utf8'))
}

/** v4 的入口在 exports['.'] 的 import/default 里(v4 的 main 导出会**主动报错拒绝**被当 postcss 插件用) */
function esmEntryOf(pkgDir, pkg) {
  const e = pkg.exports && pkg.exports['.']
  const rel = typeof e === 'string' ? e : (e && (e.import || e.default)) || null
  const cand = rel ? join(pkgDir, rel) : null
  if (cand && existsSync(cand)) return cand
  const fallback = join(pkgDir, 'dist', 'lib.mjs')
  if (existsSync(fallback)) return fallback
  throw new Undetermined(
    `tailwindcss@${pkg.version} 找不到 ESM 入口(exports['.']=${JSON.stringify(e)})`,
  )
}

/**
 * 解析指定大版本的 tailwindcss 安装。锚点顺序 = 端目录 → 仓根,并**逐个如实记账**。
 * 实测本机:端目录解析到 3.4.19、仓根解析到 4.3.3 —— 只查一个锚点必然拿错引擎,
 * 所以这里按"要哪个大版本"筛,而不是"先解析到谁就用谁"。
 */
export function resolveTailwindInstall({ root, appDir, wantMajor }) {
  const tried = []
  for (const anchor of [appDir, root]) {
    try {
      const req = createRequire(join(anchor, 'noop.js'))
      const pkgJsonPath = realpathSync(req.resolve('tailwindcss/package.json'))
      const pkgDir = dirname(pkgJsonPath)
      const pkg = readJson(pkgJsonPath)
      tried.push(`${anchor} → ${pkg.version}`)
      if (!wantMajor || majorOf(pkg.version) === wantMajor)
        return { pkgDir, pkg, version: pkg.version, major: majorOf(pkg.version), anchor, tried }
    } catch (e) {
      tried.push(`${anchor} → 解析失败(${String(e.message).split('\n')[0].slice(0, 90)})`)
    }
  }
  throw new Undetermined(
    `解析不到 tailwindcss${wantMajor ? `(${wantMajor})` : ''};试过 ${tried.join(' | ')}`,
  )
}

/**
 * pnpm 虚拟仓根:由包自己的 realpath 向上反推,不写死盘符、不写死 `D:\nm`。
 * 布局是 `<store>/<pkg目录>/node_modules/<包>`(作用域包再深一层),
 * 所以**必须先向上找到那个名为 node_modules 的祖先**,再上两级才是 store。
 * 直接对包目录数 `dirname()` 会差一层(写门时踩过:作用域包 `@tailwindcss/postcss` 的
 * 路径比裸包深一段,同一套 dirname 对裸包对、对作用域包就落到 `@tailwindcss` 上了)。
 * 结构不符(非 pnpm 布局)就如实返回 null,由调用方走下一个候选。
 */
function findPnpmStore(fromDir) {
  let cur = resolve(fromDir)
  for (let i = 0; i < 12; i++) {
    const parent = dirname(cur)
    if (parent === cur) return null
    if (basename(cur) === 'node_modules') {
      const store = dirname(parent)
      try {
        return readdirSync(store).length > 0 ? store : null
      } catch {
        return null
      }
    }
    cur = parent
  }
  return null
}

/**
 * 按包名定位它的目录。`<name>/package.json` 是最直接的,但**不少 v4 包的 exports
 * 不放开 ./package.json**(实测 `@tailwindcss/postcss` 就是这样),所以退一步:
 * 解析主入口,再向上找到 `package.json` 里 name 对得上的那一层。
 */
function resolvePkgDir(anchorDir, name) {
  const req = createRequire(join(anchorDir, 'noop.js'))
  try {
    const pj = realpathSync(req.resolve(`${name}/package.json`))
    return { pkgDir: dirname(pj), pkg: readJson(pj) }
  } catch (e) {
    const first = String(e.message).split('\n')[0].slice(0, 60)
    try {
      let cur = dirname(realpathSync(req.resolve(name)))
      for (let i = 0; i < 6; i++) {
        const pj = join(cur, 'package.json')
        if (existsSync(pj)) {
          const pkg = readJson(pj)
          if (pkg.name === name) return { pkgDir: cur, pkg }
        }
        const parent = dirname(cur)
        if (parent === cur) break
        cur = parent
      }
      return {
        pkgDir: null,
        pkg: null,
        reason: `主入口向上没找到 name=${name} 的 package.json(先:${first})`,
      }
    } catch {
      return { pkgDir: null, pkg: null, reason: first }
    }
  }
}

function storeCandidates(storeDir, scopeName, wantMajor) {
  const out = []
  if (!storeDir) return out
  const prefix = `${scopeName.replace('/', '+')}@`
  let entries = []
  try {
    entries = readdirSync(storeDir)
  } catch {
    return out
  }
  for (const d of entries) {
    if (!d.startsWith(prefix)) continue
    const pkgJson = join(storeDir, d, 'node_modules', scopeName, 'package.json')
    try {
      const pkg = readJson(pkgJson)
      if (wantMajor && majorOf(pkg.version) !== wantMajor) continue
      out.push({ pkgDir: dirname(pkgJson), pkg, via: `pnpm 虚拟仓 ${basename(storeDir)}/${d}` })
    } catch {
      /* 目录名像但不是有效包(安装中/临时键)—— 跳过并留给下一个候选 */
    }
  }
  return out
}

/**
 * v4 的 CSS-first 入口需要 `@tailwindcss/node` 的 `loadModule`(它内部用 jiti 读端内
 * `tailwind.config.ts` —— 产物里的 `text-card` / `bg-muted` 这些命名档就来自那份 config)。
 * `@tailwindcss/postcss` / `@tailwindcss/node` 在 `D:\nm\.pnpm` 里**都存在,但从端目录和仓根
 * 都 resolve 不到**(实测:端锚 MODULE_NOT_FOUND;`@tailwindcss/postcss@4.3.3` 在依赖图里挂在
 * **apps/web** 那个 importer 名下,把它当"本端的依赖"读正是本仓反复登记过的那类机器事实误采)。
 * 所以候选按可靠性排、每条落空都记原因,并且**先按版本大版本筛**再谈载入:
 *  1. 由 v4 tailwindcss 的 realpath 反推虚拟仓根,按目录名 `@tailwindcss+node@<同大版本>` 取;
 *     (本机实测:命中这条,报 `pnpm 虚拟仓 .pnpm/@tailwindcss+node@4.3.3`)
 *  2. 常规 require 解析(端目录 / 仓根 —— 自己声明了它的仓与 CI 上有效);
 *  3. 先解析 `@tailwindcss/postcss`(含 apps/web 这个兜底锚点),再顺着它的位置找 node。
 * 拿到的引擎与产物同版本已核对:本仓 store 里 v4 只有 `tailwindcss@4.3.3` 一份
 * (`ls .pnpm/tailwindcss@*` 实测),而 weapp 侧的 `loadTailwindV4DesignSystem(source)` 是
 * **先解析出一个 tailwindcss 包再加载它**,不是另带一份闭合引擎 —— 所以"根上那份 4.3.3"
 * 与构建用的是同一套代码;真要证伪这一点,看的是产物指纹(`detectProductTailwindMajor`)而不是谁的 package.json。
 * 全部候选落空 ⇒ 抛 Undetermined 并列出逐候选失败原因 —— **不得**改拿 v3 凑数,
 * 也不得"退而求其次"用没有 loadModule 的入口跑一份缺 config 的参考层(那正是本次要修的错读数)。
 */
export async function resolveV4Loaders({ root, appDir, twPkgDir, wantMajor = 'v4' }) {
  const tried = []
  const cands = []
  const pushStore = (dir, label) => {
    const store = findPnpmStore(dir)
    const got = storeCandidates(store, '@tailwindcss/node', wantMajor)
    if (!got.length)
      tried.push(
        `虚拟仓(${label} → ${store || '解析不到 store'})里没有 ${wantMajor} 的 @tailwindcss/node`,
      )
    for (const c of got) cands.push(c)
  }
  pushStore(twPkgDir, 'tailwindcss')
  for (const anchor of [appDir, root]) {
    const r = resolvePkgDir(anchor, '@tailwindcss/node')
    if (r.pkgDir && majorOf(r.pkg.version) === wantMajor)
      cands.push({ pkgDir: r.pkgDir, pkg: r.pkg, via: `createRequire(${anchor})` })
    else
      tried.push(`${anchor} → ${r.reason || `解析到 ${r.pkg && r.pkg.version},不是 ${wantMajor}`}`)
  }
  for (const anchor of [appDir, root, join(root, 'apps', 'web')]) {
    const plugin = resolvePkgDir(anchor, '@tailwindcss/postcss')
    if (!plugin.pkgDir) {
      tried.push(`经 postcss 入口(${anchor})→ ${plugin.reason}`)
      continue
    }
    pushStore(plugin.pkgDir, `@tailwindcss/postcss@${anchor}`)
    const viaPlugin = resolvePkgDir(plugin.pkgDir, '@tailwindcss/node')
    if (viaPlugin.pkgDir && majorOf(viaPlugin.pkg.version) === wantMajor)
      cands.push({
        pkgDir: viaPlugin.pkgDir,
        pkg: viaPlugin.pkg,
        via: `@tailwindcss/postcss ← ${anchor}`,
      })
    else tried.push(`经 postcss(${anchor})→ ${viaPlugin.reason || `不是 ${wantMajor}`}`)
  }
  const seen = new Set()
  for (const c of cands) {
    if (seen.has(c.pkgDir)) continue
    seen.add(c.pkgDir)
    let entry
    try {
      entry = esmEntryOf(c.pkgDir, c.pkg)
    } catch (e) {
      tried.push(`${c.via} → ${String(e.message).slice(0, 70)}`)
      continue
    }
    try {
      const mod = await import(pathToFileURL(entry).href)
      if (typeof mod.loadModule !== 'function') {
        tried.push(`${c.via} → 不导出 loadModule`)
        continue
      }
      return {
        loadModule: mod.loadModule,
        pkgDir: c.pkgDir,
        version: c.pkg.version,
        via: c.via,
        tried,
      }
    } catch (e) {
      tried.push(`${c.via} → 载入失败 ${String(e.message).split('\n')[0].slice(0, 70)}`)
    }
  }
  throw new Undetermined(
    `解析不到 v4 的 @tailwindcss/node(loadModule);候选 ${cands.length} 个,记录:${[...tried, ...cands.map((c) => c.via)].join(' | ').slice(0, 400)}`,
  )
}

/**
 * **v4 档参考层**:与产物同引擎,输入与构建一致 ——
 *  - `@config '<端内 tailwind.config.ts>'`:构建侧(weapp-tailwindcss 自带 config 加载器)就是拿这份 config 喂 v4 的;
 *    实测少了它 `bg-muted` / `text-card` 一类命名档整类不产出。
 *  - `@import 'tailwindcss/theme.css'`:v4 的 `px-4` / `text-sm` 取值来自 theme,实测**只导 utilities.css
 *    会让这些档全部产不出**(参考层从 762 掉到 599 个可选,分母当场少 161 条)。
 *  - 候选 = **调用方显式喂进来的类名**(取自本门正在判的那个源码面),而不是让引擎自己去扫盘。
 *    两条理由:① 实测 `@tailwindcss/postcss` + `@source "<端内源码>"` 在本进程里**一条候选都没扫到**
 *    (v4 直出 `px-4` 为 false,而产物里明明有 `.px-4`),拿它当分母等于把缺陷洗成"不在可选集";
 *    ② 显式候选让参考层与源码**同一个面**,消掉本门此前"参考层只能判磁盘、与 HEAD 不同面"的那把漂移尺。
 */
export async function buildUtilityReferenceV4({ root, appDir, candidates }) {
  if (!Array.isArray(candidates) || candidates.length === 0)
    throw new Undetermined('v4 参考层需要显式候选(源码面 harvest 出的类名),这次给了 0 个 ⇒ 判不出')
  const tw = resolveTailwindInstall({ root, appDir, wantMajor: 'v4' })
  const loaders = await resolveV4Loaders({ root, appDir, twPkgDir: tw.pkgDir, wantMajor: 'v4' })
  const configPath = join(appDir, 'tailwind.config.ts')
  if (!existsSync(configPath))
    throw new Undetermined(
      `端内没有 tailwind.config.ts:${configPath}(命名档全出自它,缺它参考层必失真)`,
    )
  let engine
  try {
    engine = await import(pathToFileURL(esmEntryOf(tw.pkgDir, tw.pkg)).href)
  } catch (e) {
    if (e instanceof Undetermined) throw e
    throw new Undetermined(`载入 v4 引擎失败:${String(e.message).split('\n')[0].slice(0, 160)}`)
  }
  if (typeof engine.compile !== 'function')
    throw new Undetermined(
      `tailwindcss@${tw.version} 不导出 compile() —— 不是 v4 的低层入口,拿它直出的清单与产物不同形`,
    )

  const loadStylesheet = async (id, base) => {
    const p =
      id === 'tailwindcss'
        ? join(tw.pkgDir, 'index.css')
        : id.startsWith('tailwindcss/')
          ? join(tw.pkgDir, id.slice('tailwindcss/'.length))
          : resolve(base || appDir, id)
    try {
      return { path: p, base: dirname(p), content: readFileSync(p, 'utf8') }
    } catch (e) {
      throw new Undetermined(`v4 参考层取样式入口失败:${id}(base=${base} → ${p}):${e.message}`)
    }
  }
  const head = `@config '${configPath.replace(/\\/g, '/')}';\n@import 'tailwindcss/theme.css';\n`
  const run = async (cssIn) => {
    const compiler = await engine.compile(cssIn, {
      base: join(appDir, 'src'),
      from: join(appDir, 'src', 'app.css'),
      loadStylesheet,
      loadModule: loaders.loadModule,
    })
    return compiler.build(candidates)
  }

  let css
  let themeOnly
  try {
    css = await run(`${head}@import 'tailwindcss/utilities.css';\n`)
    // 净 utilities 体积 = (theme + utilities) - theme,与 v3 的 `@tailwind utilities` 口径可比(C3 用它做算术)
    themeOnly = await run(head)
  } catch (e) {
    if (e instanceof Undetermined) throw e
    throw new Undetermined(
      `v4 utilities 参考层直出失败:${String(e.message).split('\n')[0].slice(0, 200)}`,
    )
  }
  const decls = harvestClassDeclarations(css)
  if (decls.size === 0)
    throw new Undetermined('v4 参考层产出 0 个类名 —— 输入不成立,不得拿它当分母')
  const total = Buffer.byteLength(css, 'utf8')
  const utilitiesBytes = total - Buffer.byteLength(themeOnly, 'utf8')
  return {
    names: new Set(decls.keys()),
    // 参考层里"以裸类规则产出"的子集(2026-09-25):names 减去这一集 = 只有复合形态的名字
    // (space-x / space-y / divide-x / divide-y 一族)。C1 的第三态由这个形状决定,而不是靠类名前缀猜哪族是复合的。
    // 复用 harvestLandedSelectors(同一把 isBareUtilitySelector 判据),不写第二份形状规则。
    bareNames: harvestLandedSelectors(css),
    decls,
    bytes: utilitiesBytes > 0 ? utilitiesBytes : total,
    bytesIsNetUtilities: utilitiesBytes > 0,
    tailwindVersion: tw.version,
    engine: 'v4',
    resolvedVia: `tailwindcss@${tw.version} ← ${tw.anchor};loadModule ← ${loaders.via}`,
    candidateKinds: candidates.length,
  }
}

/**
 * **v3 档参考层**(现只作为 `--legacy-reference-v3` 的人工对比档存在)。
 * 用**端内真配置**直出 utilities,得到"这份配置下到底会产出哪些 utility"。
 * 之所以必须问生成器而不是靠命名文法猜:`text-card` 之类既是 Tailwind 的 `text-<色档>`
 * 又是端内自有类名,只有生成器能判定它是不是真候选。
 *
 * 三条实现约束(都是实测踩出来的):
 *  1. **显式传配置绝对路径,不传 `{}`**。传 `{}` 时 tailwind v3 的 `resolveConfigPath` 因
 *     `isEmpty({})` 落到"按 process.cwd() 自动发现配置文件"那一支,参考集会随调用方 cwd 漂移
 *     (实测同一份 `{}` 在两个 cwd 下分别是 48,608 B / 1 B)。
 *  2. 用 createRequire 从**端目录**解析 —— 仓里同时装了 tailwind v3 与 v4,根目录解析到 v4,
 *     拿错版本参考层会整个变形。
 *  3. 跑不起来 ⇒ 抛 Undetermined ⇒ exit 2。**绝不退回"命名文法猜"再假装是同一个指标**。
 */
export async function buildUtilityReference(appDir) {
  const req = createRequire(join(appDir, 'noop.js'))
  let tailwindPath
  try {
    tailwindPath = req.resolve('tailwindcss')
  } catch (e) {
    throw new Undetermined(`端内解析不到 tailwindcss(${appDir}):${e.message}`)
  }
  let postcss
  let tailwindcss
  try {
    postcss = createRequire(tailwindPath)(createRequire(tailwindPath).resolve('postcss'))
    tailwindcss = req('tailwindcss')
  } catch (e) {
    throw new Undetermined(`tailwindcss/postcss 加载失败:${e.message}`)
  }
  const configPath = join(appDir, 'tailwind.config.ts')
  if (!existsSync(configPath)) throw new Undetermined(`端内没有 tailwind.config.ts:${configPath}`)

  const cwdBefore = process.cwd()
  try {
    process.chdir(appDir)
  } catch (e) {
    throw new Undetermined(`无法切到端目录做参考层直出:${e.message}`)
  }
  let css
  try {
    // tailwind v3 的 postcss 插件是**异步插件**,`LazyResult.toString()` 会直接抛
    // "Use process(css).then(cb) to work with async plugins"(建门时实测)。
    // 所以这里必须 await,不能同步求值 —— 本门因此整体是 async。
    const res = await postcss([tailwindcss(configPath)]).process('@tailwind utilities;\n', {
      from: join(appDir, 'src/app.css'),
      to: join(appDir, 'src/app.css'),
    })
    css = res.css
  } catch (e) {
    throw new Undetermined(`utilities 参考层直出失败:${e.message}`)
  } finally {
    process.chdir(cwdBefore)
  }
  const decls = harvestClassDeclarations(css)
  let version = 'unknown'
  try {
    version = req('tailwindcss/package.json').version
  } catch {
    /* 版本只是报告用,拿不到不改判定 */
  }
  return {
    names: new Set(decls.keys()),
    // 与 v4 档同形:裸类产出子集(人工对比档也走同一分流,不留第二套语义)
    bareNames: harvestLandedSelectors(css),
    decls,
    bytes: Buffer.byteLength(css, 'utf8'),
    tailwindVersion: version,
    engine: majorOf(version) === 'v3' ? 'v3' : majorOf(version),
    resolvedVia: `tailwindcss@${version} ← ${appDir}`,
    candidateKinds: null,
  }
}

/* ───────────────────────── 同名双义(C2) ───────────────────────── */

const LIGHT_LITERAL =
  /#fff\b|#ffffff|\bwhite\b|rgb\(\s*255\s*,\s*255\s*,\s*255\s*[,)]|rgba\(\s*255\s*,\s*255\s*,\s*255\s*,|hsla?\([^)]*100%\s*,\s*100%\s*,\s*100%\s*[,/)]/i
/** 本项目语义色板里恒为浅色的那一档(明暗两态取值相同,故可无条件判浅) */
const LIGHT_TOKEN =
  /var\(--color-(card|background|popover|float-indicator-bg|cta-foreground|primary-foreground|danger-foreground|success-foreground|info-foreground|warning-foreground)\b/i

function looksLight(value) {
  return LIGHT_LITERAL.test(value) || LIGHT_TOKEN.test(value)
}
function valuesFor(decls, propRe) {
  return decls.filter((d) => propRe.test(d)).map((d) => d.replace(/^[^:]+:/, ''))
}

/**
 * 分类三档,**每档处置动作不同,所以必须各有一正一反例钉住**:
 *  - white-on-white:utility 出浅色 color,自有类出浅色 background 且自己不设 color
 *    ⇒ 开启 utilities 后该元素直接白底白字。属观感事故,不是"样式没生效"。
 *  - color-overlap:两侧都设 color ⇒ 谁赢取决于样式表先后。现状自有规则在后所以自有赢,
 *    但这是"顺序对了才没事"那一类,不留证据就没人知道。
 *  - coexist:两侧属性不相交 ⇒ 同名但各管各的,仍是双义债。
 */
export function classifyDualMeaning(utilDecls, ownDecls) {
  const utilColors = valuesFor(utilDecls, /^color\s*:/)
  const ownColors = valuesFor(ownDecls, /^color\s*:/)
  const ownBgs = valuesFor(ownDecls, /^background(-color)?\s*:/)
  if (
    utilColors.some((v) => looksLight(v)) &&
    ownBgs.length &&
    ownBgs.some((v) => looksLight(v)) &&
    !ownColors.length
  )
    return 'white-on-white'
  if (utilColors.length && ownColors.length) return 'color-overlap'
  return 'coexist'
}

/** 类名的命名空间前缀 = 最后一个连字符之前的部分;只有一段时即整名。 */
export function namespacePrefix(name) {
  const i = name.lastIndexOf('-')
  return i <= 0 ? name : name.slice(0, i)
}

/**
 * C2 盲区:在**所判源码面**上确实用了、且端内自有 CSS 同名定义了,但不在参考层里的类名。
 * 参考层只能判磁盘,所以盘上一改名,HEAD 仍在用的那个名字就掉出参考层 —— C2 会安静少报。
 * 把"够不到"显式列出来,才不会被读成"没有双义"。
 *
 * **只收落在 Tailwind 命名空间里的**:端内 2,143 个自有类名绝大多数(`action-btn`、
 * `agent-avatar`…)前缀下没有任何 Tailwind 规则,结构上不可能是候选;全算成盲区会报出
 * 1,500+ 条并把真那一条(`text-card`)埋掉 —— 报数报到没人看,等于没报。
 */
export function findBlindSpots(usedAndOwnClassed, referenceNames) {
  const prefixes = new Set([...referenceNames].map(namespacePrefix))
  return [...new Set(usedAndOwnClassed)]
    .filter((n) => !referenceNames.has(n) && prefixes.has(namespacePrefix(n)))
    .sort()
}

/**
 * 「CSS 侧只有转写名、没有原名」那一集的**唯一取法**(2026-09-26 立)。
 * 它同时是 C4 三态的输入与 C5 的面 1,所以只能有一份实现:两处各写一遍谓词必然漂移,
 * 而漂移的表现是"C4 与 C5 对同一份产物给出两个不同的转写需求数"—— 那正是本仓反复记的那一型。
 * 隐含性质:`mangle(n) !== n` ⇒ 集内每个名字至少含一个表内标点(见 `findMangledSightings` 头注)。
 */
export function mangledOnlyNames(usedTokenNames, referenceNames, landedNames) {
  return [...new Set([...usedTokenNames].filter((n) => referenceNames.has(n)))].filter(
    (n) => !landedNames.has(n) && landedNames.has(weappMangleClassName(n)),
  )
}

/**
 * C4 运行时可达性的**三态分流**(纯函数,可用构造面证明)。
 *  - `byToken`   —— class/className 紧邻字面量抽取得到 ⇒ 可达(第 1 态)
 *  - `bySighting`—— 抽取看不见、全文子串搜索目击到 ⇒ 可达(第 2 态,拼接 class 那一型)
 *  - `dead`      —— 两侧都看不见 ⇒ 死规则(第 3 态,不进 hitKinds/pct)
 * `sightedNames = null` = 没量全文维 ⇒ 退回两态旧口径(dead = 抽取看不见的那批),
 * 与三态改造前逐字一致(镜像测试与 `--self-test` 各钉一次这条向后对照)。
 * ⚠ 两把集合的**键形不同**,这是本函数唯一容易用错的地方:`runtimeTokens` 装的是**转写名**
 * (产物 class 语料原样),`sightedNames` 装的是**源名**(`findMangledSightings` 的返回就是源名集,
 * 转写在它内部做)。调用方把转写名喂进 `sightedNames` 不会报错,只会安静地产出"全都判 dead"——
 * 那条误用由 `--self-test` P64 钉住(它同时也是一条形状锁:sighted 集按源名索引)。
 */
export function partitionRuntimeReachability(names, runtimeTokens, sightedNames = null) {
  const byToken = []
  const bySighting = []
  const dead = []
  for (const n of names) {
    const m = weappMangleClassName(n)
    if (runtimeTokens instanceof Set && runtimeTokens.has(m)) byToken.push(n)
    else if (sightedNames instanceof Set && sightedNames.has(n)) bySighting.push(n)
    else dead.push(n)
  }
  return { byToken, bySighting, dead }
}

/**
 * C5 结构性判据(纯函数):本轮 JS/WXML 转写腿是不是**整轮空转**。
 *
 * 为什么不能用 pct 代替:pct 是量级读数 —— 腿整轮没跑只是让它变小,而观测档
 * (`--min-coverage 0`)下 pct 根本不判红,于是"没有任何一条判据能在腿没跑时必然翻红"。
 * 本函数只看两件事:**有没有转写需求**、**需求里的转写名在运行时全文出现过没有**。
 *  - 面 1 > 0 ∧ 面 2 == 0 ⇒ `idle`(必红):CSS 全是转写名,运行时一次都没出现过 ⇒ 腿没跑;
 *  - 面 1 == 0            ⇒ `undetermined`:无可观测需求 = 判不出,**绝不记为通过**
 *                            ("空扫报绿"是本仓最高频失效型,宁要未判定);
 *  - 其余                  ⇒ `in`。
 * **部分偏跳不在本判据内**(今测那种只有若干条没转写的形态):面 2 > 0 就判 `in`,
 * 具体是谁没挂上由 C4 逐条计数 —— 两维职责不互吞,否则 C5 会变成一个"数量阈值门",
 * 而阈值一旦落地,就又会有人为消红去调它。
 */
export function auditMangleLeg({ demandKinds, sightingKinds, sampleNames = [] }) {
  if (!Number.isFinite(demandKinds) || !Number.isFinite(sightingKinds))
    return {
      verdict: 'undetermined',
      reason: '面 1/面 2 没量到,不得据以判定转写腿是否空转',
      demandKinds: demandKinds ?? null,
      sightingKinds: sightingKinds ?? null,
      sampleNames: [],
    }
  if (demandKinds === 0)
    return {
      verdict: 'undetermined',
      reason: '本轮无可观测转写需求(面 1 = 0)⇒ 这一维判不出,不得记为通过',
      demandKinds,
      sightingKinds,
      sampleNames: [],
    }
  if (sightingKinds === 0)
    return {
      verdict: 'idle',
      reason: `本轮 JS/WXML 转写腿空转:面 1 有 ${demandKinds} 类"wxss 里只有转写名"的需求,而面 2 在产物 js/wxml/wxs 全文里一次都没搜到任何转写名 ⇒ 这些规则谁也挂不上`,
      demandKinds,
      sightingKinds,
      sampleNames: sampleNames.slice(0, MISSING_SAMPLES),
    }
  return { verdict: 'in', reason: '', demandKinds, sightingKinds, sampleNames: [] }
}

/**
 * C1 的算术,**刻意做成纯函数**:覆盖率是本门唯一判红的量。若只能在"真仓 + 真跑 tailwind"
 * 下观察它,镜像测试就证明不了它"该红时红、该绿时绿"(§22c:形状判据只能用纯函数 + 构造面证明)。
 * 分母只算 `源码用到 ∩ 参考层` —— 参考层外的名字(端内自有语义类)结构上不可能产出,
 * 纳进分母等于把覆盖率永远压低,造出一把恒红的尺子。
 *
 * 命中判据(2026-09-25 收紧,见文件头 C1 条目):产物里的类名被 weapp-tailwindcss 按
 * WEAPP_CLASS_MANGLE_TABLE 转写过,只比原名会把所有含标点的档误判成没落地。现命中 =
 * `landed.has(n) || landed.has(weappMangleClassName(n))`,且**两态分开计数**
 * (hitOriginalKinds / hitMangledKinds):合计会把"表漏一条"藏起来,分两态才看得见来源。
 * 缺项里含表外标点的归 unmangledPunctMisses(只报数、不并入 hit、列出待验字符);
 * 样例与归族只统计 definite misses —— 保住"整族缺失"那个真信号的可读性。
 *
 * 第三态(2026-09-25 补形状盲区):v4 有一族 utility(space-x / space-y / divide-x / divide-y)
 * **从不产出裸类规则**,只以复合选择器出现(真产物实测 `.space-x-2>view+view,…`)。裸类判据把它们
 * 整族误判"没落地"。修法不是放松,而是**由参考层自己的产出形状决定产物该长成什么样**:调用方多喂
 * 两个集合 —— `referenceBareNames`(参考层里以裸类规则产出的子集)与 `compoundLeadNames`(dist 里
 * 复合选择器的首族类名)。对"参考层就只有复合形态"的名字,产物侧要求**首族**命中(单列
 * hitCompoundKinds);`.card-list .space-x-2{}` 这类后代手写提及仍判缺 —— 那是原 bug 的锁。
 * 两个新参缺一即不开启第三态,行为与三参旧调用逐字一致。
 *
 * 第四态(2026-09-26 C4 修口):第六参 `runtimeTokens` 把可达性判据从"CSS 有规则"收紧成
 * "运行时挂得上",第七参 `sightedNames` 再补上**抽取器看不见、全文搜索看得见**的那一档 ——
 * 少了它,拼接 class(`.concat(cond?"font-bold border-_blength_c14rpx_B":"")`)会被虚报成死规则。
 * 可达性两档(token 抽取 / 全文目击)**分开计数**,与两态同理:合计会把"抽取器漏一整型"藏起来。
 */
export function computeCoverage(
  usedTokenNames,
  referenceNames,
  landedNames,
  referenceBareNames = null,
  compoundLeadNames = null,
  runtimeTokens = null,
  sightedNames = null,
) {
  // ⚠ 必须**先物化**再用:`runCheck` 传进来的是 `Map#keys()` 迭代器,只能消费一次。
  // 旧写法在 `demanded` 里 `[...usedTokenNames]` 抽干之后,又把同一个已耗尽的迭代器交给
  // `mangledOnlyNames` ⇒ 面 1 恒为 0、489 条转写档被整批误判成"确定缺失",
  // 而 C5 因"面 1 = 0"退成"未判定"—— 一个耗尽的迭代器同时伪装成"没需求"和"没死规则"两种健康读数。
  // 这条由 `--self-test` 的"迭代器输入必须与数组输入同读数"那例钉死。
  const usedArr = [...usedTokenNames]
  const demanded = [...new Set(usedArr.filter((n) => referenceNames.has(n)))]
  const hitOriginal = demanded.filter((n) => landedNames.has(n))
  const mangledOnly = mangledOnlyNames(usedArr, referenceNames, landedNames)
  // 运行时维没量到 ⇒ 退回旧口径(全部算可达),报告必须写明"死规则一维未判定",不得静默当 0
  const { byToken, bySighting, dead } =
    runtimeTokens instanceof Set
      ? partitionRuntimeReachability(mangledOnly, runtimeTokens, sightedNames)
      : { byToken: mangledOnly, bySighting: [], dead: [] }
  const hitRenamed = byToken
  const hitSighted = bySighting
  const deadRule = dead
  const notBareHit = demanded.filter((n) => !hitOriginal.includes(n) && !mangledOnly.includes(n))
  const compoundMode = referenceBareNames instanceof Set && compoundLeadNames instanceof Set
  const hitCompound = compoundMode
    ? notBareHit.filter(
        (n) =>
          !referenceBareNames.has(n) &&
          (compoundLeadNames.has(n) || compoundLeadNames.has(weappMangleClassName(n))),
      )
    : []
  const hitCompoundSet = new Set(hitCompound)
  const miss = notBareHit.filter((n) => !hitCompoundSet.has(n))
  const unmangled = miss.filter((n) => unmappedPunctIn(n).length > 0)
  const definite = miss.filter((n) => unmappedPunctIn(n).length === 0)
  const unmangledPunctChars = [...new Set(unmangled.flatMap((n) => unmappedPunctIn(n)))].sort()
  const fam = new Map()
  for (const n of definite) fam.set(missFamily(n), (fam.get(missFamily(n)) || 0) + 1)
  const missFamilies = [...fam.entries()]
    .map(([family, count]) => ({ family, count }))
    .sort((a, b) => b.count - a.count || a.family.localeCompare(b.family))
  return {
    demandedKinds: demanded.length,
    // 死规则**不进** hitKinds/pct —— 它产出了 CSS 却没有任何元素会挂上那个名字,对用户等于没生效。
    hitKinds: hitOriginal.length + hitRenamed.length + hitSighted.length + hitCompound.length,
    hitOriginalKinds: hitOriginal.length,
    hitMangledKinds: hitRenamed.length,
    // 第 2 态:抽取器看不见、全文子串搜索目击得到的那批(拼接 class / 三元参数那一型)。
    // 没量全文维时为 0,与 C4 修口前的读数逐字相同(向后对照由 --self-test P68 钉住)。
    hitSightedKinds: hitSighted.length,
    hitCompoundKinds: hitCompound.length,
    deadRuleKinds: deadRule.length,
    deadRuleSamples: deadRule.sort().slice(0, MISSING_SAMPLES),
    /**
     * 全量死规则名单(数据,不是判据)。留这一格的理由:样例只给 5 条,而"剩下 26 条是什么"
     * 恰好是要回答"为什么运行时侧没被改名"的那个人唯一缺的输入 —— 没有它,他只能重跑一遍构建
     * 或改门代码;而门输出的 `--min-coverage 0` 逃生舱只让它不判红,不告诉他差集在哪。
     */
    deadRuleKindsList: deadRule.sort(),
    // 运行时类名语料是否量到过:没量到 ⇒ dead 维恒为 0,报告必须写明这一格是"未判定"而不是"没有死规则"
    runtimeFaceJudged: runtimeTokens instanceof Set,
    // 全文目击维是否量到过:没量到 ⇒ 第 2 态恒 0,报告得说"三态里少一态",不得读成"没有拼接 class"
    runtimeSightJudged: sightedNames instanceof Set,
    // C5 的面 1 从这里出(单一源):"CSS 侧只有转写名"的全部需求数 = 可达两态 + 死规则
    mangleDemandKinds: mangledOnly.length,
    missKinds: miss.length,
    definiteMissKinds: definite.length,
    unmangledPunctMisses: unmangled.length,
    unmangledPunctChars,
    pct:
      demanded.length === 0
        ? 1
        : (hitOriginal.length + hitRenamed.length + hitSighted.length + hitCompound.length) /
          demanded.length,
    missOccurrences: 0,
    referenceKinds: referenceNames.size,
    landedRuleKinds: landedNames.size,
    // miss 的**名字全集**随结果返回:runCheck 的 missOccurrences 直接吃它,不再原地重写第二份谓词
    // (谓词两处各写一遍必然漂移 —— 本票出第三态后旧的双写连"miss 定义"本身都不同形了)。
    missNames: miss,
    missingSamples: definite.sort().slice(0, MISSING_SAMPLES),
    missFamilies,
  }
}

/* ───────────────────────── 源码取材面(经 scripts/lib/face-reader.mjs) ───────────────────────── */

/** 清单与内容必须同一个面(否则"glob 读盘 + 内容读 git"会造出基准错位的假绿尺子)。 */
function listSourceFiles(root, face) {
  if (face === 'worktree') {
    return walkFiles(join(root, SRC_PREFIX))
      .map((p) => relative(root, p).split(sep).join('/'))
      .sort()
  }
  const args =
    face === 'staged'
      ? ['ls-files', '--full-name', '-z', '--', SRC_PREFIX]
      : ['ls-tree', '-r', '--name-only', 'HEAD', '-z', '--', SRC_PREFIX]
  const list = gitRaw(args, root, { timeout: 60000 }).split('\0').filter(Boolean)
  if (list.length === 0)
    throw new Undetermined(`${face} 面在 ${SRC_PREFIX} 下列出 0 个文件,无法判定`)
  return list
}

/**
 * 一轮把该面**全部**内容读回来(一次 `cat-file --batch`,不是每文件一次 `git show` ——
 * 539 个逐文件派生是 §5b 记过的 fork 风暴同型)。取不到的路径值为 null,
 * 由调用方按"少扫多少个"如实计数,不静默。
 */
function prefetchSource(root, face, paths) {
  const map = new Map()
  if (paths.length === 0) return map
  if (face === 'worktree') {
    for (const rel of paths) map.set(rel, readWorktreeFile(root, rel))
    return map
  }
  const rev = face === 'staged' ? '' : 'HEAD'
  const specs = paths.map((p) => `${rev}:${p}`)
  const got = catBatch(root, specs, { timeout: 120000 })
  paths.forEach((p, i) => {
    const t = got.get(specs[i]) ?? null
    map.set(p, t !== null && t.includes('\u0000') ? null : t)
  })
  return map
}

/* ───────────────────────── 主流程 ───────────────────────── */

export async function runCheck(opts) {
  const root = opts.root
  const { face, error } = selectFace({ staged: opts.staged, worktree: opts.worktree, def: 'head' })
  if (error) return { exit: 2, face: null, undetermined: [error], failing: [], dual: [] }

  const undetermined = []
  const notices = []
  const appDir = join(root, APP_REL)
  let tsFiles = []
  let cssFiles = []
  try {
    const all = listSourceFiles(root, face)
    tsFiles = all.filter((p) => /\.(tsx|ts)$/.test(p) && !p.endsWith('.d.ts'))
    cssFiles = all.filter((p) => p.endsWith('.css'))
  } catch (e) {
    if (!(e instanceof Undetermined)) throw e
    undetermined.push(`源码清单判不出:${e.message}`)
  }

  const usedTokens = new Map()
  const own = new Map()
  let unreadable = 0
  // 一轮批量取回该面全部内容(一次 cat-file --batch / 一次磁盘枚举),清单与内容同面同轮。
  const srcTexts = prefetchSource(root, face, [...tsFiles, ...cssFiles])
  for (const rel of tsFiles) {
    const t = srcTexts.get(rel) ?? null
    if (t === null) {
      unreadable++
      continue
    }
    for (const tok of harvestClassNameTokens(t)) usedTokens.set(tok, (usedTokens.get(tok) || 0) + 1)
  }
  for (const rel of cssFiles) {
    const t = srcTexts.get(rel) ?? null
    if (t === null) {
      unreadable++
      continue
    }
    for (const [name, decls] of harvestClassDeclarations(t)) {
      if (!own.has(name)) own.set(name, { decls: [], files: new Set() })
      const bag = own.get(name)
      for (const d of decls) if (!bag.decls.includes(d)) bag.decls.push(d)
      bag.files.add(rel.slice(SRC_PREFIX.length))
    }
  }
  if (unreadable)
    undetermined.push(`${face} 面有 ${unreadable} 个源码文件取不到内容(计入"少扫",不静默)`)
  // 单一物化点:Map#keys() 是**一次性迭代器**,消费一次即耗尽。下游 C1/C2/C4/C5 共用这一份数组,
  // 否则第二个消费者拿到空序列 —— 那会把"没需求"和"没死规则"两种健康读数一起伪造出来。
  const usedTokenList = [...usedTokens.keys()]

  /* ---- 产物面(先判,因为参考层要跟它同引擎) ---- */
  const distDir = join(appDir, opts.distDirname || 'dist')
  const shape = classifyDist(distDir)
  let landed = null
  let compoundLeads = null
  if (shape.kind === 'weapp') {
    try {
      const got = collectLandedFromDist(distDir)
      landed = got.landed
      compoundLeads = got.compoundLeads
    } catch (e) {
      if (!(e instanceof Undetermined)) throw e
      undetermined.push(`产物内容判不出:${e.message}`)
    }
  } else {
    undetermined.push(`产物面无法判定(${shape.kind}):${shape.reason}`)
  }
  let productEngine = null
  try {
    productEngine = detectProductTailwindMajor(distDir)
  } catch (e) {
    if (e instanceof Undetermined) undetermined.push(`产物引擎判不出:${e.message}`)
    else throw e
  }

  /* ---- utility 参考层:引擎由产物决定、取材面由 planReferenceFace 决定;做不到同引擎/同面就弃权 ---- */
  let referenceFace = null
  let reference = null
  let referenceJudged = true
  const wanted = opts.skipReference
    ? 'skip'
    : opts.legacyReferenceV3
      ? 'v3'
      : opts.referenceEngine || 'auto'
  const picked = opts.skipReference
    ? { engine: null, explicit: false, reason: '--skip-reference' }
    : pickReferenceEngine({ productMajor: productEngine?.major || null, requested: wanted })
  const facePlan = picked.engine
    ? planReferenceFace({ face, engine: picked.engine, explicit: picked.explicit })
    : { action: 'abstain', judged: false, sameFace: false, reason: '' }
  if (opts.skipReference) {
    undetermined.push(
      '--skip-reference:无 utility 全集 ⇒ C1 覆盖率与 C2 双义结构上判不出,只报产物规则总数',
    )
  } else if (!picked.engine) {
    // 同引擎不可得 ⇒ **不出覆盖率数字**。报一个错引擎的百分比,比报"判不出"危害大得多:
    // 前者会让人照着它决策(开链/收口),后者只会让人去查原因。
    undetermined.push(`参考层引擎无法确定:${picked.reason}`)
  } else if (facePlan.action === 'abstain') {
    // 同面不可得 ⇒ 同样弃权。此前这一格只挂一条"两把不同面"的 notice 就照常判红 ——
    // 基准错位的自洽读数比"判不出"更危险(守门 77/83/101 各记过一次同型)。
    undetermined.push(`参考层与源码面不同面:${facePlan.reason}`)
  } else {
    try {
      reference =
        picked.engine === 'v4'
          ? await buildUtilityReferenceV4({ root, appDir, candidates: [...usedTokenList] })
          : await buildUtilityReference(appDir)
      referenceFace =
        picked.engine === 'v4'
          ? `${face}(显式候选 ${reference.candidateKinds} 个,与源码同面)`
          : `${face}(生成器读 content globs;仅 worktree 面下同面)`
      referenceJudged = facePlan.judged
      if (!facePlan.judged) notices.push(facePlan.reason)
    } catch (e) {
      if (!(e instanceof Undetermined)) throw e
      reference = null
      referenceFace = null
      undetermined.push(`utility 参考层判不出(${picked.engine} 档):${e.message}`)
    }
  }
  // 参考层与产物不同引擎:默认档结构上不会再出现这一步(picked 已按产物引擎选),
  // 只有人工指定(--legacy-reference-v3 / --reference-engine)才可能不匹配。
  // 不匹配时 **C1 不计红**,只作为对比读数输出。
  const refMajor = reference ? majorOf(reference.tailwindVersion) : null
  const engineMismatch =
    !!reference &&
    !!productEngine &&
    productEngine.major !== 'unknown' &&
    refMajor !== productEngine.major
  if (reference && !picked.explicit && engineMismatch) {
    // 兜底:万一将来又允许 auto 走出不同引擎的分支,这里必须弃权而不是报数。
    reference = null
    referenceFace = null
    undetermined.push('参考层引擎与产物引擎不一致(auto 档 ⇒ 弃权,不出覆盖率)')
  }
  // 盲区 = 「HEAD/索引这一面确实用了、且端内自有 CSS 同名定义了、但参考层里没有」的名字。
  // 它们**结构上无法被 C2 分类**,所以必须报出来 —— 只因为参考层看不见就当没有,
  // 等于把"判据够不到"洗成"没有双义"。立因当天漏掉的正是 white-on-white 那一型。
  const blindSpots = reference
    ? findBlindSpots(
        [...usedTokenList].filter((n) => own.has(n)),
        reference.names,
      )
    : []
  if (blindSpots.length) {
    notices.push(
      `C2 盲区 ${blindSpots.length} 个:这些类名在 ${face} 面确实用了且自有 CSS 同名定义了,但不在参考层里 ⇒ 无法判它是否 Tailwind 候选(样例 ${blindSpots.slice(0, MISSING_SAMPLES).join(', ')})。逐个自查,不得当作零双义`,
    )
  }
  // 反向盲区 = 「产物真出了规则、源码确实用了、参考层却不认」的名字。
  // 这一维直接量的是**分母有没有在藏东西**:参考层漏认一个真 utility,
  // 症状恰恰是"覆盖率变好看"。必须报出来,不能静默。
  // 与 C2 盲区同一道过滤:**只落在 Tailwind 命名空间里** —— 端内自有类(login-btn、
  // action-btn…)前缀下没有任何 utility,结构上不可能是候选,全算进来就是 1,501 条噪声
  // (实测不过滤时正是这个数,会把真该看的那几条埋掉 —— 报数报到没人看,等于没报)。
  const referenceBlindSpots =
    reference && landed
      ? findBlindSpots(
          [...usedTokenList].filter((n) => landed.has(n)),
          reference.names,
        )
      : []
  if (referenceBlindSpots.length) {
    notices.push(
      `参考层反向盲区 ${referenceBlindSpots.length} 个:产物里有规则、${face} 面确实用了、且落在 Tailwind 命名空间里,但参考层不认它 ⇒ 它不进 C1 分母,覆盖率因此**偏高**(样例 ${referenceBlindSpots.slice(0, MISSING_SAMPLES).join(', ')})。逐条查参考层的输入是不是还缺了构建那边的某一样(缺 theme / 缺 config / 候选没喂到),不得当成"本来就没这条规则"`,
    )
  }

  let budget = null
  try {
    budget = measureMainPackage(distDir)
  } catch (e) {
    if (!(e instanceof Undetermined)) throw e
    undetermined.push(`C3 主包体积判不出:${e.message}`)
  }
  /* ---- C3 的硬红线:主包超上限就是"传不上去",不是"覆盖率高低的偏好阈值" ----
     立项实测:我给一份健康产物塞进 60KB 把余量 27KB 打穿(主包 2,129,951 > 上限 2,097,152),
     门照常报 `结论:exit 0 —— 通过`。而构建末端现在挂了这道门 —— 它放过一枚"根本无法上传"的产物,
     等于给"构建即验收"这个承诺作假证。
     刻意放进 failingC5(不受 `--min-coverage` 管辖):超上限是平台硬事实,与覆盖率阈值无关,
     任何观测档都不该把它读成通过。 */
  const failingBudget = []
  if (budget && typeof budget.headroomBytes === 'number' && budget.headroomBytes < 0)
    failingBudget.push(
      `C3 主包超微信硬上限 ${-budget.headroomBytes} B(${budget.mainBytes} > ${budget.limitBytes})⇒ 该产物无法上传,不是体积偏大`,
    )

  /* ---- C1 落地覆盖率 ---- */
  let coverage = null
  let missingSamples = []
  // C5 的红在 C1 段里算,但要合进下面统一的 `failing` —— 先单独收着,免得看起来像被 minCoverage 管着
  const failingC5 = []
  let mangleLeg = {
    verdict: 'undetermined',
    reason: 'C1 未能判定(无参考层或无产物规则集)⇒ 面 1 无从谈起',
    demandKinds: null,
    sightingKinds: null,
    sampleNames: [],
  }
  let cssLeg = { verdict: 'undetermined', reason: 'C1 未能判定 ⇒ CSS 腿见证无从取' }
  if (reference && landed) {
    // 第四/五参把"该按哪种产出形态验收"交给参考层自己的形状:
    // 裸产出档要求裸类规则;复合产出档(space-x / space-y / divide-x / divide-y 一族)只要求**首族**复合规则。
    // 第六/七参把**运行时**那一侧喂进来:weapp 只改了 CSS 侧的名字时,那条规则谁也挂不上 ⇒ 计死规则,不计命中;
    //   而"名字不在抽取器抽到的 class 字面量里"还不够 —— 拼接串里的类名抽取器结构上看不见,
    //   故再给一档"全文子串搜索目击得到"。运行时语料取不到 ⇒ 传 null ⇒ 相应一维**未判定**,报告必须喊出来。
    // **一次取材、两维共用同一份磁盘快照**:分两次读 dist,期间同端一次 `taro build` 就会把整目录
    // 换掉(立因当天本机就这样),那"token 维"与"全文维"量的就不是同一次构建 —— 两维结论必须同源。
    let runtime = null
    let runtimeSighted = null
    try {
      runtime = collectRuntimeFace(distDir)
      if (runtime.unreadable)
        notices.push(
          `运行时类名面有 ${runtime.unreadable}/${runtime.files} 个文件读不到(计入"少扫",不静默)`,
        )
    } catch (e) {
      if (!(e instanceof Undetermined)) throw e
      undetermined.push(`C4 运行时类名面判不出:${e.message} ⇒ 本轮"死规则"一维计未判定,不得当成 0`)
    }
    // 面 1 先算(与 computeCoverage 同一个 `mangledOnlyNames`,单一判据源);面 1 == 0 时**不去扫全文**:
    // 没有需求就没有可判的腿,硬扫一遍再报 0 会把"本轮无需求"与"腿没跑"混成同一个读数。
    const mangleDemand = mangledOnlyNames(usedTokenList, reference.names, landed)
    if (runtime && mangleDemand.length > 0)
      runtimeSighted = findMangledSightings(runtime.haystack, mangleDemand)
    coverage = computeCoverage(
      usedTokenList,
      reference.names,
      landed,
      reference.bareNames,
      compoundLeads,
      runtime ? runtime.tokens : null,
      runtimeSighted,
    )
    // C5:面 1 = coverage 给的那一份(单一源),面 2 = 上面那次全文搜索的命中数。
    // 没量到面 2 时 sightingKinds 传 NaN ⇒ auditMangleLeg 自己判"未判定",不冒红也不记绿。
    mangleLeg = auditMangleLeg({
      demandKinds: coverage.mangleDemandKinds,
      sightingKinds: runtimeSighted instanceof Set ? runtimeSighted.size : NaN,
      sampleNames: mangleDemand,
    })
    if (mangleLeg.verdict === 'idle')
      failingC5.push(`C5 ${mangleLeg.reason}(样例:${mangleLeg.sampleNames.join(' ')})`)
  
  /* ---- C6:weapp CSS 腿整条没跑(改名 + rem2rpx 都没生效)----
       立项实测:三连构建里最坏的那一档 C1 反而读到 99.35% / 死规则 0 / C5=in,
       因为 CSS 用转义选择器 `.z-\[1001\]` 与运行时源名字面相同 —— 名字对得上,平台却未必认。
       所以这一维必须独立存在:C1/C4/C5 结构上答不了"该不该看到这个名字"。 */
    let cssLegWitness = null
    try {
      cssLegWitness = { mangled: countMangledRuleKinds(landed) }
    } catch (e) {
      if (!(e instanceof Undetermined)) throw e
      undetermined.push(`C6 CSS 腿见证取不到:${e.message} ⇒ 这一维未判定,不记通过`)
    }
    if (cssLegWitness) {
      const arbitraryDemand = [...usedTokenList].filter((n) => weappMangleClassName(n) !== n).length
      cssLeg = auditCssLeg({
        mangledRuleKinds: cssLegWitness.mangled,
        arbitraryDemand,
      })
      cssLeg.arbitraryDemand = arbitraryDemand
      if (cssLeg.verdict === 'off') failingC5.push(`C6 ${cssLeg.reason}`)
    }
    // missOccurrences 与 computeCoverage 的 miss 集**共用同一份判据**(2026-09-25 收口):
    // 旧写法在这里原地重写第二份谓词,注释自己也警告"两处各写一遍必然漂移" ——
    // 第三态一出来它就真的漂了(复合首族命中的名字会被这行重新算成 miss)。现直接吃 missNames。
    coverage.missOccurrences = coverage.missNames.reduce((a, n) => a + (usedTokens.get(n) || 0), 0)
    missingSamples = coverage.missingSamples
    delete coverage.missingSamples
    delete coverage.missNames
  }

  /* ---- C2 同名双义 ---- */
  const dual = []
  if (reference) {
    for (const name of new Set([...usedTokenList].filter((n) => reference.names.has(n)))) {
      const o = own.get(name)
      if (!o) continue
      dual.push({
        name,
        kind: classifyDualMeaning(reference.decls.get(name) || [], o.decls),
        tailwind: reference.decls.get(name) || [],
        own: o.decls,
        ownFiles: [...o.files],
        usages: usedTokens.get(name) || 0,
      })
    }
  }
  const RANK = { 'white-on-white': 0, 'color-overlap': 1, coexist: 2 }
  dual.sort((a, b) => RANK[a.kind] - RANK[b.kind] || a.name.localeCompare(b.name))

  const minCoverage = opts.minCoverage ?? 1
  const failing = []
  // C1 只在"参考层与产物**同引擎**且与源码**同面**"时计红。人工对比档照样出数,
  // 但它是一句**读数**而不是一句**结论** —— 拿错引擎/错面的分母判红,和拿它判绿一样错。
  const c1Judged = !!coverage && !engineMismatch && referenceJudged
  if (!undetermined.length && c1Judged && coverage.pct < minCoverage) {
    failing.push(
      `C1 落地覆盖率 ${(coverage.pct * 100).toFixed(2)}%(${coverage.hitKinds}/${coverage.demandedKinds} 类、${coverage.missOccurrences} 处用法无规则)< 要求的 ${minCoverage * 100}%`,
    )
  }
  // C5 的红**不看 minCoverage、也不看 c1Judged**:它是结构性判据,而"观测档"(阈值调到 0)
  // 恰恰是最需要它的那一刻 —— 让阈值能免掉它,就等于又造一条"量级判据冒充结构判据"。
  failing.push(...failingC5)
  failing.push(...failingBudget)
  const exit = undetermined.length ? 2 : failing.length ? 1 : 0
  return {
    exit,
    face,
    distShape: shape.kind,
    wxssFiles: shape.wxssCount,
    tsFileCount: tsFiles.length,
    cssFileCount: cssFiles.length,
    usedTokenKinds: usedTokens.size,
    ownClassKinds: own.size,
    tailwindVersion: reference ? reference.tailwindVersion : null,
    referenceEngine: reference ? reference.engine : null,
    referenceResolvedVia: reference ? reference.resolvedVia : null,
    referenceRequested: wanted,
    c1Judged,
    productEngine,
    engineMismatch,
    referenceBytes: reference ? reference.bytes : null,
    referenceBytesIsNetUtilities: reference ? !!reference.bytesIsNetUtilities : null,
    referenceFace: reference ? referenceFace : null,
    coverage,
    mangleLeg,
    cssLeg,
    missingSamples,
    dual,
    blindSpots,
    referenceBlindSpots,
    budget,
    undetermined,
    notices,
    failing,
  }
}

/* ───────────────────────── 输出 ───────────────────────── */

function report(r, asJson) {
  if (asJson) {
    const jsonable = {
      ...r,
      dual: r.dual.map((d) => ({ ...d, ownFiles: d.ownFiles })),
      budget: r.budget,
    }
    process.stdout.write(JSON.stringify(jsonable, null, 1) + '\n')
    return
  }
  console.log(
    `取材面:单一判定面 = ${r.face || '(未判定)'}(源码与参考层同面取自它);产物事实 = 磁盘 —— dist 被 gitignore,不在任何 git 面上,不构成第二把判定尺`,
  )
  console.log(
    `源码:${r.tsFileCount} 个 .ts/.tsx、${r.cssFileCount} 个 .css;className token ${r.usedTokenKinds} 种、端内自有类名 ${r.ownClassKinds} 种`,
  )
  if (r.tailwindVersion)
    console.log(
      `参考层引擎 = ${r.referenceEngine || '?'} ${r.tailwindVersion}(请求档 ${r.referenceRequested})` +
        ` —— 解析:${r.referenceResolvedVia || '(未记)'}` +
        (r.referenceFace ? `;候选取材 = ${r.referenceFace}` : ''),
    )
  if (r.productEngine) {
    console.log(
      `tailwind(产物指纹)= ${r.productEngine.major || 'unknown'}` +
        `(v4 独有 ${r.productEngine.v4Hits}/${r.productEngine.v4Total}、v3 独有 ${r.productEngine.v3Hits}/${r.productEngine.v3Total};preflight ${r.productEngine.preflight ? '在' : '无'})`,
    )
  }
  console.log(`产物形态 = ${r.distShape},wxss ${r.wxssFiles} 个`)
  if (r.engineMismatch) {
    console.log(
      `⚠️ 引擎不一致 ⇒ 下面的"参考层"是**错引擎的清单**(人工指定档 ${r.referenceRequested} 才会走到这里;auto 档遇此情形直接判「无法判定」):` +
        `产物跑 ${r.productEngine.major},参考层由 ${r.tailwindVersion} 直出。` +
        `因此 C1 的"可选集"与 C3 的算术**都不构成"该不该开链"的依据**;要据此决策,去掉人工指定档重跑。`,
    )
  }

  if (r.coverage) {
    const c = r.coverage
    console.log(
      `C1 覆盖 ${c.hitKinds}/${c.demandedKinds} 类(${(c.pct * 100).toFixed(2)}%)` +
        ` —— 原名直中 ${c.hitOriginalKinds} + weapp 转写后中·token 抽取 ${c.hitMangledKinds}` +
        ` + weapp 转写后中·全文目击 ${c.hitSightedKinds} + 复合首族 ${c.hitCompoundKinds}` +
        `(四态分开计数,合计会把"漏判在哪一态"藏起来;第 3 态是拼接 class,见 C4 条目)` +
        (c.runtimeFaceJudged
          ? ` + C4 死规则 ${c.deadRuleKinds} 类(CSS 里有转写规则、运行时 token 抽取与全文子串两侧都看不见 ⇒ **谁也挂不上**,不计进命中;样例 ${c.deadRuleSamples.join(' ')})`
          : ' + C4 死规则:**未判定**(运行时类名语料没量到,不得把这格当成 0)') +
        (c.runtimeFaceJudged && !c.runtimeSightJudged
          ? ' 〔第 3 态未量(全文语料没取到)⇒ 本行的死规则读数是**两态口径**,对拼接 class 偏高,不得读成"这些都是真死规则"〕'
          : '') +
        ` —— utility 参考层共 ${c.referenceKinds} 个可选,产物规则名共 ${c.landedRuleKinds} 个` +
        (r.c1Judged ? '' : ' 〔对比档:参考层与产物不同引擎或与源码不同面,本行只是读数,不计红〕'),
    )
    if (c.missKinds) {
      console.log(`   缺失 ${c.missKinds} 类 / ${c.missOccurrences} 处用法`)
      if (c.unmangledPunctMisses) {
        console.log(
          `   其中 ${c.unmangledPunctMisses} 类含转写表外标点(待验字符:${c.unmangledPunctChars.join(' ')})` +
            ` ⇒ 只报数、不计红:判不出是"真没落地"还是"表缺一条转写",不得为消红去猜加表条目`,
        )
      }
      if (c.definiteMissKinds) {
        const top = c.missFamilies
          .slice(0, 5)
          .map((f) => `${f.family}(${f.count})`)
          .join(' ')
        console.log(
          `   确定缺失 ${c.definiteMissKinds} 类按族分布(共 ${c.missFamilies.length} 族,top5):${top}`,
        )
      }
      if (r.missingSamples.length)
        console.log(`   缺失样例(≤${MISSING_SAMPLES},只取确定缺失):${r.missingSamples.join(', ')}`)
    }
  } else {
    console.log('C1 覆盖:未判定(见下方「无法判定」)—— 拿不到同引擎的参考层就**不出覆盖率数字**')
  }

  /* ---- C5:转写腿的结构性对账(与 pct 无关,观测档 --min-coverage 0 照样判红) ---- */
  {
    const L = r.mangleLeg || {
      verdict: 'undetermined',
      demandKinds: null,
      sightingKinds: null,
      sampleNames: [],
    }
    if (L.verdict === 'idle')
      console.log(
        `❌ C5 本轮 JS/WXML 转写腿空转(结构性,不是量级):面 1「wxss 里只有转写名」的转写需求 ${L.demandKinds} 类,` +
          `而面 2 在产物 js/wxml/wxs 全文里一次都没搜到任何转写名 ⇒ 腿整轮没跑,这些规则谁也挂不上。样例(≤${MISSING_SAMPLES}):${L.sampleNames.join(' ')}`,
      )
    else if (L.verdict === 'in')
      console.log(
        `C5 转写腿:在 —— 面 1 ${L.demandKinds} 类转写需求中,面 2 全文子串搜索目击到 ${L.sightingKinds} 类` +
          `(整轮空转已被排除;个别偏跳由 C4 逐条计数,两维职责不互吞)`,
      )
    else
      console.log(
        `C5 转写腿:**未判定**${L.demandKinds === 0 ? '(本轮无可观测转写需求)' : ''}` +
          `${L.reason ? ` —— ${L.reason}` : ''};这一维**不计为通过**,与"腿在"是两回事`,
      )
    console.log(
      `C6 CSS 腿:${r.cssLeg.verdict} —— ` +
        (r.cssLeg.reason ||
          `含标点档 ${r.cssLeg.arbitraryDemand} 个,产物转写形态类名 ${r.cssLeg.mangledRuleKinds} 个 ⇒ 整条未跑已被排除`),
    )
  }

  console.log(`C2 同名双义:${r.dual.length} 条`)
  for (const d of r.dual) {
    console.log(`   - ${d.name} [${d.kind}] 源码用 ${d.usages} 处`)
    console.log(`       tailwind 会出: ${d.tailwind.join('; ')}`)
    console.log(`       端内已有    : ${d.own.join('; ')}  (${d.ownFiles.join(', ')})`)
  }

  if (r.budget) {
    const b = r.budget
    console.log(
      `C3 主包 ${b.mainBytes} B / 上限 ${b.limitBytes} B ⇒ 余量 ${b.headroomBytes} B` +
        `(按 app.json 的 ${b.subpackageRootCount} 个分包根剔除)`,
    )
    if (typeof r.referenceBytes === 'number') {
      console.log(
        `   utilities 参考层体积 = ${r.referenceBytes} B —— 链已开(2026-09-25 起,起效载体是 app.css 的 @source),` +
          `上方主包/余量是**含 utilities 落地量的实测现值**;旧的"若开启…装不装得下"假设算术不再成立(那组前置数实测方向是反的)。` +
          (r.referenceBytesIsNetUtilities === false
            ? ' 〔参考层含 theme 块,非纯 utilities 体积〕'
            : ''),
      )
    }
  }
  for (const u of r.undetermined) console.log(`⚠️ 无法判定:${u}`)
  for (const n of r.notices || []) console.log(`ℹ️ 如实报数(不计红):${n}`)
  for (const f of r.failing) console.log(`❌ ${f}`)
  console.log(
    `结论:exit ${r.exit} —— ${r.exit === 2 ? '未判定(既不记绿也不冒红)' : r.exit === 0 ? '通过' : '判红'}`,
  )
  console.log('注:本门当前为手动 / CI 门,未接进提交链(产物在提交者机器上结构上未必存在)。')
}

/* ───────────────── --self-test:纯判据成对正反例,零副作用 ───────── */

export function selfTest() {
  const results = []
  const eq = (label, got, want) => {
    const ok = JSON.stringify(got) === JSON.stringify(want)
    results.push({ label, ok, got: ok ? undefined : got, want: ok ? undefined : want })
  }
  const has = (label, set, v) => results.push({ label, ok: [...set].includes(v) })

  // token harvest
  eq(
    'P1 双引号 / 单引号 / 模板串三种形态都收',
    harvestClassNameTokens(
      `a className="flex p-3" b className='w-full' c className={\`text-sm\`} ${'x'}`,
    ).sort(),
    ['flex', 'p-3', 'text-sm', 'w-full'].sort(),
  )
  eq('P2 非 class 属性不得收', harvestClassNameTokens('href="flex items-center"'), [])

  // selector harvest
  eq(
    'P3 注释里的假规则不算定义',
    [...harvestClassDeclarations('/* .fake{color:red} */ .real{color:red}').keys()],
    ['real'],
  )
  eq('P4 多选择器共享规则体逐个收', [...harvestLandedSelectors('.a,.b{color:red}')], ['a', 'b'])
  eq('P5 无规则体的裸类名不算落地', [...harvestLandedSelectors('.only-parent .x')], [])
  eq('P6 转义类名反解', unescapeClassName('\\!visible'), '!visible')
  has(
    'P7 任意值类名可收',
    harvestLandedSelectors('.-right-\\[12rpx\\]{right:-12rpx}'),
    '-right-[12rpx]',
  )
  eq('P8 数字开头不算类名', [...harvestClassDeclarations('.2xl{a:b}').keys()], [])
  eq('P9 声明体确实带出来', harvestClassDeclarations('.flex{display:flex}').get('flex'), [
    'display:flex',
  ])
  eq(
    'P10 同名多规则的声明取并集',
    harvestClassDeclarations('.x{color:red}.x{padding:1px}').get('x'),
    ['color:red', 'padding:1px'],
  )

  // dist 形态判别 —— 把"工具失效"和"业务结论"分开的那道闸
  const base = mkTempDir('shape')
  try {
    eq('P11 不存在的 dist 判 absent', classifyDist(join(base, 'nope')).kind, 'absent')
    mkdirSync(join(base, 'h5'), { recursive: true })
    writeFileSync(join(base, 'h5', 'index.html'), '<html>')
    writeFileSync(join(base, 'h5', 'app.js'), '')
    eq(
      'P12 h5 覆盖必须判 wrong-platform(绝不当成 0% 覆盖)',
      classifyDist(join(base, 'h5')).kind,
      'wrong-platform',
    )
    const w = join(base, 'w')
    mkdirSync(join(w, 'pages'), { recursive: true })
    writeFileSync(join(w, 'app.wxss'), '@import "./a.wxss";')
    writeFileSync(join(w, 'a.wxss'), '.flex{display:flex}')
    writeFileSync(join(w, 'pages', 'i.wxml'), '<view/>')
    const s = classifyDist(w)
    eq('P13 weapp 判对并量到 wxss 数', [s.kind, s.wxssCount], ['weapp', 2])
    const partial = join(base, 'partial')
    mkdirSync(join(partial, 'pages'), { recursive: true })
    writeFileSync(join(partial, 'pages', 'x.wxml'), '')
    eq(
      'P14 有 wxml 无 wxss ⇒ 产物不完整,判 wrong-platform',
      classifyDist(partial).kind,
      'wrong-platform',
    )
    const { landed, wxssFiles } = collectLandedFromDist(w)
    eq('P15 落地集合可枚举', [wxssFiles, landed.has('flex')], [2, true])
    // P15b/P15c:裸类判据的四对正反例 —— 复合手写规则不得冒充 utility 落地(本门最大的一个洞)
    eq(
      'P15b 裸类/伪类算落地',
      ['a', 'b', 'c', 'd'].map((k) =>
        isBareUtilitySelector(
          { a: '.flex', b: '.hover\\:bg-primary:hover', c: '.text-2xl', d: '.-top-\\[2px\\]' }[k],
        ),
      ),
      [true, true, true, true],
    )
    eq(
      'P15c 复合/后代/双类不算落地',
      ['a', 'b', 'c', 'd'].map((k) =>
        isBareUtilitySelector(
          {
            a: '.vip-page .border-border',
            b: '.w-full.rounded-b-\\[30rpx\\]',
            c: '.a>.b',
            d: '.dark .flex',
          }[k],
        ),
      ),
      [false, false, false, false],
    )
    eq(
      'P15d 落地集合只收裸类(端到端:同一份 CSS 里两种写法并存)',
      (() => {
        const s = harvestLandedSelectors(
          '.vip-page .border-border{border-color:var(--vip-border)}\n.flex{display:flex}\n.w-full.rounded-x{width:100%}',
        )
        return [s.has('flex'), s.has('border-border'), s.has('w-full')]
      })(),
      [true, false, false],
    )
    eq(
      'P16 空目录 collect 必抛 Undetermined',
      throwsUndetermined(() => collectLandedFromDist(join(base, 'nope'))),
      true,
    )

    /* ---- P16b–P16k:v4「只产出复合选择器」那一族的第三态(2026-09-25 形状盲区) ----
       真产物实测 `.space-x-2>view+view,.space-x-2>view+text,…` —— 源名 space-x-2 确实落地,
       但**永远不会有** `.-space-x-2{}` 这条裸类规则。裸类判据独占命中口径时它整族隐身。
       方向不是放松:由参考层自己的产出形状决定产物该长成什么样(bareNames 分流),
       而且只认**首族** —— 「提到就算」正是本门立项要防的那一格,反向锁必须同笔写。 */
    const compoundOnly = new Set() // 参考层裸类子集为空 = 该名字在参考层就只有复合形态
    eq(
      'P16b 阳性:复合首族规则 ⇒ 记第三态,不进 miss',
      (() => {
        const leads = harvestCompoundLeadNames(
          '.space-x-2>view+view,.space-x-2>view+text{margin-right:8rpx}',
        )
        const c = computeCoverage(
          ['space-x-2'],
          new Set(['space-x-2']),
          new Set(),
          compoundOnly,
          leads,
        )
        return [c.hitCompoundKinds, c.hitKinds, c.missKinds, c.definiteMissKinds, c.pct]
      })(),
      [1, 1, 0, 0, 1],
    )
    eq(
      'P16c 反向锁(本票重点):后代手写提及**不算**首族,space-x-2 仍判缺',
      (() => {
        const leads = harvestCompoundLeadNames(
          '.card-list .space-x-2{margin:0}\n.text-muted{color:red}',
        )
        const c = computeCoverage(
          ['space-x-2'],
          new Set(['space-x-2']),
          new Set(),
          compoundOnly,
          leads,
        )
        return [leads.has('space-x-2'), c.hitCompoundKinds, c.missKinds, c.definiteMissKinds, c.pct]
      })(),
      [false, 0, 1, 1, 0],
    )
    eq(
      'P16d 端到端(真走 collectLandedFromDist):只有后代手写 + 一个无关裸类 ⇒ 仍判缺',
      (() => {
        const d = join(base, 'compound-descendant')
        mkdirSync(join(d, 'pages'), { recursive: true })
        writeFileSync(join(d, 'pages', 'i.wxml'), '<view/>')
        writeFileSync(
          join(d, 'app.wxss'),
          '.card-list .space-x-2{margin:0}\n.text-muted{color:red}',
        )
        const got = collectLandedFromDist(d)
        const c = computeCoverage(
          ['space-x-2'],
          new Set(['space-x-2']),
          got.landed,
          compoundOnly,
          got.compoundLeads,
        )
        return [
          got.landed.has('space-x-2'),
          got.landed.has('text-muted'),
          got.compoundLeads.has('space-x-2'),
          c.hitKinds,
          c.definiteMissKinds,
        ]
      })(),
      [false, true, false, 0, 1],
    )
    eq(
      'P16e 端到端阳性:同一份 dist 补上首族复合规则 ⇒ 三态翻成命中',
      (() => {
        const d = join(base, 'compound-leading')
        mkdirSync(join(d, 'pages'), { recursive: true })
        writeFileSync(join(d, 'pages', 'i.wxml'), '<view/>')
        writeFileSync(
          join(d, 'app.wxss'),
          '.card-list .space-x-2{margin:0}\n.space-x-2>view+view{margin-right:8rpx}',
        )
        const got = collectLandedFromDist(d)
        const c = computeCoverage(
          ['space-x-2'],
          new Set(['space-x-2']),
          got.landed,
          compoundOnly,
          got.compoundLeads,
        )
        return [got.compoundLeads.has('space-x-2'), c.hitCompoundKinds, c.definiteMissKinds]
      })(),
      [true, 1, 0],
    )
    eq(
      'P16f 裸类命中优先:已有裸规则的名字不得被记进第三态(三态必须互斥)',
      (() => {
        const leads = harvestCompoundLeadNames('.flex>view+view{a:b}')
        const c = computeCoverage(
          ['flex'],
          new Set(['flex']),
          new Set(['flex']),
          compoundOnly,
          leads,
        )
        return [c.hitOriginalKinds, c.hitCompoundKinds, c.missKinds]
      })(),
      [1, 0, 0],
    )
    eq(
      'P16g 参考层是裸形态的名字**不吃**第三态(否则复合手写规则又能冒充 utility 落地)',
      (() => {
        const leads = harvestCompoundLeadNames('.border-border>view+view{border-color:red}')
        const c = computeCoverage(
          ['border-border'],
          new Set(['border-border']),
          new Set(),
          new Set(['border-border']),
          leads,
        )
        return [c.hitCompoundKinds, c.missKinds]
      })(),
      [0, 1],
    )
    eq(
      'P16h 前缀边界:.space-x-20 的首族不得冒充 space-x-2(名字必须整段相等)',
      harvestCompoundLeadNames('.space-x-20>view+view{a:b}').has('space-x-2'),
      false,
    )
    eq(
      'P16i 双类形态 .space-x-2.own 不算首族(第二个类紧随 = 手写复合,不是 utility 产出形态)',
      harvestCompoundLeadNames('.space-x-2.own-hand{a:b}').has('space-x-2'),
      false,
    )
    eq(
      'P16j 无规则体的复合选择器不算命中(裸类那侧的"空壳不算"语义在第三态同样成立)',
      harvestCompoundLeadNames('.space-y-2>view+view').has('space-y-2'),
      false,
    )
    eq(
      'P16k 两态口径不变:未喂裸类子集时第三态整体不开启(旧三参调用行为逐字如前)',
      (() => {
        const leads = harvestCompoundLeadNames('.space-x-2>view+view{a:b}')
        const off = computeCoverage(['space-x-2'], new Set(['space-x-2']), new Set(), null, leads)
        const on = computeCoverage(
          ['space-x-2'],
          new Set(['space-x-2']),
          new Set(),
          compoundOnly,
          leads,
        )
        return [off.hitCompoundKinds, off.missKinds, on.hitCompoundKinds]
      })(),
      [0, 1, 1],
    )
    eq(
      'P16l 归族不得被第三态带跑:真缺项仍按前缀成族(space 族这次只剩真缺的那一条)',
      computeCoverage(
        ['space-x-2', 'space-y-9'],
        new Set(['space-x-2', 'space-y-9']),
        new Set(),
        compoundOnly,
        harvestCompoundLeadNames('.space-x-2>view+view{a:b}'),
      ).missFamilies,
      [{ family: 'space', count: 1 }],
    )
  } finally {
    rmTempDir(base)
  }

  // 同名双义分类 —— 三档各一正一反,否则分类判据等于没有
  eq(
    'P17 浅色 color × 浅色 background 且自有不设 color ⇒ white-on-white',
    classifyDualMeaning(
      ['color:var(--color-card)'],
      ['background:var(--color-card)', 'padding:28rpx'],
    ),
    'white-on-white',
  )
  eq(
    'P18 自有规则自己也设 color ⇒ 降为 color-overlap(自有在样式表后,当前自有赢)',
    classifyDualMeaning(['color:var(--color-foreground)'], ['color:#111827']),
    'color-overlap',
  )
  eq(
    'P19 两侧属性不相交 ⇒ coexist',
    classifyDualMeaning(['width:100%'], ['background:var(--color-card)']),
    'coexist',
  )
  eq(
    'P20 深色 background 不得判成白底事故',
    classifyDualMeaning(['color:var(--color-card)'], ['background:#111827']),
    'coexist',
  )
  eq(
    'P21 utility 不出 color ⇒ 不构成白底事故',
    classifyDualMeaning(['display:flex'], ['background:var(--color-card)']),
    'coexist',
  )
  eq(
    'P22 #fff / white 字面量按浅色算',
    classifyDualMeaning(['color:#fff'], ['background:white']),
    'white-on-white',
  )
  eq(
    'P23 深色 foreground 档(#0a0a0a)不得按浅色认',
    classifyDualMeaning(['color:var(--color-foreground)'], ['background:var(--color-card)']),
    'coexist',
  )

  // C2 盲区:参考层判磁盘、源码判 HEAD 时,"盘上改名但 HEAD 还在用"的那批必须被点名,
  // 否则 C2 的少报会表现为"没有双义"—— 立因当天正是这样漏掉了 white-on-white 那一型。
  eq('P23a 前缀切到最后一个连字符', namespacePrefix('text-muted-foreground'), 'text-muted')
  eq('P23a2 无前缀的裸名整名即前缀', namespacePrefix('visible'), 'visible')
  // 正例:text-card 的前缀 text 在参考层里确有邻居(text-sm)⇒ 它落在 Tailwind 命名空间,"参考层看不见"必须被点名
  eq(
    'P23b 用了且自有同名、参考层没有、但前缀属 Tailwind 命名空间 ⇒ 记盲区',
    findBlindSpots(['text-card'], new Set(['text-sm', 'flex'])),
    ['text-card'],
  )
  // 反例:action-btn 的前缀 action 在参考层里没有任何邻居 ⇒ 结构上不可能是 Tailwind 候选,
  // 不得混进盲区(否则报出 1500+ 条,把真那一条埋掉 = 等于没报)
  eq(
    'P23c 不属任何 Tailwind 命名空间的自有类不得记盲区',
    findBlindSpots(['action-btn', 'agent-avatar'], new Set(['text-sm', 'flex'])),
    [],
  )
  eq(
    'P23d 参考层全覆盖时盲区必须为空(不得凭空造盲区)',
    findBlindSpots(['flex'], new Set(['flex'])),
    [],
  )
  eq(
    'P23e 盲区去重且稳定排序',
    findBlindSpots(['text-b', 'text-a', 'text-b'], new Set(['text-sm'])),
    ['text-a', 'text-b'],
  )

  // C1 算术:该红必红、该绿必绿,且分母只算参考层内的名字(否则造出一把恒红的尺子)
  eq(
    'P23f 全缺失 ⇒ pct 0 并点名样例',
    (() => {
      const c = computeCoverage(
        ['flex', 'text-sm', 'w-full'],
        new Set(['flex', 'text-sm', 'w-full']),
        new Set(),
      )
      return [c.pct, c.demandedKinds, c.missKinds, c.missingSamples.length]
    })(),
    [0, 3, 3, 3],
  )
  eq(
    'P23g 全落地 ⇒ pct 1、无缺失',
    (() => {
      const c = computeCoverage(
        ['flex', 'text-sm'],
        new Set(['flex', 'text-sm']),
        new Set(['flex', 'text-sm', 'bg-red-500']),
      )
      return [c.pct, c.missKinds, c.landedRuleKinds]
    })(),
    [1, 0, 3],
  )
  eq(
    'P23h 参考层外的自有类不得进分母(否则覆盖率被永远压低=恒红)',
    computeCoverage(['flex', 'action-btn', 'my-title'], new Set(['flex']), new Set(['flex']))
      .demandedKinds,
    1,
  )
  eq(
    'P23i 部分落地按命中数计',
    computeCoverage(['a', 'b', 'c'], new Set(['a', 'b', 'c']), new Set(['a'])).pct,
    1 / 3,
  )
  eq(
    'P23j 分母为空不得当成 0 覆盖(无需求=无可判)',
    computeCoverage(['x'], new Set(), new Set()).pct,
    1,
  )
  const b2 = mkTempDir('budget')
  try {
    const d = join(b2, 'dist')
    mkdirSync(join(d, 'pages', 'circle'), { recursive: true })
    mkdirSync(join(d, 'pkg-ai'), { recursive: true })
    const appJson = JSON.stringify({
      pages: ['pages/index/index'],
      subpackages: [{ root: 'pages/circle' }, { root: 'pkg-ai' }],
    })
    writeFileSync(join(d, 'app.json'), appJson)
    writeFileSync(join(d, 'app.wxss'), 'x'.repeat(100))
    writeFileSync(join(d, 'pages', 'circle', 'i.wxss'), 'y'.repeat(500))
    writeFileSync(join(d, 'pkg-ai', 'a.wxss'), 'z'.repeat(700))
    const m = measureMainPackage(d)
    const wantMain = Buffer.byteLength(appJson) + 100
    eq('P24 pages/ 下的分包根必须剔除,不得算进主包', [m.mainBytes, m.subBytes], [wantMain, 1200])
    eq('P25 余量 = 上限 - 主包', m.headroomBytes, MAIN_PACKAGE_LIMIT - wantMain)
    eq('P26 分包根计数按 app.json 实数', m.subpackageRootCount, 2)
    eq(
      'P27 缺 app.json ⇒ Undetermined',
      throwsUndetermined(() => measureMainPackage(join(d, 'pages'))),
      true,
    )

    // P28-P30:产物引擎指纹判据(参考层用错引擎 ⇒ C1 的可选集与 C3 的算术都失去依据)
    const engRoot = mkTempDir('eng')
    const engBase = join(engRoot, 'dist')
    mkdirSync(engBase, { recursive: true })
    const V4 =
      '--tw-leading:;--tw-tracking:;--tw-gradient-position:initial;--tw-drop-shadow-size:;--tw-duration:initial;--tw-ease:initial;'
    const V3 = '--tw-bg-opacity:1;--tw-text-opacity:1;--tw-border-opacity:1;'
    writeFileSync(join(engBase, 'app.wxss'), '@import "./app-origin.wxss";')
    // P28 纯 v4 指纹 ⇒ v4,且 preflight 在(端 config 明写 preflight:false 时这就是"config 没进链"的证据)
    writeFileSync(
      join(engBase, 'app-origin.wxss'),
      `page{box-sizing:border-box;border:0 solid}${V4}.a{color:red}`,
    )
    eq(
      'P28 只有 v4 指纹 ⇒ v4 + preflight 在',
      (() => {
        const r = detectProductTailwindMajor(engBase)
        return [r.major, r.preflight, r.v4Hits, r.v3Hits]
      })(),
      ['v4', true, 6, 0],
    )
    // P29 纯 v3 指纹 ⇒ v3(反向对照:否则本判据等于恒答 v4)
    writeFileSync(join(engBase, 'app-origin.wxss'), `page{margin:0}${V3}`)
    eq(
      'P29 只有 v3 指纹 ⇒ v3 且 preflight 不在',
      (() => {
        const r = detectProductTailwindMajor(engBase)
        return [r.major, r.preflight]
      })(),
      ['v3', false],
    )
    // P30 两版指纹同时出现 ⇒ unknown,不得猜一个方向
    writeFileSync(join(engBase, 'app-origin.wxss'), `${V4}${V3}`)
    eq('P30 两版指纹都有 ⇒ unknown(不猜)', detectProductTailwindMajor(engBase).major, 'unknown')
  } catch (e) {
    results.push({ label: 'P24-P30 主包切分与产物引擎', ok: false, got: String(e).slice(0, 200) })
  } finally {
    rmTempDir(b2)
  }

  /* ---- P31–P38:v4 产物的嵌套语义(换引擎后新暴露的一类"分母在藏东西") ----
     v4 会把 @supports / @media **嵌在类规则自己身上**,例如实测形态
       .bg-primary\/10 { background-color: var(--color-primary); @supports (color: color-mix(in lab, red, red)) { … } }
     旧的扁平解析器对这种规则**整条匹配不上** ⇒ 类名从参考层隐身 ⇒ 分母变小、覆盖率虚高。
     这组正反例就是把这一型钉死:漏收即红。 */
  eq(
    'P31 类规则自带 @supports 嵌套时仍必须收到该类和它自己的声明',
    [
      [
        ...harvestLandedSelectors(
          '.bg-primary\\/10{background-color:var(--color-primary);@supports (color:color-mix(in lab,red,red)){background-color:color-mix(in oklab,var(--color-primary)10%,transparent)}}',
        ),
      ],
      harvestClassDeclarations(
        '.bg-primary\\/10{background-color:var(--color-primary);@supports (x:y){color:red}}',
      ).get('bg-primary/10'),
    ],
    [['bg-primary/10'], ['background-color:var(--color-primary)', 'color:red']],
  )
  eq(
    'P32 反向对照:@media 嵌在类规则里但全树零声明 ⇒ 不算落地(不得把空壳当规则)',
    [...harvestLandedSelectors('.a{@media (min-width:24rem){}}')],
    [],
  )
  eq(
    'P33 at-rule 头部 里的数值不得被当成类名',
    [...harvestLandedSelectors('@media (min-width: 24.5rem){.c{color:red}}')],
    ['c'],
  )
  eq(
    'P34 @supports 条件里的逗号/百分号不得产出假类名',
    [
      ...harvestLandedSelectors(
        '@supports (color: color-mix(in lab, red 50%, red)){.d{color:red}}',
      ),
    ],
    ['d'],
  )
  eq(
    'P35 值里的花括号与分号(引号内)不得打断解析',
    [...harvestLandedSelectors('.e{content:"{"}.f{color:red}.g{background:url("a;b.png")}')].sort(),
    ['e', 'f', 'g'],
  )
  eq(
    'P36 多层嵌套(类 > @media > 声明)逐层收',
    [
      ...harvestLandedSelectors(
        '@layer utilities{.h{color:red}.i{@media (width>=40rem){color:blue}}}',
      ),
    ].sort(),
    ['h', 'i'],
  )
  eq('P37 空规则体仍不算落地(立项语义不得被嵌套改造带跑)', [...harvestLandedSelectors('.j{}')], [])
  // P38-P42:参考层引擎择档(auto = 同引擎,判不出即弃权)
  eq('P38 auto + 产物 v4 ⇒ 参考层走 v4,且不是人工档', pickReferenceEngine({ productMajor: 'v4' }), {
    engine: 'v4',
    explicit: false,
    reason: '',
  })
  eq(
    'P39 auto + 产物 v3 ⇒ 走 v3(反向对照:否则本判据等于恒答 v4)',
    pickReferenceEngine({ productMajor: 'v3' }).engine,
    'v3',
  )
  eq(
    'P40 auto + 引擎判不出 ⇒ 必须弃权(engine null 并给原因),不得继续报一个覆盖率',
    (() => {
      const r = pickReferenceEngine({ productMajor: 'unknown' })
      return [r.engine, r.explicit, typeof r.reason === 'string' && r.reason.length > 0]
    })(),
    [null, false, true],
  )
  eq(
    'P41 人工指定 v3 对比档 ⇒ 放行且标 explicit(由调用方决定不判红)',
    pickReferenceEngine({ productMajor: 'v4', requested: 'v3' }),
    { engine: 'v3', explicit: true, reason: '' },
  )
  eq(
    'P42 非法档名 ⇒ 弃权并点名,不静默按 auto 跑',
    (() => {
      const r = pickReferenceEngine({ productMajor: 'v4', requested: 'v9' })
      return [r.engine, /非法/.test(r.reason)]
    })(),
    [null, true],
  )

  // P43–P46:参考层与源码面**同面**判据(2026-09-25 立)。
  // 关键形状是"**同一份产物输入,只换源码面,结论必须换**"——P43 与 P44 就差一个 face。
  eq(
    'P43 异面必拒:引擎档 v3 × 源码面 head ⇒ abstain(不再"两把不同面"照样出判定数)',
    (() => {
      const r = planReferenceFace({ face: 'head', engine: 'v3', explicit: false })
      return [r.action, r.sameFace, r.judged, /异面/.test(r.reason)]
    })(),
    ['abstain', false, false, true],
  )
  eq(
    'P44 同面正常出结论:引擎档 v3 × 源码面 worktree ⇒ build 且可判(与 P43 只差面)',
    planReferenceFace({ face: 'worktree', engine: 'v3', explicit: false }).action,
    'build',
  )
  eq(
    'P44a 同面正向的另一半:v3 × worktree 时 judged 必须为 true(否则 P44 只证了 action)',
    planReferenceFace({ face: 'worktree', engine: 'v3', explicit: false }).judged,
    true,
  )
  eq(
    'P45 v4 档候选由被审面喂入 ⇒ 任何源码面都同面、可判',
    planReferenceFace({ face: 'head', engine: 'v4' }),
    { sameFace: true, judged: true, action: 'build', reason: '' },
  )
  eq(
    'P46 人工对比档:异面仍出**读数**,但 judged=false(报告行必须标"不计红")',
    (() => {
      const r = planReferenceFace({ face: 'staged', engine: 'v3', explicit: true })
      return [r.action, r.sameFace, r.judged]
    })(),
    ['build', false, false],
  )

  /* ---- P47–P55:weapp 类名转写比对(2026-09-25 C1 收紧)----
     正例样本**逐字取自一次真 weapp 构建产物**(不是照抄立票时的猜测);
     反向对照钉住"加转写表"不得变成"让门更容易点头"。
     另注:不得把 mangle(mangle(x)) 当不动点用 —— 判据里没有第二遍应用,也就无需假设它幂等。 */
  eq(
    'P47 转写表与真产物逐字一致(含 arbitrary value 内部标点与变体前缀)',
    [
      weappMangleClassName('-top-[8rpx]'),
      weappMangleClassName('top-1/2'),
      weappMangleClassName('bg-[var(--color-black-50)]'),
      weappMangleClassName('bg-[rgba(0,0,0,0.4)]'),
      weappMangleClassName('dark:text-foreground'),
      weappMangleClassName('pb-[calc(20rpx+env(safe-area-inset-bottom,0))]'),
      weappMangleClassName('flex'),
    ],
    [
      '-top-_b8rpx_B',
      'top-1_f2',
      'bg-_bvar_p--color-black-50_P_B',
      'bg-_brgba_p0_m0_m0_m0_d4_P_B',
      'dark_ctext-foreground',
      'pb-_bcalc_p20rpx_uenv_psafe-area-inset-bottom_m0_P_P_B',
      'flex',
    ],
  )
  eq(
    'P48 表外标点不得猜转写(% @ # * ~ 原样保留)',
    [weappMangleClassName('w-[50%]'), weappMangleClassName('a@b#c'), weappMangleClassName('d*e~f')],
    ['w-_b50%_B', 'a@b#c', 'd*e~f'],
  )
  eq(
    // `!` 不在本例里:它已于本轮拿到真产物三条证(`._ebg-muted{…!important}`),是**表内条目**。
    // 把它留在这里 = 把已取证的事实当成猜测;真正的锁是"表内每一条都得有真产物样本"(镜像测试 §2b)。
    'P48b 已取证的 ! 必须进表(反向锁:退回"不猜"会让 11 条 important 档永远判不出归属)',
    weappMangleClassName('!bg-muted'),
    '_ebg-muted',
  )
  eq(
    'P49 两态分开计数:原名直中与转写后中各记各的(合计当数会把"表漏一条"藏起来)',
    (() => {
      const c = computeCoverage(
        ['flex', '-top-[8rpx]'],
        new Set(['flex', '-top-[8rpx]']),
        new Set(['flex', '-top-_b8rpx_B']),
      )
      return [c.hitOriginalKinds, c.hitMangledKinds, c.hitKinds, c.missKinds, c.pct]
    })(),
    [1, 1, 2, 0, 1],
  )
  eq(
    'P50 反向对照:产物里没有的名字收紧后仍判缺(加转写表 ≠ 放水)',
    computeCoverage(
      ['bg-does-not-exist-tier'],
      new Set(['bg-does-not-exist-tier']),
      new Set(['bg-_bvar_p--x_P_B', 'flex']),
    ).missKinds,
    1,
  )
  eq(
    'P51 表外标点桶:只报数、不并入 hit、字符点名,且不进确定缺失的样例',
    (() => {
      const c = computeCoverage(['w-[50%]'], new Set(['w-[50%]']), new Set(['w-full']))
      return [
        c.hitKinds,
        c.missKinds,
        c.unmangledPunctMisses,
        c.unmangledPunctChars,
        c.definiteMissKinds,
        c.missingSamples.length,
      ]
    })(),
    [0, 1, 1, ['%'], 0, 0],
  )
  eq(
    'P52 反向:同一含表外标点的名字若原名直中,不得落进表外标点桶',
    (() => {
      const c = computeCoverage(['w-[50%]'], new Set(['w-[50%]']), new Set(['w-[50%]']))
      return [c.hitOriginalKinds, c.unmangledPunctMisses]
    })(),
    [1, 0],
  )
  eq(
    'P53 归族:确定缺失按前缀成族、按数降序("整族缺失"那个真信号必须可读)',
    computeCoverage(['bg-b', 'bg-a', 'text-c'], new Set(['bg-b', 'bg-a', 'text-c']), new Set())
      .missFamilies,
    [
      { family: 'bg', count: 2 },
      { family: 'text', count: 1 },
    ],
  )
  eq(
    'P54 族取法:剥变体前缀、忽略负号、无连字符即整名',
    [
      missFamily('hover:bg-muted'),
      missFamily('-top-[8rpx]'),
      missFamily('flex'),
      missFamily('text-cta-foreground'),
    ],
    ['bg', 'top', 'flex', 'text'],
  )
  eq(
    'P55 无标点名字不受转写表影响(原名直中态不因收紧而改变)',
    (() => {
      const c = computeCoverage(['flex'], new Set(['flex']), new Set(['flex']))
      return [c.hitOriginalKinds, c.hitMangledKinds]
    })(),
    [1, 0],
  )
  /* ---- C4:转写名进了 CSS,还得运行时挂得上(2026-09-25 深夜实测逼出的一维) ---- */
  eq(
    'P56 阳性:CSS 只有转写名、运行时也挂转写名 ⇒ 计入命中,不计死规则',
    (() => {
      const c = computeCoverage(
        ['z-[1001]'],
        new Set(['z-[1001]']),
        new Set(['z-_b1001_B']),
        null,
        null,
        new Set(['z-_b1001_B', 'flex']),
      )
      return [c.hitMangledKinds, c.deadRuleKinds, c.hitKinds]
    })(),
    [1, 0, 1],
  )
  eq(
    'P57 反向(本票核心一格):CSS 只有转写名、运行时仍挂源名 ⇒ 判**死规则**,绝不进命中',
    (() => {
      const c = computeCoverage(
        ['z-[1001]'],
        new Set(['z-[1001]']),
        new Set(['z-_b1001_B']),
        null,
        null,
        new Set(['z-[1001]', 'flex']),
      )
      return [c.hitMangledKinds, c.deadRuleKinds, c.hitKinds, c.pct, c.missKinds]
    })(),
    [0, 1, 0, 0, 0],
  )
  eq(
    'P58 没量运行时面 ⇒ 这一格必须"未判定",不得静默当 0(宁报未判定,不报健康)',
    (() => {
      const c = computeCoverage(['z-[1001]'], new Set(['z-[1001]']), new Set(['z-_b1001_B']))
      return [c.runtimeFaceJudged, c.deadRuleKinds, c.hitMangledKinds]
    })(),
    [false, 0, 1],
  )
  eq(
    'P70 输入形态不变量:数组与一次性迭代器必须给出逐字相同的读数',
    (() => {
      // 回归本票真实缺陷:runCheck 传 Map#keys(),被 demanded 抽干后面 1 恒 0,
      // 485 条转写档整批伪装成"确定缺失",C5 又因"无需求"退成未判定 —— 一个耗尽的迭代器
      // 同时伪造了两种健康读数。只测数组输入永远发现不了它。
      const names = ['z-[1001]', 'bg-muted']
      const ref = new Set(names)
      const landed = new Set(['bg-muted', 'z-_b1001_B'])
      const pick = (c) =>
        JSON.stringify([
          c.hitKinds,
          c.hitOriginalKinds,
          c.hitMangledKinds,
          c.mangleDemandKinds,
          c.definiteMissKinds,
          c.pct,
        ])
      const asArray = pick(computeCoverage([...names], ref, landed))
      const asIterator = pick(
        computeCoverage(new Map(names.map((n) => [n, 1])).keys(), ref, landed),
      )
      return [asArray, asIterator, asArray === asIterator]
    })(),
    (() => {
      const j = [2, 1, 1, 1, 0, 2 / 2]
      return [JSON.stringify(j), JSON.stringify(j), true]
    })(),
  )
  eq(
    'P59 死规则既不混进 miss、也不从报告里消失:自成第 4 桶并带样例',
    (() => {
      const c = computeCoverage(
        ['z-[1001]', 'w-[100rpx]'],
        new Set(['z-[1001]', 'w-[100rpx]']),
        new Set(['z-_b1001_B', 'w-_b100rpx_B']),
        null,
        null,
        new Set(['z-[1001]', 'w-[100rpx]']),
      )
      return [c.missKinds, c.deadRuleKinds, c.deadRuleSamples.length]
    })(),
    [0, 2, 2],
  )

  /* ---- P60–P76:2026-09-26 两条新判据 —— C5 转写腿结构性对账 + C4 运行时可达性的第 3 态 ----
     C5 立项依据(实测、已定论):同一份仓库配置,一次构建 JS 侧一个转写名都没有(死规则 485、
     C1 34.89%),另一次全转写(死规则 34),config/index.ts 两次之间一字未改。
     那时"腿整轮没跑"只会让 pct 变小 —— 量级判据冒充结构判据,而 `--min-coverage 0` 的观测档
     下 pct 压根不判红。P60/P61 就是把这一型钉成"必然翻红 + 空扫不得记通过"。
     C4 修口依据(实测):`border-[length:14rpx]` 等三条被判 dead,而产物 JS 里逐字可见
     `".concat(v===t?"font-bold border-_blength_c14rpx_B border-transparent":"")` —— 抽取器只认
     `class/className` 紧邻字面量,拼接串结构上看不见 ⇒ 死规则维度对拼接 class **高估**。
     第 3 态必须与 C5 的面 2 **共用同一份全文实现**,且反向锁(P64/P65)不许把真死规则洗白。 */
  eq(
    'P60 C5 反向证明:健康的构建(面 1>0 ∧ 面 2>0)必判"在",不得被新判据误杀',
    (() => {
      const r = auditMangleLeg({ demandKinds: 485, sightingKinds: 454, sampleNames: ['z-[1001]'] })
      return [r.verdict, r.reason === '', r.demandKinds, r.sightingKinds]
    })(),
    ['in', true, 485, 454],
  )
  eq(
    'P61 C5 阳性:面 1>0 而面 2==0 ⇒ 必判 idle(腿整轮空转),并带 ≤5 个样例名',
    (() => {
      const many = Array.from({ length: 9 }, (_, i) => `a-[${i}]`)
      const r = auditMangleLeg({ demandKinds: many.length, sightingKinds: 0, sampleNames: many })
      return [r.verdict, /空转/.test(r.reason), /JS\/WXML/.test(r.reason), r.sampleNames.length]
    })(),
    ['idle', true, true, 5],
  )
  eq(
    'P62 C5 饿死方向对照:面 1==0 ⇒ 只能"未判定",**绝不记为通过**(空扫报绿是本仓最高频失效型)',
    (() => {
      const r = auditMangleLeg({ demandKinds: 0, sightingKinds: 0, sampleNames: [] })
      return [r.verdict, r.verdict === 'in', /无可观测转写需求/.test(r.reason)]
    })(),
    ['undetermined', false, true],
  )
  eq(
    'P63 面 2 没量到(全文语料取不到)⇒ 未判定,不得冒红也不得记绿',
    auditMangleLeg({ demandKinds: 485, sightingKinds: NaN }).verdict,
    'undetermined',
  )
  eq(
    'P64 三态正向:抽取器看不见、全文搜索目击得到的拼接 class ⇒ 算可达,不再计死规则(sighted 集喂**源名**,与 findMangledSightings 的返回同形)',
    (() => {
      const p = partitionRuntimeReachability(
        ['border-[length:14rpx]'],
        new Set(['border-[length:14rpx]']),
        new Set(['border-[length:14rpx]']),
      )
      // 反向形状锁:sighted 集若被误喂成**转写名**,不会报错,只会安静地把一切判成 dead
      // —— 而"死规则变多"看起来像发现了更多缺陷,是最坏的那种失效。两臂同测才钉得住键形。
      const wrongKey = partitionRuntimeReachability(
        ['border-[length:14rpx]'],
        new Set(['border-[length:14rpx]']),
        new Set(['border-_blength_c14rpx_B']),
      )
      return [
        [p.byToken.length, p.bySighting.length, p.dead.length],
        [wrongKey.bySighting.length, wrongKey.dead.length],
      ]
    })(),
    [
      [0, 1, 0],
      [0, 1],
    ],
  )
  eq(
    'P65 三态反向锁(不得放水):CSS 有转写规则、产物全文里那个转写名一个字都没有 ⇒ 仍判 dead',
    (() => {
      const p = partitionRuntimeReachability(['z-[1001]'], new Set(['z-[1001]']), new Set())
      return [p.byToken.length, p.bySighting.length, p.dead.length]
    })(),
    [0, 0, 1],
  )
  eq(
    'P66 第 1 态优先:token 抽取看得见的名字不得被记进第 2 态(三态必须互斥、合计守恒)',
    (() => {
      const names = ['z-[1001]', 'border-[length:14rpx]']
      const p = partitionRuntimeReachability(names, new Set(['z-_b1001_B']), new Set(names))
      return [
        [...p.byToken],
        [...p.bySighting],
        p.dead.length,
        p.byToken.length + p.bySighting.length + p.dead.length,
      ]
    })(),
    [['z-[1001]'], ['border-[length:14rpx]'], 0, 2],
  )
  eq(
    'P67 computeCoverage 端到端:全文目击那一条进 hitKinds/pct,deadRuleKinds 相应减 1',
    (() => {
      const used = ['z-[1001]', 'border-[length:14rpx]']
      const ref = new Set(used)
      const landed = new Set(['z-_b1001_B', 'border-_blength_c14rpx_B'])
      const tokens = new Set(['z-[1001]', 'border-[length:14rpx]']) // 源名在运行时,**转写名一个都没有**
      const two = computeCoverage(used, ref, landed, null, null, tokens)
      const three = computeCoverage(
        used,
        ref,
        landed,
        null,
        null,
        tokens,
        new Set(['border-[length:14rpx]']),
      )
      return [
        [
          two.hitMangledKinds,
          two.hitSightedKinds,
          two.deadRuleKinds,
          two.hitKinds,
          two.runtimeSightJudged,
        ],
        [
          three.hitMangledKinds,
          three.hitSightedKinds,
          three.deadRuleKinds,
          three.hitKinds,
          three.runtimeSightJudged,
        ],
        [Number(two.pct.toFixed(4)), Number(three.pct.toFixed(4))],
      ]
    })(),
    [
      [0, 0, 2, 0, false],
      [0, 1, 1, 1, true],
      [0, 0.5],
    ],
  )
  eq(
    'P68 向后兼容:不喂全文维时读数与 C4 修口前逐字一致(新判据不得悄悄改旧账)',
    (() => {
      const used = ['flex', 'z-[1001]', 'w-[100rpx]']
      const ref = new Set(used)
      const landed = new Set(['flex', 'z-_b1001_B', 'w-_b100rpx_B'])
      const tokens = new Set(['z-_b1001_B'])
      const legacy = computeCoverage(used, ref, landed, null, null, tokens)
      const explicitNull = computeCoverage(used, ref, landed, null, null, tokens, null)
      return [
        [
          legacy.hitOriginalKinds,
          legacy.hitMangledKinds,
          legacy.hitSightedKinds,
          legacy.deadRuleKinds,
          legacy.hitKinds,
        ],
        [
          explicitNull.hitOriginalKinds,
          explicitNull.hitMangledKinds,
          explicitNull.hitSightedKinds,
          explicitNull.deadRuleKinds,
          explicitNull.hitKinds,
        ],
      ]
    })(),
    [
      [1, 1, 0, 1, 2],
      [1, 1, 0, 1, 2],
    ],
  )
  eq(
    'P69 面 1 单一源:mangledOnlyNames 与 coverage 的三态合计必须等值(两处各写一遍必漂移)',
    (() => {
      const used = ['flex', 'z-[1001]', 'border-[length:14rpx]', 'nope-[1px]']
      const ref = new Set(used)
      const landed = new Set(['flex', 'z-_b1001_B', 'border-_blength_c14rpx_B'])
      const face1 = mangledOnlyNames(used, ref, landed)
      const c = computeCoverage(used, ref, landed, null, null, new Set(), new Set(['z-[1001]']))
      return [
        [...face1].sort(),
        c.mangleDemandKinds,
        c.hitMangledKinds + c.hitSightedKinds + c.deadRuleKinds,
        face1.length === c.mangleDemandKinds,
      ]
    })(),
    [['border-[length:14rpx]', 'z-[1001]'], 2, 2, true],
  )
  eq(
    'P70 面 1 结构性安全:原名直中的不进面 1;面 1 里的名字 mangle 后必不等于原名(否则全文子串会被裸词白送,腿空转就看不见)',
    (() => {
      const ref = new Set(['flex', 'z-[1001]'])
      const a = mangledOnlyNames(['flex', 'z-[1001]'], ref, new Set(['flex', 'z-_b1001_B']))
      const b = mangledOnlyNames(['flex', 'z-[1001]'], ref, new Set(['z-_b1001_B']))
      return [a.length, [...b], b.every((n) => weappMangleClassName(n) !== n)]
    })(),
    [1, ['z-[1001]'], true],
  )
  eq(
    'P71 全文子串搜索判据:只认转写名、不认原名(搜原名会把没转写的裸词到处命中算成目击)',
    (() => {
      const hay = 'className="z-[1001]" x.concat("border-_blength_c14rpx_B")'
      const seen = findMangledSightings(hay, ['z-[1001]', 'border-[length:14rpx]'])
      return [[...seen].sort(), seen.has('z-[1001]')]
    })(),
    [['border-[length:14rpx]'], false],
  )
  {
    // P72–P74:运行时取材面 —— token 维与全文维**必须读同一批文件**(共用 collectRuntimeFace)。
    // 这里造的真夹具同时是 C4 第 3 态的**端到端反向锁**:CSS 有转写规则、JS 全文一个字都没有 ⇒ 判 dead。
    const rf = mkTempDir('runtime-face')
    try {
      mkdirSync(join(rf, 'pages'), { recursive: true })
      writeFileSync(join(rf, 'pages', 'i.wxml'), '<view/>')
      const wxss = '.z-_b1001_B{z-index:1001}\n.border-_blength_c14rpx_B{border-width:14rpx}'
      const landed = harvestLandedSelectors(wxss)
      // 拼接形态:`className:"z-[1001]"` 是抽取器**看得见**的落点;而 border-… 那条只出现在 `.concat()`
      // 的**参数**里 —— CLASS_ATTR_RE 要求 class/className 紧邻字面量,这种写法它结构上看不见(本票修的那一型)。
      writeFileSync(join(rf, 'app.wxss'), wxss)
      writeFileSync(
        join(rf, 'pages', 'i.js'),
        'var el={className:"z-[1001]"};var b=".concat(v===t?\\"font-bold border-_blength_c14rpx_B border-transparent\\":\\"\\")";',
      )
      const used = ['z-[1001]', 'border-[length:14rpx]']
      const face = collectRuntimeFace(rf)
      const demand = mangledOnlyNames(used, new Set(used), landed)
      const sighted = findMangledSightings(face.haystack, demand)
      const c = computeCoverage(used, new Set(used), landed, null, null, face.tokens, sighted)
      eq(
        'P72 拼接 class:token 抽取看不见、全文维必须看得见 ⇒ 第 3 态计数,不再是死规则',
        [
          face.tokens.has('border-_blength_c14rpx_B'),
          sighted.has('border-[length:14rpx]'),
          c.hitSightedKinds,
          c.deadRuleKinds,
        ],
        [false, true, 1, 1],
      )
      // 夹具自证:P73 的"判缺"不是根本没扫到 —— 两条转写名在这份 dist 的 CSS 里都真有裸类规则体
      eq(
        'P72b 夹具自证:两条转写名在 wxss 里都真有裸类规则(否则 P73 的判缺没有判别力)',
        [landed.has('z-_b1001_B'), landed.has('border-_blength_c14rpx_B')],
        [true, true],
      )
      eq(
        'P73 反向锁(端到端):z-[1001] 的转写名在 JS 全文里真的一个字都没有 ⇒ 仍判 dead,没被"全文搜索"洗白',
        [c.hitMangledKinds, c.deadRuleKinds, c.deadRuleSamples],
        [0, 1, ['z-[1001]']],
      )
      eq(
        'P74 C5 端到端取材:面 1>0 且面 2>0 ⇒ 本轮判"在"(健康构建不得被判死);idle 时才带样例名',
        (() => {
          const leg = auditMangleLeg({
            demandKinds: c.mangleDemandKinds,
            sightingKinds: sighted.size,
            sampleNames: demand,
          })
          return [c.mangleDemandKinds, sighted.size, leg.verdict, leg.sampleNames.length]
        })(),
        [2, 1, 'in', 0],
      )
      eq(
        'P75 兼容出口 collectRuntimeClassTokens 与 collectRuntimeFace 的 token 集必须全等(不得两份取材)',
        (() => {
          const legacy = collectRuntimeClassTokens(rf)
          return [
            legacy.files,
            [...legacy.tokens].sort().join('|') === [...face.tokens].sort().join('|'),
            legacy.unreadable,
          ]
        })(),
        [2, true, 0],
      )
      eq(
        'P76 空扫不得记绿:全文语料取不到 ⇒ 抛"无法判定",而不是回一个 seen=0 让 C5 拿它判红/判绿',
        throwsUndetermined(() => findMangledSightings(null, ['z-[1001]'])),
        true,
      )
    } catch (e) {
      results.push({ label: 'P72-P76 运行时取材面', ok: false, got: String(e).slice(0, 200) })
    } finally {
      rmTempDir(rf)
    }
  }

  /* ---- C6:weapp CSS 腿整条没跑(2026-09-26 三连构建实测里最坏那一档) ---- */
  eq('P76 C3 主包超硬上限必须判红(它是平台事实,不受 --min-coverage 管辖)',
    (() => {
      const over = { mainBytes: 2097153, limitBytes: 2097152, headroomBytes: -1 }
      const ok = { mainBytes: 2069947, limitBytes: 2097152, headroomBytes: 27205 }
      const f = (b) => b.headroomBytes < 0
      return [f(over), f(ok)]
    })(),
    [true, false])
  eq('P77 C3 headroom 取不到(非数)时不得判红,也不得当成通过',
    [typeof null === 'number', typeof undefined === 'number'],
    [false, false])

  eq(
    'P71 C6 阳性:源码有含标点档而产物 0 个转写形态 ⇒ 必须判 off(这是 C1/C4/C5 一致报好的那一档)',
    auditCssLeg({ mangledRuleKinds: 0, arbitraryDemand: 550 }).verdict,
    'off',
  )
  eq(
    'P72 C6 反向:产物有转写形态 ⇒ 判 in,新判据不得把健康构建判死',
    auditCssLeg({ mangledRuleKinds: 559, arbitraryDemand: 724 }).verdict,
    'in',
  )
  eq(
    'P73 C6 空扫不记绿:源码本轮没有含标点档 ⇒ 只能 undetermined(不得报 in)',
    auditCssLeg({ mangledRuleKinds: 0, arbitraryDemand: 0 }).verdict,
    'undetermined',
  )
  eq(
    'P74 C6 见证量不到 ⇒ undetermined(不冒红也不记绿)',
    auditCssLeg({ mangledRuleKinds: null, arbitraryDemand: 12 }).verdict,
    'undetermined',
  )
  eq(
    'P75 countMangledRuleKinds 只数带转写痕迹的类名(源名/普通档不计)',
    countMangledRuleKinds(new Set(['bg-_bvar_p--color-card_P_B', 'flex', 'text-sm', 'z-_b1001_B'])),
    2,
  )

  let failed = 0
  for (const x of results) {
    console.log(
      `${x.ok ? '✅' : '❌'} ${x.label}${x.ok ? '' : ` got=${JSON.stringify(x.got)} want=${JSON.stringify(x.want)}`}`,
    )
    if (!x.ok) failed++
  }
  console.log(`--self-test:${results.length} 例,失败 ${failed}`)
  return failed === 0 ? 0 : 1
}

function throwsUndetermined(fn) {
  try {
    fn()
    return false
  } catch (e) {
    return e instanceof Undetermined
  }
}

/* 临时夹具落仓库内 .ihui-agent/tmp(§15/§15b 指定的项目内唯一临时落点,已 gitignore)。
   刻意不用 os.tmpdir() —— 活进程的 TEMP 可能仍钉在 C 盘(§26 实测)。 */
function mkTempDir(tag) {
  const p = join(DEFAULT_ROOT, '.ihui-agent', 'tmp', `css-landing-selftest-${tag}`)
  rmTempDir(p)
  mkdirSync(p, { recursive: true })
  return p
}
function rmTempDir(p) {
  if (existsSync(p)) rmSync(p, { recursive: true, force: true })
}

function parseArgs(argv) {
  const o = { minCoverage: 1 }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--staged') o.staged = true
    else if (a === '--worktree') o.worktree = true
    else if (a === '--json') o.json = true
    else if (a === '--self-test') o.selfTest = true
    else if (a === '--skip-reference') o.skipReference = true
    else if (a === '--legacy-reference-v3') o.legacyReferenceV3 = true
    else if (a === '--reference-engine') o.referenceEngine = argv[++i]
    else if (a === '--min-coverage') o.minCoverage = Number(argv[++i])
    else if (a === '--dist-dirname') o.distDirname = argv[++i]
    else if (a === '--root') o.root = resolve(argv[++i])
    else if (a === '--help' || a === '-h') o.help = true
    else throw new Error(`未知参数:${a}`)
  }
  return o
}

const HELP = `用法:node scripts/check-miniapp-css-landing.mjs [选项]
  --staged            源码判索引 blob(与 --worktree 互斥)
  --worktree          源码判磁盘(人工排查,不作门禁)
  --json              机器可读输出
  --min-coverage <n>  C1 阈值 0..1,默认 1;传 0 = 只观测不计红
  --skip-reference    不跑 tailwind(C1/C2 结构上判不出,如实计入「无法判定」)
  --reference-engine <auto|v3|v4>
                      参考层引擎。默认 auto = **跟产物同引擎、并与源码判定同面**:
                      v4 候选由被审的源码面 harvest 后显式喂入(天然同面);
                      v3 生成器只能读磁盘 ⇒ 仅 --worktree 下算同面,auto+v3+HEAD 判「无法判定」。
                      判不出产物引擎、或同引擎那套工具链解析不到 ⇒ 直接 exit 2 且**不出覆盖率数字**。
                      显式指定 v3/v4 是人工对比档:照样出数,但 C1 不判红。
  --legacy-reference-v3
                      = --reference-engine v3 的别名(与换档前的口径逐位对账时用)
  --dist-dirname <d>  换产物目录名(默认 dist)
  --root <dir>        仓库根(镜像测试夹具通道)
  --self-test         纯判据成对正反例(零副作用)
退出码:0 通过 / 1 判红 / 2 无法判定(既不记绿也不冒红)
定级:当前为手动 / CI 门,**未接进提交链**。`

async function main() {
  const opts = parseArgs(process.argv.slice(2))
  if (opts.help) {
    console.log(HELP)
    return 0
  }
  if (opts.selfTest) return selfTest()
  let r
  try {
    r = await runCheck({ ...opts, root: opts.root || DEFAULT_ROOT })
  } catch (e) {
    if (e instanceof Undetermined) {
      console.log(`⚠️ 无法判定:${e.message}`)
      console.log('结论:exit 2 —— 未判定')
      return 2
    }
    throw e
  }
  report(r, opts.json)
  return r.exit
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  main()
    .then((code) => process.exit(code))
    .catch((e) => {
      console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
      process.exit(2)
    })
}

export const __test__ = {
  harvestClassNameTokens,
  harvestClassDeclarations,
  harvestLandedSelectors,
  harvestCompoundLeadNames,
  isBareUtilitySelector,
  unescapeClassName,
  weappMangleClassName,
  unmappedPunctIn,
  missFamily,
  WEAPP_CLASS_MANGLE_TABLE,
  classifyDist,
  detectProductTailwindMajor,
  collectLandedFromDist,
  collectRuntimeClassTokens,
  collectRuntimeFace,
  findMangledSightings,
  mangledOnlyNames,
  auditCssLeg,
  countMangledRuleKinds,
  partitionRuntimeReachability,
  auditMangleLeg,
  measureMainPackage,
  classifyDualMeaning,
  findBlindSpots,
  namespacePrefix,
  computeCoverage,
  buildUtilityReference,
  buildUtilityReferenceV4,
  pickReferenceEngine,
  planReferenceFace,
  resolveTailwindInstall,
  resolveV4Loaders,
  majorOf,
  runCheck,
  selfTest,
  APP_REL,
  SRC_PREFIX,
  MAIN_PACKAGE_LIMIT,
  MISSING_SAMPLES,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
