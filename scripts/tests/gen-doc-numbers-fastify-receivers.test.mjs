// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 判据锁:apiRoutes 的非白名单接收者必须**有语法证据**才算 Fastify 实例。
 *
 * 背景(2026-11-05):旧口径只认 app/server/fastify/instance 四个名字,
 * `server.register(async (s) => { s.get(...) })` 这一族整批隐身(实测少 128 处)。
 * 本测试钉三件事:
 *  T1 正例有牙 —— register 回调首参(s)、传递闭包(sub)、别名、工厂返回、FastifyInstance 参数都能认;
 *  T2 反例不误伤 —— Map/Headers/Redis 的 `.get('key')` 即便同文件有 fastify 依赖也不得计入;
 *  T3 证据缺失即不计 —— 没有 fastify 证据的 `.register(async (s) => ...)` 不得把它认成 Fastify 实例;
 *  T4 装车证明 —— 判据必须接在 deriveNumbers 上(只测纯函数证明不了生成器真的用了它)。
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const GEN_URL = pathToFileURL(resolve(HERE, '..', 'gen-doc-numbers.mjs')).href
const GIT = process.env.GIT_BIN || 'git'

async function loadGen() {
  return import(GEN_URL)
}

test('T1 正例:register 回调首参 / 传递闭包 / 别名 / 工厂 / 类型标注都按实例计数(旧口径漏掉的必须捞回)', async () => {
  const { countFastifyRoutes, countWhitelistRoutes, deriveFastifyReceivers, maskCommentsOnly } =
    await loadGen()

  // ① register 回调首参(旧口径 1 → 新口径 2)
  const direct = maskCommentsOnly(
    [
      "import type { FastifyPluginAsync } from 'fastify'",
      'export const routes: FastifyPluginAsync = async (server) => {',
      "  server.get('/a', () => {})",
      '  server.register(async (s) => {',
      "    s.get('/b', () => {})",
      '  })',
      '}',
    ].join('\n'),
  )
  if (countWhitelistRoutes(direct) !== 1) throw new Error('夹具失效:旧口径应只见 1 处')
  if (countFastifyRoutes(direct) !== 2)
    throw new Error(`register 回调首参未计入,实得 ${countFastifyRoutes(direct)}`)

  // ② 传递闭包:role-routes 的 s.register(async (sub) => ...) 需要两轮迭代
  const nested = maskCommentsOnly(
    [
      "import type { FastifyPluginAsync } from 'fastify'",
      'export const routes: FastifyPluginAsync = async (s) => {',
      "  s.get('/a', () => {})",
      '  s.register(async (sub) => {',
      "    sub.post('/b', () => {})",
      '  })',
      '}',
    ].join('\n'),
  )
  const nestedSet = [...deriveFastifyReceivers(nested)]
  for (const need of ['s', 'sub'])
    if (!nestedSet.includes(need)) throw new Error(`传递闭包漏了 ${need}:${nestedSet}`)
  if (countFastifyRoutes(nested) !== 2)
    throw new Error(`闭包计数错,实得 ${countFastifyRoutes(nested)}`)

  // ③ 构造 / 工厂返回 / 类型标注 / 别名
  const chain = maskCommentsOnly(
    [
      "import type { FastifyInstance } from 'fastify'",
      'function build(): Promise<FastifyInstance> { return Fastify() }',
      'const made = await build()',
      "made.get('/a', () => {})",
      'function bind(inst: FastifyInstance) {',
      "  inst.get('/b', () => {})",
      '}',
      'const alias = made',
      "alias.get('/c', () => {})",
    ].join('\n'),
  )
  const chainSet = [...deriveFastifyReceivers(chain)]
  for (const need of ['made', 'inst', 'alias'])
    if (!chainSet.includes(need)) throw new Error(`证据链漏了 ${need}:${chainSet}`)
  if (countFastifyRoutes(chain) !== 3)
    throw new Error(`证据链计数错,实得 ${countFastifyRoutes(chain)}`)
})

