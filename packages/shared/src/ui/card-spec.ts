// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Card 族的结构与几何单一源(web 薄壳与 RN 薄壳共用),形状照 verify-code-modal-spec / navbar-spec。
 *
 * 两端真实实现坐标:
 *  - web 端 = packages/ui-react/src/components/card.tsx(Card/CardHeader/CardTitle/CardDescription/
 *    CardContent/CardFooter 六件,forwardRef<HTMLDivElement>,Tailwind 类承载);
 *  - RN 端  = packages/ui-native/src/card.tsx(同六件,function 组件 + ComponentProps<typeof View>,
 *    nativewind 类承载;本票前缺 CardDescription,由本票补齐)。
 *
 * 本票是「二期契约下沉」的第一个样板:把"同一组件两套实现"改成"平台无关 spec 数据 + 两端薄壳"。
 * 本表只存**取值档**,不存承载形式;承载形式(类名 / 样式表)留在两端薄壳里。代价是两端壳必须把本表
 * 的**每一个**导出常量都接走并真用 —— 挂了常量却没人消费就是"造好没装车",由同族判据
 * packages/shared/src/ui/__tests__/card-wiring.test.ts 逐条判红。
 *
 * 承载机制差异(规则6:机制,非取值分叉,逐条登记 —— 允许不同形,**不下沉**):
 *  - `ui-lift`(hover 抬升影):仅 web。依赖 CSS :hover 通道,RN 无此通道。
 *  - `min-[640px]:` 断点修饰:仅 web。响应式栅格是 web 端概念,RN 不按断点排版。
 *  - `border-border`:仅 RN。nativewind 不继承 web tokens 的边框默认色,须显式给边框色类。
 *  - 内边距承载位置:web 由 CardHeader/CardContent/CardFooter 各块承载(pb-0 / pt-0 互相 hedging),
 *    RN 原由 Card 根一次性承载(`p-4`)。本票把两端统一成**块承载**(与 web 同构):
 *    否则 CARD_CONTENT_PADDING_PX 在 RN 端没有落点,而"两端壳都消费每个常量"是本票的硬要求。
 *  - 类名形态:两端都写 Tailwind 风格类,但**字面量必须留在两端壳里** —— spec 文件不在
 *    Tailwind / nativewind 的扫描面内,把类名搬进 spec 会让规则根本不产出。
 *  ⇒ 上述不同形由 parity 基线入账(waivers 之外的锚点登记),不算欠债。
 *
 * 消费方式:子路径 `@ihui/shared/ui/card-spec`(禁挂根桶:同 verify-code-modal-spec:23-24,
 * 根桶出口会把整棵 src/chat 拉进被检程序,rn-app typecheck 从 0 错变 8 错,O81 实测)。
 * spec 内只存逻辑 px;web 端 1:1(CSS px),RN 端 1:1(逻辑 pt)。
 * 圆角**只给档名不给 px**:px 归 packages/design-tokens/src/radius.js 的 RADIUS_STEPS 与守门 77
 * 单源;本表只记"卡片取哪一档",与 RADIUS_ROLES.card = 'lg'(2026-09-27 用户定档:卡片一律 lg 档)同档。
 *
 * 裁定规则(同 O81 票④):规则1 两端现值已同,收一处防再分叉;规则2 同义不同值取 compact 较小档
 * (取小会贴边/裁切才取较大档并写明);规则3 一端有档、另一端没这处留白 → 取较大者并让缺失端补同档;
 * 规则6 平台承载机制差异 → 允许不同形,注明理由。
 */

/**
 * 卡片内边距 12(规则2):web `p-3` = 12 vs RN `p-4` = 16,取 compact 较小档。
 * 取 16 会让 web 侧所有卡片的 Header / Content / Footer 各胀 4px(web 卡片的块与卡片边缘齐平,
 * 块内边距就是卡片内边距),故取 web 现值 12,RN 侧由 16 收敛到 12。
 */
export const CARD_PADDING_PX = 12

/**
 * 卡片圆角档 'lg'(规则1):两端现值均已 `rounded-lg`,收一处防再分叉。
 * 只给档名不给 px —— px 由 radius.js 单源产出;两端各自把档名映射成本端承载类名。
 */
export const CARD_RADIUS_TIER = 'lg'

/**
 * Header 段垂直间隙 6(规则2):web CardHeader `space-y-1.5` = 6 vs RN CardHeader `mb-2` = 8,取小。
 * 承载位置不同(web 是段内 flex 行距,RN 是段下外距)⇒ 按规则6 登记为允许不同形,取值统一为 6。
 */
export const CARD_HEADER_GAP_PX = 6

/**
 * CardContent 内边距 12(规则1/2):web CardContent `p-3` = 12;RN 端原本没有这一档(内边距由
 * Card 根承载),本票把 RN 的承载位置对齐到 web 形态后按同档取值。
 * 与 CARD_PADDING_PX 同值但槽位不同:单独导出是为了 Content 单独调档时不牵连 Header / Footer。
 */
export const CARD_CONTENT_PADDING_PX = 12

/**
 * Footer 段垂直间隙 8(规则3):RN CardFooter `mt-2` = 8 是显式档,web CardFooter 原无显式间距
 * (`flex items-center` 子项紧贴)⇒ 取 8,web 侧在子项间补同档 `gap-2`。
 * 承载位置不同(web 是段内 gap,RN 是段上外距)⇒ 同 HEADER_GAP,按规则6 登记。
 */
export const CARD_FOOTER_GAP_PX = 8
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
