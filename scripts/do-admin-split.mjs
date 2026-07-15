#!/usr/bin/env node
/**
 * 完成 admin-missing-routes.ts 拆分:把每个 section 提取到 admin/<prefix>.ts
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const repoRoot = join(__dirname, '..')
const routesDir = join(repoRoot, 'apps/api/src/routes')
const targetFile = join(routesDir, 'admin-missing-routes.ts')
const adminDir = join(routesDir, 'admin')

const src = readFileSync(targetFile, 'utf8')
const lines = src.split('\n')

// 1) 识别所有 section 起始行
const B = String.fromCharCode(92) + 'b' // regex \b
const sectionStartRe = new RegExp('^\\s*//\\s*/api/admin/([a-z0-9/-]+)\\s', 'i')
const sections = []
for (let i = 0; i < lines.length; i++) {
  const m = lines[i].match(sectionStartRe)
  if (m) {
    const prefix = m[1]
    let end = lines.length
    for (let j = i + 1; j < lines.length; j++) {
      if (sectionStartRe.test(lines[j])) {
        end = j
        break
      }
    }
    sections.push({ prefix, start: i, end })
  }
}
console.log(`找到 ${sections.length} 个 section`)

// 2) 解析 schema import 块
const importBlockEnd = lines.findIndex((l) => l.startsWith('const paginationSchema'))
const importBody = importLines(importBlockEnd)
const importMatch = importBody.match(/import\s*\{([^}]+)\}\s*from\s*['"]@ihui\/database['"]/s)
if (!importMatch) {
  console.error('未找到 @ihui/database import 块')
  process.exit(1)
}
const allSchemas = importMatch[1]
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)
console.log(`共 ${allSchemas.length} 个 schema`)

function importLines(endIdx) {
  return lines.slice(0, endIdx).join('\n')
}

// 3) 检测 section 使用的 schema
function detectSchemas(body) {
  return allSchemas.filter((s) => new RegExp(B + s + B).test(body))
}

function camelCase(s) {
  return s.replace(/[-/]+([a-z])/g, (_, c) => c.toUpperCase()).replace(/^./, (c) => c.toLowerCase())
}

// 4) 写 _shared.ts
const sharedStartIdx = importBlockEnd
const sharedEndIdx = lines.findIndex((l) => l.startsWith('export const adminMissingRoutes'))
let sharedBody = lines
  .slice(sharedStartIdx, sharedEndIdx)
  .join('\n')
  .trim()
