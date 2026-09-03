#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


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
import { execFileSync } from 'node:child_process'
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
  // /goal 模式运行时文件(AGENTS.md §1 唯一例外条款:goal-runtime 状态与运行日志)
  'STATE.md',
  'loop-run-log.md',
  // 2026-09-03 显式审批:/goal 模式「远超对标程序」路线图权威收敛文档(创建 2026-09-03,
  // 长期存在的合法一级文档;若后续要求严格结构可迁至 .trae-cn/goal-runtime/)
  'GAP-PLAN.md',
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
  // 既有跟踪脚本(chat 消息 key 校验,git 跟踪保证合法)
  'check-chat-keys.js',
  // 测试临时产物(Pytest quick fail 日志,后台进程持有)
  'tmp-qfr-err.log',
  'tmp-qfr-out.log',
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
  // 2026-09-03 显式审批:评测基准套件(run.mjs/gen.mjs/tasks/reports),长期存在的合法一级目录
  'benchmarks',
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
  // 2026-08-19 立:React Native C++ native 模块编译 staging 产物
  // (expo-modules-core / react-native-reanimated / react-native-screens 构建自动生成,
  //  已被 .gitignore 忽略,不参与 git 跟踪。不加入会在每次 C++ 构建后阻塞 commit)
  '.cxx-modules-staging',
  '.cxx-worklets-staging',
])

// ============================================================================
// 精确豁免(2026-09-03)
//
// 背景:守门原只按白名单硬匹配,导致两类「合法且必然存在」的一级条目被误报,
//       使所有人 commit 被无谓阻塞(曾连撞 .next + .wt6):
//   ① .next —— 已在 .gitignore 且 git 未跟踪的构建产物(跑过 next dev/build 必有);
//   ② .wt6  —— git worktree 目录,而 AGENTS.md §12d 明确鼓励用 worktree 做多会话隔离,
//              守门把它当垃圾目录与项目规范自相矛盾。
// 判定一律走 git 官方机制(check-ignore / worktree list),不靠名字猜测:
//   仍被拦截的是「未忽略、非 worktree 的白名单外条目」,即真正的随手垃圾。
// ============================================================================

/** git 已忽略的一级条目(.gitignore 覆盖 → 不参与跟踪,不该阻塞 commit) */
function getIgnoredEntries(names) {
  try {
    const out = execFileSync('git', ['-C', ROOT, 'check-ignore', '--stdin', '-z'], {
      input: names.join('\0'),
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore'],
    })
    return new Set(out.split('\0').filter(Boolean))
  } catch {
    // check-ignore 无匹配时 exit 1;git 不可用同理 → 空集合(维持原拦截行为)
    return new Set()
  }
}

/** git worktree 注册目录(仅取一级子目录,主 worktree 自身不计) */
function getWorktreeDirNames() {
  try {
    const out = execFileSync('git', ['-C', ROOT, 'worktree', 'list', '--porcelain'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
    const rootPosix = ROOT.split('\\').join('/')
    const names = new Set()
    for (const line of out.split('\n')) {
      if (!line.startsWith('worktree ')) continue
      const p = line.slice('worktree '.length).trim().split('\\').join('/')
      if (p === rootPosix) continue // 主 worktree 自身
      if (!p.startsWith(rootPosix + '/')) continue // 仓库外的 worktree,不在一级目录范围
      const rel = p.slice(rootPosix.length + 1)
      if (rel && !rel.includes('/')) names.add(rel)
    }
    return names
  } catch {
    return new Set()
  }
}

// ============================================================================
// 扫描
// ============================================================================

const entries = readdirSync(ROOT)
const ignoredEntries = getIgnoredEntries(entries)
const worktreeDirs = getWorktreeDirNames()

const violations = []

for (const name of entries) {
  // 精确豁免:git 已忽略的产物 / git worktree 注册目录(见上「精确豁免」注释)
  if (ignoredEntries.has(name) || worktreeDirs.has(name)) continue

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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
