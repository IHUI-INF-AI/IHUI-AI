// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * `scripts/cert-expiry-check.mjs` 的镜像测试(AGENTS.md §22c)。
 *
 * 只钉一件事:**PEM 的类型必须由内容决定,不能由文件名决定**。
 * 现场(2026-09-27):`cert/pub_key.pem` 是微信支付"公钥模式"签发的 `-----BEGIN PUBLIC KEY-----`,
 * 而旧分类写的是 `f.includes('key')` ⇒ 它被当成私钥送进 `createPrivateKey`,必然报
 * `DECODER routines::unsupported` ⇒ 这份周报**永远挂着一条 error**。永远红的项与永远红的门
 * 是同一种病:读的人学会跳过整份报告,真过期那天也一起被跳过。
 *
 * ⚠ 被测脚本顶层就是 CLI 主体(它没有 §22d 的 isDirectRun 守卫,加它属另一件事),
 *   所以这里**不 import 判据** —— 一 import 就会跑完整检查并 process.exit。改用
 *   "真跑一次 + 读 --json" 的端到端形态,配两条源码形状锁(桶名与 kind 同名、文件名不再参与判定)。
 *   这与 `merge-live-doc` 镜像测试同一处境同一处置。
 */

import { maskCommentsAndStrings } from '../lib/code-mask.mjs'
import { mkdtempSync, copyFileSync, writeFileSync, rmSync, readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'

const here = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(here, '..', '..')
const SRC = join(here, '..', 'cert-expiry-check.mjs')
const src = readFileSync(SRC, 'utf8')

/** 用真件证书/私钥/公钥 + 一个怪形态组一个临时目录(不自己伪造密钥材料) */
function fixture() {
  const dir = mkdtempSync(join(resolve(REPO, '..', 'DevEnv', 'Temp'), 'cert-mirror-'))
  for (const f of ['apiclient_cert.pem', 'apiclient_key.pem', 'pub_key.pem'])
    copyFileSync(join(REPO, 'cert', f), join(dir, f))
  // 一个既不是证书也不是密钥的 PEM 形态:必须落"未判定",不得被算成 ok 或 error
  writeFileSync(join(dir, 'weird.pem'), '-----BEGIN X509 CRL-----\nQUJD\n-----END X509 CRL-----\n')
  return dir
}

function run(dir) {
  let stdout = ''
  let status = 0
  try {
    stdout = execFileSync(process.execPath, [SRC, '--dir', dir, '--json'], {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 120_000,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  } catch (e) {
    status = typeof e.status === 'number' ? e.status : -1
    stdout = `${e.stdout || ''}`
  }
  // --json 走的是 JSON.stringify(..., null, 2):整段 stdout 就是那个对象(人读日志在 json 档全静音)
  let json = null
  try {
    json = JSON.parse(stdout.trim())
  } catch {
    json = null
  }
  return { status, json, stdout }
}

test('M1 公钥按内容识别为公钥、只验可解析、不判到期也不报错误', () => {
  const dir = fixture()
  try {
    const { json } = run(dir)
    assert.ok(json, '--json 必须可 parse(供监控接入)')
    const pub = json.items.find((i) => String(i.file).endsWith('pub_key.pem'))
    assert.ok(pub, '公钥这条必须出现在结果里(被静默跳过就是没判)')
    assert.equal(pub.type, 'public-key', `公钥必须按内容归公钥桶,实得 ${pub.type}`)
    assert.equal(pub.severity, 'ok', `可解析的公钥不该计错误,实得 ${pub.severity}`)
    assert.match(String(pub.note), /无到期|不判/, '要明写"没判有效期" —— 不得读成"已确认证书有效"')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('M2 回归锁:pub_key.pem 不得再被送进私钥解析(那正是永远挂一条 error 的成因)', () => {
  const dir = fixture()
  try {
    const { json } = run(dir)
    const pub = json.items.find((i) => String(i.file).endsWith('pub_key.pem'))
    assert.notEqual(pub.type, 'key', '归到私钥桶就是回到旧缺陷')
    assert.ok(!String(pub.message || '').includes('DECODER'), '不得再出现 createPrivateKey 的解码错误')
    assert.equal(json.error, 0, `error 必须为 0,实得 ${json.error}`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('M3 怪形态 PEM 落"未判定":独立计数、不冒充通过也不冒红', () => {
  const dir = fixture()
  try {
    const { json, status } = run(dir)
    const weird = json.items.find((i) => String(i.file).endsWith('weird.pem'))
    assert.ok(weird, '未识别的形态必须报名,静默跳过等于没看')
    assert.equal(weird.severity, 'unjudged')
    assert.equal(json.unrecognized, 1)
    assert.equal(status, 0, '一条"判不出"不该把整份检查钉红(那会长出一条无人理的假红)')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('M4 形状锁:分流桶名必须与 kind 逐字同名,且文件名不再参与判定', () => {
  // 判据面 = **剥掉注释与字符串之后的代码**。不剥会翻两种车:① 本文件头注原文引用了旧写法
  // `f.includes('key')` 作为病因说明 ⇒ 锁把"解释缺陷的散文"判成"缺陷回来了";② 反向,把真正
  // 需要禁的字符串常量也遮掉。这里两条 doesNotMatch 锁的都是**标识符位**上的属性名,遮罩不影响它们。
  const code = maskCommentsAndStrings(src)
  const m = src.match(/const buckets = \{([^}]*)\}/)
  assert.ok(m, '找不到分流桶声明 ⇒ 分流换了写法,本锁要跟着改而不是默默失效')
  const keys = [...m[1].matchAll(/'?([a-z-]+)'?:/g)].map((x) => x[1])
  for (const kind of ['cert', 'private-key', 'public-key', 'other', 'unknown'])
    assert.ok(keys.includes(kind), `桶里缺 kind ${kind} —— 取不到就会把正常文件判成"未识别"`)
  // 第一版就是翻在这儿:分类器给 private-key 而桶叫 key
  assert.doesNotMatch(code, /includes\(\s*['"]key['"]\s*\)/, '按文件名猜密钥类型就是本次要修的缺陷,不得回来')
  assert.doesNotMatch(code, /includes\(\s*['"]platform['"]\s*\)/, '平台证书同理:名字不决定它是不是证书')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
