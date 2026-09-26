// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// =============================================================================
// IHUI-AI Alertmanager 告警中转(NSSM 常驻服务,Node 无依赖):运维邮件单通道
// =============================================================================
// 作用: 接收 Prometheus/Alertmanager 的 webhook_configs 推送(OpenAPI 格式 JSON,
//        POST /alert),按"告警身份"去重后把每一批待投递告警寄一封**带版式**的运维邮件。
//
// 为什么需要它:
//   - Alertmanager 自带的 email 集成用 Go text/template 渲染,**不可能**带本仓邮件版式
//     (2026-09-23 实测收到过一条无样式探针邮件后已撤销),故运维邮件必须走这里 →
//     唯一出口是 apps/api/scripts/notify-deploy-failure.ts,而不是在本文件里发信。
//
// 去重模型(2026-09-24 起): **只按身份去重,无任何总量封顶。**
//   - 同一条告警(alertname + instance 指纹)在 BRIDGE_DEDUP_MIN 窗口(默认 240 分钟)内
//     只寄一封;不同告警一律照寄。批次内多条告警合并成一封。
//   - 为什么第三方推送时代需要"每日预算":免费额度是**第三方配额**(5 条/天),不自保就会
//     撞墙并被静默丢投递。SMTP 是我们自己的服务,自设总量上限等于把"告警静默"再复制一遍
//     —— 第 11 封恰好是唯一那封真故障时,预算闸门就是事故本身。故寄几封完全由
//     "有多少不同身份的告警在响"决定,不设数字闸。
//   - BRIDGE_MAIL_ENABLED 仍保留:它关的是"要不要发"(如割接窗口人工静默),不是"发几封"。
//
// 失败必须响(2026-09-24 起,邮件是唯一到人通道):
//   - 第三方推送时代"邮件只是兜底、失败可以忍"的前提已不存在。品牌模板与 --plain 降级
//     两条路都失败时,必须在 UNDEL_FILE(与 STATE_FILE 同目录)留下可诊断的未送达标记,
//     并写 [mail][ERROR] 日志;/health 暴露 mailUndelivered=true。标记在下一次成功投递时
//     清除(参照 scripts/check-credential-health.mjs 的 UNDELIVERED 机制)。
//
// 配置(环境变量,均可省略):
//   BRIDGE_PORT          监听端口(默认 9096)
//   BRIDGE_DEDUP_MIN     同一告警(alertname+instance)去重窗口分钟数(默认 240=4h)
//   LOG_FILE             日志文件(默认 D:\DevEnv\logs\alert-webhook-bridge.log)
//   STATE_FILE           去重状态文件(默认 D:\DevEnv\state\alert-bridge-state.json)
//                        —— 未送达标记 UNDEL_FILE 落在其同目录,随其一起可重定向(沙箱用)
//   BRIDGE_MAIL_ENABLED  邮件通道开关(缺省=开;0/false/off/no 显式关闭)
//   BRIDGE_MAIL_TO       收件人覆盖;**缺省不传 --to**,由派发器回读 apps/api/.env 的 ALERT_EMAIL_TO
//   BRIDGE_MAIL_TIMEOUT_MS 派发器单次调用墙上时钟上限(默认 90000)
//
// 邮件出口纪律:正文一律经 apps/api/scripts/notify-deploy-failure.ts 的 `--message-file` 派发,
//   版式由 apps/api/src/services/email-templates.ts 的 renderSystemAlertEmail 单点决定 ——
//   本文件**不得**出现 SMTP/Resend 传输层、色值或模板字符串(守门 81「品牌邮件通道对账」)。
//
// 外部文本纪律(2026-09-26 立):Alertmanager 送来的 labels/annotations 是**不受控外部文本**,
//   进正文前一律过 stripCtl(剥控制/零宽字符、labels 折行)+ redact(先封顶 → 脱敏 → 截断,
//   截断必须在正文里点名丢弃字节数);整封正文再受 MAIL_BODY_MAX_BYTES 字节闸门约束。
//   判据在 --self-test 的 ⑤/⑤b/⑥ 三段(含"未超限不得出现截断说明"的反向锁)。
//
// 命令行旗标:
//   (缺省)         作为常驻服务监听 webhook
//   --self-test    逻辑自检(零网络、零子进程、零邮件投递),失败 exit 1
//   --mail-dry-run 只问品牌派发器"通道是否齐备"(派发器 --dry-run 不发网络请求),不启服务
//   --help         打印本说明
// =============================================================================
'use strict'

const http = require('http')
const fs = require('fs')
const path = require('path')
const { spawn } = require('child_process')

// ── 配置 ──────────────────────────────────────────────────────────────────────
const PORT = parseInt(process.env.BRIDGE_PORT || '9096', 10)
const DEDUP_WINDOW_MIN = parseInt(process.env.BRIDGE_DEDUP_MIN || '240', 10)
const LOG_FILE = process.env.LOG_FILE || 'D:\\DevEnv\\logs\\alert-webhook-bridge.log'
const STATE_FILE = process.env.STATE_FILE || 'D:\\DevEnv\\state\\alert-bridge-state.json'
/** 未送达标记:与 STATE_FILE 同目录(⇒ 沙箱把两者一起指进 .ihui-agent/tmp 即零线上污染) */
const UNDEL_FILE = path.join(path.dirname(STATE_FILE), 'alert-bridge-mail-UNDELIVERED.json')

