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

// 辅助:运行 scan-hardcoded-zh.mjs(cwd 设为临时项目根)
function runScript(args = [], opts = {}) {
  return spawnSync('node', [SCRIPT_PATH, ...args], {
    cwd: opts.cwd || process.cwd(),
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
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

})
