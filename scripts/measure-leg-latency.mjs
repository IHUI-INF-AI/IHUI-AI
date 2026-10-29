#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 本工具是运维尺子,结论必须走 stdout */
/**
 * measure-leg-latency.mjs — 单条公网腿的**分阶段延迟分位尺**(台账票 Y-12,只读探测)
 *
 * ## 它要回答的那个问题
 * Y-12 票面:机器外观测 GitHub App 最近 100 条投递,p50=0.69s / p95=8.34s / max=8.72s,
 * 直方图 <0.5s 只有 20 条、>=2s 有 21 条 ⇒ 手机用户走 api.aizhs.top 会持续"转圈"。
 * 票面要求**先按维度拆开量**(隧道边缘 RTT / 源站处理耗时 / 冷启动排队),再决定加源站并发
 * 还是把端点挪出隧道臂;且**判"腿坏"必须用外部正证**,不得拿本机 curl 自环读数定责。
 *
 * 既有的 `check-public-path-probe.mjs`(G-301)判的是**可用性/越阈事件**(慢线 8000ms、
 * 序列 A/B、换流窗剔除),它给的是"坏没坏";它**不给一条腿的分阶段分位表**,也不给
 * "这一秒 slow 归哪一段"的量级。本尺子只补这一格,不重造它的判据,也不进提交链。
 *
 * ## 三个维度的口径(每个样本都由 socket 事件自己切分,不靠 curl 的 -w 文本)
 *   · dnsMs    = lookup - start                 域名解析
 *   · tcpMs    = connect - lookup               到边缘的 TCP 建连(= 1×RTT,边缘选路好不好直接看它)
 *   · tlsMs    = secureConnect - connect        TLS 握手(真访客/真投递每条新连接都要付一次)
 *   · originMs = response - secureConnect       握手完成后到首字节(= 边缘→隧道→源站→应用)
 *   · totalMs  = end - start
 * `--keepalive` 档复用同一条连接连发:此时 tcpMs/tlsMs 记为 null,**只剩 originMs** ——
 * 这才是"源站处理耗时"的干净读数(把建连与握手成本剥掉)。
 *
 * ## 三条纪律
 *  ① **取不到输入 ⇒ undetermined 并点名原因**,绝不把"没量到"写成"没问题"。
 *     DNS/TCP/TLS 阶段缺事件 ⇒ 该阶段 null(不计入分位,分母如实报);成功样本 0 ⇒ 该目标 undetermined。
 *  ② **外部正证优先**:`--deliveries <file>` 吃一份已拉到的 GitHub 投递 JSON
 *     (`gh api app/hook/deliveries` 的数组,或 `{ deliveries: [...] }`),按 duration 算 p50/p95;
 *     `--gh` 档自己尝试 `gh api app/hook/deliveries`,401/404 一律落 **undetermined 并点名缺的凭据**
 *     (`GITHUB_APP_ID` + `GITHUB_APP_PRIVATE_KEY`)—— 那是 App JWT 才有的面,gh 用户 token 打不开。
 *     外部正证缺失**不阻断**本机分阶段读数,但结论里必须写成两条,不得互相顶账。
 *  ③ **形态判读要落到量级**:同一目标首包 vs 后续、变异系数、p95/p50 三把尺子合起来判
 *     冷启动 / 均匀排队 / 长尾上游阻塞 / 稳定,判不出就给 `unclassified`(不硬套)。
 *
 * ## 用法
 *   node scripts/measure-leg-latency.mjs                       # 默认 4 靶 × 20 样本,人读摘要
 *   node scripts/measure-leg-latency.mjs --json out.json       # 同时落机读 JSON
 *   node scripts/measure-leg-latency.mjs --json-only           # stdout 只出 JSON(管道用)
 *   node scripts/measure-leg-latency.mjs --samples 30 --keepalive   # 剥掉握手,单量源站
 *   node scripts/measure-leg-latency.mjs --target api=https://api.aizhs.top/api/health
 *   node scripts/measure-leg-latency.mjs --deliveries d.json --json out.json   # 并入外部投递正证
 *   node scripts/measure-leg-latency.mjs --gh                  # 让尺子自己试 App 投递面(通常 401)
 *   node scripts/measure-leg-latency.mjs --budget-p95-ms 2000  # p95 越阈 ⇒ exit 1
 *
 * ## 退出码
 *   0 = 全部目标已判定且未越阈 / 1 = 已判定且某目标 p95 越阈 / 2 = 用法错
 *   3 = 至少一个目标 undetermined(结论无效;不得读成健康)
 *
 * ## 靶清单的出处(不凭记忆写路径)
 *   api/https://api.aizhs.top/api/health   ← scripts/data/public-path-legs.json legs[id=api](origin 127.0.0.1:8802)
 *   www/https://www.aizhs.top/sso/login    ← 同文件 legs[id=www]
 *   /api/app-version/latest?platform=android 是**同一源站的应用端点**(两腿都 200),
 *   放在一起才能把"边缘/隧道"与"源站处理"分开:同端点跨腿差 = 腿差,单腿轻/重端点差 = 源站差。
 */
