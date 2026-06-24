/**
 * Element Plus 自动按需 import 重写插件
 * ----------------------------------------------------------------------------
 * 2026-06-24 优化：把 `import { ElXxx } from 'element-plus'` 改写为按需路径
 *   之前: import { ElMessage } from 'element-plus' (被静态分析拉入整个 element-plus 入口 ~1100KB)
 *   之后: import { ElMessage } from 'element-plus/es/components/message' (仅 message 模块 ~10KB)
 *
 * 适用：
 *   - 305 个 .vue/.ts 文件手动 import from 'element-plus'
 *   - unplugin-vue-components + ElementPlusResolver 只处理模板 <el-xxx> 标签，
 *     不会重写 setup 里的 import 语句。
 *   - 此插件作为兜底，对 setup 里的 import 也按需化。
 *
 * 命名映射规则：
 *   ElMessage      → element-plus/es/components/message
 *   ElMessageBox   → element-plus/es/components/message-box
 *   ElButton       → element-plus/es/components/button
 *   ElFormItem     → element-plus/es/components/form-item
 *   ElButtonGroup  → element-plus/es/components/button
 *   ElLoading      → element-plus/es/components/loading
 *   ElIcon         → element-plus/es/components/icon
 *
 * 不处理的：
 *   - 类型导入：import type { ElMessage } (不会产生运行时代码)
 *   - 默认导入：import EP from 'element-plus' (项目无此用法)
 *   - ElMessage2 等被排除的命名 (vite.config.ts 中 ElementPlusResolver exclude)
 *   - 整个 import 块中不含 El 前缀命名
 */
import type { Plugin } from 'vite'

const ELEMENT_PLUS_MODULE = /['"]element-plus['"]/
const EL_NAME_RE = /\bEl[A-Z][A-Za-z0-9]+\b/g

/** ElMessageBox → message-box, ElButton → button, ElFormItem → form-item */
function componentNameToPath(ElName: string): string {
  // 去掉 El 前缀
  const stripped = ElName.replace(/^El/, '')
  // 驼峰转连字符：MessageBox → message-box
  return stripped
    .replace(/([A-Z])/g, (m, _c, idx) => (idx === 0 ? m.toLowerCase() : '-' + m.toLowerCase()))
}

/**
 * 重写 import 语句
 *   import { ElMessage, ElButton as EB } from 'element-plus'
 *   → import { ElMessage } from 'element-plus/es/components/message'
 *     import { ElButton as EB } from 'element-plus/es/components/button'
 *
 * 如果包含别名 (as)，保持别名；不修改 ElMessage2 之类被排除的命名。
 */
function rewriteImport(code: string, excluded: RegExp): string {
  // 仅处理 "from 'element-plus'" 形式的 import
  // 跳过 type-only import
  const re = /import\s+(?!type\s)(?:\{([^}]+)\}|(\*\s+as\s+\w+)|(\w+))\s+from\s+(['"])element-plus\4/g
  let changed = false
  const result = code.replace(re, (_match, named, namespace, defaultName, quote) => {
    if (namespace || defaultName) {
      // import * as X / import X (default 导入) 不处理，保留原样
      return _match
    }
    // named imports
    const names = named.split(',').map((s: string) => s.trim()).filter(Boolean)
    if (names.length === 0) return _match

    // 收集所有命名，按目标路径分组
    const groups: Record<string, string[]> = {}
    let allExcluded = true
    for (const entry of names) {
      // entry 可能是 "ElMessage" 或 "ElButton as EB"
      const m = entry.match(/^(\w+)(?:\s+as\s+(\w+))?$/)
      if (!m) {
        allExcluded = false
        continue
      }
      const [_, origName, alias] = m
      if (!origName || !origName.startsWith('El')) {
        // 非 El 开头，跳过
        allExcluded = false
        continue
      }
      if (excluded.test(origName)) {
        // 被排除的命名（如 ElMessage2），保留原 import
        allExcluded = false
        continue
      }
      const path = componentNameToPath(origName)
      groups[path] = groups[path] || []
      groups[path].push(alias ? `${origName} as ${alias}` : origName)
      // 至少有一个有效的 El 命名就要改写
      if (allExcluded) allExcluded = false
    }

    if (allExcluded) return _match

    // 生成改写后的 import 块
    const lines = Object.entries(groups).map(
      ([path, items]) => `import { ${items.join(', ')} } from 'element-plus/es/components/${path}'`
    )
    changed = true
    return lines.join('\n')
  })

  return changed ? result : code
}

export function elementPlusOnDemand(options: { exclude?: RegExp } = {}): Plugin {
  const exclude = options.exclude ?? /^ElMessage2/
  return {
    name: 'element-plus-on-demand-rewrite',
    enforce: 'pre',
    transform(code, id) {
      // 仅处理 src/ 下的 .ts/.tsx/.js/.vue 文件
      if (!/\.[jt]sx?$|\.vue$/.test(id)) return null
      if (!id.includes('\\src\\') && !id.includes('/src/')) return null
      if (!ELEMENT_PLUS_MODULE.test(code)) return null
      // 排除 vite 配置等 build 文件
      if (id.includes('\\vite-plugins\\') || id.includes('/vite-plugins/')) return null
      if (id.includes('vite.config')) return null

      const newCode = rewriteImport(code, exclude)
      if (newCode === code) return null
      return {
        code: newCode,
        map: null,
      }
    },
  }
}
