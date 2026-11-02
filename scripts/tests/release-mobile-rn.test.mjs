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
const { foldStatus, checkSubmitProfile, findChannel, probeRuntimeVersion, buildLegs, exitCode, PLAY_PACKAGE, SA_SLOT_REL, STATUS } = __test__

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
    latest: { android: { status: STATUS.FOUND, detail: 'x' }, ios: { status: STATUS.MISSING, detail: 'x' } },
    submit: { status: STATUS.FOUND, detail: 'x' },
    saKey: { status: STATUS.FOUND, detail: 'x' },
    slot: { status: STATUS.FOUND, detail: 'x' },
    apple: { status: STATUS.MISSING, detail: 'x' },
    xcode: { status: STATUS.MISSING, detail: 'x' },
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

test('M11 凭据槽位路径与 .gitignore 在册规则一致(忽略不生效即拒落)', () => {
  assert.ok(SA_SLOT_REL.startsWith('credentials/'), `槽位必须落在 credentials/ 下,现为 ${SA_SLOT_REL}`)
  const gi = readFileSync(join(HERE, '..', '..', 'apps', 'mobile-rn', '.gitignore'), 'utf8')
  assert.ok(/^\/credentials$/m.test(gi), '.gitignore 必须整目录忽略 /credentials')
  assert.ok(!/^!credentials/m.test(gi), '.gitignore 里不得再出现 !credentials/… 白名单:父目录被排除时 negation 静默无效,留着等于暗示密钥可提交')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
