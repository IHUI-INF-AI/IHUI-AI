// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

// 跨端模型配置弹窗几何档 —— 值取"两端现档 + 裁决规则",两端组件文件不再各自抄裸数字。
//
// 票④ 收编后仍**不同形**的档,按性质分两类(两类都不得读成"已对齐"):
//  - 机制差异:自绘开关轨道(下面 SWITCH 一族)只有小程序端存在 —— RN 用平台 `<Switch>`,
//    原生控件不暴露几何档,没有可对齐的数字;录音弹窗一族(RECORD_*)只有 RN 存在 —— 小程序端
//    的"克隆音色"走 `Taro.chooseMessageFile` 选文件,没有录音界面。把它们的数值也收进本表只为
//    单源 + "另一端将来出现同族元素必须复用本表",不为制造同形。
//  - 未决结构分叉:上传控件外盒(UPLOAD_TILE 37 vs UPLOAD_CARD_WIDTH 80)。小程序是"方形图块 +
//    标签在块外",RN 是"虚线卡 + 标签在卡内且 numberOfLines=1"。规则 2 取小(37)会截断 RN 卡内
//    5 字标签,取大(80)会把小程序图块放大 2.2 倍成空白方块 ⇒ 两条出路都破坏观感,按规则 6
//    "判不准宁可保留并写明未决"处理,留待设计定夺(改的是标签在块内/块外,不是某个数字)。
//
// 已真正同值的档:MARK 25(规则 2 取紧凑端,RN 图标盒 32→25;票⑤续后小程序端不再内套
// 25 盒,该档转为 RN 单侧盒档,小程序同槽直接按 BLOCK_GLYPH 落字形,见 MARK 注释)、
// INPUT_HEIGHT 40(规则 3 取较大端,小程序端 5 处参数输入补同档)、
// DELETE_BADGE 20 与 AUDIO_MENU_ICON 40(票①②已收)、
// INLINE_GLYPH 12(两端现值已同:小程序 `LineIcon size={24}` 走 rpx 即 12px,RN `size={12}` 是 dp)。
//
// 票⑦(2026-09-27)新收的**同物不同档**(两端都渲染同一元素,按裁决规则取较大的一档,
// 两端由同一批具名档取数,不再各抄 className 档位):
//  CHIP_PAD_X 12 / CHIP_PAD_Y 6 / CHIP_GAP 8(选项胶囊:小程序 `px-3 py-1`+容器 `gap-2`
//  vs RN `px-2.5 py-1.5`+`mr/mb-1.5`)、LABEL_GAP 6(RN `Row` 标签 `mb-1.5` vs 小程序 `mb-1`)、
//  INPUT_PAD_X 14(RN `px-3.5` vs 小程序 `px-3`)、MENU_PAD 20(小程序卡 `p-4`=16 vs RN 行 `px-5`=20)、
//  MENU_ROW_PAD_Y 12(克隆音色行:RN `py-3` vs 小程序 `py-2`)。
//  仍然**不收敛**的三型(逐条取证见交付报告,不得为凑平给单端补数字):
//  - 单侧元素:RN `selecter` 变体(`mt-0.5`=2 / `py-8`=32)与录音弹窗(`RECORD_*` 64/24)、
//    RN 底部取消/保存与音色下拉触发块(`py-2.5`/`px-2.5`=10)—— 小程序端同一文件里**不渲染**这些
//    元素(模型列表走 `adapters/Selecter.taro` 独立组件;克隆音色走 `Taro.chooseMessageFile`),
//    补档=造新能力,须用户批准;
//  - 未决结构分叉:上传控件外盒(见上面 UPLOAD_TILE / UPLOAD_CARD_WIDTH 两条);
//  - 机制差异:自绘开关轨道一族只有小程序存在(RN 用平台 `<Switch>`)。
//
// 单位口径:本表只存**逻辑 px**。小程序侧经 `toUnit`(= `rpx(px * TARO_RPX_PER_PX)`)落位,
// RN 侧 dp 与逻辑 px 1:1。字形类走组件 `size` 属性,其量纲按各端原语约定:
// RN `lucide-react-native` 收 px,小程序 `LineIcon` 的 number 收 rpx(故调用处乘 `TARO_RPX_PER_PX`)。
//
// 消费方式只能是子路径 `@ihui/shared/ui/model-config-dialog-spec`,**禁止挂根桶**。

/** 每端注入的单位换算(一个逻辑 px 到该平台数值);泛型把单位类型带出来。 */
export type GeometryUnit<U extends string | number> = (px: number) => U

/**
 * 附件删除角标 20:小程序 `w-4 h-4` = 16 / RN `h-5 w-5` = 20。
 * 裁决规则 2(两端分叉取更稳的一档,角标取大不取小,点击命中不缩水)→ 20。
 */
