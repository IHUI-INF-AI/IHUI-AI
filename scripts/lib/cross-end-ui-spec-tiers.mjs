// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 跨端 UI 对账的「规格投影」判据族(门 103 C1 收口,2026-11-19 从 check-cross-end-ui-parity.mjs 下沉)。
 *
 * 档表→投影关系、别名/归属解析与档位等价比对住在这里;几何取值仍在
 * `cross-end-ui-parity-geometry.mjs`(两件同属本门门体,装车锁合读)。
 */

import {
  toPx,
  round,
  stripComments,
  NON_GEO_KEY,
  RADIUS_FORM_RE,
} from './cross-end-ui-parity-geometry.mjs'

export const fileName = (f) => f.split('/').pop()
/**
 * 档表 → 投影关系(`export const X = GEOMETRY_PX.g` 里的 g)。
 * 用 WeakMap 挂在**同一次解析产物**上,而不是把 tiers 改成 `{tiers, projections}`:
 * tiers 被六处判据当纯数字表消费,改形状等于让每一处都跟着改一遍(改漏一处就是静默失明)。
 */
export const SPEC_PROJECTIONS = new WeakMap()
/** 档名 → **声明它的那份 spec 文件**(同一次解析记下)。只用来划一条归属边界,见 specLegAudit。 */
export const SPEC_OWNERS = new WeakMap()
/**
 * 单一源表(共享 spec + design-tokens 几何表)→ 具名档表。
 * 键:`SPEC_…_PX` 原样;`GEOMETRY_PX` 的档挂 `geometry.` 前缀(与消费侧 `rnGeometry.tapBox` 同形)。
 * 排除项按判据面而非按名字猜:带 `PER_` 的是单位换算系数(`TARO_RPX_PER_PX = 2` 不是尺寸档)、
 * 命中 NON_GEO_KEY / 圆角形态的不入表 —— 收了就是把换算系数当几何档喂进集合。
 */
