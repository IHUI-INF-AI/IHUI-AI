// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * docs-slug-404-status-pair.spec.ts — 文档中心 HTTP 状态码的**成对**牙(2026-11-05 立,票 D53)
 *
 * 为什么还要再钉一枚:闸(src/lib/docs-detail-gate.ts 由 proxy.ts 接线)早已存在,但仓内既有断言
 * 各自只盖住一半 ——
 *   ① `src/app-tests/docs-slug-404-contract.test.ts` 判的是「闸返回 404 / null」这个**纯函数值**,
 *      它说不出「客户端实际拿到的那一枚响应码」;
 *   ② `e2e/docs-slug-404.spec.ts` 里状态码那条被 `IHUI_E2E_EXPECT_HARD_404` 旗标挡着(不置旗就
 *      skip),而同目录的已知页断言只写到 `status < 500` ⇒ **闸若被改宽(把正常文档页也判 404)
 *      或改窄(未知 slug 又回 200),这条 e2e 都不会响**;
 *   ③ 台账 D53 的口径只有「未知 slug 拿真 404」,没把「已知 slug 必须仍是 200」写进同一枚对照。
 * 本 spec 把两半合成一次对照:同一趟请求序列里,已知文档页必须恰好 200、未知 slug 必须恰好 404,
 * 任何一侧漂到对面(全 200 的软 404 回潮 / 全 404 的过宽闸)当场翻红。
 *
 * 三态判读(AGENTS §0.3「没判绝不写成判过」):
 *   404 ⇒ 判过且符合预期(连带核 noindex 与「不回显 slug」两条既有语义,不许被这次改动洗掉);
 *   200 ⇒ **红**(真 404 失效 = 软 404 回潮,正是本票要根治的缺陷);
 *   500 ⇒ 显式 skip 并点名原因(四态里的 'unknown' = 探针问不到,按判据不落 404,见
 *        src/lib/docs-slug-probe.ts),**不算绿**:能走到这一支的前提是上面那批已知页已各自断言过
 *        200,所以「整片文档都 500」会在已知页那一半先翻红,不会被这枚 skip 蒙混过去。
 * 分工:「missing 必映射 404」由纯函数层那份 contract test 钉,本 spec 只钉「HTTP 面上真拿到了」。
 *
 * 跑法(本机实测通过,复用已起的 8801,不自启也不重启任何服务):
 *   cd apps/web && PLAYWRIGHT_BROWSERS_PATH='D:\DevEnv\cache\playwright' \
 *   IHUI_E2E_EXTERNAL_SERVER=1 PLAYWRIGHT_BASE_URL=http://localhost:8801 E2E_SKIP_SEED=1 \
 *   ./node_modules/.bin/playwright test e2e/docs-slug-404-status-pair.spec.ts \
 *     --project=chromium --no-deps --workers=1
 * 只用 request 夹具(纯 HTTP,不开浏览器、不占他席的编译队列);游客态,不需要登录夹具
 * (置 E2E_SKIP_SEED=1 只是省掉 global-setup 那 60s 的 seed 预算,不影响本 spec 判定)。
 * 刻意不 import `src/lib/*`:e2e/tsconfig.json 不映射 `@/*`,一旦把 src 拉进图里就会把
 * `pnpm typecheck:e2e` 判红(2026-11-05 实测 src/lib/content.tsx → '@/lib/api' TS2307)。
 *
 * 本机实测记录(2026-11-05 夜间,两腿各一遍):
 *   - 本 spec 前两组(单段 + 多段)在 playwright 下 **2 passed**(14.2m);
 *   - 同一组断言另用只读探针在 8801(本机 dev)与 8851(本机生产腿)各跑一遍,均 22 条全过;
 *   - 第三组(目录树全量)现读枚出 18 枚真实文档页,两腿实测全部 200,零枚被闸判死。
 * 两条环境事实(不是本 spec 的缺陷,复现时先确认):
 *   ① 本机满负荷(实测 89 个 node 进程)时 Playwright 的 worker 注册要 8-14 分钟,期间 stdout
 *      一行不出 ⇒ 排查时先给它 ≥15 分钟再判死活;
 *   ② 并发席位在仓外 worktree 跑 `pnpm install` 会把 `apps/web/node_modules/@playwright/test`
 *      的符号链接改指到那个工作区(2026-11-06 02:20 实测),届时本 spec 会整组报「two different
 *      versions of @playwright/test」——那是装配污染,等对方装完/重链后重跑即可,不要去改本文件。
 */
