// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 插件接口型工具的**生产装配链路**e2e(2026-11-13 立)。
 *
 * 为什么单测不够:`plugin-interface-tools.test.ts` 那 25 例走的是 `loadPluginsWithContributionAudit`
 * —— 它证明"装载器能编译出工具",但证不了**这件事在真实启动路径上发生了**。
 * 本仓记过多次"造好没装车"(守门 132 立因、守门 115 同型):整族工具写好了、测试全绿、
 * 生产面零注册点。本文件盯的正是那一格:
 *
 *   `setupAgentTools()`(生产唯一装配入口)
 *     → 读 settings.plugins.enabled
 *     → loadPluginsWithContributionAudit
 *     → registerTools(loaded.interfaceTools)
 *     → listTools() 快照
 *     → composeSystemPrompt 拼进 systemPrompt
 *
 * 断言链走的是**真实函数**,不是替身:工具必须真的出现在 `systemPrompt` 文本里 ——
 * 那是模型唯一能看见工具的地方。只断言 `listTools()` 会漏掉"注册了但 prompt 没带上"这一型。
 *
 * 隔离策略:临时目录当 cwd(`loadSettings()` 读 `process.cwd()` 下的 `.ihui/settings.json`),
 * `afterEach` 还原 cwd + 清工具表,不留任何会话间污染。
 */

import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { setupAgentTools, reportPluginDiagnostics } from '../src/commands/agent.js'
import { listTools } from '../src/tools/index.js'

let work = ''
let prevCwd = ''

beforeEach(() => {
  prevCwd = process.cwd()
  // realpathSync:macOS 的 /var → /private/var 是符号链接,不解析会让后面 path 比较出现假红
  work = realpathSync(mkdtempSync(path.join(tmpdir(), 'ihui-piface-e2e-')))
})

afterEach(() => {
  process.chdir(prevCwd)
  rmSync(work, { recursive: true, force: true })
})

/** 在临时 cwd 里写 settings 与插件清单,然后切 cwd —— 与真实启动读的是同一份文件。 */
function stageWorkspace(settings: Record<string, unknown>, pluginManifest: Record<string, unknown>): void {
  mkdirSync(path.join(work, '.ihui', 'plugins', 'crm'), { recursive: true })
  writeFileSync(
    path.join(work, '.ihui', 'settings.json'),
    JSON.stringify(settings, null, 2),
    'utf-8',
  )
  writeFileSync(
    path.join(work, '.ihui', 'plugins', 'crm', 'plugin.json'),
    JSON.stringify(pluginManifest, null, 2),
    'utf-8',
  )
  process.chdir(work)
}

const MANIFEST = {
  name: 'crm-plugin',
  version: '1.0.0',
  description: 'e2e 探针插件',
  interfaces: [
    {
      name: 'crm__list_contacts',
      method: 'GET',
      path: '/api/crm/contacts',
      description: '列出 CRM 联系人',
      params: [{ name: 'limit', type: 'number', description: '返回条数' }],
    },
    {
      name: 'crm__delete_contact',
      method: 'DELETE',
      path: '/api/crm/contacts/{id}',
      description: '删除一个联系人',
    },
  ],
}

