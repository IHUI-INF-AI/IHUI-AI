#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * deploy/saas/docker-compose.yml 的两格静态判据(本机无 docker,用文本契约自证)。
 *
 * P2-4①:ADMIN_API_KEY 必须 `:?` fail-fast。旧写法 `${ADMIN_API_KEY:-}` 在 .env 漏配时注入空串,
 *        要到 admin-api 运行期才炸;`:?` 让 compose 在 up 之前就失败。
 * P2-4②:cAdvisor 必须有 healthcheck,且探测端口 == 其 `--port`。旧状态无 healthcheck;
 *        镜像自带 HEALTHCHECK 固定探 :8080,而服务用 --port=8808 ⇒ 即便不覆盖也恒 unhealthy。
 *
 * 修前 HEAD 实测两格均红(缺 `:?`、缺 healthcheck),修后 2/2 pass。
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const COMPOSE = join(HERE, '..', 'saas', 'docker-compose.yml')

/** 取某个 top-level service 的块(从 `  name:` 到下一个同级键/文件尾)。 */
function serviceBlock(text, name) {
  const lines = text.split('\n')
  const start = lines.findIndex((l) => new RegExp(`^  ${name}:\\s*$`).test(l))
  assert.ok(start >= 0, `compose 里找不到服务 ${name}`)
  let end = lines.length
  for (let i = start + 1; i < lines.length; i++) {
    if (/^  [A-Za-z0-9_.-]+:\s*$/.test(lines[i])) {
      end = i
      break
    }
  }
  return lines.slice(start, end).join('\n')
}

test('T1 ADMIN_API_KEY 必须是 `:?` fail-fast(不得再用 `:-` 空串兜底)', () => {
  const text = readFileSync(COMPOSE, 'utf8')
  assert.match(
    text,
    /ADMIN_API_KEY=\$\{ADMIN_API_KEY:\?/,
    'ADMIN_API_KEY 未用 `${ADMIN_API_KEY:?}` ⇒ 漏配时 compose 仍能 up,错误被推迟到运行期',
  )
  assert.ok(
    !/ADMIN_API_KEY=\$\{ADMIN_API_KEY:-\}/.test(text),
    '仍残留 `${ADMIN_API_KEY:-}` 空串兜底 ⇒ fail-fast 被绕过',
  )
})

test('T2 cAdvisor 有 healthcheck,且探针端口与 --port 一致', () => {
  const text = readFileSync(COMPOSE, 'utf8')
  const block = serviceBlock(text, 'cadvisor')
  // 注释里会引用镜像自带的 :8080 探针作说明,判据只看非注释行。
  const codeOnly = block
    .split('\n')
    .filter((l) => !/^\s*#/.test(l))
    .join('\n')
  const port = codeOnly.match(/--port=(\d+)/)
  assert.ok(port, 'cadvisor 缺少显式 --port,无法校验探针端口')
  assert.ok(/healthcheck:\s*\n/.test(codeOnly), 'cadvisor 缺少 healthcheck ⇒ 容器活跃度不可观测')
  const probe = codeOnly.match(/http:\/\/[^'"\s]*:(\d+)\/healthz/)  
  assert.ok(probe, 'cadvisor healthcheck 未探 /healthz')
  assert.equal(probe[1], port[1], `探针端口 ${probe[1]} 与 --port=${port[1]} 不一致 ⇒ 探针必然失败`)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
