/**
 * exclude-dirs.mjs — 守门脚本共享的排除目录清单
 *
 * 背景(2026-07-27 立,批次 8-P2 工程治理技术债):
 *   原 check-parent-pollution.mjs / check-workspace-hygiene.mjs / check-rounded-full.mjs /
 *   check-i18n-namespace-passing.mjs 各自维护 EXCLUDED_DIRS / EXCLUDE_DIRS 常量,
 *   内容大同小异,新增目录(如 .turbo)时需要多处同步修改,易漏。
 *
 * 设计:
 *   - 导出 EXCLUDE_DIRS(只读 Set):守门脚本通用的"安全排除目录"
 *     (构建产物 / 依赖 / IDE / Python 虚拟环境等),任何守门脚本都可直接复用
 *   - 导出 withExcludes(extra):在 EXCLUDE_DIRS 基础上追加脚本特有排除目录,
 *     返回新 Set,不影响共享常量
 *
 * 注意:
 *   - `.trae-cn` 不在通用 EXCLUDE_DIRS 中(check-workspace-hygiene.mjs 需要
 *     扫描 .trae-cn/tmp/,只跳过 archive/memory 子目录),需排除时由脚本自行追加
 *   - `tests` / `__tests__` / `e2e` 等测试目录也不在通用清单中,
 *     由具体脚本按需追加(check-rounded-full / check-i18n-namespace-passing 排除,
 *     check-workspace-hygiene 不排除以扫描测试文件)
 *   - 本模块零依赖,只用 Node.js 内置 API
 *
 * 用法:
 *   import { EXCLUDE_DIRS, withExcludes } from './lib/exclude-dirs.mjs'
 *   const EXCLUDED = withExcludes(['tests', '__tests__', '.trae-cn'])
 */

const EXCLUDE_DIRS = Object.freeze(new Set([
  // 依赖
  'node_modules',
  // 版本控制
  '.git',
  // 构建产物
  'dist', 'build', 'out', '.output', '.next', '.turbo', '.wxt',
  // 测试覆盖率
  'coverage',
  // 缓存
  '.cache',
  // Python 虚拟环境 / 缓存
  '.venv', 'venv', '__pycache__', '.pytest_cache',
  // IDE 配置
  '.vscode', '.idea',
  // 工作树(git worktree)
  '.worktrees',
]))

/**
 * 在 EXCLUDE_DIRS 基础上追加脚本特有排除目录,返回新 Set。
 * @param {string[]} [extra] 额外排除目录名
 * @returns {Set<string>}
 */
function withExcludes(extra) {
  const s = new Set(EXCLUDE_DIRS)
  if (Array.isArray(extra)) {
    for (const e of extra) s.add(e)
  }
  return s
}

export { EXCLUDE_DIRS, withExcludes }
