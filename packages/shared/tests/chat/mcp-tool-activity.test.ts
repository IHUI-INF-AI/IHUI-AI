// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D83 MCP 工具活动三层键(server / tool / 是否带上下文)回落链回归。
// 覆盖:归一化 → 五级回落逐级 → 同层档位回落 → 真五语言词表端到端 → 注入定制键的反向对照。

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  EMPTY_MCP_ACTIVITY_TABLES,
  canonicalMcpSegment,
  describeMcpToolActivity,
  hasDisplayableContext,
  mcpToolActivityKeyList,
  normalizeMcpToolName,
  resolveMcpToolActivityKey,
  type McpActivityTables,
} from '../../src/chat/mcp-tool-activity'

const LANGS = ['zh-CN', 'zh-TW', 'en', 'ja', 'ko'] as const

/** 真语言包(packages/i18n/messages/shared)—— 词表与代码同票的端到端证据 */
function loadTaskStatus(lang: string): Record<string, string> {
  const url = new URL(`../../../../packages/i18n/messages/shared/${lang}.json`, import.meta.url)
  const parsed = JSON.parse(readFileSync(fileURLToPath(url), 'utf8')) as {
    taskStatus?: Record<string, string>
  }
  return parsed.taskStatus ?? {}
}

/** 只认本仓这一种形态:{state, select, running {…} completed {…} other {…}};不匹配即原样返回(会被判不可用) */
function renderIcu(value: string, params: Record<string, string | number>): string {
  // 先把 {name} 填进去,分支体才回到"不含嵌套花括号"的形态(带上下文档的分支里就是写着 {name})
  const filled =
    params.name === undefined ? value : value.replace(/\{name\}/gu, String(params.name))
  const m =
    /^\{\s*state,\s*select,\s*running\s*\{([^{}]*)\}\s*completed\s*\{([^{}]*)\}\s*other\s*\{([^{}]*)\}\s*\}$/u.exec(
      filled,
    )
  if (!m) return value
  const branch = params.state === 'running' ? m[1] : params.state === 'completed' ? m[2] : m[3]
  return (branch ?? '').replace(
    /\{name\}/gu,
    params.name === undefined ? '{name}' : String(params.name),
  )
}

function translateFrom(pack: Record<string, string>) {
  return (key: string, params?: Record<string, string | number>): string => {
    const raw = pack[key]
    // 端内取词引擎缺键时回显键名 —— 与本仓各端同一行为
    if (typeof raw !== 'string') return key
    return renderIcu(raw, params ?? {})
  }
}

describe('段名归一化', () => {
  it('任意大小写与分隔符收敛到小写下划线形', () => {
    expect(canonicalMcpSegment('GitHub')).toBe('github')
    expect(canonicalMcpSegment('browser-use')).toBe('browser_use')
    expect(canonicalMcpSegment('createIssue')).toBe('create_issue')
    expect(canonicalMcpSegment('  Create.Pull_Request  ')).toBe('create_pull_request')
    expect(canonicalMcpSegment('!!!')).toBe('')
  })

  it('剥掉 mcp__server__ / server: 这类无歧义命名空间前缀,但绝不剥裸下划线前缀', () => {
    expect(normalizeMcpToolName('mcp__github__create_issue', 'GitHub')).toBe('create_issue')
    expect(normalizeMcpToolName('github:create_issue', 'github')).toBe('create_issue')
    // `github_token_list` 无法与"工具名本身以 github_ 开头"区分 ⇒ 不剥(宁可不命中往下回落,也不猜)
    expect(normalizeMcpToolName('github_token_list', 'github')).toBe('github_token_list')
    expect(normalizeMcpToolName('create_issue', null)).toBe('create_issue')
  })

  it('带上下文判定只认非空文本(空串/纯空白/null 都算不带)', () => {
    expect(hasDisplayableContext('修复登录报错')).toBe(true)
    expect(hasDisplayableContext('   ')).toBe(false)
    expect(hasDisplayableContext(null)).toBe(false)
    expect(hasDisplayableContext(undefined)).toBe(false)
  })
})

