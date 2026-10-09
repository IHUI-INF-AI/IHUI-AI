// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * SectionHeader「区段标题 + 更多」的结构与几何单一源(形状照 back-chevron-spec)。
 * 注:本表面向两端,但 RN 端目前尚无渲染腿 —— 见下方"两端真实实现",不要按"已共用"引用它。
 *
 * 两端真实实现(2026-09-26 现读更正;原文写"RN 端唯一实现 = …(features 各屏经 @ihui/rn-app 消费)"
 * 是一句做不到的承诺 —— 按它去 RN 端找消费方会一无所获,而账面读起来像已收口):
 *  - RN 端:**本表当前零渲染腿**。曾在的那一份 packages/app/src/components/SectionHeader.tsx
 *    是 RN 形态(View/StyleSheet)并由同目录 barrel re-export,但全仓没有任何屏具名取用它,
 *    2026-09-30 随 O92 票摘除(判据:零具名消费者 + 零深导入;摘除后 @ihui/rn-app 也不再出口该名);
 *    course-tab 与 learn 两屏里检索到的同名命中,是各自在屏内自绘的局部渲染函数
 *    (取证:两屏各有一处以自绘函数排「标题 + 更多」头部),与本表、与该组件都无引用关系。
 *    因此 RN 侧的区段头部目前**没有单一源**,把它接进本表要先改 9+ 屏的头部观感 —— 那属产品决策,
 *    未决前不得把本表读成"两端已共用"。
 *  - 小程序端**只有一条渲染腿** = apps/miniapp-taro/src/components/adapters/SectionHeader.taro.tsx
 *    (pkg-learn / pkg-shop 经适配层)。2026-09-29 实测更正本段原文:它写的是"两条渲染腿 =
 *    apps/miniapp-taro/src/components/SectionHeader.tsx(页面直连)与 …(经适配层),两条腿同取本表"。
 *    前半句"同取本表"是真的(两份的 SECTION_HEADER_* 取值集合逐字相同),后半句"页面直连"已经不做:
 *    那一份**没有任何消费者**,由两把互相独立的尺子各自量到 —— ① 按 import **绑定名**解析说明符的归因
 *    (阳性对照同一把尺量到 LineIcon 119 个、ThemeRoot 153 个消费点,证明它看得见在役件);② 穷尽
 *    `…/components/SectionHeader` 说明符的 git grep,默认导出形态也在内。`components/index.ts` 也没递它。
 *    P2-F 接线把三个页面切到适配层之后,它就成了"引用同一张表、却不在任何屏上"的副本;而它与适配层
 *    **并不等价** —— 适配层接 colorScheme 注入,它不接 ⇒ 谁按名字误接它,拿到的是一份静默脱主题的头部。
 *    所以本枚把它删掉,并把这段改成实测口径:留着一句"两条腿"比少一个文件危险得多 —— 它会让人以为
 *    改一条腿就算收口,而屏上其实只有一条。
 *    ⚠️ **这条删除需要每次合并后复核**:首次落地 f04590afb8 被并发 union 合并 26537d0fca 按
 *    "本侧整棵树"整份带回 —— `union-converge` 的构造刻意**不传播对侧删除**(那是为"零丢失"付的代价),
 *    而守门 100 的 A1 只管"新增文件被吞",单文件删除复活对它结构失明。复核一句:
 *    `git cat-file -e HEAD:apps/miniapp-taro/src/components/SectionHeader.tsx` 应当失败。
 *    (守门 99 对这枚删除判放行,但它的理由是"同名同后缀件仍在库",指的是 packages/app 那份 **RN 形态**件,
 *    不是这条小程序腿的等价物 —— 那一格属该门 E2 的口径边界,不得当成本段的佐证引用。)
 *    ⚠️ **上述"判放行"自 O92 票④ 起已不再成立,且这条复活真的发生过第二次**:2026-10-09 按本节复核判据
 *    现问,该路径仍在 HEAD(即 f04590afb8 的删除自 26537d0fca 带回后一直无人复删);而同名的 packages/app
 *    那份也已被摘除,于是门 99 的 E2 两面都够不上替代路径,本轮复删落地时它对**本件判红**并点名两处
 *    "引用方" —— 逐条读原文均为其他守门的测试夹具字符串(check-cross-end-ui-parity 自检㊪ 传的构造路径
 *    数组、check-glyph-arrow-icon 的 only() 内存夹具源码串),不是对本件的在役引用。处置按门 99 自己给的
 *    合法出口走:在 scripts/staged-deletions-allowlist.json 登记该路径并逐条写明取证,**不改别人守门的取证面**。
 *    ⇒ 通用教训:一句"某道门对这次删除判放行"是**当时**的读数,不是永久事实;被删件的同名同伴一旦被摘,
 *    同一枚删除就会从"放行"变成"判红",而下一个人只会看到门红、看不到门为什么红。
 *
 * 消费方式只能是子路径 `@ihui/shared/ui/section-header-spec`(禁挂根桶)。
 * spec 内只存逻辑 px;小程序端换算 `(px) => rpx(px * TARO_RPX_PER_PX)`,RN 端 1:1。
 *
 * 取值裁决:「更多」入口的字号/箭头不在本表(§4 已定 RN/web 12px、小程序 24rpx,且 RN 侧由
 * MoreLink 单源),本表只管标题区。
 */

/** 每端注入的单位换算(一个逻辑 px 到该平台数值);泛型把单位类型带出来。 */
export type GeometryUnit<U extends string | number> = (px: number) => U

/**
 * 标题字号 16:RN 端现档;小程序端原 28rpx = 14、适配层原 14。规则 2 取可读更稳的一档,
 * 且与 NavBar 标题(16)同档,区段头与页头不再两级分叉。
 */
export const SECTION_HEADER_TITLE_FONT_PX = 16

/** 标题字重 700:两端现值已同(小程序 `font-bold` / RN '700'),收一处防分叉。 */
export const SECTION_HEADER_TITLE_FONT_WEIGHT = '700'

/** 副标题字号 12:两端现值已同(小程序 `text-[length:24rpx]` / RN 12)。 */
export const SECTION_HEADER_SUBTITLE_FONT_PX = 12

/** 副标题与标题间距 8:两端现值已同(小程序 `ml-2` / RN `marginLeft: 8`)。 */
export const SECTION_HEADER_SUBTITLE_GAP_PX = 8

/** 「更多」入口与左侧内容区的间距 8:两端现值已同(小程序 `ml-2` / 适配层 marginLeft 8)。 */
export const SECTION_HEADER_MORE_MARGIN_LEFT_PX = 8

/** 文字与箭头图标间距 2:两端现值已同(小程序 `4rpx` = 2 / 适配层 `toRpx(2)`);取更稳的一档不再放大。 */
export const SECTION_HEADER_ARROW_MARGIN_LEFT_PX = 2

/** 标题区结构:行内水平居中 + 可截断(溢出省略的三件套只在这一处排)。 */
export function sectionHeaderTitleStyle<U extends string | number>(
  toUnit: GeometryUnit<U>,
): {
  fontSize: U
  fontWeight: '700'
  overflow: 'hidden'
  textOverflow: 'ellipsis'
  whiteSpace: 'nowrap'
} {
  return {
    fontSize: toUnit(SECTION_HEADER_TITLE_FONT_PX),
    fontWeight: SECTION_HEADER_TITLE_FONT_WEIGHT,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
