// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * §22c 镜像测试:`scripts/check-egress-facts.mjs`(出口事实对账)。
 *
 * 为什么单独有一份(而不是只靠 `--self-test`):`--self-test` 跑的是**门自己**的判据函数,
 * 它绿只证明"判据在构造输入上有牙";本文件证的是**门有没有装车**、以及它的输入是否
 * 真取自仓库里那几张表(而不是门里抄的一份)。本票刻意**不接** guardian-runner,
 * 所以装车证明落在三件真实存在的事上:
 *   T1 门按 §22c 导出 `__test__` 且本测试真的 import(不是复制一份判据);
 *   T2 域名表来源文件在位,且门从中真推出域名(表被改名/搬走 ⇒ 本测试红,而不是门悄悄绿灯);
 *   T3 唯一包装函数与它挂载实的出口在位:被点名的 `fetchWithTimeout` 必须真的
 *      调 `attachEgressFacts`(门判的是"绕开它",它自己没挂上就是整门空转);
 *   T4 基线 JSON 结构可用(坏 JSON 必须显式报错,不得被当成空清单)。
 */
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const GATE = resolve(ROOT, 'scripts/check-egress-facts.mjs')
/** 动态 import 必须喂 file:// URL:Windows 的 `G:\…\x.mjs` 裸路径在 ESM 里不是合法说明符。*/
const GATE_URL = pathToFileURL(GATE).href

const load = async () => import(GATE_URL)