import { spawnSync } from 'node:child_process'
import https from 'node:https'
import http from 'node:http'
import { performance } from 'node:perf_hooks'
import { writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

export const SCHEMA = 'ihui/leg-latency-probe@1'

/** 默认靶:每条都带仓内出处,见文件头「靶清单的出处」。 */
export const DEFAULT_TARGETS = [
  {
    id: 'api-health',
    url: 'https://api.aizhs.top/api/health',
    leg: 'api(Cloudflare 隧道臂)',
    role: '源站最轻端点 —— 走隧道,握手+隧道+源站全含',
  },
  {
    id: 'api-trace',
    url: 'https://api.aizhs.top/cdn-cgi/trace',
    leg: 'api(Cloudflare 隧道臂)',
    role: '边缘自报机房(colo)+ 本机落地 IP —— 判"边缘选路"这一维的硬证据',
  },
  {
    id: 'api-appver',
    url: 'https://api.aizhs.top/api/app-version/latest?platform=android',
    leg: 'api(Cloudflare 隧道臂)',
    role: '源站应用端点(重一点) —— 与 www-appver 同端点跨腿可比',
  },
  {
    id: 'www-appver',
    url: 'https://www.aizhs.top/api/app-version/latest?platform=android',
    leg: 'www(EdgeOne 臂)',
    role: '同一源站端点,不经隧道 —— 对照臂',
  },
  {
    id: 'cf-control',
    url: 'https://cloudflare.com/cdn-cgi/trace',
    leg: 'Cloudflare 边缘(无隧道)对照',
    role: '只到边缘就回头 —— 把"本机↔CF 边缘"与"边缘↔源站"分开',
  },
]

/** 缺外部正证时要点名的那把凭据(票面要求:undetermined 必须说缺什么)。 */
export const EXTERNAL_CREDENTIAL_HINT =
  'GITHUB_APP_ID + GITHUB_APP_PRIVATE_KEY(生成 App JWT 用);gh 的用户 token 打不开 /app/hook/deliveries'

// ─────────────────────────── 纯函数(测试面) ───────────────────────────

/** 最近秩分位;p ∈ [0,1];空样本 ⇒ null(不是 0 —— 没量到不等于零延迟)。 */
export function percentile(values, p) {
  const xs = (values || []).filter((v) => typeof v === 'number' && Number.isFinite(v)).sort((a, b) => a - b)
  if (xs.length === 0) return null
  const q = Math.min(1, Math.max(0, p))
  const rank = Math.ceil(q * xs.length)
  return xs[Math.min(xs.length - 1, Math.max(0, rank - 1))]
}

/** 阶段切分:任一事件缺 ⇒ 该阶段 null(不拿 0 冒充"没有耗时")。 */
export function derivePhases(t) {
  const dnsMs = num(t.lookupAt, t.startAt) ? t.lookupAt - t.startAt : null
  const tcpMs = num(t.connectAt, t.lookupAt) ? t.connectAt - t.lookupAt : null
  const tlsMs = num(t.secureAt, t.connectAt) ? t.secureAt - t.connectAt : null
  const isNum = (v) => typeof v === 'number' && Number.isFinite(v)
  // 复用的连接没有握手事件 ⇒ 锚点回落到"请求开始":那时 originMs 读的是
  // "发出请求到首字节"的整段等待,正是源站处理口径(拿 0 冒充锚点会把这段凭空抹掉)。
  const anchor = isNum(t.secureAt) ? t.secureAt : isNum(t.connectAt) ? t.connectAt : isNum(t.startAt) ? t.startAt : null
  const originMs = isNum(t.responseAt) && isNum(anchor) ? t.responseAt - anchor : null
  const totalMs = num(t.endAt, t.startAt) ? t.endAt - t.startAt : null
  return { dnsMs, tcpMs, tlsMs, originMs, totalMs }
}

function num(a, b) {
  return typeof a === 'number' && Number.isFinite(a) && typeof b === 'number' && Number.isFinite(b)
}

/** 单序列的 p50/p90/p95/max/min/mean/cv,samples 里 null 会被排掉并如实报分母。 */
export function describeSeries(values) {
  const xs = (values || []).filter((v) => typeof v === 'number' && Number.isFinite(v))
  if (xs.length === 0) return { n: 0, p50: null, p90: null, p95: null, max: null, min: null, mean: null, cv: null }
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length
  const variance = xs.reduce((a, b) => a + (b - mean) ** 2, 0) / xs.length
  const sd = Math.sqrt(variance)
  return {
    n: xs.length,
    p50: round(percentile(xs, 0.5)),
    p90: round(percentile(xs, 0.9)),
    p95: round(percentile(xs, 0.95)),
    max: round(Math.max(...xs)),
    min: round(Math.min(...xs)),
    mean: round(mean),
    cv: mean > 0 ? Number((sd / mean).toFixed(3)) : null,
  }
}

function round(v) {
  return typeof v === 'number' && Number.isFinite(v) ? Math.round(v * 10) / 10 : null
}

/**
 * 形态判读 —— 四档 + 一档"判不出"。
 *  · coldStart      :首样本 ≥ 3× 其余中位,且其余 cv ≤ 0.35(首包付了额外代价,之后归位)
 *  · uniformQueue   :cv ≤ 0.30 且 p95/p50 ≤ 1.5(每次都一样慢 ⇒ 带宽/排队,不是抖动)
 *  · longTail       :p95/p50 ≥ 2.0(少数样本被上游阻塞/重传拉长)
 *  · steady         :p95/p50 < 1.5 且 cv < 0.6
 *  · unclassified   :都不像(样本不足 5 条也落这里 —— 不给假档名)
 */
export function classifyShape(totals) {
  const xs = (totals || []).filter((v) => typeof v === 'number' && Number.isFinite(v))
  if (xs.length < 5) return { shape: 'unclassified', reason: `样本 ${xs.length} < 5,不足以判形态`, metrics: null }
  const rest = xs.slice(1)
  const restMedian = percentile(rest, 0.5)
  const restCv = describeSeries(rest).cv
  const first = xs[0]
  const p50 = percentile(xs, 0.5)
  const p95 = percentile(xs, 0.95)
  const cv = describeSeries(xs).cv
  const ratio = p50 && p50 > 0 ? Number((p95 / p50).toFixed(2)) : null
  const metrics = { firstMs: round(first), restMedianMs: round(restMedian), p95OverP50: ratio, cv, restCv }
  // 冷启动要看"剔除首包后是否归位" ⇒ 用其余样本的 cv,而不是含首包的总 cv
  // (含首包的总 cv 必然被那个离群值拉高,结果冷启动永远被判成长尾 —— 这是本器实测踩到的坑)
  if (restMedian && first >= 3 * restMedian && (restCv ?? 1) <= 0.35) {
    return { shape: 'coldStart', reason: `首样本 ${round(first)}ms ≥ 3× 其余中位 ${round(restMedian)}ms 且其余 cv=${restCv}`, metrics }
  }
  if (ratio !== null && ratio >= 2 && (cv ?? 0) >= 0.3) {
    return { shape: 'longTail', reason: `p95/p50=${ratio}(≥2)且 cv=${cv}`, metrics }
  }
  if ((cv ?? 1) <= 0.3 && ratio !== null && ratio <= 1.5) {
    return { shape: 'uniformQueue', reason: `cv=${cv}(≤0.3)且 p95/p50=${ratio}(≤1.5) ⇒ 每次都一样慢`, metrics }
  }
  if ((cv ?? 1) < 0.6 && ratio !== null && ratio < 1.5) {
    return { shape: 'steady', reason: `cv=${cv},p95/p50=${ratio}`, metrics }
  }
  return { shape: 'unclassified', reason: `cv=${cv},p95/p50=${ratio} 不落任何档`, metrics }
}

/**
 * 主导维度:拿目标里各阶段 p50 的**绝对毫秒**比大小(不是比占比 —— 占比会把"总体都慢"洗掉)。
 * 返回最大项与它的量级;样本不全时给 undetermined 并点名缺哪段。
 */
export function dominantPhase(phaseP50) {
  const keys = ['tlsMs', 'originMs', 'tcpMs', 'dnsMs']
  const present = keys.filter((k) => typeof phaseP50?.[k] === 'number' && Number.isFinite(phaseP50[k]))
  if (present.length === 0) return { phase: null, ms: null, reason: '各阶段分位全缺 ⇒ 无法判主导维度' }
  const sorted = present.sort((a, b) => phaseP50[b] - phaseP50[a])
  const top = sorted[0]
  if (present.length < keys.length) {
    return { phase: top, ms: round(phaseP50[top]), reason: `仅 ${present.length}/${keys.length} 段有读数(${present.join(',')}),主导维度按可得段给` }
  }
  return { phase: top, ms: round(phaseP50[top]), reason: null }
}

const PHASE_LABEL = { dnsMs: 'DNS', tcpMs: 'TCP 建连(边缘 RTT)', tlsMs: 'TLS 握手', originMs: '握手后到首字节(边缘→源站/隧道)' }

/**
 * 解析 GitHub 投递读数。容忍三种形态:
 *   ① `gh api app/hook/deliveries` 的数组:[{ duration, delivered_at, status, event, status_code }]
 *   ② `{ deliveries: [...] }` 包装
 *   ③ 值里带单位的字符串(如 "8340" 毫秒)—— 一律按**毫秒**读,遇到秒级浮点(<50)按秒换算并记换算条数
 * 取不到可用 duration ⇒ ok:false + reason 点名,不返 0 分位。
 */
export function summarizeDeliveries(raw) {
  const rows = Array.isArray(raw) ? raw : Array.isArray(raw?.deliveries) ? raw.deliveries : null
  if (!rows) return { ok: false, reason: '投递读数不是数组,也找不到 .deliveries 数组(取不到输入 ⇒ 未判定)' }
  const durations = []
  let converted = 0
  let times = []
  let success = 0
  let failure = 0
  for (const row of rows) {
    let d = row?.duration
    if (typeof d === 'string' && d.trim() !== '' && Number.isFinite(Number(d))) d = Number(d)
    if (typeof d === 'number' && Number.isFinite(d)) {
      if (d > 0 && d < 50) { d = d * 1000; converted += 1 }
      durations.push(d)
    }
    if (typeof row?.delivered_at === 'string') times.push(row.delivered_at)
    const code = row?.status_code
    if (typeof code === 'number') (code >= 200 && code < 400 ? (success += 1) : (failure += 1))
  }
  if (durations.length === 0) {
    return { ok: false, reason: `读到 ${rows.length} 行但无可用 duration 字段 ⇒ 未判定` }
  }
  times = times.sort()
  return {
    ok: true,
    n: durations.length,
    success,
    failure,
    window: times.length ? { from: times[0], to: times[times.length - 1] } : null,
    secondsConverted: converted,
    p50: round(percentile(durations, 0.5)),
    p90: round(percentile(durations, 0.9)),
    p95: round(percentile(durations, 0.95)),
    max: round(Math.max(...durations)),
    under500: durations.filter((d) => d < 500).length,
    over2000: durations.filter((d) => d >= 2000).length,
  }
}

/** 把 `gh api` 的失败输出翻译成"缺哪把凭据",而不是一句 HTTP 401。 */
export function explainGhFailure(stderrText, status) {
  const s = String(stderrText || '')
  if (/A JSON web token could not be decoded|Not Found \(HTTP 404\)|HTTP 401/i.test(s) || status === 401 || status === 404) {
    return `App 级投递面需要 App JWT —— 本机缺 ${EXTERNAL_CREDENTIAL_HINT}`
  }
  if (/gh: command not found|ENOENT/i.test(s)) return 'gh 不在 PATH ⇒ 取不到外部投递读数'
  if (/Bad credentials|HTTP 403/i.test(s)) return 'gh 凭据无效或权限不足 ⇒ 取不到外部投递读数'
  return `gh 调用失败(exit ${status ?? '?'}):${s.trim().slice(0, 200) || '无输出'}`
}

// ─────────────────────────── 采样 ───────────────────────────

/**
 * 采一个样本。传 agent 即复用连接(keepalive 档,tcp/tls 阶段自然缺事件 ⇒ null)。
 * 不抛出:任何异常都落成样本上的 error 字段,由上层计 fail(失败不是"零延迟")。
 */
export function sampleOnce(url, { agent = null, timeoutMs = 15000 } = {}) {
  return new Promise((resolve) => {
    const t = { startAt: performance.now(), lookupAt: null, connectAt: null, secureAt: null, responseAt: null, endAt: null }
    let settled = false
    const done = (extra) => {
      if (settled) return
      settled = true
      t.endAt = t.endAt ?? performance.now()
      resolve({ ...derivePhases(t), statusCode: extra.statusCode ?? null, remoteAddress: extra.remoteAddress ?? null, httpVersion: extra.httpVersion ?? null, reusedSocket: extra.reusedSocket ?? null, bodyHead: extra.bodyHead ?? null, error: extra.error ?? null })
    }
    let req
    try {
      const mod = url.startsWith('https:') ? https : http
      req = mod.request(
        url,
        {
          method: 'GET',
          agent,
          // 默认不跟重定向:3xx 也是"这条腿应答了",跟随会把边缘 301 的耗时算进源站
          headers: { 'user-agent': 'ihui-leg-latency-probe/1.0', accept: '*/*', 'cache-control': 'no-cache' },
          timeout: timeoutMs,
        },
        (res) => {
          t.responseAt = performance.now()
          const info = { statusCode: res.statusCode, remoteAddress: res.socket?.remoteAddress ?? null, httpVersion: res.httpVersion, reusedSocket: res.req?.reusedSocket ?? null }
          // 前 200 字节留给取证(api 腿的 cdn-cgi/trace 会在这里自报 colo —— 边缘落在哪个机房是硬事实)
          res.on('data', (chunk) => {
            if (info.bodyHead === undefined) info.bodyHead = ''
            if (info.bodyHead.length < 200) info.bodyHead += String(chunk).slice(0, 200 - info.bodyHead.length)
          })
          res.on('end', () => done(info))
          res.on('error', (e) => done({ ...info, error: `响应流错误:${e.message}` }))
          res.resume()
        },
      )
    } catch (e) {
      return done({ error: `构造请求失败:${e.message}` })
    }
    req.on('socket', (socket) => {
      if (socket.connecting === false) {
        // 复用连接:没有握手事件,阶段留 null(不得填 0)
        t.lookupAt = t.lookupAt ?? null
        return
      }
      socket.once('lookup', () => { t.lookupAt = performance.now() })
      socket.once('connect', () => { t.connectAt = performance.now() })
      socket.once('secureConnect', () => { t.secureAt = performance.now() })
    })
    req.on('timeout', () => {
      done({ error: `超过 ${timeoutMs}ms 上限(本尺子主动中止,不据此判对端坏)` })
      req.destroy()
    })
    req.on('error', (e) => done({ error: `${e.code || 'ERR'}:${e.message}` }))
    req.end()
  })
}

async function measureTarget(target, { samples, keepalive, timeoutMs }) {
  // ⚠️ Node 19+ 的 globalAgent 默认 keepAlive:true ⇒ "每条新建连接"档必须显式给 keepAlive:false,
  // 否则样本会偷偷复用连接、tcp/tls 阶段恒 null,读出来的"访客口径"是假的。
  const agent = new https.Agent({ keepAlive: keepalive, maxSockets: 1, keepAliveMsecs: 30000 })
  const rows = []
  try {
    for (let i = 0; i < samples; i += 1) {
      const s = await sampleOnce(target.url, { agent, timeoutMs })
      rows.push(s)
    }
  } finally {
    agent?.destroy()
  }
  const ok = rows.filter((r) => !r.error && typeof r.statusCode === 'number')
  // keepalive 档的第 1 条样本**必然**带握手(连接还没建起来),把它留在序列里会让
  // tcp/tls 分位的分母=1、占比算成 200%+ —— 那一格是"握手成本"不是"源站成本"。
  // 因此 keepalive 档把首条单独记成 warmup,后续只用复用连接的样本。
  const warmup = keepalive ? ok[0] ?? null : null
  const usable = keepalive ? ok.slice(1) : ok
  const totals = usable.map((r) => r.totalMs)
  const series = {
    dnsMs: describeSeries(usable.map((r) => r.dnsMs)),
    tcpMs: describeSeries(usable.map((r) => r.tcpMs)),
    tlsMs: describeSeries(usable.map((r) => r.tlsMs)),
    originMs: describeSeries(usable.map((r) => r.originMs)),
    totalMs: describeSeries(totals),
  }
  const p50 = series.totalMs.p50
  const share = {}
  for (const k of ['dnsMs', 'tcpMs', 'tlsMs', 'originMs']) {
    const v = series[k].p50
    share[k] = typeof v === 'number' && p50 ? Number(((v / p50) * 100).toFixed(1)) : null
  }
  const errors = {}
  for (const r of rows.filter((x) => x.error)) errors[r.error] = (errors[r.error] || 0) + 1
  return {
    id: target.id,
    url: target.url,
    leg: target.leg,
    role: target.role,
    samples: samples,
    okCount: ok.length,
    failCount: rows.length - ok.length,
    statusCodes: [...new Set(ok.map((r) => r.statusCode))].sort(),
    remoteAddresses: [...new Set(ok.map((r) => r.remoteAddress).filter(Boolean))],
    keepalive: keepalive,
    phases: series,
    p50Share: share,
    // 逐样本原值(ms)留在报告里:分位是汇总,汇总不可复算时"分位差"就成了不可证的数字
    perSample: ok.map((r) => ({
      dns: round(r.dnsMs),
      tcp: round(r.tcpMs),
      tls: round(r.tlsMs),
      origin: round(r.originMs),
      total: round(r.totalMs),
      status: r.statusCode,
    })),
    bodyHead: ok.find((r) => typeof r.bodyHead === 'string')?.bodyHead ?? null,
    warmup: warmup ? { tcp: round(warmup.tcpMs), tls: round(warmup.tlsMs), origin: round(warmup.originMs), total: round(warmup.totalMs) } : null,
    shape: classifyShape(totals),
    dominant: dominantPhase({ dnsMs: series.dnsMs.p50, tcpMs: series.tcpMs.p50, tlsMs: series.tlsMs.p50, originMs: series.originMs.p50 }),
    errors,
    verdict: usable.length === 0 ? 'undetermined' : 'measured',
    reason: usable.length === 0 ? `0/${samples} 个可用样本 ⇒ 未判定(失败样本不等于低延迟):${Object.keys(errors).join(' / ') || '无错误信息'}` : null,
  }
}

// ─────────────────────────── 外部正证 ───────────────────────────

function readGhDeliveries({ runner } = {}) {
  const run = runner || ((args) => spawnSync('gh', args, { encoding: 'utf8', windowsHide: true, timeout: 20000 }))
  const res = run(['api', 'app/hook/deliveries', '--paginate'])
  if (res?.error || res?.status !== 0) {
    return { status: 'undetermined', reason: explainGhFailure(res?.stderr || res?.error?.message, res?.status), source: 'gh api app/hook/deliveries' }
  }
  try {
    const raw = JSON.parse(String(res.stdout || '').trim())
    const sum = summarizeDeliveries(raw)
    return sum.ok
      ? { status: 'ok', source: 'gh api app/hook/deliveries', ...sum }
      : { status: 'undetermined', reason: sum.reason, source: 'gh api app/hook/deliveries' }
  } catch (e) {
    return { status: 'undetermined', reason: `投递面输出不是 JSON:${e.message}`, source: 'gh api app/hook/deliveries' }
  }
}

// ─────────────────────────── CLI ───────────────────────────

export function parseArgs(argv) {
  const opts = { samples: 20, keepalive: false, targets: null, jsonPath: null, jsonOnly: false, budgetP95: null, gh: false, deliveriesPath: null, timeoutMs: 15000 }
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]
    if (a === '--samples') {
      const raw = argv[++i]
      const n = Number(raw)
      if (!Number.isInteger(n) || n < 1) return { error: `--samples 必须是 ≥1 的整数,收到 ${JSON.stringify(raw)}` }
      opts.samples = n
    }
    else if (a === '--keepalive') opts.keepalive = true
    else if (a === '--json') opts.jsonPath = argv[++i]
    else if (a === '--json-only') opts.jsonOnly = true
    else if (a === '--budget-p95-ms') opts.budgetP95 = Number(argv[++i])
    else if (a === '--gh') opts.gh = true
    else if (a === '--deliveries') opts.deliveriesPath = argv[++i]
    else if (a === '--timeout-ms') opts.timeoutMs = Math.max(1000, Number(argv[++i]) || 0)
    else if (a === '--target') {
      const v = argv[++i] || ''
      const eq = v.indexOf('=')
      if (eq <= 0) return { error: `--target 需要 id=url 形态,收到 ${JSON.stringify(v)}` }
      opts.targets = opts.targets || []
      opts.targets.push({ id: v.slice(0, eq), url: v.slice(eq + 1), leg: 'CLI 指定', role: 'CLI 指定' })
    } else if (a === '-h' || a === '--help') return { help: true }
    else return { error: `未知参数 ${a}` }
  }
  if (!Number.isFinite(opts.samples) || opts.samples < 1) return { error: '--samples 必须是 ≥1 的整数' }
  if (opts.budgetP95 !== null && !(opts.budgetP95 > 0)) return { error: '--budget-p95-ms 必须是正数' }
  return opts
}

