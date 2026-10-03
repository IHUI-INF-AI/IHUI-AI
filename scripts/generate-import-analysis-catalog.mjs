// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
// [IHUI-AI-PROVENANCE]:⁠‌‌‌‍‍‌‌‍‍‌‌‌‌‍‍‌‌‌‍‍‌‌‍‍‌‌‌‍‍‌‌‌‌‌‌‌‌‍‍‌‌‌‌‌‌‌‌‌‍‍‌‌‍‍‌‌‍‍‌‌‌‍‍‌‍‍‌‌‌‍‍‌‌‍‍‌‌‌‍‍‌‌‌‌‌‍‍‌‌‌‍‍‌‌‍‍‌‍‍‌‌‌‍‍‌‌‍‍‌‌‌‌‌‍‍‌‌‍‍‌‌‌‌‌‍‍‌‌‍‍‌‌‍‍‌‌‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‌‌‌‌‌‍‌‌‌‍‍‌‌‌‌‌‍‌‌‍‍‌‌‍‍‌‌‌‍‍‌‌‌‌‌‌‍‍‌‍‍‌‌‍‍‌‌‌‌‌‌‍‌‌‍‍‌‌‍‍‌‌‍‌‍‍‌‌‌‍‍‌‌‌‌‌‍‌‌️‌‍‌‍‌‍‍‌‍‌‍‍⁠

/**
 * generate-import-analysis-catalog.mjs — 把 `products/ai-prompt-library/` 的提示词库
 * 投影成各端可类型安全消费的 TS 常量(D28 补「导入 → 拿来分析」那一层)。
 *
 * 为什么要生成物而不是运行时读 JSON:
 *   - 浏览器端/小程序端读不到 `products/**` 的磁盘文件;走后端新增端点会把 api 运行时
 *     绑到仓库路径上(容器里未必带 `products/`),是比生成物更脆的耦合。
 *   - 库本体是**付费数字商品**(`index.json.product.price` / `license`),单一权威源
 *     就是那 20 个 `prompts/NN-*.json`;生成物是它的**投影**,不是第二份真相。
 *     库更新后重跑本脚本即可,投影与库的一致性由本脚本 `--check` 逐字节对账兜底。
 *
 * 投影字段(只投影"选中场景 → 填 variables → 拼 prompt"这条链真正要用的):
 *   id / categoryId / title / description / useCase / variables / tags /
 *   difficulty / estimatedTokens / template
 * **不投影** example_input / example_output —— 二者合计 ~74KB 且只用于文档展示,
 *   带进来只增包体不增能力(2026-10-03 实测)。
 *
 * ## 两份投影:full(给 web / RN)与 slim(给小程序)
 *
 * 2026-10-03 实测 `pkg-ai/ai/conversation-import.js` = 736,316 B,其中本投影
 * **707,113 B = 96.03%**;而投影内 `template` 一个字段就占 632,331 B(89.4%)。
 * `template` 是 `buildAnalysisPrompt` 的**输入正文**,裁掉它功能就不存在了,
 * 所以"瘦身投影"能动的只有 template 之外的展示性字段:
 *   description / tags / useCase(三者合计 ~31.8KB)+ 分类的 category/categoryEn/icon。
 * 实测省 33,778 B(投影的 4.4%)—— 是个**诚实但有限**的量,不假装能减半。
 * 三端 UI 都已改吃 slim 字段集(见下"UI 口径"),web / RN 仍吃 full,行为零变化。
 *
 * ⚠️ slim 省的是"展示冗余",不是"能力"。`useCase` 在 slim 里保留(它是
 * `buildAnalysisPrompt` 场景行的正文之一,不是纯展示),被裁的 `description`
 * 三端 UI 都写成 `s.useCase || s.description` —— useCase 全库 210/210 非空,
 * 故 slim 下该表达式恒等于 useCase,UI 显示逐字不变。
 *
 * 用法:
 *   node scripts/generate-import-analysis-catalog.mjs            # 写入两份投影
 *   node scripts/generate-import-analysis-catalog.mjs --check    # 只校验不写(两份都逐字节对账)
 *   node scripts/generate-import-analysis-catalog.mjs --dry-run  # 只报将写入的体量
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const LIBRARY_DIR = join(ROOT, 'products', 'ai-prompt-library')
const INDEX = join(LIBRARY_DIR, 'index.json')
// 2026-10-03 下沉到 packages/shared:投影改由 web / mobile-rn / miniapp-taro 三端共用,
// 单一权威源 + 单一投影 = 改判据不必三端各生成一份(避免三份漂移)。
// ⚠️ 刻意**不在** packages/shared/src/index.ts 根 barrel 里 re-export:
// 实测小程序主包 2,033,698 / 2,097,152 B(余量仅 63,454 B),而 22 个端内文件经根 barrel
// 引 @ihui/shared 且含主包页 —— 根 barrel 一挂这 492KB 投影,主包必然超微信硬上限。
// 端内一律走子路径 @ihui/shared/import-analysis/scenarios(即本文件的 OUT 所在目录)。
const OUT = join(ROOT, 'packages/shared/src/import-analysis/catalog.generated.ts')
/**
 * slim 投影(2026-10-03):小程序端专用,字段集见文件头注。
 * 刻意与 OUT 同目录 —— 两者是同一份权威源的**两个投影**,放一起便于 `--check` 一起对账,
 * 也保证 slim 不会被漏出门禁(野生文件是投影漂移的头号来源)。
 */
