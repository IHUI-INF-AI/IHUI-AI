// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Y-14b 镜像测试:发布链(publish-mobile-apk.mjs)的 app_versions 登记腿接线。
 * 锁两件事(票面验收口径):
 *   ① 发布成功路径必然产生登记调用,或产生显式「未登记」告警(绝不静默成功);
 *   ② 三态判据不被复制第二份——本文件与发布脚本都只 import 登记器出口的同一 buildPlan/
 *      applyViaDb/applyViaApi/validateDesired(§22c),并附静态源锁(发布脚本里不得再出现
 *      function buildPlan / function validateDesired 的定义)。
 * 全部走注入的 fake 腿/fake sql,零网络、零生产库(§5 测试隔离)。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { __test__ as pub } from '../publish-mobile-apk.mjs'
import { buildPlan, validateDesired } from '../register-app-version-latest.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const PUBLISH_SRC = readFileSync(join(HERE, '..', 'publish-mobile-apk.mjs'), 'utf8')

const SECRET_DB = 'postgres://u:TOPSECRET@prod-host:5432/db'
const SECRET_JWT = 'eyJhbGci.TOKEN-TOPSECRET.value'
const DESIRED = { version: '0.1.0', versionCode: '26110101' }

function capture() {
  const out = []
  const err = []
  return { out, err, o: (m) => out.push(String(m)), e: (m) => err.push(String(m)) }
}

// fake 库夹具:形状 = applyViaDb 真正发出的 tagged-template(夹具可复制,判据不可,§22c)
function makeFakeDb(state = []) {
  const log = []
  const exec = (strings, ...vals) => {
    const s = (Array.isArray(strings) ? strings.join('?') : String(strings)).replace(/\s+/g, ' ').trim()
    log.push(s)
    if (s.startsWith('select id')) {
      return state.map((r) => ({
        id: r.id,
        version: r.version,
        build_number: r.buildNumber,
        status: r.status,
        download_url: r.downloadUrl,
      }))
    }
    if (s.startsWith('select version')) {
      return state
        .filter((r) => r.status === 'latest')
        .map((r) => ({ version: r.version, build_number: r.buildNumber, status: r.status, download_url: r.downloadUrl }))
    }
    if (s.startsWith('update') && s.includes('id <>')) {
      const target = vals[1]
      for (const r of state) if (r.status === 'latest' && r.id !== target) r.status = 'history'
      return []
    }
    if (s.startsWith('update')) {
      for (const r of state) if (r.status === 'latest') r.status = 'history'
      return []
    }
    if (s.startsWith('insert')) {
      const [v, , bn, url] = vals
      state.push({ id: `n${state.length}`, version: v, buildNumber: bn, downloadUrl: url, status: 'latest' })
      return []
    }
    throw new Error(`fake 未实现: ${s}`)
  }
  const sql = (q, ...v) => exec(q, ...v)
  sql.begin = async (fn) => fn((q, ...v) => exec(q, ...v))
  sql.end = async () => {}
  return { sql, state, log }
}

test('W1 选腿优先级:DATABASE_URL(db)⇒ IHUI_ADMIN_TOKEN(api)⇒ 皆无 leg=null(不猜)', () => {
  assert.equal(pub.registerLegFromEnv({ DATABASE_URL: SECRET_DB, IHUI_ADMIN_TOKEN: SECRET_JWT }).leg, 'db')
  assert.equal(pub.registerLegFromEnv({ IHUI_ADMIN_TOKEN: SECRET_JWT }).leg, 'api')
  const none = pub.registerLegFromEnv({ DATABASE_URL: '   ', IHUI_ADMIN_TOKEN: '' })
  assert.equal(none.leg, null, '空白串凭据 = 没凭据,不得选腿')
})

test('W2 整改命令:带本次版本/构建号/固定下载地址,绝不含凭据值', () => {
  const cmd = pub.registerRemediationCommand(DESIRED)
  assert.match(cmd, /--apply --via db --db-url "\$DATABASE_URL"/)
  assert.match(cmd, /--version 0\.1\.0 --build-number 26110101/)
  assert.match(cmd, new RegExp(pub.siteLegUrl(pub.LATEST_KEY).replace(/[.]/g, '\\.')))
  assert.ok(!cmd.includes('TOPSECRET'), '命令行只许出现 env 名,不许内嵌任何凭据值')
})

