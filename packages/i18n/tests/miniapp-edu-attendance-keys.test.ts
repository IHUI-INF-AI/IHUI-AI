// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 小程序 edu* 考勤词包键集结构锁(2026-11-10 立)。
//
// 立因:pkg-user 下这五枚**已入库**页面(edu-mgmt-attendance/{index,stats-panel,day-bar}.tsx、
// edu-my-attendance/index.tsx、edu-parent/index.tsx)引用了 29 枚 eduAttendance.* /
// eduMyAttendance.* / eduParent.* 键,而 packages/i18n/messages/miniapp-taro/ 五语言里
// 只有其中 5 枚(eduAttendance 的 statusTitle/checkIn/checkOut/status/student)。
// loader 取不到键时**原样返回键名**(packages/i18n/src/loader.ts 的 `return key`),
// 于是用户在这三页上直接看到 "eduAttendance.checkedInToast" 这样的裸串。
//
// 为什么门没拦住(实测,不是猜):check-i18n-keys.mjs 确实登记了 miniapp-taro 这一档,
// 但**没有任何调度点带 --target=miniapp-taro 跑过它**:
//   · scripts/guardian-runner.mjs 里 check-i18n-keys.mjs 共登记 5 条 —— [2](无参=web)、
//     [2f-ext](extension)、[2f-shared](shared)、[2n-web](`--parity-only`)、
//     [2f-mobile-rn](`--target=mobile-rn --parity-only`)。零条指向 miniapp-taro。
//   · 根 package.json `check:i18n-keys` = 无参 ⇒ web;CI i18n-check.yml 只跑这一条。
//   · `--parity-only` 会走 `sourceFiles = []` 分支 ⇒ **连 mobile-rn 的"端内引用键缺失"
//     检测也没进提交链**,只比五语言彼此键集。
// 所以这一族的"页面引用 × 词表"判据在提交链与 CI 上都是零覆盖(§0.9「判据在、器物在、
// 没接线」的新实例)。本测试把这格补在**测试面**,与门无关地先响起来。
//
// 射程边界(不得读成"这一族全覆盖"):
//   B1 只判**静态字面量**引用 `t('a.b')`。`statusLabelOf` 的 `t(\`eduAttendance.status.${code}\`)`
//      是动态键,门的 extractDynamicPrefixes 只看"前缀是不是对象节点"(eduAttendance.status
//      是),逐码取值无人判 —— 实测 contract.ATTENDANCE_STATUS_CODES 含 `early`,
//      而 miniapp 五语言 eduAttendance.status 只有 present/late/absent/leave 四格,
//      该页对 early 会回显原始码。本测试**不**为它补值:mobile-rn ko 里
//      leave 与 early 同为 "조퇴"(同层同值),照抄会把这格歧义带进小程序;
//      正解需要先定 ko 措辞,属另票,此处只把盲区写清不静默。
//   B2 不判值的质量(除 L3/L4 那两类可机械判的形态)。

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(here, '..', '..', '..')
const messagesRoot = join(repoRoot, 'packages', 'i18n', 'messages', 'miniapp-taro')
const sharedRoot = join(repoRoot, 'packages', 'i18n', 'messages', 'shared')
const LOCALES = ['zh-CN', 'zh-TW', 'en', 'ja', 'ko'] as const

/** 被钉页面(全部已入库;逐枚按当次实测读取,不写死键清单 ⇒ 新增引用自动进射程) */
const PAGE_SOURCES = [
  'apps/miniapp-taro/src/pkg-user/edu-mgmt-attendance/index.tsx',
  'apps/miniapp-taro/src/pkg-user/edu-mgmt-attendance/stats-panel.tsx',
  'apps/miniapp-taro/src/pkg-user/edu-mgmt-attendance/day-bar.tsx',
  'apps/miniapp-taro/src/pkg-user/edu-my-attendance/index.tsx',
  'apps/miniapp-taro/src/pkg-user/edu-parent/index.tsx',
] as const

