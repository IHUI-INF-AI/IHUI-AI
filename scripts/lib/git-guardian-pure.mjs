// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// git-guardian 纯判据层(2026-10-21 从 scripts/git-guardian.mjs 原样搬出,函数体/参数/返回值/文案零改动)。
// 只放不依赖模块级可变状态、不触碰 WORKTREE 的纯函数与常量;调度与自愈等有副作用的动作仍住在主文件。
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync, rmSync } from 'node:fs'

/** 去重窗:同 (alert 名 + 内容指纹) 在窗口内只寄一封。**没有**任何"每日 N 封"总量闸 —— 那是把"告警静默"再复制一遍 */
export const NOTIFY_DEFAULT_WINDOW_MS = 4 * 60 * 60 * 1000
/** 投递失败后的重试间隔(反 spam 用的退避,不是配额:窗口照常重发,与"封顶 N 封"不同) */
export const NOTIFY_DEFAULT_FAIL_COOLDOWN_MS = 30 * 60 * 1000

/**
 * 嵌套 ref 健康判据(纯函数 —— 镜像测试直接喂构造面,不依赖活 gitdir)。
 *
 * 立因(2026-10-05 夜间巡检实测):`refs-manifest.json` 是 `{}`(2 字节,mtime 10-03 11:30),
 * 而旧判据 `if (Object.keys(m).length === 0) return true` 把"清单里一个期望项都没有"直接判成
 * **健康**。于是 `remediate()` 结构上到不了(`if (coreOk && before.refsOk)` 走健康分支早退),
 * 而 `healRefs()` 是唯一的 bootstrap 入口 —— 旧注释写着"未 bootstrap 时不算异常(healRefs 会补)",
 * 调用点却要求"不健康才补",两句话合起来 = 空清单状态下永不补齐。后果:盘上 5143 个
 * depth>=2 的 ref(含 §22 明令禁删的 `refs/tags/backup/*` 与 `lost-commit/*`)在宿主清理层
 * 再删一次时**没有任何离线重建依据**,而每轮巡检打印"嵌套 ref 完整"。失效形态是安静,不是报错。
 *
 * 判据:只有"确实没有东西要守"(清单为空 ∧ 盘上也看不到嵌套 ref)才算正常;
 * 清单为空而盘上有嵌套 ref ⇒ `unbootstrapped` ⇒ 不健康 ⇒ 走 remediate() → healRefs() 的学习分支。
 * 附带说明:清单文件损坏(存在但 JSON 解析不出)在 readRefsManifest() 里同样得到空对象,
 * 因此也走这一支并被重新学习覆盖 —— 解析不出的那份本来就不是机器可用的期望值,而让它躺在原地
 * 的代价是"这一维永不再被看守",与空清单同罪。
 *
 * `manifestCount` 取不到(非有限数)一律落 `undetermined` 并判不健康,绝不记为通过
 * (本仓"把没判写成判过了"同一条禁令);healRefs() 只做学习/追加,判不出时调它是无害方向。
 */
export function judgeRefsHealth({ manifestCount, visibleNestedCount, missingCount, faceReadable = true } = {}) {
  const mc = Number(manifestCount)
  const vc = Number(visibleNestedCount)
  const ms = Number(missingCount)
  if (!Number.isFinite(mc) || mc < 0) {
    return { ok: false, reason: 'undetermined', manifestCount: null, visibleNestedCount: 0, missingCount: 0 }
  }
  // 面问不到(ref 那一侧读不出来)⇒ 未判定。**绝不**折成"清单里 mc 个全部缺失":那既报假红,
  // 又会让 healRefs 按清单去撒数千枚松散 ref(把读不到当被删了治)。也不折成 ok:§0.3 两头都不许。
  if (faceReadable === false) {
    return {
      ok: false,
      reason: 'face-unreadable',
      manifestCount: mc,
      visibleNestedCount: Number.isFinite(vc) && vc > 0 ? vc : 0,
      missingCount: 0,
    }
  }
  const visible = Number.isFinite(vc) && vc > 0 ? vc : 0
  const missing = Number.isFinite(ms) && ms > 0 ? ms : 0
  if (mc === 0) {
    return visible > 0
      ? { ok: false, reason: 'unbootstrapped', manifestCount: 0, visibleNestedCount: visible, missingCount: 0 }
      : { ok: true, reason: 'nothing-to-guard', manifestCount: 0, visibleNestedCount: 0, missingCount: 0 }
  }
  return missing > 0
    ? { ok: false, reason: 'missing', manifestCount: mc, visibleNestedCount: visible, missingCount: missing }
    : { ok: true, reason: 'ok', manifestCount: mc, visibleNestedCount: visible, missingCount: 0 }
}

