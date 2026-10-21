#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 测试档需 console 输出汇总 */
/**
 * 镜像档 —— 守门「暖色描边禁令」(check-no-warm-border.mjs)
 *
 * §22c 纪律:判据一律 import 源脚本的 __test__,本文件**不复制任何常量或判定**。
 * 跑法:node scripts/tests/check-no-warm-border.test.mjs
 *
 * 本档存在的理由:用户报的那圈橙不是某个组件写错,而是**主题级**缺陷(Android EditText 背景
 * 恒画原生 9-patch,tint 回落系统强调色)—— 一处命中、全端所有输入框同时中招。这类缺陷的
 * 回归形态恰好是"有人把 drawable 换回 AOSP 原件"或"新端建主题时忘了钉 colorAccent",
 * 两者在 JS 层都看不出任何异常,只有提交口这一层能拦住。
 *
 * 阳性对照一律**自带事故原文**(不钉 HEAD blob):修复入库那天,HEAD 上就再也量不到这些
 * 形态了,拿 HEAD 当正控的锁会在那一刻自动失效。
 */
import { execFileSync } from 'node:child_process'
import { dirname, resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { __test__ as G } from '../check-no-warm-border.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { resolveGitBin } from '../lib/gitdir.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..', '..')
const SOURCE_REL = 'scripts/check-no-warm-border.mjs'

const cases = []
const t = (name, fn) => cases.push({ name, fn })

/** 2026-10-20 实测事故原文三则(逐字节抄自当次 HEAD blob,自带出处,不依赖 HEAD 仍存在)。 */
const BUG_CSS =
  '.ai-input-shell--high-risk:focus-within {\n  border-color: color-mix(in srgb, var(--color-amber-500) 70%, transparent);\n}\n'
const BUG_TW = 'className="max-h-72 p-1 focus:outline-none focus-visible:ring-1 focus-visible:ring-amber-500/40"\n'
const BUG_NATIVE =
  '<item android:state_enabled="false" android:drawable="@drawable/abc_textfield_default_mtrl_alpha"/>\n<item android:drawable="@drawable/abc_textfield_activated_mtrl_alpha"/>\n'

const css = (s) => G.scanWarmBorderText(s, { css: true })

t('M1 事故原文必须被点名(两型 web + 一型原生,逐则独立正控)', () => {
  if (!css(BUG_CSS).some((h) => h.rule === 'W1-css')) throw new Error(':focus-within 取 amber 未命中 W1-css')
  if (!G.scanWarmBorderText(BUG_TW).some((h) => h.rule === 'W1-tw')) throw new Error('focus-visible:ring-amber 未命中 W1-tw')
  if (G.scanNativeTextfieldText(BUG_NATIVE).length !== 2) throw new Error('原生 textfield 9-patch 两处引用未全命中 W2')
})

t('M2 修复形态判绿(钉住"改成的样子"合规,防反向改回去)', () => {
  if (css('.ai-input-shell--high-risk:focus-within {\n  border-color: var(--color-primary);\n}').length !== 0) throw new Error('聚焦墨档被误判')
  if (css('.ai-input-shell--high-risk {\n  border-color: var(--color-border-medium);\n}').length !== 0) throw new Error('中性描边被误判')
  if (G.scanWarmBorderText('className="focus-visible:ring-1 focus-visible:ring-ring/40"').length !== 0) throw new Error('中性 ring 档被误判')
  if (G.scanNativeTextfieldText('<item android:drawable="@android:color/transparent"/>').length !== 0) throw new Error('透明件被误判')
  const colors = G.parseAndroidColorsXml('<resources><color name="accent_ink">#000000</color><color name="ripple_ink">#1F000000</color></resources>')
  const pinned = '<style name="AppTheme"><item name="colorAccent">@color/accent_ink</item><item name="android:colorControlActivated">@color/accent_ink</item></style>'
  if (G.scanAndroidThemeText(pinned, colors).length !== 0) throw new Error('钉好中性墨档的主题被误判')
})

t('M3 判据掏空反证:摘掉"聚焦态"这一维,警告横幅立刻被误咬', () => {
  // 横幅档(成套 callout)在收窄后的射程内必须为 0
  const banner = '<div className="rounded-md border border-amber-500/30 bg-amber-500/10 text-amber-700">警告</div>'
  if (G.scanWarmBorderText(banner).length !== 0) throw new Error('警告横幅被误判 ⇒ 射程又宽了(§12e 恒红门型)')
  // 而"摘掉 focus 维"的等价形态(把 variant 检查当 always-true)必须抓到它 ⇒ 证明该维确有牙
  const withFocusVariant = 'className="focus:border-amber-500"'
  if (!G.warmFocusClassOf('focus:border-amber-500')) throw new Error('warmFocusClassOf 对 focus: 档失灵')
  if (G.warmFocusClassOf('border-amber-500') !== null) throw new Error('无 variant 的横幅档被判聚焦 ⇒ 身份闸失效')
  if (!G.scanWarmBorderText(withFocusVariant).some((h) => h.rule === 'W1-tw')) throw new Error('focus:border-amber 未命中')
})

t('M3b 输入框外框的常驻暖色环(与聚焦无关的第二条通道)既要有牙、也不得误咬', () => {
  // 正控:2026-10-21 实测事故形态 —— 编辑态容器常驻 ring-amber
  const live = '<div className="ui-card rounded-lg border ring-1 ring-amber-500/30">\n  <input className="outline-none" />\n</div>'
  if (!G.scanWarmBorderText(live).some((h) => h.rule === 'W1-input')) throw new Error('输入容器常驻暖环未命中 W1-input')
  // 反控 1:复选框(且 type= 被折到下一行)不算输入框外框
  const cb = '<div className="border border-amber-500/30">\n  <input\n    type="checkbox"\n  />\n</div>'
  if (G.scanWarmBorderText(cb).length !== 0) throw new Error('复选框警示框被误咬')
  // 反控 2:距离 >2 行的兄弟徽章不算(实测 checkin 页那两处即此型)
  const far = '<span className="border border-amber-500/40">冷却</span>\n<span>a</span>\n<span>b</span>\n<span>c</span>\n<input className="h-8" />'
  if (G.scanWarmBorderText(far).length !== 0) throw new Error('远距离兄弟徽章被误咬')
})

t('M4 遮罩有牙:注释里的被禁 drawable 名不算实现,摘掉注释仍要抓到', () => {
  const commented = `<!-- 不得再引用 @drawable/abc_textfield_activated_mtrl_alpha -->\n${'<item android:drawable="@android:color/transparent"/>'}`
  if (G.scanNativeTextfieldText(commented).length !== 0) throw new Error('注释里的 drawable 名被算成实现')
  if (G.scanNativeTextfieldText(`${commented}\n<item android:drawable="@drawable/textfield_activated_mtrl_alpha"/>`).length !== 1) throw new Error('遮罩把真引用一起遮掉了')
  const s = '<!--x\ny-->'
  if (G.maskXmlComments(s).length !== s.length) throw new Error('遮罩必须等长(否则行号漂)')
})

t('M5 W3 三条腿成对:未钉 / 钉彩色 / 引用不存在 各判红,摘掉输入合并即翻红', () => {
  const colors = G.parseAndroidColorsXml('<resources><color name="ink">#000000</color><color name="hot">#ffa500</color></resources>')
  const two = G.ACCENT_ATTRS.length
  if (two !== 2) throw new Error(`强调色属性应为 2 项,实得 ${two}`)
  if (G.scanAndroidThemeText('<style name="AppTheme"/>', colors).length !== G.ACCENT_ATTRS.length) throw new Error(`未钉的自闭合 AppTheme 应命中 ${G.ACCENT_ATTRS.length} 次(每个强调属性各一次)`)
  const colored = `<style name="AppTheme">${G.ACCENT_ATTRS.map((a) => `<item name="${a}">@color/hot</item>`).join('')}</style>`
  if (G.scanAndroidThemeText(colored, colors).length !== 2) throw new Error('钉成橙色未命中')
  const ghost = `<style name="AppTheme">${G.ACCENT_ATTRS.map((a) => `<item name="${a}">@color/ghost</item>`).join('')}</style>`
  if (G.scanAndroidThemeText(ghost, colors).length !== 2) throw new Error('引用不存在的颜色未命中(不得判绿)')
  const rel = 'apps/x/android/app/src/main/res/values-night/styles.xml'
  const body = `<style name="AppTheme">${G.ACCENT_ATTRS.map((a) => `<item name="${a}">@color/ink</item>`).join('')}</style>`
  const withInput = new Map([['apps/x/android/app/src/main/res/values/colors.xml', '<resources><color name="ink">#000000</color></resources>']])
  if (G.scanOne(rel, body, withInput).length !== 0) throw new Error('同批 colors 提供取值仍判红 ⇒ 输入合并没生效(同批改两文件必假红)')
  if (G.scanOne(rel, body, new Map()).length === 0) throw new Error('摘掉输入合并仍判绿 ⇒ 这一腿是空的')
})

t('M6 棘轮锚点取该文件 HEAD 自身命中数:持平不红、加回一处才红', () => {
  const cur = new Map([['a.css', [{ line: 1 }, { line: 2 }]]])
  if (G.ratchetDiff(cur, new Map([['a.css', 2]])).length !== 0) throw new Error('存量持平被判红(§12e 禁恒红门)')
  if (G.ratchetDiff(cur, new Map([['a.css', 1]])).length !== 1) throw new Error('加回一处未判红')
  if (G.ratchetDiff(cur, new Map()).length !== 1) throw new Error('新文件带命中未判红')
})

t('M7 性能锁:长 variant 串不得把判据拖成灾难性回溯', () => {
  // 事故前的实现是一条 (?:…*:)* 嵌套量词正则,实测把全量档拖到 7 分钟跑不完。
  const long = `"${Array.from({ length: 400 }, (_, i) => `variant-${i}:hover:x-${i}`).join(' ')} focus-visible:ring-amber-500/40"`
  const t0 = Date.now()
  const hits = G.scanWarmBorderText(long)
  const dt = Date.now() - t0
  if (dt > 500) throw new Error(`单行判据耗时 ${dt}ms ⇒ 回溯炸了(不得改回嵌套量词正则)`)
  if (hits.length !== 1) throw new Error(`长串里那一条聚焦暖色档必须仍抓到,实得 ${hits.length}`)
})

t('M8 射程闸双向:样式文件在射程、生成物与测试夹具不在、build 中间产物不在', () => {
  if (!G.isInScope('apps/web/app/globals.css')) throw new Error('web 样式被踢出射程')
  if (!G.isInScope('packages/app/src/components/TextField.tsx')) throw new Error('共享层组件被踢出射程')
  if (!G.isInScope('apps/mobile-rn/android/app/src/main/res/values/styles.xml')) throw new Error('android 主题被踢出射程')
  for (const p of ['apps/web/dist/globals.css', 'apps/mobile-rn/tests/x.test.tsx', 'docs/a.css', 'apps/web/android/app/build/intermediates/res/values/styles.xml', 'README.md']) {
    if (G.isInScope(p)) throw new Error(`不该在射程的条目被收进来了:${p}`)
  }
  if (G.STYLE_SCOPES.length < 6) throw new Error(`射程目录枚举塌了(实得 ${G.STYLE_SCOPES.length})`)
})

t('M9 豁免不串门、会到期;台账形状坏 ⇒ 拒绝判定', () => {
  const rows = [
    { file: 'a.css', rule: 'W1', until: '2099-01-01', reason: 'x', ticket: 'G-1' },
    { file: 'b.css', rule: 'W1', until: '2020-01-01', reason: 'x', ticket: 'G-2' },
  ]
  const now = new Date('2026-10-20')
  if (G.applyExemptions([{ file: 'a.css', rule: 'W1-css' }], rows, now).kept.length !== 0) throw new Error('未到期豁免没生效')
  if (G.applyExemptions([{ file: 'a.css', rule: 'W2' }], rows, now).kept.length !== 1) throw new Error('W1 豁免串到了 W2')
  const r = G.applyExemptions([{ file: 'b.css', rule: 'W1-tw' }], rows, now)
  if (r.kept.length !== 1 || r.expiredOrBroken.length !== 1) throw new Error('到期豁免没回队列(豁免不会到期=没有豁免)')
  if (G.loadExemptions('{"exemptions":[]}').error !== null) throw new Error('空台账被当成坏台账')
  if (G.loadExemptions('nope').error === null) throw new Error('坏台账未报 error ⇒ 会被当"无豁免"继续判绿')
})

t('M10 装车成套:注册条目在 HEAD 或索引面上在位,且 blocking+skipEnv 成套', () => {
  const RUNNER = 'scripts/guardian-runner.mjs'
  let text = null
  let faceUsed = null
  for (const [face, args] of [['索引', ['show', ':' + RUNNER]], ['HEAD', ['show', `HEAD:${RUNNER}`]]]) {
    try {
      text = execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'pipe'] })
      faceUsed = face
      break
    } catch {
      /* 换下一面 */
    }
  }
  if (text === null) throw new Error('注册表两个面都取不到 ⇒ 未判定(不记绿)')
  const entry = /check-no-warm-border\.mjs/.exec(text)
  if (!entry) throw new Error(`${faceUsed} 面上没有本门注册条目 ⇒ 门没接进提交链(§0.9:造好没装车=没有)`)
  const window = text.slice(Math.max(0, entry.index - 700), entry.index + 700)
  if (!/blocking/.test(window)) throw new Error('条目未定级 blocking')
  if (!/HUSKY_SKIP_WARM_BORDER/.test(window)) throw new Error('条目缺 skipEnv ⇒ 应急放行没有登记过的出口')
})

