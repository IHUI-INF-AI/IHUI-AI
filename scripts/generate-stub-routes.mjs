#!/usr/bin/env node
/**
 * 根据 api-routes-missing.json 批量生成前端缺失路由桩。
 * 输出 apps/api/src/routes/frontend-stub-*.ts
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()
const missing = JSON.parse(readFileSync(join(ROOT, 'api-routes-missing.json'), 'utf8'))

// 已由其他文件真实实现或专门处理的路径前缀
const EXACT_SKIP = new Set([
  '/api/auth/google/callback',
  '/api/auth/apple/callback',
  '/api/auth/callback/wechat',
  '/api/auth/login/phone-code',
  '/api/auth/qr/generate',
  '/api/auth/2fa/status',
  '/api/auth/2fa/setup',
  '/api/auth/2fa/verify',
  '/api/auth/2fa/disable',
  '/api/auth/sso/code',
  '/api/auth/sso/exchange',
  '/api/auth/sso/logout',
  '/api/user/devices/:param',
  '/api/user/ip-whitelist',
  '/api/user/sessions/:param',
])

function normalize(path) {
  return path.replace(/:param/g, ':id').replace(/\/$/, '') || '/'
}

function fastifyPath(path) {
  // 把 :param 转成 :id（Fastify 参数名统一为 id，后续按位置使用）
  return path.replace(/:param/g, ':id')
}

function groupKey(path) {
  const parts = path.split('/').filter(Boolean)
  if (parts[0] !== 'api') return 'other'
  const second = parts[1] || 'root'
  if (second === 'admin') return 'admin'
  if (second === 'ai') return 'ai'
  if (second === 'edu' || second === 'learn') return 'edu'
  return 'other'
}

function dedupe(routes) {
  const seen = new Set()
  return routes.filter((r) => {
    const key = `${r.method} ${normalize(r.path)}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function handlerFor(method, path) {
  const segs = path.split('/').filter(Boolean)
  const last = segs[segs.length - 1]
  const isList = last !== ':id' && !last.includes(':')

  if (method === 'GET') {
    if (isList) {
      return `return reply.send(success({ list: [], total: 0 }))`
    }
    return `return reply.send(success({}))`
  }
  if (method === 'POST') {
    return `return reply.status(201).send(success({ created: true, id: randomUUID() }))`
  }
  if (method === 'PUT' || method === 'PATCH') {
    return `return reply.send(success({ updated: true }))`
  }
  if (method === 'DELETE') {
    return `return reply.send(success({ deleted: true }))`
  }
  return `return reply.send(success({ ok: true }))`
}

function buildFile(group, routes) {
  const lines = []
  lines.push(`/**`)
  lines.push(` * 前端 ${group} 模块缺失路由桩。`)
  lines.push(` * 来源：api-routes-missing.json 中未匹配到后端路由的调用。`)
  lines.push(` * 策略：统一返回空列表/空对象/操作成功，避免前端 404。`)
  lines.push(` */`)
  lines.push(`import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'`)
  lines.push(`import { randomUUID } from 'node:crypto'`)
  lines.push(`import { success } from '../utils/response.js'`)
  lines.push(``)
  lines.push(`export const frontendStub${capitalize(group)}Routes: FastifyPluginAsync = async (server) => {`)

  for (const r of routes) {
    const method = r.method.toLowerCase()
    const fp = fastifyPath(r.path).replace(/^\/api\//, '/')
    const handler = handlerFor(r.method, fp)
    lines.push(`  server.${method}('${fp}', async (_request: FastifyRequest, reply: FastifyReply) => {`)
    lines.push(`    ${handler}`)
    lines.push(`  })`)
  }

  lines.push(`}`)
  return lines.join('\n')
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

const groups = { admin: [], ai: [], edu: [], other: [] }

for (const r of missing) {
  if (EXACT_SKIP.has(r.path)) continue
  const g = groupKey(r.path)
  groups[g].push(r)
}

for (const [g, list] of Object.entries(groups)) {
  const deduped = dedupe(list)
  if (deduped.length === 0) continue
  const content = buildFile(g, deduped)
  writeFileSync(join(ROOT, `apps/api/src/routes/frontend-stub-${g}-routes.ts`), content, 'utf8')
  console.log(`Generated apps/api/src/routes/frontend-stub-${g}-routes.ts (${deduped.length} routes)`)
}