function fmt(v) {
  return typeof v === 'number' && Number.isFinite(v) ? String(Math.round(v)) : '—'
}

/**
 * 同端点跨腿对照:两个靶的 URL 路径与查询一致、host 不同 ⇒ 差值就是"腿"的净成本。
 * 只认成对存在、且两侧都判定的情形;缺一条 ⇒ 不出这一行(不拿空值凑对照)。
 */
export function buildPairs(measured) {
  const byPath = new Map()
  for (const t of measured) {
    if (t.verdict !== 'measured') continue
    let key
    try {
      const u = new URL(t.url)
      key = u.pathname + u.search
    } catch {
      continue
    }
    if (!byPath.has(key)) byPath.set(key, [])
    byPath.get(key).push(t)
  }
  const pairs = []
  for (const [path, list] of byPath) {
    if (list.length < 2) continue
    const picked = {}
    for (const t of list) {
      if (t.id.startsWith('api')) picked.api = picked.api || t
      else if (t.id.startsWith('www')) picked.www = picked.www || t
    }
    if (!picked.api || !picked.www) continue
    const apiP50 = picked.api.phases.totalMs.p50
    const wwwP50 = picked.www.phases.totalMs.p50
    const apiOriginP50 = picked.api.phases.originMs.p50
    const wwwOriginP50 = picked.www.phases.originMs.p50
    pairs.push({
      path,
      apiId: picked.api.id,
      wwwId: picked.www.id,
      apiP50: round(apiP50),
      wwwP50: round(wwwP50),
      deltaP50: round((apiP50 ?? 0) - (wwwP50 ?? 0)),
      ratio: typeof apiP50 === 'number' && wwwP50 ? Number((apiP50 / wwwP50).toFixed(2)) : null,
      apiOriginP50: round(apiOriginP50),
      wwwOriginP50: round(wwwOriginP50),
      deltaOriginP50: round((apiOriginP50 ?? 0) - (wwwOriginP50 ?? 0)),
    })
  }
  return pairs
}

