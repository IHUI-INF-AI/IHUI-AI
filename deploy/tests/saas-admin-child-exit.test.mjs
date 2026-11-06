#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * admin-api 脚本退出码的镜像测试(deploy/saas/admin-api)。
 *
 * 钉:子进程被信号终止时 Node 的 close 事件给 `code=null`。旧实现用 `code ?? 0` 把它当退出码 0,
 * 于是 create/restore/destroy 路由在脚本半途被杀(超时/OOM/运维 docker stop)时**回假成功**。
 *
 * 两格判据:① 纯函数归一(`null ⇒ 1`,正常码原样透传);② 接线断言 —— customers.ts 的 close
 * 处理必须调用 normalizeChildExit,且不得再出现 `code ?? 0`(只测纯函数不测接线 = 假绿)。
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { normalizeChildExit, runWithTimeout } from '../saas/admin-api/src/lib/child-exit.ts'

const HERE = dirname(fileURLToPath(import.meta.url))
const CUSTOMERS_TS = join(HERE, '..', 'saas', 'admin-api', 'src', 'routes', 'customers.ts')

test('T1 退出码归一:被信号终止(code=null)⇒ 1,正常退出码原样透传', () => {
  assert.equal(normalizeChildExit(null), 1, '被杀必须当失败,不得当 0')
  assert.equal(normalizeChildExit(0), 0)
  assert.equal(normalizeChildExit(2), 2)
})

test('T2 接线断言:customers.ts 必须经 runWithTimeout 出口,不得再自建 spawn 或 `code ?? 0`', () => {
  const src = readFileSync(CUSTOMERS_TS, 'utf8')
  // 注释里会引用旧写法作说明,判据只看代码行(剥掉行注释)。
  const codeOnly = src
    .split('\n')
    .map((line) => line.replace(/\/\/.*$/, ''))
    .join('\n')
  assert.ok(
    codeOnly.includes('runWithTimeout(') && codeOnly.includes('timeoutMs: DEFAULT_SCRIPT_TIMEOUT_MS'),
    'runScript 没有走 runWithTimeout/未带超时 ⇒ 脚本卡死时请求仍会无限挂起',
  )
  assert.ok(
    !codeOnly.includes("spawn('bash'"),
    'customers.ts 仍在自建 spawn ⇒ 绕过了统一出口的超时与退出码归一',
  )
  assert.ok(
    !/code\s*!==\s*null\s*\?\s*code\s*:\s*0/.test(codeOnly) && !/code\s*\?\?\s*0/.test(codeOnly),
    'customers.ts 仍残留 `code ?? 0` ⇒ 被信号终止仍会被当成功',
  )
})

test('T3 行为:注入 `bash -c "sleep 60"`,阈值内到点 kill 且按失败返回非 0', async () => {
  const startedAt = Date.now()
  const r = await runWithTimeout({
    command: 'bash',
    args: ['-c', 'sleep 60'],
    timeoutMs: 400,
  })
  const elapsed = Date.now() - startedAt
  // 阈值 400ms + 进程启动开销,10s 是很宽的上界;真的等满 60s 才会红。
  assert.ok(elapsed < 10_000, `到点没有 kill:elapsed=${elapsed}ms`)
  assert.equal(r.code, 1, `超时必须与非正常退出同口径(1),实际 ${r.code}`)
  assert.match(r.stderr, /timeout after 400ms/, `stderr 未标注超时:${JSON.stringify(r.stderr)}`)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
