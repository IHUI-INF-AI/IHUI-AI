// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * mobile-rn / packages/app 深色模式前景/容器回归守门(blocking)。
 *
 * 四类真实事故(2026-09-23 Drawer/StudyBar/UserInfoCard/主 CTA 深色复核):
 *  R1 品牌底白字:同一 style 对象里 `backgroundColor: (tokens|tk).brand.DEFAULT` 配
 *     `color: (tokens|tk).surface.light` / `.text.primary` —— 深色下 brand.DEFAULT
 *     翻成 #FFFFFF,前景必须用 brand.foreground(深色翻黑),否则白底白字。
 *     **2026-09-23 补盲**:原判据只认 `tokens.` 前缀,而 packages/app 共享组件一律写 `tk.`,
 *     等于共享包全程不在 R1 视野内。实测补盲后现存违规 0 处(非放宽,是真无违规)。
 *  R2 硬编码浅色容器 ratchet:`backgroundColor: tokens.surface.light`(两态恒白)、
 *     `rgba(255,255,255,α≥0.5)`(近实心白)、className `bg-white`(非 dark: 变体)。
 *     每文件计数与 scripts/brand-foreground-baseline.json 的 `counts` 比对,只减不增。
 *     范围保持 apps/mobile-rn/src(基线按此口径建立,扩范围会误伤存量)。
 *  R3 品牌实底填充 ratchet(2026-09-23 立,2026-09-24 扩面):
 *     `(backgroundColor|borderColor): (tokens|tk).brand.(DEFAULT|cta)` —— DEFAULT 在深色档案下是**纯白**
 *     (实测压 #1A1A1A 卡面 17.4:1 = 用户报的"刺眼");`brand.cta` 是主 CTA 独立档
 *     (2026-09-26 用户定稿回翻:亮=纯黑底/白字,暗=纯白底/黑字,与 DEFAULT 同一明暗行为)。
 *     **判据必须覆盖门自己产出的形态**:全仓"品牌实底+其上文字"已按 AGENTS §4 迁到 brand.cta,
 *     R1_BG 同日扩认 DEFAULT|cta,而 R3 若不同形扩面,那 235 处实底就整片搬进门盲区
 *     (实测:迁移前 R3 存量 235 → 迁移后"掉"到 87,不是债变少,是形态进了盲区)。
 *     成对即合规、不计债,但**按档配对**:DEFAULT 底 ↔ brand.foreground、cta 底 ↔ brand.ctaForeground
 *     (同块或 R4 同一套兄弟命名);跨档配对(如 DEFAULT 底 × ctaForeground)虽在现行档值下
 *     恰好同色不可辨差异,但仍破坏"底与字同档成对"的唯一写法,照计 —— 档位法则不随取值巧合松动。
 *     本条不拦存量(基线冻结),只拦"新增/回潮"。范围含 packages/app。
 *  R4 跨 key 品牌底白字(2026-09-24 立,补 R1 的结构性盲区):
 *     R1 只在**同一个 style 块**内配对背景与前景,而真实的 RN `StyleSheet.create` 把按钮的
 *     底和它的文字放在**兄弟 key** 里(`retryBtn` / `retryText`)—— 于是 PlazaScreen 四个按钮
 *     (brand.DEFAULT 底 × text.primary 字,实测对比度 1.06:1 纯黑压纯黑)一路 shipped 到真机。
 *     R4 用**名字**建立配对(`X`/`XText`、`XBtn`/`XButton` 与 `XBtnText`/`XButtonText`、
 *     `X`/`XLabel`,顺序无关),不用行距滑窗(滑窗必然误伤)。
 *     ⚠️ R1 的同块语义**一个字未改**(其他会话的 self-test 依赖它),R4 是叠加不是替换。
 *     R4 走基线棘轮(与 R2/R3 同形态,`r4Counts` 每文件计数只减不增),因为兄弟配对
 *     在别处可能合法(如整块 `surface.light` 底上的白字),先登记存量再逐档下调。
 *     **建门实测(2026-09-24 全量口径)**:兄弟配对 96 文件 / 127 对,其中
 *     `text.primary` 前景 **0 处**(线上那 4 处黑压黑已人工改为 brand.foreground),
 *     127 对**全部**是 `surface.light` 前景 —— 而 surface.light 现行档值
 *     (浅色 #FFFFFF / 深色 #262626)压 brand.DEFAULT(#000 / #FFF)两态都可见,
 *     故这些存量按"合法兄弟对"入基线,只冻不赦。任何**新增**兄弟对(含换成
 *     text.primary)都会使该文件计数超过基线 ⇒ 立即红。
 *     ⚠️ 已知残留口径:棘轮按**每文件对数**计,故"把某文件已有的 surface.light 兄弟对
 *     原地换成 text.primary 而不增减对数"这一种改写不会被 R4 拦到(它由 R1 在文字与底
 *     同块时兜,以及由 review 兜)。收紧到按前景 token 分档留待人工决策,不在本门范围。
 *  R5 web 类名面退役形态 ratchet(2026-09-24 立,补 R1..R4 的**整侧盲区**):
 *     R1..R4 解析的全是 **RN style 对象**(`backgroundColor: tokens.brand.DEFAULT`),
 *     对 web / ui-react 的 **Tailwind 类名形态完全看不见** —— 于是 AGENTS §4 已废的
 *     `bg-primary` + `text-primary-foreground` 实底配对可以在 web 侧无门看着地增长。
 *     立项时(HEAD `e15094ca` 一代)实测现存 **22 处 / 14 文件**,含 `@ihui/ui-react` Button
 *     的 6 个主按钮 variant —— 即全仓共享按钮组件本身仍是退役档。那 14 个文件当时全部被
 *     并行会话改在手里、不能就地迁移,故按棘轮设计(只减不增)。
 *     **建门当日并行会话把这 22 处迁完了**(commit `4e0b24689a` "剩余 22 处品牌实底迁到 cta 档"),
 *     所以基线的 `webClassPairCounts` 现为**空对象 = 零容忍**:这是比锁 22 更强的结果,
 *     任何**新写**的 `bg-primary`+`text-primary-foreground` 同行配对当场判红。
 *     正解写法:`bg-cta` + `text-cta-foreground`(+ `hover:bg-cta/90`)—— 该档 2026-09-26 用户定稿
 *     回翻为黑/白反转(亮=纯黑底/白字,暗=纯白底/黑字),与 --color-primary 同一明暗行为。
 *     ⚠️ 已知限制(如实登记,不假装覆盖):
 *      1) **同一行**才算一对。className 字符串在本仓就写在同一行,故对存量 22/22 全覆盖;
 *         把 `bg-primary` 与 `text-primary-foreground` 拆到两行(数组形态 / `cn()` 分行 /
 *         跨行模板串)**不计** —— 不是"更难写",而是跨行配对要么解析 JSX 属性要么滑窗,
 *         滑窗必然误伤(R4 立门时已就此留案),故宁窄不误。钉死在 self-test N6。
 *      2) **变体前缀一律不算实底**:前置 `:` `-` `/` 排除,于是
 *         `data-[state=checked]:bg-primary` + 同行 `data-[state=checked]:text-primary-foreground`
 *         (现存的 `packages/ui-react` checkbox 就是这一型)**不在 R5 视野内**。
 *         这是与"22 处"口径一致的**刻意窄口径**:同一条 `:` 规则同时也是排除 `bg-primary/90`
 *         透明档与负数类的依据,放宽它会连带把 `hover:bg-primary/90` 之类算成实底。
 *         该型是否要迁 cta 属人工决策(选中态小色块 vs 主按钮大色块观感不同),不在本门范围。
 *      3) 整行注释(`//` `/*` `*` 开头)不计 —— 零容忍门若把"文档里提到退役档"判红,
 *         等于给下一个无关提交造一条只能 `--no-verify` 的红。
 *      4) 需要故意保留时,同行或紧邻上行写 `r5-cta-exempt: <原因>`(与 `radius-exempt:` 同形态)。
 *      5) 后置 `-` `/` 排除,故 `bg-primary-foreground`(前景档)与 `bg-primary/40`(透明档)不计。
 *  R7 跨 JSX 嵌套层的品牌底 / 前景错配(2026-09-25 立,补 R1+R4 的**结构盲区**):
 *     R1 只在同一个 style 块内配对,R4 只在**名字**成兄弟(X ↔ XText / XBtn ↔ XBtnText / X ↔ XLabel)
 *     时配对。而真仓大量实例两边都不沾 —— 底在 `card`、字在 `bankName`,把两者连起来的
 *     唯一事实是**渲染嵌套**(`<View style={styles.card}>` 里出现 `<Text style={styles.bankName}>`)。
 *     立因两例(2026-09-25 人工改稿,门当时完全看不见):
 *       packages/app/src/features/bank-card/BankCardScreen.tsx               card × bankName / cardNumber
 *       packages/app/src/features/ai-assistant-n8n/AiAssistantN8nScreen.tsx  messageBubbleUser × messageTextUser
 *     另含内联在图标上的 `color={…}`(`<Plus color={tk.surface.card}/>` 在 cta 悬浮钮里)——
 *     这一型 R1/R4 结构上永远不可能看见(它根本不在 style 对象里)。
 *     **归属规则是这条判据的全部精度**:一个前景只归给**最近的、自身带背景的祖先**(含中间层
 *     View 的 style key 与内联 style);最近边界混着非品牌档(条件样式两态)→ 不判;
 *     前景候选里有一枚合法(三元两分支)→ 不判。
 *     与 R1/R4 **互斥**:兄弟命名对一律让给 R4,同块让给 R1 —— 两条判据各计同一次债会让
 *     两份基线互相顶掉(棘轮按文件计数,重复计数等于凭空给基线加额度)。
 *     ⚠️ 已知限制(如实登记,不假装覆盖):
 *      1) 只认**同文件**的 style 定义与 JSX。底在子组件、字由父组件经 `textStyle` prop 传入的
 *         跨文件组合看不见(那需要全仓解析,不是提交链跑得动的量)。
 *      2) 只收 `style=` / `contentContainerStyle=` 两个 style prop,以及元素上的 `color=`。
 *         `titleStyle` / `placeholderTextColor` 这类"同名不同层"的 prop 一律不收 ——
 *         放宽它必然造假阳,与"宁漏不误报"冲突。
 *      3) 绝对定位浮层 / Modal 里"视觉上并不压在该底色上"的元素,静态判不出来,会误归。
 *         立门时 16 处存量逐条人工核过,无一属这一型;真遇到就按流程登记棘轮,不得改判据。
 *      4) "前景归最近带背景祖先"这一条同时挡掉两类假阳:`card(cta) > badge(自有底) >
 *         badgeText(白字)`,以及 `container(surface.light)` 页面底上的普通正文 `text.primary`
 *         —— 后者若计入,全站正文都是债,门当场不可用。
 *      5) 确属合法(文字其实压在图片/渐变图上而非该底色上)时,在**容器 style 定义行**或
 *         **前景所在行**(或其紧邻上行)写 `r7-nest-exempt: <一句话原因>` 豁免该配对。
 *         不带原因不生效;一行标记只救它自己那一处(同守门 97 M2)。
 *     走基线棘轮(新键 `nestMismatchCounts`,与 counts/ctaCounts/r4Counts/webClassPairCounts
 *     互不重叠):立门当日 HEAD 实测 16 处真跨档配对,已全部人工目检成立 ⇒ 冻存量、赦新增。
 *
 * 用法:
 *   node scripts/check-brand-foreground.mjs                  # 全量
 *   node scripts/check-brand-foreground.mjs --staged         # 只看暂存文件
 *   node scripts/check-brand-foreground.mjs --update-baseline # 收紧基线(人工确认后;拒绝与 --staged 同用)
 *   node scripts/check-brand-foreground.mjs --self-test      # 逻辑自检
 * 紧急跳过:HUSKY_SKIP_BRAND_FOREGROUND=1
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
// 判定面取材的唯一出口(2026-09-26 迁,守门 118 的 loose-git 档收口)。此前本门自己派生
// `execFileSync('git', ['show', 'HEAD:<rel>'])` **逐文件**读正文 —— 裸 `'git'` 依赖 PATH
// (服务账户 / GUI 宿主与交互终端不通,AGENTS §5b),而 500+ 文件 = 500 次进程创建:本门自述
// "27–45s 的大头正是逐文件 git show 取材成本",迁成一次 batch 是唯一正确的性能修法。
// 保留 execFileSync 只用于**枚举路径清单**(ls-files / diff --cached / grep -l),不读正文。
import { Undetermined, catBatch, readWorktreeFile } from './lib/face-reader.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const BASELINE_PATH = path.join(__dirname, 'brand-foreground-baseline.json')
/**
 * R5 的基线键**必须**是新键。复用 `counts`(R2)/ `ctaCounts`(R3)/ `r4Counts`(R4)
 * 会让一次 `--update-baseline` 把另一条判据的存量当成 R5 的额度发出去(反之亦然)——
 * 三条计数面各自的"只减不增"承诺建立在键互不重叠上,故此键名单点声明、两处引用同一常量。
 */
const BASELINE_R5_KEY = 'webClassPairCounts'
/**
 * R7 的基线键同样**必须**是新键(理由与 BASELINE_R5_KEY 一字不差:四条计数面各自的
 * "只减不增"承诺建立在键互不重叠上)。R7 立门当日在 HEAD 实测 16 处**真跨档配对**
 * (逐条人工核过,见 README/AGENTS 登记),故按棘轮登记存量而非赦免。
 */
const BASELINE_R7_KEY = 'nestMismatchCounts'

