// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

// =============================================================================
// BUG-0019 回归: SaaS compose 的监控栈鉴权面
// =============================================================================
// 缺陷: prometheus / cadvisor / grafana 与租户容器共享 ihui-saas-net,且 prometheus
// 带着 --web.enable-lifecycle —— 任何租户容器都能直连 prometheus:9090 查询指标、
// 并通过无鉴权的 POST /-/reload 改写抓取配置;cadvisor:8808 同样零鉴权可达。
// 修复: 监控栈迁入专用网 ihui-saas-mon(与租户网零交集),摘除 enable-lifecycle,
// prometheus 不发布宿主端口;admin-api 双网保留(查 Prometheus + 既有生命周期链路)。
//
// 判据不是"文件里有没有某行",而是 auditCompose() 的结构断言。因此本夹具先对
// 真文件断言零缺陷,再喂四份人为破坏的变体,逐份断言**唯一**缺陷码 —— 变体必须
// 让判据红,否则等于判据失效(与 deploy/tests 其它自检同一形态)。
//
// 跑法: node --test deploy/tests/saas-monitoring-exposure.test.mjs
// =============================================================================
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..')
const read = (rel) => readFileSync(join(REPO, rel), 'utf8')

const COMPOSE = 'deploy/saas/docker-compose.yml'
const TENANT_COMPOSE = 'deploy/saas/templates/customer/docker-compose.yml'
const MON_SERVICES = ['prometheus', 'cadvisor', 'grafana']
const MON_NET = 'ihui-saas-mon'
const TENANT_NET = 'ihui-saas-net'

// ── YAML 子集读取(只取本票关心的块/列表,不引第三方解析器)──────────────────
const indentOf = (line) => line.match(/^ */)[0].length

function serviceRange(lines, name) {
  const start = lines.findIndex((l) => l === `  ${name}:`)
  if (start < 0) return null
  let end = lines.length
  for (let i = start + 1; i < lines.length; i += 1) {
    const line = lines[i]
    if (!line.trim()) continue
    if (indentOf(line) <= 2) {
      end = i
      break
    }
  }
  return { start, end }
}

function topRange(lines, key) {
  const start = lines.findIndex((l) => l === `${key}:`)
  if (start < 0) return null
  let end = lines.length
  for (let i = start + 1; i < lines.length; i += 1) {
    if (!lines[i].trim()) continue
    if (indentOf(lines[i]) === 0) {
      end = i
      break
    }
  }
  return { start, end }
}

function listUnder(blockLines, key, keyIndent) {
  const idx = blockLines.findIndex((l) => l === `${' '.repeat(keyIndent)}${key}:`)
  if (idx < 0) return null
  const items = []
  for (let i = idx + 1; i < blockLines.length; i += 1) {
    const line = blockLines[i]
    if (!line.trim()) continue
    if (line.trim().startsWith('#')) continue
    const ind = indentOf(line)
    if (ind < keyIndent + 2) break
    if (ind === keyIndent + 2 && !line.trim().startsWith('-')) break
    if (ind === keyIndent + 2) items.push(line.trim().replace(/^-\s*/, ''))
  }
  return items
}

