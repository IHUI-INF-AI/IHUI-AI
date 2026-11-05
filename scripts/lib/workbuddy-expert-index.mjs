// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * WorkBuddy 专家的「市场 ID ↔ 本地专家」映射(2026-11-05 立)。
 *
 * ## 为什么需要这一层
 *
 * 成长任务给的 `jump_url` 里是**市场专家 ID**(形如 `ex_GDl31WahyIH0`);
 * 而客户端专家页上的卡片,`data-track-props.source` 却是**本地专家名**
 * (形如 `ChinaEcommerceOperationsExpert`)。两者不是同一个字符串 ⇒
 * 只按 `source === 市场ID` 找,永远找不到卡;只按名字找,又会撞上一堆同名/近名专家。
 *
 * ## 桥:marketExpertId
 *
 * 实测本机 `~/.workbuddy/workbuddy.db`(会话落盘)里有权威对照:
 *   `{"v":2,"kind":"expert","expertId":"ChinaEcommerceOperationsExpert",
 *     "marketExpertId":"ex_GDl31WahyIH0","pluginRegisteredName":"china-ecommerce-operations-expert",…}`
 * ⇒ **`marketExpertId` 就是市场ID → 本地专家名 的桥**。
 * 另见 `~/.workbuddy/unified-asset/local-assets.json`:`{"experts":{"ex_XXX":{"localKey":"…","version":"…"}}}`。
 *
 * 本模块把这两份本机事实读出来、归一成一张映射表,并提供"按市场ID找本地专家名"的判据。
 * 读不到 ⇒ 返回空表并**点名未判定**(绝不猜一个名字凑数)。
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

/** WorkBuddy 用户数据目录 */
const WB_HOME = path.join(os.homedir(), '.workbuddy')
/** 本地资产表(专家ID ↔ localKey) */
const LOCAL_ASSETS = path.join(WB_HOME, 'unified-asset', 'local-assets.json')
/** 会话落盘库(里面带 marketExpertId 权威对照) */
const WB_DB = path.join(WB_HOME, 'workbuddy.db')

/** 从 unified-asset 表读「市场ID → localKey」 */
export function readLocalAssets(file = LOCAL_ASSETS) {
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'))
    const experts = raw?.experts ?? raw?.data?.experts ?? {}
    const out = {}
    for (const [eid, v] of Object.entries(experts)) {
      if (!eid || typeof v !== 'object') continue
      const localKey = String(v.localKey ?? v.local_key ?? '')
      if (!localKey) continue
      out[eid] = { localKey, version: String(v.version ?? '') }
    }
    return out
  } catch {
    return {}
  }
}

/**
 * 从会话落盘库里读「市场ID → 本地专家名」的权威对照。
 * 库是二进制 ⇒ 按字节找 `marketExpertId` 邻近的 JSON 片段。
 */
export function readMarketExpertMapping(dbFile = WB_DB) {
  const map = {}
  let buf
  try {
    buf = fs.readFileSync(dbFile)
  } catch {
    return map
  }
  const text = buf.toString('utf8')
  const re =
    /"marketExpertId"\s*:\s*"(ex_[A-Za-z0-9]+)"[\s\S]{0,400}?"expertId"\s*:\s*"([A-Za-z0-9_]+)"/g
  let m
  while ((m = re.exec(text)) !== null) {
    if (!map[m[1]]) map[m[1]] = m[2]
  }
  // 反向写法也收(有些片段 expertId 在前)
  const re2 =
    /"expertId"\s*:\s*"([A-Za-z0-9_]+)"[\s\S]{0,400}?"marketExpertId"\s*:\s*"(ex_[A-Za-z0-9]+)"/g
  while ((m = re2.exec(text)) !== null) {
    if (!map[m[2]]) map[m[2]] = m[1]
  }
  return map
}

/**
 * 合成本地专家索引:
 *   市场ID → { localKey, expertName, version }
 *
 * `expertName` 来自 marketExpertId 对照(权威);
 * `localKey` 来自 unified-asset(官方注册名,如 china-ecommerce-operations-expert);
 * 两者取不到 ⇒ 该市场ID 不进表(**未判定不冒充**)。
 */
export function buildExpertIndex({ dbFile = WB_DB, assetsFile = LOCAL_ASSETS } = {}) {
  const mapping = readMarketExpertMapping(dbFile)
  const assets = readLocalAssets(assetsFile)
  const index = {}
  for (const [eid, info] of Object.entries(assets)) {
    const localKey = info.localKey
    const expertName = mapping[eid] ?? ''
    index[eid] = {
      localKey,
      expertName,
      version: info.version,
      /** 本地专家名与 localKey 归一后是否一致(不一致说明账号侧另起了名字) */
      名与注册名一致: expertName ? expertName.toLowerCase() === localKey.toLowerCase() : null,
    }
  }
  // 会话库里出现过、但资产表没有的,补进去(至少有名字)
  for (const [eid, name] of Object.entries(mapping)) {
    if (!index[eid])
      index[eid] = { localKey: '', expertName: name, version: '', 名与注册名一致: null }
  }
  return index
}

/** 市场ID → 本地专家名(取不到 ⇒ '') */
export function localExpertNameOf(index, marketExpertId) {
  return index?.[marketExpertId]?.expertName ?? ''
}

/**
 * 给定一个候选 `source` 字符串,判断它是不是目标市场专家的本地名。
 * 兼容三种写法:市场ID 本地名 / localKey / 大小写差异。
 */
export function isLocalNameOf(index, marketExpertId, candidateSource) {
  const src = String(candidateSource ?? '')
  if (!src) return false
  if (src === marketExpertId) return true
  const info = index?.[marketExpertId]
  if (!info) return false
  if (info.expertName && src === info.expertName) return true
  if (info.localKey && src.toLowerCase() === info.localKey.toLowerCase()) return true
  return false
}

export const __test__ = {
  readLocalAssets,
  readMarketExpertMapping,
  buildExpertIndex,
  localExpertNameOf,
  isLocalNameOf,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
