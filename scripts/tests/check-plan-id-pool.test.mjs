// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 号池对账门(209)的镜像测试(§22c:判据必须从源文件 import,不得在这里再抄一份)。
 * 覆盖:① R1 识别与差值棘轮方向(存量不担责 / 新增必拦);② R2 构造级判据的失明臂与误伤臂;
 * ③ 单源锁(池上限、编号头形状、声明位判据都只许有一份);④ 豁免名单不扩的反向锁;
 * ⑤ 未判定不冒充通过(§0.3)。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { __test__ as G, overPoolDeclarations, poolRatchetVerdict, allocPathHits } from '../check-plan-id-pool.mjs'
import { LEASE_POOL_MAX } from '../lib/plan-id-lease.mjs'
import { maskComments } from '../lib/code-mask.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const SRC = (rel) => readFileSync(resolve(HERE, '..', rel), 'utf8')
const row = (k, n = 1) => `- [ ] ${k} **事${n}**:正文交代得很长以便过最短闸。`

test('P1 超池识别:只看声明位号;999 恰在上限内不算超,>999 才算', () => {
  const face = [row('G-999'), row('O23'), row('G-1038426'), row('D1047'), row('G-81439')].join('\n')
  const keys = overPoolDeclarations(face)
    .map((x) => x.key)
    .sort()
  assert.deepEqual(keys, ['D1047', 'G-1038426', 'G-81439'], `实得 ${keys.join(',')}`)
  // 上限本身从单源来,不在测试里写死第二个数
  assert.equal(overPoolDeclarations(face, 1000).some((x) => x.key === 'G-1038426'), true)
  assert.equal(overPoolDeclarations(row('G-999'), LEASE_POOL_MAX).length, 0)
})

test('P2 占位注释里的历史号不参与(判据过宽就是把自己变成恒红门)', () => {
  const face = `<!-- 已归档(2026-10-14:G-1080898 **守门 sync-lost-commit-tags --check**,完整内容在 x -->\n${row('O24')}\n`
  assert.equal(overPoolDeclarations(face).length, 0)
})

test('P3 差值棘轮方向(有牙):存量原样带着不红,新带一条长号必红;同键再抄也要按重数拦', () => {
  const head = `${row('G-1038426')}\n${row('O23')}`
  const same = poolRatchetVerdict(head, head)
  assert.equal(same.added.length, 0, '存量不担责被破坏')
  const worse = poolRatchetVerdict(head, head + '\n' + row('G-1099001'))
  assert.equal(worse.added.length, 1)
  assert.equal(worse.added[0].key, 'G-1099001')
  // 评审抓到的形状:HEAD 有 1 条同键、索引面抄成 3 条 ⇒ 键集合差为空,按重数必须算出 +2
  const dupKey = poolRatchetVerdict(row('G-1038426'), [row('G-1038426', 1), row('G-1038426', 2), row('G-1038426', 3)].join('\n'))
  assert.equal(dupKey.added.length, 2, `同键多抄的两条必须各算一次新增,实得 ${dupKey.added.length}`)
  // 变少永远放行(让号方向)
  const better = poolRatchetVerdict(head + '\n' + row('G-1099002'), head)
  assert.equal(better.added.length, 0)
})

test('P4 R2 构造级判据:发号构造必中,分组统计与"提到 max+1 的文字"必不中', () => {
  const offender = "const u = usedIdsOfPrefix(t, 'G')\nconst id = u.template.replace('%d', String(u.max + 1))\n"
  assert.equal(allocPathHits(offender).length, 1, '构造形状没被认出 ⇒ 判据失明')
  assert.equal(allocPathHits("const u = usedIdsOfPrefix(t, 'G')\nconsole.log(u.used, u.max)\n").length, 0, '分组统计被误伤')
  assert.equal(allocPathHits("// 手工 max+1 抄进正文必撞\nconst m = '不要用 max + 1 发号'\n").length, 0, '注释/字符串被误伤')
})