test('T1 门按 §22c 导出 __test__,测试 import 的是它而不是复制判据', async () => {
  const src = readFileSync(GATE, 'utf8')
  const self = readFileSync(fileURLToPath(import.meta.url), 'utf8')
  assert.match(src, /export const __test__ = \{/, '门必须导出 __test__ 锚点')
  // 本测试必须**取自门那份实现**(动态 import 亦可),并且没有复制一份判据。
  // needle 必须拼出来:直接写 /function analyzeFile/ 会让这条断言量到它自己的源码行,
  // 于是"我引用了这个函数名"被当成"我复制了它的实现"而恒红(字面量尺子量到自己)。
  const copiedImpl = new RegExp(`func${'tion '}analyzeFile\\s*\\(`)
  assert.match(self, /import\(GATE_URL\)/, '本测试必须 import 门的实现(且喂 file:// URL)')
  assert.equal(copiedImpl.test(self), false, '禁止在测试里复制源判据(§22c 镜像漂移)')
  const { __test__ } = await load()
  for (const key of ['analyzeFile', 'deriveVendorDomains', 'decide', 'decideRatchet', 'prefilterArgs', 'stripComments'])
    assert.equal(typeof __test__[key], 'function', `__test__ 缺少 ${key}`)
})

test('T2 厂商域名表来源全部在位,且真能推出域名(不硬编码第二份清单)', async () => {
  const { __test__ } = await load()
  assert.ok(__test__.DOMAIN_TABLE_SOURCES.length >= 2, '至少要核对两张既有表')
  for (const spec of __test__.DOMAIN_TABLE_SOURCES) {
    const abs = resolve(ROOT, spec.file)
    assert.ok(existsSync(abs), `域名表来源文件不存在:${spec.file}(门会对整类绕档全盲)`)
  }
  const derived = __test__.deriveVendorDomains({
    sources: __test__.DOMAIN_TABLE_SOURCES.map((s) => ({ ...s, text: readFileSync(resolve(ROOT, s.file), 'utf8') })),
  })
  assert.ok(derived.domains.length > 20, `从仓库真表只推出 ${derived.domains.length} 个域名 —— 表多半被改名了`)
  assert.ok(derived.domains.includes('api.openai.com'), 'VENDORS 表里 api.openai.com 必须被读到')
  assert.ok(derived.provenance.every((p) => p.status === 'ok'), '任一来源表为空都说明判据依据已漂移')
})

test('T3 唯一包装函数在位且真的挂出口事实(否则本门判的是不存在的东西)', async () => {
  const wrapper = readFileSync(resolve(ROOT, 'apps/api/src/routes/ai-vendors/_shared.ts'), 'utf8')
  assert.match(wrapper, /export async function fetchWithTimeout/, '包装函数必须还在(摘掉=门对整个厂商出站面失明)')
  assert.match(wrapper, /collectEgressFacts\(/, '包装函数必须计算出口事实')
  assert.match(wrapper, /attachEgressFacts\(/, '包装函数必须把事实挂到响应上')
  assert.equal((wrapper.match(/attachEgressFacts\(/g) ?? []).length >= 2, true, '代理与直连两条分支都要挂')

  const dispatcher = readFileSync(resolve(ROOT, 'apps/api/src/utils/proxy-dispatcher.ts'), 'utf8')
  assert.match(dispatcher, /export function isProxiedUrl\(url: string\): boolean \{\n\s*return collectEgressFacts\(url\)\.proxied\n\s*\}/, '路由判定必须是事实的投影(判据只有一份)')
})

test('T4 基线 JSON 可用:坏 JSON 显式报错,不当成空清单', async () => {
  const p = resolve(ROOT, 'scripts/egress-facts-baseline.json')
  assert.ok(existsSync(p), '缺基线 = 所有存量一夜判红(恒红门 ⇒ 逼人 --no-verify)')
  const parsed = JSON.parse(readFileSync(p, 'utf8'))
  assert.equal(typeof parsed.counts, 'object')
  assert.notEqual(parsed.counts, null)
  for (const [file, n] of Object.entries(parsed.counts)) {
    assert.equal(typeof n, 'number', `${file} 的额度不是数字`)
    assert.ok(n > 0, '基线只记非零条目(0 与缺条目同义,记 0 会让文件随仓库线性膨胀)')
  }
})

test('T5 判据方向:绕开包装=红,走包装=绿(构造面,不依赖仓库瞬时状态)', async () => {
  const { __test__ } = await load()
  const domains = ['api.openai.com']
  assert.equal(__test__.analyzeFile({ path: 'x.ts', content: "await fetch('https://api.openai.com/v1')", vendorDomains: domains }).hard.length, 1)
  assert.equal(__test__.analyzeFile({ path: 'x.ts', content: "await fetchWithTimeout('https://api.openai.com/v1')", vendorDomains: domains }).hard.length, 0)
  // 预筛必须是判据字面量的超集:HEAD 档的修订位置错了,门会退化成"什么都没扫"的绿灯
  const args = __test__.prefilterArgs({ domains, staged: false })
  assert.ok(args.indexOf('HEAD') > args.indexOf('-e') && args.indexOf('HEAD') < args.indexOf('--'))
  // 空枚举 / 空表都必须判死,绝不记绿
  assert.equal(__test__.decide({ verdicts: [], undetermined: 0, provenance: [], enumerated: false, domainCount: 3 }).exit, 2)
  assert.equal(__test__.decide({ verdicts: [], undetermined: 0, provenance: [], enumerated: true, domainCount: 0 }).exit, 2)
})

/**
 * T6 —— 取材面纪律的形状锁(2026-09-27 立,清偿守门 118「散写 git」那一维的第 11 枚)。
 *
 * 为什么要有它:本门在 2026-09-27 之前是**自己绑一个裸 git 常量再逐文件派生**去取正文的
 * (`const GIT_BIN = process.env.GIT_BIN || <裸名>`),这正是 face-reader 层存在要防的那一型
 * —— 绝对 git 路径 / quotepath / stdio / maxBuffer / 头解析各写一遍,漏一处就是一次静默取不到。
 * 判据语义(判什么)不由本条看守,本条只钉"从哪取、用什么管子取"不得退回散写。
 *
 * 三条锁的**输入形状**与 `check-gate-face-discipline.mjs` 的 classify 一致(它认 `catBatch` /
 * `readWorktreeFile` 为读取出口),但这里是按源码形状判,不复用它的遮噪机 —— 遮噪机若漂,
 * 本条会红而不是静默(散写一旦回来,门 118 的 loose 计数也会跟着涨,两把尺子互为对照)。
 */

/** 自己派生进程的字面量(用拼接构造,免得本测试文件自己成为被量的形状)。 */
const SPAWN_FN = 'exec' + 'FileSync'
const SPAWN_RE = new RegExp(`\\b(?:${SPAWN_FN}|execSync|spawnSync|spawn)\\s*\\(`)
/** 把标识符绑到裸 git 二进制(型 B 的输入:引号包住的裸名)。 */
const BARE_GIT_Q = "'" + 'git' + "'"
const BARE_GIT_RE = new RegExp(`["']git(?:\\.exe)?["']`)

const spawnsOwnProcess = (text) => SPAWN_RE.test(text)
const bindsBareGit = (text) => BARE_GIT_RE.test(text)

test('T6 取材必须走层:引层 + 真调用层的读取出口,且不得再自己派生进程 / 绑裸 git', async () => {
  const src = readFileSync(GATE, 'utf8')

  // ── 阳性对照:这三把尺子必须先证明抓得住散写形态,否则"零命中"只是尺子坏了(§22c 复读机教训)
  const badSpawn = `${SPAWN_FN}(${BARE_GIT_Q}, ['show', 'HEAD:a.ts'])\n`
  assert.equal(spawnsOwnProcess(badSpawn), true, '阳性对照失效:连自己派生都抓不住 ⇒ 下面的 0 不作数')
  assert.equal(bindsBareGit(badSpawn), true, '阳性对照失效:抓不住绑到裸 git 的常量')
  assert.equal(
    spawnsOwnProcess(`const GIT_BIN = process.env.GIT_BIN || ${BARE_GIT_Q}\n${SPAWN_FN}(GIT_BIN, ['ls-files'])\n`),
    true,
    '阳性对照:型 B(常量绑裸名)那一型必须在射程内',
  )
  // ── 反向对照:走了层的正确写法不得误报(否则本条会把好门钉红,逼人削判据)
  const goodLayer =
    "import { catBatch, gitRaw } from './lib/face-reader.mjs'\nconst m = catBatch(ROOT, ['HEAD:a.ts'])\nreturn gitRaw(['ls-files'], ROOT)\n"
  assert.equal(spawnsOwnProcess(goodLayer), false, '正确写法被误伤:走层不得算散写')
  assert.equal(bindsBareGit(goodLayer), false, '正确写法被误伤:层调用里的 HEAD:a.ts 不是裸 git 名')

  // ── 对本门的三条断言
  assert.match(
    src,
    /from '\.\/lib\/face-reader\.mjs'/,
    '门必须 import 共用取材层 —— 否则 stdio[0]=pipe / maxBuffer / 字节装箱这些坑又各抄一遍',
  )
  assert.match(
    src,
    /(?:catBatch|readWorktreeFile)\s*\(/,
    '引了层却没调用它的读取出口 = 半接线(守门 118 对这一型全盲,所以在这里单独钉死)',
  )
  assert.equal(
    spawnsOwnProcess(src),
    false,
    '门里仍在自己派生进程取内容:正文必须经 catBatch(HEAD/索引)或 readWorktreeFile(工作树档)',
  )
  assert.equal(
    bindsBareGit(src),
    false,
    '门里仍出现被引号包住的裸 git 二进制名(型 B:GUI 宿主/服务账户下 PATH 与交互终端不通,取数会静默失败)',
  )
  // 面旗互斥与"取不到即 exit 2"是本门对外契约的一部分,形状不得在迁移中丢
  assert.match(src, /--staged 与 --worktree 同时给出/, '两面旗同给必须判死(不得任选一边悄悄取)')
  assert.match(src, /无法判定:取材面/, '该面取不到必须喊"无法判定"而非回落另一面')
})

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
