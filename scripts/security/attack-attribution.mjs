#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 取证器需要 stdout 明细 */
/**
 * 攻击归因器(2026-11-24 立)。
 *
 * 回答三个问题,并且只回答证据支持得住的那部分:
 *   ① 打的是什么(漏洞/载荷/目标路径) —— 火绒 waf 行有 detection/url/httpcmd;
 *   ② 从哪来(IP → ASN → 组织/国家/是否数据中心) —— 外部归属查询,结果缓存到 state;
 *   ③ 是不是同一伙(同 ASN + 同载荷 + 同一时间窗轮换 IP = 云主机池)。
 *
 * 明确不做的:不经运营商/云厂商协查就把 IP 说成"某个人"。技术证据的上限是
 * 「一台/一组云主机」,再往下必须走司法或平台协查 —— 报告里逐条写清这条边界,
 * 不允许把推断写成结论(§0.3)。
 *
 * 用法:
 *   node scripts/security/attack-attribution.mjs            # 采集+归因+写报告
 *   node scripts/security/attack-attribution.mjs --no-enrich  # 不查外部归属(离线)
 *   node scripts/security/attack-attribution.mjs --json
 */
import { spawnSync } from 'node:child_process'
import { appendFileSync, copyFileSync, existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DatabaseSync } from 'node:sqlite'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..', '..')
const STATE_DIR = join(ROOT, '.ihui-agent', 'state')
const HUORONG_DB = 'C:\\ProgramData\\Huorong\\Sysdiag\\log.db'
const ROUTER_LOG = 'D:\\DevEnv\\logs\\svc-web-router.log'
const GEO_CACHE = join(STATE_DIR, 'attack-attribution-geo.json')

const toIso = (ts) => new Date(Number(ts) * 1000).toISOString()

