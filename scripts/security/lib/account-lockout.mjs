#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 账号锁定与失败登录突发判据(2026-11-26 立)。
 *
 * 为什么单列一维:account-drift 盯「身份被加进来」,host-triage 盯「持久化入口」,
 *   调度健康盯「任务起不起得来」—— 而「有人在短窗口内把本机账号打到锁定」这一条,
 *   此前没有任何判据在读。2026-11-26 02:29:09 / 02:48:29 两次 4740(Administrator 被锁),
 *   40 分钟内上百次 4625;锁定本身又连锁把 S4U 计划任务一批批拖起不来(见
 *   scheduler-health 的「启动失败 = 登录失败」维),整条安全链在那段时间是瞎的。
 *
 * 两类信号:
 *   · 4740 账号被锁定 —— 硬信号,命中即 breach(不需要再攒次数);
 *   · 4625 失败登录突发 —— 在滑动窗口内按稳定身份聚合,单组达到突发阈值才 breach;
 *     零星几次不达阈值记 ok(本机 S4U/服务偶发失败属噪声,不把它当攻击,见 A6 恒红门禁令)。
 *
 * 三维聚合点名(与现场 2026-11-26 实测对齐):
 *   · 调用方进程 ProcessName(4688 按 ProcessId 兜底补全)
 *   · 目标用户 TargetUserName
 *   · 登录类型 LogonType
 *   另带 Status(0xc000006d=用户名或密码错 / 0xc0000234=账号已锁定)、时间跨度与不同 PID 数,
 *   输出能直接还原「sshd-session.exe 102 次 · 类型 3/8」「chrome.exe 11 次 · 类型 2 ·
 *   0xc000006d,02:47–02:48 一分钟内 10 次」这样的句子。
 *
 * 三态 ok / breach / undetermined,语义与 account-drift / scheduler-health 同族。
 * 本层纯函数零 IO;时间一律由调用方注入(opts.now) ⇒ 可测、可回放。
 *
 * 判据纪律(§0.3):取不到事件(采集失败)⇒ undetermined 并点名原因,绝不冒充绿;
 *   空窗口(采到 0 条且采集成功)⇒ ok,不误报。两者必须分开,不能混成一个「0 条」。
 */

export const LOCKOUT_STATE = Object.freeze({
  OK: 'ok',
  BREACH: 'breach',
  UNDETERMINED: 'undetermined',
})

/** 主滑动窗口(分钟)。4740/4625 只在这个窗内计突发。 */
export const DEFAULT_WINDOW_MIN = 30

/** 风暴标注窗(分钟)与阈值:同一稳定身份在该窗内 ≥ 阈值次即标注风暴(复用告警身份去重思路)。 */
export const STORM_WINDOW_MIN = 60
export const STORM_THRESHOLD = 2

/** 单聚合组在主窗口内达到该次数才判「失败登录突发」。4740 命中不受此阈值约束。 */
export const DEFAULT_BURST_THRESHOLD = 5

/**
 * 本机账号锁定策略的三态(2026-11-26 立)。
 *
 * 立因(实测):Windows 的「失败计数」不区分来源——隧道侧 sshd 的 publickey 失败、
 * 本机自动化 Chrome 的 Type 2 Negotiate 失败,都计入同一个 Administrator 计数器。
 * 也就是说,任何人只要能连到 sshd 就能给本机账号"投票"锁死它,而密码认证已关
 * (密码暴破本就不可能成功)。此时锁定策略唯一的效果是把自己的 S4U 计划任务
 * (git-guardian / Pool-Sync / Zombie-Guardian)一起打死 —— 远程可触发的 DoS 面。
 *
 * 因此判据分两档:
 *   DISABLED(阈值 0/Never)  ⇒ 4625 突发只「观测」不判 breach(无锁定后果),4740 仍判红;
 *   ENABLED(阈值 > 0)       ⇒ 沿用突发判红,并额外提示 DoS 面;
 *   UNDETERMINED(读不到)    ⇒ 未判定,不冒绿也不冒红。
 */
export const LOCKOUT_POLICY = Object.freeze({
  DISABLED: 'disabled',
  ENABLED: 'enabled',
  UNDETERMINED: 'undetermined',
})

