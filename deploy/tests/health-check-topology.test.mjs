// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// =============================================================================
// health-check 家族拓扑感知判据的自检(deploy/tests)
// =============================================================================
// 立因(2026-10-13):health-check.sh/.ps1 原本只描述 compose 拓扑,而生产机
// WIN-20251101PXT 是 nssm 原生托管 —— 机器上没有 docker、`deploy/prod-bundle/`
// 下没有任何 compose 清单、jq 不在 PATH。旧写法把这些一律记成 FAIL ⇒ 每轮报出
// 一屏与线上实际状态无关的失败(服务全 Running、健康端点全 200),把"没装这套
// 东西"读成"这套东西坏了"。
// 修复形态:前置不在位(compose 项缺 docker/清单;jq 类取值缺解析器)一律落
// SKIP —— 不计 FAIL、不改退出码(compose 拓扑上行为与改前逐条一致)。
// 这把尺子钉四件事:
//   · 两份脚本里拓扑闸与 skip 出口都还在(被摘线 = 判据失效,当场翻红)
//   · AI 服务健康检查带 8803 兜底(原生拓扑下 8801 前门没有 /ai-service/ 前缀)
//   · 本机(无 docker)实跑 --json:compose 族必须全是 SKIP,没有一个 FAIL
//   · 退出码语义不因 SKIP 改变:FAIL>0 ⇒ 1,否则 0
// 跑法:node --test deploy/tests/health-check-topology.test.mjs
// =============================================================================
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { delimiter, dirname, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..')

const SH_HEALTH = 'deploy/scripts/prod-bundle/health-check.sh'
const PS1_HEALTH = 'deploy/scripts/prod-bundle/health-check.ps1'
const COMPOSE_ITEMS_SH = ['docker', 'container-db', 'container-redis', 'container-api', 'container-ai-service', 'container-web', 'cloudflared', 'db-tables']

const read = (rel) => {
  const p = join(REPO, rel)
  if (!existsSync(p)) throw new Error(`源文件不在位: ${rel}(被摘线?)`)
  return readFileSync(p, 'utf8')
}

// ── bash 宿主解析(口径与 prod-bundle-diagnose.test.mjs 一致)────────────────
const WSL_STUB_MARK = `${sep}WindowsApps${sep}`
const isWslStub = (p) => String(p).replace(/\//g, sep).includes(WSL_STUB_MARK)
function bashWorks(candidate) {
  try {
    const r = spawnSync(candidate, ['-c', 'exit 0'], { timeout: 15_000, windowsHide: true })
    return r.status === 0
  } catch {
    return false
  }
}
function resolveBash() {
  const candidates = []
  const pf = process.env.ProgramFiles ?? 'C:\\Program Files'
  const pf86 = process.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)'
  if (process.platform === 'win32') {
    candidates.push(join(pf, 'Git', 'bin', 'bash.exe'), join(pf86, 'Git', 'bin', 'bash.exe'))
    const raw = process.env.PATH ?? process.env.Path ?? ''
    for (const dir of raw.split(delimiter).filter(Boolean)) candidates.push(join(dir, 'bash.exe'))
    candidates.push('/usr/bin/bash', '/bin/bash')
  } else {
    candidates.push('/bin/bash', '/usr/bin/bash')
    const raw = process.env.PATH ?? ''
    for (const dir of raw.split(delimiter).filter(Boolean)) candidates.push(join(dir, 'bash'))
  }
  const seen = new Set()
  for (const c of candidates) {
    if (!c || seen.has(c)) continue
    seen.add(c)
    if (isWslStub(c)) continue
    if (!existsSync(c)) continue
    if (bashWorks(c)) return c
  }
  return null
}
const BASH = resolveBash()
function needBash(t) {
  if (BASH) return false
  t.skip('本机取不到可用 bash(Git Bash 未安装或 PATH 只有 WSL 转发桩)—— 机器态未判定,非代码缺陷')
  return true
}
const bash = (script) => {
  const r = spawnSync(BASH, ['-c', script], { cwd: REPO, encoding: 'utf8', timeout: 180_000, windowsHide: true })
  return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' }
}

// ── T1 sh 版:拓扑闸 / skip 出口 / jq 兜底 / df 兜底 全部在位 ────────────────
test('T1 sh: 拓扑闸与三类兜底判据在位,compose 族命令仍受闸保护', () => {
  const src = read(SH_HEALTH)
  for (const marker of [
    'IS_COMPOSE_TOPO=0',
    'IS_COMPOSE_TOPO=1',
    'skip() {',
    'http_field() {',
    'http_status_ok() {',
    'http_array_nonempty() {',
    'disk_free_gb() {',
    'deploy/win/test-health.ps1',
  ]) {
    if (!src.includes(marker)) throw new Error(`sh 缺判据物 ${marker}(拓扑感知被摘线?)`)
  }
  for (const marker of [
    '"docker"',
    'for svc in db redis api ai-service web; do',
    '"container-$svc"',
    '"cloudflared"',
    '"db-tables"',
  ]) {
    if (!src.includes(marker)) throw new Error(`sh 的 compose 族项 ${marker} 不见了(清单被改要连着改本尺)`)
  }
  // AI 服务健康的 8803 兜底必须在位(原生拓扑下 8801 前门没有 /ai-service/ 前缀)
  if (!src.includes('http://localhost:8803/health')) {
    throw new Error('sh 的 ai-service-health-local 丢了 8803 兜底 —— 原生机上会退回恒红')
  }
})

// ── T2 ps1 版:同一族判据在 Windows 侧同形 ──────────────────────────────────
test('T2 ps1: 拓扑闸与 Skip-Check 出口在位,8803 兜底在位', () => {
  const src = read(PS1_HEALTH)
  for (const marker of [
    '$isComposeTopo = $false',
    '$isComposeTopo = $true',
    'function Skip-Check',
    'http://localhost:8803/health',
    'deploy\\win\\test-health.ps1',
  ]) {
    if (!src.includes(marker)) throw new Error(`ps1 缺判据物 ${marker}(拓扑感知被摘线?)`)
  }
  for (const marker of [
    '"docker"',
    '$services = @("db", "redis", "api", "ai-service", "web")',
    '"container-$svc"',
    '"cloudflared"',
    '"db-tables"',
  ]) {
    if (!src.includes(marker)) throw new Error(`ps1 的 compose 族项 ${marker} 不见了(清单被改要连着改本尺)`)
  }
})

// ── T3 本机实跑 --json:无 docker 的机器上 compose 族必须全是 SKIP ───────────
test('T3 实跑: 无 docker 机器上 compose 族全 SKIP 且不进 FAIL 计数', (t) => {
  if (needBash(t)) return
  const dockerProbe = bash('command -v docker >/dev/null 2>&1 && echo yes || echo no')
  if (dockerProbe.stdout.trim() === 'yes') {
    t.skip('本机有 docker(可能存在 compose 拓扑)—— SKIP 断言只对无 docker 的机器成立,机器态让位')
    return
  }
  const r = bash(`bash "${join(REPO, SH_HEALTH).replace(/\\/g, '/')}" --json`)
  const line = r.stdout.split('\n').find((l) => l.trim().startsWith('{'))
  if (!line) throw new Error(`--json 没有产出 JSON 对象:\n${r.stdout}\n${r.stderr}`)
  const obj = JSON.parse(line)
  for (const k of ['pass', 'warn', 'fail', 'skip', 'checks', 'generatedAt']) {
    if (!(k in obj)) throw new Error(`--json 缺字段 ${k}(退出码判定面或下游消费者会被改坏)`)
  }
  const byName = new Map(obj.checks.map((c) => [c.name, c]))
  let skipSeen = 0
  for (const item of COMPOSE_ITEMS_SH) {
    const c = byName.get(item)
    if (!c) throw new Error(`checks 里没有 ${item}(清单漂了,连着改本尺)`)
    if (c.state === 'FAIL') {
      throw new Error(`无 docker 机器上 ${item} 仍是 FAIL —— "没装"又被读成"坏了": ${c.detail}`)
    }
    if (c.state === 'SKIP') skipSeen++
  }
  if (skipSeen !== COMPOSE_ITEMS_SH.length) {
    throw new Error(`compose 族应有 ${COMPOSE_ITEMS_SH.length} 项 SKIP,实得 ${skipSeen}(有项落到了别的状态)`)
  }
  if (obj.skip < skipSeen) throw new Error(`汇总 skip=${obj.skip} 小于实测 SKIP 项数 ${skipSeen}`)
  // 退出码语义:FAIL>0 ⇒ 1,否则 0(SKIP 不参与)
  const want = obj.fail > 0 ? 1 : 0
  if (r.status !== want) throw new Error(`退出码语义被 SKIP 改坏: fail=${obj.fail} 应 exit ${want},实得 ${r.status}`)
})

// ── T4 实跑 text 模式:汇总段必须还在(人类输出不被改坏)────────────────────
test('T4 实跑: text 模式汇总段在位且含 SKIP 行', (t) => {
  if (needBash(t)) return
  const r = bash(`bash "${join(REPO, SH_HEALTH).replace(/\\/g, '/')}" 2>&1`)
  if (!/健康检查汇总/.test(r.stdout)) throw new Error('text 模式的人类汇总输出被改坏')
  if (!/SKIP: \d+/.test(r.stdout)) throw new Error('汇总段缺 SKIP 行(SKIP 数不可见 = 又回到静默)')
})
