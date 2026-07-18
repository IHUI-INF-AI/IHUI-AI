/**
 * Crew 工具集实现
 *
 * 为 Crew executor 角色提供真实可调用的工具。
 * 每个工具遵循 OpenAI function calling 格式定义 + 对应 handler。
 *
 * 工具清单:
 * 1. llm_generate      — 二次 LLM 调用(子任务)
 * 2. web_search        — DuckDuckGo HTML 搜索(无 key)
 * 3. browser_fetch     — 抓取网页内容(HTML→text)
 * 4. code_execute      — Node.js 代码执行(沙箱 vm)
 * 5. terminal_run      — Shell 命令执行(白名单)
 * 6. knowledge_search  — RAG 知识库检索
 */
import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import vm from 'node:vm'
import { logger } from './clawdbot/logger.js'
import { callRealLlm } from './crew-llm-adapter.js'
import { knowledgeRagService } from './knowledge-rag-service.js'
import type { ToolDefinition, ToolHandler, ToolContext } from './clawdbot/tools.js'

const execAsync = promisify(exec)

/** OpenAI function calling 格式的 tool 定义 */
export interface OpenAIToolDef {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: {
      type: 'object'
      properties: Record<string, unknown>
      required?: string[]
    }
  }
}

interface CrewTool {
  def: OpenAIToolDef
  handler: ToolHandler
}

/** 终端命令白名单(安全限制) */
const TERMINAL_WHITELIST = [
  'ls',
  'dir',
  'pwd',
  'echo',
  'cat',
  'head',
  'tail',
  'wc',
  'find',
  'grep',
  'git status',
  'git log',
  'git diff',
  'git branch',
  'git show',
  'node --version',
  'npm --version',
  'pnpm --version',
  'tasklist',
  'systeminfo',
]

