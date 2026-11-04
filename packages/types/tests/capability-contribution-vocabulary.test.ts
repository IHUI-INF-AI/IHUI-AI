// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 贡献词表 ↔ 校验器 ↔ 注册表 ↔ 数据类默认拒 的四方对齐(goal-b49 / S2)。
 *
 * 立因:对侧 Qoder CN 0.5.3 `resources/extensions/catalog.v1.json` 的 contributes 键集现读 8 档,
 * 我方词表只有 3 档,且注册表遍历贡献名时**硬编码**了那 3 档 —— 词表扩了而遍历没跟上,
 * 新档的贡献名就绕过冲突登记(注册表说"没占用"、其实被占着),那是比不注册更糟的失效形态。
 * 取证锚点:docs/benchmark-evidence/2026-11/qoder-trae-workbuddy-rea-20261105/
 * Q1-qoder-cn-main-bundle.md §3 #8 与 §4「插件贡献/权限词表 + 激活事件(#8)」行。
 *
 * 超越轴钉在这里:对侧只有声明、无运行期数据类切分;我方 permissions → dataClass
 * 走 capability-catalog 的**默认拒**,并由本文件把"空权限 ⇒ 一切数据类均拒"与
 * "合法权限的正常件不得被一起挡掉"钉成正反对照(只验一边,恒拒与恒放都判不出来)。
 */
import { afterEach, describe, expect, it } from 'vitest'
import {
  EXTENSION_CONTRIBUTION_KINDS,
  validateExtensionManifest,
  type ExtensionManifestValidationContext,
} from '../src/capability-extensions.js'
import {
  CAPABILITY_DATA_CLASSES,
  extensionDataClassGrant,
  extensionMayTouchDataClass,
  getCapability,
  registerExtensionManifest,
  unregisterExtension,
} from '../src/capability-catalog.js'
import type { ApiKeyPermission } from '../src/api-key.js'

/**
 * 对侧基准词表(取证时逐字照抄、顺序照抄;刻意与我方词表分开放,才能量出"少一档 / 改了名 / 换了序")。
 * 它不是第二份实现,是被对照的**外部事实** —— 我方词表若漂,本常量把差异暴露成断言失败。
 */
const BENCHMARK_KINDS = [
  'views',
  'filePreviewers',
  'qoderAgentSdk',
  'configuration',
  'nativeModules',
  'sidebarNavItems',
  'sessionResources',
  'chatMentionProviders',
] as const

const catalogCtx: ExtensionManifestValidationContext = {
  isRegisteredScope: (scope) => Boolean(getCapability(scope as ApiKeyPermission)),
}

/** 一份合法 manifest,把 contributes 换成"某一档挂一条贡献"(id 走 slug,词表档名是 camelCase) */
function manifestWith(
  kind: string,
  contributionName = 'b49_probe',
  idTag = kind.toLowerCase().replace(/[^a-z0-9-]+/g, '-'),
): Record<string, unknown> {
  return {
    id: `com.example.b49.${idTag}`,
    name: 'B49 Probe',
    version: '1.0.0',
    entryCapabilities: ['agents:read'],
    activationEvents: ['onStartup'],
    permissions: ['agents:read'],
    contributes: { [kind]: [{ name: contributionName, capability: 'agents:read' }] },
  }
}

const registeredIds: string[] = []

afterEach(() => {
  for (const id of registeredIds.splice(0)) unregisterExtension(id)
})

describe('贡献词表与对侧同名同序', () => {
  it('前 8 档逐字等于对侧 catalog 的 contributes 键集(名字、顺序都照抄)', () => {
    expect([...EXTENSION_CONTRIBUTION_KINDS].slice(0, BENCHMARK_KINDS.length)).toEqual([
      ...BENCHMARK_KINDS,
    ])
  })

  it('本仓先行档 tools/commands 保留(摘掉即废掉扩展工具链路,AGENTS §7 三问)', () => {
    expect(EXTENSION_CONTRIBUTION_KINDS).toContain('tools')
    expect(EXTENSION_CONTRIBUTION_KINDS).toContain('commands')
    // 词表 = 对侧 8 档 ∪ 本仓先行档,不重复登记
    expect(new Set(EXTENSION_CONTRIBUTION_KINDS).size).toBe(EXTENSION_CONTRIBUTION_KINDS.length)
    expect(EXTENSION_CONTRIBUTION_KINDS.length).toBe(BENCHMARK_KINDS.length + 2)
  })
})

