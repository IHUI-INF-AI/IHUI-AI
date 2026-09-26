// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * UserInfoCard 用户信息卡的结构与几何单一源(小程序端与 RN 端共用),形状照 back-chevron-spec。
 *
 * 两端真实实现:apps/miniapp-taro/src/components/UserInfoCard.tsx ↔
 * apps/mobile-rn/src/components/UserInfoCard.tsx(variant='new')。
 * (packages/app/src/components/UserInfoCard.tsx 与 features/cards 下的是 DOM/共享副本,
 *  App 屏幕实际渲染的是 mobile-rn 那份,本表只对这两条腿生效。)
 *
 * 消费方式只能是子路径 `@ihui/shared/ui/user-info-card-spec`(禁挂根桶)。
 * spec 内只存逻辑 px;小程序端换算 `(px) => rpx(px * TARO_RPX_PER_PX)`,RN 端 1:1。
 *
 * 取值裁决规则:1 取 web(卡片内边距 web 端 `p-3` = 12);2 取触控与可读更稳的一档
 * (头像可点 → ≥44,徽章/成长值字号原小程序 10px、RN 11px 均低于 12 下限 → 收口 12,
 *  间距取两端较大者);3 平台机制差异见文件末。圆角与色档不在本表射程(守门 77 / 93 各管一段)。
 */

/** 每端注入的单位换算(一个逻辑 px 到该平台数值);泛型把单位类型带出来。 */
export type GeometryUnit<U extends string | number> = (px: number) => U

/*
 * ── 关于下面每条"取值依据"里出现的类名 ─────────────────────────────
 * 那些反引号类名(`px-3` / `text-xs` / `mt-2` / `gap-3` / `w-12` …)记的是**该档位的等值
 * Tailwind 整档形态与其历史来源**,不等于小程序端今天就是这么写的。现书写形态只有一种例外规则
 * (见 geometry.js「尺寸走 Tailwind 档位」条):**有等值整档就用类名,没有才用 `toUnit()` 内联**。
 * 小程序端当前实际用类名表达的只有四处:进度条 `h-2`(= GROWTH_BAR_HEIGHT 8)、
 * 登录钮 `py-3.5`(= LOGIN_PADDING_Y 14)、操盘手徽章 `px-2` + `py-0.5`(= BADGE 档 8/2);
 * 其余档位一律经本表常量走内联 —— 所以**改本表就是改两端**,不存在"某端还留着一份类名没跟随"。
 * RN 端则全部走常量 / spec 出口,除文件内点名登记的单侧结构档(见文件末差异登记)。
 */

/** 卡片内边距 12:web 端 UserInfoCard 就是 `p-3` = 12,规则 1 取 web;
 *  RN 端新变体原 8、**旧变体另写 16**(同一枚根容器、同一个 `padding` 属性三个数)已收口到 12。 */
export const USER_INFO_CARD_PADDING_PX = 12

/** 头像与信息列间距 12:两端现值已同(小程序 `gap-3` / RN `marginLeft: 12`),收一处防分叉。 */
export const USER_INFO_CARD_HEADER_GAP_PX = 12

/**
 * 头像边长 48:小程序 `w-12` = 48 是 Tailwind 整档且 ≥44 命中块下限;
 * RN 端原 `rpx(163)` ≈ 81.5 是从 Uniapp 旧稿换算来的非整档(注释自认"对齐旧项目"),规则 2 收口到 48。
 * **同一枚头像槽位在 RN 旧变体里还单独写着 64**(width/height 各两处),现一并引用本常量 ——
 * 判据是"同一元素同一属性",不因变体而异;旧变体当前在全仓无调用方,收口它不影响任何在跑画面。
 */
export const USER_INFO_CARD_AVATAR_PX = 48

/** 昵称字号 14:取与小程序/web 一致的正文档(规则 2 可读下限 12 之上,§4 compact);
 *  RN 端新变体原 18、**旧变体另写 16** 收口到 14。 */
