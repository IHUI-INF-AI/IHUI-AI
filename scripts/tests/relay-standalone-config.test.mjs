// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 镜像测试:deploy/relay-standalone(号池对标批 O70 单机档,结清枚 20276cb1d9f91acd5d53d35c2f6e03c6d92edd9c)静态结构。
// 本机无 docker,真机起栈由人工按 README 排障命令核对;这里锁住"改了会静默失去门/端口面"的六类结构:
// 唯一的对外端口、必填变量与样例文件对齐、门的三条命中通道、SSE 不缓冲、
// 对外出口 /v1 与 /v1beta 的 location(门 + 转发纪律逐条与 /api/ 同规,且与 apps/api 真挂前缀对账)、
// README 的 .env 键清单与出口用法示例(§0.8:文档不许写跑不通的出路)。

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

/** 正则元字符转义:判据串里含 `/` `.` `$` `(` 等,拼 RegExp 前必须原样当字面量 */
const toRe = (s) => new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))

/**
 * 按 `location <路径> {` 切出模板里的 location 块(花括号配平,块内嵌套不计入路径)。
 * 只用于本文件的文本面判据(与 serviceBlocks 同一条纪律:不引 nginx 解析器,取不到就报数)。
 * 返回 Map<路径, 行数组>(路径含 `= /healthz` 的 `= ` 前缀已被剥掉)。
 */
