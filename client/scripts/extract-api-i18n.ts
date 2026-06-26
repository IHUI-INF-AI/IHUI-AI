/**
 * 一次性脚本: 从 src/api/ 下所有 .ts 文件提取 t('api.xxx.yyy') 调用,
 * 生成 5 个语言版本的 locales/modules/{locale}/api.json.
 *
 * 设计: api.* key 的"键名"本身就是中文 (例如 api.agents.操作成功),
 *       这是项目历史欠账 (Chinese-literal-as-key 模式). 正确做法是:
 *       改成 api.agents.opSuccess 这种英文 key + 翻译值, 但全量重构
 *       涉及 ~9000 个 t() 调用, 风险大. 折中方案: 把这些 key 当作
 *       "内容数据" 整体迁到 api.json, 5 种语言里 zh-CN 直接用中文,
 *       其他语言给一个 English-ish 占位 (后续可由 i18n 团队补翻译).
 *
 * 用法: tsx scripts/extract-api-i18n.ts
 * 产物: src/locales/modules/{zh-CN,zh-TW,en,ja,ko}/api.json (覆盖写)
 */

import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const SRC_API_DIR = path.join(ROOT, 'src', 'api')
const MINIAPP_DIR = path.join(ROOT, 'miniapp', 'src')
const LOCALES_DIR = path.join(ROOT, 'src', 'locales', 'modules')

// 支持的 5 种语言
const LOCALES = ['zh-CN', 'zh-TW', 'en', 'ja', 'ko'] as const
type Locale = (typeof LOCALES)[number]

// 提取 t('api.xxx.yyy') 调用, 返回所有 key
function extractApiKeys(): Set<string> {
  const keys = new Set<string>()
  const re = /\b(?:t|tSafe|\$t)\(\s*(['"])(api\.[^'"]+)\1/g
  function scan(dir: string) {
    if (!fs.existsSync(dir)) return
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name === '__tests__') continue
      const p = path.join(dir, e.name)
      if (e.isDirectory()) {
        scan(p)
      } else if (/\.(ts|tsx|vue|js|jsx)$/.test(e.name)) {
        const content = fs.readFileSync(p, 'utf-8')
        let m: RegExpExecArray | null
        // 每次 new 一个 re, 因为 lastIndex 是有状态的
        const localRe = new RegExp(re.source, re.flags)
        while ((m = localRe.exec(content)) !== null) {
          keys.add(m[2])
        }
      }
    }
  }
  scan(SRC_API_DIR)
  scan(MINIAPP_DIR)
  return keys
}

/** 把扁平 key 列表转成嵌套对象, 叶子值由 fn 提供 */
function buildTree(keys: string[], leafFn: (key: string) => string): Record<string, unknown> {
  const root: Record<string, unknown> = {}
  for (const key of keys) {
    const parts = key.split('.')
    // 第一段固定是 "api", 跳过
    let cur: Record<string, unknown> = root
    for (let i = 0; i < parts.length - 1; i++) {
      const p = parts[i]
      if (!cur[p] || typeof cur[p] !== 'object') cur[p] = {}
      cur = cur[p] as Record<string, unknown>
    }
    const leafKey = parts[parts.length - 1]
    cur[leafKey] = leafFn(key)
  }
  return root
}

/** 从 key 提取 Chinese 段 (第三段开始) 作为 zh-CN 值 */
function chineseFromKey(key: string): string {
  const parts = key.split('.')
  // api.{group}.{chinese}[.{sub}] 模式, 取第三段 (Chinese)
  // 例如 api.agents.操作成功 -> "操作成功"
  // 例如 api.agent_category.未找到分类配置 -> "未找到分类配置"
  return parts[2] || key
}

/** 英文占位: 把 Chinese 转成英文 placeholder, 后续由翻译者补全 */
function englishPlaceholder(key: string): string {
  const cn = chineseFromKey(key)
  // 简化的 Chinese->English 占位: [ZH:操作成功] 这种标记, 提醒翻译者
  return `[ZH:${cn}]`
}

function main(): void {
  console.log('🔍 扫描 t("api.xxx.yyy") 调用...')
  const keys = extractApiKeys()
  console.log(`  找到 ${keys.size} 个独立 key`)
  if (keys.size === 0) {
    console.log('  (无 key, 不生成 api.json)')
    return
  }

  // 按第一段 (group) 分组输出
  const byGroup: Record<string, number> = {}
  for (const k of keys) {
    const parts = k.split('.')
    const g = parts[1] || 'misc'
    byGroup[g] = (byGroup[g] || 0) + 1
  }
  console.log('  分组统计:')
  for (const [g, n] of Object.entries(byGroup).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${g.padEnd(20)} ${n} keys`)
  }

  // 排序后生成嵌套结构
  const sortedKeys = Array.from(keys).sort()

  for (const loc of LOCALES) {
    const dir = path.join(LOCALES_DIR, loc)
    fs.mkdirSync(dir, { recursive: true })
    const filePath = path.join(dir, 'api.json')

    let tree: Record<string, unknown>
    if (loc === 'zh-CN') {
      // zh-CN: 叶子值 = Chinese 段 (与 key 的最后一段一致, 实际就是值)
      tree = buildTree(sortedKeys, chineseFromKey)
    } else {
      // 其他 4 种语言: 英文占位 [ZH:xxx]
      tree = buildTree(sortedKeys, englishPlaceholder)
    }

    fs.writeFileSync(filePath, JSON.stringify(tree, null, 2) + '\n', 'utf-8')
    console.log(`  ✅ ${loc.padEnd(8)} -> ${path.relative(ROOT, filePath)}  (${sortedKeys.length} keys)`)
  }

  console.log('\n📋 下一步:')
  console.log('  1. 把 "api" 加入 locales/index.ts 的 coreModules (启动时加载)')
  console.log('  2. 重新跑 npm run check:i18n:keys -- --baseline 锁定新基线')
  console.log('  3. 后续翻译: 找 i18n 团队补 [ZH:xxx] 占位为真实翻译')
}

main()
