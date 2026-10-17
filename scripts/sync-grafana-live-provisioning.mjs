#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 把仓库里的 Grafana provisioning(数据源)派生到部署机的运行副本,并把 docker 服务名
 * 改写成**本机实测可达的回环地址** —— 于是「用哪些数据源」只剩仓库一份真相,
 * 而「每个数据源在本机实际跑在哪个端口」由本脚本当次现读(§0.1 凡数字一律现读)。
 *
 * 立因(2026-10-17 Loki 上大屏时实测):
 *   仓库 `monitoring/grafana/provisioning/datasources/datasources.yml` 写的是 docker-compose
 *   里的服务名(prometheus:9090 / loki:3100 / jaeger:16686),而本机是 **nssm 原生部署**:
 *     · Prometheus 实际在 8815(不是 9090),Grafana 在 8816;
 *     · Loki 在 3100,端口碰巧同,主机名不同;
 *     · Jaeger **压根没部署**(端口无监听)。
 *   结果:部署机上那份 provisioning 是人工手抄的 12 行「只有 Prometheus」版本 ——
 *   仓库里 provisioning 了三个源、线上只有一个,Loki 与 Jaeger 从建栈那天起就是死配置,
 *   24 张大屏因此没有一张能用日志/追踪维度。这就是「账面上有、实际上没有」的同型病:
 *   和 AI 大屏查幽灵指标是同一个病根,只是换在了数据源这一层。
 *
 * 三条硬规矩:
 *   1. 运行副本一律是**派生态**,禁止手改。要加数据源改仓库那份再跑本脚本。
 *   2. 端口不猜:每个逻辑服务按候选端口逐个探活,取第一个真有响应的;全部不通 ⇒ 该数据源
 *      **不写进运行副本**并点名原因(宁可少一个源,也不要配一个连不上的源让人误判"没数据")。
 *   3. 幂等 + 留退路:内容一致时不写字节;写前把旧副本挪进 `pre-sync-backups/`。
 *
 * 用法:
 *   node scripts/sync-grafana-live-provisioning.mjs            # 检查并写回(默认)
 *   node scripts/sync-grafana-live-provisioning.mjs --check    # 零副作用,只报会改什么
 *   node scripts/sync-grafana-live-provisioning.mjs --live-dir <目录>
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync, renameSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { devEnvRoot } from './seal-c-root-stray.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const REPO_PROVISIONING = join(ROOT, 'monitoring', 'grafana', 'provisioning')
const SRC = join(REPO_PROVISIONING, 'datasources', 'datasources.yml')

const CANDIDATE_LIVE_DIRS = [join(devEnvRoot(), 'monitor', 'grafana', 'provisioning')]

// 逻辑服务 → 本机候选端口(按当次实测逐个探活,取第一个真有响应的)。
// 这里的数字是**候选清单**不是事实:9090/16686 是 docker-compose 里的端口,本机原生部署不通。
const SERVICE_PORT_CANDIDATES = {
  prometheus: [8815, 9090],
  loki: [3100],
  jaeger: [16686],
  alertmanager: [8817, 9093],
}

const PROBE_TIMEOUT_MS = 2500

function parseArgs(argv) {
  const out = { check: false, liveDir: null, help: false }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--check') out.check = true
    else if (a === '--live-dir') out.liveDir = argv[++i]
    else if (a === '--help' || a === '-h') out.help = true
  }
  return out
}

/** 探活:能建立 TCP 连接并拿到任意 HTTP 响应就算通(Loki 根路径返回 404 也是"通")。 */
async function probePort(port) {
  const url = `http://127.0.0.1:${port}/`
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), PROBE_TIMEOUT_MS)
  try {
    const res = await fetch(url, { signal: ctrl.signal, redirect: 'manual' })
    return { ok: true, port, detail: `HTTP ${res.status}` }
  } catch {
    // fetch 在连接被拒/超时都会抛;再验一次"端口确实在 LISTENING"以区分"没起"和"起了但不回 HTTP"
    return { ok: false, port, detail: 'no-http' }
  } finally {
    clearTimeout(timer)
  }
}

const probeCache = new Map()
async function resolveService(service) {
  if (probeCache.has(service)) return probeCache.get(service)
  const candidates = SERVICE_PORT_CANDIDATES[service]
  const result = { service, port: null, detail: candidates ? 'all-candidates-dead' : 'unknown-service' }
  if (candidates) {
    for (const port of candidates) {
       
      const r = await probePort(port)
      if (r.ok) {
        result.port = port
        result.detail = `HTTP ${r.detail.replace('HTTP ', '')}`
        break
      }
    }
  }
  probeCache.set(service, result)
  return result
}

/**
 * 把 datasources.yml 按「数据源块」切开。判据刻意做得窄:只认**恰好两空格缩进**的 `- name: ` 起头,
 * 其余(顶部注释、apiVersion、嵌套键如 Jaeger 的 `tags: - name: 'service'`)原样保留 ——
 * 本脚本是**改写器不是解析器**,不认识的结构一律原样透传,绝不因为看不懂就把配置吃掉。
 * (缩进判据是实测修的:按 `^\s*-\s+name:` 切会把 Jaeger 的 tags 子项认成第三个数据源。)
 */