export function specTiers(sources) {
  const tiers = {}
  /**
   * 投影关系表(档名 → 它投影的几何档),由**同一次解析**记下,不再走第二遍源码。
   * 为什么要留着这段关系:SL 维原先只比档名,于是"小程序腿直取 `taroGeometry.controlBox`、
   * RN 腿引用 `INPUT_AREA_IN_SHELL_BTN_PX`(它就是 GEOMETRY_PX.controlBox 的投影)"被算成
   * **仅一侧引用** —— 两条腿都走了单一源,门却报"另一条腿还没接线"(2026-10-19 票 G-16 那格)。
   * 归一依据取自被审面上的 `export const X = GEOMETRY_PX.g` 这一条语句本身,**不做名字相似度匹配**
   * (相似度匹配会把两个不同档并成一个,那正是本仓记过的那一型)。
   */
  const projections = {}
  const owners = {}
  // 两遍:几何表可能排在 spec 之后,先收表,再解析 `export const X = GEOMETRY_PX.y` 这类投影档。
  const geom = []
  for (const [rel, src] of Object.entries(sources)) {
    if (!/[\\/]geometry\.[jt]s$/.test(rel)) continue
    const table = stripComments(src).match(/GEOMETRY_PX\s*=\s*\{([\s\S]*?)\n\}/)
    if (!table) continue
    for (const m of table[1].matchAll(/([A-Za-z_$][\w$]*)\s*:\s*(\d+(?:\.\d+)?)/g))
      geom.push([m[1], Number(m[2])])
  }
  for (const [k, v] of geom) tiers[`geometry.${k}`] = v
  /**
   * **间距档位表**(`packages/design-tokens/src/spacing.ts`,全端共用 dp 唯一源,C3/C8 量具盲区补腿)。
   * 键形态 = 消费方成员(`rnSpacing.md`/`rnSpacingFor.gap`),与 `geometry.<k>` 同构。
   * 口径 = **dp 逻辑值**;`taroSpacing.*`(已×2 的 rpx 面)刻意**不入表** —— 单位口径没算清就把
   * 双倍数值混进比对集,正是 C5 那格"给最坏的单位错发合格证"的形态。
   * `none: 0` 不入档(0 值引用=造同值假账 —— C4 纪律)。
   */
  for (const [rel, srcSp] of Object.entries(sources)) {
    if (!/[\\/]spacing\.[jt]s$/.test(rel)) continue
    const codeSp = stripComments(srcSp)
    const spTable = codeSp.match(/SPACING_STEPS\s*=\s*\{([\s\S]*?)\}\s*as const/)
    if (!spTable) continue
    const spSteps = []
    /**
     * 档名长度上限必须是**实测上限**而不是"看起来够"。旧写法 `{1,6}` 把带连字符的档名整枚丢掉:
     * 现读 `packages/design-tokens/src/spacing.ts` 的 `'xs-loose': 6` / `'sm-loose': 10`(8 字符),
     * 于是 `rnSpacing['xs-loose']` 在 RN 腿**读不到** —— 而"读不到"在账面上的表现不是少一个数,
     * 是凭空造出"仅小程序档 6"(2026-11-01 票 O67 把 CSS 变量解值接上后立刻顶出来的第二条同型洞,
     * 与 var 那一条是**同一个失效形**:量具看不见 ⇒ 判成对面独有)。`{1,16}` 取实测最长档名
     * (`listItemPadY` 12 字符)再放余量;超限的引号串不当档名(它更可能是注释或值里的引号)。
     */
    for (const m of spTable[1].matchAll(
      /(?:'([^']{1,16})'|([A-Za-z_$][\w$]*))\s*:\s*(\d+(?:\.\d+)?)/g,
    ))
      spSteps.push([m[1] || m[2], Number(m[3])])
    for (const [k, v] of spSteps) if (v > 0) tiers[`rnSpacing.${k}`] = v
    const spRoles = codeSp.match(/SPACING_ROLES\s*=\s*\{([\s\S]*?)\}\s*as const/)
    if (spRoles)
      for (const m of spRoles[1].matchAll(/([A-Za-z_$][\w$]*)\s*:\s*'([^']+)'/g)) {
        const hit = spSteps.find(([k]) => k === m[2])
        if (hit && hit[1] > 0) tiers[`rnSpacingFor.${m[1]}`] = hit[1]
      }
  }
  /**
   * **字号档位表**(`packages/design-tokens/src/typography.ts` 的 TYPE_STEPS,2026-11-02 Phase 3)。
   * 键形态 = 消费方成员(`rnType.bodySm.size` / `rnType.bodySm.lineHeight`);`weight` 不入表
   * (字重不是几何档,GEO_KEY/NON_GEO_KEY 两筛同样不认它)。口径与本文件间距那段逐字同形:
   * 只收 `size/lineHeight` **两侧都是数字字面量**的成员 —— 取值一旦改成表达式/引用,
   * 这里读不到,由 `readGeometry` 那一条逐枚报未判定(§0.3),绝不猜。
   * `0` 档不入表(与间距段的 C4 纪律同一条:0 值进集会造"两侧同值"假账)。
   */
  for (const [rel, srcTy] of Object.entries(sources)) {
    if (!/[\\/]typography\.[jt]s$/.test(rel)) continue
    const codeTy = stripComments(srcTy)
    const tyTable = codeTy.match(/TYPE_STEPS\s*=\s*\{([\s\S]*?)\}\s*as const/)
    if (!tyTable) continue
    /**
     * **小程序投影面**(`taroType`,同表折成 `${size * 2}rpx`,2026-11-02 Phase 3 第二腿)。
     * 不接的后果:`ScreenStates.taro.tsx` 的标题只写 `fontSize: taroType.strong.fontSize`,
     * 几何维在小程序侧读不到 ⇒ 已对齐的 15 被读成"仅 RN 档"(假分叉,与 rnType 那条同型)。
     * 口径三条:① 投影倍数**从源里读**,读不到就整族不入表(不做"×2 必然等于同值"的推断 ——
     * 与间距段拒绝 `taroSpacing.*` 入表是同一条理由:单位口径没算清就把双倍数值混进比对集);
     * ② 入表值是**逻辑 px**(rpx 折半),与 `rnType.*` 的 dp 面同量纲;
     * ③ `lineHeight` 与 rnType 同罪:NON_GEO_KEY 挡住裸引用,只有几何键语境才归档。
     */
    const projSize = /taroType[\s\S]{0,400}?\$\{v\.size\s*\*\s*(\d+(?:\.\d+)?)\}rpx/.exec(codeTy)
    const projLh = /taroType[\s\S]{0,400}?\$\{v\.lineHeight\s*\*\s*(\d+(?:\.\d+)?)\}rpx/.exec(
      codeTy,
    )
    for (const m of tyTable[1].matchAll(
      /(?:'([^']{1,16})'|([A-Za-z_$][\w$]*))\s*:\s*\{\s*size\s*:\s*(\d+(?:\.\d+)?)\s*,\s*lineHeight\s*:\s*(\d+(?:\.\d+)?)/g,
    )) {
      const step = m[1] || m[2]
      const size = Number(m[3])
      const lh = Number(m[4])
      if (size > 0) tiers[`rnType.${step}.size`] = size
      if (lh > 0) tiers[`rnType.${step}.lineHeight`] = lh
      const sizePx = projSize ? round((size * Number(projSize[1])) / 2) : 0
      const lhPx = projLh ? round((lh * Number(projLh[1])) / 2) : 0
      if (sizePx > 0) tiers[`taroType.${step}.fontSize`] = sizePx
      if (lhPx > 0) tiers[`taroType.${step}.lineHeight`] = lhPx
    }
  }
  for (const [rel, src] of Object.entries(sources)) {
    if (/[\\/]geometry\.[jt]s$/.test(rel)) continue
    // `.d.ts` 是**声明**不是第二份档表:它的键集由 G 维单独与运行时表对账,
    // 混进这里会让"类型说了而表没有"的档被当成真档喂给判据。
    if (/\.d\.[jt]s$/.test(rel)) continue
    const code = stripComments(src)
    for (const m of code.matchAll(
      /export const ([A-Z][A-Z0-9_]*_PX)\s*=\s*(?:(\d+(?:\.\d+)?)(?![\w.])|(?:GEOMETRY_PX|rnGeometry|taroGeometry)\.([A-Za-z_$][\w$]*))/g,
    )) {
      const name = m[1]
      if (/PER_/.test(name) || NON_GEO_KEY.test(name) || RADIUS_FORM_RE.test(name)) continue
      const px = m[2] !== undefined ? Number(m[2]) : tiers[`geometry.${m[3]}`]
      if (typeof px === 'number' && px > 0) {
        tiers[name] = px
        owners[name] = rel
        if (m[3]) projections[name] = m[3]
      }
      // 投影源取不到(表里没这一档 / 改了名)⇒ **不计入档表**:把"解析不出"当成 0 或跳过,
      // 等于让一次改名把整条具名档判据静默关掉 —— 与本门"判不出即点名"的口径同形,这里如实留空。
    }
  }
  /**
   * 第三层:**具名档 → 具名档**的纯投影(`export const A_PX = B_PX`)。
   *
   * 为什么要在这一层补:上一层的正只认 `= <数字>` 与 `= GEOMETRY_PX.<step>` 两种右值,于是
   * "把已收口的档再起一个组件内名字"这一型**整枚从档表里消失** —— 组件引 A 时门读不到 A,
   * 另一端写同一枚数值(或引 B)就被报成"仅一侧引用/仅一侧档"。这正是票 G-16 第(i)格那族
   * (「门把没读到写成了没有」)在真仓的现存实例:HEAD 现读 `packages/shared/src/ui/tab-bar-spec.ts`
   * 的 `TAB_BAR_MARGIN_H_PX = INPUT_AREA_CONTAINER_PADDING_X_PX`(同值纯别名,目标在表内)与
   * `TAB_BAR_HEIGHT_PX = INPUT_AREA_SHELL_HEIGHT_PX`(目标本身是算术派生、不在表内)。
   *
   * 口径三条,缺一不认(与上一层同一条纪律:不做名字相似度匹配):
   *  1. 右值必须是**整行唯一标识符**(`A_PX = B_PX`);`A_PX = B_PX + 4` 是派生量,不是同一个数;
   *  2. 链上带环(`A→B→A`)⇒ 两边都**不入档表**(值未判定),也不造等价边 —— 环上的"同值"证明不了;
   *  3. 终端值可解 ⇒ 别名档**按同一数值进表**(与字面量档同门同判);终端解不出(目标本身是算术式)
   *     ⇒ **不进表**(§0.3:没判不写判过),但等价关系仍登记,供 SL 的"同值异名"归一使用 ——
   *     那一条方向是**只划掉假账**的,不会把未判定的档报成单侧。
   */
  const namedEdges = {}
  for (const [rel, src] of Object.entries(sources)) {
    if (/[\\/]geometry\.[jt]s$/.test(rel) || /\.d\.[jt]s$/.test(rel)) continue
    const code = stripComments(src)
    for (const m of code.matchAll(
      /^export const ([A-Z][A-Z0-9_]*_PX)[ \t]*=[ \t]*([A-Z][A-Z0-9_]*_PX)[ \t]*;?[ \t\r]*$/gm,
    )) {
      if (m[1] === m[2]) continue
      namedEdges[m[1]] = { target: m[2], file: rel }
    }
  }
  const namedTerminalOf = (name) => {
    let cur = name
    const seen = new Set()
    while (namedEdges[cur] && !seen.has(cur) && seen.size < 8) {
      seen.add(cur)
      cur = namedEdges[cur].target
    }
    return cur
  }
  for (const [name, edge] of Object.entries(namedEdges)) {
    const terminal = namedTerminalOf(name)
    if (terminal === name) continue // 环形链:证明不了"同值",如实按未判定处理
    /**
     * 投影终点:终端若本身投影到某个几何档,别名继承那个 step;否则指向终端具名档本身。
     * 两种都让 SL 的等价归一能沿同一条链走到同一个键(见 specTierEquivalence)。
     */
    if (typeof tiers[terminal] === 'number') {
      tiers[name] = tiers[terminal]
      owners[name] = edge.file
      projections[name] = projections[terminal] ?? terminal
    } else if (projections[terminal] !== undefined) {
      projections[name] = projections[terminal]
    } else {
      // 值不可解但**等价关系是确定的**:记下终点名,供 SL 判"两端引的是同一个数(名)"。
      projections[name] = terminal
    }
  }
  SPEC_PROJECTIONS.set(tiers, projections)
  SPEC_OWNERS.set(tiers, owners)
  return tiers
}

