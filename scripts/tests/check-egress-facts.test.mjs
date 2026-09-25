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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
