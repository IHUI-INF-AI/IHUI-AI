// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 审计策略判据(纯函数,零 IO)。
 *
 * 立因(2026-11-26):凌晨账号锁定事故取证时,现读 `auditpol /get /category:*` 发现
 * 60 条子类里 40 条 No Auditing、5 条只有 Success ——
 * Credential Validation(0CCE923F)/ Sensitive Privilege Use(0CCE9228)/
 * Security System Extension(0CCE9211)/ MPSSVC Rule-Level(0CCE9232)/ Kerberos 全盲。
 * 审计策略是取证链的地基:策略一关,下游所有哨兵读到的都是「空窗」,会判绿(§0.3 假绿)。
 *
 * 本库只做三件事:① 把 `auditpol /get /category:* /r` 的 CSV 解析成规范化行;
 * ② 按 GUID 对关键子类判分;③ 给出可执行补齐命令。判据不读盘、不派生子进程。
 *
 * 为什么必须按 GUID 匹配:实测本机 `auditpol /r` 的 Subcategory 列大量为空(只剩 GUID),
 * 按名字匹配会漏判;GUID 才是稳定身份。
 */

export const AUDIT_POLICY_STATE = Object.freeze({
  OK: 'ok',
  BREACH: 'breach',
  UNDETERMINED: 'undetermined',
})

/**
 * 关键子类表。GUID 取自微软 [MS-GPAC] 审计策略子类别规范(去掉花括号、小写)。
 * level: critical = 缺失即 breach(该面取证链断);standard = 缺失只记 observation。
 * why 用于告警与文档,点名「关掉之后哪类事件查不到」。
 */
export const AUDIT_SUBCATEGORIES = Object.freeze([
  { guid: '0cce9215-69ae-11d9-bed3-505054503030', name: 'Logon', level: 'critical', why: '4624 登录成功' },
  { guid: '0cce9216-69ae-11d9-bed3-505054503030', name: 'Logoff', level: 'critical', why: '4634/4647 注销' },
  { guid: '0cce9217-69ae-11d9-bed3-505054503030', name: 'Account Lockout', level: 'critical', why: '4740 账号被锁定' },
  { guid: '0cce9218-69ae-11d9-bed3-505054503030', name: 'Other Logon/Logoff', level: 'critical', why: '4648/4675/4778/4779' },
  { guid: '0cce921b-69ae-11d9-bed3-505054503030', name: 'Special Logon', level: 'critical', why: '4672 特权分配(提权面)' },
  { guid: '0cce923f-69ae-11d9-bed3-505054503030', name: 'Credential Validation', level: 'critical', why: '4776 凭据验证成功/失败(比 4625 更底层)' },
  { guid: '0cce9235-69ae-11d9-bed3-505054503030', name: 'User Account Management', level: 'critical', why: '4720/4722/4723/4724/4726 建号改密禁用删号' },
  { guid: '0cce9237-69ae-11d9-bed3-505054503030', name: 'Security Group Management', level: 'critical', why: '4728/4732/4756 加组(提权持久化头号信号)' },
  { guid: '0cce9236-69ae-11d9-bed3-505054503030', name: 'Computer Account Management', level: 'standard', why: '4741/4742/4743 机器账户变更' },
  { guid: '0cce9238-69ae-11d9-bed3-505054503030', name: 'Other Account Management', level: 'standard', why: '4780/4781/4794 等' },
  { guid: '0cce922f-69ae-11d9-bed3-505054503030', name: 'Audit Policy Change', level: 'critical', why: '4719 审计策略被改(反取证第一步)' },
  { guid: '0cce9230-69ae-11d9-bed3-505054503030', name: 'Authentication Policy Change', level: 'critical', why: '4739 认证策略变更' },
  { guid: '0cce9231-69ae-11d9-bed3-505054503030', name: 'Authorization Policy Change', level: 'standard', why: '4670 权限变更' },
  { guid: '0cce9228-69ae-11d9-bed3-505054503030', name: 'Sensitive Privilege Use', level: 'critical', why: '4673/4674 敏感特权使用(提权取证)' },
  { guid: '0cce9211-69ae-11d9-bed3-505054503030', name: 'Security System Extension', level: 'critical', why: '4697 服务安装(持久化头号信号)' },
  { guid: '0cce9232-69ae-11d9-bed3-505054503030', name: 'MPSSVC Rule-Level Policy Change', level: 'critical', why: '4946/4947/4950 防火墙规则变更' },
  { guid: '0cce9234-69ae-11d9-bed3-505054503030', name: 'Filtering Platform Policy Change', level: 'standard', why: '5440/5441/5442 WFP 策略变更' },
  { guid: '0cce9212-69ae-11d9-bed3-505054503030', name: 'System Integrity', level: 'critical', why: '4612/4615/4618/4621 完整性受损' },
  { guid: '0cce9210-69ae-11d9-bed3-505054503030', name: 'Security State Change', level: 'standard', why: '4608/4609 安全状态变更' },
  { guid: '0cce922b-69ae-11d9-bed3-505054503030', name: 'Process Creation', level: 'standard', why: '4688 进程创建(攻击链执行面;量大)' },
  { guid: '0cce9240-69ae-11d9-bed3-505054503030', name: 'Kerberos Service Ticket Operations', level: 'standard', why: '4769' },
  { guid: '0cce9242-69ae-11d9-bed3-505054503030', name: 'Kerberos Authentication Service', level: 'standard', why: '4768/4771' },
])