/** 从 cdn-cgi/trace 的自报体里取 colo / loc —— 边缘落哪个机房是硬事实,不靠猜。 */
export function extractColo(measured) {
  const t = measured.find((x) => x.id === 'api-trace' && typeof x.bodyHead === 'string')
  if (!t) return { status: 'undetermined', reason: '本轮没有 api-trace 靶的应答体 ⇒ 边缘机房未知' }
  const m = {}
  for (const line of t.bodyHead.split('\n')) {
    const i = line.indexOf('=')
    if (i > 0) m[line.slice(0, i).trim()] = line.slice(i + 1).trim()
  }
  if (!m.colo) return { status: 'undetermined', reason: '应答体里没有 colo 字段(可能不是 Cloudflare 边缘 ⇒ 不按 CF 口径解读)' }
  return { status: 'ok', colo: m.colo, clientIp: m.ip || null, clientLoc: m.loc || null, tls: m.tls || null, http: m.http || null }
}

function printTable(report) {
  const lines = []
  lines.push(`# 公网腿分阶段延迟 · ${report.at} · 每靶 ${report.samples} 样本 · ${report.keepalive ? 'keepalive(只量源站)' : '每条新建连接(访客口径)'}`)
  lines.push('')
  lines.push('| 靶 | 腿 | n | p50 | p95 | max | DNS p50 | TCP p50 | TLS p50 | 源站 p50 | 形态 |')
  lines.push('| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |')
  for (const t of report.targets) {
    lines.push(
      `| ${t.id} | ${t.leg} | ${t.okCount}/${t.samples} | ${fmt(t.phases.totalMs.p50)} | ${fmt(t.phases.totalMs.p95)} | ${fmt(t.phases.totalMs.max)} | ${fmt(t.phases.dnsMs.p50)} | ${fmt(t.phases.tcpMs.p50)} | ${fmt(t.phases.tlsMs.p50)} | ${fmt(t.phases.originMs.p50)} | ${t.shape.shape} |`,
    )
  }
  lines.push('')
  lines.push(`单位 ms。TCP p50 = 到边缘的 1×RTT;源站 p50 = 握手完成后到首字节(边缘→源站/隧道)。${report.keepalive ? 'keepalive 档已把第 1 条握手样本剔出分位(记在 warmup 里),故 TCP/TLS 恒空 —— 该档只读"源站处理"。' : ''}`)
  for (const t of report.targets) {
    if (t.verdict === 'undetermined') lines.push(`- **${t.id} 未判定**:${t.reason}`)
    else {
      const d = t.dominant
      const pct = typeof t.p50Share[d.phase] === 'number' ? `${t.p50Share[d.phase]}%` : '—'
      lines.push(`- ${t.id}:主导段 = ${PHASE_LABEL[d.phase] || d.phase} p50=${fmt(d.ms)}ms(${pct} 总时长)${d.reason ? ';' + d.reason : ''};形态 ${t.shape.shape}(${t.shape.reason})`)
    }
  }
  const ext = report.externalEvidence
  lines.push('')
  for (const p of report.pairs || []) {
    lines.push(`- 同端点跨腿(${p.path}):api p50=${fmt(p.apiP50)}ms / www p50=${fmt(p.wwwP50)}ms ⇒ api 多 ${fmt(p.deltaP50)}ms(${p.ratio}×);源站段 api ${fmt(p.apiOriginP50)}ms / www ${fmt(p.wwwOriginP50)}ms ⇒ 隧道净增 ${fmt(p.deltaOriginP50)}ms`)
  }
  if (report.pairs?.length) lines.push('')
  lines.push(
    report.edge?.status === 'ok'
      ? `- 边缘机房(api 腿自报 colo):${report.edge.colo} · 本机落地 ${report.edge.clientIp || '—'}(${report.edge.clientLoc || '—'})· ${report.edge.tls || ''} —— 边缘离访客越远,每条新连接的握手成本越高`
      : `- 边缘机房:**undetermined** — ${report.edge?.reason || '未取'}`,
  )
  lines.push(
    ext.status === 'ok'
      ? `- 外部正证(GitHub 投递):n=${ext.n} p50=${fmt(ext.p50)}ms p95=${fmt(ext.p95)}ms max=${fmt(ext.max)}ms,窗口 ${ext.window?.from || '—'} → ${ext.window?.to || '—'},<500ms ${ext.under500} 条 / ≥2000ms ${ext.over2000} 条`
      : `- 外部正证(GitHub 投递):**undetermined** — ${ext.reason}(本机分阶段读数照出,但不得据此判"腿坏")`,
  )
  return lines.join('\n')
}

