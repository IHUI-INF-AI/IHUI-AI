// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 更新提示文案的两端一致性结构锁(2026-10-27 立)。
//
// 为什么需要:web 的 PWAUpdatePrompt / 版本闸门卡片与 RN 的 UpdatePrompt 是**两套渲染**,
// 文案却必须"看起来是同一个东西"。此前 web 端硬编码中文、RN 端写在自己词表里,
// 两边各改各的 ⇒ 用户看到的措辞迟早漂开,而且 5 语言里只有中文对得上。
// 现在两端共用 appUpdate 命名空间,本测试把"共用"从口头约定变成机器判据:
//   S1 web 侧 5 语言键集完全一致(不许某个语言漏翻);
//   S2 RN 侧键集必须是 web 的子集,且**同名键的值逐字相等**(同键不同文 = 不一致);
//   S3 两端共有键里的占位符必须成对出现({version}/{latest} 不许单边丢);
//   S4 两端都不得残留旧命名空间 update(它已被 appUpdate 取代,留着就是第二份真相源)。

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const messagesRoot = join(here, '..', 'messages')
const LOCALES = ['zh-CN', 'en', 'ja', 'ko', 'zh-TW'] as const

type Dict = Record<string, unknown>

function readMessages(platform: 'web' | 'mobile-rn', locale: string): Dict {
  const path = join(messagesRoot, platform, `${locale}.json`)
  return JSON.parse(readFileSync(path, 'utf8')) as Dict
}

function appUpdateOf(platform: 'web' | 'mobile-rn', locale: string): Record<string, string> {
  const dict = readMessages(platform, locale)
  const ns = dict.appUpdate
  expect(ns, `${platform}/${locale} 缺 appUpdate 命名空间`).toBeTypeOf('object')
  return ns as Record<string, string>
}

/** 两端必须都有的键(RN 只用这 8 个;web 另有 gate* 强更文案)。 */
const SHARED_KEYS = [
  'title',
  'body',
  'action',
  'close',
  'ready',
  'installing',
  'error',
  'errorDesc',
] as const

/** web 独占的强更弹窗文案(web 有阻塞弹窗,RN 目前没有强更通道)。 */
const WEB_ONLY_KEYS = [
  'gateTitle',
  'gateBody',
  'gateForceBody',
  'gateReleaseNotes',
  'gateUpdateNow',
  'gateQuit',
  'gateQuitConfirm',
  'gateQuitFailed',
] as const

/**
 * RN 独占的 OTA 卡文案:下载读条 + 当前包身份(2026-10-27 第二批加)。
 * web 的 PWA 卡没有这两层(SW 更新是页面级 reload,没有"包身份"概念),
 * 所以不进 SHARED_KEYS,但五语言齐备与占位符成对照判不豁免。
 */
const RN_ONLY_KEYS = [
  'downloading',
  'currentBundle',
  'bundleEmbedded',
  'bundleOta',
  // 2026-10-28 机主「怎么还能提示用户去刷新页面」:RN 不能复用 web 的 body
  // (web 是 PWA 刷新页面,RN 是点按钮重启进程),就绪态改用自己的 readyBody;
  // 重启迟迟不回来时的兜底按钮与说明同理只在 RN 出现。
  'readyBody',
  'installingHint',
  'restartNow',
] as const

/**
 * 已被审计删掉的死键:不许再回来(回来就是"写了不渲染"的第二份真相源)。
 *   checking —— 两端 UI 都不显示检查中中间态
 *   upToDate —— 设置页用的是 settings.checkUpdateLatest
 *   retry —— 重启失败改成"回到 ready 再点一次"
 *   gateLater —— 强更弹窗里 skip 侧门恒锁死,那块 UI 结构上永不渲染
 *   〔2026-10-27 更正〕downloading 曾在本名单:原判"两端 UI 都不显示下载中间态";
 *   机主实机要求补读条后 RN 卡开始渲染它 ⇒ 移入 RN_ONLY_KEYS,不再是死键。
 */
const REMOVED_DEAD_KEYS = ['checking', 'upToDate', 'retry', 'gateLater'] as const

describe('appUpdate 文案:web 5 语言键集一致(S1)', () => {
  it('每个语言都齐 SHARED_KEYS + WEB_ONLY_KEYS', () => {
    for (const locale of LOCALES) {
      const ns = appUpdateOf('web', locale)
      for (const key of [...SHARED_KEYS, ...WEB_ONLY_KEYS]) {
        expect(ns[key], `web/${locale} 缺 ${key}`).toBeTypeOf('string')
        expect((ns[key] as string).length, `web/${locale} 的 ${key} 是空串`).toBeGreaterThan(0)
      }
    }
  })

  it('5 语言的键集逐字相同(没有语言多一个或少一个)', () => {
    const baseline = Object.keys(appUpdateOf('web', 'zh-CN')).sort()
    for (const locale of LOCALES) {
      expect(
        Object.keys(appUpdateOf('web', locale)).sort(),
        `web/${locale} 键集与 zh-CN 不同`,
      ).toEqual(baseline)
    }
  })
})

