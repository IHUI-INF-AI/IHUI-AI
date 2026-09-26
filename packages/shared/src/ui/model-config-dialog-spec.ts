// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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
// 已真正同值的档:MARK 25(规则 2 取紧凑端,RN 图标盒 32→25)、INPUT_HEIGHT 40(规则 3 取较大端,
// 小程序端 5 处参数输入补同档)、DELETE_BADGE 20 与 AUDIO_MENU_ICON 40(票①②已收)、
// INLINE_GLYPH 12(两端现值已同:小程序 `LineIcon size={24}` 走 rpx 即 12px,RN `size={12}` 是 dp)。
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
 * 上传控件里的"状态标记盒" 25:小程序 `w-[50rpx] h-[50rpx]`(=25 位图状态图)vs
 * RN `h-8 w-8`(=32 装 lucide 字形)。同一枚槽位(上传按钮内表示"待添加 / 已添加"的方块),
 * 裁决规则 2 取 compact 较小档 → 25;RN 的 18px 字形放进 25 盒仍有 3.5px 余量,不裁切。
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
 * 块内字形 18(音色菜单的 Music/Mic、上传卡的 Check/Plus)。**RN 独有** —— 小程序端同一槽位放
 * 的是位图状态图,尺寸由 UPLOAD_MARK 决定,矢量字形档在另一端没有对应元素。
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
 * 参数输入行:只有**高度**是跨端档。左右内衬与圆角不进本表 —— 圆角必须走 `radius.js`
 * 单一源(守门 77),在这里存第三个圆角数字就是第二份真相。
 */
export function modelConfigInputBoxStyle<U extends string | number>(
  toUnit: GeometryUnit<U>,
): { height: U } {
  return { height: toUnit(MODEL_CONFIG_INPUT_HEIGHT_PX) }
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