export const MODEL_CONFIG_DELETE_BADGE_PX = 20

/**
 * 音色菜单行前图标块 40:小程序 `w-[40rpx] h-[40rpx]` = 20 / RN `h-10 w-10` = 40。
 * 裁决规则 2 取大 → 40(行内文字 12/双行,图标块小于行高会把行拉歪)。
 */
export const MODEL_CONFIG_AUDIO_MENU_ICON_PX = 40

/**
 * 上传控件里的"状态标记盒" 25:曾是小程序 `w-[50rpx] h-[50rpx]`(=25 位图状态图)vs
 * RN `h-8 w-8`(=32 装 lucide 字形),裁决规则 2 取 compact 较小档 → 25。
 * **票⑤续(2026-09-26)后为 RN 单侧盒档** —— 小程序端位图退役,37 图块内直接落
 * BLOCK_GLYPH 字形,不再内套 25 盒;本档保留是因为 RN UploadButton 仍用它,
 * 且"另一端将来若给字形补内盒必须复用本档"。
 */
export const MODEL_CONFIG_UPLOAD_MARK_PX = 25

/**
 * 上传图块外盒 37(小程序 74rpx)。**与下面 RN 的 80 不是同值** —— 见文件头"未决结构分叉"。
 * 本档只保证小程序端两处图块(空态 / 成功态)由同一个数决定。
 */
export const MODEL_CONFIG_UPLOAD_TILE_PX = 37

/**
 * RN 上传虚线卡宽 80。**未决**(与小程序 37 同槽位不同形,理由见文件头)。
 * 80 不是设计取值而是布局上限:4 枚横排在 375pt 屏、`px-4` 后可用宽 ≈343,4×80 + 3×6 = 338 才放得下。
 */
export const MODEL_CONFIG_UPLOAD_CARD_WIDTH_PX = 80

/**
 * 参数输入行高 40:RN 现档 `h-10`(=40)vs 小程序端**完全没有高度档**(由 `py-2` + `text-sm`
 * 撑出约 36)。裁决规则 3「一端有档另一端无 → 取较大者并让缺失端补同档」→ 40,小程序 5 处
 * 参数输入补本档(40 > 现自然高 ⇒ 只会变高不会截断文字)。
 */
export const MODEL_CONFIG_INPUT_HEIGHT_PX = 40

/**
 * 参数输入横向内衬 14:RN `px-3.5`=14 vs 小程序 `px-3`=12,同一元素(数值/文本参数输入框)
 * 各抄一档。裁决规则「间距取较大者」→ 14。与高度一起由 `modelConfigInputBoxStyle` 出口给,
 * 这样两端不可能只改一个方向。
 */
export const MODEL_CONFIG_INPUT_PAD_X_PX = 14

/**
 * 选项胶囊(比例 / 分辨率 / 帧数 / 音色)横向内衬 12:小程序 `px-3`=12 vs RN `px-2.5`=10 → 取大。
 * 两端把类名里的档位摘掉、改挂本档,免得一端改了另一端没改。
 */
export const MODEL_CONFIG_CHIP_PAD_X_PX = 12

/** 选项胶囊纵向内衬 6:小程序 `py-1`=4 vs RN `py-1.5`=6 → 取大(RN 档)。 */
export const MODEL_CONFIG_CHIP_PAD_Y_PX = 6

/**
 * 选项胶囊之间的间距 8:小程序在容器上 `gap-2`=8,RN 在条目上 `mr-1.5 mb-1.5`=6 ——
 * **两种机制同一个数**,按"间距取较大者"统一到 8:小程序继续用容器 gap,RN 继续用条目 margin,
 * 谁也不换机制(换机制会连带影响别的元素,属重构不在本票)。
 */
export const MODEL_CONFIG_CHIP_GAP_PX = 8

/** 字段标签与其控件的间距 6:RN `Row` 标签 `mb-1.5`=6 vs 小程序标签 `mb-1`=4 → 取大。 */
export const MODEL_CONFIG_LABEL_GAP_PX = 6

/**
 * 音色选择弹窗的内容内衬 20:小程序整卡 `p-4`=16 vs RN 逐行 `px-5`=20 → 取大。
 * 小程序把四个方向一起挂本档;RN 只挂左右(它的头部纵向 16、行纵向另见 MENU_ROW_PAD_Y)。
 */
export const MODEL_CONFIG_MENU_PAD_PX = 20

/** 音色菜单行(选择音色 / 克隆音色)纵向内衬 12:RN `py-3`=12 vs 小程序克隆行 `py-2`=8 → 取大。 */
export const MODEL_CONFIG_MENU_ROW_PAD_Y_PX = 12

