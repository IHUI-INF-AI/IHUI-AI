// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠‌‌‌‍‍‌‌‍‍‌‌‌‌‍‍‌‌‌‍‍‌‌‌‌‍‍‌‌‍‍‌‌‍‌‍‍‌‌‌‌‌‌‍‌‌‌‍‌‌‌‌‌‍‌‍‍‌‌‌‌‌‌‍‌‌‍‍‌‌‌‍‌‌‌‍‌‌‌‌‌‌‍‌‌‌‌‌‌‍‌‌‌‌‌‍‍‌‌‌‌‍‍‍‌‌‌‌‍‍‌‌‍‍‌‌‌‌‌‌‌‌‌‌‍‍‌‌‍‌‍‍‌‌‌‌‍‍‌‌‍‍‍‌‌‌‍‍‍‌‌‍‌‍‍‌‌‌‌‍‍‌‌‍‍‌‍‍‌‌‌‍‌‌‍‌‌‌‌‌‍‍‌‌‌‍‍‌‌‌‍‍‌‌‍‍‌‌‍‍‌‌‌‍‌‌‌‌‍‍‌‌‍‍‍‌‌‍‌‌‍‍‌‌‌‍‍‌‌‍‍‌‌‍‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‌‍‌‌‌‌‍‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‌‍‌‌‍‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‌‍‍‌‌‍‍‌‌‍‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‌‍‌‌‌‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‌‍‌‌‌‌‌‌‌‍‌‌‍‍‌‌‍‍‌‌‍‍‍‌‌‍‍‌‌‍‍‍‌‌‍‌‌‍‍‌‌‍‍‍‌‌‍‍‌‌‌‍‌‌‍‍‍‌‌‍‍‌‌‍‍‌‌‍‍‍‌‌‌‍‌‌‍‍‍‌‌‍‍‌‌‌‍‌‌‍‍‌‌‍‍‍‌‌‍‍‌‌‍‍‌‌‌‍‌‌‍‍‍‌‌‍‍‌‌‌‍‌‌‍‍‍‌‌‍‍‌‌‍‍‌‌‍‍‍‌‌‍‍‌‌‍‍‌‌‍‍‍‌‌‍‍‌‌‍‍‌‌‌‍‌‌‍‍‍‌‌‍‍‌‌‍‍‌‌‌‍‌‌‍‍‍‌‌‍‍‌‌‍‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‌‍‌‌‍‍‍‌‌‍‍‌‌‍‍‌‌‍‍‍‌‌‌‍‌‌‍‍‌‌‍‍‍‌‌‍‍‌‌‍‍‌‌‍‍‍‌‌‍‍‌‌‌‍‌‌‍‍‍‌‌‍‍‌‌‍‍‌‌‌‍‌‌‍‍‍‌‌‍‍‌‌‍‍‍‌‌‍‍‌‌‌‍‌‌‍‍‍‌‌‍‍‌‌‌‍‌‌‍‍‍‌‌‍‍‌‌‍‍‌‌‍‍‍‌‌‍‍‌‌‌‍‌‌‍‍‍‌‌‍‍‌‌‌‍‌‌‍‍‍‌‌‌‍‌‌‍‍‌‌‍‍‍‌‌‍‍‌‌‍‍‍‌‌‍‍‌‌‌‍‌‌‍‍‍‌‌‍‍‌‌‌‍‌‌‍‍‍‌‌‍‍‌‌‌‍‌‌‍‍‍‌‌‍‍‌‌‌‍‌‌‍‍‍‌‌‍‍‌‌‍‍‌‌‌‍‌‌‍‍‍‌‌‍‍‌‌‍‍‌‌‍‍‍‌‌‍‍‌‌‌‍‌‌‍‍‍‌‌‍‍‌‌‍‍‌‌‍‍‍‌‌‍‍‌‌‌‍‌‌‍‍‍‌‌‍‍‌‌‍‍‌‌‌‍‌‌‍‍‌‌‍‍‍‌‌‍‍‌‌‌‍‌‌‍‍‍‌‌‍‍‌‌‍‍‌‌‌‍‌‌‍‍‍‌‌‍‍‌‌‌‍‌‌‍‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‍‌‌‍‍‌‌‌‍‌‌‍‍‍‌‌‍‍‌‌‍‍‌‌‍‍‍‌‌‍‍‌‌‍‍‌‌‌‍‌‌‍‍‍‌‌‍‍‌‌‍‍‌‌‌‍‌‌‍‍‍‌‌‍‍‌‌‍‍‌‌‍‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‍‌‌‍‍‌‌‍‍‌‌‌‍‌‌‍‍‍‌‌‍‍‌‌‍‍‌‌‌‍‌‌‍‍‍‌‌‍‍‌‌‍‍‌‌‌‍‌‌‍‍‍‌‌‍‍‌‌‌‍‌‌‍‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‍‌‌‍‍‌‌‍‍‍‌‌‍‍‌‌‍‍‌‌‍‍‍‌‌‍‍‌‌‍‍‍‌‌‍‍‌‌‌‍‌‌‍‍‍‌‌‍‍‌‌‍‍‌‌‍‍‍‌‌‍‍‌‌‍‍‍‌‌‍‍‌‌‍‍‌‌‍‍‍‌‌‍‍‌‌‌‍‌‌‍‍‍‌‌‍‍‌‌‍‍‍‌‌‍‍‌‌‍‍‍‌‌‍‍‌‌‌‍‌‌‍‍‍‌‌‍‍‌‌‍‍‌‌‍‍‍‌‌‍‍‌‌‍‍‌‌‍‍‍‌‌‍‍‌‌‌‍‌‌‍‍‍‌‌‍‍‌‌‌‍‍‌‌‍‍‍‌‌‍‍‌‌‍‍‍‌‌‍‍‌‌‍‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‍‌‌‍‍‌‌‌‍‌‌‍‍‍‌‌‍‍‌‌‍‍‌‌‍‍‍‌‌‍‍‌‌‍‍‌‌‌‍‍‍‌‌‍‍‌‌‍‍‌‌‍‍‍‌‌‍‍‌‌‍‍‍‌‌‍‍‌‌‍‍‍‌‌‍‍‌‌‌‍‌‌‍‍‍‌‌‍‍‌‌‌‍‌‌‍‍‍‌‌‍‍‌‌‍‍‍‌‌‍‍‌‌‍‍‌‌‍‍‍‌‌‍‍‌‌‌‍‌‌‍‍‍‌‌‍‍‌‌‍‍‍‌‌‍‍‌‌‍‍‍‌‌‍‍‌‌‍‍‍‌‌‍‍‌‌‍‍‌‌‍‍‍‌‌‍‍‌‌‌‍‌‌‍‍‍‌‌‍‍‌‌‌‍‌‌‍‍‍‌‌‍‍‌‌‍‍‍‌‌‍‍‌‌‍‍‍‌‌‍‍‌‌‌‍‍‌‌‍‍‌‌‍‍‍‌‌‍‍‌‌‌‍‍‌‌‍‍‌‌‍‍‍‌‌‍‍‌‌‍‍‍‌‌‍‍‌‌‍‍‌‌‍‍‍‌‌‍‍‌‌‌‍‌‌‍‍‍‌‌‍‍‌‌‌‍‌‌‍‍‍‌‌‍‍‌‌‍‍‍‌‌‍‍‌‌‍‍‌‌‌‍‌‌‍‍‍‌‌‍‍‌‌‍‍‌‌‍‍‍‌‌‍‍‌‌‌‍‍‌‌‍‍‌‌‍‍‍‌‌‍‍‌‌‌‍‍‌‌‍‍‍‌‌‍‍‌‌‍‍‌‌‍‍‍‌‌‍‍‌‌‌‍‌‌‍‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‌‍‍‌‌‍‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‍‌‌‍‍‌‌‍‍‌‌‍‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‍‌‌‍‍‌‌‍‍‌‌‍‍‍‌‌‍‍‌‌‍‍‌‌‌‍‌‌‍‍‍‌‌‍‍‌‌‍‍‌‌‍‍‍‌‌‍‍‌‌‍‍‌‌‍‍‍‌‌‍‍‌‌‍‍‌‌‍‍‍‌‌‍‍‌‌‍‍‌‌‍‍‍‌‌‍‍‌‌‍‍‌‌‌‍‌‌‍‍‍‌‌‍‍‌‌‍‍‍‌‌‍‍‌‌‍‍‍‌‌‍‍‌‌‍‍‌‌‍‍‍‌‌‍‍‌‌‌‍‌‌‍‍‍‌‌‍‍‌‌‍‍‌‌‍‍‍‌‌‍‍‌‌‌‍‌‌‍‍‍‌‌‍‍‌‌‍‍‍‌‌‍‍‌‌‌‍‌‌‍‍‍‌‌‍‍‌‌‍‍‍‌‌‍‍‌‌‌‍‌‌‍‍‍‌‌‍‍‌‌‍‍‌‌‌‍‍‌‌‍‍‍‌‌‍‍‌‌‍‍‌‌‍‍‍‌‌‍‍‌‌‌‍‌‌‍‍‍‌‌‍‍‌‌‍‍‍‌‌‍‍‌‌‍‍‌‌‌‍‌‌‍‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‌‍‌‌‍‍‍‌‌‍‍‌‌‌‍‌‌‍‍‍‌‌‍‍‌‌‍‍‌‌‌‍‍‌‌‍‍‍‌‌‍‍‌‌‌‍‌‌‍‍‍‌‌‍‍‌‌‌‍‌‌‍‍‍‌‌‍‍‍‌‌‍‍‌‌‌‍‌‌‍‍‍‌‌‍‍‌‌‌‍‌‌‍‍‍‌‌‍‍‌‌‍‍‍‌‌‍‍‌‌‌‍‌‌‍‍‍‌‌‍‍‌‌‍‍‍‌‌‍‍‌‌‌‍‍‌‌‍‍‌‌‍‍‍‌‌‍‍‌‌‍‍‌‌‌‍‍‌‌‍‍‌‌‍‍‍‌‌‍‍‍‌‌‍‍‌‌‍‍‍‌‌‍‍‌‌‌‍‌‌‍‍‍‌‌‍‍‌‌‍‍‍‌‌‍‍‍‌‌‍‍‌‌‍‍‌‌‌‍‍‌‌‌‍‌‌‍‍‍‌‌‍‍‌‌‌‍‌‌‍‍‍‌‌‍‍‌‌‍‍‌‌‍‍‍‌‌‍‍‌‌‍‍‍‌‌‍‍‌‌‍‍‍‌‌‌‍‌‌‍‍‍‌‌‍‍‌‌‍‍‍‌‌‍‍‌‌‌‍‌**⁠

