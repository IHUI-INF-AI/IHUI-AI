// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 桌面端「薄壳 + 直连线上站点」口径防回潮断言(G-723 票①–⑤ 的常驻尺子,镜像测试、只读判定)。
//
// 判据形状(硬要求③):当 apps/desktop/src-tauri/tauri.conf.json 的 build.beforeBuildCommand 为**空串**时,
// 受检文件集合内不得再出现「桌面端打包本地 web 产物 / 唯一校验点 / desktop 复用 ui-react / desktop typecheck」
// 这类旧口径。beforeBuildCommand 非空 ⇒ 本断言**不适用**(那条配置本身就把产物分发恢复了,措辞不算谎)。
//
// 立因:D148 把三处口径对齐到既有拍板(枚 b8a4cec4e4,S1/S2/S3 逐字同值),但同一轮实测另有点名得出的五处
// 仍写旧口径(G-723)。散文约束在本仓的失效形态永远是安静 —— 没有这条断言,下一轮薄壳化讨论会把旧措辞写回来。
//
// 判定面 = **工作树**。本票不做任何 git 写操作,已入库的 HEAD 仍是旧措辞,故按 HEAD 判会红在"我没能提交"
// 这一格上;若将来把它接进提交链,取材面必须由持有人改成 HEAD/索引(参 AGENTS §守门速查 70/77/83/98/101/103/118 口径)。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { gitBinary, catBatch } from '../lib/face-reader.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')

// 受检集合(闭包枚举,不写死清单):apps/desktop/** 全量 + 本票点名的四个载体文件。
// **刻意不含** PROJECT_PLAN.md / AGENTS.md —— 历史票面(D148/V4 的分析段)必须能逐字引述旧措辞,
// 把它们算进射程等于要求"删除证据"。
const SCAN_ROOTS = ['apps/desktop']
const SCAN_FILES = [
  'apps/web/next.config.ts',
  'apps/web/scripts/build-static.mjs',
  'docs/MULTI_END.md',
  'docs/项目说明/8端一致性认证矩阵-2026-09-15.md',
  'docs/port-management.md',
  'README.md',
  'apps/desktop/src-tauri/tauri.conf.json',
]

// **DEFERRED 已清空(2026-09-29,G-723 票①② 当场清偿)**:原先挂着根 README 与 port-management
// 两处"本票禁改"的账。两条都改完了,行留在清单里就是"清单腐烂"——它会替下一个人做出
// "这一处仍需处理"的判断(AGENTS §4 对 RN_ONLY_BRAND_KEYS 记过同一条教训)。
// 清单机制本身保留:今后若再遇到"该改但此刻被他人持有"的载体,登记时必须带 reason,
// 且判据会因 staleDeferred 自动催它了结。
const DEFERRED = []

// 行内豁免(与仓库其它门同一条纪律:必须带原因,裸标记不放行)
const EXEMPT_RE = /thin-shell-exempt:\s*\S/

/**
 * 旧口径的形状。每条都带"为什么这一型会说谎",不得凭喜好增删。
 * allowHistorical:该行同时含历史标记(旧/曾/已废/失真/不再/历史)时放过 ——
 * 否则本尺子会把"承认自己曾经是错的"那一句判成违规,而那是本票要求的写法。
 */
