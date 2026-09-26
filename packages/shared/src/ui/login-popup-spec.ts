// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * LoginPopUp 的结构与几何单一源(小程序端与 RN 端共用),形状照 loading-spec / section-header-spec。
 *
 * 两端真实实现:
 *  - 小程序端 = apps/miniapp-taro/src/components/LoginPopUp.tsx(页面级**居中弹窗**,只有资料卡一种形态);
 *  - RN 端 = apps/mobile-rn/src/components/LoginPopUp.tsx(<Modal> **底部抽屉**,含"通用授权卡"与"资料编辑卡"两种形态)。
 *
 * 承载形态差异(机制,非取值分叉,逐条登记):RN 顶部有拖拽条与右上 × 关闭、卡内顶部留白被拖拽条占用;
 * 小程序关闭走底部整宽文字按钮、四边留白均匀。RN 的"通用授权卡"(标题/描述/主副按钮/协议勾选)
 * 与资料卡的行首图标徽标、hint/error 行、保存/登出 footer,在小程序端整块不存在 —— 这些档收进本文件
 * 登记为**单侧档**;是否要给小程序端补齐属表单决策(§24),不在本票范围,不得为读数好看新增元素。
 *
 * 消费方式只能是子路径 `@ihui/shared/ui/login-popup-spec`(禁挂根桶:根桶出口会把整棵 src/chat 拉进
 * 被检程序,rn-app typecheck 从 0 错变 8 错,O81 实测)。
 * spec 内只存逻辑 px;小程序端换算 `rpx(px * TARO_RPX_PER_PX)`,RN 端 1:1。
 * 圆角不进本表(守门 77 单源:RN 用 rnRadius.*,小程序用 rounded-* 类);颜色/字号档外的观感不碰。
 *
 * 裁决规则(O81 票④):规则1 两端现值已同,收一处防再分叉;规则2 同义不同值取 compact 较小档
 * (取小会贴边/裁切才取较大档并写明);规则3 一端有档、另一端没这处留白 → 取较大者并让缺失端补同档;
 * 规则4 字号必须落在既有档(12/14/18/24;16 为标题既有档,见 section-header-spec),非档值就近吸附;
 * 规则6 平台承载机制差异 → 允许不同形,注明理由。判不准的宁可保留并写明未决。
 */

// ===== 两端共用档(小程序资料卡 × RN 资料编辑卡) =====

/**
 * 头像盒 70(规则2):小程序现档 `w-[140rpx] h-[140rpx]` = 70 vs RN AVATAR_SIZE = 72 —— 取紧凑档 70。
 * 头像内占位是 14px 单字符,70 档不裁切;RN 侧 72→70 仅收 2dp。
 */
export const LOGIN_POPUP_AVATAR_BOX_PX = 70

/**
 * 「更换头像」提示与头像的间距 6(规则2):小程序现档 `mt-2` = 8 vs RN AVATAR_MARGIN_BOTTOM = 6 → 取 6。
 */
export const LOGIN_POPUP_AVATAR_HINT_GAP_PX = 6

/** 「点击更换头像/更换头像」字号 12:两端现值已同(小程序 `text-xs` / RN 12)(规则1,收一处只为不再分叉)。 */
export const LOGIN_POPUP_CHANGE_HINT_FONT_PX = 12

/**
 * 纵向分块间距 12(规则2):小程序现档 `mb-4` = 16 / `mb-3` = 12 vs RN ROW_MARGIN_BOTTOM = 12 → 取 12。
 * 用在头像区底距、昵称/角色行底距、小程序登录按钮底距,以及 RN 通用卡主按钮底距(现值同为 12)。
 */
export const LOGIN_POPUP_SECTION_GAP_PX = 12

/**
 * 输入行盒高度 44(规则3):RN ROW_HEIGHT = 44 是显式档,小程序昵称行无显式高(`py-2` 撑出隐式 ~36)
 * → 取较大者 44,小程序端补同档(固定高 + 去竖向 padding,不再一端有档一端没有)。
 */
export const LOGIN_POPUP_ROW_HEIGHT_PX = 44

/** 输入行左右留白 12:两端现值已同(小程序 `px-3` / RN ROW_PADDING_HORIZONTAL)(规则1)。 */
export const LOGIN_POPUP_ROW_PADDING_X_PX = 12

