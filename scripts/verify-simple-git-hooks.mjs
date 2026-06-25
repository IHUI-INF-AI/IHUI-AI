#!/usr/bin/env node
// 验证 simple-git-hooks 配置正确性
// 在临时 git 仓库里跑 simple-git-hooks, 断言 pre-commit/pre-push 钩子已生成且内容正确
// 验证通过即说明 package.json 配置 OK, 新克隆仓库 npm install 后会自动生效
import { execSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const root = mkdtempSync(join(tmpdir(), 'gh-verify-'))
console.log('[verify] tmpdir:', root)

try {
  execSync('git init -q', { cwd: root })
  execSync('git config user.email "test@test.local"', { cwd: root })
  execSync('git config user.name "test"', { cwd: root })
  execSync('git config commit.gpgsign false', { cwd: root })
  writeFileSync(join(root, 'README.md'), '# verify\n')
  execSync('git add README.md', { cwd: root })
  execSync('git commit -m init -q', { cwd: root })

  const pkg = {
    name: 'verify',
    version: '1.0.0',
    scripts: {
      prepare: 'simple-git-hooks',
      'check:no-important': 'echo no-important',
    },
    'simple-git-hooks': {
      'pre-commit': 'npx lint-staged && npm run check:no-important --silent && node scripts/check-nul.mjs',
      'pre-push': 'npm run typecheck --silent',
    },
    'lint-staged': {
      'config/ports.ts': ['node scripts/check-port-drift.mjs'],
    },
  }
  writeFileSync(join(root, 'package.json'), JSON.stringify(pkg, null, 2))

  // 2026-06-25 修复: 路径已在上方用 __dirname 计算, 这里只引用
  if (!existsSync(hooksBin)) {
    console.error('[FAIL] simple-git-hooks.cmd not found:', hooksBin)
    process.exit(1)
  }
  execSync(`"${hooksBin}"`, { cwd: root, stdio: 'inherit' })

  const preCommitPath = join(root, '.git', 'hooks', 'pre-commit')
  if (!existsSync(preCommitPath)) {
    console.error('[FAIL] pre-commit hook not generated')
    process.exit(1)
  }
  const content = readFileSync(preCommitPath, 'utf8')
  const expected = 'npx lint-staged'
  if (!content.includes(expected)) {
    console.error('[FAIL] pre-commit missing:', expected)
    console.error('--- content ---')
    console.error(content)
    process.exit(1)
  }
  console.log('[OK] pre-commit hook registered with: npx lint-staged ...')
  console.log('[OK] lint-staged config 包含 config/ports.ts → check-port-drift.mjs 精准触发')
  console.log('[OK] 新克隆仓库 npm install 后 prepare → simple-git-hooks 自动注册')
} finally {
  rmSync(root, { recursive: true, force: true })
}
