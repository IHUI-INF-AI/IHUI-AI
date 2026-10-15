// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 跨端「同一端点:后端形状 ↔ 各端读法」契约对账(常驻回归,不在提交链)。
// 立因:探针按"调用点邻近行出现的字段名"比两端,抽样 12 条里前两条读代码即为真漂移 ——
//   · apps/mobile-rn/src/screens/HistoryScreen.tsx 曾把 GET /api/browse-history 的整个信封
//     {list,total,page,pageSize} 当数组用 ⇒ FlatList 拿到对象不报错,只是永远空列表;
//   · apps/extension/.../ChatFavoritesPage.tsx 曾按 PageData 读 .list,而后端回的是 {favorites,…}
//     ⇒ 静默 undefined ⇒ 该页永远"暂无收藏"。两型共同点:**没有任何一层会红**,只有用户看得见。
// 本文件不判红仓库里的其它端点:它只钉下方 REGISTRY 列出的族,新增族必须先人读后端 handler 再登记。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const read = (rel) => {
  assert.ok(existsSync(join(ROOT, rel)), `契约面点名文件 ${rel} 不在盘上 ⇒ 判据失明,不得读成"已通过"`)
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
        reads: (src) => /\.list\b/.test(src) && !/fetchApi<HistoryItem\[\]>|fetchApi<\w+\[\]>\('\/api\/browse-history/.test(src),
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
    backendProves: (src) => /server\.get\('\/favorites'[\s\S]{0,900}?success\(\{\s*favorites:/m.test(src),
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
]

test('K1 后端形状在位:契约的每一条都由路由侧自证,而不是由调用端互相印证', () => {
  for (const c of REGISTRY) {
    const src = read(c.backend)
    assert.ok(c.backendProves(src), `${c.ep} 的后端形状与契约不符 —— 要么路由改了(那两端必须同批改),要么本契约过期(那删这条)`)
  }
})

test('K2 每个消费端读的是后端真正回的那个键(静默空列表这一型到此为止)', () => {
  for (const c of REGISTRY) {
    for (const k of c.consumers) {
      const src = read(k.file)
      assert.ok(k.reads(src), `${c.ep} 在 ${k.end}(${k.file})的读法与后端形状不符 —— 该端会拿到 undefined 而界面只显示空列表,不抛错`)
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
  assert.equal(k2.reads(mutatedExt), false, '把 .favorites 换回 .list 必须红:那是本契约立因的那一型')
  assert.equal(k2.reads(realExt), true)
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
  assert.ok(total >= 6, '契约条目退化到不足 6 个面 ⇒ 本文件已不再覆盖任何分叉')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
