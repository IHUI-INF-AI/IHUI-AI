// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 壳注入腿(rn-shell-replace-plugin)的镜像测试。
 *
 * 立因(2026-10-26 现读):插件旧版按**请求字面量**等值改写(`r.request === data.request`),
 * 于是只有恰好写成 `'../i18n'` 的那条被接到端内;写成 `'../../i18n'` / `'../i18n/index'` 的
 * 照样落进 `apps/mobile-rn/src/i18n/index.tsx` —— 那个文件内联 import 了 10 份 JSON 词包
 * (shared 五语 + mobile-rn 五语)。后果不是"体积偏大"而是**单一真相源被绕过**:
 * 实测 `pkg-user/dashboard/index.js` 里字符串字面量占 68.6%、最长的一条条是法务文案,
 * 单页 1,382,817 B;改成按"解析到哪模块"判定后同一文件 25,180 B。
 *
 * 本文件是 config 目录下的 .ts,node 不能直接 import ⇒ 用仓里已有的 typescript 转译成 .mjs
 * 落到 .ihui-agent/tmp/ 再 import(不落仓库树内、不复制第二份判据,§22c)。
 *
 * 钉死五件事:
 *   R1 `'../i18n'` / `'../../i18n'` / `'../i18n/index'` 三种写法一律改写(旧版只认第一种);
 *   R2 发起方不是 RN 侧 ⇒ 一律不动(端内自己那条 `../i18n` 必须原样);
 *   R3 名字相近但不是那个模块(`../i18n-utils`)不得被顺手改写(按前缀匹配会把邻居拖进来);
 *   R4 裸包名(不以 `.` 开头)交给 alias 那一层,本插件不碰;
 *   R5 Windows 反斜杠形态(请求串与 issuer 两种)与 issuer 是文件路径的形态都要命中。
 */
import assert from 'node:assert/strict'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join, resolve } from 'node:path'
import test from 'node:test'
import { pathToFileURL } from 'node:url'

const require_ = createRequire(import.meta.url)
const ts = require_('typescript')
const ROOT = resolve(import.meta.dirname, '..', '..')
const SRC = join(ROOT, 'apps/miniapp-taro/config/rn-shell-replace-plugin.ts')
const OUT_DIR = join(ROOT, '.ihui-agent/tmp/gap-triage/plugin-test')
mkdirSync(OUT_DIR, { recursive: true })
const OUT = join(OUT_DIR, 'rn-shell-replace-plugin.transpiled.mjs')
const { outputText } = ts.transpileModule(readFileSync(SRC, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
})
writeFileSync(OUT, outputText, 'utf8')
const { RnShellReplacePlugin, normalizeModuleKey } = (await import(pathToFileURL(OUT).href)).__test__

const RN_I18N_BASE = '/repo/apps/mobile-rn/src/i18n'
const RULES = [
  { base: RN_I18N_BASE, to: '/repo/apps/miniapp-taro/src/rn-compat/i18n.ts' },
  { base: '/repo/apps/mobile-rn/src/context/ThemeContext', to: '/repo/apps/miniapp-taro/src/rn-compat/theme.tsx' },
]

/** 起一个假 compiler,只交出 beforeResolve 钩子,喂一条 resolve 数据看它被改成什么。 */
function fire(data, rules = RULES, marker = 'apps/mobile-rn/src/') {
  let hook = null
  const compiler = {
    options: {},
    hooks: { normalModuleFactory: { tap: (_n, fn) => fn({ hooks: { beforeResolve: { tap: (_m, f) => (hook = f) } } }) } },
  }
  new RnShellReplacePlugin(rules, marker).apply(compiler)
  hook(data)
  return data.request
}

test('R1 三种写法一律改写(旧版只认 ../i18n 那一种)', () => {
  assert.equal(fire({ request: '../i18n', context: '/repo/apps/mobile-rn/src/screens' }), RULES[0].to)
  assert.equal(
    fire({ request: '../../i18n', context: '/repo/apps/mobile-rn/src/features/x' }),
    RULES[0].to,
    '旧版在这一条上什么都不做 ⇒ RN 词包整包进分块',
  )
  assert.equal(fire({ request: '../i18n/index', context: '/repo/apps/mobile-rn/src/screens' }), RULES[0].to)
})

test('R2 发起方不是 RN 侧 ⇒ 一律不动(端内自己那条 ../i18n 必须原样)', () => {
  assert.equal(
    fire({ request: '../i18n', context: '/repo/apps/miniapp-taro/src/api' }),
    '../i18n',
    '把端内的取词请求改到 RN 侧落点 = 同一份词包换一条路再漂移',
  )
})

test('R3 名字相近但不是那个模块 ⇒ 不顺手改写', () => {
  assert.equal(
    fire({ request: '../i18n-utils', context: '/repo/apps/mobile-rn/src/screens' }),
    '../i18n-utils',
    '按目录前缀匹配会把邻居一起改掉;本尺只认归一化后的模块全等',
  )
  assert.equal(fire({ request: '.', context: '/repo/apps/mobile-rn/src/screens' }), '.')
})

test('R4 裸包名交给 alias 那一层,本插件不碰', () => {
  assert.equal(fire({ request: '@ihui/i18n/loader', context: '/repo/apps/mobile-rn/src/screens' }), '@ihui/i18n/loader')
})

test('R5 反斜杠形态与 issuer 是文件路径的形态都要命中', () => {
  // 盘符形态:base 也按 Windows 真路径给(规则与请求同一种根形态,才是这里的大头)
  const winRules = [{ base: 'D:\\repo\\apps\\mobile-rn\\src\\i18n', to: 'D:/mp/i18n.ts' }]
  assert.equal(
    fire({ request: '..\\..\\i18n', context: 'D:\\repo\\apps\\mobile-rn\\src\\components\\chat' }, winRules),
    'D:/mp/i18n.ts',
    '请求串本身带反斜杠时不归一就会整串当一个路径段 ⇒ 永远算不出落点',
  )
  assert.equal(
    fire({ request: '../i18n', contextInfo: { issuer: '/repo/apps/mobile-rn/src/screens/DashboardScreen.tsx' } }),
    RULES[0].to,
    'issuer 是文件路径时取所在目录;context 缺失也不能整个失效',
  )
  assert.equal(normalizeModuleKey('/a/b/index.tsx'), '/a/b', '归一 = 去扩展名 + 去结尾 /index')
  assert.equal(normalizeModuleKey('/a/b'), '/a/b', '目录形态与显式 index 形态必须同解')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
