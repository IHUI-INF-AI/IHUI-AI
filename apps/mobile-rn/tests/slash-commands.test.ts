// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * RN 斜杠命令面的跨端对齐断言(T2 收口)。
 *
 * 断言四件事,任一不成立即红:
 * ① 文案零硬编码 —— 注册表只登记 i18n 键,解析后才出文案;五语言包必须逐键齐备
 *    (本端取词缺键不抛错,而是把键名原样回显到界面,与 max-tokens 那条同一失效类)。
 * ② 模板类命令与共享层 `SLASH_COMMAND_IDS` **同序同条**(直接 import 共享层源,
 *    不抄副本 —— 抄副本等于把对账变成两人都可能漂移的两份真相)。
 *    ⚠️ 基准必须取自 `@ihui/shared/chat/slash-command-ids`,不能取自 web 源码:
 *    端与端之间的 import 边违反架构契约(端永不互相 import),web 与 RN 两侧
 *    都 import 这一份共享层清单,顺序一致才是「同源」而非「同抄」。
 * ③ 模板正文与 web `chat.cmd*` 逐字一致(中/英两语;web 侧的键名大小写拼写由映射表给出)。
 * ④ 匹配打在本地化文案上 —— 中文用户敲「总结」要能筛出 /summary;/help 文案由命令表
 *    现场拼出,新增命令不必再改一处手写清单。
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { SLASH_COMMAND_IDS } from '@ihui/shared/chat/slash-command-ids'
import {
  formatSlashHelp,
  matchSlashCommands,
  resolveSlashCommands,
} from '../src/lib/slash-commands'

const LOCALES = ['zh-CN', 'zh-TW', 'en', 'ja', 'ko'] as const

type Pack = Record<string, Record<string, string>>

function readPack(locale: string): Pack {
  return JSON.parse(
    readFileSync(
      join(
        __dirname,
        '..',
        '..',
        '..',
        'packages',
        'i18n',
        'messages',
        'mobile-rn',
        `${locale}.json`,
      ),
      'utf8',
    ),
  ) as Pack
}

function readWebPack(locale: string): Pack {
  return JSON.parse(
    readFileSync(
      join(__dirname, '..', '..', '..', 'packages', 'i18n', 'messages', 'web', `${locale}.json`),
      'utf8',
    ),
  ) as Pack
}

/** 取词器:从真实语言包取值,缺键抛错(本测试里缺键必须是失败而不是回显) */
function translator(pack: Pack): (key: string, params?: Record<string, string | number>) => string {
  return (key: string, params?: Record<string, string | number>) => {
    const [ns, field] = key.split('.')
    const value = ns === undefined ? undefined : pack[ns]?.[field ?? '']
    if (value === undefined) throw new Error(`missing i18n key: ${key}`)
    if (params === undefined) return value
    // 端内 t() 的 `{name}` 插值(本测试只用到 {list}/{model}/{count}/{state} 这类平铺占位)
    return value.replace(/\{(\w+)\}/g, (whole, name: string) =>
      params[name] === undefined ? whole : String(params[name]),
    )
  }
}

/** RN 模板正文键 → web `chat` 命名空间下的键名(两侧命名不同,映射在此显式登记) */
const WEB_TEMPLATE_KEY: Record<string, string> = {
  summary: 'cmdSummary',
  translate: 'cmdTranslate',
  explain: 'cmdExplain',
  code: 'cmdCode',
  polish: 'cmdPolish',
  wechatArticle: 'cmdWechatArticle',
  kouboScript: 'cmdKouboScript',
}

describe('RN 斜杠命令注册表', () => {
  it('id 唯一且模板类命令与 web SLASH_COMMAND_IDS 同序同条', () => {
    const commands = resolveSlashCommands(translator(readPack('zh-CN')))
    const ids = commands.map((cmd) => cmd.id)
    expect(new Set(ids).size).toBe(ids.length)
    const templateIds = commands
      .filter((cmd) => cmd.promptTemplate !== undefined)
      .map((cmd) => cmd.id)
    expect(templateIds).toEqual([...SLASH_COMMAND_IDS])
  })

  // 每条命令的标题/说明/模板键由下面「解析后文案非空」那条盖住(取词器缺键即抛);
  // 这里只管那些没有命令挂在上面、必须单独点名的键。
  it('五语言包齐备:面板标题/空态/帮助/状态行一个不缺', () => {
    const keys = [
      'slashCmd.paletteTitle',
      'slashCmd.paletteEmpty',
      'slashCmd.helpPrefix',
      'slashCmd.statusToast',
      'slashCmd.stateIdle',
      'slashCmd.stateStreaming',
    ]
    for (const locale of LOCALES) {
      const pack = readPack(locale)
      const missing = keys.filter((key) => {
        const [ns, field] = key.split('.')
        return ns === undefined || pack[ns]?.[field ?? ''] === undefined
      })
      expect(missing, `${locale} 缺键`).toEqual([])
    }
  })

  it('模板正文与 web chat.cmd* 逐字一致(中/英)', () => {
    for (const locale of ['zh-CN', 'en'] as const) {
      const rn = readPack(locale).slashTemplate ?? {}
      const web = readWebPack(locale).chat ?? {}
      for (const [rnKey, webKey] of Object.entries(WEB_TEMPLATE_KEY)) {
        expect(rn[rnKey], `${locale} /${rnKey} 模板与 web 漂移`).toBe(web[webKey])
      }
    }
  })

  it('解析后文案非空,且模板类命令带模板、动作型不带', () => {
    for (const locale of LOCALES) {
      const commands = resolveSlashCommands(translator(readPack(locale)))
      for (const cmd of commands) {
        expect(cmd.title.length, `${locale} ${cmd.id} 标题为空`).toBeGreaterThan(0)
        expect((cmd.description ?? '').length).toBeGreaterThan(0)
      }
      for (const id of SLASH_COMMAND_IDS) {
        expect(commands.find((cmd) => cmd.id === id)?.promptTemplate?.length ?? 0).toBeGreaterThan(
          0,
        )
      }
      for (const cmd of commands) {
        if (!(SLASH_COMMAND_IDS as readonly string[]).includes(cmd.id)) {
          expect(cmd.promptTemplate, `${cmd.id} 不该带模板`).toBeUndefined()
        }
      }
    }
  })
})

describe('RN 斜杠命令匹配与帮助', () => {
  const zh = resolveSlashCommands(translator(readPack('zh-CN')))

  it('按本地化标题筛得出(中文用户敲「总结」)', () => {
    const hits = matchSlashCommands('/总结', zh)
    expect(hits.map((cmd) => cmd.id)).toContain('summary')
  })

  it('按触发词筛得出,且相关度全等优先', () => {
    expect(matchSlashCommands('/sum', zh).map((cmd) => cmd.id)[0]).toBe('summary')
  })

  it('非斜杠开头不触发命令面板', () => {
    expect(matchSlashCommands('总结', zh)).toEqual([])
  })

  it('/help 文案覆盖每一条命令的触发词(由命令表现场拼,不另立手写清单)', () => {
    const help = formatSlashHelp(translator(readPack('zh-CN')))
    for (const cmd of zh) {
      expect(help).toContain(cmd.trigger)
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
