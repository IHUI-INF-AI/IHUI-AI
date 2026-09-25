// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Tailwind v3 alpha 兼容插件(2026-09-25 立)— 只服务 miniapp-taro / mobile-rn 两端。
 *
 * 【缺陷】两端走 Tailwind **v3**,颜色取自同目录 tailwind-preset.js 的 JS theme,每档写成裸
 * CSS 变量(`primary: 'var(--color-primary)'`)。v3 生成透明度修饰符工具类的前提是
 * **能把颜色解析成通道**,而 `var(...)` 解析不出来 ⇒ `bg-primary/10` 在这两端**静默地产出
 * 零条规则**(类名在、样式无、不报错、typecheck 不红)。实测 miniapp 18 个 alpha 形态全部
 * 缺失,最高频 `bg-primary/10` 有 37 处。web 端是 Tailwind v4,自己会算 alpha,不用本插件。
 *
 * 【为什么是"纯增量 addUtilities",而不是改 theme 颜色值】三条改法均已实测否决:
 *  1. 把档位改成 `rgb(var(--x-rgb) / <alpha-value>)`:Tailwind 会把任何含 `<alpha-value>` 的
 *     字符串**统一**过一遍 `withAlphaVariable`,于是**非 alpha** 的 `.bg-primary` 也被注入
 *     `--tw-bg-opacity: 1` —— 产出不是逐字节等价,等于给全站既有规则改写。
 *  2. 函数式颜色 + `*Opacity: false`:29 类小夹具上看着干净,真打到 miniapp 848 条规则上
 *     改写了 12 条默认色板规则(如 `.bg-gray-100` 掉 `--tw-bg-opacity`)。夹具本身无效。
 *  3. `color-mix()`:NativeWind 的 `cssToReactNativeRuntime` 直接丢弃声明
 *     (`IncompatibleNativeFunctionValue`)。
 * 本插件只用 `addUtilities` **追加选择器**,不碰任何既有条款。真实内容上的实测对账
 * (miniapp 全量 src 编译,848 条规则):REMOVED 0 / MUTATED 0 / ADDED 18,18 条全是 alpha 形态。
 *
 * 【输出形态】`rgba(var(--color-X-rgb), a)` 是两端公约数:
 *  - 浏览器 / WXSS:逗号 + var 的 rgba 是最宽支持的写法(不依赖 CSS Color 4 的空格语法)。
 *  - NativeWind:metro 侧 `cssToReactNativeRuntime` 把它编成 `rgba` 函数节点(实测既无
 *    warning 也不抛);运行时 `react-native-css-interop/dist/runtime/native/resolve-value`
 *    的 `case "rgb"/"rgba"` 会把 var 解析出的通道串按 `[,\s/]` 拆开 ⇒ `rgba(0, 0, 0, 0.1)`。
 *    所以 RN 侧既不崩,又仍然跟着主题走(通道变量在 .dark 另有一份)。
 *
 * 【为什么登记表是「用量推导」而不是整表铺开 —— 这条是刻意的,别改成全量】
 * 实测:本插件产出的静态工具类**不参与内容 purge** —— 登记 N 条就产出 N 条
 * (往表里加一条源码里从没写过的 `bg-primary/50`,样式表就多一条规则;把 22 档 opacity 刻度
 * × 3 前缀 × 7 档全铺开,就是 462 条死规则)。所以这张表的大小**等于**样式表增大的大小,
 * 而小程序主包有 2MB 硬预算 ⇒ 只能逐条登记真实写过的形态。
 *
 * 【2026-09-25 就地改写:这张表现在由 `scripts/sync-alpha-usage.mjs` 扫描生成,不再人工维护】
 * 上面"只能逐条登记真实写过的形态"这个约束一个字没变(变的是**谁来登记**)。人工登记当天咬了两口,
 * 方向正好相反:① 登了没人用 —— `bg-muted/40` 曾进表,而那 2 处"用量"全在注释文本里(统计没剥注释),
 * 等于往主包塞一条永不产出的死规则;② 写了没登记 —— 新加 `bg-info/10` 照样静默不产出。
 * 现在表的来源是 v3 三端源码的真实类名(先剥注释再统计),于是 ① 从定义上消失(生成器写不出源码里没有
 * 的形态),② 靠"下次生成必然覆盖"消失。
 *
 * 由此,下面这段旧措辞里被推翻的部分如实留在原地(勿照它执行):
 * ~~代价也要如实说清:新写一个没登记过的形态(如 `bg-info/10`)仍然**静默不产出**,与改动前的症状一模一样。
 * 拦住它的是守门 `scripts/check-cross-end-tokens.mjs` 的 **R6** 判据(2026-09-25 落地)—— 它扫 v3 三个
 * 消费端源码里真实写过的 alpha 类名,未登记即红并点名补哪一行;反向也判:登了却没人用的行(等于往小程序
 * 主包塞死规则)同样红。改这张表之前先记住:门在,别绕过它。~~
 * 现行关系:R6 **仍在**且判据未动,但表既然由同一份用量导出,它的"未登记即红"就**不该再触发** —— 红点
 * 含义降级为"生成器没跑 / 跑前被手改过"的兜底哨兵;它的"登了却没人用 = 腐烂"这一族结构性消失,唯一
 * 出口是 `alpha-plugin-exempt: <原因>` 行内豁免(生成器与 R6 两侧同形:豁免的既不登记也不判红)。
 * R6 还判第三件事,生成器**不代它判**:`tokens.css` 每档必须有 `--color-X-rgb` 通道三元组 —— 表里新增
 * 档名后仍要跑一次 `node scripts/check-cross-end-tokens.mjs` 确认通道在位。
 * (本头注此前声称由 `scripts/tests/tailwind-alpha-plugin.test.mjs` 看护 —— 该文件在 HEAD 与磁盘上
 *  都不存在,即一句没有兑现的承诺;R6 是它的实际出口。)
 *
 * 【已知边界(如实登记,不假装覆盖)】
 *  - 渐变(from/via/to)、ring、divide、placeholder、shadow 等前缀**未支持**:实测三端在
 *    preset 档位上零用量(唯一的 `from-black/60` 走默认色板,本来就正常产出)。要支持得逐个
 *    复刻它们的输出形状(gradient 要同时给 `--tw-gradient-*`,ring 要 `box-shadow` 组合),
 *    复刻没人用的形状等于再造一份"看起来对"的实现。
 *  - 任意值 `bg-primary/[0.07]` 只对**登记过的那一个数值**生效(下表里的 `[0.12]`),
 *    未登记的数值不产出 —— 同上,由用量对账点名。
 *
 * 消费方式与 preset 同形(CommonJS require 拿 `.default`,ESM import 直接拿)。
 *
 * @type {import('tailwindcss').Plugin}
 */

