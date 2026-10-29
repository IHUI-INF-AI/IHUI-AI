// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join, relative } from 'node:path'
import Fastify, { type FastifyInstance } from 'fastify'

/**
 * 根作用域一旦替换 application/json(server.ts registerPlugins),子作用域继承到的就是那份**自定义**
 * parser,而 Fastify 5 对同名重复注册直接抛 FST_ERR_CTP_ALREADY_PRESENT ⇒ 整进程启动即崩
 * (2026-10-28 实测:dev-stack api 反复重启失败,崩溃点 routes/live.ts:305)。
 * ① 真实例上证明"先 remove 再 add"是这条约束的唯一出路(正反对照);
 * ② 按文件现读扫描 apps/api/src,任何 add 都必须紧跟同作用域的 remove。
 */

const SRC_ROOT = fileURLToPath(new URL('../src', import.meta.url))

function walkTs(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    const st = statSync(full)
    if (st.isDirectory()) {
      if (name === 'dist' || name === 'node_modules' || name === 'tests' || name === '__tests__')
        continue
      out.push(...walkTs(full))
    } else if (name.endsWith('.ts') && !name.endsWith('.test.ts')) {
      out.push(full)
    }
  }
  return out
}

type JsonAdd = { file: string; line: number; receiver: string }

/** 找出所有以 application/json 为首参的 addContentTypeParser 调用(单行与展开两形态) */
export function findJsonParserAdds(files: string[]): JsonAdd[] {
  const hits: JsonAdd[] = []
  for (const file of files) {
    const lines = readFileSync(file, 'utf8').split(/\r?\n/)
    lines.forEach((line, idx) => {
      const open = /(\w+)\.addContentTypeParser\(\s*$/.exec(line)
      if (open) {
        const next = (lines[idx + 1] ?? '').trim()
        if (next === `'application/json',` || next === `"application/json",`) {
          hits.push({ file, line: idx + 1, receiver: open[1]! })
        }
        return
      }
      const oneLine = /(\w+)\.addContentTypeParser\(\s*['"]application\/json['"]/.exec(line)
      if (oneLine) hits.push({ file, line: idx + 1, receiver: oneLine[1]! })
    })
  }
  return hits
}

/** 越过注释与空行,要求紧邻的上一条语句就是 `${receiver}.removeContentTypeParser('application/json')` */
export function hasRemoveBefore(file: string, line: number, receiver: string): boolean {
  const lines = readFileSync(file, 'utf8').split(/\r?\n/)
  for (let i = line - 2; i >= 0; i--) {
    const text = lines[i]!.trim()
    if (text === '' || text.startsWith('//') || text.startsWith('/*') || text.startsWith('*'))
      continue
    return new RegExp(
      `^${receiver}\\.removeContentTypeParser\\(\\s*['"]application/json['"]\\s*\\)\\s*;?$`,
    ).test(text)
  }
  return false
}

describe('子作用域覆盖 application/json 必须先 remove(否则启动即崩)', () => {
  const adds = findJsonParserAdds(walkTs(SRC_ROOT))

  it('扫描面真的命中了 json 注册点(枚举到 0 算未判定,不记绿)', () => {
    expect(adds.length).toBeGreaterThanOrEqual(8)
  })

  it('每一处 add 都由同作用域的 remove 打头 —— 缺一条就是启动崩溃', () => {
    const naked = adds.filter((a) => !hasRemoveBefore(a.file, a.line, a.receiver))
    expect(naked.map((a) => `${relative(SRC_ROOT, a.file)}:${a.line} ${a.receiver}`)).toEqual([])
  })

  it('根作用域自己也先 remove 再 add(它是这条约束的来源)', () => {
    const root = adds.find((a) => a.file === join(SRC_ROOT, 'server.ts'))
    expect(root).toBeDefined()
    expect(root && hasRemoveBefore(root.file, root.line, root.receiver)).toBe(true)
  })
})

describe('真 Fastify 实例上的正反对照', () => {
  async function rootWithJsonOverride(): Promise<FastifyInstance> {
    const app = Fastify({ logger: false })
    app.removeContentTypeParser('application/json')
    app.addContentTypeParser('application/json', { parseAs: 'string' }, (_req, body, done) => {
      const raw = typeof body === 'string' ? body : ''
      done(null, raw.trim() === '' ? {} : (JSON.parse(raw) as unknown))
    })
    return app
  }

  it('子作用域只 add 不 remove ⇒ ready 抛 already present(今天崩的形态)', async () => {
    const app = await rootWithJsonOverride()
    app.register(async (scope) => {
      scope.addContentTypeParser('application/json', { parseAs: 'string' }, (_r, body, done) =>
        done(null, body),
      )
    })
    await expect(app.ready()).rejects.toThrow(/already present/i)
    await app.close()
  })

  it('先 remove 再 add ⇒ 起得来;子作用域收原始串;根作用域那份不受影响', async () => {
    const app = await rootWithJsonOverride()
    app.register(async (scope) => {
      scope.removeContentTypeParser('application/json')
      scope.addContentTypeParser('application/json', { parseAs: 'string' }, (_r, body, done) =>
        done(null, body),
      )
      scope.post('/child', (req, reply) => reply.send({ echoed: req.body }))
    })
    app.post('/root', (req, reply) => reply.send({ body: req.body }))
    await app.ready()

    const child = await app.inject({
      method: 'POST',
      url: '/child',
      headers: { 'content-type': 'application/json' },
      body: '{"a":1}',
    })
    expect(child.json().echoed).toBe('{"a":1}')

    // 空 body 仍走根作用域自定义 parser ⇒ {}(2026-10-28 那条修复的正题)
    const empty = await app.inject({
      method: 'POST',
      url: '/root',
      headers: { 'content-type': 'application/json' },
    })
    expect(empty.json().body).toEqual({})

    await app.close()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
