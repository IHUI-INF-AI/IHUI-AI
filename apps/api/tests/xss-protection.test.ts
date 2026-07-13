import { describe, it, expect, afterAll, beforeAll } from 'vitest'
import Fastify from 'fastify'
import xssProtectionPlugin from '../src/plugins/xss-protection.js'

describe('xss-protection — server.sanitizeInput', () => {
  const server = Fastify({ logger: false })

  beforeAll(async () => {
    await server.register(xssProtectionPlugin)
    await server.ready()
  })

  afterAll(async () => {
    await server.close()
  })

  it('注册插件后 server.sanitizeInput 可用', () => {
    expect(typeof server.sanitizeInput).toBe('function')
  })

  it('HTML 特殊字符实体编码', () => {
    const out = server.sanitizeInput('<div>hello & "world"</div>') as string
    expect(out).toContain('&lt;div&gt;')
    expect(out).toContain('&amp;')
    expect(out).toContain('&quot;')
    expect(out).not.toContain('<div>')
  })

  it('剥离 <script> 标签', () => {
    const out = server.sanitizeInput('<script>alert(1)</script>') as string
    expect(out.toLowerCase()).not.toContain('<script')
    expect(out.toLowerCase()).not.toContain('</script')
  })

  it('剥离 </script> 闭合标签', () => {
    const out = server.sanitizeInput('foo</script>bar') as string
    expect(out).not.toContain('</script>')
    expect(out).toContain('&lt;/script&gt;')
  })

  it('剥离内联事件处理器（onclick/onload 等）', () => {
    const out = server.sanitizeInput('<img onclick="evil()">') as string
    expect(out.toLowerCase()).not.toContain('onclick')
  })

  it('剥离 javascript: 协议', () => {
    const out = server.sanitizeInput('<a href="javascript:alert(1)">x</a>') as string
    expect(out.toLowerCase()).not.toContain('javascript:')
  })

  it('剥离 vbscript: 协议', () => {
    const out = server.sanitizeInput('<a href="vbscript:msgbox(1)">x</a>') as string
    expect(out.toLowerCase()).not.toContain('vbscript:')
  })

  it('剥离 data:text/html URI', () => {
    const out = server.sanitizeInput('<iframe src="data:text/html,<script>">') as string
    expect(out.toLowerCase()).not.toContain('data:text/html')
  })

  it('剥离 <iframe> / <object> / <embed>', () => {
    expect((server.sanitizeInput('<iframe src="evil">') as string).toLowerCase()).not.toContain(
      'iframe',
    )
    expect((server.sanitizeInput('<object data="evil">') as string).toLowerCase()).not.toContain(
      'object',
    )
    expect((server.sanitizeInput('<embed src="evil">') as string).toLowerCase()).not.toContain(
      'embed',
    )
  })

  it('剥离 expression() CSS 表达式', () => {
    const out = server.sanitizeInput('width: expression(alert(1))') as string
    expect(out.toLowerCase()).not.toContain('expression')
  })

  it('递归处理对象', () => {
    const data = {
      name: '<script>x</script>',
      profile: { bio: '<img onload="evil">' },
    }
    const out = server.sanitizeInput(data) as { name: string; profile: { bio: string } }
    expect(out.name.toLowerCase()).not.toContain('script')
    expect(out.profile.bio.toLowerCase()).not.toContain('onload')
  })

  it('递归处理数组', () => {
    const arr = ['<script>a</script>', '<img onload="x">', 'normal']
    const out = server.sanitizeInput(arr) as string[]
    expect(out[0]!.toLowerCase()).not.toContain('script')
    expect(out[1]!.toLowerCase()).not.toContain('onload')
    expect(out[2]).toBe('normal')
  })

  it('非字符串/对象/数组原样返回', () => {
    expect(server.sanitizeInput(42)).toBe(42)
    expect(server.sanitizeInput(null)).toBe(null)
    expect(server.sanitizeInput(true)).toBe(true)
  })

  it('原对象不被修改', () => {
    const data = { name: '<script>x</script>' }
    server.sanitizeInput(data)
    expect(data.name).toBe('<script>x</script>')
  })

  it('普通文本不被改变（除 & < > " 会被实体化）', () => {
    expect(server.sanitizeInput('hello world')).toBe('hello world')
    expect(server.sanitizeInput('中文')).toBe('中文')
  })
})

describe('xss-protection — onSend 安全响应头', () => {
  const server = Fastify({ logger: false })

  beforeAll(async () => {
    await server.register(xssProtectionPlugin)
    server.get('/test', async (_req, reply) => reply.send({ ok: true }))
    await server.ready()
  })

  afterAll(async () => {
    await server.close()
  })

  it('注入 X-XSS-Protection 头', async () => {
    const res = await server.inject({ method: 'GET', url: '/test' })
    expect(res.headers['x-xss-protection']).toBe('1; mode=block')
  })

  it('注入 X-Content-Type-Options 头', async () => {
    const res = await server.inject({ method: 'GET', url: '/test' })
    expect(res.headers['x-content-type-options']).toBe('nosniff')
  })

  it('注入 X-Frame-Options 头', async () => {
    const res = await server.inject({ method: 'GET', url: '/test' })
    expect(res.headers['x-frame-options']).toBe('SAMEORIGIN')
  })

  it('注入 Referrer-Policy 头', async () => {
    const res = await server.inject({ method: 'GET', url: '/test' })
    expect(res.headers['referrer-policy']).toBe('strict-origin-when-cross-origin')
  })
})
