// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 收藏(favorites)字段名口径 —— 传输层契约与后端真实回传键的源码对账。
 *
 * 为什么判源码文本而不是跑一次请求:这一型要防的是**字段名漂移**,而漂移在运行时不报错 ——
 * `apps/api` 回 `{resourceType, resourceId}`,而 `FavoriteItem` 曾写 `{targetType, targetId}`,
 * 于是移动端 `item.targetType` 恒得 `undefined`:分类过滤全空、类型徽章空白、
 * 取消收藏发出 `DELETE /favorites/undefined/undefined`、点条目跳 `url: "undefined<id>"`,
 * 而 typecheck / lint / 其余门一律不红(类型是自说自话,没有对着被调方核对)。
 *
 * 口径来源(唯一真相,不在本文件抄第二份):
 * - 列名 = `packages/database/src/schema/social.ts` 的 `userFavorites` 表列;
 * - 富化 = `apps/api/src/db/social-queries.ts` 的 `findFavorites`(`db.select()` 取整行 ⊕ `title`);
 * - 删除路径参数名 = `apps/api/src/routes/social.ts` 的 `/:resourceType/:resourceId`。
 *
 * 变异验证(判据有牙证明,见下面" parser 必须真读到东西 "那一例):
 * 把 `FavoriteItem` 退回 `targetId/targetType` ⇒ 本文件三例同时红。
 *
 * 注意边界:**订阅(subscriptions)与浏览历史(browse-history)两张表本来就叫 target***
 * (`user_subscriptions.target_type` / history 路由自述),所以本文件只在 FavoriteItem 的
 * **块内**判名字,绝不对整文件下结论 —— 那会把别的实体的正当写法判成违规。
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const HERE = fileURLToPath(new URL('.', import.meta.url))
const REPO = join(HERE, '..', '..', '..')

const read = (rel: string) => readFileSync(join(REPO, rel), 'utf8')

/** 取 `export interface X { ... }` 的块内顶层字段名(块 = 到第一个行首 `}` 为止) */
function interfaceFields(src: string, name: string): string[] {
  const start = src.indexOf(`export interface ${name} {`)
  if (start < 0) throw new Error(`找不到 interface ${name}(判据失效,不是仓库没字段)`)
  const end = src.indexOf('\n}', start)
  if (end < 0) throw new Error(`interface ${name} 块未闭合,解析不出`)
  const body = src.slice(start, end)
  return [...body.matchAll(/^\s{2}(?:readonly )?([A-Za-z_$][\w$]*)\??\s*:/gm)].map((m) => m[1])
}

/** 取 `pgTable('user_favorites', { ... })` 的列名(同上门槛:解不出就抛,不静默给空表) */
function tableColumns(src: string, symbol: string): string[] {
  const start = src.indexOf(`export const ${symbol} = pgTable(`)
  if (start < 0) throw new Error(`找不到 pgTable ${symbol}`)
  const brace = src.indexOf('{', start)
  const end = src.indexOf('\n  },', brace)
  if (brace < 0 || end < 0) throw new Error(`${symbol} 的列块边界判不出`)
  const body = src.slice(brace, end)
  return [...body.matchAll(/^\s{4}([A-Za-z_$][\w$]*):\s*\w+\(/gm)].map((m) => m[1])
}

const FAVORITES_ITEM = 'packages/api-client/src/endpoints/user.ts'
const SCHEMA = 'packages/database/src/schema/social.ts'
const QUERIES = 'apps/api/src/db/social-queries.ts'
const ROUTES = 'apps/api/src/routes/social.ts'

describe('收藏字段口径:FavoriteItem 必须等于后端真实回传键', () => {
  const columns = tableColumns(read(SCHEMA), 'userFavorites')
  const fields = interfaceFields(read(FAVORITES_ITEM), 'FavoriteItem')

  it('覆盖面自证:两把解析尺都必须真读到东西(空表 = 判据失明,不是"没有问题")', () => {
    expect(columns.length).toBeGreaterThanOrEqual(4)
    for (const c of ['id', 'userId', 'resourceType', 'resourceId', 'createdAt']) {
      expect(columns).toContain(c)
    }
    expect(fields.length).toBeGreaterThanOrEqual(4)
  })

  it('FavoriteItem 不得声明表列与富化字段之外的键( invented 字段 = 端上恒 undefined )', () => {
    const allowed = new Set([...columns, 'title'])
    const invented = fields.filter((f) => !allowed.has(f))
    expect(invented).toEqual([])
  })

  it('身份对(resourceType + resourceId)必须在位 —— 取消收藏与跳详情都靠它', () => {
    expect(fields).toContain('resourceType')
    expect(fields).toContain('resourceId')
    const block = read(FAVORITES_ITEM)
    expect(block.slice(block.indexOf('export interface FavoriteItem {'))).not.toMatch(
      /^\s{2}(targetType|targetId)\??:/m,
    )
  })

  it('删除端的路径参数名与查询层用的列名同源(两侧不得各说各话)', () => {
    const routes = read(ROUTES)
    expect(routes).toMatch(/\/favorites\/:resourceType\/:resourceId/)
    const queries = read(QUERIES)
    expect(queries).toMatch(/findFavorites/)
    // findFavorites 用 `db.select().from(userFavorites)` 取整行 ⇒ 契约就是表列;
    // 若有人改成显式挑列,本例点名要求同步更新本测试的 allowed 集。
    const body = queries.slice(queries.indexOf('export async function findFavorites'))
    expect(body.slice(0, 1600)).toMatch(/\.select\(\)\s*\n?\s*\.from\(userFavorites\)/)
  })

  it('三个消费端读的是同一套名字(不再有一端留着旧词)', () => {
    for (const rel of [
      'apps/mobile-rn/src/screens/FavoritesScreen.tsx',
      'apps/extension/entrypoints/sidepanel/pages/FavoritesPage.tsx',
      'apps/miniapp-taro/src/pkg-user/favorites/index.tsx',
    ]) {
      expect(read(rel)).toMatch(/resourceType/)
    }
    // RN 的 BookmarkScreen 也必须走收藏契约,而不是打一条后端不存在的 /api/bookmarks
    expect(read('apps/mobile-rn/src/screens/BookmarkScreen.tsx')).toMatch(/getFavorites/)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
