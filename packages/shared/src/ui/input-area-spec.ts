// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 跨端输入区几何档:值取"两端现档 + 裁决规则",两端组件文件不再各自抄数字。
//
// 刻意只收两端已同值/按规则可定档的一档。ai-home 三层结构(小程序复刻原 InputArea.vue)
// 与 RN 卡片式布局是**变体契约分叉**,其差异档(输入字号 18 vs 14、发送钮 25 vs 40/44、
// 附件缩略图 106.5×60 vs 72×72、emoji 面板小程序独有)未收进来 —— 清单见交付报告待裁决。
// ⚠️ 上面那句"未收进来"是 2026-09-25 票③ 的口径;票④(下一段)已把其中可机器判定的一批
// 收进本表(缩略图盒、发送钮盒、emoji 面板、输入上下限等)。仍待裁决的只剩**输入字号 18 vs 14**
// 一枚 —— 它牵住两端各自的共享档(18 同时是 RN 框外发送钮字形与删除角标盒),见下面清单。
//
// 票④(2026-09-26)收编上面那句"未收进来"里可以机器判定的一批:每条都标了
// 【A 两端同值】(两端屏幕上这一档同值:两端都读同一枚常数,或另一端同值落在 CSS/类臂并已注记)
// 或【B 单端档·X】(**只有一端有这一处元素/留白:机制、素材或变体差异,非取值分叉**,
// 措辞与 `intelligent-assistant-spec` 的 IA_ROBOT_DECOR_* / IA_TEXT_INDENT_PX 同形)。
// 裁决口径:票④ 起按 AGENTS §4 compact **取两端较小档**,只有取小会贴边/裁切才取较大并写明;
// 上面 2026-09-25 那批常数(如 INPUT_AREA_VOICE_BTN_GAP_PX)是在"间距取较大者"的旧口径下定档的,
// 两种口径同存于本文件是事实,不得按其中一条去"顺手统一"另一条 —— 那会把已同值的档重新拆开。
//
// 另有六处**刻意不入表**的数字,分两类。第一类的原因相同:该档两端**当前共享且另一端确有出处**;
// 收编单侧会把共用档翻成"仅另一端档",守门 128 台账不减反增(23→24 那一型),端内已就地留注:
//  1) 小程序 `bottom: rpx(112)`(56 与 RN 折叠 FAB 的 56 同档);
//  2) 小程序表情格字级 `rpx(32)`(16 与 RN 图标墨迹同档);
//  3) 小程序 ai-home 输入字号 `rpx(36)` / 行高 `rpx(40)`(18、20 两档 RN 各有多处出处;
//     18 vs 14 的字号分叉本身属变体契约,待裁决,不是本表能单方面定档的);
//  4) 小程序语音钮盒高 `rpx(44)`(22 与 RN 框内放大钮盒同档);
//  5) RN `micInShell.width: 36`(36 与小程序 `w-9` 步同档,且它本身就是 `rnGeometry.tapBox`)。
// 第二类只有一处,原因不同:
//  6) 小程序 default 变体表情面板 `className="h-48"`(折 192)。它是 Tailwind **间距步**而不是
//     端内抄的数字,而 `packages/design-tokens/src/geometry.js` 头注规定"CSS/类名侧尺寸走
//     Tailwind 档位,禁写 px/rpx 字面量" —— 把它换成 `style={{ height: toUnit(192) }}` 读数会
//     变好看,但违反那条口径,故保留类名。这是本族唯一剩余的差异档,登记而非遮掉。

/** 每端注入的单位换算(一个逻辑 px 到该平台数值);泛型把单位类型带出来。 */
export type GeometryUnit<U extends string | number> = (px: number) => U

/**
 * 放大按钮顶端内缩 6:小程序 `top: rpx(12)` = 6 / RN 放大钮 `top: 6`。两端现值已同,
 * 收一处防分叉。上一轮只搬小程序侧这一处时,RN 的命中外扩/计数浮层仍写裸 6,
 * 巧合的"两端同值"被拆成"仅 RN 档",守门 128 台账 23→24 —— 所以本档必须与下面两枚
 * 同枚提交、两端同时改指本文件,6 才会在两侧文件同时归零。
 */
export const INPUT_AREA_FANGDA_TOP_PX = 6

