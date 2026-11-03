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
//   - 同一条告警(alertname + instance 指纹)在 BRIDGE_DEDUP_MIN 窗口(默认 230 分钟)内
//     只寄一封;不同告警一律照寄。批次内多条告警合并成一封。
//     窗口**必须严格小于** Alertmanager 的 repeat_interval(现役 4h):AM 的下一次 repeat 若落在
//     窗口内会被桥侧压掉,只能等再下一次 repeat ⇒ 持续告警从 4h 沉默成 8h(2026-11-02 定)。
//     230 = 240 - 10 分钟确定性余量;实测通知落账比桥侧收件晚 0.398~1.183s(3 组真实样本)。
//   - 窗口从**上一次真正投递**起算:被抑制的重复推送只读旧时间戳、**不续期**窗口
//     (2026-11-02 修)。此前每次推送都刷新时间戳 ⇒ 持续 firing 的告警窗口永远推不远,
//     只在第一次响、之后永不再报(PostgresDown 实测被压住的正是这一格)。
//     语义仍是"同一身份在两次投递之间至少隔 BRIDGE_DEDUP_MIN",不是"最后一次推送后再等"。
//   - resolved **不再摘档**(2026-11-03 修):此前恢复事件距上次投递 ≥ RECOOL_MIN(30 分钟)
//     就删 dedup 档,下一次 firing 被当新身份 ⇒ 43/38/62 分钟的短间隔重寄(AiLlm 席实测
//     AiLlmHighFailureRate 24h 内 resolved 11 次、5 封)。现在恢复只记账、**保留 lastSentTs**,
//     并登记一条与 BRIDGE_DEDUP_MIN **解耦**的 24h 发送上限(同身份 24h 至多 1 封)。
//     为什么不用"把 BRIDGE_DEDUP_MIN 抬到 1440":那会违反"窗口必须 < AM repeat_interval(240 分钟)"
//     的余量约束;24h 上限只压"恢复过的身份",持续 firing 的首次/窗口外投递照旧即时(不静音)。
//   - 状态文件存 `dedup`(上次真正投递时刻)与 `holds`(恢复后到期的 24h 上限)两张表:
//     落盘走 tmp+rename 原子替换(硬杀不会留半写 JSON);启动时
//     JSON/形态损坏 ⇒ 原文件先备份成 .corrupt-* 再按空态起算(ERROR 日志 + state_load_failures
//     计数,不吞错、可人工恢复);条目级非法值(非数/非正/未来时刻)只跳过该条,且未来时间戳
//     在判据层也不构成压制(否则时钟回拨会把同身份告警压到时钟追平为止)。
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
//   - 双失败后不再"一次就放弃":桥侧排**一次**后台重试(默认 30s 后;距首次失败超过 2min
//     即放弃),仍失败才把 UNDEL 留作最终凭据(2026-11-02 落地)。重试**绝不回滚**
//     partitionAlerts 写入的去重锚点 —— 回滚会让 AM group 频繁变化时把同一故障反复寄,
//     那正是本文件另一头要治的"多信"。待重试记录原子落盘(与 STATE_FILE 同目录的
//     alert-bridge-mail-retry-pending.json),重启时**丢弃超过 10 分钟**的条目:
//     补发陈年告警等于新造一次轰炸,不是"补救"。
//
// 状态分流(2026-10-17 立,根治"已恢复被当故障寄信"的假警报型):
//   现役 Alertmanager 配置 send_resolved: true(tmpl 现读),恢复事件同样 POST 进本桥。
//   此前本文件全文不读 alert.status ⇒ 一条恢复与一条新故障走同一条邮件流水线,
//   标题都是"基础设施告警 — X";故障持续 >去重窗口后才恢复的,那封"恢复"就会以
//   故障面目到人(§5e-1 要杜绝的正是这种把人训回"忽略告警"的假警报)。
//   现在:显式 status=resolved ⇒ 只记账(**不摘去重档**,保留 lastSentTs 并登记 24h 同身份上限)+
//   ALERT-CLEARED 形态记日志(与 deploy/win/ihui-deploy.ps1 的 ALERT-CLEARED 同形态),
//   **绝不进故障邮件**;status 缺失/其它取值 ⇒ fail-open 照旧到人(失效方向必须是
//   "多报一次",绝不能是"多静音一条")。
//   日志状态维(同日补):审计同时留下一格 —— 此前每行都不落 status ⇒ "过去到底有没有把恢复
//   当故障寄过信"今天无人可答。现在本批每条既有日志行的尾部都带
//   ` status=<档> queued=<n> cleared=<m>`(档 ∈ firing/resolved/missing/other,混合批按固定序
//   以 + 连接;空批不落判据 = status=empty)。它落在**既有行**上:写日志的落点仍只有 writeLog
//   那一处(一条通道),行首形状一字未动,按行 grep 的下游照旧读得动。
//   取值实现唯一 = alertStatusOf,分流与日志共用同一把尺子(§0.6,第二份必然漂开)。
//
// 自监控端点(2026-09-27 起,两个端点各服务一个读者,**不可互换**):
//   GET /health   → application/json,给人和「生产值守巡检」班次读(契约一字未改)
//   GET /metrics  → text/plain; version=0.0.4,Prometheus 抓取专用(指标见 METRIC_SPECS)
//   为什么必须有两个:Prometheus 3.x 校验抓取的 Content-Type,把 job 指到 /health 会让该
//   target 恒 down ⇒ up{job="alertbridge"}==0 恒成立 ⇒ AlertBridgeDown 是一条**永远在响的
//   假告警**,而它是"运维邮件链路断了没人知道"这一维唯一的自动判据 —— 恒响会把真故障一起
//   淹掉。指标只做观测,不参与任何投递/去重判定。
//
// 配置(环境变量,均可省略):
//   BRIDGE_PORT          监听端口(默认 9096)
//   BRIDGE_DEDUP_MIN     同一告警(alertname+instance)去重窗口分钟数(默认 230;
//                        必须 < Alertmanager repeat_interval,否则重推会被误压成 8h)
//   LOG_FILE             日志文件(默认 D:\DevEnv\logs\alert-webhook-bridge.log)
//   STATE_FILE           去重状态文件(默认 D:\DevEnv\state\alert-bridge-state.json)
//                        —— 未送达标记 UNDEL_FILE 落在其同目录,随其一起可重定向(沙箱用)
//   BRIDGE_MAIL_ENABLED  邮件通道开关(缺省=开;0/false/off/no 显式关闭)
//   BRIDGE_MAIL_TO       收件人覆盖;**缺省不传 --to**,由派发器回读 apps/api/.env 的 ALERT_EMAIL_TO
//   BRIDGE_MAIL_TIMEOUT_MS 派发器单次调用墙上时钟上限(默认 90000)
//   BRIDGE_MAIL_RETRY_DELAY_MS  双失败后后台重试的延迟毫秒数(默认 30000;只重试一次)
//   BRIDGE_MAIL_RETRY_WINDOW_MS 重试发送窗口毫秒数(默认 120000;距首次失败超过它即放弃)
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
// 日志来源锚点(唯一实现住在这个模块里:标签名与分区取值一律现读 promtail 的产出,
// 本文件不得再写一份名单 —— 两处算同一件事必漂移)。
const logAnchor = require('./log-source-anchor.js')

// ── 配置 ──────────────────────────────────────────────────────────────────────
const PORT = parseInt(process.env.BRIDGE_PORT || '9096', 10)
// 去重窗口必须**严格小于** Alertmanager repeat_interval(现读仓库配置 4h)。同值 240 时,
// AM 的重推只要比桥侧记录的投递时刻早哪怕几毫秒,就会落进窗口被压掉、只能等再下一次
// repeat ⇒ 持续告警从"4h 重报"沉默成"8h 重报"。留 10 分钟余量(230)把这条边界变成
// 结构性不可能;实测 AM 通知落账比桥侧收件晚 0.398~1.183s,余量远大于该差值。
// 仍可由 BRIDGE_DEDUP_MIN 覆盖;覆盖值 ≥ AM repeat_interval 时自检 ⑪ 会红。
const DEDUP_WINDOW_MIN = parseInt(process.env.BRIDGE_DEDUP_MIN || '230', 10)
/**
 * 恢复后的 24h 发送上限(2026-11-03 立,取代 2026-10-18 的 RECOOL 冷却窗)。
 *
 * 真正的多信源不是 `ALERT-CLEARED` 分支本身,而是它调用的 `applyResolvedClears`:
 * 只要距上次投递 ≥ RECOOL_MIN(30 分钟)就 `store.delete(key)`;下一次 firing 被当新身份,
 * 230 分钟窗当场失效。AiLlm 席实测 AiLlmHighFailureRate 24h 内 resolved 11 次、寄出 5 封,
 * 间隔 43/38/62 分钟 —— 远小于 230。
 *
 * 现在:resolved **一律不摘档**(`store` 里的 lastSentTs 原样保留),另在本文件的状态里登记
 * `holds[key] = lastSentTs + 24h`;判据先看 holds,再走原有 230 分钟窗口。
 * 这条 24h 上限与 BRIDGE_DEDUP_MIN **解耦**:不把 230 硬抬到 1440(那会违反"窗口必须
 * 严格小于 AM repeat_interval=240 分钟"的余量约束,把持续告警压成 8h 沉默)。
 * 只压"恢复过的身份"⇒ 持续真故障的首次投递、以及窗口外的重报照旧即时,不会被一起静音。
 */
const IDENTITY_HOLD_MS = (() => {
  const rawMs = parseInt(String(process.env.BRIDGE_IDENTITY_HOLD_MS == null ? '' : process.env.BRIDGE_IDENTITY_HOLD_MS), 10)
  if (Number.isFinite(rawMs) && rawMs >= 0) return rawMs
  const rawMin = parseInt(String(process.env.BRIDGE_IDENTITY_HOLD_MIN == null ? '' : process.env.BRIDGE_IDENTITY_HOLD_MIN), 10)
  return Number.isFinite(rawMin) && rawMin >= 0 ? rawMin * 60 * 1000 : 24 * 60 * 60 * 1000
})()
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
/** 非负整数环境量:非法/负数回落到默认值(配置写坏不得把重试退化成"立即轰炸"或"永不重试") */
function envNonNegInt(name, fallback) {
  const v = parseInt(String(process.env[name] == null ? '' : process.env[name]), 10)
  return Number.isFinite(v) && v >= 0 ? v : fallback
}
/**
 * 双失败后的**一次**后台重试(2026-11-02)。为什么是后台重试而不是回滚去重档:
 * partitionAlerts 的锚点语义是"上一次真正投递时刻",回滚它 => 下一次同 group 的任何推送
 * 都会立刻再寄一遍,AM group 每 5 分钟就可能变一次 => 一封失败告警会在通道抖动时变成
 * 连续多封(多信)。后台重试只对"那一批"补一次,不改变任何身份的去重锚点。
 * 两个闸门:延迟 30s(给瞬时故障自愈时间);距首次失败超过 2min 不再发送(陈旧告警补发=轰炸)。
 */
const MAIL_RETRY_DELAY_MS = envNonNegInt('BRIDGE_MAIL_RETRY_DELAY_MS', 30000)
const MAIL_RETRY_WINDOW_MS = envNonNegInt('BRIDGE_MAIL_RETRY_WINDOW_MS', 120000)
/** 重启接管上限:超过 10 分钟的待重试一律丢弃(进程不在时故障早已过去,补发只会训人忽略告警) */
const MAIL_RETRY_MAX_AGE_MS = 10 * 60 * 1000
/** 待重试队列:与 STATE_FILE 同目录 ⇒ 沙箱把 STATE_FILE 指进临时目录即零线上污染 */
const RETRY_FILE = path.join(path.dirname(STATE_FILE), 'alert-bridge-mail-retry-pending.json')
/** 空串 ⇒ 不传 --to,由派发器按 process.env → apps/api/.env 的 ALERT_EMAIL_TO 解析(不复制第二份收件人真相) */
const MAIL_TO = String(process.env.BRIDGE_MAIL_TO || '').trim()
const MAIL_SOURCE = 'ihui-alertbridge'

// ── 日志来源分流(G-472 告警侧)─────────────────────────────────────────────────
// 采集器与监控自身造成的日志(pg-exporter 每 15 秒的 collector failed、Loki 把自己收到的
// 查询语句原样打进 querier INFO 行……)不得与真实业务错误共用同一条到人告警:前者只记账
// (日志 + 指标),后者照旧进邮件。**不新增任何发信通道** —— 到人仍只有品牌派发器那一条。
// 分区标签名与取值一律现读 promtail 的产出并与 alerts.yml 的同行标记对账(见
// log-source-anchor.js);对不上时 fail-open:一条都不压,全部照旧到人,并把"分流失明"
// 落成 ihui_alertbridge_log_anchor_ok=0 让 LogSourceSplitBlind 去响。
// TTL 缓存:改回同值后不必重启就恢复分流;重启也不是必要条件。
const LOG_ANCHOR_TTL_MS = parseInt(process.env.BRIDGE_LOG_ANCHOR_TTL_MS || '300000', 10)
const logAnchorCache = { untilMs: 0, value: null, announced: false }