/**
 * 跨端台账「门户维收敛」的**候选集编排** —— 纯函数(零 IO、零 Git、零全局态)。
 *
 * 立因(2026-10-31):门户收敛腿的候选集此前只看**逐条**行(gap / excluded),而段级豁免行的
 * web 键是通配串('admin/**')、门户承载集装的是真实路由名 —— 段级行自己进不了候选,
 * 被它罩着的那些路由在台账里又没有逐条行,于是**两头都不在候选集里**。
 * 后果:2026-10-30 实测 28 条"被门户表推翻的段级豁免"只能人工逐条补,机器永远修不了。
 *
 * 本模块只做**编排**(谁该被补、谁该让位、幂等如何保证);
 * **判据一件都不在这里复算**(§0.6 单一真相源):
 *   · 段级射程匹配(哪条路由落在哪枚段级豁免内)⇒ 尺子 `prefixScopeOf` / `routeInScope`;
 *   · "门户表说承载"⇒ 尺子 `collectPortalRoutes`;
 *   · "台账对该路由没有任何逐条认领"⇒ 尺子 `evaluateMap` 的 `prefixContradiction.items`;
 *   · 本模块只消费尺子**已经判好**的那份清单,不自己再匹配一遍射程。
 *
 * 硬边界(§0.10 —— 失效方向只能是"多要一次定向说明",绝不是"多放一次跳门"):
 *   ① **段级行本身只读**:本模块绝不改/删/缩段级豁免行。它的措辞与射程是人的裁决。
 *   ② **只补逐条 portal 行**:补的是"门户表已经判完"的同一句话的**更精确陈述**,
 *      不是新增豁免、不是放宽任何跳过集。
 *   ③ **让位优先于补**:生效面上已有该路由的逐条陈述(上一轮补过 / 他席在飞)⇒ 不动它,只点名。
 *   ④ **幂等**:同一路由在生效面上已有 portal 逐条陈述 ⇒ 不重复补。
 *   ⑤ **未判定不折成零**:取不到输入 ⇒ 整族一条都不补,并把理由显式点名(§0.3)。
 */