/**
 * 控制按钮命中外扩 6(RN hitSlop 机制,小程序无对应属性):数值与放大钮内缩同族
 * (都是"贴边控件向外让 6"),收进本表让该档只有一份真相。机制通道各端保留。
 */
export const INPUT_AREA_CONTROL_HIT_SLOP_PX = 6

/**
 * 计数浮层距底 6(RN 端,小程序端不渲染计数器 —— 契约分叉见头注):与上面两枚同源,
 * 收进来是为了两侧文件同时不再出现裸 6(见 INPUT_AREA_FANGDA_TOP_PX 注)。
 */
export const INPUT_AREA_COUNTER_BOTTOM_PX = 6

/**
 * 语音切换按钮与输入框的间距:小程序 `marginRight: rpx(20)` = 10 / RN `marginRight: 6`。
 * 裁决规则 2(间距取两端较大者)→ 10。RN 侧那一枚 6 必须同枚提交改指本档:留着裸 6
 * 而小程序侧的 6 已进 spec,6 就成了"仅 RN 档"(台账 23→24 的成因,机制同
 * INPUT_AREA_FANGDA_TOP_PX 注)。
 */
export const INPUT_AREA_VOICE_BTN_GAP_PX = 10

/**
 * 参数变量输入行竖向内边距 6(RN 独有「参数变量区」;小程序端该功能走 Selecter,无对应行)。
 * 刻意入表:6 这一族若只搬走部分,RN 文件残留的一枚就会从"两端同值"变成"仅 RN 档"
 * (台账 23→24 的机制),分叉不是被修掉而是被挪出来 —— 全部同族 6 进同一份源才归零。
 */
export const INPUT_AREA_PARAM_FIELD_PADDING_V_PX = 6

/**
 * 输入行顶部内边距 10:RN `input/inputBare paddingTop: 10`;小程序端对应值在 CSS 类臂
 * (`textareaPadding` 字符串)不具名。与 INPUT_AREA_VOICE_BTN_GAP_PX 同枚入表:两侧文件里
 * 若一侧留裸 10 一侧进 spec,10 就从"两端同值"翻成"仅 RN 档"(与 6 那族同型的账)。
 */
export const INPUT_AREA_INPUT_PADDING_TOP_PX = 10

/** 附件文件名跑马字级 10:RN 现值;小程序端同名条字级在 CSS 类臂,不具名。 */
export const INPUT_AREA_DOC_NAME_FONT_PX = 10

/** 附件删除角标内 X 墨迹 10:RN 现值;小程序端删除件走端内图片资产,无墨迹数字。 */
export const INPUT_AREA_ATTACHMENT_CLOSE_GLYPH_PX = 10

/* ───────────────────── 票④(2026-09-26):剩余两端各写的可见几何档 ───────────────────── */

/**
 * 【A 两端同值】缩略图底部"文件名条"高度 16:小程序 `height: rpx(32)` = 16 / RN
 * `docMarquee.height: 16`。现值已同,收进一处只为不再分叉(同一枚压字条,两端各抄一次)。
 */
export const INPUT_AREA_DOC_NAME_STRIP_PX = 16

/**
 * 【B 单端档·RN】输入框正文字号 14:RN `input` / `inputBare` 的 `fontSize`。
 * 依据:字号只能落 design-tokens 既有档(12/14/18/24),14 是 RN 现值且就是 web 的 `text-sm`。
 * 小程序 ai-home 的正文字号是 18(`rpx(36)`)—— 变体契约分叉(首页大输入框),本档刻意不把 18
 * 拉到 14(18 这一档两端共享:RN 框外发送钮字形/删除角标盒也是 18,拆开小程序侧会把 18
 * 变成"仅 RN 档",见头注"刻意不入表"清单同一机制)。
 */
export const INPUT_AREA_INPUT_FONT_PX = 14

/**
 * 【A 两端同值·裁决】容器横向留白 10:RN `container.paddingHorizontal: 12` vs 小程序
 * `.input-area` 的 `padding: '10rpx 20rpx 20rpx'`(左右 20rpx = 10px)。
 * compact 取两端较小档 → 10;纵向不同形见 INPUT_AREA_CONTAINER_PADDING_V_PX。
 */
export const INPUT_AREA_CONTAINER_PADDING_X_PX = 10