// ── 邮件通道(唯一出口 = 品牌派发器;守门 81 禁止本文件自拼 SMTP/Resend)──────────
/** 仓库根:从脚本自身位置向上找品牌派发器所在目录(禁硬编码盘符;两处历史位置同为二级目录) */
function findRepoRoot() {
  let dir = __dirname
  for (let i = 0; i < 6; i += 1) {
    if (fs.existsSync(path.join(dir, 'apps', 'api', 'scripts', 'notify-deploy-failure.ts'))) return dir
    const parent = path.dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  return path.resolve(__dirname, '..', '..')
}
const REPO_ROOT = findRepoRoot()
const TSX_ENTRY = path.join(REPO_ROOT, 'apps', 'api', 'node_modules', 'tsx', 'dist', 'cli.mjs')
const BRAND_MAIL_SCRIPT = path.join(REPO_ROOT, 'apps', 'api', 'scripts', 'notify-deploy-failure.ts')
/** 正文临时文件目录(§15:临时物一律项目内,已被 .gitignore 忽略;用后逐个删除) */
const MAIL_TMP_DIR = path.join(REPO_ROOT, '.ihui-agent', 'tmp', 'alertbridge-mail')
/** 默认开:收件人就是值班运维本人,邮件没有第三方总量配额,关掉等于回到"告警静默"。 */
const MAIL_ENABLED = !/^(0|false|off|no)$/i.test(String(process.env.BRIDGE_MAIL_ENABLED || '').trim())
const MAIL_TIMEOUT_MS = parseInt(process.env.BRIDGE_MAIL_TIMEOUT_MS || '90000', 10)
/** 空串 ⇒ 不传 --to,由派发器按 process.env → apps/api/.env 的 ALERT_EMAIL_TO 解析(不复制第二份收件人真相) */
const MAIL_TO = String(process.env.BRIDGE_MAIL_TO || '').trim()
const MAIL_SOURCE = 'ihui-alertbridge'

function writeLog(msg) {
  const line = `${new Date().toISOString()} ${msg}\n`
  try { fs.appendFileSync(LOG_FILE, line) } catch (e) { /* 日志写不进不能拖垮接收面;console 仍留一份 */ }
  console.log(line.trimEnd())
}

// 单条告警的可读行(邮件正文按行拼接)
// ⚠️ labels 与 annotations **全部是 Alertmanager 送来的外部文本**,一条都不许原样进正文:
//    统一过 stripCtl(形状归一)+ redact(脱敏 + 截断,截断量可见)。
function formatAlert(alert) {
  const labels = alert.labels || {}
  const anns = alert.annotations || {}
  const name = redact(stripCtl(labels.alertname, false) || 'unnamed')
  const inst = redact(stripCtl(labels.instance, false) || '-')
  const lv = redact(stripCtl(labels.severity, false) || 'unknown')
  const desc = redact(stripCtl(anns.description || anns.summary || '', true), MAIL_ANN_MAX_CHARS)
  return `[${lv}] ${name} (${inst})${desc === '(无内容)' ? '' : '\n' + desc}`
}

// ── 身份去重 + 状态持久化 ──────────────────────────────────────────────────────
// 去重状态**必须跨进程重启延续**:此前 3s 防抖 + NSSM 硬杀(不走 SIGINT/SIGTERM)让突发
// 窗口内的去重决定随内存一起丢,重启后同一条告警被再寄一次(实测 skipped:0)。现在改为
// 每一次会改变去重状态的 webhook 都在**回响应之前**同步落盘(文件极小,代价可忽略)。
const dedup = new Map() // key=`alertname|instance` -> lastPushTs
const MAX_DEDUP_AGE_MS = DEDUP_WINDOW_MIN * 60 * 1000

/** 去重判据(纯函数,注入 store ⇒ 只有一个状态源,不造第二份) */
function decideDedup(store, key, nowMs, windowMs) {
  const last = store.get(key)
  store.set(key, nowMs) // 不断刷新该 key 的最后时间(窗口内重复告警仅重置计时)
  return !!(last && nowMs - last < windowMs)
}
/** 一批告警 → 待投递子集 */
function partitionAlerts(alerts, store, nowMs, windowMs) {
  let dedupedCount = 0
  const toPush = (Array.isArray(alerts) ? alerts : []).filter((a) => {
    const labels = a.labels || {}
    const isDup = decideDedup(store, `${labels.alertname || ''}|${labels.instance || ''}`, nowMs, windowMs)
    if (isDup) dedupedCount++
    return !isDup
  })
  return { toPush, dedupedCount }
}

/** 状态文件形态只有一个键 `dedup`(纯函数 ⇒ --self-test 钉死"无预算/计数字段"的无总量封顶契约) */
function serializeState(store, nowMs, windowMs = MAX_DEDUP_AGE_MS) {
  const dedupObj = {}
  for (const [k, ts] of store) {
    if (nowMs - Number(ts) < windowMs) dedupObj[k] = Number(ts)
  }
  return JSON.stringify({ dedup: dedupObj })
}
function persistState(file, store, nowMs, log, windowMs = MAX_DEDUP_AGE_MS) {
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, serializeState(store, nowMs, windowMs), 'utf8')
    return true
  } catch (e) {
    // 状态落不下来 = 重启后去重失效(同一告警会重寄)。不得静默。
    log(`[state] 保存去重状态失败(重启后去重会重置): ${e.message}`)
    return false
  }
}
/** 读回去重态;返回载入条数(null=首启或文件损坏,按空态起算)。nowMs/windowMs 可注入供 --self-test 钉陈旧条目判据 */
function loadDedupState(file, store, nowMs = Date.now(), windowMs = MAX_DEDUP_AGE_MS) {
  try {
    const s = JSON.parse(fs.readFileSync(file, 'utf8'))
    const now = nowMs
    const stored = s.dedup && typeof s.dedup === 'object' ? s.dedup : {}
    let n = 0
    for (const k of Object.keys(stored)) {
      const ts = Number(stored[k])
      if (Number.isFinite(ts) && now - ts < windowMs) { store.set(k, ts); n += 1 }
    }
    return n
  } catch (e) { return null }
}

// ── 脱敏 + 长度上限(任何诊断文本落盘/进邮件正文前一律过这一层:子进程可能把 .env 片段
//    倒进 stderr,Alertmanager 可能把上游原文塞进 labels/annotations)────────────────
// 为什么上限必须在这一层:邮件是**唯一到人通道**(AGENTS.md §5e),而本文件的正文内容
// 逐字来自 Alertmanager 送来的 labels/annotations —— 那是不受控的外部文本,parseBody
// 允许到 5e6 字符(见文件内 `data.length > 5e6`),不设上限就等于把邮箱当垃圾桶。
// 「静默变短」比「变短」更糟:运维必须能从正文里看出**少了一段**,否则截断就是在伪造完整性。
const SECRETISH_LINE_RE = /(api[_-]?key|token|secret|credential|passw|authorization|bearer)/i

/**
 * 裸凭据前缀族:值出现在正文里但**同一行没有** key/token/secret 这类关键词时,
 * SECRETISH_LINE_RE 结构上看不见 —— 那正是"annotation 里躺着一把 key"的形态。
 *
 * 权威清单是 `packages/shared/src/utils/redact.ts` 的 `SECRET_RULES`。本文件是**零依赖常驻
 * .cjs 服务**,结构上 import 不了 TS 源码包(与 deploy/scripts/ai-diagnose.mjs 头注里那条
 * `createRequire(...).resolve('@ihui/shared') → MODULE_NOT_FOUND` 是同一个否证),所以这里是
 * 一份副本 —— 副本的风险由 --self-test 的"逐族正向证明"兜:每个前缀都必须有一条用例证明
 * 它真被脱敏,清单烂掉(加了族没测/测了没生效)当场判红。
 * 共享层新增一族而这里没跟上时,没有机器判据横跨两侧 —— 已如实登记,不是"已收口"。
 */
const BARE_SECRET_PREFIXES = Object.freeze(['ihui_', 'ihui-', 'sk_', 'sk-', 'ghp_', 'github_pat_', 'gho_', 'AKIA', 'ASIA', 'eyJ'])
// 前置一个"非词字符"闸门:否则 `task-12345678` 会被里面的 `sk-` 误伤(告警正文里 job/task 名极常见)。
// 尾巴要求 ≥8 位,避免把普通缩写/短 ID 打成掩码。
const BARE_SECRET_RE = new RegExp(`(^|[^A-Za-z0-9_-])(?:${BARE_SECRET_PREFIXES.join('|')})[A-Za-z0-9_+/=-]{8,}`, 'g')

