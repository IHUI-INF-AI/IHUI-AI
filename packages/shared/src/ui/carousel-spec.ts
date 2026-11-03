// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 跨端轮播几何档:值取"两端现档 + 裁决规则",两端组件文件不再各自抄数字。
//
// 本表只收"两端在同一含义处各自定了档"的数字(字面量,或 Tailwind 档位类名折出的档)——
// 端内只做"单位换算 + 平台原语挂载"。模式与裁决规则同 `bottom-action-bar-spec.ts`(O81)。
//
// 刻意不入表的(逐条给理由,不是清单外的遗漏):
//  - 小程序端独有渲染的两块 ——「无图兜底文案块」与「课程变体叠加层」。2026-09-27 复核把
//    守门 128 剩余 6 枚"仅小程序档"逐枚映射到载体(载体是 variant='course'/courseMeta 与
//    逐项 img 兜底这组只在小程序组件存在的入参,RN 同名文件 `apps/mobile-rn/src/components/
//    Carousel.tsx` 不渲染它们;RN 侧的课程卡是另一枚组件 CourseCarousel,不在本配对面上):
//      20 = 兜底标题 text-xl;14 = 兜底副标题与叠加层标题 text-sm;16 = 兜底容器 p-4;
//      8 = 兜底标题 mb-2 + 叠加层标签行 gap-2 + 徽章 px-2;4 = 标签行 mt-1;2 = 徽章 py-0.5。
//    按规则 6「不构成同一元素」不入库,也**不得**改走函数出口:spec 的 `_PX` 档被单腿引用会
//    立刻生成 SL(本族要求 SL 0);让 RN 端也写档名是死引用(为判据造消费方);把单端数字折进
//    toUnit 函数则让读数归零而两端屏幕上依旧一边有一边无 —— 后两条都是原票明令禁止的假绿。
//    真要收口,前置只有两条(均属持判据者的另票,不是清账顺手动作):
//    ① 把兜底文案与叠加层移植进 RN 端(那是新增能力,§24),届时六档全部立 `_PX` 档两端同吃;
//    ② 或由台账 `pairingRejects` 判这一族"同名而能力集不同"并拆对(reason + until 齐备)。
//    【裁定@2026-10-24,机主 2026-10-23 强制令代裁】选②、落选①:RN 端课程卡是独立
//    组件 CourseCarousel,把这两层移植进 RN = 在既有件之外再造一层课程卡,属新增能力,不满足
//    "最小且可回退";而对面结构上确无这两层,"给单端补数字"即假绿,正解只剩承认两端不同族。
//    ⚠️ **落地状态纠偏@2026-10-27(xend-geometry 现读)**:此处原写「落地形态:台账
//    `pairingRejects.Carousel`(legs=main、until 2027-03-27)入账,本族 counts/radiusCounts/
//    elementRadiusCounts/waivers 四键同批清掉」—— **那句与台账不符,作废**。现读
//    `scripts/cross-end-ui-parity-baseline.json`:`pairingRejects` 只有 `FloatBox` 一族,
//    `counts.Carousel` 仍 = 6、`waivers.Carousel` 仍在,门 128 判定档仍报
//    `○ Carousel [className|className] 几何仅小程序档 2/4/8/14/16/20` ⇒ 本族**仍在配对射程内**,
//    下一步读票的人不得按"已拆对"跳过它。未落地不是执行漏笔:拆对要删这四键,而票「守门 128
//    换腿后新暴露的跨端几何差(三对)」的硬约束是"只许清偿后下调,不许删条目/为变绿删账"
//    ⇒ 该步归门 128 持有人 / 主席批,执行席不得自行销账。
//    两条出口按裁决原样保留:① RN 端真落地这两层渲染(§24 新增能力,须人定档)⇒ 六档立 `_PX`
//    两端同吃;② 主席批准拆对 ⇒ 再补 `pairingRejects.Carousel`(reason+until 齐备)并同批清四键。
//    拆对不影响本文件的单一源地位:两端真正必须同值的指示点几何 / 默认高仍从这里取。
//    若将来 RN 端真落地这两层渲染(前置①),撤声明并按默认档实测重新登记。
//  - 12 的两侧"抵消"是**数字巧合,不是同值**:小程序侧来自叠加层容器 p-3 与徽章 text-xs,
//    RN 侧来自空列表占位文案 text-xs(小程序空列表 return null,该占位在对面不存在)。
//    三个不同元素撞在同一个数上 —— 改任一侧,这一档立刻以"仅小程序档 12"或"仅 RN 档 12"
//    重新现形;不得把这一行读成"已收口档"。
//  - web 端对照(规则 1)也查过了:`apps/web` 没有这个元素的对应实现 ——
//    `carousel-fallback` 是端内 app.css 专有类,`marketing/HeroCarousel.tsx` 是营销首屏大图
//    (标题 text-2xl/3xl/5xl 随断点缩放、副标题 text-sm/lg),媒介与布局角色都不同,不构成对照。
//  - 圆角与配色:同 `bottom-action-bar-spec` 的理由 —— 圆角两端都引 `design-tokens/src/radius.js`
//    (守门 77 问责),再存第三个数字就是第二份真相(规则 5);配色归 tokens 派生链(守门 93)。
//  - (历史记录)共享层 `packages/app/src/components/Carousel.tsx` 里的视口兜底宽 375:那是
//    `window.innerWidth` 取不到时的设备宽度默认值,不是设计档 —— 小程序侧同一含义走
//    百分比宽(`width: ${(total*100)}%` + 每屏 `100/total%`),两端都没有"轮播宽"这个档。
//    该共享层死副本已按 O81 票删除(守门 128 配对面上 RN 腿只剩端内那份),此条留作依据出处。
//
// ── O02 票④(第 ④ 格)收口证据:本族"只剩一份源"────────────────────────────────
// 现读 2026-10-28(`node scripts/check-cross-end-ui-parity.mjs --json`,HEAD 977d324b22):
//   findings[Carousel] = diffCount 6 / radiusCount 0 / elementRadiusCount 0;
//   人读面:`○ Carousel [className|className] 几何仅小程序档 2/4/8/14/16/20`。
// 两条腿的**共用**几何档全部经本文件三个出口取数,端内不再自持数字:
//   · apps/miniapp-taro/src/components/Carousel.tsx → carouselDefaultHeightPx /
//     carouselIndicatorWrapStyle / carouselDotStyle(换算 `toUnit = rpx(px * TARO_RPX_PER_PX)`)
//   · apps/mobile-rn/src/components/Carousel.tsx   → 同三出口(换算 `toUnit = px` 恒等)
// 已收口档(两端同值同源):默认高 160、指示器底距 12、点间距 6、点高 6、非激活宽 6、激活宽 16。
// ⚠ 门读数里 6/12/16 两侧都出现**不能**当作收口证据:12 在两端另有巧合来源(见下),6/16 在端内
//   是圆角档(rounded-md / rounded-2xl,归守门 77)不是几何档;收口证据是三出口被两条腿真调用
//   (__tests__/carousel-wiring.test.ts ②③ 逐端现算)。
//
// 6 枚几何逐条归属 —— **全部 A 类**,0 枚 B、0 枚 C:
//  A 一端根本没有该元素(六枚全部来自小程序独有渲染两块,RN 同名文件不渲染它们):
//    兜底文案块(`!hasImg && (title || subtitle)`):16 = 容器 p-4;20 = 标题 text-xl;
//                                          14 = 副标题 text-sm;8 = 标题 mb-2
//    course 叠加层(`variant === 'course' && meta`):8 = 标签行 gap-2 / 徽章 px-2;
//                                          4 = 标签行 mt-1;2 = 徽章 py-[4rpx];
//                                          14 = 叠加层标题 text-sm
//    ⇒ 集合恰为 2/4/8/14/16/20。依据与裁决(2026-10-24 选拆对、不向 RN 移植)以及
//      落地状态纠偏(2026-10-27:pairingRejects 仍只有 FloatBox、counts 仍 = 6)见上半段。
//  B 已裁决变体契约:0 枚。
//  C 同槽位、机制不同:0 枚**带数值的**。轮播步进确属机制不同(小程序 ScrollView + scrollIntoView
//    + 每屏 `100/total%` 宽 vs RN pagingEnabled + slideWidth 像素 + scrollTo),但两端都没有
//    "步进宽"这个档 —— 一端是百分比、一端是容器实测宽,不构成可对账的档。
//
// ⚠ 12 的"两侧相消"是数字巧合:小程序来自叠加层容器 p-3 与徽章 text-xs,RN 来自空列表占位文案
//   text-xs(小程序空列表 return null,该占位在对面不存在)⇒ 不得读成已收口档。
//   RD / RE 两维 0:圆角两端同走 radius.js(rounded-2xl / rounded-sm 两端同值,守门 77 问责);
//   RE 维两侧无同名具名元素 ⇒ 零判据(覆盖面事实,不是"已同值")。
//
// ⇒ 结论:本族**无可继续收敛项** —— A 组六枚与"RN 端不渲染这两层"是同一件事的两面,补引用是
//   造假;B/C 0 枚。counts 维持 6(几何)/ 0(RD)/ 0(RE)。逐档归属由
//   __tests__/carousel-wiring.test.ts 机器钉住:谁往 RN 端补这六枚、谁把三出口的取数删掉、
//   谁在端内同一块里另写同值裸数字,对应那条用例就红。