export async function main(argv, deps = {}) {
  const opts = parseArgs(argv)
  if (opts.error) {
    console.log(`用法错:${opts.error}`)
    return 2
  }
  if (opts.help) {
    console.log('node scripts/measure-leg-latency.mjs [--samples N] [--keepalive] [--json out] [--json-only] [--budget-p95-ms MS] [--gh] [--deliveries file] [--target id=url]')
    return 0
  }
  const targets = opts.targets || DEFAULT_TARGETS
  const measured = []
  for (const t of targets) measured.push(await (deps.measureTarget || measureTarget)(t, opts))

  let externalEvidence = { status: 'undetermined', reason: '本轮未取外部投递读数(未给 --gh / --deliveries)' }
  if (opts.deliveriesPath) {
    try {
      const { readFileSync } = await import('node:fs')
      const sum = summarizeDeliveries(JSON.parse(readFileSync(opts.deliveriesPath, 'utf8')))
      externalEvidence = sum.ok
        ? { status: 'ok', source: `file:${opts.deliveriesPath}`, ...sum }
        : { status: 'undetermined', reason: sum.reason, source: `file:${opts.deliveriesPath}` }
    } catch (e) {
      externalEvidence = { status: 'undetermined', reason: `投递读数文件读不到/不是 JSON:${e.message}`, source: `file:${opts.deliveriesPath}` }
    }
  } else if (opts.gh) {
    externalEvidence = (deps.readGhDeliveries || readGhDeliveries)()
  }

  const breached = measured.filter((t) => t.verdict === 'measured' && typeof t.phases.totalMs.p95 === 'number' && opts.budgetP95 !== null && t.phases.totalMs.p95 > opts.budgetP95)
  const undetermined = measured.filter((t) => t.verdict === 'undetermined')
  const rc = undetermined.length > 0 ? 3 : breached.length > 0 ? 1 : 0
  const report = {
    schema: SCHEMA,
    at: new Date().toISOString(),
    samples: opts.samples,
    keepalive: opts.keepalive,
    budgetP95Ms: opts.budgetP95,
    targets: measured,
    pairs: buildPairs(measured),
    edge: extractColo(measured),
    externalEvidence,
    exitCode: rc,
    verdict: undetermined.length > 0 ? 'undetermined' : breached.length > 0 ? 'over-budget' : 'within-budget',
  }
  if (opts.jsonPath) writeFileSync(opts.jsonPath, JSON.stringify(report, null, 2))
  if (opts.jsonOnly) console.log(JSON.stringify(report))
  else {
    console.log(printTable(report))
    console.log('')
    console.log(`退出码 ${rc}${rc === 3 ? '(至少一个靶未判定 —— 不得读成健康)' : rc === 1 ? '(p95 越阈)' : '(已判定且未越阈)'}`)
  }
  return rc
}

export const __test__ = { percentile, derivePhases, describeSeries, classifyShape, dominantPhase, summarizeDeliveries, explainGhFailure, parseArgs, printTable, buildPairs, extractColo }

const isDirectRun = Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main(process.argv.slice(2)).then((rc) => process.exit(rc)).catch((e) => {
    console.error(`本尺子自身异常:${e?.stack || e}`)
    process.exit(2)
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