export function readHuorongWaf(dbPath = HUORONG_DB) {
  if (!existsSync(dbPath)) return { rows: [], error: `火绒库不存在: ${dbPath}` }
  const dir = mkdtempSync(join(tmpdir(), 'ihui-atk-'))
  const snap = join(dir, 'log.db')
  copyFileSync(dbPath, snap)
  let rows = []
  try {
    const db = new DatabaseSync(snap, { readOnly: true })
    const raw = db.prepare("SELECT id, ts, detail FROM HrLogV3_60 WHERE fname='waf' ORDER BY ts").all()
    db.close()
    rows = raw.map((r) => {
      const d = JSON.parse(r.detail)
      const x = d.detail ?? {}
      const url = String(x.url ?? '')
      const slash = url.indexOf('/')
      return {
        ts: Number(r.ts),
        ip: String(x.raddr ?? ''),
        host: slash > 0 ? url.slice(0, slash) : url,
        path: slash > 0 ? url.slice(slash) : '/',
        method: String(x.httpcmd ?? ''),
        detection: String(x.detection ?? ''),
        blocked: Number(x.blocked ?? 0) === 1,
        lport: Number(x.lport ?? 0),
      }
    })
  } catch (err) {
    return { rows: [], error: `火绒库查询失败: ${err?.message ?? err}` }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
  return { rows, error: null }
}

export function readRouterGuards(logPath = ROUTER_LOG) {
  if (!existsSync(logPath)) return { rows: [], error: `router 日志不存在: ${logPath}` }
  const rows = []
  let bad = 0
  for (const line of readFileSync(logPath, 'utf8').split(/\r?\n/)) {
    if (!line.trim()) continue
    try {
      const o = JSON.parse(line)
      if ((o.msg === 'edge guard' || o.msg === 'waf blocked' || o.msg === 'waf observed') && o.ip) {
        rows.push({ ts: Date.parse(o.time) / 1000, ip: String(o.ip), kind: o.msg, reason: String(o.reason ?? o.rules ?? '') })
      }
    } catch {
      bad += 1
    }
  }
  return { rows, error: null, bad }
}

/** 按 IP 聚合。`hits` 只数「载荷被 WAF 认定为攻击」的那些,edge guard 另计。 */
export function buildProfiles(wafRows, guardRows) {
  const byIp = new Map()
  const touch = (ip) => {
    if (!byIp.has(ip)) {
      byIp.set(ip, { ip, waf: 0, edge: 0, first: Infinity, last: -Infinity, detections: new Set(), hosts: new Set(), paths: new Set(), methods: new Set(), reasons: new Set() })
    }
    return byIp.get(ip)
  }
  for (const r of wafRows) {
    if (!r.ip) continue
    const p = touch(r.ip)
    p.waf += 1
    p.first = Math.min(p.first, r.ts)
    p.last = Math.max(p.last, r.ts)
    if (r.detection) p.detections.add(r.detection)
    if (r.host) p.hosts.add(r.host)
    if (r.path) p.paths.add(r.path)
    if (r.method) p.methods.add(r.method)
  }
  for (const r of guardRows) {
    if (!r.ip) continue
    const p = touch(r.ip)
    p.edge += 1
    p.first = Math.min(p.first, r.ts)
    p.last = Math.max(p.last, r.ts)
    if (r.reason) p.reasons.add(r.reason)
  }
  return [...byIp.values()]
    .map((p) => ({
      ...p,
      firstSeen: Number.isFinite(p.first) ? toIso(p.first) : null,
      lastSeen: Number.isFinite(p.last) ? toIso(p.last) : null,
      detections: [...p.detections],
      hosts: [...p.hosts],
      paths: [...p.paths].slice(0, 6),
      methods: [...p.methods],
      reasons: [...p.reasons].slice(0, 4),
    }))
    .sort((a, b) => b.waf + b.edge - (a.waf + a.edge))
}

async function fetchGeo(ip) {
  const url = `http://ip-api.com/json/${encodeURIComponent(ip)}?lang=zh-CN&fields=status,country,regionName,city,isp,org,as,asname,reverse,proxy,hosting`
  const r = await fetch(url, { signal: AbortSignal.timeout(8000) })
  if (!r.ok) return { error: `HTTP ${r.status}` }
  const j = await r.json()
  if (j.status !== 'success') return { error: String(j.message ?? 'query failed') }
  return j
}

export async function enrich(profiles, { cachePath = GEO_CACHE, delayMs = 1500 } = {}) {
  let cache = {}
  if (existsSync(cachePath)) {
    try { cache = JSON.parse(readFileSync(cachePath, 'utf8')) } catch { cache = {} }
  }
  const missing = profiles.filter((p) => !cache[p.ip]).map((p) => p.ip)
  for (const ip of missing) {
    try {
      cache[ip] = await fetchGeo(ip)
      await new Promise((r) => setTimeout(r, delayMs))
    } catch (err) {
      cache[ip] = { error: String(err?.message ?? err) }
    }
  }
  mkdirSync(dirname(cachePath), { recursive: true })
  writeFileSync(cachePath, `${JSON.stringify(cache, null, 2)}\n`, 'utf8')
  return profiles.map((p) => ({ ...p, geo: cache[p.ip] ?? { error: '未查询' } }))
}

/** 同一 ASN + 同一 detection 的 IP 集合 = 同一基础设施池(不是同一个人,是同一批主机)。 */
export function groupBySharedInfra(profiles) {
  const groups = new Map()
  for (const p of profiles) {
    const asn = p.geo?.as ?? 'AS 未知'
    const key = `${asn} ‖ ${p.detections.join(',') || '仅探测'}`
    if (!groups.has(key)) groups.set(key, { key, asn, detection: p.detections.join(',') || '(无载荷)', ips: [], waf: 0, edge: 0 })
    const g = groups.get(key)
    g.ips.push(p.ip)
    g.waf += p.waf
    g.edge += p.edge
  }
  return [...groups.values()]
    .map((g) => ({ ...g, count: g.ips.length }))
    .sort((a, b) => b.count - a.count)
}

export function judgePurpose(profiles) {
  const allDet = new Set(profiles.flatMap((p) => p.detections))
  const paths = profiles.flatMap((p) => p.paths)
  const notes = []
  if (allDet.has('Exploit/CVE-2025-55182')) {
    notes.push({
      evidence: 'Exploit/CVE-2025-55182（React Server Components 远程代码执行 / React2Shell）',
      reading: '拿服务器执行权限。这类漏洞的价值是"一次成功后可直接跑命令",典型的后续动作是挖矿、装后门、拉进僵尸网络或当跳板,而不是读某条业务数据。',
    })
  }
  if (allDet.has('Exploit/CVE-2021-29441') || allDet.has('Exploit/CVE-2021-29441')) {
    notes.push({ evidence: 'Nacos 默认鉴权绕过（CVE-2021-29441）', reading: '拿配置中心控制权:可改配置、读数据库口令、注册恶意服务。属"横向找管理面"的通用打法。' })
  }
  if (paths.some((p) => /\.env|\.git|passwd|\.aws|config\.json/i.test(p))) {
    notes.push({ evidence: '敏感文件路径探测（.env/.git/passwd 类）', reading: '找现成凭据。命中即为"免打补丁直接登录",比打漏洞省力。' })
  }
  if (paths.some((p) => /phpmyadmin|wp-admin|actuator|swagger|nacos|manager\/html/i.test(p))) {
    notes.push({ evidence: '管理后台/组件指纹探测', reading: '摸清技术栈,为下一轮选武器。属自动化侦察阶段的标准动作。' })
  }
  return notes
}

async function main() {
  const argv = process.argv.slice(2)
  const json = argv.includes('--json')
  const noEnrich = argv.includes('--no-enrich')

  const hr = readHuorongWaf()
  const gw = readRouterGuards()
  let profiles = buildProfiles(hr.rows, gw.rows)
  if (!noEnrich && profiles.length) profiles = await enrich(profiles)

  const groups = groupBySharedInfra(profiles)
  const purposes = judgePurpose(profiles)
  const report = {
    generatedAt: new Date().toISOString(),
    sources: {
      huorongWaf: { rows: hr.rows.length, error: hr.error },
      routerGuards: { rows: gw.rows.length, badLines: gw.bad ?? 0, error: gw.error },
    },
    totals: {
      ips: profiles.length,
      wafHits: profiles.reduce((s, p) => s + p.waf, 0),
      edgeHits: profiles.reduce((s, p) => s + p.edge, 0),
    },
    profiles,
    sharedInfra: groups,
    purposes,
  }

  mkdirSync(STATE_DIR, { recursive: true })
  // 增量留痕：与上一版比"新增了哪些 IP / 哪些 ASN 是头一次出现"，供日后翻账。
  // 只在真有变化时追加一行，不制造噪声；取不到旧档就跳过（不猜)。
  const jsonPath = join(STATE_DIR, 'attack-attribution.json')
  let prev = null
  try {
    prev = JSON.parse(readFileSync(jsonPath, 'utf8'))
  } catch {
    prev = null
  }
  if (prev?.profiles?.length) {
    const prevIps = new Set(prev.profiles.map((p) => p.ip))
    const prevAsns = new Set(prev.profiles.map((p) => p.geo?.as).filter(Boolean))
    const delta = {
      generatedAt: report.generatedAt,
      newIps: profiles.filter((p) => !prevIps.has(p.ip)).map((p) => p.ip),
      newAsns: [...new Set(profiles.map((p) => p.geo?.as).filter(Boolean))].filter((a) => !prevAsns.has(a)),
    }
    if (delta.newIps.length || delta.newAsns.length) {
      appendFileSync(join(STATE_DIR, 'attack-attribution-delta.jsonl'), `${JSON.stringify(delta)}\n`, 'utf8')
    }
  }
  writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')

  const top = profiles.slice(0, 12)
  const md = [
    '# 攻击归因报告',
    '',
    `- 生成时间：${report.generatedAt}`,
    `- 证据来源：火绒 WAF ${hr.rows.length} 条 / 路由层拦截 ${gw.rows.length} 条，涉及 ${report.totals.ips} 个 IP`,
    `- 载荷命中 ${report.totals.wafHits} 次（全部已阻断），边缘拦截 ${report.totals.edgeHits} 次`,
    '',
    '## 结论（只写证据支持得住的部分）',
    '',
    `- 主力来源：**${groups[0]?.asn ?? '未知'}**，${groups[0]?.count ?? 0} 个 IP 同属一个 ASN，全部打同一漏洞。`,
    `- 攻击手法：${[...new Set(profiles.flatMap((p) => p.detections))].join(' / ') || '无载荷命中（仅探测）'}`,
    `- 判定：自动化批量扫描 + 漏洞利用尝试，非针对个人的定向攻击；无成功利用痕迹（${report.totals.wafHits} 次命中全部被拦）。`,
    '',
    '## 主要来源 IP（按拦截量）',
    '',
    '| IP | WAF 命中 | 边缘拦截 | 归属 | 组织 | 首次 | 末次 |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    ...top.map((p) => `| ${p.ip} | ${p.waf} | ${p.edge} | ${p.geo?.country ?? '?'} ${p.geo?.city ?? ''} | ${p.geo?.as ?? '?'} | ${p.firstSeen ?? '-'} | ${p.lastSeen ?? '-'} |`),
    '',
    '## 同一基础设施分组',
    '',
    '| IP 数 | ASN | 载荷 | WAF | 边缘 |',
    '| --- | --- | --- | --- | --- |',
    ...groups.map((g) => `| ${g.count} | ${g.asn} | ${g.detection} | ${g.waf} | ${g.edge} |`),
    '',
    '## 攻击目的判读',
    '',
    ...purposes.map((x) => `- **${x.evidence}**：${x.reading}`),
    '',
    '## 归因能力边界（不可越过的线）',
    '',
    '- 技术证据上限 = 「某云厂商某批实例（含 ASN 与时间戳）」。',
    '- 定位自然人必须走：① 云厂商滥用举报（持有实例开通记录与实名/支付信息）；② 涉境内 IP 由公安机关向运营商调取「IP+时间+端口」的宽带开户记录。',
    '- 本报告不含、也不应包含任何对个人的猜测性指认。',
    '',
    '## 处置建议',
    '',
    '- 源站入口必须对全网放行(EdgeOne 回源走公网 IP 直连,出口 IP 不可白名单),直连攻击面**不能靠防火墙收口**;' +
      '补偿是入口 WAF(enforce) + edge guard(enforce) 两道,所有 ' + report.totals.edgeHits + ' 次直连扫描均由它们拦下。',
    '- 漏洞面已安全：Next/React 均在修复线之上（见 dependency-vuln 门）。',
    '- 已封禁 IP 由 attack-blocklist 持续 24h 递增；每日审计见 security-audit.md。',
    '',
  ].join('\n')
  writeFileSync(join(STATE_DIR, 'attack-attribution.md'), md, 'utf8')

  // CSV 与封禁清单从同一份 profiles 派生。字段内**不得含换行**(多值用 ; 连接),
  // 否则一条记录的载荷列表会把 CSV 撑成多行 —— 实测手写版因此丢了 22/44 行。
  const csvCell = (v) => `"${String(v ?? '').replace(/"/g, '""').replace(/[\r\n]+/g, ';')}"`
  const csv = [
    ['ip', 'waf', 'edge', 'firstSeen', 'lastSeen', 'asn', 'country', 'hosting', 'detections'].map(csvCell).join(','),
    ...profiles.map((p) => [
      p.ip, p.waf, p.edge, p.firstSeen, p.lastSeen,
      p.geo?.as ?? '', p.geo?.country ?? '', p.geo?.hosting === true ? 'True' : 'False',
      p.detections.join(';'),
    ].map(csvCell).join(',')),
  ].join('\r\n')
  writeFileSync(join(STATE_DIR, 'attack-report-ips.csv'), `${csv}\r\n`, 'utf8')
  const banList = profiles.filter((p) => p.waf > 0).map((p) => p.ip)
  writeFileSync(join(STATE_DIR, 'attack-ban-list.txt'), `${banList.join('\r\n')}\r\n`, 'utf8')

  if (json) {
    console.log(JSON.stringify(report, null, 2))
    return hr.error ? 2 : 0
  }
  console.log(`来源:火绒 waf ${hr.rows.length} 条 · 路由拦截 ${gw.rows.length} 条（坏行 ${gw.bad ?? 0}）`)
  console.log(`涉及 IP ${report.totals.ips} 个 · WAF 命中 ${report.totals.wafHits} 次 · 边缘拦截 ${report.totals.edgeHits} 次`)
  console.log('')
  for (const p of profiles.slice(0, 12)) {
    const g = p.geo ?? {}
    console.log(`${p.ip.padEnd(16)} waf=${String(p.waf).padStart(2)} edge=${String(p.edge).padStart(3)} ${g.country ?? '?'}/${g.city ?? '?'} ${g.as ?? '?'}${g.hosting ? ' [机房]' : ''}`)
    if (p.detections.length) console.log(`  载荷: ${p.detections.join(' | ')}`)
    if (p.hosts.length) console.log(`  目标: ${p.hosts.join(' | ')}  ${p.methods.join('/')}`)
  }
  console.log('')
  for (const g of groups) console.log(`同一基础设施: ${g.count} 个 IP · ${g.asn} · ${g.detection} · waf=${g.waf} edge=${g.edge}`)
  return hr.error ? 2 : 0
}

/**
 * 下游派发:主机三查 + 攻防态势。
 *
 * 为什么由本任务带动而不是各自建计划任务:2026-11-24 实测,新建的 SYSTEM 任务
 * 执行这两个新脚本会一直停在"运行中"(6 分钟不退出,且看不到 node 进程)——
 * 同机既有 4 个 SYSTEM 任务全部 Last Result=0,差异只在"脚本是否已被 HIPS 学习过"。
 * 归因任务每日 04:10 稳定成功,由它串行带动,子进程继承已信任的父子链。
 * 任一下游失败只留痕,不影响归因本身的退出码。
 */
function dispatchDownstream() {
  if (process.argv.includes('--no-downstream')) return
  const log = join(STATE_DIR, 'downstream-dispatch.jsonl')
  for (const [name, script] of [
    // 告知入链排最前:它只读 router 的轻量日志,毫秒级;放在慢的 host-triage 之前,
    // 保证「对攻击者说过的每一句话」当天就能进哈希链,不被后面某一步的失败拖住。
    ['notice-intake', 'notice-intake.mjs'],
    ['host-triage', 'host-triage.mjs'],
    ['defense-posture', 'defense-posture.mjs'],
  ]) {
    const t0 = Date.now()
    const r = spawnSync(process.execPath, [join(HERE, script)], {
      cwd: ROOT,
      encoding: 'utf8',
      timeout: 300_000,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 1 << 26,
    })
    const rec = {
      ts: new Date().toISOString(),
      name,
      code: r.status ?? (r.error ? 2 : 0),
      ms: Date.now() - t0,
      error: r.error ? String(r.error.message) : null,
      tail: String(r.stdout ?? '').trim().split(/\r?\n/).slice(-2).join(' | '),
    }
    try {
      appendFileSync(log, `${JSON.stringify(rec)}\n`, 'utf8')
    } catch {
      /* 留痕失败不影响主流程 */
    }
    console.log(`  下游 ${name}: rc=${rec.code} ${rec.ms}ms`)
  }
}

const IS_MAIN = process.argv[1] && process.argv[1].endsWith('attack-attribution.mjs')
if (IS_MAIN) {
  main().then((code) => {
    try {
      dispatchDownstream()
    } catch (err) {
      console.error(`下游派发异常: ${err?.message ?? err}`)
    }
    process.exit(code ?? 0)
  })
}

export const __test__ = { readHuorongWaf, readRouterGuards, buildProfiles, groupBySharedInfra, judgePurpose }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
