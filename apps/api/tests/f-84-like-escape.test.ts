// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-84 回归锁(2026-11-13)。
 *
 * 病灶:db 层 8 个查询文件把用户输入直接拼成 `%${kw}%` 交给 ilike,`%`/`_`/`\` 未转义 ⇒
 * `search=%` 命中全表(索引失效 + 全表 count),直播回调 `ilike(pushUrl, '%/' + streamName)`
 * 也会因通配符退化为多行匹配,批量改写频道 isLive。
 *
 * 本文件锁:
 *   ① 单源转义器 asContainsTerm / escapeLikeChars 的转义口径(% _ \ 与空串);
 *   ② 8 个 db 文件不再出现裸 `%${x}%` 内插(与 scripts/check-like-wildcard-escape.mjs D2 同形);
 *   ③ 每个 ilike 调用的模式参数必须来自 asContainsTerm(或由其派生的同名变量 kw);
 *   ④ 直播回调改为转义后的字面后缀匹配 + status=1,且不再出现 `%/${streamName}` 裸内插。
 *
 * 只读源码与纯函数,不连库、不触达 PG/Redis。
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'
import { asContainsTerm, escapeLikeChars } from '../src/utils/like-escape.js'

/** F-84 涉及的 8 个 db 文件(order-queries 是已修好的对照样例)。 */
const DB_FILES = [
  'fund-queries.ts',
  'knowledge-queries.ts',
  'certificate-queries.ts',
  'live-queries.ts',
  'member-queries.ts',
  'member-extended-queries.ts',
  'resource-queries.ts',
  'order-queries.ts',
] as const

function readDbSource(name: string): string {
  return readFileSync(fileURLToPath(new URL(`../src/db/${name}`, import.meta.url)), 'utf8')
}

/** 与守门脚本 D2 同形:把值内插进带前后 % 的模板串。 */
const RAW_WRAP_RE = /`%[^`]*\$\{[^`]*\}%`/g

/** 允许直传的已派生变量(值本身来自 asContainsTerm)。 */
const DERIVED_PATTERN_VARS = new Set(['kw'])

describe('F-84 转义原语口径', () => {
  it.each([
    ['100%', '%100\\%%'],
    ['a_b', '%a\\_b%'],
    ['a\\b', '%a\\\\b%'],
    ['hello', '%hello%'],
    ['', '%%'],
  ])('asContainsTerm(%j) => %j', (input, expected) => {
    expect(asContainsTerm(input)).toBe(expected)
  })

  it('反斜杠优先转义,不会二次转义', () => {
    expect(escapeLikeChars('\\%')).toBe('\\\\\\%')
  })

  it('null/undefined 回空串,调用方无需再判', () => {
    expect(escapeLikeChars(null)).toBe('')
    expect(escapeLikeChars(undefined)).toBe('')
    expect(asContainsTerm(undefined)).toBe('%%')
  })
})

describe('F-84 源锁:用户可控 ilike 必须经过转义', () => {
  it('8 个 db 文件无裸 `%${...}%` 内插', () => {
    for (const name of DB_FILES) {
      const hits = readDbSource(name).match(RAW_WRAP_RE) ?? []
      expect(hits, `${name} 仍有未转义 LIKE 内插`).toEqual([])
    }
  })

  it('每个 ilike 的模式参数必须来自 asContainsTerm(或派生变量 kw)', () => {
    for (const name of DB_FILES) {
      const text = readDbSource(name)
      for (const m of text.matchAll(/ilike\(([^)]*)\)/g)) {
        const args = m[1] ?? ''
        if (args.includes('asContainsTerm(')) continue
        const patternArg = args.slice(args.indexOf(',') + 1).trim()
        expect(
          DERIVED_PATTERN_VARS.has(patternArg),
          `${name} 的 ilike 未走转义:ilike(${args})`,
        ).toBe(true)
      }
    }
  })

  it('8 个文件的用户输入点逐个改为 asContainsTerm', () => {
    const required: Record<(typeof DB_FILES)[number], string[]> = {
      'fund-queries.ts': ['ilike(funds.name, asContainsTerm(opts.search))'],
      'knowledge-queries.ts': ['ilike(knowledgeBase.title, asContainsTerm(opts.search))'],
      'certificate-queries.ts': [
        'ilike(certificateTemplates.name, asContainsTerm(opts.search))',
        'ilike(certificates.certificateNo, asContainsTerm(opts.search))',
      ],
      'live-queries.ts': [
        'ilike(liveChannels.title, asContainsTerm(opts.search))',
        'ilike(liveLecturers.name, asContainsTerm(opts.name))',
        'like(liveChannels.pushUrl, `%/${escapeLikeChars(streamName)}`)',
        'eq(liveChannels.status, 1)',
      ],
      'member-queries.ts': [
        'ilike(eduMembers.username, asContainsTerm(opts.username))',
        'ilike(eduMembers.mobile, asContainsTerm(opts.mobile))',
        'const kw = asContainsTerm(opts.keyword)',
        'ilike(eduMembers.username, kw)',
        'ilike(eduMembers.mobile, kw)',
        'ilike(eduMembers.nickname, kw)',
        'ilike(eduCompanies.name, asContainsTerm(opts.name))',
        'ilike(eduDepartments.name, asContainsTerm(opts.name))',
      ],
      'member-extended-queries.ts': [
        'ilike(memberGroups.name, asContainsTerm(query.keyword))',
        'ilike(memberPosts.name, asContainsTerm(query.keyword))',
        'ilike(memberTags.name, asContainsTerm(query.keyword))',
        'ilike(memberTypes.name, asContainsTerm(query.keyword))',
        'ilike(companyTypes.name, asContainsTerm(query.keyword))',
      ],
      'resource-queries.ts': [
        'ilike(resources.title, asContainsTerm(title))',
        'ilike(resourceProducts.name, asContainsTerm(name))',
        'ilike(resourceTags.name, asContainsTerm(name))',
      ],
      'order-queries.ts': ['ilike(eduOrders.orderNo, asContainsTerm(orderNo))'],
    }

    for (const name of DB_FILES) {
      const text = readDbSource(name)
      for (const snippet of required[name]) {
        expect(text.includes(snippet), `${name} 缺转义调用:${snippet}`).toBe(true)
      }
    }
  })

  it('直播回调不再用裸 streamName 做后缀匹配,且限定 status=1', () => {
    const text = readDbSource('live-queries.ts')
    expect(text.includes('`%/${streamName}`')).toBe(false)
    expect(text.includes('ilike(liveChannels.pushUrl')).toBe(false)
    expect(text.includes('like(liveChannels.pushUrl, `%/${escapeLikeChars(streamName)}`)')).toBe(
      true,
    )
  })
})
