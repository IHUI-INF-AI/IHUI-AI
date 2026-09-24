// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * @file 硬编码中文扫描器集成测试
 * @description 端到端覆盖 scripts/scan-hardcoded-zh.mjs 的核心规则:
 *   检测 apps/web/app + apps/web/src/components 下 .ts/.tsx 文件中的
 *   硬编码中文字符串(未走 t()/next-intl 的代码行)。
 *
 *   测试用临时 fixture(在 os.tmpdir() 下创建项目结构 + spawnSync cwd 模拟项目根),
 *   不污染项目,符合 AGENTS.md §23(目录用 tests/)。
 *
 *   覆盖场景:
 *   ① 无中文 → exit 0
 *   ② apps/web/app + apps/web/src/components 均被扫描(JSX 文本 + 字符串字面量)
 *   ③ 非目标目录(apps/web/src/lib)不被扫描
 *   ④ // 行注释 → 跳过
 *   ⑤ 多行块注释 → 跳过
 *   ⑥ import 语句 → 跳过
 *   ⑦ interface / type / export type 声明 → 跳过
 *   ⑧ useTranslations / getTranslations 行 → 跳过(SKIP_TOKEN_RE)
 *   ⑨ description: 行 → 跳过
 *   ⑩ --exit 1:有命中 exit 1 / 无命中 exit 0
 *   ⑪ --json:写入 JSON 文件 + 结构正确
 *   ⑫ 排除 __tests__/ 目录 + .test.tsx 文件 + admin/ 目录
 *   ⑬ 单文件多命中 → count 累计
 *
 *   用 Node.js 内置 test runner,无第三方依赖。路径推导用 import.meta.url(AGENTS.md §15)。
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'

// ─── 路径推导(AGENTS.md §15:用 import.meta.url,不硬编码) ───
const __dirname = fileURLToPath(new URL('.', import.meta.url))
const SCRIPT_PATH = join(__dirname, '..', 'scan-hardcoded-zh.mjs')

// ─── 辅助:创建临时项目根目录 ─────────────────────────────
function createTempProject() {
  return mkdtempSync(join(tmpdir(), 'ihui-scan-zh-'))
}

// 辅助:在临时项目根下写文件(自动创建父目录)
function writeFile(root, relPath, content) {
  const full = join(root, relPath)
  mkdirSync(dirname(full), { recursive: true })
  writeFileSync(full, content, 'utf8')
}

// 辅助:运行 scan-hardcoded-zh.mjs(把项目根显式指向临时夹具)
// 必须传 --root:脚本的 ROOT 由自身位置推导(防"从子包 cwd 调用 ⇒ 静默扫不到文件而恒绿"),
// 只改 spawn 的 cwd 不影响它 → 曾经 14 例里 13 例在比对真仓数据而恒红。
// 用 process.execPath 而非裸 'node'(不依赖 PATH),windowsHide 防派生可见控制台窗口(AGENTS §5b)。
function runScript(args = [], opts = {}) {
  const cwd = opts.cwd || process.cwd()
  const rooted = opts.cwd === undefined || args.includes('--root') ? args : [...args, '--root', cwd]
  return spawnSync(process.execPath, [SCRIPT_PATH, ...rooted], {
    cwd,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true,
  })
}

