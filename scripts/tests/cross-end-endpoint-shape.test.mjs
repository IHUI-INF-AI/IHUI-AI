// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 跨端「同一端点:后端形状 ↔ 各端读法」契约对账(常驻回归,不在提交链)。
// 立因:探针按"调用点邻近行出现的字段名"比两端,抽样 12 条里逐条读代码后坐实四族；随后按同一
// 反模式(端内 `fetchApi<X[]>` + 直接把 data 喂列表)扫出剩余 44 处候选，又逐条读后端收口十族
// (activities、announcements、certificates、coupons、feedbacks、help/articles、invited-users、
//  notifications、memory、live/history)共十四族 ——
// 后四族里有三条的注册是**多行形态**(`server.get(` 换行再写路径)：本仓的路径不能按整串字面量
// grep 就判"没有服务端"，本轮就被它骗过一次(曾把 GET /api/notifications 误登记成死端点)。
//   · apps/mobile-rn/src/screens/HistoryScreen.tsx 曾把 GET /api/browse-history 的整个信封
//     {list,total,page,pageSize} 当数组用 ⇒ FlatList 拿到对象不报错,只是永远空列表;
//   · apps/extension/.../ChatFavoritesPage.tsx 曾按 PageData 读 .list,而后端回的是 {favorites,…}
//     ⇒ 静默 undefined ⇒ 该页永远"暂无收藏"。
//   · apps/mobile-rn/src/screens/ExamHistoryScreen.tsx 与第一站同形(后端 {list,total,…},它按数组读)。
//   · GET /api/agents 后端回 {list,total,page,pageSize},而 web agent-runtime 页与 RN 市场页
//     **两端都**按数组读 ⇒ 这一族唯一正确的是共享层 packages/api-client 的 PageData<Agent> 声明,
//     所以本契约把共享层也钉成第三方消费端:两端与它不一致时,红的是端。
// 共同点:**没有任何一层会红**,只有用户看得见。
// 本文件不判红仓库里的其它端点:它只钉下方 REGISTRY 列出的族,新增族必须先人读后端 handler 再登记。
// 刻意不进本契约的两条:GET /api/chat/templates 与 GET /api/notifications **没有任何服务端注册**
//   (前者两端都读 .list 而无人回该形状;后者的 GET 只在 /api/ai-feed 下存在)⇒ 那是"接口不存在",
//   不是"两端读法不同",补服务端属新增 API,须另票由人定档,不由本文件冒充已判。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const read = (rel) => {
  assert.ok(
    existsSync(join(ROOT, rel)),
    `契约面点名文件 ${rel} 不在盘上 ⇒ 判据失明,不得读成"已通过"`,
  )
  const t = readFileSync(join(ROOT, rel), 'utf8')
  assert.ok(t.trim().length > 0, `契约面点名文件 ${rel} 是空文件 ⇒ 判据失明`)
  return t
}

/**
 * 一条契约 = 后端回什么键 + 每个消费端必须读那个键。
 * consumer 的 pattern 用**函数**给,这样变异对照能直接改文本再喂同一个判据(而不是改正则本身)。
 */
