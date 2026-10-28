// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 跨端重复屏合并锁(2026-10-28,门 237 缺口 3 枚共享层重复屏的收口凭据)。
 *
 * 立因:小程序侧只有「我的收藏」「我的关注」两张页,已分别声明给
 * `favorite/FavoriteScreen` 与 `follow/FollowScreen`;兄弟屏
 * `favorites/FavoritesScreen`、`following/FollowingScreen`、`bookmark/BookmarkScreen`
 * 若再补镜像标记就是"一页两声明"的假精度(门 237 的凭据必须是"这一页真的对齐那一屏")。
 * 正解是先在 `packages/app` 合并重复屏 —— 本文件把合并结果钉住,防止有人把第二份渲染
 * 真相源加回来(加回来 = 缺口数字不变而页面又分叉了)。
 *
 * 判据全部读**磁盘工作树**(这是"当下仓库长什么样"的对账,不是守门取材面;门 237 自己
 * 按 §0.4 判 HEAD/索引面,本锁不替代它)。
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import assert from 'node:assert/strict'

const here = dirname(fileURLToPath(import.meta.url))
const ROOT = join(here, '..', '..')
const rel = (p) => join(ROOT, ...p.split('/'))
const read = (p) => readFileSync(rel(p), 'utf8')

const SHARED = 'packages/app/src/features'
const RN = 'apps/mobile-rn/src/screens'

test('合并结果:favorites/FollowingScreen 两枚兄弟屏已从共享层删除', () => {
  for (const gone of [
    `${SHARED}/favorites/FavoritesScreen.tsx`,
    `${SHARED}/following/FollowingScreen.tsx`,
  ]) {
    assert.equal(existsSync(rel(gone)), false, `${gone} 仍在位:重复屏又长回来了(要加回请先证明它不是子集)`)
  }
  // 父目录一并收干净,空目录留在那儿会被 IDE / 后续 glob 读成"这一族还在"
  for (const goneDir of [`${SHARED}/favorites`, `${SHARED}/following`]) {
    assert.equal(existsSync(rel(goneDir)), false, `${goneDir} 目录残留`)
  }
})

test('共享层出口:被删的两枚组件不再从 packages/app 导出,超集屏照常导出', () => {
  const barrel = read('packages/app/src/index.ts')
  for (const dead of ['FavoritesScreen', 'FollowingScreen']) {
    assert.equal(
      new RegExp(`^export \\{ ${dead} \\} from`, 'm').test(barrel),
      false,
      `index.ts 仍在导出已删除的 ${dead}(typecheck 必崩)`,
    )
  }
  for (const alive of ['FavoriteScreen', 'FollowScreen', 'BookmarkScreen']) {
    assert.match(barrel, new RegExp(`^export \\{ ${alive} \\} from`, 'm'))
  }
})

test('收藏族:取数与渲染各只有一份,Favorites 路由不再自立第二套', () => {
  const model = read(`${RN}/FavoriteScreen.tsx`)
  // 唯一实现:端点 + 删除 + tab 状态都住在这一份模型里
  assert.match(model, /getFavorites/, 'FavoriteScreen.tsx 不再打收藏端点 ⇒ 唯一实现跑到了别处')
  assert.match(model, /deleteFavorite/)
  assert.match(model, /export function useFavoriteScreenModel/)

  const alias = read(`${RN}/FavoritesScreen.tsx`)
  assert.match(alias, /from '@ihui\/rn-app'/, 'Favorites 路由必须仍委托共享层(门 237 R4 的下沉率锚点)')
  assert.match(alias, /useFavoriteScreenModel/)
  for (const second of ['getFavorites', 'deleteFavorite', 'usePaginatedList']) {
    assert.equal(
      new RegExp(second).test(alias),
      false,
      `FavoritesScreen.tsx 里出现了 ${second} ⇒ 又抄了第二份取数`,
    )
  }
})

test('关注族:FollowingScreen 从未有 RN 消费方(路由与屏文件都不在位)', () => {
  assert.equal(
    existsSync(rel(`${RN}/FollowingScreen.tsx`)),
    false,
    'RN 侧又立了一枚 FollowingScreen 屏:与 FollowScreen(关注+粉丝双 tab)重复',
  )
  const nav = read('apps/mobile-rn/src/navigation/RootNavigator.tsx')
  assert.equal(
    /<RootStack\.Screen name="Following"/.test(nav),
    false,
    'Following 路由已并入 Follow(2026-09-04 裁决),不得复活',
  )
})

test('镜像凭据与登记表仍指向存活的超集屏(门 237 R1 的三文件齐备)', () => {
  const registry = JSON.parse(read('scripts/data/cross-end-screen-registry.json'))
  for (const [shared, miniapp] of [
    [`${SHARED}/favorite/FavoriteScreen.tsx`, 'pkg-user/favorites/index'],
    [`${SHARED}/follow/FollowScreen.tsx`, 'pkg-user/following/index'],
  ]) {
    const entry = registry.entries.find((e) => e.shared === shared)
    assert.ok(entry, `登记表缺 ${shared} 条目:合并后凭据链断了`)
    assert.equal(entry.miniapp, miniapp)
    assert.ok(existsSync(rel(entry.shared)), `登记表指向的共享屏不在位: ${entry.shared}`)
    assert.ok(existsSync(rel(entry.rn)), `登记表指向的 RN 屏不在位: ${entry.rn}`)
  }
  // 小程序两张页各自只声明一枚共享屏:一页两声明就是假精度
  const decl = (p) => [...read(p).matchAll(/packages\/app\/src\/features\/([a-z-]+)\/([A-Z]\w*Screen)/g)]
  for (const [page, only] of [
    ['apps/miniapp-taro/src/pkg-user/favorites/index.tsx', 'favorite/FavoriteScreen'],
    ['apps/miniapp-taro/src/pkg-user/following/index.tsx', 'follow/FollowScreen'],
  ]) {
    const specs = [...new Set(decl(page).map((m) => `${m[1]}/${m[2]}`))]
    assert.deepEqual(specs, [only], `${page} 声明了 ${specs.join(' + ')}:一页两声明`)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