/**
 * 【B 单端档·RN】容器纵向留白 8。机制差异,非取值分叉:小程序同一处是
 * `padding: '10rpx 20rpx 20rpx'` + CSS 里 `calc(20rpx + env(safe-area-inset-bottom))`
 * (底部留白随安全区动态决定,不是一个可补的固定档),RN 侧安全区由 `useSafeAreaInsets` 在
 * 容器外补偿。上留白两端本来就不是同一个量,强行同值等于把小程序的键盘避让算进静态档。
 */
export const INPUT_AREA_CONTAINER_PADDING_V_PX = 8

/**
 * 【B 单端档·RN】输入框内左右留白 12。机制差异,非取值分叉:小程序同一处走
 * `textareaPadding` 字符串(`12rpx 134rpx 12rpx 44rpx` / `12rpx 38rpx 82rpx 0`,按是否放大、
 * 是否长文三种形态切换),不具名也无单一档 —— 与 INPUT_AREA_INPUT_PADDING_TOP_PX 同一情况。
 */
export const INPUT_AREA_INPUT_PADDING_X_PX = 12

/**
 * 【B 单端档·RN】紧凑间距步 8(堆叠留白单一档):缩略图行的 gap / 上下留白、参数行的
 * gap / 顶留白、转写行 gap、参数输入行内边距、框外发送钮左边距。
 * 小程序这些位置分别是 20rpx(=10)、10rpx(=5)与原项目 CSS 里的定值,且**没有对应元素**
 * (小程序无缩略图行 gap 的同物:附件条用 `imgs-list` 类臂)—— 属"一端有档、另一端不具名",
 * 按旧口径本可取较大者,但两端元素不是一对一,补过去就是在没有元素的地方造留白。故登记为单端档。
 */
export const INPUT_AREA_STACK_GAP_PX = 8

/**
 * 【B 单端档·RN】浮层控件右内缩 8(计数浮层 / 放大钮 / 折叠态关闭钮)。
 * 机制差异,非取值分叉:这三处都是 absolute 浮在输入盒内的 RN 控件;小程序端计数浮层与
 * 关闭钮都不渲染(计数器与折叠 FAB 是 RN 变体),放大钮固定贴 `right: 0`(原项目档,见
 * INPUT_AREA_AI_HOME_* 那一组)。
 */
export const INPUT_AREA_CONTROL_RIGHT_PX = 8

/**
 * 【B 单端档·RN·裁决】次要文字字号 12(语音区提示/录音时长/参数标题/参数输入),同时是
 * 计数浮层字号:RN 收编前写 11 —— **11 不在 design-tokens 字号档上**,按裁决规则 4
 * 就近吸附到 12。小程序端这些文字在 CSS 类臂,不具名。
 */
export const INPUT_AREA_SECONDARY_FONT_PX = 12

/**
 * 【B 单端档·RN】大图标墨迹 26(折叠态 FAB 里的加号)。
 * 变体差异,非取值分叉:collapsible FAB 只有 RN 侧实现(小程序首页用的是原项目常驻输入条),
 * 没有可对齐的另一端。同一常数也被未被任何渲染点引用的遗留样式 `docIcon` 取用 ——
 * 那一条属遗留清理项(另计一票),本票不删,只把裸数字挪出端内。
 */
export const INPUT_AREA_GLYPH_LG_PX = 26

/**
 * 【B 单端档·RN·裁决】缩略图行图标墨迹 24:RN 文档缩略图里的 `FileText` 收编前是 26,
 * 而**同一行**的图片/视频占位图标已经是 24(`Film` / `ImageIcon`)。取同行已有的档(compact
 * 较小且是端内既存的第 2 大墨迹档),否则两种缩略图并排时墨迹不齐 —— 这跟"两端各写一份"
 * 是同一型缺陷,只是发生在同一端内部。
 */
export const INPUT_AREA_THUMB_GLYPH_PX = 24

/**
 * 【B 单端档·RN】控件字形 14(放大/缩小 ⤢ 字符):RN 收编前写 15。
 * 依据:裁决规则 4 —— 字号只能落既有档(12/14/18/24),15 不在档上,就近取较小档 14。
 * 另一端(小程序)这一位置是 PNG 素材、无字号数字,故不构成把某端拉偏。
 */
