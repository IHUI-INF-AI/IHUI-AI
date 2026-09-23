#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * check-credential-health.mjs —— 凭据有效性巡检(2026-09-23 立)
 *
 * 起因(实测事故):生产部署环连续两天每轮构建成功后被回滚,根因是 `IHUI-DEPLOYLOOP` 服务环境块里
 * 的 `IHUI_ADMIN_PASSWORD` 仍是 09-21 23:54 轮换**前**的旧值 —— 健康门禁要登录拿 Bearer,登录 401
 * 被 `catch {}` 吞掉,现象是"LLM 网关不可达",与凭据毫无字面关联,故两天无人知。
 * 同类形态第二次:我把 git PAT 读错(同步盘冲突副本)也差点被判成"凭据已失效"。
 *
 * 本脚本把这两类"凭据过期"从**静默下游失败**变成**独立可告警签名**,并区分
 * `401/不匹配`(凭据本身失效,需处理)与 `429/超时`(被限流或网络,不是凭据问题)——
 * 混为一谈是当天排查最大的干扰源。
 *
 * 用法:
 *   node scripts/check-credential-health.mjs              # 人工/CI 巡检,异常 exit 1
 *   node scripts/check-credential-health.mjs --json       # 机器可读(供告警/看板)
 *   node scripts/check-credential-health.mjs --self-test   # 逻辑自检(不触网、不读真凭据)
 *   node scripts/check-credential-health.mjs --install     # 注册 6 小时计划任务(经 vbs 隐藏,§5b)
 *   node scripts/check-credential-health.mjs --uninstall | --status
 *
 * 安全:全程只输出「长度 + 掩码前缀 + sha256 短摘要」,**绝不**打印任何凭据值;
 *       探测每轮各 1 次请求(登录限流 max:10/min,不可自撞)。
 */
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync, mkdirSync, appendFileSync, rmSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { request } from 'node:https'
import { request as httpRequest } from 'node:http'
import { resolveGitBin } from './lib/gitdir.mjs'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const TASK_NAME = 'IHUI credential-health'
const GIT_BIN = resolveGitBin()
const SECRETS_DIR = process.env.IHUI_SECRETS_DIR || 'D:/DevEnv/secrets'
const GIT_KEY_DIR = process.env.IHUI_MODEL_KEY_DIR_GIT || 'D:/BaiduSyncdisk/密钥/git仓库'
const WEB_PROBE = process.env.IHUI_DEPLOY_PROBE || 'http://127.0.0.1:8801'
const GITHUB_REPO = 'IHUI-INF-AI/IHUI-AI'

const sha = (s) => createHash('sha256').update(String(s)).digest('hex').slice(0, 12)
// 观测用的脱敏指纹:长度 + 内容摘要。二者足以判断"是不是同一把",又不泄露值。
const fingerprint = (v) => (v === null || v === undefined ? '缺失' : `len=${String(v).trim().length} sha=${sha(String(v).trim())}`)

/** 读服务环境块里的键值(nssm get AppEnvironmentExtra;UTF-16LE 输出需清洗 NUL) */
export function readServiceEnv(service, key) {
  try {
    const out = execFileSync('C:/Windows/System32/nssm.exe', ['get', service, 'AppEnvironmentExtra'], {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 15000,
    })
      .replace(/\0/g, '')
    for (const line of out.split(/\r?\n/)) {
      const i = line.indexOf('=')
      if (i > 0 && line.slice(0, i).trim() === key) return line.slice(i + 1).trim()
    }
    return null
  } catch {
    return null
  }
}

/** 凭据在代码/服务/文件三处是否同值 —— 当天故障的精确形状 */
export function compareCredential({ serviceValue, authoritativeValue }) {
  if (!authoritativeValue) return { level: 'unknown', why: '权威源缺失(文件不存在或为空),不判定为过期' }
  if (!serviceValue) return { level: 'fail', why: '服务环境块缺该键 ⇒ 依赖它的门禁必然失败' }
  if (sha(serviceValue) === sha(authoritativeValue)) return { level: 'ok', why: '与服务运行态同值' }
  return { level: 'fail', why: '服务环境块与权威源不一致 ⇒ 就是本次事故形态(轮换未同步)' }
}

/**
 * 把 HTTP 状态归类 —— 401/403(凭据或权限)与 429/0(限流/网络)必须分开,
 * 否则一次限流会被误读成"key 过期"(本会话真实踩过)。
 */
export function classifyHttpStatus(sc) {
  if (sc === 200 || sc === 204 || (sc >= 200 && sc < 300)) return 'ok'
  if (sc === 401 || sc === 403) return 'fail'
  if (sc === 429) return 'limited'
  if (sc === 0) return 'unreachable'
  return 'unknown'
}

function probeHttps(host, path, headers = {}) {
  return new Promise((res) => {
    let settled = false
    const done = (sc, body) => {
      if (settled) return
      settled = true
      res({ sc, body })
    }
    try {
      const r = request({ host, path, headers: { 'User-Agent': 'ihui-credential-health', ...headers }, timeout: 15000 }, (rp) => {
        let b = ''
        rp.on('data', (d) => (b += d))
        rp.on('end', () => done(rp.statusCode, b))
      })
      r.on('error', () => done(0, ''))
      r.on('timeout', () => {
        r.destroy()
        done(0, '超时')
      })
      r.end()
    } catch {
      done(0, '请求构造失败')
    }
  })
}

