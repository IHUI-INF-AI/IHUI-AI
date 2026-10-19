// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * VerifyCodeModal 的结构与几何单一源(小程序端与 RN 端共用),形状照 login-popup-spec / navbar-spec。
 *
 * 两端真实实现:
 *  - 小程序端 = apps/miniapp-taro/src/components/VerifyCodeModal.tsx(零引用孤儿副本;自带登录/注册业务流);
 *  - RN 端 = apps/mobile-rn/src/components/VerifyCodeModal.tsx(RegisterScreen 活体;受控纯 UI, onSubmit/onResend 由调用方驱动)。
 *
 * 结构承载差异(机制,非取值分叉,逐条登记 —— 规则6,两端各自保留合法):
 *  - 键盘输入:RN 单隐藏 TextInput(1×1 opacity 0 键盘接收器,G-978007 注释钉死"聚焦视觉由格子档承担,
 *    不套共享 TextField");小程序 6 枚 FocusInput 逐格输入(Taro 惯例)。
 *  - 关闭入口:RN 卡片右上角 × 钮;小程序 header 行右侧"关闭"文字(历史形态)。
 *  - 按钮组:RN 底部单"确定"(onClose 已由 × 承担);小程序"取消 / 确定(验证中)"双按钮。
 *  - 号码呈现:RN 独立一行;小程序并入描述句(auth.resendCode 同族带参文案)。
 *  ⇒ 本票只收敛"同物不同值"的取值档;上述四种不同形由 parity 基线入账(waivers 之外的锚点登记)。
 *
 * 业务流差异(不在本 spec 射程):小程序端 sendSmsCode/loginBySms/register/bindPhone + Taro.showToast;
 * RN 端零业务,完全受控。
 *
 * 消费方式:子路径 `@ihui/shared/ui/verify-code-modal-spec`(禁挂根桶:同 login-popup-spec 头注,
 * 根桶出口会把整棵 src/chat 拉进被检程序, rn-app typecheck 从 0 错变 8 错,O81 实测)。
 * spec 内只存逻辑 px;小程序端换算 rpx(px * TARO_RPX_PER_PX),RN 端 1:1。
 * 圆角不进本表(守门 77 单源:RN 用 rnRadiusFor.*,小程序用 rounded-* 类;按钮/格子两端均取 control 档)。
 *
 * 裁定规则(O81 票④):规则1 两端现值已同,收一处防再分叉;规则2 同义不同值取 compact 较小档
 * (取小会贴边/裁切才取较大档并写明);规则3 一端有档、另一端没这处留白 → 取较大者并让缺失端补同档;
 * 规则4 字号必须落在既有档(12/14/16/24);规则6 平台承载机制差异 → 允许不同形,注明理由。
 */

/** 验证码位数 6(规则1):两端现值已同 —— 小程序 CODE_LENGTH / RN DEFAULT_LENGTH。 */
export const VERIFY_CODE_LENGTH = 6

/** 重发倒计时秒数 60(规则1):两端现值已同 —— 小程序 COUNTDOWN_SECONDS / RN DEFAULT_COUNTDOWN_SECONDS。 */
export const VERIFY_CODE_COUNTDOWN_SECONDS = 60

/**
 * 格子宽 36(规则2):RN BOX_SIZE = 48 vs 小程序 w-9 = 36,取 compact 较小档。
 * 取 48 会在小程序端溢出:六格+五距须 ≤ 卡内内容宽(750rpx 设计宽 - mx-8×2 - px-5×2 ≈ 606rpx ≈ 303px,
 * 6×48+5×8 = 328px > 303px);36 宽放 1 位数字不贴边,不裁切。
 */
export const VERIFY_CODE_BOX_WIDTH_PX = 36

/** 格子高 44(规则2):RN BOX_SIZE = 48 vs 小程序 h-11 = 44,取小;格内 16px 数字不裁切。 */
export const VERIFY_CODE_BOX_HEIGHT_PX = 44

/** 格间距 8(规则3):RN BOX_GAP = 8 显式档,小程序 justify-between 无显式 gap → 取 8,小程序端补显式 gap。 */
export const VERIFY_CODE_BOX_GAP_PX = 8

/** 格内数字字号 16(规则2+4):RN boxText = 20 vs 小程序 text-base = 16,取小;20 非既有档,就近吸附 16。 */
export const VERIFY_CODE_BOX_FONT_PX = 16

/**
 * 卡片最大宽 320(规则2):RN CARD_MAX_WIDTH = 360 vs 小程序 max-w-xs = 320,取小。
 * 320 在两端 375px 逻辑屏上都留足外边距;格子行(6×36+5×8 = 256px)在卡内宽(320-40 = 280px)不溢出。
 */
export const VERIFY_CODE_CARD_MAX_WIDTH_PX = 320

/** 卡片内边距 20(规则2):RN CARD_PADDING = 24 vs 小程序 px-5 = 20,取小。 */
export const VERIFY_CODE_CARD_PADDING_PX = 20

/** 卡片外边距(水平)16(规则1):RN center.paddingHorizontal = 16 = 小程序 mx-8 = 32rpx(16px)。 */
export const VERIFY_CODE_CARD_MARGIN_X_PX = 16

/** 标题字号 16(规则2+4):RN title = 18 vs 小程序 text-base = 16,取小;18 非既有档位(12/14/16/24),就近 16。 */
export const VERIFY_CODE_TITLE_FONT_PX = 16

/** 描述行字号 12(规则1):RN description = 12 = 小程序 text-xs。 */
export const VERIFY_CODE_DESC_FONT_PX = 12

/** 主按钮高 40(规则3):RN CONFIRM_BUTTON_HEIGHT = 40 显式档,小程序 py-[20rpx] 隐式撑高 → 取 40,小程序补显式高。 */
export const VERIFY_CODE_BUTTON_HEIGHT_PX = 40

/** 按钮文字字号 14(规则1):RN confirmText = 14 = 小程序 text-sm。 */
export const VERIFY_CODE_BUTTON_FONT_PX = 14

/** 倒计时/重发行字号 12(规则2):RN countdown = 12 vs 小程序 text-sm = 14,取小。 */
export const VERIFY_CODE_COUNTDOWN_FONT_PX = 12

/**
 * 号码行字号 14(单侧档,规则6登记):仅 RN 有独立号码行(现值 14,落既有档);小程序并入描述句,无此元素。
 * 保留导出的用途:RN 本地常量删除后由本表承接;parity 的 SL 维按"仅 RN 消费"报数,由基线入账。
 */
export const VERIFY_CODE_PHONE_FONT_PX = 14

/** 关闭钮盒 24(单侧档,规则6登记):仅 RN 有 × 钮(现值 24);小程序关闭走文字。同 PHONE_FONT 的报数逻辑。 */
export const VERIFY_CODE_CLOSE_BOX_PX = 24

/** × 字形字号 16(单侧档,规则6登记):仅 RN 有(现值 16,落既有档)。 */
export const VERIFY_CODE_CLOSE_ICON_FONT_PX = 16

/** 隐藏键盘接收器边长 1(单侧档,规则6登记):仅 RN 有(1×1 opacity 0 TextInput,G-978007);小程序走 6 枚 FocusInput。 */
export const VERIFY_CODE_HIDDEN_INPUT_PX = 1