const REGISTRY = [
  {
    ep: 'GET /api/browse-history',
    backend: 'apps/api/src/routes/other/history-routes.ts',
    backendProves: (src) => /return reply\.send\(\s*success\(\{\s*list,\s*total/.test(src),
    consumers: [
      {
        end: 'web',
        file: 'apps/web/app/(main)/member/history/page.tsx',
        reads: (src) =>
          /\.list\b/.test(src) &&
          !/fetchApi<HistoryItem\[\]>|fetchApi<\w+\[\]>\('\/api\/browse-history/.test(src),
      },
      {
        end: 'mobile-rn',
        file: 'apps/mobile-rn/src/screens/HistoryScreen.tsx',
        reads: (src) => /res\.data\?\.list/.test(src) && !/fetchApi<HistoryItem\[\]>/.test(src),
      },
    ],
  },
  {
    ep: 'GET /api/chat/favorites',
    backend: 'apps/api/src/routes/chat.ts',
    backendProves: (src) =>
      /server\.get\('\/favorites'[\s\S]{0,900}?success\(\{\s*favorites:/m.test(src),
    consumers: [
      {
        end: 'web',
        file: 'apps/web/app/(main)/chat/favorites/page.tsx',
        reads: (src) => /\.data\.favorites\b/.test(src),
      },
      {
        end: 'extension',
        file: 'apps/extension/entrypoints/sidepanel/pages/ChatFavoritesPage.tsx',
        reads: (src) => /res\.data\?\.favorites/.test(src) && !/type PageData/.test(src),
      },
    ],
  },
  {
    ep: 'GET /api/exam/records',
    backend: 'apps/api/src/routes/exam.ts',
    backendProves: (src) =>
      /server\.get\('\/exam\/records'[\s\S]{0,1200}?success\(\{\s*list,/m.test(src),
    consumers: [
      {
        end: 'web',
        file: 'apps/web/app/(main)/user/exam/page.tsx',
        reads: (src) => /r\.data\?\.list/.test(src),
      },
      {
        end: 'mobile-rn',
        file: 'apps/mobile-rn/src/screens/ExamHistoryScreen.tsx',
        reads: (src) => /res\.data\?\.list/.test(src) && !/fetchApi<ExamHistoryItem\[\]>/.test(src),
      },
    ],
  },
  {
    // 这一族过去**两端都**按数组读(不只是移动端),所以把共享层的正确声明也钉进来当第三方:
    // 谁与 `PageData<Agent>` 不一致,红的是端,不是契约。
    ep: 'GET /api/agents',
    backend: 'apps/api/src/routes/agents.ts',
    backendProves: (src) =>
      /server\.get\('\/agents', handleListAgents\)/.test(src) &&
      /success\(\{\s*\.\.\.result,\s*list:/.test(src),
    consumers: [
      {
        end: 'shared(api-client)',
        file: 'packages/api-client/src/endpoints/agent.ts',
        reads: (src) => src.includes('fetchApi<PageData<Agent>>'),
      },
      {
        end: 'web',
        file: 'apps/web/app/(main)/agent-runtime/page.tsx',
        reads: (src) => /r\.data\?\.list/.test(src) && !/fetchApi<Agent\[\]>/.test(src),
      },
      {
        end: 'mobile-rn',
        file: 'apps/mobile-rn/src/screens/AgentMarketScreen.tsx',
        reads: (src) => /res\.data\?\.list/.test(src) && !/fetchApi<AgentMarketItem\[\]>/.test(src),
      },
    ],
  },
  {
    // 这一族与第④族同形：**RN 与小程序两侧都**按数组读，而 web 早就读 d.list ⇒ 用户看到的
    // 就是"移动端列表空白、网页有数据"。注册是多行形态(server.get( 换行 '/activities')，
    // 所以 backendProves 必须跨行匹配 —— 单行 grep 会把它读成"没有这个路由"。
    ep: 'GET /api/activities',
    backend: 'apps/api/src/routes/promotions.ts',
    backendProves: (src) =>
      /server\.get\(\s*'\/activities',[\s\S]{0,700}?success\(\{ list \}\)/.test(src),
    consumers: [
      {
        end: 'web',
        file: 'apps/web/app/(main)/activities/page.tsx',
        reads: (src) => /d\.list \?\? \[\]/.test(src),
      },
      {
        end: 'mobile-rn',
        file: 'apps/mobile-rn/src/screens/ActivityScreen.tsx',
        reads: (src) => /res\.data\?\.list/.test(src) && !/fetchApi<ActivityItem\[\]>/.test(src),
      },
      {
        end: 'miniapp-taro',
        file: 'apps/miniapp-taro/src/pkg-content/activity/index.tsx',
        reads: (src) => /res\.data\?\.list/.test(src) && !/fetchApi<ActivityItem\[\]>/.test(src),
      },
    ],
  },
  {
    ep: 'GET /api/announcements',
    backend: 'apps/api/src/routes/content.ts',
    backendProves: (src) =>
      /server\.get\(\s*'\/announcements',[\s\S]{0,1200}?success\(\{ list:/.test(src),
    consumers: [
      {
        end: 'web',
        file: 'apps/web/app/(main)/announcements/page.tsx',
        reads: (src) => /d\.list \?\? \[\]/.test(src),
      },
      {
        end: 'mobile-rn',
        file: 'apps/mobile-rn/src/screens/AnnouncementScreen.tsx',
        reads: (src) =>
          /res\.data\?\.list/.test(src) && !/fetchApi<AnnouncementItem\[\]>/.test(src),
      },
      {
        end: 'miniapp-taro',
        file: 'apps/miniapp-taro/src/pkg-content/announcement/index.tsx',
        reads: (src) =>
          /res\.data\?\.list/.test(src) && !/fetchApi<AnnouncementItem\[\]>/.test(src),
      },
    ],
  },
  {
    // 第七、八族的新意：**同一端在同一 App 里两个屏各写各的** —— 一个读 .list(对)，
    // 一个把信封当数组(错)。这种"端内自我分叉"是"移动端跟 web 不一致"的下半段。
    ep: 'GET /api/certificates',
    backend: 'apps/api/src/routes/certificate.ts',
    backendProves: (src) =>
      /server\.get\('\/certificates',[\s\S]{0,320}?success\(result\)/.test(src),
    backendAlso: {
      file: 'apps/api/src/db/certificate-queries.ts',
      proves: (src) =>
        /Promise<\{\s*list: CertificateWithUser\[\];\s*total: number;\s*page: number;\s*pageSize: number\s*\}>/.test(
          src,
        ),
    },
    consumers: [
      {
        end: 'mobile-rn/CertificateScreen',
        file: 'apps/mobile-rn/src/screens/CertificateScreen.tsx',
        reads: (src) => /res\.data\.list \?\? \[\]/.test(src),
      },
      {
        end: 'mobile-rn/CertListScreen',
        file: 'apps/mobile-rn/src/screens/CertListScreen.tsx',
        reads: (src) => /res\.data\?\.list/.test(src) && !/fetchApi<CertListItem\[\]>/.test(src),
      },
    ],
  },
  {
    ep: 'GET /api/coupons',
    backend: 'apps/api/src/routes/promotions.ts',
    backendProves: (src) =>
      /'\/coupons',[\s\S]{0,900}?success\(\{ list, total, page, pageSize \}\)/.test(src),
    consumers: [
      {
        end: 'mobile-rn/CouponScreen',
        file: 'apps/mobile-rn/src/screens/CouponScreen.tsx',
        reads: (src) => /res\.data\?\.list/.test(src),
      },
      {
        end: 'mobile-rn/PromotionScreen',
        file: 'apps/mobile-rn/src/screens/PromotionScreen.tsx',
        reads: (src) =>
          /resp\.data\?\.list/.test(src) && !/fetchApi<PromotionCoupon\[\]>/.test(src),
      },
    ],
  },
  {
    ep: 'GET /api/feedbacks',
    backend: 'apps/api/src/routes/comments.ts',
    backendProves: (src) =>
      /'\/feedbacks',[\s\S]{0,900}?success\(\{ list, total, page, pageSize \}\)/.test(src),
    consumers: [
      {
        end: 'mobile-rn',
        file: 'apps/mobile-rn/src/screens/FeedbackHistoryScreen.tsx',
        reads: (src) =>
          /res\.data\?\.list/.test(src) && !/fetchApi<FeedbackHistoryItem\[\]>/.test(src),
      },
    ],
  },
  {
    ep: 'GET /api/help/articles',
    backend: 'apps/api/src/routes/content.ts',
    backendProves: (src) =>
      /server\.get\('\/help\/articles'[\s\S]{0,320}?success\(\{ list \}\)/.test(src),
    consumers: [
      {
        end: 'mobile-rn',
        file: 'apps/mobile-rn/src/screens/HelpScreen.tsx',
        reads: (src) => /res\.data\?\.list/.test(src) && !/fetchApi<HelpListItem\[\]>/.test(src),
      },
    ],
  },
  {
    // 第十一族：同一屏里两半各打一条端点，overview 回对象、invited-users 回分页信封 ——
    // 按数组读记录那半，"已邀请用户"就永远空。
    ep: 'GET /api/distribution/invited-users',
    backend: 'apps/api/src/routes/distribution.ts',
    // 这条 handler 有**两个分支**(传 page/pageSize 走分页、不传走"保持移动端现有行为"全量)，
    // 两支都包着 list 键 ⇒ 无论调用方怎么问，把整个信封当数组都是错的。断言两支同证，
    // 只断一支会留下"改了另一支而契约照绿"的缝。
    backendProves: (src) => {
      const win =
        /server\.get\('\/distribution\/invited-users'([\s\S]{0,1600}?)\n  \}\)/.exec(src)?.[1] ?? ''
      return (
        win.includes('success({ list, total: list.length })') &&
        win.includes('success({ list: result.items, total: result.total, page, pageSize })')
      )
    },
    consumers: [
      {
        end: 'mobile-rn',
        file: 'apps/mobile-rn/src/screens/InviteScreen.tsx',
        reads: (src) =>
          /listRes\.data\?\.list/.test(src) && !/fetchApi<InviteRecordItem\[\]>/.test(src),
      },
    ],
  },
  {
    // 第十二到十四族：后端注册是**多行形态**(`server.get(` 换行再写路径)，单行 grep 会把它们
    // 读成"没有这条路由"—— 本轮就被这种形态骗过一次(曾把 /api/notifications 误判成死端点)。
    ep: 'GET /api/notifications',
    backend: 'apps/api/src/routes/notifications.ts',
    backendProves: (src) =>
      /server\.get\(\s*'\/notifications',[\s\S]{0,1600}?success\(\{\s*list: listWithTopic, total, page, pageSize, unread:/.test(
        src,
      ),
    consumers: [
      {
        end: 'shared(api-client)',
        file: 'packages/api-client/src/endpoints/notification.ts',
        reads: (src) => src.includes('fetchApi<PageData<NotificationItem>>'),
      },
      {
        end: 'mobile-rn',
        file: 'apps/mobile-rn/src/screens/NotificationListScreen.tsx',
        reads: (src) =>
          /res\.data\?\.list/.test(src) && !/fetchApi<NotificationListItem\[\]>/.test(src),
      },
    ],
  },
  {
    // 这一族的键不是 list 而是 entries —— 契约按"每个消费端读后端真回的那个键"判，不按习惯猜。
    ep: 'GET /api/memory',
    backend: 'apps/api/src/routes/memory.ts',
    backendProves: (src) =>
      /server\.get\('\/memory'[\s\S]{0,900}?success\(\{ entries, total: entries\.length \}\)/.test(
        src,
      ),
    consumers: [
      {
        end: 'extension',
        file: 'apps/extension/entrypoints/sidepanel/pages/MemoryPage.tsx',
        reads: (src) => /res\.data\?\.entries/.test(src) && !/fetchApi<MemoryItem\[\]>/.test(src),
      },
    ],
  },
  {
    ep: 'GET /api/live/history',
    backend: 'apps/api/src/routes/live.ts',
    backendProves: (src) =>
      /server\.get\('\/live\/history'[\s\S]{0,900}?success\(\{ list, total: result\.total/.test(
        src,
      ),
    consumers: [
      {
        end: 'mobile-rn',
        file: 'apps/mobile-rn/src/screens/LivePlaybackListScreen.tsx',
        reads: (src) =>
          /res\.data\?\.list/.test(src) && !/fetchApi<LivePlaybackItem\[\]>/.test(src),
      },
    ],
  },
]

test('K1 后端形状在位:契约的每一条都由路由侧自证,而不是由调用端互相印证', () => {
  for (const c of REGISTRY) {
    const src = read(c.backend)
    assert.ok(
      c.backendProves(src),
      `${c.ep} 的后端形状与契约不符 —— 要么路由改了(那两端必须同批改),要么本契约过期(那删这条)`,
    )
    // 有些端点的形状证据不在路由文件里，而在它调用的 db 查询类型声明里 ⇒ 第二处同样由后端自证，
    // 不由"调用端都这么读"来反推。
    if (c.backendAlso) {
      const also = read(c.backendAlso.file)
      assert.ok(
        c.backendAlso.proves(also),
        `${c.ep} 的第二处后端证据(${c.backendAlso.file})已不支持这个形状 ⇒ 契约过期或后端改了`,
      )
    }
  }
})

test('K2 每个消费端读的是后端真正回的那个键(静默空列表这一型到此为止)', () => {
  for (const c of REGISTRY) {
    for (const k of c.consumers) {
      const src = read(k.file)
      assert.ok(
        k.reads(src),
        `${c.ep} 在 ${k.end}(${k.file})的读法与后端形状不符 —— 该端会拿到 undefined 而界面只显示空列表,不抛错`,
      )
    }
  }
})

test('K3 阳性对照:把读法退回"信封当数组"必须让判据红(否则 K2 是一条恒绿断言)', () => {
  const real = read('apps/mobile-rn/src/screens/HistoryScreen.tsx')
  const mutated = real.replace(/res\.data\?\.list/g, 'res.data')
  assert.notEqual(mutated, real, '变异未命中 ⇒ 判据的匹配面与实际写法脱节')
  const k = REGISTRY[0].consumers.find((x) => x.end === 'mobile-rn')
  assert.equal(k.reads(mutated), false, '退回旧错形仍被判"合规" ⇒ K2 无牙')
  // 反向:当前真实文本必须判合规(证明上一条红的是形态,不是判据过宽)
  assert.equal(k.reads(real), true)

  const realExt = read('apps/extension/entrypoints/sidepanel/pages/ChatFavoritesPage.tsx')
  const mutatedExt = realExt.replace(/res\.data\?\.favorites/g, 'res.data.list')
  assert.notEqual(mutatedExt, realExt)
  const k2 = REGISTRY[1].consumers.find((x) => x.end === 'extension')
  assert.equal(
    k2.reads(mutatedExt),
    false,
    '把 .favorites 换回 .list 必须红:那是本契约立因的那一型',
  )
  assert.equal(k2.reads(realExt), true)

  // 第三条族:同一型第三站(RN 考试历史)。变异 = 把 `.list` 摘掉,即入库前的错形。
  const realExam = read('apps/mobile-rn/src/screens/ExamHistoryScreen.tsx')
  const mutatedExam = realExam.replace(/res\.data\?\.list/g, 'res.data')
  assert.notEqual(mutatedExam, realExam, '变异未命中 ⇒ 契约与写法脱节')
  const k3 = REGISTRY[2].consumers.find((x) => x.end === 'mobile-rn')
  assert.equal(k3.reads(mutatedExam), false, '考试历史退回"整个信封当数组"必须红')
  assert.equal(k3.reads(realExam), true)

  // 第四族:这一条**两端都曾**按数组读,所以两侧各做一次变异 —— 只钉一端的话,另一端的
  // 同型缺陷照样能过(而它过的表现是"页面没数据",不是"门红")。
  const realMarket = read('apps/mobile-rn/src/screens/AgentMarketScreen.tsx')
  const mutatedMarket = realMarket.replace(/res\.data\?\.list/g, 'res.data')
  assert.notEqual(mutatedMarket, realMarket, '变异未命中 ⇒ 契约与写法脱节')
  const kMarket = REGISTRY[3].consumers.find((x) => x.end === 'mobile-rn')
  assert.equal(kMarket.reads(mutatedMarket), false, '市场页退回数组读必须红')
  assert.equal(kMarket.reads(realMarket), true)

  const realRuntime = read('apps/web/app/(main)/agent-runtime/page.tsx')
  const mutatedRuntime = realRuntime.replace(/r\.data\?\.list/g, 'r.data')
  assert.notEqual(mutatedRuntime, realRuntime, '变异未命中 ⇒ 契约与写法脱节')
  const kRuntime = REGISTRY[3].consumers.find((x) => x.end === 'web')
  assert.equal(kRuntime.reads(mutatedRuntime), false, 'web 运行时页退回数组读必须红')
  assert.equal(kRuntime.reads(realRuntime), true)

  // 第五、六族(activities / announcements):RN 与小程序两侧原本都按数组读，web 一直读 d.list。
  // 逐端变异，不是"抽一端代表全端"。
  for (const idx of [4, 5]) {
    const fam = REGISTRY[idx]
    for (const k of fam.consumers.filter(
      (c) => c.end === 'mobile-rn' || c.end === 'miniapp-taro',
    )) {
      const real = read(k.file)
      const mutated = real.replace(/res\.data\?\.list/g, 'res.data')
      assert.notEqual(mutated, real, `${k.file} 变异未命中 ⇒ 契约与写法脱节`)
      assert.equal(k.reads(mutated), false, `${fam.ep} 在 ${k.end} 退回"信封当数组"必须红`)
      assert.equal(k.reads(real), true)
    }
    for (const k of fam.consumers.filter((c) => c.end === 'web')) {
      const real = read(k.file)
      const mutated = real.replace(/d\.list \?\? \[\]/g, 'd ?? []')
      assert.notEqual(mutated, real, `${k.file} 变异未命中 ⇒ 契约与写法脱节`)
      assert.equal(k.reads(mutated), false, `${fam.ep} 在 web 摘掉 .list 必须红`)
      assert.equal(k.reads(real), true)
    }
  }

  // 第七到十族：同一 App 里两个屏对同一端点各写各的(一个读 .list、一个把信封当数组)，
  // 所以逐消费端变异 —— 只钉"读对的那个"等于没钉。
  for (const idx of [6, 7, 8, 9, 10, 11, 12, 13]) {
    const fam = REGISTRY[idx]
    for (const k of fam.consumers) {
      const real = read(k.file)
      const mutated = real
        .replace(/data\?\.list/g, 'data')
        .replace(/data\?\.entries/g, 'data')
        .replace(/data\.list \?\? \[\]/g, 'data ?? []')
        .replace(/fetchApi<PageData<NotificationItem>>/g, 'fetchApi<NotificationItem[]>')
      assert.notEqual(mutated, real, `${k.file} 变异未命中 ⇒ 契约与写法脱节`)
      assert.equal(k.reads(mutated), false, `${fam.ep} 在 ${k.end} 摘掉 .list 必须红`)
      assert.equal(k.reads(real), true)
    }
  }
})

test('K4 覆盖面自证:契约确实覆盖了它点名的每一条,而非静默少跑', () => {
  let checked = 0
  for (const c of REGISTRY) {
    read(c.backend)
    checked++
    for (const k of c.consumers) {
      read(k.file)
      checked++
    }
  }
  const total = REGISTRY.reduce((n, c) => n + 1 + c.consumers.length, 0)
  assert.equal(checked, total, `应核 ${total} 个文件而实核 ${checked} ⇒ 有静默跳过的端点`)
  assert.ok(total >= 40, '契约面退化到不足 40 个(14 族)⇒ 有族被删,本文件已不再覆盖当初那条分叉')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
