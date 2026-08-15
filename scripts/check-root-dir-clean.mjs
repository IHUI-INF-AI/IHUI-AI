#!/usr/bin/env node
/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
/**
 * 根目录整洁守门 — 防止乱七八糟文件在一级目录下随意生成/放置。
 *
 * 依据 AGENTS.md「根目录整洁铁律」(强制):
 *   一级目录只允许保留白名单内的配置文件 / 标准文档 / 项目强制文档 / 固定目录。
 *   任何新文件 / 新目录 / 新隐藏文件落地根目录,均触发本守门,commit 时阻断。
 *
 * 白名单在本文件内维护(4 组 Set),封闭集合。新增合法条目必须显式把条目加进白名单
 * 并随 commit 一起提交,视为"显式审批"。禁止以「看起来无害」为由跳过白名单。
 *
 * 用法:
 *   node scripts/check-root-dir-clean.mjs --staged   (pre-commit 模式,违规 exit 1)
 *   node scripts/check-root-dir-clean.mjs             (报告模式,违规仍 exit 0)
 *
 * 判定对象:一级目录(非递归)。二级目录内容(如 tmp/*、logs/*、node_modules/*)不在本
 * 守门范围,由 .gitignore 与各自的临时产物目录语义兜底。
 */
import { readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()
const isStaged = process.argv.includes('--staged')

// 逃生舱(应急跳过,默认不推荐,与 check-pwsh-version 等守门脚本一致)
if (process.env.HUSKY_SKIP_ROOT_DIR_GUARD === '1') {
  console.log('  ⏭  根目录整洁守门(HUSKY_SKIP_ROOT_DIR_GUARD=1, 跳过)')
  process.exit(0)
}

// ============================================================================
// 白名单(一级目录合法条目,封闭集合)
// ============================================================================

/** 根目录合法文件(配置 + 标准文档 + 项目强制文档) */
const ALLOWED_FILES = new Set([
  // 项目强制文档
  'AGENTS.md',
  'PROJECT_PLAN.md',
  // 开源标准文档(GitHub 官方识别)
  'README.md',
  'README.en.md',
  'README.ja.md',
  'README.ko.md',
  'LICENSE',
  'SECURITY.md',
  'CONTRIBUTING.md',
  'CODE_OF_CONDUCT.md',
  // 构建 / 工具配置
  'package.json',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
  'turbo.json',
  'eslint.config.mjs',
  'tsconfig.base.json',
  'knip.jsonc',
  // 部署配置
  'docker-compose.yml',
  'railway.json',
  'render.yaml',
  'app.json',
  // 守门脚本产物
  '__gate_result.txt',
])

/** 根目录合法目录(monorepo 标准结构 + 运行时目录) */
const ALLOWED_DIRS = new Set([
  'apps',
  'packages',
  'scripts',
  'docs',
  'deploy',
  'monitoring',
  'reports',
  'sdks',
  'cert',
  'products',
  'logs',
  'node_modules',
  'tmp',
  'test-results',
])

/** 合法隐藏文件(.env / .gitignore 等) */
const ALLOWED_HIDDEN_FILES = new Set([
  '.actrc',
  '.check-api-routes-ignore.json',
  '.dockerignore',
  '.editorconfig',
  '.env.act',
  '.env.example',
  '.env.production.example',
  '.gitattributes',
  '.gitignore',
  '.npmrc',
  '.prettierignore',
  '.prettierrc',
  '.secrets.act.example',
])

/** 合法隐藏目录(git / IDE / 工具 / 运行时锁) */
const ALLOWED_HIDDEN_DIRS = new Set([
  '.git',
  '.github',
  '.husky',
  '.ihui',
  '.pnpm-store',
  '.qoder',
  '.trae',
  '.trae-cn',
  '.trae-html-share-packages',
  '.turbo',
  '.vscode',
  '.workbuddy',
  '.deploy.lock',
])

// ============================================================================
// 扫描
// ============================================================================

const violations = []

for (const name of readdirSync(ROOT)) {
  const isHidden = name.startsWith('.')
  const isDir = statSync(join(ROOT, name)).isDirectory()

  if (isHidden) {
    if (isDir) {
      if (!ALLOWED_HIDDEN_DIRS.has(name)) violations.push({ name, kind: '隐藏目录' })
    } else if (!ALLOWED_HIDDEN_FILES.has(name)) {
      violations.push({ name, kind: '隐藏文件' })
    }
  } else if (isDir) {
    if (!ALLOWED_DIRS.has(name)) violations.push({ name, kind: '目录' })
  } else if (!ALLOWED_FILES.has(name)) {
    violations.push({ name, kind: '文件' })
  }
}

// ============================================================================
// 输出
// ============================================================================

if (violations.length === 0) {
  console.log('  ✅ 根目录整洁守门通过:一级目录无白名单外条目')
  process.exit(0)
}

console.error('❌ 根目录整洁守门失败:一级目录存在白名单外条目')
for (const v of violations) {
  console.error(`   - ${v.name}  (${v.kind})`)
}
console.error('')
console.error('  💡 处置(二选一):')
console.error('     1. 临时/垃圾产物 → 删除,或移入 tmp/ 或 logs/')
console.error('     2. 合法新增(新配置/新文档/新目录) → 加入 scripts/check-root-dir-clean.mjs 白名单后重新 commit')
console.error('')
console.error('  禁止在一级目录随意生成 .log / .html / cookies / 截图 / ad-hoc 脚本。')

process.exit(isStaged ? 1 : 0)