/** 档位名 → 通道三元组变量后缀。三元组的真实值只有 tokens.css 一份(由守门 R6 对账)。 */
export const ALPHA_CHANNEL_SUFFIX = '-rgb'

/**
 * 前缀 → 声明构造。这里放的是**能力**(这类工具类长什么样),不是用量。
 * 新增一档不会自动扩面:必须先在这里有对应前缀。
 */
export const ALPHA_UTILITY_KINDS = {
  bg: (decl) => ({ 'background-color': decl }),
  text: (decl) => ({ color: decl }),
  border: (decl) => ({ 'border-color': decl }),
}

/**
 * 用量登记表:档位 → 前缀 → 已写过的透明度修饰符。
 *
 * 【本表由 `node scripts/sync-alpha-usage.mjs` 扫描生成,不要手改】
 * 扫描面 = Tailwind v3 的三个消费端 `apps/miniapp-taro/src` + `apps/mobile-rn/src` + `packages/app/src`,
 * 取材口径与守门 R6 同一套(默认 HEAD blob,`--face staged` 走索引⊕HEAD),并且**先剥注释再统计** ——
 * 注释里的类名不是用量。判据本身也复用 R6 那份实现(`scripts/check-cross-end-tokens.mjs` 的
 * `maskComments` / `extractAlphaUsages` / `parseLiteralObject` / `flattenColorTiers`),不在这里抄第二份:
 * 同一判据两处不同形正是这张表当初登进死规则的成因。
 * 写回是**原位**的:只替换本对象的花括号内部,上面这段说明、`ALPHA_UTILITY_KINDS`、下面的函数体
 * 一律逐字节不动;表与用量一致时脚本零改动(幂等),所以手改的内容会在下一次生成时被覆盖 —— 这是特性。
 *
 * 【登记什么、不登记什么(四类都在脚本输出里如实计数,绝不静默丢弃)】
 *  - 登记:`bg|text|border-<preset 档>/<数值或 [任意值]>`,且未被 `alpha-plugin-exempt:` 豁免。
 *  - 不登记:默认色板(`bg-white/50` 这类)—— v3 自己能算通道,本插件不该接,接了是重复产出。
 *  - 不登记:前缀不在 `ALPHA_UTILITY_KINDS` 里的(`ring-*` / `from-*` / `divide-*` …)—— 那要先扩能力表,
 *    否则登记一行也产不出东西;脚本点名它,但不替作者决定要不要支持。
 *  - 不登记也不判缺:动态拼接的类名(`bg-${x}/10`、`bg-primary/${a}`)—— 判据看不见内容,归 undetermined 报数。
 *
 * 【数值档与任意值档是两族,逐条如实登记,永不归并】
 * `[0.12]` 与 `12` 产出的选择器不同(`bg-muted\/\[0\.12\]` vs `bg-muted\/12`),归并成一族就产出错的那条。
 *
 * 【本表不再附一份手写用量统计】此前这里抄过一份"2026-09-25 实测:bg-primary/10 37 · …"的数字。
 * 那种快照登记即腐烂(改一处用法它就过期,而没人会回来改注释),现一律看命令输出:
 * `node scripts/sync-alpha-usage.mjs --check` 打印形态清单、各自计数、四类排除面与 undetermined 明细。
 *
 * 【2026-09-25 由守门 R6 揪出并删除的一行(人工维护的代价,留作本表改为生成的理由)】
 * 原表登记过 `bg-muted/40`(数据行写作"bg-muted/40 2")。那 2 处命中全在**注释里**
 * (packages/app 的 SearchInput.tsx / LoginScreen.tsx 各一处,内容是"(web 基准:… bg-muted/40 …)"
 * 这类对照说明)—— 当初的用量统计没剥注释,于是把散文当成了用量,往主包里留下一条永远不会被用到的规则。
 * 真正写 `bg-muted/40` 的代码在 apps/web 与 apps/extension,而它们是 Tailwind v4、原生支持 alpha、
 * 根本不经过本插件。这一型现在由生成器的剥注释判据从源头堵住(`--self-test` 的 A1/A1b 成对锁住)。
 */
