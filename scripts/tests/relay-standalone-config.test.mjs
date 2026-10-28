// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 镜像测试:deploy/relay-standalone(O70 单机档)静态结构。
// 本机无 docker,真机起栈由人工按 README 排障命令核对;这里锁住"改了会静默失去门/端口面"
// 的四类结构:唯一的对外端口、必填变量与样例文件对齐、门的三条命中通道、SSE 不缓冲。

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const DIR = join(HERE, '..', '..', 'deploy', 'relay-standalone')
const COMPOSE = join(DIR, 'docker-compose.yml')
const NGINX = join(DIR, 'nginx', 'default.conf.template')
const ENV_SAMPLE = join(DIR, '.env.example')
const README = join(DIR, 'README.md')

const read = (p) => readFileSync(p, 'utf8')

/** 按两空格缩进切出顶层服务块(仅用于本文件的文本面判据,不解析 YAML) */
function serviceBlocks(composeText) {
  const out = new Map()
  let current = null
  for (const line of composeText.split('\n')) {
    const svc = /^ {2}([a-z][a-z0-9-]*):\s*$/.exec(line)
    if (svc) {
      current = svc[1]
      out.set(current, [])
      continue
    }
    if (/^ {2}[a-zA-Z]/.test(line) && !/^ {3,}/.test(line)) {
      current = null
      continue
    }
    if (current) out.get(current).push(line)
  }
  return out
}

test('四件套齐备', () => {
  for (const p of [COMPOSE, NGINX, ENV_SAMPLE, README]) {
    assert.ok(existsSync(p), `缺文件:${p}`)
  }
})

test('对外端口面:只有 gateway 发布端口', () => {
  const blocks = serviceBlocks(read(COMPOSE))
  for (const name of ['db', 'redis', 'migrate', 'api', 'worker', 'web', 'gateway']) {
    assert.ok(blocks.has(name), `compose 缺服务 ${name}`)
  }
  const published = [...blocks.entries()]
    .filter(([, lines]) => lines.some((l) => /^ {4}ports:\s*$/.test(l)))
    .map(([name]) => name)
  assert.deepEqual(published, ['gateway'], `只有 gateway 允许发布端口,实际:${published.join(',')}`)
  assert.match(blocks.get('gateway').join('\n'), /RELAY_STANDALONE_PORT:-7864\}:7864/)
})

test('必填变量与 .env.example 对齐(compose 里每个 :? 都要在样例里出现)', () => {
  const compose = read(COMPOSE)
  const required = new Set()
  for (const m of compose.matchAll(/\$\{([A-Z0-9_]+):\?/g)) required.add(m[1])
  assert.ok(required.size > 0, 'compose 没有必填项:多半是校验被删了')
  const sample = read(ENV_SAMPLE)
  for (const key of required) {
    assert.match(sample, new RegExp(`^${key}=`, 'm'), `.env.example 缺必填项 ${key}`)
  }
  // 入口门凭据必须也是必填,不得退化成有默认值的弱档
  assert.ok(required.has('RELAY_STANDALONE_KEY'), 'RELAY_STANDALONE_KEY 必须是 :? 必填')
})

test('入口门:header/cookie/query 三通道命中才算放行,否则 401', () => {
  const nginx = read(NGINX)
  assert.match(nginx, /map \$http_x_relay_key \$relay_ok_header/)
  assert.match(nginx, /map \$cookie_relay_key \$relay_ok_cookie/)
  assert.match(nginx, /map \$arg_key \$relay_ok_query/)
  assert.match(nginx, /if \(\$relay_allowed = 0\)/)
  assert.match(nginx, /return 401/)
  assert.match(nginx, /listen 7864/)
  // 放行前必须先把 ?key= 种成 cookie,否则浏览器面板无法二次访问
  assert.match(nginx, /Set-Cookie "relay_key=\$arg_key/)
})

test('反向代理:面板 8801 / API 8802,SSE 不缓冲', () => {
  const nginx = read(NGINX)
  assert.match(nginx, /proxy_pass http:\/\/web:8801/)
  assert.match(nginx, /proxy_pass http:\/\/api:8802/)
  assert.match(nginx, /proxy_buffering off/)
  assert.match(nginx, /proxy_read_timeout 3600s/)
})

test('README 给出真跑得通的一条命令与边界', () => {
  const md = read(README)
  assert.match(md, /docker compose -f deploy\/relay-standalone\/docker-compose\.yml up -d/)
  assert.match(md, /不含 ai-service/, '必须写明不含 ai-service 的边界')
  assert.match(md, /7864/)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
