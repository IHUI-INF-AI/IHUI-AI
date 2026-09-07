#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌

// 自建 Cloudflare 优选 IP —— 免费、不迁 DNS(直接用 Cloudflare API 改 aizhs.top zone 内 img 记录)、保留内网穿透。
//
// 原理:
//   小程序 ─HTTPS─▶ 优选CF边缘IP(img A/TXT, orange ON) ─CF兜底─▶ 穿透机:80 (cdn-server.js)
//   周期性用开源 CloudflareSpeedTest 从本机(穿透机)测出当前 ISP 最快的 CF IP,
//   再借 Cloudflare API 把 img 记录改为该 IP(TTL 300),让国内用户直接命中更优边缘节点。
//
// 用法(需穷 user 提供三样):
//   set CLOUDFLARE_API_TOKEN=xxx      # CF 账号下 Zone.DNS Edit 权限的令牌
//   set CF_ZONE_ID=xxx                # aizhs.top 的 zone_id (CF API 查: /zones?name=aizhs.top)
//   set CF_RECORD=img                 # 要优选的主机记录(默认 img)
//   set CST_BIN=D:\CloudflareST.exe   # XIU2/CloudflareSpeedTest 可执行文件路径(必填)
//
//   跑一次:  node cf-preferred-ip.mjs --run
//   安装每30分钟任务(Windows): node cf-preferred-ip.mjs --install
//
// 依赖: 仅 node 内置 + 外部 CloudflareST.exe。无需任何 npm 包、不迁 DNS。

import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import https from 'node:https'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const LOG = join(HERE, 'cf-preferred-ip.log')
const LKG = join(HERE, 'cf-preferred-ip.lkg') // 最近一次验证可用的好 IP
const CONF = join(HERE, 'cf-preferred-ip.env') // 可选: 把环境变量写这里, 避免命令行裸传

const HELP = `
自建 Cloudflare 优选 IP (免费 / 不迁DNS / 保留内网穿透)
------------------------------
必要配置(优先读进程环境变量, 其次读同目录 cf-preferred-ip.env):
  CLOUDFLARE_API_TOKEN   CF 令牌, 需 Zone.DNS 编辑权限
  CF_ZONE_ID             aizhs.top 的 zone_id
  CF_RECORD              要优选的主机记录 (默认 img)
  CF_PROXIED             写回 record 时保持 proxied 布尔值 (默认照旧)
  CST_BIN                XIU2/CloudflareSpeedTest 可执行文件路径 (必填)
可选:
  CF_TTL                 写回 TTL(秒), 默认 300
  CST_ARGS               附加测速参数(如 -tp 5 -url https://... ), 默认 "-dd -f tp 3"
命令:
  --run                  测速→取最优IP→回调 CF API 更新 img 记录 (成功才写, 失败保留原值)
  --check                只测速并打印候选, 不写回 CF
  --install              在 Windows 上注册每30分钟计划任务(需管理员)
  --source               打印当前 img 记录的 A/AAAA 值后退出
`
function log(msg) { const line = `[${new Date().toISOString()}] ${msg}`; try { execFileSync('cmd', ['/c', `echo ${line}>> "${LOG}"`], { shell: false }) } catch {} ; console.log(line) }

