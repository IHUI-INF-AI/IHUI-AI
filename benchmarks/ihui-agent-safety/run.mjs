// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * L16 可复核 benchmark harness(2026-11-26)。
 *
 * 只跑**确定性、无外网、无数据库**的本地门禁,把每个门的结论收成一份 JSON:
 *  - 任何第三方克隆仓库后可用同一命令复跑;
 *  - 不把单测/文档冒充真机结论:R8 读数直接从证据 JSON 读取;
 *  - 不输出竞品排名,只输出本仓在这套尺子上的可复核结果。
 *
 * 用法:
 *   node benchmarks/ihui-agent-safety/run.mjs
 *   node benchmarks/ihui-agent-safety/run.mjs --out docs/benchmark-evidence/2026-11/l16-benchmark-run-2026-11-26.json
 */

import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '../..')
const defaultOut = resolve(
  root,
  'docs/benchmark-evidence/2026-11/l16-benchmark-run-2026-11-26.json',
)

const args = process.argv.slice(2)
const outIndex = args.indexOf('--out')
const outPath = outIndex >= 0 && args[outIndex + 1] ? resolve(root, args[outIndex + 1]) : defaultOut

function runNode(script, extraArgs = []) {
  const started = Date.now()
  try {
    const stdout = execFileSync(process.execPath, [script, ...extraArgs], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 120_000,
    })
    return { ok: true, exitCode: 0, stdout: stdout.trim(), stderr: '', durationMs: Date.now() - started }
  } catch (error) {
    return {
      ok: false,
      exitCode: typeof error?.status === 'number' ? error.status : 1,
      stdout: String(error?.stdout ?? '').trim(),
      stderr: String(error?.stderr ?? error?.message ?? '').trim(),
      durationMs: Date.now() - started,
    }
  }
}

function readJson(relativePath) {
  try {
    return JSON.parse(readFileSync(resolve(root, relativePath), 'utf8'))
  } catch (error) {
    return { __readError: String(error) }
  }
}

const checks = []

// 1. 桌面命令暴露面:注册表与调用点一致,预算内。
{
  const result = runNode('scripts/check-desktop-invoke-registry.mjs')
  checks.push({
    id: 'desktop-invoke-registry',
    title: '桌面命令暴露面与调用点一致',
    ok:
      result.ok &&
      /无对应命令=0/.test(result.stdout) &&
      /重名=0/.test(result.stdout) &&
      /清单差异=0/.test(result.stdout),
    ...result,
  })
}

// 2. 生产窗口安全:红项为 0。
{
  const result = runNode('scripts/check-window-security.mjs')
  checks.push({
    id: 'window-security',
    title: '生产窗口安全工厂无红项',
    ok: result.ok && /红=0/.test(result.stdout),
    ...result,
  })
}

// 3. MCP 回环路由表:Fastify 源与 Host 适配器 15=15。
{
  const result = runNode('scripts/check-mcp-loopback-route-parity.mjs')
  const match = result.stdout.match(/mcp-loopback-route-parity (\{.*\})/)
  const report = match ? JSON.parse(match[1]) : null
  checks.push({
    id: 'mcp-loopback-route-parity',
    title: 'MCP 回环 Host 覆盖全部业务路由',
    ok:
      result.ok &&
      report !== null &&
      report.missing.length === 0 &&
      report.extra.length === 0 &&
      report.duplicate === 0,
    report,
    ...result,
  })
}

// 4. 三端协议契约:三端出口存在,业务请求带 ACP 方法身份。
{
  const result = runNode('scripts/check-acp-three-end-contract.mjs')
  const match = result.stdout.match(/acp-three-end-contract (\{.*\})/)
  const report = match ? JSON.parse(match[1]) : null
  checks.push({
    id: 'acp-three-end-contract',
    title: 'web/RN/小程序共享同一份 ACP 契约',
    ok: result.ok && report !== null && report.problems === 0 && report.ends === 3,
    report,
    ...result,
  })
}

// 5. 协议字面量棘轮:除单源与测试外无第二份。
{
  const result = runNode('scripts/check-acp-method-single-source.mjs')
  checks.push({
    id: 'acp-method-single-source',
    title: 'ACP 方法名只有一份真相源',
    ok: result.ok && /state=ok/.test(result.stdout) && /越界=0/.test(result.stdout),
    ...result,
  })
}

// 6. R8 真机读数:直接读证据 JSON,不重新用单测冒充。
{
  const debug = readJson('docs/benchmark-evidence/2026-11/r8-real-window-selftest-2026-11-26.json')
  const release = readJson('docs/benchmark-evidence/2026-11/r8-release-window-selftest-2026-11-26.json')
  const valid = (data) =>
    data?.ok === true &&
    data?.authMode === 'real-login' &&
    data?.before?.height === 420 &&
    data?.collapsed?.height === 48 &&
    data?.expanded?.height === 420 &&
    data?.reopened?.height === 420 &&
    data?.heightDelta === 0
  checks.push({
    id: 'r8-real-window',
    title: '真实登录态 PIP 收起/展开/重开几何闭环',
    ok: valid(debug) && valid(release),
    debug: debug,
    release: release,
    exitCode: valid(debug) && valid(release) ? 0 : 1,
    stdout: '',
    stderr: '',
    durationMs: 0,
  })
}

const passed = checks.filter((check) => check.ok).length
const failed = checks.length - passed
const gitHead = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim()

const report = {
  schema: 'ihui-agent-safety-benchmark/v1',
  generatedAt: new Date().toISOString(),
  gitHead,
  scope: [
    '桌面命令暴露面',
    '生产窗口安全',
    'MCP 回环路由覆盖',
    '三端 ACP 契约',
    'ACP 字面量单一真相源',
    'R8 真实窗口几何',
  ],
  nonClaims: [
    '本报告不是第三方认证,也不含竞品排名。',
    '每个结论都由同仓脚本/证据 JSON 复算;第三方可克隆后复跑。',
    '不覆盖数据库、外网服务与真实用户流量。',
  ],
  summary: { total: checks.length, passed, failed, score: `${passed}/${checks.length}` },
  checks,
}

mkdirSync(dirname(outPath), { recursive: true })
writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
process.stdout.write(
  `ihui-agent-safety-benchmark ${JSON.stringify(report.summary)} head=${gitHead.slice(0, 8)} out=${outPath}\n`,
)
for (const check of checks) {
  process.stdout.write(`  ${check.ok ? '✅' : '❌'} ${check.id}\n`)
}
process.exit(failed === 0 ? 0 : 1)