const SKIP_ENV = 'HUSKY_SKIP_BRAND_FOREGROUND'
// 前缀 `tokens.`(apps/mobile-rn 端)与 `tk.`(packages/app 共享组件的别名)必须同时认,
// 否则共享包整片不在判据视野内 —— 这正是 2026-09-23 补的盲区。
const TKS = '(?:tokens|tk)'
const R1_BG = new RegExp(`backgroundColor:\\s*${TKS}\\.brand\\.(?:DEFAULT|cta)\\b`)
const R1_BAD_FG = new RegExp(`color:\\s*${TKS}\\.(?:surface\\.light|text\\.primary)\\b`)
const STYLE_OBJ_START = /^\s{2}[A-Za-z_$][\w$]*:\s*\{/
/** R4 用:任意缩进的 `key: {` 起始行(共享包样式一律在 makeStyles 内 4 空格缩进) */
const ANY_STYLE_KEY_START = /^[ \t]*([A-Za-z_$][\w$]*)\s*:\s*\{/
const STYLE_OBJ_END = /^ {2}\}/
const R2_SURFACE_LIGHT = /backgroundColor:\s*tokens\.surface\.light\b/
const R2_RGBA_WHITE = /backgroundColor:\s*['"]rgba\(255,\s*255,\s*255,\s*(0?\.\d+|1)\)/
const R2_BG_WHITE_CLASS = /\bbg-white\b/
/**
 * R3 填充面:与 R1_BG 同形(DEFAULT|cta 两档都认)。只认 DEFAULT 会让迁移后的主实底整片隐身 ——
 * 门推荐怎么写,判据就得能看见怎么写(AGENTS §4 2026-09-24 改档,教训同守门 77 B6 括号形态盲区)。
 */
const R3_BRAND_FILL = new RegExp(
  `(?:backgroundColor|borderColor):\\s*${TKS}\\.brand\\.(?:DEFAULT|cta)\\b`,
)
/** R3 分档:cta 填充的正配前景只有 brand.ctaForeground;DEFAULT 填充的正配前景只有 brand.foreground */
const R3_FILL_CTA = new RegExp(`(?:backgroundColor|borderColor):\\s*${TKS}\\.brand\\.cta\\b`)
/** R4:兄弟 key 的名字后缀(文字侧 / 底侧的角色后缀) */
const TEXT_ROLE_SUFFIXES = ['Text', 'Label']
const BG_ROLE_SUFFIXES = ['Btn', 'Button']
/** R1/R3 扫描范围:RN 端 + 跨端共享包(两者深色语义同一套 rn-tokens) */
const SCAN_DIRS = ['apps/mobile-rn/src', 'packages/app/src']
/** R2 基线口径范围(扩范围会误伤未登记的存量,故与 SCAN_DIRS 分开) */
const R2_DIR = 'apps/mobile-rn/src'
/**
 * R5 扫描范围:web 端 + 共享 React 组件包(类名形态的退役档只出现在这两处)。
 * 与 SCAN_DIRS(RN style 对象面)互不重叠 —— R1..R4 对本范围**零覆盖**,这正是 R5 立项的原因。
 */
const R5_DIRS = ['apps/web', 'packages/ui-react', 'apps/miniapp-taro']
const R5_EXT = /\.(tsx|jsx|ts)$/
/** R5 排除面:测试/e2e 里合法描述退役档,不构成 UI 债务 */
const R5_SKIP_DIR = /(^|\/)(e2e|tests|__tests__|node_modules)\//
const R5_SKIP_FILE = /\.(test|spec)\.[cm]?[jt]sx?$/
/** R5 的两个类名 token */
const R5_BG_CLASS = 'bg-primary'
const R5_FG_CLASS = 'text-primary-foreground'
/**
 * 整行注释不得计债:基线现为**零容忍**(22 处已由并行会话在 `4e0b24689a` 迁完),
 * 于是"在 JSDoc 里描述退役档"这种纯叙述行会硬拦一个毫不相关的提交 ——
 * 而恒红的 blocking 门只会逼人 `--no-verify`,连带废掉全部守门(本仓最高反面教训)。
 * 注释不是 UI 债务,不判。判据是"行首(去缩进)为 `//` `/*` `*`"。
 */
const R5_COMMENT_LINE = /^\s*(?:\/\/|\/\*|\*)/
/**
 * 行内豁免出口(零容忍门必须有人工出口,否则唯一出路是跳钩子):
 * 同行或紧邻上行写 `r5-cta-exempt: <一句话原因>` 即不计该行。与 `radius-exempt:` /
 * `statusbar-exempt:` / `brand-mail-exempt:` 同一套形态,**必须带原因**。
 */
const R5_EXEMPT = /r5-cta-exempt:/

/**
 * R5 前置:类名 token 是否作为**完整 Tailwind 类**出现在这一行。
 *
 * `indexOf` 裸匹配会把三种非实底形态也算进来,它们都属误伤(且会让棘轮被"写文档"顶红):
 *  - `bg-primary-foreground` —— 这是**前景档**,不是底;后置 `-` 排除
 *  - `bg-primary/90` —— 透明档,不是实底;后置 `/` 排除
 *  - `hover:bg-primary` / `-bg-primary` —— 变体前缀与负号;前置 `:` `-` `/` 排除
 * 后置再排 `\w`(`bg-primaryX` 不是这个类)。
 * `forbidAfter` 由调用方给:前景档允许 `/`(`text-primary-foreground/50` 仍是它作前景),
 * 底档不允许。空串(行尾/行唯一内容)必须放行 —— 注意 `'' .includes('')` 为 true,
 * 直接写成 `forbid.includes(after)` 会让"类名在行尾"这一最常见形态永不匹配(门自己造盲区)。
 *
 * @param {string} line
 * @param {string} tok 完整类名
 * @param {string} forbidAfter 后置不得出现的字符集('' 表示不额外限制)
 * @returns {boolean}
 */
export function hasClassToken(line, tok, forbidAfter) {
  let i = 0
  for (;;) {
    i = line.indexOf(tok, i)
    if (i === -1) return false
    const before = i === 0 ? '' : line[i - 1]
    const after = i + tok.length >= line.length ? '' : line[i + tok.length]
    const beforeOk = before === '' || !'-:/'.includes(before)
    const afterOk = after === '' || (!/\w/.test(after) && !forbidAfter.includes(after))
    if (beforeOk && afterOk) return true
    i += tok.length
  }
}

/**
 * R5:单文件「web 类名面退役实底配对」计数(`bg-primary` 实底 × `text-primary-foreground` 同行)。
 * 按**行**计(一行 className 就是一对),不按出现次数计,免得一行里写两个 `bg-primary` 算成两债。
 */
export function countWebClassPairs(lines) {
  let count = 0
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (R5_COMMENT_LINE.test(line)) continue
    // 豁免:同行,或紧邻上行(多行 className 的注释通常写在属性上方)
    if (R5_EXEMPT.test(line) || (i > 0 && R5_EXEMPT.test(lines[i - 1]))) continue
    if (!hasClassToken(line, R5_FG_CLASS, '')) continue
    // 实底 `bg-primary` **或** 渐变端 `from-primary`/`to-primary`。后者是 2026-09-25 补的盲区:
    // `@ihui/ui-react` Button 的 hero-cta 写 `bg-gradient-to-r from-primary to-primary/70`,
    // 行内没有 `bg-primary` —— 迁移判据与 R5 同形,于是两边一起看不见同一处。
    // 渐变两端与实底同属"品牌实底 + 其上文字",§4 不因填色是单色还是渐变而豁免。
    const solid = hasClassToken(line, R5_BG_CLASS, '-/')
    const grad = hasClassToken(line, 'from-primary', '/') || hasClassToken(line, 'to-primary', '/')
    if (solid || grad) count++
  }
  return count
}

function isR5Scope(rel) {
  const p = rel.replace(/\\/g, '/')
  return (
    R5_DIRS.some((d) => p.startsWith(`${d}/`)) &&
    R5_EXT.test(p) &&
    !R5_SKIP_DIR.test(p) &&
    !R5_SKIP_FILE.test(p)
  )
}

/**
 * R5 预筛:一次 git grep 拿到"文件里出现过这两个类名"的交集(判据的**严格超集**:
 * 同行要求比它宽,故预筛只会少判、不会漏判)。apps/web 跟踪文件上千,逐个 `git show`
 * 太慢;预筛后只剩个位数文件要读内容(口径同守门 97 的 git grep 预筛)。
 *
 * @returns {string[]|null} 相对路径数组;null = git grep 判不出来(异常/非"无匹配"退出码),
 *   调用方必须退回全量枚举 —— 把"预筛失效"表现成"零命中"等于造一台在故障现场报绿的尺子。
 */
function r5Prefilter(fromHead) {
  const revArgs = fromHead ? ['HEAD'] : ['--cached']
  const paths = ['--', ...R5_DIRS]
  const one = (pat) => {
    try {
      const out = execFileSync(
        'git',
        ['-c', 'safe.directory=*', 'grep', '-l', '-I', '-e', pat, ...revArgs, ...paths],
        {
          cwd: ROOT,
          encoding: 'utf8',
          maxBuffer: 1 << 26,
          windowsHide: true,
          timeout: 30000,
        },
      )
      return out
        .split('\n')
        .filter(Boolean)
        .map((f) => (fromHead ? f.replace(/^HEAD:/, '') : f))
    } catch (err) {
      // git grep 用 exit 1 表示"零匹配"(合法结论);其余(2 及以上 / 无 status)是判不出来
      if (err && err.status === 1) return []
      return null
    }
  }
  const fg = one(R5_FG_CLASS)
  if (fg === null) return null
  const bg = one(R5_BG_CLASS)
  if (bg === null) return null
  const bgSet = new Set(bg)
  return fg.filter((f) => bgSet.has(f))
}

/** R5 待判文件清单(全量口径:预筛 + 跟踪文件范围校验;预筛失效则退回 git ls-files 全量) */
function listR5Files() {
  const tracked = [
    ...new Set(
      execFileSync('git', ['ls-files', ...R5_DIRS], {
        cwd: ROOT,
        encoding: 'utf8',
        windowsHide: true,
        timeout: 30000,
      })
        .split('\n')
        .filter((f) => isR5Scope(f)),
    ),
  ]
  const trackedSet = new Set(tracked)
  // IHUI_R5_NO_PREFILTER=1:镜像测试用它证明「预筛 ⊇ 实际命中」在真仓成立。
  // 预筛一旦静默丢文件,两种模式的结果就会分叉 —— 而棘轮只会显示"0 处",看起来全绿。
  const pre = process.env.IHUI_R5_NO_PREFILTER === '1' ? null : r5Prefilter(true)
  const rels = pre === null ? tracked : pre.filter((f) => trackedSet.has(f))
  return {
    files: rels.map((rel) => path.join(ROOT, rel)),
    candidates: rels.length,
    scopeTotal: tracked.length,
    prefallback: pre === null,
  }
}

/** R5 待判文件清单(--staged 口径:暂存文件 ∩ R5 范围,清单已经很小,不预筛) */
function stagedR5Files() {
  const out = execFileSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACM'], {
    cwd: ROOT,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 30000,
  })
    .split('\n')
    .filter((f) => isR5Scope(f))
  return {
    files: out.map((rel) => path.join(ROOT, rel)),
    candidates: out.length,
    scopeTotal: out.length,
    prefallback: false,
  }
}

/** 从源码行提取 style 属性块(2 空格缩进的顶层样式对象),返回块文本数组 */
export function extractStyleChunks(lines) {
  const chunks = []
  let current = null
  for (const line of lines) {
    if (current === null) {
      if (STYLE_OBJ_START.test(line)) {
        // 单行闭合的对象({ 与 } 配平)自成一块,防止吞并后续样式
        const opens = (line.match(/\{/g) ?? []).length
        const closes = (line.match(/\}/g) ?? []).length
        if (opens > 0 && opens === closes) chunks.push(line)
        else current = [line]
      }
    } else {
      current.push(line)
      if (STYLE_OBJ_END.test(line)) {
        chunks.push(current.join('\n'))
        current = null
      }
    }
  }
  if (current !== null) chunks.push(current.join('\n'))
  return chunks
}

/** R1:块内(或单行)同时出现 brand.DEFAULT 背景 + 恒白前景 → 白底白字缺陷 */
export function findR1Violations(lines) {
  const violations = []
  for (const chunk of extractStyleChunks(lines)) {
    if (R1_BG.test(chunk) && R1_BAD_FG.test(chunk)) violations.push(chunk.split('\n')[0].trim())
  }
  for (const line of lines) {
    if (R1_BG.test(line) && R1_BAD_FG.test(line)) violations.push(line.trim())
  }
  return violations
}

/**
 * 逐行算括号净增量,带**跨行**的字符串/注释状态机:
 * 字符串与注释里的 `{` `}` 不得参与配平(否则 `'{}'`、模板串、注释会切错块)。
 * `'` / `"` 在行尾强制复位(JS 单双引号串不得跨行;这一条同时挡住 JSX 文本里的
 * 撇号 `don't` 把整行"吃进字符串"的失真)。模板串可跨行,故保留状态。
 */
export function computeBraceDeltas(lines) {
  const deltas = new Array(lines.length).fill(0)
  let mode = ''
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    let d = 0
    let j = 0
    while (j < line.length) {
      const two = line.slice(j, j + 2)
      if (mode === '') {
        if (two === '//') {
          mode = '//'
          break
        }
        if (two === '/*') {
          mode = '/*'
          j += 2
          continue
        }
        const ch = line[j]
        if (ch === "'" || ch === '"' || ch === '`') {
          mode = ch
          j++
          continue
        }
        if (ch === '{') d++
        else if (ch === '}') d--
        j++
      } else if (mode === '/*') {
        if (two === '*/') {
          mode = ''
          j += 2
        } else j++
      } else {
        if (line[j] === '\\') {
          j += 2
          continue
        }
        if (line[j] === mode) {
          mode = ''
          j++
          continue
        }
        j++
      }
    }
    if (mode === '//' || mode === "'" || mode === '"') mode = ''
    deltas[i] = d
  }
  return deltas
}

/**
 * R4 前置:切出**具名** style 块 `{ name: { ... } }`,返回 { name, text }[]。
 * 与 extractStyleChunks 的两点差别(均为 R4 必需,且不改 R1 语义):
 *  1) 缩进无关 —— 共享包的样式一律写成 `makeStyles()` 里 4 空格缩进的
 *     `retryBtn: {`,R1 的 `^  key:` 锚定根本看不见这类文件;
 *  2) 括号配平收口 —— 闭合行是 `} as ViewStyle,`,`^  \}` 同样对不上。
 * 只产出**同层兄弟**块:命中一个块后跳到它的闭合行之后,故嵌套块被并入父块、
 * 不再单独成块(否则父子里应归 R1 的同块关系会被误报成兄弟)。
 */
export function extractNamedStyleChunks(lines) {
  const deltas = computeBraceDeltas(lines)
  const out = []
  for (let i = 0; i < lines.length; i++) {
    const m = ANY_STYLE_KEY_START.exec(lines[i])
    if (!m) continue
    let depth = 0
    let end = lines.length - 1
    for (let j = i; j < lines.length; j++) {
      depth += deltas[j]
      if (depth <= 0) {
        end = j
        break
      }
    }
    out.push({ name: m[1], text: lines.slice(i, end + 1).join('\n'), start: i })
    i = end
  }
  return out
}

// ═══════════════════════════════════════════════════════════════════════════
// R7 —— 跨「JSX 嵌套层」的品牌底 / 前景错配(2026-09-25 立)
// ═══════════════════════════════════════════════════════════════════════════
//
// R1 只看同一个 style 块,R4 只看**名字**成兄弟的一对 —— 而真仓大量实例两边都不沾:
//
//   // packages/app/src/features/bank-card/BankCardScreen.tsx
//   card:      { backgroundColor: tk.brand.cta }     // 底
//   bankName:  { color: tk.surface.light }           // 渲染在 <View style={styles.card}> **之内**
//
//   // packages/app/src/features/ai-assistant-n8n/AiAssistantN8nScreen.tsx
//   messageBubbleUser: { backgroundColor: tk.brand.cta }
//   messageTextUser:   { color: tk.surface.light }
//
// `card` 与 `bankName` 名字毫无关系(主干不同 → R4 的 isSiblingStylePair 判否),
// 也不在同一块(→ R1 看不见)。唯一能把两者连起来的事实是 **JSX 渲染嵌套**:
// 哪个 style key 出现在哪个容器 style key 的子树里。R7 就是补这条边。
//
// 与 R1/R4 不重叠的前提:同块归 R1、兄弟名归 R4、嵌套归 R7,三条各自计数。

/**
 * **跨档矩阵**(与 AGENTS §4 的 rn-tokens 实测值一一对应,不得凭感觉扩):
 *   brand.cta      = #000000 / #ffffff(2026-09-26 回翻,与 DEFAULT 同一明暗反转)
 *   brand.DEFAULT  = #000000 / #FFFFFF(与页面反极)
 *   surface.light  = #FFFFFF / #262626   text.primary = #0A0A0A / #FAFAFA
 *   surface.card   = #FFFFFF / (深色另档)
 *
 *  - cta 底:`surface.light` / `text.primary` / `surface.card` 都不是它的配对前景档
 *    (§4 唯一正配 = brand.ctaForeground)。对比度上 `text.primary` 两态都与底同色
 *    (黑压黑 / 白压白)纯隐形;另两档虽在现行黑/白取值下碰巧可读,但按"底与字同档成对"
 *    的档位法则照判 —— 否则换回中间调底色时这些配对会静默掉出 AA。
 *  - DEFAULT 底:`surface.light` **两态都可见**(#FFF 压 #000 / #262626 压 #FFF)⇒ 不算债
 *    (R4 建门时 127 处存量全是这一型,已按"合法兄弟对"入基线,此处必须同口径)。
 *    而 `text.primary` 两态都与底同色(黑压黑 / 白压白),`brand.ctaForeground` 与常量白
 *    同判 —— 它在两态下取值与 brand.foreground 全等,写它等于把唯一写法搅成两套。
 */
