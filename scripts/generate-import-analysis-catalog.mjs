// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
// [IHUI-AI-PROVENANCE]:⁠‌‌‌‍‍‌‌‍‍‌‌‌‌‍‍‌‌‌‍‍‌‌‍‍‌‌‌‍‍‌‌‌‌‌‌‌‌‍‍‌‌‌‌‌‌‌‌‌‍‍‌‌‍‍‌‌‍‍‌‌‌‍‍‌‍‍‌‌‌‍‍‌‌‍‍‌‌‌‍‍‌‌‌‌‌‍‍‌‌‌‍‍‌‌‍‍‌‍‍‌‌‌‍‍‌‌‍‍‌‌‌‌‌‍‍‌‌‍‍‌‌‌‌‌‍‍‌‌‍‍‌‌‍‍‌‌‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‌‌‌‌‌‍‌‌‌‍‍‌‌‌‌‌‍‌‌‍‍‌‌‍‍‌‌‌‍‍‌‌‌‌‌‌‍‍‌‍‍‌‌‍‍‌‌‌‌‌‌‍‌‌‍‍‌‌‍‍‌‌‍‌‍‍‌‌‌‍‍‌‌‌‌‌‍‌‌️‌‍‌‍‌‍‍‌‍‌‍‍⁠

/**
 * generate-import-analysis-catalog.mjs — 把 `products/ai-prompt-library/` 的提示词库
 * 投影成 web 端可类型安全消费的 TS 常量(D28 补「导入 → 拿来分析」那一层)。
 *
 * 为什么要生成物而不是运行时读 JSON:
 *   - 浏览器端读不到 `products/**` 的磁盘文件;走后端新增端点会把 api 运行时
 *     绑到仓库路径上(容器里未必带 `products/`),是比生成物更脆的耦合。
 *   - 库本体是**付费数字商品**(`index.json.product.price` / `license`),单一权威源
 *     就是那 20 个 `prompts/NN-*.json`;生成物是它的**投影**,不是第二份真相。
 *     库更新后重跑本脚本即可,投影与库的一致性由 `check-import-analysis-catalog.mjs`
 *     之外的人工 diff 兜(本脚本 `--check` 做逐字节对账)。
 *
 * 投影字段(只投影"选中场景 → 填 variables → 拼 prompt"这条链真正要用的):
 *   id / categoryId / title / description / useCase / variables / tags /
 *   difficulty / estimatedTokens / template
 * **不投影** example_input / example_output —— 二者合计 ~250KB 且只用于文档展示,
 *   带进来只增包体不增能力(2026-10-03 实测:全量 template ≈366KB,example_* ≈250KB)。
 *
 * 用法:
 *   node scripts/generate-import-analysis-catalog.mjs            # 写入投影文件
 *   node scripts/generate-import-analysis-catalog.mjs --check    # 只校验不写(逐字节)
 *   node scripts/generate-import-analysis-catalog.mjs --dry-run  # 只报将写入的体量
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const LIBRARY_DIR = join(ROOT, 'products', 'ai-prompt-library')
const INDEX = join(LIBRARY_DIR, 'index.json')
const OUT = join(ROOT, 'apps/web/src/lib/import-analysis-catalog.generated.ts')
/** 溯源水印取材文件(与 OUT 同目录):首 3 行横幅 + 末行载荷,按字节复制,绝不手打零宽字符 */
const WATERMARK_SOURCE = join(ROOT, 'apps/web/src/lib/ai-skill-variables.ts')

const DRY_RUN = process.argv.includes('--dry-run')
const CHECK = process.argv.includes('--check')

/** 读取 index.json 的分类目录(投影里作为 category 维度) */
function readCategories() {
  const index = JSON.parse(readFileSync(INDEX, 'utf-8'))
  if (!Array.isArray(index.categories) || index.categories.length === 0) {
    throw new Error(`[import-analysis-catalog] index.json 缺 categories:${INDEX}`)
  }
  return index.categories.map((c) => ({
    id: String(c.id),
    category: String(c.category),
    categoryZh: String(c.category_zh),
    categoryEn: String(c.category_en),
    icon: String(c.icon ?? ''),
    count: Number(c.count ?? 0),
  }))
}

/**
 * 读 20 个 prompts/NN-*.json,按 id 升序摊平成 prompt 列表。
 * 刻意**不**信任 index.json 的 `file` 字段去拼路径 —— 那是发布产物里的相对路径,
 * 拼错会静默少投影几条;改为按 id_range 声明的文件名兜底并逐个断言存在。
 */
function readPrompts(categories) {
  const prompts = []
  for (const cat of categories) {
    const file = join(LIBRARY_DIR, 'prompts', `${cat.id}-${cat.category}.json`)
    if (!existsSync(file)) {
      throw new Error(`[import-analysis-catalog] 分类文件缺失:${file}`)
    }
    const doc = JSON.parse(readFileSync(file, 'utf-8'))
    if (!Array.isArray(doc.prompts)) {
      throw new Error(`[import-analysis-catalog] ${file} 缺 prompts 数组`)
    }
    for (const p of doc.prompts) {
      if (typeof p.id !== 'string' || typeof p.prompt_template !== 'string') {
        throw new Error(`[import-analysis-catalog] ${file} 存在缺 id/prompt_template 的条目`)
      }
      if (!Array.isArray(p.variables)) {
        throw new Error(`[import-analysis-catalog] prompt ${p.id} 缺 variables 数组`)
      }
      prompts.push({
        id: p.id,
        categoryId: cat.id,
        title: String(p.title ?? ''),
        description: String(p.description ?? ''),
        useCase: String(p.use_case ?? ''),
        variables: p.variables.map((v) => String(v)),
        tags: Array.isArray(p.tags) ? p.tags.map((t) => String(t)) : [],
        difficulty: String(p.difficulty ?? ''),
        estimatedTokens: Number(p.estimated_tokens ?? 0),
        template: p.prompt_template,
      })
    }
  }
  // 按 id 升序(id 是 3 位零填字符串,字典序 == 数值序)
  prompts.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  const ids = new Set(prompts.map((p) => p.id))
  if (ids.size !== prompts.length) {
    throw new Error('[import-analysis-catalog] prompt id 有重复(投影会出现两条同 id 场景)')
  }
  return prompts
}

