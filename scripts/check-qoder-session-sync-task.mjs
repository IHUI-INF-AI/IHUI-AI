// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Qoder 会话回灌计划任务的存续哨兵(2026-10-31 立)。
 *
 * 判机器状态(计划任务注册值 + 日志区段)⇒ **刻意不进提交链**(§12e:提交者结构上满足不了,
 * 挂成提交门即恒红)。唯一调度器 = `scripts/git-guardian.mjs` 的 `auditQoderSessionSyncTask()`。
 *
 * 立因:回灌任务以交互用户身份跑(DPAPI 只能由登录用户解),而"任务被删 / 被禁用 /
 * 被改成 S4U / pwsh 或 Qoder 目录漂移 / 任务停摆"这些失效形态全部表现为**安静** ——
 * 池里那枚号照旧显示 healthy(票还有 30 天),直到票过期才发现没人续。本尺子只判
 * "这条保活腿现在还在不在跑",不判账号业务健康。
 *
 * 三态(§0.3):ok / breach / unjudged。取不到输入记 unjudged(不记绿也不冒红);
 * 日志刚被新一轮写了一半 ⇒ 本轮 unjudged,不按缺陷派单。
 *
 * 用法:`node scripts/check-qoder-session-sync-task.mjs [--json]`
 * 退出码:0 ok / 1 breach / 2 unjudged。
 *
 * §根因(2026-11-15 定案):11-02~11-14 该腿每 12h 一封「保活腿失效」告警,而任务本体
 * 五维一直全绿、日志每 10 分钟新鲜。真因 = 回灌脚本在 WorkBuddy 客户端主进程不在时
 * 按 §0.3 写「❌ 回灌未判定」(exit 2,探测面取不到输入),本尺子的 hasFailureMark 只认 ❌,
 * 把连续两轮「未判定」当成连续真故障 ⇒ log_verdict=breach ⇒ 发信。历次处置(11-03 拉
 * 168h 窗口 / 11-05 重建任务并回收 12h 窗口)全在抑制层,没动判据,所以反复复发。
 * 本轮修在判据:isClientNotReady 把「探测面取不到输入」归 unjudged;真失败 / tsx 缺失 /
 * SIGTERM 超时 / 结构化失败汇总仍走原有连续失败判定(镜像测试 S6~S9 双向钉死)。
 * 另修同族假红:schtasks 查询失败时空 XML 曾让 task_wrapper 凭空判 breach,
 * 现整组派生维一并 unjudged。
 *
 * §杜绝复发(2026-11-15):判据不再自己持有「什么算未判定」的规则。生产者在日志里写
 * 结构化标记,消费者与生产者共用 scripts/lib/client-sync-verdict.mjs 这一份契约;
 * 旧日志无标记才回退文本正则。上游改文案不会再让本尺子失配,历次「改冷却窗口压症状」
 * 的路径已从结构上堵住(alert-delivery-policy.json 该族 reason 有定案,镜像测试钉死)。
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import {
  CLIENT_NOT_READY_RE,
  classifyLogSegment,
  hasFailureMark,
  hasHardFailureLine,
  isClientNotReady,
} from './lib/client-sync-verdict.mjs'

/** 计划任务名(env 可覆盖,便于镜像测试与换名演练) */
export const DEFAULT_TASK_NAME = 'IHUI-Qoder-Session-Sync'
/** 回灌日志落点(与 setup-qoder-session-sync-task.ps1 的默认 LogDir 一致) */
export const DEFAULT_LOG_PATH = 'D:\\DevEnv\\logs\\qoder-session-sync.log'
/** 每轮写入的 ASCII 分隔标记(定位"最后一轮"区段;无时间成分,避免区域格式) */
export const RUN_MARKER = '=== RUN ==='
/** 日志新鲜度容差:默认按 3 个周期;周期解析不到时用 30 分钟 */
export const DEFAULT_STALE_MS = 30 * 60 * 1000

