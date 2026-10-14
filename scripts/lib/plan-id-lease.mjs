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
 *
 * G-815400(2026-10-07):机器标识与段起点都混入机器指纹。
 *  ① 机器标识派生混入 machineGuid(Windows 注册表 MachineGuid / Linux /etc/machine-id):
 *    仅主机名+路径在"同 host 换仓根目录"的场景仍可 forgery 式趋同,GUID 是 OS 安装级唯一量。
 *    注意:本机旧租约行登记的是旧指纹 ⇒ 改后首次取号认不出自有段而另立新段 —— 失效方向是
 *    多占一段(安全侧),不撞别人的段。
 *  ② 新占段整体平移:段起点 = floor+1+off,off = hash(machineId|family|floor) % segmentSize,
 *    段尺寸不变(end = start + segmentSize - 1)。残余撞号面 = "两侧同刻/同 floor 新占段"——
 *    旧口径两侧起点/主键(段尾号)必然同值:F9 主键撞号必发生、首实号必撞;平移后两侧起点
 *    大概率分离(hash 熵 999 分之一同偏),主键随之分离,CAS 兜底仍在。无 machineId ⇒ off=0,
 *    与旧口径逐字同形(镜像 N2/N3 回归锁)。
 *
 * 池式改造(2026-10-14 拍板,"任务编号全量压缩到三位数"枚 A):
 *  千段租约落地后暴露了结构性膨胀 —— 每占一段就把全局 max 顶高 1000,floor 单调爬升,
 *  号位一路涨到七位数(G-1122550)。根治不是"忘了收号",而是"取号前沿只会单调向前"这一条:
 *  本日改池式 —— 每族号池 = 1..LEASE_POOL_MAX(硬上限 999,三位数);新占段不再越过 max,
 *  而是在池内找"连续 segmentSize 个全空闲"的窗,从最小空闲窗起排(多个候选窗时按机器指纹
 *  取模错开,两机同刻新占大概率落不同窗,CAS 兜底不变)。段满续占池内下一窗;整池再装不下
 *  一段 ⇒ 池满,拒绝发号(fail-loud)—— 宁可停下来逼人归档已完成任务腾号,绝不发 1000+。
 *  占用面口径:池内只认 ≤999 的号;归档件里 >999 的大号是存量债,不占池、不挡新号、
 *  也因此**不参与 floor** —— collectIdFace 的宽面(台账⊕归档件)照旧同面同轮,只是
 *  "什么号能发"由池这一层裁决。租约续占只认**完全落在池内**的段:池外的旧段是历史定格,
 *  续发就会突破上限 ⇒ 结构上不可续(失效方向 = 走池内新占段,安全侧)。
 *  归档回收咬合:archive-completed-tasks 归档 [x] 条目后台账只剩 HTML 注释占位,不占池;
 *  池的占用只随"新登记"增长、随"归档"从台账面让位 —— 池满即真实水位,不是误报。
 */
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { hostname } from 'node:os'
import { resolve } from 'node:path'

import { keyOfRow, parseTaskRows } from './plan-task-index.mjs'

/** 租约行的正文标记(解析与构造共用同一常量,两处各写一份字面量必漂)。 */
export const LEASE_MARK = '〔千段租约〕'

/** 台账里的租约登记区标题(appendLeaseRows 找它,找不到就在文件尾新建)。 */
export const LEASE_SECTION_TITLE = '## 号段租约登记区(取号器专用,千段租约制)'

/**
 * 段容量:一个租约段覆盖的号数。千段口径(1000)在池式下会把 999 的池一次吃满 ⇒ 改 50
 * (2026-10-14 拍板);`IHUI_LEASE_SEGMENT_SIZE` env 可覆写(1 < n ≤ 999 之外一律回落 50,
 * 覆写不得突破池上限)。测试与运维需要别的段宽时用它,生产缺省不动。
 */
export const LEASE_SEGMENT_SIZE = (() => {
  const raw = Number(process.env.IHUI_LEASE_SEGMENT_SIZE)
  return Number.isInteger(raw) && raw > 1 && raw <= 999 ? raw : 50
})()

/** 号池硬上限:每族取号池 = 1..LEASE_POOL_MAX(三位数,2026-10-14 拍板,env 不得覆写)。 */
export const LEASE_POOL_MAX = 999

