// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 镜像测试:release-mobile-rn.mjs 的判据必须零复制、腿注册表形状不可散、凭据落件闸不可绕过。
// 口径见 AGENTS.md §22c(import 源脚本的 __test__,禁止在测试里再抄一份判据)。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const SRC_PATH = join(HERE, '..', 'release-mobile-rn.mjs')
const SRC = readFileSync(SRC_PATH, 'utf8')
const { __test__ } = await import(import.meta.resolve('../release-mobile-rn.mjs'))
const { foldStatus, checkSubmitProfile, findChannel, probeRuntimeVersion, buildLegs, buildStoreLegs, exitCode, PLAY_PACKAGE, SA_SLOT_REL, STATUS } = __test__
const { STORE_VENDORS } = await import(import.meta.resolve('../lib/rn-release-credentials.mjs'))

const okAndroid = { track: 'alpha', serviceAccountKeyPath: './credentials/x.json' }

test('M1 判据单源:测试面直接吃源脚本导出的函数,未复抄', () => {
  for (const [name, fn] of Object.entries({ foldStatus, checkSubmitProfile, findChannel, probeRuntimeVersion, buildLegs, exitCode })) {
    assert.equal(typeof fn, 'function', `${name} 未从 __test__ 导出`)
  }
  assert.ok(SRC.includes('export const __test__'), '源脚本未导出 __test__')
})

test('M2 foldStatus 单调性:unjudged > blocked > ready,空集不冒绿', () => {
  assert.equal(foldStatus([]), 'unjudged')
  assert.equal(foldStatus([STATUS.FOUND, STATUS.MISSING, STATUS.UNJUDGED]), 'unjudged')
  assert.equal(foldStatus([STATUS.FOUND, STATUS.MISSING]), 'blocked')
  assert.equal(foldStatus([STATUS.FOUND]), 'ready')
})

test('M3 submit 判据正反对照(found / internal / 缺项 / 空段)', () => {
  assert.equal(checkSubmitProfile({ submit: { production: { android: okAndroid } } }, { packageName: PLAY_PACKAGE }).status, STATUS.FOUND)
  assert.equal(checkSubmitProfile({ submit: { production: { android: { ...okAndroid, track: 'internal' } } } }).status, STATUS.MISSING)
  assert.equal(checkSubmitProfile({ submit: { production: { android: { track: 'alpha' } } } }).status, STATUS.MISSING)
  assert.equal(checkSubmitProfile({ submit: { production: {} } }).status, STATUS.MISSING)
  assert.equal(checkSubmitProfile({ submit: { production: { android: okAndroid } } }, { packageName: 'other.pkg' }).status, STATUS.MISSING)
})

test('M4 回归锁:eas.json 里不得出现 packageName —— eas-cli schema 拒该键并顶掉全部 eas 命令', () => {
  const easJson = JSON.parse(readFileSync(join(HERE, '..', '..', 'apps', 'mobile-rn', 'eas.json'), 'utf8'))
  const leg = easJson?.submit?.production?.android ?? {}
  assert.equal('packageName' in leg, false, `submit.production.android 出现了 packageName(${leg.packageName});eas-cli 实测报 "submit.production.android.packageName is not allowed" 且让 channel:list 一并退 1`)
  assert.equal(leg.track, 'alpha', 'docs/RELEASE.md:409 实测:个人开发者号 12 人×14 天门槛只认闭测,alpha 是唯一有效轨道')
})

test('M5 channel 判据:命中/缺失点名枚举集/坏输入一律 unjudged', () => {
  assert.equal(findChannel(JSON.stringify({ currentPage: [{ name: 'preview', isPaused: false, updateBranches: [] }] }), 'preview').status, STATUS.FOUND)
  const absent = findChannel(JSON.stringify({ currentPage: [{ name: 'preview' }] }), 'production')
  assert.equal(absent.status, STATUS.MISSING)
  assert.ok(absent.detail.includes('preview'), '缺失时必须点名已枚举到的渠道,否则"没查到"与"查了没有"不可区分')
  assert.equal(findChannel('{"currentPage":{}}', 'preview').status, STATUS.UNJUDGED)
  assert.equal(findChannel('nope', 'preview').status, STATUS.UNJUDGED)
})