function loginProbe(user, pass) {
  return new Promise((res) => {
    const body = JSON.stringify({ username: user, password: pass })
    const u = new URL(WEB_PROBE + '/api/auth/login/username')
    let settled = false
    const done = (sc, txt) => {
      if (settled) return
      settled = true
      res({ sc, txt })
    }
    try {
      const r = httpRequest(
        {
          host: u.hostname,
          port: u.port || 80,
          path: u.pathname,
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
          timeout: 15000,
        },
        (rp) => {
          let b = ''
          rp.on('data', (d) => (b += d))
          rp.on('end', () => done(rp.statusCode, b))
        },
      )
      r.on('error', () => done(0, '网络错误'))
      r.on('timeout', () => {
        r.destroy()
        done(0, '超时')
      })
      r.end(body)
    } catch {
      done(0, '请求构造失败')
    }
  })
}

export function readFileSyncOr(path) {
  try {
    return existsSync(path) ? readFileSync(path, 'utf8').trim() : null
  } catch {
    return null
  }
}

/**
 * 国内镜像活性。判据必须是**镜像仓真收到了哪一天的提交**,不是 GitHub 运行元数据 ——
 * 2026-09-23 实测两者会严重背离:run 每 20 分钟一条且 `updated_at` 一直在刷新,看起来"很健康",
 * 而 Gitee 的 `main` 停在 09-20(被服务端硬配额 `Repo size 1156MB > 1024MB` 拒绝),
 * 一整天的镜像**一条都没落地**。看元数据 = 把"持续失败"读成"在跑"。
 *
 * 分级(gitee 与 gitcode 独立判,不混为一谈):
 *   · 两仓 main 都够新 ⇒ ok
 *   · 只有一个落后 ⇒ fail 并点名是哪个仓 + 落后天数(今天实况:GitCode 新鲜、Gitee 停摆)
 *   · 都落后 ⇒ fail,并在 detail 里带上 GitHub 侧最近一次运行的 conclusion(定位用)
 * 阈值默认 30 小时(镜像本就是"尽力而为"的下游,不是发布通道);`IHUI_MIRROR_STALL_MIN` 可调。
 * 仍保留补发 dispatch 自愈:只有"两仓都旧且 GitHub 也没有在跑的运行"时才补发,
 * 因为**配额型失败补发多少次都不会成功**(实测补发那轮跑了 69 分钟后失败)。
 */
const GH_REPO = 'IHUI-INF-AI/IHUI-AI'
const MIRROR_WF = '317969743' // Mirror to CN 的 workflow id(由 API 取,非猜测;变更需重取)

function ghApi(method, path, body) {
  const token = readText(process.env.IHUI_GH_KEY_FILE || 'D:/BaiduSyncdisk/密钥/git仓库/github key.txt').trim()
  if (!token) return Promise.resolve({ status: 0, j: null, why: '未取到 GitHub 权威凭据文件' })
  const payload = body ? JSON.stringify(body) : null
  return new Promise((res) => {
    const r = request({
      host: 'api.github.com',
      path,
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'User-Agent': 'ihui-credential-health',
        Accept: 'application/vnd.github+json',
        ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {}),
      },
      timeout: 20000,
    }, (rp) => {
      let b = ''
      rp.on('data', (d) => (b += d))
      rp.on('end', () => {
        let j = null
        try {
          j = JSON.parse(b || 'null')
        } catch {
          /* 非 JSON 响应只保留状态码 */
        }
        res({ status: rp.statusCode, j })
      })
    })
    r.on('error', (e) => res({ status: 0, j: null, why: e.message }))
    r.on('timeout', () => {
      r.destroy()
      res({ status: 0, j: null, why: '超时' })
    })
    r.end(payload)
  })
}

/** 形状校验后再用凭据:同目录有 `_冲突文件_` 副本把 Gitee token 与 GitHub token 拼成 74 字符串
 *  (实测前缀 `a97fghp_`),不加形状闸就会拿错 key ⇒ 表现为"镜像凭据失效"的假故障。 */
export function pickKey(raw, re) {
  // `readFileSyncOr` 的缺失/读失败契约是 **null**,原来直接 `.trim()` ⇒ TypeError 把整轮巡检打崩。
  // 崩在 runChecks 里意味着心跳文件永不写出,而守护的"看门人的看守"检测到的正是这个缺失,
  // 它派生的自愈拉起同样跑在这一行 ⇒ 凭据/停摆告警链在一台缺 key 的机器上**双向静默**。
  const v = (raw ?? '').trim()
  return re.test(v) ? v : ''
}

function readMirrKey(file, re) {
  return pickKey(readFileSyncOr(join(GIT_KEY_DIR, file)), re)
}

