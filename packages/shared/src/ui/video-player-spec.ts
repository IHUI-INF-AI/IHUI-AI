// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 视频播放器(VideoPlayer)的几何单一源(小程序端与 RN 端共用),模式同 `back-chevron-spec.ts`。
 *
 * 两端的控制条机制根本不同(本票规则 3:数值对齐、通道各端保留,登记 waivers):
 *  - 小程序:原生 `<Video controls>` —— 播放/暂停/进度/全屏都是微信原生 chrome,端上没有任何
 *    自绘控件可以喂这张表;它经本表消费的只有**舞台尺寸**(高度由同一比例推导,不再写死 px)。
 *  - RN:`react-native-video` + `controls={false}` + 自绘浮层 chrome —— 与 web 端
 *    `apps/web/src/components/media/VideoPlayer.tsx` 的自绘 chrome 才是"同一元素",按规则 1
 *    取 web 既有值(见逐档注释)。
 *
 * 舞台尺寸:收编前小程序写死 `210px`(三处),RN 用 `aspect-video`(16:9,375 宽参考高 ≈211)。
 * 单一源定为**比例**:RN 直接吃 `VP_STAGE_ASPECT`,小程序经 `vpStageHeightRpx()` 换算成设计稿
 * rpx(750 宽 ⇒ 422rpx,375 设备上 = 211px,与 RN 同值;且随屏宽缩放,行为也与 aspect 同向)。
 * 裁决取 RN 的 16:9 而不是把 RN 压回 210:比例是无参考宽度的定义,固定 px 只是它在 375 上的投影。
 *
 * 不进本表的东西(登记在交付报告 waivers):
 *  - 浮层遮罩不透明度(web/70 · RN 顶栏/40 底栏/50)与进度色 —— 色档归 tokens/守门 93/83 管,
 *    本票只收几何;
 *  - loading/错误态载体:小程序是文字占位 + 原生 onError,RN 是 `<Loading>` spinner 叠错误文案
 *    —— 不同媒介;文字尺寸两端都走 Tailwind `text-sm` 档(同值 14),不经本表;
 *  - RN 的倍速切换/标题行是端内能力,小程序原生控件自带倍速菜单,无自绘对应物。
 *
 * 消费方式只能是子路径 `@ihui/shared/ui/video-player-spec`,**禁止挂根桶**。本表只存逻辑 px;
 * 小程序侧换算 `(px)=>rpx(px*TARO_RPX_PER_PX)`,RN 侧 1:1(dp)。
 *
 * ── O02 票④(第 ④ 格)收口证据:本族"单端档全在 RN、真收敛 0"────────────────
 * 现读 2026-10-28(`node scripts/check-cross-end-ui-parity.mjs --json`):
 *   VideoPlayer diffCount 5 / radiusCount 0 / elementRadiusCount 0 / named 冲突 0;
 *   仅 RN 5 = [4, 6, 8, 12, 16],仅小程序 0。
 *
 * 5 值逐条归属 —— **每一条都是 A(小程序端没有这个节点),B 0 枚、C 0 枚**:
 *   4  进度条轨道粗细 `VP_TRACK_HEIGHT_PX`(web `h-1` = 4);小程序原生 chrome 无自绘轨道。
 *      同值还有 RN 的 `py-1` 按钮纵向内边距(另一个槽,按值合并会过宽归因,§头注"同名数值不同槽"同理)。
 *   6  进度条命中行可见高 `VP_PROGRESS_ROW_HEIGHT_PX`(RN 原 `h-1.5`);小程序无自绘命中行。
 *   8  控制条内元素间距 `VP_CONTROL_GAP_PX`(web `gap-2` = 8);小程序无自绘控制条。
 *   12 浮层控制条内边距 `VP_OVERLAY_PADDING_PX`(web `p-3` = 12);
 *      **与 `VP_LABEL_FONT_PX`(12)同值但不同槽** —— 字号与内边距不得按值并成一档。
 *   16 错误文案横向留白(端内 Tailwind `px-4`,**不在本表**):小程序错误态是
 *      `justify-center` 容器里的裸 `<Text>`(无自绘容器),补一个 16 就是往屏幕上加节点。
 *
 * ⇒ 真收敛 = 0 枚:两端**没有**"同值却各写一份"的档 ——
 *   · 舞台尺寸已经单源:小程序 `rpx(vpStageHeightRpx())`、RN `aspectRatio: VP_STAGE_ASPECT`,
 *     422rpx → 211px @375 与 375 × 9/16 = 210.94px 落在同一像素(由 wiring 测试 ② 现算钉住);
 *   · 其余 4 个数值档的消费面只有 RN 自绘 chrome,小程序端按平台机制不消费
 *     (原生 `<Video controls>` 的播放/进度/全屏都是微信 chrome)。
 *   ⚠ 门 128 的 px 档集合**看不见舞台档**(比例不是 px 档),所以"舞台两端同值"这件事
 *   不能从门读数里推 —— 判据在 `__tests__/video-player-wiring.test.ts` 第 ② 条,不在本表。
 *
 * 单腿档清单(处置 = 留端内 / 留本表,均不得给小程序端补自绘节点):
 *   本表 4 枚(VP_TRACK_HEIGHT_PX / VP_PROGRESS_ROW_HEIGHT_PX / VP_CONTROL_GAP_PX /
 *   VP_OVERLAY_PADDING_PX)与字号档 VP_LABEL_FONT_PX 只被 RN 消费;
 *   hitSlop 两枚(VP_CONTROL_BUTTON_HIT_SLOP_PX / VP_PROGRESS_BAR_HIT_SLOP_PX)同为 RN 独有命中扩张通道;
 *   `px-4`(16)属端内 Tailwind 刻度,不搬进本表(搬进来会造出"两处都同值"的假账)。
 */

