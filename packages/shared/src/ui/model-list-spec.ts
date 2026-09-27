// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 模型列表的结构与几何单一源(小程序端与 RN 端共用),模式同 `back-chevron-spec.ts`。
 *
 * 消费方式只能是子路径 `@ihui/shared/ui/model-list-spec`(禁挂根桶,根桶会把整棵 src/chat 拉进被检程序)。
 * 本表只存逻辑 px;小程序侧换算 `(px)=>rpx(px*TARO_RPX_PER_PX)`,RN 侧 1:1(dp)。
 *
 * 两端的行结构整体分叉且数据契约不同(小程序:扁平 models + 单选 + list/popup 双变体,
 * 行盒子在 `pages/index/index.css` 的 `.ai-chu-row`,本票不改该文件;
 * RN:groups + SectionList + 单/多选)。本表收的是**两端确有同一元素**的那些档;
 * 仍未收进来的(逐条附理由,不是"下次再说"):
 *  - **行盒与 logo 块**:小程序行高 40(=80rpx)、logo 块 20×20(=40rpx)、块内首字母 10;
 *    RN logo 块 40×44、块内字形 20 —— 同一档动到哪一端都会改整行高度(小程序行高由 CSS 的
 *    `.ai-chu-row` 定,在本票文件清单外),属设计裁决项而非取值分叉,故不收;
 *  - **行内次要标注**:小程序 popup 的"用途分类"标注 10(20rpx) 对 RN 的"描述"行 12 ——
 *    两端该行装的内容不同(分类标签 vs 描述文本),不构成同一元素;
 *  - **仅一端存在的元素**:小程序 list/popup 变体的骨架屏(4/8/10/12/20/40/80)在 RN 侧没有
 *    对应实现(RN 无 loading prop)。
 *    ~~行尾"免/排名第一"位图徽章(rankone.png / mian_label.png)与 RN 文字徽章(TOP1/NEW 9、
 *    免费/付费 11)~~ **已被 2026-09-27 收口票取代**:按"择优=矢量优先"(AGENTS §4 徽章/状态
 *    指示属 UI 图标位,禁位图;用户已两次打回"一端 CDN 位图当图标"),小程序三处位图槽
 *    (Agent 行、排名第一、行尾"免")全部换成与 RN 同形的**文字徽章**,几何经下方
 *    `MODEL_LIST_BADGE_*` / `MODEL_LIST_PRICE_BADGE_*` 档两端同吃 —— 9/11 及徽章内衬不再单侧。
 *    ~~RN 的 `ItemSeparatorComponent`(高 1、缩进 68)~~ **同样已被取代,但不是"收档"而是撤除**:
 *    它命中 AGENTS §4「禁止分割线」的禁止清单(列表项之间画一条线),2026-09-27 随本票删除,
 *    分隔改用行自带 paddingVertical 的间距 + 选中态背景对比(§4 允许的两条出路);1/68 不再是
 *    任何一端的档。RN 的 `letterSpacing` 0.5(西文大写 tracking,非布局档)、描述行距 2
 *    (该行本端独有,小程序同行装"用途分类"标签,不构成同一元素)与 iconWrap 块高 44(行盒裁决项)
 *    仍是单侧,按守门 128 的口径走台账,不是"再收一档"就能消掉的。
 *  - **2026-09-27 O81 逐档判定(读数「仅小程序档 4/10/80 | 仅 RN 档 1/2/9/11/44/68」的落点账,
 *    行号为该次 HEAD 面实测)**:
 *    4 = 小程序 list 变体两处:外层容器 `py-1`(上面 MODEL_LIST_CONTENT_BOTTOM_PADDING_PX 注里
 *    已登记「另计一票」的布局裁决项,本票不动)与折叠区分组头行 `pb-1` —— 后者判为**同元素不同档**
 *    (RN sectionHeader paddingVertical 8,且与本行自身 pt-2 也分叉),已收敛为 `pb-2`(间距取较大);
 *    故 4 在集合读数中仍由前者供给,这是量纲(集差)判据的如实上限,不是漏改。
 *    10 = popup 变体的块内首字母(`fontSize: rpx(20)` 两处)与普通行用途分类标注(`rpx(20)` 两处)
 *    —— 前者属上面行盒/logo 块裁决项,后者 RN 该行渲染的是 description、不渲染分类标注;
 *    80 = popup 骨架条宽(`width: rpx(160)`)—— RN 端无 loading prop、无骨架屏实现,RN 腿不渲染;
 *    ~~1 = RN 文字徽章容器 `paddingVertical: 1`(rank/new)与 separator `height: 1`(单侧机制元素)~~
 *    → 2026-09-27 收口票:徽章内衬改经 `MODEL_LIST_BADGE_PADDING_Y_PX` 两端同吃;separator 的 1 随
 *    「禁止分割线」撤除消失;
 *    2 = RN description `marginTop: 2`(单侧行,上面已登记)—— ~~徽章 paddingVertical: 2~~ 现经
 *    `MODEL_LIST_PRICE_BADGE_PADDING_Y_PX` 两端同吃(该值随之不再单侧);
 *    ~~9 / 11 = RN 文字徽章字号(同一位在小程序是位图,媒介差异)~~ → 2026-09-27 收口票:
 *    小程序位图徽章已换与 RN 同形的文字徽章,9/11 经本表两档两端同吃;
 *    44 = RN iconWrap 块高(行盒裁决项);~~68 = RN separator 缩进~~ 随分割线撤除消失。
 *    除 `pb-1`→`pb-2` 外,其余全部为「另一腿不渲染该元素」或已登记裁决项 —— 按票规不造元素、
 *    不删档凑数、不给单端补裸数字。
 */

