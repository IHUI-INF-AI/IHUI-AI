// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 绑定表读出口径一致性锁(2026-10-22 立)。
 *
 * 立因:`oauth-queries.ts` 里 `listUserBindings` 一直带 `deletedAt IS NULL`,
 * 而 `findThirdPartyAccount` 从来没带 —— 同一个文件里两条查询对"这个微信还绑着吗"给出
 * 不同答案。用户可见的后果不是报错,是**错身份**:在「已绑定账号」页解绑(列表按软删过滤 ⇒
 * 显示未绑),再扫同一次微信,登录那一条仍命中那枚软删行 ⇒ 登进原来那个账号;
 * `/mini/rebind` 的 `existing.userId !== request.userId ⇒ 409「该微信已绑定其他账号」`
 * 也会被一枚早已解绑的死行触发。
 *
 * 这类"两条尺子对同一件事不同形"的缺陷(§22c 单一真相源那一族)靠逐行 review 抓不住,
 * 所以这里锁**整族**:凡是 `select` 读 `userThirdPartyAccounts` 的函数,都必须滤软删。
 * 新增一条绑定读出口而忘了滤 ⇒ 本文件当场红,而不是等用户报"我解绑了还能登进去"。
 *
 * 遮罩用全仓那一份 `scripts/lib/code-mask.mjs`(§0.6):本文件头注逐字引用了
 * `deletedAt IS NULL` 这条判据本身,不遮注释的话反向锁会咬到自己的说明文字。
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const SRC = resolve(HERE, '../src/db/oauth-queries.ts')

/** 只遮注释、保留字符串:判据看的是代码里的谓词,不是散文 */
async function masked(): Promise<string> {
  const m = await import(
    // arch-exempt: 判据面必须与被审门共用同一份遮罩实现(§22c),属测试面而非生产依赖边;until 2026-12-31
    pathToFileURL(resolve(HERE, '../../../scripts/lib/code-mask.mjs')).href
  )
  return (m as { maskComments: (s: string) => string }).maskComments(readFileSync(SRC, 'utf8'))
}

/** 按 `export async function` 切块(同一文件里函数是平铺的,不嵌套) */
function splitFunctions(src: string): Array<{ name: string; body: string }> {
  const out: Array<{ name: string; body: string }> = []
  const marks = [...src.matchAll(/^export async function\s+([A-Za-z0-9_]+)/gm)]
  for (let i = 0; i < marks.length; i++) {
    const from = marks[i]!.index!
    const to = i + 1 < marks.length ? marks[i + 1]!.index! : src.length
    out.push({ name: marks[i]![1]!, body: src.slice(from, to) })
  }
  return out
}

const FILTERS = [
  /deletedAt\}\s+IS\s+NULL/i, // sql`...deletedAt} IS NULL`
  /isNull\(\s*userThirdPartyAccounts\.deletedAt\s*\)/, // drizzle isNull() 同义形态
]
const isFiltered = (body: string) => FILTERS.some((re) => re.test(body))

describe('绑定表(user_third_party_accounts)的每一条读出口都必须排除软删行', () => {
  it('取材面自身不能是空的(枚举到 0 个候选判死不记绿)', async () => {
    const fns = splitFunctions(await masked()).filter((f) =>
      /from\(userThirdPartyAccounts\)/.test(f.body),
    )
    expect(fns.length).toBeGreaterThan(0)
  })

  it('每一条 select 读绑定表的函数都带软删过滤 —— 漏一条就是"解绑后仍能登进旧账号"', async () => {
    const readers = splitFunctions(await masked()).filter((f) =>
      /from\(userThirdPartyAccounts\)/.test(f.body),
    )
    const unfiltered = readers.filter((f) => !isFiltered(f.body)).map((f) => f.name)
    expect(unfiltered).toEqual([])
  })

  it('反向对照(判据必须有牙):摘掉 findThirdPartyAccount 的谓词,这一族就应当被本锁抓到', async () => {
    const src = await masked()
    const neutered = src.replace(
      /(export async function findThirdPartyAccount[\s\S]*?)sql`\$\{userThirdPartyAccounts\.deletedAt\} IS NULL`,/,
      '$1',
    )
    expect(neutered).not.toBe(src) // 替换没命中 = 这一版反向锁在打空靶
    const readers = splitFunctions(neutered).filter((f) =>
      /from\(userThirdPartyAccounts\)/.test(f.body),
    )
    expect(readers.filter((f) => !isFiltered(f.body)).map((f) => f.name)).toContain(
      'findThirdPartyAccount',
    )
  })

  it('limit(1) 之前必须有确定序(无排序的 limit(1) = 命中哪一行由数据库决定)', async () => {
    const fns = splitFunctions(await masked()).filter(
      (f) => /from\(userThirdPartyAccounts\)/.test(f.body) && /\.limit\(/.test(f.body),
    )
    for (const f of fns) expect(f.body, `${f.name} 带 limit 却没有 orderBy`).toMatch(/\.orderBy\(/)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