/** 门户维收敛的两个族。族名是**人可读的追责标签**,出现在结论行点名里。 */
export const PORTAL_FAMILY_PER_ROW = '逐条族'
export const PORTAL_FAMILY_PREFIX = '段级族'

/**
 * 台账行的"生效面"键集合 —— 幂等与让位闸共用这一把(§0.6:同口径只许一份实现)。
 * 生效面 = HEAD 面 ∪ 工作树面(落地就是往这个并集上写)。
 * @param {Array<{web?:string,status?:string}>} rows
 * @returns {{ all:Set<string>, portal:Set<string> }}
 */
export function effectiveWebSets(rows) {
  const all = new Set()
  const portal = new Set()
  for (const r of rows ?? []) {
    const web = String(r?.web ?? '')
    if (!web) continue
    all.add(web)
    if (String(r?.status ?? '') === 'portal') portal.add(web)
  }
  return { all, portal }
}

/**
 * 逐条族候选:台账里与门户表**互斥**的逐条判定行 ⇒ 改写成 portal 行。
 *
 * 为什么只取 gap / excluded 两档:这两档说的是"这一条**不**由 RN 承载",
 * 而门户表说"这一条由 WebView 承载" —— 两句互斥的话,门户表是承载事实的唯一源(§0.6)。
 * aligned / portal 两档说的是"承载",与门户表同向,不动。
 *
 * @param {object} p
 * @param {Array<{web?:string,status?:string}>} p.mapRows 台账行(读到的那个面)
 * @param {Set<string>|null} p.portalCarried 门户承载集(null = 门户表取不到 ⇒ 未判定)
 * @param {Set<string>} p.effectivePortalWebs 生效面上已有的 portal 逐条陈述(幂等闸)
 * @param {string} p.today 落盘日期戳
 * @returns {{ plan:Array<{row:object,family:string,detail:string}>, skips:string[] }}
 */