describe('appUpdate 文案:RN = 共用键 + RN 独占键,共用键与 web 等值(S2)', () => {
  it('RN 有 SHARED_KEYS,且每个共用键的值与 web 逐字相等', () => {
    for (const locale of LOCALES) {
      const web = appUpdateOf('web', locale)
      const mobile = appUpdateOf('mobile-rn', locale)
      for (const key of SHARED_KEYS) {
        expect(mobile[key], `mobile-rn/${locale} 缺 ${key}`).toBeTypeOf('string')
        expect(mobile[key], `mobile-rn/${locale} 的 ${key} 与 web 措辞不一致`).toBe(web[key])
      }
    }
  })

  it('RN 独占键五语言齐备且非空(RN_ONLY_KEYS 不进 web,但翻译纪律同 SHARED)', () => {
    for (const locale of LOCALES) {
      const mobile = appUpdateOf('mobile-rn', locale)
      for (const key of RN_ONLY_KEYS) {
        expect(mobile[key], `mobile-rn/${locale} 缺 RN 独占键 ${key}`).toBeTypeOf('string')
        expect(
          (mobile[key] as string).length,
          `mobile-rn/${locale} 的 ${key} 是空串`,
        ).toBeGreaterThan(0)
      }
    }
  })

  it('RN 独占键 currentBundle 的 {{bundle}} 占位符五语言成对', () => {
    for (const locale of LOCALES) {
      expect(
        appUpdateOf('mobile-rn', locale).currentBundle,
        `mobile-rn/${locale} currentBundle 缺 {{bundle}}`,
      ).toContain('{{bundle}}')
    }
  })
})

describe('appUpdate 文案:占位符成对(S3)', () => {
  it('{version} / {latest} 该有的地方都在', () => {
    for (const locale of LOCALES) {
      const web = appUpdateOf('web', locale)
      expect(web.gateBody, `web/${locale} gateBody 缺 {version}`).toContain('{version}')
      expect(web.gateBody, `web/${locale} gateBody 缺 {latest}`).toContain('{latest}')
      expect(web.gateForceBody, `web/${locale} gateForceBody 缺 {latest}`).toContain('{latest}')
    }
  })
})

describe('appUpdate 文案:旧命名空间不得残留(S4)', () => {
  it('两端都没有 update 命名空间(已被 appUpdate 取代)', () => {
    for (const locale of LOCALES) {
      expect(
        Object.hasOwn(readMessages('mobile-rn', locale), 'update'),
        `mobile-rn/${locale} 仍残留旧 update 命名空间`,
      ).toBe(false)
      expect(
        Object.hasOwn(readMessages('web', locale), 'appUpdate'),
        `web/${locale} 缺 appUpdate`,
      ).toBe(true)
    }
  })
})

describe('appUpdate 文案:死键不许回来(S5)', () => {
  it('审计删掉的键两端都不存在', () => {
    for (const locale of LOCALES) {
      const web = appUpdateOf('web', locale)
      const mobile = appUpdateOf('mobile-rn', locale)
      for (const key of REMOVED_DEAD_KEYS) {
        expect(web[key], `web/${locale} 又长回死键 ${key}`).toBeUndefined()
        expect(mobile[key], `mobile-rn/${locale} 又长回死键 ${key}`).toBeUndefined()
      }
    }
  })

  it('键集恰好等于"共用键 + web 独占键"/"共用键 + RN 独占键"(没有多余项)', () => {
    for (const locale of LOCALES) {
      const webKeys = Object.keys(appUpdateOf('web', locale)).sort()
      expect(webKeys).toEqual([...SHARED_KEYS, ...WEB_ONLY_KEYS].sort())
      const mobileKeys = Object.keys(appUpdateOf('mobile-rn', locale)).sort()
      expect(mobileKeys).toEqual([...SHARED_KEYS, ...RN_ONLY_KEYS].sort())
    }
  })
})

describe('pwaInstall 文案:web 5 语言齐(S6)', () => {
  it('title/body/action/close 都存在且非空,5 语言键集一致', () => {
    const baseline = ['action', 'body', 'close', 'title']
    for (const locale of LOCALES) {
      const dict = readMessages('web', locale) as { pwaInstall?: Record<string, string> }
      expect(dict.pwaInstall, `web/${locale} 缺 pwaInstall`).toBeTypeOf('object')
      const ns = dict.pwaInstall as Record<string, string>
      expect(Object.keys(ns).sort()).toEqual(baseline)
      for (const [k, v] of Object.entries(ns)) {
        expect(v.length, `web/${locale} 的 pwaInstall.${k} 是空串`).toBeGreaterThan(0)
      }
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