/** 工具集定义 */
export const CREW_TOOLS: CrewTool[] = [
  // 1. LLM 二次调用
  {
    def: {
      type: 'function',
      function: {
        name: 'llm_generate',
        description:
          '调用 LLM 生成文本(用于子任务、文本润色、翻译、总结等)。当需要基于上下文生成自然语言内容时使用。',
        parameters: {
          type: 'object',
          properties: {
            prompt: { type: 'string', description: '给 LLM 的提示词' },
            system: { type: 'string', description: '可选的 system prompt' },
          },
          required: ['prompt'],
        },
      },
    },
    handler: async (params) => {
      const prompt = String(params.prompt ?? '')
      const system = params.system ? String(params.system) : undefined
      const messages = system
        ? [
            { role: 'system' as const, content: system },
            { role: 'user' as const, content: prompt },
          ]
        : [{ role: 'user' as const, content: prompt }]
      const result = await callRealLlm({ messages })
      return {
        success: true,
        output: result.content,
        metadata: { model: result.modelUsed, tokens: result.usage.totalTokens },
        duration: 0,
      }
    },
  },
  // 2. Web 搜索
  {
    def: {
      type: 'function',
      function: {
        name: 'web_search',
        description: '使用 DuckDuckGo 搜索关键词,返回前 8 条结果(标题+摘要+链接)。无需 API key。',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: '搜索关键词' },
          },
          required: ['query'],
        },
      },
    },
    handler: async (params) => {
      const query = String(params.query ?? '')
      const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`
      const resp = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        signal: AbortSignal.timeout(15000),
      })
      if (!resp.ok) return { success: false, error: `HTTP ${resp.status}`, duration: 0 }
      const html = await resp.text()
      // 解析 DuckDuckGo HTML 结果(简化:正则提取标题+链接+摘要)
      const results: Array<{ title: string; url: string; snippet: string }> = []
      const itemRegex =
        /<a[^>]+class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g
      let match: RegExpExecArray | null
      let count = 0
      while ((match = itemRegex.exec(html)) !== null && count < 8) {
        const linkUrl = (match[1] || '').replace(/&amp;/g, '&')
        const uddg = linkUrl.match(/uddg=([^&]+)/)
        const realUrl = uddg && uddg[1] ? decodeURIComponent(uddg[1]) : linkUrl
        const title = (match[2] || '').replace(/<[^>]+>/g, '').trim()
        const snippet = (match[3] || '').replace(/<[^>]+>/g, '').trim()
        results.push({ title, url: realUrl, snippet })
        count++
      }
      return {
        success: true,
        output: results,
        metadata: { count: results.length, query },
        duration: 0,
      }
    },
  },
  // 3. 网页抓取
  {
    def: {
      type: 'function',
      function: {
        name: 'browser_fetch',
        description: '抓取指定 URL 的网页内容,返回纯文本(HTML 标签已剥离)。用于获取网页详细信息。',
        parameters: {
          type: 'object',
          properties: {
            url: { type: 'string', description: '要抓取的 URL' },
            max_length: { type: 'number', description: '返回文本最大长度(字符),默认 5000' },
          },
          required: ['url'],
        },
      },
    },
    handler: async (params) => {
      const url = String(params.url ?? '')
      const maxLen = Number(params.max_length ?? 5000)
      const resp = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        signal: AbortSignal.timeout(20000),
      })
      if (!resp.ok) return { success: false, error: `HTTP ${resp.status}`, duration: 0 }
      const html = await resp.text()
      // 剥离 script/style/标签
      const text = html
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
      return {
        success: true,
        output: text.slice(0, maxLen),
        metadata: { url, length: text.length },
        duration: 0,
      }
    },
  },
  // 4. 代码执行(Node.js vm 沙箱)
  {
    def: {
      type: 'function',
      function: {
        name: 'code_execute',
        description:
          '在 Node.js vm 沙箱中执行 JavaScript 代码,返回 console.log 输出。可用于计算、数据处理、算法验证。',
        parameters: {
          type: 'object',
          properties: {
            code: { type: 'string', description: '要执行的 JavaScript 代码' },
          },
          required: ['code'],
        },
      },
    },
    handler: async (params) => {
      const code = String(params.code ?? '')
      const logs: string[] = []
      const sandbox = {
        console: {
          log: (...args: unknown[]) =>
            logs.push(
              args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' '),
            ),
          error: (...args: unknown[]) =>
            logs.push(
              '[ERROR] ' +
                args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' '),
            ),
        },
        JSON,
        Math,
        Date,
        Array,
        Object,
        String,
        Number,
        Boolean,
      }
      try {
        const ctx = vm.createContext(sandbox)
        vm.runInContext(code, ctx, { timeout: 5000 })
        return {
          success: true,
          output: logs.join('\n') || '(无输出)',
          metadata: { lines: logs.length },
          duration: 0,
        }
      } catch (e) {
        return { success: false, error: e instanceof Error ? e.message : String(e), duration: 0 }
      }
    },
  },
  // 5. 终端命令(白名单)
  {
    def: {
      type: 'function',
      function: {
        name: 'terminal_run',
        description:
          '执行白名单内的终端命令(ls/pwd/cat/grep/git status 等)。返回 stdout。注意:仅安全命令可用。',
        parameters: {
          type: 'object',
          properties: {
            command: { type: 'string', description: '要执行的命令(必须在白名单内)' },
          },
          required: ['command'],
        },
      },
    },
    handler: async (params) => {
      const cmd = String(params.command ?? '').trim()
      const isAllowed = TERMINAL_WHITELIST.some((w) => cmd === w || cmd.startsWith(w + ' '))
      if (!isAllowed) {
        return {
          success: false,
          error: `命令不在白名单内: ${cmd.slice(0, 50)}。允许: ${TERMINAL_WHITELIST.join(', ')}`,
          duration: 0,
        }
      }
      try {
        const { stdout, stderr } = await execAsync(cmd, { timeout: 10000, maxBuffer: 1024 * 1024 })
        const output = stdout + (stderr ? `\n[stderr]\n${stderr}` : '')
        return { success: true, output: output.slice(0, 8000), metadata: { cmd }, duration: 0 }
      } catch (e) {
        return { success: false, error: e instanceof Error ? e.message : String(e), duration: 0 }
      }
    },
  },
  // 6. 知识库检索
  {
    def: {
      type: 'function',
      function: {
        name: 'knowledge_search',
        description:
          '从 RAG 知识库检索与查询相关的文档片段。当需要项目领域知识、历史文档、规范说明时使用。',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: '检索查询' },
            top_k: { type: 'number', description: '返回结果数,默认 3' },
          },
          required: ['query'],
        },
      },
    },
    handler: async (params) => {
      const query = String(params.query ?? '')
      const topK = Number(params.top_k ?? 3)
      try {
        const results = await knowledgeRagService.search({
          query,
          topK,
          // 不限定 owner,检索全局知识库(含 system 种子文档)
          ownerUuid: '',
        })
        return {
          success: true,
          output: results.map((r) => ({
            content: r.content,
            score: r.score,
            docId: r.docId,
            chunkIndex: r.chunkIndex,
          })),
          metadata: { count: results.length, query },
          duration: 0,
        }
      } catch (e) {
        return { success: false, error: e instanceof Error ? e.message : String(e), duration: 0 }
      }
    },
  },
]

/** 获取所有工具的 OpenAI 定义 */
export function getCrewToolDefinitions(): OpenAIToolDef[] {
  return CREW_TOOLS.map((t) => t.def)
}

/** 按名称执行工具 */
export async function executeCrewTool(
  name: string,
  args: Record<string, unknown>,
  context?: ToolContext,
): Promise<{ success: boolean; output?: unknown; error?: string }> {
  const tool = CREW_TOOLS.find((t) => t.def.function.name === name)
  if (!tool) {
    return { success: false, error: `工具 "${name}" 不存在` }
  }
  logger.info({ tool: name, args: Object.keys(args) }, '[CrewTools] 执行工具')
  const start = Date.now()
  try {
    const result = await tool.handler(args, context)
    return {
      success: result.success,
      output: result.output,
      error: result.error,
    }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : String(e) }
  } finally {
    logger.info({ tool: name, elapsed: Date.now() - start }, '[CrewTools] 完成')
  }
}

/** 向 ToolExecutor 注册所有 Crew 工具(用于 /api/crew/tools 端点展示) */
export function registerCrewTools(
  register: (def: ToolDefinition, handler: ToolHandler) => void,
): void {
  for (const t of CREW_TOOLS) {
    const params: Record<string, { type: string; required?: boolean; description?: string }> = {}
    const props = t.def.function.parameters.properties as Record<
      string,
      { type: string; description?: string }
    >
    const required = t.def.function.parameters.required ?? []
    for (const [k, v] of Object.entries(props)) {
      params[k] = { type: v.type, description: v.description, required: required.includes(k) }
    }
    register(
      {
        name: t.def.function.name,
        description: t.def.function.description,
        category: 'crew',
        parameters: params,
        enabled: true,
      },
      t.handler,
    )
  }
}
