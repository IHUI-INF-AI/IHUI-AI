import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'

const out = []
const log = (s) => {
  out.push(s)
  console.log(s)
}
const run = (label, args, opts = {}) => {
  try {
    const o = execFileSync('node', args, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, windowsHide: true, timeout: 900000, ...opts })
    log(`OK   ${label} :: ${o.trim().split('\n').slice(-2).join(' | ')}`)
  } catch (e) {
    const o = ((e.stdout || '') + (e.stderr || '')).toString()
    log(`FAIL ${label} (exit ${e.status}) :: ${o.trim().split('\n').slice(-6).join(' | ')}`)
  }
}
const sh = (label, cmd, args) => {
  try {
    const o = execFileSync(cmd, args, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, windowsHide: true, timeout: 900000 })
    log(`OK   ${label} :: ${o.trim().split('\n').slice(-3).join(' | ')}`)
  } catch (e) {
    const o = ((e.stdout || '') + (e.stderr || '')).toString()
    log(`FAIL ${label} (exit ${e.status}) :: ${o.trim().split('\n').slice(-8).join(' | ')}`)
  }
}

sh('cli vitest(terminal-delta+policy)', 'pnpm', ['--filter', '@ihui/cli', 'exec', 'vitest', 'run', 'tests/terminal-delta.test.ts', 'tests/terminal.test.ts', 'tests/command-policy.test.ts'])
sh('extension vitest(terminal-delta)', 'pnpm', ['--filter', '@ihui/extension', 'exec', 'vitest', 'run', 'tests/terminal-delta.test.tsx'])
sh('shared vitest(tool-display+mcp)', 'pnpm', ['--filter', '@ihui/shared', 'exec', 'vitest', 'run'])
sh('web vitest(D83 新测)', 'pnpm', ['--filter', '@ihui/web', 'exec', 'vitest', 'run', 'src/components/ai/__tests__/task-status-bar-mcp-activity.test.tsx', 'src/components/ai/__tests__/tool-call-card-mcp-activity.test.tsx'])
sh('miniapp vitest(D83 新测)', 'pnpm', ['--filter', '@ihui/miniapp-taro', 'exec', 'vitest', 'run', 'tests/tool-line-mcp.test.ts'])

run('门 55 工具名覆盖', ['scripts/check-tool-name-display-coverage.mjs'])
run('门 56 措辞可解析', ['scripts/check-tool-display-resolvable.mjs'])
run('门 90 sse dispatch parity', ['scripts/check-sse-dispatch-parity.mjs'])
run('门 90 镜像测试', ['--test', 'scripts/tests/check-sse-dispatch-parity.test.mjs'])
run('门 74 词表可解析', ['scripts/check-word-table-resolvable.mjs'])
run('门 57 对话流元素覆盖', ['scripts/check-chat-element-coverage.mjs'])
run('门 89 接线对账', ['scripts/check-gate-wiring.mjs'])
run('门 79 冲突标记(提交树)', ['scripts/check-no-conflict-markers.mjs', '--rev', 'HEAD'])
run('守门 71 计划登记行', ['scripts/check-plan-line-loss.mjs', '--self-test'])
run('门 77 圆角自测', ['scripts/check-radius-single-source.mjs', '--self-test'])
sh('watermark verify', 'node', ['scripts/watermark.mjs', 'verify'])
sh('i18n 键 parity', 'node', ['scripts/check-i18n-keys.mjs'])
sh('nav 死链', 'node', ['scripts/check-nav-dead-links.mjs'])

writeFileSync('.ihui-agent/tmp/plan-audit/verify-gates.txt', out.join('\n'), 'utf8')