const OUT_SLIM = join(ROOT, 'packages/shared/src/import-analysis/catalog.slim.generated.ts')
/** 溯源水印取材文件(与 OUT 同目录):首 3 行横幅 + 末行载荷,按字节复制,绝不手打零宽字符 */
const WATERMARK_SOURCE = join(ROOT, 'packages/shared/src/import-analysis/provenance.ts')

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

/**
 * 投影模式定义。
 *
 * `full`  = 原字段集,web / mobile-rn 消费(行为不得变化)。
 * `slim`  = 小程序端消费:裁掉**纯展示**字段。逐条裁剪依据(2026-10-03 实测三端
 *           UI 读点 + 产物字节分布,不是"看起来用不上"):
 *             - `description`:三端 UI 都写 `s.useCase || s.description`,而 useCase
 *               全库 210/210 非空 ⇒ slim 下该式恒等于 useCase,显示逐字不变。
 *               且 `buildAnalysisPrompt` 同样只取 `useCase || description`。
 *             - `tags`:全仓**零**读点(web/RN/小程序/shared 都不读),纯冗余。
 *             - 分类的 `category` / `categoryEn`:全仓零读点(只有 `icon` 被 web 读,
 *               但 web 吃 full,不受影响)。
 *           保留的每个字段都有**功能**读点:title(场景行/指令头)、useCase(同上)、
 *           variables(填表 + 拼 prompt)、difficulty/estimatedTokens(底部估算行)、
 *           template(分析指令正文)、categoryId(分类筛选)、categoryZh/count(分类胶囊)。
 */
const MODES = {
  full: {
    out: OUT,
    label: 'full(web / mobile-rn)',
    categoryFields: ['id', 'category', 'categoryZh', 'categoryEn', 'icon', 'count'],
    scenarioFields: [
      'id',
      'categoryId',
      'title',
      'description',
      'useCase',
      'variables',
      'tags',
      'difficulty',
      'estimatedTokens',
      'template',
    ],
  },
  slim: {
    out: OUT_SLIM,
    label: 'slim(miniapp-taro)',
    categoryFields: ['id', 'categoryZh', 'count'],
    scenarioFields: [
      'id',
      'categoryId',
      'title',
      'useCase',
      'variables',
      'difficulty',
      'estimatedTokens',
      'template',
    ],
  },
}

/** 按 mode 的字段清单投影;字段顺序即输出顺序,故两份产物都稳定可对账 */
function project(rows, fields) {
  return rows.map((row) => {
    const out = {}
    for (const f of fields) {
      if (!(f in row)) {
        throw new Error(`[import-analysis-catalog] 投影字段 ${f} 不在源数据中(库结构变了?)`)
      }
      out[f] = row[f]
    }
    return out
  })
}

/** 场景接口的字段级注释(两份投影共用;被裁字段不出现) */
const SCENARIO_FIELD_DOC = {
  id: '',
  categoryId: '/** 所属分类 id(ImportAnalysisCategory.id) */',
  title: '',
  description: '',
  useCase: '',
  variables: '/** 模板占位符变量名(库自带清单,已去重保序) */',
  tags: '',
  difficulty: '',
  estimatedTokens: '',
  template: '/** 原始 prompt_template,含 `{var}` 占位符 —— 填充后作为分析指令正文 */',
}

function renderInterface(name, fields, docMap) {
  const lines = fields.map((f) => {
    const doc = docMap?.[f]
    const body = `  readonly ${f}: ${f === 'estimatedTokens' || f === 'count' ? 'number' : f === 'variables' || f === 'tags' ? 'readonly string[]' : 'string'}`
    return doc ? `${doc}\n${body}` : body
  })
  return `export interface ${name} {\n${lines.join('\n')}\n}`
}

const CATEGORY_FIELD_DOC = {
  id: '/** 分类 id(与库文件名 `NN-<category>.json` 的 NN 一致) */',
  category: '',
  categoryZh: '',
  categoryEn: '',
  icon: '',
  count: '',
}

/**
 * 构建一份投影文件内容。
 * @param {'full'|'slim'} mode
 */