export function planPerRowFamily({ mapRows, portalCarried, effectivePortalWebs, today }) {
  const plan = []
  const skips = []
  for (const r of mapRows ?? []) {
    const status = String(r?.status ?? '')
    if (status !== 'gap' && status !== 'excluded') continue
    const web = String(r?.web ?? '')
    if (!web) continue
    if (!portalCarried?.has(web)) continue
    if (effectivePortalWebs.has(web)) {
      skips.push(`${web} —— 生效面上已是 portal 逐条陈述 ⇒ 不重复改写`)
      continue
    }
    plan.push({
      row: {
        web,
        status: 'portal',
        reason: `门户承载(web-portal.ts 推导@${today}):原在册 ${status}`,
        at: today,
      },
      family: PORTAL_FAMILY_PER_ROW,
      detail: `原在册 ${status}`,
    })
  }
  return { plan, skips }
}

/**
 * 段级族候选:门户表说承载、而台账对这一条**没有任何逐条认领**
 * (只被某枚段级豁免罩着)⇒ 补一条逐条 portal 行。
 *
 * `prefixItems` 是尺子 `evaluateMap` 的 `prefixContradiction.items` —— **判据已在尺子里判完**
 * (哪条路由落在哪枚段级豁免射程内、门户表说它承载、台账对它零逐条认领)。
 * 本函数只做"该不该补 / 让位给谁 / 幂等",不再自己匹配一遍射程(§0.6)。
 *
 * @param {object} p
 * @param {Array<{route?:string,prefix?:string,line?:number}>} p.prefixItems 尺子判好的段级互斥清单
 * @param {Set<string>} p.effectiveAnyWebs 生效面上已有的**任何**逐条陈述(让位闸)
 * @param {string} p.today 落盘日期戳
 * @returns {{ plan:Array<{row:object,family:string,detail:string}>, skips:string[] }}
 */