export const FORBIDDEN_PATTERNS = [
  {
    id: 'T1',
    label: '自称"唯一校验点"',
    re: /唯一校验点/,
    why: 'beforeBuildCommand 为空 ⇒ 该脚本在构建链上永不执行,不可能是任何契约的校验点(V4 #98 实测)',
  },
  {
    id: 'T2',
    label: '把 frontendDist 说成指向 web 静态产物',
    re: /frontendDist[^|\n]{0,40}(?:\.\.\/)+(?:apps\/)?web\/out/i,
    why: '实际值是 "shell"(占位页),说成 ../../web/out 就是描述一份不存在的分发',
  },
  {
    id: 'T3',
    label: '把"打包本地 web 产物"当成桌面端现行行为',
    re: /(?<!不)打包本地\s*web\s*产物/,
    why: '薄壳拍板(V3 #72)的原话是"**不**打包";去掉那个"不"字,承诺就从壳翻成产物分发',
  },
  {
    id: 'T4',
    label: '声称桌面端复用 web 产物/静态导出',
    re: /(?:有意)?复用\s*(?:apps\/)?web\s*(?:的)?\s*(?:静态(?:导出)?\s*)?(?:产物|导出)/,
    why: '与 apps/desktop/package.json + tauri.conf.json 矛盾(D148 已按实测改正 §2.5,其余小节不得再打架)',
  },
  {
    id: 'T5',
    label: '把桌面端列进共享包消费端',
    re: /^\|\s*`@ihui\/[a-z][a-z-]*`\s*\|[^|\n]*\|[^|\n]*\bdesktop\b/m,
    why: '实测 devDependencies 仅 @tauri-apps/cli + rimraf ⇒ 桌面端经站点间接使用,不直接依赖(硬要求②)',
  },
  {
    id: 'T6',
    label: '声称可跑 desktop typecheck',
    re: /pnpm\s+--filter\s+@ihui\/desktop\s+typecheck/,
    why: '该 package.json 没有 typecheck script ⇒ 文档给的是跑不通的出路(AGENTS「文档不得写跑不通的出路」)',
  },
  {
    id: 'T7',
    label: '声称桌面端有 JS 测试目录',
    re: /apps\/desktop\/tests\//,
    why: '本端无前端工程、该目录不存在;与 T6 同一型——把不存在的验证面写成承诺',
  },
  {
    id: 'T8',
    label: '把桌面端打包态说成"加载/使用 web/out 静态产物"',
    re: /(?<!不)(?:build|打包)\s*时[^|\n]{0,12}?[`'"]?(?:\.\.\/)?(?:apps\/)?web\/out/,
    why: '2026-09-17 `f10258c8f6`「终极薄壳」起,安装包不内嵌前端产物;`docs/port-management.md` 那句"build 时加载 `web/out` 静态产物"改了之后**没有任何尺子看着它**(T1–T7 一条都不命中),所以这条判据是"改完不再回潮"的唯一保证 —— 补判据前它已经在 HEAD 里躺着,而当时的 7 例测试全绿',
  },
]

// 历史标记:含这些词的句子是在**描述旧口径**,不是复用旧口径。
const HISTORICAL_RE = /(旧|曾|已废|已删|失真|不再|历史|更正|当初|曾经|移除)/

function isHistoricalFraming(line) {
  return HISTORICAL_RE.test(line)
}

function normalize(text) {
  return text.replace(/\r\n/g, '\n')
}

/**
 * 核心判据:纯函数,输入(配置状态 + 文件清单),输出 findings / deferred / undetermined。
 * 导出给镜像测试直接喂构造面 —— 证明"取材条件"这类行为只能用构造面,不得依赖仓库瞬时状态(AGENTS 103 T12 那一课)。
 */
export function scanThinShellWording({ beforeBuildCommand, entries }) {
  if (typeof beforeBuildCommand !== 'string') {
    return { applicable: false, reason: 'beforeBuildCommand 取不到 ⇒ 本断言未判定', findings: [], deferred: [] }
  }
  if (beforeBuildCommand !== '') {
    return {
      applicable: false,
      reason: `beforeBuildCommand 非空(=${JSON.stringify(beforeBuildCommand)})⇒ 产物分发若在配置里已恢复,旧措辞不算谎,本断言不适用`,
      findings: [],
      deferred: [],
    }
  }
  if (!Array.isArray(entries) || entries.length === 0) {
    return { applicable: true, reason: '受检集合枚举到 0 个文件 ⇒ 判死,不记为通过(空扫不是合格证)', findings: [], deferred: [] }
  }

  const findings = []
  const deferred = []
  const undetermined = []

  for (const { path, text } of entries) {
    if (typeof text !== 'string') {
      undetermined.push({ path, reason: '内容取不到' })
      continue
    }
    const lines = normalize(text).split('\n')
    for (const pat of FORBIDDEN_PATTERNS) {
      for (let i = 0; i < lines.length; i += 1) {
        const line = lines[i]
        // 判据面与豁免面同看原文:标记本身就是注释/HTML 注释里的字,遮掉会让出口失效。
        if (!pat.re.test(line)) continue
        if (isHistoricalFraming(line)) continue
        if (EXEMPT_RE.test(line) || EXEMPT_RE.test(lines[i - 1] || '')) continue
        const hit = { path, line: i + 1, id: pat.id, label: pat.label, why: pat.why, text: line.trim().slice(0, 200) }
        if (DEFERRED.some((d) => d.path === path)) deferred.push(hit)
        else findings.push(hit)
      }
    }
  }

  // 防清单腐烂:DEFERRED 里的项若已不再命中,说明它已被修好,这一条必须喊出来。
  const staleDeferred = DEFERRED.filter((d) => !deferred.some((h) => h.path === d.path)).map((d) => d.path)

  return { applicable: true, reason: '', findings, deferred, staleDeferred, undetermined }
}

function listTrackedFiles() {
  const out = execFileSync(gitBinary(), ['-C', ROOT, 'ls-files', '-z', ...SCAN_ROOTS], { encoding: 'utf8', timeout: 30000, windowsHide: true })
  const underRoot = out.split('\0').filter(Boolean).map((p) => p.replace(/\\/g, '/'))
  const extra = SCAN_FILES.filter((p) => !p.startsWith('apps/desktop/'))
  const all = [...new Set([...underRoot, ...extra, ...DEFERRED.map((d) => d.path)])].sort()
  if (all.length === 0) throw new Error('受检集合枚举到 0 个文件')
  return all
}

function readEntry(path, overrides = {}) {
  if (Object.prototype.hasOwnProperty.call(overrides, path)) return { path, text: overrides[path] }
  // **取 HEAD 面,不取工作树磁盘**(2026-09-29 改,守门 118 那条取材面纪律):
  // 共享工作区的 README / AGENTS 这类活文档常年**滞后 HEAD 且带着别人在飞的改动**,按磁盘判会出两种错 ——
  // 别人没提交的旧措辞把我判红(与本提交无关),或别人改了而我看不见判绿。
  // 本尺子守的是"仓库对外承诺的措辞",那就是 HEAD;取不到 ⇒ 落 undetermined(下面已按 text 非 string 处理),不记通过。
  const text = faceText(path)
  return { path, text: typeof text === 'string' ? normalize(text) : null }
}

function buildEntries(overrides = {}) {
  return listTrackedFiles().map((p) => readEntry(p, overrides))
}

// 一次批量读满,避免逐文件派生 git(与守门 118 同一条理由:枚举与内容同面同轮)。
let FACE = null
function faceText(path) {
  if (FACE === null) {
    try {
      FACE = catBatch(ROOT, listTrackedFiles().map((p) => `HEAD:${p}`), { maxBuffer: 1 << 28 })
    } catch {
      FACE = new Map() // 一次都读不到 ⇒ 每条都落"取不到内容"的未判定,而不是静默空文本
    }
  }
  return FACE.get(`HEAD:${path}`)
}

function currentBeforeBuildCommand() {
  const raw = faceText('apps/desktop/src-tauri/tauri.conf.json') ?? readFileSync(join(ROOT, 'apps/desktop/src-tauri/tauri.conf.json'), 'utf8')
  const conf = JSON.parse(raw)
  return conf?.build?.beforeBuildCommand
}

test('前置事实:本断言只在 beforeBuildCommand 为空时才成立,现读必须是空串(否则整条尺子不适用)', () => {
  const v = currentBeforeBuildCommand()
  assert.equal(v, '', `tauri.conf.json 的 build.beforeBuildCommand 实测=${JSON.stringify(v)},与 D148 拍板不一致 —— 先查配置再谈措辞`)
})

test('真仓 HEAD 面:受检集合(含 README 与 port-management)不得出现旧口径措辞', () => {
  const r = scanThinShellWording({ beforeBuildCommand: currentBeforeBuildCommand(), entries: buildEntries() })
  assert.equal(r.applicable, true, r.reason)
  assert.deepEqual(
    r.findings,
    [],
    `检出 ${r.findings.length} 处旧口径:\n${r.findings.map((f) => `  ${f.id} ${f.path}:${f.line}  ${f.text}`).join('\n')}`,
  )
  // DEFERRED 已清空 ⇒ deferred 必须为 0;不为 0 就说明有人**一边修好一边把行留在清单上**,
  // 或新挂了没理由的豁免项。两者都要当场喊出来(AGENTS「绝不静默成看起来全绿」)。
  assert.equal(r.deferred.length, 0, `还有 deferred 命中,说明清单没跟着清或改动没落地:${JSON.stringify(r.deferred)}`)
  assert.deepEqual(r.staleDeferred, [], `DEFERRED 里的这些项已不再命中旧口径,须删行: ${r.staleDeferred.join(', ')}`)
  assert.deepEqual(r.undetermined, [], `取不到内容的受检文件(不得当作通过): ${r.undetermined.map((u) => u.path).join(', ')}`)
})

test('注入证明:往临时副本塞一句旧措辞 ⇒ 断言必须红(否则它恒绿,等于没有)', () => {
  const real = buildEntries()
  const target = real.find((e) => e.path === 'docs/MULTI_END.md')
  assert.ok(target, '受检集合必须真的含 docs/MULTI_END.md,否则注入证明是在别处自证')

  const injectedSamples = {
    T1: '本脚本是该契约的唯一校验点。',
    T2: 'Tauri 桌面端(frontendDist: ../../web/out)加载本地静态产物。',
    T3: '桌面端打包本地 web 产物,安装包内含 UI。',
    T4: '桌面端有意复用 web 产物,不自建前端。',
    T5: '| `@ihui/ui-react` | Web 组件库 | web / desktop / extension |',
    T6: '桌面端验证命令:`pnpm --filter @ihui/desktop typecheck`。',
    T7: '桌面端测试目录:`apps/desktop/tests/`,框架 Vitest。',
  }

  for (const [id, line] of Object.entries(injectedSamples)) {
    const entries = real.map((e) => (e.path === target.path ? { path: e.path, text: `${e.text}\n${line}\n` } : e))
    const r = scanThinShellWording({ beforeBuildCommand: '', entries })
    const hits = r.findings.filter((f) => f.path === target.path && f.id === id)
    assert.ok(hits.length >= 1, `注入 ${id} 那句旧措辞后必须判红,实得 findings=${r.findings.length}`)
    // 其余判据不得被这一行连带误报(每条注入只应红在自己那一型上)
    const otherIds = [...new Set(r.findings.filter((f) => f.path === target.path).map((f) => f.id))]
    assert.deepEqual(otherIds, [id], `注入 ${id} 只应命中 ${id},实得 ${otherIds.join(',')}(判据互相串门=会误伤)`)
  }
})

test('反向对照:同一行带历史标记或行内豁免时不得判红(否则本票要求的"如实写明旧口径"会被自己拦下)', () => {
  const real = buildEntries()
  const target = real.find((e) => e.path === 'docs/MULTI_END.md')
  const okLines = [
    '旧口径:本脚本曾是该契约的唯一校验点(现已不在构建链)。',
    '桌面端不打包本地 web 产物(V3 #72 拍板)。',
    '桌面端验证命令:`pnpm --filter @ihui/desktop typecheck`。 <!-- thin-shell-exempt: 仅叙述该命令已被删除 -->',
  ]
  for (const line of okLines) {
    const entries = real.map((e) => (e.path === target.path ? { path: e.path, text: `${e.text}\n${line}\n` } : e))
    const r = scanThinShellWording({ beforeBuildCommand: '', entries })
    assert.equal(r.findings.length, 0, `这一行不该判红,却红了:\n${r.findings.map((f) => `${f.id} ${f.text}`).join('\n')}\n注入行:${line}`)
  }
})

test('判据不适用性:beforeBuildCommand 非空时整条尺子必须闭嘴(不得把恢复产物的配置读成措辞违规)', () => {
  const real = buildEntries()
  const target = real.find((e) => e.path === 'docs/MULTI_END.md')
  const dirty = { ...Object.fromEntries(real.map((e) => [e.path, e.text])), 'docs/MULTI_END.md': `${target.text}\n桌面端有意复用 web 产物。\n` }
  const entries = real.map((e) => readEntry(e.path, dirty))
  const r = scanThinShellWording({ beforeBuildCommand: 'node scripts/ensure-web-out.mjs', entries })
  assert.equal(r.applicable, false)
  assert.equal(r.findings.length, 0, '配置里产物分发已恢复 ⇒ 措辞不是谎,不得判红')
  assert.match(r.reason, /不适用/)
})

test('判死条件:受检集合为空 / 配置取不到 ⇒ 一律不得记为通过(空扫不是合格证)', () => {
  const empty = scanThinShellWording({ beforeBuildCommand: '', entries: [] })
  assert.match(empty.reason, /判死|0 个/, empty.reason)
  const missing = scanThinShellWording({ beforeBuildCommand: undefined, entries: buildEntries() })
  assert.equal(missing.applicable, false)
  assert.match(missing.reason, /未判定/)
})

test('受检集合必须真的覆盖本票点名的载体(否则"没检出"只是没看)', () => {
  const files = listTrackedFiles()
  for (const must of [
    'apps/web/next.config.ts',
    'apps/web/scripts/build-static.mjs',
    'docs/MULTI_END.md',
    'docs/项目说明/8端一致性认证矩阵-2026-09-15.md',
    'apps/desktop/scripts/ensure-web-out.mjs',
    // G-723 票①② 的载体必须在射程里 —— 不在射程就等于"改完没人看守"(与本票立项理由同一条)
    'docs/port-management.md',
    'README.md',
  ]) {
    assert.ok(files.includes(must), `受检集合漏了 ${must} —— 该处回归将无人看守`)
  }
  assert.ok(!files.includes('PROJECT_PLAN.md'), 'PROJECT_PLAN.md 不得进射程(历史票面允许引述旧措辞)')
  assert.ok(!files.includes('AGENTS.md'), 'AGENTS.md 不得进射程(同上)')
})

/**
 * T8 的成对证明(G-723 票② 的"判据跟着改动走"那一半)。
 * 立项事实:`docs/port-management.md` 那句"build 时加载 `web/out` 静态产物"在 HEAD 里躺着时,
 * 上面 7 例**全绿** —— 因为 T1–T7 一条都不命中它。所以只改文字不改判据,等于把同一句话
 * 交给下一个人的记性(§12f:"改被审代码的写法,必须同时改审它的正则";守门 117 记过同型)。
 * 两条必须同时成立,缺一即本判据没有牙:
 *  ① 旧句喂进去 ⇒ T8 命中(它能抓到我刚改掉的那一型);
 *  ② 新句喂进去 ⇒ 零命中(它不把"承认薄壳 + 线上站点"的正确写法误判成违规)。
 */
test('T8 成对证明:旧那句"build 时加载 web/out 静态产物"必须被抓,新那句正确写法必须不被抓', () => {
  const OLD =
    '| 8806 | ~~Desktop(Vite+Tauri)~~ 已废弃(A 套壳:Desktop 通过 `tauri.conf.json` `devUrl:8801` 加载 web dev server,build 时加载 `web/out` 静态产物,不再需要独立 Vite 端口。启动:`pwsh -File scripts/start-dev.ps1 -Desktop` = api+ai-service+desktop,desktop 自带 web 8801,脚本自动注入 cargo PATH,与 web 互斥)| apps/desktop | `apps/desktop/src-tauri/tauri.conf.json` `devUrl: http://localhost:8801` | — |'
  // 两条都是**构造面文本**,不读仓库 —— 本条证明的是"判据抓旧句、不抓新句"这件事本身;
  // "仓库里现在到底是新句"由上面那条「真仓 HEAD 面」断言负责(两者判的东西不同,混在一起
  // 就会把仓库瞬时状态当恒定前提,那是本仓记过多次的失效型)。
  const NEW =
    '| 8806 | ~~Desktop(Vite+Tauri)~~ 已废弃(A 薄壳:Desktop 的 `tauri.conf.json` `devUrl:8801` 只在**开发期**加载 web dev server;打包态**不内嵌前端产物** —— `beforeBuildCommand` 为空、`frontendDist` = `src-tauri/shell` 占位页、窗口 `url` 直指线上站点,2026-09-17 `f10258c8f6`「终极薄壳」定稿,详见 D148/G-723。因此不再需要独立 Vite 端口。启动:`pwsh -File scripts/start-dev.ps1 -Desktop` = api+ai-service+desktop,desktop 自带 web 8801,脚本自动注入 cargo PATH,与 web 互斥)| apps/desktop | `apps/desktop/src-tauri/tauri.conf.json` `devUrl: http://localhost:8801` | — |'
  const hitOld = scanThinShellWording({
    beforeBuildCommand: '',
    entries: [{ path: 'docs/port-management.md', text: OLD }],
  })
  assert.ok(
    hitOld.findings.some((f) => f.id === 'T8'),
    `旧句没被 T8 抓到 ⇒ 这条判据是装饰品(实测 findings=${JSON.stringify(hitOld.findings.map((f) => f.id))})`,
  )
  const hitNew = scanThinShellWording({
    beforeBuildCommand: '',
    entries: [{ path: 'docs/port-management.md', text: NEW }],
  })
  assert.deepEqual(
    hitNew.findings,
    [],
    `改后的正确写法被判红(实测 ${JSON.stringify(hitNew.findings.map((f) => [f.id, f.text]))})—— 判据过宽就会逼人绕过它`,
  )
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