export const ALPHA_USAGE = {
  primary: { bg: ['10'], border: ['20', '30', '40'] },
  'primary-foreground': { text: ['90'] },
  foreground: { bg: ['30', '80'] },
  muted: { bg: ['[0.12]'] },
  destructive: { bg: ['5', '10', '[0.12]'], border: ['40'] },
  success: { bg: ['10', '[0.12]'] },
  warning: { bg: ['10', '20', '[0.12]'] },
}

/** 登记表里的档位集合(单一真相 = ALPHA_USAGE 的键,不留第二份清单)。 */
export function alphaTiers(usage = ALPHA_USAGE) {
  return Object.keys(usage)
}

/**
 * 按类名档名在 theme.colors 树上取值。
 * preset 里既有裸档(`foreground: 'var(--color-foreground)'`),也有嵌套档
 * (`primary: { DEFAULT, foreground }` ⇒ 类名 `primary-foreground`)。
 * 嵌套档在 `theme('colors')` 的返回对象里**没有** `'primary-foreground'` 这个键,
 * 所以必须按连字符逐段下钻;首段能命中对象就递归剩余部分。命不中返回 undefined(不猜)。
 */
export function resolveThemeColor(colors, name) {
  if (!colors || typeof colors !== 'object') return undefined
  if (Object.prototype.hasOwnProperty.call(colors, name)) return colors[name]
  const parts = String(name).split('-')
  for (let i = 1; i < parts.length; i++) {
    const head = parts.slice(0, i).join('-')
    const tail = parts.slice(i).join('-')
    const sub = colors[head]
    if (sub && typeof sub === 'object') {
      const found = resolveThemeColor(sub, tail)
      if (found !== undefined) return found
    }
  }
  return undefined
}

/**
 * 把一档的颜色取值解析成 CSS 变量名。
 * 值形态有两种:裸档 `'var(--color-foreground)'`,以及带 DEFAULT 子档的对象
 * —— DEFAULT 在类名语法里就是裸档名,所以两种都要认;认不出即返回 null(不猜)。
 */
export function cssVarFromTierColor(value) {
  const single = (v) =>
    typeof v === 'string' ? (v.trim().match(/^var\(\s*(--[\w-]+)\s*\)$/) || [null, null])[1] : null
  return single(value) ?? single(value && value.DEFAULT)
}

/** 类名档名 → 通道三元组变量名(`primary-foreground` → `--color-primary-foreground-rgb`)。 */
export function channelVarForTier(colors, tier) {
  const varName = cssVarFromTierColor(resolveThemeColor(colors, tier))
  return varName ? `${varName}${ALPHA_CHANNEL_SUFFIX}` : null
}

/**
 * 修饰符 → 0..1 的 alpha 数值;认不出返回 null。
 * `'10'` → 0.1(刻度档) · `'[0.12]'` → 0.12(任意值档) · `'1'`/`'100'` → 1(上下两端)。
 * 归一到 4 位小数,保证产出串稳定可 diff(浮点尾噪会让同值写出不同文本)。
 */