/** 刻意不开的子类(理由必须留在判据里,免得后人以为是漏了)。 */
export const INTENTIONALLY_UNSET = Object.freeze([
  {
    guid: '0cce921d-69ae-11d9-bed3-505054503030',
    name: 'File System',
    why: '需 SACL 才会产事件,开了也不产;且 4663 海量。取证靠 4688+进程树,不靠对象审计。',
  },
  {
    guid: '0cce921e-69ae-11d9-bed3-505054503030',
    name: 'Registry',
    why: '同上:需 SACL;持久化面已由 4697(服务)+4688(进程)覆盖。',
  },
  {
    guid: '0cce9223-69ae-11d9-bed3-505054503030',
    name: 'Handle Manipulation',
    why: '同上:需 SACL,单开无事件。',
  },
  {
    guid: '0cce9229-69ae-11d9-bed3-505054503030',
    name: 'Non Sensitive Privilege Use',
    why: '本机每天数万条 4674,噪声压垮 512MB 日志窗口,收益为零。',
  },
  {
    guid: '0cce922c-69ae-11d9-bed3-505054503030',
    name: 'Process Termination',
    why: '4689 只说明进程结束,无取证价值。',
  },
])

/** GUID 规范化:去花括号、小写、trim。 */
export function normalizeGuid(raw) {
  return String(raw ?? '')
    .trim()
    .replace(/^\{/, '')
    .replace(/\}$/, '')
    .toLowerCase()
}

/** 把 auditpol 的 Inclusion Setting 归成四档(both/success/failure/none)。中英双语。 */
export function levelOfSetting(raw) {
  const s = String(raw ?? '')
    .trim()
    .toLowerCase()
  if (!s || s.includes('no auditing') || s.includes('无审核') || s.includes('未审核')) return 'none'
  const hasSuccess = s.includes('success') || s.includes('成功')
  const hasFailure = s.includes('failure') || s.includes('失败')
  if (hasSuccess && hasFailure) return 'both'
  if (hasSuccess) return 'success'
  if (hasFailure) return 'failure'
  return 'none'
}

/** 引号感知的 CSV 单行切分(auditpol 输出字段可能含逗号,虽实测未见,但不能假设)。 */
export function splitCsvLine(line) {
  const out = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"'
        i += 1
      } else {
        inQuotes = !inQuotes
      }
    } else if (ch === ',' && !inQuotes) {
      out.push(cur)
      cur = ''
    } else {
      cur += ch
    }
  }
  out.push(cur)
  return out
}

/**
 * 解析 `auditpol /get /category:* /r` 的 CSV。
 * 返回 [{ machine, target, subcategory, guid, setting, exclusion }]。
 * 表头行按前两列含 "Machine Name" 识别;空行、非 6 列行丢弃(不猜)。
 */
export function parseAuditPolicyCsv(text) {
  const src = String(text ?? '')
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
  const rows = []
  for (const rawLine of src) {
    if (!rawLine.trim()) continue
    const cols = splitCsvLine(rawLine)
    if (cols.length < 5) continue
    if (/machine name/i.test(cols[0] || '') || /policy target/i.test(cols[1] || '')) continue
    const guid = normalizeGuid(cols[3])
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(guid)) continue
    rows.push({
      machine: String(cols[0] ?? '').trim(),
      target: String(cols[1] ?? '').trim(),
      subcategory: String(cols[2] ?? '').trim(),
      guid,
      setting: String(cols[4] ?? '').trim(),
      exclusion: String(cols[5] ?? '').trim(),
    })
  }
  return rows
}

/**
 * 判分。
 * @param {{ rows: Array|null, fetchError?: string|null, includeStandard?: boolean }} input
 * @returns {{ state: string, reason: string, missing: Array, critical: Array, standard: Array,
 *             checkedCount: number, bothCount: number, observations: string[] }}
 */