import { existsSync, readdirSync, writeSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { expect, test } from '@playwright/test'

/**
 * 逐条即时落 stdout(fd 1,不经管道缓冲):满负荷机器上这条链要十几分钟,
 * 只等 reporter 收尾输出会把「正在慢」误读成「卡死了」。
 */
function mark(line: string): void {
  writeSync(1, `${line}\n`)
}

/** 本次专用幽灵 slug:仓内无同名目录、后端无同名记录,且不与既有 spec 的幽灵串共用(避免互相污染)。 */
const GHOST = 'e2e-doc-status-pair-ghost-zz7'

/**
 * 已知存在的文档页 = `app/(main)/docs` 目录树里的静态段(一级 + 二级各取一枚以上)。
 * 它们必须**恰好** 200:这是「闸不许把正常页面判死」那一半对照面,也是 /docs/[slug] 之外
 * 唯一不该被探针射程覆盖的路径族。(与 STATIC_DOC_SLUGS / STATIC_DOC_SUBPATHS 的逐字节等价由
 * `src/app-tests/docs-slug-404-contract.test.ts` ③ 对账目录树,本处只取其中几枚做活体对照。)
 */
const KNOWN_200_PATHS = ['/docs', '/docs/quickstart', '/docs/manual', '/docs/manual/account']

/** 品牌 404 页的标题字面值(构建期 404 资产与 not-found 共用);用来证「200 的那批没被渲染成 404 页」。 */
const BRAND_404_TITLE_MARK = '404 · 页面未找到'

test.describe('文档中心状态码成对断言(单段)', () => {
  test.setTimeout(120_000)

  test('已知 slug 恰好 200 ∧ 未知 slug 恰好 404', async ({ request }) => {
    // ── 半边一:已知文档页 200(先跑,好让「全 404 的过宽闸」在这一侧就当场翻红)──
    for (const docPath of KNOWN_200_PATHS) {
      const res = await request.get(docPath)
      const body = await res.text()
      mark(`known ${docPath} -> ${res.status()}`)
      expect(
        res.status(),
        `${docPath} 是仓内真实存在的静态文档页,必须 200(实测 ${res.status()})`,
      ).toBe(200)
      expect(
        body,
        `${docPath} 状态码是 200 却被渲染成 404 页 ⇒ 闸射程过宽会连正常文档一起打死`,
      ).not.toContain(BRAND_404_TITLE_MARK)
    }

    // ── 半边二:未知 slug 的硬状态码 ──
    const ghostPath = `/docs/${GHOST}`
    const res = await request.get(ghostPath)
    const status = res.status()
    const body = await res.text()
    mark(`ghost ${ghostPath} -> ${status}`)

    if (status === 500) {
      test.skip(
        true,
        `未判定:${ghostPath} 回 500 = 探针问不到(四态 'unknown'),按判据不落 404;需活的后端在场才判得动`,
      )
      return
    }

    expect(status, `${ghostPath} 回 200 ⇒ 软 404 回潮(本票 D53 要根治的正是这一型)`).toBe(404)
    // 既有语义不得被回退掉:not-found 侧的 noindex 仍在(台账 D53 已生效项之一)
    expect(
      res.headers()['x-robots-tag'] ?? '',
      `${ghostPath} 已 404,但 x-robots-tag 的 noindex 丢了 ⇒ 索引语义回退`,
    ).toContain('noindex')
    // 结构性不回显 slug:404 响应体里不许出现幽灵串(标题位回显 slug 就是软 404 的指纹)
    expect(body, `${ghostPath} 的 404 响应体回显了 slug 原文`).not.toContain(GHOST)
  })
})

test.describe('文档中心状态码成对断言(多段,零后端依赖)', () => {
  test.setTimeout(120_000)

  /**
   * 多段路径由 docsDeepPathGateStatus 按仓内目录树判,不探后端 ⇒ 这一组在任何环境(含后端缺席)
   * 都该成立,是「已知 200 / 未知 404」最干净的一对照,也是本 spec 无条件判红的一档。
   */
  test('登记的静态深层页 200 ∧ 未登记的多段 404', async ({ request }) => {
    const ok = await request.get('/docs/manual/account')
    const okBody = await ok.text()
    mark(`known /docs/manual/account -> ${ok.status()}`)
    expect(ok.status(), '/docs/manual/account 是登记的静态深层页,必须 200').toBe(200)
    expect(okBody).not.toContain(BRAND_404_TITLE_MARK)

    for (const ghost of [`/docs/${GHOST}/extra`, '/docs/manual/account/extra', '/docs/a/b/c']) {
      const res = await request.get(ghost)
      mark(`ghost ${ghost} -> ${res.status()}`)
      expect(res.status(), `${ghost} 在本应用没有任何路由承接,必须真 404`).toBe(404)
      expect(res.headers()['x-robots-tag'] ?? '', `${ghost} 缺 noindex}`).toContain('noindex')
      expect(await res.text(), `${ghost} 的 404 响应体回显了 slug 原文`).not.toContain(GHOST)
    }
  })
})

/**
 * 第三组:被审面 = `app/(main)/docs` 目录树本身(现读枚举,不抄清单)。
 *
 * 立因:`docsDeepPathGateStatus` 只对账**两层**深度(STATIC_DOC_SUBPATHS 的键形如 `manual/<段>`)。
 * 日后若新增三层或更深的文档页(如 `docs/manual/x/y/page.tsx`),它天然不在清单里 ⇒ 闸会把这枚
 * 真实页面判成硬 404,而 `docs-slug-404-contract.test.ts` ③ 的两层对账**看不出来**(它只比一层
 * 与两层的目录集合)。这一组把「树里每个含 page.tsx 的目录都必须拿 200」变成活体断言:深一层的
 * 页面一旦落地,要么同步登记清单、要么当场翻红,不会静默打死正常文档。只读枚举 + 只读 GET。
 */
test.describe('文档中心状态码成对断言(目录树全量,现读不抄清单)', () => {
  // 这一组要按树逐枚 GET(现读 18 枚)。本机满负荷时单枚请求要等十几秒,180s 会假红;
  // 给 5 分钟(空载机器上整组实际 <5s)。
  test.setTimeout(300_000)

  const docsRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../app/(main)/docs',
  )

  /** 递归收集「含 page.tsx 的目录」相对 docs 的路径;`[slug]` 动态段与 `_` 前缀私有段不参与。 */
  function collectDocPagePaths(dir: string, rel: string[], acc: string[]): void {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue
      if (entry.name.startsWith('[') || entry.name.startsWith('_')) continue
      const abs = path.join(dir, entry.name)
      const next = [...rel, entry.name]
      if (existsSync(path.join(abs, 'page.tsx'))) acc.push(next.join('/'))
      collectDocPagePaths(abs, next, acc)
    }
  }

  test('树里每一枚真实文档页都不被判成 404(闸射程不得吃掉已存在的页面)', async ({ request }) => {
    const relPaths: string[] = []
    if (existsSync(path.join(docsRoot, 'page.tsx'))) relPaths.push('')
    collectDocPagePaths(docsRoot, [], relPaths)
    mark(`tree enumerated=${relPaths.length} root=${docsRoot}`)
    // 现读枚举必须有产物:0 枚 = 路径拼错/目录被挪 ⇒ 宁可显式失败,不得让这组用例空转冒绿
    expect(relPaths.length, `在 ${docsRoot} 下枚举到 0 枚文档页,判据输入取不到`).toBeGreaterThan(0)

    for (const rel of relPaths) {
      const urlPath = rel === '' ? '/docs' : `/docs/${rel}`
      const res = await request.get(urlPath)
      mark(`tree ${urlPath} -> ${res.status()}`)
      expect(
        res.status(),
        `${urlPath} 在目录树里有 page.tsx,却拿到 ${res.status()} ⇒ 文档闸把已存在的页面判死了`,
      ).toBe(200)
      expect(await res.text(), `${urlPath} 被渲染成 404 页`).not.toContain(BRAND_404_TITLE_MARK)
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