/** 两轮自愈之间的最小墙钟间隔。
 *  为什么必须有:常驻模式(`--daemon`)的 tick 是 `GIT_GUARDIAN_INTERVAL_MS || 10000`,即**10 秒**
 *  (它兜的是 `.git` 被整体删除那一型,必须快,不该为此调慢)。但家目录自愈是按"每 2 分钟一趟"
 *  设计的(见上面三条改法的 ①②),挂在 10 秒 tick 上就等于把一轮几百 MB 的 robocopy 提频 12 倍。
 *  2026-09-27 实测到后果:同一失败项 12 秒刷一条告警、两小时 1.3 万行。
 *  冷却表(修复器自己写)已能拦住**已知失败项**,这一层拦的是"任何一轮的整体重抄",两者不互替:
 *  判红原因落在项之外时(例如登记表被过滤空)冷却表是空的,只有墙钟间隔兜得住。 */
const HOME_HEAL_MIN_INTERVAL_MS = 10 * 60 * 1000

/** 纯函数:本轮该不该叫自愈。时间戳读不到/为 0/为负 ⇒ 视为到期(宁跑一轮,不因为一个坏文件永久静默)。 */
export function homeHealDue(raw, now, minIntervalMs = HOME_HEAL_MIN_INTERVAL_MS) {
  const last = Number(String(raw ?? '').trim())
  if (!Number.isFinite(last) || last <= 0) return true
  return now - last >= minIntervalMs
}

/**
 * 从 `check-merge-addition-loss.mjs` 的 stdout 取"丢失路径数"。
 *
 * 为什么要有这个函数(2026-10-26 立):守护原先在调用点内联一条正则
 * `丢失新增路径\s+(\d+)`,而对账脚本的结论行早已改写成「丢失路径或回退内容 N」——
 * **散文措辞一漂,数字就恒取不到**,于是判红信的正文写着「共 ? 个路径」,
 * 身份里的档位也恒为同一档(噪声信无法靠量级区分恶化)。这不是取不到结论,
 * 是取到了却没读懂 —— 所以修法不是放宽正则,而是让生产者给**机器可读令牌**,
 * 读侧优先认令牌、散文只作旧版兜底。
 *
 * 三档来源按可信度降序:① `RESULT lost=<n>`(机器令牌)② 现行散文措辞 ③ 旧版措辞。
 * 三档全落空 ⇒ 返回 `'?'`(调用方照旧判红,但正文如实写"数不出来",绝不折成 0)。
 */
export function parseMergeLossCount(stdout) {
  const s = String(stdout ?? '')
  const patterns = [
    /\bRESULT\s+lost=(\d+)/,
    /丢失路径或回退内容\s*(\d+)/,
    /丢失新增路径\s*(\d+)/,
  ]
  for (const re of patterns) {
    const m = s.match(re)
    if (m) return m[1]
  }
  return '?'
}

/**
 * 一趟派生的结论分档(纯函数,镜像测试钉契约)。三档:绿 / 判红 / 未判定。
 * "未判定"既不得读成"对账层坏了",也不得读成"没问题"(§0.3)——它只说明这一轮没有可采信的输入,
 * 该不该喊人由上面那个持续性门槛判。
 */
export function classifyMergeLossOutcome(e) {
  if (!e) return { kind: 'ok' }
  if (typeof e.status === 'number') {
    if (e.status === 2) return { kind: 'undetermined', why: '尺子自报 exit 2(取不到输入/自身异常)' }
    return { kind: 'breach', code: e.status }
  }
  const shape = `${e.code || ''} ${e.signal || ''} ${e.killed ? 'killed' : ''}`.trim()
  if (shape) return { kind: 'undetermined', why: `派生超时/被杀(${shape})` }
  return { kind: 'undetermined', why: String(e.message || e).slice(0, 160) }
}

/**
 * 内容指纹:数字与哈希归一后再散列。不归一的话"丢失 38 个路径"里一个计数浮动、
 * 或"→ 9f2ab1c"里 sha 换一个前缀,每 2 分钟都会产新指纹 ⇒ 每趟重发(轰炸)。
 * 归一后表达的是"同一故障仍在发生";实时数字保留在邮件正文里,不丢诊断价值。
 */