const R7_BAD_ON_CTA = new Set(['surface.light', 'text.primary', 'surface.card'])
const R7_BAD_ON_DEFAULT = new Set(['text.primary', 'brand.ctaForeground'])
const R7_FILL_TIERS = new Set(['brand.cta', 'brand.DEFAULT'])
/** R7 只认这两个 props 作 style 载体(其余 *Style 如 titleStyle/highlightColor 一律不收,防串位) */
const R7_STYLE_PROPS = ['style', 'contentContainerStyle']
/**
 * R7 解析异常流水(全量模式每轮开跑前清零)。
 * 判据"看不见"必须比"判错"更响 —— 否则一次解析崩溃会把整条判据洗成恒绿。
 */
const r7ParseErrors = []

/**
 * 行内豁免出口(与 `r5-cta-exempt:` / `radius-exempt:` / `statusbar-exempt:` 同一套形态):
 * 写在**容器 style 定义行**或**前景所在行**(或其紧邻上行)任一处即豁免该配对。
 * **必须带原因** —— `r7-nest-exempt:` 后紧跟空白再换行不算数,否则豁免会退化成
 * "先加上再说"的静默通道(守门 97 M2 的同一课:一行标记只救它自己那一处)。
 */
const R7_EXEMPT = /r7-nest-exempt:\s*\S/

/** 该 1-based 行(或其紧邻上行)是否带豁免标记 */
function r7ExemptAt(lines, ln) {
  if (!ln || ln < 1 || ln > lines.length) return false
  if (R7_EXEMPT.test(lines[ln - 1])) return true
  return ln > 1 && R7_EXEMPT.test(lines[ln - 2])
}

/** 常量白(R7 视同 brand.ctaForeground 的等价物,只用于"压 brand.DEFAULT 深色档=白压白") */
function isConstantWhite(tok) {
  if (!tok) return false
  const t = tok.toLowerCase().replace(/\s+/g, '')
  if (
    t === "'#fff'" ||
    t === "'#ffffff'" ||
    t === '"#fff"' ||
    t === '"#ffffff"' ||
    t === "'white'" ||
    t === '"white"'
  )
    return true
  const rgba = t.match(/^['"]rgba\(255,255,255,(0?\.\d+|1)\)['"]$/)
  return !!rgba && Number.parseFloat(rgba[1]) >= 0.9
}

/** 某前景 token 落在某品牌档底上是否跨档错配(未知 token 一律不判 —— 宁漏不误报) */
export function r7IsMismatch(fillTier, fgTok) {
  if (!R7_FILL_TIERS.has(fillTier)) return false
  if (fgTok === 'constant-white') return fillTier === 'brand.DEFAULT'
  return (fillTier === 'brand.cta' ? R7_BAD_ON_CTA : R7_BAD_ON_DEFAULT).has(fgTok)
}

/** 从一段表达式文本里抽出 `tokens.X.Y` / `tk.X.Y` 令牌路径(取 `X.Y`) */
function tokenPathsIn(expr) {
  const out = []
  if (!expr) return out
  const re = new RegExp(`(?:^|[^\\w$.])(?:${TKS})\\.([a-zA-Z_$][\\w$]*\\.[a-zA-Z_$][\\w$]*)`, 'g')
  let m
  while ((m = re.exec(expr)) !== null) out.push(m[1])
  return out
}

/** 从一段 style 表达式里收集背景/前景令牌(具名 token 与字面量都要 —— 字面量是"边界") */
function collectInlineColors(expr) {
  const bg = new Set()
  const fg = new Set()
  if (!expr) return { bg, fg }
  let m
  const bgm = new RegExp(
    `backgroundColor\\s*:\\s*(?:${TKS})\\.([a-zA-Z_$][\\w$]*\\.[a-zA-Z_$][\\w$]*)`,
    'g',
  )
  const fgm = new RegExp(
    `(?:^|[,{\\s])color\\s*:\\s*(?:${TKS})\\.([a-zA-Z_$][\\w$]*\\.[a-zA-Z_$][\\w$]*)`,
    'g',
  )
  const litBg = /backgroundColor\s*:\s*(['"][^'"]*['"])/g
  const litFg = new RegExp(`(?:^|[,{\\s])color\\s*:\\s*(['"][^'"]*['"])`, 'g')
  while ((m = bgm.exec(expr)) !== null) bg.add(m[1])
  while ((m = fgm.exec(expr)) !== null) fg.add(m[1])
  while ((m = litBg.exec(expr)) !== null)
    bg.add(isConstantWhite(m[1]) ? 'constant-white' : 'literal')
  while ((m = litFg.exec(expr)) !== null)
    fg.add(isConstantWhite(m[1]) ? 'constant-white' : 'literal')
  return { bg, fg }
}

/**
 * style key → { bg:Set<令牌路径|'literal'>, fg:Set<令牌路径|'constant-white'|'literal'> }
 * 只收同一文件内**具名 style 块**;字面量也计入(它们构成"背景边界",见 findR7Violations)。
 */
export function collectR7StyleKeys(lines) {
  const map = new Map()
  for (const chunk of extractNamedStyleChunks(lines)) {
    const { bg, fg } = collectInlineColors(chunk.text)
    if (bg.size === 0 && fg.size === 0) continue
    const prev = map.get(chunk.name)
    if (prev) {
      // 同文件同名 key(两个 StyleSheet)取并集:两边都可能被引用,漏收会造"看不见"
      for (const v of bg) prev.bg.add(v)
      for (const v of fg) prev.fg.add(v)
    } else {
      map.set(chunk.name, { bg, fg, line: chunk.start + 1 })
    }
  }
  return map
}

/**
 * 从 style 表达式里取「被引用的 style key 名」。
 * 对象名必须**含 style**(styles / cardStyles / footerStyle…)或为单字母 `s` —— 这一条
 * 是精度关键:`a.card`、`item.card` 这类普通成员访问不得被当成样式引用而串进关系里。
 * 调用方还要再叠加 `keyMap.has(key)`(本文件确有其 key)才算成立。
 */
export function styleKeyRefsIn(expr) {
  const out = []
  if (!expr) return out
  const re = /(?:^|[^\w$.])([A-Za-z_$][\w$]*)\.([A-Za-z_$][\w$]*)\b/g
  let m
  while ((m = re.exec(expr)) !== null) {
    if (/style/i.test(m[1]) || m[1] === 's') out.push(m[2])
  }
  return out
}

/** 从 JSX 开标签属性区读 `name={...}` / `name="..."` 的值(括号配平,串内不计) */
function readJsxAttrValues(region, names) {
  const found = []
  for (const name of names) {
    const re = new RegExp(`(^|[\\s])${name}\\s*=\\s*`, 'g')
    let m
    while ((m = re.exec(region))) {
      let j = m.index + m[0].length
      if (j >= region.length) break
      const c = region[j]
      if (c === '"' || c === "'") {
        const e = region.indexOf(c, j + 1)
        if (e === -1) continue
        found.push({ name, value: region.slice(j, e + 1) })
        j = e + 1
      } else if (c === '{') {
        let depth = 0
        let k = j
        for (; k < region.length; k++) {
          const ch = region[k]
          if (ch === '"' || ch === "'" || ch === '`') {
            const e = region.indexOf(ch, k + 1)
            if (e === -1) break
            k = e
            continue
          }
          if (ch === '{') depth++
          else if (ch === '}') {
            depth--
            if (depth === 0) break
          }
        }
        if (depth !== 0) continue
        found.push({ name, value: region.slice(j + 1, k) })
      }
    }
  }
  return found
}

/**
 * 扫一个 JSX 区域,产出**带父子关系**的元素序列。
 * `st = { text, keyMap, nodes }`;`stopName` 非空时,遇到 `</stopName>` 即返回其下标。
 * 递归而非"整文件括号配平":属性表达式里以 prop 形式传入的子元素(`<FlatList renderItem={…}>`)
 * 同样是渲染后代,必须进同一棵树 —— 真仓 BankCardScreen 的 `card` 就长在 `renderItem` 里。
 */
function scanJsxRegion(st, from, to, parentIdx, stopName) {
  const { text, keyMap, nodes } = st
  let i = from
  while (i < to) {
    const c = text[i]
    const c2 = text[i + 1] || ''
    if (c === '/' && c2 === '/') {
      while (i < to && text[i] !== '\n') i++
      continue
    }
    if (c === '/' && c2 === '*') {
      const e = text.indexOf('*/', i + 2)
      i = e === -1 ? to : Math.min(e + 2, to)
      continue
    }
    if (c === '"' || c === "'") {
      const e = text.indexOf(c, i + 1)
      const nl = text.indexOf('\n', i + 1)
      i = e === -1 || (nl !== -1 && e > nl) ? i + 1 : Math.min(e + 1, to)
      continue
    }
    if (c === '`') {
      const e = text.indexOf('`', i + 1)
      i = e === -1 || e >= to ? i + 1 : Math.min(e + 1, to)
      continue
    }
    if (c === '<' && c2 === '/') {
      const m = /^<\/([A-Z][\w$]*)/.exec(text.slice(i, Math.min(to, i + 80)))
      if (m && m[1] === stopName) return i
      const g = text.indexOf('>', i)
      i = g === -1 || g >= to ? to : g + 1
      continue
    }
    if (c === '<' && /[A-Z]/.test(c2)) {
      const head = parseTagHead(text, i, to)
      if (!head) {
        i++
        continue
      }
      const attrs = maskNestedElements(text, head.attrStart, head.attrEnd)
      const keys = []
      const fg = new Set()
      const bg = new Set()
      for (const a of readJsxAttrValues(attrs, R7_STYLE_PROPS)) {
        for (const k of styleKeyRefsIn(a.value)) if (keyMap.has(k)) keys.push(k)
        const inline = collectInlineColors(a.value)
        for (const t of inline.bg) bg.add(t)
        for (const t of inline.fg) fg.add(t)
      }
      for (const a of readJsxAttrValues(attrs, ['color'])) {
        for (const t of tokenPathsIn(a.value)) fg.add(t)
        if (isConstantWhite(a.value.trim())) fg.add('constant-white')
      }
      nodes.push({ parent: parentIdx, keys, fg, bg, line: lineOf(st, i), name: head.name })
      const idx = nodes.length - 1
      scanJsxRegion(st, head.attrStart, head.attrEnd, idx, null)
      if (!head.selfClosing) {
        const closeAt = scanJsxRegion(st, head.end, to, idx, head.name)
        const g = text.indexOf('>', closeAt)
        i = g === -1 || g >= to ? to : g + 1
        continue
      }
      i = head.end
      continue
    }
    i++
  }
  return to
}

/** 由预置换行表算 1-based 行号(逐节点重新数换行会把全量扫描拖成 O(n²)) */
function lineOf(st, idx) {
  const starts = st.lineStarts
  let lo = 0
  let hi = starts.length - 1
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (starts[mid] <= idx) lo = mid
    else hi = mid - 1
  }
  return lo + 1
}

/** 解析 `<Name ...>` 的头:返回属性区 [attrStart,attrEnd) 与标签终点(含 `>` / `/>`) */
function parseTagHead(text, i, to) {
  const m = /^<([A-Z][\w$]*)/.exec(text.slice(i, Math.min(to, i + 120)))
  if (!m) return null
  let j = i + m[0].length
  let brace = 0
  let angle = 0
  const attrStart = j
  while (j < to) {
    const c = text[j]
    const c2 = text[j + 1] || ''
    if (c === '/' && c2 === '/') {
      while (j < to && text[j] !== '\n') j++
      continue
    }
    if (c === '/' && c2 === '*') {
      const e = text.indexOf('*/', j + 2)
      j = e === -1 ? to : Math.min(e + 2, to)
      continue
    }
    if (c === '"' || c === "'") {
      const e = text.indexOf(c, j + 1)
      const nl = text.indexOf('\n', j + 1)
      j = e === -1 || (nl !== -1 && e > nl) ? j + 1 : e + 1
      continue
    }
    if (c === '`') {
      const e = text.indexOf('`', j + 1)
      j = e === -1 ? j + 1 : Math.min(e + 1, to)
      continue
    }
    if (c === '{') {
      brace++
      j++
      continue
    }
    if (c === '}') {
      if (brace > 0) brace--
      j++
      continue
    }
    if (brace === 0) {
      if (c === '<') {
        angle++
        j++
        continue
      }
      if (c === '>') {
        if (angle > 0) {
          angle--
          j++
          continue
        }
        return {
          name: m[1],
          attrStart,
          attrEnd: text[j - 1] === '/' ? j - 1 : j,
          end: j + 1,
          selfClosing: text[j - 1] === '/',
        }
      }
    }
    j++
  }
  return null
}

/** 跳过一个完整元素(含其子树),返回其后继下标;解不出则前进 1 格 */
function skipElement(text, i, to) {
  const head = parseTagHead(text, i, to)
  if (!head) return i + 1
  if (head.selfClosing) return head.end
  let j = head.end
  while (j < to) {
    const c = text[j]
    const c2 = text[j + 1] || ''
    if (c === '/' && (c2 === '/' || c2 === '*')) {
      j += 2
      continue
    }
    if (c === '"' || c === "'") {
      const e = text.indexOf(c, j + 1)
      const nl = text.indexOf('\n', j + 1)
      j = e === -1 || (nl !== -1 && e > nl) ? j + 1 : e + 1
      continue
    }
    if (c === '<' && c2 === '/') {
      const m = /^<\/([A-Z][\w$]*)/.exec(text.slice(j, Math.min(to, j + 80)))
      if (m && m[1] === head.name) {
        const g = text.indexOf('>', j)
        return g === -1 || g >= to ? to : g + 1
      }
      const g = text.indexOf('>', j)
      j = g === -1 || g >= to ? to : g + 1
      continue
    }
    if (c === '<' && /[A-Z]/.test(c2)) {
      j = skipElement(text, j, to)
      continue
    }
    j++
  }
  return to
}

/**
 * 把属性区里**嵌套元素**的整段抹成空格(长度不变)。
 * 不做这一步的话:`<FlatList ListEmptyComponent={<Text style={styles.a}>} renderItem={…}>`
 * 会把子元素的 `style=` 一并算进 FlatList 自己的 style key 集 —— 于是"祖先边界"继承了
 * 孙层的背景,ArticleDetailScreen 的 `commentEmptyText` 因此被当成 `commentNickname` 的
 * 品牌底容器(实测假阳)。属性区与子树两条通道必须各收各的 style。
 */
function maskNestedElements(text, from, to) {
  let out = text.slice(from, to)
  let i = from
  while (i < to) {
    const c = text[i]
    const c2 = text[i + 1] || ''
    if (c === '<' && /[A-Z]/.test(c2)) {
      const end = skipElement(text, i, to)
      const head = out.slice(0, i - from)
      const tail = out.slice(Math.min(end, to) - from)
      out = head + ' '.repeat(Math.max(0, Math.min(end, to) - i)) + tail
      i = end
      continue
    }
    i++
  }
  return out
}

/**
 * R7:容器风格的品牌实底 × **嵌套在其内的**前景跨档错配。
 * 归属规则(本条精度的全部来源):一个前景 token 只归给**最近的、自身带背景的祖先**
 * (含中间层 View 的 style key / 内联 style)。最近边界不是品牌档 → 不判。
 * 这条边界规则同时挡掉两类假阳:
 *  ① `card(cta)` 里的 `badge(rgba 白)` 上的 `badgeText(surface.light)` —— 实际底是 badge;
 *  ② `container(surface.light)` 页面底上的 `title(text.primary)` —— 与品牌档无关。
 * 自身 key 自带的 bg+color 组合归 R1、兄弟 key 归 R4,故这里**从父级开始**找边界。
 */
export function findR7Violations(lines) {
  const joined = lines.join('\n')
  // 便宜的入场券:文件里既无品牌底也无 R7 视野内的前景 token ⇒ 直接跳过
  // (全量面 600+ 文件,不做这一步会把提交链从秒级拖到十秒级)
  if (!/\b(?:brand)\s*\.\s*(?:cta|DEFAULT)\b/.test(joined)) return []
  const keyMap = collectR7StyleKeys(lines)
  if (keyMap.size === 0) return []
  const nodes = []
  const st = {
    text: joined,
    keyMap,
    nodes,
    lineStarts: [0],
  }
  for (let k = 0; k < joined.length; k++) if (joined[k] === '\n') st.lineStarts.push(k + 1)
  try {
    scanJsxRegion(st, 0, joined.length, -1, null)
  } catch (err) {
    // 解析异常不得冒报,但**也绝不静默**:计入 r7ParseErrors,由 run() 如实打印
    // (恒绿的判据比红判据危险 —— 本仓"扫到 0 必须先怀疑判据"的同一条教训)
    r7ParseErrors.push(`${err && err.message ? err.message : String(err)}`)
    return []
  }
  /** 祖先边界缓存:同一父链重复展开会把热点文件算成平方级 */
  const boundaryCache = new Map()
  const boundaryOf = (nodeIdx) => {
    if (boundaryCache.has(nodeIdx)) return boundaryCache.get(nodeIdx)
    let p = nodes[nodeIdx].parent
    let found = null
    while (p >= 0) {
      const node = nodes[p]
      const bgSet = new Set(node.bg)
      for (const k of node.keys) {
        const info = keyMap.get(k)
        if (info) for (const t of info.bg) bgSet.add(t)
      }
      if (bgSet.size > 0) {
        found = { node, bgSet }
        break
      }
      p = node.parent
    }
    boundaryCache.set(nodeIdx, found)
    return found
  }
  const out = []
  const seen = new Set()
  for (let n = 0; n < nodes.length; n++) {
    const fgSet = new Set(nodes[n].fg)
    for (const k of nodes[n].keys) {
      const info = keyMap.get(k)
      if (info) for (const t of info.fg) fgSet.add(t)
    }
    if (fgSet.size === 0) continue
    const boundary = boundaryOf(n)
    if (!boundary) continue
    const tiers = [...boundary.bgSet].filter((t) => R7_FILL_TIERS.has(t))
    // 边界背景**全部**是品牌档才判:混着一档非品牌底(条件样式两态)时归属不确定
    if (tiers.length === 0 || tiers.length !== boundary.bgSet.size) continue
    const fgs = [...fgSet]
    const bad = fgs.filter((t) => tiers.every((tier) => r7IsMismatch(tier, t)))
    // 有一枚前景合法(如 `color={active ? ctaForeground : surface.light}` 三元)⇒ 不判
    if (bad.length === 0 || bad.length !== fgs.length) continue
    /** 该前景 token 的**定义行**(用于 `r7-nest-exempt:` 的逐行落点;内联 color= 没有定义行) */
    const fgOwner = new Map()
    for (const k of nodes[n].keys) {
      const info = keyMap.get(k)
      if (!info) continue
      for (const t of info.fg) if (!fgOwner.has(t)) fgOwner.set(t, info.line)
    }
    const cname = boundary.node.keys[0] || null
    const container = cname || `${tiers[0]}(inline)`
    const containerLine = (cname && keyMap.get(cname)?.line) || boundary.node.line
    for (const b of bad) {
      const fgName = nodes[n].keys[0] || `${b}(@JSX)`
      // R7 与 R1/R4 **必须互斥**,否则同一次债被两道判据各计一次、基线彼此打架:
      //  同块归 R1(结构上不可能:底与字来自两个 key)、兄弟命名归 R4(`X` × `XText`)。
      //  剩下的"名字毫无关系、只靠渲染嵌套成立"才是 R7 的独有面 —— 也正是 R1/R4 的盲区。
      if (cname && isSiblingStylePair(cname, nodes[n].keys[0])) continue
      // 行内豁免:容器 style 定义行、前景 style 定义行、或前景所在 JSX 行
      // (各含其紧邻上行)任一处标了 `r7-nest-exempt: <原因>` 即不计该配对
      if (
        r7ExemptAt(lines, containerLine) ||
        r7ExemptAt(lines, fgOwner.get(b)) ||
        r7ExemptAt(lines, nodes[n].line)
      )
        continue
      const sig = `${container}×${fgName}×${b}`
      if (seen.has(sig)) continue
      seen.add(sig)
      out.push({
        container,
        containerLine,
        fg: fgName,
        fgTok: b,
        fgLine: nodes[n].line,
        tier: tiers[0],
      })
    }
  }
  return out
}

/**
 * 一个 style key 名字可能指代的"元素主干"集合。
 * `retryBtn` → {retryBtn, retry};`chatBtnText` → {chatBtnText, chatBtn, chat};
 * `card` → {card}。名字必须**真的**带后缀才剥(camelCase 大小写敏感),
 * 所以 `retry` 不会被当成 `xRetry`(无后缀关系)。
 */
function styleNameCores(name) {
  const cores = new Set([name])
  const strip = (s, suffixes) => {
    const hit = []
    for (const suf of suffixes) {
      if (s.length > suf.length && s.endsWith(suf)) hit.push(s.slice(0, -suf.length))
    }
    return hit
  }
  for (const t of strip(name, TEXT_ROLE_SUFFIXES)) {
    cores.add(t)
    for (const b of strip(t, BG_ROLE_SUFFIXES)) cores.add(b)
  }
  for (const b of strip(name, BG_ROLE_SUFFIXES)) cores.add(b)
  return cores
}

/** 名字是否构成同一视觉元素的「底 / 字」兄弟对(顺序无关,只看名字,不看行距) */
export function isSiblingStylePair(bgKey, fgKey) {
  if (!bgKey || !fgKey || bgKey === fgKey) return false
  const bgCores = styleNameCores(bgKey)
  for (const core of styleNameCores(fgKey)) if (bgCores.has(core)) return true
  return false
}

/**
 * R4:brand.DEFAULT 底在 key A、surface.light/text.primary 字在**兄弟** key B。
 * 返回 'A×B' 形态的配对清单(同块情形归 R1,这里 A!==B 故天然不重叠)。
 */
export function findR4Violations(lines) {
  const chunks = extractNamedStyleChunks(lines)
  const bgKeys = chunks.filter((c) => R1_BG.test(c.text)).map((c) => c.name)
  const fgKeys = chunks.filter((c) => R1_BAD_FG.test(c.text)).map((c) => c.name)
  const pairs = []
  for (const bg of bgKeys) {
    for (const fg of fgKeys) {
      if (isSiblingStylePair(bg, fg)) pairs.push(`${bg}×${fg}`)
    }
  }
  return pairs
}

/** R2:单文件「浅色容器」计数(surface.light 背景 / α≥0.5 白 rgba / 非 dark: 的 bg-white) */
export function countLightContainers(lines) {
  let count = 0
  for (const line of lines) {
    if (R2_SURFACE_LIGHT.test(line)) count++
    const rgba = line.match(R2_RGBA_WHITE)
    if (rgba && Number.parseFloat(rgba[1]) >= 0.5) count++
    if (R2_BG_WHITE_CLASS.test(line) && !line.includes('dark:bg-')) count++
  }
  return count
}

/** 某 style 块内是否用了 brand.foreground(= DEFAULT 底的正配前景) */
const BRAND_FG = new RegExp(`(?:^|[,{\\s])color:\\s*${TKS}\\.brand\\.foreground\\b`)
/** 某 style 块内是否用了 brand.ctaForeground(= brand.cta 底的正配前景,2026-09-24 改档) */
const BRAND_FG_CTA = new RegExp(`(?:^|[,{\\s])color:\\s*${TKS}\\.brand\\.ctaForeground\\b`)

/**
 * R3:单文件「品牌实底(brand.DEFAULT / brand.cta 作填充/描边)」计数。
 *
 * **不计** §4 认可的成对主 CTA,但**按档配对**:
 *  - DEFAULT 填充 ↔ `color: *.brand.foreground`(深色档案翻黑)
 *  - cta 填充 ↔ `color: *.brand.ctaForeground`(明暗同值白字)
 *  前景在填充所在 style 块自己带,或其**兄弟键**(X ↔ XText / XBtn ↔ XBtnText / X ↔ XLabel ——
 *  用 R4 同一套命名配对)使用时豁免。跨档配对不放行:DEFAULT 底 × ctaForeground 在深色档案下
 *  是白压白,恰属该计的债。
 *
 * 为什么必须排除成对的:AGENTS §4 规定主 CTA 的唯一写法就是"实底 + 配对前景"这套两档
 * (旧档 DEFAULT+foreground、新档 cta+ctaForeground)。再按规矩写就计债,等于"按规矩写就红" ——
 * 而恒红的 blocking 门只会逼人 `--no-verify`,连带废掉全部守门。
 * 不合法的用法仍然计:实底 × text.primary/surface.light 字由 R1、R4 判红;
 * 而**完全没有**配对前景的实底卡片(R3 原本真正要拦的东西)照旧计数。
 */
export function countCtaFills(lines) {
  const deltas = computeBraceDeltas(lines)
  const ownerAt = new Array(lines.length).fill(null)
  const fgKeysDefault = new Set()
  const fgKeysCta = new Set()
  for (let i = 0; i < lines.length; i++) {
    const m = ANY_STYLE_KEY_START.exec(lines[i])
    if (!m) continue
    let depth = 0
    let end = lines.length - 1
    for (let j = i; j < lines.length; j++) {
      depth += deltas[j]
      if (depth <= 0) {
        end = j
        break
      }
    }
    const block = lines.slice(i, end + 1).join('\n')
    if (BRAND_FG.test(block)) fgKeysDefault.add(m[1])
    if (BRAND_FG_CTA.test(block)) fgKeysCta.add(m[1])
    for (let k = i; k <= end; k++) if (ownerAt[k] === null) ownerAt[k] = m[1]
    i = end
  }
  let count = 0
  for (let i = 0; i < lines.length; i++) {
    if (!R3_BRAND_FILL.test(lines[i])) continue
    // 按档取前景集:cta 填充只认 ctaForeground,DEFAULT 填充只认 foreground
    const fgKeys = R3_FILL_CTA.test(lines[i]) ? fgKeysCta : fgKeysDefault
    const owner = ownerAt[i]
    if (owner && fgKeys.has(owner)) continue
    let paired = false
    for (const k of fgKeys) {
      if (isSiblingStylePair(owner, k)) {
        paired = true
        break
      }
    }
    if (paired) continue
    count++
  }
  return count
}

function isR2Scope(rel) {
  return rel.replace(/\\/g, '/').startsWith(`${R2_DIR}/`)
}

function listTargetFiles() {
  // git ls-files 只取跟踪文件,避免扫到 gitignore 的临时副本
  const out = execFileSync('git', ['ls-files', ...SCAN_DIRS], {
    cwd: ROOT,
    encoding: 'utf8',
    windowsHide: true,
  })
    .split('\n')
    .filter((f) => /\.(ts|tsx)$/.test(f))
  return out.map((rel) => path.join(ROOT, rel))
}

function stagedFiles() {
  const out = execFileSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACM'], {
    cwd: ROOT,
    encoding: 'utf8',
    windowsHide: true,
  })
    .split('\n')
    .filter((f) => SCAN_DIRS.some((d) => f.startsWith(`${d}/`) && /\.(ts|tsx)$/.test(f)))
  return out.map((rel) => path.join(ROOT, rel))
}

