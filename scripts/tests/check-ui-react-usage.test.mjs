// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * §22c 镜像测试:`scripts/check-ui-react-usage.mjs`(Web 系三端 ui-react 组件复用对账)。
 *
 * 判据一律走门体导出的 `gate`:`gate.PAGE_SHELL_FILE_RE` / `gate.DIALOG_CARD_FORM_FILE_RE` /
 * `gate.UI_REACT_IMPORT_RE` 三条正则,加 `gate.findTsxFiles` / `gate.toRel` 两个取景函数。
 * 本文件不重述它们的内容,也不新增第四份清单(AGENTS.md §22c 红线 + 守门 191 的 F1/F2);
 * FAIL/WARN 两支的合成只由这三条生产正则完成(见 classify)。
 *
 * 断言输入逐字取自真仓 HEAD(`catBatch` 现取 blob):真屏名 `page-shell.tsx`、真 WARN 面
 * `apps/web/src/components/ai/goal-card.tsx` / `.../worktree-card.tsx`、真 PASS 面
 * `apps/web/src/components/chat/question-dialog.tsx` / `.../project-card.tsx`、真共享包 import 面
 * `apps/web/src/components/admin/AdminFilterBar.tsx` —— 路径全部来自 `git ls-tree -r HEAD` 实测输出。
 * 反向对照(同一面改一处写法)一律在内存里做,不改盘上门体也不往仓库树写夹具。
 *
 * 用例清单:
 *  T1 三条生产正则对真仓在册名的正反成对,含门体注释写明的两支刻意口径:form 不判、只认一枚前缀、
 *     带连字符的大小写写法仍算同一名。
 *  T2 内容无关性对照:名字不在判据口径里的面,喂空内容与喂真 import 内容都必须同为 PASS ——
 *     这一条让 T3 可以只对"名字命中"的真面取 blob(同判据、成本从 2839 枚降到个位数)。
 *  T3 存量对账(真仓 HEAD apps/web 全量在册名 + 命中面的真 blob):FAIL 类必须为 0(门体此刻绿的这一处),
 *     真 WARN 面逐枚在场、真 import 面不得在场;再删掉真 PASS 面那行共享包 import ⇒ 必须立刻翻 WARN(有牙)。
 *  T4 findTsxFiles 取景面:扩展名口径由门体自己回答;依赖目录不进;[G-1059141 2026-10-07]
 *     EXCLUDE_DIRS(tests/__tests__/e2e/scripts)已增量接线进 findTsxFiles,`__tests__` 不再进
 *     (接线前进,当时 280 枚 *.test.tsx 全是零命中噪声,差值进交付报告);`.vscode` 名义上写在
 *     ALLOWED_DOT_DIRS 放行名单里、实际被通用 EXCLUDE_DIRS 先挡掉(.github 放行逻辑有效,
 *     但真仓三个扫描根下今日均无该目录)—— 一律钉现读行为而不钉注释意图,差值进交付报告。
 *  T5 toRel 正反:仓内给正斜杠相对路径,仓外必须带 `..` 而不是伪装成仓内。
 *  T6 CLI 装车(临时仓):FAIL 面 exit 1 / 同一面补共享包 import exit 0 / WARN 面默认档 exit 0 且
 *     --strict 档 exit 1 —— 定级差异必须由判据自己说出来。
 *  T7 共享工作树实况档:CLI 读磁盘面,而并发会话随时在改 apps/**。加载期同步量能力探测:
 *     命中口径下的工作树文件集与 HEAD 文件集不等就整条跳过 —— 这一维此刻不判,跳过不等于通过。
 *
 * 派生一律 `windowsHide: true` + `stdio: ['ignore','pipe','pipe']`(AGENTS.md §12g);
 * 临时目录一律 mkScratch/rmScratch(§26 唯一落点)。门体 ROOT 在加载时由 process.cwd() 冻结
 * ⇒ 本文件要求以仓库根为工作目录运行(T5 专门钉这一条,不满足就点名而不是判错)。
 * 本机 Node v24.19 无 `it.skipIf`(实测 `typeof it.skipIf === 'undefined'`),等价形状是
 * `it(name, { skip: <原因字符串 | false> }, fn)`。
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { catBatch, gitBinary } from '../lib/face-reader.mjs'
import { __test__ as gate } from '../check-ui-react-usage.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..')
const GATE_CLI = join(REPO, 'scripts', 'check-ui-react-usage.mjs')
const WEB_REL = 'apps/web'

/** 真仓 HEAD 在册路径(逐字取自 `git ls-tree -r HEAD --name-only -- apps/web` 等实测输出)。 */
const SHARED_PAGE_SHELL_REL = 'packages/ui-react/src/page-shell.tsx'
const WARN_HIT_REL = 'apps/web/src/components/ai/goal-card.tsx'
const WARN_HIT_2_REL = 'apps/web/src/components/ai/progress-sections/worktree-card.tsx'
const PASS_DIALOG_REL = 'apps/web/src/components/chat/question-dialog.tsx'
const PASS_CARD_REL = 'apps/web/src/components/workspace/project-card.tsx'
const IMPORTER_REL = 'apps/web/src/components/admin/AdminFilterBar.tsx'
const NEITHER_REL = 'apps/web/src/components/feedback/portal-panel.tsx'
const TESTS_DIR_REL = 'apps/web/src/components/__tests__/Switch.test.tsx'
const HEAD_BLOBS = catBatch(
  REPO,
  [
    SHARED_PAGE_SHELL_REL,
    WARN_HIT_REL,
    WARN_HIT_2_REL,
    PASS_DIALOG_REL,
    PASS_CARD_REL,
    IMPORTER_REL,
    NEITHER_REL,
    TESTS_DIR_REL,
  ].map((p) => `HEAD:${p}`),
)