describe('scan-hardcoded-zh.mjs 集成测试', () => {

  // ─── 1. 无中文 → exit 0, 0 文件 ─────────────────────────
  test('通过: 无中文字符 → exit 0, 0 命中', () => {
    const root = createTempProject()
    try {
      writeFile(root, 'apps/web/app/page.tsx', [
        "import { useTranslations } from 'next-intl'",
        "const t = useTranslations('about')",
        "export default function Page() { return <div>{t('title')}</div> }",
      ].join('\n'))
      const r = runScript([], { cwd: root })
      assert.equal(r.status, 0, `无中文应 exit 0,实际 ${r.status}\nstdout: ${r.stdout}`)
      assert.match(r.stdout, /含硬编码中文的文件: 0/)
      assert.match(r.stdout, /硬编码中文行数: 0/)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  // ─── 2. 两个目标目录均被扫描(JSX 文本 + 字符串字面量)────
  test('检测: apps/web/app + apps/web/src/components 均被扫描', () => {
    const root = createTempProject()
    try {
      // app 目标:JSX 文本含中文
      writeFile(root, 'apps/web/app/page.tsx', [
        "export default function Page() {",
        "  return <div>你好世界</div>",
        "}",
      ].join('\n'))
      // components 目标:字符串字面量含中文
      writeFile(root, 'apps/web/src/components/Button.tsx', [
        "const label = '提交按钮'",
        "export default function Button() { return null }",
      ].join('\n'))
      const r = runScript([], { cwd: root })
      assert.equal(r.status, 0, `无 --exit 1 应 exit 0,实际 ${r.status}`)
      assert.match(r.stdout, /含硬编码中文的文件: 2/)
      assert.match(r.stdout, /硬编码中文行数: 2/)
      assert.match(r.stdout, /你好世界/)
      assert.match(r.stdout, /提交按钮/)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  // ─── 3. 非目标目录不被扫描 ───────────────────────────────
  test('范围: apps/web/src/lib(非 components)不被扫描', () => {
    const root = createTempProject()
    try {
      writeFile(root, 'apps/web/src/lib/helper.ts', [
        "const msg = '这里不应被扫描'",
        "export default msg",
      ].join('\n'))
      const r = runScript([], { cwd: root })
      assert.equal(r.status, 0)
      assert.match(r.stdout, /含硬编码中文的文件: 0/, 'apps/web/src/lib 不在 TARGETS 内,不应被扫描')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  // ─── 4. // 行注释含中文 → 跳过 ──────────────────────────
  test('跳过: // 行注释含中文 → 不命中(SKIP_LINE_RE)', () => {
    const root = createTempProject()
    try {
      writeFile(root, 'apps/web/app/page.tsx', [
        "// 这是中文行注释",
        "export default function Page() { return null }",
      ].join('\n'))
      const r = runScript([], { cwd: root })
      assert.equal(r.status, 0)
      assert.match(r.stdout, /含硬编码中文的文件: 0/)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  // ─── 5. 多行块注释含中文 → 跳过 ─────────────────────────
  test('跳过: 多行块注释含中文 → 不命中(inBlockComment 状态机)', () => {
    const root = createTempProject()
    try {
      writeFile(root, 'apps/web/app/page.tsx', [
        "/*",
        " * 这是多行注释第一行",
        " * 这是多行注释第二行",
        " */",
        "export default function Page() { return null }",
      ].join('\n'))
      const r = runScript([], { cwd: root })
      assert.equal(r.status, 0)
      assert.match(r.stdout, /含硬编码中文的文件: 0/)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  // ─── 6. import 语句含中文 → 跳过 ────────────────────────
  test('跳过: import 语句含中文 → 不命中(SKIP_LINE_RE)', () => {
    const root = createTempProject()
    try {
      writeFile(root, 'apps/web/app/page.tsx', [
        "import { 获取数据 } from '@/lib/api'",
        "export default function Page() { return null }",
      ].join('\n'))
      const r = runScript([], { cwd: root })
      assert.equal(r.status, 0)
      assert.match(r.stdout, /含硬编码中文的文件: 0/)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  // ─── 7. interface / type / export type 声明含中文 → 跳过 ─
  test('跳过: interface / type / export type 声明含中文 → 不命中', () => {
    const root = createTempProject()
    try {
      writeFile(root, 'apps/web/app/page.tsx', [
        "interface User { 名称: string }",
        "type Status = '激活' | '未激活'",
        "export type Role = '管理员' | '用户'",
        "export default function Page() { return null }",
      ].join('\n'))
      const r = runScript([], { cwd: root })
      assert.equal(r.status, 0)
      assert.match(r.stdout, /含硬编码中文的文件: 0/)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  // ─── 8. useTranslations / getTranslations 行含中文 → 跳过
  test('跳过: useTranslations / getTranslations 行含中文 → 不命中(SKIP_TOKEN_RE)', () => {
    const root = createTempProject()
    try {
      writeFile(root, 'apps/web/app/page.tsx', [
        "const t = useTranslations('about') // 获取翻译",
        "const gt = await getTranslations('about') // 获取翻译2",
        "export default function Page() { return null }",
      ].join('\n'))
      const r = runScript([], { cwd: root })
      assert.equal(r.status, 0)
      assert.match(r.stdout, /含硬编码中文的文件: 0/, '含 useTranslations/getTranslations token 的行应被 SKIP_TOKEN_RE 跳过')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  // ─── 9. description: 行含中文 → 跳过 ────────────────────
  test('跳过: description: 行含中文 → 不命中(SKIP_LINE_RE + SKIP_TOKEN_RE)', () => {
    const root = createTempProject()
    try {
      writeFile(root, 'apps/web/app/page.tsx', [
        "export const metadata = {",
        "  description: '页面描述',",
        "  title: 'Page Title',",
        "}",
        "export default function Page() { return null }",
      ].join('\n'))
      const r = runScript([], { cwd: root })
      assert.equal(r.status, 0)
      // description 行被 SKIP_LINE_RE(前缀 description:)+ SKIP_TOKEN_RE 双重跳过
      // 其他行无中文 → 0 命中
      assert.match(r.stdout, /含硬编码中文的文件: 0/)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  // ─── 10. --exit 1: 有命中 → exit 1 ─────────────────────
  test('--exit 1: 有硬编码中文 → exit 1(stderr 含拒绝信息)', () => {
    const root = createTempProject()
    try {
      writeFile(root, 'apps/web/app/page.tsx', [
        "export default function Page() {",
        "  return <div>你好</div>",
        "}",
      ].join('\n'))
      const r = runScript(['--exit', '1'], { cwd: root })
      assert.equal(r.status, 1, `--exit 1 有命中应 exit 1,实际 ${r.status}`)
      assert.match(r.stderr, /--exit 1.*发现硬编码中文|pre-commit 拒绝/)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  // ─── 11. --exit 1: 无命中 → exit 0 ─────────────────────
  test('--exit 1: 无硬编码中文 → exit 0', () => {
    const root = createTempProject()
    try {
      writeFile(root, 'apps/web/app/page.tsx', [
        "export default function Page() { return <div>OK</div> }",
      ].join('\n'))
      const r = runScript(['--exit', '1'], { cwd: root })
      assert.equal(r.status, 0, `--exit 1 无命中应 exit 0,实际 ${r.status}`)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  // ─── 12. --json: 写入 JSON 文件 + 结构正确 ──────────────
  test('--json: 写入 JSON 文件 + 结构正确', () => {
    const root = createTempProject()
    try {
      writeFile(root, 'apps/web/app/page.tsx', [
        "export default function Page() {",
        "  const a = '你好'",
        "  return <div>{a}</div>",
        "}",
      ].join('\n'))
      const jsonOut = join(root, 'out.json')
      const r = runScript(['--json', jsonOut], { cwd: root })
      assert.equal(r.status, 0, `--json 无 --exit 1 应 exit 0,实际 ${r.status}`)
      assert.equal(existsSync(jsonOut), true, 'JSON 文件应写入')
      const data = JSON.parse(readFileSync(jsonOut, 'utf8'))
      assert.equal(data.totalFiles, 1, '应检测到 1 个文件')
      assert.equal(data.totalHits, 1, '应检测到 1 处命中')
      assert.ok(Array.isArray(data.targets), 'targets 应为数组')
      assert.ok(data.scannedAt, 'scannedAt 应存在')
      const hit = data.files[0]
      assert.equal(hit.count, 1)
      assert.equal(hit.samples[0].line, 2, '命中行号应为 2')
      assert.match(hit.samples[0].text, /你好/)
      // file 字段为相对路径,跨平台用 regex 匹配
      assert.match(hit.file, /apps[\\\/]web[\\\/]app[\\\/]page\.tsx/)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  // ─── 13. 排除 __tests__/ 目录 + .test.tsx 文件 + admin/ ─
  test('排除: __tests__/ 目录 + .test.tsx 文件 + admin/ 目录不被扫描', () => {
    const root = createTempProject()
    try {
      // __tests__ 目录内的普通文件(中文,非 .test)→ 应被 EXCLUDE_DIRS 排除
      writeFile(root, 'apps/web/app/__tests__/helper.tsx', "const x = '测试目录排除'")
      // .test.tsx 文件(中文,不在 __tests__)→ 应被 EXCLUDE_FILE_PATTERNS 排除
      writeFile(root, 'apps/web/app/page.test.tsx', "const x = '测试文件排除'")
      // admin 目录内的文件(中文)→ 应被 EXCLUDE_DIRS 排除
      writeFile(root, 'apps/web/app/admin/page.tsx', "const x = '测试admin排除'")
      // 合法文件(无中文)
      writeFile(root, 'apps/web/app/page.tsx', "export default function Page() { return null }")
      const r = runScript([], { cwd: root })
      assert.equal(r.status, 0)
      assert.match(r.stdout, /含硬编码中文的文件: 0/, '__tests__/ + .test.tsx + admin/ 均应被排除')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  // ─── 14. 单文件多命中 → count 累计 ──────────────────────
  test('多命中: 单文件多处中文 → count 累计 + 行号准确', () => {
    const root = createTempProject()
    try {
      writeFile(root, 'apps/web/app/page.tsx', [
        "export default function Page() {",
        "  const a = '你好'",
        "  const b = '世界'",
        "  const c = 'English'",  // 无中文,不计
        "  return <div>{a}{b}</div>",
        "}",
      ].join('\n'))
      const r = runScript([], { cwd: root })
      assert.equal(r.status, 0)
      assert.match(r.stdout, /含硬编码中文的文件: 1/)
      assert.match(r.stdout, /硬编码中文行数: 2/, '第 2、3 行含中文,第 4 行英文不计,应 2 处命中')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  // ─── 15. 行尾 `//` 注释:免检说明不计数,但不得顺手剥掉字符串内容与豁免标记 ───
  // 2026-09-24 起因:门 70 只剥"成对块注释"和"整行行注释",**行尾** `//` 之后的中文
  // 被算成硬编码中文 —— PriceChart/TerminalTab/TerminalStatusIndicators 各被
  // `radius-exempt` 说明顶出 2/1/1 处假阳,越过基线使门在 HEAD 上恒红。
  // 五条正反例钉住三件事:① 行尾注释不计数;② 字符串里的 `//` 不是注释起点(否则真文案被吞);
  // ③ 豁免标记写在行尾注释里时仍然有效(否则咬断别人的兜底译文通道)。
  test('行尾注释:radius-exempt 说明不计数 + 字符串内 // 与行尾豁免标记不得误剥', () => {
    const cases = [
      // ① 行尾免检说明 → 0 命中
      { name: 'trailing-exempt', body: "export const rx = 1.5 // radius-exempt: 图表细柱微圆角,吸附到档位会破坏观感", want: 0 },
      // ② 字符串里含 // → 中文是真界面文案,必须仍命中
      { name: 'slash-in-string', body: "export const label = '输入//输出'", want: 1 },
      // ③ 豁免标记写在行尾注释里 → 整行仍按 i18n 兜底译文放过
      { name: 'tail-exemption', body: "export const copy = { zh: '工具记录内容', en: 'Tool content' } // next-intl 缺词兜底", want: 0 },
      // ④ 真硬编码中文 + 行尾注释 → 注释不算,代码部分必须命中
      { name: 'real-copy-with-tail', body: "export const title = '首页标题' // 待迁移到词表", want: 1 },
      // ⑤ 跨行模板里的裸 URL:`://` 不得被当注释起点(否则整行文档示例被抹掉 = 假绿)
      { name: 'url-in-template', body: 'export const doc = `\nhttps://api-staging.aizhs.top/v1  # 预发\n`', want: 1 },
    ]
    for (const c of cases) {
      const root = createTempProject()
      try {
        writeFile(root, `apps/web/app/${c.name}.tsx`, c.body)
        const r = runScript([], { cwd: root })
        const m = String(r.stdout).match(/硬编码中文行数:\s*(\d+)/)
        assert.ok(m, `${c.name}: 未解析到命中数\n${r.stdout}\n${r.stderr}`)
        assert.equal(Number(m[1]), c.want, `${c.name} 命中数应为 ${c.want},实际 ${m[1]}\nstdout:${r.stdout}\nstderr:${r.stderr}`)
      } finally {
        rmSync(root, { recursive: true, force: true })
      }
    }
  })

  // ─── 16. 内容文案豁免声明:必须"有理由 + 在文件头 + 可见报数"三件事同时成立 ───
  // 2026-09-24 立:门 70 的结论把"确属内容文案"写成一种真实情形,却只给了
  // "调高基线"这一条被 AGENTS 明令禁止的出口 ⇒ 这类文件只能恒红或逼人来一句 --no-verify。
  // 三道约束一一钉死:无理由不生效、躲在第 40 行之后不生效、生效必须逐文件报出命中数。
  test('内容文案豁免:声明式出口只在有理由且位于文件头时生效,且必须可见报数', () => {
    const REASON = '通知与工单通道没有 i18n 运行时,本文件文本即对外 payload'
    const body = (header) => [header, 'export const HANDOFF = {', "  title: '失败诊断交接单',", "  copy: '复制交接单',", '}'].join('\n')

    // ① 正向:声明 + 长理由 → 不计命中,且如实报"有文件被豁免"与逐文件命中数
    const r1root = createTempProject()
    try {
      writeFile(r1root, 'apps/web/app/page.tsx', body(`// i18n-content-exempt-file: ${REASON}`))
      const r = runScript([], { cwd: r1root })
      assert.match(r.stdout, /硬编码中文行数:\s*0/, '声明生效时不得计入待办命中')
      assert.match(r.stdout, /内容文案豁免/, '必须可见地报出"有文件被豁免",不得静默')
      assert.match(r.stdout, /page\.tsx \(2 处\)/, '必须逐文件给出被放行的命中数')
    } finally {
      rmSync(r1root, { recursive: true, force: true })
    }

    // ② 反例:空标记 → 不生效(防"写一行注释就白免")
    const r2root = createTempProject()
    try {
      writeFile(r2root, 'apps/web/app/page.tsx', body('// i18n-content-exempt-file:'))
      const r = runScript([], { cwd: r2root })
      assert.match(r.stdout, /硬编码中文行数:\s*2/, '无理由的标记不得生效')
      assert.doesNotMatch(r.stdout, /内容文案豁免/, '未生效时不得报成已豁免')
    } finally {
      rmSync(r2root, { recursive: true, force: true })
    }

    // ③ 反例:声明躲到命中行旁边(第 40 行之后) → 不生效
    const r3root = createTempProject()
    try {
      const pad = Array.from({ length: 45 }, (_, i) => `const pad${i} = ${i}`).join('\n')
      writeFile(r3root, 'apps/web/app/page.tsx', `${pad}\n// i18n-content-exempt-file: ${REASON}\nexport const tail = '复制交接单'\n`)
      const r = runScript([], { cwd: r3root })
      assert.match(r.stdout, /硬编码中文行数:\s*1/, '声明必须在文件头;躲在尾部不得生效')
      assert.doesNotMatch(r.stdout, /内容文案豁免/, '同上:未生效就不该出现豁免段')
    } finally {
      rmSync(r3root, { recursive: true, force: true })
    }
  })

  //  2026-09-24 事故:`cd505a4374` 把 apps/cli/src 等三端加进扫描面,却没为它们生成基线条目
  //  (targets 仍 5 个旧根、apps/cli 条目 0)⇒ 这些端每个既有中文文件额度都是 0。
  //  本次只把 `interface ReplState` 改成 `export interface ReplState`(中文 250→250,差值 0)
  //  仍被判"新增 245"并拦住提交。修法是让额度锚点自己会说话:max(静态清单, 该文件 HEAD 命中数)。
  //  夹具用**真 git 临时仓**:脚本的 HEAD 维度按 ROOT 取,而 ROOT 可由 --root 指到夹具,
  //  于是能造出"基线文件不存在(额度 0)+ 文件在 HEAD 里本来就有中文"这一精确形态。
  function createGitProject() {
    const root = mkdtempSync(join(tmpdir(), 'ihui-scan-zh-git-'))
    const GIT = 'C:/Program Files/Git/cmd/git.exe'
    const git = (args) =>
      spawnSync(GIT, ['-c', `user.name=t`, '-c', 'user.email=t@t', '-c', 'safe.directory=*', ...args], {
        cwd: root,
        encoding: 'utf8',
        windowsHide: true,
        timeout: 60000,
      })
    git(['init', '-q', '-b', 'main'])
    return { root, git }
  }

  test('HEAD 锚点:既有中文不因"没进静态清单"而被判新增(正反成对)', () => {
    const { root, git } = createGitProject()
    try {
      const rel = 'apps/cli/src/commands/repl.ts'
      mkdirSync(join(root, 'apps/cli/src/commands'), { recursive: true })
      const base = `export const A = '确定'\nexport const B = '取消'\nexport const C = '关闭'\n`
      writeFileSync(join(root, rel), base, 'utf8')
      git(['add', '-A'])
      git(['commit', '-q', '-m', 'init'])
      // 反向对照:内容一字未动,只是工作树副本存在 ⇒ 不得判红
      let r = runScript(['--exit', '1'], { cwd: root })
      assert.equal(r.status, 0, `未改动却被判红:\n${r.stdout}\n${r.stderr}`)
      // 正向对照:真加一条硬编码中文 ⇒ 必须判红(违规清单走 stderr,报告走 stdout,两面都要看)
      writeFileSync(join(root, rel), `${base}export const D = '新增文案'\n`, 'utf8')
      r = runScript(['--exit', '1'], { cwd: root })
      const both = `${r.stdout}\n${r.stderr}`
      assert.notEqual(r.status, 0, '新增一条硬编码中文必须判红 —— HEAD 锚点不得把门改成没牙')
      //  "基线 3" 就是 HEAD 那一维在起作用:额度不再是静态清单的 0,而是该文件 HEAD 自身的命中数;
      //  若退回只看清单,这里会变成"4 处 > 基线 0 处(新增 4)"—— 把既有债全算成本次新增。
      assert.match(both, /repl\.ts: 4 处 > 基线 3 处\(新增 1\)/)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  test('额度表达式必须同时含静态清单与 HEAD 命中数(防被改回只看清单)', () => {
    const src = readFileSync(SCRIPT_PATH, 'utf8')
    assert.match(
      src,
      /Math\.max\(baseline\[h\.file\] \?\? 0, headCountOf\(h\.file\)\)/,
      '锚点维度不得退回单一静态清单',
    )
    assert.match(src, /n = 0 \/\/ 该路径不在 HEAD\(新文件\)/, '新文件额度必须仍为 0(否则"新文件写死中文即拦"失效)')
  })

})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