/**
 * 进入 SECRETISH_LINE_RE 之前的输入硬封顶(字符数)。
 * 取值理由:与 apps/api/src/services/log-sanitizer.ts 的 `MAX_SANITIZE_INPUT_CHARS = 4096`
 * **同值同理由** —— 该文件原文:「先封顶、后正则:脱敏正则永远只面对 ≤cap 的输入,
 * ReDoS/无界 CPU 成本被结构性排除」。反过来「先正则后封顶」,成本与回溯风险已经发生。
 */
const REDACT_INPUT_CAP_CHARS = 4096

/**
 * 单条 annotation(description/summary)进正文的上限(字符)。
 * 取值理由:取 REDACT_INPUT_CAP_CHARS 的一半 —— 4096 是「正则能吃下的量」,不是「该给人看的量」。
 * Alertmanager 的 annotation 典型形态是 1~3 行说明(本仓 alertmanager 规则里最长的一条 <600 字符),
 * 2,000 足够装下真实故障描述,同时结构上保证「一条 annotation 撑爆整封正文」不可能发生
 * (MAIL_BODY_MAX_BYTES ÷ 本档 ≫ 一批告警的正常条数)。
 */
const MAIL_ANN_MAX_CHARS = 2000

/**
 * 整封邮件正文的字节上限(UTF-8)。
 * 取值理由:夹在本仓既有三档之间 —— deploy/win/ihui-deploy.ps1:155 的单条诊断串 300 字符、
 * deploy/scripts/ai-diagnose.mjs 的上下文档 24,000 字符、本文件 runDispatcher 对子进程输出的
 * 兜底档 64,000 字符。告警邮件的主体是**我们自己写的结论行**,外部原文只是佐证,
 * 20,000 字节足够列完一批告警又低于上述任何一档 ⇒ 本门在下游兜底之前收口,而不是依赖它。
 */
const MAIL_BODY_MAX_BYTES = 20_000

/** 截断说明自身要占的字节预留:预留后总长仍 ≤ MAIL_BODY_MAX_BYTES,上限才是真上限 */
const MAIL_BODY_NOTICE_RESERVE_BYTES = 400

function utf8Bytes(s) {
  return Buffer.byteLength(s, 'utf8')
}

function redact(text, limit = 200) {
  const raw = String(text === undefined || text === null ? '' : text)
  // ① 先封顶(正则不吃无界输入)② 再脱敏 ③ 最后按输出档截断 —— 三步的丢弃量合并成一个诚实数字
  const capped = raw.length > REDACT_INPUT_CAP_CHARS ? raw.slice(0, REDACT_INPUT_CAP_CHARS) : raw
  let droppedBytes = utf8Bytes(raw) - utf8Bytes(capped)
  const scrubbed = capped.split('\n').map((line) => {
    let l = line.trimEnd()
    if (SECRETISH_LINE_RE.test(l)) {
      const sep = /[=:]/.exec(l)
      l = sep && sep.index < 40 ? `${l.slice(0, sep.index + 1)}***` : '[已脱敏]'
    }
    // 恒走 replace:带 /g 的 .test() 会推进 lastIndex,逐行复用时下一行从串中间开始匹配 ⇒ 漏。
    // (String.replace 用 /g 时自带 lastIndex 归零,所以不判直接替换才是安全形态。)
    return l.replace(BARE_SECRET_RE, '$1[已脱敏]')
  }).join('\n')
  if (!scrubbed.trim()) return droppedBytes > 0 ? `(无内容)[已丢弃 ${droppedBytes} 字节]` : '(无内容)'
  if (scrubbed.length > limit) {
    const kept = scrubbed.slice(0, limit)
    droppedBytes += utf8Bytes(scrubbed) - utf8Bytes(kept)
    return `${kept}…(截断,已丢弃 ${droppedBytes} 字节)`
  }
  if (droppedBytes > 0) return `${scrubbed}…[输入超封顶,已丢弃 ${droppedBytes} 字节]`
  return scrubbed
}

/**
 * 剥控制字符 + 零宽字符(外部文本进正文前的形状归一):
 * - keepNewline=false:labels 用 —— alertname/instance/severity 本应是**单行标识符**,
 *   换行必须折成空格,否则一条外部文本能在正文里凭空造出若干行冒充别的告警。
 * - keepNewline=true:annotations 用 —— 保留换行(它是给人读的多行说明),只收成行首尾空白。
 * 为什么零宽字符也算这一层:本仓 §5c 的溯源水印正是靠 U+200B/200C/200D/2060 生存,
 * 放任外部文本原样带这些字符进正文,等于允许它在我们的格式里藏不可见内容(肉眼与
 * diff 都看不见 —— 与本仓"判据失效的表现永远是安静"同型)。
 */
function stripCtl(value, keepNewline) {
  const raw = String(value === undefined || value === null ? '' : value).replace(
    //  C0(除 \n \t)  \x7f  零宽/word-joiner  LS/PS
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u200b-\u200d\u2060\u2028\u2029]/g,
    ' ',
  )
  if (keepNewline) return raw.replace(/[ \t]+\n/g, '\n').replace(/\n[ \t]+/g, '\n').trim()
  return raw.replace(/\s+/g, ' ').trim()
}

// ── Alertmanager 批次 → 品牌邮件载荷 ───────────────────────────────────────────
/** Alertmanager 的 severity 标签 → 品牌模板档位(白名单外一律 warning,不猜严重度) */
function mailSeverity(alerts) {
  const rank = { info: 0, warning: 1, critical: 2 }
  const map = {
    info: 'info', debug: 'info', none: 'info',
    warning: 'warning', warn: 'warning', alert: 'warning',
    critical: 'critical', crit: 'critical', error: 'critical', fatal: 'critical', page: 'critical',
  }
  let worst = 'warning'
  for (const a of alerts || []) {
    const raw = String((a.labels || {}).severity || '').trim().toLowerCase()
    const mapped = map[raw] || 'warning'
    if (rank[mapped] > rank[worst]) worst = mapped
  }
  return worst
}

/** 邮件标题:告警名可读,过长时截断为"前 4 项 + 等 N 项"(标题不是正文,别把注意力花在长串上) */
function mailTitle(alerts) {
  // 标题同样喂给派发器的 --title 命令行参数(还要过一层控制台代码页),所以 alertname
  // 在这里也必须折行 + 走 redact 的单行档 —— 与正文用的是同一把尺子,不是第二套规则。
  const names = (alerts || []).map((a) => redact(stripCtl((a.labels || {}).alertname, false) || 'unnamed'))
  const head = names.length <= 4 ? names.join(' / ') : `${names.slice(0, 4).join(' / ')} 等 ${names.length} 项`
  return `基础设施告警 — ${head}`
}