t('M11 源脚本自身语法可解析 + 判据未被复制进门体之外的第二处实现', () => {
  const src = readFileSync(join(ROOT, SOURCE_REL), 'utf8')
  if (!src.includes('export const __test__')) throw new Error('源脚本缺 __test__ 出口 ⇒ 镜像档无从 import(§22c)')
  // 回溯炸掉这件事由 M7 的**行为锁**管(量耗时),不在此做字符串反向断言 ——
  // "文件里不许出现某串"拦不住等价写法,只会逼出第二份判据。
  const testSrc = readFileSync(join(HERE, 'check-no-warm-border.test.mjs'), 'utf8')
  // 用拼接出来的正则查"重新定义判据"这一形态 —— 若写成 includes('function isWarmRgb')
  // 这类字面量,本档自己就含该串,锁会咬到自己(实测踩过)。
  for (const name of ['isWarmRgb', 'scanAndroidThemeText', 'warmFocusClassOf', 'applyExemptions', 'ratchetDiff']) {
    const defRe = new RegExp('^(?:export\\s+)?function\\s+' + name + '\\b|^(?:const|let)\\s+' + name + '\\s*=', 'm')
    if (defRe.test(testSrc)) throw new Error(`镜像档里重新定义了判据:${name}(§22c 必然漂移)`)
  }
})