function build(mode, categories, prompts) {
  const { banner, tailLine } = readWatermark()
  const spec = MODES[mode]
  const total = indexTotal()
  const cats = project(categories, spec.categoryFields)
  const scens = project(prompts, spec.scenarioFields)
  const slim = mode === 'slim'
  const body = `// @generated by scripts/generate-import-analysis-catalog.mjs — DO NOT EDIT BY HAND。
// 投影模式:${spec.label}(本文件是 \`${spec.out.split('/').pop()}\`)。
// 单一权威源 = products/ai-prompt-library/(付费数字商品,20 分类 / ${total} 条)。
// 库更新后重跑 \`node scripts/generate-import-analysis-catalog.mjs\` 重新生成本文件。
//
// 用途(D28 补「导入会话 → 拿来分析」):导入完成后的结果区与会话消息区提供"用场景分析",
// 场景从本目录选取、variables 由用户填写、prompt_template 填充后作为**普通用户消息**
// 注入导入会话 —— 复用既有聊天通道,不新造 LLM 调用链。
//
// 投影刻意不含 example_input / example_output(合计 ~74KB,只用于文档展示);
// chatTask 之类的"来源 → 场景"推荐映射也不在本文件:那是消费侧判据,不是库的内容,
// 放同目录 provenance.ts,与本投影分离以免改推荐就要重新生成。
${
  slim
    ? `//
// 【slim 投影】本文件比同目录 catalog.generated.ts 少 3 个字段(description / tags /
// 分类的 category / categoryEn),省下的字节全部来自**纯展示**字段(实测三端 UI 读点
// 见生成器 MODES 注释);template 一个字段仍占投影 89%,它是分析指令正文,不可裁。
// 仅小程序端消费 —— 本端静态 import(动态 import() 在 Taro 小程序不可用)且必须把
// 投影压进 pkg-ai 分包,故给它一份瘦的。web / mobile-rn 继续吃 full,行为不变。
`
    : `//
// 【full 投影】web / mobile-rn 消费本份。若只想给小程序瘦身,改的是同目录的
// catalog.slim.generated.ts,不要动本文件 —— 三端展示文案一致是刻意维护的契约。
`
}//
// ⚠️ 引用纪律:端内**只能**经子路径 @ihui/shared/import-analysis/ 下的访问层消费本文件。
// 根 barrel(@ihui/shared)严禁 re-export:小程序主包余量仅 93,697 B(2026-10-03 实测),
// 挂上去必超微信 2 MB 硬上限。

${renderInterface('ImportAnalysisCategory', spec.categoryFields, CATEGORY_FIELD_DOC)}

${renderInterface('ImportAnalysisScenario', spec.scenarioFields, SCENARIO_FIELD_DOC)}

export const IMPORT_ANALYSIS_CATEGORIES: readonly ImportAnalysisCategory[] = ${JSON.stringify(cats, null, 2)}

export const IMPORT_ANALYSIS_SCENARIOS: readonly ImportAnalysisScenario[] = ${JSON.stringify(scens, null, 2)}
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

/** 两份产物都构建出来 —— --check 必须同时覆盖,否则 slim 会变成无门禁的野生文件 */
const BUILT = Object.keys(MODES).map((mode) => ({
  mode,
  out: MODES[mode].out,
  label: MODES[mode].label,
  content: build(mode, categories, prompts),
}))

if (DRY_RUN) {
  for (const b of BUILT) {
    console.log(
      `[dry-run] 将写入 ${b.out}(${b.content.length} chars,${prompts.length} 条场景 / ${categories.length} 个分类,${b.label})`,
    )
  }
  process.exit(0)
}

if (CHECK) {
  const drifted = []
  for (const b of BUILT) {
    if (!existsSync(b.out)) {
      drifted.push(`  投影文件不存在:${b.out}(跑 node scripts/generate-import-analysis-catalog.mjs)`)
      continue
    }
    if (readFileSync(b.out, 'utf-8') !== b.content) {
      drifted.push(`  与 products/ai-prompt-library/ 不同步(逐字节不一致):${b.out}`)
    }
  }
  if (drifted.length > 0) {
    console.error(`[check] ❌ ${drifted.length}/${BUILT.length} 份投影与库不同步:`)
    for (const d of drifted) console.error(d)
    console.error('       修复:node scripts/generate-import-analysis-catalog.mjs')
    process.exit(1)
  }
  console.log(
    `[check] ✅ 投影与库同步(${prompts.length} 条场景 / ${categories.length} 个分类;已逐字节校验 ${BUILT.length} 份:full + slim)`,
  )
  process.exit(0)
}

for (const b of BUILT) {
  writeFileSync(b.out, b.content, 'utf-8')
  console.log(
    `已生成 ${b.out}(${prompts.length} 条场景 / ${categories.length} 个分类,${b.content.length} chars,${b.label})`,
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