/**
 * 整封正文的字节闸门(纯函数,--self-test 钉死"超限必须留可见说明")。
 * 截断说明自身占的字节先从预算里扣掉 ⇒ 追加后总长仍 ≤ MAIL_BODY_MAX_BYTES,
 * 上限才是**真上限**而不是"上限 + 一条说明"。
 * ⚠️ 按码点累加字节,不按 UTF-16 索引切 —— 切在代理对中间会产出坏字符,
 * 那等于把人要看的那半句也弄坏。
 */
function capMailBody(text) {
  const bytes = utf8Bytes(text)
  if (bytes <= MAIL_BODY_MAX_BYTES) return text
  const budget = MAIL_BODY_MAX_BYTES - MAIL_BODY_NOTICE_RESERVE_BYTES
  let used = 0
  let cut = 0
  for (const ch of text) {
    const b = utf8Bytes(ch)
    if (used + b > budget) break
    used += b
    cut += ch.length
  }
  const dropped = bytes - used
  return `${text.slice(0, cut)}\n…[正文已达上限 ${MAIL_BODY_MAX_BYTES} 字节,已丢弃 ${dropped} 字节;` + '被丢弃的告警明细不在本邮件内,请到 Alertmanager 界面按身份查看完整批次]'
}

/** 邮件正文(纯文本多行;版式由 renderSystemAlertEmail 单点决定,本函数不得含 HTML) */
function buildMailMessage(alerts) {
  const parts = ['Prometheus 指标告警(Prometheus → Alertmanager → alert-webhook-bridge 链路)', '']
  for (const a of alerts || []) parts.push(formatAlert(a), '')
  parts.push(
    `告警条数:${(alerts || []).length};去重窗口:${DEDUP_WINDOW_MIN} 分钟(同一 alertname+instance 窗口内不重复投递)。`,
    '说明:邮件是唯一到人通道,无每日总量封顶 —— 同一条告警窗口内只寄一封,不同告警一律照寄。',
    `来源:${MAIL_SOURCE}(本机即生产机,仓库根 ${REPO_ROOT})。`,
    `长度上限:单条 annotation ≤${MAIL_ANN_MAX_CHARS} 字符,整封正文 ≤${MAIL_BODY_MAX_BYTES} 字节(超出即在正文里点名丢弃字节数)。`,
  )
  return capMailBody(parts.join('\n'))
}

/**
 * 拼派发器 argv(纯函数,--self-test 钉契约)。
 * ⚠️ 绝不传 `--env-file`:tsx v4 会把它劫持转发给 node 自身,路径不存在时 node 直接 exit 9
 *    (仓库既有实现 scripts/check-credential-health.mjs 的同款教训)。派发器默认就回读 apps/api/.env。
 * ⚠️ 多行中文正文只走 `--message-file`,命令行参数还要过一层控制台代码页(GBK),换行/引号会被吃掉。
 */
function buildMailArgv({ title, severity, messageFile, to = '', plain = false, dryRun = false }) {
  const argv = [TSX_ENTRY, BRAND_MAIL_SCRIPT]
  if (to) argv.push('--to', to)
  argv.push('--title', title, '--severity', severity, '--source', MAIL_SOURCE, '--message-file', messageFile)
  if (plain) argv.push('--plain')
  if (dryRun) argv.push('--dry-run')
  argv.push('--strict') // 失败必须非零退出,降级重试才有依据
  return argv
}

/** 正文写成**无 BOM** UTF-8 临时文件(Node 的 utf8 写入天然无 BOM;调用方负责删除) */
function writeMailMessageFile(text) {
  fs.mkdirSync(MAIL_TMP_DIR, { recursive: true })
  const file = path.join(MAIL_TMP_DIR, `${Date.now()}-${process.pid}.txt`)
  fs.writeFileSync(file, text, 'utf8')
  return file
}

/**
 * 派生一次品牌派发器(异步,不阻塞事件循环)。
 * ⚠️ 这里**必须**用 spawn 而不是 spawnSync:本进程是 Alertmanager 的常驻 webhook 接收端,
 * 一次 tsx 冷启 + SMTP 握手要几十秒,spawnSync 会把事件循环钉死 —— 表现是 Alertmanager
 * 推送超时、后续告警全部堆积(与"告警丢投递"同一后果)。超时用 kill 兜底,双 settled 守卫。
 */
function runDispatcher(argv) {
  return new Promise((resolvePromise) => {
    let settled = false
    const done = (r) => { if (!settled) { settled = true; resolvePromise(r) } }
    let child
    try {
      child = spawn(process.execPath, argv, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }) // windowsHide:§5b 禁弹窗
    } catch (e) {
      done({ ok: false, why: `派发器启动失败: ${redact(e && e.message ? e.message : e)}` })
      return
    }
    let out = ''
    let err = ''
    const cap = (s) => (s.length > 64_000 ? s.slice(0, 64_000) : s)
    child.stdout.on('data', (d) => { out = cap(out + d) })
    child.stderr.on('data', (d) => { err = cap(err + d) })
    const timer = setTimeout(() => {
      try { child.kill('SIGKILL') } catch (e) { /* 已退出 */ }
      done({ ok: false, why: `派发器超时(${MAIL_TIMEOUT_MS}ms),已强制结束` })
    }, MAIL_TIMEOUT_MS)
    child.on('error', (e) => { clearTimeout(timer); done({ ok: false, why: `派发器进程异常(${e.code || e.name}): ${redact(e.message)}` }) })
    child.on('close', (code) => {
      clearTimeout(timer)
      done({ ok: code === 0, code, out, err, why: code === 0 ? '已送达' : `exit=${code} ${redact(err || out)}` })
    })
  })
}

/**
 * 品牌派发器的一次调用:异常/超时一律归为失败,绝不抛出(投递腿不能让服务崩)。
 * 返回 Promise<{ok, why}>。
 */
async function dispatchBrandMail({ title, message, severity, plain = false, dryRun = false }) {
  if (!fs.existsSync(TSX_ENTRY) || !fs.existsSync(BRAND_MAIL_SCRIPT)) {
    return { ok: false, why: `品牌派发器缺失(tsx=${fs.existsSync(TSX_ENTRY)} 脚本=${fs.existsSync(BRAND_MAIL_SCRIPT)})` }
  }
  let msgFile = null
  try {
    msgFile = writeMailMessageFile(message)
    const argv = buildMailArgv({ title, severity, messageFile: msgFile, to: MAIL_TO, plain, dryRun })
    const r = await runDispatcher(argv)
    if (!dryRun) return r
    const out = String(r.out || '') + String(r.err || '')
    return { ok: /通道判定 (?:SMTP|Resend): 可用/.test(out), why: `通道判定: ${redact(out.replace(/\r?\n/g, ' / '))}` }
  } catch (e) {
    return { ok: false, why: `派发器调用异常: ${redact(e && e.message ? e.message : e)}` }
  } finally {
    if (msgFile) { try { fs.rmSync(msgFile, { force: true }) } catch (e) { /* 临时文件残留由 .gitignore 兜住 */ } }
  }
}