/**
 * 解析账号锁定阈值,支持两种真实文本面(纯函数,便于测试),不自己跑命令。
 *
 * ① `secedit /export /cfg <inf> /areas SECURITYPOLICY` 导出的 inf(ASCII 键,无码页问题)
 *    键名 `LockoutBadCount`;空值/缺失 = 未配置(未判定)。
 * ② `net accounts` 的 stdout。**注意**:该命令往管道写时用 OEM 码页(本机 936),
 *    Node 按 utf8 解会把中文行读成乱码 —— 英文 locale 才可用,故只作兜底。
 *
 * @param {string|null} text
 * @returns {{state:string,threshold:number|null,raw:string}}
 */
export function parseLockoutThreshold(text) {
  if (typeof text !== 'string' || !text.trim()) {
    return { state: LOCKOUT_POLICY.UNDETERMINED, threshold: null, raw: '' }
  }
  /* 面 ①:secedit inf。 */
  const ini = text.match(/^\s*LockoutBadCount\s*=\s*([0-9]*)\s*$/m)
  if (ini) {
    const raw = String(ini[1] || '').trim()
    if (raw === '') return { state: LOCKOUT_POLICY.UNDETERMINED, threshold: null, raw: '' }
    const n = Number(raw)
    return {
      state: n === 0 ? LOCKOUT_POLICY.DISABLED : LOCKOUT_POLICY.ENABLED,
      threshold: n,
      raw,
    }
  }
  /* 面 ②:net accounts。英文与中文两套措辞都认。 */
  const m = text.match(/Lockout threshold:\s*([^\r\n]+)/i) || text.match(/锁定阈值:\s*([^\r\n]+)/)
  if (!m) return { state: LOCKOUT_POLICY.UNDETERMINED, threshold: null, raw: '' }
  const raw = String(m[1]).trim()
  if (/never/i.test(raw) || /从不|永不/.test(raw)) {
    return { state: LOCKOUT_POLICY.DISABLED, threshold: 0, raw }
  }
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 0) {
    return { state: LOCKOUT_POLICY.UNDETERMINED, threshold: null, raw }
  }
  return {
    state: n === 0 ? LOCKOUT_POLICY.DISABLED : LOCKOUT_POLICY.ENABLED,
    threshold: n,
    raw,
  }
}

/** 已知的 4625 Status 码(NTSTATUS)。认不出的原样传出,不猜语义。 */
const STATUS_LABELS = Object.freeze({
  '0xc000006d': '用户名或密码错',
  '0xc0000234': '账号已锁定',
  '0xc000006a': '用户名正确但密码错',
  '0xc0000193': '账号过期',
  '0xc0000070': '登录时段受限',
})

const LTYPE_LABELS = Object.freeze({
  '2': '交互式',
  '3': '网络',
  '4': '批处理',
  '5': '服务',
  '7': '解锁',
  '8': '网络明文',
  '9': '新凭据',
  '10': '远程交互',
  '11': '缓存交互',
})

function toMs(v) {
  if (v === null || v === undefined) return null
  if (v instanceof Date) return Number.isFinite(v.getTime()) ? v.getTime() : null
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  const n = Date.parse(String(v))
  return Number.isFinite(n) ? n : null
}

/** 进程名取 basename;空值归一到占位符,不把「取不到」显示成空白。 */
export function normalizeProcessName(p) {
  const s = String(p ?? '').trim().replace(/^"|"$/g, '')
  if (!s) return '(unknown)'
  const base = s.split(/[\\/]/).pop()
  return base || s
}

export function normalizeUser(u) {
  const s = String(u ?? '').trim()
  return s || '(空)'
}

export function normalizeLogonType(t) {
  const s = String(t ?? '').trim()
  return s || '?'
}

export function normalizeStatus(s) {
  const raw = String(s ?? '').trim().toLowerCase()
  return raw.startsWith('0x') ? raw : raw
}

export function statusLabel(status) {
  const k = normalizeStatus(status)
  if (!k) return ''
  return STATUS_LABELS[k] ? `${STATUS_LABELS[k]}(${k})` : k
}

export function logonTypeLabel(t) {
  const k = normalizeLogonType(t)
  return LTYPE_LABELS[k] ? `${k}(${LTYPE_LABELS[k]})` : k
}

