// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * §22c 镜像测试:`scripts/check-web-tokens-import.mjs`(apps/web globals.css 的 design-tokens @import 对账)。
 *
 * 门体导出的判据只有两枚:`gate.REQUIRED_IMPORTS`(要逐字出现在 globals.css 里的那几条 @import,
 * 连它们各自锚定的 file/source/label)与 `gate.check()`(把那份清单拿去读盘并给出失败清单)。
 * 本文件不重述 needle 串、不自列 label —— 断言一律取 `gate.REQUIRED_IMPORTS` 自己的字段
 * (AGENTS.md §22c 红线 + 守门 191 的 F1/F2)。
 *
 * 断言输入逐字取自真仓 HEAD:`git show HEAD:apps/web/app/globals.css`、两份 design-tokens 样式源、
 * 以及门体自身的 HEAD blob,全部经 `scripts/lib/face-reader.mjs` 的 `catBatch` 现取
 * (§22c「回声机」教训:只喂自造夹具的镜像测试判不出真面)。
 *
 * 为什么还要把门体**逐字节**搬进 scratch 再 import 一次:`gate.check()` 读的路径是在门体模块内由
 * `import.meta.url` 往上两级冻结的(不看 cwd),所以"这条判据有没有牙"只能靠换**门体所在目录**来造面。
 * 搬过去的是 HEAD blob 原文(T4 用逐字比对钉住 provenance),测试文件里仍然一个字判据都没有。
 *
 * 用例清单:
 *  T1 正反成对:每条 needle 都在真仓 HEAD 的 globals.css 上逐字在场;由 needle 自己拼出的近邻串
 *     (包名少一个 s)必须不在场 —— 钉的是精确相对路径,不是"出现过包名"。
 *  T2 清单形状由生产材料自证:同锚一枚 globals.css、label 互不相同、每条 source 都在 HEAD 在册。
 *  T3 装车(构造面):铺 HEAD 面 ⇒ 0 失败;按生产清单逐条删掉对应 @import ⇒ 恰好 1 条失败并点名该
 *     label;留 @import 但删样式源 ⇒ 报「源缺失」而不是「needle 缺失」;删 globals.css ⇒ 报「文件缺失」;
 *     最后铺回 HEAD 面 ⇒ 必须重新回到 0 失败(每支红都能被反向对照证明是那次改动造成的)。
 *  T4 provenance:scratch 里那份门体副本与 HEAD blob 逐字相同,且它导出的 `__test__` 键集与真仓导入
 *     逐字相同 ⇒ T3 判的是生产代码,不是测试自写的替身。
 *  T5 真仓现面读数(CLI 档):门体读的是磁盘面,并发会话随时在改 apps/web/app/globals.css;
 *     加载期同步量能力探测 —— 盘面与 HEAD 漂开就整条跳过,这一维此刻不判,跳过不等于通过。
 *
 * 派生一律 `windowsHide: true` + `stdio: ['ignore','pipe','pipe']`(AGENTS.md §12g);
 * 临时目录一律 mkScratch/rmScratch(§26 唯一落点),不往仓库树写夹具,也不改盘上门体。
 * 本机 Node v24.19 无 `it.skipIf`(实测 `typeof it.skipIf === 'undefined'`),等价形状是
 * `it(name, { skip: <原因字符串 | false> }, fn)`。
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { catBatch, gitBinary } from '../lib/face-reader.mjs'
import { __test__ as gate } from '../check-web-tokens-import.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..')
const GATE_REL = 'scripts/check-web-tokens-import.mjs'
const GATE_CLI = join(REPO, ...GATE_REL.split('/'))

/** 真仓 HEAD 在册路径(逐字取自 `git ls-tree -r HEAD --name-only`)。 */
const GLOBALS_REL = 'apps/web/app/globals.css'
const STYLE_DIR_REL = 'packages/design-tokens/src/styles'