test('M6 runtimeVersion 三臂:真件 found / 桶随显示版本漂移 missing / 桶恒缺 missing', () => {
  const real = probeRuntimeVersion(readFileSync(join(HERE, '..', '..', 'apps', 'mobile-rn', 'app.config.js'), 'utf8'))
  assert.equal(real.status, STATUS.FOUND, `真件判据未过:${real.detail}`)
  assert.match(real.bucket, /^[0-9]+\.[0-9]+\.[0-9]+$/)
  const drift = probeRuntimeVersion('module.exports = () => ({ version: process.env.IHUI_MOBILE_VERSION, runtimeVersion: process.env.IHUI_MOBILE_VERSION })')
  assert.equal(drift.status, STATUS.MISSING)
  assert.equal(probeRuntimeVersion('module.exports = () => ({ version: process.env.IHUI_MOBILE_VERSION })').status, STATUS.MISSING)
  assert.equal(probeRuntimeVersion('module.exports = 42').status, STATUS.UNJUDGED, '导出非函数应落未判定而非猜')
})

test('M7 腿注册表形状:id 唯一、每条 checks 三键齐、blocked 腿必须自带出路命令', () => {
  const ev = {
    whoami: { status: STATUS.FOUND, detail: 'x' },
    runtime: { status: STATUS.FOUND, detail: 'x' },
    channels: { status: STATUS.FOUND, detail: '', raw: JSON.stringify({ currentPage: [{ name: 'preview' }, { name: 'production' }] }) },
    appJson: { updates: { url: 'https://u.expo.dev/1' }, ios: { bundleIdentifier: 'ai.ihui.mobile' }, android: { package: PLAY_PACKAGE } },
    signing: { status: STATUS.FOUND, detail: 'x' },
    site: { status: STATUS.FOUND, detail: 'x' },
    prodHost: { status: STATUS.MISSING, detail: '本机零 IHUI-* 服务' },
    latest: { android: { status: STATUS.FOUND, detail: 'x' }, ios: { status: STATUS.MISSING, detail: 'x' } },
    submit: { status: STATUS.FOUND, detail: 'x' },
    saKey: { status: STATUS.FOUND, detail: 'x' },
    slot: { status: STATUS.FOUND, detail: 'x' },
    apple: { status: STATUS.MISSING, detail: 'x' },
    xcode: { status: STATUS.MISSING, detail: 'x' },
    artifacts: { status: STATUS.MISSING, detail: '无 release 产物' },
    stores: STORE_VENDORS.map((v) => ({ vendor: v, cred: { status: STATUS.MISSING, detail: '夹具' } })),
  }
  const legs = buildLegs(ev)
  assert.equal(new Set(legs.map((l) => l.id)).size, legs.length, '腿 id 不得重复')
  for (const leg of legs) {
    assert.ok(leg.checks.length >= 3, `${leg.id} 判据不足`)
    for (const c of leg.checks) {
      assert.ok(c.k && c.status && c.detail !== undefined, `${leg.id} 的判据项三键不齐:${JSON.stringify(c)}`)
    }
    assert.ok(leg.command.length > 10, `${leg.id} 缺出路命令`)
  }
  // play-aab 腿的"Play 应用/授权"默认留 unjudged(体检面不擅自发外网请求)⇒ 整体顶到 exit 2
  assert.equal(exitCode(legs.map((l) => ({ status: foldStatus(l.checks.map((c) => c.status)) }))), 2)
  assert.equal(foldStatus(legs.find((l) => l.id === 'ota-production').checks.map((c) => c.status)), 'ready')
  assert.equal(foldStatus(legs.find((l) => l.id === 'app-store').checks.map((c) => c.status)), 'blocked')
})

test('M8 凭据落件闸:git check-ignore 不命中就绝不写盘(结构邻接锁,§15c/§5d)', () => {
  const i = SRC.indexOf("flags.has('--stage-credentials')")
  assert.ok(i > 0, "找不到 main 里的 --stage-credentials 分支(锚点必须取 flags.has 判定,头注示例不算)")
  const block = SRC.slice(i, i + 2000)
  const gateCheck = block.indexOf('ev.slot.status !== STATUS.FOUND')
  const write = block.indexOf('copyFileSync(')
  assert.ok(block.includes("'check-ignore'") || SRC.includes("'check-ignore'"), '取证面必须实测 git 忽略状态,不得凭 .gitignore 文本推断')
  assert.ok(gateCheck >= 0 && write >= 0, `分支内缺少忽略闸或落件动作(slotGate=${gateCheck}, copy=${write})`)
  assert.ok(write > gateCheck, 'copyFileSync 必须排在忽略闸之后,否则凭据可能落到不被忽略的路径')
  assert.match(block.slice(0, gateCheck), /return 1/, '凭据缺席时必须非 0 退出,不得继续往下落件')
  assert.match(block.slice(gateCheck, write), /return 1/, '忽略闸不通过必须直接退出')
})