describe('回落链逐级命中(台账明写:无定制时回落通用名)', () => {
  it('第 1 层:server × tool 定制优先于 server / tool 通用条目', () => {
    const hit = resolveMcpToolActivityKey({ serverName: 'github', toolName: 'create_issue' })
    expect(hit.level).toBe('server-tool')
    expect(hit.key).toBe('toolMcpGithubCreateIssueActivity')
    expect(hit.variant).toBe('base')
  })

  it('第 2 层:server 已登记但该 tool 未定制 ⇒ 该 server 的通用条目', () => {
    const hit = resolveMcpToolActivityKey({
      serverName: 'github',
      toolName: 'a_tool_we_never_written',
    })
    expect(hit.level).toBe('server')
    expect(hit.key).toBe('toolMcpServerGithubActivity')
  })

  it('第 3 层:server 未登记而 tool 已登记 ⇒ 该 tool 的跨 server 通用条目', () => {
    const hit = resolveMcpToolActivityKey({ serverName: 'jira', toolName: 'create_issue' })
    expect(hit.level).toBe('tool')
    expect(hit.key).toBe('toolMcpToolCreateIssueActivity')
    // 完全没有 serverName 时同层
    expect(resolveMcpToolActivityKey({ toolName: 'create_issue' }).key).toBe(
      'toolMcpToolCreateIssueActivity',
    )
  })

  it('第 4 层:三层都不认 ⇒ 回落既有「工具码名 → 通用名」一层(不是回落码名)', () => {
    const hit = resolveMcpToolActivityKey({ serverName: 'jira', toolName: 'web_search' })
    expect(hit.level).toBe('tool-name')
    expect(hit.key).toBe('toolWebSearch')
  })

  it('第 5 层:链尾显式返回原始码名,绝不返回 undefined', () => {
    const hit = resolveMcpToolActivityKey({
      serverName: 'jira',
      toolName: 'zzz_unknown_vendor_tool',
    })
    expect(hit.level).toBe('code-name')
    expect(hit.key).toBeNull()
    expect(hit.codeName).toBe('zzz_unknown_vendor_tool')
    expect(hit.server).toBe('jira')
    expect(hit.tool).toBe('zzz_unknown_vendor_tool')
  })

  it('同层档位回落:条目只配 base 时带上下文仍留在第 1 层,不掉到 server 档', () => {
    const hit = resolveMcpToolActivityKey({
      serverName: 'github',
      toolName: 'list_notifications',
      hasContext: true,
    })
    expect(hit.level).toBe('server-tool')
    expect(hit.variant).toBe('base')
    expect(hit.key).toBe('toolMcpGithubListNotificationsActivity')
  })

  it('第三层键:hasContext 决定取 …WithContextActivity 还是 …Activity', () => {
    const bare = resolveMcpToolActivityKey({ serverName: 'linear', toolName: 'search' })
    const ctx = resolveMcpToolActivityKey({
      serverName: 'linear',
      toolName: 'search',
      hasContext: true,
    })
    expect(bare.key).toBe('toolMcpLinearSearchActivity')
    expect(ctx.key).toBe('toolMcpLinearSearchWithContextActivity')
    expect(ctx.variant).toBe('withContext')
  })

  it('归一化不影响命中:同一 server 的三种写法落到同一级同一个键', () => {
    const forms = ['GitHub', 'github', 'git_hub'].map(
      (s) => resolveMcpToolActivityKey({ serverName: s, toolName: 'create_issue' }).key,
    )
    expect(forms[0]).toBe('toolMcpGithubCreateIssueActivity')
    // git_hub 与 github 是两个不同的 server 段 ⇒ 只有前两种写法命中同一键
    expect(forms.slice(0, 2)).toEqual([forms[0], forms[0]])
    expect(forms[2]).toBe('toolMcpToolCreateIssueActivity')
  })
})

describe('反向对照:注入一条定制键 ⇒ 必须不再走回落', () => {
  const toolName = 'create_release'

  it('未注入时该 pair 回落到 server 档(证明判据不是恒真)', () => {
    const before = resolveMcpToolActivityKey({ serverName: 'github', toolName })
    expect(before.level).toBe('server')
    expect(before.key).toBe('toolMcpServerGithubActivity')
  })

  it('注入定制条目后同一输入必须改判 server-tool,且键为注入值', () => {
    const injected: McpActivityTables = {
      serverTool: {
        ...EMPTY_MCP_ACTIVITY_TABLES.serverTool,
        github: { [toolName]: { base: 'toolMcpInjectedCreateReleaseActivity' } },
      },
      server: EMPTY_MCP_ACTIVITY_TABLES.server,
      tool: EMPTY_MCP_ACTIVITY_TABLES.tool,
    }
    const after = resolveMcpToolActivityKey({ serverName: 'github', toolName }, injected)
    expect(after.level).toBe('server-tool')
    expect(after.key).toBe('toolMcpInjectedCreateReleaseActivity')
  })

  it('整张表清空 ⇒ 已登记的 server×tool 也必须一路回落到链尾(只剩原始码名)', () => {
    const empty = resolveMcpToolActivityKey(
      { serverName: 'github', toolName: 'create_issue' },
      EMPTY_MCP_ACTIVITY_TABLES,
    )
    expect(empty.level).toBe('code-name')
    expect(empty.key).toBeNull()
    expect(empty.codeName).toBe('create_issue')
  })
})

