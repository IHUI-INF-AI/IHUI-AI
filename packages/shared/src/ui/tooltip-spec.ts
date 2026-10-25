// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Tooltip 族的结构与几何单一源(web 薄壳与 RN 薄壳共用),形状照 card-spec / badge-spec / vip-badge-spec。
 *
 * 两端真实实现坐标:
 *  - web 端 = packages/ui-react/src/components/tooltip.tsx(Radix 四件套
 *    Provider / Root / Trigger / Content(:11-13,:15-34),`TooltipContent` 是 forwardRef 薄壳,
 *    Tailwind 类 + Radix `Arrow` 承载,hover/focus 触发,38 行);
 *  - RN 端  = packages/ui-native/src/tooltip.tsx(单体 `children + content + side`(:9-13),
 *    `Pressable` 长按触发 + `Modal` + `Animated` 自绘定位(:79-105),nativewind 类承载,
 *    无 Arrow,107 行)。
 *
 * 本表只存**取值档**,不存承载形式;承载形式(类名 / 样式表 / Radix prop)留在两端薄壳里。
 * 代价是两端壳必须把本表的**每一个**导出常量都接走并真用 —— 挂了常量却没人消费就是"造好没装车",
 * 由同族判据 packages/shared/src/ui/__tests__/tooltip-wiring.test.ts 逐条判红。
 *
 * 本族要收的**核心档** = 气泡与触发点之间的间距 gap:
 *  - web:18 `sideOffset = 4`(Radix prop,数值);
 *  - RN :15 `TOOLTIP_GAP = 8`(本地常量,computePosition 里 ± 它,:69-75)。
 *  这是两端**同义不同值**的唯一几何分叉,由 `TOOLTIP_GAP_PX` 收口(裁定见该常量注释)。
 *  其余已同值的五档(圆角 / 横向内边距 / 纵向内边距 / 字号 / 投影)两端**逐字相同** ⇒
 *  本票的作用是**回归锁**:现在零差异不等于永远零差异,任一侧单方面改档都会被 wiring 判据挡回。
 *
 * 承载机制差异(规则6:机制,非取值分叉,逐条登记 —— 允许不同形,**不下沉**):
 *  - **触发机制**:web = hover / focus(Radix Provider 的 :hover 通道);
 *    RN = **长按 300ms**(RN:81 `delayLongPress={300}`,移动端无 hover 通道)。
 *    ⇒ 机制差,不下沉。但"间距"是触发之后气泡落点的**几何**,与触发机制正交 ⇒ 照收;
 *    两端把同一个 GAP 档落进两套完全不同的定位实现里,恰恰证明它不该是两份常量。
 *  - **定位机制**:web 由 Radix Popper 计算(`sideOffset` 是个 prop);RN 由 `measureInWindow`
 *    手算(:63-77 的 computePosition)。同一档的量在两个坐标系里落点形态不同,但**取值同源**。
 *  - `z-popover` + `Portal`(web:19,:24):仅 web。RN 用 `Modal` 全屏层(RN:84),没有 z-index 通道。
 *  - `Arrow`(web:31 `TooltipPrimitive.Arrow` + `fill-popover`):仅 web。RN 端无箭头件 ——
 *    这正是 RN 原先把 gap 抬到 8 的来历(无箭头时用距离代替视觉补位),裁定见 GAP_PX。
 *  - `animate-in` / `data-[state=closed]:animate-out` / `data-[side=…]:slide-in-*`(web:25):仅 web,
 *    依赖 CSS 动画 + Radix 的 data-attr 通道;RN 进出场走 `Animated.timing` + `ANIM_DURATION`(JS 通道)。
 *  - `overflow-hidden`(web:24):仅 web。RN 气泡在 Modal 内绝对定位,不经父容器裁剪。
 *  - `border-border`(RN:96)vs 裸 `border`(web:24):nativewind 不继承 web tokens 的边框默认色。
 *  - 字色落点:web 落在 Content 根(`text-popover-foreground`,web:24);RN 落在内层 `Text`(RN:97)。
 *  - 类名字面量:两端都写 Tailwind 风格类,但**字面量必须留在两端壳里** —— spec 文件不在
 *    Tailwind / nativewind 的扫描面内,把类名搬进 spec 会让规则根本不产出。
 *  ⇒ 上述不同形由 parity 基线入账(waivers 之外的锚点登记),不算欠债。
 *
 * 单端档(本票**不收**,逐条登记留痕 —— 免得被"已下沉"的账盖掉):
 *  - `MAX_WIDTH = 240`(仅 RN:17):web 端没有这处上限。按规则3 本该"取较大者并让缺失端补同档",
 *    但下沉它等于给 web 端**新加**一条 240px 上限(web 现有长文案 tooltip 会提前折行),
 *    那是产品定档而不是取值收口 ⇒ 维持单端,登记待裁。
 *  - `ANIM_DURATION = 150`(仅 RN:16):动画时长是进出场机制的一部分,随机制(规则6)不下沉。
 *  - `delayLongPress = 300`(仅 RN:81):触发机制的一部分,同上。
 *
 * 消费方式:子路径 `@ihui/shared/ui/tooltip-spec`(禁挂根桶:同 card-spec:30-31,
 * 根桶出口会把整棵 src/chat 拉进被检程序,rn-app typecheck 从 0 错变 8 错,O81 实测)。
 * spec 内只存逻辑 px;web 端 1:1(CSS px),RN 端 1:1(逻辑 pt)。
 * 圆角**只给档名不给 px**:px 归 packages/design-tokens/src/radius.js 的 RADIUS_STEPS 与守门 77
 * 单源;本表只记"气泡取哪一档"。
 *
 * 裁定规则(同 card-spec:36-38):规则1 两端现值已同,收一处防再分叉;规则2 同义不同值取 compact
 * 较小档(取小会贴边/裁切才取较大档并写明);规则3 一端有档、另一端没这处留白 → 取较大者并让缺失端
 * 补同档;规则6 平台承载机制差异 → 允许不同形,注明理由。
 */