/**
 * 自绘开关轨道宽 44(小程序 88rpx)。**机制差异,非取值分叉** —— RN 侧是平台 `<Switch>`,
 * 没有可对齐的几何档(见文件头)。44 恰为触控下限,但轨道**高只有 22** —— 小程序端无 hitSlop
 * 通道,本票只收编现档不改观感,补触控高度另计一票。
 */
export const MODEL_CONFIG_SWITCH_TRACK_WIDTH_PX = 44

/** 自绘开关轨道高 22(小程序 44rpx)。同上,机制差异档。 */
export const MODEL_CONFIG_SWITCH_TRACK_HEIGHT_PX = 22

/** 自绘开关轨道左右内衬 2(小程序 `px-[4rpx]`)。拇指行程的减数,见下面 TRAVEL。 */
export const MODEL_CONFIG_SWITCH_TRACK_PAD_X_PX = 2

/** 自绘开关拇指方块 18(小程序 36rpx)。与 RN 端 BLOCK_GLYPH 同为 18 属**巧合**而非同一元素。 */
export const MODEL_CONFIG_SWITCH_THUMB_PX = 18

/**
 * 拇指位移 = 轨道宽 − 拇指 − 左右内衬(派生式,不留第二个真相)。
 * 小程序端原文案是字面量 `translateX(44rpx)`,与本式算得的 22px(=44rpx)同值 —— 收编只换取数
 * 来源,不改观感。
 */
export const MODEL_CONFIG_SWITCH_THUMB_TRAVEL_PX =
  MODEL_CONFIG_SWITCH_TRACK_WIDTH_PX -
  MODEL_CONFIG_SWITCH_THUMB_PX -
  MODEL_CONFIG_SWITCH_TRACK_PAD_X_PX * 2

/**
 * 行内小字形 12(箭头 / 关闭叉)。裁决规则 1:两端现值已同(小程序 `LineIcon size={24}` 按 rpx
 * 折成 12px,RN `size={12}` 是 dp),收进一处只为不再分叉。
 */
export const MODEL_CONFIG_INLINE_GLYPH_PX = 12

/**
 * 块内字形 18(音色菜单的 Music/Mic、上传卡的 Check/Plus)。**两端同档** ——
 * 票⑤续(2026-09-26)小程序端把该槽位的 CDN 位图退役为 `<LineIcon>`
 * (plus/check/mic),墨迹一律经本档 × `TARO_RPX_PER_PX` 落位,与 RN 侧同值。
 */
export const MODEL_CONFIG_BLOCK_GLYPH_PX = 18

/**
 * 录音按钮方块 64(RN `h-16 w-16`)。**机制差异,非取值分叉** —— 小程序端无录音界面
 * (克隆音色走 `Taro.chooseMessageFile`),见文件头。
 */
export const MODEL_CONFIG_RECORD_BUTTON_PX = 64

/** 录音按钮内字形 24(RN `Square` / `Mic`)。同上,RN 独有元素。 */
export const MODEL_CONFIG_RECORD_GLYPH_PX = 24

/** 角标盒子结构:正方块 + 居中内容(定位/圆角通道各端保留,这里只统一几何)。 */
export function modelConfigDeleteBadgeStyle<U extends string | number>(
  toUnit: GeometryUnit<U>,
): { width: U; height: U } {
  return {
    width: toUnit(MODEL_CONFIG_DELETE_BADGE_PX),
    height: toUnit(MODEL_CONFIG_DELETE_BADGE_PX),
  }
}

/** 音色菜单图标块盒子:正方形(排布 flex 由端内挂自己的原语)。 */
export function modelConfigAudioMenuIconStyle<U extends string | number>(
  toUnit: GeometryUnit<U>,
): { width: U; height: U } {
  return {
    width: toUnit(MODEL_CONFIG_AUDIO_MENU_ICON_PX),
    height: toUnit(MODEL_CONFIG_AUDIO_MENU_ICON_PX),
  }
}

/**
 * 通用正方盒 —— 本弹窗里"边长相等"的那几槽(上传图块 / 标记盒 / 开关拇指 / 录音按钮)
 * 共用这一份结构,边长由各常数给定。不再为每一槽抄一个同体函数。
 */
export function modelConfigSquareStyle<U extends string | number>(
  px: number,
  toUnit: GeometryUnit<U>,
): { width: U; height: U } {
  return { width: toUnit(px), height: toUnit(px) }
}

/**
 * 参数输入行:高度与横向内衬两档一起给(票⑦前只有高度是跨端档,横向两端各抄 className 档位)。
 * 圆角与上下内衬不进本表 —— 圆角必须走 `radius.js` 单一源(守门 77),在这里存第三个圆角数字
 * 就是第二份真相。
 */