/** 解析计划任务 XML(ASCII 标签,与编码无关;中文描述不参与判读)。 */
export function parseTaskXml(xml) {
  const text = String(xml ?? '')
  const enabledRaw = /<Enabled>(true|false)<\/Enabled>/i.exec(text)?.[1]
  const intervalRaw = /<Interval>PT(\d+)M<\/Interval>/i.exec(text)?.[1]
  // 不能只吃字母:真实值是 InteractiveToken / S4U / ServiceAccount(S4U 含数字,
  // 只写 [A-Za-z]+ 会把 "S4U" 截成 "S" 再匹配失败 ⇒ 误判 unjudged 放过配置漂移)
  const logonType = /<LogonType>([^<]*)<\/LogonType>/i.exec(text)?.[1] ?? ''
  const argsRaw = /<Arguments>([^<]*)<\/Arguments>/i.exec(text)?.[1] ?? ''
  const wrapperPath = /([A-Za-z]:\\[^"<>]*?\.vbs)/i.exec(argsRaw.replace(/&quot;/g, '"'))?.[1] ?? ''
  const startBoundaryRaw = /<StartBoundary>([^<]*)<\/StartBoundary>/i.exec(text)?.[1] ?? ''
  const startBoundaryMs = startBoundaryRaw ? Date.parse(startBoundaryRaw) : NaN
  return {
    // 任务 XML 省略 <Enabled> 时 Windows 语义为"启用"(实测本机任务即无该字段,
    // 只有被禁用才会显式写 false)。缺失若判未判定,这把尺子会永久 unjudged。
    enabled: enabledRaw === undefined ? true : enabledRaw === 'true',
    enabledExplicit: enabledRaw !== undefined,
    intervalMinutes: intervalRaw === undefined ? null : Number(intervalRaw),
    logonType,
    wrapperPath,
    startBoundaryMs: Number.isFinite(startBoundaryMs) ? startBoundaryMs : null,
  }
}

/**
 * 取最后一轮的区段:优先按 RUN_MARKER 切;旧格式(无标记)退到最后 20 行。
 * `hasMarker=false` 时 verdict 只作参考(见 judgeDims 的 legacy 说明)。
 */
export function splitLastRun(text) {
  const raw = String(text ?? '')
  const idx = raw.lastIndexOf(RUN_MARKER)
  if (idx >= 0) return { hasMarker: true, segment: raw.slice(idx + RUN_MARKER.length) }
  return { hasMarker: false, segment: raw.split(/\r?\n/).slice(-20).join('\n') }
}

/** 段内最后一个可解析的 JSON 汇总行(回灌脚本的 --json 产出)。 */
export function parseLastJson(segment) {
  const lines = String(segment ?? '').split(/\r?\n/)
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const t = lines[i].trim()
    if (!t.startsWith('{')) continue
    try {
      return JSON.parse(t)
    } catch {
      /* 不是汇总行,继续往前找 */
    }
  }
  return null
}

/**
 * 段级语义判据一律取自 scripts/lib/client-sync-verdict.mjs(唯一真相源,见文件头 §杜绝复发)。
 * 本文件不再持有第二份正则/句式:生产者写结构标记、消费者优先读标记,旧日志才回退文本口径。
 * 转出到 __test__ 只是给镜像测试一个稳定入口,不是新实现。
 */

/**
 * 判据主体(纯函数,镜像测试直接调)。入参全部由调用方现读,不做第二份取值。
 * @returns {Record<string,{verdict:'ok'|'breach'|'unjudged',reason?:string,reading?:string}>}
 */
export function judgeDims({
  taskQuery,
  xml,
  wrapperExists,
  logStat,
  segment,
  hasMarker,
  now = Date.now(),
  /**
   * 倒数第二段(区分"单轮瞬时失败"与"连续失败")。
   * 不传(测试/无历史)⇒ 退化为旧行为:最后一轮报错即 breach(§报警前先自愈)。
   * 传了且上一段健康 ⇒ 单轮瞬时失败(机器饱和被 SIGTERM / 并发改文件短暂缺失,下一轮自愈重试即恢复)⇒ unjudged 不喊人;
   * 传了且上一段也失败 ⇒ 连续失败(真故障,qoder 号要掉)⇒ breach。
   */
  prevSegment = null,
}) {
  const dims = {}
  const task = parseTaskXml(xml)
  const intervalMinutes =
    Number.isFinite(task.intervalMinutes) && task.intervalMinutes > 0 ? task.intervalMinutes : 10
  const staleMs = Math.max(intervalMinutes * 3, 20) * 60 * 1000

  if (!taskQuery?.ok) {
    if (taskQuery?.error === 'not-found') {
      dims.task_registered = {
        verdict: 'breach',
        reason: '计划任务不存在',
        reading: `schtasks query rc!=0`,
      }
    } else {
      dims.task_registered = {
        verdict: 'unjudged',
        reason: `计划任务查询取不到输入:${String(taskQuery?.error ?? '未知')}`,
      }
    }
  } else if (task.enabled === false) {
    dims.task_registered = { verdict: 'breach', reason: '计划任务被禁用', reading: 'Enabled=false' }
  } else {
    dims.task_registered = {
      verdict: 'ok',
      reading: `interval=${intervalMinutes}m${task.enabledExplicit ? '' : ';enabled=default'}`,
    }
  }

  // 计划任务 XML 取不到输入(查询被拒 / spawn 失败)⇒ 整组派生维都未判定(§0.3)。
  // 旧版把空 XML 解析出的空 wrapperPath 直接判 breach,会在 schtasks 被拒时凭空发一封告警。
  const xmlUnavailable = taskQuery?.ok !== true
  if (xmlUnavailable) {
    dims.task_wrapper = {
      verdict: 'unjudged',
      reason: '计划任务 XML 取不到输入 ⇒ 无法判 action(§0.3,不冒红)',
    }
    dims.task_identity = {
      verdict: 'unjudged',
      reason: '计划任务 XML 取不到输入 ⇒ 无法判 LogonType(§0.3,不冒红)',
    }
  } else if (!task.wrapperPath) {
    dims.task_wrapper = { verdict: 'breach', reason: '任务 action 未指向隐藏包装脚本' }
  } else if (!wrapperExists) {
    dims.task_wrapper = {
      verdict: 'breach',
      reason: 'action 指向的 VBS 包装不存在(幽灵任务)',
      reading: task.wrapperPath,
    }
  } else {
    dims.task_wrapper = { verdict: 'ok', reading: task.wrapperPath }
  }

  if (!xmlUnavailable) {
    if (!task.logonType) {
      dims.task_identity = { verdict: 'unjudged', reason: '任务 XML 未给出 LogonType' }
    } else if (task.logonType !== 'InteractiveToken') {
      dims.task_identity = {
        verdict: 'breach',
        reason: `LogonType=${task.logonType};DPAPI 只在交互登录会话可用,S4U/ServiceAccount 读不到 Qoder 凭据`,
      }
    } else {
      dims.task_identity = { verdict: 'ok', reading: task.logonType }
    }
  }

  const ageMs = logStat?.exists ? now - logStat.mtimeMs : null
  const registeredForMs =
    task.startBoundaryMs === null ? null : now - task.startBoundaryMs
  if (ageMs === null) {
    // 任务注册已超过 3 个周期仍无日志 ⇒ 不是"刚装",是"从未跑成功";判红比永远 unjudged 有用。
    if (registeredForMs !== null && registeredForMs > staleMs) {
      dims.log_fresh = {
        verdict: 'breach',
        reason: '任务注册超过 3 个周期仍无日志(从未跑成功或日志路径漂移)',
        reading: `registered=${Math.round(registeredForMs / 60000)}m`,
      }
    } else {
      dims.log_fresh = {
        verdict: 'unjudged',
        reason: '日志文件不存在(刚注册尚未产出,未判定)',
      }
    }
  } else if (ageMs > staleMs) {
    dims.log_fresh = {
      verdict: 'breach',
      reason: '回灌任务停摆(日志超过 3 个周期未更新)',
      reading: `age=${Math.round(ageMs / 60000)}m > ${Math.round(staleMs / 60000)}m`,
    }
  } else {
    dims.log_fresh = { verdict: 'ok', reading: `age=${Math.round(ageMs / 60000)}m` }
  }

  const summary = parseLastJson(segment)
  if (isClientNotReady(segment)) {
    // 客户端主进程/数据目录不在 ⇒ 探测面取不到输入,回灌脚本自己标的是「未判定」(exit 2)。
    // 这是环境未就绪而非保活腿失效;票面由池侧兜底,号池健康另有 relay-keepalive-* 告警族。
    // 按 §0.3 取不到输入 ⇒ 未判定,不记绿也不冒红。
    dims.log_verdict = {
      verdict: 'unjudged',
      reason:
        '最后一轮为探测面取不到输入(客户端主进程/数据目录不在,回灌脚本自述未判定);' +
        '环境未就绪,不是保活腿失效 ⇒ 按 §0.3 不记绿也不冒红',
      reading:
        String(segment)
          .trim()
          .split(/\r?\n/)
          .find((l) => l.includes('❌'))
          ?.slice(0, 200) ?? '',
    }
  } else if (hasFailureMark(segment)) {
    // §报警前先自愈:同步任务每几分钟自跑即重试。单轮瞬时失败(机器饱和被 SIGTERM /
    // 并发改文件短暂缺失)下一轮即恢复,不应占人通道;只有连续失败才是真故障(qoder 号要掉)。
    const hasPrev = Boolean(prevSegment) && prevSegment.trim().length > 0
    // 上一轮只是「环境未就绪」不算失败:客户端一开就恢复,不能和本轮真失败拼成「连续两轮」
    const prevFailed =
      hasPrev && hasFailureMark(prevSegment) && !isClientNotReady(prevSegment)
    if (prevFailed) {
      dims.log_verdict = {
        verdict: 'breach',
        reason: '连续两轮回灌报错(非瞬时,真故障)',
        reading: String(segment).trim().split(/\r?\n/).slice(-1)[0]?.slice(0, 200) ?? '',
      }
    } else if (hasPrev) {
      dims.log_verdict = {
        verdict: 'unjudged',
        reason:
          '最后一轮回灌报错,但上一轮成功 ⇒ 单轮瞬时失败,待下一轮确认(下一轮仍失败才视为真故障)',
        reading: String(segment).trim().split(/\r?\n/).slice(-1)[0]?.slice(0, 200) ?? '',
      }
    } else {
      dims.log_verdict = {
        verdict: 'breach',
        reason: '最后一轮回灌报错(无历史段可确认是否瞬时)',
        reading: String(segment).trim().split(/\r?\n/).slice(-1)[0]?.slice(0, 200) ?? '',
      }
    }
  } else if (!summary) {
    dims.log_verdict = {
      verdict: 'unjudged',
      reason: hasMarker ? '最后一轮尚未产出汇总行(可能正在运行)' : '旧格式日志无汇总行可判',
    }
  } else if (summary.ok === false || Number(summary.failed) > 0) {
    dims.log_verdict = {
      verdict: 'breach',
      reason: '最后一轮汇总判失败',
      reading: `ok=${summary.ok} failed=${summary.failed} imported=${summary.imported}`,
    }
  } else {
    dims.log_verdict = {
      verdict: 'ok',
      reading: `total=${summary.total} applied=${summary.applied} skipped=${summary.skipped} imported=${summary.imported ?? '-'}`,
    }
  }

  return dims
}

/** 总体三态:breach > unjudged > ok。 */
export function judgeOverall(dims) {
  const values = Object.values(dims ?? {}).map((d) => d?.verdict)
  if (values.includes('breach')) return 'breach'
  if (values.includes('unjudged')) return 'unjudged'
  return 'ok'
}

function queryTaskXml(taskName) {
  try {
    const buf = execFileSync('schtasks.exe', ['/Query', '/TN', taskName, '/XML'], {
      windowsHide: true,
      timeout: 20_000,
      stdio: ['ignore', 'pipe', 'pipe'],
      encoding: 'buffer',
    })
    // latin1 = 每字节一字符:本尺子只匹配 ASCII 标签,中文描述乱码无影响
    return { ok: true, xml: Buffer.from(buf).toString('latin1') }
  } catch (e) {
    const status = typeof e?.status === 'number' ? e.status : null
    return {
      ok: false,
      error: status === 1 || status === 2 ? 'not-found' : `spawn:${e?.code ?? e?.message ?? 'unknown'}`,
    }
  }
}

function readLog(logPath) {
  try {
    const st = statSync(logPath)
    return { exists: true, mtimeMs: st.mtimeMs, size: st.size }
  } catch {
    return { exists: false, mtimeMs: null, size: 0 }
  }
}

function readLogSegment(logPath, size) {
  if (!size) return ''
  try {
    const fd = readFileSync(logPath)
    const tail = fd.subarray(Math.max(0, fd.length - 256 * 1024)).toString('utf8')
    return tail
  } catch {
    return ''
  }
}

/** 取 `--flag value`(命令行优先;取不到返回 null,由上层回落到 env/默认)。 */
export function argValue(argv, flag) {
  const i = argv.indexOf(flag)
  if (i < 0 || i + 1 >= argv.length) return null
  const v = String(argv[i + 1] ?? '').trim()
  return v && !v.startsWith('--') ? v : null
}

export async function main(argv) {
  const json = argv.includes('--json')
  // 命令行 > env > 默认:同一把尺子被 qoder / workbuddy 两条腿共用,判据零分叉
  const taskName =
    argValue(argv, '--task') || process.env.IHUI_QODER_SYNC_TASK || DEFAULT_TASK_NAME
  const logPath = argValue(argv, '--log') || process.env.IHUI_QODER_SYNC_LOG || DEFAULT_LOG_PATH
  const now = Date.now()

  const taskQuery = queryTaskXml(taskName)
  const xml = taskQuery.ok ? taskQuery.xml : ''
  const task = parseTaskXml(xml)
  const wrapperExists = Boolean(task.wrapperPath) && existsSync(task.wrapperPath)
  const logStat = readLog(logPath)
  const raw = readLogSegment(logPath, logStat.size)
  const split = splitLastRun(raw)
  // 取倒数第二段,供 log_verdict 区分"单轮瞬时失败"与"连续失败"(§报警前先自愈)
  const runSegs = raw.split(RUN_MARKER)
  const prevSegment = runSegs.length >= 2 ? runSegs[runSegs.length - 2] : ''
  const dims = judgeDims({
    taskQuery,
    xml,
    wrapperExists,
    logStat,
    segment: split.segment,
    hasMarker: split.hasMarker,
    prevSegment,
    now,
  })
  const overall = judgeOverall(dims)
  const out = {
    ok: overall === 'ok',
    overall,
    task: {
      name: taskName,
      enabled: task.enabled,
      intervalMinutes: task.intervalMinutes,
      logonType: task.logonType,
      wrapperPath: task.wrapperPath,
    },
    log: { path: logPath, exists: logStat.exists, ageMinutes: logStat.exists ? Math.round((now - logStat.mtimeMs) / 60000) : null },
    dims,
    checkedAt: new Date(now).toISOString(),
  }
  if (json) {
    process.stdout.write(`${JSON.stringify(out)}\n`)
  } else {
    process.stdout.write(`Qoder 回灌任务存续:${overall}\n`)
    for (const [k, d] of Object.entries(dims)) {
      const extra = [d.reason, d.reading].filter(Boolean).join(' | ')
      process.stdout.write(`  ${k}: ${d.verdict}${extra ? ` (${extra})` : ''}\n`)
    }
  }
  return overall === 'ok' ? 0 : overall === 'breach' ? 1 : 2
}

const isDirectRun =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  main(process.argv.slice(2))
    .then((code) => process.exit(code))
    .catch((e) => {
      process.stderr.write(`❌ ${e?.message ?? e}\n`)
      process.exit(2)
    })
}

export const __test__ = {
  parseTaskXml,
  splitLastRun,
  parseLastJson,
  hasFailureMark,
  hasHardFailureLine,
  isClientNotReady,
  CLIENT_NOT_READY_RE,
  judgeDims,
  judgeOverall,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