// ── 未送达标记(唯一通道失败必须响;参照 check-credential-health 的 UNDELIVERED 机制)──
function markMailUndelivered(file, payload) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, JSON.stringify(payload, null, 2), 'utf8')
}
function clearMailUndelivered(file) {
  try { fs.rmSync(file, { force: true }) } catch (e) { /* 文件本就不在 = 已清除 */ }
}

/**
 * 投递闸门(纯函数,--self-test 直接钉):空批 / 显式关闭 两种情形是"跳过"而非"失败"
 * —— 跳过不该写成投递失败,否则会污染对账。除 BRIDGE_MAIL_ENABLED 外**没有任何数字闸**。
 */
function mailGate({ enabled, count }) {
  if (!count) return { pass: false, skipped: true, why: '本批无可投递告警' }
  if (!enabled) return { pass: false, skipped: true, why: 'BRIDGE_MAIL_ENABLED=0,邮件通道已显式关闭(未尝试投递)' }
  return { pass: true }
}

/**
 * 一次投递(品牌 → 失败 --plain 降级 → 两条都失败写未送达标记)。
 * dispatch/log/undelFile 注入 ⇒ --self-test 用假 dispatch 钉"失败必留痕、成功必清痕"。
 * 去重不在此处:批次已在 partitionAlerts 按同一份状态筛过 ⇒ 同一身份窗口内不再进这里。
 */
async function deliverMail(alerts, { dispatch, log, undelFile }) {
  const payload = { title: mailTitle(alerts), message: buildMailMessage(alerts), severity: mailSeverity(alerts) }
  const branded = await dispatch(payload)
  if (branded.ok) { clearMailUndelivered(undelFile); return branded }
  const plain = await dispatch({ ...payload, plain: true })
  if (plain.ok) { clearMailUndelivered(undelFile); return { ok: true, why: `品牌模板失败(${branded.why})→ 降级纯文本已送达` } }
  const why = `品牌模板失败(${branded.why});降级纯文本同样失败(${plain.why})`
  // 唯一到人通道寄不出去 = 故障从未被人看见。日志 + 标记双留痕,标记再写不出去就是双盲,单独吼出来。
  log(`[mail][ERROR] 未送达(告警从未到人): ${redact(why)}`)
  try {
    markMailUndelivered(undelFile, {
      ts: new Date().toISOString(),
      alerts: (alerts || []).map((a) => (a.labels || {}).alertname || 'unnamed'),
      why: redact(why),
    })
    log(`[mail][ERROR] 已写未送达标记 ${undelFile}(下一次成功投递自动清除;/health 可见 mailUndelivered=true)`)
  } catch (e) {
    log(`[mail][CRITICAL] 连未送达标记都写不出去(${redact(e.message)})—— 告警面双盲,请立即人工核查本批告警: ${redact(why)}`)
  }
  return { ok: false, why }
}

/** 生产入口:真派发器 + 真日志 + 真标记路径;三个依赖可注入供 --self-test 零投递钉契约 */
function sendMailLeg(toPush, { dispatch = dispatchBrandMail, log = writeLog, undelFile = UNDEL_FILE } = {}) {
  const gate = mailGate({ enabled: MAIL_ENABLED, count: toPush ? toPush.length : 0 })
  if (!gate.pass) return Promise.resolve({ ok: false, skipped: true, why: gate.why })
  return deliverMail(toPush, { dispatch, log, undelFile })
}

// ── webhook 处理 ───────────────────────────────────────────────────────────────
async function handleAlert(reqBody) {
  const alerts = (reqBody && Array.isArray(reqBody.alerts)) ? reqBody.alerts : []
  if (!alerts.length) {
    writeLog('[alert] 空 alert 列表,忽略')
    return { skipped: 0 }
  }

  const now = Date.now()
  // 去重: 只保留"该去重窗口内未推过"的告警。
  const { toPush, dedupedCount } = partitionAlerts(alerts, dedup, now, MAX_DEDUP_AGE_MS)
  // 回响应前同步落盘(含 decideDedup 刚刷新过的时间戳)⇒ 跨重启延续,杜绝重启后重寄。
  persistState(STATE_FILE, dedup, now, writeLog)

  if (!toPush.length) {
    writeLog(`[alert] 全部命中去重窗口(${alerts.length}条/${alerts.length}条),跳过投递`)
    return { skipped: dedupedCount }
  }

  // 每批待投递告警直接寄一封(不同身份一律照寄,无任何计数闸/队列丢弃)
  void sendMailLeg(toPush)
    .then((m) => {
      const tag = m.ok ? '已送达' : m.skipped ? '跳过' : '失败'
      writeLog(`[mail] ${tag}: ${redact(m.why || '')}(本批 ${toPush.length} 条,身份去重窗口 ${DEDUP_WINDOW_MIN} 分钟)`)
    })
    .catch((e) => {
      // deliverMail 内部已把投递异常收敛成结论;走到这里只能是结论链路自身异常 —— 同样必须响。
      writeLog(`[mail][ERROR] 投递腿未收敛异常: ${redact(e && e.message ? e.message : e)}`)
    })
  return { queued: toPush.length }
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', (c) => { data += c; if (data.length > 5e6) req.destroy() })
    req.on('end', () => {
      try { resolve(JSON.parse(data)) } catch (e) { reject(e) }
    })
    req.on('error', reject)
  })
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end() }

  // 健康检查(mailUndelivered = 唯一通道曾寄不出去且尚未被成功投递清除)
  if (req.url === '/health' || req.url === '/-/healthy') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    return res.end(JSON.stringify({ ok: true, service: 'alert-webhook-bridge', mailEnabled: MAIL_ENABLED, mailUndelivered: fs.existsSync(UNDEL_FILE) }))
  }

  // 仅接受 Alertmanager webhook(v2 API 用 POST /alert 或任意 POST)
  if (req.method === 'POST') {
    let body
    try { body = await parseBody(req) } catch (e) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      return res.end(JSON.stringify({ ok: false, error: 'bad json' }))
    }
    try {
      const r = await handleAlert(body)
      res.writeHead(200, { 'Content-Type': 'application/json' })
      return res.end(JSON.stringify({ ok: true, ...r }))
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' })
      return res.end(JSON.stringify({ ok: false, error: redact(String(e)) }))
    }
  }

  res.writeHead(404)
  res.end()
})

// ── 命令行旗标(缺省形态必须与既有服务逐字一致)────────────────────────────────────
/** 纯函数:旗标 → 运行模式。空数组必须落 'serve'(向后兼容的机读证明) */
function parseMode(argv) {
  const a = Array.isArray(argv) ? argv : []
  if (a.includes('--help') || a.includes('-h')) return 'help'
  if (a.includes('--self-test')) return 'self-test'
  if (a.includes('--mail-dry-run')) return 'mail-dry-run'
  return 'serve'
}

