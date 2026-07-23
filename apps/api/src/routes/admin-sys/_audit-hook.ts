import type { onResponseAsyncHookHandler } from 'fastify'
import { createOperlog } from '../../db/admin-sys-queries.js'

// sys_operlog 审计埋点:onResponse 钩子,异步记录 admin 后台写操作
// - 仅记录 POST/PUT/PATCH/DELETE(RuoYi businessType:1新增/2修改/3删除/0其他)
// - status: 0=正常(statusCode<400), 1=异常(statusCode>=400)
// - setImmediate 异步落库,失败忽略,不阻塞业务请求
// - 自身路由(/operlog/*)不记录,避免日志查询/清空产生自循环日志
const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])
const TITLE_MAP: Record<string, string> = {
  '/sys-menu': '菜单管理',
  '/dept': '部门管理',
  '/post': '岗位管理',
  '/config': '参数配置',
  '/dict-type': '字典类型',
  '/dict-data': '字典数据',
  '/notice': '通知公告',
  '/job': '定时任务',
  '/role': '角色管理',
  '/users': '用户管理',
  '/logininfor': '登录日志',
}
const METHOD_MAP: Record<string, number> = { POST: 1, PUT: 2, PATCH: 2, DELETE: 3 }

export const operlogAuditOnResponse: onResponseAsyncHookHandler = async (request, reply) => {
  const method = request.method.toUpperCase()
  if (!WRITE_METHODS.has(method)) return

  const url = request.url.split('?')[0] ?? ''
  // 命中 operlog 路由(列表/清空/删除)直接跳过,避免自循环
  if (url.includes('/operlog')) return

  // 从 URL 推断模块名(title)
  const segments = url.split('/').filter(Boolean)
  const seg = segments.find((s) => TITLE_MAP[`/${s}`])
  const title = (seg && TITLE_MAP[`/${seg}`]) || '系统管理'
  const businessType = METHOD_MAP[method] ?? 0
  const statusCode = reply.statusCode
  const status = statusCode >= 400 ? 1 : 0
  const operName = request.userId ?? ''
  const operIp = request.ip ?? ''
  const operUrl = url.slice(0, 255)

  // operParam:请求 body JSON 序列化(限长 2000 防止超大日志)
  let operParam: string | undefined
  try {
    const body = request.body
    if (body !== undefined && body !== null) {
      operParam = JSON.stringify(body).slice(0, 2000)
    }
  } catch {
    operParam = undefined
  }

  const jsonResult = JSON.stringify({ code: statusCode }).slice(0, 2000)
  const costTime = Math.max(0, Math.round(reply.elapsedTime ?? 0))

  setImmediate(() => {
    createOperlog({
      title,
      businessType,
      method: `${seg ?? 'system'}.${method.toLowerCase()}`,
      requestMethod: method,
      operatorType: 0,
      operName,
      operUrl,
      operIp,
      operParam,
      jsonResult,
      status,
      errorMsg: status === 1 ? `HTTP ${statusCode}` : undefined,
      costTime,
    }).catch(() => {
      /* 审计写入失败不影响业务 */
    })
  })
}