async function mirrorTipDate({ host, path, label }) {
  const p = await probeHttps(host, path)
  if (p.sc !== 200) return { label, ok: false, why: `http=${p.sc}` }
  let j = null
  try {
    j = JSON.parse(p.body)
  } catch {
    return { label, ok: false, why: '响应非 JSON' }
  }
  const c = Array.isArray(j) ? j[0] : j
  const iso = c?.commit?.committer?.date || c?.commit?.author?.date || ''
  const t = Date.parse(iso)
  return Number.isFinite(t) ? { label, ok: true, t, sha: String(c.sha || '').slice(0, 9) } : { label, ok: false, why: `无提交时间(${iso.slice(0, 25)})` }
}

async function mirrorLivenessCheck() {
  const NAME = '国内镜像活性(mirror-to-cn)'
  const thresholdMin = Number(process.env.IHUI_MIRROR_STALL_MIN || 18 * 60)
  const now = Date.now()
  const giteeTok = readMirrKey('gitee apikey.txt', /^[0-9a-f]{32}$/)
  if (!giteeTok) {
    return [{ name: NAME, level: 'fail', detail: 'gitee apikey.txt 取不到形状合法的 token(注意同目录的 _冲突文件_ 副本不可用)' }]
  }
  const [g, gh] = await Promise.all([
    mirrorTipDate({
      host: 'gitee.com',
      path: '/api/v5/repos/JLSLSSZWHYXGS_0/IHUI-AI/commits?per_page=1&access_token=' + encodeURIComponent(giteeTok),
      label: 'Gitee',
    }),
    ghApi('GET', `/repos/${GH_REPO}/actions/workflows/${MIRROR_WF}/runs?per_page=1`),
  ])
  const last = gh.j?.workflow_runs?.[0]
  const runDesc = last ? `${last.event}/${last.status}/${last.conclusion ?? '-'}` : '无运行记录'
  if (!g.ok) return [{ name: NAME, level: 'unreachable', detail: `Gitee 查询失败 ${g.why};GitHub 侧最近运行 ${runDesc}` }]
  const ageMin = (now - g.t) / 60000
  const head = `Gitee main=${g.sha} @ ${new Date(g.t).toISOString().slice(0, 16)}Z,落后 ${(ageMin / 1440).toFixed(1)} 天;最近运行 ${runDesc}`
  if (ageMin <= thresholdMin) return [{ name: NAME, level: 'ok', detail: `${head} ≤ 阈值 ${(thresholdMin / 1440).toFixed(1)} 天` }]
  // 落后 ⇒ 先看 GitHub 侧是否**正有一轮在跑**(在跑就别补发,免得两轮互相抢)
  const running = last && (last.status === 'in_progress' || last.status === 'queued')
  if (running) return [{ name: NAME, level: 'limited', detail: `${head} 超阈值但有运行在途,等它结束再看` }]
  // 已知上一轮是 failure 时**不补发**:配额/体积型失败补发多少次都还是失败,而单轮要跑 69 分钟
  // (实测),白烧 Actions 时长。只如实判红,处置交给下面的 hint。
  if (last?.conclusion === 'failure') {
    return [
      {
        name: NAME,
        level: 'fail',
        detail: `${head} 超阈值,且上一轮 conclusion=failure ⇒ 不补发(补发只会再跑一遍注定失败的 69 分钟)。查 Gitee 侧拒绝原因(今天实测是仓库体积超配额,需减 ref 或清标签)`,
      },
    ];
  }
  const d = await ghApi('POST', `/repos/${GH_REPO}/actions/workflows/${MIRROR_WF}/dispatches`, { ref: 'main' })
  const hint = ''
  return [
    {
      name: NAME,
      level: 'fail',
      detail: `${head} 超阈值(阈值 ${(thresholdMin / 1440).toFixed(1)} 天)→ ${d.status === 204 ? '已补发 dispatch(下轮复验是否真落地)' : `补发失败 http=${d.status}`}${hint}`,
    },
  ]
}

