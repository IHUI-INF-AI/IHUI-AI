// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 镜像构建上下文不得携带真实密钥。
 *
 * 立因(2026-10-29 实测):`apps/ai-service` 原先没有 .dockerignore,而 Dockerfile 末尾是
 * `COPY . .`;根 `.dockerignore` 也不排除 .env / cert / *.pem。构建上下文里当时真实存在:
 *   · cert/apiclient_key.pem(微信支付私钥)、cert/alipay/alipay_app_private_key.pem
 *   · apps/miniapp-taro/private.wx27028e276ffdbc5d.key(小程序上传私钥)
 *   · .workbuddy/github-app.private-key.pem(GitHub App 私钥)
 *   · 根与 apps/* 下的 .env、.env.bak-*
 * ⇒ 一次 docker build 就把它们写进镜像层;镜像被拉取/推送/扫描即全量泄露,删历史层也
 *   清不掉构建缓存里的副本。
 *
 * 判据(纯静态,不需要 docker):
 *   D1 每个构建上下文都必须有 .dockerignore(根 = monorepo 根,apps/ai-service = 子上下文);
 *   D2 规则必须覆盖 .env 族与私钥族(.pem / .key / .p12);
 *   D3 上下文里**真实存在**的密钥文件必须被规则命中 —— 防"写了规则但模式写错"。
 */
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')

/** 极简 dockerignore 匹配:支持 `**`(任意层级)与 `*`(段内);目录规则按前缀匹配。 */
function toMatcher(pattern) {
  const raw = pattern.trim()
  if (!raw || raw.startsWith('#')) return null
  if (raw.startsWith('!')) return null
  const isDir = raw.endsWith('/')
  const body = isDir ? raw.slice(0, -1) : raw
  let re = ''
  for (let i = 0; i < body.length; i += 1) {
    const c = body[i]
    if (c === '*') {
      if (body[i + 1] === '*') {
        if (body[i + 2] === '/') {
          re += '(?:.*/)?'
          i += 2
        } else {
          re += '.*'
          i += 1
        }
      } else {
        re += '[^/]*'
      }
    } else if ('\\^$+.()|{}[]'.includes(c)) {
      re += `\\${c}`
    } else {
      re += c
    }
  }
  return isDir ? new RegExp(`^${re}/`) : new RegExp(`^${re}$`)
}

function loadMatchers(contextDir) {
  const file = join(contextDir, '.dockerignore')
  if (!existsSync(file)) return null
  return readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .map(toMatcher)
    .filter(Boolean)
}

const CONTEXTS = [
  { name: '根上下文(api/web/migrate 的 Dockerfile 都用它)', dir: ROOT },
  { name: 'ai-service 子上下文', dir: join(ROOT, 'apps', 'ai-service') },
]

/** 上下文里真实存在的密钥文件(相对上下文根);CI 干净检出上多数不存在,断言自动跳过。 */
const SECRET_FILES = [
  '.env',
  'apps/api/.env',
  'apps/ai-service/.env',
  'cert/apiclient_key.pem',
  'cert/alipay/alipay_app_private_key.pem',
  'apps/miniapp-taro/private.wx27028e276ffdbc5d.key',
]

test('D1:每个构建上下文都有 .dockerignore', () => {
  for (const c of CONTEXTS) {
    assert.ok(loadMatchers(c.dir), `${c.name} 缺少 .dockerignore(路径 ${c.dir})`)
  }
})

test('D2:.env 与私钥族都在排除规则里', () => {
  for (const c of CONTEXTS) {
    const matchers = loadMatchers(c.dir)
    assert.ok(matchers, `${c.name} 缺少 .dockerignore`)
    for (const [label, probe] of [
      ['.env', '.env'],
      ['私钥 .pem', 'x/p.pem'],
      ['私钥 .key', 'x/p.key'],
      ['证书 .p12', 'x/p.p12'],
    ]) {
      assert.ok(
        matchers.some((m) => m.test(probe)),
        `${c.name} 的 .dockerignore 未排除 ${label}(探针 ${probe})`,
      )
    }
  }
})

test('D3:上下文里真实存在的密钥文件必须被规则命中', () => {
  for (const c of CONTEXTS) {
    const matchers = loadMatchers(c.dir)
    assert.ok(matchers, `${c.name} 缺少 .dockerignore`)
    const abs = (rel) => join(c.dir, rel)
    for (const rel of SECRET_FILES) {
      if (!existsSync(abs(rel))) continue
      assert.ok(
        matchers.some((m) => m.test(rel)),
        `${c.name} 的 .dockerignore 放行了真实存在的密钥文件 ${rel}`,
      )
    }
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