export function normalizeAlpha(modifier) {
  const raw = String(modifier).trim()
  const body = /^\[(.*)\]$/.test(raw) ? raw.slice(1, -1) : raw
  const n = Number(body)
  if (!Number.isFinite(n) || n < 0) return null
  const isBareFraction = /^\[/.test(raw) || (n >= 0 && n <= 1 && !/^[0-9]+$/.test(raw))
  const a = isBareFraction ? n : n / 100
  if (a > 1) return null
  return Number(a.toFixed(4))
}

/**
 * 类名 → CSS 选择器标识符转义。
 *
 * 必须转义:v3 把 addUtilities 的键**原样**当选择器文本交给 postcss,`bg-primary/10` 里的
 * `/`、`[0.12]` 里的方括号会让 selector 解析直接抛
 * `Unexpected '/'. Escaping special characters with \ may help.`(实测:整条 tailwind 编译崩)。
 * 规则与 Tailwind 自带 escapeClassName 一致 —— 非 `[A-Za-z0-9_-]` 一律前置反斜杠;
 * selector-parser 读回的 class value 仍是不带斜杠的原类名,所以候选匹配照常。
 */
export function escapeSelectorClass(className) {
  return String(className).replace(/[^a-zA-Z0-9_-]/g, (ch) => '\\' + ch)
}

/**
 * 纯函数:按登记表产出「转义选择器 → 声明」表。不依赖 Tailwind API,便于测试喂变异输入。
 *
 * @param {Record<string, Record<string, string[]>>} usage 用量登记表(ALPHA_USAGE)
 * @param {Record<string, unknown>} colors                 preset 的 theme.extend.colors
 *                                                         (唯一 var 名来源,不在这里抄第二份)
 * @param {Record<string, (decl:string)=>Record<string,string>>} [kinds] 前缀能力表
 * @returns {{ utilities: Record<string, Record<string,string>>, unresolvable: string[], unknownKinds: string[] }}
 *   unresolvable = 登了档但 preset 里取不出单一 var 的(必须红,不能静默少产出);
 *   unknownKinds = 登了表里没有的前缀(同上)。
 */
export function buildAlphaUtilities(usage, colors, kinds = ALPHA_UTILITY_KINDS) {
  const utilities = {}
  const unresolvable = []
  const unknownKinds = []
  for (const [tier, byKind] of Object.entries(usage || {})) {
    const varName = cssVarFromTierColor(resolveThemeColor(colors, tier))
    if (!varName) {
      unresolvable.push(tier)
      continue
    }
    const triplet = `var(${varName}${ALPHA_CHANNEL_SUFFIX})`
    for (const [prefix, modifiers] of Object.entries(byKind)) {
      const makeDecl = kinds[prefix]
      if (!makeDecl) {
        unknownKinds.push(`${prefix}-${tier}`)
        continue
      }
      for (const modifier of modifiers) {
        const alpha = normalizeAlpha(modifier)
        if (alpha === null) {
          unresolvable.push(`${prefix}-${tier}/${modifier}`)
          continue
        }
        utilities[escapeSelectorClass(`${prefix}-${tier}/${modifier}`)] = makeDecl(
          `rgba(${triplet}, ${alpha})`,
        )
      }
    }
  }
  return { utilities, unresolvable, unknownKinds }
}

/** 登记表期望的通道变量名清单(tokens.css 必须逐条声明,由测试与守门 R6 双向对账)。 */
export function expectedChannelVars(usage = ALPHA_USAGE, colors) {
  const out = []
  for (const tier of alphaTiers(usage)) {
    const varName = cssVarFromTierColor(colors && colors[tier])
    if (varName) out.push(`${varName}${ALPHA_CHANNEL_SUFFIX}`)
  }
  return out.sort()
}

/** Tailwind 插件本体:只 addUtilities,不加 base/component 层、不改 theme。 */
const alphaCompatPlugin = (api) => {
  const { addUtilities, theme } = api
  const built = buildAlphaUtilities(ALPHA_USAGE, theme('colors', {}) || {})
  // 变体面给上,但当前三端**零**变体 alpha 用量 ⇒ 不产出任何额外规则(实测),
  // 等真写 `hover:bg-primary/10` 时它已经在位。
  addUtilities(built.utilities, [
    'hover',
    'focus',
    'focus-visible',
    'active',
    'dark',
    'group-hover',
  ])
}

export default alphaCompatPlugin
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