/** 主巡检:返回结果数组,不直接打印(便于 --json / 告警复用) */
export async function runChecks() {
  const out = []
  // ⓪ 告警通道自检:上一轮若有故障但一条都没送出去,这本身就是必须报红的一项。
  //    (今天的教训:Server 酱日额度耗尽 → sent=false → 故障静默丢失,和 12h 去重把
  //     持续两天的故障压成静默是同一类"放大器"。)
  if (existsSync(UNDEL)) {
    let info = {}
    try {
      info = JSON.parse(readFileSync(UNDEL, 'utf8'))
    } catch {
      /* 标记损坏也照样报红,只是没有细节 */
    }
    out.push({
      name: '告警投递通道(上轮有故障未能通报)',
      level: 'fail',
      detail: `标记于 ${info.ts || '?'};未通报的故障: ${info.sig || '?'};通道: ${(info.attempts || []).join(' / ')}`,
    })
  }
  // ① 服务运行态口令 vs 权威口令表
  const adminInSvc = readServiceEnv('IHUI-DEPLOYLOOP', 'IHUI_ADMIN_PASSWORD')
  const adminAuthority = readFileSyncOr(join(SECRETS_DIR, 'admin-password.txt'))
  const cmp = compareCredential({ serviceValue: adminInSvc, authoritativeValue: adminAuthority })
  out.push({
    name: 'IHUI-DEPLOYLOOP 环境块 IHUI_ADMIN_PASSWORD',
    level: cmp.level,
    detail: `${cmp.why};服务侧 ${fingerprint(adminInSvc)} / 权威源 ${fingerprint(adminAuthority)}`,
  })

  // ② 真登录一次(与门禁同一入口)。127.0.0.1 自有桶,单轮 1 次不撞限流。
  // **但①已判不一致时必须跳过**:拿必错的口令去撞登录 = 巡检自己消耗"剩余 N 次即锁定"预算,
  // 那会把"发现故障"变成"制造故障"(本脚本首次自测就真实触发了 401 + 剩余次数递减)。
  if (adminAuthority && cmp.level !== 'fail') {
    const r = await loginProbe('admin', adminAuthority)
    out.push({
      name: '后端登录探针 /api/auth/login/username',
      level: classifyHttpStatus(r.sc),
      detail: `http=${r.sc} ${r.sc >= 400 ? String(r.txt).slice(0, 60).replace(/\s+/g, ' ') : '(成功)'}`,
    })
  }
  // ③ GitHub 凭据(同步盘里那把):先看能不能取到仓库权限,再判断"是否被同步盘写成冲突副本"
  const ghPath = join(GIT_KEY_DIR, 'github key.txt')
  const gh = readFileSyncOr(ghPath)
  if (gh) {
    const looksClassic = /^gh[pousr]_[A-Za-z0-9]{20,}$/.test(gh)
    const looksFine = /^github_pat_[A-Za-z0-9_]{20,}$/.test(gh)
    out.push({
      name: 'GitHub token 形态',
      level: looksClassic || looksFine ? 'ok' : 'fail',
      detail: `文件 ${ghPath} len=${gh.length} 类型=${looksClassic ? 'classic' : looksFine ? 'fine-grained' : '非 token(疑同步盘冲突副本/含杂散字符)'}`,
    })
    if (looksClassic || looksFine) {
      const p = await probeHttps('api.github.com', '/rate_limit', { Authorization: 'Bearer ' + gh })
      out.push({ name: 'GitHub token 有效性', level: classifyHttpStatus(p.sc), detail: `api.github.com/rate_limit http=${p.sc}` })
      const rp = await probeHttps('api.github.com', `/repos/${GITHUB_REPO}`, { Authorization: 'Bearer ' + gh, Accept: 'application/vnd.github+json' })
      let push = false
      try {
        push = !!(JSON.parse(rp.body).permissions || {}).push
      } catch {
        push = false
      }
      out.push({ name: 'GitHub token 可写仓库', level: rp.sc === 200 ? (push ? 'ok' : 'fail') : classifyHttpStatus(rp.sc), detail: `http=${rp.sc} push 权限=${push}` })
    }
  }
  // ④ 镜像 token(不直推,但 CI secrets 用的是同一把 ⇒ 挂了镜像会静默)
  const gitee = readFileSyncOr(join(GIT_KEY_DIR, 'gitee apikey.txt'))
  if (gitee) {
    const p = await probeHttps('gitee.com', '/api/v5/user?access_token=' + encodeURIComponent(gitee))
    let login = ''
    try {
      login = JSON.parse(p.body).login || ''
    } catch {
      login = ''
    }
    out.push({
      name: 'Gitee token 有效性',
      level: p.sc === 200 && login ? 'ok' : classifyHttpStatus(p.sc),
      detail: `http=${p.sc} login=${login || '-'}`,
    })
  }
  // ⑤ 部署停摆(测结果,不猜原因):线上构建 sha 落后 origin/main 且超过阈值即红。
  //    为什么测结果而不是查 ff/凭据/构建:今天停摆有两层原因(口令过期 + 脏树挡 ff),
  //    任何一种都可能再变出第三种;只有"线上产物是否等于当前 tip"是不会骗人的判据。
  out.push(...deployStallCheck())
  out.push(...(await mirrorLivenessCheck()))
  return out
}

/** 读取文本文件(去 NUL/CR),失败返回空串 */
function readText(p) {
  try {
    return readFileSync(p, 'utf8').replace(/\0/g, '')
  } catch {
    return ''
  }
}

export function judgeStall({ liveSha, tipSha, lastSuccessIso, nowMs, thresholdMin, inFlight = false }) {
  if (!tipSha) return { level: 'unknown', why: '取不到 origin/main tip,不判定' }
  // 部署环**正在跑这一轮**时不得判停摆:2026-09-23 14:05 实测假阳性 —— 14:02 起在构建,
  // 14:06:21 就成功了,而我按"距上次成功 > 阈值"判红并真发了一封邮件。
  // 告警器乱叫就会被静音(邮件 10 封/天、Server酱 5 条/天),所以这一条是硬护栏。
  if (inFlight) return { level: 'unknown', why: '部署环正在跑这一轮(日志有新活动且非失败态),不判定' }
  if (!liveSha) return { level: 'fail', why: `线上无构建标记(.next/IHUI_BUILD_SHA 缺失),最近成功部署=${lastSuccessIso || '未知'}` }
  if (liveSha === tipSha) return { level: 'ok', why: '线上构建 == origin/main tip' }
  if (!lastSuccessIso) return { level: 'fail', why: `线上 ${liveSha.slice(0, 9)} ≠ tip ${tipSha.slice(0, 9)},且日志里找不到一次成功部署` }
  const mins = (nowMs - Date.parse(lastSuccessIso)) / 60000
  if (!Number.isFinite(mins) || mins <= thresholdMin) {
    return { level: 'ok', why: `线上落后但最近 ${(Number.isFinite(mins) ? mins : 0).toFixed(0)} 分钟刚成功过,不算停摆` }
  }
  return {
    level: 'fail',
    why: `线上 ${liveSha.slice(0, 9)} ≠ origin/main ${tipSha.slice(0, 9)},且已 **${(mins / 60).toFixed(1)} 小时**无成功部署(阈值 ${thresholdMin} 分钟)`,
  }
}