/** 正文/输入/角色/描述字号 14:两端现值已同(小程序 `text-sm` / RN BODY_FONT_SIZE、DESCRIPTION_FONT_SIZE)(规则1)。 */
export const LOGIN_POPUP_BODY_FONT_PX = 14

/**
 * 小胶囊(立即升级/绑定)高度 24(规则3):RN UPGRADE_HEIGHT = 24 显式档;小程序胶囊无显式高
 * (`py-2` 撑出隐式 ~33)→ 取 RN 现档 24,小程序补同档(12px 文字在 24 盒内不裁切)。
 */
export const LOGIN_POPUP_PILL_HEIGHT_PX = 24

/** 小胶囊左右留白 10(规则2):小程序 `px-4` = 16 vs RN UPGRADE_PADDING_HORIZONTAL = 10 → 取 10。 */
export const LOGIN_POPUP_PILL_PADDING_X_PX = 10

/**
 * 小胶囊文字字号 12(规则4+2):RN 现值 11 非档 → 就近吸附 12;小程序 `text-sm` = 14 → 取两端较小档 12。
 * 「立即升级」「绑定/重绑」共用。
 */
export const LOGIN_POPUP_PILL_FONT_PX = 12

/**
 * 整宽动作按钮高度 48(规则3+4):RN 主/次按钮现档 48,保存/登出 footer 46 非档 —— 就近档在 44/48 之间
 * 等距,**取 48**:44 已是输入行档,按钮与输入行同档会把层级压平,且主/次按钮现值不用动;
 * 小程序登录/关闭按钮无显式高(`py-2` 隐式)→ 补同档 48。
 */
export const LOGIN_POPUP_BUTTON_HEIGHT_PX = 48

/**
 * 整宽按钮标签字号 14(规则4+2):RN 主/次按钮 15 非档 → 就近吸附 14(16 属标题档,不给按钮用);
 * 保存/登出 16 → 同族(弹窗按钮文字)按规则2 取 14;小程序现值已是 `text-sm` = 14。
 */
export const LOGIN_POPUP_BUTTON_FONT_PX = 14

/** 弹窗卡左右内边距 16(规则2):小程序 `p-6` = 24 vs RN CARD_PADDING_HORIZONTAL = 16 → 取 16。 */
export const LOGIN_POPUP_CARD_PADDING_X_PX = 16

/** 弹窗卡底部内边距 24:两端现值已同(小程序 `p-6` 的 24 / RN CARD_PADDING_BOTTOM)(规则1)。 */
export const LOGIN_POPUP_CARD_PADDING_BOTTOM_PX = 24

// ===== 小程序端单侧档(居中弹窗承载,机制差异,规则6) =====

/**
 * 居中弹窗顶部内边距 24(机制差异):小程序是居中卡,无拖拽条与右上 ×,顶距与四边同档 24;
 * RN 抽屉顶距被拖拽条占用(见 LOGIN_POPUP_SHEET_PADDING_TOP_PX 的 8)。**非取值分叉**。
 */
export const LOGIN_POPUP_DIALOG_PADDING_TOP_PX = 24

/**
 * 居中弹窗宽度上限 300(机制差异):小程序现档 `max-w-[600rpx]` = 300,弹窗靠屏居中需要上限;
 * RN 底部抽屉整宽(`width:'100%'`),没有这一档。**非取值分叉,不得为对账删除**。
 */
export const LOGIN_POPUP_DIALOG_MAX_WIDTH_PX = 300

// ===== RN 端单侧档(底部抽屉/授权卡/资料卡独有形态,机制差异,规则6) =====

/** 抽屉卡顶部内边距 8:被拖拽条占用,与小程序居中卡的 24 属承载差异(规则6)。 */
export const LOGIN_POPUP_SHEET_PADDING_TOP_PX = 8

/** 拖拽条宽 36:RN 底部抽屉独有(数值与 geometry.js 的 tapBox=36 同档属巧合,本档语义是把手宽)。 */
export const LOGIN_POPUP_DRAG_BAR_WIDTH_PX = 36

/** 拖拽条高 4:几何正圆/胶囊圆角仍走 `高/2` 表达式 + radius-exempt 标记(守门 77),本表只存高度。 */
export const LOGIN_POPUP_DRAG_BAR_HEIGHT_PX = 4

/** 拖拽条底距 12:与分块间距同值但语义独立(把手与内容的距离),不并档。 */
export const LOGIN_POPUP_DRAG_BAR_MARGIN_BOTTOM_PX = 12