/** 每端注入的单位换算(一个逻辑 px 到该平台数值);泛型把单位类型带出来。 */
export type GeometryUnit<U extends string | number> = (px: number) => U

/**
 * 默认高度 160:两端现值已同(小程序 prop `height = 160` / RN `DEFAULT_HEIGHT = 160`),
 * 收一处防分叉。小程序端那个裸 160 会被守门 128 按端量纲折成 80px,与 RN 侧 160 造出
 * 一对假差异 —— 收成函数调用后两侧文件都无字面量,假差异随之消失。
 */
export function carouselDefaultHeightPx(): number {
  return 160
}

/** 指示器距底边 12:RN 现值 12,小程序端 `bottom-2` = 8。裁决规则 2(间距取两端较大者)→ 12。 */
const CAROUSEL_INDICATOR_BOTTOM_PX = 12

/** 指示点间距 6:两端现值已同(小程序 `gap-1.5` / RN `gap: 6`)。 */
const CAROUSEL_INDICATOR_GAP_PX = 6

/** 指示点高度 6:两端现值已同(小程序 `h-1.5` / RN `height: 6`)。 */
const CAROUSEL_DOT_HEIGHT_PX = 6

/** 未激活指示点宽度 6(正圆):两端现值已同(小程序 `w-1.5` / RN 三元里的 6)。 */
const CAROUSEL_DOT_INACTIVE_WIDTH_PX = 6

