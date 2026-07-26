import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execSync, spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'

// ─── 路径推导(AGENTS.md §15:用 import.meta.url,不硬编码) ───
const __dirname = fileURLToPath(new URL('.', import.meta.url))
const SCRIPT_PATH = join(__dirname, '..', 'check-i18n-messages-exist.mjs')

// ─── 辅助:创建临时项目根目录 ─────────────────────────────
function createTempProject() {
  return mkdtempSync(join(tmpdir(), 'ihui-msg-exist-'))
}

// 辅助:生成合法的 messages .ts 文件内容
// 结构必须满足:
//   1. 含 'export default'
//   2. 匹配 /export\s+default\s*\{([\s\S]*?)\n\}/ (export default { ... } 闭合 }
//   3. 至少 1 个顶级 key(2-space 缩进 + \w+: {)
function makeValidMessagesFile(keys = ['common']) {
  const body = keys.map((k) => `  ${k}: {\n    save: 'Save',\n  },`).join('\n')
  return `export default {\n${body}\n}\n`
}

// 辅助:为指定端写入 5 语言 messages 文件
// endpointName: 'desktop' | 'extension' | 'mobile-rn' | 'miniapp-taro'
// fileContents: 可选,{ [locale]: string } 默认 {} → 用 makeValidMessagesFile()
function writeEndpointMessages(root, endpointName, fileContents = {}) {
  const dirMap = {
    desktop: 'apps/desktop/src/i18n/messages',
    extension: 'apps/extension/src/i18n/messages',
    'mobile-rn': 'apps/mobile-rn/src/i18n/messages',
    'miniapp-taro': 'apps/miniapp-taro/src/i18n', // 注意:无 messages/ 子目录
  }
  const dir = join(root, dirMap[endpointName])
  mkdirSync(dir, { recursive: true })
  const locales = ['zh-CN', 'en', 'ja', 'ko', 'zh-TW']
  for (const locale of locales) {
    const content = fileContents[locale] || makeValidMessagesFile()
    writeFileSync(join(dir, `${locale}.ts`), content)
  }
}

// 辅助:为 4 端全部写入合法 messages 文件
function writeAllEndpointsValid(root) {
  writeEndpointMessages(root, 'desktop')
  writeEndpointMessages(root, 'extension')
  writeEndpointMessages(root, 'mobile-rn')
  writeEndpointMessages(root, 'miniapp-taro')
}

// 辅助:运行 check-i18n-messages-exist.mjs
function runScript(args = [], opts = {}) {
  return spawnSync('node', [SCRIPT_PATH, ...args], {
    cwd: opts.cwd || process.cwd(),
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, ...opts.env },
  })
}

// 辅助:初始化 git 仓库(含 baseline commit,用于 --staged 测试)
function initGitRepo(root) {
  execSync('git init -b main', { cwd: root, stdio: 'pipe' })
  execSync('git config user.email test@test.com', { cwd: root, stdio: 'pipe' })
  execSync('git config user.name test', { cwd: root, stdio: 'pipe' })
  execSync('git config commit.gpgsign false', { cwd: root, stdio: 'pipe' })
  writeFileSync(join(root, 'README.md'), '# init\n')
  execSync('git add README.md', { cwd: root, stdio: 'pipe' })
  execSync('git commit -m "init"', { cwd: root, stdio: 'pipe' })
}