function currentLogAnchor(nowMs = Date.now()) {
  if (logAnchorCache.value && nowMs < logAnchorCache.untilMs) return logAnchorCache.value
  let resolved
  try {
    resolved = logAnchor.resolveAnchor(REPO_ROOT)
  } catch (e) {
    resolved = { ok: false, problems: [`锚点解析异常: ${e && e.message ? e.message : e}`] }
  }
  logAnchorCache.value = resolved
  logAnchorCache.untilMs = nowMs + LOG_ANCHOR_TTL_MS
  logAnchorOk = !!resolved.ok
  // 失明必须大声且**只喊一次**一条(它是每 5 分钟重评一次的判据,不是每次 webhook 的新故障);
  // 恢复也要喊,否则"什么时候不再响"没人知道。
  if (!resolved.ok && !logAnchorCache.announced) {
    logAnchorCache.announced = true
    writeLog(`[anchor][WARN] 日志来源分流失明(本轮全部照旧到人,未压任何一条): ${(resolved.problems || []).join('; ')}`)
  } else if (resolved.ok && logAnchorCache.announced) {
    logAnchorCache.announced = false
    writeLog(`[anchor] 日志来源分流已恢复: ${resolved.label} ∈ [${resolved.self}] 只报不炸 / [${resolved.page}] 照旧到人`)
  }
  return resolved
}

function writeLog(msg) {
  const line = `${new Date().toISOString()} ${msg}\n`
  try { fs.appendFileSync(LOG_FILE, line) } catch { /* 日志写不进不能拖垮接收面;console 仍留一份 */ }
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
const dedup = new Map() // key=`alertname|instance` -> lastDeliveredTs(最近一次**真正投递**时刻;被抑制的推送不写)
/** 恢复后的 24h 上限:key -> holdUntilTs。resolved 只写这里、**不删 dedup**;
 *  与 BRIDGE_DEDUP_MIN 解耦(230 仍留给持续 firing 的重复推送,见 IDENTITY_HOLD_MS 注释)。 */
const clearHolds = new Map()
const MAX_DEDUP_AGE_MS = DEDUP_WINDOW_MIN * 60 * 1000
/**
 * 时钟容差(2026-11-02 三修)。时间戳落在"未来"只有两种来源:机器时钟回拨,或状态文件被
 * 写坏/手工改成未来值。两种都**不得**构成压制 —— 未来时刻 + 窗口会把该身份压到时钟追平
 * 为止(实测 +4h 的条目让同身份 firing 直接被判重),方向锁只能是"多寄一封",与派发器
 * decideDedupe 的 `elapsed < 0 ⇒ send` 同向。60s 只容忍正常 NTP 抖动。
 */
const CLOCK_SKEW_MS = 60 * 1000

/** 解析 Alertmanager 配置里的 Go duration(4h/30m/45s)→ 毫秒;解析不了返回 null,
 *  自检据此判红而不是悄悄兜一个默认值(两边同值这件事必须由配置本身来证)。 */
function parseGoDurationMs(text) {
  const m = /^\s*(\d+)(h|m|s)\s*$/.exec(String(text == null ? '' : text))
  if (!m) return null
  return Number(m[1]) * { h: 3600000, m: 60000, s: 1000 }[m[2]]
}

/** 去重判据(纯读,注入 store ⇒ 只有一个状态源,不造第二份;**判定本身绝不写状态**)。
 *  holds(可选)= 恢复后登记的 24h 上限表;它先于窗口判定,且与 BRIDGE_DEDUP_MIN 解耦。 */
function decideDedup(store, key, nowMs, windowMs, holds = null) {
  const hold = holds && typeof holds.get === 'function' ? Number(holds.get(key)) : 0
  // 上限值本身由本进程写(≤ lastSentTs + IDENTITY_HOLD_MS);越界的坏值不得压制(同上:坏状态
  // 文件/时钟回拨的失效方向必须是"多寄一封",不是"多静音一条")。
  if (Number.isFinite(hold) && hold > nowMs && hold - nowMs <= IDENTITY_HOLD_MS + CLOCK_SKEW_MS) return true
  const last = store.get(key)
  if (!last) return false
  const ts = Number(last)
  if (!Number.isFinite(ts) || ts <= 0) return false
  // 未来时间戳不构成压制(见 CLOCK_SKEW_MS):放行后由 partitionAlerts 用本次时刻覆盖,
  // 未来值自愈;否则时钟回拨/坏状态文件会让同身份告警"该发的没发"。
  if (ts > nowMs + CLOCK_SKEW_MS) return false
  return nowMs - ts < windowMs
}
/** 一批告警 → 待投递子集(只有判定**可投递**的条目才落状态;被抑制的只读旧值、
 *  不得写回时间戳 —— 写回就是给窗口续期,持续 firing 的告警会被永远压住) */
function partitionAlerts(alerts, store, nowMs, windowMs, holds = null) {
  let dedupedCount = 0
  const toPush = (Array.isArray(alerts) ? alerts : []).filter((a) => {
    const labels = a.labels || {}
    const key = `${labels.alertname || ''}|${labels.instance || ''}`
    const isDup = decideDedup(store, key, nowMs, windowMs, holds)
    if (isDup) { dedupedCount++; return false }
    store.set(key, nowMs) // 仅"可投递"这一刻建档/刷新 —— 窗口锚在最近一次真正投递
    // 真发出去 = 24h 上限已到期(否则上面就判重了);顺手摘掉过期 hold,不让它继续堆在状态里。
    if (holds && typeof holds.delete === 'function') holds.delete(key)
    return true
  })
  return { toPush, dedupedCount }
}

/** 状态文件形态: `dedup`(上次真正投递时刻) + `holds`(恢复后登记的 24h 上限)。
 *  纯函数 ⇒ --self-test 钉死"无预算/计数字段"的无总量封顶契约(这两张表都不是配额)。 */
function serializeState(store, nowMs, windowMs = MAX_DEDUP_AGE_MS, holds = null) {
  const dedupObj = {}
  for (const [k, tsRaw] of store) {
    const ts = Number(tsRaw)
    // 非数/非正/未来时刻一律不落盘:重启后不得凭一个坏值压制该身份(见 CLOCK_SKEW_MS)。
    if (!Number.isFinite(ts) || ts <= 0 || ts > nowMs + CLOCK_SKEW_MS) continue
    if (nowMs - ts < windowMs) dedupObj[k] = ts
  }
  const holdsObj = {}
  if (holds && typeof holds.forEach === 'function') {
    for (const [k, v] of holds) {
      const until = Number(v)
      // 已到期的不再落盘(它不再压制任何东西);越界(> 24h+skew)的坏值也不给压制留载体。
      if (!Number.isFinite(until) || until <= nowMs) continue
      if (until > nowMs + IDENTITY_HOLD_MS + CLOCK_SKEW_MS) continue
      holdsObj[k] = until
    }
  }
  return JSON.stringify({ dedup: dedupObj, holds: holdsObj })
}
/**
 * 落盘**必须原子**(2026-11-02 三修):先写同目录临时文件再 rename 覆盖。
 * 原实现直接 writeFileSync 到目标路径,NSSM 硬杀/断电落在写入中途会留下截断 JSON;
 * 下次启动解析失败 ⇒ 静默空态 ⇒ 同身份告警全量重报(多信方向)。rename 在同一卷上是
 * 原子替换:读者要么看到旧完整文件、要么看到新完整文件,不存在半写中间态。
 */
function persistState(file, store, nowMs, log, windowMs = MAX_DEDUP_AGE_MS, holds = null) {
  const tmp = `${file}.tmp-${process.pid}`
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(tmp, serializeState(store, nowMs, windowMs, holds), 'utf8')
    fs.renameSync(tmp, file)
    return true
  } catch (e) {
    try { fs.rmSync(tmp, { force: true }) } catch { /* 残留由下次同名覆盖 */ }
    // 状态落不下来 = 重启后去重失效(同一告警会重寄)。不得静默。
    log(`[state] 保存去重状态失败(重启后去重会重置): ${e.message}`)
    return false
  }
}
/**
 * 读回去重态;返回载入条数(null=首启或文件损坏,按空态起算)。nowMs/windowMs 可注入供 --self-test 钉陈旧条目判据。
 * 文件损坏/形态不对时:**先备份原文件再按空态起算**,并写 ERROR 日志 + 计数 —— 不吞错,
 * 也不让下一次 persist 把唯一的诊断证据覆盖掉(备份可人工抢救回有效条目)。
 * 条目级异常(非数字/非正/未来时刻)只跳过该条并如实报数,不牵连整份文件(保留可恢复能力)。
 */
function quarantineStateFile(file, log, why, label = '状态文件') {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const bak = `${file}.corrupt-${stamp}`
  try {
    fs.renameSync(file, bak)
    if (log) log(`[state][ERROR] ${label}损坏(${why}),已原样备份到 ${bak};本次按空态起算 —— 可从备份人工恢复`)
    return true
  } catch (e) {
    if (log) log(`[state][ERROR] ${label}损坏(${why})且备份失败(${e.message}) —— 下一次落盘会覆盖原文件,请立即人工留存`)
    return false
  }
}
function loadDedupState(file, store, nowMs = Date.now(), windowMs = MAX_DEDUP_AGE_MS, log = null, holds = null) {
  let raw
  try {
    raw = fs.readFileSync(file, 'utf8')
  } catch (e) {
    // 文件不存在 = 正常首启,不算故障;其余读失败(权限/占用)才是异常。
    if (e.code !== 'ENOENT' && log) log(`[state][ERROR] 状态文件不可读(${e.message}) —— 本次按空态起算`)
    return null
  }
  let s
  try {
    s = JSON.parse(raw)
  } catch (e) {
    counters.stateLoadFailures += 1
    quarantineStateFile(file, log, `JSON 解析失败: ${e.message}`)
    return null
  }
  // 顶层必须是普通对象、dedup 必须是普通对象(数组的 typeof 也是 object ⇒ 必须显式排除,
  // 否则索引 0/1 会被当成身份键读进去,既不报错也毫无意义)。
  if (!s || typeof s !== 'object' || Array.isArray(s)) {
    counters.stateLoadFailures += 1
    quarantineStateFile(file, log, '顶层不是 JSON 对象')
    return null
  }
  const stored = s.dedup
  if (!stored || typeof stored !== 'object' || Array.isArray(stored)) {
    counters.stateLoadFailures += 1
    quarantineStateFile(file, log, 'dedup 字段缺失或类型不是对象')
    return null
  }
  const now = nowMs
  let n = 0
  let skipped = 0
  for (const k of Object.keys(stored)) {
    const ts = Number(stored[k])
    // 非数/非正/未来时刻:不载入。未来值会被判据层放行并覆盖(多寄一封),绝不让它压制。
    if (!Number.isFinite(ts) || ts <= 0 || ts > now + CLOCK_SKEW_MS) { skipped += 1; continue }
    if (now - ts < windowMs) { store.set(k, ts); n += 1 }
  }
  // holds(2026-11-03):恢复后登记的 24h 上限。旧格式没有这张表 ⇒ 空表,不影响 dedup。
  // 条目校验:非数/已到期/越界(> IDENTITY_HOLD_MS+skew)一律不载入;坏值方向仍是"多寄一封"。
  let heldN = 0
  if (holds && typeof holds.set === 'function' && s.holds && typeof s.holds === 'object' && !Array.isArray(s.holds)) {
    for (const k of Object.keys(s.holds)) {
      const until = Number(s.holds[k])
      if (!Number.isFinite(until) || until <= now || until > now + IDENTITY_HOLD_MS + CLOCK_SKEW_MS) continue
      holds.set(k, until)
      heldN += 1
    }
  } else if (holds && s.holds != null && (typeof s.holds !== 'object' || Array.isArray(s.holds))) {
    if (log) log('[state][WARN] holds 字段类型不对,已忽略(去重表照常载入)')
  }
  if (skipped && log) log(`[state][WARN] 状态文件有 ${skipped} 条时间戳非法(非数/非正/未来),已跳过;其余 ${n} 条正常载入`)
  if (heldN && log) log(`[state] 载入 ${heldN} 条恢复后 24h 发送上限(同身份在到期前不再重报)`)
  return n
}

// ── 待重试队列(双失败后的一次后台重试;2026-11-02)──────────────────────────────
// 为什么落盘:重试要能扛 NSSM 硬杀重启。为什么不无限期接管:补发 20 分钟前的告警
// 等于把"已经过去、可能早已恢复"的故障重新炸一遍,那是新造轰炸而不是补救。
function serializeRetryQueue(queue, nowMs = Date.now()) {
  const pending = []
  for (const e of queue.values()) {
    if (!e || !Array.isArray(e.alerts)) continue
    const first = Number(e.firstAttemptTs)
    // 未来时刻(时钟回拨)与超过接管上限的一律不写:重试的前提是"这次失败还新鲜"。
    if (!Number.isFinite(first) || first <= 0 || first > nowMs + CLOCK_SKEW_MS) continue
    if (nowMs - first > MAIL_RETRY_MAX_AGE_MS) continue
    const next = Number(e.nextAttemptTs)
    pending.push({
      id: String(e.id || ''),
      firstAttemptTs: first,
      nextAttemptTs: Number.isFinite(next) ? next : first + MAIL_RETRY_DELAY_MS,
      alerts: e.alerts,
      why: String(e.why || ''),
    })
  }
  return JSON.stringify({ pending })
}
/** 原子写(同 persistState):重试队列被截断就只剩"重启后不再补救",且现场会被下一次覆盖 */
function persistRetryQueue(file, queue, nowMs, log) {
  const tmp = `${file}.tmp-${process.pid}`
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(tmp, serializeRetryQueue(queue, nowMs), 'utf8')
    fs.renameSync(tmp, file)
    return true
  } catch (e) {
    try { fs.rmSync(tmp, { force: true }) } catch { /* 残留由下次同名覆盖 */ }
    if (log) log(`[mail][retry][ERROR] 待重试记录落盘失败(重启后这条补救会丢): ${e.message}`)
    return false
  }
}
/**
 * 启动接管:丢弃超过 MAIL_RETRY_MAX_AGE_MS 的条目,所以"15 分钟前的 pending 重启后不会补发"。
 * 文件坏/形态不对 => 备份 + 空队列(与去重状态同一条"不吞错"纪律),绝不因重试记录坏掉而拒绝启动。
 */
