// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 造页器「壳承载形制」两条新拒则的镜像测试(§22c:import 源 __test__,零复制判据)。
 *
 * 立因(2026-10-26 实测,weapp 构建输出里的两条 ModuleDependencyWarning):
 *   ① export 'default' (imported as 'DashboardScreenShell') was not found in
 *      '@rn-shells/DashboardScreen' (possible exports: DashboardScreen)
 *      —— 造页器无条件写默认导入,而 5 枚已落壳承载页里 4 枚的壳只有具名导出。
 *      webpack 对此只给**警告**:页面编译得过、运行时组件是 undefined,账面全绿而屏幕空白。
 *   ② 同名 RN 壳文件不存在(上一轮 ConsoleTableScreen / SwitchPrefsScreen 两枚),
 *      Taro 解析别名后当场 "…ConsoleTableScreen.vue doesn't exist",整条构建停摆。
 * 两条都不是"人忘了改",是造页器自己产出的形态没有对过壳的现读出口 ⇒ 修在器物里。
 *
 * 钉死四件事:
 *   B1 壳只有具名导出 ⇒ 产出**具名**取用(绝不再写默认导入);
 *   B2 壳有默认导出 ⇒ 产出默认取用(反控:B1 的修法不得把好端端的形态也改掉);
 *   B3 两种都不认 ⇒ 返回 error(上层转 refuse),不产出"猜一个"的页面;
 *   B4 接线与单一真相源:同名壳校验在射程内、壳文来自现读面、导出形态判据 import lib/rn-shell-refs。
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'

import { __test__ as G } from '../gen-miniapp-mirror.mjs'

const SRC = readFileSync(resolve(import.meta.dirname, '..', 'gen-miniapp-mirror.mjs'), 'utf8')
const shell = (name) => ({ spec: `packages/app/src/features/x/${name}Screen.tsx`, base: name })

test('B1 壳只有具名导出 ⇒ 产出具名取用(默认导入会让运行时组件变 undefined)', () => {
  const out = G.buildShellPage({
    ...shell('Dashboard'),
    shellText: 'export function DashboardScreen() {}\n',
  })
  assert.equal(typeof out, 'string')
  assert.match(out, /import \{ DashboardScreen as DashboardScreenShell \} from '@rn-shells\/DashboardScreen'/)
  assert.equal(/^import DashboardScreenShell from/m.test(out), false, '壳没有默认导出时不得再写默认导入')
  assert.match(out, /<DashboardScreenShell \/>/, 'JSX 必须引用实际绑定到的那个名字')
})

test('B2 壳有默认导出 ⇒ 产出默认取用(反控:别把对的形态一起改掉)', () => {
  const out = G.buildShellPage({
    ...shell('DomainHub'),
    shellText: 'export default function DomainHubScreen() {}\n',
  })
  assert.match(out, /^import DomainHubScreenShell from '@rn-shells\/DomainHubScreen'$/m)
})

test('B3 两种都不认 ⇒ error(交上层 refuse),不猜一个能编过的空壳', () => {
  const r = G.buildShellPage({ ...shell('Login'), shellText: 'export const unrelated = 1\n' })
  assert.equal(typeof r, 'object')
  assert.match(r.error, /既无 default 导出也没有具名 LoginScreen/)
  assert.match(r.error, /unrelated/, '点名现读到的真实出口,人才有可能一眼修壳')
})

test('B4 接线:同名壳先验、壳文取现读面、导出形态判据是单一真相源', () => {
  assert.match(SRC, /opts\.form === 'shell' && !rnRels\.includes\(shellRel\)/, '缺同名 RN 壳的射程校验被摘掉 ⇒ 又能产出悬空页')
  assert.match(SRC, /shellText: rnMap\.get\(shellRel\)/, '壳文必须来自现读面,不许留空串默认值')
  assert.match(SRC, /from '\.\/lib\/rn-shell-refs\.mjs'/, '导出形态判据不得在本器里再写一份')
  assert.equal(/function shellExportShapeOf\s*\(/.test(SRC), false, '本器不得自带第二份壳出口形态判据')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