export const INPUT_AREA_CONTROL_GLYPH_PX = 14

/**
 * 【B 单端档·RN】语音/键盘切换钮盒宽 32。
 * 变体契约分叉,非取值分叉:小程序同一处是原项目 `.search-box1` 的 50×44rpx(=25×22),
 * 其所在行高由端内 CSS 的 80rpx 定,把命中盒扩到 RN 这一档会撑破那一行(不是"取小会贴边"
 * 的例外,而是"取大会破版")。两枚档各记各的,不互相靠拢。
 */
export const INPUT_AREA_VOICE_BTN_WIDTH_PX = 32

/**
 * 【B 单端档·RN】输入行最小高 48:输入框 `minHeight`、语音区 `minHeight`、语音钮盒 `height`
 * 三处同档(它们同排,上缘要对齐,分两档就会看到一根错位 1px 的缝)。
 * 小程序 ai-home 对应位置是 44rpx(=22)一行高的紧凑条,且 22 这一档两端共享,故不同形。
 */
export const INPUT_AREA_INPUT_MIN_HEIGHT_PX = 48

/**
 * 【B 单端档·RN】语音波形条:整条容器高 32、单条基线高 8(端内按 `8 + (i % 6) * 4` 排齿)。
 * 机制差异,非取值分叉:小程序端语音条是 `.voice-bar-animation` + line1~line30 的 CSS 关键帧,
 * 每根线的高度写死在类里(30 条各一档),没有可与 dp 对齐的单一数字。
 */
export const INPUT_AREA_VOICE_BARS_HEIGHT_PX = 32
export const INPUT_AREA_VOICE_BAR_BASE_PX = 8

/**
 * 【B 单端档·RN】删除角标的命中外扩 8(RN hitSlop 通道,小程序无对应属性)。
 * 与 INPUT_AREA_CONTROL_HIT_SLOP_PX(6)是两处不同的贴位控件:那枚贴容器边、本枚贴在
 * 缩略图角上且可见盒只有 18,故外扩档不同 —— 数值不同形但都收进同一份源。
 */
export const INPUT_AREA_CLOSE_HIT_SLOP_PX = 8

/**
 * 【B 单端档·RN】参数变量输入行最小高 32(输入框与"添加参数图片"虚线框同档 —— 两者并排,
 * 一高一矮就会露出错位,所以同一枚档)。
 * 单端落地的原因写在 INPUT_AREA_PARAM_FIELD_PADDING_V_PX:小程序端参数变量走 Selecter 弹层,
 * 根本没有这一行。
 */
export const INPUT_AREA_PARAM_FIELD_MIN_HEIGHT_PX = 32

/**
 * 【B 单端档·RN】大输入框(showVoiceMic)内的发送钮/麦克风高 40。
 * 变体差异,非取值分叉:小程序端这一位置是原项目 `sand_msg.png` 的 50rpx(=25)图标盒,
 * 见 INPUT_AREA_AI_HOME_ICON_BOX_PX;两端都在框内右侧,但一者是实底圆角钮、一者是裸图标。
 */
export const INPUT_AREA_IN_SHELL_BTN_PX = 40

/**
 * 【B 单端档·RN】大输入框内放大钮的右侧偏移。收编前端内写 52,它的构成就是
 * 「发送钮盒 40 + 其左间距 4 + 让位一档 8」;写成派生式(而不是第四枚裸数字)之后,
 * 上面钮盒或间距一动,这一档跟着动,不会留下"改了钮忘了改让位"的那半格。
 * 若将来观感要调,调的是那两枚入参,不是在这里补常数。
 */
export const INPUT_AREA_IN_SHELL_EXPAND_RIGHT_PX =
  INPUT_AREA_IN_SHELL_BTN_PX + 4 + INPUT_AREA_STACK_GAP_PX

/**
 * 【B 单端档·RN】附件缩略图盒 72×72(方形,图片/视频/文档同盒)。
 * 媒介差异,非取值分叉:小程序端图片走 `imgs-list-item-img`(CSS `mode="heightFix"`,高度由
 * 类定、宽度随素材),视频走 16:9 内容盒(见 INPUT_AREA_VIDEO_THUMB_*),两端不是同一个盒子。
 */
