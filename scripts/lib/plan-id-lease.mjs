// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 千段租约制 —— 跨机取号撞号的收敛机制(G-916936 机主拍板,2026-10-07 落地)。
 *
 * 缺陷本体(G-916936 票面):两台机在同一远端 max 上各取同号,并集收敛才撞出 F9;让号是
 * 自我循环 —— 对面下一轮还会发同一个号,因为两侧的"当前 max"本来就相同。能终止它的只有
 * 号段预留:每机取号前先用 CAS 占一个千号段,段内连号,段满另立下一段;占段撞了由 CAS
 * 重试换下一段,一次终止,不自我循环。
 *
 * 机制(为什么主键是**段尾号**):租约行是 done 形态的登记行,`usedIdsOfPrefix` 每行只取
 * 主键 ⇒ 段尾号入占用面即把"无租约感知的 max+1"顶到所有已占段**之外** —— 第二发号出口
 * (next-plan-id 的建议号)与未改造的出口不用改一行就自动避开本段;而持有机自己的取号器
 * 读租约行后段内连号。跨机撞号由此从"每个号都可能撞"收敛为"两侧同刻新占段才可能撞一次,
 * 且由 CAS 终止"。
 *
 * 行形态与各道门的互洽(立项当日逐条验过,勿凭记忆改形态):
 *  - `- [x]` done 形态 ⇒ 不进 open 待办计数(F1/F4 不动),归档器"无日期不搬"不会把段还回去;
 *  - 主键=段尾号 + 正文 `段=段首~段尾` 引用 ⇒ 畸形登记编号判据(族名出现两次)不命中;
 *  - 租约行只贡献主键号 ⇒ 段首号不占面,持有机第一个实号就是段首,一个号不浪费。
 *
 * 判据只有一份:行解析复用 `plan-task-index.mjs` 的 `parseTaskRows`/`keyOfRow`,本文件不抄
 * 第二份"什么算一个编号"。机器标识 = `IHUI_MACHINE_ID` env > 主机名+仓根路径指纹 —— 同机双
 * checkout(G:/D: 两份工作区共用同一远端)各占各段,不互借。
 */
import { createHash } from 'node:crypto'
import { hostname } from 'node:os'
import { resolve } from 'node:path'

import { keyOfRow, parseTaskRows } from './plan-task-index.mjs'

/** 租约行的正文标记(解析与构造共用同一常量,两处各写一份字面量必漂)。 */
export const LEASE_MARK = '〔千段租约〕'

/** 台账里的租约登记区标题(appendLeaseRows 找它,找不到就在文件尾新建)。 */
export const LEASE_SECTION_TITLE = '## 号段租约登记区(取号器专用,千段租约制)'

/** 段容量:一个租约段覆盖的号数(拍板口径"千段")。 */
export const LEASE_SEGMENT_SIZE = 1000