/**
 * 取一批 blob 正文 —— **一次 `cat-file --batch`**,不是逐文件派生(2026-09-26 迁)。
 *
 * 本门自述"27–45s 的大头是既有的逐文件 `git show` 取材成本"(AGENTS 守门 83 R7 条),
 * 而这正是要防的 fork 风暴:HEAD 面一次扫 500+ 文件 = 500 次进程创建。
 * 原先还有两处独立缺陷一起走:
 *   · 裸 `'git'` 依赖 PATH —— 服务账户 / GUI 宿主的 PATH 与交互终端不通(AGENTS §5b);
 *   · 任何一次派生失败被 `catch { return null }` 吞掉 ⇒ "我自己的 git 跑不起来"表现成
 *     "这些文件都不在 HEAD" ⇒ 判据少扫一整片而账面全绿(一道假绿的尺子)。
 * 现在:批次跑不成 ⇒ 抛 Undetermined ⇒ 对外 exit 2「无法判定」;单个路径不在这一面 ⇒ null,
 * 由 readText 按面各自的规则处置(全量档降级取工作树、暂存档判死)。
 *
 * @param batch 注入点 —— self-test 用它**构造**「同一条路径在索引面脏、在 HEAD 面干净」的现场,
 *   不真改仓库、也不依赖并发会话此刻往索引里放了什么。
 */
function prefetchFace(root, rev, rels, batch = null) {
  const out = new Map()
  const uniq = [...new Set(rels)]
  if (uniq.length === 0) return out
  const specs = uniq.map((r) => `${rev}:${r}`)
  const opts = { maxBuffer: 1 << 29, timeout: 120000 }
  // `catBatch(...)` 必须**逐字出现在调用点**:守门 118 只认真的使用了层的读取入口,
  // 把 catBatch 写成形参默认值再调 `batch(...)` 会被判成 half-wired(引了层却没用它读)。
  const got = batch ? batch(root, specs, opts) : catBatch(root, specs, opts)
  for (let i = 0; i < uniq.length; i++) out.set(uniq[i], got.get(specs[i]) ?? null)
  return out
}

/** 当次判定的这一轮:被审内容(rel → 正文|null)与它来自哪一面。 */
let faceTexts = new Map()
let faceMode = 'head'

/**
 * 判据取内容的口径(2026-09-26 起两面都经 `scripts/lib/face-reader.mjs`):
 *   · 全量 ⇒ **HEAD blob**;HEAD 没有该路径(并发会话刚 `git add` 的新文件)⇒ 降级取工作树;
 *     两面都没有 ⇒ null(不判、不猜),与改判前一致。
 *   · `--staged` ⇒ **索引 blob**;取不到 ⇒ 抛 Undetermined ⇒ 对外 exit 2。
 *     旧写法在这里读的是**磁盘**,即"盘上随后改对不算修好"那一型 —— 提交进去的仍是索引这一份。
 *
 * 共享工作树对成百上千个路径滞后 HEAD(§12d 的 commit-tree/merge-tree 旁路只推进 HEAD 与
 * 索引、从不 checkout),按磁盘判会让这道门在"恒红"与"假绿"之间来回跳,并把错数写回棘轮基线
 * (本仓 2026-09-24 一天内 R3 登记被整文件回退三次即此型)。守门 77 / 57 / 70 同取向。
 *
 * @returns 判据文本行数组;null = 该面与磁盘都没有该文件(不判,不猜)
 */