export const USER_INFO_CARD_NAME_FONT_PX = 14

/**
 * 小字档 12(角色/等级徽章、成长值标注、操作按钮文字,以及**单侧结构里的小字**:
 * RN 的邀请码「复制」钮文字、旧变体 ID 行):原小程序 10px、RN 11px 均低于 12,规则 2 取可读下限。
 * RN 侧原先有 8 处写死 `fontSize: 12`、2 处写死 `fontSize: 11` —— 11 那一档既不在表里也低于下限,
 * 属"该端没改成引用"(不是另有属性),现一律引用本常量。
 */
export const USER_INFO_CARD_SMALL_FONT_PX = 12

/** 徽章左右内边距 8:取两端较大者(小程序 `px-1.5` = 6 vs RN 8)。
 *  小程序侧此前有**两枚**徽章各写各的档:等级徽章已引本常量,操盘手标识却写 `px-1`(= 4),
 *  同一角色两个数 ⇒ 现换成等值的 Tailwind 整档 `px-2`(= 8)。上下档两端本就同值 2(`py-0.5`)。 */
export const USER_INFO_CARD_BADGE_PADDING_X_PX = 8

/** 徽章上下内边距 2:两端现值已同(`py-0.5` / `paddingVertical: 2`)。 */
export const USER_INFO_CARD_BADGE_PADDING_Y_PX = 2

/** 智汇值字号 12:两端现值已同(小程序 `text-xs` / RN 12)。 */
export const USER_INFO_CARD_TOKEN_FONT_PX = 12

/**
 * 行与上一行的间距 8:取两端较大者(小程序 `mt-2` = 8 vs RN `marginTop: 6` 的等级行,统一 8)。
 * RN 侧原先有 **两处** 写着 6(等级行 `roleRow` 之外的退订按钮 `unsubscribeBtn`),
 * 属同一属性(本行与上一行的间距)漏改,现两处都引用本常量。
 */
export const USER_INFO_CARD_ROW_MARGIN_TOP_PX = 8

/** 操作按钮(开通会员/退订/充值/修改资料)左右内边距 12:取两端较大者(小程序 `px-3` = 12 vs RN 10)。 */
export const USER_INFO_CARD_ACTION_PADDING_X_PX = 12

/** 操作按钮上下内边距 4:两端现值已同(`py-1` / `paddingVertical: 4`);
 *  RN 旧变体的「修改资料」钮此前写着 6,与同一档位的其它钮不同形,现引用本常量。 */
export const USER_INFO_CARD_ACTION_PADDING_Y_PX = 4

/** 未登录态「一键登录」文字 16:取两端较大者(RN 16 vs 小程序 `text-sm` = 14)。 */
export const USER_INFO_CARD_LOGIN_FONT_PX = 16

/**
 * 未登录按钮上下内边距 14:规则 1 无候选 —— web 端 `apps/web/src/components/user/UserInfoCard.tsx`
 * 通篇没有登录按钮(它是 title + `grid` 字段表),故落规则 2「取触控更稳的一档」。
 * 两端原值:小程序 `py-3` = 12 / RN `loginBtn.paddingVertical` = 14(RN 旧变体另写 12,是第三个数)。
 * 现值:小程序侧书写形态 = `py-3.5`(Tailwind 整档,1 档 = 4px ⇒ 14px,见 geometry.js
 * 「尺寸走 Tailwind 档位」条),RN 侧引用本常量。按钮**宽度**仍按文件末平台差异登记不强行对齐。
 */
export const USER_INFO_CARD_LOGIN_PADDING_Y_PX = 14

/**
 * 成长值进度条粗细 8:规则 1 无候选(web 端该组件无进度条),落规则 2「间距/几何取两端较大者」。
 * 两端原值:小程序 `h-2` = 8 / RN `growthBarBg.height` = 4 —— 4 在触屏上几乎不可见,
 * 且 8 已是小程序侧的 Tailwind 整档(`h-2`),不必为对齐去把整档换成内联数字。
 * 现值:小程序侧仍写 `h-2`(= 本档,同一数字的合法类名形态),RN 侧引用本常量。
 */
