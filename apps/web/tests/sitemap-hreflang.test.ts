// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * sitemap 的 hreflang 集群锁(2026-11-01 立)。
 *
 * 为什么需要这一把:这份文件里曾经写着「ko/ja 路由文件不存在,声明会让爬虫 404」,
 * 而现读是 app/(main)/{ja,ko}/use-cases/* 各 5 枚 page.tsx 在 HEAD 面上、线上同名页 200 ——
 * 于是那 10 个页面在 sitemap 里根本不可发现。注释会说谎,盘上的路由文件不会:
 * 本锁把「声明的本地化集合」直接对账「真实存在的 ja 路由集合」,两侧不等即红。
 * (AGENTS §0.6 单一真相源:不在测试里另抄一份五路径白名单。)
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import sitemap from '../app/sitemap'

const SITE = 'https://aizhs.top'
const LOCALES = ['zh-TW', 'ja', 'ko'] as const

/**
 * 取材面锚点:先按本文件位置推(vitest 会把 import.meta.url 给成非 file: 协议,那种形态下
 * fileURLToPath 当场抛),抛了才退到 cwd 候选;三个候选都指不到 app/sitemap.ts ⇒ 抛「未判定」,
 * 绝不让这条锁在取不到输入时读成通过(§0.3)。
 */
function appDir(): string {
  const cands: string[] = []
  try {
    cands.push(resolve(dirname(fileURLToPath(import.meta.url)), '..'))
  } catch {
    /* import.meta.url 不是 file: ⇒ 交给下面 cwd 候选 */
  }
  cands.push(process.cwd(), resolve(process.cwd(), 'apps/web'))
  const hit = cands.find((c) => existsSync(resolve(c, 'app/sitemap.ts')))
  if (!hit) throw new Error(`未判定:找不到 apps/web/app 目录,候选=${cands.join(' | ')}`)
  return resolve(hit, 'app')
}

const APP = appDir()

/** 盘上真实存在 ja 副本的 use-cases 路径集合(唯一取材面 = 路由文件本身)。 */
function jaRoutesOnDisk(): Set<string> {
  const base = resolve(APP, '(main)/ja/use-cases')
  const out = new Set<string>()
  for (const dir of readdirSync(base)) {
    if (readdirSync(resolve(base, dir)).includes('page.tsx')) out.add(`/use-cases/${dir}`)
  }
  return out
}

const entries = sitemap()
const byUrl = new Map(entries.map((e) => [e.url, e]))
const declared = new Set<string>()
for (const e of entries) {
  const langs = Object.keys(e.alternates?.languages ?? {})
  if (langs.some((l) => (LOCALES as readonly string[]).includes(l))) {
    declared.add(e.url.replace(SITE, ''))
  }
}

describe('sitemap hreflang 集群', () => {
  it('声明的本地化集合 == 盘上 ja 路由集合(不多不少)', () => {
    expect([...declared].sort()).toEqual([...jaRoutesOnDisk()].sort())
  })

  it('每个集群成员都同时声明 zh-CN / zh-TW / ja / ko / x-default 五档,且 URL 逐字对得上', () => {
    for (const path of declared) {
      const langs = byUrl.get(`${SITE}${path}`)?.alternates?.languages ?? {}
      expect(Object.keys(langs).sort()).toEqual(['ja', 'ko', 'x-default', 'zh-CN', 'zh-TW'])
      expect(langs['x-default']).toBe(`${SITE}${path}`)
      expect(langs['zh-CN']).toBe(`${SITE}${path}`)
      for (const l of LOCALES) expect(langs[l]).toBe(`${SITE}/${l}${path}`)
    }
  })

  it('反向对照:没有本地化副本的页面只声明 x-default(不得凭空造出 /ja/… 这种 404 指针)', () => {
    const plain = entries.find((e) => e.url === `${SITE}/agents`)
    expect(plain).toBeTruthy()
    expect(Object.keys(plain!.alternates?.languages ?? {})).toEqual(['x-default'])
  })

  it('集群非空(枚举到 0 个成员就是本锁自己的瞎,不记绿)', () => {
    expect(declared.size).toBeGreaterThan(0)
  })
})

describe('sitemap 发射面自证', () => {
  it('源码里 ja / ko 两档必须真有发射语句(摘掉任一即翻红,不靠注释保证)', () => {
    const src = readFileSync(resolve(APP, 'sitemap.ts'), 'utf8')
    for (const l of LOCALES) {
      const needle = `languages['${l}'] = \`\${SITE_URL}/${l}\${path}\``
      expect(src, `缺 ${l} 的 hreflang 发射语句:${needle}`).toContain(needle)
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