function readText(file) {
  const rel = path.relative(ROOT, file).replace(/\\/g, '/')
  const t = faceTexts.get(rel)
  if (typeof t === 'string') return t.split('\n')
  if (faceMode === 'staged')
    throw new Undetermined(`${rel}: 索引 blob 取不到 —— --staged 面无法判定(不回退磁盘、不静默跳过)`)
  const wt = readWorktreeFile(ROOT, rel)
  return typeof wt === 'string' ? wt.split('\n') : null
}

function run(options) {
  if (process.env[SKIP_ENV] === '1') {
    console.log(`⏭ ${SKIP_ENV}=1,跳过 mobile-rn 前景/容器守门`)
    return 0
  }
  // 基线是全量口径:与 --staged 同用会拿"暂存子集"覆盖整份基线,把未暂存文件的
  // 存量清零 → 下次全量恒红或误拦(与 scan-hardcoded-zh 同一条护栏)。
  if (options.updateBaseline && options.staged) {
    console.error('❌ --update-baseline 不得与 --staged 同用(基线须按全量口径收紧)')
    return 1
  }
  const all = listTargetFiles()
  const files = options.staged ? stagedFiles().filter((f) => all.includes(f)) : all
  // R5 覆盖面(web 类名面)与上面两条 RN 清单互不重叠,必须各自成立:
  // 只有两边都空才允许早退,否则"只改了 web 的提交"会整门跳过,R5 永远不醒(判据存在而永不调用 = 没有)。
  const r5Scan = options.staged ? stagedR5Files() : listR5Files()
  faceMode = options.staged ? 'staged' : 'head'
  console.log(
    `📎 内容口径:${faceMode === 'staged' ? '索引 blob(git show :<path>,一次 cat-file --batch)' : 'HEAD blob(一次 cat-file --batch;HEAD 无此路径才降级工作树)'} —— 工作树滞后不参与判定`,
  )
  if (options.staged && files.length === 0 && r5Scan.files.length === 0) {
    console.log(
      '⏭ 暂存区无 apps/mobile-rn/src、packages/app/src、apps/web、packages/ui-react、apps/miniapp-taro 文件,跳过',
    )
    return 0
  }
  // **先 prefetch 再 read**:层内 read() 对未预取的路径会抛,这里不偷偷补派生(退化必须被看见)。
  // 清单与内容必须同一轮、同一个面 —— 否则"枚举读盘 + 内容读 git"会造出自洽但基准错位的假绿。
  try {
    faceTexts = prefetchFace(
      ROOT,
      faceMode === 'staged' ? '' : 'HEAD',
      [...files, ...r5Scan.files].map((f) => path.relative(ROOT, f).replace(/\\/g, '/')),
    )
  } catch (e) {
    const msg = e instanceof Undetermined ? e.message : e?.message ?? String(e)
    console.error(`❌ 无法判定(exit 2):${msg}`)
    if (!(e instanceof Undetermined)) console.error(e?.stack ?? '')
    return 2
  }
  // 暂存档的"取不到"必须在**判之前**就问出来:readText 里的 throw 是结构护栏(自检第三条钉它),
  // 但让异常从采集循环里冒出去会被外层当成脚本异常,措辞与退出码都不是判据给的这套。
  if (faceMode === 'staged') {
    const missing = [...files, ...r5Scan.files]
      .map((f) => path.relative(ROOT, f).replace(/\\/g, '/'))
      .filter((rel) => typeof faceTexts.get(rel) !== 'string')
    if (missing.length > 0) {
      console.error(
        `❌ 无法判定(exit 2):${missing.length} 个暂存路径取不到索引 blob(${missing.slice(0, 5).join(', ')}${missing.length > 5 ? ' …' : ''})—— 不回退磁盘、不静默跳过`,
      )
      return 2
    }
  }

  const r1 = []
  const counts = {}
  const ctaCounts = {}
  const r4ByFile = {}
  const r7ByFile = {}
  r7ParseErrors.length = 0
  for (const file of files) {
    const rel = path.relative(ROOT, file).replace(/\\/g, '/')
    const lines = readText(file)
    if (lines === null) continue
    for (const v of findR1Violations(lines)) r1.push(`${rel} → ${v}`)
    const r4Pairs = findR4Violations(lines)
    if (r4Pairs.length > 0) r4ByFile[rel] = r4Pairs
    const r7Items = findR7Violations(lines)
    if (r7Items.length > 0) r7ByFile[rel] = r7Items
    if (isR2Scope(rel)) {
      const c = countLightContainers(lines)
      if (c > 0) counts[rel] = c
    }
    const cc = countCtaFills(lines)
    if (cc > 0) ctaCounts[rel] = cc
  }
  // R5:web / ui-react 类名面(同一 readText 口径 —— 全量判 HEAD blob、--staged 判暂存,绝不读磁盘)
  const webClassPairCounts = {}
  for (const file of r5Scan.files) {
    const rel = path.relative(ROOT, file).replace(/\\/g, '/')
    const lines = readText(file)
    if (lines === null) continue
    const c = countWebClassPairs(lines)
    if (c > 0) webClassPairCounts[rel] = c
  }
  const r4Counts = {}
  for (const [rel, pairs] of Object.entries(r4ByFile)) r4Counts[rel] = pairs.length
  const nestMismatchCounts = {}
  for (const [rel, items] of Object.entries(r7ByFile)) nestMismatchCounts[rel] = items.length

  if (options.updateBaseline) {
    // 重新校准只重写五个计数面;他人手记的文档性注记(如 pairedCtaNotVisibleToRule)
    // 不得被回写吞掉 —— 那是"计数为什么这样"的取证,吞了等于下一个人只能重查一遍。
    const prev = existsSync(BASELINE_PATH) ? JSON.parse(readFileSync(BASELINE_PATH, 'utf8')) : {}
    const {
      counts: _omitCounts,
      ctaCounts: _omitCta,
      r4Counts: _omitR4,
      webClassPairCounts: _omitWebPair,
      nestMismatchCounts: _omitNest,
      ...notes
    } = prev
    writeFileSync(
      BASELINE_PATH,
      `${JSON.stringify(
        { counts, ctaCounts, r4Counts, webClassPairCounts, nestMismatchCounts, ...notes },
        null,
        2,
      )}\n`,
    )
    const sum = (o) =>
      `${Object.keys(o).length} 文件 / ${Object.values(o).reduce((a, b) => a + b, 0)} 处`
    console.log(
      `✅ 基线已更新:R2 ${sum(counts)};R3 ${sum(ctaCounts)};R4 ${sum(r4Counts)};R5 ${sum(webClassPairCounts)};R7 ${sum(nestMismatchCounts)}`,
    )
    return 0
  }

  let failed = false
  if (r1.length > 0) {
    failed = true
    console.error(
      `❌ R1 品牌底白字(brand.DEFAULT 背景 + surface.light/text.primary 前景,深色下白底白字):${r1.length} 处`,
    )
    for (const v of r1) console.error(`   ${v}`)
  }

  const baseline = existsSync(BASELINE_PATH) ? JSON.parse(readFileSync(BASELINE_PATH, 'utf8')) : {}
  const r2 = []
  for (const [file, count] of Object.entries(counts)) {
    const allowed = baseline.counts?.[file] ?? 0
    if (count > allowed) r2.push(`${file}: ${count} > 基线 ${allowed}`)
  }
  if (r2.length > 0) {
    failed = true
    console.error(`❌ R2 新增硬编码浅色容器(基线棘轮,只减不增):${r2.length} 文件`)
    for (const v of r2) console.error(`   ${v}`)
  }

  const r3 = []
  for (const [file, count] of Object.entries(ctaCounts)) {
    const allowed = baseline.ctaCounts?.[file] ?? 0
    if (count > allowed) r3.push(`${file}: ${count} > 基线 ${allowed}`)
  }
  if (r3.length > 0) {
    failed = true
    console.error(
      `❌ R3 新增品牌实底(brand.DEFAULT/brand.cta 作填充或描边,未与配对前景成文,基线棘轮只减不增):${r3.length} 文件`,
    )
    for (const v of r3) console.error(`   ${v}`)
  }

  const r4 = []
  const r4Detail = []
  let r4Total = 0
  for (const [file, pairs] of Object.entries(r4ByFile)) {
    r4Total += pairs.length
    const allowed = baseline.r4Counts?.[file] ?? 0
    if (pairs.length > allowed) {
      r4.push(`${file}: ${pairs.length} > 基线 ${allowed}`)
      for (const p of pairs) r4Detail.push(`   ${file} → ${p}`)
    }
  }
  if (r4.length > 0) {
    failed = true
    console.error(
      `❌ R4 跨 key 品牌底白字(兄弟 key:brand.DEFAULT 底 × surface.light/text.primary 字,基线棘轮只减不增):${r4.length} 文件`,
    )
    for (const v of r4) console.error(`   ${v}`)
    for (const v of r4Detail) console.error(v)
  }

  const r5 = []
  let r5Total = 0
  for (const [file, count] of Object.entries(webClassPairCounts)) {
    r5Total += count
    const allowed = baseline[BASELINE_R5_KEY]?.[file] ?? 0
    if (count > allowed) r5.push(`${file}: ${count} > 基线 ${allowed}`)
  }
  if (r5.length > 0) {
    failed = true
    console.error(
      `❌ R5 web 类名面新增退役主按钮配对(bg-primary 实底 + text-primary-foreground 同行,AGENTS §4 已于 2026-09-24 改档,基线棘轮只减不增):${r5.length} 文件`,
    )
    for (const v of r5) console.error(`   ${v}`)
    console.error(
      '   改为 bg-cta / text-cta-foreground / hover:bg-cta/90(= RN 侧 brand.cta + brand.ctaForeground)',
    )
    console.error('   单独复验:node scripts/check-brand-foreground.mjs --staged')
  }

  const r7 = []
  let r7Total = 0
  if (r7ParseErrors.length > 0) {
    console.error(
      `⚠️ R7 解析异常 ${r7ParseErrors.length} 处(该轮这些文件**未按 R7 判定**,不得当成"已清"): ${r7ParseErrors.slice(0, 3).join(' / ')}`,
    )
  }
  for (const [file, items] of Object.entries(r7ByFile)) {
    r7Total += items.length
    const allowed = baseline[BASELINE_R7_KEY]?.[file] ?? 0
    if (items.length > allowed) {
      r7.push(`${file}: ${items.length} > 基线 ${allowed}`)
      for (const it of items) {
        console.error(
          `   ${file} → L${it.containerLine} ${it.container}(底=${it.tier}) 内 L${it.fgLine} ${it.fg}(字=${it.fgTok}) —— 跨档`,
        )
      }
    }
  }
  if (r7.length > 0) {
    failed = true
    console.error(
      `❌ R7 跨 JSX 嵌套层的品牌底/前景错配(容器 style key 与文字 style key **既不同块也不同名**,只有渲染嵌套能把它们连起来;基线棘轮只减不增):${r7.length} 文件`,
    )
    for (const v of r7) console.error(`   ${v}`)
    console.error(
      '   底取 brand.cta 时文字**只能**取 brand.ctaForeground;底取 brand.DEFAULT 时只能取 brand.foreground。',
    )
    console.error(
      '   surface.light / text.primary / surface.card 都不是品牌底的配对前景档(§4 唯一正配 = 同档 foreground;黑/白反转下 text.primary 更是两态纯隐形)。',
    )
    console.error(
      '   确属合法(文字实际压在图片/渐变图上,不压在该底色上)时:在容器 style 行或前景行写 `r7-nest-exempt: <原因>`。',
    )
    console.error('   单独复验:node scripts/check-brand-foreground.mjs --staged')
  }

  if (failed) {
    console.error(
      [
        '',
        '  💡 修复:容器背景用 tokens.surface.card / surface.muted / surface.inputBg;',
        '     品牌底(brand.DEFAULT)上的文字用 tokens.brand.foreground(深色自动翻黑);',
        '     R4 与 R1 同一缺陷,只是底和字被拆到了兄弟 key(retryBtn / retryText):',
        '     配对由**名字**成立,故改法是给文字 key 换前景 brand.foreground;',
        '     ⚠️ brand.ctaFill / ctaText 已于 2026-09-24 删除(AGENTS §4 品牌 CTA 同源),',
        '        不得作为修法加回来 —— 悬空引用由守门 90 R3 判红;',
        '        要调主按钮观感,改 tokens.css 的 --color-cta **一处**(它不分 .dark,明暗两态同时动);',
        '     主 CTA / 选中态胶囊 / 悬浮钮一律 brand.cta + brand.ctaForeground 成对(= web 的',
        '     --color-cta + --color-cta-foreground,明暗同值不反转)—— 不要逐处硬写颜色;',
        '     brand.DEFAULT / --color-primary 只保留墨色、描边、文字色三义,**不再**作大色块底',
        '     (2026-09-24 改档;旧写法亮=纯黑/暗=纯白,与页面反极);',
        '     R5(web / ui-react 类名面)唯一正解:bg-cta + text-cta-foreground(+ hover:bg-cta/90),',
        '     对应 RN 侧 brand.cta + brand.ctaForeground —— bg-primary/text-primary-foreground 是',
        '     2026-09-24 已废的退役档(明暗反极,用户实拍"浅色一大片黑 / 深色一大片白");',
        '     R7(跨 JSX 嵌套层)与 R1/R4 同一缺陷,只是底和字**连名字都不共享**:',
        '     `card:{backgroundColor:brand.cta}` 里渲染 `<Text style={styles.bankName}/>`,',
        '     改法只有一处 —— 给那个文字 key 换 brand.ctaForeground(不得换 surface.light);',
        '     内联在图标上的 `color={…}` 同理(`<Plus color={tk.surface.card}/>` 在 cta 悬浮钮里):',
        '     图标不是"装饰白",它取哪一档由**它所在容器**决定;',
        '     覆盖在图片/彩色底上的白色前景属合法,基线棘轮只拦「比基线更多」。',
        '     收紧基线(人工确认后,全量口径):node scripts/check-brand-foreground.mjs --update-baseline',
        '     自检:node scripts/check-brand-foreground.mjs --self-test',
        `     紧急跳过(不推荐):${SKIP_ENV}=1 git commit ...`,
        '',
      ].join('\n'),
    )
    return 1
  }
  console.log(
    `✅ mobile-rn/共享包 前景/容器守门通过(${files.length} 文件,R1=0,R4 ${r4Total} 处全部 ≤ 基线,R7 ${r7Total} 处全部 ≤ 基线,R2/R3 全部 ≤ 基线;R3 存量 ${Object.values(ctaCounts).reduce((a, b) => a + b, 0)} 处)`,
  )
  // R5 的"范围文件数 / 候选数"必须与"命中数"同行打印:预筛(git grep)或范围正则一旦静默失效,
  // 命中数会掉到 0 而棘轮依然全绿 —— 只有把分母摆出来,镜像测试才能区分
  // "债真的清完了"与"门瞎了"(本仓硬规则:报 0 的判据必须有阳性对照撑着)。
  console.log(
    `✅ R5 web 类名面守门通过(范围 ${r5Scan.scopeTotal} 文件 → 候选 ${r5Scan.candidates}${r5Scan.prefallback ? '[预筛关闭/失效,已退回全量]' : ''},存量 ${r5Total} 处 / ${Object.keys(webClassPairCounts).length} 文件,全部 ≤ 基线)`,
  )
  return 0
}