function loadRetryQueue(file, nowMs = Date.now(), log = null) {
  let raw
  try {
    raw = fs.readFileSync(file, 'utf8')
  } catch (e) {
    if (e.code !== 'ENOENT' && log) log(`[mail][retry][ERROR] 待重试记录不可读(${e.message}) —— 本次不接管任何重试`)
    return new Map()
  }
  let s
  try {
    s = JSON.parse(raw)
  } catch (e) {
    quarantineStateFile(file, log, `JSON 解析失败: ${e.message}`, '待重试记录')
    return new Map()
  }
  if (!s || typeof s !== 'object' || Array.isArray(s) || !Array.isArray(s.pending)) {
    quarantineStateFile(file, log, '顶层不是含 pending 数组的对象', '待重试记录')
    return new Map()
  }
  const now = nowMs
  const q = new Map()
  let dropped = 0
  for (const e of s.pending) {
    if (!e || typeof e !== 'object' || typeof e.id !== 'string' || !e.id || !Array.isArray(e.alerts)) { dropped += 1; continue }
    const first = Number(e.firstAttemptTs)
    const next = Number(e.nextAttemptTs)
    if (!Number.isFinite(first) || first <= 0 || first > now + CLOCK_SKEW_MS || !Number.isFinite(next)) { dropped += 1; continue }
    if (now - first > MAIL_RETRY_MAX_AGE_MS) { dropped += 1; continue }
    q.set(e.id, { id: e.id, firstAttemptTs: first, nextAttemptTs: next, alerts: e.alerts, why: String(e.why || '') })
  }
  if (dropped && log) log(`[mail][retry][WARN] 丢弃 ${dropped} 条过期/非法的待重试记录(超过 ${Math.floor(MAIL_RETRY_MAX_AGE_MS / 60000)} 分钟的补发等于新造轰炸)`)
  return q
}

// ── 自监控指标(GET /metrics,标准 Prometheus 文本格式)───────────────────────────
// 为什么必须有 /metrics 而不是把 prometheus 指到 /health:Prometheus 3.x 抓取时**强制校验
// Content-Type**,而 /health 返回 application/json ⇒ 该 target 恒 down ⇒
// `up{job="alertbridge"} == 0` 恒成立 ⇒ alerts.yml 的 AlertBridgeDown 是一条**永远在响的假告警**。
// 而它是"运维邮件链路断了没人知道"这一维唯一的自动判据,恒响的告警会把真故障一起淹掉
// (告警疲劳的标准成因;与 AGENTS §12e"恒红门唯一结局是逼人绕过"是同一条物理)。
//
// 纪律(改动边界):这一段**只做观测**。所有计数器都由既有链路顺手 +1,不参与任何投递、
// 去重、闸门判定;一个数的读法都不会改变 mailGate / partitionAlerts / deliverMail 的结论。
// /health 的 JSON 契约**一字不改**(值守巡检班次直连它并读 mailUndelivered,见本目录 README)。
// 零依赖:本服务是常驻 .cjs,不引 prom-client(与它 import 不了 TS 包是同一条结构约束)。
const PROC_START_MS = Date.now()

/** 单调递增的累计量(进程生命周期内)。重启归零是 counter 的正常语义,下游一律用 rate() 读。 */
const counters = {
  webhooksReceived: 0,       // 收到的 webhook 请求数(含空批次)
  alertsReceived: 0,         // 收到的告警条数(去重**前**)
  dedupSuppressed: 0,        // 按 alertname+instance 身份压下的条数 —— "压下了多少"
  batchesDelivered: 0,       // 投递成功的批次 —— 与 alertsDelivered 一起回答"真寄出多少"
  batchesFailed: 0,          // 品牌 + --plain 两条路都失败(告警从未到人)
  batchesSkipped: 0,         // 闸门跳过(空批 / BRIDGE_MAIL_ENABLED=0):跳过不是失败,不得混计
  alertsDelivered: 0,        // 真正随邮件寄出的告警条数
  plainFallbacks: 0,         // 品牌模板失败但纯文本救回:版式退化了,投递没丢 —— 必须可见
  statePersistFailures: 0,   // 去重态落盘失败 ⇒ 重启后去重重置(本文件注释里那个"重寄"洞的前置信号)
  stateLoadFailures: 0,      // 状态文件存在但读不出(JSON 坏/形态不对):原文件已备份,本次按空态起算
  undeliveredMarks: 0,       // 写下 UNDELIVERED 标记的次数
  selfScopeReported: 0,      // 按来源锚点判为"采集器/监控自身造成"、只记账不炸到人的条数
  alertsCleared: 0,          // 显式 status=resolved 被清偿(ALERT-CLEARED 记账、未冒充故障寄信)的条数
  alertsClearedHeld: 0,      // 恢复但判为抖动、去重档被保留(压住下一轮重寄)的条数 —— "压住了多少重寄"
  mailRetriesOk: 0,          // 后台重试成功(UNDEL 已清;不改去重锚点、不计第二批 delivered)
  mailRetriesFail: 0,        // 后台重试仍失败(UNDEL 保留,一次退避已用完,不再重试)
  mailRetriesExpired: 0,     // 重试到时已超过发送窗口,主动放弃(不补发陈旧告警)
}
/** 日志来源锚点的活性(1=两侧名字对得上、分流在跑;0=失明 ⇒ 本桥已 fail-open 全照旧到人)。 */
let logAnchorOk = false
/** 最近一次投递尝试/成功的墙上时刻(秒)。up==1 而它长期不推进 = 链路活着但从未投递过任何东西。 */
let lastMailAttemptTs = 0
let lastMailSuccessTs = 0
/** 待重试批次(id -> entry)与计时器(id -> Timeout)。记录本身另落 RETRY_FILE(重启可接管) */
const pendingRetries = new Map()
const retryTimers = new Map()
let retrySeq = 0

/** /metrics 的 Content-Type —— Prometheus 靠 `version=0.0.4` 这一参数认 scrape_protocol */
const METRICS_CONTENT_TYPE = 'text/plain; version=0.0.4; charset=utf-8'

/** 抓取时刻的快照(纯数据,renderMetrics 的唯一输入 ⇒ 渲染可被 --self-test 直接钉,不必真起服务) */
function metricsSnapshot(nowMs = Date.now()) {
  return {
    uptimeSeconds: Math.max(0, Math.floor((nowMs - PROC_START_MS) / 1000)),
    mailEnabled: MAIL_ENABLED,
    mailUndelivered: fs.existsSync(UNDEL_FILE),
    dedupKeys: dedup.size,
    dedupWindowSeconds: Math.floor(MAX_DEDUP_AGE_MS / 1000),
    logAnchorOk,
    lastMailAttemptTs,
    lastMailSuccessTs,
    counters: { ...counters },
  }
}

/**
 * 渲染成标准 Prometheus 文本格式(# HELP / # TYPE + 样本行,以 \n 收尾)。
 * 纯函数 + 显式表驱动:新增一个指标只许在 METRIC_SPECS 里加一行,
 * 这样"有没有漏写 TYPE""名字前缀对不对"这类格式错是**结构上**发生不了的。
 * 非有限值一律落成 0 而不是 NaN —— 一条 NaN 会让 Prometheus **整次抓取**失败,
 * 那等于把"多一个指标"变成"链路又瞎了",宁可把一个数写钝也绝不再造一次失明。
 */
const METRIC_SPECS = [
  ['ihui_alertbridge_up', 'gauge', 'Always 1 while the bridge process serves requests (scrape success is the real liveness signal).', () => 1],
  ['ihui_alertbridge_uptime_seconds', 'gauge', 'Seconds since this bridge process started.', (s) => s.uptimeSeconds],
  ['ihui_alertbridge_mail_enabled', 'gauge', 'BRIDGE_MAIL_ENABLED: 1 = mail channel on, 0 = explicitly off (alerts are then dropped, not queued).', (s) => (s.mailEnabled ? 1 : 0)],
  ['ihui_alertbridge_mail_undelivered', 'gauge', '1 = an UNDELIVERED marker is on disk: some alert never reached anyone and nobody has succeeded since.', (s) => (s.mailUndelivered ? 1 : 0)],
  ['ihui_alertbridge_dedup_keys', 'gauge', 'Distinct alert identities currently inside the dedup window.', (s) => s.dedupKeys],
  ['ihui_alertbridge_dedup_window_seconds', 'gauge', 'Configured dedup window (BRIDGE_DEDUP_MIN) in seconds.', (s) => s.dedupWindowSeconds],
  ['ihui_alertbridge_webhooks_received_total', 'counter', 'Alertmanager webhook requests handled (including empty batches).', (s) => s.counters.webhooksReceived],
  ['ihui_alertbridge_alerts_received_total', 'counter', 'Alerts received before dedup.', (s) => s.counters.alertsReceived],
  ['ihui_alertbridge_alerts_dedup_suppressed_total', 'counter', 'Alerts suppressed by identity (alertname+instance) inside the dedup window.', (s) => s.counters.dedupSuppressed],
  ['ihui_alertbridge_alerts_selfscope_reported_total', 'counter', 'Alerts whose log-source anchor says "collector / monitoring self noise": recorded here (log + this counter) instead of waking a human. Zero when the split is blind.', (s) => s.counters.selfScopeReported],
  ['ihui_alertbridge_alerts_cleared_total', 'counter', 'Alerts with explicit status=resolved: recorded as ALERT-CLEARED; the dedup anchor is NOT deleted (a 24h per-identity hold is registered instead) and nothing is mailed as an incident.', (s) => s.counters.alertsCleared],
  ['ihui_alertbridge_alerts_cleared_held_total', 'counter', 'Resolved alerts whose dedup anchor was KEPT (never deleted since 2026-11-03), each registering a 24h per-identity send cap from lastSentTs. High values mean an alert is oscillating, not that it is healthy.', (s) => s.counters.alertsClearedHeld],
  ['ihui_alertbridge_log_anchor_ok', 'gauge', '1 = the log-source anchor label agrees between promtail and the alert rules, so the collector/business split is live; 0 = blind (bridge fails open and pages everything) — alerts.yml rule LogSourceSplitBlind reads this.', (s) => (s.logAnchorOk ? 1 : 0)],
  ['ihui_alertbridge_mail_batches_delivered_total', 'counter', 'Mail batches delivered on either the branded or the plain-text path.', (s) => s.counters.batchesDelivered],
  ['ihui_alertbridge_mail_batches_failed_total', 'counter', 'Mail batches where BOTH the branded and the plain-text path failed (alerts never reached a human).', (s) => s.counters.batchesFailed],
  ['ihui_alertbridge_mail_batches_skipped_total', 'counter', 'Mail batches skipped by the gate (empty batch / BRIDGE_MAIL_ENABLED=0). Skipped is not failed.', (s) => s.counters.batchesSkipped],
  ['ihui_alertbridge_mail_alerts_delivered_total', 'counter', 'Alerts actually carried out to a human inside delivered batches.', (s) => s.counters.alertsDelivered],
  ['ihui_alertbridge_mail_plain_fallback_total', 'counter', 'Deliveries rescued by the --plain downgrade because the branded template failed (layout degraded, delivery kept).', (s) => s.counters.plainFallbacks],
  ['ihui_alertbridge_mail_retry_total', 'counter', 'Background retries after both mail paths failed (one attempt per failed batch, dedup anchor untouched): result=ok delivered on retry; result=fail still failed (marker kept); result=expired skipped because the retry window had passed (no stale alert is sent).', (s) => s.counters.mailRetriesOk, '{result="ok"}'],
  ['ihui_alertbridge_mail_retry_total', 'counter', 'Same metric; one series per result label.', (s) => s.counters.mailRetriesFail, '{result="fail"}'],
  ['ihui_alertbridge_mail_retry_total', 'counter', 'Same metric; one series per result label.', (s) => s.counters.mailRetriesExpired, '{result="expired"}'],
  ['ihui_alertbridge_state_persist_failures_total', 'counter', 'Times dedup state failed to persist; after a restart dedup then silently resets and alerts get re-mailed.', (s) => s.counters.statePersistFailures],
  ['ihui_alertbridge_state_load_failures_total', 'counter', 'Times the dedup state file existed but was unparseable/wrong-shaped at startup (original quarantined as .corrupt-* and dedup started empty).', (s) => s.counters.stateLoadFailures],
  ['ihui_alertbridge_undelivered_marks_written_total', 'counter', 'UNDELIVERED markers written (each one means an alert batch went out blind).', (s) => s.counters.undeliveredMarks],
  ['ihui_alertbridge_mail_last_attempt_timestamp_seconds', 'gauge', 'Wall clock of the last mail delivery attempt, 0 = never attempted since start.', (s) => s.lastMailAttemptTs],
  ['ihui_alertbridge_mail_last_success_timestamp_seconds', 'gauge', 'Wall clock of the last successful delivery, 0 = never succeeded since start.', (s) => s.lastMailSuccessTs],
]

function renderMetrics(s, specs = METRIC_SPECS) {
  const lines = []
  const declared = new Set()
  for (const [name, type, help, read, labels] of specs) {
    const raw = Number(read(s))
    // 同一指标名可以有多条带不同 result 标签的样本行:HELP/TYPE 只在首次出现时声明一次
    // (Prometheus 文本格式里 TYPE 行只认指标名,重复声明会被判格式错)。
    if (!declared.has(name)) {
      lines.push(`# HELP ${name} ${help}`, `# TYPE ${name} ${type}`)
      declared.add(name)
    }
    lines.push(`${name}${labels || ''} ${Number.isFinite(raw) ? raw : 0}`)
  }
  return lines.join('\n') + '\n'
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
      try { child.kill('SIGKILL') } catch { /* 已退出 */ }
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
    if (msgFile) { try { fs.rmSync(msgFile, { force: true }) } catch { /* 临时文件残留由 .gitignore 兜住 */ } }
  }
}

