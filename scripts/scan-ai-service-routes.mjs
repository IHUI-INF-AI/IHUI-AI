#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


/**
 * AI-SERVICE 端点清单生成器(2026-11-13 立)。
 *
 * 立因(实测现读):`apps/cli/src/tools/api-bridge.ts` 的 `api_*` 族只覆盖 **apps/api**(Fastify)
 * 的 5539 条端点 —— 那份清单由 `scripts/scan-api-routes.mjs` 静态扫 apps/api/src/routes 下的 .ts 文件
 * 得到。而承载 AI 能力本身的 **ai-service**(FastAPI,682 operation / 621 path)对 CLI **完全不可见**:
 * 全仓 `grep ai_read|ai_list_endpoints` 零命中。于是"让 AI 调用整个项目所有接口"在 CLI 这一侧
 * 缺了整整一半 —— 知识库、RAG、编排、memory、agent-runtime 这些能力都长在 ai-service 上。
 *
 * 为什么必须**运行时**取而不是静态扫源码(与 api-bridge 的取向相反,理由必须写清):
 *   ai-service 的路由前缀分散在 `main.py` 的 94 处 `include_router` 里(68 处 `prefix="/api"`、
 *   5 处 `/api/v1`、其余**不带 prefix**)且 88 个 router 文件各写各的 `@router.get(...)`;
 *   静态扫要么漏带 prefix 的那批、要么把 prefix 猜错 —— 而"猜错前缀"产出的是一条**看起来在册、
 *   调用必 404** 的端点,比没有更坏(api-bridge 头注记过同一型教训)。
 *   OpenAPI 是框架自己算出来的真值:path 已含全部前缀、operationId 已在、参数 schema 已在。
 *   代价是生成时必须有一个能 import 起 app 的 Python 环境 —— 本仓 `apps/ai-service/.venv` 即是,
 *   且在不了时**必须 fail-loud 退出**,绝不回落成"空清单"或"从上次产物沿用"(那会把陈旧当新鲜)。
 *
 * 用法:
 *   node scripts/scan-ai-service-routes.mjs             # 生成并落盘
 *   node scripts/scan-ai-service-routes.mjs --check      # 只比对不写(CI/守门用)
 *   node scripts/scan-ai-service-routes.mjs --report-only
 *
 * 取材面纪律:本器读的是**工作树上的 ai-service 源码**(Python 只能从磁盘 import),
 * 不是 HEAD blob —— 这是与 api-bridge 生成器的实质差异,已如实登记。因此它**不适合**放进
 * `--staged` 提交链判据(半编辑态的 Python 会让生成器读到别的会话的在飞改动);
 * 它的使用方式是"人工/定时重生成 + --check 报陈旧",而不是"每次提交都重跑"。
 */

import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { renderStablePin } from './lib/generated-input-pin.mjs'
// 取材层单源(守门 118 / `check-gate-face-discipline`):门脚本读**仓库内容**必须经它,
// 不裸 readFileSync。唯一例外是"要跑 Python 取运行时 OpenAPI"那一步 —— 那条腿读的不是仓库
// blob,而是子系统导出的 spec,已在下面 readText 的注释里写明为什么不走取材层。
import { readWorktreeFile } from './lib/face-reader.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const AI_SERVICE = path.join(ROOT, 'apps', 'ai-service')
const OUT_FILE = path.join(ROOT, 'apps', 'cli', 'src', 'tools', 'ai-endpoints.generated.ts')
const WATERMARK_SRC = path.join(ROOT, 'packages', 'design-tokens', 'src', 'index.ts')

const argv = process.argv.slice(2)
const CHECK_ONLY = argv.includes('--check')
const REPORT_ONLY = argv.includes('--report-only')

const VALID_METHODS = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options']

/** 解释器候选序:显式 env 优先 → 仓内 venv → PATH 上的 python。找到第一个真能 import 的。 */
function resolvePython() {
  const candidates = []
  const fromEnv = (process.env.IHUI_AI_SERVICE_PYTHON ?? '').trim()
  if (fromEnv) candidates.push({ cmd: fromEnv, why: 'env IHUI_AI_SERVICE_PYTHON' })
  const venv =
    process.platform === 'win32'
      ? path.join(AI_SERVICE, '.venv', 'Scripts', 'python.exe')
      : path.join(AI_SERVICE, '.venv', 'bin', 'python')
  candidates.push({ cmd: venv, why: 'apps/ai-service/.venv' })
  for (const name of process.platform === 'win32' ? ['python.exe', 'python'] : ['python3', 'python']) {
    candidates.push({ cmd: name, why: 'PATH' })
  }
  return candidates
}