test('P5 单源锁:池上限 / 编号头形状 / 声明位判据都只许有一份', () => {
  const code = SRC('check-plan-id-pool.mjs')
  const masked = maskComments(code)
  assert.match(code, /from '\.\/lib\/plan-id-lease\.mjs'/, '池上限与编号头形状必须来自 plan-id-lease')
  assert.match(code, /LEASE_POOL_MAX/, '池上限不得写死第二个数')
  assert.match(code, /ID_HEAD_RE/, '编号头形状必须复用 plan-id-lease 那一份,不得在门里再抄一份正则')
  // 诚实边界(2026-10-15 评审):"哪些形态算声明位"由 keyOfRow 一家说了算,本门不扩口。
  // `G1038426` / `G_1038426` 这类 keyOfRow 认不出的写法**结构上不进本门射程** —— 那是声明位判据的
  // 口径,不是本门的漏判;要收那一型得改 keyOfRow,并让所有共用它的门一起复核。
  assert.equal(overPoolDeclarations('- [ ] G1038426 无分隔符形态').length, 0)
  assert.equal(overPoolDeclarations(row('G-1038426')).length, 1)
  assert.match(code, /idx\.keyOfRow\(/, '声明位判据必须用 plan-task-index 的 keyOfRow')
  assert.ok(!masked.includes('^([A-Za-z]+)'), '门内不得再抄一份编号头正则(第二份实现必漂开)')
  // 上限只许有一个来源:不得出现 `poolMax = 999` / `> 999` 这类把上限写死的形状
  // (self-test 夹具里的 'G-999' 是被判的数据,不是判据,所以按形状判而不按"出现过 999"判)
  const hardcoded = masked.split(/\r?\n/).filter((l) => /(poolMax|上限)\s*=\s*999|>\s*999(?!\d)|>=\s*999(?!\d)/.test(l))
  assert.equal(hardcoded.length, 0, `门体把池上限写死了:${hardcoded.join(' ;; ').slice(0, 160)}`)
})

test('P6 豁免不扩的反向锁:名单封闭、每项必须真实存在、测试目录不得进名单,且判据本体没跟着放宽', () => {
  const list = [...G.SANCTIONED_ALLOC]
  assert.equal(list.length, 6, `豁免名单项数变了(${list.length}): ${list.join(', ')} —— 新增必须连同理由与本断言一起改`)
  for (const f of list) {
    assert.ok(/\.mjs$/.test(f), `名单项形状不对:${f}`)
    assert.ok(!f.includes('/'), `名单按 basename 匹配,不得写路径(写路径就是在藏作用域):${f}`)
    assert.ok(!/\.test\.mjs$/.test(f), '测试文件不得进豁免名单')
    // 空豁免自检:名单里放一个不存在的名字 = "看着有豁免其实空转",必须当场被这条钉住
    // (HERE 已经在 scripts/tests 下 ⇒ 基准是仓库根,不能再拼一层 scripts/)
    const repoRoot = resolve(HERE, '..', '..')
    const found = ['scripts', 'scripts/lib'].some((d) => existsSync(resolve(repoRoot, d, f)))
    assert.ok(found, `豁免名单里的 ${f} 在 scripts/ 与 scripts/lib/ 都不存在 ⇒ 空豁免`)
  }
  assert.ok(!list.includes('plan-tasks.mjs'), 'plan-tasks.mjs 是统计用途,不该进名单(它靠构造级判据不被误伤,不是靠豁免)')
  // 递归扫描必须真覆盖 scripts/lib:把 offender 形状放进 lib 下的文件名也报得出来(第一版只扫一层)
  assert.equal(allocPathHits("const u = usedIdsOfPrefix(x, 'G')\nconst i = u.template.replace('%d', String(u.max + 1))").length, 1)
  const src = readFileSync(resolve(HERE, '..', 'check-plan-id-pool.mjs'), 'utf8')
  assert.match(src, /walk\(full, depth \+ 1\)/, '扫描必须递归,否则 scripts/lib 整个是盲区')
  assert.match(src, /e\.name === 'tests'/, '测试目录必须被排除(夹具不是发号通道)')
})

test('P7 未判定不冒充通过(§0.3):面取不到 ⇒ main 返 2,不是 0 也不是 1', () => {
  // 判据层的等价形状:空面 = 未判定;真·0 条违规 = 有结论
  assert.equal(overPoolDeclarations('').length, 0, '空面的 over 清单为空是"没量到",调用方必须自己判未判定')
  assert.equal(G.PLAN, 'PROJECT_PLAN.md')
  const code = SRC('check-plan-id-pool.mjs')
  assert.match(code, /return 2/, '未判定臂必须存在')
  assert.match(code, /⏭[\s\S]{0,40}未判定/, '未判定必须大声报名,不得静默')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
