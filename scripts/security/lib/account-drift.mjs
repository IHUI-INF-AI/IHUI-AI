#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 账号与凭据面判据(2026-11-25 立)。
 *
 * 为什么是这一面:
 *   host-triage 的 persistence 只盯三种入口: 注册表 run-key / 服务 / 计划任务。
 *   攻击者手里还有三条更安静的路,一条都没被盯:
 *     ① 新建本地用户 —— 直接拿到一个长期身份,且不出现在任何任务清单里;
 *     ② 把自己加进 Administrators —— 用别人的名字拿到最高权限;
 *     ③ 往 authorized_keys 里塞一条自己的公钥 —— 不需要密码、不触发登录审计,
 *        而且这条公钥在文件里长得和正常的那几条一模一样。
 *   三条的共同点: 加进去之后系统一切正常,每条判据都还是绿的。
 *
 * 判据只认「相对基线新增」。基线必须由人来确认一次 —— 自动落的基线会把攻击者
 * 已经写进去的东西一起当成"本来就这样"。
 *
 * 语义:
 *   新增 ⇒ breach(这三类面上的新增,要么是攻击,要么是需要立刻解释的运维动作)
 *   消失 ⇒ warn(可能是正常清理;但删管理员/删公钥也可能是攻击者在掩盖痕迹,要人看一眼)
 *   首次无基线 ⇒ undetermined(不记绿)
 *
 * 本层纯函数零 IO。
 */

export const ACCOUNT_STATE = Object.freeze({
  OK: 'ok',
  BREACH: 'breach',
  UNDETERMINED: 'undetermined',
})

/** 三个受管面。新增任何一条都判 breach。 */
export const ACCOUNT_CLASSES = Object.freeze([
  { id: 'local-user', label: '本地用户账户' },
  { id: 'admin-group', label: '管理员组成员' },
  { id: 'ssh-key', label: 'SSH 授权公钥' },
])

const CLASS_IDS = ACCOUNT_CLASSES.map((c) => c.id)

/** 归一化一行清单:去首尾空白、压内部空白、小写(仅用于比对,展示保留原文)。 */
export function normalizeEntry(v) {
  return String(v == null ? '' : v).trim().replace(/\s+/g, ' ').toLowerCase()
}

/**
 * 比较一份清单的新增与消失。
 * @returns {{added:string[],removed:string[],unchanged:number}}
 */
export function diffClass(baseline, current) {
  const b = new Set((baseline || []).map(normalizeEntry).filter(Boolean))
  const c = new Set((current || []).map(normalizeEntry).filter(Boolean))
  const added = []
  const removed = []
  for (const k of c) if (!b.has(k)) added.push(k)
  for (const k of b) if (!c.has(k)) removed.push(k)
  return { added, removed, unchanged: [...c].filter((k) => b.has(k)).length }
}

/**
 * 判一份完整快照。
 * @param {{baseline?:object|null,current:object}} input
 *   baseline/current 形状: { 'local-user': string[], 'admin-group': string[], 'ssh-key': string[] }
 * @param {{now?:number}} opts
 * @returns {{state:string,perClass:object[],addedAll:string[],removedAll:string[],
 *            totalCurrent:number,reason:string}}
 */
export function judgeAccountDrift(input, opts = {}) {
  void opts
  const baseline = input?.baseline
  const current = input?.current || {}

  /* 没有基线 ⇒ 未判定。绝不把"当前这份"自动当成基线。 */
  if (!baseline || typeof baseline !== 'object') {
    return {
      state: ACCOUNT_STATE.UNDETERMINED,
      perClass: [],
      addedAll: [],
      removedAll: [],
      totalCurrent: CLASS_IDS.reduce((n, id) => n + (current[id]?.length || 0), 0),
      reason: '没有基线,无法判新增(首次需人工确认后落基线)',
    }
  }

  const perClass = []
  const addedAll = []
  const removedAll = []
  let totalCurrent = 0

  for (const cls of ACCOUNT_CLASSES) {
    const cur = Array.isArray(current[cls.id]) ? current[cls.id] : []
    const base = Array.isArray(baseline[cls.id]) ? baseline[cls.id] : []
    totalCurrent += cur.length
    const d = diffClass(base, cur)
    perClass.push({ id: cls.id, label: cls.label, ...d, total: cur.length })
    for (const a of d.added) addedAll.push(`${cls.id}:${a}`)
    for (const r of d.removed) removedAll.push(`${cls.id}:${r}`)
  }

  /* 取不到任何一面 ⇒ 未判定,不因为"看起来没新增"就记绿。 */
  if (totalCurrent === 0) {
    return {
      state: ACCOUNT_STATE.UNDETERMINED,
      perClass,
      addedAll,
      removedAll,
      totalCurrent: 0,
      reason: '三个面都没采到内容(采集失败,不是"干净")',
    }
  }

  let state = ACCOUNT_STATE.OK
  let reason
  if (addedAll.length > 0) {
    state = ACCOUNT_STATE.BREACH
    reason = `${addedAll.length} 条新增: ${addedAll.slice(0, 6).join('、')}`
  } else if (removedAll.length > 0) {
    reason = `${removedAll.length} 条消失(需确认是否正常清理): ${removedAll.slice(0, 6).join('、')}`
  } else {
    reason = `${totalCurrent} 条与基线一致`
  }
  return { state, perClass, addedAll, removedAll, totalCurrent, reason }
}

/** 给每条新增/消失一句可执行的下一步。 */
export function remediationForAccount(result) {
  const out = []
  const kindOf = (s) => String(s).split(':')[0]
  const valOf = (s) => String(s).split(':').slice(1).join(':')
  for (const a of result?.addedAll || []) {
    const k = kindOf(a)
    const v = valOf(a)
    if (k === 'ssh-key') {
      out.push(`ssh-key ${v}: 立即 grep -n "${v}" C:\\ProgramData\\ssh\\administrators_authorized_keys C:\\Users\\*\\\.ssh\\authorized_keys 定位;不认识就删掉该行并查 sshd 日志里该指纹的登录记录`)
    } else if (k === 'admin-group') {
      out.push(`admin-group ${v}: net localgroup administrators ${v} /delete 移除;同时确认该账号是否该存在`)
    } else {
      out.push(`local-user ${v}: net user ${v} 查创建时间与最后登录;不认识就 net user ${v} /delete`)
    }
  }
  for (const r of result?.removedAll || []) {
    out.push(`${r}: 消失条目,确认是正常清理;若是管理员/公钥被删且没人解释,按掩盖痕迹处理`)
  }
  return out
}

export const __test__ = { CLASS_IDS, normalizeEntry }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