/**
 * 在 ai-service 目录下导出 OpenAPI。**失败一律抛**(不回落、不复用上次产物)。
 *
 * 为什么导出脚本写成一段内联 Python 而不是独立 .py 文件:那段代码只在"能 import 起 app"
 * 的环境里才有意义,落成仓内文件会诱使人用错解释器去跑它 —— 反而多一处漂移面。
 */
function exportOpenApi(pythonCmd) {
  const script = [
    'import json,sys',
    'from app.main import fastapi_app',
    'spec = fastapi_app.openapi()',
    'sys.stdout.write("@@OPENAPI@@" + json.dumps(spec, ensure_ascii=False))',
  ].join('\n')
  const out = execFileSync(pythonCmd, ['-c', script], {
    cwd: AI_SERVICE,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    // 导入 app 会跑模块级初始化(实测约 20-40s,含 OTel no-op 降级),给足预算。
    timeout: 300_000,
    maxBuffer: 256 * 1024 * 1024,
  })
  const marker = '@@OPENAPI@@'
  const at = out.indexOf(marker)
  if (at < 0) throw new Error('python 输出里没有 OpenAPI 标记(说明 import 阶段就失败了)')
  return JSON.parse(out.slice(at + marker.length))
}

/** 从 path 抽一级能力域(与 ai_service_bridge 的 `_path_domain` 逐字同口径)。 */
function pathDomain(p) {
  for (const seg of p.split('/')) {
    if (seg && seg !== 'api' && seg !== 'v1') return seg
  }
  return '(root)'
}

/** 路径参数名(OpenAPI 已把它写在 parameters 里,这里只做兜底核对)。 */
function pathParamNames(p) {
  return [...p.matchAll(/\{([^}]+)\}/g)].map((m) => m[1])
}

/** 把 OpenAPI spec 摊成行记录。同一 (method, path) 只留一条 —— 有 Duplicate Operation ID 告警时要能收敛。 */
function specToRows(spec) {
  const rows = []
  const seen = new Set()
  const duplicates = []
  for (const [p, item] of Object.entries(spec.paths ?? {})) {
    for (const method of VALID_METHODS) {
      const op = item[method]
      if (!op) continue
      const key = `${method.toUpperCase()} ${p}`
      if (seen.has(key)) {
        duplicates.push(key)
        continue
      }
      seen.add(key)
      rows.push({
        method: method.toUpperCase(),
        path: p,
        operationId: typeof op.operationId === 'string' ? op.operationId : '',
        summary: typeof op.summary === 'string' && op.summary ? op.summary : '',
        tags: Array.isArray(op.tags) ? op.tags.filter((t) => typeof t === 'string') : [],
        domain: pathDomain(p),
        pathParams: pathParamNames(p),
      })
    }
  }
  rows.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : a.method < b.method ? -1 : a.method > b.method ? 1 : 0))
  return { rows, duplicates }
}

/** 单行序列化:字段用 `\u0001` 分隔(路径里不会出现该字符),Tab 太易被工具吃掉。 */
function serializeRow(r) {
  return [r.method, r.path, r.domain, r.operationId, r.summary, r.tags.join(','), r.pathParams.join(',')].join('\u0001')
}

/**
 * 读一份**仓库内容**(经统一取材层的 worktree 面)。
 *
 * 为什么不裸 `fs.readFileSync`:守门 118(`check-gate-face-discipline`)要求门脚本读仓库内容
 * 必须经 `scripts/lib/face-reader.mjs` —— 两处各写一份读法,取材面判定就会与真实读法漂移
 * (该门头注记的"磁盘面散写"正是这一型)。
 *
 * `p` 是绝对路径,这里转成仓根相对路径再交给取材层;越界(不在 ROOT 下)视为取不到。
 */
function readText(p) {
  const rel = path.relative(ROOT, p).replace(/\\/g, '/')
  if (rel.startsWith('..')) return null
  return readWorktreeFile(ROOT, rel)
}