/** 激活指示点宽度 16(胶囊):两端现值已同(小程序 `w-4` / RN 三元里的 16)。 */
const CAROUSEL_DOT_ACTIVE_WIDTH_PX = 16

/** 指示器容器结构:底部居中一行,等距排点;只在这一处排,端内不再重摆。 */
export function carouselIndicatorWrapStyle<U extends string | number>(
  toUnit: GeometryUnit<U>,
): {
  position: 'absolute'
  left: 0
  right: 0
  bottom: U
  display: 'flex'
  flexDirection: 'row'
  alignItems: 'center'
  justifyContent: 'center'
  gap: U
} {
  return {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: toUnit(CAROUSEL_INDICATOR_BOTTOM_PX),
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: toUnit(CAROUSEL_INDICATOR_GAP_PX),
  }
}

/**
 * 指示点几何(宽/高;颜色与圆角留在端内 —— 圆角归守门 77,配色归 tokens 派生链)。
 * 三元式在 spec 内部完成,端内 JSX 不再出现裸 6/16 字面量。
 */
export function carouselDotStyle<U extends string | number>(
  toUnit: GeometryUnit<U>,
  active: boolean,
): { width: U; height: U } {
  return {
    width: toUnit(active ? CAROUSEL_DOT_ACTIVE_WIDTH_PX : CAROUSEL_DOT_INACTIVE_WIDTH_PX),
    height: toUnit(CAROUSEL_DOT_HEIGHT_PX),
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