function selfTest() {
  const assert = (cond, msg) => {
    if (!cond) {
      console.error(`❌ self-test 失败: ${msg}`)
      process.exit(1)
    }
  }
  // R1 正例:同一块内 brand 背景 + 恒白前景
  assert(
    findR1Violations([
      '  btn: {',
      '    backgroundColor: tokens.brand.DEFAULT,',
      '    color: tokens.surface.light,',
      '  },',
    ]).length === 1,
    'R1 应命中同块 brand 背景 + surface.light 前景',
  )
  // R1 正例:text.primary 前景同样恒白(深色)
  // ⚠️ 这条断言钉的是 **R1 的同块语义**,不得因为 R4 上线而放宽 —— 其他会话依赖 R1 只判同块。
  // 跨块那一半由 R4 负责(见下方 R4 用例组),这里必须继续为 0。
  assert(
    findR1Violations([
      '  btn: {',
      '    backgroundColor: tokens.brand.DEFAULT,',
      '  },',
      '  btnText: {',
      '    color: tokens.text.primary,',
      '  },',
    ]).length === 0,
    'R1 不应跨块命中(text.primary 在另一块)',
  )
  // R1 反例:brand.foreground 是正确前景
  assert(
    findR1Violations([
      '  btn: {',
      '    backgroundColor: tokens.brand.DEFAULT,',
      '    color: tokens.brand.foreground,',
      '  },',
    ]).length === 0,
    'R1 不应命中 brand.foreground',
  )
  // R2 计数
  assert(
    countLightContainers(['    backgroundColor: tokens.surface.light,']) === 1,
    'R2 surface.light 计 1',
  )
  assert(
    countLightContainers(["    backgroundColor: 'rgba(255,255,255,0.6)',"]) === 1,
    'R2 α=0.6 计 1',
  )
  assert(
    countLightContainers(["    backgroundColor: 'rgba(255, 255, 255, 0.18)',"]) === 0,
    'R2 α=0.18 是淡出层不计',
  )
  assert(
    countLightContainers(['<View className="flex-1 bg-white">']) === 1,
    'R2 className bg-white 计 1(Drawer 事故形态)',
  )
  assert(
    countLightContainers(['<View className="bg-white dark:bg-gray-900">']) === 0,
    'R2 dark: 变体不计',
  )
  assert(
    countLightContainers([
      '  tabActive: {',
      '    backgroundColor: tokens.brand.DEFAULT,',
      '  },',
    ]) === 0,
    'R2 brand 背景不计',
  )
  // 块提取:未闭合块也应产出
  assert(extractStyleChunks(['  a: {', '    x: 1,']).length === 1, '未闭合块仍应提取')
  // R1 补盲:packages/app 共享组件一律写 `tk.`,原判据只认 tokens. → 共享包整片不可见
  assert(
    findR1Violations([
      '  btn: {',
      '    backgroundColor: tk.brand.DEFAULT,',
      '    color: tk.surface.light,',
      '  },',
    ]).length === 1,
    'R1 应命中 tk. 前缀(共享包补盲)',
  )
  assert(
    findR1Violations([
      '  btn: {',
      '    backgroundColor: tk.brand.DEFAULT,',
      '    color: tk.text.primary,',
      '  },',
    ]).length === 1,
    'R1 应命中 tk. 前缀 + text.primary 前景',
  )
  assert(
    findR1Violations([
      '  btn: {',
      '    backgroundColor: tk.brand.DEFAULT,',
      '    color: tk.brand.foreground,',
      '  },',
    ]).length === 0,
    'R1 不应命中 tk.brand.foreground(正确前景)',
  )
  // === R4 跨 key 兄弟配对(2026-09-24 立,PlazaScreen 四个黑压黑按钮的根治)===
  // R4 与 R1 的分工必须钉死:同块归 R1、兄弟 key 归 R4,两边都不得沉默。
  assert(
    extractNamedStyleChunks(['  retryBtn: {', '    x: 1,', '  },']).length === 1,
    'R4 具名块:多行块应提取 1 块',
  )
  assert(
    extractNamedStyleChunks(['  retryBtn: {', '    x: 1,', '  },'])[0].name === 'retryBtn',
    'R4 具名块:key 名须为 retryBtn',
  )
  assert(
    extractNamedStyleChunks(['  retryBtn: { backgroundColor: tk.brand.DEFAULT },'])
      .map((c) => c.name)
      .join() === 'retryBtn',
    'R4 具名块:单行闭合块同样提取 key 名',
  )
  // (a) retryBtn + retryText 兄弟对 → 命中(线上真实事故形态)
  assert(
    findR4Violations([
      '  retryBtn: {',
      '    backgroundColor: tk.brand.DEFAULT,',
      '  },',
      '  retryText: {',
      '    color: tk.text.primary,',
      '  },',
    ]).join() === 'retryBtn×retryText',
    'R4 (a) 应命中 retryBtn × retryText',
  )
  // (b) 文字 key 在前、背景 key 在后 → 顺序无关,仍命中
  assert(
    findR4Violations([
      '  chatBtnText: {',
      '    color: tk.text.primary,',
      '  },',
      '  chatBtn: {',
      '    backgroundColor: tk.brand.DEFAULT,',
      '  },',
    ]).join() === 'chatBtn×chatBtnText',
    'R4 (b) 不得依赖 key 出现顺序',
  )
  // (c) ctaFill + ctaText 配对 → 不命中(底不是 brand.DEFAULT,R4 无从成立)
  //     注:ctaFill/ctaText 已于 2026-09-24 退役(AGENTS §4),此处只作"非 brand.DEFAULT 底
  //     不得命中"的负向夹具,不构成对这两个键的推荐。
  assert(
    findR4Violations([
      '  ctaFill: {',
      '    backgroundColor: tk.brand.ctaFill,',
      '  },',
      '  ctaText: {',
      '    color: tk.brand.ctaText,',
      '  },',
    ]).length === 0,
    'R4 (c) 不应命中非 brand.DEFAULT 底(ctaFill/ctaText 夹具)',
  )
  // (d) brand.DEFAULT 底 + brand.foreground 字 → 不命中(前景合法)
  assert(
    findR4Violations([
      '  retryBtn: {',
      '    backgroundColor: tk.brand.DEFAULT,',
      '  },',
      '  retryText: {',
      '    color: tk.brand.foreground,',
      '  },',
    ]).length === 0,
    'R4 (d) 不应命中 brand.foreground 前景',
  )
  // (e) 名字必须**真的**配对:card 有底、avatarText 有字,但主干不同 → 不命中
  assert(
    findR4Violations([
      '  card: {',
      '    backgroundColor: tk.brand.DEFAULT,',
      '  },',
      '  avatarText: {',
      '    color: tk.text.primary,',
      '  },',
    ]).length === 0,
    'R4 (e) 名字不成对时不得靠滑窗误伤',
  )
  // (f) XBtn + XBtnText → 命中
  assert(
    findR4Violations([
      '  submitBtn: {',
      '    backgroundColor: tokens.brand.DEFAULT,',
      '  },',
      '  submitBtnText: {',
      '    color: tokens.surface.light,',
      '  },',
    ]).join() === 'submitBtn×submitBtnText',
    'R4 (f) 应命中 XBtn × XBtnText',
  )
  // 名字关系单测:XButton + XButtonText / X + XLabel 同为合法配对
  assert(isSiblingStylePair('shareButton', 'shareButtonText'), 'R4 名字:XButton × XButtonText 成对')

  // R5 范围必须真的含小程序端 —— 缩回范围会让已迁的 37 处重新隐身,且不会有任何声响
  assert(
    [
      [
        'apps/miniapp-taro/src/components/Carousel.tsx',
        ["  x: 'bg-primary text-primary-foreground'"],
      ],
      ['apps/web/src/App.tsx', ["  x: 'bg-primary text-primary-foreground'"]],
      [
        'packages/ui-react/src/components/button.tsx',
        ["  x: 'bg-primary text-primary-foreground'"],
      ],
    ].every(([f, L]) => isR5Scope(f) && countWebClassPairs(L) === 1),
    'R5-S1 三端(web / ui-react / miniapp-taro)都必须在 R5 视野内且能计 1',
  )
  assert(!isR5Scope('apps/mobile-rn/src/App.tsx'), 'R5-S2 RN 端不属类名面范围(它走 R1/R3/R4)')

  assert(isSiblingStylePair('section', 'sectionLabel'), 'R4 名字:X × XLabel 成对')
  assert(isSiblingStylePair('retryBtn', 'retryText'), 'R4 名字:跨后缀 XBtn × XText 成对')
  assert(!isSiblingStylePair('retryBtn', 'retryBtn'), 'R4 名字:同 key 不成对(归 R1 管辖)')
  assert(!isSiblingStylePair('primaryBtn', 'secondaryText'), 'R4 名字:主干不同不得成对')
  assert(isSiblingStylePair('Btn', 'BtnText'), 'R4 名字:Btn × BtnText 走 X/XText 规则成对')
  // 真新缺陷不得因为"同时命中 R1"而被 R4 沉默:同块 + 兄弟 key 同时存在 → 两条各自计数
  assert(
    findR1Violations([
      '  btn: {',
      '    backgroundColor: tk.brand.DEFAULT,',
      '    color: tk.text.primary,',
      '  },',
    ]).length === 1,
    'R4 上线后 R1 同块语义不变(阳性对照)',
  )
  assert(
    findR4Violations([
      '  btn: {',
      '    backgroundColor: tk.brand.DEFAULT,',
      '    height: 32,',
      '  },',
      '  btnText: {',
      '    color: tk.text.primary,',
      '  },',
      '  unrelated: {',
      '    padding: 4,',
      '  },',
    ]).length === 1,
    'R4 应命中 btn × btnText(且只 1 对)',
  )
  // 块提取的配平卫生:字符串 / 注释内的括号不得参与收口
  assert(computeBraceDeltas(["  a: { content: '{}',"])[0] === 1, 'R4 配平:串内 {} 不计')
  assert(computeBraceDeltas(['  a: { // } 注释里的闭包不计'])[0] === 1, 'R4 配平:// 注释内不计')
  assert(
    computeBraceDeltas(['  a: {', "    t: 'don\\'t',", '  },'])[2] === -1,
    'R4 配平:转义引号不得吃掉后文',
  )
  assert(
    extractNamedStyleChunks([
      '  a: {',
      "    label: 'x: {',",
      '  },',
      '  b: { color: tk.text.primary },',
    ]).length === 2,
    'R4 具名块:串内 `key: {` 不得额外成块',
  )
  // R3:brand.DEFAULT/brand.cta 填充/描边计数(端内自立的 ctaFill 不是任何一档正解,不认)
  assert(
    countCtaFills(['    backgroundColor: tokens.brand.DEFAULT,']) === 1,
    'R3 tokens.brand.DEFAULT 背景计 1',
  )
  assert(
    countCtaFills(['    borderColor: tk.brand.DEFAULT,']) === 1,
    'R3 tk.brand.DEFAULT 描边计 1',
  )
  assert(
    countCtaFills(['    backgroundColor: tokens.brand.ctaFill,']) === 0,
    'R3 不应命中 ctaFill(正解)',
  )
  assert(countCtaFills(['    color: tokens.brand.foreground,']) === 0, 'R3 不计前景色')
  // R3 口径(2026-09-24 补):§4 成对主 CTA 不计债;无配对/错配前景仍计 —— 三条都要有对照
  assert(
    countCtaFills([
      '  btn: {',
      '    backgroundColor: tk.brand.DEFAULT,',
      '    color: tk.brand.foreground,',
      '  },',
    ]) === 0,
    'R3 同块成对(brand.foreground)不计 —— 这是按 §4 写的正确主 CTA',
  )
  assert(
    countCtaFills([
      '  btn: {',
      '    backgroundColor: tk.brand.DEFAULT,',
      '  },',
      '  btnText: {',
      '    color: tk.brand.foreground,',
      '  },',
    ]) === 0,
    'R3 兄弟键成对(xBtn ↔ xBtnText)同样不计(与 R4 同一套命名配对)',
  )
  assert(
    countCtaFills(['  card: {', '    backgroundColor: tk.brand.DEFAULT,', '  },']) === 1,
    'R3 反向对照:无任何配对前景的白卡片必须仍计 1',
  )
  assert(
    countCtaFills([
      '  card: {',
      '    backgroundColor: tk.brand.DEFAULT,',
      '  },',
      '  cardText: {',
      '    color: tk.text.primary,',
      '  },',
    ]) === 1,
    'R3 反向对照:配 text.primary(非 brand.foreground)的填充不得被当成已配对放行',
  )
  assert(
    countCtaFills(['    backgroundColor: tokens.brand.DEFAULTISH,']) === 0,
    'R3 边界:同前缀字段不得误计',
  )
  // ═══ 2026-09-24 补盲:brand.cta 是主 CTA 改档后的**唯一实底写法**(AGENTS §4),
  //     R1/R3/R4 必须能看见它 —— 判据必须覆盖门自己产出的形态(教训同守门 77 B6 括号盲区)。═══
  // F1 R1 坏例子:cta 实底 + 同块 surface.light → 必红(surface.light 非配对前景档;档位法则判,不靠对比度巧合)
  assert(
    findR1Violations([
      '  btn: {',
      '    backgroundColor: tokens.brand.cta,',
      '    color: tokens.surface.light,',
      '  },',
    ]).length === 1,
    'R1-F1 应命中 cta 底 + surface.light(跨档错配)',
  )
  // F2 R1 好例子:cta 实底 + 同块 ctaForeground → 必绿(§4 成对即合规)
  assert(
    findR1Violations([
      '  btn: {',
      '    backgroundColor: tokens.brand.cta,',
      '    color: tokens.brand.ctaForeground,',
      '  },',
    ]).length === 0,
    'R1-F2 不应命中 cta + ctaForeground(成对即合规)',
  )
  // F3 R4 兄弟键形态:retryBtn(cta 底)× retryText(surface.light 字)→ 必命中
  assert(
    findR4Violations([
      '  retryBtn: {',
      '    backgroundColor: tk.brand.cta,',
      '  },',
      '  retryText: {',
      '    color: tk.surface.light,',
      '  },',
    ]).join() === 'retryBtn×retryText',
    'R4-F3 应命中 retryBtn(cta) × retryText(surface.light)',
  )
  // F4 R3 计数:cta 填充必须计(修盲区前这一组实测 0 = 235 处实底整片隐身的确证)
  assert(
    countCtaFills(['    backgroundColor: tk.brand.cta,']) === 1,
    'R3-F4 tk.brand.cta 背景计 1(修前为 0 ⇒ 盲区)',
  )
  assert(
    countCtaFills(['    borderColor: tokens.brand.cta,']) === 1,
    'R3-F4 tokens.brand.cta 描边计 1',
  )
  // F4b R3 按档配对:cta ↔ ctaForeground(同块/兄弟)豁免;跨档配对仍计债
  assert(
    countCtaFills([
      '  btn: {',
      '    backgroundColor: tk.brand.cta,',
      '    color: tk.brand.ctaForeground,',
      '  },',
    ]) === 0,
    'R3-F4b cta 同块成对(ctaForeground)不计',
  )
  assert(
    countCtaFills([
      '  btn: {',
      '    backgroundColor: tk.brand.cta,',
      '  },',
      '  btnText: {',
      '    color: tk.brand.ctaForeground,',
      '  },',
    ]) === 0,
    'R3-F4b cta 兄弟键成对(ctaForeground)不计',
  )
  assert(
    countCtaFills([
      '  btn: {',
      '    backgroundColor: tk.brand.cta,',
      '    color: tk.brand.foreground,',
      '  },',
    ]) === 1,
    'R3-F4b 跨档(cta 底 × brand.foreground)不认作配对,仍计 1',
  )
  assert(
    countCtaFills([
      '  btn: {',
      '    backgroundColor: tk.brand.DEFAULT,',
      '    color: tk.brand.ctaForeground,',
      '  },',
    ]) === 1,
    'R3-F4b 跨档(DEFAULT 底 × ctaForeground,深色档案=白压白)不认作配对,仍计 1',
  )
  assert(
    countCtaFills(['    backgroundColor: tk.brand.ctaForegroundish,']) === 0,
    'R3 边界:ctaForeground 不得被当成填充误计',
  )
  // F5 反向对照:把 R1_BG/R3_BRAND_FILL 退回只认 DEFAULT 时,F1/F4 夹具必须变绿 ——
  //    证明那几条断言真的在守"扩认 cta"这个点,而不是碰巧过(谁改回去,这几条当场红)。
  const legacyR1BG = /backgroundColor:\s*(?:tokens|tk)\.brand\.DEFAULT\b/
  const legacyR3Fill = /(?:backgroundColor|borderColor):\s*(?:tokens|tk)\.brand\.DEFAULT\b/
  assert(
    legacyR1BG.test('    backgroundColor: tokens.brand.DEFAULT,'),
    'F5 前提:旧 R1_BG 对 DEFAULT 行是匹配的',
  )
  assert(
    !legacyR1BG.test('    backgroundColor: tokens.brand.cta,'),
    'F5 旧 R1_BG(只认 DEFAULT)对 cta 行必不匹配 ⇒ F1 的红只可能来自扩面',
  )
  assert(R1_BG.test('    backgroundColor: tokens.brand.cta,'), 'F5 现 R1_BG 必须匹配 cta 填充行')
  assert(
    !legacyR3Fill.test('    backgroundColor: tk.brand.cta,'),
    'F5 旧 R3 判据对 cta 行必不匹配 ⇒ F4 的计 1 只可能来自扩面',
  )
  assert(
    R3_BRAND_FILL.test('    backgroundColor: tk.brand.cta,'),
    'F5 现 R3_BRAND_FILL 必须匹配 cta 填充行',
  )
  assert(
    R3_BRAND_FILL.test('    borderColor: tk.brand.DEFAULT,'),
    'F5 现 R3_BRAND_FILL 对 DEFAULT 描边仍匹配(扩面不缩旧面)',
  )
  assert(
    !R3_BRAND_FILL.test('    backgroundColor: tk.brand.ctaForeground,'),
    'F5 R3 不得把 ctaForeground(前景档)当填充',
  )
  // ═══ R5(2026-09-24 立):web / ui-react 类名面的退役主按钮配对 ═══
  // 本仓硬规则:判据报"0 处"不可信,除非同一判据先拿**已知应命中**的正例喂过一遍。
  // 故 P 组(阳性对照)在前,N 组(反向对照)逐条钉住词法边界 —— 两组都必须存在。
  // (P1) 真仓形态:packages/ui-react/src/components/button.tsx:21 的原文一行,必须计 1
  assert(
    countWebClassPairs([
      "    default: 'bg-primary text-primary-foreground shadow hover:bg-primary/90',",
    ]) === 1,
    'R5-P1 阳性对照:实底 bg-primary + 同行 text-primary-foreground 必须计 1(否则整条判据是瞎的)',
  )
  // (P2) 真仓形态:apps/web 页面按钮原文一行(带一堆间距/圆角类,不影响判定)
  assert(
    countWebClassPairs([
      '          className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"',
    ]) === 1,
    'R5-P2 阳性对照:JSX className 属性形态同样计 1',
  )
  // (P3) 类名落在**行尾**:`'' .includes('')` 为 true,naive 写法会让这一行永不匹配 ——
  //      而 `'bg-primary text-primary-foreground'` 这种结尾形态恰恰是最常见写法。
  assert(
    countWebClassPairs(['bg-primary text-primary-foreground']) === 1,
    'R5-P3 行尾前景档必须计 1(空后置陷阱)',
  )
  // (N1) 只有透明档 `bg-primary/90` + 前景 → 不是实底,不计
  assert(
    countWebClassPairs(["  x: 'bg-primary/90 text-primary-foreground'"]) === 0,
    'R5-N1 bg-primary/90 是透明档,不计',
  )
  // (N2) `bg-primary-foreground` 是前景档不是底 → 不计(naive includes 会误计,故必须钉)
  assert(
    countWebClassPairs(["  x: 'bg-primary-foreground text-primary-foreground'"]) === 0,
    'R5-N2 后置 `-` 必须排除',
  )
  // (N3) 变体前缀 `hover:bg-primary` → 前置 `:` 排除,该行没有实底
  assert(
    countWebClassPairs(["  x: 'hover:bg-primary text-primary-foreground'"]) === 0,
    'R5-N3 变体前置 `:` 必须排除',
  )
  // (N4) `text-primary`(墨色文字)+ 合法 bg-cta → 与新档无关,不计
  assert(
    countWebClassPairs(["  x: 'bg-cta text-primary text-cta-foreground'"]) === 0,
    'R5-N4 正解档 bg-cta 绝不得计债',
  )
  // (N5) 只有一半:有实底无前景 → 不成对,不计(R5 判的是"底字同行配对",不是查 bg-primary 本身)
  assert(countWebClassPairs(["  x: 'bg-primary text-xs'"]) === 0, 'R5-N5 无同行前景不计')
  // 渐变端形态(hero-cta 事故形态):必须计 1
  assert(
    countWebClassPairs([
      "        'bg-gradient-to-r from-primary to-primary/70 text-primary-foreground shadow-md px-8 py-3',",
    ]) === 1,
    'R5-P4 渐变端 from-primary × text-primary-foreground 必须计 1(实底判据看不见它)',
  )
  assert(
    countWebClassPairs(["  x: 'bg-gradient-to-r from-cta to-cta/70 text-cta-foreground'"]) === 0,
    'R5-N6 渐变正解档 from-cta/to-cta 不得计债(反向对照,证明 P4 不是无条件放行)',
  )
  assert(
    countWebClassPairs(["  x: 'from-primary to-emerald-500 text-xs'"]) === 0,
    'R5-N7 渐变端但无同行前景不计',
  )
  // (N6) 已知限制:**跨行**拆开的配对不计(见文件头 R5 限制①)—— 本条把该限制钉成契约,
  //      谁将来实现了跨行判定,这条会红并强制他回来改注释,而不是让限制悄悄变成隐债。
  assert(
    countWebClassPairs(["  x: 'bg-primary", "    text-primary-foreground'"]) === 0,
    'R5-N6 限制契约:跨行配对当前不计(实现跨行判定时须同步改本断言与头注)',
  )
  // (N7) 一行两处实底也只算**一对**(按行计,不按出现次数膨胀)
  assert(
    countWebClassPairs(["  x: 'bg-primary bg-primary text-primary-foreground'"]) === 1,
    'R5-N7 按行计:同行重复实底不得膨胀成 2',
  )
  // (N8) 整行注释不计(零容忍门下,注释里提到退役档不得拦住无关提交)—— 真仓实测形态:
  //      apps/web/app/(main)/models/ModelsNav.tsx 的 JSDoc 就照原样写着这两个类名。
  assert(
    countWebClassPairs([
      '   * - active 态:bg-primary + text-primary-foreground(主色填充,无下划线)',
    ]) === 0,
    'R5-N8 整行注释不计(真仓 ModelsNav.tsx:33 形态)',
  )
  assert(
    countWebClassPairs(['// bg-primary text-primary-foreground 已废']) === 0,
    'R5-N8b 行注释不计',
  )
  // (N9) 行内豁免出口必须真起作用(零容忍门若没有人出口,唯一出路就是 --no-verify)
  assert(
    countWebClassPairs([
      "      'bg-primary text-primary-foreground' // r5-cta-exempt: 覆盖在图片上的合法浮层",
    ]) === 0,
    'R5-N9 同行 r5-cta-exempt 豁免必须生效',
  )
  assert(
    countWebClassPairs([
      '  // r5-cta-exempt: 旧截图预览底色',
      "  x: 'bg-primary text-primary-foreground'",
    ]) === 0,
    'R5-N9b 紧邻上行豁免必须生效',
  )
  assert(
    countWebClassPairs([
      "  x: 'bg-primary text-primary-foreground'",
      "  y: 'bg-primary text-primary-foreground'",
    ]) === 2,
    'R5-N9c 反向:豁免不得外溢到后续行(一行标记救不了同文件另一处,同守门 97 M2)',
  )
  // (N10) 前向登记的盲区:变体前缀 `data-[state=checked]:bg-primary` 不判为实底
  //       (真仓 packages/ui-react/checkbox.tsx:28 即此型)。本条不是"验收",而是把窄口径钉成契约:
  //       谁放宽 `:` 规则,这条会红并强制他回来改注释与基线,而不是让口径悄悄漂移。
  assert(
    countWebClassPairs([
      "      'data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground hover:border-foreground/60',",
    ]) === 0,
    'R5-N10 已登记盲区:变体前缀形态不判(放宽此条须同步改头注限制②与基线)',
  )
  // 变异对照:naive `includes` 判据会把 N1/N2/N3 三条全计成债 —— 证明上面那三条的红真挂在词法规则上,
  // 而不是"恰好没匹配上"。谁把 hasClassToken 退化回 includes,R5-N1..N3 当场红。
  const naiveR5 = (l) => l.includes(R5_BG_CLASS) && l.includes(R5_FG_CLASS)
  const r5NaiveFixtures = [
    ["  x: 'bg-primary/90 text-primary-foreground'", '透明档'],
    ["  x: 'bg-primary-foreground text-primary-foreground'", '前景档当底'],
    ["  x: 'hover:bg-primary text-primary-foreground'", '变体前缀'],
  ]
  for (const [i, [line, label]] of r5NaiveFixtures.entries()) {
    assert(
      naiveR5(line) === true,
      `R5 变异对照前提 ${i + 1}(${label}):naive 判据应对该行误计(否则本对照无意义)`,
    )
    assert(
      countWebClassPairs([line]) === 0,
      `R5 变异对照 ${i + 1}(${label})必须由词法规则判 0,不得靠 naive 碰巧`,
    )
  }
  // hasClassToken 的边界单测(它同时服务 R5 两侧,判据本身要能单独取证)
  assert(
    hasClassToken('bg-primary', 'bg-primary', '-/') === true,
    'R5 词法:整行只有一个类名(前后皆空)必须匹配',
  )
  assert(hasClassToken('bg-primaryFoo', 'bg-primary', '-/') === false, 'R5 词法:后置字母不得算整词')
  assert(hasClassToken('bg-primary/90', 'bg-primary', '-/') === false, 'R5 词法:后置 `/` 排除')
  assert(
    hasClassToken('bg-primary-foreground', 'bg-primary', '-/') === false,
    'R5 词法:后置 `-` 排除',
  )
  assert(hasClassToken('-bg-primary', 'bg-primary', '-/') === false, 'R5 词法:前置 `-` 排除')
  assert(hasClassToken('hover:bg-primary', 'bg-primary', '-/') === false, 'R5 词法:前置 `:` 排除')
  assert(
    hasClassToken('text-primary-foreground/50', R5_FG_CLASS, '') === true,
    'R5 词法:前景档允许带透明后缀仍算前景',
  )
  assert(hasClassToken('text-primary-foo', R5_FG_CLASS, '') === false, 'R5 词法:前景档必须整词')
  // R5 范围口径:测试面/e2e 不判,非 tsx/jsx/ts 不判
  assert(isR5Scope('apps/web/src/components/x.tsx'), 'R5 范围:apps/web .tsx 在射程内')
  assert(
    isR5Scope('packages/ui-react/src/components/button.tsx'),
    'R5 范围:ui-react 在射程内(共享按钮组件本身仍是退役档)',
  )
  assert(!isR5Scope('apps/web/e2e/icon-text-alignment.spec.ts'), 'R5 范围:e2e 不判')
  assert(!isR5Scope('apps/web/src/components/x.test.tsx'), 'R5 范围:*.test.tsx 不判')
  assert(!isR5Scope('apps/mobile-rn/src/components/X.tsx'), 'R5 范围:RN 端归 R1..R4,不在 R5')
  assert(!isR5Scope('apps/web/app/globals.css'), 'R5 范围:css 不在 R5(类名形态只出现在 ts/tsx/jsx)')
  assert(!isR5Scope('packages/shared/src/utils/x.ts'), 'R5 范围:未列入的包不判')
  // 基线键必须独立:R5 用 webClassPairCounts,不得复用 counts/ctaCounts/r4Counts
  assert(BASELINE_R5_KEY === 'webClassPairCounts', 'R5 基线键必须是新键 webClassPairCounts')
  // ═══ R7(2026-09-25 立):跨 JSX 嵌套层的品牌底 / 前景错配 ═══
  // 本仓硬规则:"判据报 0" 必须配阳性对照。R7 报 0 处比 R1..R5 更危险 —— 它靠一棵
  // 手搓的 JSX 树,树一旦解不出来就静默退化成"没有违规"。故 P 组两条就是用户点名的
  // 两个真仓实例的原样形态,必须红;N 组钉住三类会造假阳的形态。
  const sig = (v) => v.map((x) => `${x.container}×${x.fg}×${x.fgTok}`).join()
  // (P1) 真仓形态:BankCardScreen 的 card(cta) 内渲染 bankName(surface.light)
  assert(
    sig(
      findR7Violations([
        '    card: {',
        '      padding: 12,',
        '      backgroundColor: tk.brand.cta,',
        '    },',
        '    bankName: { fontSize: 16, fontWeight: "600", color: tk.surface.light },',
        '  return (',
        '    <View style={styles.card}>',
        '      <Text style={styles.bankName}>{item.bankName}</Text>',
        '    </View>',
        '  )',
      ]),
    ) === 'card×bankName×surface.light',
    'R7-P1 阳性对照:card(cta) × bankName(surface.light) 必命中(真仓 BankCardScreen 原样形态)',
  )
  // (P2) 真仓形态:AiAssistantN8nScreen 的消息气泡 —— 名字同样毫无关系
  assert(
    sig(
      findR7Violations([
        '    messageBubbleUser: { backgroundColor: tk.brand.cta, padding: 8 },',
        '    messageTextUser: { color: tk.surface.light },',
        '  return (',
        '    <View style={styles.messageBubbleUser}>',
        '      <Text style={styles.messageTextUser}>{msg.content}</Text>',
        '    </View>',
        '  )',
      ]),
    ) === 'messageBubbleUser×messageTextUser×surface.light',
    'R7-P2 阳性对照:messageBubbleUser(cta) × messageTextUser(surface.light) 必命中',
  )
  // (P3) 内联在图标上的 color prop(R1/R4 结构上永远看不见这一型)
  assert(
    findR7Violations([
      '    sendBtn: { backgroundColor: tk.brand.cta, width: 40 },',
      '  return (',
      '    <TouchableOpacity style={styles.sendBtn}>',
      '      <Send size={18} color={tk.surface.light} />',
      '    </TouchableOpacity>',
      '  )',
    ]).length === 1,
    'R7-P3 内联 color={…} 的图标前景同样归容器档位',
  )
  // (N1) 正确成对:cta 底 + ctaForeground 文字 → 必绿(按 §4 写就红 = 逼人 --no-verify)
  assert(
    findR7Violations([
      '    card: { backgroundColor: tk.brand.cta },',
      '    cardTitle: { color: tk.brand.ctaForeground },',
      '  return (<View style={styles.card}><Text style={styles.cardTitle}>x</Text></View>)',
    ]).length === 0,
    'R7-N1 成对(cta + ctaForeground)不得计债',
  )
  // (N2) 非嵌套的兄弟 key:文字不在容器里渲染 → R7 无从成立(它归 R4)
  assert(
    findR7Violations([
      '    card: { backgroundColor: tk.brand.cta },',
      '    bankName: { color: tk.surface.light },',
      '  return (',
      '    <View>',
      '      <View style={styles.card} />',
      '      <Text style={styles.bankName}>x</Text>',
      '    </View>',
      '  )',
    ]).length === 0,
    'R7-N2 平行兄弟元素(未嵌套)不得被当成"底上的字"',
  )
  // (N3) 前景归**最近的带背景祖先**:card(cta) > badge(自有底) > badgeText(surface.light)
  assert(
    findR7Violations([
      '    card: { backgroundColor: tk.brand.cta },',
      "    badge: { backgroundColor: 'rgba(255,255,255,0.25)' },",
      '    badgeText: { fontSize: 10, color: tk.surface.light },',
      '  return (',
      '    <View style={styles.card}>',
      '      <View style={styles.badge}>',
      '        <Text style={styles.badgeText}>x</Text>',
      '      </View>',
      '    </View>',
      '  )',
    ]).length === 0,
    'R7-N3 中间层自带背景时它是归属边界(真仓 BankCardScreen.badge 即此型)',
  )
  // (N4) 前景来自非品牌背景:页面底 surface.light 上的 text.primary 与品牌档无关
  assert(
    findR7Violations([
      '    container: { flex: 1, backgroundColor: tk.surface.light },',
      '    title: { fontSize: 20, color: tk.text.primary },',
      '  return (<View style={styles.container}><Text style={styles.title}>x</Text></View>)',
    ]).length === 0,
    'R7-N4 非品牌底容器内的前景一律不判(否则全站正文都成债)',
  )
  // (N5) 条件三元前景:有一枚前景合法即放过 —— 判不出归属时不得猜
  assert(
    findR7Violations([
      '    card: { backgroundColor: tk.brand.cta },',
      '    label: { color: tk.surface.light },',
      '  return (',
      '    <View style={styles.card}>',
      '      <Text style={active ? styles.label : styles.labelOn}>x</Text>',
      '    </View>',
      '  )',
      '    labelOn: { color: tk.brand.ctaForeground },',
    ]).length === 0,
    'R7-N5 前景候选里只要有一枚合法就不判(宁漏不误报)',
  )
  // (N6) R7 与 R4 互斥:X × XText 兄弟命名归 R4,不得被两条判据各计一次
  assert(
    findR7Violations([
      '    retryBtn: { backgroundColor: tk.brand.cta },',
      '    retryText: { color: tk.surface.light },',
      '  return (<View style={styles.retryBtn}><Text style={styles.retryText}>x</Text></View>)',
    ]).length === 0,
    'R7-N6 兄弟命名对归 R4(重叠计数会让两条基线互相顶掉)',
  )
  // (N7) 名字无关系但**确属**兄弟族的另一型:linkBtn+copyBtn 复合底 × linkBtnText
  //      copyBtn 与 linkBtnText 不成 R4 兄弟对(主干 copy vs linkBtn),但底来自 copyBtn
  assert(
    sig(
      findR7Violations([
        '    linkBtn: { flex: 1, alignItems: "center" },',
        '    copyBtn: { backgroundColor: tk.brand.cta },',
        '    linkBtnText: { fontSize: 14, color: tk.surface.light },',
        '  return (',
        '    <TouchableOpacity style={[styles.linkBtn, styles.copyBtn]}>',
        '      <Text style={styles.linkBtnText}>x</Text>',
        '    </TouchableOpacity>',
        '  )',
      ]),
    ) === 'copyBtn×linkBtnText×surface.light',
    'R7-N7 数组复合 style 的底必须参与归属(真仓 PromoteScreen 即此型)',
  )
  // (N8) 属性里的子元素不得算作宿主的 style(ListEmptyComponent 型假阳的回归钉)
  assert(
    findR7Violations([
      '    emptyText: { color: tk.text.tertiary },',
      '    itemBody: { padding: 8 },',
      '    itemTitle: { color: tk.text.primary },',
      '  return (',
      '    <FlatList',
      '      ListEmptyComponent={<Text style={styles.emptyText}>无</Text>}',
      '      renderItem={() => (',
      '        <View style={styles.itemBody}>',
      '          <Text style={styles.itemTitle}>t</Text>',
      '        </View>',
      '      )}',
      '    />',
      '  )',
    ]).length === 0,
    'R7-N8 属性内嵌套元素的 style 不得并入宿主 key 集(建门第一版即在此造出假阳)',
  )
  // (N9) brand.DEFAULT × surface.light 两态都可见 ⇒ 不是债(与 R4 建门实测同一口径)
  assert(
    findR7Violations([
      '    btn: { backgroundColor: tokens.brand.DEFAULT },',
      '    btnCaption: { color: tokens.surface.light },',
      '  return (<View style={styles.btn}><Text style={styles.btnCaption}>x</Text></View>)',
    ]).length === 0,
    'R7-N9 DEFAULT 底 × surface.light 不得判(深色 #262626 压 #FFF 清晰)',
  )
  // (N10) brand.DEFAULT × 常量白:深色档案 #FFF 压 #FFF = 白压白 → 必红
  assert(
    findR7Violations([
      '    btn: { backgroundColor: tokens.brand.DEFAULT },',
      '    btnCaption: { color: "#FFFFFF" },',
      '  return (<View style={styles.btn}><Text style={styles.btnCaption}>x</Text></View>)',
    ]).length === 1,
    'R7-N10 DEFAULT 底 × 常量白(深色=白压白)必判',
  )
  // 判据矩阵本身要能单独取证(未知 token 一律不判 —— 宁漏不误报)
  assert(r7IsMismatch('brand.cta', 'surface.light') === true, 'R7 矩阵:cta × surface.light')
  assert(r7IsMismatch('brand.cta', 'surface.card') === true, 'R7 矩阵:cta × surface.card')
  assert(
    r7IsMismatch('brand.cta', 'brand.ctaForeground') === false,
    'R7 矩阵:cta × ctaForeground 正配',
  )
  assert(
    r7IsMismatch('brand.DEFAULT', 'surface.light') === false,
    'R7 矩阵:DEFAULT × surface.light 两态可见',
  )
  assert(
    r7IsMismatch('brand.DEFAULT', 'constant-white') === true,
    'R7 矩阵:DEFAULT × 常量白(深色白压白)',
  )
  assert(r7IsMismatch('surface.muted', 'surface.light') === false, 'R7 矩阵:非品牌底一律不判')
  assert(r7IsMismatch('brand.cta', 'text.quaternary') === false, 'R7 矩阵:未知 token 不猜')
  assert(
    isConstantWhite("'#fff'") && isConstantWhite('"#FFFFFF"') && isConstantWhite("'white'"),
    'R7 常量白三种写法',
  )
  assert(isConstantWhite("'rgba(255,255,255,0.95)'"), 'R7 α≥0.9 视作实心白')
  assert(!isConstantWhite("'rgba(255,255,255,0.85)'"), 'R7 α<0.9 是半透明点缀,不当实心白')
  assert(!isConstantWhite("'#262626'"), 'R7 深色字面量不是常量白')
  // style 引用识别的假阳闸门:`item.card` / `theme.brand` 不得被当成样式引用
  assert(
    styleKeyRefsIn('{[styles.card, active && styles.cardOn]}').join() === 'card,cardOn',
    'R7 style 数组解析',
  )
  assert(styleKeyRefsIn('{item.card}').length === 0, 'R7 非 style 宿主标识符不得算 style 引用')
  assert(styleKeyRefsIn('tk.surface.light').length === 0, 'R7 令牌路径不得被当成 style key')
  // 解析器遇到畸形 JSX 必须**照常判定**,不得退化成"0 处"(静默的绿比红危险)
  assert(
    findR7Violations([
      '    card: { backgroundColor: tk.brand.cta },',
      '    t1: { color: tk.surface.light },',
      '  return (<View style={styles.card}><Text style={styles.t1}></View>',
    ]).length === 1,
    'R7 未闭合标签仍须判出 card×t1(解析失败不得伪装成"没有债")',
  )
  // 基线键独立:R7 用 nestMismatchCounts,与 R2/R3/R4/R5 四面互不重叠
  assert(BASELINE_R7_KEY === 'nestMismatchCounts', 'R7 基线键必须是新键 nestMismatchCounts')
  // (N11) 人工豁免出口必须真起作用,且**逐行**生效、**必须带原因**
  assert(
    findR7Violations([
      '    card: { backgroundColor: tk.brand.cta }, // r7-nest-exempt: 底是渐变图的一部分',
      '    cap: { color: tk.surface.light },',
      '  return (<View style={styles.card}><Text style={styles.cap}>x</Text></View>)',
    ]).length === 0,
    'R7-N11 容器行 r7-nest-exempt 必须生效',
  )
  assert(
    findR7Violations([
      '    card: { backgroundColor: tk.brand.cta },',
      '    cap: { color: tk.surface.light },',
      '  return (',
      '    <View style={styles.card}>',
      '      {/* r7-nest-exempt: 这行字其实压在图片上 */}',
      '      <Text style={styles.cap}>x</Text>',
      '    </View>',
      '  )',
    ]).length === 0,
    'R7-N11b 前景行的紧邻上行豁免必须生效(与 R5 同形态)',
  )
  assert(
    findR7Violations([
      '    card: { backgroundColor: tk.brand.cta }, // r7-nest-exempt:',
      '    cap: { color: tk.surface.light },',
      '  return (<View style={styles.card}><Text style={styles.cap}>x</Text></View>)',
    ]).length === 1,
    'R7-N11c 不带原因的豁免不算豁免(否则豁免会退化成"先加上再说")',
  )
  assert(
    findR7Violations([
      '    card: { backgroundColor: tk.brand.cta },',
      '    cap: { color: tk.surface.light }, // r7-nest-exempt: 覆盖在图片上',
      '    spacer: { height: 1 },',
      '    other: { color: tk.surface.light },',
      '  return (<View style={styles.card}><Text style={styles.cap}>a</Text><Text style={styles.other}>b</Text></View>)',
    ]).length === 1,
    'R7-N11d 豁免不得外溢到同文件另一处配对(一行标记只救它自己那一处)',
  )
  for (const other of ['counts', 'ctaCounts', 'r4Counts', BASELINE_R5_KEY]) {
    assert(
      BASELINE_R7_KEY !== other,
      `R7 复用了 ${other} ⇒ 一次 --update-baseline 会把另一条判据的存量发给 R7`,
    )
  }
  /**
   * 取材面(2026-09-26 迁到 scripts/lib/face-reader.mjs)的构造面证明。
   *
   * 注入假 batch 造「同一条路径在**索引面**脏、在 **HEAD 面**干净」—— 真仓的索引此刻由并发会话
   * 决定,拿它当夹具就是一台时红时绿的尺子。两条必须给出**不同结论**:若 readText 忽略面,
   * 其中一条必红,所以这不是一句恒真式。第三条钉"取不到 ⇒ 无法判定"而不是回退磁盘。
   */
  {
    const dirty = ['  card: {', '    backgroundColor: tk.brand.cta,', '    color: tk.surface.light,', '  },']
    const clean = [
      '  card: {',
      '    backgroundColor: tk.brand.cta,',
      '    color: tk.brand.ctaForeground,',
      '  },',
    ]
    const fake = (root, specs) =>
      new Map(specs.map((s) => [s, s.startsWith('HEAD:') ? clean.join('\n') : dirty.join('\n')]))
    const rel = 'packages/app/src/features/face-probe.ts'
    const abs = path.join(ROOT, rel)
    faceTexts = prefetchFace(ROOT, '', [rel], fake)
    faceMode = 'staged'
    assert(
      findR1Violations(readText(abs)).length === 1,
      '取材面①:--staged 档必须跟**索引 blob** 走(索引侧那处跨档错配必须被看见)',
    )
    faceTexts = prefetchFace(ROOT, 'HEAD', [rel], fake)
    faceMode = 'head'
    assert(
      findR1Violations(readText(abs)).length === 0,
      '取材面②(反向对照):同一输入在 head 档取 HEAD blob ⇒ 结论必须随面改变(证明①不是恒真)',
    )
    faceTexts = new Map([[rel, null]])
    faceMode = 'staged'
    let threwUndetermined = false
    try {
      readText(abs)
    } catch (e) {
      threwUndetermined = e instanceof Undetermined
    }
    assert(
      threwUndetermined,
      '取材面③:--staged 取不到索引 blob ⇒ 抛 Undetermined(对外 exit 2),不得回退磁盘、不得静默跳过',
    )
    // 自检不得把伪造的判定面留给后面的读者
    faceTexts = new Map()
    faceMode = 'head'
  }
  console.log('✅ check-brand-foreground self-test 全部通过')
  return 0
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  const argv = process.argv.slice(2)
  const options = {
    staged: argv.includes('--staged'),
    updateBaseline: argv.includes('--update-baseline'),
  }
  const code = argv.includes('--self-test') ? selfTest() : run(options)
  process.exit(code)
}