export function modelConfigInputBoxStyle<U extends string | number>(
  padX: number,
  toUnit: GeometryUnit<U>,
): { height: U; paddingLeft: U; paddingRight: U } {
  return {
    height: toUnit(MODEL_CONFIG_INPUT_HEIGHT_PX),
    paddingLeft: toUnit(padX),
    paddingRight: toUnit(padX),
  }
}

/** 选项胶囊内衬:横纵两档成对给出,免得一端只改一个方向而两端又分叉。 */
export function modelConfigChipInnerStyle<U extends string | number>(
  padX: number,
  padY: number,
  toUnit: GeometryUnit<U>,
): { paddingLeft: U; paddingRight: U; paddingTop: U; paddingBottom: U } {
  return {
    paddingLeft: toUnit(padX),
    paddingRight: toUnit(padX),
    paddingTop: toUnit(padY),
    paddingBottom: toUnit(padY),
  }
}

/** 胶囊间距 · 小程序形态:挂在 `flex-wrap` 容器上的 `gap`。 */
export function modelConfigChipRowGapStyle<U extends string | number>(
  gap: number,
  toUnit: GeometryUnit<U>,
): { gap: U } {
  return { gap: toUnit(gap) }
}

/** 胶囊间距 · RN 形态:挂在条目上的右/下 margin(与上面同档不同机制,见 CHIP_GAP 注释)。 */
export function modelConfigChipItemMarginStyle<U extends string | number>(
  gap: number,
  toUnit: GeometryUnit<U>,
): { marginRight: U; marginBottom: U } {
  return { marginRight: toUnit(gap), marginBottom: toUnit(gap) }
}

/** 字段标签与它下面那行控件的间距(标签块只有这一档是跨端的)。 */
export function modelConfigLabelGapStyle<U extends string | number>(
  gap: number,
  toUnit: GeometryUnit<U>,
): { marginBottom: U } {
  return { marginBottom: toUnit(gap) }
}

/** 音色选择弹窗内容内衬 · 小程序形态:整卡四边同一档。 */
export function modelConfigMenuCardStyle<U extends string | number>(
  pad: number,
  toUnit: GeometryUnit<U>,
): { paddingLeft: U; paddingRight: U; paddingTop: U; paddingBottom: U } {
  return {
    paddingLeft: toUnit(pad),
    paddingRight: toUnit(pad),
    paddingTop: toUnit(pad),
    paddingBottom: toUnit(pad),
  }
}

/** 音色选择弹窗内容内衬 · RN 形态:卡本身不挂内衬,逐行挂左右两档(与上面同档)。 */
export function modelConfigMenuPadXStyle<U extends string | number>(
  pad: number,
  toUnit: GeometryUnit<U>,
): { paddingLeft: U; paddingRight: U } {
  return { paddingLeft: toUnit(pad), paddingRight: toUnit(pad) }
}

/** 音色菜单行的纵向内衬(两端同一档;横向另见 MENU_PAD)。 */
export function modelConfigMenuRowStyle<U extends string | number>(
  padY: number,
  toUnit: GeometryUnit<U>,
): { paddingTop: U; paddingBottom: U } {
  return { paddingTop: toUnit(padY), paddingBottom: toUnit(padY) }
}

/** 上传虚线卡(RN 独有形态):只有宽度是档,高度由"标记盒 + 单行标签"撑出。 */
export function modelConfigUploadCardStyle<U extends string | number>(
  toUnit: GeometryUnit<U>,
): { width: U } {
  return { width: toUnit(MODEL_CONFIG_UPLOAD_CARD_WIDTH_PX) }
}

/**
 * 自绘开关轨道:宽 / 高 / 左右内衬三档同时给,因为拇指行程是它们的派生式
 * (`MODEL_CONFIG_SWITCH_THUMB_TRAVEL_PX`)。拆开写就会有一处漏改而轨道与拇指不再相减。
 */
export function modelConfigSwitchTrackStyle<U extends string | number>(
  toUnit: GeometryUnit<U>,
): { width: U; height: U; paddingLeft: U; paddingRight: U } {
  return {
    width: toUnit(MODEL_CONFIG_SWITCH_TRACK_WIDTH_PX),
    height: toUnit(MODEL_CONFIG_SWITCH_TRACK_HEIGHT_PX),
    paddingLeft: toUnit(MODEL_CONFIG_SWITCH_TRACK_PAD_X_PX),
    paddingRight: toUnit(MODEL_CONFIG_SWITCH_TRACK_PAD_X_PX),
  }
}