/**
 * 空态「暂无模型」文字字号(逻辑 px)。
 * 取值依据:收编前小程序 popup 变体(`text-[length:24rpx]` = 12px,与 RN 弹出选择器同角色)
 * 与 RN `emptyText.fontSize = 12` 同值,等于 Tailwind text-xs 档;
 * list 变体此前写 `text-sm`(14px) —— 同一组件的两枚空态不该有两种字号,而 12 是两端已同的那一档
 * (规则 2 取紧凑档),现两变体一律经本常数,端内不再各留一份。
 */
export const MODEL_LIST_EMPTY_FONT_PX = 12

/**
 * 模型名称字号(逻辑 px)。
 * 取值依据:规则 2「同含义不同值取 compact 较小档」—— 小程序 popup 主行 14(28rpx)、
 * 折叠行 13(26rpx) vs RN `name.fontSize = 16` → 取 14;14 命中 design-tokens 既有档
 * (text-sm),满足规则 4「字号必须落既有档」;折叠行的 13 属非档值,就近吸附到与本常数同档
 * (13 与 14 只差 1px,而折叠行与主行是同一元素、只靠背景与选中态区分,再留一档无设计意图)。
 */
export const MODEL_LIST_NAME_FONT_PX = 14

/**
 * 分组头 / 折叠区标题字号(逻辑 px)。
 * 取值依据:端内现值三处 11(22rpx)/ 12(24rpx)/ 13(26rpx) 与 RN 12 —— RN 已是 12,
 * 规则 4 要求字号落 design-tokens 既有档(11 与 13 皆非档,就近吸附到 12),
 * 于是"现值已同,收进一处只为不再分叉"。
 * 注:本档收口后守门 128 会新报一枚"仅 RN 档 11" —— 那是 RN 独有的「免费/付费」文字徽章
 * (小程序侧同一位是位图徽章),属媒介差异,不是本常数漏收。
 */
export const MODEL_LIST_SECTION_HEADER_FONT_PX = 12

/**
 * 空态容器纵向留白(逻辑 px)。
 * 取值依据:小程序 popup `padding: 40rpx 0` = 20 vs RN `empty.paddingVertical = 48`
 * → 规则 2 取紧凑档 20(空态盒上下无贴边/裁切风险,不触发"取小会裁切才取大"的例外)。
 * 覆盖面(2026-09-26 补齐):本档此前只落到小程序 **popup** 变体与 RN `empty`,而同一组件的
 * **list** 变体空态仍写 `py-12`(= 48,正是当初从 RN 摘掉的那个值)⇒ 两枚空态两种留白,
 * 且 list 变体与 RN 不同值。现 list 变体同样经本档取数,三处落点(popup / list / RN)同值 20。
 */
export const MODEL_LIST_EMPTY_PADDING_Y_PX = 20

/**
 * 列表内容底部留白(逻辑 px)。
 * 取值依据:此前 RN `listBody.paddingBottom = 24` 是端内独有一档、小程序列表容器底部无留白。
 * 规则 3「一端有档另一端无 → 取较大者并让缺失端补同档」(措辞与做法同 `loading-spec` 的
 * `LOADING_INLINE_PADDING_X_PX`)→ 定 24,两端的列表容器同取,不再一端有档一端没有。
 * 覆盖面如实登记(2026-09-26 复核):该"补齐"落在小程序 **popup** 变体容器与 RN `listBody`;
 * 小程序 **list** 变体的外层容器内衬仍是类名刻度 `px-3 py-1`(= 12 / 4),没有这一档 ——
 * 它不是跨端第二份真相(两端同锚),而是**同一端的两个变体**留白不齐,且给 inline paddingBottom
 * 会与类名 `py-1` 争同一属性(后者同时设顶与底)。要不要让 list 变体也吃 24 属布局裁决,另计一票,
 * 不在本档射程(照 AGENTS §4 浮动弹层档位表:内容面板 p-3=12 / 菜单列表 p-1=4,两档都已在上)。
 */