export function alertFingerprint(name, detail) {
  const norm = String(detail ?? '')
    .replace(/\b[0-9a-f]{7,40}\b/gi, '<sha>')
    .replace(/\d+/g, '#')
    .replace(/\s+/g, ' ')
    .trim()
  return createHash('sha1').update(`${name}\u0000${norm}`, 'utf8').digest('hex')
}

/**
 * 稳定身份指纹(2026-10-03 立):调用方显式给定"什么算同一故障",**不做数字归一**。
 *
 * 为什么不能直接复用 alertFingerprint:那条路把 `\d+` 一律打成 `#`,本意是压掉
 * "38 个路径"↔"39 个路径"这类实时计数抖动;但盘根卫生的 dedupKey 恰恰**要靠量级
 * 区分故障演化**(外流 2 项 → 5 项是恶化,必须重报)。走归一后 `stray=2;wt=4` 与
 * `stray=5;wt=4` 撞同一指纹,恶化被静默 —— 那是把"压抖动"改成"压事实"。
 *
 * 2026-10-05 修正(同一格,措辞必须跟着改,否则下一个人会以为身份里是原始计数):
 * 原始计数也不行 —— 实测 09-30 至 10-05 同一原因寄出 **34 封**,其中 10-04
 * 20:59 / 21:29 / 21:59 三封只隔 30 分钟,4 小时窗口形同虚设。真因是计数本身在抖
 * (多会话并行建删落点外 worktree 是常态,0↔1↔2↔3 每轮都可能变)。所以身份里放的是
 * `alertCountTier()` 的**档位**:0 / 1 / 2-3 / 4-7 / 8+ —— 档内抖动不重报,跨档(含缓解到 0)重报。
 * 这是"压抖动"与"压事实"之间的一条实测出来的线,不是把两者混为一谈的第三条路。
 *
 * 因此这里刻意**不做通用归一**:调用方给什么身份就是什么身份,身份怎么构造是调用方的义务
 * (盘根这一格给的是"违规类别 + 计数档位",明细清单不进身份)。
 */
export function stableAlertFingerprint(name, identity) {
  const id = String(identity ?? '').replace(/\s+/g, ' ').trim()
  return createHash('sha1').update(`${name}\u0000${id}`, 'utf8').digest('hex')
}

/**
 * 状态表解析:坏 JSON / 数组 / 缺字段条目一律归一为空表或剔除。
 * 取向:"多寄一封"的代价远小于"通知层自己抛异常把守护流程带崩"(守护崩了才是事故)。
 */
export function parseNotifyState(text) {
  if (!text) return {}
  try {
    const obj = JSON.parse(String(text))
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return {}
    const out = {}
    for (const [k, v] of Object.entries(obj)) {
      if (v && typeof v === 'object' && typeof v.fp === 'string' && Number.isFinite(v.ts)) {
        out[k] = { fp: v.fp, ts: v.ts, delivered: Boolean(v.delivered) }
      }
    }
    return out
  } catch {
    return {}
  }
}

/**
 * 当轮是否应当发信(纯函数,去重的全部判据):
 *  · 无记录 / 指纹变了(新故障或旧故障演化)⇒ 立刻发,不等窗口;
 *  · 同指纹且上次**已送达** ⇒ 窗口(默认 4h)内压住,过期重发 —— 去重只能去"重复",
 *    不能去"还在发生",所以这里没有时间窗就永远沉默的路径;
 *  · 同指纹且上次**没送达**(含无收件人降级)⇒ 按失败退避(默认 30min)重试。
 *    这是反 spam 退避,不是"每日 N 封"配额闸:窗口与退避只推迟下一封,永不封死。
 */
export function shouldAlert(state, key, fp, now, { windowMs, failCooldownMs } = {}) {
  const e = state && state[key]
  if (!e) return true
  if (e.fp !== fp) return true
  const w = Number.isFinite(windowMs) ? windowMs : NOTIFY_DEFAULT_WINDOW_MS
  const fc = Number.isFinite(failCooldownMs) ? failCooldownMs : NOTIFY_DEFAULT_FAIL_COOLDOWN_MS
  return e.delivered ? now - e.ts > w : now - e.ts > fc
}

/** 写回一条发信标记(送达与否由调用方按派发结论给);返回新对象,不改入参 */
export function withAlertMark(state, key, fp, now, delivered) {
  return { ...state, [key]: { fp, ts: now, delivered: Boolean(delivered) } }
}

/** 收件人脱敏展示:日志/状态里只留 local-part 首字符 + 域名(地址不是密钥,但也不扩散) */
export function maskEmail(addr) {
  const [local = '', domain = ''] = String(addr ?? '').split('@')
  return domain ? `${local.slice(0, 1)}***@${domain}` : '***'
}

