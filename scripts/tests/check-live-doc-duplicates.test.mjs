#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 测试文件需 console 输出 */
/**
 * 守门 245(check-live-doc-duplicates.mjs)的镜像测试。
 *
 * §22c:判据只有一份 —— 折叠算法住在 scripts/dedupe-live-doc.mjs,本文件与门体都 import 它,
 * 谁都不许再写第二份"数字归一"。这里锁三件事:
 *  ① 读数语义(按行数 / 换数字也算副本 / 唯一内容不计 / 短行与围栏不计);
 *  ② 守恒(A1 形态不缩 ∧ A3 只删不改 ∧ A4 横幅不动)—— 摘掉守卫即翻红;
 *  ③ 装车形状锁(读 runner 现值,不读文档)。
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { __test__ as G } from '../check-live-doc-duplicates.mjs'
import { __test__ as D } from '../dedupe-live-doc.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const cases = []
const ok = (name, cond) => cases.push({ name, pass: Boolean(cond) })

const LONG = '对外关键数字声明(与本页生成块同源,均现算):606 张表 · 4557 API 路由 · 25 个 WebSocket 端点'
const LONG2 = '对外关键数字声明(与本页生成块同源,均现算):608 张表 · 4558 API 路由 · 25 个 WebSocket 端点'
const UNIQUE = '这一段只出现一次,讲的是别的机制,长度足够参与形态折叠'

ok('门体与折叠器同一把尺(duplicateCount == planCollapse.drop.size)',
  G.duplicateCount([LONG, LONG, LONG2].join('\n')) === D.planCollapse([LONG, LONG, LONG2].join('\n')).drop.size)
ok('按行数计份数(三份同形态 ⇒ 两行副本)', G.duplicateCount([LONG, LONG, LONG2].join('\n')) === 2)
ok('换了数字的同形态副本同样计入', G.duplicateCount([LONG, LONG2].join('\n')) === 1)
ok('唯一内容读数为 0', G.duplicateCount([LONG, UNIQUE].join('\n')) === 0)
ok('短行不计(表格分隔不是副本)', G.duplicateCount(['| --- | --- |', '| --- | --- |'].join('\n')) === 0)
ok('代码围栏内反复不计', G.duplicateCount(['```', LONG, LONG, '```'].join('\n')) === 0)

// 守恒档:摘掉 A3 会允许"改写行"混进产物,摘掉 A4 会把水印横幅挪位 —— 两档各有成对夹具
// A4 的射程是文档开头三行(水印横幅位);夹具把副本放到横幅位之外,才能单独验 A3
const bannerLine = '#!/usr/bin/env node —— 这行代表水印横幅,唯一形态,永远不该被折叠'
const secondHead = '// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。'
const bad3 = [bannerLine, secondHead, LONG, LONG2].join('\n')
const c3 = D.collapse(bad3)
ok('A3 夹具:产物每一行都逐字来自输入',
  c3.violations.length === 0 && c3.text.split('\n').every((l) => bad3.split('\n').includes(l)))
const fenceMoved = [bannerLine, secondHead, 'x'.repeat(30), 'y'.repeat(30), 'y'.repeat(30), 'z'.repeat(30)].join('\n')
ok('折叠只删副本,幸存行顺序与内容逐字不变',
  D.collapse(fenceMoved).text ===
    [bannerLine, secondHead, 'x'.repeat(30), 'y'.repeat(30), 'z'.repeat(30)].join('\n'))
const bannerDup = [LONG, LONG, UNIQUE].join('\n')
ok('A4 有牙:横幅位自身是副本时必点名', D.collapse(bannerDup).violations.some((v) => v.startsWith('A4')))

// 被审面清单是活的:六份文档少一份就是射程收窄(§0.7 豁免必须带出口,清单不许静默缩)
ok('被审文档含四语言 README 与 AGENTS/PLAN 共 6 份', G.AUDITED_DOCS.length === 6 &&
  ['README.md', 'README.en.md', 'README.ko.md', 'README.ja.md', 'AGENTS.md', 'PROJECT_PLAN.md'].every((d) => G.AUDITED_DOCS.includes(d)))

// 形状锁:装车证明读 runner 现值
const runner = readFileSync(path.join(ROOT, 'scripts', 'guardian-runner.mjs'), 'utf8')
const at = runner.indexOf("id: '245'")
const entry = at < 0 ? null : runner.slice(at, runner.indexOf('\n  },', at))
ok('245 已登记进 runner', Boolean(entry) && entry.length > 80)
ok('245 mode blocking 在位', Boolean(entry) && /mode:\s*'blocking'/.test(entry))
ok('245 skipEnv 成套', Boolean(entry) && /HUSKY_SKIP_LIVE_DOC_DUPLICATES/.test(entry))
ok('245 射程点名六份活文档', Boolean(entry) && /PROJECT_PLAN\.md/.test(entry) && /README/.test(entry))

// 门体不得自带第二份折叠算法(§22c:两份必然漂移)
const gate = readFileSync(path.join(ROOT, 'scripts', 'check-live-doc-duplicates.mjs'), 'utf8')
ok('门体 import 折叠器而非另写一份', /from '\.\/dedupe-live-doc\.mjs'/.test(gate) && !/replace\(\/\[0-9\]\+/g.test(gate))
ok('两面旗同给落未判定(§0.4)', /两面旗同给/.test(gate))
ok('锚点取不到不拿 0 冒充', /锚点面取不到/.test(gate))
ok('枚举 0 份被审文档判死', /枚举到 0 份/.test(gate))

// 本枚修复的落地面是 HEAD blob(工作树那几份是别席滞后副本,不能当判据面)——
// 因此"修完是否真归零"由门体在 HEAD 面自证,本文件不读盘上副本。

let rc = 0
for (const c of cases) {
  console.log(`${c.pass ? '✅' : '❌'} ${c.name}`)
  if (!c.pass) rc = 1
}
console.log(`mirror ${cases.filter((c) => c.pass).length}/${cases.length}`)
process.exit(rc)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
