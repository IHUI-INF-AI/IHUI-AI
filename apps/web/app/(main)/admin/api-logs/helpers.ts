import type { ApiLog } from './types'

export const METHOD_COLOR: Record<string, string> = {
  GET: 'bg-primary/10 text-primary',
  POST: 'bg-emerald-500/10 text-emerald-600',
  PATCH: 'bg-amber-500/10 text-amber-600',
  PUT: 'bg-amber-500/10 text-amber-600',
  DELETE: 'bg-red-500/10 text-red-600',
}

export const th = 'px-4 py-2.5 font-medium'

export const selectClass =
  'h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

export function genMockLogs(): ApiLog[] {
  const methods = ['GET', 'POST', 'PATCH', 'DELETE']
  const endpoints = [
    '/api/agents',
    '/api/chat/messages',
    '/api/admin/users',
    '/api/orders',
    '/api/health',
    '/api/upload',
    '/api/members',
  ]
  const users = ['admin@ihui.ai', 'user01@ihui.ai', 'user02@ihui.ai', 'system', 'guest']
  const logs: ApiLog[] = []
  for (let i = 0; i < 58; i++) {
    const method = methods[Math.floor(Math.random() * methods.length)] ?? 'GET'
    const ok = Math.random() > 0.15
    const statusCode = ok
      ? method === 'POST'
        ? 201
        : 200
      : ([400, 401, 403, 404, 500][Math.floor(Math.random() * 5)] ?? 500)
    logs.push({
      id: `log-${i}`,
      time: `2026-07-10 0${8 + (i % 9)}:${String((i * 7) % 60).padStart(2, '0')}:${String((i * 13) % 60).padStart(2, '0')}`,
      endpoint: endpoints[Math.floor(Math.random() * endpoints.length)] ?? '',
      method,
      statusCode,
      latency: Math.floor(Math.random() * 800) + 10,
      ip: `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
      user: users[Math.floor(Math.random() * users.length)] ?? '',
    })
  }
  return logs
}
