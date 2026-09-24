import { execSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'

const out = []
const log = (s) => {
  out.push(s)
  console.log(s)
}
const run = (label, cmd) => {
  try {
    const o = execSync(cmd, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, windowsHide: true, timeout: 1500000 })
    log(`OK   ${label} :: ${(o.trim().split('\n').slice(-3).join(' | ')) || '(无输出)'}`)
  } catch (e) {
    const o = ((e.stdout || '') + '\n' + (e.stderr || '')).toString().trim()
    log(`FAIL ${label} (exit ${e.status})\n${o.split('\n').slice(-16).map((l) => '     ' + l).join('\n')}`)
  }
  writeFileSync('.ihui-agent/tmp/plan-audit/verify-tests.txt', out.join('\n'), 'utf8')
}

run('cli vitest terminal-delta+terminal+policy', 'pnpm --filter @ihui/cli exec vitest run tests/terminal-delta.test.ts tests/terminal.test.ts tests/command-policy.test.ts 2>&1')
run('extension vitest terminal-delta', 'pnpm --filter @ihui/extension exec vitest run tests/terminal-delta.test.tsx 2>&1')
run('web vitest D83 两测', 'pnpm --filter @ihui/web exec vitest run src/components/ai/__tests__/task-status-bar-mcp-activity.test.tsx src/components/ai/__tests__/tool-call-card-mcp-activity.test.tsx 2>&1')
run('miniapp vitest tool-line-mcp', 'pnpm --filter @ihui/miniapp-taro exec vitest run tests/tool-line-mcp.test.ts 2>&1')
run('shared vitest 全量', 'pnpm --filter @ihui/shared exec vitest run 2>&1')