/** 稳定身份键:进程 + 用户 + 登录类型。刻意不含 PID / 时刻 / 原始计数(告警身份去重同口径)。 */
export function groupKeyOf(g) {
  return `${normalizeProcessName(g.processName)}|${normalizeUser(g.targetUser)}|${normalizeLogonType(g.logonType)}`
}

const TIME_FMT = new Intl.DateTimeFormat('zh-CN', {
  hour12: false,
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  timeZone: 'Asia/Shanghai',
})

function fmtTime(ms) {
  if (!Number.isFinite(ms)) return ''
  return TIME_FMT.format(new Date(ms))
}

/**
 * 用 4688(进程创建)按 ProcessId 兜底补全进程名。
 * 4625 自带 ProcessName;只有它为空时才用 4688 映像名补,取不到保留 '(unknown)'。
 * @param {Array} events 4625 事件
 * @param {Map<string,string>} procByPid pid(hex/dec 归一到小写字符串)→ 进程名
 */
export function enrichProcessByPid(events, procByPid) {
  const pidMap = procByPid instanceof Map ? procByPid : new Map(Object.entries(procByPid || {}))
  return (events || []).map((e) => {
    const proc = normalizeProcessName(e.processName)
    if (proc !== '(unknown)') return e
    const pid = String(e.processId ?? '').trim().toLowerCase()
    const alt = pidMap.get(pid) || pidMap.get(`0x${pid.replace(/^0x/, '')}`)
    return alt ? { ...e, processName: alt } : e
  })
}

/**
 * 把一组 4625 聚合成一条点名记录。
 * 组内保留:次数、登录类型集合、状态集合、PID 集合、首末时刻、跨度(分钟)。
 */
function aggregateGroup(key, rows) {
  const first = Math.min(...rows.map((r) => r.ts))
  const last = Math.max(...rows.map((r) => r.ts))
  const pids = new Set(rows.map((r) => String(r.processId ?? '').trim()).filter(Boolean))
  const statuses = [...new Set(rows.map((r) => normalizeStatus(r.status)).filter(Boolean))]
  const ltypes = [...new Set(rows.map((r) => normalizeLogonType(r.logonType)))]
  const [proc, user, ltype] = key.split('|')
  const spanMin = (last - first) / 60_000
  return {
    key,
    processName: proc,
    targetUser: user,
    logonType: ltype,
    logonTypes: ltypes,
    statuses,
    statusLabel: statuses.map(statusLabel).filter(Boolean).join('、'),
    count: rows.length,
    pidCount: pids.size,
    pids: [...pids].slice(0, 12),
    firstTs: first,
    lastTs: last,
    spanMin,
    firstTime: fmtTime(first),
    lastTime: fmtTime(last),
  }
}

/** 一条聚合组的可读句:能直接还原现场那两类表述。 */
export function describeGroup(g) {
  if (!g) return ''
  const ltypeText = g.logonTypes.length > 1 ? g.logonTypes.join('/') : normalizeLogonType(g.logonType)
  const parts = [`${g.processName} ${g.count} 次`, `类型 ${ltypeText}`]
  if (g.statusLabel) parts.push(g.statusLabel)
  let tail = ''
  if (g.count > 1 && Number.isFinite(g.spanMin)) {
    if (g.spanMin <= 1) tail = `，${g.firstTime}–${g.lastTime} 一分钟内 ${g.count} 次`
    else tail = `，${g.firstTime}–${g.lastTime} 跨度 ${Math.round(g.spanMin)} 分钟`
  }
  return `${parts.join(' · ')}${tail}`
}

/**
 * 判一份事件快照。
 * @param {{events:Array|null, fetchError?:string|null}} input
 *   events 元素形状见文件头;fetchError 非空 = 采集失败(取不到 Security 日志)。
 * @param {{now?:number, windowMin?:number, burstThreshold?:number,
 *          stormWindowMin?:number, stormThreshold?:number}} opts
 * @returns {{state:string,reason:string,windowMin:number,lockedOut:Array,groups:Array,
 *            byProcess:Array,byUser:Array,byLogonType:Array,total4740:number,total4625:number,
 *            breaches:string[],storm:string[]}}
 */
