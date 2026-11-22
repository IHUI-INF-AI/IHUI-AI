// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 镜像测试:判据一律 import 源脚本的 __test__,本文件不复制第二份(AGENTS §22c)。
/**
 * check-aasa-public-health.test.mjs —— AASA 公网健康只读哨兵的镜像测试。
 *
 * 立因:G-100 那一族票里「AASA / file.aizhs.top 公网复核」这格此前只有人肉 curl 一次,
 * 没有器物 ⇒ 下次还得靠人。本文件钉四件事:
 *   ① 三态判据本身(breach / unjudged / ok 各自有正反对照);
 *   ② **反向夹具**:注定拿不到的输入必须落 unjudged,绝不冒绿(§0.3);
 *   ③ 靶清单来自 App 声明面(app.json 的 associatedDomains),不是代码里硬编码的靶;
 *   ④ 越线锁:**不接提交链、不接 CI**(§12e),且带值旗标走 lib/flag-value 唯一出口、
 *      根推导不用 process.cwd()(§15)、双形态入口用 pathToFileURL(§22d)。
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { __test__ as S, evaluate, probeAasaUrl } from '../check-aasa-public-health.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const SRC = join(ROOT, 'scripts', 'check-aasa-public-health.mjs')
const srcText = readFileSync(SRC, 'utf8')

const expected = {
  components: ['/wechat/*', '/*'],
  placeholderTeamId: 'TEAMID',
  defaultBundleId: 'ai.ihui.mobile',
  contentType: 'application/json; charset=utf-8',
  cacheControl: '',
}
const goodBody = JSON.stringify({
  applinks: {
    details: [
      { appIDs: ['TKF3V7GG6T.ai.ihui.mobile'], components: [{ '/': '/wechat/*' }, { '/': '/*' }] },
    ],
  },
})
const appJson = JSON.stringify({
  expo: {
    ios: {
      bundleIdentifier: 'ai.ihui.mobile',
      associatedDomains: ['applinks:aizhs.top', 'applinks:file.aizhs.top'],
    },
    extra: { WX_UNIVERSAL_LINK: 'https://aizhs.top/' },
  },
})
const leg = {
  id: 'aasa:file.aizhs.top',
  host: 'file.aizhs.top',
  url: 'https://file.aizhs.top/.well-known/apple-app-site-association',
}
const status200 = (body, contentType = 'application/json; charset=utf-8') => ({
  kind: 'status',
  status: 200,
  contentType,
  body,
  hops: 0,
})

describe('判据:可达性 + 内容一致性(与脚本自检同一份实现)', () => {
  it('200 + application/json + 与单源同构 ⇒ ok,且把响应体交给一致性维(否则一致性永远拿不到样本)', () => {
    const r = S.judgeLegOutcome({
      leg,
      outcome: status200(goodBody),
      expected,
      bundleId: 'ai.ihui.mobile',
    })
    assert.equal(r.state, 'ok')
    assert.equal(r.raw, goodBody)
  })

  it('终页 404 ⇒ breach:Apple 只认 200,G-100 票面当时的病灶就是这一型', () => {
    const r = S.judgeLegOutcome({
      leg,
      outcome: { kind: 'status', status: 404, contentType: 'text/html', body: '', hops: 0 },
      expected,
    })
    assert.equal(r.state, 'breach')
    assert.equal(r.code, 'path-not-served')
  })

  it('MIME 退成 text/plain ⇒ breach(Fastify 默认推断就是这一型)', () => {
    assert.equal(S.judgeContentType('text/plain; charset=UTF-8').state, 'breach')
    assert.equal(S.judgeContentType('Application/JSON; charset=utf-8').state, 'ok')
  })

  it('components 序列与单源不符 ⇒ breach(顺序即匹配优先级,不是集合等值)', () => {
    const swapped = JSON.stringify({
      applinks: {
        details: [
          {
            appIDs: ['TKF3V7GG6T.ai.ihui.mobile'],
            components: [{ '/': '/*' }, { '/': '/wechat/*' }],
          },
        ],
      },
    })
    const r = S.judgeAasaBody({ text: swapped, expected })
    assert.equal(r.state, 'breach')
    assert.ok(r.faults.some((f) => f.code === 'components-mismatch'))
  })

  it('真实 APPLE_TEAM_ID 那格归机主面:占位符只降 warn,且文案点名实得 appID', () => {
    const r = S.judgeAasaBody({ text: goodBody.replace('TKF3V7GG6T', 'TEAMID'), expected })
    assert.equal(r.state, 'warn')
    assert.ok(
      r.faults[0].detail.includes('TEAMID.ai.ihui.mobile'),
      'warn 必须报**实得**那串,不许合成串糊过',
    )
  })

  it('Team 段只判形态:非 10 位大写且非占位 ⇒ breach(形态坏是可判的,真伪不可判)', () => {
    const c = S.classifyAppId('team-id.ai.ihui.mobile', 'TEAMID')
    assert.equal(c.state, 'breach')
    assert.equal(c.code, 'appid-team-form')
  })

  it('appID 的 Bundle 段必须与 app.json 声明一致(跨源对账,不是网络判据)', () => {
    const r = S.judgeAasaBody({
      text: goodBody.replace('ai.ihui.mobile', 'com.other.app'),
      expected,
      bundleId: 'ai.ihui.mobile',
    })
    assert.equal(r.state, 'breach')
    assert.ok(r.faults.some((f) => f.code === 'appid-bundle-mismatch'))
  })

  it('各腿内容分叉 ⇒ breach;只有 1 腿可比对 ⇒ unjudged(缺对照面不冒充判过)', () => {
    const diverge = S.judgeLegConsistency([
      { state: 'ok', leg: { host: 'a' }, raw: goodBody },
      { state: 'ok', leg: { host: 'b' }, raw: goodBody.replace('TKF3V7GG6T', 'TEAMID') },
    ])
    assert.equal(diverge.state, 'breach')
    assert.equal(diverge.code, 'leg-divergence')
    const single = S.judgeLegConsistency([
      { state: 'ok', leg: { host: 'a' }, raw: goodBody },
      { state: 'breach', code: 'origin-5xx', leg: { host: 'b' } },
    ])
    assert.equal(single.state, 'unjudged')
  })

  it('同域 301→200 允许跟完并如实记跳数;跨注册域重定向 ⇒ breach', () => {
    const r = S.judgeLegOutcome({
      leg: { ...leg, host: 'aizhs.top' },
      outcome: { ...status200(goodBody), hops: 1 },
      expected,
      bundleId: 'ai.ihui.mobile',
    })
    assert.equal(r.state, 'ok')
    assert.equal(r.hops, 1)
    assert.equal(
      S.judgeLegOutcome({
        leg,
        outcome: { kind: 'offDomainRedirect', from: 'file.aizhs.top', to: 'evil.example.com' },
        expected,
      }).state,
      'breach',
    )
    assert.equal(S.registrableDomain('www.aizhs.top'), S.registrableDomain('aizhs.top'))
  })

  it('5xx / 拒连 = 对端可归因(breach);DNS / TLS / 超时 = 未判定(§5d 网络不可达 ≠ 无效)', () => {
    assert.equal(
      S.judgeLegOutcome({
        leg,
        outcome: {
          kind: 'status',
          status: 502,
          contentType: 'application/json',
          body: '{}',
          hops: 0,
        },
        expected,
      }).state,
      'breach',
    )
    assert.equal(
      S.judgeLegOutcome({ leg, outcome: { kind: 'conn', code: 'ECONNREFUSED' }, expected }).state,
      'breach',
    )
    for (const kind of ['dns', 'tls', 'stall', 'probeBlind']) {
      assert.equal(
        S.judgeLegOutcome({ leg, outcome: { kind, detail: 'x' }, expected }).state,
        'unjudged',
        `${kind} 必须落未判定`,
      )
    }
  })
})

describe('反向夹具:取不到的输入一律 unjudged,绝不冒绿(§0.3)', () => {
  it('【反向夹具】那一腿根本没跑到(outcome=null)⇒ unjudged,且原因点名"没有任何探测样本"', () => {
    const r = S.judgeLegOutcome({ leg, outcome: null, expected })
    assert.equal(r.state, 'unjudged')
    assert.equal(r.code, 'no-sample')
    assert.match(r.detail, /未判定/)
    assert.match(r.detail, /没有.*探测样本/)
    assert.equal(r.raw, undefined, '没跑到的腿不得带响应体进一致性比对')
    assert.equal(S.exitCodeFor(r.state), 2, '这一型到了出口必须是 2,不得落 0')
  })

  it('【反向夹具】单源期望形状取不到 ⇒ 内容一致性未判定(绝不因"能解析成 JSON"记绿)', () => {
    const r = S.judgeAasaBody({ text: goodBody, expected: null })
    assert.equal(r.state, 'unjudged')
    assert.match(r.why, /未判定/)
  })

  it('【反向夹具】app.json 读不到 ⇒ 声明面 unjudged(枚举不到靶不许读成"没有腿要判"而放过)', () => {
    const r = S.judgeLocalDeclarations({
      appJsonText: null,
      appJsonError: 'ENOENT',
      staticText: goodBody,
      staticError: null,
      expected,
    })
    assert.equal(r.state, 'unjudged')
    assert.equal(r.facts.hosts.length, 0)
  })

  it('【反向夹具】声明文件在但 associatedDomains 枚举为 0 ⇒ breach(判死,不记绿)', () => {
    const r = S.judgeLocalDeclarations({
      appJsonText: JSON.stringify({
        expo: {
          ios: { bundleIdentifier: 'ai.ihui.mobile', associatedDomains: [] },
          extra: { WX_UNIVERSAL_LINK: 'https://aizhs.top/' },
        },
      }),
      staticText: null,
      staticError: 'absent',
      expected,
    })
    assert.equal(r.state, 'breach')
    assert.ok(r.faults.some((f) => f.code === 'associated-domains-empty'))
  })

  it('汇总优先级:breach > unjudged > warn > ok;未判定退出码恒 2(不记绿也不冒红)', () => {
    assert.equal(
      S.aggregate({ a: { state: 'breach' }, b: { state: 'unjudged' } }).verdict,
      'breach',
    )
    assert.equal(
      S.aggregate({ a: { state: 'warn' }, b: { state: 'unjudged' } }).verdict,
      'unjudged',
    )
    assert.equal(S.aggregate({ a: { state: 'ok' }, b: { state: 'warn' } }).verdict, 'warn')
    assert.equal(S.aggregate({ a: { state: 'ok' } }).verdict, 'ok')
    assert.equal(S.exitCodeFor('ok'), 0)
    assert.equal(S.exitCodeFor('warn'), 0)
    assert.equal(S.exitCodeFor('breach'), 1)
    assert.equal(S.exitCodeFor('unjudged'), 2)
    assert.equal(S.exitCodeFor(undefined), 2, '拿不到结论也必须落 2,不得落 0')
  })

  it('--skip-probe 时公网维如实 unjudged(只判本机不许冒充全量合格证)', async () => {
    const out = await evaluate({
      argv: ['--skip-probe'],
      baseline: { state: 'ok', expected },
      face: { appJsonText: appJson, appJsonError: null, staticText: goodBody, staticError: null },
    })
    assert.equal(out.verdict, 'unjudged')
    assert.equal(out.dimensions.probe.state, 'unjudged')
    assert.equal(out.skippedProbe, true)
  })
})

describe('靶清单与编排:由 App 声明面推靶,不硬编码', () => {
  it('注入假探针:靶 = associatedDomains 逐条拼 .well-known 路径,全绿时 verdict=ok', async () => {
    const seen = []
    const out = await evaluate({
      argv: [],
      baseline: { state: 'ok', expected },
      face: { appJsonText: appJson, appJsonError: null, staticText: goodBody, staticError: null },
      probe: async (url) => {
        seen.push(url)
        return status200(goodBody)
      },
    })
    assert.deepEqual(seen, [
      'https://aizhs.top/.well-known/apple-app-site-association',
      'https://file.aizhs.top/.well-known/apple-app-site-association',
    ])
    assert.equal(out.verdict, 'ok')
    assert.equal(out.dimensions.consistency.state, 'ok')
    assert.equal(
      out.legs.every((l) => l.source === 'app.json associatedDomains'),
      true,
    )
  })

  it('单源导入不了 ⇒ baseline 维 unjudged(不回落第二份期望)', async () => {
    const out = await evaluate({
      argv: ['--skip-probe'],
      baseline: await S.loadExpectedBaseline({
        importer: async () => {
          throw new Error('ERR_UNKNOWN_FILE_EXTENSION')
        },
      }),
      face: { appJsonText: appJson, appJsonError: null, staticText: goodBody, staticError: null },
    })
    assert.equal(out.dimensions.baseline.state, 'unjudged')
    assert.match(out.dimensions.baseline.detail, /未判定/)
  })

  it('本机单源真在位时按权威面(.ts)可导入 —— 摘掉它必须显式失败,不得静默换面', async () => {
    const r = await S.loadExpectedBaseline({
      modulePath: join(ROOT, 'scripts', 'no-such-shared-source.ts'),
    })
    assert.equal(r.state, 'unjudged')
    assert.match(r.why, /单源不在位/)
    const real = await S.loadExpectedBaseline({})
    assert.equal(real.state, 'ok', `真实单源导入失败(判据将整维失明):${real.why}`)
    assert.deepEqual(real.expected.components, ['/wechat/*', '/*'])
  })

  it('探针错误归桶:undici 连接超时 ⇒ stall(不是"对端坏",也不是"尺子坏")', () => {
    assert.equal(
      S.classifyFetchError(
        { name: 'TypeError', message: 'fetch failed', cause: { code: 'UND_ERR_CONNECT_TIMEOUT' } },
        'https://x',
      ).kind,
      'stall',
    )
    assert.equal(
      S.classifyFetchError(
        { name: 'Error', message: 'certificate has expired', cause: { code: 'CERT_HAS_EXPIRED' } },
        'https://x',
      ).kind,
      'tls',
    )
    assert.equal(
      S.classifyFetchError(
        { name: 'Error', message: 'getaddrinfo ENOTFOUND x', code: 'ENOTFOUND' },
        'https://x',
      ).kind,
      'dns',
    )
  })

  it('probeAasaUrl 拒非 https 靶(明文要求证书有效,不给 http 出合格证)', async () => {
    const r = await probeAasaUrl('http://file.aizhs.top/.well-known/apple-app-site-association', {})
    assert.equal(r.kind, 'insecureRedirect')
  })
})

describe('越线锁:只读尺子的纪律', () => {
  const runnerSrc = readFileSync(join(ROOT, 'scripts', 'guardian-runner.mjs'), 'utf8')
  const hookSrc = readFileSync(join(ROOT, 'scripts', 'lib', 'pre-commit-hook.js'), 'utf8')
  const huskyDir = join(ROOT, '.husky')

  it('不许接进提交链/CI(判公网与本机出口态 ⇒ 挂 blocking 就是人人 --no-verify 的恒红门,§12e)', () => {
    for (const [where, text] of [
      ['scripts/guardian-runner.mjs', runnerSrc],
      ['scripts/lib/pre-commit-hook.js', hookSrc],
    ]) {
      assert.equal(
        text.includes('check-aasa-public-health'),
        false,
        `${where} 里出现了本器 ⇒ 只读尺子被挂进了提交通道`,
      )
    }
    for (const f of ['pre-commit', 'commit-msg', 'pre-push', 'post-commit']) {
      let t = ''
      try {
        t = readFileSync(join(huskyDir, f), 'utf8')
      } catch {
        continue
      }
      assert.equal(t.includes('check-aasa-public-health'), false, `.husky/${f} 引用了本器`)
    }
    const ci = readFileSync(join(ROOT, '.github', 'workflows', 'ci-monorepo.yml'), 'utf8')
    assert.equal(ci.includes('check-aasa-public-health'), false, 'CI 里不得引用只读尺子')
  })

  it('根推导用 import.meta.url,不用 process.cwd()(§15:共享工作区 cwd 不可靠)', () => {
    assert.match(srcText, /const ROOT = resolve\(HERE, '\.\.'\)/)
    assert.equal(srcText.includes('process.cwd()'), false)
  })

  it('带值旗标走 lib/flag-value 唯一出口,不许自己 argv[i+1](G-322 静默降级族)', () => {
    assert.match(srcText, /from '\.\/lib\/flag-value\.mjs'/)
    assert.match(srcText, /requireFlagValue\(argv, '--url'/)
    assert.equal(/argv\[i \+ 1\]/.test(srcText), false)
  })

  it('双形态入口必须走 pathToFileURL(Windows 反斜杠手拼 file:/// 永不匹配,§22d)', () => {
    assert.match(srcText, /import\.meta\.url === pathToFileURL\(process\.argv\[1\]\)\.href/)
    assert.match(srcText, /if \(isDirectRun\) \{/)
    assert.equal(srcText.includes("file:///' +"), false)
  })

  it('只读:器自身不写盘、不发信、不自拼 SMTP(守门 81 / §5e)', () => {
    for (const banned of [
      'writeFileSync',
      'appendFileSync',
      'createWriteStream',
      'nodemailer',
      'notify-deploy-failure',
    ]) {
      assert.equal(srcText.includes(banned), false, `源码里出现 ${banned} ⇒ 只读哨兵越界`)
    }
    assert.equal(srcText.includes('rmSync'), false)
  })

  it('期望形状不在本器复抄:判据面必须引用共享单源路径(§0.6 单一真相源)', () => {
    assert.equal(
      S.SHARED_AASA_SOURCE,
      join(ROOT, 'packages', 'shared', 'src', 'constants', 'apple-app-site-association.ts'),
    )
    assert.equal(S.AASA_PATH, '/.well-known/apple-app-site-association')
    assert.equal(S.AASA_MAX_BYTES, 128 * 1024)
  })
})

// ─── 未知旗标即用法错(2026-10-28 本席接管时补的牙) ──────────────────────────
// 立因是本席现场踩到的:给它打 `--base-url https://no-such-host.invalid`,它把旗标连同值一起
// 静默忽略,照报「✅ ok:2 腿全部 200」——一台哨兵的绿意味着"我查过了",而这一下它什么都没查。
// 与本仓既有纪律同型(plan-tasks.mjs 头注:「未知/残缺开关静默掉进默认分支,是本仓登记过的失效型」)。
describe('未知旗标必须用法错,不得静默掉进默认靶', () => {
  it('① 未知旗标被点名(它的值也一起点名——两个 token 都不被接受,少报一个等于替用户猜)', () => {
    const u = S.unknownTokensOf(['--base-url', 'https://no-such-host.invalid'])
    assert.equal(u.length, 2)
    assert.equal(u[0].token, '--base-url')
    assert.equal(u[1].token, 'https://no-such-host.invalid')
  })
  it('② 合法旗标不误伤:带值旗标的值不得被当成未知参数', () => {
    const u = S.unknownTokensOf([
      '--url',
      'https://aizhs.top/.well-known/apple-app-site-association',
      '--timeout-ms',
      '5000',
      '--max-hops',
      '3',
      '--json',
      '--skip-probe',
    ])
    assert.deepEqual(u, [], `合法形态被误拦: ${JSON.stringify(u)}`)
  })
  it('③ 裸参数也被点名(没有"多一个位置参数就走默认"这种通道)', () => {
    const u = S.unknownTokensOf(['https://aizhs.top/.well-known/apple-app-site-association'])
    assert.equal(u.length, 1)
    assert.match(u[0].why, /裸参数/)
  })
  it('④ 形状锁:main 真的把 unknownTokensOf 接进了 errors(有函数没人调=没修)', () => {
    const code = srcText
      .split(/\r?\n/)
      .filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*'))
      .join('\n')
    assert.match(code, /unknownTokensOf\(argv\)/, '判据必须被 main 真调用')
    assert.match(code, /includes\('--help'\)/, '--help 档必须在位(文档不许写跑不通的出路)')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