/**
 * 气泡与触发点的间距 4(规则2:同义不同值取 compact 较小档)。
 * 分歧现场:web:18 `sideOffset = 4` vs RN:15 `TOOLTIP_GAP = 8`。
 * 取 4 的理由:
 *  - web 的 4 是 Radix + `Arrow` 组合下已被验收的现值,再加到 8 会让箭头与气泡视觉脱开、显得悬空;
 *  - 取小**不裁切**:RN 气泡在 `Modal` 内绝对定位(RN:94),不进父容器裁剪通道,4pt 不产生截断;
 *  - RN 的 8 是端内自设常量(TOOLTIP_GAP),无对外契约;8 → 4 只动气泡落点,不动触发与进出场机制。
 * ⇒ RN 端由 8 收敛到 4,web 端保持 4。两端各把这同一个数送进自己的定位实现(Radix `sideOffset`
 *   prop / RN `computePosition` 的 ±偏移)。
 */
export const TOOLTIP_GAP_PX = 4

/**
 * 圆角档 'md'(规则1):两端现值均已 `rounded-md`(web:24 / RN:96)。
 * 只给档名不给 px —— px 由 radius.js 单源产出;两端各自把档名映射成本端承载类名。
 */
export const TOOLTIP_RADIUS_TIER = 'md'

/**
 * 横向内边距 12(规则1):两端同为 `px-3` = 12(web:24 / RN:96)。已同值 ⇒ 本票的作用是回归锁。
 */
export const TOOLTIP_PADDING_X_PX = 12

/**
 * 纵向内边距 6(规则1):两端同为 `py-1.5` = 6(web:24 / RN:96)。已同值 ⇒ 回归锁。
 */
export const TOOLTIP_PADDING_Y_PX = 6

/**
 * 字号档 'xs'(规则1):两端同为 `text-xs` = 12(web:24 / RN:97)。
 * 只给档名不给 px —— 字号档由两端各自的 Tailwind / nativewind 尺度产出,本表不复制一份 px,
 * 免得同一语义出现两个可改点。
 */
export const TOOLTIP_TEXT_TIER = 'xs'

/**
 * 投影档 'md'(规则1):两端同为 `shadow-md`(web:24 / RN:96)。已同值 ⇒ 回归锁。
 * 只给档名不给色值/偏移:投影是 token 消费,搬进 spec 会脱离 Tailwind / nativewind 扫描面。
 * 注意与容器类卡片的区别(见 card.tsx:29-31「静止无影、hover 才有影」定档):
 * tooltip 是**浮层**,不在那条"容器静止无影"的定档范围内,两端现值同为 shadow-md,照收。
 */
export const TOOLTIP_SHADOW_TIER = 'md'
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