function usageText() {
  return [
    '用法: node alert-webhook-bridge.cjs [旗标]',
    '',
    '  (缺省)         作为常驻服务监听 127.0.0.1:' + PORT + '(Alertmanager webhook → 运维邮件单通道)',
    '  --self-test    逻辑自检:argv 契约 / 无 BOM 写入 / 去重跨重启 / 无总量封顶 /',
    '                 失败必留未送达标记(零网络、零子进程、零投递),失败 exit 1',
    '  --mail-dry-run 只问品牌邮件派发器「通道是否齐备」(派发器 --dry-run 零网络请求),不启服务',
    '',
    '环境变量: BRIDGE_PORT / BRIDGE_DEDUP_MIN / LOG_FILE / STATE_FILE',
    '          / BRIDGE_MAIL_ENABLED(缺省=开) / BRIDGE_MAIL_TO / BRIDGE_MAIL_TIMEOUT_MS',
    '邮件出口唯一实现: apps/api/scripts/notify-deploy-failure.ts(版式= renderSystemAlertEmail);',
    '本文件不得出现 SMTP/Resend 传输层或模板字符串(守门 81「品牌邮件通道对账」)。',
    '只按告警身份去重、无每日总量封顶;寄不出去会留 UNDELIVERED 标记并在 /health 可见。',
  ].join('\n')
}