/** 归一:剥 BOM + CRLF→LF(与 generated-input-pin 的归一口径一致,否则同内容两哈希)。 */
function normalize(text) {
  return text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n')
}

function main() {
  const candidates = resolvePython()
  let spec = null
  let used = null
  const failures = []
  for (const c of candidates) {
    try {
      if (!c.cmd.includes(path.sep) && path.sep === '\\' && !c.cmd.includes('\\')) {
        // PATH 上的裸名交给 execFileSync 自己解析
      } else if (!fs.existsSync(c.cmd)) {
        failures.push(`${c.why}: ${c.cmd} 不存在`)
        continue
      }
      spec = exportOpenApi(c.cmd)
      used = c
      break
    } catch (err) {
      failures.push(`${c.why}: ${c.cmd} → ${String(err && err.message ? err.message : err).split('\n')[0].slice(0, 200)}`)
    }
  }

  if (!spec) {
    console.error('[ai-routes] 无法导出 OpenAPI —— 拒绝生成)')
    console.error('  候选解释器全部失败:')
    for (const f of failures) console.error('    - ' + f)
    console.error('  出口:装好 apps/ai-service 依赖(含 socketio/fastapi),或用 IHUI_AI_SERVICE_PYTHON 指定解释器。')
    console.error('  刻意不回落成空清单/沿用旧产物:那会把"没判"写成"判过"(AGENTS §0.3)。')
    return 2
  }

  const { rows, duplicates } = specToRows(spec)
  if (rows.length === 0) {
    console.error('[ai-routes] spec 里抽到 0 条端点 —— 判「未判定」而不是「就是没有」,退出码 2')
    return 2
  }

  const generatedAt = new Date().toISOString()
  let sourceCommit = 'unknown'
  try {
    sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim()
  } catch {
    /* 取不到就写 unknown(钉里字段允许) */
  }

  // 输入清单:生成器自身 + ai-service 的 app 目录(逐文件 sha256)。Python 侧读的是工作树,
  // 所以钉的输入面也必须是工作树 —— 两面同源,钉才有意义(守门 118 的面一致性)。
  const inputs = []
  const selfRel = 'scripts/scan-ai-service-routes.mjs'
  const selfText = readText(path.join(ROOT, selfRel))
  if (selfText !== null) inputs.push({ rel: selfRel, text: normalize(selfText) })

  const appDir = path.join(AI_SERVICE, 'app')
  const walk = (dir) => {
    let entries
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const e of entries) {
      const full = path.join(dir, e.name)
      if (e.isDirectory()) {
        if (e.name === '__pycache__') continue
        walk(full)
      } else if (e.isFile() && e.name.endsWith('.py')) {
        const rel = path.relative(ROOT, full).replace(/\\/g, '/')
        const text = readText(full)
        if (text !== null) inputs.push({ rel, text: normalize(text) })
      }
    }
  }
  walk(appDir)

  const watermark = normalize(readText(WATERMARK_SRC) ?? '')
    .split('\n')
    .slice(0, 3)
    .join('\n')

  const dataLines = rows.map(serializeRow)
  const mainExport =
    '// Each line: METHOD \\u0001 fullPath \\u0001 domain \\u0001 operationId \\u0001 summary \\u0001 tags \\u0001 pathParams\n' +
    `export const AI_ENDPOINTS_RAW = ${JSON.stringify(dataLines.join('\n'))}\n`

  const existing = normalize(readText(OUT_FILE) ?? '')
  const pinLines = renderStablePin({
    generator: 'scripts/scan-ai-service-routes.mjs',
    sourceCommit,
    inputs,
    generatedAt,
    extraLines: [`files: ${inputs.length}`, `endpoints: ${dataLines.length}`],
    existingText: existing || null,
  })

  // 导出常量必须与**钉里那一份**同源(2026-11-13 实测修):
  // 原实现用 `generatedAt`(每次新值),而钉里的是 renderStablePin 稳定后的旧值 ⇒
  // 输入一字未改,产物仍逐字节变 ⇒ 每次重跑都产生新 blobOid ⇒ 触发"重生成 → 收编"自激链
  // (generated-input-pin.mjs 头注记的 209 枚同形提交正是这样来的)。
  // 判据:从钉块里把最终生效的 generatedAt 读回来,导出常量照抄它 —— 两处永远同一个值。
  const stableGeneratedAt = (() => {
    const m = pinLines.join('\n').match(/^\/\/ generatedAt:\s*(\S+)\s*$/m)
    return m ? m[1] : generatedAt
  })()

  const header =
    '/**\n' +
    ' * Generated by scripts/scan-ai-service-routes.mjs - DO NOT hand-edit.\n' +
    ' * 来源 = ai-service 运行时 OpenAPI(框架算出的真值,path 已含全部 include_router 前缀)。\n' +
    ' * 为什么不静态扫源码:88 个 router 文件 + 94 处 include_router 前缀分散,静态推前缀会产出\n' +
    ' * 「看起来在册、调用必 404」的端点 —— 比没有更坏。详见生成器头注。\n' +
    ' */\n'

  const tail =
    `export const AI_ENDPOINTS_GENERATED_AT = ${JSON.stringify(stableGeneratedAt)}\n` +
    `export const AI_ENDPOINT_LINE_COUNT = ${dataLines.length}\n`

  const content = watermark + '\n\n' + header + pinLines.join('\n') + '\n' + mainExport + tail

  // 覆盖统计(与 api-bridge 生成器同风格:先报数,再落盘)
  const byMethod = {}
  for (const r of rows) byMethod[r.method] = (byMethod[r.method] || 0) + 1
  const byDomain = {}
  for (const r of rows) byDomain[r.domain] = (byDomain[r.domain] || 0) + 1
  const topDomains = Object.entries(byDomain)
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
    .slice(0, 15)

  const R = []
  R.push('==== ai-service endpoint scan coverage report ====')
  R.push('openapi paths                    : ' + Object.keys(spec.paths ?? {}).length)
  R.push('operations (deduped)             : ' + rows.length)
  R.push('duplicate (method,path) skipped  : ' + duplicates.length)
  R.push('interpreter used                 : ' + (used ? `${used.cmd} (${used.why})` : '(none)'))
  R.push('endpoints by method              : ' + JSON.stringify(byMethod))
  R.push('distinct domains                 : ' + Object.keys(byDomain).length)
  R.push('endpoints with {path params}     : ' + rows.filter((r) => r.pathParams.length > 0).length)
  R.push('top 15 domains by count          :')
  for (const [d, c] of topDomains) R.push('   ' + String(c).padStart(6) + '  ' + d)
  if (duplicates.length > 0) {
    R.push('duplicate list                   :')
    for (const d of duplicates.slice(0, 20)) R.push('   - ' + d)
  }
  console.log(R.join('\n'))

  if (REPORT_ONLY) {
    console.log('report-only                      : true (no write)')
    return
  }

  const prev = existing || ''
  const same = prev === content
  if (CHECK_ONLY) {
    console.log('check-only                       : true (no write)')
    console.log('stale                            : ' + !same)
    if (!same) {
      console.log('→ 产物与当前输入不一致,请跑 node scripts/scan-ai-service-routes.mjs 重生成')
      return 1
    }
    return
  }

  const outDir = path.dirname(OUT_FILE)
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })
  fs.writeFileSync(OUT_FILE, content, 'utf8')

  // 水印自检:前 3 行必须与源逐字节相等(与 api-bridge 生成器同一纪律)
  const back = normalize(readText(OUT_FILE) ?? '')
  if (back.split('\n').slice(0, 3).join('\n') !== watermark) {
    console.error('FATAL: 生成物水印(前 3 行)与源不逐字节相等')
    return 1
  }

  console.log('generated file                    : ' + path.relative(ROOT, OUT_FILE).replace(/\\/g, '/'))
  console.log('written                           : true')
  console.log('byte-identical to previous        : ' + same)
  const line3 = normalize(readText(OUT_FILE) ?? '').split('\n')[2] || ''
  console.log('watermark (line 3) md5            : ' + crypto.createHash('md5').update(line3, 'utf8').digest('hex'))
  return 0
}

// §22d 入口守卫:被 import 时不得执行(否则任何引它的测试都会触发一次 40s 的 Python 导出)。
// 与 `scripts/check-tool-family-registered.mjs:939` 同一形态 —— 单源模板,不另创造型。
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main())
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