/** 档名 → 投影的几何档名(由 specTiers 同一次解析记下;没有这层关系就返回空表)。 */
export function specProjectionAliases(tiers) {
  return SPEC_PROJECTIONS.get(tiers) ?? {}
}

/** 档名 → 声明它的 spec 文件(由 specTiers 同一次解析记下)。 */
export function specProjectionOwners(tiers) {
  return SPEC_OWNERS.get(tiers) ?? {}
}

/**
 * **具名档等价类** —— 判"两端是否同形"而不是"是否同名"的最后一块。
 *
 * 一个名字沿投影链走到底,得到两类键:
 *  - `step:<声明它的 spec>:<几何档>` —— 投影到 `GEOMETRY_PX` 的成员。owner 仍在键里,
 *    因为**同一个 step 可以被多枚组件各自的常数引用**(真仓实测 `controlBox` 同挂
 *    INPUT_AREA_IN_SHELL_BTN_PX 与 BOTTOM_ACTION_BAR_CONTROL_BOX_PX),跨 spec 并档就会把
 *    别处组件的档算到这个组件头上(2026-10-24 实测:双向用成同一键当场多报 3 条)。
 *  - `named:<终端具名档>` —— 显式 `export const A_PX = B_PX` 声明出来的同值关系(含目标值
 *    不可解那一型)。这条是**声明式的**,跨 spec 也成立(`A` 就是 `B`,不是"碰巧同一个 step")。
 *
 * 返回 `{ keyOf, membersOf }`:`membersOf.get(key)` 是这等价类里**任何一端都可以写**的名字集合
 * (含几何成员名 / 别名 / 终端名)—— SL 用它做"这条腿已经走单一源"的判定。方向纪律不变:
 * 等价类只许**划掉**假账,不许据此新报单侧(理由同 specLegAudit 内注)。
 */