test('W3 成功路径必然产生登记调用:db 腿参数逐键对账,输出恒脱敏', async () => {
  const calls = []
  const cap = capture()
  const step = await pub.publishRegisterStep({
    ...DESIRED,
    env: { DATABASE_URL: SECRET_DB },
    out: cap.o,
    err: cap.e,
    deps: {
      openDb: () => ({ end: async () => {} }),
      applyViaDb: async (p) => {
        calls.push(p)
        return { plan: { action: 'create', demoteIds: [] }, wrote: true }
      },
    },
  })
  assert.equal(step.ok, true)
  assert.equal(calls.length, 1, '发布成功路径必须产生恰好一次登记调用')
  assert.equal(calls[0].platform, 'android')
  assert.equal(calls[0].version, '0.1.0')
  assert.equal(calls[0].buildNumber, 26110101, 'buildNumber 必须是数字形态(与登记器同一入参形状)')
  assert.equal(calls[0].downloadUrl, pub.siteLegUrl(pub.LATEST_KEY), '登记的必须是固定地址,不是版本名副本')
  assert.equal(calls[0].apply, true)
  assert.match(cap.out.join('\n'), /✓ app_versions 登记已落地 leg=db plan=create/)
  assert.ok(!(cap.out.join('') + cap.err.join('')).includes('TOPSECRET'), '凭据值不得进任何输出')
})

test('W4 无凭据 ⇒ 显式「未登记」告警三要素齐(缺什么/后果/唯一命令),且一腿都不碰', async () => {
  const calls = []
  const cap = capture()
  const step = await pub.publishRegisterStep({
    ...DESIRED,
    env: {},
    out: cap.o,
    err: cap.e,
    deps: {
      openDb: () => {
        throw new Error('不该被调用')
      },
      applyViaDb: async () => calls.push('db'),
      applyViaApi: async () => calls.push('api'),
    },
  })
  assert.equal(step.ok, false, '未登记的结论必须是"不成功"(失效方向=多喊一次,§0.10)')
  assert.equal(step.status, 'unregistered')
  assert.deepEqual(calls, [], '无凭据时任何腿都不许发起')
  const msg = cap.err.join('\n')
  assert.match(msg, /未登记/)
  assert.match(msg, /DATABASE_URL/)
  assert.match(msg, /IHUI_ADMIN_TOKEN/, '必须点名**两条**腿各缺什么')
  assert.match(msg, /node scripts\/register-app-version-latest\.mjs --apply/, '必须给一条可复制的整改命令')
  assert.equal(cap.out.filter((m) => m.includes('✓')).length, 0, '不许出现"登记成功"式绿字')
})

test('W5 三态判据单源:真 applyViaDb+fake 库跑通 create→noop,plan 与登记器 buildPlan 逐键相等', async () => {
  const fake = makeFakeDb([])
  const cap = capture()
  const s1 = await pub.publishRegisterStep({
    ...DESIRED,
    env: { DATABASE_URL: SECRET_DB },
    out: cap.o,
    err: cap.e,
    deps: { openDb: () => fake.sql },
  })
  assert.equal(s1.ok, true)
  assert.equal(s1.status, 'registered')
  assert.equal(s1.plan.action, 'create')
  assert.equal(fake.state.length, 1)
  assert.equal(fake.state[0].status, 'latest')

  const readsBefore = fake.log.length
  const s2 = await pub.publishRegisterStep({
    ...DESIRED,
    env: { DATABASE_URL: SECRET_DB },
    out: cap.o,
    err: cap.e,
    deps: { openDb: () => fake.sql },
  })
  assert.equal(s2.status, 'noop', '同一输入第二次跑必须落在登记器 noop 态(幂等)')
  assert.equal(s2.ok, true)
  assert.equal(fake.log.length, readsBefore + 1, '第二次只许多一条 select,一条写都不许有')

  // 行为层单源证明:发布链拿到的 plan ≡ 直接问 buildPlan 的 plan(同一个函数,不是两份实现)
  const mapped = fake.state.map((r) => ({
    id: r.id,
    version: r.version,
    buildNumber: Number(r.buildNumber),
    status: r.status,
    downloadUrl: r.downloadUrl,
  }))
  const expected = buildPlan(mapped, {
    version: DESIRED.version,
    buildNumber: Number(DESIRED.versionCode),
    downloadUrl: pub.siteLegUrl(pub.LATEST_KEY),
  })
  assert.deepEqual(s2.plan, expected)
  assert.ok(Array.isArray(validateDesired({ platform: 'android', version: '0.1.0', buildNumber: 1, downloadUrl: pub.siteLegUrl(pub.LATEST_KEY) })))
})