// ─── 1. CLI --help 不崩溃(脚本未实现 --help,按默认模式运行) ─
test('CLI: --help 不崩溃(无文件 → 报告全部缺失 exit 1)', () => {
  const root = createTempProject()
  try {
    const r = runScript(['--help'], { cwd: root })
    // 无任何文件 → 20 个全缺失 → exit 1,但不应 crash
    assert.ok(r.status === 0 || r.status === 1, `--help 不应 crash,实际 exit ${r.status}\nstderr: ${r.stderr}`)
    assert.ok(!r.stderr.includes('Error:'), `--help 不应产生未捕获 Error`)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 2. 4 端 × 5 语言 = 20 文件全部存在且合法 → 通过 ────
test('通过: 4 端 × 5 语言 = 20 文件全部存在且合法 → exit 0', () => {
  const root = createTempProject()
  try {
    writeAllEndpointsValid(root)
    const r = runScript([], { cwd: root })
    assert.equal(r.status, 0, `20 文件全合法应 exit 0,实际 ${r.status}\nstdout: ${r.stdout}\nstderr: ${r.stderr}`)
    assert.match(r.stdout, /✅.*通过|20 文件全部存在且合法/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 3. 缺失文件(desktop/en.ts 缺失)→ 检测到 file-missing
test('违规: desktop/en.ts 缺失 → exit 1 (file-missing)', () => {
  const root = createTempProject()
  try {
    writeAllEndpointsValid(root)
    // 删除 desktop/en.ts
    rmSync(join(root, 'apps/desktop/src/i18n/messages/en.ts'))
    const r = runScript([], { cwd: root })
    assert.equal(r.status, 1, `缺 desktop/en.ts 应 exit 1,实际 ${r.status}`)
    // 注:源脚本违规消息输出到 stderr(console.error)
    assert.match(r.stderr, /file-missing|缺失文件/)
    assert.match(r.stderr, /desktop/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 4. 缺失目录(apps/extension/src/i18n/messages/ 缺失)→ directory-missing
test('违规: extension messages 目录缺失 → exit 1 (directory-missing)', () => {
  const root = createTempProject()
  try {
    writeAllEndpointsValid(root)
    // 删除整个 extension messages 目录
    rmSync(join(root, 'apps/extension/src/i18n/messages'), { recursive: true, force: true })
    const r = runScript([], { cwd: root })
    assert.equal(r.status, 1, `extension 目录缺失应 exit 1,实际 ${r.status}`)
    // 注:源脚本违规消息输出到 stderr(console.error)
    assert.match(r.stderr, /directory-missing|缺失/)
    assert.match(r.stderr, /extension/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 5. 文件无 export default → no-export-default ────────
test('违规: 文件无 export default → exit 1 (no-export-default)', () => {
  const root = createTempProject()
  try {
    writeAllEndpointsValid(root)
    // 覆盖 desktop/zh-CN.ts 为无 export default 的内容
    writeFileSync(
      join(root, 'apps/desktop/src/i18n/messages/zh-CN.ts'),
      "const messages = { common: { save: '保存' } }\nexport { messages }\n",
    )
    const r = runScript([], { cwd: root })
    assert.equal(r.status, 1, `无 export default 应 exit 1,实际 ${r.status}`)
    // 注:源脚本违规消息输出到 stderr(console.error)
    assert.match(r.stderr, /no-export-default|解析错误/)
    assert.match(r.stderr, /desktop/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 6. 文件有 export default 但无顶级 key → no-top-level-keys
test('违规: export default {} 空对象 → exit 1 (no-top-level-keys)', () => {
  const root = createTempProject()
  try {
    writeAllEndpointsValid(root)
    // 覆盖 mobile-rn/en.ts 为空 export default
    writeFileSync(join(root, 'apps/mobile-rn/src/i18n/messages/en.ts'), 'export default {\n}\n')
    const r = runScript([], { cwd: root })
    assert.equal(r.status, 1, `空 export default 应 exit 1,实际 ${r.status}`)
    // 注:源脚本违规消息输出到 stderr(console.error)
    assert.match(r.stderr, /no-top-level-keys|空文件/)
    assert.match(r.stderr, /mobile-rn/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 7. --staged 模式(无 i18n staged → 跳过 exit 0)────
test('--staged: 暂存区无 i18n 改动 → 跳过 exit 0', () => {
  const root = createTempProject()
  try {
    initGitRepo(root)
    writeAllEndpointsValid(root)
    // 不 stage 任何 i18n 文件(stage 一个无关文件)
    writeFileSync(join(root, 'other.txt'), 'x\n')
    execSync('git add other.txt', { cwd: root, stdio: 'pipe' })
    const r = runScript(['--staged'], { cwd: root })
    assert.equal(r.status, 0, `staged 无 i18n 应跳过 exit 0,实际 ${r.status}`)
    assert.match(r.stdout, /跳过|暂存区无 i18n 改动/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 8. --staged 模式(i18n staged → 触发检查)──────────
test('--staged: 暂存区含 i18n 改动 → 触发检查', () => {
  const root = createTempProject()
  try {
    initGitRepo(root)
    writeAllEndpointsValid(root)
    // stage 一个 i18n 文件(但其他端有缺失)
    rmSync(join(root, 'apps/extension/src/i18n/messages/en.ts'))
    execSync('git add apps/desktop/src/i18n/messages/en.ts', { cwd: root, stdio: 'pipe' })
    const r = runScript(['--staged'], { cwd: root })
    // staged 模式触发后,检查所有 4 端(extension/en.ts 缺失 → exit 1)
    assert.equal(r.status, 1, `staged 触发检查后 extension/en.ts 缺失应 exit 1,实际 ${r.status}`)
    // 注:源脚本违规消息输出到 stderr(console.error)
    assert.match(r.stderr, /extension|file-missing|缺失/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 9. miniapp-taro 路径差异(无 messages/ 子目录)──────
test('路径: miniapp-taro 文件在 src/i18n/ 而非 src/i18n/messages/', () => {
  const root = createTempProject()
  try {
    writeAllEndpointsValid(root)
    const r = runScript([], { cwd: root })
    // miniapp-taro 路径正确 → 不应报缺失
    assert.equal(r.status, 0, `miniapp-taro 路径正确应 exit 0,实际 ${r.status}\nstdout: ${r.stdout}`)
    // 确认 miniapp-taro 不在缺失列表中
    const missingSection = r.stdout.split('缺失')[1] || ''
    assert.ok(!/miniapp-taro/.test(missingSection), 'miniapp-taro 不应出现在缺失列表')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 10. 批量: 多端同时有问题 → 全部报告 ────────────────
test('批量: desktop + extension 同时缺文件 → 报告两端', () => {
  const root = createTempProject()
  try {
    writeAllEndpointsValid(root)
    // 删除 desktop/ja.ts 和 extension/ko.ts
    rmSync(join(root, 'apps/desktop/src/i18n/messages/ja.ts'))
    rmSync(join(root, 'apps/extension/src/i18n/messages/ko.ts'))
    const r = runScript([], { cwd: root })
    assert.equal(r.status, 1, `两端缺文件应 exit 1,实际 ${r.status}`)
    // 注:源脚本违规消息输出到 stderr(console.error)
    assert.match(r.stderr, /desktop/)
    assert.match(r.stderr, /extension/)
    // 应报告 2 处问题
    assert.match(r.stderr, /\d+\s*处问题/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 11. export default 形状不匹配(无 { ... } 闭合)→ invalid-export-default-shape
test('违规: export default 非对象(如数组)→ exit 1 (invalid-export-default-shape)', () => {
  const root = createTempProject()
  try {
    writeAllEndpointsValid(root)
    // 覆盖 miniapp-taro/en.ts 为 export default 数组
    writeFileSync(
      join(root, 'apps/miniapp-taro/src/i18n/en.ts'),
      "export default ['save', 'cancel']\n",
    )
    const r = runScript([], { cwd: root })
    assert.equal(r.status, 1, `export default 数组应 exit 1,实际 ${r.status}`)
    // 注:源脚本违规消息输出到 stderr(console.error)
    assert.match(r.stderr, /invalid-export-default-shape|解析错误/)
    assert.match(r.stderr, /miniapp-taro/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 12. 多语言文件全部缺失(空项目)→ 报告 20 处 ─────────
test('空项目: 4 端全部缺失 → 报告 directory-missing × 4', () => {
  const root = createTempProject()
  try {
    // 不创建任何文件
    const r = runScript([], { cwd: root })
    assert.equal(r.status, 1, `空项目应 exit 1,实际 ${r.status}`)
    // 4 端 directory-missing(注:源脚本违规消息输出到 stderr via console.error)
    assert.match(r.stderr, /directory-missing/)
    assert.match(r.stderr, /desktop/)
    assert.match(r.stderr, /extension/)
    assert.match(r.stderr, /mobile-rn/)
    assert.match(r.stderr, /miniapp-taro/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 13. 自定义顶级 key(多个命名空间)→ 通过 ───────────
test('合法: 多命名空间(common/nav/models)→ exit 0', () => {
  const root = createTempProject()
  try {
    const customContent = [
      "export default {",
      "  common: {",
      "    save: 'Save',",
      "  },",
      "  nav: {",
      "    home: 'Home',",
      "  },",
      "  models: {",
      "    user: 'User',",
      "  },",
      "}",
    ].join('\n')
    writeEndpointMessages(root, 'desktop', {
      'zh-CN': customContent.replace(/Save|Home|User/g, 'x'),
      en: customContent,
    })
    writeEndpointMessages(root, 'extension')
    writeEndpointMessages(root, 'mobile-rn')
    writeEndpointMessages(root, 'miniapp-taro')
    const r = runScript([], { cwd: root })
    assert.equal(r.status, 0, `多命名空间应 exit 0,实际 ${r.status}\nstdout: ${r.stdout}`)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
