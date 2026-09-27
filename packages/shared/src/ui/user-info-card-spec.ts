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
 * Tailwind 整档形态与其历史来源**,不等于小程序端今天就是这么写的。
 * 小程序端当前用类名表达的只剩徽章一族 `px-2` + `py-0.5`(= BADGE 档 8/2);其余档位一律经本表
 * 常量走内联 —— 所以**改本表就是改两端**,不存在"某端还留着一份类名没跟随"。
 * RN 端则全部走常量 / spec 出口,除文件内点名登记的单侧结构档(见文件末差异登记)。
 *
 * ⚠️ 为什么此前"有等值整档就用类名"这一条例外在 `py-3.5`(登录钮上下 14)/ `h-2`(进度条 8)上
 * 被收回:守门 128 的 SL 维判的是**档名有没有在两条腿的源码面上各出现一次**,类名形态读不出来,
 * 于是这两档长期被记成"仅 RN 引用"= "另一端没接线"。把它们改成 `toUnit(CONST)` 内联,渲染字节
 * 不变(14 逻辑 px 在本端本来就是 `rpx(28)`),但数字从此只住在表里一处 —— 这是收紧,不是凑平。
 * 反过来,**不得**为了消 SL 给不渲染该元素的那条腿补一个档名引用:那才是把数字从门眼前挪开。
 */

/** 卡片内边距 12:web 端 UserInfoCard 就是 `p-3` = 12,规则 1 取 web;
 *  RN 端新变体原 8、**旧变体另写 16**(同一枚根容器、同一个 `padding` 属性三个数)已收口到 12。 */
export const USER_INFO_CARD_PADDING_PX = 12

/** 头像与信息列间距 12:两端现值已同(小程序 `gap-3` / RN `marginLeft: 12`),收一处防分叉。 */
export const USER_INFO_CARD_HEADER_GAP_PX = 12

/**
 * 头像边长 48:小程序 48 是 Tailwind 整档(`w-12`)且 ≥44 命中块下限;
 * RN 端原 `rpx(163)` ≈ 81.5 是从 Uniapp 旧稿换算来的非整档(注释自认"对齐旧项目"),规则 2 收口到 48。
 * **同一枚头像槽位在 RN 已删除的旧变体里曾单独写着 64**(width/height 各两处)—— 那份死件已于
 * 2026-09-27 随 `variant='old'` 一并摘除(零调用方),本端这一角色现在只剩本表一个数。
 * 现书写形态:两端都把它显式喂进 `userInfoCardAvatarStyle(toUnit, USER_INFO_CARD_AVATAR_PX)`
 * (小程序端此前只调函数、不喂档名 ⇒ 48 在它的读面上不存在,门读到的是"仅 RN 档 48")。
 */
export const USER_INFO_CARD_AVATAR_PX = 48

/** 昵称字号 14:取与小程序/web 一致的正文档(规则 2 可读下限 12 之上,§4 compact);
 *  RN 端新变体原 18、**旧变体另写 16** 收口到 14。 */
export const USER_INFO_CARD_NAME_FONT_PX = 14

/**
 * 小字档 12(角色/等级徽章、成长值标注、操作按钮文字,以及**单侧结构里的小字**:
 * RN 的邀请码「复制」钮文字):原小程序 10px、RN 11px 均低于 12,规则 2 取可读下限。
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
 * 现值:小程序侧经本常量走内联 `paddingTop/paddingBottom: toUnit(USER_INFO_CARD_LOGIN_PADDING_Y_PX)`
 * (此前写 `py-3.5` —— 同一数字的类名形态,守门 128 的档名判据读不到,于是本档长期被记成
 * "仅小程序没接线";改内联不改变渲染字节,14 逻辑 px 在本端就是 `rpx(28)`),RN 侧引用本常量。
 * 按钮**宽度**仍按文件末平台差异登记不强行对齐。
 */
export const USER_INFO_CARD_LOGIN_PADDING_Y_PX = 14

/**
 * 成长值进度条粗细 8:规则 1 无候选(web 端该组件无进度条),落规则 2「间距/几何取两端较大者」。
 * 两端原值:小程序 `h-2` = 8 / RN `growthBarBg.height` = 4 —— 4 在触屏上几乎不可见,
 * 且 8 已是小程序侧的 Tailwind 整档(`h-2`),不必为对齐去把整档换成内联数字。
 * 现书写形态:小程序侧改为本常量走内联 `height: toUnit(USER_INFO_CARD_GROWTH_BAR_HEIGHT_PX)`
 * (8 逻辑 px 在本端即 `rpx(16)`,与原 `h-2` 同一渲染字节)。此前留类名形态时,守门 128 的档名
 * 判据在小程序侧读不到这一档 ⇒ 被记成"仅 RN 引用";RN 侧引用本常量。
 */