export const USER_INFO_CARD_GROWTH_BAR_HEIGHT_PX = 8

/** 头像盒子(方档 + overflow hidden 兜底裁切),居中结构只在这一处。 */
export function userInfoCardAvatarStyle<U extends string | number>(
  toUnit: GeometryUnit<U>,
): {
  width: U
  height: U
  overflow: 'hidden'
  display: 'flex'
  alignItems: 'center'
  justifyContent: 'center'
  flexShrink: 0
} {
  const side = toUnit(USER_INFO_CARD_AVATAR_PX)
  return {
    width: side,
    height: side,
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  }
}

/**
 * 本族的平台机制差异登记(数值对齐、通道各端保留;台账 waivers 用):
 *  1. 未登录按钮形态:小程序端全宽条(`w-full py-3.5`),RN 端胶囊 inline(`paddingHorizontal: 32`)
 *     —— 布局机制差异。文字档已同收 16,上下内边距已同收 14(`LOGIN_PADDING_Y`),
 *     **容器宽度与 RN 侧的左右内边距不强行对齐**。
 *  2. VIP 徽标:小程序端是远程图片徽标(`h-4 w-10` = 16×40),RN 端是文字徽章 —— 素材体系差异,
 *     非数值档。同族还有小程序侧的 userIcon(`w-5 h-5`)/ 编辑图标(`w-4 h-4`)/
 *     wirelesslogo(`w-4 h-3`)/ rechargebtn(`w-6 h-5`),RN 端这几处都是文字 affordance,
 *     没有对应的位图槽 ⇒ 这些 12/16/20/24/40 都是**单侧素材档**,不进本表。
 *  3. 等级弹窗 / 邀请码行 / `variant='old'` 旧变体仅 RN 端存在(小程序端由页面自持弹层、
 *     且没有旧变体),单侧结构不进本表。其自有节奏档(弹窗 padding 20、标题 18、关闭钮 24/8/14、
 *     复制钮 8/2、旧变体 initials 28)按本条登记,不得为让守门 128 变绿搬进本表。
 *  4. initials 兜底字形(RN `avatarFallbackText` 新变体 32 / 旧变体 28)小程序端不存在
 *     —— 小程序端无头像 URL 时落的是默认位图头像。**同一角色在 RN 文件内自己就有 28/32 两个数**
 *     是端内一致性缺陷,但它不是"两端分叉"(另一端根本不渲染),按 §3 组件源统一那一票处理,
 *     不在这里凭空立一档。
 *  5. RN 端行级 muted 面板(`tokenRow`/`growthRow`/`inviteRow` 的 `paddingHorizontal: 8` +
 *     `paddingVertical: 6`)与 `nameRow.paddingVertical: 4`:小程序端这些行没有面板容器、
 *     行内也没有额外上下档 ⇒ 是"一端有底、一端无底"的容器差异,不是同一属性取了两值。
 *     另:RN `card.padding` 之外还有 `header.padding: 8`,而小程序 / web 都只有卡片一层 inset
 *     (`p-3` / 本表 `PADDING_PX` = 12)—— 这道**双 inset** 是真实观感分叉(内容比小程序侧多缩 8px),
 *     删它等于改 RN 版面、不属本票授权范围,登记留待组件源统一票裁。
 *  6. 通道差异造成的量纲盲区:小程序侧 `gap-1`(4)/ `gap-2`(8)/ `mb-1`(4)与 RN 侧
 *     `marginLeft: 4` / `marginBottom: 4` 屏幕上同值,但守门 128 只读得见 RN 那一份
 *     (Tailwind 的 `gap-*`/`mb-*` 不在它的类名正则里)⇒ 读到的"仅 RN 档 4"是**测量残留**,
 *     不是分叉。不得为此把 4 搬进本表(搬了屏幕上什么都没变,只是把数字从门眼前挪开)。
 */
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