/**
 * 取水印横幅:首 3 行原文 + 末行原文,**按字节**从同目录既有文件复制。
 * 手打零宽字符是明令禁止的(文本级批量改写会静默改写它们),故只能复制。
 */
function readWatermark() {
  const raw = readFileSync(WATERMARK_SOURCE, 'utf-8')
  const lines = raw.split('\n')
  const banner = lines.slice(0, 3).join('\n')
  const tail = lines[lines.length - 1] ?? ''
  if (!banner.includes('[IHUI-AI-PROVENANCE]:')) {
    throw new Error(`[import-analysis-catalog] 水印取材文件首 3 行不含载荷行:${WATERMARK_SOURCE}`)
  }
  // 末行可能是文件末尾空行(以 \n 结尾),载荷行即最后一个非空行
  let tailLine = tail
  if (tailLine.trim() === '') {
    for (let i = lines.length - 1; i >= 0; i--) {
      const l = lines[i] ?? ''
      if (l.trim() !== '') {
        tailLine = l
        break
      }
    }
  }
  if (!tailLine.trimStart().startsWith('//')) {
    throw new Error(`[import-analysis-catalog] 水印取材文件末行不是注释行:${WATERMARK_SOURCE}`)
  }
  return { banner, tailLine }
}

function build(categories, prompts) {
  const { banner, tailLine } = readWatermark()
  const total = indexTotal()
  const body = `// @generated by scripts/generate-import-analysis-catalog.mjs — DO NOT EDIT BY HAND。
// 单一权威源 = products/ai-prompt-library/(付费数字商品,20 分类 / ${total} 条)。
// 库更新后重跑 \`node scripts/generate-import-analysis-catalog.mjs\` 重新生成本文件。
//
// 用途(D28 补「导入会话 → 拿来分析」):导入完成后的结果区与会话消息区提供"用场景分析",
// 场景从本目录选取、variables 由用户填写、prompt_template 填充后作为**普通用户消息**
// 注入导入会话 —— 复用既有聊天通道,不新造 LLM 调用链。
//
// 投影刻意不含 example_input / example_output(合计 ~250KB,只用于文档展示);
// chatTask 之类的"来源 → 场景"推荐映射也不在本文件:那是消费侧判据,不是库的内容,
// 放 apps/web/src/lib/import-analysis.ts,与本投影分离以免改推荐就要重新生成。

export interface ImportAnalysisCategory {
  /** 分类 id(与库文件名 \`NN-<category>.json\` 的 NN 一致) */
  readonly id: string
  readonly category: string
  readonly categoryZh: string
  readonly categoryEn: string
  readonly icon: string
  readonly count: number
}

export interface ImportAnalysisScenario {
  readonly id: string
  /** 所属分类 id(ImportAnalysisCategory.id) */
  readonly categoryId: string
  readonly title: string
  readonly description: string
  readonly useCase: string
  /** 模板占位符变量名(库自带清单,已去重保序) */
  readonly variables: readonly string[]
  readonly tags: readonly string[]
  readonly difficulty: string
  readonly estimatedTokens: number
  /** 原始 prompt_template,含 \`{var}\` 占位符 —— 填充后作为分析指令正文 */
  readonly template: string
}

export const IMPORT_ANALYSIS_CATEGORIES: readonly ImportAnalysisCategory[] = ${JSON.stringify(categories, null, 2)}

export const IMPORT_ANALYSIS_SCENARIOS: readonly ImportAnalysisScenario[] = ${JSON.stringify(prompts, null, 2)}
`
  return `${banner}\n${body}${tailLine}\n`
}

/** index.json 里声明的提示词总数(用于生成物头注的库规模描述,并与实投影条数对账) */
function indexTotal() {
  const index = JSON.parse(readFileSync(INDEX, 'utf-8'))
  return Number(index?.product?.total_prompts ?? 0)
}

const categories = readCategories()
const prompts = readPrompts(categories)

if (indexTotal() !== prompts.length) {
  throw new Error(
    `[import-analysis-catalog] 投影条数(${prompts.length})与 index.json 声明的 total_prompts(${indexTotal()})不符`,
  )
}

const ts = build(categories, prompts)

if (DRY_RUN) {
  console.log(`[dry-run] 将写入 ${OUT}(${ts.length} chars,${prompts.length} 条场景 / ${categories.length} 个分类)`)
  process.exit(0)
}

if (CHECK) {
  if (!existsSync(OUT)) {
    console.error(`[check] 投影文件不存在:${OUT}(跑 node scripts/generate-import-analysis-catalog.mjs)`)
    process.exit(1)
  }
  const current = readFileSync(OUT, 'utf-8')
  if (current !== ts) {
    console.error('[check] ❌ 投影文件与 products/ai-prompt-library/ 不同步(逐字节不一致)')
    console.error('       修复:node scripts/generate-import-analysis-catalog.mjs')
    process.exit(1)
  }
  console.log(`[check] ✅ 投影与库同步(${prompts.length} 条场景 / ${categories.length} 个分类)`)
  process.exit(0)
}

writeFileSync(OUT, ts, 'utf-8')
console.log(`已生成 ${OUT}(${prompts.length} 条场景 / ${categories.length} 个分类,${ts.length} chars)`)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
