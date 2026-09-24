import { execSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'

const out = []
const log = (s) => {
  out.push(s)
  console.log(s)
}
const run = (label, cmd) => {
  try {
    const o = execSync(cmd, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, windowsHide: true, timeout: 1200000, stdio: ['ignore', 'pipe', 'pipe'] })
    log(`OK   ${label} :: ${o.trim().split('\n').slice(-3).join(' | ') || '(无输出)'}`)
  } catch (e) {
    const o = ((e.stdout || '') + '\n' + (e.stderr || '')).toString().trim()
    log(`FAIL ${label} (exit ${e.status})\n     ${o.split('\n').slice(-14).join('\n     ')}`)
  }
  writeFileSync('.ihui-agent/tmp/plan-audit/verify-typecheck.txt', out.join('\n'), 'utf8')
}

run('typecheck @ihui/cli', 'pnpm --filter @ihui/cli typecheck 2>&1')
run('typecheck @ihui/extension', 'pnpm --filter @ihui/extension typecheck 2>&1')
run('typecheck @ihui/shared', 'pnpm --filter @ihui/shared typecheck 2>&1')
run('typecheck @ihui/api', 'pnpm --filter @ihui/api typecheck 2>&1')
run('typecheck @ihui/web', 'pnpm --filter @ihui/web typecheck 2>&1')
run('typecheck @ihui/miniapp-taro', 'pnpm --filter @ihui/miniapp-taro typecheck 2>&1')
