import { execSync } from 'node:child_process'
const sh = (c) => {
  try {
    return execSync(c, { encoding: 'utf8', maxBuffer: 128 * 1024 * 1024, windowsHide: true })
  } catch {
    return ''
  }
}
const SETS = {
  D19: ['terminal_delta', 'onTerminalDelta', 'terminalDelta', 'TerminalDelta', 'sse-dispatch', 'D19', 'foldTerminalDelta', 'takeTerminalDeltaLines', 'iteration', 'baseline'],
  D83: ['describeMcpToolActivity', 'mcp', 'Mcp', 'MCP', 'serverName', 'D83', 'toolActivityState', 'activityState', '双时态', 'server'],
  D17: ['ecosystem', 'Ecosystem', 'D17', 'expert', 'Expert', 'LayoutGrid', 'group'],
  D16: ['route', 'Router', 'router', 'budget', 'LLM_MODEL_ROUTER', 'D16', 'candidate', '_apply_cost_aware_routing', 'from_catalog', 'wiring'],
  MINE: ['O60', 'command-policy', 'isAutoApprovableCommand', 'yolo', 'YOLO'],
}
const FILES = {
  D19: [
    'apps/extension/entrypoints/sidepanel/pages/ChatPage.tsx',
    'apps/extension/tests/terminal-delta.test.tsx',
    'apps/cli/src/commands/agent.ts',
    'apps/cli/src/commands/repl.ts',
    'apps/cli/tests/terminal-delta.test.ts',
    'scripts/data/sse-dispatch-coverage.json',
    'scripts/tests/check-sse-dispatch-parity.test.mjs',
  ],
  D83: [
    'apps/web/src/components/ai/task-status-bar.tsx',
    'apps/web/src/components/ai/tool-call-card.tsx',
    'apps/miniapp-taro/src/pkg-ai/ai/cards/tool-line.ts',
    'apps/miniapp-taro/src/pkg-ai/ai/cards/types.ts',
    'apps/miniapp-taro/src/pkg-ai/ai/chat.tsx',
    'apps/web/src/components/ai/__tests__/task-status-bar-mcp-activity.test.tsx',
    'apps/web/src/components/ai/__tests__/tool-call-card-mcp-activity.test.tsx',
    'apps/miniapp-taro/tests/tool-line-mcp.test.ts',
  ],
  D17: ['apps/web/src/components/sidebar/nav-data.ts', 'apps/web/app/(main)/ecosystem/page.tsx', 'apps/web/src/components/ecosystem/ecosystem-hub.tsx'],
  D16: ['apps/ai-service/app/core/llm_gateway.py', 'apps/ai-service/tests/test_model_router_wiring.py', 'apps/ai-service/.env.example'],
  MINE: ['apps/cli/src/commands/settings.ts'],
}
for (const [k, files] of Object.entries(FILES)) {
  console.log(`\n## ${k}`)
  for (const f of files) {
    const tracked = sh(`git ls-files -- "${f}"`).trim() !== ''
    let added
    let stat
    if (tracked) {
      const d = sh(`git diff -U0 -- "${f}" 2>&1`)
      added = d.split('\n').filter((l) => l.startsWith('+') && !l.startsWith('+++'))
      stat = sh(`git diff --numstat -- "${f}"`).trim() || '(无改动)'
    } else {
      // 未跟踪新文件:git diff 看不到内容,必须读磁盘,否则会把"新写的整份文件"误判成 0 行
      added = sh(`cat -- "${f}" 2>/dev/null`).split('\n').map((l) => '+' + l)
      stat = `new ${added.length}L`
    }
    const kw = SETS[k]
    const mine = added.filter((l) => kw.some((w) => l.includes(w)))
    const rest = added.filter((l) => !kw.some((w) => l.includes(w)) && l.replace(/[+]\s*/, '').trim().length > 0)
    console.log(`  ${stat.padEnd(14)} ${f}  可归因 ${mine.length}/${added.length}`)
    if (rest.length > 4) console.log('     不明样本: ' + rest.slice(0, 4).map((l) => l.trim().slice(0, 72)).join(' ⏎ '))
  }
}