test('T2 反例:Map/Headers/Redis 的 .get("key") 不得被证据链误伤', async () => {
  const { countFastifyRoutes, deriveFastifyReceivers, maskCommentsOnly } = await loadGen()
  const code = maskCommentsOnly(
    [
      "import type { FastifyPluginAsync } from 'fastify'",
      'export const routes: FastifyPluginAsync = async (server) => {',
      "  server.get('/real', () => {})",
      "  headers.get('X-RateLimit-Remaining')",
      "  topicMap.get('n1')",
      "  redis.get('cache:key')",
      "  map.get('autoLogin')",
      "  r.get('relay:affinity')",
      '}',
    ].join('\n'),
  )
  const set = [...deriveFastifyReceivers(code)]
  for (const bad of ['headers', 'topicMap', 'redis', 'map', 'r'])
    if (set.includes(bad)) throw new Error(`误伤:${bad} 被认成 Fastify 实例`)
  if (countFastifyRoutes(code) !== 1)
    throw new Error(`反例被计入,实得 ${countFastifyRoutes(code)}(应仅 1 处真路由)`)
})

test('T3 证据缺失即不计:没有 fastify 依赖的 register 回调不得被认成实例', async () => {
  const { countFastifyRoutes, deriveFastifyReceivers, maskCommentsOnly } = await loadGen()
  const code = maskCommentsOnly(
    [
      'const obj = makeThing()',
      'obj.register(async (s) => {',
      "  s.get('/x', () => {})",
      '})',
    ].join('\n'),
  )
  if (deriveFastifyReceivers(code).size !== 0)
    throw new Error(`无 fastify 证据却推出了实例:${[...deriveFastifyReceivers(code)]}`)
  if (countFastifyRoutes(code) !== 0)
    throw new Error(`无证据的路由被计入,实得 ${countFastifyRoutes(code)}`)

  // 反向:同一个文件补上一行真实的 fastify 插件签名,证据链才成立 —— 证明红/绿由证据而非命名驱动
  const withProof = maskCommentsOnly(
    [
      "import type { FastifyPluginAsync } from 'fastify'",
      'export const routes: FastifyPluginAsync = async (server) => {',
      '  server.register(async (s) => {',
      "    s.get('/x', () => {})",
      '  })',
      '}',
    ].join('\n'),
  )
  if (countFastifyRoutes(withProof) !== 1)
    throw new Error(`补上证据后仍未计入,实得 ${countFastifyRoutes(withProof)}`)
})

test('T4 装车证明:判据接在 collectNumbers 上(临时仓里 s 注册点必须进 apiRoutes)', async () => {
  const gen = await loadGen()
  const s = mkScratch('doc-num-fastify-receivers')
  try {
    const body = [
      "import type { FastifyPluginAsync } from 'fastify'",
      'export const routes: FastifyPluginAsync = async (server) => {',
      "  server.get('/public', () => {})",
      '  server.register(async (s) => {',
      "    s.get('/admin/list', () => {})",
      '  })',
      '}',
    ].join('\n')
    mkdirSync(resolve(s, 'apps/api/src/routes'), { recursive: true })
    writeFileSync(resolve(s, 'apps/api/src/routes/a.ts'), body)
    writeFileSync(resolve(s, 'package.json'), JSON.stringify({ name: 'x', version: '0.0.0' }))
    const git = (...args) =>
      execFileSync(
        GIT,
        ['-c', 'safe.directory=*', '-c', 'user.email=t@e2e.local', '-c', 'user.name=e2e', ...args],
        { cwd: s, stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' },
      )
    git('init', '-q', '-b', 'main')
    git('add', '-A')
    git('commit', '-q', '-m', 'seed')
    const d = gen.collectNumbers({ root: s, face: 'head' })
    if (d.numbers.apiRoutes !== 2)
      throw new Error(
        `生成器未接判据:apiRoutes=${d.numbers.apiRoutes}(应 2 = 1 白名单 + 1 证据推导)`,
      )
  } finally {
    rmScratch(s)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