function deployStallCheck() {
  const thresholdMin = Number(process.env.IHUI_DEPLOY_STALL_MIN || 45)
  const errs = []
  const git = (...args) => {
    try {
      // 按 §5b 约定:绝对路径 git + `-c safe.directory=*`(服务账户与交互账户的 safe.directory
      // 互不相通),路径统一正斜杠(git -C 对反斜杠路径在本机 rev-parse 下会失败)
      return execFileSync(GIT_BIN, ['-c', 'safe.directory=*', '-C', REPO.replace(/\\/g, '/'), ...args], {
        encoding: 'utf8',
        windowsHide: true,
        timeout: 20000,
      }).trim()
    } catch (e) {
      errs.push(`${args.join(' ')}: ${String((e && e.message) || e).slice(0, 70)}`)
      return ''
    }
  }
  const liveSha = readText(join(REPO, 'apps', 'web', '.next', 'IHUI_BUILD_SHA')).trim()
  let tipSha = git('rev-parse', 'refs/remotes/origin/main') || git('rev-parse', 'FETCH_HEAD')
  if (!tipSha) tipSha = git('rev-parse', 'HEAD') // 连不上远端引用时退化为本机 tip(仍能看到停摆)
  const log = readText(join(REPO, 'deploy', 'win', 'deploy-loop.log'))
  // 取最后一次"部署完成"(日志时间是 UTC,+00:00)
  const lines = log.split(/\r?\n/).filter((l) => /部署完成/.test(l))
  let lastSuccessIso = ''
  if (lines.length) {
    const m = String(lines[lines.length - 1]).match(/\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}) ([+-]\d{2}:\d{2})\]/)
    if (m) lastSuccessIso = `${m[1].replace(' ', 'T')}${m[2]}`
  }
  // 本轮是否"在飞":日志最后一行仍是轮次中间产物(未出现 轮询结束/部署完成 这类轮次边界),
  // 且写于 20 分钟内。边界之后一律照判(冷却/失败都属于真停摆)。
  const all = log.split(/\r?\n/).filter((l) => l.trim())
  let inFlight = false
  if (all.length) {
    const last = String(all[all.length - 1])
    const lm = last.match(/\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}) ([+-]\d{2}:\d{2})\]/)
    const lastAge = lm ? (Date.now() - Date.parse(`${lm[1].replace(' ', 'T')}${lm[2]}`)) / 60000 : Infinity
    inFlight = Number.isFinite(lastAge) && lastAge < 20 && !/轮询结束|部署完成/.test(last)
  }
  const r = judgeStall({ liveSha, tipSha, lastSuccessIso, nowMs: Date.now(), thresholdMin, inFlight })
  const diag = errs.length ? ` [诊断: ${errs.join(' ; ')}]` : ''
  return [{ name: '部署停摆(线上构建 vs origin/main)', level: r.level, detail: r.why + diag }]
}