/** 编号头形状,与 usedIdsOfPrefix 的判据同形(族名 + 可选分隔符 + 数字段)。 */
const ID_HEAD_RE = /^([A-Za-z]+)([-_ ]?)(\d+)/
const SEGMENT_RE = /段=([A-Za-z]+[-_ ]?)?(\d+)~(?:[A-Za-z]+[-_ ]?)?(\d+)/
const MACHINE_RE = /本机=([^\s（(〔【,，;；"']+)/

/**
 * 机器标识:env 显式给优先(部署机可自报稳定名);缺省 = 主机名 + 仓根路径指纹(8 hex)。
 * 为什么带路径指纹:同机两份 checkout(D:/G: 两个盘符的工作区)是**两个取号主体**,
 * 只用主机名会让两份互借同一段,而它们各自 CAS 各自的 HEAD,借段会把段内连号打乱。
 */
export function machineIdentity(root) {
  const env = process.env.IHUI_MACHINE_ID
  if (env && env.trim()) return env.trim().replace(/\s+/g, '-')
  const fp = createHash('sha256')
    .update(resolve(String(root ?? '.')).toLowerCase())
    .digest('hex')
    .slice(0, 8)
  return `${String(hostname()).replace(/\s+/g, '-')}-${fp}`
}

/** 构造一行租约登记。template 取自 usedIdsOfPrefix 的该族形状(如 `G-%d`),不另写编号语法。 */
export function buildLeaseRow({ family, template, start, end, machineId }) {
  const tmpl = String(template ?? '')
  if (!tmpl.includes('%d')) throw new Error(`lease template missing %d: ${tmpl}`)
  if (!Number.isInteger(start) || !Number.isInteger(end) || start <= 0 || end < start)
    throw new Error(`lease segment invalid: ${start}~${end} (${family})`)
  const startLabel = tmpl.replace('%d', String(start))
  const endLabel = tmpl.replace('%d', String(end))
  return (
    `- [x] ${endLabel} ${LEASE_MARK} 本机=${machineId} 段=${startLabel}~${endLabel}` +
    `(取号器专用行:占用面只取本行主键=段尾号 ⇒ 无租约感知的 max+1 落在段外;` +
    `段内连号自段首起、由持有机取号器递增;段满由取号器另立下一段,占段撞号由 CAS 终止,不是让号自我循环)`
  )
}

/**
 * 从面里解析某族的租约行。三读数(主键/段/机)齐且互洽才算:主键必须等于段尾号 —— 手改漂移
 * 的行不认,宁可当"没有租约"走新占段(失效方向是多占一段,不是撞进别人的段)。
 */
export function parseLeases(content, family) {
  const want = String(family ?? '')
    .replace(/[^A-Za-z]/g, '')
    .toUpperCase()
  if (!want) return []
  const out = []
  for (const r of parseTaskRows(content)) {
    const raw = String(r.raw)
    if (!raw.includes(LEASE_MARK)) continue
    const key = keyOfRow(raw)
    if (!key) continue
    const kh = ID_HEAD_RE.exec(key)
    if (!kh || kh[1].toUpperCase() !== want) continue
    const seg = SEGMENT_RE.exec(raw)
    const mach = MACHINE_RE.exec(raw)
    if (!seg || !mach) continue
    const start = Number(seg[2])
    const end = Number(seg[3])
    if (!Number.isFinite(start) || !Number.isFinite(end) || start <= 0 || end < start) continue
    const segFamily = String(seg[1] ?? '')
      .replace(/[^A-Za-z]/g, '')
      .toUpperCase()
    if (segFamily && segFamily !== want) continue
    if (Number(kh[3]) !== end) continue
    out.push({
      raw,
      primaryKey: key,
      primaryKeyNum: Number(kh[3]),
      family: want,
      machine: mach[1],
      start,
      end,
    })
  }
  return out
}

/**
 * 取号游标的租约判定(纯函数)。
 *  - 自有段(按 machine)从最新段起找还有空闲的:段内已用 = usedNumbers ∩ [start,end] 且**剔除
 *    本行主键**(主键是段尾号,不是实号) ⇒ 下一个 = 段内 max+1(空段 = 段首)。
 *  - 没有 / 段满 ⇒ 新占段 [floor+1, floor+段容量],floor = max(本地已用, 租约主键, baseMax)。
 *    baseMax 由调用方给"max(本地, 远端)" —— 新占段必须站在两侧 Union 之上,否则占段本身就撞。
 */
export function leaseCursor({
  usedNumbers = [],
  leases = [],
  machineId,
  baseMax = null,
  segmentSize = LEASE_SEGMENT_SIZE,
}) {
  const used = (Array.isArray(usedNumbers) ? usedNumbers : []).filter(Number.isFinite)
  const keyNums = leases.map((l) => l.primaryKeyNum).filter(Number.isFinite)
  const floor = Math.max(0, ...used, ...keyNums, Number.isFinite(baseMax) ? baseMax : 0)
  const mine = leases
    .filter((l) => l.machine === machineId)
    .sort((a, b) => b.start - a.start || b.end - a.end)
  for (const lease of mine) {
    const usedInRange = used.filter(
      (n) => n >= lease.start && n <= lease.end && n !== lease.primaryKeyNum,
    )
    const next = (usedInRange.length ? Math.max(...usedInRange) : lease.start - 1) + 1
    // 段尾这一号被本行主键自己占着(解析已验 主键=段尾),实号空间是 [start, end-1] ——
    // 判"还有空闲"必须用 next < end;写成 <= 会在段只剩末号时把租约行自己的主键发出去(镜像 T3 钉)。
    if (next < lease.end) return { mode: 'in-lease', next, lease }
  }
  return { mode: 'claim', start: floor + 1, end: floor + segmentSize }
}

/** resolveIdTokens 的族级胶水:解析 + 判定一次给全(调用方只传 usedIdsOfPrefix 的结果)。 */
export function decideLease({ baseContent, family, used, baseMax, machineId, segmentSize }) {
  const leases = parseLeases(baseContent, family)
  const usedNumbers = (used?.ids ?? []).map((label) => {
    const m = ID_HEAD_RE.exec(String(label))
    return m ? Number(m[3]) : Number.NaN
  })
  return leaseCursor({ usedNumbers, leases, machineId, baseMax, segmentSize })
}

/**
 * 把租约行并进 next 内容:登记区在 ⇒ 行插到区头(最新在前,行间无序依赖);不在 ⇒ 文件尾
 * 新建(空行 + 标题 + 行)。只追加、不删不改任何既有行 —— 台账门 71 的防丢面见到的只是增量。
 */
export function appendLeaseRows(lines, rows) {
  const out = lines.map(String)
  const rowsList = rows.map(String)
  const idx = out.findIndex((l) => l.trim() === LEASE_SECTION_TITLE)
  if (idx >= 0) {
    out.splice(idx + 1, 0, ...rowsList)
    return out
  }
  out.push('', LEASE_SECTION_TITLE, ...rowsList)
  return out
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