export function judgeAuditPolicy(input = {}) {
  const { rows, fetchError = null, includeStandard = false } = input
  const observations = []

  if (fetchError) {
    return {
      state: AUDIT_POLICY_STATE.UNDETERMINED,
      reason: `审计策略取不到: ${String(fetchError).split(/\r?\n/)[0]}`,
      missing: [],
      critical: [],
      standard: [],
      checkedCount: 0,
      bothCount: 0,
      observations: ['策略未知 ⇒ 下游「空窗」不能当正常读。按 §0.3 只报未判定,不冒绿。'],
    }
  }
  if (!Array.isArray(rows) || rows.length === 0) {
    return {
      state: AUDIT_POLICY_STATE.UNDETERMINED,
      reason: 'auditpol 未返回任何合法子类行(策略不可读)',
      missing: [],
      critical: [],
      standard: [],
      checkedCount: 0,
      bothCount: 0,
      observations: ['命令成功但零行 ⇒ 不判绿(§0.3:枚举到 0 个候选不记绿)。'],
    }
  }

  const byGuid = new Map()
  for (const r of rows) {
    if (!byGuid.has(r.guid)) byGuid.set(r.guid, r.setting)
  }

  const missing = []
  let bothCount = 0
  for (const sc of AUDIT_SUBCATEGORIES) {
    const setting = byGuid.has(sc.guid) ? byGuid.get(sc.guid) : null
    const lv = levelOfSetting(setting)
    if (lv === 'both') {
      bothCount += 1
      continue
    }
    missing.push({
      guid: sc.guid,
      name: sc.name,
      level: sc.level,
      why: sc.why,
      setting: setting ?? '(未出现在 auditpol 输出里)',
      missingSide: lv === 'none' ? '全部(现在无审核)' : lv === 'success' ? '失败面' : '成功面',
    })
  }

  const critical = missing.filter((m) => m.level === 'critical')
  const standard = missing.filter((m) => m.level === 'standard')

  if (critical.length) {
    return {
      state: AUDIT_POLICY_STATE.BREACH,
      reason: `关键审计子类未双开 ${critical.length} 条:${critical.map((m) => m.name).join(' / ')}`,
      missing,
      critical,
      standard,
      checkedCount: AUDIT_SUBCATEGORIES.length,
      bothCount,
      observations,
    }
  }
  if (standard.length && includeStandard) {
    return {
      state: AUDIT_POLICY_STATE.BREACH,
      reason: `--include-standard 档:standard 子类未双开 ${standard.length} 条`,
      missing,
      critical,
      standard,
      checkedCount: AUDIT_SUBCATEGORIES.length,
      bothCount,
      observations,
    }
  }
  if (standard.length) {
    observations.push(
      `standard 档未双开 ${standard.length} 条(不判 breach):${standard.map((m) => m.name).join(' / ')}`,
    )
  }
  return {
    state: AUDIT_POLICY_STATE.OK,
    reason:
      standard.length
        ? `关键子类全部双开;${standard.length} 条 standard 档未双开(只记观察)`
        : `关键子类 ${AUDIT_SUBCATEGORIES.length} 条全部双开`,
    missing,
    critical,
    standard,
    checkedCount: AUDIT_SUBCATEGORIES.length,
    bothCount,
    observations,
  }
}

/** 补齐命令(argv 形态,给 fixer 直接 execFileSync)。 */
export function buildAuditSetCommands(missing) {
  return (missing ?? []).map((m) => [
    '/set',
    `/subcategory:{${m.guid}}`,
    '/success:enable',
    '/failure:enable',
  ])
}

/** 人读/发信共用的处置清单。 */
export function remediationForAuditPolicy(result) {
  const out = []
  if (result.state === AUDIT_POLICY_STATE.BREACH) {
    out.push('一条命令补齐并自证:node scripts/security/check-audit-policy.mjs --apply')
    const sample = result.critical.slice(0, 3)
    for (const m of sample) {
      out.push(`手工单条:auditpol /set /subcategory:{${m.guid}} /success:enable /failure:enable  (${m.name} → ${m.why})`)
    }
    if (result.critical.length > sample.length) {
      out.push(`其余 ${result.critical.length - sample.length} 条见 --json 的 critical 数组`)
    }
    out.push('补完复跑 node scripts/security/check-audit-policy.mjs,要 exit 0 才算闭环')
  } else if (result.state === AUDIT_POLICY_STATE.UNDETERMINED) {
    out.push('先确认 auditpol 可用:auditpol /get /category:* /r 手工跑一次,看是否被组策略/权限挡住')
    out.push('取不到策略时,所有「空窗」结论都不可信(§0.3 未判定)')
  } else {
    if (Array.isArray(result.missing) && result.missing.length === 0) {
      out.push('无需动作:关键与 standard 子类都已双开')
    } else {
      out.push('无需动作;standard 档若想一起收,跑 node scripts/security/check-audit-policy.mjs --apply --include-standard')
    }
  }
  out.push('刻意不开 File System/Registry/Handle Manipulation:需 SACL 才产事件,开了只是噪声')
  return out
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