// 给所有顶层 const 声明加 export,确保子文件能引用
sharedBody = sharedBody.replace(/^const\s+/gm, 'export const ')
sharedBody = sharedBody.replace(/^function\s+/gm, 'export function ')
// FieldType 是 type alias,也要 export
sharedBody = sharedBody.replace(/^type\s+/gm, 'export type ')
// 去掉 /* eslint-disable */ 标记(不需要,函数本身已合法)
sharedBody = sharedBody.replace(/\/\* eslint-disable[^]*?\*\//g, '')

const sharedHeader = `/**
 * admin 子路由共享工具(从 admin-missing-routes.ts 拆分)。
 * 包含:分页/查询 schema、CRUD 工厂 registerCrud、fields 字段映射器、所有 body 校验 schema。
 */
import { z } from 'zod'
import { eq, ilike, desc, sql, inArray } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { emptyToUndefined, success, error } from '../../utils/response.js'
`

writeFileSync(join(adminDir, '_shared.ts'), sharedHeader + sharedBody + '\n', 'utf8')
console.log('wrote admin/_shared.ts')

// 5) 为每个 section 写子文件
for (const s of sections) {
  const sectionBody = lines.slice(s.start, s.end).join('\n')
  let cleanedBody = sectionBody.replace(/^\s*\/\/\s*\/api\/admin\/[^\n]*\n/m, '').trim()
  // 去掉尾部可能存在的 `}`(原 adminMissingRoutes 函数闭合),由本脚本的 footer 重新生成
  cleanedBody = cleanedBody.replace(/\n\}\s*$/, '').trimEnd()

  const usedSchemas = detectSchemas(cleanedBody)
  const schemaImport = usedSchemas.length > 0
    ? `import { ${usedSchemas.join(', ')} } from '@ihui/database'\n`
    : ''

  const drizzleOps = new Set()
  const ops = ['eq', 'inArray', 'notInArray', 'ilike', 'desc', 'asc', 'sql', 'and', 'or']
  for (const op of ops) {
    if (new RegExp(B + op + B).test(cleanedBody)) drizzleOps.add(op)
  }
  const drizzleImport = drizzleOps.size > 0
    ? `import { ${[...drizzleOps].join(', ')} } from 'drizzle-orm'\n`
    : ''

  // 检测 db/. 多行场景(drizzle 链式调用 db 换行后 .method())
  const needsDb = new RegExp(B + 'db' + B + '\\s*\\.').test(cleanedBody)
  const needsSuccess = new RegExp(B + 'success' + B).test(cleanedBody)
  const needsError = new RegExp(B + 'error' + B).test(cleanedBody)
  const needsRequireAdmin = new RegExp(B + 'requireAdmin' + B).test(cleanedBody)
  const needsCrypto = new RegExp(B + '(encryptJSON|decryptJSON|isEncryptedPayload)' + B).test(cleanedBody)
  // z 仅在 body 直接使用 z.X 或 .safeParse() 时导入
  const needsZ = new RegExp(
    B + 'z' + B + '\\.(object|string|number|boolean|array|union|optional|preprocess|coerce|enum|record|unknown|literal|infer|input|transform|refine|safe|int|min|max|positive|date|regex|extend|nativeEnum|tuple)' + B,
  ).test(cleanedBody) || new RegExp('\\.safeParse\\(').test(cleanedBody)

  const coreImports = []
  if (needsDb) coreImports.push(`import { db } from '../../db/index.js'`)
  if (needsSuccess || needsError) {
    const fns = [needsSuccess && 'success', needsError && 'error'].filter(Boolean).join(', ')
    coreImports.push(`import { ${fns} } from '../../utils/response.js'`)
  }
  if (needsRequireAdmin)
    coreImports.push(`import { requireAdmin } from '../../plugins/require-permission.js'`)
  if (needsCrypto)
    coreImports.push(
      `import { encryptJSON, decryptJSON, isEncryptedPayload } from '../../utils/crypto.js'`,
    )

  const sharedNames = [
    'paginationSchema',
    'commentLogQuerySchema',
    'videoLogQuerySchema',
    'idParamSchema',
    'updateAuthInfoSchema',
    'createRoleSchema',
    'updateRoleSchema',
    'createVipLevelSchema',
    'updateVipLevelSchema',
    'createSmsTemplateSchema',
    'updateSmsTemplateSchema',
    'createUserRoleSchema',
    'createPermissionSchema',
    'updatePermissionSchema',
    'registerCrud',
    'fields',
  ]
  const usedShared = sharedNames.filter((n) => new RegExp(B + n + B).test(cleanedBody))
  const sharedImport = usedShared.length > 0
    ? `import { ${usedShared.join(', ')} } from './_shared.js'\n`
    : ''

  const fname = `${s.prefix.replace(/\//g, '-')}.ts`
  const varName = camelCase('/' + s.prefix) + 'Routes'

  const header = `/**
 * /api/admin/${s.prefix} 路由(从 admin-missing-routes.ts 拆分)。
 */
import type { FastifyPluginAsync } from 'fastify'
${needsZ ? `import { z } from 'zod'\n` : ''}${coreImports.join('\n')}
${schemaImport}${drizzleImport}${sharedImport}
const ${varName}: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', requireAdmin)
`

  const footer = `\n}\n\nexport default ${varName}\n`

  const out = header + cleanedBody + footer
  writeFileSync(join(adminDir, fname), out, 'utf8')
  console.log(`  wrote admin/${fname} (${cleanedBody.length} chars)`)
}

// 6) 重写主文件
const mainHeader = `/**
 * admin-missing-routes: 路由 hub,负责注册 admin/ 目录下所有子路由。
 * 原始实现已拆分到 admin/*.ts,本文件只保留注册逻辑。
 */
import type { FastifyPluginAsync } from 'fastify'
import { requireAdmin } from '../plugins/require-permission.js'
`

const registerCalls = sections
  .map((s) => {
    const varName = camelCase('/' + s.prefix) + 'Routes'
    return `  const { default: ${varName} } = await import('./admin/${s.prefix.replace(/\//g, '-')}.js')\n  await server.register(${varName})`
  })
  .join('\n\n')

const mainBody = `export const adminMissingRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', requireAdmin)

${registerCalls}
}
`

writeFileSync(targetFile, mainHeader + mainBody, 'utf8')
console.log('rewrote admin-missing-routes.ts')
