// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 计划号域族注册表(唯一真相源,RP-1 / 2026-11-03)。
 *
 * 立因:取号器(`scripts/next-plan-id.mjs`)的族名校验按**单字母**假设写死(`/^[A-Za-z]$/`),
 * 于是台账里已开张的 `RP` 两字母族结构上取不到号(手填号绕过 keepIfFree / 撞号扫描 / 租约)。
 * 现在族的第一等判据改成这张**显式允许表**:每个在册族带段宽与池上限,未登记族一律拒。
 *
 * 单字母族:2026-10-24 拍板"一个字母就是一个系列" ⇒ A–Z 全部在册,段宽/池上限取
 * `plan-id-lease.mjs` 的同一份常量 ⇒ 单字母行为与改前逐字同形(不在这里另抄一份数字)。
 * 多字母族:只认显式登记的那几枚(`RP`),不是"任意多字母都收"。
 */
// 常量只许有一个来源(§22c):段宽/池上限住在 plan-id-lease.mjs,本表引用而不复算。
import { LEASE_POOL_MAX, LEASE_SEGMENT_SIZE } from './plan-id-lease.mjs'

/** 单字母族 = A–Z 全表(顺序固定,便于报告按字母序点名)。 */
const SINGLE_LETTER_FAMILIES = Object.freeze([
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
  'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z',
])

/**
 * 多字母族(显式登记):`separator` = 该族在标题/登记行里的书写分隔符(可省)。
 * RP 的台账行写作 `RP-47` / `RP47` 两种,故标题判据允许 `[-_ ]?`。
 */
const MULTI_LETTER_FAMILIES = Object.freeze([{ name: 'RP', separator: '-' }])

/** 单条族目:段宽与池上限一律引用 lease 常量,`multiLetter` 供取号器选标题形状。 */
function familyEntry(name, separator) {
  return Object.freeze({
    name,
    separator,
    multiLetter: name.length > 1,
    segmentWidth: LEASE_SEGMENT_SIZE,
    poolMax: LEASE_POOL_MAX,
  })
}

export const PLAN_ID_FAMILY_REGISTRY = Object.freeze(
  Object.fromEntries(
    [
      ...SINGLE_LETTER_FAMILIES.map((name) => familyEntry(name, '')),
      ...MULTI_LETTER_FAMILIES.map((f) => familyEntry(f.name, f.separator)),
    ].map((entry) => [entry.name, entry]),
  ),
)

/** 在册族名(报告与错误文案用;单字母在前、多字母在后)。 */
export const PLAN_ID_FAMILY_NAMES = Object.freeze(Object.keys(PLAN_ID_FAMILY_REGISTRY))

/**
 * 族名归一 + 查表。未登记 ⇒ null(调用方必须拒发,不得静默退回缺省族)。
 * 大小写不敏感(`rp` → `RP`),但不做拼写容错(`R-P` / `R.P` 一律不在册)。
 */
export function lookupPlanIdFamily(raw) {
  if (typeof raw !== 'string') return null
  const name = raw.toUpperCase()
  return PLAN_ID_FAMILY_REGISTRY[name] ?? null
}

/** 错误文案里的可读族表(单字母折叠成 A–Z + 多字母逐一点名)。 */
export function describeRegisteredFamilies() {
  return `A–Z 单字母 + ${MULTI_LETTER_FAMILIES.map((f) => f.name).join('/')} 多字母`
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