export function specTierEquivalence(tiers) {
  const aliases = specProjectionAliases(tiers)
  const owners = specProjectionOwners(tiers)
  const keyOf = new Map()
  const membersOf = new Map()
  const keyFor = (name) => {
    let cur = name
    const seen = new Set()
    let step = null
    let stepOwner = owners[name] ?? null
    while (aliases[cur] !== undefined && !seen.has(cur) && seen.size < 8) {
      seen.add(cur)
      const next = aliases[cur]
      if (tiers[`geometry.${next}`] !== undefined) {
        step = next
        if (owners[cur] !== undefined) stepOwner = owners[cur]
        break
      }
      cur = next
      if (owners[cur] !== undefined) stepOwner = owners[cur]
    }
    if (step !== null) return `step:${stepOwner ?? '-'}:${step}`
    return `named:${cur}`
  }
  const add = (name) => {
    if (keyOf.has(name)) return
    const k = keyFor(name)
    keyOf.set(name, k)
    if (!membersOf.has(k)) membersOf.set(k, new Set())
    membersOf.get(k).add(name)
  }
  // 成员面 = 档表里的 spec 档 + 全部别名声明名 + 具名终端名 + step 名(几何成员)。
  for (const name of Object.keys(tiers)) if (!name.startsWith('geometry.')) add(name)
  for (const name of Object.keys(aliases)) add(name)
  for (const name of [...keyOf.keys()]) {
    const m = /^named:(.+)$/.exec(keyOf.get(name))
    if (m) add(m[1])
  }
  for (const [k, set] of membersOf) {
    const m = /^step:.+?:(.+)$/.exec(k)
    if (m) set.add(m[1])
  }
  return { keyOf, membersOf }
}