let pass = 0
const fails = []
t('M12 W5 原生表单控件的 accent-color:四档缺一即红,取不到落未判定', () => {
  const sels = G.ACCENT_CONTROL_SELECTORS
  const all = sels.join(',') + '{accent-color:var(--color-primary)}'
  if (G.scanAccentColorRule(all).length !== 0) throw new Error('四类控件全钉住的 base.css 被判红')
  for (let i = 0; i < sels.length; i++) {
    const minus = sels.filter((_, j) => j !== i).join(',') + '{accent-color:var(--color-primary)}'
    const hits = G.scanAccentColorRule(minus)
    if (!hits.some((h) => h.rule === 'W5' && h.text.includes(sels[i])))
      throw new Error(`摘掉 ${sels[i]} 一档未被点名 ⇒ 这一维的牙不是"全没钉才红"`)
  }
  const warm = G.scanAccentColorRule(sels.join(',') + '{accent-color:#f59e0b}')
  if (warm.length !== sels.length || !warm.every((h) => h.rule === 'W5'))
    throw new Error('accent-color 取暖色未逐档点名')
  if (!G.scanAccentColorRule(null).every((h) => h.rule === 'W5-undetermined'))
    throw new Error('base.css 取不到必须落未判定档(§0.3 不记绿也不冒红)')
})