function auditCompose(text) {
  const lines = text.split(/\r?\n/)
  const issues = []

  for (const name of MON_SERVICES) {
    const range = serviceRange(lines, name)
    if (!range) {
      issues.push(`SERVICE_MISSING:${name}`)
      continue
    }
    const block = lines.slice(range.start, range.end)
    const nets = listUnder(block, 'networks', 4)
    if (!nets || nets.length === 0) {
      issues.push(`NETWORK_UNDECLARED:${name}`)
    } else if (nets.length !== 1 || nets[0] !== MON_NET) {
      issues.push(`SERVICE_NOT_ISOLATED:${name}`)
    }
  }

  const promRange = serviceRange(lines, 'prometheus')
  if (promRange) {
    const block = lines.slice(promRange.start, promRange.end)
    if (block.some((l) => /^\s*-\s+(?:'|")?--web\.enable-lifecycle/.test(l))) {
      issues.push('PROM_LIFECYCLE_ENABLED')
    }
    if (block.some((l) => /^    ports:/.test(l))) {
      issues.push('PROM_HOST_PORT_PUBLISHED')
    }
  }

  const adminRange = serviceRange(lines, 'admin-api')
  if (adminRange) {
    const nets = listUnder(lines.slice(adminRange.start, adminRange.end), 'networks', 4)
    if (!nets || !nets.includes(TENANT_NET) || !nets.includes(MON_NET)) {
      issues.push('ADMIN_API_DUAL_NETWORK_MISSING')
    }
  } else {
    issues.push('SERVICE_MISSING:admin-api')
  }

  const netRange = topRange(lines, 'networks')
  if (!netRange) {
    issues.push('MON_NET_UNDEFINED')
  } else {
    const block = lines.slice(netRange.start, netRange.end)
    if (!block.includes(`  ${MON_NET}:`)) issues.push('MON_NET_UNDEFINED')
  }

  return issues
}

function auditTenant(text) {
  const lines = text.split(/\r?\n/)
  const issues = []
  for (const name of ['db', 'redis', 'ai-service', 'api', 'web']) {
    const range = serviceRange(lines, name)
    if (!range) {
      issues.push(`TENANT_SERVICE_MISSING:${name}`)
      continue
    }
    const nets = listUnder(lines.slice(range.start, range.end), 'networks', 4)
    if (nets && nets.includes(MON_NET)) issues.push(`TENANT_ON_MON_NET:${name}`)
  }
  const netRange = topRange(lines, 'networks')
  const block = netRange ? lines.slice(netRange.start, netRange.end) : []
  if (!block.includes(`  ${TENANT_NET}:`)) issues.push('TENANT_SHARED_NET_UNDECLARED')
  return issues
}

// ── 变体夹具:在指定服务块内制造一处破坏 ──────────────────────────────────
function mutateService(text, name, mutateLines) {
  const lines = text.split(/\r?\n/)
  const range = serviceRange(lines, name)
  assert.ok(range, `变体目标服务不在位: ${name}`)
  lines.splice(range.start, range.end - range.start, ...mutateLines(lines.slice(range.start, range.end)))
  return lines.join('\n')
}

function insertLineInService(text, name, anchor, line) {
  return mutateService(text, name, (block) => {
    const idx = block.findIndex((l) => l === anchor)
    assert.ok(idx >= 0, `变体锚点不在位: ${anchor}`)
    return [...block.slice(0, idx + 1), line, ...block.slice(idx + 1)]
  })
}

function replaceLineInService(text, name, from, to) {
  return mutateService(text, name, (block) => {
    assert.equal(block.filter((l) => l === from).length, 1, `变体行必须唯一: ${from}`)
    return block.map((l) => (l === from ? to : l))
  })
}

// ── 真文件:零缺陷 ────────────────────────────────────────────────────────
test('BUG-0019: SaaS compose 监控栈已与租户网隔离且无 lifecycle/宿主端口', () => {
  const issues = auditCompose(read(COMPOSE))
  assert.deepEqual(issues, [], `compose 仍有鉴权面缺陷: ${issues.join(', ')}`)
})

test('BUG-0019: 租户模板不加入监控专用网', () => {
  const issues = auditTenant(read(TENANT_COMPOSE))
  assert.deepEqual(issues, [], `租户模板可触达监控网: ${issues.join(', ')}`)
})

// ── 变体夹具:每一处破坏都必须被精确打红 ──────────────────────────────────
test('变体: 重挂 --web.enable-lifecycle 必须报 PROM_LIFECYCLE_ENABLED', () => {
  const mutated = insertLineInService(
    read(COMPOSE),
    'prometheus',
    "      - '--web.console.templates=/usr/share/prometheus/consoles'",
    "      - '--web.enable-lifecycle'",
  )
  assert.deepEqual(auditCompose(mutated), ['PROM_LIFECYCLE_ENABLED'])
})

test('变体: prometheus 回到租户网必须报 SERVICE_NOT_ISOLATED', () => {
  const mutated = replaceLineInService(read(COMPOSE), 'prometheus', `      - ${MON_NET}`, `      - ${TENANT_NET}`)
  assert.deepEqual(auditCompose(mutated), ['SERVICE_NOT_ISOLATED:prometheus'])
})

test('变体: prometheus 发布宿主端口必须报 PROM_HOST_PORT_PUBLISHED', () => {
  const mutated = insertLineInService(
    read(COMPOSE),
    'prometheus',
    '    healthcheck:',
    "    ports:\n      - '127.0.0.1:9090:9090'",
  )
  assert.deepEqual(auditCompose(mutated), ['PROM_HOST_PORT_PUBLISHED'])
})

test('变体: 摘掉 ihui-saas-mon 网络定义必须报 MON_NET_UNDEFINED', () => {
  const lines = read(COMPOSE).split(/\r?\n/)
  const netRange = topRange(lines, 'networks')
  assert.ok(netRange, '顶层 networks 不在位')
  const block = lines.slice(netRange.start, netRange.end)
  const monStart = block.findIndex((l) => l === `  ${MON_NET}:`)
  assert.ok(monStart >= 0, 'ihui-saas-mon 定义不在位')
  let monEnd = block.length
  for (let i = monStart + 1; i < block.length; i += 1) {
    if (block[i].trim() && indentOf(block[i]) <= 2) {
      monEnd = i
      break
    }
  }
  const mutated = [...lines.slice(0, netRange.start), ...block.slice(0, monStart), ...block.slice(monEnd)]
  assert.deepEqual(auditCompose(mutated.join('\n')), ['MON_NET_UNDEFINED'])
})

test('变体: 租户容器挂上监控网必须报 TENANT_ON_MON_NET', () => {
  const mutated = insertLineInService(
    read(TENANT_COMPOSE),
    'api',
    `      - ${TENANT_NET}`,
    `      - ${MON_NET}`,
  )
  assert.deepEqual(auditTenant(mutated), ['TENANT_ON_MON_NET:api'])
})