test('W6 api 腿:仅 IHUI_ADMIN_TOKEN 时走 applyViaApi,token 只进腿不进日志', async () => {
  const calls = []
  const cap = capture()
  const step = await pub.publishRegisterStep({
    ...DESIRED,
    env: { IHUI_ADMIN_TOKEN: SECRET_JWT },
    out: cap.o,
    err: cap.e,
    deps: {
      applyViaApi: async (p) => {
        calls.push(p)
        return { plan: { action: 'update', demoteIds: [] }, wrote: true }
      },
    },
  })
  assert.equal(step.ok, true)
  assert.equal(step.leg, 'api')
  assert.equal(calls[0].token, SECRET_JWT, '值只许透传给登记器的腿(执行用)')
  assert.equal(calls[0].baseUrl, pub.SITE_LEG.PublicBase)
  assert.ok(!(cap.out.join('') + cap.err.join('')).includes('TOPSECRET'), '任何输出不得含 token 值')
})

test('W7 有凭据但登记执行失败 ⇒ ok:false + 点名"站点腿已落地、只补登记"并给命令', async () => {
  const cap = capture()
  const step = await pub.publishRegisterStep({
    ...DESIRED,
    env: { DATABASE_URL: SECRET_DB },
    out: cap.o,
    err: cap.e,
    deps: {
      openDb: () => ({ end: async () => {} }),
      applyViaDb: async () => {
        throw new Error('connection reset')
      },
    },
  })
  assert.equal(step.ok, false)
  assert.equal(step.status, 'register-error')
  assert.match(cap.err.join('\n'), /登记执行失败/)
  assert.match(cap.err.join('\n'), /禁止重发整包/)
  assert.match(cap.err.join('\n'), /node scripts\/register-app-version-latest\.mjs --apply/)
})

test('W8 形状锁:三态判据零复制 + main 的登记步接在公网自证之后并以非零码退出', () => {
  // ② 判据不被复制第二份:发布脚本必须从登记器 import,且自己体内零定义
  assert.match(PUBLISH_SRC, /from '\.\/register-app-version-latest\.mjs'/)
  assert.doesNotMatch(PUBLISH_SRC, /function\s+buildPlan/, 'buildPlan 只许存在于登记器一处(§0.6)')
  assert.doesNotMatch(PUBLISH_SRC, /function\s+validateDesired/, '参数校验同理')
  // ① 成功路径必然接登记:main 内 publishRegisterStep 必须排在 verifySiteLegLive 之后,
  //    且 !step.ok 一律 return 1(未登记/执行失败都不许以 0 收场)
  const mainSrc = PUBLISH_SRC.slice(PUBLISH_SRC.indexOf('async function main'))
  assert.ok(mainSrc.length > 0, 'main 必须可定位')
  assert.ok(
    mainSrc.indexOf('publishRegisterStep(') > mainSrc.indexOf('verifySiteLegLive('),
    '登记步必须接在公网自证成功之后(包没发出去不先动库)',
  )
  assert.match(mainSrc, /if \(!step\.ok\) return 1/, '登记不落地必须以非零码退出')
  assert.match(mainSrc, /--dry-run: app_versions 登记腿/, 'dry-run 必须现读并打印登记腿判定(不联网)')
  assert.match(PUBLISH_SRC, /const regBad = validateDesired\(/, '非法参数在落包之前就未判定(fail-fast)')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
