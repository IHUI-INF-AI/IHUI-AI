// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 智能体收藏/点赞与分类字典的端内接口路径回归(台账行「RN 与 api-client 三处接口路径多写一段 agents」)
//
// 立票事实(现读,非推断):
//   ①② apps/mobile-rn/src/screens/HomeScreen.tsx 的收藏/点赞曾写 cozeZhsApi 前缀下带 agents 段的
//      collect / thumbs,归一后多一段 agents ⇒ 运行时必 404;后端 apps/api/src/routes/agents.ts
//      注册的是 server.post 直写的 /collect 与 /thumbs,经 routes/index.ts 的
//      register(agentsRoutes, { prefix: /api }) 挂载 ⇒ 实际路径 /api/collect、/api/thumbs。
//      该两处已修入库(提交 f3bf8bd3fc),本测试防回潮。
//   ③ packages/api-client/src/endpoints/agent.ts 的 getAgentCategories 请求
//      cozeZhsApi 前缀下的 cache/agent-category-dict/categories(fetchApi 的 normalizeUrl 归一为
//      /api 前缀),后端由 agent-category-dict.ts 以绝对路径字面量注册(机主拍板新建的公开端点)。
//
// 2026-10-15 尺子重定锚(调用点已迁移,原尺子读空→红):
//   HomeScreen 的收藏/点赞现役实现不再直写 fetchApi —— 提交 63b94c98ce 把 collect/thumbs 调用
//   连同 fetchApi 直写一并删除,改走 api-client 包装:HomeScreen.handleAssistantFavorite →
//   addFavorite/deleteFavorite(endpoints/social.ts → '/favorites'),Drawer → favoriteConversation
//   (endpoints/chat.ts → '/api/chat/conversations/:id/favorite');后端 socialRoutes 挂 prefix '/api'
//   注册 server.post('/favorites') 与 server.delete('/favorites/:resourceType/:resourceId')。
//   防回潮目标不变(收藏/点赞路径不得多写一段 agents),只是现读面从 HomeScreen 的 fetchApi
//   直写,换成「api-client 端字面量 ⟷ 后端注册面」两端相等 + 不含 agents 段 + 变异有牙。
//   原 agents.ts 的 /collect /thumbs 注册仍在(后端留旧面),但已无任何端内调用方 —— 不再作为
//   尺子目标,只保留其「不得被重新调用」语义:客户端现役面必须是 /favorites 系。
//
// 为什么不只靠守门 8:守门 8 按 §12e 对存量只报数不判红,且其默认面是 HEAD blob
// (要 --worktree 才看工作树读数)。这条测试在提交链上钉住现役调用点的现读事实;
// 两端路径都从源码现读,不在测试里抄第二份真相。
//
// 注意:本文件不写引号紧邻的错误路径字面量 —— 守门 8 的 pathRe 把引号与反引号同等当引号,
// 写出来会被抽成调用点;反例路径一律用数组 join 现拼。
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, it, expect } from 'vitest'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8')

const RN_HOME = 'apps/mobile-rn/src/screens/HomeScreen.tsx'
const RN_SRC = 'apps/mobile-rn/src'
const CLIENT_SRC = 'packages/api-client/src'
const CLIENT_SOCIAL = 'packages/api-client/src/endpoints/social.ts'
const CLIENT_CHAT = 'packages/api-client/src/endpoints/chat.ts'
const AGENT_ENDPOINT = 'packages/api-client/src/endpoints/agent.ts'
const API_AGENTS_ROUTE = 'apps/api/src/routes/agents.ts'
const API_ROUTES_INDEX = 'apps/api/src/routes/index.ts'
const API_DICT_ROUTE = 'apps/api/src/routes/agent-category-dict.ts'
const API_SOCIAL_ROUTE = 'apps/api/src/routes/social.ts'
const API_CHAT_ROUTE = 'apps/api/src/routes/chat.ts'

/**
 * 通道等价归一档 —— 与 api-client normalizeUrl(client.ts L546-555)逐分支同规则:
 * 绝对 http(s) 原样; /api/ /uploads/ /ws/ 原样; /cozeZhsApi 换 /api; 其余以 / 开头补 /api;
 * 不带斜杠的补 /api/。守门 8 CE① 的 /cozeZhsApi 规则同样涵盖。
 */