export const USER_INFO_CARD_GROWTH_BAR_HEIGHT_PX = 8

/**
 * 头像盒子(方档 + overflow hidden 兜底裁切),居中结构只在这一处。
 *
 * **边长由调用方显式喂 `USER_INFO_CARD_AVATAR_PX`,本函数不设默认值**:默认值会把这一档从两条腿的
 * 源码面上一起抹掉,守门 128 的具名档判据(读的是文件里出现的档名)就把它当成"另一端没接线"——
 * 小程序端此前只调本函数,于是 48 在它的读面上不存在,读出的"仅 RN 档 48"就是这么来的。
 * 数字仍然只有一份真相(常量在本表),调用方引用的是同一个名字,不是第二个数。
 */
export function userInfoCardAvatarStyle<U extends string | number>(
  toUnit: GeometryUnit<U>,
  sidePx: number,
): {
  width: U
  height: U
  overflow: 'hidden'
  display: 'flex'
  alignItems: 'center'
  justifyContent: 'center'
  flexShrink: 0
} {
  const side = toUnit(sidePx)
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
 *  2. 图标载体(2026-09-27 按「端图标择优 = 矢量优先」收口,不再是"素材体系差异"这一档):
 *     小程序侧原有 6 处 CDN/本地位图槽,现 **4 处已换载体** —— userIcon(`w-5 h-5` 人形线图)→
 *     `LineIcon name="user"`、编辑图标(`w-4 h-4` 铅笔线图)→ `LineIcon name="pencil"`、
 *     rechargebtn(`w-6 h-5`,把「充值智汇值」烘进金色渐变图里)→ 文字按钮(取本表 ACTION/SMALL 档,
 *     与 RN `rechargeBtn` 同形)、VIP 徽标(`h-4 w-10` = 16×40 位图)→ 文字徽章(取本表 BADGE/SMALL 档,
 *     与 RN `roleBadge` 同形)。**这一换同时消掉守门 128 几何维的"仅小程序档 40"** —— 40 就是那枚
 *     位图徽标的固定宽,它从来不是布局档,而是素材尺寸混进了几何账。
 *     **保留位图的 2 处**各带行内 `icon-bitmap-exempt` 理由:默认头像(多色 3D 吉祥物插画,非线形
 *     图标)、智汇值行首的品牌标识(须官方真实图标,自造矢量近似属品牌失真)。
 *     行内 `w-4 h-3`(16/12)随保留的品牌标识留在原处,仍是单侧素材档,不进本表。
 *  3. 等级弹窗 / 邀请码行仅 RN 端存在(小程序端由页面自持弹层、且没有邀请码行),单侧结构不进本表。
 *     其自有节奏档(弹窗 padding 20、标题 18、关闭钮 24/8/14、复制钮 8/2)按本条登记,
 *     不得为让守门 128 变绿搬进本表。⚠️ 其中 **24 自 2026-09-27 起在门账上成为"仅 RN 档"**:
 *     此前小程序端一枚 24×20 位图充值按钮的数字与它恰好等值,被算成"两端同档";位图换成文字按钮后
 *     这一格显形为它本来的定性(RN 单侧弹窗档),屏幕上什么都没变 —— 不得为此把 24 塞回小程序端。
 *     另:随 `variant='old'` 死变体一起删除的还有一行 `ID:<uuid>` 展示,它在新变体里**无处可去**
 *     (搬进 live 版面属 §24 须用户确认的新增),已在此点名留给下一票决定去留。
 *  4. initials 兜底字形(RN `avatarFallbackText` 32)小程序端不存在 —— 小程序端无头像 URL 时落的是
 *     默认位图头像(第 2 条保留的那张多色吉祥物)。**此前 RN 文件内同一角色还写着 28**(在已删除的
 *     旧变体里),那是一份端内一致性缺陷;随死变体一并消失,现在这一角色本端只有一个数。
 *     它不是"两端分叉"(另一端根本不渲染 initials),故仍不进本表。
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