/** --self-test:不触网、不派生子进程、不投递(所有投递点均以假函数注入) */
async function runSelfTest() {
  const cases = []
  const eq = (label, got, want) => cases.push([label, JSON.stringify(got) === JSON.stringify(want), `got=${JSON.stringify(got)} want=${JSON.stringify(want)}`])
  const norm = (p) => String(p).replace(/\\/g, '/')
  const HOUR = 3600 * 1000
  const tmpProbe = (tag) => path.join(MAIL_TMP_DIR, `selftest-${tag}-${Date.now()}-${process.pid}.json`)
  const cleanup = []

  // ⓪ 向后兼容:不带旗标必须仍是"起服务"
  eq('缺省无旗标 ⇒ 模式为 serve(行为与接线前一致)', parseMode([]), 'serve')
  eq('未知旗标也不得改变缺省模式', parseMode(['--whatever']), 'serve')
  eq('--self-test / --mail-dry-run / --help 各自独立成模式', [parseMode(['--self-test']), parseMode(['--mail-dry-run']), parseMode(['--help'])], ['self-test', 'mail-dry-run', 'help'])

  // ① argv 契约(与 scripts/check-credential-health.mjs 同一份派发器形态)
  const argv = buildMailArgv({ title: 't', severity: 'critical', messageFile: 'm.txt' })
  eq('邮件唯一出口是品牌派发器 notify-deploy-failure', norm(argv[1]).endsWith('apps/api/scripts/notify-deploy-failure.ts'), true)
  eq('经 apps/api 的 tsx 入口运行(不依赖 PATH 上的 pnpm/npx)', norm(argv[0]).endsWith('apps/api/node_modules/tsx/dist/cli.mjs'), true)
  eq('绝不传 --env-file:tsx v4 会劫持它转发给 node,路径不存在时 node 直接 exit 9', argv.includes('--env-file'), false)
  eq('必带 --strict(失败要非零退出,降级重试才有依据)', argv.includes('--strict'), true)
  eq('必带 --message-file(多行中文正文不得走命令行参数)', argv.includes('--message-file'), true)
  eq('--source 固定为 ihui-alertbridge(品牌模板的来源栏)', argv.slice(argv.indexOf('--source'), argv.indexOf('--source') + 2), ['--source', 'ihui-alertbridge'])
  eq('缺省不传 --to ⇒ 由派发器回读 apps/api/.env 的 ALERT_EMAIL_TO(不复制第二份收件人真相)', argv.includes('--to'), false)
  eq('显式 BRIDGE_MAIL_TO 才传 --to(沙箱/换收件人场景)', buildMailArgv({ title: 't', severity: 'warning', messageFile: 'm', to: 'ops@example.com' }).filter((a) => a === '--to' || a === 'ops@example.com'), ['--to', 'ops@example.com'])
  eq('默认不降级、不演练:--plain/--dry-run 都不出现', [argv.includes('--plain'), argv.includes('--dry-run')], [false, false])
  eq('降级/演练标志按需才出现', buildMailArgv({ title: 't', severity: 'warning', messageFile: 'm', plain: true, dryRun: true }).filter((a) => a === '--plain' || a === '--dry-run'), ['--plain', '--dry-run'])
  eq('派发器与 tsx 入口在本仓可解析(缺失=通道直接判不可用,不静默成功)', [fs.existsSync(TSX_ENTRY), fs.existsSync(BRAND_MAIL_SCRIPT)], [true, true])

  // ② 无 BOM UTF-8 写入(多行中文正文的送达前提)
  const probeFile = writeMailMessageFile('第一行:CPU 使用率 95%\n第二行 "quoted" `backtick`\n')
  const probeBytes = fs.readFileSync(probeFile)
  const hasBom = probeBytes[0] === 0xef && probeBytes[1] === 0xbb && probeBytes[2] === 0xbf
  eq('正文文件首字节非 BOM(否则派发器读到乱码)', hasBom, false)
  eq('正文原样往返(中文/引号/反引号未被改写)', fs.readFileSync(probeFile, 'utf8'), '第一行:CPU 使用率 95%\n第二行 "quoted" `backtick`\n')
  fs.rmSync(probeFile, { force: true })
  eq('临时正文用后即删(不在 .ihui-agent/tmp 里堆积)', fs.existsSync(probeFile), false)

  // ③ 身份去重:同一 alertname+instance 窗口内压住,窗口外必须重新放行
  const store = new Map()
  const alerts = [{ labels: { alertname: 'HighCPU', instance: 'a:9100', severity: 'critical' } }, { labels: { alertname: 'DiskFull', instance: 'b:9100', severity: 'warning' } }]
  eq('首批两条告警全部待投递', partitionAlerts(alerts, store, 1000, HOUR).toPush.length, 2)
  const second = partitionAlerts(alerts, store, 1000 + 60000, HOUR)
  eq('同批再推一次 ⇒ 全部命中去重', [second.toPush.length, second.dedupedCount], [0, 2])
  eq('超出窗口后重新放行(去重不得把持续故障压成永久静默)', partitionAlerts(alerts, store, 1000 + 3 * HOUR, HOUR).toPush.length, 2)
  eq('空/非数组输入不炸', partitionAlerts(undefined, store, 1, HOUR).toPush.length, 0)

  // ③b 去重态跨重启(正反对照):落盘 → 清空内存 → 读回 → 仍判重复;陈旧条目不得复活
  const stateFile = tmpProbe('state')
  cleanup.push(stateFile)
  const storeA = new Map()
  partitionAlerts(alerts, storeA, 1000, HOUR)
  partitionAlerts(alerts, storeA, 1000 + 60000, HOUR) // 窗口内的重复推送只刷新时间戳(与线上行为同形)
  // 反向对照:一条已超出窗口的陈旧条目不得被持久化/读回
  storeA.set('Old|gone:9100', 1000 - 2 * HOUR)
  const savedOk = persistState(stateFile, storeA, 1000 + HOUR, () => {}, HOUR)
  eq('去重状态真实落盘(persistState 返回成功且文件存在)', [savedOk, fs.existsSync(stateFile)], [true, true])
  const storeB = new Map() // 模拟重启后的空进程
  const loaded = loadDedupState(stateFile, storeB, 1000 + HOUR, HOUR)
  eq('重启后按文件读回去重条目(陈旧那条不复活)', loaded, 2)
  const afterRestart = partitionAlerts(alerts, storeB, 1000 + HOUR, HOUR)
  eq('重启后收到同一告警 ⇒ 仍判重复(修前实测 skipped:0 的那个洞)', [afterRestart.toPush.length, afterRestart.dedupedCount], [0, 2])
  eq('重启后不同身份告警照寄(去重态不得顺手压掉新告警)', partitionAlerts([{ labels: { alertname: 'NewIssue', instance: 'c:9100' } }], storeB, 1000 + HOUR, HOUR).toPush.length, 1)
  eq('状态文件形态只有 dedup(无预算/计数字段 ⇒ 结构上不存在总量封顶)', Object.keys(JSON.parse(fs.readFileSync(stateFile, 'utf8'))), ['dedup'])
  eq('状态文件缺失 ⇒ 空态起算(null,不抛错)', loadDedupState(tmpProbe('nope'), new Map(), Date.now()), null)

  // ④ 无总量封顶:闸门只认"开关 + 空批",连续不同身份告警一律放行
  eq('闸门:关闭时标 skipped 且不算失败', mailGate({ enabled: false, count: 1 }), { pass: false, skipped: true, why: 'BRIDGE_MAIL_ENABLED=0,邮件通道已显式关闭(未尝试投递)' })
  eq('闸门:空批次直接跳过', mailGate({ enabled: true, count: 0 }).pass, false)
  eq('闸门:开启且有告警 ⇒ 放行', mailGate({ enabled: true, count: 1 }).pass, true)
  const storm = Array.from({ length: 11 }, (_, i) => ({ labels: { alertname: `Storm${i}`, instance: `n${i}:9100` } }))
  const stormStore = new Map()
  eq('第 11 封不同身份告警仍照寄(11 个不同身份 ⇒ 11 条全部待投,无数字闸)', partitionAlerts(storm, stormStore, 1000, HOUR).toPush.length, 11)

  // ⑤ 脱敏:密钥样诊断行不得进日志(派发器 stderr 可能倒出 .env 片段)
  eq('密钥样行留键名抹值(诊断仍读得懂)', redact('RESEND_API_KEY=re-secret-value-123'), 'RESEND_API_KEY=***')
  eq('无分隔符可切的命中行整行打码', redact('Bearer eyJhbGciOiJIUzI1Ni5x'), '[已脱敏]')
  eq('普通行原样保留', redact('SMTP 发送失败,回落 Resend'), 'SMTP 发送失败,回落 Resend')
  eq('超长诊断文本截断且**点名丢了多少字节**(不得静默变短)', redact('x'.repeat(500)), `${'x'.repeat(200)}…(截断,已丢弃 300 字节)`)
  eq('正则前先封顶:5e5 字符输入不得原样喂给 SECRETISH_LINE_RE', redact('y'.repeat(500000)).length < 500, true)
  eq('输入封顶这件事必须可见(报出被丢字节数;limit 大于封顶档时才走到这一支)', /输入超封顶,已丢弃 \d+ 字节/.test(redact('z'.repeat(REDACT_INPUT_CAP_CHARS + 1234), 6000)), true)
  eq('零宽字符不得活着进正文(不可见内容不算内容)', stripCtl('a\u200bb\u2060c', true), 'a b c')
  eq('labels 里的换行折成空格(外部文本不得凭空多造一行告警)', stripCtl('HighCPU\n[Fake] 伪造行', false), 'HighCPU [Fake] 伪造行')
  eq('annotations 保留换行(它是给人读的多行说明)', stripCtl('第一行\n第二行', true), '第一行\n第二行')

  // ⑤b 邮件正文面:外部文本必须"经过脱敏 + 受长度上限约束",且截断可见
  const evil = [{
    labels: { alertname: 'Evil\n[Fake] 注入行', instance: 'x:1', severity: 'critical' },
    annotations: { description: `api_key = leak-me-please\n${'A'.repeat(3000)}` },
  }]
  const evilBody = buildMailMessage(evil)
  eq('annotation 里的密钥样行经 redact:值不得出现在正文', evilBody.includes('leak-me-please'), false)
  eq('annotation 里的密钥样行经 redact:键名仍在(诊断价值不丢)', evilBody.includes('api_key =***'), true)
  eq('单条 annotation 受 MAIL_ANN_MAX_CHARS 约束且点名丢弃量', /已丢弃 \d+ 字节/.test(evilBody) && evilBody.split('\n').find((l) => /^A+$/.test(l.slice(0, 10))).length <= MAIL_ANN_MAX_CHARS + 40, true)
  eq('labels 的换行不会在正文里多造一行(注入行不独立成行)', evilBody.includes('\n[Fake] 注入行'), false)
  const stormBody = buildMailMessage(Array.from({ length: 40 }, (_, i) => ({
    labels: { alertname: `S${i}`, instance: `n${i}:9100`, severity: 'warning' },
    annotations: { description: 'D'.repeat(1900) },
  })))
  eq('整封正文不得越过 MAIL_BODY_MAX_BYTES(预留后追加说明也算)', utf8Bytes(stormBody) <= MAIL_BODY_MAX_BYTES, true)
  eq('正文被截断时必须吼出来(丢了多少字节 + 去哪看剩下的)', /正文已达上限 \d+ 字节,已丢弃 \d+ 字节/.test(stormBody), true)
  eq('未超限时不得出现截断说明(不得虚报)', /正文已达上限/.test(buildMailMessage(alerts)), false)
  eq('标题里的 alertname 同样折行 + 封顶(它进的是命令行 --title)', mailTitle(evil).includes('\n'), false)

  // ⑥ 版式零手抄:邮件正文必须是纯文本(模板归 renderSystemAlertEmail 单点)
  const msg = buildMailMessage(alerts)
  eq('正文不含任何 HTML 标签(未手抄版式)', /<[a-z!/][^>]*>/i.test(msg), false)
  eq('正文如实声明唯一通道与无封顶口径', /唯一到人通道,无每日总量封顶/.test(msg), true)
  eq('正文把本封适用的长度上限写在脸上(读信的人不必猜)', new RegExp(`annotation ≤${MAIL_ANN_MAX_CHARS} 字符`).test(msg), true)
  eq('severity 映射:page→critical、未知→warning', [mailSeverity([{ labels: { severity: 'page' } }]), mailSeverity([{ labels: { severity: 'weird' } }]), mailSeverity([{ labels: { severity: 'info' } }, { labels: { severity: 'critical' } }])], ['critical', 'warning', 'critical'])
  eq('标题过长时截断为"前 4 项 等 N 项"', mailTitle(Array.from({ length: 7 }, (_, i) => ({ labels: { alertname: `A${i}` } }))), '基础设施告警 — A0 / A1 / A2 / A3 等 7 项')

  // ⑦ 失败必留痕 / 成功必清痕(假 dispatch 注入,零投递;log 收集到数组)
  const undelFile = tmpProbe('undel')
  cleanup.push(undelFile)
  const logs = []
  const fakeLog = (m) => logs.push(m)
  const failDispatch = async () => ({ ok: false, why: '假失败:SMTP 拒收' })
  const okDispatch = async () => ({ ok: true, why: '假成功' })
  const rFail = await deliverMail(alerts, { dispatch: failDispatch, log: fakeLog, undelFile })
  eq('两条路都失败 ⇒ 结论为失败(唯一通道失败不得被吞)', rFail.ok, false)
  eq('失败必须落未送达标记文件(参照 UNDELIVERED 机制)', fs.existsSync(undelFile), true)
  const marker = JSON.parse(fs.readFileSync(undelFile, 'utf8'))
  eq('标记含可诊断三要素:时间/告警名/失败原因(且已脱敏)', [!!marker.ts, marker.alerts, /假失败/.test(marker.why)], [true, ['HighCPU', 'DiskFull'], true])
  eq('日志里能看到未送达吼声', logs.some((l) => /未送达/.test(l)), true)
  const rOk = await deliverMail(alerts, { dispatch: okDispatch, log: fakeLog, undelFile })
  eq('下一次成功投递自动清除标记', [rOk.ok, fs.existsSync(undelFile)], [true, false])
  const plainRescue = async (p) => (p.plain ? { ok: true, why: '假成功(纯文本)' } : { ok: false, why: '品牌失败' })
  const rPlain = await deliverMail(alerts, { dispatch: plainRescue, log: fakeLog, undelFile })
  eq('品牌失败 → --plain 送达 ⇒ 算送达且不留标记(宁降级不静默)', [rPlain.ok, /降级纯文本/.test(rPlain.why), fs.existsSync(undelFile)], [true, true, false])
  let dispatchCalls = 0
  const counting = async () => { dispatchCalls += 1; return { ok: true, why: 'x' } }
  const rEmpty = await sendMailLeg([], { dispatch: counting, log: fakeLog, undelFile })
  eq('空批经生产入口 sendMailLeg ⇒ 跳过且不派任何子进程', [rEmpty.skipped, dispatchCalls], [true, 0])
  eq('BRIDGE_MAIL_ENABLED=0 时 mailGate 不放行(开关关"要不要发",不是"发几封")', mailGate({ enabled: false, count: 3 }).pass, false)

  // ⑦ 裸凭据前缀族:逐族正向证明(名单类判据必须至少有一条断言的输入取自名单本身 ——
  //    只写一条"能拦"的笼统断言,清单可以在完全失效的状态下一路报绿)。
  for (const p of BARE_SECRET_PREFIXES) {
    // 样本在运行时拼装:源码里绝不出现「前缀 + 长随机串」的完整形态,
    // 否则 push protection 会按 commit 拦下整条 main(本仓为一枚假 token 样本卡死过一次)。
    const probe = `job ${p}${'AbCd1234'.repeat(3)} ended`
    eq(`裸前缀族 ${p} 进正文前被脱敏`, redact(probe).includes('[已脱敏]'), true)
    eq(`裸前缀族 ${p} 掩码后原值不再出现`, redact(probe).includes('AbCd1234'), false)
  }
  eq('反向锁:task-12345678 这类正常 job 名不得被 sk- 误伤', redact('job task-12345678 done'), 'job task-12345678 done')
  eq('反向锁:无凭据形态的告警行逐字不变(脱敏不得顺手改写正常文本)', redact('CPU 使用率 95% 持续 5 分钟'), 'CPU 使用率 95% 持续 5 分钟')

  let bad = 0
  for (const [label, pass, why] of cases) {
    if (!pass) bad++
    console.log(`${pass ? '✓' : '✗'} ${label}${pass ? '' : `  ${why}`}`)
  }
  for (const f of cleanup) { try { fs.rmSync(f, { force: true }) } catch (e) { /* 自检临时文件清不掉不影响结论 */ } }
  console.log(`自检 ${cases.length - bad}/${cases.length} 通过`)
  process.exit(bad ? 1 : 0)
}