export function planPrefixFamily({ prefixItems, effectiveAnyWebs, today }) {
  const plan = []
  const skips = []
  // 同键不许两行(维四):两枚段级豁免罩着同一条路由时只补一行。
  const seen = new Set()
  for (const it of prefixItems ?? []) {
    const route = String(it?.route ?? '')
    if (!route) continue
    if (seen.has(route)) continue
    if (effectiveAnyWebs.has(route)) {
      skips.push(`${route} —— 生效面上已有逐条陈述(上一轮已补或他席在飞)⇒ 让位,不改写`)
      continue
    }
    seen.add(route)
    plan.push({
      row: {
        web: route,
        status: 'portal',
        reason: `门户承载(web-portal.ts 推导@${today}):段级豁免 ${it.prefix} 射程内、门户表说承载,补逐条陈述`,
        at: today,
      },
      family: PORTAL_FAMILY_PREFIX,
      detail: `段级豁免 ${it.prefix}(台账 L${it.line})`,
    })
  }
  return { plan, skips }
}

/**
 * 两族合并 + 幂等去重 + 未判定闸(总闸)。
 *
 * 合并顺序:逐条族在前、段级族在后 —— 同一条路由两族都命中时**逐条族优先**
 * (逐条是更具体的判定,段级是兜底射程;与尺子"更具体的判定赢"同一口径)。
 *
 * @param {object} p
 * @param {Array} p.mapRows 台账行
 * @param {Set<string>|null} p.portalCarried 门户承载集(null ⇒ 未判定)
 * @param {Set<string>} p.effectiveAnyWebs 生效面上已有的任何逐条陈述
 * @param {Set<string>} p.effectivePortalWebs 生效面上已有的 portal 逐条陈述
 * @param {Array} p.prefixItems 尺子判好的段级互斥清单
 * @param {string[]} p.undetermined 未判定理由(非空 ⇒ 一条都不补,§0.3)
 * @param {string} p.today 落盘日期戳
 * @returns {{ rows:Array<object>, families:Array<object>, skipped:string[], undetermined:string[] }}
 */
export function planPortalConverge({
  mapRows,
  portalCarried,
  effectiveAnyWebs,
  effectivePortalWebs,
  prefixItems,
  undetermined = [],
  enabled = true,
  portalSource = '门户表',
  today,
}) {
  const undet = [...(undetermined ?? [])]
  // 「档未开启」= 本腿没被判,一条都不补、也不记绿(§0.3:没判 ≠ 判过且无缺口)。
  // 调用方已知的取不到理由照实透传,不静默吞掉。
  if (!enabled) return { rows: [], families: [], skipped: [], undetermined: undet }
  // 门户表取不到 ⇒ 整维未判定:既不放宽跳过集,也不改写任何在册行(§0.3)。
  if (portalCarried === null)
    undet.push(`${portalSource}取不到 ⇒ 本族一条都不补(未判定,不记绿)`)
  if (undet.length > 0) {
    return { rows: [], families: [], skipped: [], undetermined: undet }
  }
  const perRow = planPerRowFamily({ mapRows, portalCarried, effectivePortalWebs, today })
  const prefix = planPrefixFamily({ prefixItems, effectiveAnyWebs, today })
  // 逐条族优先(更具体的判定赢);同键只留第一枚 —— 与尺子维四"同键不许两行"同向。
  // 去重只此一份实现:`families`(追责视图)与 `rows`(落盘视图)必须同源同序,
  // 两处各写一遍去重(一份 seen、一份 findIndex)迟早会漂成"点名了三条、只落了两条"。
  const seen = new Set()
  const merged = []
  for (const item of [...perRow.plan, ...prefix.plan]) {
    const web = String(item.row.web)
    if (seen.has(web)) continue
    seen.add(web)
    merged.push(item)
  }
  return {
    // 行本体直接取两族算好的那一枚(不在这里重拼 reason —— 反推字符串是脆的:
    // 改一个措辞就静默错字,而 reason 是台账里"为什么"的唯一凭据)。
    rows: merged.map((item) => item.row),
    families: merged.map((item) => ({
      web: String(item.row.web),
      family: item.family,
      detail: item.detail,
    })),
    skipped: [...perRow.skips, ...prefix.skips],
    undetermined: [],
  }
}

export const __test__ = {
  effectiveWebSets,
  planPerRowFamily,
  planPrefixFamily,
  planPortalConverge,
  PORTAL_FAMILY_PER_ROW,
  PORTAL_FAMILY_PREFIX,
}