function locationBlocks(nginxText) {
  const out = new Map()
  let current = null
  let depth = 0
  for (const line of nginxText.split('\n')) {
    if (current === null) {
      const m = /^\s*location\s+(?:=\s+)?(\S+)\s*\{/.exec(line)
      if (!m) continue
      current = m[1]
      out.set(current, [])
      depth = (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length
      continue
    }
    out.get(current).push(line)
    depth += (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length
    if (depth <= 0) current = null
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

// ── 对外出口面(/v1、/v1beta)────────────────────────────────────────────────
// 立因(2026-10-29 实测):模板原本只有 `/`、`/api/`、`/healthz` 三条 location,而
// apps/api 把 OpenAI 兼容出口挂在根前缀 `/v1`、Gemini 挂在 `/v1beta`(不在 `/api/` 之下),
// 于是 7864 上**打不出对外出口**,README 却把这套写成可用的号池网关形态 = §0.8 禁止的
// "文档写了跑不通的出路"。下面四条判据把"出口存在 ∧ 出口带门 ∧ 出口按 SSE 纪律转发"钉住。

/** /api/、/v1、/v1beta 三条 api 向 location 必须逐条同纪律(缺一条即"这条出口没配全") */
const API_UPSTREAM_DISCIPLINE = [
  'proxy_pass http://api:8802',
  'proxy_http_version 1.1',
  'Connection "";',
  'Host $host;',
  'X-Real-IP $remote_addr;',
  'X-Forwarded-For $proxy_add_x_forwarded_for;',
  'X-Forwarded-Proto $scheme;',
  'proxy_buffering off;',
  'proxy_cache off;',
  'proxy_read_timeout 3600s;',
  'proxy_send_timeout 3600s;',
]

/** 入口门判据:未命中 key ⇒ 401(三通道 map 由上面那条 test 判,这里只判每条 location 有没有挂门) */
const DOOR_MARKS = [
  'if ($relay_allowed = 0)',
  'return 401 \'{"code":401,"message":"relay key required"}\'',
]

test('对外出口:模板必须为 /v1 与 /v1beta 各配一条 location,且转发目标 = api:8802', () => {
  const blocks = locationBlocks(read(NGINX))
  for (const path of ['/api/', '/v1', '/v1beta']) {
    assert.ok(
      blocks.has(path),
      `模板缺 location ${path}:从 7864 打不出这条出口,README 的用法示例就成了跑不通的出路`,
    )
  }
  for (const path of ['/v1', '/v1beta']) {
    const body = blocks.get(path).join('\n')
    assert.match(
      body,
      toRe('proxy_pass http://api:8802'),
      `${path} 的 proxy_pass 必须指向 api:8802`,
    )
  }
})

test('对外出口与 /api/ 同纪律:门判据 + SSE 不缓冲 + 超时 + 转发头逐条齐备', () => {
  const blocks = locationBlocks(read(NGINX))
  for (const path of ['/api/', '/v1', '/v1beta']) {
    const body = blocks.get(path).join('\n')
    for (const mark of DOOR_MARKS) {
      assert.match(body, toRe(mark), `${path} 缺入口门判据「${mark}」:未命中 key 会直接放行到 api`)
    }
    for (const d of API_UPSTREAM_DISCIPLINE) {
      assert.match(body, toRe(d), `${path} 缺「${d}」(与 /api/ 同纪律)`)
    }
  }
})

test('门覆盖计数:带门的 location 数 ≥ 会转发到后端的 location 数(/healthz 除外)', () => {
  const nginx = read(NGINX)
  const blocks = locationBlocks(nginx)
  // 反向门:所有 location 都要被本判据枚举到 —— 枚举到 0 个判死,不记绿(§0.3)
  assert.ok(blocks.size > 0, '模板里枚举到 0 条 location:判据失明,不得记为通过')
  const proxying = [...blocks.entries()].filter(([, lines]) =>
    lines.join('\n').includes('proxy_pass'),
  )
  assert.ok(
    proxying.length >= 2,
    `模板只剩 ${proxying.length} 条反代 location:多半是被删掉了,门计数无从对账`,
  )
  const doorCount = (nginx.match(/\$relay_allowed = 0/g) || []).length
  assert.ok(
    doorCount >= proxying.length,
    `入口门判据出现 ${doorCount} 次,少于反代 location 数 ${proxying.length}` +
      `(逐条:${proxying.map(([p]) => p).join(', ')})⇒ 至少一条出口能绕过 key 直接打到后端`,
  )
  // /healthz 是门自身探活口、不放行业务面(模板头注写明),因此它**不带**门是设计如此;
  // 但它绝不能变成反代口 —— 一旦哪天有人给它加 proxy_pass,上面的计数判据就会要求它也带门。
  const healthz = blocks.get('/healthz')
  assert.ok(healthz, '缺 location = /healthz:compose 的 gateway healthcheck 打的正是它')
  assert.ok(!healthz.join('\n').includes('proxy_pass'), '/healthz 不该反代任何后端')
})

test('api 侧真挂的前缀必须都在门上(门与挂载点对不上 = 出口写了也打不通)', (t) => {
  const routesFile = join(ROOT, 'apps', 'api', 'src', 'routes', 'index.ts')
  if (!existsSync(routesFile)) {
    t.skip(`取不到 ${routesFile} ⇒ 本轮不判前缀对账(未判定不等于通过)`)
    return
  }
  const routes = read(routesFile)
  const prefixes = new Set(
    [...routes.matchAll(/server\.register\([\w-]+,\s*\{\s*prefix:\s*'\/(v1beta|v1)'\s*\}\)/g)].map(
      (m) => `/${m[1]}`,
    ),
  )
  assert.ok(
    prefixes.size >= 2,
    `api 侧只解析出 ${prefixes.size} 个对外前缀(现读 ${[...prefixes].join(',') || '无'}):多半是挂载形态改了,本判据要跟现`,
  )
  const blocks = locationBlocks(read(NGINX))
  for (const p of prefixes) {
    assert.ok(
      blocks.has(p),
      `api 挂了 prefix '${p}' 而 gateway 模板没有对应 location ⇒ 7864 上打不出这个出口`,
    )
  }
})

test('README 给出客户出口用法(7864/v1 与 /v1beta 的 base_url + 两把 key 的如实边界)', () => {
  const md = read(README)
  assert.match(md, /7864\/v1\b/, 'README 必须有 base_url 指向 7864/v1 的用法示例')
  assert.match(md, /7864\/v1beta/, 'README 必须有 7864/v1beta 的用法示例')
  // 入口门对客户出口同样生效,且它不等于调模型的凭据 —— 两句都必须写在明面,不得只写"可用"
  assert.match(md, /X-Relay-Key/, 'README 必须写明出口也吃入口门(key 的三种带法之一)')
  assert.match(md, /developer api key/, 'README 必须如实写明客户侧还需自己的 developer api key')
  // .env 清单与 .env.example 逐键对齐(现读 11 枚):漏键 = 照 README 起栈会撞 compose 的 :? 拒绝
  const sampleKeys = [...read(ENV_SAMPLE).matchAll(/^([A-Z0-9_]+)=/gm)].map((m) => m[1])
  assert.equal(
    sampleKeys.length,
    11,
    `.env.example 键数现读 ${sampleKeys.length}(清单条目须与它同批改)`,
  )
  const missing = sampleKeys.filter((k) => !md.includes(`\`${k}\``))
  assert.deepEqual(missing, [], `README 的 .env 清单缺键:${missing.join(', ')}`)
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
