// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 课程筛选屏的取数端点回归(2026-09-27 死调用票)
//
// 立票事实(现网实测,不是推断):
//   GET https://aizhs.top/api/courses?page=1&pageSize=20   → 404 Route GET:/api/courses not found
//   GET https://aizhs.top/api/learn/lessons?page=1&pageSize=2 → 200 {code:0,…,data:{list:[],total:0}}
// 改之前 apps/mobile-rn/src/screens/CourseFilterScreen.tsx 用 fetchApi('/courses') 自拼路径,
// 该路由**两端都不存在**,于是从「学习 → 课程分类 → 更多」进来永远是一片"加载失败"。
//
// 为什么还要一条测试:守门 8(check-api-routes)当时报的是「死调用 0 处」。它把
// 「任一 localPath × 任一绝对前缀」的笛卡尔集当注册面(注释自述:把 /api 与 /api/admin 当根去拼),
// 所以 ranking.ts 里挂在 /api/ranking 下的 `server.get('/courses')` 会组合出一条结构上不存在的
// /api/courses —— 组合集越大(实测 5140 路由 × 162 前缀),门越看不见这一型。把该门的判据换成
// 精确挂载图同样不行:实测 2675 处调用里 2092 处会"消失",因为 registerCrud 这类 helper 注册
// 形态挂载图读不到 —— 那是一把漏读两千的尺子,接进提交链等于造一台恒红门。
// 所以这里只钉住**这一个屏**:路径不写死在测试里,而是从 api-client 现读,再拿真实注册树验。
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8')

const SCREEN = 'apps/mobile-rn/src/screens/CourseFilterScreen.tsx'
const API_ROUTES_INDEX = 'apps/api/src/routes/index.ts'
const API_SERVER = 'apps/api/src/server.ts'
const LEARN_ENDPOINT_FILE = 'packages/api-client/src/endpoints/learn.ts'

/** 把 `import { a, b as c } from './x.js'` 与默认导入收成 局部名 → 相对模块路径 */
function importMap(src: string, ownDir: string): Map<string, string> {
  const out = new Map<string, string>()
  const re = /\bimport\s+((?:(?!\bfrom\b)[\s\S])*?)\s+from\s*['"](\.[^'"]*)['"]/g
  for (const m of src.matchAll(re)) {
    const target = normalize(`${ownDir}/${m[2].replace(/\.jsx?$/, '')}`)
    const named = /\{([^}]*)\}/.exec(m[1])
    if (named) {
      for (const raw of named[1].split(',')) {
        const parts = raw.trim().split(/\s+as\s+/)
        const local = (parts[1] || parts[0] || '').trim().replace(/^type\s+$/, '')
        if (local) out.set(local, target)
      }
    }
    const head = m[1].trim().replace(/^type\s+/, '')
    if (!head.startsWith('{') && !head.startsWith('*')) {
      const def = /^([A-Za-z_$][\w$]*)/.exec(head)
      if (def) out.set(def[1], target)
    }
  }
  return out
}

const normalize = (p: string) =>
  p
    .split('/')
    .reduce<string[]>((acc, seg) => {
      if (seg === '.' || seg === '') return acc
      if (seg === '..') acc.pop()
      else acc.push(seg)
      return acc
    }, [])
    .join('/')

const joinPrefix = (prefix: string, path: string) => {
  const p = prefix.replace(/\/+$/, '')
  if (!path || path === '/') return p || '/'
  return path.startsWith('/') ? `${p}${path}` : `${p}/${path}`
}

/**
 * 沿 `server.register(sym, { prefix })` 走一层到底(深度上限 4,带 visited 防环)。
 * 只认字面量前缀与字面量局部路径;认不出的挂载(第三方插件、模板前缀、registerCrud 这类
 * helper 注册)一律**不猜** —— 本测试只问"这条路径能不能被证明注册过",证明不了就是不在集合里,
 * 而那属于挂载形态读不到的已知盲区,由调用方的断言目标(learn.ts 是直写形态)规避。
 */