export function judgeAccountLockout(input, opts = {}) {
  const now = toMs(opts.now) ?? Date.now()
  const windowMin = Number(opts.windowMin) > 0 ? Number(opts.windowMin) : DEFAULT_WINDOW_MIN
  const burstThreshold =
    Number(opts.burstThreshold) > 0 ? Number(opts.burstThreshold) : DEFAULT_BURST_THRESHOLD
  const stormWindowMin =
    Number(opts.stormWindowMin) > 0 ? Number(opts.stormWindowMin) : STORM_WINDOW_MIN
  const stormThreshold =
    Number(opts.stormThreshold) > 0 ? Number(opts.stormThreshold) : STORM_THRESHOLD
  /*
   * 锁定策略档:调用方读了 `net accounts` 就传进来;读不到(或缺省)按 ENABLED 语义走,
   * 即"宁可报红"——策略未判定不能成为降噪借口。
   */
  const policyState = String(opts.lockoutPolicy?.state || LOCKOUT_POLICY.ENABLED)
  const policyThreshold = opts.lockoutPolicy?.threshold ?? null

  /* 采集失败 ⇒ 未判定。绝不把「取不到」读成「没有攻击」(§0.3)。 */
  if (input && typeof input === 'object' && typeof input.fetchError === 'string' && input.fetchError) {
    return {
      state: LOCKOUT_STATE.UNDETERMINED,
      reason: `取不到 Security 事件(采集失败): ${input.fetchError}`,
      windowMin,
      lockedOut: [],
      groups: [],
      byProcess: [],
      byUser: [],
      byLogonType: [],
      total4740: 0,
      total4625: 0,
      breaches: [],
      observations: [],
      storm: [],
      policy: { state: policyState, threshold: policyThreshold },
    }
  }
  if (!Array.isArray(input?.events)) {
    return {
      state: LOCKOUT_STATE.UNDETERMINED,
      reason: 'events 不是数组(采集面未判定,不是"空窗")',
      windowMin,
      lockedOut: [],
      groups: [],
      byProcess: [],
      byUser: [],
      byLogonType: [],
      total4740: 0,
      total4625: 0,
      breaches: [],
      observations: [],
      storm: [],
      policy: { state: policyState, threshold: policyThreshold },
    }
  }

  const windowStart = now - windowMin * 60_000
  const stormStart = now - stormWindowMin * 60_000

  const lockedOut = []
  const failRows = []
  for (const raw of input.events) {
    const ts = toMs(raw?.ts)
    if (ts === null || ts === undefined) continue
    if (ts < windowStart) continue
    const kind = String(raw?.kind || '')
    if (kind === '4740') {
      lockedOut.push({ ts, targetUser: normalizeUser(raw.targetUser) })
    } else if (kind === '4625') {
      failRows.push({
        ts,
        targetUser: normalizeUser(raw.targetUser),
        processName: normalizeProcessName(raw.processName),
        processId: raw.processId,
        logonType: normalizeLogonType(raw.logonType),
        status: normalizeStatus(raw.status),
        ipAddress: String(raw?.ipAddress ?? '').trim(),
        logonProcessName: String(raw?.logonProcessName ?? '').trim(),
      })
    }
  }

  /* 分组(主窗口口径)。 */
  const byKey = new Map()
  for (const r of failRows) {
    const key = groupKeyOf(r)
    if (!byKey.has(key)) byKey.set(key, [])
    byKey.get(key).push(r)
  }
  const groups = [...byKey.entries()]
    .map(([key, rows]) => aggregateGroup(key, rows))
    .sort((a, b) => b.count - a.count)

  /* 风暴标注:同一稳定身份在更长的风暴窗内达到阈值。只标注,不单独判 breach。 */
  const storm = []
  const stormByKey = new Map()
  for (const r of failRows) {
    if (r.ts < stormStart) continue
    const key = groupKeyOf(r)
    stormByKey.set(key, (stormByKey.get(key) || 0) + 1)
  }
  for (const [key, n] of stormByKey) {
    if (n >= stormThreshold) storm.push(key)
  }

  /* 三维汇总(供报告按任一维度点名)。 */
  const sumDim = (pick) => {
    const m = new Map()
    for (const g of groups) {
      const k = pick(g)
      m.set(k, (m.get(k) || 0) + g.count)
    }
    return [...m.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
  }
  const byProcess = sumDim((g) => g.processName)
  const byUser = sumDim((g) => g.targetUser)
  const byLogonType = sumDim((g) => logonTypeLabel(g.logonType))

  const breaches = []
  let state = LOCKOUT_STATE.OK
  let reason

  if (lockedOut.length > 0) {
    state = LOCKOUT_STATE.BREACH
    const who = [...new Set(lockedOut.map((l) => l.targetUser))].join('、')
    reason = `${lockedOut.length} 次账号被锁定(4740): ${who}`
    breaches.push(...lockedOut.map((l) => `locked:${l.targetUser}`))
  }

  const burstGroups = groups.filter((g) => g.count >= burstThreshold)
  const observations = []
  if (burstGroups.length > 0) {
    const burstText = burstGroups.map(describeGroup).join('；')
    if (policyState === LOCKOUT_POLICY.DISABLED) {
      /* 阈值 0 ⇒ 失败计数不会触发锁定 ⇒ 突发没有锁定后果,只记观测。
         4740 若真出现(说明策略被别处改回)仍由上面的分支判红,这里不兜。 */
      observations.push(
        `失败登录突发(仅观测,锁定策略=永不锁定故无锁定后果): ${burstText}`,
      )
      for (const g of burstGroups) observations.push(`observed:${g.key}`)
    } else {
      if (state !== LOCKOUT_STATE.BREACH) state = LOCKOUT_STATE.BREACH
      reason = reason ? `${reason};失败登录突发: ${burstText}` : `失败登录突发: ${burstText}`
      breaches.push(...burstGroups.map((g) => g.key))
      if (policyState === LOCKOUT_POLICY.ENABLED) {
        observations.push(
          `锁定阈值=${policyThreshold ?? '>0'}:失败计数不分来源(隧道 sshd 的 publickey 失败也计入),存在「远程触发锁定」的 DoS 面`,
        )
      }
    }
  }

  if (state === LOCKOUT_STATE.OK) {
    if (failRows.length === 0 && lockedOut.length === 0) {
      reason = `近 ${windowMin} 分钟内无 4740/4625 事件(空窗)`
    } else if (observations.length > 0) {
      reason = `近 ${windowMin} 分钟内 ${failRows.length} 次失败登录,其中 ${burstGroups.length} 组达突发阈值(${burstThreshold} 次/组),但锁定策略=永不锁定 ⇒ 仅观测,无锁定后果`
    } else {
      reason = `近 ${windowMin} 分钟内 ${failRows.length} 次失败登录,均未达突发阈值(${burstThreshold} 次/组),无账号锁定`
    }
  }

  return {
    state,
    reason,
    windowMin,
    lockedOut,
    groups,
    byProcess,
    byUser,
    byLogonType,
    total4740: lockedOut.length,
    total4625: failRows.length,
    breaches,
    observations,
    storm,
    policy: { state: policyState, threshold: policyThreshold },
  }
}

/** 给每条 breach 一句可执行的下一步。 */
export function remediationForLockout(result) {
  const out = []
  for (const g of result?.groups || []) {
    if (!result?.breaches.includes(g.key)) continue
    if (/sshd/i.test(g.processName)) {
      out.push(
        `${describeGroup(g)}: 隧道侧 sshd 在扫用户名;核对 sshd_config 的 PasswordAuthentication 确为 no、只留公钥,并在隧道入口限制来源;被扫到的账号立即查是否被成功登录过`,
      )
    } else if (/chrome|explorer/i.test(g.processName)) {
      out.push(
        `${describeGroup(g)}: 交互进程反复登录同一账号失败;先确认是否本人在输错密码,若非本人 ⇒ 该会话凭据已被试探,尽快改密并注销异常会话;账号锁定期间不要反复补登(会把锁定续期)`,
      )
    } else {
      out.push(`${describeGroup(g)}: 核对该进程与目标用户是否为预期服务;非预期的失败登录按入侵试探处置`)
    }
  }
  for (const l of result?.lockedOut || []) {
    out.push(
      `账号 ${l.targetUser} 已被锁定(4740):先停掉失败来源、等锁定窗口过期再解锁;根治口径:关键服务改 SYSTEM 运行,不受交互账号锁定影响`,
    )
  }
  return out
}

export const __test__ = {
  toMs,
  normalizeProcessName,
  normalizeUser,
  normalizeLogonType,
  normalizeStatus,
  statusLabel,
  logonTypeLabel,
  groupKeyOf,
  describeGroup,
  enrichProcessByPid,
  aggregateGroup,
  parseLockoutThreshold,
  STATUS_LABELS,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
