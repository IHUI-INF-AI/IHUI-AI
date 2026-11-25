// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Windows 安全事件判据(纯函数,零 IO)。
 *
 * 立因(2026-11-26):凌晨账号锁定事故取证时实测 Security 日志只保留 4.6 小时
 * (01:55 → 06:31,上限 512MB + 滚动覆盖,4688 双开是主要噪声源)。
 * 审计策略已补齐 22 条双开之后事件只会更多,窗口只会更短 ⇒
 * **关键事件必须先增量抽取、永久落盘,再谈取证**;日志本身只当"实时缓存"。
 *
 * 本库只做三件事:① 事件 ID → 语义与严重级(内置固定目录);
 * ② 一批事件的判分(breach / watch / note);
 * ③ 日志窗口体检(最老事件距今 < N 小时即点名,不靠日志当档案)。
 */

export const EVENT_LEVEL = Object.freeze({ BREACH: 'breach', WATCH: 'watch', NOTE: 'note' })

/**
 * 事件目录。只收「取证有意义」的 ID;未收录的 ID 按 note 处理(仍落盘,不判红)。
 * level 口径:
 *   breach = 反取证/持久化/提权成功的直接信号,出现即判红并告警;
 *   watch  = 账户/权限/防火墙变更,落盘并计数,不单独判红(避免正常运维刷红);
 *   note   = 登录/进程等高频面,只落盘供关联。
 */
export const EVENT_CATALOG = Object.freeze({
  1102: { name: '审计日志被清空', level: EVENT_LEVEL.BREACH, why: '反取证头号信号:日志被清空后所有历史取证归零' },
  1100: { name: '事件日志服务关闭', level: EVENT_LEVEL.BREACH, why: '攻击者常先停日志服务' },
  /* 4719 归 watch 而不是 breach:本仓自己的补齐器(check-audit-policy.mjs --apply)每跑一次就产
     15 条 4719,判 breach 会把「合法运维」打成「攻击」。它是「必须人看一眼」而非「必须立即判红」。 */
  4719: { name: '审计策略被修改', level: EVENT_LEVEL.WATCH, why: '反取证常见手法;也可能是本仓补齐器所为,需人核对' },
  4697: { name: '服务安装', level: EVENT_LEVEL.BREACH, why: '持久化头号信号:装服务常伴随自启后门' },
  4732: { name: '成员加入本地组', level: EVENT_LEVEL.BREACH, why: '提权持久化:加入 Administrators/Remote Desktop Users' },
  4740: { name: '账号被锁定', level: EVENT_LEVEL.BREACH, why: '账号锁定事故的直接凭据' },
  4624: { name: '登录成功', level: EVENT_LEVEL.NOTE, why: '基线:谁在什么时候从哪登录' },
  4625: { name: '登录失败', level: EVENT_LEVEL.NOTE, why: '失败面基线(见账号锁定哨兵)' },
  4634: { name: '注销', level: EVENT_LEVEL.NOTE, why: '会话结束;与 4624 配对可算会话时长' },
  4647: { name: '用户发起注销', level: EVENT_LEVEL.NOTE, why: '用户主动注销;与 4624 配对可发现短会话与暴力节奏' },
  4648: { name: '显式凭据登录', level: EVENT_LEVEL.WATCH, why: 'runas/凭据切换,横向移动常见手法' },
  4672: { name: '分配特殊特权', level: EVENT_LEVEL.WATCH, why: '提权面:SeDebugPrivilege 等' },
  4673: { name: '敏感特权使用', level: EVENT_LEVEL.WATCH, why: '提权动作取证' },
  4674: { name: '特权对象操作', level: EVENT_LEVEL.NOTE, why: '高频,只落盘' },
  4688: { name: '进程创建', level: EVENT_LEVEL.NOTE, why: '攻击链执行面(402 万级噪声,只落盘不判)' },
  4720: { name: '创建用户账户', level: EVENT_LEVEL.WATCH, why: '持久化:建后门账号' },
  4722: { name: '启用账户', level: EVENT_LEVEL.WATCH, why: '启用被禁用的后门账号' },
  4723: { name: '修改自身密码', level: EVENT_LEVEL.WATCH, why: '用户改自己的密码;接管前铺路或凭据轮换' },
  4724: { name: '重置密码', level: EVENT_LEVEL.WATCH, why: '重置他人密码 = 接管账号的经典一步' },
  4725: { name: '禁用账户', level: EVENT_LEVEL.WATCH, why: '干扰可用性/清场,让原用户进不来' },
  4726: { name: '删除用户账户', level: EVENT_LEVEL.WATCH, why: '删号清痕迹,攻击者收尾常见动作' },
  4728: { name: '加入全局安全组', level: EVENT_LEVEL.WATCH, why: '域内提权' },
  4735: { name: '本地组被修改', level: EVENT_LEVEL.WATCH, why: '组成员变更' },
  4738: { name: '用户账户被修改', level: EVENT_LEVEL.NOTE, why: '属性变更' },
  4756: { name: '加入通用安全组', level: EVENT_LEVEL.WATCH, why: '域内提权' },
  4768: { name: '请求 Kerberos TGT', level: EVENT_LEVEL.NOTE, why: '认证基线' },
  4769: { name: '请求 Kerberos 服务票据', level: EVENT_LEVEL.NOTE, why: '认证基线' },
  4771: { name: 'Kerberos 预认证失败', level: EVENT_LEVEL.NOTE, why: 'Kerberos 预认证失败,暴力破解的第一手信号' },
  4776: { name: '凭据验证', level: EVENT_LEVEL.NOTE, why: 'NTLM 凭据验证(含失败)' },
  4946: { name: '防火墙规则添加', level: EVENT_LEVEL.WATCH, why: '放行面变更' },
  4947: { name: '防火墙规则修改', level: EVENT_LEVEL.WATCH, why: '放行面变更' },
  4948: { name: '防火墙规则删除', level: EVENT_LEVEL.WATCH, why: '防守面被削' },
  4950: { name: '防火墙规则变更', level: EVENT_LEVEL.WATCH, why: '放行面变更' },
  5440: { name: 'WFP 过滤器变更', level: EVENT_LEVEL.WATCH, why: '底层过滤策略变更' },
  5441: { name: 'WFP 提供程序变更', level: EVENT_LEVEL.WATCH, why: '底层过滤策略变更' },
  5442: { name: 'WFP 子层变更', level: EVENT_LEVEL.WATCH, why: '底层过滤策略变更' },
})