/** 编号头形状,与 usedIdsOfPrefix 的判据同形(族名 + 可选分隔符 + 数字段)。 */
const ID_HEAD_RE = /^([A-Za-z]+)([-_ ]?)(\d+)/
const SEGMENT_RE = /段=([A-Za-z]+[-_ ]?)?(\d+)~(?:[A-Za-z]+[-_ ]?)?(\d+)/
const MACHINE_RE = /本机=([^\s（(〔【,，;；"']+)/

/** 机器 GUID 的模块级缓存(undefined=未读,''=读过但读不到,已降级)。 */
let machineGuidCache

/**
 * 机器 GUID:Windows 走注册表 MachineGuid,Linux 走 /etc/machine-id;读不到降级 ''。
 * 为什么模块级缓存:reg query 一次子进程数十 ms,批量令牌多次取号不重复付这个钱。
 */
function readMachineGuid() {
  if (machineGuidCache !== undefined) return machineGuidCache
  let guid = ''
  try {
    if (process.platform === 'win32') {
      const out = execFileSync(
        'reg',
        ['query', 'HKLM\\SOFTWARE\\Microsoft\\Cryptography', '/v', 'MachineGuid'],
        { stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8', windowsHide: true, timeout: 5000 },
      )
      guid = /MachineGuid\s+REG_SZ\s+(\S+)/.exec(out)?.[1] ?? ''
    } else {
      guid = readFileSync('/etc/machine-id', 'utf8').trim()
    }
  } catch {
    guid = '' // 降级:无 GUID 时指纹退回主机名+路径,机制不失效,只是熵变少
  }
  machineGuidCache = guid
  return guid
}

/**
 * 机器标识:env 显式给优先(部署机可自报稳定名);缺省 = 主机名 + 仓根路径⊕机器GUID 指纹(8 hex)。
 * 为什么带路径指纹:同机两份 checkout(D:/G: 两个盘符的工作区)是**两个取号主体**,
 * 只用主机名会让两份互借同一段,而它们各自 CAS 各自的 HEAD,借段会把段内连号打乱。
 * G-815400:GUID 混入指纹 —— 跨机同路径(容器/镜像克隆仓)不再同标识。
 */
export function machineIdentity(root) {
  const env = process.env.IHUI_MACHINE_ID
  if (env && env.trim()) return env.trim().replace(/\s+/g, '-')
  const fp = createHash('sha256')
    .update(`${resolve(String(root ?? '.')).toLowerCase()}|${readMachineGuid()}`)
    .digest('hex')
    .slice(0, 8)
  return `${String(hostname()).replace(/\s+/g, '-')}-${fp}`
}

/**
 * G-815400:新占段的段首偏移。off = hash(machineId|family|floor) % segmentSize,
 * 段起点 = floor+1+off(封顶 floor+segmentSize),段尺寸不变(end = start+segmentSize-1)。
 * 无 machineId ⇒ 0 —— 旧口径逐字同形;family/floor 缺省仅测试直调 leaseCursor 用,真实路径
 * 由 decideLease 恒给 family、floor 恒为实数。
 *
 * 池式下(2026-10-14)本函数保留同一实现、同一份 hash,但入参语义微调:leaseCursor 传
 * floor = 候选窗总数、segmentSize = 候选窗总数 ⇒ 返回值就是"第几个候选窗"的下标 ——
 * 同面同轮两机错窗的机理不变(hash 只随机器标识分离),错开熵从段容量变成整池窗数,
 * 反而更散。调用方不得把它当"段内偏移"复用。
 */
export function claimOffset({ machineId, family = '', floor = 0, segmentSize = LEASE_SEGMENT_SIZE }) {
  if (!machineId || !(segmentSize > 1)) return 0
  const h = createHash('sha256').update(`${machineId}|${family}|${floor}`).digest()
  return h.readUInt32BE(0) % segmentSize
}

/**
 * 池式占用视图(2026-10-14):把占用号收敛进池内。>poolMax 的大号不进 blocked —— 它们是
 * 归档件里的存量债,不占池、不挡新号;但 baseMax(远端只抬高那一份,≤poolMax 时)代表的
 * "本地看不见、对面可能已占"的那一段要一并避让,否则宽面盲区里的号会被重复发。
 * 返回 `{ blocked:Set<number>, lowMax:number }`,lowMax = 池内已见最大号(报告用,空池 = 0)。
 */
export function poolBlocked({ usedNumbers = [], baseMax = null, poolMax = LEASE_POOL_MAX } = {}) {
  const used = (Array.isArray(usedNumbers) ? usedNumbers : []).filter(Number.isFinite)
  const blocked = new Set(used.filter((n) => n >= 1 && n <= poolMax))
  const lowMax = blocked.size ? Math.max(...blocked) : 0
  if (Number.isFinite(baseMax) && baseMax <= poolMax)
    for (let n = lowMax + 1; n <= Math.min(baseMax, poolMax); n += 1) blocked.add(n)
  return { blocked, lowMax }
}

/**
 * 池内最小空闲号(1..poolMax 补集最小);池满 ⇒ null。
 * next-plan-id(第二发号出口)与 resolveIdTokens 的"无租约基准"共用这一份 —— 同一把尺,不抄第二份。
 */
export function smallestFreeId({ usedNumbers = [], baseMax = null, poolMax = LEASE_POOL_MAX } = {}) {
  const { blocked } = poolBlocked({ usedNumbers, baseMax, poolMax })
  for (let n = 1; n <= poolMax; n += 1) if (!blocked.has(n)) return n
  return null
}

/** 池内空闲号升序全表(批量发号的候选序与报告共用;池满 = 空数组)。 */
export function poolFreeList({ usedNumbers = [], baseMax = null, poolMax = LEASE_POOL_MAX } = {}) {
  const { blocked } = poolBlocked({ usedNumbers, baseMax, poolMax })
  const out = []
  for (let n = 1; n <= poolMax; n += 1) if (!blocked.has(n)) out.push(n)
  return out
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
 * 取号游标的租约判定(纯函数;2026-10-14 起池式)。
 *  - 自有段(按 machine)从最新段起找还有空闲的:**只认完全落在池内的段**(end ≤ poolMax)——
 *    池外旧段是历史定格,续发就突破三位数上限 ⇒ 不可续。段内已用 = usedNumbers ∩ [start,end]
 *    且**剔除本行主键**(主键是段尾号,不是实号) ⇒ 下一个 = 段内 max+1(空段 = 段首)。
 *  - 没有 / 段满 ⇒ 池内新占段:在 1..poolMax 里找"连续 segmentSize 个全空闲"的窗
 *    (避开已占号、避开一切租约段的保留位、避开 baseMax 代表的远端盲区段),
 *    多个候选窗时按下标 `hash(machineId|family|窗数) % 窗数` 错开(同面同轮确定性,
 *    两机大概率不同窗);**不再越过全局 max 单调爬升**。占不了窗 ⇒ mode:'pool-exhausted',
 *    调用方必须拒绝发号 —— 绝不发 poolMax 之外的号。
 *  baseMax 由调用方给"max(本地, 远端)":≤poolMax 时参与避让(远端只抬高),>poolMax 时
 *  说明对面还在旧口径发大号 ⇒ 池式不理它(双方号域不相交,结构性不撞)。
 */
export function leaseCursor({
  usedNumbers = [],
  leases = [],
  machineId,
  family,
  baseMax = null,
  segmentSize = LEASE_SEGMENT_SIZE,
  poolMax = LEASE_POOL_MAX,
}) {
  const used = (Array.isArray(usedNumbers) ? usedNumbers : []).filter(Number.isFinite)
  const mine = leases
    .filter(
      (l) =>
        l.machine === machineId &&
        Number.isFinite(l.start) &&
        Number.isFinite(l.end) &&
        l.end <= poolMax,
    )
    .sort((a, b) => b.start - a.start || b.end - a.end)
  for (const lease of mine) {
    const usedInRange = used.filter(
      (n) => n >= lease.start && n <= lease.end && n !== lease.primaryKeyNum,
    )
    const next = (usedInRange.length ? Math.max(...usedInRange) : lease.start - 1) + 1
    // 段尾这一号被本行主键自己占着(解析已验 主键=段尾),实号空间是 [start, end-1] ——
    // 判"还有空闲"必须用 next < end;写成 <= 会在段只剩末号时把租约行自己的主键发出去(镜像 T3 钉)。
    if (next < lease.end) return { mode: 'in-lease', next, lease, poolMax }
  }
  const { blocked } = poolBlocked({ usedNumbers: used, baseMax, poolMax })
  // 一切池内租约段(含他机)的保留位都不可落窗:那些号虽未入占用面,但已被租约行预留。
  const reserved = leases
    .filter((l) => Number.isFinite(l.start) && Number.isFinite(l.end) && l.end <= poolMax)
    .map((l) => [Math.max(1, l.start), Math.min(poolMax, l.end)])
  const inReserved = (n) => {
    for (const [a, b] of reserved) if (n >= a && n <= b) return true
    return false
  }
  const candidates = []
  for (let s = 1; s + segmentSize - 1 <= poolMax; s += 1) {
    let free = true
    for (let n = s; n < s + segmentSize; n += 1) {
      if (blocked.has(n) || inReserved(n)) {
        free = false
        break
      }
    }
    if (free) candidates.push(s)
  }
  if (candidates.length === 0) return { mode: 'pool-exhausted', poolMax, segmentSize }
  const off = claimOffset({ machineId, family, floor: candidates.length, segmentSize: candidates.length })
  const start = candidates[off]
  return { mode: 'claim', start, end: start + segmentSize - 1, poolMax }
}

/** resolveIdTokens 的族级胶水:解析 + 判定一次给全(调用方只传 usedIdsOfPrefix 的结果)。 */
export function decideLease({
  baseContent,
  family,
  used,
  baseMax,
  machineId,
  segmentSize,
  poolMax = LEASE_POOL_MAX,
}) {
  const leases = parseLeases(baseContent, family)
  const usedNumbers = (used?.ids ?? []).map((label) => {
    const m = ID_HEAD_RE.exec(String(label))
    return m ? Number(m[3]) : Number.NaN
  })
  return leaseCursor({ usedNumbers, leases, machineId, family, baseMax, segmentSize, poolMax })
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