export const __test__ = {
  extractStyleChunks,
  findR1Violations,
  countLightContainers,
  countCtaFills,
  computeBraceDeltas,
  extractNamedStyleChunks,
  isSiblingStylePair,
  findR4Violations,
  // R5(web 类名面):判据函数 + 词法前置 + 范围判定 + 基线键与类名 token 常量。
  // 导出常量的理由同 §22c —— 镜像测试要靠它们做"键被复用/类名被改窄"的变异对照。
  countWebClassPairs,
  hasClassToken,
  isR5Scope,
  r5Prefilter,
  BASELINE_R5_KEY,
  R5_BG_CLASS,
  R5_FG_CLASS,
  R5_DIRS,
  // R7(JSX 嵌套层):判据函数 + 归属矩阵 + 解析前置 + 基线键。
  // 镜像测试要靠这些做"矩阵被改宽 / style 引用识别被改松 / 基线键被复用"的变异对照。
  findR7Violations,
  collectR7StyleKeys,
  r7IsMismatch,
  isConstantWhite,
  styleKeyRefsIn,
  readJsxAttrValues,
  parseTagHead,
  maskNestedElements,
  BASELINE_R7_KEY,
  R7_BAD_ON_CTA,
  R7_BAD_ON_DEFAULT,
  R7_FILL_TIERS,
  R7_STYLE_PROPS,
  R7_EXEMPT,
  r7ExemptAt,
  r7ParseErrors,
  // §22c:判据正则本体也导出 —— 镜像测试用"旧版只认 DEFAULT 的正则 vs 现版"做变异对照,
  // 证明 cta 夹具的红/绿确实挂在扩面上(仅导出函数无法证伪"判据被改回只认 DEFAULT")。
  R1_BG,
  R1_BAD_FG,
  R3_BRAND_FILL,
  R3_FILL_CTA,
  BRAND_FG,
  BRAND_FG_CTA,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
