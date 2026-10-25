// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * VipBadge 族的结构与几何单一源(web 薄壳与 RN 薄壳共用),形状照 card-spec / badge-spec。
 *
 * 两端真实实现坐标:
 *  - web 端 = packages/ui-react/src/components/vip-badge.tsx(span + lucide `Crown` 图标 + Tailwind 类);
 *  - RN 端  = packages/ui-native/src/vip-badge.tsx(View 包 Text,nativewind 类,无图标)。
 *
 * ⚠️ 本族的票面价值是**证明"零差异也能下沉"**(与 badge 族相反:badge 有色档分歧待裁,
 * 本族两端现值**逐字相同**):
 *  - props 层已同源:两端都只吃 `VipBadgeBaseProps`(@ihui/design-tokens component-props.ts:15-18,
 *    仅 `size: 'sm' | 'md'` + `label`);
 *  - sizing 串两端**逐字相同**:web:14 与 RN:9 同为
 *    md = `px-2.5 py-1 text-xs gap-1` / sm = `px-2 py-0.5 text-xs gap-0.5`;
 *  - 所以本票**收不到任何需要"裁定"的数值档**(没有规则2 / 规则3 的适用场景)。
 *  仍要下沉的理由:把已同值的 sizing 沉成 spec,作为**回归锁** —— 现在零差异不等于永远零差异,
 *  任一侧单方面改内边距/间隙,都会被 packages/shared/src/ui/__tests__/vip-badge-wiring.test.ts 判红
 *  (它要求两端壳的**每个常量既 import 又消费**,端内写死字面量即断链)。
 *  ⇒ 若日后本族出现分歧,那是一次**新分叉**,不是本票没收干净。
 *
 * 承载机制差异(规则6:机制,非取值分叉,逐条登记 —— 允许不同形,**不下沉**):
 *  - lucide `Crown` 图标:仅 web(web:5,:23)。RN 端不引 lucide(RN 图标走另一套通道),
 *    且图标尺寸 `h-3.5 w-3.5` / `h-3 w-3` 随 size 变 —— 它是图标自己的档,不是徽标的几何档。
 *  - `dark:text-amber-500`:仅 web(web:18)。RN 端无 `dark:` 通道(nativewind 暗色不按此前缀切)。
 *  - `inline-flex`(web:18)vs `flex-row`(RN:11):同一"横排"语义的两端承载写法。
 *  - `className` 入参:仅 web(web:10,:17);RN 端当前不收 className。
 *  - 文本落点:web 文本直接落在 span(与图标同级),RN 落在内层 Text。
 *  - 琥珀色系(`bg-amber-500/10` / `text-amber-600`)两端**同色但同上不下沉**:色值是 token 消费,
 *    不是几何档;搬进 spec 会脱离 Tailwind / nativewind 扫描面 ⇒ 规则根本不产出。
 *  ⇒ 上述不同形由 parity 基线入账,不算欠债。
 *
 * 消费方式:子路径 `@ihui/shared/ui/vip-badge-spec`(禁挂根桶:同 card-spec:30-31,
 * 根桶出口会把整棵 src/chat 拉进被检程序,rn-app typecheck 从 0 错变 8 错)。
 * spec 内只存逻辑 px;web 端 1:1(CSS px),RN 端 1:1(逻辑 pt)。
 * 圆角**只给档名不给 px**:px 归 packages/design-tokens/src/radius.js 的 RADIUS_STEPS 与守门 77 单源。
 *
 * 裁定规则(同 card-spec:36-38):规则1 两端现值已同,收一处防再分叉;规则2 同义不同值取 compact
 * 较小档;规则3 一端有档、另一端没这处留白 → 取较大者并让缺失端补同档;规则6 平台承载机制差异 →
 * 允许不同形。**本族全部命中规则1**。
 */

/**
 * size 档名集合(规则1):两端均只有两档 —— `VipBadgeBaseProps.size`(component-props.ts:16)
 * 与两端 `size === 'md' ? … : …` 的实际分支逐字一致。
 * 消费形态是**类型级**(两端壳把 sizing 映射表标注成 `Record<本集合[number], string>`):
 * spec 增档而某端没给类名 ⇒ tsc 直接红。
 */
export const VIP_BADGE_SIZE_TIERS = ['sm', 'md'] as const

/**
 * 默认档 'sm'(规则1):两端默认值均为 `'sm'`(web:13 / RN:8)。
 */
export const VIP_BADGE_DEFAULT_SIZE = 'sm'

/**
 * 默认文案 'VIP'(规则1):两端默认值均为 `'VIP'`(web:13 / RN:8)。
 * 下沉它不只是省一个字面量:默认文案是**对客可见字符串**,两端各写一份就是两条可改点。
 */
export const VIP_BADGE_DEFAULT_LABEL = 'VIP'

/**
 * 圆角档 'md'(规则1):两端现值均已 `rounded-md`(web:18 / RN:11)。只给档名不给 px。
 */
export const VIP_BADGE_RADIUS_TIER = 'md'

/**
 * 字号档 'xs'(规则1):两端 sizing 串内均为 `text-xs`(web:14 / RN:9)。只给档名不给 px。
 */
export const VIP_BADGE_TEXT_TIER = 'xs'

/** md 档横向内边距 10(规则1):两端同为 `px-2.5` = 10。 */
export const VIP_BADGE_MD_PADDING_X_PX = 10

/** md 档纵向内边距 4(规则1):两端同为 `py-1` = 4。 */
export const VIP_BADGE_MD_PADDING_Y_PX = 4

/** md 档图标-文案间隙 4(规则1):两端同为 `gap-1` = 4。 */
export const VIP_BADGE_MD_GAP_PX = 4

/** sm 档横向内边距 8(规则1):两端同为 `px-2` = 8。 */
export const VIP_BADGE_SM_PADDING_X_PX = 8

/** sm 档纵向内边距 2(规则1):两端同为 `py-0.5` = 2。 */
export const VIP_BADGE_SM_PADDING_Y_PX = 2

/** sm 档图标-文案间隙 2(规则1):两端同为 `gap-0.5` = 2。 */
export const VIP_BADGE_SM_GAP_PX = 2
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