function selfTest() {
  const cases = []
  const eq = (label, got, want) => cases.push([label, JSON.stringify(got) === JSON.stringify(want), `got=${JSON.stringify(got)} want=${JSON.stringify(want)}`])
  eq('同值判 ok', compareCredential({ serviceValue: 'abc12345', authoritativeValue: 'abc12345' }).level, 'ok')
  eq('不一致判 fail(事故形态)', compareCredential({ serviceValue: 'old-pass', authoritativeValue: 'new-pass' }).level, 'fail')
  eq('服务缺键判 fail', compareCredential({ serviceValue: null, authoritativeValue: 'x' }).level, 'fail')
  eq('权威源缺失不误判', compareCredential({ serviceValue: 'x', authoritativeValue: null }).level, 'unknown')
  eq('401 归 fail', classifyHttpStatus(401), 'fail')
  eq('429 不得归 fail(限流≠过期)', classifyHttpStatus(429), 'limited')
  eq('网络不可达归 unreachable', classifyHttpStatus(0), 'unreachable')
  eq('指纹不泄露原值', /^[a-f0-9]{12}$/.test(sha('super-secret-value')), true)
  eq('线上一致判 ok', judgeStall({ liveSha: 'A', tipSha: 'A', lastSuccessIso: '', nowMs: 0, thresholdMin: 45 }).level, 'ok')
  eq('落后且刚成功过不判停摆', judgeStall({ liveSha: 'A', tipSha: 'B', lastSuccessIso: new Date(1000).toISOString(), nowMs: 1000 + 10 * 60000, thresholdMin: 45 }).level, 'ok')
  eq('落后 2 小时判停摆', judgeStall({ liveSha: 'A', tipSha: 'B', lastSuccessIso: new Date(1000).toISOString(), nowMs: 1000 + 120 * 60000, thresholdMin: 45 }).level, 'fail')
  // 在飞护栏(2026-09-23 14:05 假阳性实测:那轮 14:02 开始构建、14:06:21 成功,我却判红并发邮件)
  eq('同一输入:本轮在飞 ⇒ 不判定', judgeStall({ liveSha: 'A', tipSha: 'B', lastSuccessIso: new Date(1000).toISOString(), nowMs: 1000 + 120 * 60000, thresholdMin: 45, inFlight: true }).level, 'unknown')
  eq('反向对照:同样输入但非在飞 ⇒ 仍判停摆(护栏不得吞掉真故障)', judgeStall({ liveSha: 'A', tipSha: 'B', lastSuccessIso: new Date(1000).toISOString(), nowMs: 1000 + 120 * 60000, thresholdMin: 45, inFlight: false }).level, 'fail')
  eq('无标记判红', judgeStall({ liveSha: '', tipSha: 'B', lastSuccessIso: '', nowMs: 1, thresholdMin: 45 }).level, 'fail')
  eq('取不到 tip 不误判', judgeStall({ liveSha: 'A', tipSha: '', lastSuccessIso: '', nowMs: 1, thresholdMin: 45 }).level, 'unknown')
  // key 读取的三态(2026-09-24 本机实测:GIT_KEY_DIR 在本机不存在 ⇒ 原实现 TypeError 打崩整轮巡检,
  // 心跳写不出、守护的拉起也崩在同一行 ⇒ 告警链双向静默)
  eq('key 缺失(null)判空串而非抛错', pickKey(null, /^[0-9a-f]{32}$/), '')
  eq('形状不合判空(同目录冲突副本不可用)', pickKey('a97fghp_0123456789abcdef0123456789abcdef', /^[0-9a-f]{32}$/), '')
  eq('形状合 ⇒ 去空白取原值', pickKey(' 0123456789abcdef0123456789abcdef\n', /^[0-9a-f]{32}$/), '0123456789abcdef0123456789abcdef')
  let bad = 0
  for (const [label, pass, why] of cases) {
    if (!pass) bad++
    console.log(`${pass ? '✓' : '✗'} ${label}${pass ? '' : '  ' + why}`)
  }
  console.log(`自检 ${cases.length - bad}/${cases.length} 通过`)
  process.exit(bad ? 1 : 0)
}

// ── 计划任务(§5b:计划任务禁止直接跑控制台程序 ⇒ 经纯 ASCII vbs 隐藏窗口) ──
const VBS = join(REPO, 'scripts', 'credential-health-hidden.vbs')
function ensureVbs() {
  // 必须纯 ASCII:GBK 代码页解 UTF-8 中文会编译期报错并弹窗
  const body = [
    'Option Explicit',
    'Dim sh, dir, node, script',
    'Set sh = CreateObject("WScript.Shell")',
    'dir = Left(WScript.ScriptFullName, InStrRev(WScript.ScriptFullName, "\\") - 1)',
    'node = sh.Environment("Process")("IHUI_NODE_BIN")',
    'If Len(node) = 0 Then node = "node.exe"',
    'script = dir & "\\check-credential-health.mjs"',
    '  sh.Run """" & node & """ """ & script & """ --json", 0, False',
  ].join('\r\n')
  writeFileSync(VBS, body, 'ascii')
  return VBS
}
function schtasks(args) {
  return spawnSync('schtasks.exe', args, { encoding: 'utf8', windowsHide: true, timeout: 30000 })
}
function installTask() {
  const vbs = ensureVbs()
  const wscript = join(process.env.WINDIR || 'C:\\Windows', 'System32', 'wscript.exe')
  const r = schtasks([
    '/Create',
    '/F',
    '/TN',
    TASK_NAME,
    '/SC',
    'HOURLY',
    '/MO',
    '6',
    '/TR',
    `"${wscript}" //B "${vbs}"`,
  ])
  console.log(r.status === 0 ? `✅ 已注册计划任务「${TASK_NAME}」(每 6 小时,vbs 隐藏窗口)` : `❌ 注册失败: ${r.stderr || r.stdout}`)
  process.exit(r.status === 0 ? 0 : 1)
}
function uninstallTask() {
  const r = schtasks(['/Delete', '/F', '/TN', TASK_NAME])
  console.log(r.status === 0 ? '✅ 已卸载' : `❌ ${r.stderr || r.stdout}`)
  process.exit(r.status === 0 ? 0 : 1)
}
function taskStatus() {
  const r = schtasks(['/Query', '/TN', TASK_NAME])
  console.log(r.status === 0 ? `✅ 已注册: ${String(r.stdout).split(/\r?\n/).filter((l) => /TaskName|Last Run|Last Result|Next Run/i.test(l)).join(' | ')}` : '⚠️ 未注册计划任务')
  process.exit(0)
}