export function notifyWindowMs() {
  const n = Number(process.env.GIT_GUARDIAN_NOTIFY_WINDOW_MS)
  return Number.isFinite(n) && n >= 0 ? n : NOTIFY_DEFAULT_WINDOW_MS
}

export function notifyFailCooldownMs() {
  const n = Number(process.env.GIT_GUARDIAN_NOTIFY_FAIL_COOLDOWN_MS)
  return Number.isFinite(n) && n >= 0 ? n : NOTIFY_DEFAULT_FAIL_COOLDOWN_MS
}

/**
 * 持续多久折档 —— 给"稳定指纹 × 零有效出口"那一格(本地恢复源、长期成立的入口慢)当**终态**用:
 * 同档持续由窗口压住不重复轰炸,跨档(6h/24h/72h)即新身份 ⇒ 报警只会越拖越响,不会被压成静音。
 * 起点取不到 ⇒ 落最短档并在 `undetermined` 里点名(§0.10:方向是多要一次说明,绝不是静音)。
 */
export function alertHeldTier(firstMs, nowMs = Date.now()) {
  const f = Number(firstMs)
  const h = Number.isFinite(f) ? (Number(nowMs) - f) / 3_600_000 : NaN
  if (!Number.isFinite(h) || h < 6) return { tier: 'lt6h', hours: Number.isFinite(h) ? Math.round(h * 10) / 10 : null, undetermined: !Number.isFinite(h) }
  if (h < 24) return { tier: '6-24h', hours: Math.round(h), undetermined: false }
  if (h < 72) return { tier: '24-72h', hours: Math.round(h), undetermined: false }
  return { tier: '72h+', tierEscalated: true, hours: Math.round(h), undetermined: false }
}

/**
 * "这一轮取不到结论"的持续起点台账(型②通用件,`auditMergeAdditionLoss` 首用)。
 * 读写失败一律不影响判定本身:状态件坏了最多让下一轮重新起算(顶多多等一个窗),
 * 反过来"写不进就不判"会把瞎掉的那一格读成没问题,那才是贵的那种失效。
 *
 * `extra`(2026-10-19 加):把**本次事件的起始属性**钉在同一份状态件里,只写不覆盖 ——
 * 已有键一律保留,所以钉进去的是"这一段故障开始时是什么形状"。加这一格是因为部署停摆那封信
 * 实测**同一场停摆寄出 3 封**:身份里带了 `class`(线上有无构建标记),而一次清 rebuild 就会把标记洗掉
 * ⇒ class 在事件中途从 behind 翻成 no-marker ⇒ 旧窗口形同虚设,当场自增一枚新身份。
 * 起始形状一旦被钉住,事件内怎么翻都只算同一起点(持续档照常升级,那是有意越拖越响)。
 */
export function noteUndeterminedStreak(file, nowMs = Date.now(), extra = {}) {
  let prev = {}
  let firstMs = NaN
  try {
    prev = JSON.parse(readFileSync(file, 'utf8')) || {}
    firstMs = Number(prev.firstMs)
  } catch {
    /* 没有起点 ⇒ 以本次为新起点 */
  }
  if (!Number.isFinite(firstMs)) firstMs = nowMs
  // 起始形状 = **先到先得**:上一轮已经在册的键一律不被本轮覆盖(本轮想钉的只在缺席时才落册)。
  // 时间戳三键由本函数自己管,不参与"先到先得"。
  const keep = {}
  for (const [k, v] of Object.entries(prev)) {
    if (k === 'firstMs' || k === 'firstAt' || k === 'lastSeenAt') continue
    keep[k] = v
  }
  for (const [k, v] of Object.entries(extra)) if (!(k in keep)) keep[k] = v
  try {
    writeFileSync(
      file,
      JSON.stringify({ ...keep, firstMs, firstAt: new Date(firstMs).toISOString(), lastSeenAt: new Date(nowMs).toISOString() }),
      'utf8',
    )
  } catch {
    /* 状态件写不掉只影响下一轮的持续性判定 */
  }
  // 返回的是**文件里应当留下**的那份起始形状(写失败时即上一轮原值),而不是调用方这次想钉的值 ——
  // 否则"钉住起始形状"在写不进盘的那一晚会静默变成"没钉",而账面读起来像钉过了。
  return { firstMs, heldMs: nowMs - firstMs, meta: keep }
}

export function clearUndeterminedStreak(file) {
  try {
    rmSync(file, { force: true })
  } catch {
    /* 同上 */
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