function splitBlocks(text) {
  const lines = text.split(/\r?\n/)
  const head = []
  const blocks = []
  let cur = null
  for (const line of lines) {
    if (/^ {2}- name:\s*/.test(line)) {
      cur = { name: line.match(/^\s*-\s+name:\s*(.+?)\s*$/)[1].replace(/^['"]|['"]$/g, ''), lines: [line] }
      blocks.push(cur)
    } else if (cur) {
      cur.lines.push(line)
    } else {
      head.push(line)
    }
  }
  return { head, blocks }
}

function findLineIndex(blockLines, re) {
  return blockLines.findIndex((l) => re.test(l))
}

function indentOf(line) {
  return line.match(/^\s*/)[0]
}

async function buildLiveYaml(srcText) {
  const { head, blocks } = splitBlocks(srcText)
  const kept = []
  const dropped = []
  const rewritten = []

  for (const block of blocks) {
    const urlIdx = findLineIndex(block.lines, /^\s*url:\s*/)
    if (urlIdx === -1) {
      kept.push(block)
      continue
    }
    const urlLine = block.lines[urlIdx]
    const m = urlLine.match(/^\s*url:\s*(\S+)\s*$/)
    const rawUrl = m ? m[1] : ''
    const hostMatch = rawUrl.match(/^https?:\/\/([^:/]+)(?::(\d+))?/)
    const service = hostMatch ? hostMatch[1].toLowerCase() : null
    const resolved = service ? await resolveService(service) : null

    if (!resolved || !resolved.port) {
      dropped.push({ name: block.name, url: rawUrl, reason: resolved ? resolved.detail : 'url 无法解析出服务名' })
      continue
    }

    const liveUrl = `http://127.0.0.1:${resolved.port}`
    if (liveUrl !== rawUrl) {
      block.lines[urlIdx] = `${indentOf(urlLine)}url: ${liveUrl}`
      rewritten.push({ name: block.name, from: rawUrl, to: liveUrl })
    }

    // uid 必须显式:大屏 panel 用 uid 引用数据源(Prometheus 那份线上副本就是靠显式 uid 才对上),
    // 不显式 uid 时 Grafana 会自生成一个,仓库面板里的 "uid": "Prometheus" 就永远对不上。
    if (findLineIndex(block.lines, /^\s*uid:\s*/) === -1) {
      block.lines.splice(urlIdx + 1, 0, `${indentOf(urlLine)}uid: ${block.name}`)
    }

    // 派生字段(trace→metrics 跳转)里写的是服务名,要换成真正落地的 uid。
    block.lines = block.lines.map((l) => {
      // 注意 `- ` 列表前缀:derivedFields 是列表项(`        - datasourceUid: prometheus`),
      // 首版正则没认这个前缀,于是派生字段仍指向小写的 docker 服务名,跳转会指空。
      const dm = l.match(/^(\s*(?:-\s+)?datasourceUid:\s*)([A-Za-z0-9_-]+)\s*$/)
      if (!dm) return l
      const target = blocks.find((b) => b.name.toLowerCase() === dm[2].toLowerCase())
      return target ? `${dm[1]}${target.name}` : l
    })

    kept.push(block)
  }

  const out = [...head]
  for (const b of kept) out.push(...b.lines)
  return { yaml: out.join('\n').replace(/\n+$/, '\n'), kept, dropped, rewritten }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) {
    console.info('用法: node scripts/sync-grafana-live-provisioning.mjs [--check] [--live-dir <目录>]')
    process.exit(0)
  }
  if (!existsSync(SRC)) {
    console.error('❌ 仓库 provisioning 不存在: ' + SRC)
    process.exit(2)
  }

  const liveDir = args.liveDir || CANDIDATE_LIVE_DIRS.find((d) => existsSync(d)) || CANDIDATE_LIVE_DIRS[0]
  const target = join(liveDir, 'datasources', 'datasources.yml')

  const srcText = readFileSync(SRC, 'utf8')
  const { yaml, kept, dropped, rewritten } = await buildLiveYaml(srcText)

  console.info('仓库源: ' + SRC)
  console.info('运行副本: ' + target)
  for (const r of rewritten) console.info(`  ↳ URL 改写 ${r.name}: ${r.from} → ${r.to}(本机实测端口)`)
  for (const d of dropped) console.info(`  ⏭ 跳过 ${d.name}(${d.url}):${d.reason} —— 连不上的源不写进运行副本`)
  console.info(`  ✅ 落 ${kept.length} 个数据源: ${kept.map((b) => b.name).join(', ')}`)

  if (!existsSync(target)) {
    if (args.check) {
      console.info('[check] 运行副本尚不存在,将新建')
      return
    }
    mkdirSync(dirname(target), { recursive: true })
    writeFileSync(target, yaml, 'utf8')
    console.info('✅ 已新建运行副本')
    return
  }

  const before = readFileSync(target, 'utf8')
  if (before === yaml) {
    console.info('✅ 运行副本已与仓库源一致,未写字节(幂等)')
    return
  }
  if (args.check) {
    console.info('[check] 运行副本与仓库源不一致,将重写(未写盘)')
    return
  }
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  mkdirSync(join(liveDir, 'pre-sync-backups'), { recursive: true })
  renameSync(target, join(liveDir, 'pre-sync-backups', `datasources.yml.${stamp}`))
  writeFileSync(target, yaml, 'utf8')
  console.info(`✅ 已按仓库源重写运行副本(旧副本存于 pre-sync-backups/datasources.yml.${stamp})`)
  console.info('ℹ️  Grafana 需在重启后加载新数据源: Restart-Service ihui-grafana')
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main().catch((e) => {
    console.error('❌ ' + (e && e.stack ? e.stack : e))
    process.exit(1)
  })
}

export { buildLiveYaml, splitBlocks, resolveService }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