export const INPUT_AREA_THUMB_PX = 72

/**
 * 【B 单端档·RN】输入框自动撑高上限 120 / 最小高 48。
 * 与小程序 ai-home 的 250(INPUT_AREA_AI_HOME_INPUT_MAX_HEIGHT_PX)是**变体契约分叉**:
 * RN 卡片态超过 120 就内部滚动、放大钮切到无上限;小程序 ai-home 是可从 80rpx 逐层放大到
 * 全屏的大输入框,500rpx 是复刻原项目的可视区上限。compact 取小会让 ai-home 在 120 就滚
 * (内容被裁走可视性)—— 取较大档例外的反向情形,故两端各留一档、写明不成对。
 */
export const INPUT_AREA_INPUT_MAX_HEIGHT_PX = 120

/**
 * 【B 单端档·RN】缩略图删除角标文字阴影纵向偏移 1。
 * 绘制细节,非布局档:小程序端的同类角标是实底色块 + 图片资产,没有阴影通道。
 * 收进本表只为端内不留裸数字;该样式条目当前无渲染点(遗留,清理另计一票)。
 */
export const INPUT_AREA_LEGACY_SHADOW_OFFSET_PX = 1

/**
 * 【B 单端档·RN】遗留删除叉字形的行盒 12。同上一条:条目未被渲染引用,数值入表以免端内
 * 再抄一份 12。若遗留样式被清理,本档随它一起消失。
 */
export const INPUT_AREA_LEGACY_GLYPH_LINE_PX = 12

/* ── 以下为小程序 ai-home(复刻原项目 InputArea.vue)一侧的档 ──
 * 这一族 RN 端**没有同一元素**:RN 卡片态用主题 token + 实底钮,小程序态逐条对齐原项目
 * 的 rpx 定值。全部登记为【B 单端档·小程序】,机制/变体差异,非取值分叉。
 */

/**
 * 【B 单端档·小程序】附件类型角标("文档"/"视频")字号 12。
 * 依据:裁决规则 4 —— 收编前端内写 `rpx(18)` = 9,不在 design-tokens 任何字号档上,
 * 就近吸到最低档 12(取小会小到读不清,故不往 10 走)。RN 端这一位置是 <Play> 矢量角标,无文字。
 */
export const INPUT_AREA_ATTACHMENT_BADGE_FONT_PX = 12

/** 【B 单端档·小程序】附件类型角标行盒 16。取 16 与上面那枚文件名条同档,不再第三个"压字条"高。 */
export const INPUT_AREA_ATTACHMENT_BADGE_LINE_PX = 16

/**
 * 【B 单端档·小程序】视频缩略内容盒 106.5×60(=213×120rpx,16:9)。
 * 素材固有比:它是按视频画面比例给的内容盒,与 RN 的 72×72 方形盒不是同一形态
 * (裁决规则 6 点名的"看起来像内容上限/动态测量"那一类,实测它是静态 16:9 盒)。
 */
export const INPUT_AREA_VIDEO_THUMB_W_PX = 106.5
export const INPUT_AREA_VIDEO_THUMB_H_PX = 60

/** 【B 单端档·小程序】ai-home textarea 自动撑高上限 250(=500rpx,复刻原项目)。与 RN 120 不同形,依据见 INPUT_AREA_INPUT_MAX_HEIGHT_PX 注。 */
export const INPUT_AREA_AI_HOME_INPUT_MAX_HEIGHT_PX = 250

/**
 * 【B 单端档·小程序】全屏放大态浮层的顶偏移 60(=120rpx)。
 * 平台机制差异:这是 fixed 浮层让开原生导航栏与页面标题的偏移,RN 端全屏态走另一套
 * (放大即解除 `maxHeight`,不产生 fixed 浮层),没有可对的另一端。
 */
export const INPUT_AREA_AI_HOME_OVERLAY_TOP_PX = 60

/**
 * 【B 单端档·小程序】全屏放大态在「加号面板已展开」时的底偏移 146(=292rpx = 112rpx 基础
 * 偏移 + 92rpx 面板高)。基础偏移那一支(`rpx(112)` = 56)**刻意留在端内做字面量**:56 这一档
 * 两端共享(RN 折叠 FAB 盒也是 56),把这一支一起收编会让 56 变成"仅 RN 档",台账不减反增。
 */