const HEAD_BLOBS = catBatch(REPO, [GLOBALS_REL, GATE_REL].map((p) => `HEAD:${p}`))
const STYLE_LIST = gitRead(['ls-tree', '-r', '--name-only', 'HEAD', '--', STYLE_DIR_REL])
const STYLE_FILES = String(STYLE_LIST.stdout || '').split('\n').filter(Boolean).map(toFwd)
/** 门体清单锚定的样式源在仓内的相对路径(路径来自生产字段,不在测试里点名)。 */
const SOURCE_RELS = gate.REQUIRED_IMPORTS.map((e) => toFwd(e.source).slice(REPO.length + 1))
for (const rel of SOURCE_RELS) {
  if (!HEAD_BLOBS.has(`HEAD:${rel}`)) HEAD_BLOBS.set(`HEAD:${rel}`, gitRead(['show', `HEAD:${rel}`]).stdout)
}

function toFwd(p) {
  return String(p).split(sep).join('/')
}

function head(rel) {
  const text = HEAD_BLOBS.get(`HEAD:${rel}`)
  assert.equal(typeof text, 'string', `HEAD 面取不到 ${rel} —— 判不了就点名,绝不回落成自造夹具`)
  return text
}

function gitRead(args, cwd = REPO) {
  return spawnSync(
    gitBinary(),
    ['-c', 'safe.directory=*', '-c', 'core.quotepath=false', '-C', cwd, ...args],
    {
      encoding: 'utf8',
      cwd,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 120_000,
      maxBuffer: 1 << 26,
    },
  )
}

function layFile(dir, rel, text) {
  const abs = join(dir, ...rel.split('/'))
  mkdirSync(dirname(abs), { recursive: true })
  writeFileSync(abs, text, 'utf8')
  return abs
}

/** 把真仓 HEAD globals.css 里对应 needle 那一行整行去掉(行定位用生产 needle 自己)。 */
function dropImport(text, entry) {
  const lines = text.split('\n')
  const at = lines.findIndex((l) => l.includes(entry.needle))
  assert.ok(at >= 0, `HEAD 面里应逐字找到那条 @import:${entry.needle}`)
  return lines.filter((_, i) => i !== at).join('\n')
}

/** 门体副本 = HEAD blob 原文,放在 `<root>/scripts/` 下 —— 它的路径就是由自己位置推出来的。 */
function buildGateCopy(root) {
  return layFile(root, GATE_REL, head(GATE_REL))
}

/** 铺一面:globals.css + 生产清单锚定的那些样式源(全用真仓 HEAD 文本)。 */
function layFace(root, opts = {}) {
  if (!opts.skipGlobals) layFile(root, GLOBALS_REL, opts.globals ?? head(GLOBALS_REL))
  for (const rel of SOURCE_RELS) {
    if (opts.skipSources && opts.skipSources.includes(rel)) continue
    layFile(root, rel, head(rel))
  }
}

function copyOf(root) {
  return readFileSync(join(root, ...GATE_REL.split('/')), 'utf8')
}

/** 子进程里导入 scratch 那份门体副本,把它的 check() 结果打成 JSON(驱动内不含任何判据)。 */
function runCheckCopy(root) {
  const driver = layFile(
    root,
    'gate-driver-tokens.mjs',
    [
      "import { pathToFileURL } from 'node:url'",
      'const mod = await import(pathToFileURL(process.argv[2]).href)',
      'const g = mod.__test__',
      'console.log(JSON.stringify({',
      '  keys: Object.keys(g).sort(),',
      '  failures: g.check(),',
      '  needles: g.REQUIRED_IMPORTS.map((x) => x.needle),',
      '  labels: g.REQUIRED_IMPORTS.map((x) => x.label),',
      '  files: g.REQUIRED_IMPORTS.map((x) => x.file),',
      '  sources: g.REQUIRED_IMPORTS.map((x) => x.source),',
      '}))',
      '',
    ].join('\n'),
  )
  const r = spawnSync(process.execPath, [driver, join(root, ...GATE_REL.split('/'))], {
    encoding: 'utf8',
    cwd: root,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 120_000,
    maxBuffer: 1 << 26,
  })
  let json = null
  try {
    json = JSON.parse(String(r.stdout || '').trim())
  } catch {
    json = null
  }
  assert.equal(r.status, 0, `子进程没跑成 rc=${r.status} / ${String(r.stderr).slice(0, 240)}`)
  assert.ok(json, `驱动输出不是 JSON:${String(r.stdout).slice(0, 240)}`)
  return json
}