const normalize = (p: string): string => {
  if (/^https?:\/\//i.test(p)) return p
  if (p.startsWith('/api/') || p.startsWith('/uploads/') || p.startsWith('/ws/')) return p
  if (p.startsWith('/cozeZhsApi')) return p.replace(/^\/cozeZhsApi/, '/api')
  if (p.startsWith('/')) return `/api${p}`
  return `/api/${p}`
}

/** 多写一段 agents 的错误路径(现拼,不落字面量) */
const wrongPath = (...segs: string[]): string => ['/api', ...segs].join('/')

/** 从源码抽 fetchApi 调用点的路径字面量;引号紧邻才算(注释里的路径不带引号,不会命中) */
function fetchApiPaths(src: string): string[] {
  const out: string[] = []
  for (const m of src.matchAll(/fetchApi\s*(?:<[^(]*>)?\s*\(\s*(['"`])([^'"`]+)\1/g)) {
    if (m[2]) out.push(m[2])
  }
  return out
}

/** 递归列目录下全部源码文件(相对 ROOT,正斜杠) */
function listSourceFiles(relDir: string): string[] {
  const abs = join(ROOT, relDir)
  const out: string[] = []
  for (const name of readdirSync(abs)) {
    const rel = `${relDir}/${name}`
    const st = statSync(join(ROOT, rel))
    if (st.isDirectory()) out.push(...listSourceFiles(rel))
    else if (/\.(ts|tsx)$/.test(name)) out.push(rel)
  }
  return out
}

/** 从指定函数签名起,抽函数体(取前 600 字符窗口)里的第一个引号路径字面量 */
function firstPathInFn(src: string, fnSig: string): string {
  const start = src.indexOf(fnSig)
  if (start < 0) throw new Error(`函数 ${fnSig} 不见了 —— 提取尺子失效,请随调用面重定锚`)
  const lit = /(['"`])(\/[^'"`]+)\1/.exec(src.slice(start, start + 600))
  if (!lit?.[2]) throw new Error(`${fnSig} 函数体读不到路径字面量 —— 形态变了`)
  return lit[2]
}

describe('端内收藏/点赞路径(①②):不得再多写 agents 段', () => {
  // ── 现役面(2026-10-15 重定锚,原 fetchApi 直写尺子已读空):api-client 四条收藏函数 ──
  const clientPaths = (): string[] =>
    [
      firstPathInFn(read(CLIENT_SOCIAL), 'export async function addFavorite'),
      firstPathInFn(read(CLIENT_SOCIAL), 'export async function deleteFavorite'),
      firstPathInFn(read(CLIENT_CHAT), 'export function favoriteConversation'),
      firstPathInFn(read(CLIENT_CHAT), 'export function unfavoriteConversation'),
    ].map(normalize)

  it('提取尺子先自证非空,现役收藏四条路径全落 /api 归一面', () => {
    const paths = clientPaths()
    expect(paths.length, '四条现役收藏函数路径应都读得到').toBe(4)
    for (const p of paths) expect(p, `${p} 未归一到 /api 归一面`).toMatch(/^\/api\//)
  })

  it('死调用不得回来(全端现读):端内任何 fetchApi 调用点都不是带 agents 段的,也不再直写 collect/thumbs', () => {
    const files = [...listSourceFiles(RN_SRC), ...listSourceFiles(CLIENT_SRC)]
    const all: string[] = []
    for (const rel of files) all.push(...fetchApiPaths(read(rel)).map(normalize))
    expect(all.length, '全端 fetchApi 调用点应仍读得到(防提取器空转)').toBeGreaterThan(0)
    expect(all).not.toContain(wrongPath('agents', 'collect'))
    expect(all).not.toContain(wrongPath('agents', 'thumbs'))
    // 迁移语义:collect/thumbs 已改走 /favorites 系,直写调用点必须绝迹(旧面 agents.ts 仍注册但无人调)
    expect(all, 'collect/thumbs 直写调用点已迁移至 /favorites,不得回来').not.toContain(
      '/api/collect',
    )
    expect(all).not.toContain('/api/thumbs')
  })

  it('变异有牙:把现役路径改回 agents 段,同一把尺子必须当场读出违规', () => {
    // 现役四条路径都不得落 agents 段(提取自证)
    expect(
      clientPaths().some(
        (p) => p === wrongPath('agents') || p.startsWith(`${wrongPath('agents')}/`),
      ),
      '现役路径不该已含 agents 段(否则本尺子前提不成立)',
    ).toBe(false)
    // 现役面变异:把 addFavorite 的 '/favorites' 换成带 agents 段的错误路径
    const social = read(CLIENT_SOCIAL)
    const regressed = social.replace(`'/favorites'`, `'${wrongPath('agents', 'favorites')}'`)
    expect(regressed, '变异没咬到调用点 —— 提取面已不是本测试认的那个形态').not.toBe(social)
    const path = normalize(
      /(['"`])(\/[^'"`]+)\1/.exec(
        regressed.slice(regressed.indexOf('export async function addFavorite')),
      )![2]!,
    )
    expect(path, '变异路径未被读成违规').toBe(wrongPath('agents', 'favorites'))
  })

  it('HomeScreen 收藏现役走 api-client 包装(不再直写 fetchApi)', () => {
    const home = read(RN_HOME)
    expect(home, 'HomeScreen 应走 addFavorite/deleteFavorite 包装').toContain('addFavorite')
    expect(home).toContain('deleteFavorite')
    expect(home, 'HomeScreen 不得再出现 fetchApi 直写调用点').not.toMatch(/fetchApi\s*\(/)
  })

  it('后端注册面:旧 agents 面留旧账(仍注册),现役 favorites 面两端同轨', () => {
    // 旧面(票面事实保留:agents.ts 的 /collect /thumbs 注册仍在,仅无调用方)
    const agents = read(API_AGENTS_ROUTE)
    const locals = [...agents.matchAll(/server\.post\(\s*(['"`])([^'"`]+)\1/g)].map((m) => m[2])
    expect(locals).toContain('/collect')
    expect(locals).toContain('/thumbs')
    // 现役 social 面:POST/DELETE /favorites + socialRoutes 挂 /api
    const social = read(API_SOCIAL_ROUTE)
    expect(social, '后端应注册 POST /favorites').toMatch(/server\.post\(\s*['"]\/favorites['"]/)
    expect(social, '后端应注册 DELETE /favorites/:resourceType/:resourceId').toMatch(
      /server\.delete\(\s*['"]\/favorites\/:resourceType\/:resourceId['"]/,
    )
    const chat = read(API_CHAT_ROUTE)
    expect(chat, '后端应注册对话收藏面 /conversations/:id/favorite').toMatch(
      /server\.(?:post|delete)\(\s*['"]\/conversations\/:id\/favorite['"]/,
    )
    const index = read(API_ROUTES_INDEX)
    expect(index).toMatch(/register\(\s*agentsRoutes\s*,\s*\{\s*prefix:\s*['"]\/api['"]\s*\}/)
    expect(index).toMatch(/register\(\s*socialRoutes\s*,\s*\{\s*prefix:\s*['"]\/api['"]\s*\}/)
    expect(index).toMatch(/register\(\s*chatRoutes\s*,\s*\{\s*prefix:\s*['"]\/api\/chat['"]\s*\}/)
  })
})

describe('api-client 分类字典路径(③):客户端现读路径必须等于后端注册字面量', () => {
  /** 从 getAgentCategories 函数体现读第一个路径字面量(真相在两端源码,不在测试里抄) */
  function clientPath(): string {
    const src = read(AGENT_ENDPOINT)
    const start = src.indexOf('export async function getAgentCategories')
    if (start < 0) throw new Error('getAgentCategories 被改名或摘线 —— 提取尺子失效')
    const body = src.slice(start, start + 600)
    const lit = /(['"`])(\/[^'"`]+)\1/.exec(body)
    if (!lit?.[2]) throw new Error('函数体里读不到路径字面量 —— 形态变了')
    return normalize(lit[2])
  }

  /** 后端 agent-category-dict.ts 的 server.get 绝对路径字面量 */
  function serverPath(): string {
    const src = read(API_DICT_ROUTE)
    const lit = /server\.get\(\s*(['"`])(\/[^'"`]+)\1/.exec(src)
    if (!lit?.[2]) throw new Error('后端注册形态变了(不再是 server.get + 绝对字面量)')
    return lit[2]
  }

  it('两端现读路径逐字相等,且落在 /api 归一面上', () => {
    const c = clientPath()
    const s = serverPath()
    expect(c).toMatch(/^\/api\//)
    expect(c, `${c} ≠ 后端注册的 ${s}`).toBe(s)
  })

  it('路由确实被挂进 Fastify(不是只写了没人 register)', () => {
    const index = read(API_ROUTES_INDEX)
    expect(index).toMatch(/register\(\s*agentCategoryDictRoutes\s*\)/)
  })

  it('变异有牙:客户端多写一段就不再等于注册面', () => {
    const s = serverPath()
    const tampered = s.replace('/cache/', '/agents/cache/')
    expect(tampered).not.toBe(s)
    expect(clientPath()).not.toBe(tampered)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
