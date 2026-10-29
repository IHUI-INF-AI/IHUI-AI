// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * ui-mirror-waivers.mjs —— 「档 → 类」镜像判据的**具名豁免判序**唯一出口(2026-10-28 立)。
 *
 * 为什么要有它:跨端镜像族里有两类判据同时在看「小程序壳有没有跟上 RN 壳的 spec 接线」——
 *   · `scripts/check-ui-spec-mirror.mjs` 判**消费面**(常量名有没有出现在壳里);
 *   · `scripts/gen-ui-mirror.mjs` 判**绑定块**(档 → 类映射表与 RN 逐字相等)。
 * 而有些名字本端**在物理上不可能照抄**:weapp-tailwindcss 的 content 只扫 `apps/miniapp-taro/src/**`,
 * 把类名表搬进 spec 就产不出规则(头像是第一个实例)。这种例外必须有地方写,且两把尺子必须读同一份,
 * 否则第二份必然漂移(AGENTS §0.6)。判序因此只在这里实现一次,两个调用方各自 import。
 *
 * 台账位置 `scripts/data/ui-mirror-waivers.json`;每条形如
 * `{ pair, names[], reason, reviewBy }`。判序四态(AGENTS §0.7「验过才免且会到期」、§0.10
 * 「失效方向是多要一次定向说明,绝不是多放一次跳门」):
 *   · `used`    —— 本被审面确实缺这些名、未过期、行形态合格 ⇒ 扣掉;
 *   · `expired` —— reviewBy 已到/过期 ⇒ 不免,回队列逐条点名;
 *   · `rot`     —— 登记的名字在本被审面已不再缺 ⇒ **清单腐烂判红**(豁免不得长成白名单);
 *   · 行形态不合格(缺 names / reason 短于 10 字 / reviewBy 不是 YYYY-MM-DD)⇒ 免不了任何东西并进 rot 点名。
 *
 * **取材面纪律(§0.4)**:判序本身不含 IO。台账由调用方从**它自己要审的那一面**读进来
 * (门读 HEAD blob,派生器读工作树),清单与内容同面同轮 —— 绝不在判 HEAD 时回落磁盘。
 */

export const WAIVER_LEDGER_REL = 'scripts/data/ui-mirror-waivers.json'

/** 台账文本解析。两种"拿不到"必须分开,方向不同:
 *  - **在被审面上不存在**(`null`)⇒ 零豁免继续判(`ok:true, absent:true`)。
 *    豁免是"放宽"用的输入,它缺失只会让判定**更严**,不会让判定失效;
 *    把它读成"未判定"会让所有"门体已同步、台账还在路上"的交错面(多会话并发收敛的常态)
 *    集体报 exit 2 —— 与提交内容无关的红/黄门,唯一结局是逼人跳门(§12e)。
 *  - **存在但读不出结构**(坏 JSON / 缺 `waivers` 数组 / 空文本)⇒ `ok:false`,调用方按未判定处理,
 *    既不记绿也不冒红(§0.3):这份文件明明在,却没人知道里面免了什么。 */
export function parseWaivers(text) {
  if (text === null || text === undefined) return { ok: true, waivers: [], absent: true }
  let parsed
  try {
    parsed = JSON.parse(text)
  } catch (error) {
    return { ok: false, waivers: [], error: error?.message ?? String(error) }
  }
  if (!Array.isArray(parsed?.waivers))
    return { ok: false, waivers: [], error: `${WAIVER_LEDGER_REL} 缺 waivers 数组` }
  return { ok: true, waivers: parsed.waivers }
}

/** 本日被判定用哪个时刻(可注入,自检要钉日期)。 */
export function todayIso(date = new Date()) {
  return date.toISOString().slice(0, 10)
}

/** 一条豁免行是否形态合格(有名字、有 ≥10 字定向说明、日期是 YYYY-MM-DD)。 */
function rowOk(entry) {
  return (
    Array.isArray(entry?.names) &&
    entry.names.length > 0 &&
    typeof entry?.reason === 'string' &&
    entry.reason.trim().length >= 10 &&
    typeof entry?.reviewBy === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(entry.reviewBy)
  )
}

/**
 * 对一个被审面(某一对壳的「RN 侧有而小程序侧缺」名单)执行豁免判序。
 * @returns {{used:string[], expired:string[], rot:string[]}}
 */
export function waiverVerdict(pair, missingNames, waivers, today = todayIso()) {
  const used = []
  const expired = []
  const rot = []
  const hit = new Set()
  for (const entry of waivers || []) {
    if (entry?.pair !== pair) continue
    if (!rowOk(entry)) {
      rot.push(`${pair}: 豁免行形态不合格(需 names + reason≥10字 + reviewBy=YYYY-MM-DD)`)
      continue
    }
    const isExpired = entry.reviewBy < today
    for (const name of entry.names) {
      if (isExpired) {
        expired.push(`${pair}.${name}(reviewBy=${entry.reviewBy})`)
        continue
      }
      if (missingNames.includes(name)) {
        used.push(name)
        hit.add(name)
      }
    }
  }
  // 第二轮:活着的豁免行里,一个名字都没被本面命中 ⇒ 这条登记已是腐烂清单(§0.7)
  for (const entry of waivers || []) {
    if (entry?.pair !== pair || !rowOk(entry) || entry.reviewBy < today) continue
    const dead = entry.names.filter((name) => !hit.has(name) && !missingNames.includes(name))
    for (const name of dead) rot.push(`${pair}.${name}(被审面已不再缺这一名)`)
  }
  return { used, expired, rot }
}

export const __test__ = { parseWaivers, rowOk, todayIso, waiverVerdict }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