export const MODEL_LIST_CONTENT_BOTTOM_PADDING_PX = 24

/**
 * Agent 模式行 logo 位的字形墨迹档(逻辑 px)。
 * 取值依据(O81 票⑤续,2026-09-26):该槽位小程序端此前用 CDN 位图 mian_label.png 当 UI 图标,
 * 矢量化为 `<LineIcon name="bot">` 后取 RN `AgentModeRow` 同一槽 `<Bot size={20}>` 的现值 ——
 * **非单侧档**(两端同有 Agent 行,两端墨迹自本档起同值)。行盒本身
 * (小程序 20×20 vs RN iconWrap 40×44)仍是文件头登记的裁决项,不因本档改变。
 * 消费面补齐(2026-09-26 复核):本档立项时声明"两端墨迹自本档起同值",但 RN 端仍写裸数字
 * `<Bot size={20}>` 未引用本档 ⇒ 那一格是**第二份真相**(改本档 RN 不跟随)。现 RN 端已改为
 * 引用本档,两端墨迹真正由同一个数字决定。普通模型行的 `<item.icon size={20}>` 与 `iconEmoji`
 * 的 20 **不**并入本档(它与 40×44 logo 块同属上面那句裁决项)。
 * 小程序消费方式:`size={MODEL_LIST_AGENT_GLYPH_PX * TARO_RPX_PER_PX}`(LineIcon number 量纲 rpx)。
 */
export const MODEL_LIST_AGENT_GLYPH_PX = 20

/**
 * 选中态圆点徽标内的字形墨迹档(逻辑 px)。
 * 取值依据(O81 票⑤续,2026-09-26):该槽位小程序端此前用 CDN 位图 selected_model.png,
 * 矢量化为 `<LineIcon name="check">` 后取 RN `Check()` 组件 `<CheckIcon size={12}>` 的现值 ——
 * **非单侧档**。前景取 AGENTS §4 品牌实底成对档(底 `--color-cta` / 字形 `--color-cta-foreground`,
 * 与 RN `brand.cta` + `brand.ctaForeground` 同形);外盒尺寸与圆角(小程序 16px vs RN 20px 正圆)
 * 仍是文件头登记的行盒分叉,不在本档射程。
 * 消费面补齐(2026-09-26 复核):同上 —— RN 端此前写裸数字 `<CheckIcon size={12}>`,现引用本档。
 */
export const MODEL_LIST_CHECK_GLYPH_PX = 12

/**
 * 「排名第一 / NEW」文字徽章容器内衬(横向 5 / 纵向 1,逻辑 px)与左间距 6、字号 9。
 * 取值依据(2026-09-27 收口票):四档此前全部住在 RN `styles.rankBadge/newBadge*` 里当端内数,
 * 同一位在小程序是 CDN 位图(rankone.png / mian_label.png)—— 按"择优=矢量优先 + 徽章属 UI
 * 图标位禁位图"(AGENTS §4),小程序换与 RN 同形的文字徽章后,这四处**两端确有同一元素**,
 * 于是从端内摘进本表(值 = RN 现值,两端零观感变化;小程序侧只做单位换算)。
 * 底色/文字色不经本表(配色归 tokens 派生链,守门 93):RN 落 `#F5B301`+surface.light(复刻 rankone
 * 用,头注有出处),小程序落 `--color-warning`/`--color-warning-foreground`(同一"实底金/琥珀 +
 * 近白字"语义走各自端的 token 链)。圆角同理留端内(两端同取 `rnRadius.xs`,守门 77 管档)。
 */
export const MODEL_LIST_BADGE_PADDING_X_PX = 5
export const MODEL_LIST_BADGE_PADDING_Y_PX = 1
export const MODEL_LIST_BADGE_MARGIN_LEFT_PX = 6
export const MODEL_LIST_BADGE_FONT_PX = 9

/**
 * 「免费 / 付费」文字徽章容器内衬(横向 8 / 纵向 2)与字号 11。
 * 取值依据与上组同:RN `freeBadge/paidBadge*` 现值,小程序"免"位图槽换成同形文字徽章后
 * 两端同吃(徽章间距复用 `MODEL_LIST_BADGE_MARGIN_LEFT_PX`)。配色留端内:RN 走
 * success.lighter/DEFAULT 与 warning.amberLight/amberText,小程序走
 * `--color-success-lighter`/`--color-success`(同语义两档,守门 93 问责);圆角两端同取 `rnRadius.sm`。
 */
export const MODEL_LIST_PRICE_BADGE_PADDING_X_PX = 8
export const MODEL_LIST_PRICE_BADGE_PADDING_Y_PX = 2
export const MODEL_LIST_PRICE_BADGE_FONT_PX = 11
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