describe('词表 ↔ 校验器键集穷尽性对齐(少一项即红)', () => {
  it('词表里每一档都能被校验器接受,并原样出现在规范化 contributes 上', () => {
    for (const kind of EXTENSION_CONTRIBUTION_KINDS) {
      const result = validateExtensionManifest(manifestWith(kind, `probe_${kind}`), catalogCtx)
      expect(result.ok, `档 "${kind}" 在词表内却不被校验器接受: ${JSON.stringify(result)}`).toBe(
        true,
      )
      if (!result.ok) continue
      expect(Object.keys(result.manifest.contributes)).toContain(kind)
    }
  })

  it('未知档 ⇒ 拒,并点名当前词表全量(点名必须跟着词表长,不得写死三档)', () => {
    const result = validateExtensionManifest(manifestWith('totallyUnknownKind'), catalogCtx)
    expect(result.ok).toBe(false)
    if (result.ok) return
    const hit = result.errors.find((e) => e.path === 'contributes.totallyUnknownKind')
    expect(hit, JSON.stringify(result.errors)).toBeTruthy()
    expect(hit!.code).toBe('unknown_field')
    for (const kind of EXTENSION_CONTRIBUTION_KINDS) {
      expect(hit!.message, `拒绝消息未点名词表档位 "${kind}"`).toContain(kind)
    }
  })

  it('注册表遍历贡献名覆盖全词表:新档同样进冲突登记(硬编码三元组即红)', () => {
    // 两枚不同 id、同一档、同一贡献名:若目录侧只遍历旧三档,这第二枚会注册成功(= 静默漏判)
    const first = registerExtensionManifest(
      manifestWith('nativeModules', 'b49_shared_native_probe', 'nm-a'),
    )
    expect(first.ok, JSON.stringify(first)).toBe(true)
    if (first.ok) registeredIds.push(first.manifest.id)

    const second = registerExtensionManifest(
      manifestWith('nativeModules', 'b49_shared_native_probe', 'nm-b'),
    )
    expect(second.ok).toBe(false)
    if (second.ok) return
    expect(second.errors.some((e) => e.code === 'contribution_conflict')).toBe(true)
  })
})

describe('permissions → dataClass 默认拒', () => {
  it('未声明任何权限 ⇒ 一切数据类均拿不到(正反对照的负侧)', () => {
    const grant = extensionDataClassGrant({ permissions: [] })
    expect(grant.allowed).toEqual([])
    expect(grant.byScope).toEqual([])
    for (const dataClass of CAPABILITY_DATA_CLASSES) {
      expect(extensionMayTouchDataClass({ permissions: [] }, dataClass)).toBe(false)
    }
  })

  it('声明了合法权限的正常件不得被一起挡掉(正侧;只放开它声明到的那一档)', () => {
    const grant = extensionDataClassGrant({ permissions: ['agents:read'] })
    expect(grant.allowed).toEqual(['scoped-read'])
    expect(grant.byScope).toEqual([{ scope: 'agents:read', dataClass: 'scoped-read' }])
    expect(extensionMayTouchDataClass({ permissions: ['agents:read'] }, 'scoped-read')).toBe(true)
    // 默认拒不得变成默认放行:platform 绝不可能从一条 scoped-read 权限里长出来
    expect(extensionMayTouchDataClass({ permissions: ['agents:read'] }, 'platform')).toBe(false)
  })

  it('声明了但未在目录登记的 scope:不贡献数据类,并逐条点名(§0.3 不得写成"没限制")', () => {
    const grant = extensionDataClassGrant({ permissions: ['agents:read', 'bogus:scope'] })
    expect(grant.allowed).toEqual(['scoped-read'])
    expect(grant.unregistered).toEqual(['bogus:scope'])

    const onlyBogus = extensionDataClassGrant({ permissions: ['bogus:scope'] })
    expect(onlyBogus.allowed).toEqual([])
    expect(onlyBogus.unregistered).toEqual(['bogus:scope'])
  })

  it('多条权限的数据类按声明顺序去重(入库可 diff,同一输入同一输出)', () => {
    const grant = extensionDataClassGrant({
      permissions: ['agents:read', 'models:write', 'agents:call'],
    })
    expect(grant.allowed).toEqual(['scoped-read', 'scoped-write', 'compute'])
    expect(grant.byScope.map((b) => b.scope)).toEqual([
      'agents:read',
      'models:write',
      'agents:call',
    ])
  })

  it('校验器与默认拒同源:permissions 未登记的扩展在校验那一关就被拒(不留到运行期)', () => {
    const result = validateExtensionManifest(
      {
        id: 'com.example.b49.unregistered',
        name: 'B49 Unregistered',
        version: '1.0.0',
        entryCapabilities: ['bogus:scope'],
        activationEvents: ['onStartup'],
        permissions: ['bogus:scope'],
        contributes: { views: [{ name: 'b49_view', capability: 'bogus:scope' }] },
      },
      catalogCtx,
    )
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors.some((e) => e.code === 'permission_not_registered')).toBe(true)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