export const INPUT_AREA_AI_HOME_OVERLAY_BOTTOM_WITH_PANEL_PX = 146

/**
 * 【B 单端档·小程序】发送图标左让位 9(=18rpx)。RN 端两枚操作钮各自的让位是 4(框内)与
 * 8(框外,已收进 INPUT_AREA_STACK_GAP_PX):一者是裸图标的视觉让位、一者是实底钮的外边距,
 * 不是同一处留白,不构成可对的两端。
 */
export const INPUT_AREA_AI_HOME_SEND_ICON_MARGIN_PX = 9

/**
 * 【B 单端档·小程序】ai-home 原项目图标盒 25(=50rpx 方形:语音钮盒宽、发送/清空图标)。
 * 与 RN 的 40/44 实底钮不同形态(裸图标无底),故不成对。
 */
export const INPUT_AREA_AI_HOME_ICON_BOX_PX = 25

/** 【B 单端档·小程序】ai-home 行内 10rpx 留白(表情面板与输入条之间、清空图标与发送图标之间)= 5。 */
export const INPUT_AREA_AI_HOME_INLINE_GAP_PX = 5

/** 【B 单端档·小程序】表情面板高 90(=180rpx)、单格 30(=60rpx)。RN 端没有表情面板(契约分叉)。 */
export const INPUT_AREA_AI_HOME_EMOJI_PANEL_H_PX = 90
export const INPUT_AREA_AI_HOME_EMOJI_CELL_PX = 30

/**
 * 【A 两端同值·裁决】图标墨迹 20(O81 票⑤ 取代原 4 枚位图墨迹比常数):
 * 语音/键盘切换钮与"添加附件"加号的墨迹档。依据三处同源:
 *  - RN `InputArea.tsx` 的 `<Mic size={20}/>` 与 `<Keyboard size={20}/>`(同一切换钮的两态);
 *  - 小程序 default 变体这一处一直是 Tailwind `w-5 h-5`(= 20);
 *  - 小程序 ai-home 的 `.search-box1-img` 类臂 38×40rpx,其墨迹高 40rpx = 20。
 * 被删掉的四枚常数(`..._VOICE_GLYPH_TEXT_W/H`、`..._VOICE_GLYPH_VOICE_W/H`)记的是
 * **两张 PNG 素材各自的非方形墨迹比**(38×40 / 50×30rpx),矢量图标是正方形盒,
 * 位图退役后那两对比值不再有载体,故整体并成本枚方形档,不保留死表。
 */
export const INPUT_AREA_GLYPH_MD_PX = 20

/**
 * 【B 单端档·小程序】ai-home 加号(附件钮)墨迹 22(= `.search-box2-img` 的 44rpx)。
 * 与上面 20 那一档不同形:20 是 RN 与小程序 default 变体共享的档,而 ai-home 这一枚是复刻
 * 原项目的 44rpx 内联盒(RN 端同一功能走共享 `PlusButton` 实底钮,墨迹 16/26 两档另有形态),
 * 强行并档会改写首页输入条的观感,故登记为单端档,换算入表以免端内裸数字。
 */
export const INPUT_AREA_AI_HOME_ADD_GLYPH_PX = 22

/**
 * 【B 单端档·小程序】ai-home 放大/缩小钮墨迹 24(= 收编前位图内联 `rpx(48)`)。
 * RN 端同一处不是矢量图标:输入框里是 `⤢`/`⤡` 字符(`INPUT_AREA_CONTROL_GLYPH_PX` 14),
 * 底部辅助行才是 lucide `Maximize` 18 —— 三处三种载体,取值不同形,故本档只登记小程序这一枚,
 * 数值取原位图墨迹盒以免改观感。
 */
export const INPUT_AREA_AI_HOME_EXPAND_GLYPH_PX = 24

/**
 * 【B 单端档·小程序】ai-home 语音钮盒宽 25(=50rpx)。高度刻意不收:那一行的 22 这一档
 * 两端共享(小程序 44rpx / RN 放大钮 22),把高度收进表会把共用档变成"仅 RN 档"。
 * 与头注"刻意不入表"清单同源。
 */
export const INPUT_AREA_AI_HOME_VOICE_BTN_W_PX = 25
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