function collectRegisteredPaths(entryFiles: string[]): {
  paths: Set<string>
  templateMounted: string[]
} {
  const paths = new Set<string>()
  const templateMounted: string[] = []
  const visited = new Set<string>()
  const queue: Array<{ rel: string; prefix: string; depth: number }> = entryFiles.map((rel) => ({
    rel,
    prefix: '',
    depth: 0,
  }))
  while (queue.length) {
    const { rel, prefix, depth } = queue.shift()!
    const key = `${rel}@@${prefix}`
    if (visited.has(key) || depth > 4) continue
    visited.add(key)
    const src = read(rel)
    const dir = dirname(rel)
    const imports = importMap(src, dir)
    for (const m of src.matchAll(
      /\.(get|post|put|patch|delete|all)\s*\(\s*['"`]([^'"`]+)['"`]/g,
    )) {
      const full = canon(joinPrefix(prefix, m[2]))
      if (hasTemplateSeg(full)) templateMounted.push(full)
      else paths.add(full)
    }
    for (const m of src.matchAll(/\bregister\s*\(\s*([A-Za-z_$][\w$]*)\s*(?:,\s*\{([^)]*)\})?/g)) {
      const pre = /prefix\s*:\s*['"`]([^'"`]*)['"`]/.exec(m[2] || '')
      const target = imports.get(m[1])
      if (!target) continue
      const file = [`${target}.ts`, `${target}/index.ts`].find((c) => existsInRepo(c))
      if (file) queue.push({ rel: file, prefix: joinPrefix(prefix, pre ? pre[1] : ''), depth: depth + 1 })
    }
  }
  return { paths, templateMounted }
}

/** 只在后端源码里走树:取不到(不在 apps/api 下 / 不存在)即 false,不猜。 */
function existsInRepo(rel: string) {
  if (!rel.startsWith('apps/api/src/') || !rel.endsWith('.ts')) return false
  try {
    read(rel)
    return true
  } catch {
    return false
  }
}

/** 尾部斜杠不参与比较;插值段留给 hasRegistered 按"参数段"处理,不在这里抹成 * */
const canon = (p: string) => p.replace(/\/+$/, '')

/** 前端模板路径去掉插值(它们只会是查询串或 id 实值,不改变所属路由段) */
const stripInterp = (p: string) => p.replace(/\$\{[^}]*\}/g, '')

/** 后端路由段:':id' / '{id}' 是 Fastify 的参数段语法,可配任意实段 */
const isParamSeg = (seg: string) => /^:|^\{/.test(seg)

/**
 * 挂载路径里有**整段是插值**的(`server.get(\`/api/${vendor}\`)` 这类)结构上读不出实际路径 ——
 * 这类条目**不进集合**,因为把它当"能配任何实段"会让"这条路径没注册"的断言永远不成立
 * (实测 /api/${...} 会把 /api/courses 也"配上"),而把它当"不存在"又会造假死调用。
 * 单列出来报名:尺子的已知盲区必须是看得见的数字,不能是沉默。
 */
const hasTemplateSeg = (p: string) => p.split('/').some((s) => /^\$\{/.test(s))

function hasRegistered(paths: Set<string>, p: string): boolean {
  if (paths.has(p)) return true
  const fSegs = p.split('/')
  for (const entry of paths) {
    const bSegs = entry.split('/')
    if (bSegs.length !== fSegs.length) continue
    let ok = true
    for (let i = 0; i < bSegs.length; i++) {
      if (isParamSeg(bSegs[i]) || bSegs[i] === '*') continue
      if (bSegs[i] !== fSegs[i]) {
        ok = false
        break
      }
    }
    if (ok) return true
  }
  return false
}

/** 从 api-client 现读该端点真正请求的路径字面量 —— 不在测试里抄第二份真相 */
function endpointPath(): string {
  const src = read(LEARN_ENDPOINT_FILE)
  const start = src.indexOf('export async function getLearnCourses')
  if (start === -1) throw new Error('api-client 里找不到 getLearnCourses —— 出口被改名或摘线')
  const body = src.slice(start, start + 900)
  const lit = /[`'"]((\/api\/)[^`'"]*)[`'"]/.exec(body)
  if (!lit) throw new Error('没能从 getLearnCourses 读出 /api/ 开头的路径字面量 —— 形态变了')
  const p = canon(stripInterp(lit[1]))
  expect(p, '请求路径必须是完整字面量,否则本测试读不到它').toMatch(/^\/api\/[a-z]/)
  return p
}

describe('课程筛选屏取数端点必须真实存在', () => {
  it('屏不再自拼裸路径,改走 @ihui/api-client 的端点函数(§3 共享层优先)', () => {
    const src = read(SCREEN)
    expect(src).toMatch(/from '@ihui\/api-client'/)
    expect(src).toMatch(/getLearnCourses\s*\(/)
    expect(src, '端内不得再出现 fetchApi 裸路径调用').not.toMatch(/fetchApi\s*[<(]/)
    expect(src, '死调用不得回来').not.toMatch(/['"`]\/courses['"`]/)
  })

  it('api-client 现读到的路径能在 Fastify 注册树上找到', () => {
    const { paths } = collectRegisteredPaths([API_ROUTES_INDEX, API_SERVER])
    const p = endpointPath()
    expect(hasRegistered(paths, p), `${p} 不在真实挂载路径集合里`).toBe(true)
  })

  it('阳性对照:同一把尺子必须认不出拼错的路径与已知的死调用', () => {
    const { paths, templateMounted } = collectRegisteredPaths([API_ROUTES_INDEX, API_SERVER])
    const real = endpointPath()
    // 反例 1 —— 差一个字母就不该在集合里(证明不是"任何路径都算命中")
    expect(hasRegistered(paths, `${real}s`)).toBe(false)
    // 反例 2 —— 本次修掉的那一条:路由挂在 /api/ranking 下,所以 /api/courses 结构上不存在
    expect(hasRegistered(paths, '/api/courses')).toBe(false)
    // 反例 3 —— 尺子若整棵走空(取材/解析失效),上面两条会同时"通过",故必须量到非零
    expect(paths.size, '注册集合为空 = 尺子失效,不是没有死调用').toBeGreaterThan(200)
    // 反例 4 —— 读不出实路径的模板挂载必须**报名**,不得静默混进集合冒充"已注册"
    // (它们一旦进集合,"这条路径没注册"的断言永不可能成立 —— 实测 /api/${...} 会配上 /api/courses)
    expect(templateMounted.length, '本仓确有模板段挂载形态,它属已知盲区而不是"没有"').toBeGreaterThan(
      0,
    )
    expect(paths.has('/api/courses')).toBe(false)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
