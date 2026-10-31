// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 根 logger 落盘前必须打码凭据(2026-11-01 安全强化)。
 *
 * 这型缺陷的成因不是"某处写错",而是**闸装错了层**:`plugins/log-sanitizer.ts` 的
 * Proxy 在 onRequest 钩子里只包 `request.log`,而全仓 169 个 `import { logger }` 的
 * 模块级日志结构上不经它。file-transfer.ts 里那句
 * `logger.info('[file-transfer] downloading: ' + url)`(url 带 `?token=`)就是活的例子。
 *
 * 所以每条"没漏"的断言都配一条"绕开闸就会漏"的反向牙口:少了后者,任何一次
 * "闸其实没装在这条链上"都会静默变成假绿 —— 而那正是本枚要根治的失效型。
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { logger, setFastify, type FastifyLogInstance } from '../src/utils/logger.js'
import { redactCredentialText } from '../src/utils/redact-credential-text.js'

const TOKEN_URL = 'https://cdn.example.com/a.mp4?token=eyJhbGciOiJIUzI1.abcdef.REALsig'
const ETHERSCAN_URL = 'https://api.etherscan.io/api?a=1&apikey=AbCdEf1234567890xyz'

interface Captured {
  meta: unknown
  msg: string
}

function capturingSink(): { sink: Captured[]; instance: FastifyLogInstance } {
  const sink: Captured[] = []
  const push = (meta: unknown, msg: string) => {
    sink.push({ meta, msg })
  }
  const instance = {
    log: {
      debug: (m: unknown, msg: string) => push(m, msg),
      info: (m: unknown, msg: string) => push(m, msg),
      warn: (m: unknown, msg: string) => push(m, msg),
      error: (m: unknown, msg: string) => push(m, msg),
    },
  } as unknown as FastifyLogInstance
  return { sink, instance }
}

afterEach(() => {
  // fastifyInstance 是模块级状态:不还原会把捕获器泄漏给后面的测试文件
  setFastify(null as unknown as FastifyLogInstance)
})

describe('根 logger 的凭据脱敏闸', () => {
  it('消息里的带 token 链接不落盘明文', () => {
    const { sink, instance } = capturingSink()
    setFastify(instance)
    logger.info(`[file-transfer] downloading: ${TOKEN_URL}`)
    expect(sink).toHaveLength(1)
    expect(sink[0]?.msg).not.toContain('eyJhbGciOiJIUzI1')
    expect(sink[0]?.msg).toContain('***REDACTED***')
  })

  it('第三方只能放查询串的 apikey 同样不落盘', () => {
    const { sink, instance } = capturingSink()
    setFastify(instance)
    logger.info(`upstream GET ${ETHERSCAN_URL}`)
    expect(sink[0]?.msg).not.toContain('AbCdEf1234567890xyz')
  })

  it('meta 里的字符串叶子也被盖住', () => {
    const { sink, instance } = capturingSink()
    setFastify(instance)
    logger.warn('retry scheduled', { url: TOKEN_URL, attempt: 2 } as object)
    const meta = sink[0]?.meta as { url?: string; attempt?: number }
    expect(meta.url).not.toContain('eyJhbGciOiJIUzI1')
    expect(meta.attempt).toBe(2)
  })

  it('反向牙口:绕开本 logger 直接落 pino,同一个串必须**真的**带明文', () => {
    const { sink, instance } = capturingSink()
    setFastify(instance)
    instance.log.info({}, `[file-transfer] downloading: ${TOKEN_URL}`)
    expect(sink[0]?.msg).toContain('eyJhbGciOiJIUzI1')
    expect(sink).toHaveLength(1)
  })

  it('无凭据的行逐字节不变(闸不得改写出错信息本身)', () => {
    const { sink, instance } = capturingSink()
    setFastify(instance)
    logger.info('user 42 saved ok')
    expect(sink[0]?.msg).toBe('user 42 saved ok')
  })

  it('err 键仍是 Error 实例:pino 的标准错误序列化不能被打码走形', () => {
    const { sink, instance } = capturingSink()
    setFastify(instance)
    const err = new Error('upstream 502')
    logger.error('download failed', { err } as object)
    const meta = sink[0]?.meta as { err?: unknown }
    expect(meta.err).toBe(err)
    expect(meta.err).toBeInstanceOf(Error)
  })

  it('console 回退档(未注入 fastify)同样过闸', () => {
    setFastify(null as unknown as FastifyLogInstance)
    const lines: string[] = []
    const original = console.info
    console.info = (...args: unknown[]) => {
      lines.push(args.map((a) => String(a)).join(' '))
    }
    try {
      logger.info(`download ${TOKEN_URL}`)
    } finally {
      console.info = original
    }
    expect(lines.join('\n')).not.toContain('eyJhbGciOiJIUzI1')
    expect(lines).toHaveLength(1)
  })
})

describe('接线与单一真相源', () => {
  const src = (rel: string) =>
    readFileSync(fileURLToPath(new URL(`../src/${rel}`, import.meta.url)), 'utf8')

  it('logger.ts 自己调那两道出口(而不是只躺着导入了)', () => {
    const text = src('utils/logger.ts')
    expect(text).toContain('redactCredentialText(msg)')
    expect(text).toContain('redactCredentialStrings(meta)')
  })

  it('打码实现全仓只有一份函数体(§0.6)', () => {
    // 叶子模块:一处定义。log-sanitizer:只许 re-export,不许再有第二处
    // `export function redactCredentialText` —— 那正是本枚消掉的形状。
    expect(src('utils/redact-credential-text.ts')).toContain('export function redactCredentialText')
    expect(src('plugins/log-sanitizer.ts')).not.toContain('export function redactCredentialText')
    expect(src('plugins/log-sanitizer.ts')).not.toMatch(/function redactCredentialStrings/)
  })

  it('导入链无环(叶子模块不引任何本仓上层)', () => {
    const leaf = src('utils/redact-credential-text.ts')
    const localImports = [...leaf.matchAll(/from\s+'(\.[^']+)'/g)].map((m) => m[1] as string)
    expect(localImports).toEqual([])
  })

  it('出口本身对三类形态都有效(不靠 logger 侧兜圈)', () => {
    expect(redactCredentialText(TOKEN_URL)).not.toContain('eyJhbGciOiJIUzI1')
    expect(redactCredentialText(ETHERSCAN_URL)).not.toContain('AbCdEf1234567890xyz')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