test('M9 eas 派生纪律:必须 node 直调 bin/run,不得走 .bin/eas 的 cmd 壳(§12g/EINVAL 实测)', () => {
  assert.ok(!/\.bin[/\\]eas/.test(SRC), '源码出现 .bin/eas 形态')
  assert.ok(!/[{,]\s*shell:\s*true/.test(SRC), '源码出现 shell:true 形态(注释里的禁令字样不算)')
  assert.match(SRC, /stdio:\s*\[['"]ignore['"],\s*['"]pipe['"],\s*['"]pipe['"]\]/, 'execFileSync 必须显式接管 stdio')
  assert.ok(SRC.includes('windowsHide: true'), '派生进程必须 windowsHide')
  assert.ok(/pathToFileURL\(process\.argv\[1\]\)\.href/.test(SRC), 'CLI 脚本必须有 isDirectRun 守卫(§22d,禁手拼 file:/// )')
})

test('M10 SA key 按内容识别,不认文件名(GCP 默认名是随机串)', async () => {
  const lib = await import(import.meta.resolve('../lib/rn-release-credentials.mjs'))
  assert.ok(!/spherical-door/.test(lib.__test__.playServiceKey.toString()), 'playServiceKey 里不得写死某枚 key 的文件名')
  assert.equal(typeof lib.__test__.fp, 'function')
  assert.notEqual(lib.__test__.fp('a'), lib.__test__.fp('b'))
})

test('M11 凭据槽位路径与 .gitignore 在册规则一致(忽略不生效即拒落)', () => {  assert.ok(SA_SLOT_REL.startsWith('credentials/'), `槽位必须落在 credentials/ 下,现为 ${SA_SLOT_REL}`)
  const gi = readFileSync(join(HERE, '..', '..', 'apps', 'mobile-rn', '.gitignore'), 'utf8')
  assert.ok(/^\/credentials$/m.test(gi), '.gitignore 必须整目录忽略 /credentials')
  assert.ok(!/^!credentials/m.test(gi), '.gitignore 里不得再出现 !credentials/… 白名单:父目录被排除时 negation 静默无效,留着等于暗示密钥可提交')
})

test('M12 商店矩阵:每家一条腿,能力缺口不得报成凭据缺口', () => {
  const ev = {
    artifacts: { status: STATUS.MISSING, detail: '夹具:无 release 产物' },
    signing: { status: STATUS.FOUND, detail: '夹具' },
    stores: STORE_VENDORS.map((v) => ({ vendor: v, cred: { status: STATUS.MISSING, detail: '夹具' } })),
  }
  const legs = buildStoreLegs(ev)
  assert.equal(legs.length, STORE_VENDORS.length, '矩阵必须逐家在册,少一家就是"账面都有而实际没有"')
  for (const leg of legs) {
    assert.ok(leg.id.startsWith('store-'), `腿 id 前缀不统一:${leg.id}`)
    assert.ok(leg.checks.every((c) => c.k && c.status && c.detail), `${leg.id} 判据三键不齐`)
    assert.equal(foldStatus(leg.checks.map((c) => c.status)), 'blocked', '凭据/器物缺一即不得冒 ready')
    assert.ok(leg.command.length > 8, `${leg.id} 必须自带出路`)
  }
  const harmony = legs.find((l) => l.id === 'store-harmony')
  assert.match(harmony.checks.find((c) => c.k === '上传通道器物').detail, /无 RN 鸿蒙产物能力/, '鸿蒙要如实报"产物能力都没有",不能混成"缺凭据"')
  const huawei = STORE_VENDORS.find((v) => v.id === 'huawei')
  assert.match(huawei.note, /HMS OAuth/, '华为那枚实测是 HMS OAuth 客户端凭据(过 AGC Connect API 回 203890688),这条结论必须留在册上')
  assert.match(huawei.note, /Connect API/, '出路要点名缺的是 Connect API 客户端凭据')
})

test('M13 商店凭据按厂商匹配、且绝不外泄字段值', async () => {  const lib = await import(import.meta.resolve('../lib/rn-release-credentials.mjs'))
  const { STORE_VENDORS: vendors, storeCredential, STATUS: ST } = lib.__test__
  assert.ok(Array.isArray(vendors) && vendors.length >= 6, '矩阵至少要覆盖国内主流商店')
  const src = readFileSync(join(HERE, '..', 'lib', 'rn-release-credentials.mjs'), 'utf8')
  const body = src.slice(src.indexOf('export function storeCredential'), src.indexOf('export function androidArtifacts'))
  assert.ok(!/console\.(log|info)/.test(body), 'storeCredential 自身不得打印任何内容(值只能由调用方以摘要形态输出)')
  const fake = { match: /不可能存在的厂商名zz/, label: '夹具厂' }
  const r = storeCredential(fake, { root: 'D:/不存在的密钥根-zz' })
  assert.equal(r.status, ST.MISSING, '根存在但无匹配 ⇒ 判 missing')
  const u = storeCredential(fake, { root: null })
  assert.equal(u.status, ST.UNJUDGED, '根解析不出必须落未判定,不得判成"该厂商无凭据"(§0.3)')
})

test('M14 通道鉴别器三臂:HTML/非 JSON 一律未判定,绝不读成"对方拒绝"', async () => {
  const { __test__ } = await import(import.meta.resolve('../probe-store-channel.mjs'))
  const { classifyTokenResponse, CHANNELS } = __test__
  const ok = classifyTokenResponse(200, JSON.stringify({ access_token: 'x'.repeat(40), expires_in: 3600 }))
  assert.equal(ok.status, 'found')
  assert.ok(ok.token, 'token 必须回传给调用方继续探测')
  const rejected = classifyTokenResponse(200, JSON.stringify({ ret: { code: 203890688, msg: 'client id or secret error' } }))
  assert.equal(rejected.status, 'missing', '结构化 ret.code ⇒ 这是对方的答复,可判 missing')
  assert.equal(rejected.code, 203890688)
  // 反例锁:2026-11-02 真踩过的坑 —— 我把 /api-publish/v2/... 当成端点,拿到 Nginx 的 404 HTML,
  // 差点据此写"华为没开通发布 API"。非 JSON 只能是我的形态问题,不得替对方下结论。
  const html = classifyTokenResponse(404, '<!DOCTYPE html><html><head><title>Error</title>')
  assert.equal(html.status, 'unjudged', '非 JSON 响应必须落未判定')
  assert.equal(html.kind, 'non-json')
  assert.ok(Object.keys(CHANNELS).includes('huawei'), '华为通道已证,必须在册')
})

test('M15 未核实端点的厂商:零网络调用 + 未判定(防"猜的 URL 进水")', async () => {
  const { __test__ } = await import(import.meta.resolve('../probe-store-channel.mjs'))
  const { probeVendor, CHANNELS } = __test__
  let calls = 0
  const fakeFetch = async () => {
    calls++
    return { status: 200, text: async () => '{}' }
  }
  const unverified = STORE_VENDORS.map((v) => v.id).filter((id) => !Object.keys(CHANNELS).includes(id))
  assert.ok(unverified.includes('harmony'), '鸿蒙无产物能力也不该有猜的端点,必须留在未核实集里')
  for (const id of unverified) {
    const r = await probeVendor(id, { fetchImpl: fakeFetch })
    assert.equal(r.status, 'unjudged', `${id} 未核实端点必须判未判定,不得冒 missing`)
    assert.equal(r.verdict, 'endpoint-unverified')
  }
  assert.equal(calls, 0, '未核实的厂商一条请求都不许发')
  // OPPO 特例:token 端点有官方出处、传包端点正文需登录 ⇒ 必须落"未核实"而不是"不可用"
  const oppo = await probeVendor('oppo', { fetchImpl: fakeFetch })
  assert.equal(oppo.verdict, 'publish-endpoint-unverified')
  assert.equal(oppo.status, 'unjudged')
  assert.equal(calls, 0, 'OPPO 传包端点未证 ⇒ 一条也不发')
})

test('M16 探测只打只读端点:任何厂商的 URL 都不得含写动词(防误改别人商店后台)', async () => {
  const { __test__ } = await import(import.meta.resolve('../probe-store-channel.mjs'))
  const { CHANNELS, classifySignatureProbe } = __test__
  const WRITE_VERBS = /upload|submit|audit|push|update|create|delete|release|modify|commit/i
  for (const [id, ch] of Object.entries(CHANNELS)) {
    if (typeof ch.probe !== 'function') continue
    // 只看动作段(路径最后一段):小米域名本身叫 devupload,拿整条 URL 比会误报
    const action = new URL(ch.probe('probe-app-id').url).pathname.split('/').filter(Boolean).pop()
    assert.ok(!WRITE_VERBS.test(action), `${id} 的探测动作段含写动词:${action} ⇒ 探测只准打只读查询端点`)
  }
  // 三臂:HTML ⇒ 未判定 / 参数校验类拒绝 ⇒ 缺凭据 / "功能不存在" ⇒ 我方形态未获认可,不背书
  assert.equal(classifySignatureProbe(404, '<html>nope</html>').status, 'unjudged')
  assert.equal(classifySignatureProbe(200, JSON.stringify({ code: -20002, msg: '数字签名异常' })).status, 'missing')
  assert.equal(classifySignatureProbe(200, JSON.stringify({ code: 10010, msg: '此功能不存在，请联系vivo开放平台' })).status, 'unjudged', '对方没认我的 method ⇒ 端点活着不等于调用形态对,必须落未判定')
  assert.equal(classifySignatureProbe(200, JSON.stringify({ msg: 'unknown method' })).verdict, 'endpoint-alive-but-call-shape-unverified')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
