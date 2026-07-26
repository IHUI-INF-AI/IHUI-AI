#!/usr/bin/env node
/**
 * Staged pollution 自动检测(2026-07-26 立,工程债 #12).
 * 防止 commit 时混入预期文件清单外的 staged 文件.
 *
 * 用法:
 *   node scripts/check-staged-pollution.mjs
 *   node scripts/check-staged-pollution.mjs --expected packages/i18n/messages/web/zh-CN.json
 *   node scripts/check-staged-pollution.mjs --expected file1 --expected file2
 *   node scripts/check-staged-pollution.mjs --help
 *
 * 退出码:
 *   0 = 通过(无 --expected 清单,或 staged 全部在预期内)
 *   1 = 发现非预期文件
 *
 * 设计:
 *   - 默认跳过(无 --expected 清单):不挂 pre-commit,允许自由提交
 *   - CI / 多 agent 协调场景:显式传 --expected 清单,严格守门
 *   - 路径匹配精确,不做 normalize(避免 ../ 等绕过)
 */
import { execSync } from 'node:child_process'

const args = process.argv.slice(2)
const expected = []
let help = false

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--expected') {
    const v = args[++i]
    if (!v) {
      console.error('❌ --expected 需要一个文件路径参数')
      process.exit(2)
    }
    expected.push(v)
  } else if (args[i] === '--help' || args[i] === '-h') {
    help = true
  }
}

if (help) {
  console.log(`check-staged-pollution.mjs — Staged pollution 自动检测(2026-07-26)

用法:
  node scripts/check-staged-pollution.mjs                              # 默认跳过(无 --expected)
  node scripts/check-staged-pollution.mjs --expected <file1>          # 严格守门:仅允许该文件
  node scripts/check-staged-pollution.mjs --expected <f1> --expected <f2>  # 允许多个
  node scripts/check-staged-pollution.mjs --help

退出码:
  0 = 通过
  1 = 发现非预期文件
  2 = 用法错误

用途:
  - 多 agent 并行提交时,显式约束本任务只能 commit 预期文件
  - CI 流水线:在 pre-job 阶段调用,防止其他 agent 改动混入本任务 commit
`)
  process.exit(0)
}

if (expected.length === 0) {
  console.log('✅ check-staged-pollution: 无 --expected 清单,跳过(自由提交模式)')
  process.exit(0)
}

let stagedRaw
try {
  stagedRaw = execSync('git diff --cached --name-only', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] })
} catch (e) {
  console.error('❌ 无法读取 git staged 列表(可能不在 git 仓库中)')
  console.error(`   ${e.message}`)
  process.exit(2)
}

const staged = stagedRaw.split('\n').filter(Boolean)
const polluted = staged.filter((f) => !expected.includes(f))

if (polluted.length > 0) {
  console.error(`❌ Staged pollution 检测到 ${polluted.length} 个非预期文件:`)
  for (const f of polluted) console.error(`  - ${f}`)
  console.error('')
  console.error('预期清单(本任务允许的 staged 文件):')
  for (const f of expected) console.error(`  ✓ ${f}`)
  console.error('')
  console.error('如需取消 staged 多余文件:')
  console.error('  git restore --staged <file>')
  console.error('或调整 --expected 清单覆盖实际需要提交的文件')
  process.exit(1)
}

console.log(`✅ Staged pollution 检查通过(${staged.length} 个文件全部在预期清单内)`)
process.exit(0)