export const normKey = (file) =>
  fileName(file)
    .replace(/\.(tsx|jsx|ts|js)$/i, '')
    .replace(/[^a-z0-9]/gi, '')
    .toLowerCase()
export const nameOf = (file) => fileName(file).replace(/\.[^.]+$/, '')

/**
 * 配对键:先走 `normKey`,再剥掉**平台后缀**。
 * 机制要写准(2026-09-30 实测更正 —— 原文说"构建器按后缀解析同名实现,`SectionHeader.taro.tsx` 才是
 * weapp 上被打包的那一份"是错的):`@tarojs/helper/dist/utils.js` 的 `resolveMainFilePath()` 拼的是
 * `${p}.${process.env.TARO_ENV}${ext}`,所以真正的后缀竞争只在 `X.weapp.tsx` vs `X.tsx` 这一族;
 * `.taro.tsx` 是本仓自己的命名约定,它被打包是因为调用方**显式写了**说明符。表里因此既要留 weapp/h5/alipay
 * 这类 TARO_ENV 词,也要留 taro 这个约定词 —— 但理由不同,不得再混成一句"构建器认后缀"。
 * 后缀必须剥进同一个键:`normKey` 会把 `.taro` 一起吸进键里 ⇒ `SectionHeader` 与 `SectionHeader.taro`
 * 成不了对。
 * 本轮实测未配对名单里 `Selecter.taro / SectionHeader.taro / ColorfulLoader.taro` 全是这一型 ——
 * 是键判据太糙,不是"另一端没有这个元素"。只剥这一族明确的平台词,不做模糊匹配:
 * 宁可少配,也不把两个不同元素并成一对(那会造出假"同值",比漏配更坏)。
 */
export const PLATFORM_SUFFIX = /(?:taro|weapp|h5|swan|tt|alipay|mp|rn|native)$/i
export const pairKey = (f) => normKey(f).replace(PLATFORM_SUFFIX, '')
/** 族名 = 去扩展名后的文件名再剥平台后缀。后缀必须先随扩展名一起去掉。 */
export const baseName = (f) => {
  const n = nameOf(f)
  return PLATFORM_SUFFIX.test(n) ? n.replace(/\.[^.]*$/, '') : n
}
/** 同键多候选时,带平台后缀那份优先(它是该端构建期真被解析进去的那份)。 */
export const candRank = (f) => (PLATFORM_SUFFIX.test(normKey(f)) ? 0 : 1)

/**
 * 同侧多候选的唯一选腿比较器 —— scan() 与 pruneUnreachableLegs() 的换腿**共用它**
 * (两处各写一份选法必然漂移,与票⑪"换腿桶必须与配对键同键同序"是同一条禁令)。
 * 四序取小者胜(lex):
 *   1) candRank:平台后缀那份先 —— 理由是**本仓约定**:带后缀那份是被 import 显式点名的适配腿,
 *      同名 plain 那份在本仓历次实测里都是不可达副本(D172/O92 两批皆如此);Taro 并不按 `.taro` 解析
 *      (它认 `${TARO_ENV}`,见上方配对键注),所以这一支是"约定 + 实测"的优先级,不是构建器行为。
 *      真判据仍是可达性维(pruneUnreachableLegs)—— 若哪天 plain 那份才是被点名的腿,该由可达性翻案,
 *      而不是靠这条后缀优先级硬压;
 *   2) 同端自绘层:`ownEndPrefix` 之下那份(该端屏幕上真渲染的那一份)—— 本门比的是"同一元素
 *      在两端的脸",拿共享层卡去对端内卡就是拿两个不同的元素互相记账;
 *   3) 出口指向:`preferFile` 是该族 re-export 链解到的那份(判据,不是猜测);
 *   4) 先入桶序:即 SIDES 目录优先级不变(共享层在前)—— 没有以上证据时的兜底。
 * 返回 {chosen, others, by};by = 击败次名的那一序('suffix'|'own-end'|'exit'|'order'),供报告点名
 * "为什么选这份" —— 只报 chosen 不报依据,与静默选一份只差一层措辞。
 * `ownEndPrefix` 不传 ⇒ 第二序对所有候选同值 ⇒ 行为与票#9 之前**逐字一致**(既有调用与镜像用例不受影响)。
 */
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