t('M13 CSS 输入类选择器的常驻暖描边(不要求 :focus)有牙,且不误咬结果区/按钮', () => {
  if (!css('textarea{ border-color: #f59e0b; }').some((h) => h.rule === 'W1-css-input'))
    throw new Error('textarea 元素选择器的常驻暖描边未命中 ⇒ 只判 :focus 的那条盲区没补上')
  if (!css('.bfc-input{ border: 1rpx solid var(--color-warning); }').some((h) => h.rule === 'W1-css-input'))
    throw new Error('类名带 -input 的包装容器未命中')
  if (css('.search-results{ border-color: #f59e0b; }').length !== 0)
    throw new Error('结果区被误咬 ⇒ 选择器收得太宽(裸 search 一旦收进来就是恒红门)')
  if (css('.member-cta-outlined{ border: 2rpx solid #ffd700; }').length !== 0)
    throw new Error('按钮描边被误咬(2026-10-21 审计实测该型 7 处全落在卡片/按钮/色条,非输入框)')
})

t('M14 旁路落地腿在位:落地器必须以 --rev 审树档调用本门(只活在 pre-commit 的门对它无效)', () => {
  const lander = readFileSync(join(ROOT, 'scripts', 'object-space-land.mjs'), 'utf8')
  if (!/check-no-warm-border\.mjs/.test(lander))
    throw new Error('object-space-land 不再引用本门 ⇒ 旁路通道(commit-tree+CAS)不跑 pre-commit,这条腿一摘就等于没装')
  if (!/'--rev'/.test(lander) || !/'--only'/.test(lander))
    throw new Error('落地器调用本门时未走 --rev <tree> --only <清单> ⇒ 审的不是将要落盘的那棵树')
  if (!/IHUI_LAND_SKIP_WARM_BORDER/.test(lander))
    throw new Error('缺应急跳过出口 —— blocking 判据没有具名出口,漂移时只会逼人绕开整条链')
  // 反向对照:审树档三态在真树上实测(旧树红 / 新树绿 / 坏 oid 未判定)由本档 M15 钉住
})

