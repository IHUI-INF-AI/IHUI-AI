// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Badge 族的结构与几何单一源(web 薄壳与 RN 薄壳共用),形状照 card-spec。
 *
 * 两端真实实现坐标:
 *  - web 端 = packages/ui-react/src/components/badge.tsx(cva 四档 variant,div 单节点 + Tailwind 类);
 *  - RN 端  = packages/ui-native/src/badge.tsx(cva 四档 variant,View 包 Text + nativewind 类)。
 *
 * 本表只存**档名与数值档**,不存承载形式;承载形式(类名 / token 名)留在两端薄壳里。代价是两端壳
 * 必须把本表的**每一个**导出常量都接走并真用 —— 挂了常量却没人消费就是"造好没装车",由同族判据
 * packages/shared/src/ui/__tests__/badge-wiring.test.ts 逐条判红。
 *
 * ⚠️ 本族与「4662 行死适配器」同型事故:variant 的 **`default` 同名档两端不同色**
 *  - web(:16):`default` = `bg-cta text-cta-foreground`(+ `hover:bg-cta/80`);
 *  - RN (:13,:24):`default` = `bg-primary` + `text-primary-foreground`。
 *  裁定(**规则6:色值不下沉,允许不同形;但档名集合必须两端一致**):
 *   1. **档名集合两端必须一致** —— 四档 `default/secondary/destructive/outline` 沉为本表
 *      `BADGE_VARIANT_TIERS`,两端 cva 的 variant 键都按它收口。**缺档才是真缺口**:
 *      调用方传了这一档而某端没这个键 ⇒ 该端静默掉到底色,既不报错也看不出错,是本族唯一的真事故型。
 *   2. **色值归属本票不裁** —— `cta` 是 web 端 CTA 专用主色,`primary` 是 RN 端主色;取任一端
 *      都等于给另一端换品牌色,不是"取值收口"这一步能定的事。故维持两端现值,并把这条分歧
 *      **显式登记为待定档债**(须机主单独定档),不许被"已下沉"的账盖掉。
 *   3. 两端**同色**的两档(`secondary` / `destructive` / `outline`)同样不下沉色值:色值是 token 消费,
 *      不是几何档;把 token 名搬进 spec 只会让它脱离 Tailwind / nativewind 扫描面 ⇒ 规则根本不产出。
 *
 * 承载机制差异(规则6:机制,非取值分叉,逐条登记 —— 允许不同形,**不下沉**):
 *  - `border` / `border-transparent`:仅 web(web base 带 `border`,各档再给 `border-transparent`);
 *    RN 只有 `outline` 档显式 `border border-border`(nativewind 不继承 web 的边框默认色)。
 *  - 各档 hover 态 `hover:bg-…/80` 与 `transition-colors`:仅 web。依赖 CSS :hover 通道,RN 无此通道。
 *  - `focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2`:仅 web。
 *    focus-ring 是 web 键盘可达性通道;RN 走 `accessibilityRole` / `accessibilityLabel` 另一条通道。
 *  - `accessibilityRole="text"` + `accessibilityLabel`:仅 RN(RN 无障碍通道),web 用 div 承载语义。
 *  - `inline-flex`(web)vs `flex-row`(RN):同一"横排"语义的两端承载写法,不是取值分叉。
 *  - 字色落点:web 落在根 div(单节点),RN 落在内层 Text(View 不着字色)。
 *  ⇒ 上述不同形由 parity 基线入账(waivers 之外的锚点登记),不算欠债。
 *
 * 消费方式:子路径 `@ihui/shared/ui/badge-spec`(禁挂根桶:同 card-spec:30-31,
 * 根桶出口会把整棵 src/chat 拉进被检程序,rn-app typecheck 从 0 错变 8 错,O81 实测)。
 * spec 内只存逻辑 px;web 端 1:1(CSS px),RN 端 1:1(逻辑 pt)。
 * 圆角**只给档名不给 px**:px 归 packages/design-tokens/src/radius.js 的 RADIUS_STEPS 与守门 77 单源;
 * 本表只记"徽标取哪一档"。
 *
 * 裁定规则(同 card-spec:36-38):规则1 两端现值已同,收一处防再分叉;规则2 同义不同值取 compact
 * 较小档(取小会贴边/裁切才取较大档并写明);规则3 一端有档、另一端没这处留白 → 取较大者并让缺失端
 * 补同档;规则6 平台承载机制差异 → 允许不同形,注明理由。
 */

/**
 * variant 档名集合(规则1):两端现值逐字相同 —— web:15-21 与 RN:12-17 同为这四档。
 * 收一处不是因为值会分叉,而是因为**缺档无告警**:这是本族唯一会静默掉色的失效型。
 * 消费形态是**类型级**(两端壳把 cva 的 variant 映射表标注成 `Record<本集合[number], string>`),
 * 而不是运行级 —— spec 增档而某端没给类名 ⇒ tsc 直接红,这正是要挡的那一类。
 * 与 @ihui/design-tokens 的 `BadgeVariant`(component-props.ts:21)四档同名同序;
 * spec 禁 import(纯度要求),故不在这里做类型引用,由 wiring 判据做源码级对账。
 */
export const BADGE_VARIANT_TIERS = ['default', 'secondary', 'destructive', 'outline'] as const

/**
 * 默认档 'default'(规则1):两端 cva 的 defaultVariants 均为此档(web:24-26 / RN:19)。
 */
export const BADGE_DEFAULT_VARIANT = 'default'

/**
 * 圆角档 'md'(规则1):两端现值均已 `rounded-md`(web base:12 / RN:41)。
 * 只给档名不给 px —— px 由 radius.js 单源产出;两端各自把档名映射成本端承载类名。
 */
export const BADGE_RADIUS_TIER = 'md'

/**
 * 横向内边距 10(规则1):两端同为 `px-2.5` = 10(web base:12 / RN cva base:10)。
 * 两端已同值 ⇒ 本票的作用是**回归锁**:任一侧单方面改内边距都会被 wiring 判据挡回。
 */
export const BADGE_PADDING_X_PX = 10

/**
 * 纵向内边距 2(规则1):两端同为 `py-0.5` = 2(web base:12 / RN cva base:10)。同上,已同值收防分叉。
 */
export const BADGE_PADDING_Y_PX = 2

/**
 * 字号档 'xs'(规则1):两端同为 `text-xs` = 12(web base:12 / RN Text:46)。
 * 只给档名不给 px —— 字号档由两端各自的 Tailwind / nativewind 尺度产出,本表不复制一份 px,
 * 免得同一语义出现两个可改点。
 */
export const BADGE_TEXT_TIER = 'xs'
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