// ── 未送达标记(唯一通道失败必须响;参照 check-credential-health 的 UNDELIVERED 机制)──
function markMailUndelivered(file, payload) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, JSON.stringify(payload, null, 2), 'utf8')
}
function clearMailUndelivered(file) {
  try { fs.rmSync(file, { force: true }) } catch { /* 文件本就不在 = 已清除 */ }
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
  if (plain.ok) { clearMailUndelivered(undelFile); counters.plainFallbacks += 1; return { ok: true, why: `品牌模板失败(${branded.why})→ 降级纯文本已送达` } }
  const why = `品牌模板失败(${branded.why});降级纯文本同样失败(${plain.why})`
  // 唯一到人通道寄不出去 = 故障从未被人看见。日志 + 标记双留痕,标记再写不出去就是双盲,单独吼出来。
  log(`[mail][ERROR] 未送达(告警从未到人): ${redact(why)}`)
  try {
    markMailUndelivered(undelFile, {
      ts: new Date().toISOString(),
      alerts: (alerts || []).map((a) => (a.labels || {}).alertname || 'unnamed'),
      why: redact(why),
    })
    counters.undeliveredMarks += 1
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

/**
 * 双失败 → 排**一次**后台重试(2026-11-02)。
 * 只登记这一批,绝不触碰 dedup 里任何身份的时间戳:回滚锚点会把"一次失败"放大成
 * "AM group 每变一次就重寄一次"(多信),而本文件另一头刚把这条治掉。
 */
function scheduleMailRetry(alerts, why, log) {
  const now = Date.now()
  retrySeq += 1
  const entry = {
    id: `${now}-${process.pid}-${retrySeq}`,
    firstAttemptTs: now,
    nextAttemptTs: now + MAIL_RETRY_DELAY_MS,
    alerts: Array.isArray(alerts) ? alerts : [],
    why: String(why || ''),
  }
  pendingRetries.set(entry.id, entry)
  persistRetryQueue(RETRY_FILE, pendingRetries, now, log)
  armRetryTimer(entry, { log })
  log(`[mail][retry] 已排一次后台重试(${MAIL_RETRY_DELAY_MS}ms 后;距首次失败超过 ${MAIL_RETRY_WINDOW_MS}ms 即放弃,不补发;去重锚点保持不变)`)
  return entry.id
}

/** 计时器到点(或重启接管时 nextAttemptTs 已过 ⇒ waitMs=0);窗口上限防止"睡过头"越过 2min */
function armRetryTimer(entry, ctx) {
  const waitMs = Math.max(0, Math.min(Number(entry.nextAttemptTs) - Date.now(), MAIL_RETRY_WINDOW_MS))
  const timer = setTimeout(() => { void runMailRetry(entry.id, ctx) }, waitMs)
  retryTimers.set(entry.id, timer)
}

/**
 * 唯一一次重试。成功 => 清 UNDEL + retry ok;仍失败 => UNDEL 保留 + retry fail + **不再排第二次**
 * (无限重试会把"通道断"变成"每 30 秒一封信",比丢信更糟)。
 */
async function runMailRetry(id, { log = writeLog, dispatch = dispatchBrandMail, undelFile = UNDEL_FILE, retryFile = RETRY_FILE } = {}) {
  retryTimers.delete(id)
  const entry = pendingRetries.get(id)
  if (!entry) return { ok: false, gone: true }
  const now = Date.now()
  if (now - entry.firstAttemptTs > MAIL_RETRY_WINDOW_MS) {
    counters.mailRetriesExpired += 1
    pendingRetries.delete(id)
    persistRetryQueue(retryFile, pendingRetries, now, log)
    log(`[mail][retry][WARN] 放弃重试:距首次失败 ${now - entry.firstAttemptTs}ms 已超过 ${MAIL_RETRY_WINDOW_MS}ms 窗口 —— 不补发陈旧告警(未送达标记保留)`)
    return { ok: false, expired: true }
  }
  let r
  try {
    r = await deliverMail(entry.alerts, { dispatch, log, undelFile })
  } catch (e) {
    r = { ok: false, why: `重试腿异常: ${redact(e && e.message ? e.message : e)}` }
  }
  pendingRetries.delete(id)
  persistRetryQueue(retryFile, pendingRetries, Date.now(), log)
  if (r.ok) {
    counters.mailRetriesOk += 1
    lastMailSuccessTs = Math.floor(Date.now() / 1000)
    log(`[mail][retry] 重试成功(唯一一次;此前的失败批次已到人): ${redact(r.why || '')}`)
    // deliverMail 的成功会清 UNDEL;但若还有别的批次在等重试,那个标记必须重新立起来,
    // 否则"一封救回"会把另一封仍双盲的证据抹掉。
    if (pendingRetries.size > 0) {
      try {
        markMailUndelivered(undelFile, {
          ts: new Date().toISOString(),
          alerts: [...pendingRetries.values()].flatMap((x) => (x.alerts || []).map((a) => (a.labels || {}).alertname || 'unnamed')),
          why: '仍有后台重试未完成',
        })
      } catch (e) {
        log(`[mail][retry][ERROR] 重写未送达标记失败(${redact(e.message)}) —— 请人工核对剩余待重试批次`)
      }
    }
  } else {
    counters.mailRetriesFail += 1
    log(`[mail][retry][ERROR] 重试仍失败,不再重试(一次退避已用完;未送达标记保留): ${redact(r.why || '')}`)
  }
  return r
}

/** 一批告警 → 投递计划(纯函数:先按来源分流、再对"要炸到人"的那一支做身份去重)。
 *  handleAlert 与 --self-test 都走这一条铰链 —— 分流判据若只在生产路径里内联一份,
 *  自检就是在测另一件事(本仓"判据必须在真跑它的那一刻才成立"同族)。 */
function planDelivery(alerts, anchor, store, nowMs, windowMs, holds = null) {
  const { page, selfReportOnly } = logAnchor.splitAlertsByLogSource(alerts, anchor)
  const { toPush, dedupedCount } = partitionAlerts(page, store, nowMs, windowMs, holds)
  return { toPush, dedupedCount, selfReportOnly, page }
}

/**
 * 单条告警的状态档(唯一取值实现,2026-10-17 立):
 * `splitAlertsByStatus` 的去向判定与日志状态维共用这一把尺子 —— 两处各写一遍必然漂开(§0.6)。
 * 词表:firing / resolved / missing(字段缺失或全空白)/ other(陌生取值)。
 * 本函数**只描述、不决定去向**;fail-open 的方向锁在 splitAlertsByStatus 那一格。
 */
function alertStatusOf(alert) {
  const st = String((alert && alert.status) || '').trim().toLowerCase()
  if (!st) return 'missing'
  if (st === 'firing' || st === 'resolved') return st
  return 'other'
}

/**
 * 按 Alertmanager 的 `status` 字段分流(纯函数,--self-test 成对钉):
 * 只有**显式** status=resolved 进清偿支;缺失/firing/其它取值一律 fail-open 留到人支
 * —— 失效方向必须是"多报一次",绝不能是"多静音一条"(AGENTS §5e-1/§0.10 同一条禁令)。
 */
function splitAlertsByStatus(alerts) {
  const paging = []
  const resolved = []
  for (const a of Array.isArray(alerts) ? alerts : []) {
    if (alertStatusOf(a) === 'resolved') resolved.push(a)
    else paging.push(a)
  }
  return { paging, resolved }
}

/**
 * 日志状态维(纯函数):` status=<档> queued=<n> cleared=<m>`,由调用点拼进**既有**日志行尾部
 * (不新增通道、不改行首形状)。补的是审计留下的那一格:历史日志从不记 status,所以
 * "过去有没有把恢复当故障寄过信"无法证明;从这一维起,任何一次投递/跳过/清偿都能在日志里对上。
 * queued/cleared 一律取调用点已经得出的分流结论(本函数不参与判定,只如实落账)。
 * 一批里多种档同时出现按 firing→resolved→missing→other 固定序以 + 连接(与输入顺序无关,
 * 否则同一批的两轮读数会写成两种形状);没有可判的对象 ⇒ status=empty,不折成任何一档(§0.3)。
 */
function statusDimension(alerts, queued, cleared) {
  const seen = new Set((Array.isArray(alerts) ? alerts : []).map(alertStatusOf))
  const kinds = ['firing', 'resolved', 'missing', 'other'].filter((k) => seen.has(k))
  return `status=${kinds.length ? kinds.join('+') : 'empty'} queued=${Number(queued) || 0} cleared=${Number(cleared) || 0}`
}

/**
 * 恢复事件记账(纯函数,2026-11-03 改):**绝不删档**。
 *
 * 旧实现(2026-10-18)在 `now - last >= RECOOL_MIN(30 分钟)` 时 `store.delete(key)`,
 * 语义是"真恢复了,下次故障立刻再报";代价是同身份 30 分钟后再次 firing 被当新身份,
 * 230 分钟窗当场失效。真实日志里 AiLlmHighFailureRate 24h resolved 11 次、
 * 相邻两封间隔 43/38/62 分钟,远小于 230 —— 这就是轰炸源。
 *
 * 现在:保留 lastSentTs,并在 holds 里登记 `lastSentTs + holdMs`(默认 24h)。
 * 上限**从上次真正投递起算**,不是从 CLEAR 起算 —— 所以"恢复之前已寄过、恢复后仍在
 * 24h 内"的 re-fire 一样被压住。`cleared` 恒为空表(保留字段只为调用点/日志口径稳定)。
 * 档本就不存在(从未投递)⇒ 不登记上限:那不是"恢复",是第一次故障,首封必须即时送达。
 */
function applyResolvedClears(store, resolved, nowMs = Date.now(), holds = null, holdMs = IDENTITY_HOLD_MS) {
  const held = []
  const hold = Number.isFinite(Number(holdMs)) && Number(holdMs) >= 0 ? Number(holdMs) : IDENTITY_HOLD_MS
  for (const a of resolved || []) {
    const labels = (a && a.labels) || {}
    const key = `${labels.alertname || ''}|${labels.instance || ''}`
    const last = Number(store.get(key))
    if (Number.isFinite(last) && last > 0 && holds && typeof holds.set === 'function') {
      const until = Math.max(Number(holds.get(key)) || 0, last + hold)
      holds.set(key, until)
    }
    // 不再 store.delete(key):锚点必须活到 24h 上限到期,否则下一次 firing 又被当新身份。
    held.push(key)
  }
  return { cleared: [], held }
}

// ── webhook 处理 ───────────────────────────────────────────────────────────────
async function handleAlert(reqBody) {
  counters.webhooksReceived += 1 // 纯观测:以下判定链路一字未改
  const alerts = (reqBody && Array.isArray(reqBody.alerts)) ? reqBody.alerts : []
  if (!alerts.length) {
    writeLog('[alert] 空 alert 列表,忽略')
    return { skipped: 0 }
  }

  const now = Date.now()
  counters.alertsReceived += alerts.length
  // ⓪ 状态分流(2026-10-17):显式 resolved ⇒ 清偿 + ALERT-CLEARED 记账,绝不冒充故障寄邮件;
  //    其余(含 status 缺失)照旧走下方到人链路(fail-open,故障照寄不被静音)。
  const { paging, resolved } = splitAlertsByStatus(alerts)
  // 状态维只在本批**每一条既有日志行**的尾部落一次(行首形状与通道一字未动):分流结论与
  // 状态档必须同处一行,否则"这一封是哪一档寄出去的"还是得靠猜(历史日志正是这样丢的那格)。
  // queued 一律取**该条那一行的真实去向**:恢复支那一行取进入人链路的条数(paging),
  // 投递/跳过那几行取实际交到投递腿的条数(toPush) —— 一个数字糊两行就是把两件事写成一件。
  const statusDimOf = (queued) => statusDimension(alerts, queued, resolved.length)
  if (resolved.length) {
    counters.alertsCleared += resolved.length
    // 2026-11-03:恢复**一律不摘档**(旧行为按 RECOOL 30 分钟删档,是 43/38/62 分钟重寄的根因)。
    // 保留 lastSentTs,并在 clearHolds 登记 lastSentTs + 24h;到期前同身份 re-fire 一律不寄。
    const { cleared, held } = applyResolvedClears(dedup, resolved, now, clearHolds)
    counters.alertsClearedHeld += held.length
    const shown = resolved.slice(0, 3).map((a) => formatAlert(a).replace(/\n/g, ' / ')).join(' ;; ')
    const clearNote = held.length
      ? `${held.length} 条已登记 24h 同身份发送上限(从上次投递起算;${cleared.length} 条实际摘档 —— 本实现恒不摘档)`
      : `无投递锚点(首次故障前收到恢复,不设上限)`
    writeLog(`ALERT-CLEARED 收到恢复 ${resolved.length} 条(不计故障、不寄邮件;${clearNote};前 3 条:${shown}) ${statusDimOf(paging.length)}`)
  }
  if (!paging.length) {
    // 本批全是恢复:24h 上限同样必须回响应前落盘(跨重启延续;否则重启后第一条 firing 就会重寄)
    if (!persistState(STATE_FILE, dedup, now, writeLog, MAX_DEDUP_AGE_MS, clearHolds)) counters.statePersistFailures += 1
    return { cleared: resolved.length }
  }
  // ① 按日志来源分流:采集器/监控自身造成的 → 只记账;其余 → 照旧走身份去重 + 邮件。
  //    锚点对不上时 splitAlertsByLogSource 把所有告警放进"照旧到人"那一支(fail-open),
  //    所以这一层在失明态下与分流接入前的行为逐字一致(不会顺手压掉任何一条)。
  const anchor = currentLogAnchor(now)
  const { toPush, dedupedCount, selfReportOnly, page } = planDelivery(paging, anchor, dedup, now, MAX_DEDUP_AGE_MS, clearHolds)
  counters.dedupSuppressed += dedupedCount
  if (selfReportOnly.length) {
    counters.selfScopeReported += selfReportOnly.length
    // "只报不炸"不等于"没记":逐条留一行(外部文本一律过 formatAlert 的脱敏+形状归一),
    // 并计入 /metrics 的那个 counter ⇒ 静默变短在这里结构上不可能发生。
    for (const a of selfReportOnly) {
      writeLog(`[alert][selfscope] 只报不炸(来源分区 ${anchor.ok ? `${anchor.label}=${(a.labels || {})[anchor.label]}` : '未判定'}): ${formatAlert(a).replace(/\n/g, ' / ')} ${statusDimOf(toPush.length)}`)
    }
  }
  // 回响应前同步落盘(含 partitionAlerts 刚为**可投递**条目写入的时间戳;被抑制的不写也不动旧值)⇒ 跨重启延续,杜绝重启后重寄。
  if (!persistState(STATE_FILE, dedup, now, writeLog, MAX_DEDUP_AGE_MS, clearHolds)) counters.statePersistFailures += 1

  if (!toPush.length) {
    if (!page.length && selfReportOnly.length) {
      writeLog(`[alert] 本批 ${alerts.length} 条全部按来源判为只报不炸,未寄邮件(去重命中 ${dedupedCount} 条) ${statusDimOf(toPush.length)}`)
      return { skipped: dedupedCount, reported: selfReportOnly.length, cleared: resolved.length }
    }
    writeLog(`[alert] 到人那一支全部命中去重窗口(${page.length}条/${dedupedCount}条),跳过投递 ${statusDimOf(toPush.length)}`)
    return { skipped: dedupedCount, reported: selfReportOnly.length, cleared: resolved.length }
  }

  // 每批待投递告警直接寄一封(不同身份一律照寄,无任何计数闸/队列丢弃)
  lastMailAttemptTs = Math.floor(now / 1000)
  void sendMailLeg(toPush)
    .then((m) => {
      // 结论分类:成功 / 跳过 / 失败三态**不得并桶** —— 跳过(空批、显式关通道)写成失败
      // 就是在污染对账,与本文件 mailGate 的注释同一条理由。
      if (m.ok) { counters.batchesDelivered += 1; counters.alertsDelivered += toPush.length; lastMailSuccessTs = Math.floor(Date.now() / 1000) }
      else if (m.skipped) counters.batchesSkipped += 1
      else {
        counters.batchesFailed += 1
        // 双失败只补一次后台重试;partitionAlerts 已写下的去重锚点**不回滚**(见 scheduleMailRetry 注释)。
        scheduleMailRetry(toPush, m.why, writeLog)
      }
      const tag = m.ok ? '已送达' : m.skipped ? '跳过' : '失败'
      writeLog(`[mail] ${tag}: ${redact(m.why || '')}(本批 ${toPush.length} 条,身份去重窗口 ${DEDUP_WINDOW_MIN} 分钟) ${statusDimOf(toPush.length)}`)
    })
    .catch((e) => {
      // deliverMail 内部已把投递异常收敛成结论;走到这里只能是结论链路自身异常 —— 同样必须响。
      writeLog(`[mail][ERROR] 投递腿未收敛异常: ${redact(e && e.message ? e.message : e)} ${statusDimOf(toPush.length)}`)
    })
  return { queued: toPush.length, reported: selfReportOnly.length, cleared: resolved.length }
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

  // Prometheus 抓取端点(标准文本格式)。/health 是**给人/巡检班次读的 JSON 契约**,两者不互换:
  // 把 scrape 指到 /health 会让该 target 恒 down(Prometheus 3.x 校验 Content-Type),
  // 于是 AlertBridgeDown 恒响 —— 本端点存在的唯一理由就是让"桥活着"与"指标抓得动"同义。
  if (req.method === 'GET' && req.url.split('?')[0] === '/metrics') {
    res.writeHead(200, { 'Content-Type': METRICS_CONTENT_TYPE })
    return res.end(renderMetrics(metricsSnapshot()))
  }

  // 仅接受 Alertmanager webhook(v2 API 用 POST /alert 或任意 POST)
  if (req.method === 'POST') {
    let body
    try { body = await parseBody(req) } catch {
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
    '两个只读端点: GET /health(JSON,值守巡检读) / GET /metrics(Prometheus 抓取专用,只观测)',
    '邮件出口唯一实现: apps/api/scripts/notify-deploy-failure.ts(版式= renderSystemAlertEmail);',
    '本文件不得出现 SMTP/Resend 传输层或模板字符串(守门 81「品牌邮件通道对账」)。',
    '只按告警身份去重、无每日总量封顶;寄不出去会留 UNDELIVERED 标记并在 /health 可见。',
    '状态分流:显式 status=resolved ⇒ 清偿去重档 + ALERT-CLEARED 记账,不冒充故障寄邮件;',
    '          status 缺失/其它取值 ⇒ fail-open 照旧到人(故障照寄,绝不顺手静音)。',
    '日志行状态维:本批每条既有日志行尾部带 status=<firing|resolved|missing|other> queued=<n> cleared=<m>;',
    '            通道仍只有一条(LOG_FILE 单点 append)、行首形状一字未动 ⇒ 以后"有没有把恢复当故障',
    '            寄过信"这类问题能用日志回答(此前每行都不落 status,历史无从证明)。',
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
  eq('被抑制的重复推送不得续期窗口(该键时间戳保持首次投递时刻)', [store.get('HighCPU|a:9100'), store.get('DiskFull|b:9100')], [1000, 1000])
  // 回归锁(2026-11-02 修):持续 firing 每 10 分钟推一次,旧实现每次推送都写 ts ⇒ 窗口被无限
  // 续期 ⇒ 只在第一次响、之后永不再报。新语义:只有真正投递才刷新,窗口锚在最近一次投递。
  const renewalStore = new Map()
  partitionAlerts(alerts, renewalStore, 1000, HOUR) // 首次投递建档
  for (let i = 1; i <= 5; i += 1) partitionAlerts(alerts, renewalStore, 1000 + i * 10 * 60 * 1000, HOUR) // 50 分钟内 5 次重复推送,全被压
  eq('持续重复推送 5 次后仍在原窗口内 ⇒ 判重(窗口位置没被推后)', partitionAlerts(alerts, renewalStore, 1000 + 59 * 60 * 1000, HOUR).toPush.length, 0)
  eq('越过首次投递 + 窗口即重新放行(持续故障必须按期重报)', partitionAlerts(alerts, renewalStore, 1000 + 61 * 60 * 1000, HOUR).toPush.length, 2)
  eq('超出窗口后重新放行(去重不得把持续故障压成永久静默)', partitionAlerts(alerts, store, 1000 + 3 * HOUR, HOUR).toPush.length, 2)
  eq('空/非数组输入不炸', partitionAlerts(undefined, store, 1, HOUR).toPush.length, 0)

  // ③b 去重态跨重启(正反对照):落盘 → 清空内存 → 读回 → 仍判重复;陈旧条目不得复活
  const stateFile = tmpProbe('state')
  cleanup.push(stateFile)
  const storeA = new Map()
  partitionAlerts(alerts, storeA, 1000, HOUR)
  partitionAlerts(alerts, storeA, 1000 + 60000, HOUR) // 窗口内的重复推送只读、不写 ts(与线上行为同形)
  // 反向对照:一条已超出窗口的陈旧条目不得被持久化/读回
  storeA.set('Old|gone:9100', 1000 - 2 * HOUR)
  const savedOk = persistState(stateFile, storeA, 1000 + 60000, () => {}, HOUR)
  eq('去重状态真实落盘(persistState 返回成功且文件存在)', [savedOk, fs.existsSync(stateFile)], [true, true])
  const storeB = new Map() // 模拟重启后的空进程
  const loaded = loadDedupState(stateFile, storeB, 1000 + 60000, HOUR)
  eq('重启后按文件读回去重条目(陈旧那条不复活)', loaded, 2)
  const afterRestart = partitionAlerts(alerts, storeB, 1000 + 2 * 60000, HOUR)
  eq('重启后收到同一告警 ⇒ 仍判重复(修前实测 skipped:0 的那个洞)', [afterRestart.toPush.length, afterRestart.dedupedCount], [0, 2])
  eq('重启后不同身份告警照寄(去重态不得顺手压掉新告警)', partitionAlerts([{ labels: { alertname: 'NewIssue', instance: 'c:9100' } }], storeB, 1000 + HOUR, HOUR).toPush.length, 1)
  eq('状态文件形态只有 dedup+holds(无预算/计数字段 ⇒ 结构上不存在总量封顶)', Object.keys(JSON.parse(fs.readFileSync(stateFile, 'utf8'))), ['dedup', 'holds'])
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

  // ⑧ /metrics 渲染面(判据必须覆盖门自己产出的形态 —— 把 prometheus 指过来这件事,
  //    如果产出不被 Prometheus 接受的文本,就会重演"恒响的假告警"那一型)。
  const undelBeforeSelfTest = fs.existsSync(UNDEL_FILE) // 只记录,不删:真标记是线上状态,自检无权清除
  const sample = metricsSnapshot(PROC_START_MS + 12_345_000)
  const text = renderMetrics(sample)
  eq('/metrics 的 Content-Type 必须是带 version=0.0.4 的 text/plain(Prometheus 3.x 靠它认 scrape_protocol)', METRICS_CONTENT_TYPE, 'text/plain; version=0.0.4; charset=utf-8')
  eq('文本以换行收尾(末行缺 \\n 会被读成截断)', text.endsWith('\n'), true)
  eq('所有指标名共用 ihui_alertbridge_ 前缀且形态合法', METRIC_SPECS.every(([n]) => /^ihui_alertbridge_[a-z][a-z0-9_]*$/.test(n)), true)
  eq('累计量一律 _total + counter,gauge 一律不带 _total(混了就别想用 rate() 读)', METRIC_SPECS.every(([n, t]) => (n.endsWith('_total') ? t === 'counter' : t === 'gauge')), true)
  // 每条样本行前必须有同名 # TYPE,# TYPE 前必须有 # HELP —— 缺一 Prometheus 直接判抓取失败
  const allLines = text.split('\n').filter((l) => l !== '')
  const typeNames = allLines.filter((l) => l.startsWith('# TYPE ')).map((l) => l.split(' ')[2])
  const helpNames = allLines.filter((l) => l.startsWith('# HELP ')).map((l) => l.split(' ')[2])
  const sampleLines = allLines.filter((l) => !l.startsWith('#'))
  // 同一指标可以有多条带 result 标签的序列(重试 ok/fail/expired):比对时按"名"去掉标签,
  // 否则三条序列会被读成三个不同的指标,把合法的多标签形态误判成格式错。
  const sampleNames = sampleLines.map((l) => l.split(' ')[0].replace(/\{.*$/, ''))
  eq('每个样本名都有且只有一条同名 # TYPE(按名字集合比,不靠行序)', [...new Set(sampleNames)].sort(), typeNames.slice().sort())
  eq('每个样本名都有同名 # HELP', [...new Set(sampleNames)].sort(), helpNames.slice().sort())
  eq('每个 TYPE 名恰好声明一次(同名多标签序列不得重复声明)', typeNames.length, new Set(typeNames).size)
  eq('样本行形态 = 名(+可选 result 标签集) + 单个十进制数值(无 NaN/Inf、无引号)', sampleLines.every((l) => /^[a-z_]+(\{[a-z_]+="[^"]*"\})? -?[0-9]+(\.[0-9]+)?$/.test(l)), true)
  eq('HELP 文本单行(HELP 里带换行会把后续样本吞进注释)', allLines.filter((l) => l.startsWith('# HELP ')).every((l) => l.length > 9), true)
  // 正向证明:判据输入取自 METRIC_SPECS 名单本身 —— 每个计数器都要"数得出来",
  // 否则名单可以是张死表而渲染一路报绿(§120 名单类判据必须有正向证明)。
  for (const [k, name, type] of [['dedupSuppressed', 'ihui_alertbridge_alerts_dedup_suppressed_total', 7], ['alertsDelivered', 'ihui_alertbridge_mail_alerts_delivered_total', 3], ['webhooksReceived', 'ihui_alertbridge_webhooks_received_total', 5], ['statePersistFailures', 'ihui_alertbridge_state_persist_failures_total', 2], ['undeliveredMarks', 'ihui_alertbridge_undelivered_marks_written_total', 1], ['plainFallbacks', 'ihui_alertbridge_mail_plain_fallback_total', 4], ['batchesFailed', 'ihui_alertbridge_mail_batches_failed_total', 6]]) {
    const c = {}
    for (const key of Object.keys(counters)) c[key] = 0
    c[k] = type
    eq(`名单项 ${k} 的数值真出现在样本行上`, new RegExp(`^${name} ${type}$`, 'm').test(renderMetrics({ ...sample, counters: c })), true)
  }
  const zeroed = {}
  for (const key of Object.keys(counters)) zeroed[key] = 0
  eq('未涉及的计数器落成 0 而不是消失(缺样本 = 下游 rate() 断线)', /^ihui_alertbridge_mail_batches_failed_total 0$/m.test(renderMetrics({ ...sample, counters: zeroed })), true)
  // 三态必须分得开
  eq('mail_undelivered:标记在=1 / 不在=0(两个方向都要判)', [renderMetrics({ ...sample, mailUndelivered: true }).includes('\nihui_alertbridge_mail_undelivered 1\n'), renderMetrics({ ...sample, mailUndelivered: false }).includes('\nihui_alertbridge_mail_undelivered 0\n')], [true, true])
  eq('mail_enabled:通道关=0(关掉通道必须从指标上看得见,而不是只写在日志里)', renderMetrics({ ...sample, mailEnabled: false }).includes('\nihui_alertbridge_mail_enabled 0\n'), true)
  eq('up 恒为 1(它判的是"进程答了这一次抓取",不是自报健康)', /^ihui_alertbridge_up 1$/m.test(text), true)
  eq('从未投递过 ⇒ 两个 last_*_timestamp 都是 0(不得把"没发生过"写成"一切正常")', [renderMetrics({ ...sample, lastMailAttemptTs: 0, lastMailSuccessTs: 0 }).includes('\nihui_alertbridge_mail_last_attempt_timestamp_seconds 0\n'), renderMetrics({ ...sample, lastMailAttemptTs: 0, lastMailSuccessTs: 0 }).includes('\nihui_alertbridge_mail_last_success_timestamp_seconds 0\n')], [true, true])
  // 一个坏数不得拖垮整次抓取:NaN 不是合法样本值,Prometheus 遇之判**整次**失败
  eq('非有限值落 0 而不是产出 NaN/Infinity 字样', renderMetrics(sample, [['ihui_alertbridge_broken', 'gauge', 'probe', () => Number(undefined)], ['ihui_alertbridge_broken2', 'gauge', 'probe', () => 'abc']]).includes('NaN'), false)
  eq('坏值那一行仍然在场(不得静默丢样本行)', renderMetrics(sample, [['ihui_alertbridge_broken', 'gauge', 'probe', () => undefined]]), '# HELP ihui_alertbridge_broken probe\n# TYPE ihui_alertbridge_broken gauge\nihui_alertbridge_broken 0\n')
  // 观测不得反过来参与判定 + 计数不得并桶(用增量比较:自检与线上共用同一份 counters)
  const probeStore = new Map()
  eq('反向锁:统计接入后去重判定一字未改(首批 2 / 二次全压)', [partitionAlerts(alerts, probeStore, 1000, HOUR).toPush.length, partitionAlerts(alerts, probeStore, 1500, HOUR).toPush.length], [2, 0])
  const cBefore = { ...counters }
  /** 探针标记路径:登记进 cleanup,失败用例写出的标记文件不得留在自检之后 */
  const probeUndel = ['m1', 'm2', 'm3'].map((t) => { const p = tmpProbe(t); cleanup.push(p); return p })
  await deliverMail(alerts, { dispatch: failDispatch, log: () => {}, undelFile: probeUndel[0] })
  eq('两条路都失败 ⇒ undelivered_marks +1、plain_fallback 不加', [counters.undeliveredMarks - cBefore.undeliveredMarks, counters.plainFallbacks - cBefore.plainFallbacks], [1, 0])
  const cAfterFail = { ...counters }
  await deliverMail(alerts, { dispatch: plainRescue, log: () => {}, undelFile: probeUndel[1] })
  eq('品牌失败但纯文本救回 ⇒ plain_fallback +1 且不再记未送达', [counters.plainFallbacks - cAfterFail.plainFallbacks, counters.undeliveredMarks - cAfterFail.undeliveredMarks], [1, 0])
  const cAfterPlain = { ...counters }
  await deliverMail(alerts, { dispatch: okDispatch, log: () => {}, undelFile: probeUndel[2] })
  eq('直接成功 ⇒ 两个退化计数都不动(成功不得被记成退化)', [counters.plainFallbacks - cAfterPlain.plainFallbacks, counters.undeliveredMarks - cAfterPlain.undeliveredMarks], [0, 0])
  eq('自检不得改动线上 UNDELIVERED 标记(它是真故障的凭据,自检无权清除)', fs.existsSync(UNDEL_FILE), undelBeforeSelfTest)

  // ⑥ 日志来源分流(G-472 告警侧)。三条断言必须成对,且判据一律走纯函数 + 构造面:
  //    a) 采集器/监控自身来源 ⇒ 只报不炸(阳性对照)
  //    b) 真实业务错误 ⇒ 照旧进到人告警(反向对照)
  //    c) 采集侧与规则侧的标签名/取值必须同值,任一侧改名或摘线都读得出来(反向锁)
  //    锚点判不出时的方向也钉死:fail-open(一条都不压),绝不允许"判不出"退化成"都不炸"。
  const readRepoFile = (rel) => fs.readFileSync(path.join(REPO_ROOT, ...rel.split('/')), 'utf8')
  const anchorNow = currentLogAnchor(Date.now())
  // 构造面兜底:现读判不出时后面几条不能崩(崩了会把"自检异常"冒充"判据红",exit 2 那种);
  // 而这一条本身已经红了,不需要再靠崩溃来表达。
  const ANCHOR_FIXTURE = { ok: true, label: 'job', page: ['api', 'ai-service', 'applogs'], self: ['monitorlogs'] }
  eq('⑥a 现读两侧真文件 ⇒ 锚点对得上(分流真的在跑,不是"以为在跑")', anchorNow.ok, true)
  const A = anchorNow.ok ? anchorNow : ANCHOR_FIXTURE
  const collectorAlert = { labels: { alertname: 'PgCollectorWalFailed', instance: 'pg-exporter:9187', severity: 'critical', [A.label]: A.self[0] }, annotations: { description: 'source=collector.go msg="collector failed" name=wal' } }
  const businessAlert = { labels: { alertname: 'ApiHighErrorRate', instance: 'api:8802', severity: 'critical', [A.label]: A.page[0] } }
  const untaggedAlert = { labels: { alertname: 'WindowsDiskSpaceLow', instance: 'windows:9182', severity: 'warning' } }
  const split1 = logAnchor.splitAlertsByLogSource([collectorAlert, businessAlert, untaggedAlert], A)
  eq('⑥b 采集器来源那一条被分到"只报不炸"(阳性对照)', split1.selfReportOnly.map((x) => x.labels.alertname), ['PgCollectorWalFailed'])
  eq('⑥c 业务错误 + 没有该标签的指标型告警都照旧到人(反向对照;不猜、不顺手压)', split1.page.map((x) => x.labels.alertname), ['ApiHighErrorRate', 'WindowsDiskSpaceLow'])
  const splitBlind = logAnchor.splitAlertsByLogSource([collectorAlert, businessAlert], { ok: false, problems: ['构造:两侧名字对不上'] })
  eq('⑥d 锚点判不出 ⇒ 全部照旧到人(fail-open;失效方向必须是"少压一条"而不是"多压一条")', [splitBlind.page.length, splitBlind.selfReportOnly.length], [2, 0])
  const planStore = new Map()
  const plan1 = planDelivery([collectorAlert, businessAlert, untaggedAlert], A, planStore, 1000, HOUR)
  eq('⑥e 端到端投递计划:到人那一支只含业务/未打标告警', plan1.toPush.map((x) => x.labels.alertname), ['ApiHighErrorRate', 'WindowsDiskSpaceLow'])
  const plan2 = planDelivery([collectorAlert, businessAlert, untaggedAlert], A, planStore, 1500, HOUR)
  eq('⑥f 第二轮:业务那两条命中身份去重,而只报不炸那一支仍逐条记账(它不进人名额、也不被人名额压掉)', [plan2.toPush.length, plan2.dedupedCount, plan2.selfReportOnly.length], [0, 2, 1])
  // ⑥g 反向锁:两侧标签名/取值同值,任一侧改名或摘线都必须判"失明"
  if (anchorNow.ok) {
    const promtailText = readRepoFile(logAnchor.PROMTAIL_REL)
    const rulesText = readRepoFile(logAnchor.RULES_REL)
    const renamedProducer = promtailText.replace(`job: ${A.self[0]}`, `job: ${A.self[0]}z`)
    const renamedConsumer = rulesText.replace(`page={${A.label}=~"${A.page.join('|')}"} report-only={${A.label}="${A.self[0]}"}`, `page={svc=~"${A.page.join('|')}"} report-only={svc="${A.self[0]}"}`)
    const droppedConsumer = rulesText.replace(/LOG_SOURCE_ANCHOR:\s*page=\{[^\n]*\}/, '（标记行被摘掉了）')
    eq('⑥g-1 采集侧把分区改了名(规则侧没跟)⇒ 判失明,不静默分错', logAnchor.resolveAnchorFromTexts(renamedProducer, rulesText).ok, false)
    eq('⑥g-2 规则侧把标签名换了(svc≠job)⇒ 判失明', logAnchor.resolveAnchorFromTexts(promtailText, renamedConsumer).ok, false)
    eq('⑥g-3 规则侧标记整行被摘 ⇒ 判失明(口径没了就是没了,不许当作"这一族无告警")', logAnchor.resolveAnchorFromTexts(promtailText, droppedConsumer).ok, false)
    eq('⑥g-4 两侧原样 ⇒ 判得上(⑥g-1..3 的红不是因为函数恒假)', logAnchor.resolveAnchorFromTexts(promtailText, rulesText).ok, true)
    eq('⑥g-5 两侧标记行的标签名逐字同值', [logAnchor.parseMarker(promtailText).label, logAnchor.parseMarker(rulesText).label], [A.label, A.label])
    // ⑥h 规则的"装车证明":gauge 暴露了还不够,规则里必须真有人读它(否则=没有这条判据)
    eq('⑥h alerts.yml 真有读该 gauge 的规则(造好没装车那一型不得复发)', rulesText.includes('ihui_alertbridge_log_anchor_ok == 0'), true)
    eq('⑥i 分流判据必须挂在生产路径上(handleAlert 真调 planDelivery,不是只写了个函数)', /const \{ toPush, dedupedCount, selfReportOnly, page \} = planDelivery\(/.test(fs.readFileSync(__filename, 'utf8')), true)
  } else {
    eq('⑥g 锚点失明时后面的构造面断言无法成立(本条与 ⑥a 同时红,原因见 problems)', anchorNow.problems.length > 0, true)
  }
  // ⑥j 只报不炸必须"看得见":两个指标都得真在名单里(名单里有名字而渲染不出来 = 死表)
  eq('⑥j-1 失明 gauge 在名单里且两个方向都判(1/0)', [
    /^ihui_alertbridge_log_anchor_ok 1$/m.test(renderMetrics({ ...sample, logAnchorOk: true })),
    /^ihui_alertbridge_log_anchor_ok 0$/m.test(renderMetrics({ ...sample, logAnchorOk: false })),
  ], [true, true])
  const cSelf = {}
  for (const key of Object.keys(counters)) cSelf[key] = 0
  cSelf.selfScopeReported = 8
  eq('⑥j-2 只报不炸的计数真出现在样本行上(它不在 METRIC_SPECS 里就是静默丢弃)', /^ihui_alertbridge_alerts_selfscope_reported_total 8$/m.test(renderMetrics({ ...sample, counters: cSelf })), true)

  // ⑥k 改后的规则文件必须"解析得动"(本机无 js-yaml、不借 promtool 二进制 ⇒ 自写结构校验,
  //    与本仓 unattended-intake 测试同一先例)。正反成对:现读必须干净,而三类形状错必须红。
  const rulesNow = readRepoFile(logAnchor.RULES_REL)
  const shapeNow = logAnchor.validateAlertRules(rulesNow)
  eq('⑥k-0 现读 alerts.yml 结构自洽(规则数 > 0 且每条齐 alert/expr/for/severity/summary/description)', [shapeNow.ok, shapeNow.ruleCount > 0], [true, true])
  const oneRule = rulesNow.replace('      - alert: LogSourceSplitBlind\n        expr: ihui_alertbridge_log_anchor_ok == 0\n        for: 10m\n', '      - alert: LogSourceSplitBlind\n        expr: ihui_alertbridge_log_anchor_ok == 0\n')
  eq('⑥k-1 抽掉一条规则的 for ⇒ 必红(漏写不是"少一行"而是整份被 promtool 拒收)', logAnchor.validateAlertRules(oneRule).ok, false)
  // ⑥k-2 夹具自带,不再锚 alerts.yml 的某一行正文(2026-10-23):原写法 replace 一句
  // 真实 description,而那行早被别人改写 ⇒ replace 空转 ⇒ "该必红"变成"根本没改"而假红。
  // 夹具一旦依赖被审文件的正文,它测的就是那行字还在不在,不是判据还灵不灵。
  const syntheticRules = [
    'groups:',
    '  - name: probe',
    '    rules:',
    '      - alert: ProbeRule',
    '        expr: ihui_alertbridge_log_anchor_ok == 0',
    '        for: 10m',
    '        labels:',
    '          severity: warning',
    '        annotations:',
    "          summary: 's'",
    "          description: 'd'",
  ].join('\n')
  eq('⑥k-2a 自带夹具的正向对照:这份合成规则本身必须判干净(否则下面那条负例是空转)', logAnchor.validateAlertRules(syntheticRules).ok, true)
  eq(
    '⑥k-2 标量收尾的引号丢了 ⇒ 必红(YAML 会把后半行连同下一行吃进标量)',
    logAnchor.validateAlertRules(syntheticRules.replace("description: 'd'", "description: 'd")).ok,
    false,
  )
  eq('⑥k-3 把失明 gauge 多写一遍 ⇒ 必红(两份真相 = 改一处漏一处)', logAnchor.validateAlertRules(rulesNow + '\n      - alert: LogSourceSplitBlind\n        expr: ihui_alertbridge_log_anchor_ok == 0\n        for: 10m\n        labels:\n          severity: critical\n        annotations:\n          summary: s\n          description: d\n').ok, false)

  // ⑨ 状态分流(2026-10-17,"恢复被当故障寄信"的假警报型)。四条成对,全走纯函数铰链:
  //    a) resolved 不进到人支(阳性)  b) firing/缺 status 照旧到人(反向,故障不静音)
  //    c) 清偿语义:恢复摘档后同身份下次 firing 立即可再报  d) 指标行真渲染(只报不炸≠没记)
  const sStore = new Map()
  const firingA = { status: 'firing', labels: { alertname: 'ApiDown', instance: 'api:1', severity: 'critical' } }
  const resolvedA = { status: 'resolved', labels: { alertname: 'PgDown', instance: 'pg:1', severity: 'critical' } }
  const noStatusA = { labels: { alertname: 'Weird', instance: 'w:1' } }
  const pendingA = { status: 'pending', labels: { alertname: 'AlsoReal', instance: 'r:1' } }
  // 先建立"窗口内活跃身份"(模拟故障已寄出过一封)
  partitionAlerts([resolvedA], sStore, 1000, HOUR)
  const tri9 = splitAlertsByStatus([firingA, resolvedA, noStatusA, pendingA])
  eq('⑨a 只有显式 resolved 进清偿支(阳性对照:恢复不被当故障)', tri9.resolved.map((x) => x.labels.alertname), ['PgDown'])
  eq('⑨b firing/缺 status/其它取值全留在到人支(反向锁:故障照寄不被静音)', tri9.paging.map((x) => x.labels.alertname), ['ApiDown', 'Weird', 'AlsoReal'])
  // ⑨c 恢复不再摘档 + 24h 上限(2026-11-03 改,取代 RECOOL 冷却窗):把"翻面重寄"钉死。
  //   c-1 恢复只记账、保留 lastSentTs,并登记 24h 上限
  //   c-2 恢复后 24h 内 re-fire 被压(含"恢复前已寄过"的那一封)
  //   c-3 恢复满 30 分钟(RECOOL 旧阈值)之后仍在 24h 内 ⇒ 仍被压(修的就是这一格)
  //   c-4 跨 24h 边界恢复发送(反向锁:不永久静音)
  //   c-5 从未恢复的持续 firing 在窗口外照常送达(反向锁:真故障不被上限一起静音)
  const HOLD = 24 * HOUR
  const flapStore = new Map()
  const flapHolds = new Map()
  partitionAlerts([resolvedA], flapStore, 1000, HOUR) // 模拟刚寄出过一封
  const heldOnly = applyResolvedClears(flapStore, [resolvedA], 1000 + 60 * 1000, flapHolds)
  eq('⑨c-1 恢复只记账、绝不摘档;并登记 lastSentTs+24h 上限', [heldOnly.cleared.length, heldOnly.held.length, flapStore.has('PgDown|pg:1'), flapHolds.get('PgDown|pg:1')], [0, 1, true, 1000 + HOLD])
  const afterFlap = partitionAlerts([{ labels: { alertname: 'PgDown', instance: 'pg:1' } }], flapStore, 1000 + 120 * 1000, HOUR, flapHolds)
  eq('⑨c-2 恢复后 24h 内 re-fire 被压(重寄被消掉 —— "邮箱一直在报警"的那一格)', afterFlap.toPush.length, 0)
  const trueRecover = applyResolvedClears(flapStore, [resolvedA], 1000 + 60 * 60 * 1000, flapHolds) // 距投递 1 小时(旧 RECOOL 已判"真恢复")
  eq('⑨c-3 恢复满 30 分钟(旧 RECOOL 阈值)后仍在 24h 内 ⇒ 不摘档、仍被压', [trueRecover.cleared.length, trueRecover.held.length, flapStore.has('PgDown|pg:1'), partitionAlerts([{ labels: { alertname: 'PgDown', instance: 'pg:1' } }], flapStore, 1000 + 31 * 60 * 1000, HOUR, flapHolds).toPush.length], [0, 1, true, 0])
  const after24h = partitionAlerts([{ labels: { alertname: 'PgDown', instance: 'pg:1' } }], flapStore, 1000 + HOLD + 1000, HOUR, flapHolds)
  eq('⑨c-4 跨 24h 边界恢复发送(上限到期即放行,不永久静音)', [after24h.toPush.length, flapHolds.has('PgDown|pg:1')], [1, false])
  const sustainedStore = new Map()
  partitionAlerts([{ labels: { alertname: 'Sustained', instance: 's:1' } }], sustainedStore, 1000, HOUR)
  eq('⑨c-5 从未恢复的持续 firing 在窗口外照常送达(真故障不被 24h 上限一起静音)', partitionAlerts([{ labels: { alertname: 'Sustained', instance: 's:1' } }], sustainedStore, 1000 + 2 * HOUR, HOUR, new Map()).toPush.length, 1)
  const clearedKeys = applyResolvedClears(sStore, tri9.resolved, Date.now(), new Map())
  eq('⑨c-6 恢复支恒不摘档(clear 列表恒空;锚点仍在)', [clearedKeys.cleared.length, clearedKeys.held.length, sStore.has('PgDown|pg:1')], [0, 1, true])
  eq('⑨c-7 上限取生产常量 24h(与 BRIDGE_DEDUP_MIN 解耦;改了默认值这里跟着动)', IDENTITY_HOLD_MS, 24 * HOUR)
  eq('⑨d 空/非数组输入不炸且全 fail-open 到人', [splitAlertsByStatus(undefined).paging.length, splitAlertsByStatus([]).resolved.length], [0, 0])
  const cCleared = {}
  for (const key of Object.keys(counters)) cCleared[key] = 0
  cCleared.alertsCleared = 5
  eq('⑨e 清偿指标行真出现在样本行上(不在名单里就是静默丢弃)', /^ihui_alertbridge_alerts_cleared_total 5$/m.test(renderMetrics({ ...sample, counters: cCleared })), true)
  eq('⑨f 分流判据挂在生产路径上(handleAlert 真调 splitAlertsByStatus,不是只写了个函数)', /const \{ paging, resolved \} = splitAlertsByStatus\(alerts\)/.test(fs.readFileSync(__filename, 'utf8')), true)

  // ⑩ 日志状态维(2026-10-17 补)。审计留下一格:此前每行都不落 status ⇒ "过去到底有没有把恢复
  //    当故障寄过信"今天无人可答。此后每条既有日志行尾部都带 ` status=<档> queued=<n> cleared=<m>`,
  //    下次任何人都能用日志回答。断言一律喂生产实现 statusDimension / alertStatusOf /
  //    splitAlertsByStatus(§22c:测试内不抄第二份判据)。三条成对 + 方向锁 + 单一尺子 + 接线锁。
  const dimFiring = statusDimension([firingA], 1, 0)
  eq('⑩a firing 批的行里有 status=firing 且计入 queued、不计入 cleared', [/\bstatus=firing\b/.test(dimFiring), /\bqueued=1\b/.test(dimFiring), /\bcleared=0\b/.test(dimFiring)], [true, true, true])
  const dimResolved = statusDimension([resolvedA], 0, 1)
  eq('⑩b resolved 批的行里有 status=resolved 且计入 cleared、不进 queued(投递腿结构上拿不到它)', [/\bstatus=resolved\b/.test(dimResolved), /\bqueued=0\b/.test(dimResolved), /\bcleared=1\b/.test(dimResolved)], [true, true, true])
  const dimMissing = statusDimension([noStatusA], 1, 0)
  eq('⑩c status 缺失 ⇒ 行里记 status=missing,且 fail-open 照寄(到人支 1 条 / 清偿支 0 条)', [/status=missing/.test(dimMissing), splitAlertsByStatus([noStatusA]).paging.length, splitAlertsByStatus([noStatusA]).resolved.length], [true, 1, 0])
  const dimOther = statusDimension([pendingA], 1, 0)
  eq('⑩d 陌生取值 ⇒ 行里如实记 status=other(不得冒充 firing/missing),去向仍 fail-open 到人', [/status=other/.test(dimOther), splitAlertsByStatus([pendingA]).paging.length], [true, 1])
  eq('⑩e 混合批按固定序拼接(与输入顺序无关)而空批不落任何状态档(§0.3:没有输入就不落判据)', [statusDimension([resolvedA, firingA, noStatusA], 2, 1), statusDimension([firingA, noStatusA, resolvedA], 2, 1), statusDimension([], 0, 0)], ['status=firing+resolved+missing queued=2 cleared=1', 'status=firing+resolved+missing queued=2 cleared=1', 'status=empty queued=0 cleared=0'])
  eq('⑩f 单一把尺子:状态档与分流去向逐条同源 alertStatusOf(第二份分类必然漂开)', [firingA, resolvedA, noStatusA, pendingA].every((a) => (alertStatusOf(a) === 'resolved') === (splitAlertsByStatus([a]).resolved.length === 1)), true)
  const bridgeSrc = fs.readFileSync(__filename, 'utf8')
  eq('⑩g 接线锁:handleAlert 真造状态维并拼进既有行(清偿行 1 处 + 投递/跳过行 ≥4 处),不是只写了个函数', [bridgeSrc.includes('const statusDimOf = (queued) => statusDimension(alerts, queued, resolved.length)'), bridgeSrc.includes('${statusDimOf(paging.length)}'), (bridgeSrc.match(/\$\{statusDimOf\(toPush\.length\)\}/g) || []).length >= 4], [true, true, true])
  eq('⑩h 通道唯一:全文件只有一处写日志的落点(补维度不得开出第二套日志通道)', (bridgeSrc.match(/appendFileSync\(LOG_FILE/g) || []).length, 1)

  // ⑪ 去重窗口余量锁(2026-11-02 二修)。边界:桥侧窗口与 AM repeat_interval 同值时,重推
  //    只要落在窗口内就会被压掉、只能等下一次 repeat ⇒ 持续告警从 4h 沉默成 8h。
  //    repeat_interval 一律**现读仓库配置**(单一真相,不硬编码),读不到/解析不了即红。
  const AM_CFG_REL = 'monitoring/alertmanager/alertmanager.yml.tmpl'
  const amCfg = readRepoFile(AM_CFG_REL)
  const repeatRaw = (/^  repeat_interval:\s*([^\s#]+)/m.exec(amCfg) || [])[1]
  const repeatMs = parseGoDurationMs(repeatRaw)
  eq('⑪a AM repeat_interval 现读配置且解析得出(不硬编码两边)', [repeatRaw, repeatMs], ['4h', 4 * HOUR])
  eq('⑪b 生产去重窗口严格小于 AM repeat_interval(余量由默认值结构上保证)', MAX_DEDUP_AGE_MS < repeatMs, true)
  const marginStore = new Map()
  const marginFirst = 1000
  partitionAlerts(alerts, marginStore, marginFirst, MAX_DEDUP_AGE_MS)
  eq('⑪c 窗口内(差 1 分钟到期)同身份仍判重(余量不得把去重改没)', partitionAlerts(alerts, marginStore, marginFirst + MAX_DEDUP_AGE_MS - 60000, MAX_DEDUP_AGE_MS).dedupedCount, 2)
  eq('⑪d 窗口到期那一刻即放行', partitionAlerts(alerts, marginStore, marginFirst + MAX_DEDUP_AGE_MS, MAX_DEDUP_AGE_MS).toPush.length, 2)
  const repeatStore = new Map()
  partitionAlerts(alerts, repeatStore, marginFirst, MAX_DEDUP_AGE_MS)
  eq('⑪e AM 按 repeat_interval 重推的第一封必然放行(不得被自家窗口压成 8h)', partitionAlerts(alerts, repeatStore, marginFirst + repeatMs, MAX_DEDUP_AGE_MS).toPush.length, 2)
  eq('⑪f Go duration 解析器正反成对(4h/45s 认,裸数字/未知单位不认)', [parseGoDurationMs('4h'), parseGoDurationMs('45s'), parseGoDurationMs('4'), parseGoDurationMs('4d')], [4 * HOUR, 45000, null, null])

  // ⑫ 状态文件损坏/半写/未来时间戳(2026-11-02 三修)。两条方向锁各钉一头:
  //    坏文件不得被静默当成空态(那会让重启后全量重报 = 多信),未来时刻不得构成压制
  //    (那会让同身份告警永久静默 = 丢信)。文件损坏时必须先备份再空态起算,且 ERROR 可见。
  const corruptLogs = []
  const stateLog = (m) => corruptLogs.push(m)
  const corruptBase = tmpProbe('corrupt')
  cleanup.push(corruptBase)
  const parentDir = path.dirname(corruptBase)
  const corruptBaks = () => fs.readdirSync(parentDir).filter((f) => f.startsWith(path.basename(corruptBase) + '.corrupt-'))
  const mkCorrupt = (text) => {
    for (const f of corruptBaks()) fs.rmSync(path.join(parentDir, f), { force: true })
    fs.writeFileSync(corruptBase, text, 'utf8')
  }
  mkCorrupt('{"dedup":{')
  eq('⑫a 非法 JSON 不崩、按空态起算(null)', loadDedupState(corruptBase, new Map(), Date.now(), HOUR, stateLog), null)
  eq('⑫b 损坏文件原样备份(可人工恢复),原路径不再留坏文件', [corruptBaks().length, fs.existsSync(corruptBase)], [1, false])
  eq('⑫c 损坏必须喊出来(ERROR 行点名原因,不吞错)', [corruptLogs.some((l) => /\[state\]\[ERROR\]/.test(l)), corruptLogs.some((l) => /JSON 解析失败/.test(l))], [true, true])
  mkCorrupt(JSON.stringify({ dedup: [{ x: 1 }] }))
  eq('⑫d dedup 字段类型不对(数组)同样判损坏并备份(不得静默当空对象)', [loadDedupState(corruptBase, new Map(), Date.now(), HOUR, stateLog), corruptBaks().length], [null, 1])
  mkCorrupt(JSON.stringify({ dedup: { 'Future|x': Date.now() + 4 * HOUR, 'Ok|y': Date.now() - 60000 } }))
  const futStore = new Map()
  eq('⑫e 未来时间戳条目不载入,同文件里的正常条目照常载入(条目级隔离,不牵连整份文件)', [loadDedupState(corruptBase, futStore, Date.now(), HOUR, stateLog), futStore.has('Future|x'), futStore.has('Ok|y')], [1, false, true])
  eq('⑫f 判据层同样不认未来时间戳(放行,不得压到时钟追平为止)', decideDedup(new Map([['Future|x', Date.now() + 4 * HOUR]]), 'Future|x', Date.now(), HOUR), false)
  eq('⑫g 持久化不得把未来时刻写进文件(重启后也不给压制留载体)', /"Future\|x"/.test(serializeState(new Map([['Future|x', Date.now() + 4 * HOUR]]), Date.now(), HOUR)), false)
  const atomicFile = tmpProbe('atomic')
  cleanup.push(atomicFile)
  const atomicDir = path.dirname(atomicFile)
  const tmpLeft = () => fs.readdirSync(atomicDir).filter((f) => f.startsWith(path.basename(atomicFile) + '.tmp-'))
  const a1 = persistState(atomicFile, new Map([['A|a', Date.now() - 1000]]), Date.now(), stateLog, HOUR)
  const a2 = persistState(atomicFile, new Map([['B|b', Date.now() - 1000]]), Date.now(), stateLog, HOUR)
  eq('⑫h 原子写:两次覆盖都成功且无 .tmp- 残留(不存在半写中间态)', [a1, a2, tmpLeft().length, Object.keys(JSON.parse(fs.readFileSync(atomicFile, 'utf8')).dedup)], [true, true, 0, ['B|b']])
  eq('⑫i 状态载入失败进入可观测计数(坏文件不是无声事件)', counters.stateLoadFailures > 0, true)
  for (const f of corruptBaks()) fs.rmSync(path.join(parentDir, f), { force: true })

  // ⑬ 双失败 ⇒ 一次后台重试(2026-11-02 四修)。两头都要钉死:
  //    丢信方向:品牌 + --plain 双失败后若"一次就放弃",一封本该到人的告警永远消失;
  //    多信方向:若靠"回滚去重锚点"来补救,AM group 每变一次就会把同一故障再寄一遍 ——
  //    所以重试只补这一批、**绝不触碰 dedup**。队列落盘要扛 NSSM 重启,但只接管 10 分钟内
  //    的记录:补发 15 分钟前的告警等于新造一次轰炸,不是补救。
  const retryLogs = []
  const retryLog = (m) => retryLogs.push(m)
  const retryFile = tmpProbe('retry-queue')
  const retryUndel = tmpProbe('retry-undel')
  cleanup.push(retryFile, retryUndel)
  const retryTmpLeft = () => fs.readdirSync(path.dirname(retryFile)).filter((f) => f.startsWith(path.basename(retryFile) + '.tmp-'))
  const nowRetry = Date.now()
  const freshEntry = { id: 'fresh-1', firstAttemptTs: nowRetry, nextAttemptTs: nowRetry + MAIL_RETRY_DELAY_MS, alerts, why: '假失败' }
  const staleEntry = { id: 'stale-1', firstAttemptTs: nowRetry - 15 * 60 * 1000, nextAttemptTs: nowRetry - 14 * 60 * 1000, alerts, why: '假失败' }
  const futureEntry = { id: 'future-1', firstAttemptTs: nowRetry + 4 * HOUR, nextAttemptTs: nowRetry + 4 * HOUR, alerts, why: '假失败' }
  eq('⑬a 落盘过滤:15 分钟前 / 时钟未来的条目一律不写(重启后没有补发陈旧告警的载体)', JSON.parse(serializeRetryQueue(new Map([[freshEntry.id, freshEntry], [staleEntry.id, staleEntry], [futureEntry.id, futureEntry]]), nowRetry)).pending.map((x) => x.id), ['fresh-1'])
  const rq1 = persistRetryQueue(retryFile, new Map([[freshEntry.id, freshEntry]]), nowRetry, retryLog)
  const rq2 = persistRetryQueue(retryFile, new Map(), nowRetry, retryLog)
  eq('⑬b 待重试记录原子写:两次覆盖均成功且无 .tmp- 残留', [rq1, rq2, retryTmpLeft().length], [true, true, 0])
  fs.writeFileSync(retryFile, JSON.stringify({ pending: [freshEntry, staleEntry] }), 'utf8')
  const rqLoaded = loadRetryQueue(retryFile, nowRetry, retryLog)
  eq('⑬c 载入只接管 10 分钟内的记录,更早的丢弃并留 WARN(不静默补发)', [rqLoaded.size, retryLogs.some((l) => /丢弃 1 条过期/.test(l))], [1, true])
  // 成功腿:UNDEL 起点必须存在(模拟首次双失败留下的凭据),再看重试成功后是否被清掉。
  markMailUndelivered(retryUndel, { ts: new Date(nowRetry).toISOString(), alerts: ['HighCPU'], why: '首次双失败' })
  dedup.set('Anchor|a:1', 1000) // 种一个去重锚点:重试腿不得改写它(回滚锚点 = 多信)
  const okCalls = []
  const okDispatchCounted = async (p) => { okCalls.push(p); return { ok: true, why: '假成功' } }
  const okBefore = counters.mailRetriesOk
  pendingRetries.set('ok-1', { ...freshEntry, id: 'ok-1' })
  persistRetryQueue(retryFile, pendingRetries, Date.now(), retryLog)
  const rOkRetry = await runMailRetry('ok-1', { log: retryLog, dispatch: okDispatchCounted, undelFile: retryUndel, retryFile })
  eq('⑬d 重试成功 ⇒ ok 计数 +1、派发只 1 次(品牌一次即成)、队列清空', [rOkRetry.ok, counters.mailRetriesOk - okBefore, okCalls.length, pendingRetries.size], [true, 1, 1, 0])
  eq('⑬e 重试成功 ⇒ UNDEL 被清(告警已到人,旧凭据必须消失)', fs.existsSync(retryUndel), false)
  eq('⑬f 日志有「重试成功」', retryLogs.some((l) => /重试成功/.test(l)), true)
  eq('⑬g 重试腿不碰去重锚点:ts 原样保留,且重试后同身份推送仍被判重(窗口没被打穿)', [dedup.get('Anchor|a:1'), partitionAlerts([{ labels: { alertname: 'Anchor', instance: 'a:1' } }], dedup, 1000 + 60000, HOUR).toPush.length], [1000, 0])
  dedup.delete('Anchor|a:1')
  // 失败腿:两次都失败 ⇒ UNDEL 保留、计数 +1,且**不再排第二次**(无限重试比丢信更糟)。
  const failBefore = counters.mailRetriesFail
  markMailUndelivered(retryUndel, { ts: new Date(nowRetry).toISOString(), alerts: ['HighCPU'], why: '首次双失败' })
  const failCalls = []
  const failDispatchCounted = async (p) => { failCalls.push(p); return { ok: false, why: '假失败:SMTP 拒收' } }
  pendingRetries.set('fail-1', { ...freshEntry, id: 'fail-1' })
  persistRetryQueue(retryFile, pendingRetries, Date.now(), retryLog)
  const rFailRetry = await runMailRetry('fail-1', { log: retryLog, dispatch: failDispatchCounted, undelFile: retryUndel, retryFile })
  eq('⑬h 重试仍失败 ⇒ fail 计数 +1、品牌 + plain 共 2 次、队列清空且不再排第二次(无无限重试)', [rFailRetry.ok, counters.mailRetriesFail - failBefore, failCalls.length, pendingRetries.size, retryTimers.size], [false, 1, 2, 0, 0])
  eq('⑬i 仍失败 ⇒ UNDEL 保留(重试过不等于到人)', fs.existsSync(retryUndel), true)
  eq('⑬j 日志有「不再重试」', retryLogs.some((l) => /不再重试/.test(l)), true)
  // 过期腿:15 分钟前的记录被进程接管也绝不发送(陈旧告警补发 = 新造轰炸)。
  const expBefore = counters.mailRetriesExpired
  let expCalls = 0
  pendingRetries.set('exp-1', { ...staleEntry, id: 'exp-1', nextAttemptTs: Date.now() })
  const rExpRetry = await runMailRetry('exp-1', { log: retryLog, dispatch: async () => { expCalls += 1; return { ok: true } }, undelFile: retryUndel, retryFile })
  eq('⑬k 超过 2min 发送窗口 ⇒ 派发 0 次、expired 计数 +1、队列清空(陈旧告警不补发)', [rExpRetry.expired, expCalls, counters.mailRetriesExpired - expBefore, pendingRetries.size], [true, 0, 1, 0])
  const retryText = renderMetrics({ ...sample, counters })
  eq('⑬l 三条 result 样本行都真渲染(retry ok/fail/expired 各自可观测,不并桶)', [
    /^ihui_alertbridge_mail_retry_total{result="ok"} [0-9]+$/m.test(retryText),
    /^ihui_alertbridge_mail_retry_total{result="fail"} [0-9]+$/m.test(retryText),
    /^ihui_alertbridge_mail_retry_total{result="expired"} [0-9]+$/m.test(retryText),
  ], [true, true, true])
  const bridgeSrcRetry = fs.readFileSync(__filename, 'utf8')
  eq('⑬m 接线锁:handleAlert 的双失败分支真排重试(不是只写了个函数)', bridgeSrcRetry.includes('scheduleMailRetry(toPush, m.why, writeLog)'), true)
  const retryFnBody = bridgeSrcRetry.slice(bridgeSrcRetry.indexOf('async function runMailRetry'), bridgeSrcRetry.indexOf('/** 一批告警 → 投递计划'))
  eq('⑬n 反向锁:重试腿里不得再排第二次,也不得读写去重表', [/armRetryTimer|scheduleMailRetry|setTimeout/.test(retryFnBody), /\bdedup\b/.test(retryFnBody), /\bstore\.(set|delete)\b/.test(retryFnBody)], [false, false, false])
  eq('⑬o 重启接管锁:startServer 真读待重试队列并续排(不是只落盘不接)', [bridgeSrcRetry.includes('loadRetryQueue(RETRY_FILE, Date.now(), writeLog)'), bridgeSrcRetry.includes('if (MAIL_ENABLED) armRetryTimer(e, { log: writeLog })')], [true, true])
  eq('⑬p 对外契约未改:/health 仍是原来四个键、全文件没有 503(AM 不得因邮件失败被拖进重试风暴)', [bridgeSrcRetry.includes("JSON.stringify({ ok: true, service: 'alert-webhook-bridge', mailEnabled: MAIL_ENABLED, mailUndelivered: fs.existsSync(UNDEL_FILE) })"), (bridgeSrcRetry.match(/writeHead\(503/g) || []).length], [true, 0])

  let bad = 0
  for (const [label, pass, why] of cases) {
    if (!pass) bad++
    console.log(`${pass ? '✓' : '✗'} ${label}${pass ? '' : `  ${why}`}`)
  }
  for (const f of cleanup) { try { fs.rmSync(f, { force: true }) } catch { /* 自检临时文件清不掉不影响结论 */ } }
  console.log(`自检 ${cases.length - bad}/${cases.length} 通过`)
  process.exit(bad ? 1 : 0)
}

function startServer() {
  // 起服务就先问一次锚点:否则第一条抓取会在 TTL 之前读到 0,而 LogSourceSplitBlind 的
  // `for: 10m` 会把一次正常重启读成"分流失明"。
  const anchor = currentLogAnchor()
  server.listen(PORT, '127.0.0.1', () => {
    const n = loadDedupState(STATE_FILE, dedup, Date.now(), MAX_DEDUP_AGE_MS, writeLog, clearHolds) // 去重态 + 24h 上限跨重启延续;损坏文件先备份再空态起算
    // 重启接管待重试:只接 10 分钟内的记录;更早的一律丢弃(补发陈年告警 = 新造轰炸)。
    const rq = loadRetryQueue(RETRY_FILE, Date.now(), writeLog)
    pendingRetries.clear()
    for (const e of rq.values()) {
      pendingRetries.set(e.id, e)
      if (MAIL_ENABLED) armRetryTimer(e, { log: writeLog })
    }
    persistRetryQueue(RETRY_FILE, pendingRetries, Date.now(), writeLog)
    if (rq.size) {
      writeLog(MAIL_ENABLED
        ? `[mail][retry] 重启接管 ${rq.size} 条待重试记录(仅 10 分钟内且 2 分钟发送窗口内的才真发)`
        : `[mail][retry][WARN] 邮件通道关闭,${rq.size} 条待重试记录不接管(超过 10 分钟自然作废)`)
    }
    if (fs.existsSync(UNDEL_FILE)) {
      writeLog(`[mail][WARN] 存在未送达标记 ${UNDEL_FILE} —— 此前有告警未能到人,处置后由下一次成功投递自动清除`)
    }
    writeLog(`alert-webhook-bridge 启动, 监听 127.0.0.1:${PORT}, 邮件通道 ${MAIL_ENABLED ? '开' : '关(BRIDGE_MAIL_ENABLED)'}, 去重窗口 ${DEDUP_WINDOW_MIN} 分钟(只按身份去重,无总量封顶), 载入去重条目 ${n === null ? 0 : n}${n === null ? '(状态文件缺失/损坏,按空态起算)' : ''}, 日志来源分流 ${anchor.ok ? `在跑(${anchor.label}=${anchor.self.join('|')} 只报不炸)` : '未判定(一条都不压,全部照旧到人 —— 见 LogSourceSplitBlind)'}`)
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
