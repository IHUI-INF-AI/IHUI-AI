// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 镜像测试:deploy/relay-standalone(号池对标批 O70 单机档,结清枚 20276cb1d9f91acd5d53d35c2f6e03c6d92edd9c)静态结构。
// 本机无 docker,真机起栈由人工按 README 排障命令核对;这里锁住"改了会静默失去门/端口面"
// 的四类结构:唯一的对外端口、必填变量与样例文件对齐、门的三条命中通道、SSE 不缓冲。

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..', '..')
const DIR = join(ROOT, 'deploy', 'relay-standalone')
const COMPOSE = join(DIR, 'docker-compose.yml')
const NGINX = join(DIR, 'nginx', 'default.conf.template')
const ENV_SAMPLE = join(DIR, '.env.example')
const README = join(DIR, 'README.md')

/** 只读解析:有带 PyYAML 的 venv python 才能真解析 compose;取不到 ⇒ 由调用方落"未判定" */
function resolvePython() {
  for (const c of [
    join(ROOT, 'apps', 'ai-service', '.venv', 'Scripts', 'python.exe'),
    join(ROOT, 'apps', 'ai-service', '.venv', 'bin', 'python'),
  ]) {
    if (existsSync(c)) return c
  }
  return null
}

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

test('envsubst 引用闭包:模板里的 ${VAR} 必须全由 compose 注入(否则 key 展开成空 ⇒ 门裸奔)', () => {
  const nginx = read(NGINX)
  const refs = new Set([...nginx.matchAll(/\$\{([A-Z0-9_]+)\}/g)].map((m) => m[1]))
  assert.ok(refs.size > 0, '模板不再引用任何环境变量:多半是门被改成了常量比对')
  const gatewayBlock = (serviceBlocks(read(COMPOSE)).get('gateway') ?? []).join('\n')
  const injected = new Set([...gatewayBlock.matchAll(/^\s*-\s*([A-Z0-9_]+)=/gm)].map((m) => m[1]))
  for (const name of refs) {
    assert.ok(
      injected.has(name),
      '模板引用 ${' + name + '} 但 compose 的 gateway 没注入 ⇒ envsubst 展开成空串,门会放行空 key',
    )
  }
})

test('compose 真解析(取不到带 PyYAML 的 python ⇒ 显式未判定,不冒绿)', (t) => {
  const py = resolvePython()
  if (py === null) {
    t.skip('取不到 venv python ⇒ 本轮不判 compose 结构(未判定不等于通过)')
    return
  }
  const probe = spawnSync(py, ['-c', 'import yaml'], { encoding: 'utf8' })
  if (probe.status !== 0) {
    t.skip('该 python 无 PyYAML ⇒ 本轮不判 compose 结构(未判定不等于通过)')
    return
  }
  const code = [
    'import json,sys,yaml',
    'd=yaml.safe_load(open(sys.argv[1],encoding="utf-8"))',
    'svc=d.get("services",{})',
    'print(json.dumps({',
    '  "services":sorted(svc.keys()),',
    '  "published":[s for s,v in svc.items() if v.get("ports")],',
    '  "builds":[[s,v["build"]] for s,v in svc.items() if v.get("build")],',
    '  "deps":{s:sorted((v.get("depends_on") or {}).keys()) for s,v in svc.items()},',
    '  "listeners":[[s,[p for p in (v.get("healthcheck") or {}).get("test",[]) if "127.0.0.1" in str(p)]] for s,v in svc.items() if v.get("healthcheck")],',
    '}))',
  ].join('\n')
  const r = spawnSync(py, ['-c', code, COMPOSE], { encoding: 'utf8' })
  assert.equal(r.status, 0, `PyYAML 解析失败:${r.stderr}`)
  const parsed = JSON.parse(r.stdout)
  assert.deepEqual(parsed.services, ['api', 'db', 'gateway', 'migrate', 'redis', 'web', 'worker'])
  assert.deepEqual(parsed.published, ['gateway'], 'YAML 真解析下也只有 gateway 发布端口')
  for (const [name, build] of parsed.builds) {
    const df = join(DIR, build.context, build.dockerfile)
    assert.ok(existsSync(df), `${name} 的 build.dockerfile 不存在:${df}`)
  }
  for (const [name, deps] of Object.entries(parsed.deps)) {
    for (const d of deps) {
      assert.ok(parsed.services.includes(d), `${name} depends_on 引用了不存在的服务 ${d}`)
    }
  }
  // 健康检查打的端口必须是该服务自己监听的端口(否则探活恒失败或探到别人)
  const listenOf = { api: ':8802/', web: ':8801/', gateway: ':7864/', redis: null, db: null }
  for (const [name, hits] of parsed.listeners) {
    if (hits.length === 0) continue
    const expect = listenOf[name]
    if (expect === null) continue
    assert.ok(
      hits[0].includes(expect),
      `${name} 的健康检查端口与监听端口不符:${hits[0]}(期望含 ${expect})`,
    )
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
