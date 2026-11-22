// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 路由 → AI 工具 生成器(清单驱动)。
 *
 * 输入一份 manifest JSON(数组:[{ domain, specs: RouteToolSpec[] }]),
 * 为每个 domain 生成 apps/cli/src/tools/<domain>.ts,导出 `<DOMAIN>_TOOLS`,
 * 内部由 tools/route-tools.ts 的 createRouteTools 编译成 Tool[]。
 *
 * 这是「AI 调用操作整个项目所有功能」的批量接入机制:每个业务域只需补一份 spec 清单,
 * 跑一次本脚本即生成对应 AI 工具,再在 agent.ts 加一行 import + registerTools 即可。
 *
 * 用法:node scripts/gen-ai-tools-from-routes.mjs scripts/data/ai-tool-manifests/all.json
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const WATERMARK =
  readFileSync(join(ROOT, 'packages/design-tokens/src/index.ts'), 'utf8')
    .split('\n')
    .slice(0, 3)
    .join('\n') + '\n'

function usage() {
  console.error('usage: node scripts/gen-ai-tools-from-routes.mjs <manifest.json>')
  process.exit(1)
}

const manifestPath = process.argv[2]
if (!manifestPath || !existsSync(manifestPath)) {
  console.error(`manifest 不存在: ${manifestPath}`)
  usage()
}

let manifest
try {
  manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
} catch (e) {
  console.error('manifest 解析失败:', e instanceof Error ? e.message : String(e))
  process.exit(1)
}
if (!Array.isArray(manifest)) {
  console.error('manifest 必须是数组 [{ domain, specs }]')
  process.exit(1)
}

const outDir = join(ROOT, 'apps/cli/src/tools')
mkdirSync(outDir, { recursive: true })

/**
 * 后端路由清单(由 scripts/scan-api-routes.mjs 从 apps/api 源码静态扫描生成)。
 *
 * 为什么生成期就要比对:spec.path 是**纯字符串**,类型系统看不见它,门也拦不住;
 * 2026-11-09 实测过一型 —— route-tools 去掉运行期 `/api` 拼接后,清单 14 条全缺前缀,
 * typecheck / 所有门全绿,实际每条请求都打到不存在的路径。唯一能在交付前发现它的位置就是这里。
 *
 * 取不到清单 ⇒ exit 2「未判定」,不静默放行(AGENTS §0.3)。
 */
const ENDPOINTS_FILE = join(ROOT, 'apps/cli/src/tools/api-endpoints.generated.ts')

/** 参数名归一:不同来源可能写 `:id` / `:agentId`,端点是否存在与参数名无关。 */
const normalizePath = (p) => String(p).replace(/:[A-Za-z0-9_]+/g, ':param')

function loadEndpointSet() {
  if (!existsSync(ENDPOINTS_FILE)) {
    console.error(
      '未判定:apps/cli/src/tools/api-endpoints.generated.ts 不存在;\n' +
        '  先跑 node scripts/scan-api-routes.mjs 生成端点清单,再重跑本生成器。',
    )
    process.exit(2)
  }
  const src = readFileSync(ENDPOINTS_FILE, 'utf8')
  const m = /export const API_ENDPOINTS_RAW = `([\s\S]*?)`\n/.exec(src)
  if (!m) {
    console.error('未判定:端点清单里读不到 API_ENDPOINTS_RAW(产物结构变了?)')
    process.exit(2)
  }
  const set = new Set()
  for (const line of m[1].split('\n')) {
    if (!line.trim()) continue
    const [method, endpointPath] = line.split('\t')
    if (method && endpointPath) set.add(`${method.toUpperCase()} ${normalizePath(endpointPath)}`)
  }
  if (set.size === 0) {
    console.error('未判定:端点清单解析出 0 条端点(空输入不是通过)')
    process.exit(2)
  }
  return set
}

const endpointSet = loadEndpointSet()
let rejected = 0

const registrations = []
for (const entry of manifest) {
  const { domain, specs } = entry ?? {}
  if (typeof domain !== 'string' || !Array.isArray(specs)) {
    console.error(`跳过非法条目: ${JSON.stringify(entry).slice(0, 80)}`)
    continue
  }
  const missing = specs.filter(
    (s) => !endpointSet.has(`${String(s.method ?? 'GET').toUpperCase()} ${normalizePath(s.path)}`),
  )
  if (missing.length > 0) {
    console.error(`\n❌ ${domain}: ${missing.length}/${specs.length} 条 spec 在 API 路由清单里不存在(实跑必 404):`)
    for (const s of missing) console.error(`   ${String(s.method ?? 'GET').toUpperCase()} ${s.path}`)
    console.error('   改法:把 path 改成与 apps/api 注册前缀逐段一致(含 /api 等前缀),再重跑本生成器。')
    console.error(
      '   注意:本校验的取材面只含 Fastify 路由(apps/api/src/routes/**/*.ts);FastAPI 与边缘改写端点不在其中,',
    )
    console.error('   精度边界见 scripts/scan-api-routes.mjs 头注。')
    rejected += missing.length
    continue
  }

  const upper = domain.toUpperCase().replace(/[^A-Z0-9]/g, '_')
  const exportName = `${upper}_TOOLS`
  const constName = `${upper}_SPECS`

  const body =
    `${WATERMARK}` +
    `/**\n` +
    ` * ${domain} 工具族 —— 由 scripts/gen-ai-tools-from-routes.mjs 从清单自动生成。\n` +
    ` * 手工修改请改清单后重跑生成器,不要直接改本文件。\n` +
    ` */\n` +
    `import { createRouteTools, type RouteToolSpec } from './route-tools.js'\n\n` +
    `const ${constName}: RouteToolSpec[] = ${JSON.stringify(specs, null, 2)}\n\n` +
    `export const ${exportName} = createRouteTools(${constName})\n`

  const file = join(outDir, `${domain}.ts`)
  writeFileSync(file, body)
  registrations.push({ domain, exportName, file: `apps/cli/src/tools/${domain}.ts` })
  console.log(`generated ${file}`)
}

console.log(
  `\n生成 ${registrations.length} 个工具文件。请在 apps/cli/src/commands/agent.ts 的 setupAgentTools 注册块增加:`,
)
for (const r of registrations) {
  console.log(`  import { ${r.exportName} } from '../tools/${r.domain}.js'`)
  console.log(`  registerTools(${r.exportName});`)
}

if (rejected > 0) {
  console.error(`\n拒绝落地:${rejected} 条 spec 指向不存在的端点(产物未写出,见上)。`)
  process.exit(1)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