/**
 * 授权卡标题字号 16:RN 独有(小程序弹窗无标题块)。16 是项目既有**标题档**
 * (section-header-spec 的 SECTION_HEADER_TITLE_FONT_PX 与 NavBar 标题同为 16),不属新增字号档。
 */
export const LOGIN_POPUP_TITLE_FONT_PX = 16

/** 授权卡标题底距 8:RN 独有。 */
export const LOGIN_POPUP_TITLE_MARGIN_BOTTOM_PX = 8

/** 授权卡描述底距 24:RN 独有(描述字号并入 LOGIN_POPUP_BODY_FONT_PX)。 */
export const LOGIN_POPUP_DESC_MARGIN_BOTTOM_PX = 24

/** 授权卡次按钮底距 24(次按钮与协议行的分隔留白):RN 独有(小程序无协议行)。 */
export const LOGIN_POPUP_SECONDARY_BUTTON_MARGIN_BOTTOM_PX = 24

/**
 * 协议文案字号 12(规则4):RN 现值 11 非档 → 就近吸附 12。
 * 未决登记:小程序端登录场景的协议勾选由微信授权面板承载,这行整块不存在 —— 属形态差异,是否补 UI 另计决策,本票不新增元素。
 */
export const LOGIN_POPUP_AGREEMENT_FONT_PX = 12

/** 勾选框与协议文案间距 4:RN 独有。 */
export const LOGIN_POPUP_AGREEMENT_GAP_PX = 4

/** 协议勾选框边长 16:RN 独有(命中区由 hitSlop 等平台补偿兜,不进本表)。 */
export const LOGIN_POPUP_CHECKBOX_SIZE_PX = 16

/** 勾选内 <Check/> 图标 12(规则4:现值 11 非档 → 吸附 12;16 盒内 12 不贴边):RN 独有。 */
export const LOGIN_POPUP_AGREEMENT_MARK_PX = 12

/** 右上 × 关闭按钮盒 32:小程序的关闭是底部整宽文字按钮(承载形态差异,规则6),两档不得互抄。 */
export const LOGIN_POPUP_CLOSE_BUTTON_SIZE_PX = 32

/** × 字形字号 18:落在既有字号档(12/14/18/24)上,无吸附(规则1,单侧登记)。 */
export const LOGIN_POPUP_CLOSE_ICON_FONT_PX = 18

/** × 字形行高 22(现值 = 18+4 的行盒补偿,只为稳住基线,不另放档):RN 独有。 */
export const LOGIN_POPUP_CLOSE_ICON_LINE_HEIGHT_PX = 22

/** × 关闭按钮距卡顶/右 8:RN 独有(抽屉头部区留白)。 */
export const LOGIN_POPUP_CLOSE_INSET_PX = 8

/**
 * 资料卡行首图标徽标 20:取值与 geometry.js 的 glyphMd=20 同档(不新造第三档);
 * 小程序资料卡行没有前缀徽标(对齐原小程序页版式),形态差异保留单侧(规则6)。
 */
export const LOGIN_POPUP_ICON_BADGE_SIZE_PX = 20

/** 徽标与输入/文字的间距 10:RN 独有。 */
export const LOGIN_POPUP_ICON_BADGE_MARGIN_RIGHT_PX = 10

/** 徽标内字形字号 12(规则4:现值 11 非档 → 就近吸附 12):RN 独有。 */
export const LOGIN_POPUP_ICON_GLYPH_FONT_PX = 12

/**
 * hint/error 行字号 12(规则4:现值 11 非档 → 就近吸附 12)。
 * 未决登记:小程序端校验失败走 Taro.showToast,没有行内提示块 —— 形态差异,本票不新增元素。
 */
export const LOGIN_POPUP_NOTE_FONT_PX = 12

/**
 * hint/error 行顶距 -6:出处为旧表达式 `marginTop: -ROW_MARGIN(12) + 6`,把提示行拉近上一行;
 * 收进一处只为让组件文件不再留数字字面量。RN 独有。
 */
export const LOGIN_POPUP_NOTE_MARGIN_TOP_PX = -6

/** 保存/登出 footer 行顶距 8:小程序弹窗没有保存/登出块(保存由父页面承载),形态差异(规则6)。 */
export const LOGIN_POPUP_FOOTER_MARGIN_TOP_PX = 8

/** 保存/登出按钮横向间距 10:RN 独有。 */
export const LOGIN_POPUP_FOOTER_GAP_PX = 10
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
