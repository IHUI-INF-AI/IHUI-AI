// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Tabs 族的结构与几何单一源(web 薄壳与 RN 薄壳共用),形状照 card-spec。
 *
 * 两端真实实现坐标:
 *  - web 端 = packages/ui-react/src/components/tabs.tsx(Radix Tabs 包四件:
 *    Tabs / TabsList / TabsTrigger / TabsContent,forwardRef<HTML...>,Tailwind 类承载);
 *  - RN 端  = packages/ui-native/src/tabs.tsx(单组件 Tabs,View + 逐 tab Pressable,
 *    nativewind 类承载;本票前无 TabsContent 等价物 —— RN 的 Tabs 只是 tablist + onPress 回调)。
 *
 * 本表只存**取值档**,不存承载形式;承载形式(类名 / 样式表)留在两端薄壳里。代价是两端壳必须把本表
 * 的**每一个**导出常量都接走并真用 —— 挂了常量却没人消费就是"造好没装车",由同族判据
 * packages/shared/src/ui/__tests__/tabs-wiring.test.ts 逐条判红。
 *
 * 承载机制差异(规则6:机制,非取值分叉,逐条登记 —— 允许不同形,**不下沉**):
 *  - TabsTrigger 横向内边距:web `px-3` = 12(Radix Trigger 按内容定宽,需横向 padding);
 *    RN 的 tab 是 `flex-1` 均分整条 list 宽度,无横向 padding(均分即布局)。**取值不可比 ⇒ 不下沉**,
 *    登记为平台专属项,两端壳各自保留。
 *  - TabsContent 上间距 `mt-2` = 8:仅 web(RN 无 TabsContent 等价物)。机制差异 ⇒ 不下沉。
 *  - 选中态背景:web `data-[state=active]:bg-selection`;RN `active && 'bg-background'`(flex-1 下
 *    用 bg-background 而非 bg-selection,避免整条 tab 反白)。色值/选择器差异 ⇒ 不下沉。
 *  - web 的 focus-visible:ring-2 / transition-all、RN 的 accessibilityRole / accessibilityState
 *    无障碍通道:平台机制差异 ⇒ 不下沉。
 *  - 类名形态:两端都写 Tailwind 风格类,但**字面量必须留在两端壳里** —— spec 文件不在
 *    Tailwind / nativewind 的扫描面内,把类名搬进 spec 会让规则根本不产出。
 *  ⇒ 上述不同形由 parity 基线入账(waivers 之外的锚点登记),不算欠债。
 *
 * 消费方式:子路径 `@ihui/shared/ui/tabs-spec`(禁挂根桶:同 card-spec,
 * 根桶出口会把整棵 src/chat 拉进被检程序,rn-app typecheck 从 0 错变 8 错,O81 实测)。
 * spec 内只存逻辑 px;web 端 1:1(CSS px),RN 端 1:1(逻辑 pt)。
 * 圆角**只给档名不给 px**:px 归 packages/design-tokens/src/radius.js 的 RADIUS_STEPS 与守门 77 单源;
 * 本表只记"tabs 取哪一档",与 RADIUS_ROLES 同档。
 *
 * 裁定规则(同 card-spec):规则1 两端现值已同,收一处防再分叉;规则2 同义不同值取 compact
 * 较小档(取小会贴边/裁切才取较大档并写明);规则3 一端有档、另一端没这处留白 → 取较大者并让缺失端
 * 补同档;规则6 平台承载机制差异 → 允许不同形,注明理由。
 */

/**
 * TabsList 圆角档 'lg'(规则1):两端现值均已 `rounded-lg`,收一处防再分叉。
 * 只给档名不给 px —— px 由 radius.js 单源产出;两端各自把档名映射成本端承载类名。
 */
export const TABS_LIST_RADIUS_TIER = 'lg'

/**
 * TabsList 内边距 4(规则1):web `p-1` = 4 vs RN `p-1` = 4,两端现值已同,收一处防再分叉。
 */
export const TABS_LIST_PADDING_PX = 4

/**
 * TabsList 高度 36(规则3):web `h-9` = 36 是显式档;RN 端原无显式高度(由内容撑开),
 * 本票把 RN 对齐到 web 的 `h-9`,使两端 tablist 视觉高度一致。
 */
export const TABS_LIST_HEIGHT_PX = 36

/**
 * TabsTrigger 圆角档 'md'(规则1):两端现值均已 `rounded-md`,收一处防再分叉。
 */
export const TABS_TRIGGER_RADIUS_TIER = 'md'

/**
 * TabsTrigger 字号 14(规则1):web `text-sm` = 14 vs RN `text-sm` = 14,两端现值已同,收一处防再分叉。
 */
export const TABS_TRIGGER_FONT_SIZE_PX = 14

/**
 * TabsTrigger 纵向内边距 4(规则2):web `py-1` = 4 vs RN `py-1.5` = 6,取 compact 较小档。
 * 承载位置相同(均为 trigger 纵向内距)⇒ 按规则2 取小,RN 侧由 6 收敛到 4。
 */
export const TABS_TRIGGER_PADDING_Y_PX = 4
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