/** 本票点名的三个命名空间(其余命名空间也一并判齐,但反证锁只对这族摘键) */
const TICKET_NAMESPACES = ['eduAttendance', 'eduMyAttendance', 'eduParent'] as const

/** 与 check-i18n-keys.mjs 同口径的剥注释(注释里的示例不是发射点) */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '')
}

function readPack(locale: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(messagesRoot, `${locale}.json`), 'utf8')) as Record<
    string,
    unknown
  >
}

/** shared 基础包(端包与它 mergeShared,判 resolve 时必须一起看,口径同门) */
function readShared(locale: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(sharedRoot, `${locale}.json`), 'utf8')) as Record<
    string,
    unknown
  >
}

function getByPath(root: unknown, dotted: string): unknown {
  return dotted.split('.').reduce<unknown>((acc, seg) => {
    if (acc && typeof acc === 'object' && !Array.isArray(acc)) {
      return (acc as Record<string, unknown>)[seg]
    }
    return undefined
  }, root)
}

/** 端内 hook 形态 `t('a.b')` / `tt("a.b")`;模板串与拼接不在射程(见 B1) */
function staticRefs(src: string): string[] {
  const code = stripComments(src)
  const out = new Set<string>()
  const re = /\b(?:t|tt)\(\s*['"]([A-Za-z][\w]*(?:\.[\w]+)+)['"]/g
  let m: RegExpExecArray | null
  while ((m = re.exec(code)) !== null) out.add(m[1]!)
  return [...out].sort()
}

function consumedRefs(): { file: string; key: string }[] {
  const rows: { file: string; key: string }[] = []
  for (const rel of PAGE_SOURCES) {
    // 取不到源码 ⇒ 直接判死:静默跳过会让这把锁对着空集合报绿(§0.3)
    let src: string
    try {
      src = readFileSync(join(repoRoot, rel), 'utf8')
    } catch (e) {
      throw new Error(`反证锁取不到页面源 ${rel}(不据此报绿):${String(e)}`)
    }
    for (const key of staticRefs(src)) rows.push({ file: rel, key })
  }
  return rows
}

function placeholdersOf(value: string): string[] {
  return [...value.matchAll(/\{\{?(\w+)\}?\}/g)].map((m) => m[1]!).sort()
}

describe('miniapp edu* 考勤词包键集结构锁', () => {
  const refs = consumedRefs()

  it('L0 射程非空:五枚页面确实各带静态取词引用(0 候选不许当"已覆盖")', () => {
    const files = new Set(refs.map((r) => r.file))
    expect(files.size, '扫到的被钉页面数').toBe(PAGE_SOURCES.length)
    expect(refs.length).toBeGreaterThan(0)
    for (const ns of TICKET_NAMESPACES) {
      expect(
        refs.some((r) => r.key.startsWith(`${ns}.`)),
        `页面引用集里没有 ${ns}.* —— 命名空间改名或整族被摘,本锁就成空锁`,
      ).toBe(true)
    }
  })

  it('L1 页面引用的每一枚键在五语言都存在且为非空字符串(缺=屏上回显裸键名)', () => {
    const packs = LOCALES.map((l) => ({ lang: l, mini: readPack(l), shared: readShared(l) }))
    for (const { file, key } of refs) {
      for (const { lang, mini, shared } of packs) {
        const value = getByPath(mini, key) ?? getByPath(shared, key)
        expect(
          value,
          `${file} 引用 ${key},但 miniapp-taro/${lang} 取不到 ⇒ loader 把键名当文案渲染给用户`,
        ).toBeTypeOf('string')
        expect(
          (value as string).trim().length,
          `${file} 引用 ${key},但 ${lang} 取值是空串(空串=另一种用户可见缺陷)`,
        ).toBeGreaterThan(0)
        expect(value, `${lang}: ${key} 的取值等于键名本身(=把"没翻译"写成了文案)`).not.toBe(key)
      }
    }
  })

  it('L2 edu* 三族在五语言的键集完全一致(不许某一语言漏翻)', () => {
    for (const ns of TICKET_NAMESPACES) {
      const sets = LOCALES.map((lang) => {
        const node = readPack(lang)[ns]
        expect(node, `miniapp-taro/${lang}.json 缺 ${ns} 命名空间`).toBeTypeOf('object')
        return Object.keys(node as Record<string, unknown>)
          .sort()
          .join(',')
      })
      for (let i = 1; i < LOCALES.length; i++) {
        expect(sets[i], `${ns}: ${LOCALES[i]} 键集与 ${LOCALES[0]} 不一致`).toBe(sets[0])
      }
    }
  })

  it('L3 带插值的键在五语言用的是同一组占位符名(少一个=渲染成 "近  天")', () => {
    const interpolated = refs
      .map((r) => r.key)
      .filter((k) => {
        const v = getByPath(readPack('zh-CN'), k)
        return typeof v === 'string' && placeholdersOf(v).length > 0
      })
    expect(
      interpolated.length,
      '射程内一枚带占位符的键都没有 ⇒ 本判据在空转(不得读成通过)',
    ).toBeGreaterThan(0)
    for (const key of interpolated) {
      const base = placeholdersOf(String(getByPath(readPack('zh-CN'), key)))
      for (const lang of LOCALES) {
        if (lang === 'zh-CN') continue
        const got = placeholdersOf(String(getByPath(readPack(lang), key)))
        expect(got, `${key}: ${lang} 的占位符集与 zh-CN 不一致`).toStrictEqual(base)
      }
    }
  })

  it('L4 状态类取值不得同字(同值=把两种状态渲染成同一张脸)', () => {
    const distinctPairs: [string, string, string][] = [
      ['eduAttendance', 'checkedInToast', 'checkedOutToast'],
      ['eduAttendance', 'checkIn', 'checkOut'],
      ['eduMyAttendance', 'selfDoneToast', 'scanInvalidToast'],
      ['eduMyAttendance', 'scanDoneToast', 'scanInvalidToast'],
    ]
    for (const lang of LOCALES) {
      const pack = readPack(lang)
      for (const [ns, a, b] of distinctPairs) {
        const va = String(getByPath(pack, `${ns}.${a}`))
        const vb = String(getByPath(pack, `${ns}.${b}`))
        expect(vb, `${ns}.${a} 与 ${ns}.${b} 在 ${lang} 同值`).not.toBe(va)
      }
    }
  })

  it('L5 备注占位符走通用单源键,不得在 eduMyAttendance 下另抄一份', () => {
    const code = PAGE_SOURCES.map((rel) =>
      stripComments(readFileSync(join(repoRoot, rel), 'utf8')),
    ).join('\n')
    // 引用必须已改指 share.remarkPlaceholder(改引用这一路的结论锁)
    expect(code).toContain(`t('share.remarkPlaceholder')`)
    expect(
      /t\(\s*['"]eduMyAttendance\.remarkPlaceholder['"]/.test(code),
      '页面又引用 eduMyAttendance.remarkPlaceholder:该串与 share.remarkPlaceholder 同义,§0.6 不许第二份真相',
    ).toBe(false)
    for (const lang of LOCALES) {
      const pack = readPack(lang)
      const shared = getByPath(readShared(lang), 'share.remarkPlaceholder')
      const own = getByPath(pack, 'share.remarkPlaceholder')
      expect(own ?? shared, `share.remarkPlaceholder 在 ${lang} 两头都取不到`).toBeTypeOf('string')
      expect(
        getByPath(pack, 'eduMyAttendance.remarkPlaceholder'),
        `eduMyAttendance.remarkPlaceholder 被重新造出来了(${lang})`,
      ).toBeUndefined()
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
