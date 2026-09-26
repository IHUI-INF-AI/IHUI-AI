#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 守门:文本箭头当图标 / 「箭头比标签还大」对账(GA 判据)
 *
 * 立因(2026-09-24 用户实拍缺陷):四端的「查看更多 / 更多」入口把尾部箭头渲染成**文本字形**
 * (`›` / `»` / 字面 `>`),而不是 lucide 的 `chevron-right` 矢量;并且给箭头设了**比自身标签更大**
 * 的字号(标签 24rpx、箭头 28/32rpx)—— 文本字形在自身 em 盒里的位置随字号变,不同字号同行
 * 必然上下错位(AGENTS.md §4「区段头『更多』入口单一源头」记的实测:「更」12px 墨迹偏上 1.0px,
 * `›` 在 14/16/18/20px 档偏下 1.0~1.5px,是相加关系 ⇒ 旧写法错位 2.0~2.5px)。
 * 四端现已统一到共享实现(`packages/app/src/components/MoreLink.tsx`、
 * `apps/web/src/components/common/view-more-link.tsx`、小程序 `SectionHeader` 经 `LineIcon`
 * 渲染 `icons.ts` 里的 `chevron-right`),但没有任何机器判据阻止新页面把字形形态再写回来,
 * 也没有判据看"箭头字号 > 标签字号"这一种。
 *
 * 为什么不并进 check-no-emoji-icons.mjs(11h):那道门顶层直接 `process.exit` 并按"暂存新增行"
 * 逐行扫盘,没有 §22d 的 isDirectRun/`__test__` 形态(测试一 import 就会跑完整 CLI 并退出进程),
 * 也没有本门必需的 HEAD/索引 blob 取材口径。把一条正在跑的 blocking 门连它的口径一起重写,
 * 爆炸半径远大于新增一个文件 —— 故新建本门,11h 逐字不动。
 *
 * 判据(六条,一律**宁漏不误报**):
 *  S0   单一实现在位 —— 上述共享组件必须仍在、仍引用矢量图标、仍被别处 import。
 *       防"装好被摘线":机制不在而本门仍报绿,等于没有(守门 70/76/81 同型)。
 *       现登记 5 个:三端「更多」箭头 + 页头返回键的两份同名实现(小程序端内 `BackChevron`
 *       与 RN/共享屏层 `packages/app/.../BackChevron`)。只登记其中一份时,另一份被摘线无人喊红。
 *  GA1  文本字形当 chevron —— 一个 JSX 元素的**唯一**子内容恰好是 `›` `»` `→` `》` `‹` `←`(或裸 `>`),
 *       或表达式子内容 `{'›'}` / `{">"}`,**且**语境可证明是 affordance:本元素属性里有
 *       onClick/onPress/onTap/onLongPress 或 role/accessibilityRole="button",或其任一祖先元素
 *       (含 Link/Pressable/TouchableOpacity/Button 这类组件名)带上述标记。
 *       ⚠️ 左向 `‹`/`←` 是 2026-09-25 补的:本门立项时只纳右向「更多」箭头,于是小程序
 *       `NavBar.tsx` 与 7 个页面头把 `‹` 当返回图标**长期零判据**。一条门只管自己立项那一型,
 *       就是"判据只拦得住别人、拦不住隔壁那一型"的现成例子。
 *       不判:注释、模板字符串里拼的 HTML(串内 `<span>›</span>`)、非整格的正文含字
 *       (`查看更多 ›`)、面包屑分隔符(祖先无 handler 即放过)、比较运算符、泛型尖括号、
 *       JSX 属性语法(`&gt;` 形态刻意不纳,宁可漏)。
 *  GA2  箭头字号 > 标签字号 —— 同一文件里按命名配对:标签键名含 `more`/`showMore`/`viewAll`
 *       词元,箭头键名 = 同一词干 + `Arrow`/`arrow`(或同一对象组里唯一的那个 label × 唯一 arrow
 *       兄弟键);CSS 侧同文件按 `.show-more-text` × `.show-more-arrow` 的词干配对判。
 *       两侧都写了字号且**单位相同**时箭头更大才判红;单位不同 ⇒ 不判但如实计数。
 *       切词按词元等值比对,所以 `removeText` 不会被当成 `more`(历史误伤最常见的一类)。
 *  GA4  文字「返回」当返回箭头(2026-09-25 立,起因:用户实拍"小程序端所有返回按钮是返回
 *       两个字")—— JSX 元素的**唯一**子内容是「返回」类文案,且该元素处在可证 affordance 语境
 *       (判据与 GA1 共用同一遍 `walkAffordanceChildren`,两条对"可证"的定义必须同形):
 *       i18n 调用 `{t('common.back')}` / `{tt('common.back','返回')}`(键名末段须为 `back` 或
 *       `back<数字>`)或字面量 `返回`。
 *       **刻意不纳**带宾语的标签(`backHome` 返回首页 / `backLogin` 返回登录 / `prevMonth`):
 *       那些是按钮文案,换成裸箭头反而不表意 —— 拦的是"箭头位放文字",不是"不许出现返回二字"。
 *       web 端 0 处存量(它的返回键本就是 lucide `<ChevronLeft />`),本判据把另三端对齐过去。
 *  GA5  「返回」与字形**混写**(2026-09-25 立)。GA1 只判"整格唯一子内容是字形"、GA4 只判
 *       "整格是返回文案",于是 `← 返回` / `‹ 返回` 这一型两条都不纳 —— 它恰好是**改了图标但把
 *       文案留在原地**的产物(实测两处真站点:`packages/app/src/components/Selecter.tsx:415`、
 *       `apps/mobile-rn/src/components/ModelConfigDialog.tsx:288`)。GA5 由 `classifyBackLabel`
 *       在整格分类时认它,与 GA4 共用同一遍遍历 ⇒ 一个元素只会算一条。
 *       另一型 `← {t('common.back')}`(字形与调用**分居两个子节点**)连"整格"都不成立,GA1/GA4
 *       结构上看不见 ⇒ 由 `findGlyphPlusCallLines` 逐行配(详见下方 GA5 注释;删掉它自检会翻绿)。
 *  GA6  页内返回键不得与微信**原生导航栏**同屏(2026-09-25 立,起因:把文字返回键收成矢量箭头后,
 *       模拟器截图里同一屏出现**两个**返回箭头 —— 原生栏自绘一个、页内 `<BackChevron/>` 一个)。
 *       web 的模型是"chrome 拥有唯一返回键"(GlobalTopBar 的 TopBarBackButton,页面不再自渲染),
 *       所以原生栏在的页不该再有页内返回键。判据读 Taro 的编译前真值:页面 `x.config.ts`,
 *       页内未写 `navigationStyle` 则继承 `app.config.ts` 的全局 window(两处都取不到 ⇒ **未判定**,
 *       既不记绿也不冒红)。渲染 `<NavBar/>` 的页一并纳入 —— 它按胶囊按钮算状态栏高度,本就是为
 *       custom 页写的,挂原生栏等于双层 chrome(实测 `pages/community`、`pages/distribution` 正是配置错页)。
 *  GA7  RN/共享屏层同屏**双份返回 affordance / 双层页头**(2026-09-26 立,把 GA6 的同一语义扩到
 *       RN 侧;起因:实拍 phone-set2.png —— RN 设置页顶上一条「设置 + 菜单」栏(NavBar 带 onBack
 *       即自绘 ChevronLeft,apps/mobile-rn/src/components/NavBar.tsx:79 实测),下面又一条「< 设置」
 *       = 共享屏层自带的 <BackChevron/>(packages/app/src/features/settings/SettingsScreen.tsx:98);
 *       wrapper 把 onBack 传给共享屏、共享屏再画自己的返回键 ⇒ 同屏两个返回箭头。
 *       **这一型在 RN 侧此前零判据** —— GA6 只判小程序「页内返回键 × 微信原生导航栏」,这里却是
 *       「页内返回键 × 页内返回键」,同一条"chrome 拥有唯一返回键"规矩的另一半。
 *       三信号(全静态、宁漏不误报,只判屏目录 `packages/app/src/features/` + `apps/mobile-rn/src/screens/`):
 *       H1 同一 return 分支 ≥2 处页头返回键(`<BackChevron` / 带 onBack 的 `<NavBar` 任一组合)⇒ 判第二处
 *       —— 互斥分支(loading/错误态/正常态)各画一套是正当形态,按整文件计数会产假阳;
 *       H2 本文件有页头返回键、且把 `onBack=` 传给的组件经**一跳解析**(相对路径直解;`@ihui/rn-app`
 *       经 barrel `packages/app/src/index.ts` 的命名再导出解析)落在屏目录、其内容又自绘页头返回键
 *       ⇒ 判在传 onBack 那一行;解析不出/barrel 或目标取不到 ⇒ **未判定**点名(不记绿);目标可读而
 *       子屏不画返回键 ⇒ 正当放行(子屏作纯内容托管合法,这正是"宁漏"的那一侧)。
 *       H3 `headerShown: true` 在 RN 面(`apps/mobile-rn/src` + `packages/app/src`)复现 —— 两个导航栈
 *       已全局 false(RootNavigator.tsx:502/602 实测),翻 true 即原生标题条与自绘页头同屏;
 *       HEAD 存量 0 ⇒ 新增即红。
 *       豁免**复用 GA6 的文件级 `nav-chrome-exempt`**(带原因):GA7 的错同样是"页面组合 × 页面渲染"
 *       的产物,不落在某一行上;语义与 GA6 同族(同屏双层 chrome),开第四通道只会稀释现有三条。
 *       已知边界如实登记:别名导入使子屏以 `<MyChevron/>` 这类非 BackChevron/NavBar 名义渲染返回键时,
 *       H2 会读成"子屏无返回键"而放行(收窄面以免假阳)。H1/H2/H3 不依赖 walkAffordanceChildren 的
 *       祖先栈 ⇒ GA4/GA5 那条"跨行自闭合标签致栈失配"的已知盲区不传染本判据。
 *
 * 泄压阀:行内 `glyph-arrow-exempt: <一句话原因>`(GA1/GA2)与
 * `back-label-exempt: <一句话原因>`(GA4/GA5,可写在命中行、可点元素起始行或其紧邻上行)——
 * 两条**独立通道**,都得带原因,裸标记不生效。分开是为了不给 GA1 开第二条豁免口。
 * GA6 用文件级 `nav-chrome-exempt: <原因>`:它的"错"是页面配置与页面渲染的**组合**,
 * 不落在某一行上,逐行豁免对本判据没有意义。
 *
 * 内容口径(本门生命线):缺省判 **HEAD blob**,`--staged` 判**索引 blob**,
 * 棘轮锚点恒为**该文件 HEAD 版本自身的违规数**。共享工作树常年滞后 HEAD,按磁盘算会在恒红/假绿
 * 之间来回跳;而 miniapp-taro 的 setting/member 一类行尾箭头存量在百级,写死零容忍等于逼人
 * `--no-verify`、连带废掉全部守门。所以:
 *   - 全量模式 = 审计报告(GA1/GA2 存量如实报数),只有 S0 破了才红;
 *   - `--staged` = 只拦"这次改动把违规加回来了"(判定集=暂存文件,锚点=这些文件的 HEAD 自身);
 *   - `--files a b` = 按文件自验(锚点同样是该文件 HEAD 自身,新文件即零容忍);
 *   - `--worktree` = 人工排查逃生舱,不作结论。
 * GA2 额外覆盖 `.css/.scss/.less`:用户报的那一对字号(24rpx 标签 / 32rpx 箭头)在小程序端就写在
 * 端内 `.css` 里,只扫 .tsx/.ts 会让本门对**它自己立项的那一型**全盲(串内 CSS 不计,见 GA1 说明)。
 *
 * 用法:
 *   node scripts/check-glyph-arrow-icon.mjs [--all|--staged|--worktree|--files <a> <b>|--self-test|--json|--root <dir>]
 * 退出码:0=通过/无新增;1=有违规;2=无法判定(git 失败、所选取材面取不到内容、扫描面为空)
 * 紧急跳过:HUSKY_SKIP_GLYPH_ARROW_ICON=1 git commit ...
 */
/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
// 判定面取材的五个易错点(git 必须绝对路径、`cat-file --batch` 的 stdin 必须是 pipe、
// 不得逐文件派生 git、仓库根比较要穿 junction、maxBuffer 要给足)只应有一处实现。
// 本门此前自带一份 `git()` + `catBatch()`,与守门 91/94/101 同形;现统一走共用层。
import { Undetermined, catBatch, gitRaw } from './lib/face-reader.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SELF_SKIP = 'HUSKY_SKIP_GLYPH_ARROW_ICON'
const GIT_TIMEOUT = 120000

/**
 * 目标面 = **所有会渲染界面的端**,不是"任务书点名的那几端"。
 * 2026-09-26 扩面:原清单只有 5 条(mobile-rn / packages/app / miniapp-taro / web×2),
 * 于是 apps/extension、apps/desktop、apps/cli、apps/mobile-cap、packages/ui-react、
 * packages/shared、packages/ui-native 共 **376 个源文件在门外** —— 而门内实测就有 1 处真违规
 * (`apps/extension/entrypoints/sidepanel/pages/AgentPage.tsx` 的 i18n「返回」摆在箭头位),
 * 它不是"漏改",是**结构上看不见**:pre-commit 永远不会为它喊红。
 * 这正是本仓反复记的那一型:"一条门只管自己立项那一型" —— 这里换成"只管自己立项那几端"。
 * 扩面不改变判据强度:棘轮锚点仍是"该文件 HEAD 自身违规数",所以新纳入端上的存量只报数、
 * 不会把与改动无关的提交钉红(那才是逼人 --no-verify 的成因)。
 * CSS 只在 GA2 生效。
 */
const SCAN_DIRS = [
  'apps/mobile-rn',
  'packages/app',
  'apps/miniapp-taro',
  'apps/web/app',
  'apps/web/src',
  'apps/extension',
  'apps/desktop',
  'apps/cli/src',
  'apps/mobile-cap',
  'packages/ui-react/src',
  'packages/ui-native/src',
  'packages/shared/src',
]
// `.jsx` 必须与 `.tsx` 同视(2026-09-26 补):实测全仓 `.jsx` 存量为 **0**,所以"不扩"今天不会漏任何东西 ——
// 但把结论建立在"恰好没有这种文件"上,等于让"全端已覆盖"这句话随时可能被一枚新文件悄悄作废(本仓最高频
// 失效型就是"看起来有、其实没牙")。扩它零风险(无受害者),换来判据对自己产出的形态恒有牙。
const TSX_RE = /\.(tsx|jsx)$/
const SRC_RE = /\.(tsx?|jsx|css|scss|less)$/
/** 本门自身与其测试必含被判据字面量 ⇒ 按路径前缀跳过并如实计数 */
const SELF_EXEMPT_RE = /check-glyph-arrow-icon\.[\w.]*mjs$/

/**
 * S0:三端「更多」入口的矢量出口(与 AGENTS.md §4「区段头『更多』入口单一源头」逐字对齐)
 * 加 2026-09-25 的小程序端返回键矢量出口(对齐 web 端 GlobalTopBar 的 TopBarBackButton)。
 * symbol = 消费方 import 里会出现的锚点名(用于判"造好了有没有装车"),**不得**按文件名猜 ——
 * `icons.ts` 的锚点是 `LineIcon`,按 basename 取会得出 `icons` 这种满屏假接线的名字。
 */
const MECHANISMS = [
  {
    file: 'packages/app/src/components/MoreLink.tsx',
    symbol: 'MoreLink',
    icon: /\bChevronRight\b/,
    note: 'RN + 跨端共享屏层:lucide-react-native ChevronRight',
  },
  {
    file: 'apps/web/src/components/common/view-more-link.tsx',
    symbol: 'view-more-link',
    icon: /\bChevronRight\b/,
    note: 'web:lucide-react ChevronRight',
  },
  {
    file: 'apps/miniapp-taro/src/components/LineIcon/icons.ts',
    symbol: 'LineIcon',
    icon: /['"]chevron-right['"]/,
    note: '小程序:LineIcon 的 chevron-right 素材(区块头由 SectionHeader 组装),零新素材',
  },
  {
    file: 'apps/miniapp-taro/src/components/BackChevron.tsx',
    symbol: 'BackChevron',
    icon: /['"]chevron-left['"]/,
    note: '小程序:页头返回键唯一实现(与 web 端 ChevronLeft 同向同档),素材复用 LineIcon chevron-left',
  },
  {
    file: 'packages/app/src/components/BackChevron.tsx',
    symbol: 'BackChevron',
    icon: /\bChevronLeft\b/,
    note: 'RN + 跨端共享屏层:lucide-react-native ChevronLeft(与小程序那份同名不同实现,两边都要被 S0 看着 —— 只登记端内那一份时,共享层被摘线无人喊红)',
  },
]

/** GA1:整格文本箭头(含左向 `‹`/`←` —— 2026-09-25 随小程序端返回键收口一起纳进来:
 *  该门立项时只管右向「更多」箭头,于是 `NavBar.tsx` 与 7 个页面头把 `‹` 当返回图标长期无人拦) */
const BARE_GLYPH_RE = /^[›»→》‹←>]$/
const BRACED_GLYPH_RE = /^\{\s*(['"`])([›»→》‹←>])\1\s*\}$/
/** affordance 证据:事件/角色属性 */
const HANDLER_ATTR_RE =
  /\bon(?:Click|Press|LongPress|PressIn|PressOut|Tap|Change|Select)\b|\b(?:role|accessibilityRole)\s*=\s*['"]button['"]/
/** …或组件名本身就是可点容器 */
const AFFORDANCE_TAG_RE =
  /^(?:Link|Pressable|TouchableOpacity|TouchableHighlight|TouchableWithoutFeedback|Touchable|Button|MoreLink|ViewMoreLink|a|button|Picker)$/

const EXEMPT_LINE_RE = /glyph-arrow-exempt:\s*(\S.*)/
/** GA4 专用人工出口:与 glyph-arrow 分开收集,免得给 GA1 开第二条豁免通道 */
const BACK_EXEMPT_LINE_RE = /back-label-exempt:\s*(\S.*)/
/** 盲区探针用的"附近有可点证据"宽松判据:比 GA1/GA4 的祖先遍历更宽(含 onChange / <a> / <Button>),
 *  因为探针的目的正是抓"栈遍历因形态没走通"的那些格子 —— 与判据同宽就永远抓不到。 */
const AFFORD_NEARBY_RE =
  /on(?:Press|Click|Tap|Change|Select)|role\s*=\s*["']button|<(?:Button|Link|Pressable|TouchableOpacity|Touchable\w*|Picker|a|button)\b/i

// 什么不算"原因":注释收尾符与标点(星号、斜杠、花括号、中英标点)一律剥掉后,必须还剩
// 词字符(含中文)。否则"裸标记 + 注释闭合符"会被读成带了原因 ⇒ 裸标记照样整行免检。
// 本门头版就是这样:它只 replace 掉 `-exempt:` 尾巴,把标记名 itself 留在了"原因"里,
// 于是任何以 `exempt:` 收尾的行都算有原因 —— 由 GA4 的自检用例反手抓出。
const NOT_A_REASON_RE = /[\s*/})\]>$#.,;:、，。；：!\-]+/g
const MAX_ANCESTORS = 8

/**
 * GA4:整格子内容是「返回」类文案,却摆在返回箭头的位置上。
 *  - i18n 表达式 `{t('common.back')}` / `{tt('common.back','返回')}` / `{t('forgot.back')}` /
 *    `{tt('adaptersSelectertaro.back4','← 返回')}` ⇒ 键名末段须是 `back` 或 `back<数字>`。
 *    **刻意不纳** `backHome`(返回首页)/ `backLogin`(返回登录)/ `prevMonth`:它们的值不是
 *    单个「返回」,是带宾语的按钮标签,换成裸箭头反而不表意。
 *  - 字面量 `<Text>返回</Text>` 同判(不走 i18n 的写法更该拦)。
 */
const BACK_LABEL_EXPR_RE = /^\{\s*(?:[\w$]+\.)?(?:tt?|i18nT)\s*\(\s*['"][^'"]*(?:\bback|[a-z]Back)\d*['"]/
const BACK_TEXT_LITERAL_RE = /^[「『]?返回[」』]?$/

/**
 * 一次 `git grep` 预筛。模式串是**判据所需字面量的超集(差一处,已如实登记)**:
 * GA1 需那六个字形(‹/← 为 2026-09-25 新增)+ 带引号的 `{'>'}` / `{">"}` 形态;
 * GA2 只需 fontSize|font-size(命名配对在筛后的内容里做);GA4 只需「返回」二字
 * (i18n 表达式与字面量两种形态都必含它);GA5 另需 `«`(BACK_GLYPH_PREFIX_RE 的字形族比 GA1
 * 多这一档,预筛必须是**超集**,少一档就是"筛掉了自己判据要抓的东西");
 * GA6 是**跨文件**判据,候选里没有字形可筛 —— 它按 `BackChevron` / `NavBar` 的 import 与页面
 * config 的 `navigationStyle` 识别,所以这三个标识符**必须**进模式串,否则"只有页内返回键、
 * 没有任何字形"的干净页会被预筛吞掉,本门就在自己立项的那一型上失明。
 * S0 机制文件永远实读,不受预筛影响。
 * ⚠️ **残盲登记**:GA1 的**裸文本子节点** `>Text></` 形态(整格只有一个 `>`、不带引号)
 * 无法进预筛 —— `>` 在任意 TSX 里都是标签结束符,加进模式串等于取消预筛。
 * 该形态现网 0 处;若哪天要纳进来,得换成"两遍扫"(先扫结构再判字形),不得静默留着。
 * 筛不动(异常)退回全量,绝不退成"少扫文件 = 少违规"。
 * 2026-09-26 再补一档,而且是**最贵的那一类漏**:`[bB]ack\d*["']` —— GA4 认的 i18n 形态
 * `{t('common.back')}` 里根本没有中文「返回」二字(键名才是 back),而旧模式串只有 `返回` 这个
 * 字面量 ⇒ 这类文件被预筛整批丢掉。实测全仓 298 个文件含 `…back…()` 调用,其中 **161 个不含
 * 中文「返回」** ⇒ GA4 在这 161 个文件上结构上失明,`apps/extension/.../AgentPage.tsx` 就是撞上
 * 的那一个(它在 HEAD 上就有一处真违规,而全量面报 0、把同一文件喂门却报 1 —— 两个面结论相反
 * 就是判据失效的指纹)。自检里"预筛必须是判据字面量超集"那条锁只覆盖了**字形字符集**,
 * 没覆盖**键名形态**,所以它一路绿灯地看着这个洞存在。
 */
const PREFILTER =
  '›|»|→|》|‹|←|«|返回|fontSize|font-size|\'>\'|">"|BackChevron|NavBar|navigationStyle|[bB]ack[0-9]*["\']|headerShown|onBack'

const git = (args, cwd = ROOT) => gitRaw(args, cwd, { timeout: GIT_TIMEOUT })

/**
 * `git grep` 的"零命中"用退出码 1 表达,且**不往 stderr 写任何东西**。共用层把派生失败统一
 * 包成 Undetermined(gitErrText 对空 stderr 的哨兵是 `(git 无输出)`),没有把退出码透出来 ——
 * 故本门按该哨兵还原三态:命中哨兵 = 真的零命中(返回空串),其余异常原样抛。
 * ⚠️ 这是对上游文案的依赖(缺的原语 = "带退出码的只读派生出口"):若上游改了哨兵,
 *   预筛一侧会把零命中升成异常 ⇒ 退回**全量**扫描(更保守,不会少扫文件少报违规),
 *   wiring 一侧会以 exit 2「无法判定」响亮收场(绝不静默记绿)。
 */
const NO_MATCH_SENTINEL = ': (git 无输出)'
const gitGrep = (args, cwd = ROOT) => {
  try {
    return git(args, cwd)
  } catch (e) {
    if (e instanceof Undetermined && e.message.endsWith(NO_MATCH_SENTINEL)) return ''
    throw e
  }
}

// ── 取材 ──────────────────────────────────────────────────────────────────────────────
/** 一次 cat-file --batch 读完一批 blob(逐文件 git show 在数百文件上就是钩子链上的分钟级挂起)
 *  实现已收口到 scripts/lib/face-reader.mjs 的 catBatch —— 参数同为 (仓库根, rev 列表)。 */

/** 面 → 前缀:head 用 `HEAD:`、index 用 `:`、worktree 直读磁盘 */
const revPrefix = (face) => (face === 'head' ? 'HEAD:' : face === 'index' ? ':' : '')

function surfaceFiles(cwd, face) {
  const out =
    face === 'head'
      ? git(['ls-tree', '-r', '--name-only', '-z', 'HEAD', '--', ...SCAN_DIRS], cwd)
      : git(['ls-files', '-z', '--', ...SCAN_DIRS], cwd)
  return out
    .split('\0')
    .filter(Boolean)
    .filter((p) => SRC_RE.test(p))
}

/** 暂存面(仅本次要提交的文件)—— --staged 的判定宇宙。不得用 ls-files:那是整个索引,
 *  在共享工作区里等于每次提交都全量重扫,而"别人已入库的存量"与本票无关。 */
function stagedFiles(cwd) {
  return git(
    ['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z', '--', ...SCAN_DIRS],
    cwd,
  )
    .split('\0')
    .filter(Boolean)
    .filter((p) => SRC_RE.test(p))
}

/** 候选集:null = 筛不动(退回全量);Set()(含零命中)= 合法的空候选 */
function candidateSet(cwd, face) {
  const args =
    face === 'head'
      ? ['grep', '-l', '-I', '-E', PREFILTER, 'HEAD', '--', ...SCAN_DIRS]
      : face === 'index'
        ? ['grep', '--cached', '-l', '-I', '-E', PREFILTER, '--', ...SCAN_DIRS]
        : ['grep', '-l', '-I', '-E', PREFILTER, '--', ...SCAN_DIRS]
  try {
    return new Set(
      gitGrep(args, cwd)
        .split('\n')
        .filter(Boolean)
        .map((l) => l.replace(/^HEAD:/, '').replaceAll('\\', '/')),
    )
  } catch {
    return null
  }
}

function makeReader(cwd, face, files) {
  if (face === 'worktree') {
    // 工作树面**不套 try**:脚本自身缺陷(漏 import、编码错)不得被吞成"取不到内容"
    return (rel) => readFileSync(join(cwd, rel), 'utf8')
  }
  const pre = revPrefix(face)
  const batch = catBatch(
    cwd,
    files.map((p) => `${pre}${p}`),
  )
  return (rel) => {
    const v = batch.get(`${pre}${rel}`)
    return v === undefined ? null : v
  }
}

// ── 文本状态机(保行/列偏移;报不准行号的门没法逐行豁免) ─────────────────────────────
/**
 * 一次遍历同时产出:
 *  - `code`:注释整段抹为空格(换行保留),字符串**原样保留**(GA1 要认 `{'›'}` 这种串形态)
 *  - `strMask`:与 code 等长的布尔表,标记"该字符属于字符串内容" —— JSX 文本子节点必须落在串外,
 *    否则模板字符串里拼的 HTML 会被当成 JSX 命中(守门 70 的串内 `/*` 同型坑)。
 */
function stripCommentsKeepStrings(src) {
  let out = ''
  const mask = []
  let i = 0
  const n = src.length
  const put = (ch, inStr) => {
    out += ch
    mask.push(inStr)
  }
  while (i < n) {
    const ch = src[i]
    const nx = src[i + 1]
    if (ch === '/' && nx === '/') {
      while (i < n && src[i] !== '\n') {
        put(' ', false)
        i++
      }
      continue
    }
    if (ch === '/' && nx === '*') {
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) {
        put(src[i] === '\n' ? '\n' : ' ', false)
        i++
      }
      for (let k = 0; i < n && k < 2; k++, i++) put(' ', false)
      continue
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      put(ch, true)
      i++
      while (i < n) {
        if (src[i] === '\\') {
          const nl = src[i + 1] === '\n'
          put(src[i], true)
          put(nl ? '\n' : (src[i + 1] ?? ' '), true)
          i += 2
          continue
        }
        if (src[i] === ch) break
        put(src[i], true)
        i++
      }
      if (i < n) {
        put(ch, true)
        i++
      }
      continue
    }
    put(ch, false)
    i++
  }
  return { code: out, strMask: mask }
}

/** 注释与字符串都抹平(GA2 用:串里的 `content: "→"` 与生成的 CSS 文本不得算作本文件的样式) */
function stripCommentsAndStrings(src) {
  const { code, strMask } = stripCommentsKeepStrings(src)
  let out = ''
  for (let i = 0; i < code.length; i++) out += strMask[i] && code[i] !== '\n' ? ' ' : code[i]
  return out
}

function lineOf(text, idx) {
  let line = 1
  for (let i = 0; i < idx && i < text.length; i++) if (text[i] === '\n') line++
  return line
}

/**
 * 逐行生效、必须带原因;裸标记不生效。marker 不同 ⇒ 两条独立豁免通道(GA1 / GA4)。
 * 原因取自 `re` 的**捕获组**(整条标记名连同冒号一起被消费掉),再剥注释闭合符/标点,
 * 剩下必须含词字符 —— 缺这一步,"裸标记 + 注释收尾"会被当成带了原因(见 NOT_A_REASON_RE 注)。
 */
function collectExemptLines(raw, re = EXEMPT_LINE_RE) {
  const lines = new Set()
  raw.split('\n').forEach((l, idx) => {
    const m = l.match(re)
    if (!m) return
    const reason = (m[1] ?? '').replace(NOT_A_REASON_RE, '')
    if (/[\w一-鿿]/.test(reason)) lines.add(idx + 1)
  })
  return lines
}

/** 从 openIdx(指向 '{')起花括号配平取对象体;不配对返回 null */
function objectBody(src, openIdx) {
  let depth = 0
  for (let i = openIdx; i < src.length; i++) {
    if (src[i] === '{') depth++
    else if (src[i] === '}' && --depth === 0) return src.slice(openIdx + 1, i)
  }
  return null
}

/** 只保留**本层**声明:嵌套对象体整段抹平,避免把孙对象的 fontSize 记到父键上 */
function shallowBody(body) {
  let out = ''
  let depth = 0
  for (const ch of body) {
    if (ch === '{') depth++
    else if (ch === '}') depth--
    out += depth > 0 && ch !== '{' && ch !== '}' ? (ch === '\n' ? '\n' : ' ') : ch
  }
  return out
}

/** 每个 `{` 的开括号处 → 其**父作用域**的 `{` 下标(顶层为 'root'),用于"同一规则组"判定 */
function braceParents(text) {
  const parent = new Map()
  const stack = []
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (c === '{') {
      parent.set(i, stack.length ? stack[stack.length - 1] : 'root')
      stack.push(i)
    } else if (c === '}') stack.pop()
  }
  return parent
}

// ── GA1 ───────────────────────────────────────────────────────────────────────────────
/** `<` 只有在前面不是单词字符/引号/闭括号时才是 JSX 开标签:`a<b`、`Array<Foo>` 一律拒绝 */
function prevAllowsTagStart(text, i) {
  if (i === 0) return true
  return !/[\w$)\]'"`]/.test(text[i - 1])
}

/** 从 i 处解析一个标签:属性里的 `{}`/`()`/`[]` 计入深度后才认配平的 `>`;不是标签返回 null */
export function parseTagAt(text, i, strMask) {
  if (text[i] !== '<' || strMask[i]) return null
  // **闭合标签不受 prevAllowsTagStart 约束**:它天然紧跟文本内容(`A</a>`、`›</span>`),
  // 而那条守卫是为"比较运算符 `a < b` 不是标签"设计的 —— 把它一并套到 `</` 上,后果是
  // 闭合标签永不入栈出栈 ⇒ 祖先栈跨兄弟泄漏(面包屑 `<a>A</a><span>›</span>` 会被判成"祖先 <a> 可点"),
  // 且真正该被看到的格子反过来被漏掉(CourseScreen 的盲区即此型)。
  const isCloseStart = text[i + 1] === '/' && !strMask[i + 1]
  if (!isCloseStart && !prevAllowsTagStart(text, i)) return null
  let j = i + 1
  let closing = false
  if (text[j] === '/') {
    closing = true
    j++
  }
  const m = /^[A-Za-z_][\w.]*/.exec(text.slice(j, j + 64))
  if (!m) return null
  const name = m[0]
  let k = j + name.length
  let depth = 0
  const stop = Math.min(text.length, k + 4000)
  while (k < stop) {
    if (strMask[k]) {
      k++
      continue
    }
    const c = text[k]
    if (c === '{' || c === '(' || c === '[') depth++
    else if (c === '}' || c === ')' || c === ']') {
      if (depth === 0) return null
      depth--
    } else if (c === '>' && depth === 0) {
      const attrs = text.slice(j + name.length, k)
      // 真 JSX 属性表要么为空(`<Text>`)、要么以空白 / `/` 起头(`<Text\n  …>`);
      // `<T,>` 这类泛型/箭头类型参数attrs 直接以 `,`/`(`/`<` 起头 ⇒ 不是标签,拒。
      if (attrs && !/^[\s/]/.test(attrs)) return null
      return {
        kind: closing ? 'close' : /\/\s*$/.test(attrs) ? 'self' : 'open',
        name,
        attrs,
        start: i,
        end: k + 1,
      }
    } else if (c === '<' && depth === 0) return null
    k++
  }
  return null
}

/**
 * 该开标签之后是否"唯一子内容就是一小段文本",且紧随其后的闭合标签同名。
 * 返回 { raw(未 trim 原文), tr(trim 后), pos(raw 首个非空白字符的偏移) } 或 null。
 * GA1 与 GA4 共用这一层 —— 两条判据对"整格子内容"的定义必须逐字同形,
 * 各自抄一遍必然在"多远算不整格"(nextLt - j > 40)这类边界上漂移。
 */
function loneChildText(text, strMask, tag) {
  let j = tag.end
  while (j < text.length && /\s/.test(text[j])) j++
  const nextLt = text.indexOf('<', j)
  /**
   * 上界 80:GA1 的子内容是单字形,40 足够;但 GA4 认的是 `{tt('adaptersSelectertaro.back4','← 返回')}`
   * 这类**长表达式**(实测 42 字符),沿用 40 会让本门对自己新加的判据失明 ——
   * 与"门让你这么写就看不见怎么写"同型。放宽只影响"多长算不整格",
   * GA1 侧不会因此多判(字形判据仍要求整格匹配 BARE/BRACED_RE)。
   */
  if (nextLt < 0 || nextLt - j > 80) return null
  const raw = text.slice(j, nextLt)
  const tr = raw.trim()
  if (!tr) return null
  const pos = j + (raw.length - raw.trimStart().length)
  const tail = text.slice(nextLt, nextLt + tag.name.length + 10)
  if (!new RegExp(`^</\\s*${tag.name.replace(/\./g, '\\.')}\\s*>`).test(tail)) return null
  return { tr, pos, line: lineOf(text, pos) }
}

/** 该子内容是否为"串外"的 JSX 文本节点(串内的 `›` 是 HTML 字符串,不是子节点) */
function isOutsideString(strMask, pos) {
  return !strMask[pos]
}

/**
 * GA5:字形与返回文案的**混写**。GA1 只判"整格唯一子内容是字形"、GA4 只判"整格唯一子内容是
 * 返回类文案",两型混排都不纳:
 *   A 型 整格 `← 返回` / `‹ 返回`(实测两处真站点:`packages/app/src/components/Selecter.tsx:415`、
 *        `apps/mobile-rn/src/components/ModelConfigDialog.tsx:288`)⇒ 由 `classifyBackLabel` 在
 *        整格分类里认,与 GA4 共用同一遍遍历,一个元素只算一条;
 *   B 型 同一行"独立字形 + 返回类 i18n 调用"分居**两个子节点**(`<Text onClick>← {t('common.back')}</Text>`)
 *        ⇒ `walkAffordanceChildren` 走 `loneChildText`,**多子元素的元素根本不入选**,于是这一型
 *        今天 GA1/GA4/GA5-A 三条**全部零命中**(自检里那条断言就是它的存在性证明:去掉下面这个
 *        逐行判据,该断言从红翻绿)。刻意按**同行**配对:跨行窗口会把"上一行的矢量箭头 + 下一行
 *        无关文案"算成一对,那是造假红。
 */
const BACK_GLYPH_PREFIX_RE = /^[‹←«‹]\s*返回$/
const BACK_CALL_ON_LINE_RE = /\{\s*(?:[\w$]+\.)?(?:tt?|i18nT)\s*\(\s*['"][^'"]*(?:\bback|[a-z]Back)\d*['"]/
const LONE_BACK_GLYPH_RE = /(^|[>\s{])\s*([‹←«])\s*(?=[\s<{]|$)/

/** 该子内容是否为「返回」类文案(GA4 判据);返回命中的形态名或 null */
export function classifyBackLabel(tr, strMask, pos) {
  if (BACK_TEXT_LITERAL_RE.test(tr)) return isOutsideString(strMask, pos) ? 'text-literal' : null
  if (BACK_GLYPH_PREFIX_RE.test(tr)) return isOutsideString(strMask, pos) ? 'glyph-plus-text' : null
  if (!tr.startsWith('{') || !tr.endsWith('}')) return null
  return BACK_LABEL_EXPR_RE.test(tr) ? 'i18n-call' : null
}

/** GA5 B 型:逐行找"同一行既有独立返回字形、又有返回类 i18n 调用"(两型分居两个子节点时整格判据全盲) */
export function findGlyphPlusCallLines(text) {
  const { code, strMask } = stripCommentsKeepStrings(text)
  const hits = []
  const lines = code.split('\n')
  let start = 0
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (BACK_CALL_ON_LINE_RE.test(line)) {
      const g = LONE_BACK_GLYPH_RE.exec(line)
      if (g) {
        const at = line.indexOf(g[2], g.index)
        if (at >= 0 && !strMask[start + at]) hits.push({ line: i + 1, glyph: g[2] })
      }
    }
    start += line.length + 1
  }
  return hits
}

/** GA5 A 型的分类出口:整格「← 返回」归 GA5,整格「返回」归 GA4(两条共用同一遍遍历,不重复计) */

/** 该整格子内容是否为箭头字形(GA1 分类器);返回 { glyph, form } 或 null */
export function classifyGlyph(tr, strMask, pos) {
  if (BARE_GLYPH_RE.test(tr)) {
    // 串内的 `›` 不是 JSX 文本子节点(模板字符串里拼的 HTML)
    return isOutsideString(strMask, pos) ? { glyph: tr, form: 'text-child' } : null
  }
  if (BRACED_GLYPH_RE.test(tr)) {
    return { glyph: BRACED_GLYPH_RE.exec(tr)[2], form: 'braced-string-child' }
  }
  return null
}

/**
 * 返回 `{ reason, anchor }`:anchor 是**提供可点证据的那个元素**(本元素或某层祖先)。
 * 人写豁免注释时标的是"这个可点块",而命中行往往落在块内部最里层的文字节点上
 * (实测四处 `back-label-exempt` 全部写在 `<View onTap=…>` 上一行,而命中行在其下 2~10 行)——
 * 只认命中行或其紧邻上行,会让人按直觉写、门按行号不认,于是恒红 ⇒ 逼人 --no-verify。
 */
function affordanceEvidence(tag, ancestors) {
  if (HANDLER_ATTR_RE.test(tag.attrs))
    return { reason: '本元素自身带 onClick/onPress/role=button', anchor: tag }
  for (const a of ancestors) {
    if (AFFORDANCE_TAG_RE.test(a.name))
      return { reason: `祖先 <${a.name}> 本身就是可点容器`, anchor: a }
    if (HANDLER_ATTR_RE.test(a.attrs))
      return { reason: `祖先 <${a.name}> 带 onClick/onPress/role=button`, anchor: a }
  }
  return null
}

/**
 * 单次前向遍历,产出每个"唯一子内容成格、且语境可证是 affordance"的开标签:
 * `{ tag, via, tr, pos }`。栈给祖先,开标签给整格子内容判定,闭合标签按名回退栈。
 * GA1 与 GA4 **共用这一遍**(两条判据对"可证 affordance"的定义必须同形,各走一遍
 * 会在栈深/祖先窗口上漂移),分类各自在上层做。
 */
export function walkAffordanceChildren(text, strMask) {
  const out = []
  const stack = []
  let i = 0
  const n = text.length
  while (i < n) {
    if (text[i] !== '<') {
      i++
      continue
    }
    const t = parseTagAt(text, i, strMask)
    if (!t) {
      i++
      continue
    }
    if (t.kind === 'close') {
      for (let s = stack.length - 1; s >= 0; s--) {
        if (stack[s].name === t.name) {
          stack.length = s
          break
        }
      }
      i = t.end
      continue
    }
    if (t.kind === 'open') {
      const lone = loneChildText(text, strMask, t)
      if (lone) {
        const ev = affordanceEvidence(t, stack.slice(-MAX_ANCESTORS))
        if (ev) out.push({ tag: t, via: ev.reason, anchorLine: lineOf(text, ev.anchor.start), ...lone })
      }
      stack.push(t)
    }
    i = t.end
  }
  return out
}

/** GA1:整格子内容恰为一个箭头字形 */
export function findGlyphIconChildren(text, strMask) {
  const hits = []
  for (const c of walkAffordanceChildren(text, strMask)) {
    const g = classifyGlyph(c.tr, strMask, c.pos)
    if (g) hits.push({ ...g, pos: c.pos, line: c.line, tag: c.tag.name, via: c.via })
  }
  return hits
}

/** GA4:整格子内容恰为「返回」类文案(字面量或 i18n 调用) */
export function findBackLabelChildren(text, strMask) {
  const hits = []
  for (const c of walkAffordanceChildren(text, strMask)) {
    const form = classifyBackLabel(c.tr, strMask, c.pos)
    if (form)
      hits.push({
        form,
        pos: c.pos,
        line: c.line,
        anchorLine: c.anchorLine,
        tag: c.tag.name,
        via: c.via,
        text: c.tr,
      })
  }
  return hits
}

// ── GA2 ───────────────────────────────────────────────────────────────────────────────
/** 标识符切词:camelCase / kebab / snake → 小写词元(`showMoreText` 与 `show-more-text` 同形) */
export function wordsOf(name) {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[\s\-_./]+/)
    .filter(Boolean)
    .map((w) => w.toLowerCase())
}

const ROLE_SUFFIX_WORDS = new Set([
  'text',
  'label',
  'title',
  'copy',
  'name',
  'span',
  'link',
  'row',
  'item',
  'btn',
  'button',
  'wrap',
  'inner',
  'outer',
  'tag',
])
const ARROW_WORDS = new Set(['arrow', 'chevron'])

export function isArrowName(name) {
  return wordsOf(name).some((w) => ARROW_WORDS.has(w))
}

/** 标签名:词元含 more,或 view/show/see 紧跟 all;自身不得是箭头键 */
export function isLabelName(name) {
  if (isArrowName(name)) return false
  const w = wordsOf(name)
  if (w.includes('more')) return true
  for (let i = 0; i < w.length - 1; i++)
    if (['view', 'show', 'see'].includes(w[i]) && w[i + 1] === 'all') return true
  return false
}

/** 词干:剥掉尾部 arrow/chevron 与角色词,让 `show-more-text` 与 `show-more-arrow` 对上 */
export function stemOf(name) {
  const w = wordsOf(name)
  while (w.length && ARROW_WORDS.has(w[w.length - 1])) w.pop()
  while (w.length > 1 && ROLE_SUFFIX_WORDS.has(w[w.length - 1])) w.pop()
  return w.join('-')
}

const OBJ_GROUP_RE = /([A-Za-z_$][\w$]*)\s*:\s*\{/g
const OBJ_FS_RE = /fontSize\s*:\s*([0-9]*\.?[0-9]+)/g
const CSS_BLOCK_RE = /([^{}]+)\{([^{}]*)\}/g
const CSS_SEL_RE = /\.([A-Za-z_][\w-]*)/g
const CSS_FS_RE = /font-size\s*:\s*([0-9]*\.?[0-9]+)\s*(rpx|px|rem|em|pt)?/

/**
 * 收集"某处写了字号"的条目。
 *  - 对象形态:键 = 样式名,组 = **父对象**(兄弟键同组),值取本层 fontSize
 *  - CSS 形态:组 = 一条规则块(同文件的跨块配对在下面按词干做)
 */
export function collectFontSizes(blank) {
  const entries = []
  const parents = braceParents(blank)
  for (const m of blank.matchAll(OBJ_GROUP_RE)) {
    const braceIdx = blank.indexOf('{', m.index + m[0].length - 1)
    if (braceIdx < 0) continue
    const body = objectBody(blank, braceIdx)
    if (body === null) continue
    const group = `obj@${parents.get(braceIdx) ?? 'root'}`
    for (const f of shallowBody(body).matchAll(OBJ_FS_RE)) {
      entries.push({
        name: m[1],
        group,
        size: Number(f[1]),
        unit: '',
        line: lineOf(blank, braceIdx + 1 + f.index),
        keyLine: lineOf(blank, m.index),
      })
    }
  }
  for (const m of blank.matchAll(CSS_BLOCK_RE)) {
    const braceIdx = m.index + m[1].length
    if (blank[braceIdx] !== '{') continue
    const f = CSS_FS_RE.exec(m[2])
    if (!f) continue
    for (const s of m[1].matchAll(CSS_SEL_RE)) {
      entries.push({
        name: s[1],
        group: `css@${braceIdx}`,
        size: Number(f[1]),
        unit: f[2] || 'unitless',
        line: lineOf(blank, braceIdx + 1 + f.index),
        keyLine: lineOf(blank, m.index + m[1].indexOf(s[0])),
      })
    }
  }
  return entries
}

/**
 * 配对:同组内按词干相等;组内恰好一个 label × 一个 arrow 时按兄弟键配(任务书点名的形态)。
 * CSS 侧跨块按同词干配。单位不一致 ⇒ 不判、只计 undetermined。
 */
export function findOpticalMismatch(entries) {
  const found = []
  const undetermined = []
  const byGroup = new Map()
  for (const e of entries) {
    if (!byGroup.has(e.group)) byGroup.set(e.group, [])
    byGroup.get(e.group).push(e)
  }
  const check = (label, arrow, sameGroup) => {
    if (label.unit !== arrow.unit) {
      undetermined.push(
        `${label.name}(${label.size}${label.unit || ''}) vs ${arrow.name}(${arrow.size}${arrow.unit || ''}) 单位不同、判不出`,
      )
      return
    }
    if (arrow.size > label.size) found.push({ label, arrow, sameGroup })
  }
  for (const list of byGroup.values()) {
    const labels = list.filter((e) => isLabelName(e.name))
    const arrows = list.filter((e) => isArrowName(e.name))
    for (const l of labels) {
      const stem = stemOf(l.name)
      const exact = arrows.filter((a) => stemOf(a.name) === stem)
      if (exact.length) for (const a of exact) check(l, a, true)
      else if (labels.length === 1 && arrows.length === 1) check(l, arrows[0], true)
    }
  }
  const css = entries.filter((e) => e.group.startsWith('css@'))
  const cssLabels = css.filter((e) => isLabelName(e.name))
  const cssArrows = css.filter((e) => isArrowName(e.name))
  for (const l of cssLabels) {
    const stem = stemOf(l.name)
    for (const a of cssArrows) if (a !== l && stemOf(a.name) === stem) check(l, a, false)
  }
  const seen = new Set()
  const violations = found.filter((v) => {
    const k = `${v.label.name}@${v.label.line}|${v.arrow.name}@${v.arrow.line}`
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
  return { violations, undetermined }
}

// ── 单文件审计(返回结构化条目,不做字符串反解析) ───────────────────────────────────────
export function auditFile(rel, text) {
  const findings = []
  const notes = { exempt: 0, backExempt: 0, undetermined: [], backBlind: [] }
  const sawBack = new Set()
  const exempt = collectExemptLines(text)
  const backExempt = collectExemptLines(text, BACK_EXEMPT_LINE_RE)
  if (TSX_RE.test(rel)) {
    const { code, strMask } = stripCommentsKeepStrings(text)
    for (const h of findGlyphIconChildren(code, strMask)) {
      if (exempt.has(h.line)) {
        notes.exempt++
        continue
      }
      findings.push({
        rule: 'GA1',
        file: rel,
        line: h.line,
        msg: `文本字形「${h.glyph}」当 chevron 图标(<${h.tag}> 的唯一子内容,${h.via})—— 须改用矢量图标:共享 MoreLink / lucide chevron-right|chevron-left / Taro LineIcon / 小程序 BackChevron`,
      })
    }
    for (const h of findBackLabelChildren(code, strMask)) {
      sawBack.add(h.line)
      // 人工出口认三个位置:命中行、供可点证据那个元素的**起始行**、及其紧邻上行。
      // "只认命中行或其紧邻上行"的初版实测让四处豁免**全部落空** —— 人标的是那个可点块,
      // 命中却在块内最里层的文字行上(相差 2~10 行);按初版口径这四处会恒红,
      // 而恒红门的唯一结局是逼人 --no-verify、连带废掉全部守门。
      // 与 GA1 刻意不同(GA1 仍只认同行):GA1 若按块放行,一个标记就能救整棵子树,
      // 那条"一行救不了别处"的反向锁就没了 —— 两条通道的宽严各自被自检钉住,不悄悄对齐。
      if (
        backExempt.has(h.line) ||
        backExempt.has(h.anchorLine) ||
        backExempt.has(h.anchorLine - 1)
      ) {
        notes.backExempt++
        continue
      }
      findings.push({
        rule: h.form === 'glyph-plus-text' ? 'GA5' : 'GA4',
        file: rel,
        line: h.line,
        msg: `${h.form === 'i18n-call' ? 'i18n「返回」文案' : h.form === 'glyph-plus-text' ? `字形+文案「${h.text}」` : `字面量「${h.text}」`}摆在返回箭头位(<${h.tag}> 的唯一子内容,${h.via})—— 返回 affordance 须用矢量箭头(web/RN:ChevronLeft;小程序:<BackChevron />);确属"按钮标签"而非页头返回键,在**可点元素起始行或其紧邻上行**写 \`back-label-exempt: <原因>\``,
      })
    }
    // GA5 B 型:同一行"独立字形 + 返回类调用"分居两个子节点 —— 整格判据对多子元素的元素根本不入选,三条全盲
    for (const g of findGlyphPlusCallLines(text)) {
      sawBack.add(g.line)
      if (backExempt.has(g.line) || exempt.has(g.line)) {
        notes.backExempt++
        continue
      }
      findings.push({
        rule: 'GA5',
        file: rel,
        line: g.line,
        msg: `字形「${g.glyph}」与「返回」文案同一行并写(分居两个子节点)—— GA1/GA4 都只判整格唯一子内容,这一型三条都不纳;要么只用矢量图标,要么只用文案标签`,
      })
    }
  }
  // ── 盲区探针(2026-09-26 立)───────────────────────────────────────────────────────────
  // GA4/GA5 走 JSX 栈遍历,而遍历会被表达式里的 `<=`(标签提前闭合)、`onChange` 型交互、
  // 大写键名(`fullscreenBack`)、祖先不在事件表等形态**静默跳过** —— 症状是"门报 0,而这一格真的在那"。
  // 这里用一条刻意宽松的**渲染位**正则(只认 `>` 之后紧跟返回类调用;`label=`/`aria` 属性位不算)
  // 数一遍,凡是它命中、而遍历一个都没咨询过的行,就是判据失明嫌疑:**点名报数,不静默成 0**。
  // 刻意不判红(它同时会抓到合法的内容文案,判红即恒红门),但每次全量都喊出来,漏不掉了。
  if (TSX_RE.test(rel)) {
    const loose = /\{\s*(?:[\w$]+\.)?(?:tt?|i18nT)\s*\(\s*['"][^'"]*\bback\d*['"]/g
    const codeOnly = stripCommentsKeepStrings(text).code
    const lines = codeOnly.split('\n')
    lines.forEach((ln, idx) => {
      const line = idx + 1
      if (!ln.includes('{')) return
      const m = new RegExp(loose.source, 'g')
      let mm2
      while ((mm2 = m.exec(ln))) {
        const before = ln.slice(0, mm2.index)
        const isRenderPos = /[>]\s*$/.test(before) || before.trim() === ''
        const isProp = /=\s*$/.test(before) && !/[>]\s*$/.test(before)
        if (!isRenderPos || isProp || sawBack.has(line)) continue
        // 只有"这个表达式就是该元素的唯一子内容"时才算盲区 —— 多子元素(图标 + 文案的带标签按钮)
        // 是 GA4 设计上不纳的形态,把它报成盲区只会造噪音。
        const prevIdx = line - 2
        const prev = prevIdx >= 0 ? lines[prevIdx].trim() : ''
        let ni = line
        while (ni < lines.length && !lines[ni].trim()) ni++
        const next = ni < lines.length ? lines[ni].trim() : ''
        // 前一行必须是**开标签**的收尾(排除 `/>` 自闭合与 `=>` 箭头),后一行是闭合标签 ⇒ 该表达式是唯一子内容
        const opensTag = />$/.test(prev) && !/\/>$/.test(prev) && !/=>$/.test(prev)
        const soleChild = opensTag && /^<\//.test(next)
        if (!soleChild) continue
        const back = lines.slice(Math.max(0, line - 13), line - 1).join('\n')
        if (AFFORD_NEARBY_RE.test(back)) notes.backBlind.push({ file: rel, line })
      }
    })
  }
  const mm = findOpticalMismatch(collectFontSizes(stripCommentsAndStrings(text)))
  for (const v of mm.violations) {
    if (
      exempt.has(v.arrow.line) ||
      exempt.has(v.label.line) ||
      exempt.has(v.arrow.keyLine) ||
      exempt.has(v.label.keyLine)
    ) {
      notes.exempt++
      continue
    }
    findings.push({
      rule: 'GA2',
      file: rel,
      line: v.arrow.line,
      msg: `箭头字号 ${v.arrow.size}${v.arrow.unit || ''}(L${v.arrow.line} ${v.arrow.name})> 标签字号 ${v.label.size}${v.label.unit || ''}(L${v.label.line} ${v.label.name})—— ${v.sameGroup ? '同一规则组' : '同文件规则族'}配对;文本箭头随字号移位、同行必然对不齐 ⇒ 换矢量图标或按标签同档`,
    })
  }
  notes.undetermined.push(...mm.undetermined)
  return { findings, notes }
}

/**
 * GA6:页内返回键不得与微信原生导航栏同屏(2026-09-25 立)。
 * 起因:把文字返回键收成矢量箭头后,模拟器截图里发现同一屏有**两个**返回箭头 —— 原生导航栏自绘
 * 一个、页内 `<BackChevron/>` 一个。web 的模型是"chrome 拥有唯一返回键"(GlobalTopBar 的
 * TopBarBackButton,页面不再自渲染),所以原生栏在的页不该再有页内返回键。
 * 判据取**编译前的真值**:Taro 约定页面 config 与页面文件同名(`x.tsx` ↔ `x.config.ts`),
 * 页面没写 `navigationStyle` 时继承 `app.config.ts` 的全局 window;两处都取不到 ⇒ 判"无法判定"
 * 并点名,不冒红也不记绿(把"没读到"当成"没有"会产出反向结论 —— 那正是本门初版把
 * "config 不存在" 判成 native 的同时又记 undetermined 的自相矛盾,已按继承链重写)。
 * 渲染 `NavBar` 的页一并纳入 —— 它内部按胶囊按钮算状态栏高度,本就是为 custom 页写的,
 * 挂原生栏等于双层 chrome(实测 community / distribution 两页正是配置错页)。
 * 行内出口 `nav-chrome-exempt: <原因>`(整文件生效:这里的"错"是页面级配置与页面级渲染的
 * 组合,不在某一行上,逐行豁免对本判据没有意义)。
 */
const CUSTOM_NAV_RE = /navigationStyle\s*:\s*['"]custom['"]/
const NAV_CHROME_EXEMPT_RE = /nav-chrome-exempt:\s*\S/
const GLOBAL_APP_CONFIG = 'apps/miniapp-taro/src/app.config.ts'

/** 可选文件:ENOENT 是正当状态(页面没有自己的 config),其它异常必须照抛 —— 见守门 97 那条"编码错误伪装成取不到" */
function readOptional(read, rel) {
  try {
    return read(rel)
  } catch (e) {
    if (e?.code === 'ENOENT') return null
    throw e
  }
}

/** 该页导航栏形态:'custom' | 'native' | null(判不出)。null 只在两处来源都取不到时出现。 */
export function navStyleOf(read, pageRel) {
  const own = readOptional(read, pageRel.replace(/\.tsx$/, '.config.ts'))
  if (own !== null && CUSTOM_NAV_RE.test(own)) return 'custom'
  const global = readOptional(read, GLOBAL_APP_CONFIG)
  if (global === null) return null
  return CUSTOM_NAV_RE.test(global) ? 'custom' : 'native'
}

export function findChromeDuplicates(readFile, files) {
  const out = []
  for (const rel of files) {
    if (!rel.startsWith('apps/miniapp-taro/src/') || !rel.endsWith('.tsx')) continue
    if (rel.includes('/components/')) continue
    const src = readFile(rel)
    if (src === null) continue
    const usesKey = /from '@\/components\/BackChevron'/.test(src) || /<NavBar\b/.test(src)
    if (!usesKey) continue
    if (NAV_CHROME_EXEMPT_RE.test(src)) continue
    const cfgPath = rel.replace(/\.tsx$/, '.config.ts')
    const style = navStyleOf(readFile, rel)
    if (style === null) {
      out.push({
        file: rel,
        line: 1,
        undetermined: true,
        msg: `渲染页内返回键,但 ${cfgPath} 与 ${GLOBAL_APP_CONFIG} 在所选取材面都取不到 ⇒ 无法判定导航栏形态(不记绿,也不冒红)`,
      })
      continue
    }
    if (style === 'native') {
      const viaNavBar = /<NavBar\b/.test(src)
      out.push({
        file: rel,
        line: 1,
        msg: `该页是原生导航栏(${cfgPath} 未写、${GLOBAL_APP_CONFIG} 也没有 navigationStyle:'custom'),却又渲染${viaNavBar ? ' <NavBar/>(它内部 showBack 默认 true 会再画一个返回键,并按胶囊按钮给状态栏留位 ⇒ 双层 chrome + 正文被再推一档)' : '页内 <BackChevron/>'} ⇒ 同屏两个返回箭头。${viaNavBar ? "改法只有把该页设 navigationStyle:'custom'(NavBar 本就是为 custom 页写的)" : '改法:该页设 navigationStyle:\'custom\',或删掉页内 <BackChevron/>(标题行留着)'} —— 只把 showBack 设 false 会留下空的固定标题条,那是半修`,
      })
    }
  }
  return out
}

/** GA6 要读页面 config —— 必须补进取材批次,否则 reader 只认清单内路径,会把"没读"当成"没有" */
export function withPageConfigs(files) {
  const extra = []
  for (const f of files) {
    if (!f.startsWith('apps/miniapp-taro/src/') || !f.endsWith('.tsx') || f.includes('/components/')) continue
    const cfg = f.replace(/\.tsx$/, '.config.ts')
    if (!files.includes(cfg)) extra.push(cfg)
  }
  return [...files, ...extra]
}

// ── GA7:RN/共享屏层 同屏双份返回 affordance / 双层页头(2026-09-26 立) ─────────────────
/** 屏目录 = 会作为"一整屏"被挂载的组件所在处;components/ 是机制文件,不作屏判(与 GA6 同理)。 */
const RN_SCREEN_PREFIXES = ['packages/app/src/features/', 'apps/mobile-rn/src/screens/']
/** RN 面的两个包前缀(H3 与依赖枚举的射程;不含 extension/desktop/web —— 它们没有 RN chrome) */
const RN_FACE_PREFIXES = ['packages/app/src', 'apps/mobile-rn/src']
const RN_APP_BARREL = 'packages/app/src/index.ts'
const RN_HEADER_GREP_DIRS = ['packages/app/src', 'apps/mobile-rn/src']
const HEADER_SHOWN_TRUE_RE = /headerShown\s*:\s*true/

/**
 * 标签属性里是否真有 onBack。`onBack={undefined}` 形态不算 —— NavBar 只在 onBack 存在时
 * 画 ChevronLeft(NavBar.tsx:79 `{onBack ? ... : null}` 实测),传 undefined 等于没画。
 */
export function tagHasOnBack(attrs) {
  const total = (attrs.match(/\bonBack\b/g) || []).length
  if (total === 0) return false
  const undef = (attrs.match(/onBack\s*=\s*\{\s*undefined\s*\}/g) || []).length
  return total > undef
}

/** 扁平收一遍所有非闭合标签(不建祖先栈 —— GA7 不需要 affordance 证据,也因此不继承栈失配盲区) */
function collectTags(code, strMask) {
  const tags = []
  for (let i = 0; i < code.length; i++) {
    if (code[i] !== '<') continue
    const t = parseTagAt(code, i, strMask)
    if (!t) continue
    if (t.kind !== 'close')
      tags.push({ name: t.name, attrs: t.attrs, pos: t.start, line: lineOf(code, t.start) })
    i = t.end - 1
  }
  return tags
}

/**
 * "分支"= 紧邻其前的 `return` 关键字把文件切成的段(段号 = 之前 return 的个数)。
 * 立门的实证依据(2026-09-26,HEAD 面 12 处首跑读数里 9 处是这个形态):屏文件常有
 * **互斥的多个 return 分支**(loading / 错误态 / 正常态,如 ActivityDetailScreen 的
 * returns@26,40,57,84 各带一套页头),它们**从不同时出现在同一屏**。按整文件计数会把
 * 这一族全判成"双层页头" —— 那是假阳,而假阳指使人去"修"没坏的东西(门 118 的教训)。
 * 嵌套函数(如 .map 回调)的 return 也会切段:切多了只会**漏判**,与"宁漏不误报"同向。
 */
function branchOf(pos, returnOffsets) {
  let b = 0
  for (const r of returnOffsets) {
    if (r < pos) b++
    else break
  }
  return b
}

/** 页头级返回键渲染点:<BackChevron> 或 带 onBack 的 <NavBar>(NavBar 无 onBack 不画箭头) */
function headerRenders(tags) {
  return tags.filter((t) => t.name === 'BackChevron' || (t.name === 'NavBar' && tagHasOnBack(t.attrs)))
}

const IMPORT_RE =
  /import\s+(?:type\s+)?([\w$]+|\*\s+as\s+[\w$]+|\{[^}]*\})\s*(?:,[\s\S]{0,400}?)?from\s*['"]([^'"]+)['"]/g

/** 本地名 → { spec(模块说明符), exported(源侧名) }。多行具名导入按 `[^}]*` 吃到闭合。 */
export function importsOf(code) {
  const map = new Map()
  for (const m of code.matchAll(IMPORT_RE)) {
    const clause = m[1].trim()
    const spec = m[2]
    if (clause.startsWith('{')) {
      for (const raw of clause.slice(1, -1).split(',')) {
        const part = raw.trim().replace(/^type\s+/, '')
        if (!part) continue
        const asM = part.match(/^([\w$]+)\s+as\s+([\w$]+)$/)
        if (asM) map.set(asM[2], { spec, exported: asM[1] })
        else if (/^[\w$]+$/.test(part)) map.set(part, { spec, exported: part })
      }
    } else if (/^[\w$]+$/.test(clause)) map.set(clause, { spec, exported: 'default' })
    else {
      const nsM = clause.match(/\*\s+as\s+([\w$]+)/)
      if (nsM) map.set(nsM[1], { spec, exported: '*' })
    }
  }
  return map
}

/** barrel 的命名再导出:消费侧可见名 → './rel'。export * 存在时表可能不全 ⇒ 带旗,查不到就判未判定。 */
export function barrelExportMap(barrelText) {
  const map = new Map()
  for (const m of barrelText.matchAll(/export\s*\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]/g)) {
    for (const raw of m[1].split(',')) {
      const part = raw.trim().replace(/^type\s+/, '')
      if (!part) continue
      const asM = part.match(/^([\w$]+)\s+as\s+([\w$]+)$/)
      map.set(asM ? asM[2] : part, m[2])
    }
  }
  return { map, star: /export\s*\*\s*from/.test(barrelText) }
}

/** 仓内 POSIX 风格的相对路径解算(不经 node:path,避免 Windows 反斜杠把仓库路径打歪) */
export function resolveRelPath(fromRel, spec) {
  const segs = fromRel.split('/').slice(0, -1)
  for (const p of spec.split('/')) {
    if (p === '' || p === '.') continue
    else if (p === '..') segs.pop()
    else segs.push(p)
  }
  return segs.join('/')
}

/** TS 解析顺序的同形探针:原样 → .tsx → .ts → .js → /index.tsx → /index.ts;ENOENT=null,其它异常照抛 */
function probeExt(base, read) {
  for (const cand of [base, `${base}.tsx`, `${base}.ts`, `${base}.js`, `${base}/index.tsx`, `${base}/index.ts`]) {
    let v
    try {
      v = read(cand)
    } catch (e) {
      if (e && e.code === 'ENOENT') continue
      throw e
    }
    if (v !== null && v !== undefined) return cand
  }
  return null
}

/**
 * H2 的依赖批次(GA6 的 config 批次同型):凡含 `<BackChevron`/`<NavBar` 的 RN 面文件 + barrel,
 * 必须进**同一个 catBatch 同面**预读,否则 --staged 只含 wrapper 时子屏永远"取不到"⇒ 整条判据
 * 在提交链上失明(判不出被洗成没命中,正是本仓"看起来全绿"那一型)。
 * grep 失败 ⇒ 返回 [] —— 效果是 H2 全部计未判定并在报告点名,绝不静默放行。
 */
export function headerBackFiles(cwd, face) {
  const pat = '<BackChevron|<NavBar'
  const args =
    face === 'head'
      ? ['grep', '-l', '-I', '-E', pat, 'HEAD', '--', ...RN_HEADER_GREP_DIRS]
      : face === 'index'
        ? ['grep', '--cached', '-l', '-I', '-E', pat, '--', ...RN_HEADER_GREP_DIRS]
        : ['grep', '-l', '-I', '-E', pat, '--', ...RN_HEADER_GREP_DIRS]
  try {
    return gitGrep(args, cwd)
      .split('\n')
      .filter(Boolean)
      .map((l) => l.replace(/^HEAD:/, '').replaceAll('\\', '/'))
  } catch {
    return []
  }
}

/**
 * GA7 主判据(纯函数:与屏文件同一个 readFile,自检直接喂内存 map)。
 * 返回 { findings, undetermined } —— findings 全带 rule:'GA7'。
 */
export function findRnDoubleHeaders(readFile, files) {
  const findings = []
  const undetermined = []
  const read = (p) => {
    try {
      return readFile(p)
    } catch (e) {
      if (e && e.code === 'ENOENT') return null
      throw e
    }
  }
  let barrelCache
  for (const rel of files) {
    const src = read(rel)
    if (src === null) continue
    if (NAV_CHROME_EXEMPT_RE.test(src)) continue
    const isRnFace = RN_FACE_PREFIXES.some((p) => rel.startsWith(p + '/'))
    if (!isRnFace) continue
    const isTsx = TSX_RE.test(rel)
    const isScreen = isTsx && RN_SCREEN_PREFIXES.some((p) => rel.startsWith(p))
    const { code, strMask } = stripCommentsKeepStrings(src)
    // H3:屏目录/导航面任何文件把原生 header 翻回来(RootNavigator 两栈已全局 false,实测 :502/:602)
    if (isTsx || rel.endsWith('.ts')) {
      const hm = code.match(HEADER_SHOWN_TRUE_RE)
      if (hm) {
        findings.push({
          rule: 'GA7',
          file: rel,
          line: lineOf(code, code.indexOf(hm[0])),
          msg: `headerShown:true 在 RN 面复现 —— apps/mobile-rn 的 RootStack 与 MainTabs 两个栈都写了 headerShown:false(RootNavigator.tsx:502/602),而屏目录的屏一律自绘页头;翻回 true 即原生标题条 + 自绘页头 = 同屏双层 chrome。确有屏要用原生 header,就不该再自绘页头,并写 nav-chrome-exempt: <为什么破全局-off 设计>`,
        })
      }
    }
    if (!isScreen) continue
    const tags = collectTags(code, strMask)
    const returnOffsets = []
    for (const m of code.matchAll(/\breturn\b/g)) returnOffsets.push(m.index)
    const own = headerRenders(tags)
    const ownBranches = own.map((h) => branchOf(h.pos, returnOffsets))
    // H1:**同一 return 分支**里两套页头返回键。互斥分支各画一套(loading/错误态/正常态)是正当形态
    // —— 首跑 12 处读数里 9 处即此型(ActivityDetailScreen returns@26,40,57 各带一套),按整文件
    // 计数会把它判成假阳;假阳指使人去"修"没坏的东西(门 118 教训)。
    const perBranch = new Map()
    own.forEach((h, i) => {
      const b = ownBranches[i]
      if (!perBranch.has(b)) perBranch.set(b, [])
      perBranch.get(b).push(h)
    })
    for (const [, hs] of perBranch) {
      if (hs.length < 2) continue
      findings.push({
        rule: 'GA7',
        file: rel,
        line: hs[1].line,
        msg: `同一 return 分支出现 ${hs.length} 处页头返回键(${hs.map((h) => `<${h.name}> L${h.line}`).join(' + ')})⇒ 同屏两个返回 affordance / 双层页头。页头只留一处:chrome 的返回交给 NavBar(onBack),页内 <BackChevron/> 删掉(标题行留着)`,
      })
    }
    // H2:自带页头返回键 × **同分支**把 onBack 传给"自己也画页头"的子屏
    const childTags = tags.filter(
      (t) =>
        /^[A-Z]/.test(t.name) &&
        t.name !== 'NavBar' &&
        t.name !== 'BackChevron' &&
        tagHasOnBack(t.attrs) &&
        ownBranches.includes(branchOf(t.pos, returnOffsets)),
    )
    if (own.length >= 1 && childTags.length > 0) {
      const imap = importsOf(code)
      if (barrelCache === undefined) {
        const b = read(RN_APP_BARREL)
        barrelCache = b === null ? null : barrelExportMap(b)
      }
      for (const t of childTags) {
        // 本文件自己定义的组件不算"跨文件子屏":同文件里的 <BackChevron> 无论写在哪个子渲染函数,
        // collectTags 都已计入 own ⇒ 双份由 H1 负责;在这里再判会产出"本地组件解不出 import"的假未判定噪声。
        if (new RegExp(`(?:function|const|class)\\s+${t.name}\\b`).test(code)) continue
        const imp = imap.get(t.name)
        if (!imp) {
          undetermined.push(`${rel}:<${t.name}> 传了 onBack 但本文件解不出它的 import 来源 ⇒ 子屏是否自绘页头未判定`)
          continue
        }
        let target = null
        if (imp.spec === '@ihui/rn-app') {
          if (!barrelCache) {
            undetermined.push(`${rel}:${RN_APP_BARREL} 在所选取材面取不到 ⇒ barrel 解不出(不记绿)`)
            continue
          }
          const spec = barrelCache.map.get(imp.exported)
          if (!spec) {
            undetermined.push(
              `${rel}:${RN_APP_BARREL} 的命名再导出里找不到 ${imp.exported}${barrelCache.star ? '(且 barrel 有 export *,表可能不全)' : ''} ⇒ 未判定`,
            )
            continue
          }
          target = probeExt(resolveRelPath(RN_APP_BARREL, spec), read)
        } else if (imp.spec.startsWith('.')) {
          target = probeExt(resolveRelPath(rel, imp.spec), read)
        } else continue // npm 包的组件不是自家屏,不判
        if (!target) {
          undetermined.push(`${rel}:<${t.name}> 的 import(${imp.spec})在本面解析不到文件 ⇒ 未判定`)
          continue
        }
        // 子组件不是屏目录(drawer/dialog/基础件都可以合法带自己的 onBack)⇒ 不判
        if (!RN_SCREEN_PREFIXES.some((p) => target.startsWith(p))) continue
        const dep = read(target)
        if (dep === null) {
          undetermined.push(`${rel}:子屏 ${target} 取不到内容 ⇒ 未判定`)
          continue
        }
        const d = stripCommentsKeepStrings(dep)
        if (headerRenders(collectTags(d.code, d.strMask)).length >= 1) {
          findings.push({
            rule: 'GA7',
            file: rel,
            line: t.line,
            msg: `本屏自带页头返回键(${own.map((h) => `<${h.name}>`).join('/')}),又把 onBack 传给 <${t.name}> —— 它解析到 ${target},其内容**又**自绘页头返回键 ⇒ 同屏两个返回箭头(phone-set2.png 的「设置+菜单」栏下再来一条「< 设置」正是这一型)。改法:组合层别把 chrome 的 onBack 喂给自带页头的子屏,或子屏删自绘画头、标题/返回统一由外层 NavBar`,
          })
        }
      }
    }
  }
  return { findings, undetermined }
}


// ── 扫描(纯函数:自检直接喂内存 reader,不做任何 git 写) ──────────────────────────────
export function scan(readFile, files, opts = {}) {
  const v = { s0: [], ga1: [], ga2: [], ga4: [], ga5: [], ga6: [], ga7: [] }
  const notes = {
    totalFiles: files.length,
    scanned: 0,
    selfExempt: 0,
    skipped: 0,
    unreadable: [],
    exempt: 0,
    backExempt: 0,
    undetermined: [],
    chromeUndetermined: [],
    rnDoubleUndetermined: [],
    backBlind: [],
    wiringSkipped: !opts.checkWiring,
  }
  for (const rel of files) {
    // 顺序要紧:先认自豁免(本门必含被判据字面量),再按扩展名筛 —— 反过来就永远数不到
    if (SELF_EXEMPT_RE.test(rel)) {
      notes.selfExempt++
      continue
    }
    if (!SRC_RE.test(rel)) {
      notes.skipped++
      continue
    }
    const text = readFile(rel)
    if (text === null) {
      notes.unreadable.push(rel)
      continue
    }
    notes.scanned++
    const { findings, notes: fn } = auditFile(rel, text)
    notes.exempt += fn.exempt
    notes.backExempt += fn.backExempt
    for (const b of fn.backBlind) notes.backBlind.push(b)
    for (const u of fn.undetermined) notes.undetermined.push(`${rel}: ${u}`)
    for (const f of findings) v[f.rule.toLowerCase()].push(f)
  }
  // GA6 是**跨文件**判据(页面 × 页面 config),必须在整轮逐文件循环之后跑,
  // 且与屏文件走同一个 readFile —— 换面就换一个结论(守门 77/83 的"两面同轮"纪律)。
  for (const h of findChromeDuplicates(readFile, files)) {
    if (h.undetermined) notes.chromeUndetermined.push(h)
    else v.ga6.push(h)
  }
  // GA7 与屏文件走**同一个 readFile**(同面同轮,守门 77/83 纪律):它要读的 barrel 与子屏文件
  // 已由 scanRepo 的 headerBackFiles 批次补进 —— 漏补会让 --staged 只含 wrapper 时整条失明。
  const rn = findRnDoubleHeaders(readFile, files)
  for (const f of rn.findings) v.ga7.push(f)
  for (const u of rn.undetermined) notes.rnDoubleUndetermined.push(u)
  // S0 与屏文件走同一个取材面 —— 否则 --root/工作树通道下发的是 worktree,
  // 而 S1 偷读 HEAD,结论会自相矛盾。机制文件自身不算"消费者"(它们互相含名字,会假接线)。
  const mechSet = new Set(MECHANISMS.map((m) => m.file))
  const wiringOf = (mech) => {
    if (opts.wiring) return opts.wiring.get(mech.file) || []
    if (!opts.checkWiring) return null // 判不出 ⇒ 不判,但输出里如实说明"未判定"
    return (opts.wireUniverse || files)
      .filter((f) => !mechSet.has(f) && !SELF_EXEMPT_RE.test(f))
      .filter((f) => {
        const t = readFile(f)
        return t !== null && t.includes(mech.symbol)
      })
  }
  for (const mech of MECHANISMS) {
    const text = readFile(mech.file)
    if (text === null) {
      v.s0.push({
        file: mech.file,
        line: 0,
        msg: `取不到内容 ⇒ 无法判定共享「更多」实现在位(${mech.note})`,
      })
      continue
    }
    if (!mech.icon.test(text))
      v.s0.push({
        file: mech.file,
        line: 1,
        msg: `不再引用矢量图标(${mech.note})—— 疑似被改回文本字形`,
      })
    const wiredBy = wiringOf(mech)
    if (wiredBy !== null && wiredBy.length === 0)
      v.s0.push({
        file: mech.file,
        line: 1,
        msg: '在位但无人 import —— 共享实现造好没装车,等于没有(守门 64 同型)',
      })
  }
  return { violations: v, notes, fileCount: notes.scanned }
}

/**
 * 消费者清单(按面):一次 `git grep -l -F <符号>` 就够,且**必须**用完整扫描面而不是
 * 预筛后的候选集 —— 预筛只留"含判据字面量"的文件,拿它判"有没有人 import"会假报未接线。
 */
function computeWiring(cwd, face) {
  const map = new Map()
  for (const mech of MECHANISMS) {
    const symbol = mech.symbol
    const args =
      face === 'head'
        ? ['grep', '-l', '-I', '-F', symbol, 'HEAD', '--', ...SCAN_DIRS]
        : face === 'index'
          ? ['grep', '--cached', '-l', '-I', '-F', symbol, '--', ...SCAN_DIRS]
          : ['grep', '-l', '-I', '-F', symbol, '--', ...SCAN_DIRS]
    const out = gitGrep(args, cwd)
    map.set(
      mech.file,
      out
        .split('\n')
        .map((l) => l.replace(/^HEAD:/, '').replaceAll('\\', '/'))
        .filter((p) => p && p !== mech.file && !SELF_EXEMPT_RE.test(p)),
    )
  }
  return map
}

/** 仓库级扫描:清单 + 预筛 + 同面取材。explicitFiles(按文件自验)时判定宇宙太小 ⇒ 不判 wiring */
export function scanRepo(root, face, explicitFiles, opts = {}) {
  const all = explicitFiles ? explicitFiles.filter((p) => SRC_RE.test(p)) : surfaceFiles(root, face)
  let files = all
  if (!explicitFiles) {
    const cand = candidateSet(root, face)
    if (cand) files = all.filter((f) => cand.has(f) || MECHANISMS.some((m) => m.file === f))
    for (const m of MECHANISMS)
      if (!files.includes(m.file) && all.includes(m.file)) files.push(m.file)
  }
  const reader = makeReader(root, face, [
    ...new Set([
      ...withPageConfigs(files),
      ...headerBackFiles(root, face),
      RN_APP_BARREL,
      ...MECHANISMS.map((m) => m.file),
      GLOBAL_APP_CONFIG,
    ]),
  ])
  return {
    result: scan(reader, files, { checkWiring: !!opts.wiring, wiring: opts.wiring }),
    surface: all.length,
  }
}

/** 每个文件的违规条数(GA1+GA2+GA4+GA5+GA6+GA7),用于棘轮锚点 */
function countsByFile(result) {
  const per = new Map()
  for (const arr of [
    result.violations.ga1,
    result.violations.ga2,
    result.violations.ga4,
    result.violations.ga5,
    result.violations.ga6,
    result.violations.ga7,
  ])
    for (const f of arr) per.set(f.file, (per.get(f.file) || 0) + 1)
  return per
}

/**
 * 棘轮比对(单独成函数,好让自检能直接喂计数做正反对照)。
 * 锚点 = 该文件 HEAD 自身的条数;相等或更少 ⇒ 只算存量,更多 ⇒ 新增。
 * 没有锚点(HEAD 里没这个路径)⇒ 锚点按 0,即新文件零容忍。
 */
export function splitFresh(nowCounts, headCounts) {
  const fresh = []
  let tolerated = 0
  for (const [rel, n] of nowCounts) {
    const tol = headCounts.get(rel) || 0
    if (n > tol) fresh.push({ rel, n, tol })
    else tolerated += n
  }
  return { fresh, tolerated }
}

const fmt = (arr) => arr.map((f) => `${f.file}:${f.line} ${f.msg}`)

function report(res, meta) {
  const { violations: v, notes } = res
  const filesGA1 = new Set(v.ga1.map((f) => f.file)).size
  const filesGA2 = new Set(v.ga2.map((f) => f.file)).size
  const filesGA4 = new Set(v.ga4.map((f) => f.file)).size
  const filesGA5 = new Set(v.ga5.map((f) => f.file)).size
  const filesGA6 = new Set(v.ga6.map((f) => f.file)).size
  const filesGA7 = new Set(v.ga7.map((f) => f.file)).size
  const total =
    v.s0.length + v.ga1.length + v.ga2.length + v.ga4.length + v.ga5.length + v.ga6.length + v.ga7.length
  const lines = [
    `文本箭头/文字返回对账(GA)|面=${meta.faceLabel}`,
    `  实读 ${notes.scanned} 个源文件(预筛后候选 ${notes.totalFiles},受管面共 ${meta.surface};S0 机制文件 ${MECHANISMS.length} 个恒实读)${meta.anchorLabel ? ` | ${meta.anchorLabel}` : ''}`,
    `  S0   共享矢量实现在位 ${v.s0.length ? '❌ ' + v.s0.length : '✅ 0'}`,
    `  GA1  文本字形当 chevron ${v.ga1.length ? `${meta.verdictLabel} ${v.ga1.length} 处 / ${filesGA1} 文件` : '✅ 0'}`,
    `  GA2  箭头字号 > 标签字号 ${v.ga2.length ? `${meta.verdictLabel} ${v.ga2.length} 处 / ${filesGA2} 文件` : '✅ 0'}`,
    `  GA4  文字「返回」当返回箭头 ${v.ga4.length ? `${meta.verdictLabel} ${v.ga4.length} 处 / ${filesGA4} 文件` : '✅ 0'}`,
    `  GA5  字形+「返回」混合写法 ${v.ga5.length ? `${meta.verdictLabel} ${v.ga5.length} 处 / ${filesGA5} 文件` : '✅ 0'}`,
    `  GA6  页内返回键与原生导航栏同屏 ${v.ga6.length ? `${meta.verdictLabel} ${v.ga6.length} 处 / ${filesGA6} 文件` : '✅ 0'}`,
    `  GA7  RN/共享层同屏双返回·双层页头 ${v.ga7.length ? `${meta.verdictLabel} ${v.ga7.length} 处 / ${filesGA7} 文件` : '✅ 0'}`,
    `  自豁免(门自身与其测试必含被判据字面量):${notes.selfExempt} 个文件${notes.skipped ? `;非受管扩展名跳过 ${notes.skipped} 个` : ''}`,
  ]
  if (notes.exempt) lines.push(`  行内豁免 glyph-arrow-exempt 放过:${notes.exempt} 处`)
  if (notes.backExempt) lines.push(`  行内豁免 back-label-exempt 放过:${notes.backExempt} 处`)
  if (notes.undetermined.length)
    lines.push(`  GA2 单位不一致、判不出:${notes.undetermined.length} 对(不判红,如实计数)`)
  if (notes.backBlind.length)
    lines.push(
      `  ⚠️ GA4/GA5 遍历盲区:${notes.backBlind.length} 处渲染位「返回」被宽松正则看到、而栈遍历一个都没咨询过(= 本门对这些格子**没有判据覆盖**,不是"通过"):`,
    )
    for (const b of notes.backBlind.slice(0, 12))
      lines.push(`      · ${b.file}:${b.line}`)
    if (notes.backBlind.length > 12) lines.push(`      …另有 ${notes.backBlind.length - 12} 处`)
  if (notes.chromeUndetermined.length)
    lines.push(
      `  ⚠️ GA6 导航栏形态未判定:${notes.chromeUndetermined.length} 个页面(页面 config 与 app.config 都取不到 ⇒ 这一型本轮没看守,不是通过):${notes.chromeUndetermined.map((h) => h.file).slice(0, 6).join(', ')}`,
    )
  if (notes.rnDoubleUndetermined.length)
    lines.push(
      `  ⚠️ GA7 子屏来源未判定:${notes.rnDoubleUndetermined.length} 处(import/barrel/目标在所选面取不到 ⇒ 这些组合本轮没看守,不是通过):`,
    )
  for (const u of notes.rnDoubleUndetermined.slice(0, 8)) lines.push(`      · ${u}`)
  if (notes.rnDoubleUndetermined.length > 8)
    lines.push(`      …另有 ${notes.rnDoubleUndetermined.length - 8} 处(--json 看全量)`)
  if (notes.wiringSkipped)
    lines.push('  S0 的"是否被 import"一侧:本轮按文件自验,未判定(不静默当作通过)')
  for (const x of fmt(v.s0)) lines.push(`  ✗ ${x}`)
  for (const x of fmt(v.ga1)) lines.push(`  ✗ ${x}`)
  for (const x of fmt(v.ga2)) lines.push(`  ✗ ${x}`)
  for (const x of fmt(v.ga4)) lines.push(`  ✗ ${x}`)
  for (const x of fmt(v.ga5)) lines.push(`  ✗ ${x}`)
  for (const x of fmt(v.ga6)) lines.push(`  ✗ ${x}`)
  for (const x of fmt(v.ga7)) lines.push(`  ✗ ${x}`)
  return { lines, total }
}

function usage() {
  console.log(`
check-glyph-arrow-icon.mjs — 文本箭头当图标 / 「箭头比标签还大」对账(守门 GA)

用法:
  node scripts/check-glyph-arrow-icon.mjs                 全量审计(判 HEAD blob,存量只报数)
  node scripts/check-glyph-arrow-icon.mjs --staged        pre-commit(判索引 blob,锚点=该文件 HEAD 自身)
  node scripts/check-glyph-arrow-icon.mjs --files a b     按文件自验(工作树内容,锚点仍是 HEAD)
  node scripts/check-glyph-arrow-icon.mjs --worktree      逃生舱:整面按磁盘判(不作结论)
  node scripts/check-glyph-arrow-icon.mjs --json          机器可读输出(只吐一份可 jq 的文档)
  node scripts/check-glyph-arrow-icon.mjs --self-test     判据自检(正反成对,纯内存不碰 git)
  node scripts/check-glyph-arrow-icon.mjs --root <dir>    指定仓根(测试/多仓自验用)

判据:
  - S0   共享矢量实现在位、仍引用矢量图标、仍被 import(三端「更多」+ web/RN/小程序三处返回键实现)
  - GA1  JSX 元素的唯一子内容恰为 › » → 》 ‹ ← 或 {'>'} 这类字形,且语境可证是 affordance
  - GA2  同一文件里 more/viewAll 标签与同词干 *Arrow* 键都写了字号,且箭头更大(单位须一致)
  - GA4  JSX 元素的唯一子内容是「返回」类文案(t('common.back') / 字面量),且语境可证是 affordance
         ⇒ 即"把返回两个字当返回箭头用";带宾语的按钮标签(backHome/backLogin/prevMonth)刻意不纳
  - GA5  「返回」与字形**混写成整格**(\`← 返回\` / \`‹ 返回\`)—— GA1 只看整格字形、GA4 只看整格文案,这一型两条都不纳
  - GA6  小程序页面渲染页内返回键(BackChevron / NavBar)却是**原生导航栏** ⇒ 同屏两个返回箭头
         (判 Taro 页面 config,页内没写则继承 app.config.ts;两处都取不到 ⇒ 未判定,不记绿)
  - GA7  RN/共享屏层同屏双返回 · 双层页头(屏目录 H1 同文件两套页头返回键 / H2 onBack 传给
         一跳解析后自绘页头的子屏 / H3 headerShown:true 在 RN 面回潮;解析不出 ⇒ 未判定点名)

豁免:行内 \`glyph-arrow-exempt: <一句话原因>\`(GA1/GA2)
      行内 \`back-label-exempt: <一句话原因>\`(GA4/GA5,写在命中行、可点元素起始行或其紧邻上行)
      文件级 \`nav-chrome-exempt: <一句话原因>\`(GA6/GA7,页面级配置/组合与渲染不在某一行上)
      前两者是逐行通道、裸标记不生效;裸 nav-chrome-exempt 不带原因同样不生效
退出码:0=通过/无新增 1=有违规 2=无法判定(git 失败 / 取材面取不到 / 扫描面为空)
紧急跳过:HUSKY_SKIP_GLYPH_ARROW_ICON=1 git commit ...
`)
}

function main(argv) {
  const ri = argv.indexOf('--root')
  const root = ri >= 0 ? resolve(argv[ri + 1]) : ROOT
  if (argv.includes('--self-test')) return selfTest()
  if (argv.includes('--help')) {
    usage()
    return 0
  }
  const fi = argv.indexOf('--files')
  const explicit =
    fi >= 0
      ? argv
          .slice(fi + 1)
          .filter((a) => !a.startsWith('--'))
          .map((p) => p.replaceAll('\\', '/').replace(/^\.\//, ''))
      : null
  if (!explicit && process.env[SELF_SKIP] === '1') {
    console.log(`⏭️  已跳过(${SELF_SKIP}=1):文本箭头图标对账未执行`)
    return 0
  }
  if (['--staged', '--worktree'].filter((f) => argv.includes(f)).length > 1) {
    console.error('❌ --staged 与 --worktree 互斥:同一轮只允许一个取材面')
    return 2
  }
  const face = explicit
    ? 'worktree'
    : argv.includes('--staged')
      ? 'index'
      : argv.includes('--worktree')
        ? 'worktree'
        : 'head'
  if (explicit && argv.includes('--worktree'))
    console.log('  (注:--files 已隐含工作树取材,--worktree 被忽略)')

  let judged
  let judgedFiles = null
  let surface = 0
  try {
    if (explicit) {
      const missing = explicit.filter((p) => !existsSync(join(root, p)))
      if (missing.length) {
        console.error(`❌ --files 里这些路径不存在 ⇒ 无法判定:${missing.join(', ')}`)
        return 2
      }
      judged = scanRepo(root, 'worktree', explicit)
    } else if (face === 'index') {
      judgedFiles = stagedFiles(root)
      if (!judgedFiles.length) {
        console.log('✅ 暂存区无受管源码文件,跳过(取材面正常)')
        return 0
      }
      judged = scanRepo(root, 'index', judgedFiles, { wiring: computeWiring(root, 'index') })
    } else {
      judged = scanRepo(root, face, null, { wiring: computeWiring(root, face) })
    }
    surface = judged.surface
  } catch (e) {
    console.error(`无法判定(git 调用失败):${e?.message ?? e}`)
    return 2
  }
  const res = judged.result
  if (!explicit && res.notes.totalFiles === 0) {
    console.error('❌ 扫描面解析到 0 个受管源文件 ⇒ 空扫不得记为通过')
    return 2
  }
  if (res.notes.unreadable.length) {
    console.error(
      `❌ ${res.notes.unreadable.length} 个文件在所选取材面取不到内容 ⇒ 无法判定(不记绿):${res.notes.unreadable.slice(0, 8).join(', ')}`,
    )
    return 2
  }

  // 棘轮:锚点恒为该文件 HEAD 自身的违规数。无命中时不必再扫 HEAD(热路径省一整轮派生)。
  const nowCounts = countsByFile(res)
  let fresh = []
  let tolerated = 0
  if (nowCounts.size) {
    try {
      const anchorFiles = [...nowCounts.keys()]
      const anchor = face === 'head' ? res : scanRepo(root, 'head', anchorFiles).result
      const headCounts = face === 'head' ? nowCounts : countsByFile(anchor)
      ;({ fresh, tolerated } = splitFresh(nowCounts, headCounts))
    } catch (e) {
      console.error(`无法判定(HEAD 锚点面读取失败):${e?.message ?? e}`)
      return 2
    }
  }
  const meta = {
    faceLabel: explicit
      ? `工作树 --files ${surface} 个(仅供自验)`
      : face === 'index'
        ? `索引 blob(--staged,判定 ${surface} 个暂存源文件)`
        : face === 'worktree'
          ? '工作树(逃生舱,不作结论)'
          : 'HEAD blob(全量审计)',
    anchorLabel:
      face === 'head'
        ? '全量模式:锚点即自身 ⇒ 存量只报数'
        : `新增 ${fresh.length} 文件 / 存量容忍 ${tolerated} 处`,
    surface,
    // 计数前的定语必须说清"这些数是存量还是新增" —— 全量模式的 GA1/GA2 是 HEAD 存量,
    // 而 --staged / --files 面里越线的才是"这次加的"(写成"违规"会让下一个人以为门在红)。
    verdictLabel: fresh.length ? '❌ 越线' : face === 'head' ? '⚠️ HEAD 存量' : '⚠️ 存量(未越线)',
  }
  const { lines, total } = report(res, meta)
  const s0Broken = res.violations.s0.length > 0
  if (argv.includes('--json')) {
    console.log(
      JSON.stringify(
        {
          face,
          surface,
          violations: res.violations,
          notes: res.notes,
          fresh,
          tolerated,
          ok: !s0Broken && fresh.length === 0,
        },
        null,
        2,
      ),
    )
    return s0Broken || fresh.length ? 1 : 0
  }
  lines.forEach((l) => console.log(l))
  if (s0Broken) {
    console.log(
      `\n❌ S0 红:${res.violations.s0.length} 处 —— 共享「更多」实现被摘线,四端会各自回潮。`,
    )
    console.log(`   紧急跳过:${SELF_SKIP}=1(会连同把机制回归留在 main 上,勿滥用)`)
    return 1
  }
  if (fresh.length) {
    console.log(`\n❌ 新增违规(只拦"这次把绕档加回来了",锚点 = 该文件 HEAD 自身):`)
    for (const p of fresh) console.log(`   ${p.rel}(HEAD 自身 ${p.tol} 处 → 本次 ${p.n} 处)`)
    console.log(
      `   单独复现:node scripts/check-glyph-arrow-icon.mjs --files ${fresh.map((p) => p.rel).join(' ')}`,
    )
    console.log(
      `   改法:箭头一律走共享实现 —— 「更多」系 MoreLink / ViewMoreLink / LineIcon(chevron-right),`,
    )
    console.log(
      `         页头返回键 web/RN 用 ChevronLeft、小程序用 <BackChevron />;文本字形与文字标签都不得再写;`,
    )
    console.log(
      `         确属按钮标签写 \`back-label-exempt: <原因>\`,其他例外写 \`glyph-arrow-exempt: <原因>\``,
    )
    console.log(`   紧急跳过:${SELF_SKIP}=1 git commit ...`)
    return 1
  }
  if (total === 0)
    console.log('✅ 无文本箭头字形、无文字返回键、无字号倒挂、共享矢量实现在位')
  else
    console.log(
      `\n✅ 提交链口径无新增(GA1/GA2 为 HEAD 存量,按文件棘轮容忍 ${tolerated} 处;清理办法是把命中行的箭头换成矢量)`,
    )
  return 0
}

// ── 自检:正反成对 + 端到端(纯内存 reader,不产生任何 git 写) ───────────────────────────
const MECH_SNIPPETS = {
  'packages/app/src/components/MoreLink.tsx':
    "import { Pressable, Text } from 'react-native'\nimport { ChevronRight } from 'lucide-react-native'\nexport function MoreLink({ label }) {\n  return <Pressable onPress={() => {}}><Text>{label}</Text><ChevronRight size={12} /></Pressable>\n}\n",
  'apps/web/src/components/common/view-more-link.tsx':
    "import Link from 'next/link'\nimport { ChevronRight } from 'lucide-react'\nexport function ViewMoreLink({ label }) {\n  return <Link href='/a'><span>{label}</span><ChevronRight className='h-3 w-3' /></Link>\n}\n",
  'apps/miniapp-taro/src/components/LineIcon/icons.ts':
    "export const ICONS = {\n  'chevron-right': '<svg><path d=\"m9 18 6-6-6-6\" /></svg>',\n}\n",
  'apps/miniapp-taro/src/components/BackChevron.tsx':
    "import LineIcon from '@/components/LineIcon'\nexport default function BackChevron({ onTap }) {\n  return <View onClick={onTap}><LineIcon name=\"chevron-left\" size={40} /></View>\n}\n",
  'packages/app/src/components/BackChevron.tsx':
    "import { Pressable } from 'react-native'\nimport { ChevronLeft } from 'lucide-react-native'\nexport function BackChevron({ onPress }) {\n  return <Pressable onPress={onPress}><ChevronLeft size={18} /></Pressable>\n}\n",
}

function selfTest() {
  const cases = []
  const t = (name, pass, detail = '') => cases.push({ name, pass, detail })
  const run = (files) => {
    const read = (p) => (p in files ? files[p] : null)
    const { violations, notes } = scan(read, Object.keys(files), { checkWiring: true })
    return {
      ga1: violations.ga1,
      ga2: violations.ga2,
      ga4: violations.ga4,
      ga5: violations.ga5,
      ga6: violations.ga6,
      ga7: violations.ga7,
      s0: violations.s0,
      notes,
      n1: violations.ga1.length,
      n2: violations.ga2.length,
      n4: violations.ga4.length,
      n5: violations.ga5.length,
      n6: violations.ga6.length,
      n7: violations.ga7.length,
      ncu: notes.chromeUndetermined.length,
      nru: notes.rnDoubleUndetermined.length,
      blind: notes.backBlind.length,
      n0: violations.s0.length,
    }
  }
  const only = (files) =>
    run({
      'packages/app/consumer.tsx':
        "import { MoreLink } from '@ihui/rn-app'\nimport { ViewMoreLink } from '@/components/common/view-more-link'\nimport SectionHeader from '@/components/SectionHeader'\nimport LineIcon from '@/components/LineIcon'\nimport BackChevron from '@/components/BackChevron'\nexport const K = [MoreLink, ViewMoreLink, SectionHeader, LineIcon, BackChevron]\n",
      ...MECH_SNIPPETS,
      ...files,
    })

  // GA1:阳性对照(探针必须看得见已知目标,否则"扫到 0"毫无意义)
  const CONTROL_TSX =
    'export function Card({ go }) {\n  return (\n    <View onClick={go}>\n      <Text>最近学习</Text>\n      <Text className="text-[32rpx] text-muted-foreground">›</Text>\n    </View>\n  )\n}\n'
  t(
    'GA1 阳性对照:onClick 容器里的整格 › 看得见',
    only({ 'packages/app/x.tsx': CONTROL_TSX }).n1 === 1,
  )
  // 扩展名对账:同一条内容换扩展名,结论必须不变。全仓 .jsx 存量实测为 0,所以"不扩"今天不出事 ——
  // 但"今天没有受害者"从来不是"判据覆盖了"的证据(本门立项就是因为左向 ‹ 不在字符集里)。
  t(
    '属性表达式里的 `<=` 不得让标签解析提前放弃(parseTagAt 的 `<` 只在深度 0 才拒)',
    // 同一条内容,只把 style 数组里的 `<=` 换成 `===` ⇒ 结论必须一致;
    // 旧实现(`c === "<"` 无条件 return null)会让带 `<=` 那一支整个文件的遍历静默失配。
    only({
      'packages/app/src/features/probe/A.tsx':
        'export const P = ({ page, go }) => (\n  <Pressable onPress={go}>\n    <Text style={[a, page <= 1 && b]}>\n      {t(\'common.back\')}\n    </Text>\n  </Pressable>\n)\n',
    }).n4 +
      only({
        'packages/app/src/features/probe/A.tsx':
          'export const P = ({ page, go }) => (\n  <Pressable onPress={go}>\n    <Text style={[a, page === 1 && b]}>\n      {t(\'common.back\')}\n    </Text>\n  </Pressable>\n)\n',
      }).n4 ===
      2,
  )
  t(
    '盲区探针不得虚报:walker 正常咨询到的整格 ⇒ backBlind 必须为 0(虚报会让真盲区没人看)',
    only({
      'packages/app/src/features/probe/B.tsx':
        'export const P = ({ go }) => (\n  <Pressable onPress={go}>\n    <Text>\n      {t(\'common.back\')}\n    </Text>\n  </Pressable>\n)\n',
    }).blind === 0,
  )
  t(
    '扩展名对账:同一违规在 .jsx 上必须与 .tsx 同判(TSX_RE/SRC_RE 若退回只认 .tsx,本条即红)',
    only({ 'packages/app/x.jsx': CONTROL_TSX }).n1 === 1 &&
      only({ 'packages/app/x.tsx': CONTROL_TSX }).n1 === 1 &&
      only({
        'packages/app/b.jsx':
          'export function More({ go }) {\n  return <TouchableOpacity onPress={go}><Text>更多</Text><Text>{">"}</Text></TouchableOpacity>\n}\n',
      }).n1 === 1,
  )
  const CONTROL_INNER =
    'export function More({ go }) {\n  return <Text onPress={go}>查看更多 <Text>›</Text></Text>\n}\n'
  t(
    'GA1 阳性对照(任务书原文形态):<Text onPress>查看更多 <Text>›</Text></Text> 看得见',
    only({ 'packages/app/y.tsx': CONTROL_INNER }).n1 === 1,
  )
  const CONTROL_BRACED =
    'export function More({ go }) {\n  return <TouchableOpacity onPress={go}><Text>更多</Text><Text>{">"}</Text></TouchableOpacity>\n}\n'
  t(
    'GA1 阳性对照:{">"} 表达式子内容看得见(门让你这么写就得看得见)',
    only({ 'packages/app/z.tsx': CONTROL_BRACED }).n1 === 1,
  )
  t(
    'GA1 阳性对照:→ 与 》 同形认',
    only({
      'packages/app/z2.tsx':
        'export const X = ({ go }) => <Pressable onPress={go}><Text>→</Text><Text>》</Text></Pressable>\n',
    }).n1 === 2,
  )
  // GA1:反向(限制条件必须真在起作用)
  t(
    'GA1 反向:注释里的 › » 一律不判',
    only({ 'packages/app/a.tsx': '// 这里曾用 › 当箭头\n/* 还有 » 与 → */\nexport const k = 1\n' })
      .n1 === 0,
  )
  t(
    'GA1 反向:模板字符串里拼的 <span>›</span> 不算 JSX 子节点',
    only({ 'packages/app/b.ts': 'export const html = `<div><span>›</span></div>`\n' }).n1 === 0,
  )
  t(
    'GA1 反向:非整格的正文含字(查看更多 ›)不判',
    only({
      'packages/app/c.tsx': 'export const X = ({ go }) => <Text onPress={go}>查看更多 ›</Text>\n',
    }).n1 === 0,
  )
  t(
    'GA1 反向:面包屑分隔符(字形是锚点的兄弟、祖先 <nav> 无可点标记)不判 —— 闭合标签必须真出栈',
    only({
      'packages/app/d.tsx':
        "export const Crumbs = () => <nav><a href='/1'>A</a><span>›</span><a href='/2'>B</a></nav>\n",
    }).n1 === 0,
  )
  t(
    'GA1 阳性:原生 <a href> 里的整格字形必须当图标判(2026-09-26 补;生产 DOM 实测 7 个渲染实例)',
    only({
      'apps/web/app/x/a.tsx':
        'export const Card = () => (<a href="/d/1"><span>→</span></a>)\n',
    }).n1 === 1 &&
      only({ 'apps/web/app/x/b.tsx': 'export const C = () => (<button><span>›</span></button>)\n' }).n1 === 1,
  )
  t(
    'GA1 反向:比较运算符 / 泛型尖括号 / JSX 属性语法都不判',
    only({
      'packages/app/e.tsx':
        "export const Y = <T,>(a: T, b: number) => (a < b ? <Text>{'x'}</Text> : null)\n",
    }).n1 === 0,
  )
  t(
    'GA1 反向:闭合标签不同名 ⇒ 不认整格子内容',
    only({
      'packages/app/f.tsx': 'export const Z = ({ go }) => <View onClick={go}><Text>›</View>\n',
    }).n1 === 0,
  )
  t(
    'GA1 反向:配置字段 icon: "›" 不是渲染位,不判(交 11h 那套 emoji 判据)',
    only({ 'packages/app/g.ts': 'export const CFG = { icon: "›", arrow: "»" }\n' }).n1 === 0,
  )
  t(
    'GA1 反向:整格字形但整链无可点证据 ⇒ 放过(可证 affordance 这条限制生效)',
    only({
      'packages/app/h.tsx': 'export const X = () => <View><Text className="a">›</Text></View>\n',
    }).n1 === 0,
  )
  t(
    '行内豁免:必须带原因,且逐行生效(整文件免检就是洞)',
    collectExemptLines('a // glyph-arrow-exempt:\nb // glyph-arrow-exempt: 装饰性分隔符\nc')
      .size === 1,
  )
  t(
    '行内豁免:带原因的那一行放过',
    only({
      'packages/app/i.tsx':
        'export const X = ({ go }) => <View onClick={go}><Text>›</Text></View> // glyph-arrow-exempt: 与封面同源的指示符\n',
    }).n1 === 0,
  )
  t(
    '行内豁免:一行救不了同文件另一处',
    only({
      'packages/app/j.tsx':
        'export const X = ({ go }) => <View onClick={go}><Text>›</Text> // glyph-arrow-exempt: 原因\n<Text>»</Text></View>\n',
    }).n1 === 1,
  )

  // GA1:左向字形(2026-09-25 纳进来才是有牙的,不补这条就等于把新字符集写成散文)
  t(
    'GA1 阳性对照:onClick 容器里的整格 ‹ 看得见(小程序 NavBar 返回键立项时的形态)',
    only({
      'apps/miniapp-taro/src/x.tsx':
        "export const X = ({ go }) => <View onClick={go}><Text style={{ fontSize: '22px' }}>{'‹'}</Text></View>\n",
    }).n1 === 1,
  )
  t(
    'GA1 阳性对照:← 与 ‹ 同形认',
    only({
      'apps/miniapp-taro/src/x2.tsx':
        'export const X = ({ go }) => <Text onPress={go}>←</Text>\n',
    }).n1 === 1,
  )
  t(
    'GA1 反向:左向字形但整链无可点证据 ⇒ 放过(与右向同口径)',
    only({ 'apps/miniapp-taro/src/x3.tsx': 'export const X = () => <Text>‹</Text>\n' }).n1 === 0,
  )
  t(
    '预筛串必须覆盖判据字面量(否则筛后的子集让门对自己失明)',
    ['›', '»', '→', '》', '‹', '←', '返回'].every((lit) => PREFILTER.includes(lit)),
  )

  // GA4:文字「返回」摆在箭头位
  const BACK_HEADER =
    "export const P = ({ goBack }) => (\n  <View style={viewStyles.header()}>\n    <View style={viewStyles.backBtn()} onTap={goBack} hoverClass=\"opacity-60\">\n      <Text style={textStyles.back()}>{tt('common.back', '返回')}</Text>\n    </View>\n    <Text style={textStyles.title()}>{'平台活动'}</Text>\n  </View>\n)\n"
  t(
    'GA4 阳性对照:真实页头多行排版(文字在 Text 里、onTap 在祖先 View 上)看得见',
    only({ 'apps/miniapp-taro/src/p1.tsx': BACK_HEADER }).n4 === 1,
  )
  t(
    'GA4 阳性对照:祖先 View 带 onTap、子 Text 放文案 ⇒ 经祖先证据命中',
    only({
      'apps/miniapp-taro/src/p2.tsx':
        "export const P = ({ goBack }) => <View onTap={goBack}><Text style={textStyles.back()}>{tt('common.back', '返回')}</Text></View>\n",
    }).n4 === 1,
  )
  t(
    'GA4 阳性对照:{t("common.back")}(单参 i18n 调用)命中',
    only({
      'apps/miniapp-taro/src/p3.tsx':
        "export const P = ({ go }) => <Text onClick={go}>{t('common.back')}</Text>\n",
    }).n4 === 1,
  )
  t(
    'GA4 阳性对照:字面量 返回(不走 i18n 更要拦)',
    only({
      'apps/miniapp-taro/src/p4.tsx': "export const P = ({ go }) => <Text onPress={go}>返回</Text>\n",
    }).n4 === 1,
  )
  t(
    'GA4 阳性对照:back4 这类带序号的键同形认',
    only({
      'apps/miniapp-taro/src/p5.tsx':
        "export const P = ({ go }) => <Text onClick={go}>{tt('adaptersSelectertaro.back4', '← 返回')}</Text>\n",
    }).n4 === 1,
  )
  t(
    'GA4 反向:带宾语的按钮标签不纳(backHome 返回首页 / backLogin 返回登录)—— 换成裸箭头反而不表意',
    only({
      'apps/miniapp-taro/src/n1.tsx':
        "export const P = ({ go }) => <View onClick={go}><Text>{t('pay.backHome')}</Text><Text>{t('forgot.backLogin')}</Text></View>\n",
    }).n4 === 0,
  )
  t(
    'GA4 反向:翻页器 prevMonth 文案不纳',
    only({
      'apps/miniapp-taro/src/n2.tsx':
        "export const P = ({ go }) => <Text onClick={go}>{tt('live.calendar.prevMonth', '‹')}</Text>\n",
    }).n4 === 0 &&
      only({
        'apps/miniapp-taro/src/n2.tsx':
          "export const P = ({ go }) => <Text onClick={go}>{tt('live.calendar.prevMonth', '‹')}</Text>\n",
      }).n1 === 0,
  )
  t(
    'GA4 反向:非整格的正文含字(返回首页查看订单)不判',
    only({
      'apps/miniapp-taro/src/n3.tsx':
        "export const P = ({ go }) => <Text onClick={go}>返回上一页继续查看</Text>\n",
    }).n4 === 0,
  )
  t(
    'GA4 反向:整链无可点证据(纯文案出现「返回」)⇒ 放过',
    only({ 'apps/miniapp-taro/src/n4.tsx': "export const P = () => <Text>返回</Text>\n" }).n4 === 0,
  )
  t(
    'GA4 反向:i18n 资源文件里的 返回 文案不算渲染位(非 .tsx 不判)',
    only({ 'packages/i18n/messages/miniapp-taro/zh-CN.json': '{"common":{"back":"返回"}}\n' })
      .n4 === 0,
  )
  t(
    'GA4 换成 <BackChevron /> 后不判(GA4 阳性对照的对照组)',
    only({
      'apps/miniapp-taro/src/fixed.tsx':
        "import BackChevron from '@/components/BackChevron'\nexport const P = ({ goBack }) => <View style={viewStyles.header()}><BackChevron onTap={goBack} /><Text>{'平台活动'}</Text></View>\n",
    }).n4 === 0,
  )
  t(
    'GA4 豁免:同行带原因 ⇒ 放过,且裸标记不生效',
    only({
      'apps/miniapp-taro/src/e1.tsx':
        "export const P = ({ go }) => <Text onClick={go}>返回</Text> {/* back-label-exempt: 错误态卡片按钮,文字即标签 */}\n",
    }).n4 === 0 &&
      only({
        'apps/miniapp-taro/src/e2.tsx':
          "export const P = ({ go }) => <Text onClick={go}>返回</Text> {/* back-label-exempt: */}\n",
      }).n4 === 1,
  )
  t(
    'GA4 豁免:标在**可点元素起始行上一行**也生效(四处真实站点的排版,初版按命中行判 ⇒ 全落空)',
    only({
      'apps/miniapp-taro/src/e6.tsx':
        "export const P = ({ go }) => (\n  <View>\n    {/* back-label-exempt: 错误态卡片按钮,文字即标签 */}\n    <View style={btn()} onTap={go} hoverClass=\"opacity-60\">\n      <Text style={btnText()}>{tt('common.back', '返回')}</Text>\n    </View>\n  </View>\n)\n",
    }).n4 === 0,
  )
  t(
    'GA4 豁免:标在可点块内**更远**的文字行旁不生效(块级放行要有边界,否则整文件免检)',
    only({
      'apps/miniapp-taro/src/e7.tsx':
        "export const P = ({ go }) => (\n  <View>\n    <View style={btn()} onTap={go}>\n      <Text>占位</Text>\n      {/* back-label-exempt: 原因 */}\n      <Text>{tt('common.back', '返回')}</Text>\n    </View>\n  </View>\n)\n",
    }).n4 === 1,
  )
  t(
    'GA4 豁免:一行救不了别处(标记只覆盖命中行与其紧邻上行,整文件免检就是洞)',
    only({
      'apps/miniapp-taro/src/e4.tsx':
        "export const P = ({ go }) => (\n  <View onClick={go}>\n    <Text>返回</Text>{/* back-label-exempt: 原因 */}\n    <Text>占位</Text>\n    <Text onClick={go}>返回</Text>\n  </View>\n)\n",
    }).n4 === 1,
  )
  t(
    '两条豁免通道互不串门:glyph-arrow-exempt 救不了 GA4(否则给 GA1 开了第二道口)',
    only({
      'apps/miniapp-taro/src/e5.tsx':
        "export const P = ({ go }) => <Text onClick={go}>返回</Text> {/* glyph-arrow-exempt: 原因 */}\n",
    }).n4 === 1,
  )
  t(
    'GA4 与 GA1 共用同一遍遍历:一个元素只会算一条(‹ 不重复计成文字返回)',
    only({
      'apps/miniapp-taro/src/dup.tsx':
        "export const P = ({ go }) => <Text onClick={go}>{'‹'}</Text>\n",
    }).n1 === 1,
  )

  // GA5:字形与「返回」混写 —— GA1 只看整格字形、GA4 只看整格文案,这一型两条都不纳
  const g5a = only({
    'apps/miniapp-taro/src/mix-a.tsx':
      "export const P = ({ go }) => <Text onClick={go}>← 返回</Text>\n",
  })
  t(
    'GA5-A 阳性对照:整格「← 返回」必红,且只记一条(不得同时算成 GA1 字形或 GA4 文案)',
    g5a.n5 === 1 && g5a.n1 === 0 && g5a.n4 === 0,
    `n5=${g5a.n5} n1=${g5a.n1} n4=${g5a.n4}`,
  )
  t(
    'GA5-A 反向:字形 + **带宾语**的标签(← 首页)不纳 —— 与 GA4 的 backHome 例外同一取向',
    only({
      'apps/miniapp-taro/src/mix-a-ok.tsx':
        "export const P = ({ go }) => <Text onClick={go}>← 首页</Text>\n",
    }).n5 === 0,
  )
  const g5b = only({
    'apps/miniapp-taro/src/mix-b.tsx':
      "export const P = ({ go }) => <Text onClick={go}>← {t('common.back')}</Text>\n",
  })
  t(
    'GA5-B 阳性对照:字形与返回调用**分居同一元素的两个子节点** ⇒ 元素不是"唯一子内容",GA1/GA4 两条整格判据结构上看不见(本断言去掉了 B 型判据就会翻绿)',
    g5b.n5 === 1 && g5b.n4 === 0 && g5b.n1 === 0,
    `n5=${g5b.n5} n4=${g5b.n4} n1=${g5b.n1}`,
  )
  t(
    'GA5-B 反向:返回调用独占整格(同行无独立字形)⇒ 归 GA4,GA5-B 不重复计',
    (() => {
      const r = only({
        'apps/miniapp-taro/src/mix-b2.tsx':
          "export const P = ({ go }) => <Text onClick={go}>{t('common.back')}</Text>\n",
      })
      return r.n4 === 1 && r.n5 === 0
    })(),
  )
  t(
    'GA5-B 反向:字形在**字符串里**(模板串拼的 HTML)⇒ 不是 JSX 独立字形,不得配对(strMask 那一层要真起作用)',
    only({
      'apps/miniapp-taro/src/mix-b3.tsx':
        'export const P = ({ go }) => <Text onClick={go}>"← "{t(\'common.back\')}</Text>\n',
    }).n5 === 0,
  )
  t(
    '预筛必须是判据字面量的超集:GA5 的 « 与 GA6 的三个标识符少一个,门就在自己立项的那一型上失明;GA7 同 —— headerShown/onBack 漏一个,H3 整型隐身、H2 候选全被筛掉',
    ['«', 'BackChevron', 'NavBar', 'navigationStyle', 'headerShown', 'onBack'].every((lit) =>
      PREFILTER.includes(lit),
    ),
  )
  // 2026-09-26 补的锁 —— 上面那条**只查字符集与标识符**,所以它一路绿灯地放过了下面这个洞:
  // GA4 的 i18n 形态 `{t('common.back')}` 里**没有中文「返回」二字**(键名才是 back),
  // 而旧模式串只写了 `返回` 这个字面量 ⇒ 这类文件被预筛整批丢掉,全量面 GA4 报假 0。
  // 实测规模:全仓 298 个文件含 `…back…()` 调用,其中 **161 个不含中文「返回」** = 纯盲区。
  // 这条断言用**真正则**判(不是 includes),并把旧模式串当反例钉住:它必须测不到该形态。
  t(
    '预筛必须覆盖 GA4 的**键名形态**(文件只含 {t("common.back")}、不含中文「返回」也要能筛到)—— 旧模式串在这一条上是红的',
    (() => {
      const probe = '          <span>{t(\'common.back\')}</span>\n'
      const hitByCurrent = new RegExp(PREFILTER).test(probe)
      const oldPattern = '›|»|→|》|‹|←|«|返回|fontSize|font-size|\'>\'|">"|BackChevron|NavBar|navigationStyle'
      const hitByOld = new RegExp(oldPattern).test(probe)
      return hitByCurrent === true && hitByOld === false && !probe.includes('返回')
    })(),
    '当前模式串必须命中、旧模式串必须不命中(否则这条锁没有牙)',
  )
  t(
    'GA5 豁免:back-label-exempt 带原因 ⇒ 放过(A 型与 GA4 共用同一条人工出口)',
    only({
      'apps/miniapp-taro/src/mix-ex.tsx':
        "export const P = ({ go }) => <Text onClick={go}>← 返回{/* back-label-exempt: 原因 */}</Text>\n",
    }).n5 === 0,
  )

  // GA6:页内返回键 × 原生导航栏 = 同屏两个箭头
  const PAGE = 'apps/miniapp-taro/src/pages/g6/index.tsx'
  const PCFG = 'apps/miniapp-taro/src/pages/g6/index.config.ts'
  const PAGE_SRC =
    "import BackChevron from '@/components/BackChevron'\nexport default function P() {\n  return <View><BackChevron /></View>\n}\n"
  const NATIVE_CFG = "export default definePageConfig({\n navigationBarTitleText: '标题',\n})\n"
  const CUSTOM_CFG =
    "export default definePageConfig({\n  navigationStyle: 'custom',\n})\n"
  const APP_CFG = "export default defineAppConfig({\n  window: {navigationBarTitleText: 'I'},\n})\n"
  t(
    'GA6 阳性对照:页内渲染 <BackChevron/> 而页面 config 是原生栏 ⇒ 判红(web 模型是 chrome 拥有唯一返回键)',
    only({ [PAGE]: PAGE_SRC, [PCFG]: NATIVE_CFG, 'apps/miniapp-taro/src/app.config.ts': APP_CFG })
      .n6 === 1,
  )
  t(
    'GA6 反向:页面 config 写了 navigationStyle:custom ⇒ 0(原生栏不在场)',
    only({ [PAGE]: PAGE_SRC, [PCFG]: CUSTOM_CFG, 'apps/miniapp-taro/src/app.config.ts': APP_CFG })
      .n6 === 0,
  )
  t(
    'GA6 继承链:页面**没有**自己的 config 时按 app.config 的全局 window 判(只查同名文件会把"继承 custom"误判成原生栏)',
    only({ [PAGE]: PAGE_SRC, 'apps/miniapp-taro/src/app.config.ts': CUSTOM_CFG }).n6 === 0,
  )
  t(
    'GA6 未判定:两处 config 都取不到 ⇒ **不记绿也不冒红**,但必须计入 chromeUndetermined 点名(静默成 0 就是洞)',
    (() => {
      const r = only({ [PAGE]: PAGE_SRC })
      return r.n6 === 0 && r.ncu === 1
    })(),
  )
  t(
    'GA6 覆盖 <NavBar/> 型:它按胶囊算状态栏高度、本就是 custom 页写的,挂原生栏等于双层 chrome',
    only({
      [PAGE]: "import NavBar from '@/components/NavBar'\nexport default function P() {\n  return <NavBar />\n}\n",
      [PCFG]: NATIVE_CFG,
      'apps/miniapp-taro/src/app.config.ts': APP_CFG,
    }).n6 === 1,
  )
  t(
    'GA6 不越界:components/ 目录本身(机制文件与共享屏级适配器)不在射程内 —— 它不是"页面"',
    only({
      'apps/miniapp-taro/src/components/Whatever.tsx': PAGE_SRC,
      'apps/miniapp-taro/src/app.config.ts': APP_CFG,
    }).n6 === 0,
  )
  t(
    'GA6 豁免:文件级 nav-chrome-exempt **必须带原因**,裸标记不生效(与另两条通道同形)',
    only({
      [PAGE]:
        "// nav-chrome-exempt: 该页由 webview 套壳,自管返回\n" + PAGE_SRC,
      [PCFG]: NATIVE_CFG,
      'apps/miniapp-taro/src/app.config.ts': APP_CFG,
    }).n6 === 0 &&
      only({
        [PAGE]: '// nav-chrome-exempt\n' + PAGE_SRC,
        [PCFG]: NATIVE_CFG,
        'apps/miniapp-taro/src/app.config.ts': APP_CFG,
      }).n6 === 1,
  )

  // GA7:RN/共享层 同屏双返回 · 双层页头(2026-09-26 立)
  const WRAP = 'apps/mobile-rn/src/screens/g7/WrapperScreen.tsx'
  const CHILD = 'packages/app/src/features/g7/G7ChildScreen.tsx'
  const BARREL_TXT = "export { G7ChildScreen } from './features/g7/G7ChildScreen'\n"
  const NAVBAR_TXT = "export const NavBar = 1\n"
  const WRAP_NAVBAR_BACK =
    "import { NavBar } from '../../components/NavBar'\nimport { G7ChildScreen } from '@ihui/rn-app'\nexport default function W() {\n  return <View><NavBar title=\"设置\" onBack={go} rightActions={ra}><G7ChildScreen onBack={go} /></NavBar></View>\n}\n"
  const CHILD_WITH_HEADER =
    "import { BackChevron } from '../../components/BackChevron'\nexport function G7ChildScreen({ onBack }) {\n  return <View><BackChevron onPress={onBack} /><Text>设置</Text></View>\n}\n"
  const CHILD_NO_HEADER =
    "export function G7ChildScreen({ onBack }) {\n  return <View><FlatList data={rows} /></View>\n}\n"
  const G7_FIX = {
    [WRAP]: WRAP_NAVBAR_BACK,
    [CHILD]: CHILD_WITH_HEADER,
    [RN_APP_BARREL]: BARREL_TXT,
    'apps/mobile-rn/src/components/NavBar.tsx': NAVBAR_TXT,
  }
  t(
    'GA7-H2 阳性对照:wrapper 自绘 NavBar(onBack)+ 把 onBack 传给经 barrel 一跳解析后自绘 <BackChevron/> 的子屏 ⇒ 判红(phone-set2.png 那一型)',
    only(G7_FIX).n7 === 1 && only(G7_FIX).ga7.some((f) => f.file === WRAP && /G7ChildScreen/.test(f.msg)),
  )
  t(
    'GA7-H2 反向:子屏可读且**不画**页头返回键 ⇒ 正当放行(子屏作纯内容托管;判红就是假阳)',
    only({ ...G7_FIX, [CHILD]: CHILD_NO_HEADER }).n7 === 0,
  )
  t(
    'GA7-H2 未判定:barrel 在所选取材面取不到 ⇒ 不记绿也不冒红,必须计 rnDoubleUndetermined 点名(静默成 0 就是洞)',
    (() => {
      const r = only({ [WRAP]: WRAP_NAVBAR_BACK, 'apps/mobile-rn/src/components/NavBar.tsx': NAVBAR_TXT })
      return r.n7 === 0 && r.nru === 1
    })(),
  )
  t(
    'GA7-H2 NavBar 无 onBack ⇒ 它没画返回箭头,不构成"自带页头返回键",不得判(宁漏不误报的"漏"侧)',
    only({
      ...G7_FIX,
      [WRAP]:
        "import { NavBar } from '../../components/NavBar'\nimport { G7ChildScreen } from '@ihui/rn-app'\nexport default function W() {\n  return <View><NavBar title=\"首页\" leftActions={la}><G7ChildScreen onBack={go} /></NavBar></View>\n}\n",
    }).n7 === 0,
  )
  t(
    'GA7-H2 onBack={undefined} 不算画了返回键(NavBar 的 {onBack ? ... : null} 语义,NavBar.tsx:79 实测)',
    only({
      ...G7_FIX,
      [WRAP]:
        "import { NavBar } from '../../components/NavBar'\nimport { G7ChildScreen } from '@ihui/rn-app'\nexport default function W() {\n  return <View><NavBar title=\"设置\" onBack={undefined}><G7ChildScreen onBack={go} /></NavBar></View>\n}\n",
    }).n7 === 0,
  )
  t(
    'GA7-H1:同一屏文件两套页头返回键(NavBar+BackChevron)⇒ 判第二处(不需要跨文件)',
    only({
      [WRAP]:
        "import { NavBar } from '../../components/NavBar'\nimport { BackChevron } from '../../components/BackChevron'\nexport default function W() {\n  return <View><NavBar title=\"设置\" onBack={go} /><BackChevron onPress={go} /></View>\n}\n",
      'apps/mobile-rn/src/components/NavBar.tsx': NAVBAR_TXT,
      'apps/mobile-rn/src/components/BackChevron.tsx': 'export const BackChevron = 1\n',
    }).n7 === 1,
  )
  t(
    'GA7-H3:headerShown:true 在 RN 面回潮 ⇒ 判红;headerShown:false 不判;web 面同字面量不判(射程只 RN)',
    only({ 'apps/mobile-rn/src/navigation/G7Probe.tsx': 'export const O = { headerShown: true }\n' }).n7 === 1 &&
      only({ 'apps/mobile-rn/src/navigation/G7Probe.tsx': 'export const O = { headerShown: false }\n' }).n7 === 0 &&
      only({ 'apps/web/src/g7.tsx': 'export const O = { headerShown: true }\n' }).n7 === 0,
  )
  t(
    'GA7 豁免复用文件级 nav-chrome-exempt(带原因才生效;不开第四通道)',
    only({ ...G7_FIX, [WRAP]: "// nav-chrome-exempt: 双栈迁移过渡期,子屏页头暂留\n" + WRAP_NAVBAR_BACK }).n7 === 0 &&
      only({ ...G7_FIX, [WRAP]: '// nav-chrome-exempt\n' + WRAP_NAVBAR_BACK }).n7 === 1,
  )
  t(
    'GA7 只在屏目录判:packages/app/src/components/ 不算屏(机制/共享组件文件不自判)',
    only({ 'packages/app/src/components/G7Widget.tsx': CHILD_WITH_HEADER, [RN_APP_BARREL]: BARREL_TXT }).n7 === 0,
  )
  t(
    'GA7 不继承 GA4/GA5 的跨行自闭合栈失配盲区:同文件双返回键写成跨多行自闭合标签仍要判到',
    only({
      [CHILD]:
        "import { BackChevron } from '../../../components/BackChevron'\nexport function G7ChildScreen({ onBack }) {\n  return (\n    <View>\n      <BackChevron\n        onPress={onBack}\n        colorScheme=\"light\"\n      />\n      <BackChevron onPress={onBack} />\n    </View>\n  )\n}\n",
      'packages/app/src/components/BackChevron.tsx': 'export const BackChevron = 1\n',
    }).n7 === 1,
  )

  t(
    'GA7-H1 反向:互斥 return 分支各画一套页头(loading/错误态/正常态)⇒ **不是**同屏双返回,不得判 —— HEAD 面 9 处此型(ActivityDetail/Income/QrCode 等 returns@26,40,57 各带一套),首版按整文件计数全判成假阳,这条锁钉死分支口径',
    only({
      [CHILD]:
        "import { BackChevron } from '../../../components/BackChevron'\nexport function G7ChildScreen({ onBack, loading, err }) {\n  if (loading) return <View><BackChevron onPress={onBack} /><Spinner /></View>\n  if (err) return <View><BackChevron onPress={onBack} /><Text>出错</Text></View>\n  return <View><BackChevron onPress={onBack} /><Content /></View>\n}\n",
      'packages/app/src/components/BackChevron.tsx': 'export const BackChevron = 1\n',
    }).n7 === 0,
  )
  t(
    'GA7-H2 同分支约束:NavBar 与子屏 onBack 分属**互斥分支**(错误态有 NavBar、正常态挂子屏)⇒ 不同屏,不得判',
    only({
      [WRAP]:
        "import { NavBar } from '../../components/NavBar'\nimport { G7ChildScreen } from '@ihui/rn-app'\nexport default function W({ bad }) {\n  if (bad) return <View><NavBar title=\"设置\" onBack={go} /></View>\n  return <View><G7ChildScreen onBack={go} /></View>\n}\n",
      [CHILD]: CHILD_WITH_HEADER,
      [RN_APP_BARREL]: BARREL_TXT,
      'apps/mobile-rn/src/components/NavBar.tsx': NAVBAR_TXT,
    }).n7 === 0,
  )

  // GA6 的取材批次:config 路径必须补进 reader,否则"没读"会被当成"没有"
  t(
    'withPageConfigs:只补小程序页面 config,组件/非页面/已有条目不重复补',
    // 语义是"追加缺失的 config 路径",不是"过滤列表" —— 断言必须按真语义写,否则这是一条
    // 会教下一个人把 withPageConfigs 改成过滤器的假自检。
    JSON.stringify(
      withPageConfigs([
        PAGE,
        PCFG,
        'apps/miniapp-taro/src/components/NavBar.tsx',
        'apps/web/app/page.tsx',
        'apps/miniapp-taro/src/pages/g7/index.tsx',
      ]),
    ) ===
      JSON.stringify([
        PAGE,
        PCFG,
        'apps/miniapp-taro/src/components/NavBar.tsx',
        'apps/web/app/page.tsx',
        'apps/miniapp-taro/src/pages/g7/index.tsx',
        'apps/miniapp-taro/src/pages/g7/index.config.ts',
      ]) &&
      // 已列出的 config 不得被重复追加(reader 路径集去重靠 Set,但顺序变了会改输出行数)
      withPageConfigs([PAGE, PCFG]).length === 2,
  )


  // GA2:阳性对照与反向对
  const cssRun = (css) => only({ 'apps/miniapp-taro/src/pages/p.css': css })
  t(
    'GA2 阳性对照(任务书原文形态):.show-more-text 26rpx × .show-more-arrow 28rpx 看得见',
    cssRun(
      '.show-more-text {\n  font-size: 26rpx;\n}\n.show-more-arrow {\n  font-size: 28rpx;\n}\n',
    ).n2 === 1,
  )
  t(
    'GA2 反向:字号相等 ⇒ 0(同词干)',
    cssRun('.show-more-text {\n font-size: 26rpx;\n}\n.show-more-arrow {\n font-size: 26rpx;\n}\n')
      .n2 === 0,
  )
  t(
    'GA2 反向:箭头更小 ⇒ 0',
    cssRun('.show-more-text {\n font-size: 32rpx;\n}\n.show-more-arrow {\n font-size: 24rpx;\n}\n')
      .n2 === 0,
  )
  t(
    'GA2 反向:单位不同判不出,但必须如实计数',
    cssRun('.show-more-text {\n font-size: 26rpx;\n}\n.show-more-arrow {\n font-size: 16px;\n}\n')
      .n2 === 0 &&
      cssRun('.show-more-text {\n font-size: 26rpx;\n}\n.show-more-arrow {\n font-size: 16px;\n}\n')
        .notes.undetermined.length === 1,
  )
  t(
    'GA2 反向:词干不同 ⇒ 不配对(不把无关箭头算进来)',
    cssRun('.view-all-text {\n font-size: 24rpx;\n}\n.card-arrow {\n font-size: 32rpx;\n}\n').n2 ===
      0,
  )
  t(
    'GA2 反向:remove 不得被当成 more(按词元等值,不按子串)',
    cssRun('.remove-text {\n font-size: 24rpx;\n}\n.remove-arrow {\n font-size: 32rpx;\n}\n').n2 ===
      0,
  )
  t(
    'GA2 反向:串里生成的 CSS 不算本文件样式声明',
    only({
      'packages/app/s.ts':
        'export const css = `.show-more-text{font-size:24rpx}\\n.show-more-arrow{font-size:40rpx}`\n',
    }).n2 === 0,
  )
  t(
    'GA2 反向:CSS 的 content: "›" 不算整格 JSX 子内容',
    cssRun('.a::after {\n  content: "›";\n  font-size: 40rpx;\n}\n').n1 === 0,
  )
  const RN_DIRTY =
    "import { StyleSheet } from 'react-native'\nexport const styles = StyleSheet.create({\n  moreText: { fontSize: 12 },\n  moreArrow: { fontSize: 16 },\n})\n"
  t(
    'GA2 阳性对照:RN 兄弟键 moreText 12 × moreArrow 16 看得见',
    only({ 'packages/app/r.tsx': RN_DIRTY }).n2 === 1,
  )
  t(
    'GA2 反向:同组两档字号齐平 ⇒ 0',
    only({ 'packages/app/r2.tsx': RN_DIRTY.replace('fontSize: 16', 'fontSize: 12') }).n2 === 0,
  )
  t(
    'GA2 兜底形态:组内唯一 label × 唯一 arrow 即使不成词干也要配对(任务书 sibling Arrow key)',
    only({
      'packages/app/r3.tsx':
        'export const s = { showMoreLabel: { fontSize: 14 }, arrow: { fontSize: 20 } }\n',
    }).n2 === 1,
  )
  t(
    'GA2 兜底反向:组内两个 label ⇒ 不猜谁配谁',
    only({
      'packages/app/r4.tsx':
        'export const s = { showMoreLabel: { fontSize: 14 }, moreText: { fontSize: 12 }, arrow: { fontSize: 20 } }\n',
    }).n2 === 0,
  )
  t(
    'GA2 不越层:孙对象的 fontSize 不得记到父键上',
    only({
      'packages/app/r5.tsx':
        'export const s = { moreText: { padding: 4, inner: { fontSize: 12 } }, moreArrow: { fontSize: 8 } }\n',
    }).n2 === 0,
  )
  t(
    'GA2 兄弟组隔离:不同对象组里的同名字键不互配',
    only({
      'packages/app/r6.tsx':
        'export const a = { moreText: { fontSize: 12 } }\nexport const b = { moreArrow: { fontSize: 20 } }\n',
    }).n2 === 0,
  )

  // 词法单元
  t(
    'wordsOf 三种命名法切词同形',
    JSON.stringify(wordsOf('showMoreText')) === JSON.stringify(['show', 'more', 'text']) &&
      JSON.stringify(wordsOf('show-more-text')) === JSON.stringify(['show', 'more', 'text']),
  )
  t(
    'stemOf 剥箭头与角色词后同干',
    stemOf('show-more-arrow') === 'show-more' &&
      stemOf('moreText') === 'more' &&
      stemOf('moreArrow') === 'more',
  )
  t(
    'isLabelName 只认 more/viewAll 系',
    isLabelName('viewAllRow') &&
      isLabelName('moreText') &&
      !isLabelName('removeText') &&
      !isLabelName('moreArrow'),
  )
  t('剥注释不漂行号', stripCommentsKeepStrings('a\n// b\nc').code.split('\n').length === 3)
  t(
    'parseTagAt:属性里的 => 不吃掉标签尾(尾 > 才是标签终点)',
    parseTagAt('<Text onPress={() => x()}>›</Text>', 0, new Array(40).fill(false))?.end === 26,
  )
  t(
    'parseTag:a<b 与泛型尖括号一律拒绝',
    parseTagAt('a<b>', 1, new Array(4).fill(false)) === null &&
      parseTagAt('<T,>(x: T)', 0, new Array(10).fill(false)) === null,
  )
  t(
    'parseTag:串内的 < 不当标签起点(JSX 属性串/HTML 串)',
    parseTagAt('a = "<b>", <Text>', 4, [
      ...Array(4).fill(false),
      true,
      ...Array(12).fill(true),
      ...Array(6).fill(false),
    ]) === null,
  )

  // S0:机制在位 / 被摘线 / 无人 import
  t(
    'S0 反向:机制齐备且被 import ⇒ 0',
    only({ 'packages/app/ok.tsx': 'export const K = 1\n' }).n0 === 0,
  )
  t(
    'S0 阳性对照:共享组件被改回文本字形 ⇒ 必红',
    only({
      'packages/app/src/components/MoreLink.tsx':
        'export function MoreLink({ label }) {\n  return <Text>{label}</Text>\n}\n',
      'packages/app/c.tsx': 'export const K = 1\n',
    }).n0 >= 1,
  )
  t(
    'S0 阳性对照:机制在位但无人 import ⇒ 必红(没装车等于没有)',
    run({ ...MECH_SNIPPETS, 'packages/app/noise.tsx': 'export const K = 1\n' }).n0 >= 1,
  )

  // 自豁免与未判定:必须如实计数,不得静默成"看起来全绿"
  const selfRun = run({
    'scripts/check-glyph-arrow-icon.mjs': CONTROL_TSX,
    'scripts/tests/check-glyph-arrow-icon.test.mjs':
      '.show-more-text{font-size:26rpx}\n.show-more-arrow{font-size:28rpx}\n',
    ...MECH_SNIPPETS,
    'packages/app/c.tsx': 'export const K = 1\n',
  })
  t(
    '自豁免:门自身与其测试被跳过、不判红,且如实报数 2 个(其余仍实读)',
    selfRun.n1 === 0 &&
      selfRun.n2 === 0 &&
      selfRun.notes.selfExempt === 2 &&
      // 期望值从 MECH_SNIPPETS 派生,不抄常数:机制清单从 4 个长到 5 个时,写死的 5 会让这条
      // 自检变成"计数变了 ⇒ 判据坏了"的假红 —— 而它测的是自豁免,与机制个数无关。
      selfRun.notes.scanned === Object.keys(MECH_SNIPPETS).length + 1,
    `selfExempt=${selfRun.notes.selfExempt} scanned=${selfRun.notes.scanned}`,
  )
  const gapRun = run({ 'packages/app/clean.tsx': 'export const K = 1\n' })
  t(
    'S0 机制文件在取材面取不到 ⇒ 逐条点名"无法判定"(不得静默记为通过)',
    gapRun.s0.length === MECHANISMS.length && gapRun.notes.scanned === 1,
    `s0=${gapRun.s0.length} scanned=${gapRun.notes.scanned}`,
  )

  // 棘轮:锚点必须是"该文件 HEAD 自身",既不能恒红也不能恒绿
  const sf = splitFresh(
    new Map([
      ['a.tsx', 3],
      ['b.tsx', 3],
      ['c.tsx', 1],
    ]),
    new Map([
      ['a.tsx', 3],
      ['b.tsx', 2],
    ]),
  )
  t(
    '棘轮反向:计数与 HEAD 持平 ⇒ 存量放过(把锚点写成 0 会让 70 处存量恒红)',
    sf.fresh.every((f) => f.rel !== 'a.tsx') && sf.tolerated === 3,
  )
  t(
    '棘轮阳性:计数比 HEAD 多 ⇒ 判新增并点名差值',
    sf.fresh.length === 2 && sf.fresh.some((f) => f.rel === 'b.tsx' && f.n === 3 && f.tol === 2),
  )
  t(
    '棘轮:HEAD 无锚点的新文件按 0 容忍 ⇒ 直接判新增',
    sf.fresh.some((f) => f.rel === 'c.tsx' && f.tol === 0),
  )
  t(
    '棘轮:计数比 HEAD 少(清理了存量)⇒ 放过',
    splitFresh(new Map([['a.tsx', 1]]), new Map([['a.tsx', 5]])).fresh.length === 0,
  )

  const failed = cases.filter((c) => !c.pass)
  for (const c of cases)
    console.log(`${c.pass ? '✅' : '❌'} ${c.name}${c.detail ? ' — ' + c.detail : ''}`)
  console.log(`${cases.length - failed.length}/${cases.length} 通过`)
  return failed.length ? 1 : 0
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  try {
    process.exitCode = main(process.argv.slice(2))
  } catch (e) {
    console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  }
}

export const __test__ = {
  scan,
  scanRepo,
  auditFile,
  splitFresh,
  countsByFile,
  findGlyphIconChildren,
  findBackLabelChildren,
  findChromeDuplicates,
  withPageConfigs,
  navStyleOf,
  findRnDoubleHeaders,
  headerBackFiles,
  importsOf,
  barrelExportMap,
  resolveRelPath,
  tagHasOnBack,
  RN_SCREEN_PREFIXES,
  RN_FACE_PREFIXES,
  RN_APP_BARREL,
  HEADER_SHOWN_TRUE_RE,
  walkAffordanceChildren,
  classifyGlyph,
  classifyBackLabel,
  parseTagAt,
  collectFontSizes,
  findOpticalMismatch,
  shallowBody,
  braceParents,
  wordsOf,
  stemOf,
  isLabelName,
  isArrowName,
  stripCommentsKeepStrings,
  stripCommentsAndStrings,
  collectExemptLines,
  objectBody,
  lineOf,
  BARE_GLYPH_RE,
  BRACED_GLYPH_RE,
  BACK_LABEL_EXPR_RE,
  BACK_TEXT_LITERAL_RE,
  BACK_EXEMPT_LINE_RE,
  BACK_GLYPH_PREFIX_RE,
  CUSTOM_NAV_RE,
  NAV_CHROME_EXEMPT_RE,
  GLOBAL_APP_CONFIG,
  HANDLER_ATTR_RE,
  AFFORDANCE_TAG_RE,
  PREFILTER,
  SCAN_DIRS,
  MECHANISMS,
  SELF_EXEMPT_RE,
  SELF_SKIP,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