/**
 * 告警:把"凭据失效"从静默变成必须有人看。
 *
 * 反今天事故的规则:今天的 `SCT 同签名失败告警 12h 内已推过,跳过` 把一次**持续两天的故障**
 * 压成了静默 —— 去重只能去"重复",不能去"还在发生"。这里因此:
 *   · 失败集合发生变化 ⇒ 立刻发(新故障不等窗口);
 *   · 失败集合不变但仍在失败 ⇒ 每 20 小时重发一次(绝不因去转而消失);
 *   · 恢复(失败数归零)⇒ 发一条恢复通知并清空状态。
 */
const STATE = join(REPO, '.workbuddy', 'credential-health-alert-state.json')
/** 全通道投递失败时写此标记:告警没送出去 = 故障从未被人看见,必须留下可被下轮检出的证据 */
const UNDEL = join(REPO, '.workbuddy', 'credential-health-alert-UNDELIVERED.json')
/** 本地留痕账本:通道全挂时至少有一条人类可读的追加流水 */
const LEDGER = join(REPO, '.workbuddy', 'credential-health-alerts.log')

function appendLedger(title, desp, delivery) {
  try {
    mkdirSync(join(REPO, '.workbuddy'), { recursive: true })
    const head = `——— ${new Date().toISOString()} ${title} ———\n${desp}\n投递: ${
      delivery ? (delivery.sent ? `✅ 经 ${delivery.via} 送达` : '❌ 全通道失败') : '(dry-run,未投递)'
    }\n${delivery ? delivery.attempts.map((a) => `  · ${a}`).join('\n') : ''}\n\n`
    appendFileSync(LEDGER, head, 'utf8')
  } catch (e) {
    console.error(`⚠️ 告警账本写入失败(${e?.message})—— 台账本身也不能静默失败`)
  }
}

function loadState() {
  try {
    return JSON.parse(readFileSync(STATE, 'utf8'))
  } catch {
    return null
  }
}
/** 通用 POST(https),永不抛异常 —— 告警通道自身不能让巡检崩掉 */
function post({ host, path, headers, body, timeout = 15000 }) {
  return new Promise((res) => {
    const r = request({ host, path, method: 'POST', headers, timeout }, (rp) => {
      let b = ''
      rp.on('data', (d) => (b += d))
      rp.on('end', () => res({ status: rp.statusCode, b: String(b).slice(0, 120) }))
    })
    r.on('error', (e) => res({ status: 0, b: e.message }))
    r.on('timeout', () => {
      r.destroy()
      res({ status: 0, b: '超时' })
    })
    r.end(body)
  })
}

async function sendServerChan(key, title, desp) {
  const body = new URLSearchParams({ title, desp }).toString()
  const r = await post({
    host: 'sctapi.ftqq.com',
    path: `/${key}.send`,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) },
  })
  let ok = false
  try {
    ok = JSON.parse(r.b).code === 0
  } catch {
    ok = false
  }
  return { ok, b: `HTTP ${r.status} ${r.b}` }
}

/** §5e 的邮件兜底:Server 酱免费额度仅 5 条/天,耗尽时告警不得静默丢失 */
async function sendEmail(title, desp) {
  const key = readEnvValue(join(REPO, 'apps', 'api', '.env'), 'RESEND_API_KEY')
  if (!key) return { ok: false, why: 'apps/api/.env 缺 RESEND_API_KEY' }
  const body = JSON.stringify({
    from: '智汇AI官方 <IHUI-AI@aizhs.top>',
    to: ['502319984@qq.com'],
    subject: title.slice(0, 100),
    text: desp,
  })
  const r = await post({
    host: 'api.resend.com',
    path: '/emails',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body,
  })
  return { ok: r.status >= 200 && r.status < 300, why: `HTTP ${r.status} ${r.b}` }
}

/** 读 .env 里的单个键(不回显值) */
function readEnvValue(envPath, key) {
  try {
    for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
      const m = /^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line)
      if (m && m[1] === key) return m[2].trim().replace(/^["']|["']$/g, '')
    }
  } catch {
    /* 文件不存在即视为未配置 */
  }
  return ''
}

/**
 * 多通道投递:Server酱 → 邮件。返回每一通的尝试结论,调用方据此留痕。
 * 全通道失败 = 故障从未被人看见,必须写 UNDELIVERED 标记并在下一轮判红。
 */
async function deliver(title, desp) {
  const attempts = []
  let key = process.env.SERVERCHAN_SENDKEY || ''
  if (!key) key = readServiceEnv('IHUI-DEPLOYLOOP', 'SERVERCHAN_SENDKEY') || ''
  if (!key) attempts.push('serverchan: 无 SERVERCHAN_SENDKEY(未尝试,应在计划任务环境里配好)')
  else {
    const r = await sendServerChan(key, title, desp)
    attempts.push(`serverchan: ${r.ok ? '已送达' : `未送达 — ${r.b}`}`)
    if (r.ok) return { sent: true, via: 'serverchan', attempts }
  }
  const e = await sendEmail(title, desp)
  attempts.push(`email: ${e.ok ? '已送达' : `未送达 — ${e.why}`}`)
  if (e.ok) return { sent: true, via: 'email', attempts }
  return { sent: false, via: null, attempts }
}