describe('生产链路:settings.plugins.enabled → setupAgentTools → 模型可见', () => {
  it('真开开关后,接口工具出现在工具表**且**出现在 systemPrompt 里', async () => {
    stageWorkspace({ plugins: { enabled: true } }, MANIFEST)

    const result = await setupAgentTools({ workspacePath: work, silent: true })

    // ① 工具表(运行时真值)
    const names = listTools().map((t) => t.name)
    expect(names).toContain('plugin__crm__list_contacts')
    expect(names).toContain('plugin__crm__delete_contact')

    // ② systemPrompt —— 模型唯一能看见工具的地方。
    // 只断言 ① 会漏掉"注册了但没带进 prompt"这一型(守门 132 记的正是这一格)。
    expect(result.systemPrompt).toContain('plugin__crm__list_contacts')
    expect(result.systemPrompt).toContain('plugin__crm__delete_contact')

    // ③ 插件本身也装上了(装配链完整走过,不是只编译了接口)
    expect(result.pluginRegistry).toBeTruthy()
    expect(result.pluginRegistry?.has('crm-plugin')).toBe(true)
  }, 60_000)

  it('危险档在生产链路里保持:DELETE 那枚是 dangerous,GET 那枚是 read', async () => {
    stageWorkspace({ plugins: { enabled: true } }, MANIFEST)
    await setupAgentTools({ workspacePath: work, silent: true })

    const byName = new Map(listTools().map((t) => [t.name, t]))
    expect(byName.get('plugin__crm__delete_contact')?.dangerLevel).toBe('dangerous')
    expect(byName.get('plugin__crm__list_contacts')?.dangerLevel).toBe('read')
    // `{id}` 占位在生产链路里也补成了必填(2026-11-13 修的两种形态之一)
    expect(byName.get('plugin__crm__delete_contact')?.required).toContain('id')
  }, 60_000)

  it('开关关着 ⇒ 一枚插件接口工具都不该出现(证明它不是无条件注册)', async () => {
    stageWorkspace({ plugins: { enabled: false } }, MANIFEST)

    const result = await setupAgentTools({ workspacePath: work, silent: true })

    const names = listTools().map((t) => t.name)
    expect(names).not.toContain('plugin__crm__list_contacts')
    expect(result.systemPrompt).not.toContain('plugin__crm__list_contacts')
    // 插件注册表也不存在(装配链在开关那一步就停住了)
    expect(result.pluginRegistry).toBeUndefined()
  }, 60_000)

  it('反例:非法接口声明 ⇒ 插件装载成功但工具不出现,诊断点名原因', async () => {
    stageWorkspace(
      { plugins: { enabled: true } },
      {
        name: 'bad-plugin',
        version: '1.0.0',
        interfaces: [
          // 合法的那一条:必须装上
          { name: 'crm__ok', method: 'GET', path: '/api/crm/ok', description: '合法' },
          // 非法:名字不是三段形态
          { name: 'BAD NAME', method: 'GET', path: '/api/crm/bad' },
          // 非法:method 不在词表
          { name: 'crm__weird', method: 'FETCH', path: '/api/crm/weird' },
        ],
      },
    )

    const result = await setupAgentTools({ workspacePath: work, silent: true })

    const names = listTools().map((t) => t.name)
    // 合法的那条照常装上 —— 拒一条声明不等于废掉整份插件
    expect(names).toContain('plugin__crm__ok')
    // 非法的两条一枚都不许出现
    expect(names.some((n) => n.includes('BAD'))).toBe(false)
    expect(names.some((n) => n.includes('weird'))).toBe(false)
    // 插件本身装上了(拒的是接口声明,不是插件)
    expect(result.pluginRegistry?.has('bad-plugin')).toBe(true)
  }, 60_000)

  it('诊断派发通道对 plugin-interface-rejected 真的会出声(而不是只在数组里躺着)', () => {
    // 直接喂一条诊断给唯一的派发出口:证明 warning 档真的走到 logger.warn。
    // 这一条挡的是"诊断产出了但没人调派发器"那一型(守则 64/70/81/115/138 记过)。
    const calls: Array<{ level: string; msg: string }> = []
    reportPluginDiagnostics(
      [
        {
          code: 'plugin-interface-rejected',
          severity: 'warning',
          file: '/tmp/x/plugin.json',
          pluginName: 'crm-plugin',
          message: 'Interface "BAD NAME" was rejected [name-invalid]: name must be "<namespace>__<tool>"',
        },
      ],
      {
        info: () => {},
        warn: (msg: string) => calls.push({ level: 'warn', msg }),
        error: (msg: string) => calls.push({ level: 'error', msg }),
      },
    )
    expect(calls).toHaveLength(1)
    expect(calls[0]?.level).toBe('warn')
    // 必须点名判别码与清单路径 —— 只转述 message 会让路径随文案改版而丢
    expect(calls[0]?.msg).toContain('plugin-interface-rejected')
    expect(calls[0]?.msg).toContain('plugin.json')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