describe('渲染位:命中的键在端内取不到值 ⇒ 继续走链,不把键名印到界面', () => {
  it('词表齐全时按命中级取到本地化措辞(五语言各自非空且不等于键名)', () => {
    for (const lang of LANGS) {
      const pack = loadTaskStatus(lang)
      const running = describeMcpToolActivity({
        serverName: 'github',
        toolName: 'create_issue',
        state: 'running',
        translate: translateFrom(pack),
      })
      const completed = describeMcpToolActivity({
        serverName: 'github',
        toolName: 'create_issue',
        state: 'completed',
        translate: translateFrom(pack),
      })
      expect(running).not.toBe('toolMcpGithubCreateIssueActivity')
      expect(running).not.toContain('{state, select')
      expect(running.trim()).not.toBe('')
      expect(completed.trim()).not.toBe('')
      expect(completed).not.toBe(running)
    }
  })

  it('带上下文时措辞里点出对象文本({name} 被真实替换)', () => {
    const pack = loadTaskStatus('zh-CN')
    const text = describeMcpToolActivity({
      serverName: 'github',
      toolName: 'create_issue',
      state: 'running',
      context: '修复登录报错',
      translate: translateFrom(pack),
    })
    expect(text).toContain('修复登录报错')
    expect(text).not.toContain('{name}')
  })

  it('server 档:未知 server 但 tool 命中功能名层 ⇒ 交回既有链(不出键名、不出码名以外的假陈述)', () => {
    const pack = loadTaskStatus('zh-CN')
    const text = describeMcpToolActivity({
      serverName: 'jira',
      toolName: 'web_search',
      state: 'completed',
      translate: translateFrom(pack),
    })
    expect(text).not.toContain('toolWebSearch')
    expect(text).not.toContain('{')
  })

  it('链尾:三层无定制且功能名层也不认 ⇒ 只能显示原始码名(既有链的最后一档)', () => {
    const pack = loadTaskStatus('zh-CN')
    const text = describeMcpToolActivity({
      serverName: 'jira',
      toolName: 'zzz_unknown_vendor_tool',
      state: 'running',
      translate: translateFrom(pack),
    })
    expect(text).toBe('zzz_unknown_vendor_tool')
  })

  it('取词全部落空(语言包一个键都没有)⇒ 仍然只出原始码名,不出键名', () => {
    const text = describeMcpToolActivity({
      serverName: 'github',
      toolName: 'create_issue',
      state: 'running',
      context: '标题',
      translate: (key) => key,
    })
    expect(text).toBe('create_issue')
  })
})

describe('登记表与语言包同票(缺一个语言的键即红)', () => {
  it('已登记键在 5 语言 shared taskStatus 全部有值、形状是 state select、不等于键名', () => {
    const keys = mcpToolActivityKeyList()
    expect(keys.length).toBeGreaterThanOrEqual(29)
    for (const lang of LANGS) {
      const pack = loadTaskStatus(lang)
      for (const key of keys) {
        const value = pack[key]
        expect(value, `${lang}.${key} 缺值`).toBeTypeOf('string')
        expect(value).not.toBe(key)
        expect(value).toMatch(/^\{\s*state,\s*select,/)
        expect(value).toMatch(/other\s*\{/)
      }
    }
  })

  it('withContext 档必须带 {name} 占位,否则上下文层等于白写', () => {
    const pack = loadTaskStatus('zh-CN')
    const ctxKeys = keysWithContext()
    expect(ctxKeys.length).toBeGreaterThan(0)
    for (const key of ctxKeys) expect(pack[key]).toContain('{name}')
  })
})

/** 从登记表取出的 withContext 档键名(按命名法筛,不复制措辞) */
function keysWithContext(): string[] {
  return mcpToolActivityKeyList().filter((key) => key.includes('WithContext'))
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