function startServer() {
  server.listen(PORT, '127.0.0.1', () => {
    const n = loadDedupState(STATE_FILE, dedup) // 去重态跨重启延续(修前只在 3s 防抖窗口内存活)
    if (fs.existsSync(UNDEL_FILE)) {
      writeLog(`[mail][WARN] 存在未送达标记 ${UNDEL_FILE} —— 此前有告警未能到人,处置后由下一次成功投递自动清除`)
    }
    writeLog(`alert-webhook-bridge 启动, 监听 127.0.0.1:${PORT}, 邮件通道 ${MAIL_ENABLED ? '开' : '关(BRIDGE_MAIL_ENABLED)'}, 去重窗口 ${DEDUP_WINDOW_MIN} 分钟(只按身份去重,无总量封顶), 载入去重条目 ${n === null ? 0 : n}${n === null ? '(状态文件缺失/损坏,按空态起算)' : ''}`)
  })
}

/** --mail-dry-run:零网络问一次通道判定(不启服务、不投任何一封真信) */
async function runMailDryRun() {
  const r = await dispatchBrandMail({
    title: '【核验信】alert-webhook-bridge 邮件通道演练(dry-run,未发送)',
    message: '这是一条 dry-run 演练正文,不会真的寄出。\n第二行用于验证多行中文经 --message-file 通道原样送达。',
    severity: 'info',
    dryRun: true,
  })
  console.log(`邮件通道(dry-run): ok=${r.ok} ${redact(r.why)}`)
  process.exit(r.ok ? 0 : 1)
}

const MODE = parseMode(process.argv.slice(2))
if (MODE === 'help') {
  console.log(usageText())
  process.exit(0)
} else if (MODE === 'self-test') {
  // 自检自身异常必须 exit 2(与 §22b/§22d 约定一致:1=业务失败,2=脚本异常),不得静默放行
  void runSelfTest().catch((e) => {
    console.error(`❌ 自检自身异常: ${e && e.message ? e.message : e}\n${e && e.stack ? e.stack : ''}`)
    process.exit(2)
  })
} else if (MODE === 'mail-dry-run') {
  void runMailDryRun().catch((e) => {
    console.error(`❌ 通道演练异常: ${redact(e && e.message ? e.message : e)}`)
    process.exit(2)
  })
} else {
  startServer()
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
