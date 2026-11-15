// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‌‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 镜像测试:scripts/check-runtime-tmp-landing.mjs(守门 322)
//
// §22c:判据一律直接 import 源门的导出函数,**不在测试里复制第二份判据**。
// 这里锁住五条只能靠源码验的防线:
//  T-mask 掩码只能有一份:JS/TS 走 code-mask 的 maskCommentsAndStrings;Python 自带
//        maskPython(长度保持)。判"注释/字符串里的 tmpdir 字样不算调用"必须经掩码,
//        否则判据自身的头注就会被算成违规(守门 131/135 同条)。
//  T-wired 接线豁免是文件级:引用合规工厂 ⇒ 全部残留降级 M1 只报数,不判红。
//  T-ratchet 差值棘轮只拦新增:staged 计数 > HEAD 锚点才判红;存量只报数。默认档
//        (head 面)按构造恒为新增 0 —— 必须由 decide 的 face 分支锁住,防有人顺手升档。
//  T-scope 测试面不在射程:tests/__tests__/*.test.*/test_*.py/e2e/fixtures 不判。
//  T-face 取材面纪律:清单与内容同面同轮,只能经 lib/face-reader.mjs 读。

import test from 'node:test'
import assert from 'node:assert/strict'

import {
  judgeSource,
  decide,
  inScope,
  maskPython,
  STRUCTURAL_EXCLUDES,
} from '../check-runtime-tmp-landing.mjs'

test('T-mask-1 JS 未接线真落盘 → F1 命中,未接线', () => {
  const j = judgeSource(
    'apps/cli/src/x/a.ts',
    'import * as fs from "node:fs";\nconst d = fs.mkdtempSync(path.join(os.tmpdir(), "x-"));\n',
  )
  assert.equal(j.lang, 'js')
  assert.equal(j.wired, false)
  assert.equal(j.hits.length, 2, 'tmpdir( 与 mkdtempSync( 各一处')
})

test('T-mask-2 JS 已接线 → 残留降级(wired=true),注释里的字样不算', () => {
  const j = judgeSource(
    'apps/cli/src/x/b.ts',
    "import { getRuntimeTempRoot } from '@ihui/shared';\n" +
      '// os.tmpdir() 已废弃,头注说明\n' +
      'const r = getRuntimeTempRoot();\n',
  )
  assert.equal(j.wired, true)
  assert.equal(j.hits.length, 0, '注释里的 os.tmpdir() 不算真调用')
})

test('T-mask-3 JS 字符串里的 tmpdir 不算调用(掩码防假阳)', () => {
  const j = judgeSource('apps/api/src/x/e.ts', "const s = 'os.tmpdir() 只是文档';\nconst r = 1;\n")
  assert.equal(j.hits.length, 0)
})

test('T-mask-4 Python 未接线 tempfile.mkdtemp → 命中', () => {
  const j = judgeSource('apps/ai-service/app/x/c.py', 'import tempfile\n# tempfile.mkdtemp 注释不算\nd = tempfile.mkdtemp(prefix="x-")\n')
  assert.equal(j.lang, 'py')
  assert.equal(j.wired, false)
  assert.equal(j.hits.length, 1)
})

test('T-mask-5 Python 已接线 → wired=true,残留只报数', () => {
  const j = judgeSource(
    'apps/ai-service/app/x/d.py',
    'from app.core.runtime_temp import install_runtime_temp_root\ninstall_runtime_temp_root()\nd = tempfile.mkdtemp(prefix="x-")\n',
  )
  assert.equal(j.wired, true)
  assert.equal(j.hits.length, 1)
})

test('T-pymask maskPython 长度保持(行号不漂)+ 注释/字符串抹空格', () => {
  const src = 'a = 1  # tempfile.mkdtemp 注释\nb = "tempfile.mkdtemp 字符串"\nc = tempfile.mkdtemp()\n'
  const m = maskPython(src)
  assert.equal(m.length, src.length, '长度保持 ⇒ 行号一致')
  assert.ok(!m.includes('mkdtemp 注释'), '注释已抹')
  assert.ok(!m.includes('mkdtemp 字符串'), '字符串已抹')
  // 真调用仍在(掩码只抹注释与字符串,不抹代码)
  const j = judgeSource('apps/x/pymask.py', src)
  assert.equal(j.hits.length, 1, '真调用保留')
})

test('T-scope 测试面不在射程,业务面在射程', () => {
  assert.equal(inScope('apps/cli/src/a.ts'), true)
  assert.equal(inScope('packages/shared/src/utils/x.ts'), true)
  assert.equal(inScope('apps/cli/__tests__/a.ts'), false)
  assert.equal(inScope('apps/cli/a.test.ts'), false)
  assert.equal(inScope('apps/ai-service/tests/test_x.py'), false)
  assert.equal(inScope('apps/web/e2e/a.ts'), false)
  assert.equal(inScope('apps/web/fixtures/a.ts'), false)
  assert.equal(inScope('scripts/check-x.mjs'), false, 'scripts/ 由 fixture-tmpdir 守')
  assert.equal(inScope('README.md'), false, '非可判扩展名')
})

test('T-structural 尺子自身与镜像测试被排除', () => {
  assert.ok(STRUCTURAL_EXCLUDES.has('scripts/check-runtime-tmp-landing.mjs'))
  assert.ok(STRUCTURAL_EXCLUDES.has('scripts/tests/check-runtime-tmp-landing.test.mjs'))
})

test('T-ratchet-1 staged 新增(staged 2 > head 1)⇒ 判红并点名', () => {
  const judged = [{ rel: 'a.ts', hits: [{ line: 5 }, { line: 9 }], wired: false, lang: 'js' }]
  const d = decide({ judged, anchor: new Map([['a.ts', 1]]), face: 'staged' })
  assert.equal(d.violations.length, 1)
  assert.equal(d.violations[0].count, 1)
  assert.match(d.violations[0].why, /新增 F1 1 处/)
})

test('T-ratchet-2 staged 存量(staged 1 == head 5)⇒ 只报数不判红', () => {
  const judged = [{ rel: 'a.ts', hits: [{ line: 5 }], wired: false, lang: 'js' }]
  const d = decide({ judged, anchor: new Map([['a.ts', 5]]), face: 'staged' })
  assert.equal(d.violations.length, 0)
  assert.equal(d.stock.length, 1)
})

test('T-ratchet-3 head 全量档按构造恒为新增 0', () => {
  const judged = [{ rel: 'a.ts', hits: [{ line: 5 }, { line: 9 }], wired: false, lang: 'js' }]
  const d = decide({ judged, anchor: new Map([['a.ts', 2]]), face: 'head' })
  assert.equal(d.violations.length, 0, 'head 面永不判新增(§12e 防恒红门)')
  assert.equal(d.stock.length, 1)
})

test('T-wired-gate 已接线文件的命中全部进 wiredResidual,不进 violations', () => {
  const judged = [{ rel: 'b.ts', hits: [{ line: 3 }], wired: true, lang: 'js' }]
  const d = decide({ judged, anchor: new Map(), face: 'staged' })
  assert.equal(d.violations.length, 0)
  assert.equal(d.wiredResidual.length, 1)
})

test('T-dead 新文件基线 0:staged 有命中且 HEAD 无锚点 ⇒ 判新增', () => {
  const judged = [{ rel: 'new.ts', hits: [{ line: 2 }], wired: false, lang: 'js' }]
  const d = decide({ judged, anchor: new Map(), face: 'staged' })
  assert.equal(d.violations.length, 1, '新文件首犯即拦')
})