/** 舞台宽高比(单一源)。取值依据:RN 收编前既有 `aspect-video` = 16:9;小程序 210px 是同一意图的投影。 */
export const VP_STAGE_ASPECT = 16 / 9

/** rpx 设计稿基准宽(Taro 750)。只用于把比例投成小程序 rpx,不是第二档尺寸。 */
const VP_STAGE_REF_WIDTH_RPX = 750

/**
 * 小程序舞台高度(rpx 数值,喂 `rpx()`)。750 × 9/16 = 421.875 → 422(取整)。
 * 在 375pt 参考屏上 = 211px,即 RN `aspectRatio: VP_STAGE_ASPECT` 在同屏的渲染高度 —— 两端同值。
 */
export function vpStageHeightRpx(): number {
  return Math.round(VP_STAGE_REF_WIDTH_RPX / VP_STAGE_ASPECT)
}

/**
 * 浮层控制条内边距(逻辑 px)。取值依据:规则 1 —— web 控制条既有值 `p-3` = 12(RN 原 py-2=8 升档)。
 * **RN/web 单侧档**:小程序腿用原生 `<video>`(端内只有 STAGE_STYLE),不自绘控制层,无此内边距。
 */
export const VP_OVERLAY_PADDING_PX = 12

/**
 * 控制条内元素间距(逻辑 px)。web `gap-2` = RN `gap-2` = 8,收编前三方已同值;RN 进度行 `mt-2` 一并改吃本常数。
 * **RN/web 单侧档**:同上,小程序腿不自绘控制条。
 */
export const VP_CONTROL_GAP_PX = 8

/**
 * 浮层文字字号(逻辑 px)。取值依据:规则 1 —— web 时间/按钮标签既有值 `text-xs` = 12;
 * RN 时间戳与全屏标签原 `text-[10px]` 低于规则 2 的字号下限 12,一并升档。
 * **RN/web 单侧档**:小程序腿无自绘时间戳/全屏标签。
 */
export const VP_LABEL_FONT_PX = 12

/**
 * 进度条轨道粗细(逻辑 px)。web `h-1` = RN `h-1` = 4,收编前已同值。
 * **RN/web 单侧档**:小程序腿用原生视频控件的进度条,无自绘轨道。
 */
export const VP_TRACK_HEIGHT_PX = 4

/** 进度条命中行的可见高度(RN 原 `h-1.5` = 6)。只作为命中补差的被减数,小程序无自绘进度条。 */
export const VP_PROGRESS_ROW_HEIGHT_PX = 6

// 规则 2「命中块 ≥44」已由 hitSlop 出口承担(VP_CONTROL_BUTTON_HIT_SLOP_PX /
// VP_PROGRESS_BAR_HIT_SLOP_PX;小程序侧由原生控件 chrome 自证)——2026-10-27 撤零消费出口 VP_CONTROL_HIT_PX。

/**
 * 文字按钮的 hitSlop(不可外溢到相邻按钮:水平向补差刻意小于 `VP_CONTROL_GAP_PX` 的一半以上区间,
 * 取 4,避免 play/rate 命中区互相吞并)。
 * 推导:按钮可见高 ≈ 12px 行盒(~17) + `py-1`(4×2) ≈ 25 ⇒ 垂直向 (44−25)/2 = 9.5 → 10。
 */
export const VP_CONTROL_BUTTON_HIT_SLOP_PX = { top: 10, bottom: 10, left: 4, right: 4 } as const

/**
 * 进度条的 hitSlop。推导:命中行可见高 `VP_PROGRESS_ROW_HEIGHT_PX`(6)⇒ 垂直向 (44−6)/2 = 19;
 * 水平向取 8(与 `VP_CONTROL_GAP_PX` 同档,左右无相邻可竞争命中区)。
 */
export const VP_PROGRESS_BAR_HIT_SLOP_PX = { top: 19, bottom: 19, left: 8, right: 8 } as const
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
