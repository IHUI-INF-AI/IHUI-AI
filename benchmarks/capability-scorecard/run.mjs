// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 五层能力体检（本机可复现读数）。
 *
 * 这不是"跑个分好看"：每条检查都调用仓库里已有的硬判据测试，退出码非 0 就判红；
 * 没有真实检查来源的层（推理质量、感知真机）如实标 `unjudged`，不拿别的层顶替。
 *
 * 用法：node benchmarks/capability-scorecard/run.mjs [--json]
 * 产物：benchmarks/capability-scorecard/results/scorecard.json（不入库）
 */
/* eslint-disable no-console */
import { spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..', '..')
const resultsDir = join(here, 'results')

/** 一条检查：命令 + 计数解析 + 该层"为什么这么判"。 */
const checks = [
  {
    id: 'memory.restart-zero-reembed',
    layer: '记忆',
    cwd: join(root, 'apps', 'cli'),
    command: `${process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'} exec vitest run tests/memory-embedding-cache.test.ts tests/memory-hybrid-search.test.ts --reporter=dot`,
    parse: (out) => {
      const m = out.match(/Tests\s+(\d+) passed/)
      return m ? { passed: Number(m[1]), failed: 0 } : null
    },
    evidence: '重启后 chunk 向量来自磁盘、只 embed query；坏缓存/换模型/TTL 均有判据',
  },
  {
    id: 'agent.baseline-9cases',
    layer: '规划与反思',
    cwd: root,
    command: 'node benchmarks/agent-capability/run.mjs',
    parse: (out) => {
      const m = out.match(/用例\s+(\d+)（失败\s+(\d+)）/)
      return m ? { passed: Number(m[1]) - Number(m[2]), failed: Number(m[2]) } : null
    },
    evidence: '工具配对/压缩/续跑/错误恢复四类行为，录制回放且基线逐字段比对',
  },
  {
    id: 'sandbox.low-integrity-real-process',
    layer: '工具执行',
    cwd: join(root, 'apps', 'desktop', 'src-tauri'),
    command: 'C:\\caches\\cargo\\bin\\cargo.exe test --lib sandbox -- --test-threads=1',
    parse: (out) => {
      const m = out.match(/test result: ok\.\s+(\d+) passed/)
      return m ? { passed: Number(m[1]), failed: 0 } : null
    },
    evidence: '低完整性进程可启动/可读 stdout/AppContainer 令牌真阻断网络/写中完整性路径被拒/Job 终止整树',
  },
  {
    id: 'toolhost.process-separation-rpc',
    layer: '工具执行',
    cwd: join(root, 'apps', 'desktop', 'src-tauri'),
    command: 'C:\\caches\\cargo\\bin\\cargo.exe test --test tool_host -- --test-threads=1',
    parse: (out) => {
      const m = out.match(/test result: ok\.\s+(\d+) passed/)
      return m ? { passed: Number(m[1]), failed: 0 } : null
    },
    evidence: '真子进程 + 命名管道 + token 握手 + 双键幂等重放 + AppContainer/继承档写盘边界 + AppContainer 网络阻断 + Manager 重启 + 安装布局查找 + 超时收口',
  },
  {
    id: 'toolhost.desktop-git-business',
    layer: '工具执行',
    cwd: join(root, 'apps', 'desktop', 'src-tauri'),
    command: 'C:\\caches\\cargo\\bin\\cargo.exe test --lib git_tool_host_runner_tests -- --test-threads=1',
    parse: (out) => {
      const m = out.match(/test result: ok\.\s+(\d+) passed/)
      return m ? { passed: Number(m[1]), failed: 0 } : null
    },
    evidence: '桌面正常业务 git 通道（git_workspace_status）经 tool-host inherit 档执行 git status，临时仓库返回 facts',
  },
  {
    id: 'toolhost.cli-foreground-dual-key',
    layer: '工具执行',
    cwd: join(root, 'apps', 'cli'),
    command: `${process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'} exec vitest run tests/tool-host-client.test.ts tests/task-workspace-session.test.ts --reporter=dot`,
    env: { IHUI_TOOL_HOST_EXE: join(root, 'apps', 'desktop', 'src-tauri', 'resources', 'tool-host', 'ihui-tool-host.exe') },
    parse: (out) => {
      const m = out.match(/Tests\s+(\d+) passed/)
      return m ? { passed: Number(m[1]), failed: 0 } : null
    },
    evidence: 'CLI 消费方：同 turnId|toolCallId 重试只执行一次、ToolContext 双键命中宿主缓存、显式 IHUI_TOOL_HOST_FOREGROUND=1 时 run_command 真走宿主、AppContainer 档 ping 断网、TaskPrepare Git/非 Git 副本写入→diff→publish 全链路（含源改动拒绝覆盖）',
  },
  {
    id: 'toolhost.mcp-client-relay',
    layer: '工具执行',
    cwd: join(root, 'apps', 'cli'),
    command: `${process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'} exec vitest run tests/mcp-tool-host.test.ts --reporter=dot`,
    env: { IHUI_TOOL_HOST_EXE: join(root, 'apps', 'desktop', 'src-tauri', 'resources', 'tool-host', 'ihui-tool-host.exe') },
    parse: (out) => {
      const m = out.match(/Tests\s+(\d+) passed/)
      return m ? { passed: Number(m[1]), failed: 0 } : null
    },
    evidence: 'MCP stdio 子进程归宿主拉起：initialize/tools/list/tools/call 全链路经 loopback relay 可用，isError 只失败结果不标死连接',
  },
]

/** 没有本机硬判据来源的层：如实 unjudged，不用相邻层冒充。 */
const unjudged = [
  {
    layer: '推理大脑',
    reason: '只有路由/准入单测，没有模型质量评测；要真分数需外部模型 key（本轮未充值、未订阅）',
  },
  {
    layer: '感知',
    reason: '截图/OCR/浏览器链路需要真实桌面会话与 GUI，本脚本不在无人值守环境伪造通过',
  },
]

function runCheck(check) {
  const started = Date.now()
  const res = spawnSync(check.command, {
    cwd: check.cwd,
    shell: true,
    encoding: 'utf8',
    timeout: 15 * 60 * 1000,
    env: { ...process.env, ...(check.env || {}) },
  })
  const out = `${res.stdout || ''}\n${res.stderr || ''}`
  // vitest/cargo 会打 ANSI 颜色；不剥掉就会把 "Tests 37 passed" 拆成带控制码的串
  const plain = out.replace(/\x1b\[[0-9;]*m/g, '')
  const parsed = check.parse(plain)
  return {
    id: check.id,
    layer: check.layer,
    evidence: check.evidence,
    exitCode: res.status,
    durationMs: Date.now() - started,
    ...(parsed || { passed: 0, failed: 1 }),
    ok: res.status === 0 && !!parsed && parsed.failed === 0,
    tail: res.status === 0 ? undefined : plain.trim().split('\n').slice(-8).join('\n'),
  }
}

function main() {
  const onlyJson = process.argv.includes('--json')
  const records = checks.map(runCheck)
  const totals = records.reduce(
    (acc, r) => ({ passed: acc.passed + r.passed, failed: acc.failed + r.failed }),
    { passed: 0, failed: 0 },
  )
  const scorecard = {
    generatedAt: new Date().toISOString(),
    commit: spawnSync('git rev-parse HEAD', { cwd: root, shell: true, encoding: 'utf8' }).stdout?.trim() || null,
    totals,
    records,
    unjudged,
    externalLeaderboard: {
      status: 'not_run',
      reason: 'SWE-bench Verified / Terminal-Bench / GAIA 需要数据集 + 可用模型凭据；本机未配置，拒绝编造分数',
    },
  }
  mkdirSync(resultsDir, { recursive: true })
  writeFileSync(join(resultsDir, 'scorecard.json'), `${JSON.stringify(scorecard, null, 2)}\n`, 'utf-8')

  if (onlyJson) {
    process.stdout.write(`${JSON.stringify(scorecard, null, 2)}\n`)
    return
  }
  console.log(`五层能力体检 · ${scorecard.commit?.slice(0, 12) ?? 'unknown'}`)
  for (const r of records) {
    console.log(
      `${r.ok ? 'PASS' : 'FAIL'}  ${r.layer.padEnd(6)} ${r.id}  ${r.passed}/${r.passed + r.failed}  ${(r.durationMs / 1000).toFixed(1)}s`,
    )
  }
  for (const u of unjudged) console.log(`UNJUDGED  ${u.layer}  ${u.reason}`)
  console.log(`外部榜：${scorecard.externalLeaderboard.status}（${scorecard.externalLeaderboard.reason}）`)
  console.log(`产物：${join(resultsDir, 'scorecard.json')}`)
}

main()
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
