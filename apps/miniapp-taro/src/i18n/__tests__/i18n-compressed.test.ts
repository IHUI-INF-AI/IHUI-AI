// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 按需语言包的**产物层**对账(与 i18n-on-demand.test.ts 的运行时行为对账分家):
// 钉三件"产物之间必须一致"的事实 —— 它们是同一次生成器运行派生的三个消费面,任何一面
// 单独重生成/被回写,都会让运行时读的清单与 CDN 上的载荷对不上号(sha 变了 ⇒ 缓存整体失效,
// 而 bytes 校验会把旧载荷判成坏包 ⇒ 全端静默回落 zh-CN,用户永远看不到所选语言,且零报错)。

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join, sep } from 'node:path'
import { gunzipSync, strFromU8 } from 'fflate'
import { mergeMessages } from '@ihui/i18n/loader'
import type { Locale, Messages } from '@ihui/i18n/types'
import { REMOTE_LOCALE_B64 } from '@/i18n/generated/remote-locales.gen'
import {
  REMOTE_LOCALE_MANIFEST,
  type RemoteLocale,
} from '@/i18n/generated/remote-locale-manifest.gen'

const REMOTE_LOCALES: RemoteLocale[] = ['en', 'ja', 'ko', 'zh-TW']

// 落点按测试文件自身位置推导(与同目录 permission-tier-pack.test.ts 同一写法)。
// 不用 process.cwd():守门 70 记过那一型 —— 换个目录跑,判据结论就跟着变。
const SRC_ROOT = join(__dirname, '..', '..')
const PAYLOAD_ROOT = join(SRC_ROOT, 'assets', 'remote-locales')
const GENERATED_ROOT = join(SRC_ROOT, 'i18n', 'generated')
const MESSAGES_ROOT = join(__dirname, '..', '..', '..', '..', '..', 'packages', 'i18n', 'messages')

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

function readLocaleMessages(locale: Locale): Messages {
  const base = JSON.parse(
    readFileSync(join(MESSAGES_ROOT, 'shared', `${locale}.json`), 'utf8'),
  ) as Messages
  const override = JSON.parse(
    readFileSync(join(MESSAGES_ROOT, 'miniapp-taro', `${locale}.json`), 'utf8'),
  ) as Messages
  // 与 @ihui/i18n/loader#mergeMessages 语义一致:浅拷贝 + 普通对象递归
  return mergeMessages(base, override)
}

describe('非中文语言包离线 gzip+base64 无损性', () => {
  for (const locale of REMOTE_LOCALES) {
    it(`${locale}: 解压数据 === mergeMessages(shared, miniapp-taro) 源 JSON`, () => {
      const merged = readLocaleMessages(locale)
      const inflated = JSON.parse(
        strFromU8(gunzipSync(b64ToBytes(REMOTE_LOCALE_B64[locale]))),
      ) as Messages
      // 深比较证明字节级无损
      expect(inflated).toEqual(merged)
    })
  }
})

describe('CDN 载荷与离线真相、运行时清单同批一致', () => {
  for (const locale of REMOTE_LOCALES) {
    it(`${locale}: src/assets/remote-locales/<locale>.b64.txt 与内联载荷逐字节相同`, () => {
      const disk = readFileSync(join(PAYLOAD_ROOT, `${locale}.b64.txt`), 'utf8')
      expect(disk).toBe(REMOTE_LOCALE_B64[locale])
    })

    it(`${locale}: 清单 version === sha256(载荷) 且 bytes === 载荷字符数`, () => {
      const payload = REMOTE_LOCALE_B64[locale]
      const entry = REMOTE_LOCALE_MANIFEST[locale]
      expect(entry.bytes).toBe(payload.length)
      expect(entry.version).toBe(createHash('sha256').update(payload, 'utf8').digest('hex'))
    })
  }
})

describe('主包不再内联 440KB 载荷(判据 = 产物事实,不是"我以为")', () => {
  const offlineBundleBytes = readFileSync(
    join(GENERATED_ROOT, 'remote-locales.gen.ts'),
    'utf8',
  ).length
  const manifestBytes = readFileSync(
    join(GENERATED_ROOT, 'remote-locale-manifest.gen.ts'),
    'utf8',
  ).length

  /** src 下的**运行时**源文件(排除测试面与 generated 产物自身)—— webpack 只会打进可达模块 */
  function collectRuntimeSources(dir: string, acc: string[] = []): string[] {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name)
      if (name === '__tests__' || name === 'generated' || name === 'node_modules') continue
      const st = statSync(full)
      if (st.isDirectory()) collectRuntimeSources(full, acc)
      else if (/\.(ts|tsx)$/.test(name)) acc.push(full)
    }
    return acc
  }

  const toRelative = (f: string) => f.slice(SRC_ROOT.length).split(sep).join('/')

  it('离线包确实是被搬走的那一大块(否则本条断言没有意义)', () => {
    // 400KB 这一维不是审美:主包上限 2MB,旧内联占 440KB ≈ 22%(见票面读数)。
    // 若哪天离线包缩水到 400KB 以下,"搬出主包"这件事的量纲就变了,该重读判据而不是默默通过。
    expect(offlineBundleBytes).toBeGreaterThan(400_000)
  })

  it('运行时源面没有任何文件 import 离线包(静态或动态)', () => {
    // 引号内允许 ./ 相对路径与 @/ 别名两种写法;动态 import() 同样拦 —— 运行时一旦有人
    // "顺手补回来",440KB 立刻重新进 common.js,而 build 不报错、只是包变大。
    const importerRe = /(?:from|import)\s*\(?\s*['"][^'"]*remote-locales\.gen(?:\.ts)?['"]/
    const offenders = collectRuntimeSources(SRC_ROOT)
      .filter((f) => importerRe.test(readFileSync(f, 'utf8')))
      .map(toRelative)
    expect(offenders).toEqual([])
  })

  it('进主包的只有清单(轻量),且它被运行时引用', () => {
    expect(manifestBytes).toBeLessThan(8_000)
    expect(manifestBytes * 40).toBeLessThan(offlineBundleBytes) // 至少小两个数量级
    const runtimeIndex = readFileSync(join(SRC_ROOT, 'i18n', 'index.tsx'), 'utf8')
    expect(runtimeIndex).toMatch(/remote-locale-manifest\.gen/)
  })

  it('内置 zh-CN 仍留在包内(它是未就绪时的唯一回落语,不得搬走)', () => {
    const runtimeIndex = readFileSync(join(SRC_ROOT, 'i18n', 'index.tsx'), 'utf8')
    expect(runtimeIndex).toMatch(/@ihui\/i18n\/messages\/shared\/zh-CN\.json/)
    expect(runtimeIndex).toMatch(/@ihui\/i18n\/messages\/miniapp-taro\/zh-CN\.json/)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