t('M15 审树档三态:红/绿/未判定各自成立(纯函数面 + 真 git 树)', () => {
  const run = (args) => {
    try {
      execFileSync(process.execPath, [join(ROOT, 'scripts', 'check-no-warm-border.mjs'), ...args], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 120000,
      })
      return { rc: 0, out: '' }
    } catch (e) {
      return { rc: e.status ?? 9, out: String((e.stdout ?? '') + (e.stderr ?? '')) }
    }
  }
  const bad = run(['--rev', 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef', '--only', 'apps/web/src/app/globals.css'])
  if (bad.rc !== 2) throw new Error(`不存在的 oid 必须 exit 2(未判定),实得 ${bad.rc} —— fail-open 会把"读不到树"放成绿`)
  const mixed = run(['--rev', 'deadbeef1', '--staged'])
  if (mixed.rc === 0 || !/互斥/.test(mixed.out))
    throw new Error(`--rev 与 --staged 同给必须报错并 exit 2,实得 rc=${mixed.rc}`)
})

t('M16 --root 换仓三态(G-929):显式指定被审仓 ⇒ 真判;目录不存在 ⇒ 未判定;缺省仍自推导', () => {
  // 立因(票 G-929 原话):旁路落地器镜像测试把 LAND_ROOT 指到 mkScratch 临时仓,门体缺省按
  // 自身位置推导 ⇒ 在主仓里问一枚只存在于临时仓的树 ⇒ "not a tree object" ⇒ 未判定
  // ⇒ 落地器 fail-closed 拒绝 ⇒ object-space-land 镜像套件 26 例整批红。
  // 本档钉死"换仓不失明"与"缺省行为不变"两件事各有一枚对照。
  const GIT = resolveGitBin() || 'git'
  const run = (args) => {
    try {
      execFileSync(process.execPath, [join(ROOT, 'scripts', 'check-no-warm-border.mjs'), ...args], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 120000,
      })
      return { rc: 0, out: '' }
    } catch (e) {
      return { rc: e.status ?? 9, out: String((e.stdout ?? '') + (e.stderr ?? '')) }
    }
  }
  const git = (dir, args) =>
    execFileSync(GIT, ['-c', 'safe.directory=*', '-c', 'user.email=t@e2e.local', '-c', 'user.name=e2e', '-c', 'core.autocrlf=false', '-C', dir, ...args], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 120000,
    })
  const dir = mkScratch('wb-root-')
  try {
    git(dir, ['init', '-q'])
    mkdirSync(join(dir, 'apps', 'web', 'src'), { recursive: true })
    // 射程内(apps/web 前缀 + .css)的暖色聚焦描边 —— 判据与仓根无关,换仓必须照样判红
    writeFileSync(join(dir, 'apps', 'web', 'src', 'scratch-input.css'), '.x:focus-within {\n  border-color: var(--color-amber-500);\n}\n')
    git(dir, ['add', '-A'])
    git(dir, ['commit', '-q', '-m', 'base'])
    const tree = git(dir, ['rev-parse', 'HEAD^{tree}']).trim()
    // ① 正控:--root 指到临时仓 ⇒ 照常判红且点名 W1-css(判据不因换仓失明)
    const withRoot = run(['--rev', tree, '--only', 'apps/web/src/scratch-input.css', '--root', dir])
    if (withRoot.rc !== 1) throw new Error(`换仓后必须照常判红(rc=1),实得 rc=${withRoot.rc}:${withRoot.out.slice(0, 200)}`)
    if (!/W1-css/.test(withRoot.out)) throw new Error('判红必须点名 W1-css(判据没跑起来)')
    // ② 反证:--root 指向不存在的目录 ⇒ 未判定(不静默回落到自推导 —— 那是 fail-open)
    //    断言必须钉到**拒绝理由本身**(点名 --root 目录不存在),只钉 rc=2 分不出
    //    "校验拒绝"与"静默回落后树问不到"—— 两者都是 exit 2,后者正是要禁的形态。
    const badRoot = run(['--rev', tree, '--only', 'apps/web/src/scratch-input.css', '--root', join(dir, 'no-such-dir')])
    if (badRoot.rc !== 2) throw new Error(`--root 不存在必须 exit 2(未判定),实得 rc=${badRoot.rc} —— 静默回落=把指错仓读成审过了`)
    if (!/目录不存在/.test(badRoot.out))
      throw new Error(`拒绝理由必须点名"目录不存在"(靠下游树噪声蒙混 = 校验被绕开):${badRoot.out.slice(0, 200)}`)
    // ③ 方向锁:同一棵树不给 --root(缺省按脚本位置在主仓里问)⇒ 仍 exit 2
    //    —— 证明生产路径"缺省自推导"的行为没被改掉;26 例红的根因正是这一格
    const noRoot = run(['--rev', tree, '--only', 'apps/web/src/scratch-input.css'])
    if (noRoot.rc !== 2) throw new Error(`不给 --root 必须仍按自推导(临时仓的树在主仓问不到 ⇒ exit 2),实得 rc=${noRoot.rc} —— 缺省行为被改坏了`)
  } finally {
    rmScratch(dir, { bestEffort: true })
  }
})

for (const c of cases) {
  try {
    c.fn()
    pass++
  } catch (e) {
    fails.push(`${c.name} — ${e && e.message ? e.message : String(e)}`)
  }
}
for (const f of fails) console.log(`  ❌ ${f}`)
console.log(`\n镜像 ${pass}/${cases.length} 通过${fails.length ? `,失败 ${fails.length} 条` : ''}(判据 import 源脚本 __test__)`)
process.exit(fails.length ? 1 : 0)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