function head(rel) {
  const text = HEAD_BLOBS.get(`HEAD:${rel}`)
  assert.equal(typeof text, 'string', `HEAD 面取不到 ${rel} —— 判不了就点名,绝不回落成自造夹具`)
  return text
}

function base(rel) {
  return rel.split('/').pop()
}

/** 名字是否落在门体的两条口径里(只用生产正则,不看内容)。 */
function nameInScope(name) {
  return gate.PAGE_SHELL_FILE_RE.test(name) || gate.DIALOG_CARD_FORM_FILE_RE.test(name)
}

/** main() 的两支合成裁定:三个谓词全部来自门体导出。 */
function classify(name, content) {
  const usesShared = gate.UI_REACT_IMPORT_RE.test(content)
  if (gate.PAGE_SHELL_FILE_RE.test(name) && !usesShared) return 'FAIL'
  if (gate.DIALOG_CARD_FORM_FILE_RE.test(name) && !usesShared) return 'WARN'
  return 'PASS'
}

function toFwd(p) {
  return String(p).split(sep).join('/')
}

function layFile(dir, rel, text) {
  const abs = join(dir, ...rel.split('/'))
  mkdirSync(dirname(abs), { recursive: true })
  writeFileSync(abs, text, 'utf8')
  return abs
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

function runCli(args, cwd) {
  const r = spawnSync(process.execPath, [GATE_CLI, ...args], {
    encoding: 'utf8',
    cwd,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 300_000,
    maxBuffer: 1 << 26,
  })
  // 门体的站点行前面挂着 ANSI 颜色码,不剥掉就"看不见"站点(本机踩过:彩色输出打断标识符提取)
  return { rc: r.status, out: stripAnsi(String(r.stdout ?? '') + String(r.stderr ?? '')) }
}

function stripAnsi(s) {
  return s.split('\u001B').flatMap((chunk, i) => {
    if (i === 0) return [chunk]
    const at = chunk.indexOf('m')
    return [at >= 0 ? chunk.slice(at + 1) : chunk]
  }).join('')
}

/** 门体站点行写法 `  [LEVEL] path`,只用于对账读数,不参与判定。 */
function reportedLevelPaths(stdout, level) {
  const tag = `[${level}]`
  const out = []
  for (const line of stdout.split('\n')) {
    const t = line.trim()
    if (!t.startsWith(tag)) continue
    const rest = t.slice(tag.length).trim()
    if (rest) out.push(rest)
  }
  return out.sort()
}

// 真仓 HEAD 的 apps/web 在册名 + 落在门体口径里的那些(T3 只对它们取 blob)
const HEAD_SCOPE = (() => {
  const r = gitRead(['ls-tree', '-r', '--name-only', 'HEAD', '--', WEB_REL])
  if (r.status !== 0) return { ok: false, reason: `HEAD ${WEB_REL} 清单枚举失败(exit=${r.status})`, all: [], hits: [], blobs: null }
  const all = String(r.stdout || '').split('\n').filter(Boolean).map(toFwd)
  const hits = all.filter((p) => nameInScope(base(p)))
  const blobs = catBatch(REPO, hits.map((p) => `HEAD:${p}`))
  const bad = hits.filter((p) => typeof blobs.get(`HEAD:${p}`) !== 'string')
  if (bad.length > 0) return { ok: false, reason: `HEAD 面 ${bad.length} 个命中面取不到,首个:${bad[0]}`, all, hits, blobs }
  return { ok: true, reason: '', all, hits, blobs }
})()

/** 加载期同步量出的能力探测(T7):口径内的候选面必须两面同面同轮才可比。 */
const WORKTREE_PROBE = (() => {
  if (!HEAD_SCOPE.ok) return { ok: false, reason: `HEAD 面取不齐:${HEAD_SCOPE.reason}` }
  const workAll = gate.findTsxFiles(join(REPO, ...WEB_REL.split('/'))).map((p) => toFwd(relative(REPO, p)))
  const workHits = workAll.filter((p) => nameInScope(base(p)))
  const onlyHead = HEAD_SCOPE.hits.filter((p) => !workHits.includes(p))
  const onlyWork = workHits.filter((p) => !HEAD_SCOPE.hits.includes(p))
  if (onlyHead.length + onlyWork.length > 0) {
    return {
      ok: false,
      reason: `命中口径下两面文件集不等(HEAD 独有:${onlyHead.slice(0, 2).join(', ') || '—'};工作树独有:${onlyWork.slice(0, 2).join(', ') || '—'})`,
    }
  }
  return { ok: true, reason: '', size: workHits.length, workHits }
})()

describe('check-ui-react-usage · §22c 镜像测试(判据一律走门体导出的 gate)', () => {
  it('T1 三条生产正则对真仓在册名的正反成对(form 不判、单前缀、大小写同判三支都钉住)', () => {
    assert.equal(gate.PAGE_SHELL_FILE_RE.test(base(SHARED_PAGE_SHELL_REL)), true, '真名 page-shell.tsx 判不进 = 尺子瞎了')
    assert.equal(gate.PAGE_SHELL_FILE_RE.test('Page-Shell.tsx'), true, '门体那句 /i 必须让大小写写法算同一个被审对象')
    assert.equal(gate.PAGE_SHELL_FILE_RE.test('PageLayout.tsx'), false, '无分隔符的驼峰名不在门体写法里(命中就是口径回潮)')
    assert.equal(gate.PAGE_SHELL_FILE_RE.test(base(WARN_HIT_REL)), false, 'goal-card.tsx 被判成 PageShell 独立实现 = 冒红')
    assert.equal(gate.PAGE_SHELL_FILE_RE.test(base(NEITHER_REL)), false, 'portal-panel.tsx 不该命中')

    for (const rel of [WARN_HIT_REL, WARN_HIT_2_REL, PASS_DIALOG_REL, PASS_CARD_REL]) {
      assert.equal(gate.DIALOG_CARD_FORM_FILE_RE.test(base(rel)), true, `真名 ${base(rel)} 应落在 dialog/card 口径里`)
    }
    assert.equal(
      gate.DIALOG_CARD_FORM_FILE_RE.test(base(PASS_DIALOG_REL).replace('dialog', 'form')),
      false,
      '门体已把 form 从判据里摘掉(共享层无通用 Form),命中就是判据回潮',
    )
    assert.equal(gate.DIALOG_CARD_FORM_FILE_RE.test('my-scope-card.tsx'), false, '那句写法只吃一枚前缀,双前缀不该命中')
    assert.equal(gate.DIALOG_CARD_FORM_FILE_RE.test(base(IMPORTER_REL)), false, 'AdminFilterBar.tsx 不在 dialog/card 口径里')

    assert.equal(gate.UI_REACT_IMPORT_RE.test(head(IMPORTER_REL)), true, '真面 AdminFilterBar.tsx 在 HEAD 上就 import 共享包')
    assert.equal(gate.UI_REACT_IMPORT_RE.test(head(WARN_HIT_REL)), false, '真面 goal-card.tsx 在 HEAD 上没 import 共享包')
    assert.equal(gate.UI_REACT_IMPORT_RE.test(head(SHARED_PAGE_SHELL_REL)), false, '共享层自己的文件不靠包名自证(否则 FAIL 支永不可达)')
  })

  it('T2 内容无关性对照:名字不在口径里的面,空内容与真 import 内容必须同为 PASS', () => {
    assert.equal(classify(base(NEITHER_REL), ''), 'PASS', '不在口径里的名字 + 空内容判红 = 名字谓词没起作用')
    assert.equal(classify(base(NEITHER_REL), head(IMPORTER_REL)), 'PASS', '不在口径里的名字 + 真 import 内容判红 = 名字谓词被内容淹没')
    assert.equal(classify(base(WARN_HIT_REL), ''), 'WARN', '口径内名字 + 空内容必须落 WARN,否则 T3 的"只对命中面取 blob"就失去依据')
    assert.equal(classify(base(SHARED_PAGE_SHELL_REL), ''), 'FAIL', '口径内屏名 + 空内容必须落 FAIL')
    assert.ok(HEAD_SCOPE.ok, `HEAD 在册名枚举不可用:${HEAD_SCOPE.reason} —— 后续对账不成立`)
    assert.ok(
      HEAD_SCOPE.all.length > 0,
      'HEAD apps/web 在册名枚举到 0 ⇒ 空扫不记绿',
    )
  })

  it(
    'T3 存量对账 + 有牙:HEAD 全量 apps/web 在册名里 FAIL 类为 0,真 WARN 面在场,删掉真 PASS 面的 import 立刻翻 WARN',
    { skip: HEAD_SCOPE.ok ? false : `能力探测未过:${HEAD_SCOPE.reason} —— 面取不齐就不下结论` },
    () => {
      const fails = []
      const warns = []
      for (const rel of HEAD_SCOPE.hits) {
        const cls = classify(base(rel), HEAD_SCOPE.blobs.get(`HEAD:${rel}`))
        if (cls === 'FAIL') fails.push(rel)
        if (cls === 'WARN') warns.push(rel)
      }
      assert.deepEqual(fails, [], `HEAD 面上存在 PageShell 独立实现:${fails.slice(0, 3).join(', ')} —— 门体此刻是红的,点名而不掩饰`)
      assert.ok(warns.includes(WARN_HIT_REL), `真面 ${WARN_HIT_REL} 应落 WARN 类`)
      assert.ok(warns.includes(WARN_HIT_2_REL), `真面 ${WARN_HIT_2_REL} 应落 WARN 类`)
      assert.ok(!warns.includes(PASS_DIALOG_REL), '真面 question-dialog.tsx 在 HEAD 上 import 了共享包,不该进 WARN')
      assert.ok(!warns.includes(PASS_CARD_REL), '真面 project-card.tsx 同上')
      assert.ok(
        warns.every((p) => !gate.UI_REACT_IMPORT_RE.test(HEAD_SCOPE.blobs.get(`HEAD:${p}`))),
        'WARN 名单里混进了 import 过共享包的面 = 两支判据自相矛盾',
      )

      const dialog = head(PASS_DIALOG_REL)
      const stripped = dialog.split('\n').filter((l) => !gate.UI_REACT_IMPORT_RE.test(l)).join('\n')
      assert.equal(classify(base(PASS_DIALOG_REL), dialog), 'PASS', '反事实之前必须先是 PASS')
      assert.equal(classify(base(PASS_DIALOG_REL), stripped), 'WARN', '删掉共享包 import 后仍判 PASS = 这条判据没牙')
      assert.equal(classify(base(SHARED_PAGE_SHELL_REL), head(SHARED_PAGE_SHELL_REL)), 'FAIL', 'FAIL 支永不成立 = 主判据形同虚设')
      assert.equal(
        classify(base(SHARED_PAGE_SHELL_REL), `${head(SHARED_PAGE_SHELL_REL)}\nimport { PageShell } from '@ihui/ui-react'\n`),
        'PASS',
        '同一面补上共享包 import 后仍判 FAIL = 两支都白',
      )
    },
  )

  it('T4 findTsxFiles 取景面:扩展名口径由门体回答,依赖目录不进,[G-1059141] tests/__tests__/e2e/scripts 接线后不进、.vscode 实际被挡', () => {
    const scratch = mkScratch('ihui-ui-react-usage-t4-')
    try {
      const root = join(scratch, WEB_REL)
      const layout = [
        ['src/components/ai/goal-card.tsx', head(WARN_HIT_REL)],
        ['src/components/__tests__/Switch.test.tsx', head(TESTS_DIR_REL)],
        ['src/tests/Other.test.tsx', 'export const x = 1\n'],
        ['src/e2e/Login.e2e.tsx', 'export const x = 1\n'],
        ['src/scripts/Tool.tsx', 'export const x = 1\n'],
        ['src/components/.hidden/Secret.tsx', 'export const x = 1\n'],
        ['src/.github/Inner.tsx', 'export const x = 1\n'],
        ['src/.vscode/Excluded.tsx', 'export const x = 1\n'],
        ['src/node_modules/pkg/index.tsx', 'export const x = 1\n'],
        ['src/store/session.ts', 'export const x = 1\n'],
        ['src/views/Legacy.jsx', 'export const x = 1\n'],
        ['src/pages/Note.mdx', 'export const x = 1\n'],
        ['src/styles/global.css', ':root { color: red }'],
      ]
      for (const [relp, body] of layout) layFile(root, relp, body)
      const got = gate.findTsxFiles(root).map((p) => toFwd(relative(root, p)))
      assert.ok(got.includes('src/components/ai/goal-card.tsx'), '真面路径应被收进取景面')
      assert.ok(
        !got.some((p) => p.includes('__tests__/')),
        '[G-1059141 2026-10-07] EXCLUDE_DIRS(tests/__tests__/e2e/scripts) 已增量接线进 findTsxFiles:__tests__ 里的 .tsx 不再被收(接线前本断言钉的是旧漏接行为、现读是收;280 枚 *.test.tsx 曾全是零命中空扫)',
      )
      assert.ok(!got.some((p) => p.includes('/tests/')), '[G-1059141] tests 名单目录接线后必须被挡')
      assert.ok(!got.some((p) => p.includes('/e2e/')), '[G-1059141] e2e 名单目录接线后必须被挡')
      assert.ok(!got.some((p) => p.includes('/scripts/')), '[G-1059141] scripts 名单目录接线后必须被挡')
      assert.ok(!got.some((p) => p.includes('.hidden/')), '点目录默认不进(ALLOWED_DOT_DIRS 之外)')
      assert.ok(
        got.includes('src/.github/Inner.tsx'),
        '.github 在门体 ALLOWED_DOT_DIRS 放行名单里,挡掉就是判据漂开(证明点目录那一臂不是一律挡)',
      )
      assert.ok(
        !got.some((p) => p.includes('.vscode/')),
        '现读:.vscode 虽写在 ALLOWED_DOT_DIRS 里,却被 isExcludedDirName(通用 EXCLUDE_DIRS)先挡掉 ⇒ 那句放行名单只有 .github 真正生效。本断言钉现读行为,差值已写进交付报告',
      )
      assert.ok(!got.some((p) => p.includes('node_modules/')), '依赖目录必须被 isExcludedDirName 挡掉')
      assert.ok(!got.some((p) => p.endsWith('.ts')), '非 .tsx 不进(门体那句"只扫 .tsx"与实现同读法)')
      assert.ok(!got.some((p) => p.endsWith('.jsx')), 'jsx 不在取景口径内 —— 与守门 check-portal-fixed 的 SCAN_EXTS 是两套面,差值如实记在这里')
      assert.ok(!got.some((p) => p.endsWith('.mdx') || p.endsWith('.css')), '样式/文档不进')
      assert.deepEqual(gate.findTsxFiles(join(scratch, 'no-such-dir')), [], '目录不存在必须空返而不是抛')
    } finally {
      rmScratch(scratch, { bestEffort: true })
    }
  })

  it('T5 toRel 正反:仓内给正斜杠相对路径,仓外必须带 .. 而不是伪装成仓内', () => {
    assert.equal(
      resolve(process.cwd()),
      REPO,
      '门体 ROOT 由 process.cwd() 冻结 ⇒ 本镜像测试必须以仓库根为工作目录运行,否则 toRel 判的是别人的面',
    )
    assert.equal(gate.toRel(join(REPO, 'apps', 'web', 'app', 'globals.css')), 'apps/web/app/globals.css', '真仓在册路径的相对写法必须逐字这样')
    const rel = gate.toRel(join(REPO, ...WARN_HIT_REL.split('/')))
    assert.equal(rel, WARN_HIT_REL, `真面相对路径不逐字相等:${rel}`)
    assert.ok(!rel.includes('\\'), `相对路径里不得留反斜杠:${rel}`)
    const outside = mkScratch('ihui-ui-react-usage-t5-')
    try {
      const far = gate.toRel(join(outside, 'x.tsx'))
      assert.ok(far.startsWith('..'), `仓外路径必须带 ..(伪装成仓内就等于把别人的文件算进账):${far}`)
      assert.ok(!far.includes('\\'), `仓外相对路径也得给正斜杠:${far}`)
    } finally {
      rmScratch(outside, { bestEffort: true })
    }
  })

  it('T6 CLI 装车(临时仓):FAIL 面 exit 1 / 补 import exit 0 / WARN 面默认档 exit 0 而 --strict exit 1', () => {
    const shared = head(SHARED_PAGE_SHELL_REL)
    const scenarios = [
      {
        name: 'FAIL 面(PageShell 独立实现)',
        rel: `${WEB_REL}/src/layouts/page-shell.tsx`,
        src: shared,
        flags: [],
        expectRc: 1,
        level: 'FAIL',
      },
      {
        name: '同一 FAIL 面补上共享包 import',
        rel: `${WEB_REL}/src/layouts/page-shell.tsx`,
        src: `${shared}\nimport { PageShell } from '@ihui/ui-react'\n`,
        flags: [],
        expectRc: 0,
        level: null,
      },
      {
        name: 'WARN 面(goal-card 未 import 共享包)默认档',
        rel: WARN_HIT_REL,
        src: head(WARN_HIT_REL),
        flags: [],
        expectRc: 0,
        level: 'WARN',
      },
      {
        name: 'WARN 面 --strict 档',
        rel: WARN_HIT_REL,
        src: head(WARN_HIT_REL),
        flags: ['--strict'],
        expectRc: 1,
        level: 'WARN',
      },
    ]
    for (const s of scenarios) {
      const repo = mkScratch('ihui-ui-react-usage-t6-')
      try {
        layFile(repo, s.rel, s.src)
        const { rc, out } = runCli(s.flags, repo)
        assert.equal(typeof rc, 'number', `${s.name}:CLI 没有退出码 = 没跑成,不记绿`)
        assert.equal(rc, s.expectRc, `${s.name}:期望 exit ${s.expectRc},实得 ${rc} / ${out.slice(0, 260)}`)
        if (s.level) {
          assert.ok(reportedLevelPaths(out, s.level).includes(s.rel), `${s.name}:${s.level} 站点必须点名 ${s.rel},实得 ${JSON.stringify(reportedLevelPaths(out, s.level))}`)
        } else {
          assert.deepEqual(reportedLevelPaths(out, 'FAIL'), [], `${s.name}:补 import 之后仍报 FAIL 站点 = 反向对照没牙`)
        }
      } finally {
        rmScratch(repo, { bestEffort: true })
      }
    }
  })

  it(
    'T7 共享工作树实况档:CLI 读的是磁盘面,并发会话随时在改 apps/**(命中口径两面不等同时,这一维此刻不判)',
    {
      skip: WORKTREE_PROBE.ok
        ? false
        : `能力探测未过:${WORKTREE_PROBE.reason} —— 判红可能来自他人未提交的现场,跳过不等于通过`,
    },
    () => {
      const { rc, out } = runCli([], REPO)
      const fails = reportedLevelPaths(out, 'FAIL')
      assert.equal(rc, fails.length === 0 ? 0 : 1, `工作树面 FAIL ${fails.length} 处时退出码应为 ${fails.length === 0 ? 0 : 1},实得 ${rc}`)
      assert.deepEqual(fails, [], `两面同面同轮(T2/T3 已证 HEAD 面 FAIL 为 0),此刻却报出 FAIL:${fails.slice(0, 3).join(', ')}`)
      const warns = reportedLevelPaths(out, 'WARN')
      assert.deepEqual(
        warns,
        HEAD_SCOPE.hits.filter((p) => classify(base(p), HEAD_SCOPE.blobs.get(`HEAD:${p}`)) === 'WARN').sort(),
        'CLI 报出的 WARN 站点集合必须等于同一组生产正则对 HEAD 面的读数(两面同料必须同判)',
      )
      assert.ok(warns.includes(WARN_HIT_REL), '真 WARN 面必须在工作树读数里也在场')
    },
  )
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