function env(name, fallback = '') {
  const v = process.env[name]
  if (v && v.trim()) return v.trim()
  // 回退读同目录 .env
  if (existsSync(CONF)) {
    for (const raw of readFileSync(CONF, 'utf8').split(/\r?\n/)) {
      const m = raw.match(/^\s*([A-Z_]+)\s*=\s*(.+?)\s*$/)
      if (m && m[1] === name && m[2]) return m[2].replace(/^["']|["']$/g, '')
    }
  }
  return fallback
}

async function cfApi(path, opts = {}) {
  const token = env('CLOUDFLARE_API_TOKEN')
  if (!token) throw new Error('缺少 CLOUDFLARE_API_TOKEN (CF Zone.DNS Edit 令牌)')
  const url = `https://api.cloudflare.com/client/v4${path}`
  const res = await fetch(url, {
    method: opts.method || 'GET',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || (data && data.success === false)) {
    const msg = data?.errors?.[0]?.message || res.statusText
    throw new Error(`CF API ${opts.method || 'GET'} ${url} -> ${res.status}: ${msg}`)
  }
  return data
}

function parseBestIPs(cstBin, extraArgs) {
  if (!existsSync(cstBin)) throw new Error(`找不到 CloudflareST: ${cstBin} (已内置在 deploy/tools/CloudflareST.exe, 或自填 CST_BIN)`)
  // 默认参数: -tp 200 并发200, -dd 禁用下载测速(节省流量); cwd 指到 tools/ 以便工具读取其自带的 ip.txt 候选表
  const out = join(HERE, 'cst-result.txt')
  const cwd = existsSync(join(HERE, 'tools', 'ip.txt')) ? join(HERE, 'tools') : HERE
  const args = ['-tp', '200', '-dd', '-o', out, ...extraArgs]
  log(`执行: ${cstBin} ${args.join(' ')} (cwd=${cwd})`)
  execFileSync(cstBin, args, { cwd, stdio: 'inherit', windowsHide: true })
  if (!existsSync(out)) throw new Error('测速无输出')
  const lines = readFileSync(out, 'utf8').split(/\r?\n/)
  const rows = []
  for (const line of lines) {
    const c = line.split(',')
    // CSV 列: IP,已发送,已接收,丢包率,平均延迟,下载速度,地区码
    if (c.length < 5 || !c[0].match(/^[\d.]+$/)) continue
    if (Number.isNaN(parseFloat(c[3]))) continue
    rows.push({ ip: c[0], loss: parseFloat(c[3]) || 0, delay: parseFloat(c[4]) || 9999 })
  }
  // 丢包率升序, 同丢包再按延迟升序; 取前5
  return rows.sort((a, b) => (a.loss - b.loss) || (a.delay - b.delay)).slice(0, 5).map(x => x.ip)
}

async function getImage() { const data = await cfApi(`/zones/${env('CF_ZONE_ID')}/dns_records?type=A,AAAA&name=${env('CF_RECORD', 'img')}.aizhs.top&per_page=5`); return data.result?.[0] || null }

function readLKG() { try { return readFileSync(LKG, 'utf8').trim() } catch { return '' } }
function writeLKG(ip) { try { writeFileSync(LKG, ip) } catch {} }

// 写回前健康校验: 直接 HTTPS 打到候选 IP(域名解析覆写为它, Host 仍为 img.aizhs.top),
// 确认该边缘节点真的能出图(200 + image/*), 规避把站点解析到不服务本域名的 IP。
function healthCheck(ip, timeoutMs = 6000) {
  const host = `${env('CF_RECORD', 'img')}.aizhs.top`
  return new Promise((resolve) => {
    let done = false
    const finish = (ok) => { if (!done) { done = true; resolve(ok) } }
    const req = https.request({
      host, path: env('CF_HEALTH_PATH', '/tabbar/home/carousel4-footer1/BottomFigure.png'), method: 'GET',
      headers: { Host: host, 'User-Agent': 'cf-preferred-ip-health' },
      lookup: (_h, _o, cb) => cb(null, ip, 4),
    }, (res) => {
      let n = 0
      res.on('data', (d) => { n += d.length; if (n > 2048) res.destroy() })
      res.on('end', () => finish(res.statusCode === 200 && /^image\//.test(res.headers['content-type'] || '')))
      res.on('error', () => finish(false))
    })
    req.on('error', () => finish(false))
    req.setTimeout(timeoutMs, () => { finish(false); req.destroy() })
    req.end()
  })
}

async function run() {
  const zone = env('CF_ZONE_ID'); const rec = env('CF_RECORD', 'img')
  const cstDefault = join(HERE, 'tools', 'CloudflareST.exe')
  const cstBin = env('CST_BIN', cstDefault)
  if (!zone) throw new Error('缺少 CF_ZONE_ID')
  if (!existsSync(cstBin)) throw new Error(`缺少测速工具: ${cstBin} 不存在`)

  // 1. 取当前记录, 保护原值
  const cur = await getImage()
  if (!cur) throw new Error(`未找到 ${rec}.aizhs.top 记录`)
  log(`当前 ${cur.name}: type=${cur.type} content=${cur.content} proxied=${cur.proxied} ttl=${cur.ttl}`)

  // 2. 测速 → 候选, 逐个健康校验, 取第一个真能出图的
  const extra = (env('CST_ARGS') || '').split(/\s+/).filter(Boolean)
  const candidates = parseBestIPs(cstBin, extra)
  let best = null
  for (const ip of candidates.slice(0, 5)) {
    if (await healthCheck(ip)) { best = ip; log(`候选 ${ip} 健康校验通过`); break }
    log(`候选 ${ip} 健康校验未通过, 试下一个`)
  }
  if (!best) {
    const lkg = readLKG()
    if (lkg && lkg !== cur.content && await healthCheck(lkg)) { best = lkg; log(`候选全失败, 回滚最近一次好 IP: ${lkg}`) }
    else { log('候选与回滚项均不可用, 保留当前值'); return 'unchanged' }
  }
  log(`候选用 IP: ${best}`)

  // 3. 仅当 IP 变化才更新
  if (cur.content === best) { log('IP 未变化, 跳过写回'); return 'unchanged' }
  const proxied = env('CF_PROXIED') ? env('CF_PROXIED') === 'true' : !!cur.proxied
  const ttl = parseInt(env('CF_TTL', '300')) || 300
  // 优选 IP 为 IPv4; 若当前是 CNAME(tunnel 指向 cfargotunnel.com), 需规范成 A 记录(orange 照旧开)。
  const type = best.includes(':') ? 'AAAA' : 'A'
  log(`写回 ${cur.name} ${cur.type}->${type} ${best} (proxied=${proxied} ttl=${ttl})`)
  await cfApi(`/zones/${zone}/dns_records/${cur.id}`, { method: 'PUT', body: { type, name: cur.name, content: best, proxied, ttl } })
  writeLKG(best)
  log('OK 已更新')
  return 'updated'
}

function install() {
  // Windows 计划任务: 每30分钟跑一次
  const node = process.execPath
  const script = fileURLToPath(import.meta.url)
  const cmd = `cmd /c ""${node}" "${script}" --run" >> "${LOG}" 2>&1`
  execFileSync('schtasks', ['/Create', '/F', '/TN', 'IHUI-CFPreferredIP', '/SC', 'MINUTE', '/MO', '30', '/TR', cmd])
  log('已注册计划任务 IHUI-CFPreferredIP (每30分钟)')
}

async function main() {
  const flag = process.argv[2]
  try {
    if (flag === '--install') { install() }
    else if (flag === '--check') { const cs = parseBestIPs(env('CST_BIN', join(HERE, 'tools', 'CloudflareST.exe')), (env('CST_ARGS') || '').split(/\s+/).filter(Boolean)); console.log('Top 候选 IP:', cs.join(', ')) }
    else if (flag === '--source') { const r = await getImage(); if(!r){console.log('(无A/AAAA记录)');return} console.log(`${r.name} ${r.type} ${r.content} proxied=${r.proxied} ttl=${r.ttl}`) }
    else if (flag === '--run') { const r = await run(); console.log(`结果片段: ${r}`) }
    else { console.log(HELP); process.exit(0) }
  } catch (e) {
    log(`[错误] ${e.message}`); console.error(e.message); process.exit(1)
  }
}

main()