/** 抽取器默认只抽这些 ID(排除 4688 等超高频,4688 由账号哨兵按需另读)。 */
export const INTAKE_EVENT_IDS = Object.freeze(
  Object.keys(EVENT_CATALOG)
    .map(Number)
    .filter((id) => id !== 4688 && id !== 4674)
    .sort((a, b) => a - b),
)

/** ID → 目录项(未收录 ID 也返回结构化对象,level=note)。 */
export function describeEvent(id) {
  const key = Number(id)
  const hit = EVENT_CATALOG[key]
  if (hit) return { id: key, ...hit }
  return { id: key, name: `未分类事件 ${key}`, level: EVENT_LEVEL.NOTE, why: '不在目录里,只落盘' }
}

/**
 * 判一批已落盘/新抽取的事件。
 * @param {Array<{id:number, recordId?:number, ts?:string}>} records
 * @param {{ maxSample?: number }} [opts]
 */
export function judgeEventBatch(records, opts = {}) {
  const maxSample = Number(opts.maxSample) > 0 ? Number(opts.maxSample) : 20
  const list = Array.isArray(records) ? records : []
  if (list.length === 0) {
    return {
      state: 'ok',
      total: 0,
      breaches: [],
      watches: [],
      counts: {},
      reason: '本次增量 0 条(空窗)',
    }
  }
  const counts = {}
  const breaches = []
  const watches = []
  for (const r of list) {
    const d = describeEvent(r.id)
    counts[d.id] = (counts[d.id] || 0) + 1
    if (d.level === EVENT_LEVEL.BREACH) breaches.push({ ...r, name: d.name, why: d.why })
    else if (d.level === EVENT_LEVEL.WATCH) watches.push({ ...r, name: d.name, why: d.why })
  }
  const breachSummary = Object.entries(counts)
    .filter(([id]) => describeEvent(id).level === EVENT_LEVEL.BREACH)
    .map(([id, n]) => `${describeEvent(id).name}×${n}`)
  return {
    state: breaches.length ? 'breach' : 'ok',
    total: list.length,
    breaches: breaches.slice(0, maxSample),
    watches: watches.slice(0, maxSample),
    counts,
    reason: breaches.length
      ? `命中 ${breaches.length} 条高危事件:${breachSummary.join(' / ')}`
      : `本次 ${list.length} 条,无高危(watch ${watches.length} 条)`,
  }
}

/**
 * 日志窗口体检。取证靠抽取器落盘,但「日志窗口过短」本身要报:
 * 它意味着任何没被抽取器抓到的空档就永久消失。
 * @param {{ oldestTs: string|number|Date|null, newestTs: any, now?: number, minHours?: number }} input
 */
export function summarizeWindow(input = {}) {
  const minHours = Number(input.minHours) > 0 ? Number(input.minHours) : 6
  const nowMs = Number(input.now) || Date.now()
  const oldestMs = input.oldestTs === null || input.oldestTs === undefined ? NaN : Date.parse(String(input.oldestTs))
  const newestMs = input.newestTs === null || input.newestTs === undefined ? NaN : Date.parse(String(input.newestTs))
  if (!Number.isFinite(oldestMs)) {
    return { state: 'undetermined', hours: null, minHours, reason: '取不到最老事件时间(日志不可读或在空窗)' }
  }
  const hours = (nowMs - oldestMs) / 3_600_000
  const newestLagMin = Number.isFinite(newestMs) ? (nowMs - newestMs) / 60_000 : null
  const base = { hours: Number(hours.toFixed(2)), minHours, newestLagMin: newestLagMin === null ? null : Number(newestLagMin.toFixed(1)) }
  if (hours < minHours) {
    return {
      ...base,
      state: 'warn',
      reason: `Security 日志只保留 ${base.hours} 小时(< ${minHours}h 阈值):未被抽取器抓到的空档会永久消失`,
    }
  }
  if (newestLagMin !== null && newestLagMin > 120) {
    return { ...base, state: 'undetermined', reason: `最新事件距今 ${base.newestLagMin} 分钟(>120):日志采集可能已停` }
  }
  return { ...base, state: 'ok', reason: `日志窗口 ${base.hours} 小时(≥ ${minHours}h)` }
}

/** 增量过滤:只留 recordId 严格大于游标的记录;无 recordId 的一律丢(不猜顺序)。 */
export function filterAfterCursor(records, lastRecordId) {
  const cursor = Number(lastRecordId) || 0
  return (Array.isArray(records) ? records : []).filter(
    (r) => Number.isFinite(Number(r?.recordId)) && Number(r.recordId) > cursor,
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
