// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * RN 资讯页(NewsScreen)取数域回归(2026-10-28 立)。
 *
 * 立票事实(逐条现读,不是推断):
 *   · 列表取的是 `GET /api/knowledge`(apps/api/src/routes/user/knowledge-routes.ts:22 →
 *     findPublishedKnowledge → **knowledge_base 表**);
 *   · 分类 chips 把 `code` 发出去,而后端 `paginationSchema`
 *     (apps/api/src/routes/user/_shared.ts:14-18)只认 page/pageSize/search ⇒ `code` 被
 *     **Zod 静默剥掉**,7 枚 chip 纯装饰,点哪一枚都是同一份列表;
 *   · 列表项点击接的是 `ArticleDetail` → `GET /api/articles/:id`(**news_articles 表**)
 *     ⇒ 列表给 knowledge 的 id、详情按 news 的 id 查,两条腿跨了两个域,点击恒查不到。
 *   所以这一屏此前不是"样式没对齐",是**链路不自洽**。小程序侧早已是 news 域
 *   (apps/miniapp-taro/src/pkg-content/news/list.tsx:120 getNewsList → /news/articles),
 *   落后的是 RN 这一端。
 *
 * 为什么钉在这里而不是靠对账门:门 257 判的是"这一格有没有屏",不判屏取哪个域;
 * 台账的 note 是散文,改回旧形态它也不会喊。域一致性只有按源码面判才判得住。
 */
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8')

const SCREEN = 'apps/mobile-rn/src/screens/NewsScreen.tsx'
const API_CLIENT_NEWS = 'packages/api-client/src/endpoints/community.ts'
const API_NEWS_ROUTE = 'apps/api/src/routes/news.ts'

/** 取 `const articlesQuerySchema = z.object({...})` 这一段源码体(顶层花括号配平,不猜形态) */
function articlesQuerySchemaSource(): string {
  const src = read(API_NEWS_ROUTE)
  const decl = src.indexOf('const articlesQuerySchema')
  if (decl === -1) throw new Error('news.ts 里找不到 articlesQuerySchema —— 服务端换了形态')
  const open = src.indexOf('{', src.indexOf('z.object', decl))
  if (open === -1) throw new Error('articlesQuerySchema 不是 z.object({...}) 形态')
  let depth = 0
  for (let i = open; i < src.length; i++) {
    const ch = src[i] as string
    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) return src.slice(open, i + 1)
    }
  }
  throw new Error('articlesQuerySchema 花括号没配平 —— 被读的那份文件语法已坏')
}

/** 从 api-client 现读 getNews 真正请求的路径字面量 —— 不在测试里抄第二份真相 */
function getNewsPath(): string {
  const src = read(API_CLIENT_NEWS)
  const start = src.indexOf('export async function getNews(')
  if (start === -1) throw new Error('api-client 里找不到 getNews —— 出口被改名或摘线')
  const body = src.slice(start, start + 400)
  const lit = /[`'"]([^`'"]*articles[^`'"]*)[`'"]/.exec(body)
  if (typeof lit?.[1] !== 'string') throw new Error('没能从 getNews 读出 articles 路径字面量')
  return lit[1]
}

describe('RN 资讯页必须落在 news 域,且列表与详情同域', () => {
  it('列表取数走 api-client 的 getNews,不再自拼 /api/knowledge', () => {
    const src = read(SCREEN)
    expect(src).toMatch(/from '@ihui\/api-client'/)
    expect(src, '资讯列表必须经 getNews 出口(共享层优先,§3)').toMatch(/getNews\s*\(/)
    expect(src, 'knowledge 域取数不得回来(那是本次修掉的根)').not.toMatch(
      /fetchApi\s*[<(][^)]*['"`]\/api\/knowledge/,
    )
  })

  it('列表项点击与列表同域:接 NewsArticle(不再接跨域的 ArticleDetail)', () => {
    const src = read(SCREEN)
    expect(src, '点击必须接 news 域详情路由,否则列表 id 与详情查询不同表').toMatch(
      /navigate\(\s*['"`]NewsArticle['"`]/,
    )
    expect(src, '跨域点击不得回来').not.toMatch(/navigate\(\s*['"`]ArticleDetail['"`]/)
  })

  it('分类 chips 由源头驱动,端内不得再有硬编码 code 组', () => {
    const src = read(SCREEN)
    expect(src, '分类必须现读 /api/news/categories').toMatch(/\/api\/news\/categories/)
    expect(src, '端内硬编码 code 是"点了不筛"的成因,不得回来').not.toMatch(/code:\s*['"`]ARTF_INTG['"`]/)
    for (const dead of ['news.catAi', 'news.catMl', 'news.catChip']) {
      expect(src, `写死的分类 i18n 键 ${dead} 不得回来(分类名住在 news_categories 表)`).not.toContain(dead)
    }
  })

  it('跨层锁:屏上发得出且 api-client 声明得的查询键,服务端必须认(阳性对照同条命令给)', () => {
    const schemaSrc = articlesQuerySchemaSource()
    // 尺子自身先量住:整棵读空 ⇒ 下面所有断言都会"通过"
    for (const k of ['page', 'pageSize', 'categoryId', 'search']) {
      expect(schemaSrc, `articlesQuerySchema 应含 ${k}`).toContain(`${k}:`)
    }
    expect(schemaSrc, '服务端不认的键不得被算进认的集合').not.toContain('notARealQueryParam:')

    // 屏实际下传的键:categoryId(「全部」时整键不下传)
    const screen = read(SCREEN)
    expect(screen).toContain('categoryId')
    expect(schemaSrc, 'categoryId 必须是服务端顶层键(Zod 会静默剥掉不认的键 ⇒ 筛不动还不报错)').toContain(
      'categoryId:',
    )

    // api-client 的真实路径必须就是后端注册的资讯列表路由
    const p = getNewsPath()
    const routeSrc = read(API_NEWS_ROUTE)
    expect(routeSrc, `${p} 必须有对应注册形态`).toContain(`'/news/articles'`)
    expect(p).toContain('news/articles')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
