// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

import { describe, it, expect, beforeEach } from 'vitest'

import {
  BUILTIN_COMMANDS,
  COMMAND_GROUP_LABEL_KEY,
  COMMAND_GROUP_ORDER,
  clearMru,
  filterCommands,
  getMruCommandIds,
  groupCommands,
  recordCommandUse,
  sortByMru,
  type CommandDef,
  type CommandTextGetter,
} from '@/lib/command-registry'

/** 固定文案 text getter(隔离 i18n) */
const text: CommandTextGetter = {
  getLabel: (id) => `label-${id}`,
  getDescription: (id) => `desc-${id}`,
  getKeywords: (id) => [`kw-${id}`],
}

/** 大小写不敏感匹配的 text getter */
const ciText: CommandTextGetter = {
  getLabel: (id) => (id === 'chat' ? 'AI Chat' : `label-${id}`),
  getDescription: (id) => `desc-${id}`,
  getKeywords: (id) => [`kw-${id}`],
}

describe('command-registry BUILTIN_COMMANDS', () => {
  it('包含 21 项命令且 id 唯一', () => {
    expect(BUILTIN_COMMANDS).toHaveLength(21)
    const ids = new Set(BUILTIN_COMMANDS.map((c) => c.id))
    expect(ids.size).toBe(BUILTIN_COMMANDS.length)
  })

  it('每项命令有分组/图标/action,分组均在分组顺序表内', () => {
    for (const cmd of BUILTIN_COMMANDS) {
      expect(cmd.group).toBeTruthy()
      expect(cmd.icon).toBeTruthy()
      expect(cmd.action).toBeTruthy()
      expect(COMMAND_GROUP_ORDER).toContain(cmd.group)
      expect(COMMAND_GROUP_LABEL_KEY[cmd.group]).toMatch(/^groups\./)
    }
  })
})

describe('filterCommands', () => {
  it('空查询返回全部', () => {
    expect(filterCommands(BUILTIN_COMMANDS, '', text)).toHaveLength(21)
    expect(filterCommands(BUILTIN_COMMANDS, '   ', text)).toHaveLength(21)
  })

  it('按 label 子串过滤', () => {
    const result = filterCommands(BUILTIN_COMMANDS, 'label-chat', text)
    expect(result.map((c) => c.id)).toEqual(['chat'])
  })

  it('按 keywords 过滤', () => {
    const result = filterCommands(BUILTIN_COMMANDS, 'kw-terminal', text)
    expect(result.map((c) => c.id)).toEqual(['terminal'])
  })

  it('大小写不敏感', () => {
    const result = filterCommands(BUILTIN_COMMANDS, 'ai chat', ciText)
    expect(result.map((c) => c.id)).toContain('chat')
  })

  it('无匹配返回空数组', () => {
    expect(filterCommands(BUILTIN_COMMANDS, '不存在的命令xyz', text)).toEqual([])
  })
})

describe('sortByMru', () => {
  it('MRU 命中项按 MRU 顺序前置,未命中保持原顺序', () => {
    const defs: CommandDef[] = [
      BUILTIN_COMMANDS.find((c) => c.id === 'chat')!,
      BUILTIN_COMMANDS.find((c) => c.id === 'search')!,
      BUILTIN_COMMANDS.find((c) => c.id === 'settings')!,
    ]
    const sorted = sortByMru(defs, ['settings', 'chat'])
    expect(sorted.map((c) => c.id)).toEqual(['settings', 'chat', 'search'])
  })

  it('无 MRU 时保持原顺序(稳定)', () => {
    const defs = BUILTIN_COMMANDS.slice(0, 5)
    expect(sortByMru(defs, []).map((c) => c.id)).toEqual(defs.map((c) => c.id))
  })
})

describe('groupCommands', () => {
  it('按 COMMAND_GROUP_ORDER 分组且过滤空组', () => {
    const defs = [
      BUILTIN_COMMANDS.find((c) => c.id === 'chat')!,
      BUILTIN_COMMANDS.find((c) => c.id === 'terminal')!,
    ]
    const groups = groupCommands(defs)
    expect(groups.map((g) => g.group)).toEqual(['navigate', 'tools'])
    expect(groups[0]!.items.map((c) => c.id)).toEqual(['chat'])
    expect(groups[1]!.items.map((c) => c.id)).toEqual(['terminal'])
  })

  it('全量命令产生 5 个非空组', () => {
    const groups = groupCommands(BUILTIN_COMMANDS)
    expect(groups.map((g) => g.group)).toEqual(COMMAND_GROUP_ORDER)
  })
})

describe('MRU 持久化', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('recordCommandUse + getMruCommandIds 降序返回', () => {
    recordCommandUse('chat')
    recordCommandUse('search')
    recordCommandUse('chat')
    expect(getMruCommandIds()).toEqual(['chat', 'search'])
  })

  it('未知 id 不被记录', () => {
    recordCommandUse('not-a-command')
    expect(getMruCommandIds()).toEqual([])
  })

  it('超过 8 条淘汰最旧', () => {
    const ids = BUILTIN_COMMANDS.slice(0, 10).map((c) => c.id)
    ids.forEach((id) => recordCommandUse(id))
    const mru = getMruCommandIds()
    expect(mru).toHaveLength(8)
    // 最早两条被淘汰
    expect(mru).not.toContain(ids[0])
    expect(mru).not.toContain(ids[1])
    expect(mru[0]).toBe(ids[9])
  })

  it('损坏的 localStorage 数据静默降级', () => {
    localStorage.setItem('ihui-command-mru', 'not-json{')
    expect(getMruCommandIds()).toEqual([])
  })

  it('clearMru 清空', () => {
    recordCommandUse('chat')
    clearMru()
    expect(getMruCommandIds()).toEqual([])
  })

  it('已下线 id 被过滤', () => {
    localStorage.setItem(
      'ihui-command-mru',
      JSON.stringify([
        { id: 'chat', lastUsedAt: 100 },
        { id: 'removed-command', lastUsedAt: 200 },
      ]),
    )
    expect(getMruCommandIds()).toEqual(['chat'])
  })
})
