#!/usr/bin/env node
/**
 * 打印 staged 文件清单(info-only)。
 * commit 前最后看一眼 staged 清单,杜绝"混入其他 agent 改动"污染事故。
 * 与第 19 项 check-staged-pollution 互补:19 是跨端超阈值 warn,23 是无条件打印清单。
 * 始终 exit 0,不影响其他守门。
 */
import { execSync } from 'node:child_process'

let staged = []
try {
  const out = execSync('git diff --cached --name-only', { encoding: 'utf8' })
  staged = out.split('\n').filter(Boolean)
} catch {
  // git 命令失败不阻塞 commit
}

if (staged.length === 0) {
  console.log('  ℹ️  暂无 staged 文件')
} else {
  console.log(`  ℹ️  staged 文件清单(${staged.length} 个):`)
  for (const f of staged) {
    console.log(`     - ${f}`)
  }
}
process.exit(0)