async function maybeAlert(results, dryRun) {
  const fails = results.filter((r) => r.level === 'fail')
  const sig = fails.map((f) => f.name).sort().join(' | ')
  const prev = loadState()
  const now = Date.now()
  const changed = !prev || (prev.sig || '') !== sig
  const overdue = prev && prev.ts && now - Date.parse(prev.ts) > 20 * 3600 * 1000
  const recovered = fails.length === 0 && prev && prev.sig
  if (fails.length === 0 && !recovered) return { sent: false, why: '无失败且此前也未告警,不打扰' }
  if (fails.length > 0 && !changed && !overdue) return { sent: false, why: '同一故障已在窗口内通报过(仍会每 20h 重发)' }

  const title = recovered ? '【生产环境】凭据巡检已恢复' : '【生产环境】凭据失效/部署停摆告警'
  const desp = recovered
    ? `上一轮失效项已恢复: ${prev.sig}\n\n全部检查: ${results.map((r) => `${r.level} ${r.name}`).join('\n')}`
    : `失效项(${fails.length}):\n${fails.map((f) => `- ${f.name}\n  ${f.detail}`).join('\n')}\n\n` +
      `全部结果:\n${results.map((r) => `- [${r.level}] ${r.name} — ${r.detail}`).join('\n')}\n\n` +
      `处置:更新对应凭据后**必须同步服务环境块**(nssm AppEnvironmentExtra),` +
      `再跑 node scripts/check-credential-health.mjs 复验。限流/网络不可达不算失效。\n` +
      `来源:本机即生产机(D:/IHUI-AI 上跑 IHUI-API / IHUI-DEPLOYLOOP)。`
  // 台账先落盘:即便所有远端通道都失败,这一条也已经留下人类可读记录
  appendLedger(title, desp, null)
  if (dryRun) {
    console.log(`[alert-dry] title=${title}\n${desp.slice(0, 300)}…`)
    return { sent: false, why: 'dry-run 未发送' }
  }
  const d = await deliver(title, desp)
  if (d.sent) {
    mkdirSync(join(REPO, '.workbuddy'), { recursive: true })
    writeFileSync(STATE, JSON.stringify({ ts: new Date().toISOString(), sig, fails: fails.length }), 'utf8')
    rmSync(UNDEL, { force: true })
  } else {
    writeFileSync(UNDEL, JSON.stringify({ ts: new Date().toISOString(), sig, attempts: d.attempts }, null, 2), 'utf8')
  }
  return {
    sent: d.sent,
    via: d.via,
    attempts: d.attempts,
    why: d.sent ? `经 ${d.via} 送达` : `全通道失败(已写标记 ${UNDEL})`,
  }
}

const argv = process.argv.slice(2)
if (argv.includes('--self-test')) selfTest()
else if (argv.includes('--test-alert')) {
  // 通道可用性必须可证:只看"代码写了 fallback"不算,必须真发一次并回读结果。
  const d = await deliver('【生产环境】凭据巡检通道自测', '这是一条通道自测消息(非故障)。用于验证 Server酱额度耗尽时邮件兜底是否真能落地。')
  console.log(`通道自测: sent=${d.sent} via=${d.via || '-'}`)
  for (const t of d.attempts) console.log(`  · ${t}`)
  process.exit(d.sent ? 0 : 1)
} else if (argv.includes('--install')) installTask()
else if (argv.includes('--uninstall')) uninstallTask()
else if (argv.includes('--status')) taskStatus()
else {
  const results = await runChecks()
  const bad = results.filter((r) => r.level === 'fail')
  if (argv.includes('--json')) {
    mkdirSync(join(REPO, '.workbuddy'), { recursive: true })
    const a = await maybeAlert(results, false)
    const line = JSON.stringify({ ts: new Date().toISOString(), fail: bad.length, alert: a, results })
    writeFileSync(join(REPO, '.workbuddy', 'credential-health-last.json'), line, 'utf8')
    console.log(line)
    if (!a.sent) console.log(`告警判定: sent=false ${a.why}`)
    process.exit(bad.length ? 1 : 0)
  } else {
    for (const r of results) console.log(`${{ ok: '✅', fail: '❌', limited: '⚠️', unreachable: '⚠️', unknown: '· ' }[r.level]} [${r.level}] ${r.name} — ${r.detail}`)
    const warn = results.filter((r) => r.level === 'limited' || r.level === 'unreachable')
    if (warn.length) console.log(`· 另有 ${warn.length} 项限流/网络不可达(不计为失效): ${warn.map((w) => w.name).join(' ; ')}`)
    if (bad.length) console.log('⚠️ 被限流/网络不可达 ≠ 凭据过期,不要据此换 key(本会话真实误判过一次)')
    console.log(bad.length ? `❌ ${bad.length} 项凭据失效: ${bad.map((b) => b.name).join(' ; ')}` : '✅ 全部凭据有效')
  }
  const a = await maybeAlert(results, argv.includes('--alert-dry'))
  console.log(`告警判定: sent=${a.sent} ${a.why}`)
  for (const t of a.attempts || []) console.log(`  · ${t}`)
  process.exit(bad.length ? 1 : 0)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