/** 真仓现面探测(T5 用):盘面 globals.css 与 HEAD blob 是否逐字相同。 */
const WORKTREE_PROBE = (() => {
  let disk = null
  try {
    disk = readFileSync(join(REPO, ...GLOBALS_REL.split('/')), 'utf8')
  } catch {
    disk = null
  }
  const blob = HEAD_BLOBS.get(`HEAD:${GLOBALS_REL}`)
  if (typeof disk !== 'string') return { ok: false, reason: `工作树读不到 ${GLOBALS_REL}` }
  if (disk !== blob) return { ok: false, reason: `工作树的 ${GLOBALS_REL} 已与 HEAD 面漂开(他人未提交的现场)` }
  return { ok: true, reason: '' }
})()

describe('check-web-tokens-import · §22c 镜像测试(判据一律走门体导出的 gate)', () => {
  it('T1 正反成对:每条 needle 在真仓 HEAD 面逐字在场,拼出来的近邻串必须不在场', () => {
    const globals = head(GLOBALS_REL)
    assert.ok(gate.REQUIRED_IMPORTS.length >= 1, '生产清单为空 = 这道门无从裁定')
    for (const entry of gate.REQUIRED_IMPORTS) {
      assert.ok(
        globals.includes(entry.needle),
        `真仓 HEAD 面应逐字含这条 @import:${entry.needle} —— 不在场就是门体此刻判红的存量,要点名而不是改门体`,
      )
      const nearMiss = entry.needle.replace('design-tokens', 'design-token')
      assert.notEqual(nearMiss, entry.needle, '近邻串与真 needle 相同 ⇒ 本条对照没有区分力,换一个拼法')
      assert.ok(!globals.includes(nearMiss), `近邻串被一起吃掉:${nearMiss}`)
      assert.ok(entry.needle.startsWith('@import'), `needle 应是 @import 语句(生产字段自证):${entry.needle}`)
    }
  })

  it('T2 清单形状自证:同锚一枚 globals.css、label 互不相同、每条 source 都在 HEAD 在册', () => {
    const anchors = new Set(gate.REQUIRED_IMPORTS.map((x) => toFwd(x.file)))
    assert.equal(anchors.size, 1, '两条断言应锚同一枚 globals.css(门体头注就是这么写的)')
    const only = [...anchors][0]
    assert.ok(only.endsWith(GLOBALS_REL), `锚点应落在真仓那枚在册 globals.css 上,实得:${only}`)
    const labels = gate.REQUIRED_IMPORTS.map((x) => x.label)
    assert.equal(new Set(labels).size, labels.length, `label 必须互不相同,否则失败清单点不出是哪一条:${labels.join(', ')}`)
    assert.equal(STYLE_LIST.status, 0, `HEAD 样式目录枚举失败(exit=${STYLE_LIST.status})`)
    for (const entry of gate.REQUIRED_IMPORTS) {
      const rel = toFwd(entry.source).slice(REPO.length + 1)
      assert.ok(STYLE_FILES.includes(rel), `门体锚定的样式源不在 HEAD 在册:${rel}(HEAD 面实有:${STYLE_FILES.join(', ')})`)
    }
    assert.ok(STYLE_FILES.length >= gate.REQUIRED_IMPORTS.length, 'HEAD 在册样式源数量应撑得起这份清单')
  })

  it('T3 装车(构造面):HEAD 面 0 失败 / 逐条删 @import 各判 1 条 / 缺源与缺文件各有各的报法 / 铺回必回绿', () => {
    const scenarios = [
      { name: 'HEAD 完整面', globals: null, skipSources: null, skipGlobals: false, expectFailures: 0, expectLabel: null, expectPhrase: null },
      ...gate.REQUIRED_IMPORTS.map((entry) => ({
        name: `删掉「${entry.label}」那条 @import`,
        globals: dropImport(head(GLOBALS_REL), entry),
        skipSources: null,
        skipGlobals: false,
        expectFailures: 1,
        expectLabel: entry.label,
        expectPhrase: 'MISSING @import',
      })),
      ...gate.REQUIRED_IMPORTS.map((entry) => ({
        name: `留 @import 但删掉「${entry.label}」样式源`,
        globals: null,
        skipSources: [toFwd(entry.source).slice(REPO.length + 1)],
        skipGlobals: false,
        expectFailures: 1,
        expectLabel: entry.label,
        expectPhrase: 'MISSING source',
      })),
      {
        name: 'globals.css 整枚缺失',
        globals: null,
        skipSources: null,
        skipGlobals: true,
        expectFailures: gate.REQUIRED_IMPORTS.length,
        expectLabel: null,
        expectPhrase: 'MISSING file',
      },
      { name: '铺回 HEAD 面(反向对照)', globals: null, skipSources: null, skipGlobals: false, expectFailures: 0, expectLabel: null, expectPhrase: null },
    ]

    for (const s of scenarios) {
      const root = mkScratch('ihui-web-tokens-import-t3-')
      try {
        buildGateCopy(root)
        layFace(root, { globals: s.globals ?? head(GLOBALS_REL), skipSources: s.skipSources, skipGlobals: s.skipGlobals })
        const json = runCheckCopy(root)
        assert.ok(Array.isArray(json.failures), `失败清单必须是数组,实得 ${JSON.stringify(json.failures)}`)
        assert.equal(
          json.failures.length,
          s.expectFailures,
          `${s.name}:期望 ${s.expectFailures} 条失败,实得 ${JSON.stringify(json.failures)}`,
        )
        if (s.expectLabel) {
          assert.ok(
            json.failures.some((f) => f.includes(s.expectLabel)),
            `${s.name}:失败清单没点出对应 label,实得 ${JSON.stringify(json.failures)}`,
          )
        }
        if (s.expectPhrase) {
          assert.ok(
            json.failures.every((f) => f.includes(s.expectPhrase)),
            `${s.name}:报法应含「${s.expectPhrase}」,实得 ${JSON.stringify(json.failures)}`,
          )
        }
      } finally {
        rmScratch(root, { bestEffort: true })
      }
    }
  })

  it('T4 provenance:scratch 里门体副本与 HEAD blob 逐字相同,且导出的 __test__ 键集与真仓导入一致', () => {
    const root = mkScratch('ihui-web-tokens-import-t4-')
    try {
      buildGateCopy(root)
      layFace(root)
      const json = runCheckCopy(root)
      assert.deepEqual(json.keys, Object.keys(gate).sort(), '副本与真仓门体的导出键集不等 ⇒ T3 判的就不是生产判据')
      assert.deepEqual(json.needles, gate.REQUIRED_IMPORTS.map((x) => x.needle), 'needle 材料必须同源')
      assert.deepEqual(json.labels, gate.REQUIRED_IMPORTS.map((x) => x.label), 'label 材料必须同源')
      assert.equal(copyOf(root), head(GATE_REL), '铺进 scratch 的门体必须与 HEAD blob 逐字相同(不许测试自己改写判据本体)')
      assert.deepEqual(json.failures, [], 'HEAD 完整面在这份生产判据下应当 0 失败(T3 第一支的复述)')
      // 副本读的是自己目录下的面:把副本目录里的 globals.css 换掉,真仓一面不受影响(两侧独立 ⇒ 证明面由位置决定)
      layFile(root, GLOBALS_REL, dropImport(head(GLOBALS_REL), gate.REQUIRED_IMPORTS[0]))
      const second = runCheckCopy(root)
      assert.equal(second.failures.length, 1, '换掉副本目录里的面却仍判 0 失败 ⇒ check() 根本没读那枚面')
    } finally {
      rmScratch(root, { bestEffort: true })
    }
  })

  it(
    'T5 真仓现面读数(CLI 档):判的是工作树盘面(盘面与 HEAD 漂开时,这一维此刻不判)',
    {
      skip: WORKTREE_PROBE.ok ? false : `能力探测未过:${WORKTREE_PROBE.reason} —— 判红可能来自他人未提交的现场,跳过不等于通过`,
    },
    () => {
      const r = spawnSync(process.execPath, [GATE_CLI], {
        encoding: 'utf8',
        cwd: REPO,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 120_000,
        maxBuffer: 1 << 26,
      })
      assert.equal(typeof r.status, 'number', 'CLI 没有退出码 = 没跑成,不记绿')
      assert.equal(
        r.status,
        0,
        `盘面与 HEAD 同面、而 HEAD 面每条 @import 都在场(T1 已证),此刻应放行,实得 rc=${r.status} / ${String(r.stdout).slice(0, 200)}${String(r.stderr).slice(0, 200)}`,
      )
      const gateFindings = gate.check()
      assert.deepEqual(gateFindings, [], '父进程里导入的生产 check() 与 CLI 必须同判(同一判据同一面)')
    },
  )
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
