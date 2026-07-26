import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execSync, spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'

// ─── 路径推导(AGENTS.md §15:用 import.meta.url,不硬编码) ───
const __dirname = fileURLToPath(new URL('.', import.meta.url))
const SCRIPT_PATH = join(__dirname, '..', 'check-i18n-broken-en.mjs')

// ─── 辅助:创建临时项目根目录 ─────────────────────────────
function createTempProject() {
  return mkdtempSync(join(tmpdir(), 'ihui-broken-en-'))
}

// 辅助:写入 web en.json(默认 target=web)
function writeWebEn(root, obj) {
  const dir = join(root, 'packages', 'i18n', 'messages', 'web')
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'en.json'), JSON.stringify(obj, null, 2))
}

// 辅助:写入 web zh-CN.json(用于验证"不扫描 zh-CN")
function writeWebZhCN(root, obj) {
  const dir = join(root, 'packages', 'i18n', 'messages', 'web')
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'zh-CN.json'), JSON.stringify(obj, null, 2))
}

// 辅助:写入 extension en.json
function writeExtensionEn(root, obj) {
  const dir = join(root, 'packages', 'i18n', 'messages', 'extension')
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'en.json'), JSON.stringify(obj, null, 2))
}

// 辅助:写入 README.en.md
function writeReadmeEn(root, text) {
  writeFileSync(join(root, 'README.en.md'), text)
}

// 辅助:运行 check-i18n-broken-en.mjs
function runScript(args = [], opts = {}) {
  return spawnSync('node', [SCRIPT_PATH, ...args], {
    cwd: opts.cwd || process.cwd(),
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, ...opts.env },
  })
}

// 辅助:初始化 git 仓库(用于 --staged 测试)
function initGitRepo(root) {
  execSync('git init -b main', { cwd: root, stdio: 'pipe' })
  execSync('git config user.email test@test.com', { cwd: root, stdio: 'pipe' })
  execSync('git config user.name test', { cwd: root, stdio: 'pipe' })
  execSync('git config commit.gpgsign false', { cwd: root, stdio: 'pipe' })
}

// ─── 1. CLI --help 不崩溃(脚本未实现 --help,按默认模式运行) ─
test('CLI: --help 不崩溃(无 en.json → 跳过 exit 0)', () => {
  const root = createTempProject()
  try {
    const r = runScript(['--help'], { cwd: root })
    // 无 en.json 文件 → "跳过 (文件不存在: ...)" exit 0
    assert.equal(r.status, 0, `--help 应 exit 0(文件不存在跳过),实际 ${r.status}\nstdout: ${r.stdout}\nstderr: ${r.stderr}`)
    assert.ok(!r.stderr.includes('Error:'), `--help 不应产生未捕获 Error`)
    assert.match(r.stdout, /跳过|文件不存在/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 2. en.json 全英文无中文 → 通过 ─────────────────────
test('通过: en.json 全英文无中文 → exit 0', () => {
  const root = createTempProject()
  try {
    writeWebEn(root, {
      common: { save: 'Save', cancel: 'Cancel', delete: 'Delete' },
      nav: { home: 'Home', settings: 'Settings' },
    })
    const r = runScript([], { cwd: root })
    assert.equal(r.status, 0, `全英文应 exit 0,实际 ${r.status}\nstdout: ${r.stdout}`)
    assert.match(r.stdout, /✅.*通过|0 处破碎英文/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 3. en.json 含中文字符 → 检测到 zh-residue ───────────
test('违规: en.json value 含中文字符 → exit 1 (zh-residue)', () => {
  const root = createTempProject()
  try {
    writeWebEn(root, {
      common: { greeting: 'Hello 你好', save: 'Save' },
    })
    const r = runScript([], { cwd: root })
    assert.equal(r.status, 1, `含中文应 exit 1,实际 ${r.status}`)
    assert.match(r.stdout, /zh-residue|破碎机翻英文/)
    assert.match(r.stdout, /greeting/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 4. en.json 含破碎机翻(3+ CamelCase 无空格拼接) ────
// 注:AgentDevPlatform 含 'orm'(Platform 子串)匹配白名单 'ORM' → 豁免,不算违规
// 注:BigModelAppDevRole 含 'vr'(devRole 子串)匹配白名单 'VR' → 豁免,不算违规
// 改用 BigModelAppDevTest(不含任何白名单子串)
test('违规: BigModelAppDevTest (4 CamelCase 词) → exit 1 (no-space-concat)', () => {
  const root = createTempProject()
  try {
    writeWebEn(root, {
      models: { platform: 'BigModelAppDevTest' },
    })
    const r = runScript([], { cwd: root })
    assert.equal(r.status, 1, `BigModelAppDevTest 应 exit 1,实际 ${r.status}`)
    assert.match(r.stdout, /no-space-concat|破碎机翻英文/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 4b. 3 词 CamelCase 也算违规 ─────────────────────────
test('违规: BigModelAppDev (3 CamelCase 词) → exit 1 (no-space-concat)', () => {
  const root = createTempProject()
  try {
    writeWebEn(root, {
      label: { x: 'BigModelAppDev' },
    })
    const r = runScript([], { cwd: root })
    assert.equal(r.status, 1, `BigModelAppDev 应 exit 1,实际 ${r.status}`)
    assert.match(r.stdout, /no-space-concat/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 4c. 白名单精确匹配(AgentDevPlatform 不再被 ORM 子串误豁免) ─
// 修复前:'agentdevplatform'.includes('orm') = true → 白名单豁免(误,已知 bug)
// 修复后:完整 token 不等、按 -/_/. 分段也不等 → 不豁免 → 检测为 no-space-concat
test('违规: AgentDevPlatform (3 CamelCase 词) 不再被 ORM 子串误豁免 → exit 1 (no-space-concat)', () => {
  const root = createTempProject()
  try {
    writeWebEn(root, {
      label: { x: 'AgentDevPlatform' },
    })
    const r = runScript([], { cwd: root })
    // 修复后:AgentDevPlatform 不再被 'orm' 子串误豁免,检测为 no-space-concat
    assert.equal(r.status, 1, `AgentDevPlatform 应检测为 no-space-concat,实际 ${r.status}`)
    assert.match(r.stdout, /no-space-concat/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 4d. 白名单短 token 不再子串误豁免(M3SubAI → case-chaos) ─────
// Bug:WHITELIST_TOKENS 中的 'M3' 因子串包含匹配命中 "M3SubAI" → 错误豁免
// 修复:M3 完整 token 不等、按 -/_/. 分段也不等 → 不豁免 → 检测为 case-chaos
test('违规: M3SubAI 不再被 M3 子串误豁免 → exit 1 (case-chaos)', () => {
  const root = createTempProject()
  try {
    writeWebEn(root, {
      models: { x: 'M3SubAI' },
    })
    const r = runScript([], { cwd: root })
    assert.equal(r.status, 1, `M3SubAI 应检测为 case-chaos,实际 ${r.status}`)
    assert.match(r.stdout, /case-chaos/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 4e. 合法连字符复合词仍豁免(GPT-4) ─────────────────────
// 注:GPT-4 在 token 分割阶段被 - 切成 ["GPT", "4"],均 <4 字符跳过,合法通过
test('豁免: GPT-4 连字符复合词(GPT 在白名单)→ exit 0', () => {
  const root = createTempProject()
  try {
    writeWebEn(root, {
      models: { x: 'GPT-4' },
    })
    const r = runScript([], { cwd: root })
    assert.equal(r.status, 0, `GPT-4 应豁免,实际 ${r.status}`)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 4f. 白名单完整 token 等于(M3 单独 → 豁免) ─────────────
// 注:M3 长度 2 < 4,detectBroken 早返回 null;此处验证 M3 不会被误判
test('豁免: M3 单独(完整 token 等于白名单项)→ exit 0', () => {
  const root = createTempProject()
  try {
    writeWebEn(root, {
      models: { x: 'M3' },
    })
    const r = runScript([], { cwd: root })
    assert.equal(r.status, 0, `M3 单独应豁免,实际 ${r.status}`)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 5. en.json 含合法驼峰(2 段复合词)→ 通过 ───────────
test('通过: userRole (2 段复合词,合法驼峰) → exit 0', () => {
  const root = createTempProject()
  try {
    writeWebEn(root, {
      fields: { userRole: 'UserRole', status: 'Status' },
    })
    const r = runScript([], { cwd: root })
    assert.equal(r.status, 0, `UserRole (2 段) 应 exit 0,实际 ${r.status}\nstdout: ${r.stdout}`)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 6. en.json 含品牌名(OpenAI / Anthropic)→ 通过 ────
test('通过: 品牌名 OpenAI / Anthropic / ChatGPT → exit 0', () => {
  const root = createTempProject()
  try {
    writeWebEn(root, {
      vendors: {
        openai: 'OpenAI',
        anthropic: 'Anthropic',
        chatgpt: 'ChatGPT',
        claude: 'Claude',
      },
    })
    const r = runScript([], { cwd: root })
    assert.equal(r.status, 0, `品牌名应 exit 0,实际 ${r.status}\nstdout: ${r.stdout}`)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 7. en.json 占位符 {var} / {{var}} 保留 → 通过 ──────
test('通过: 占位符 {name} / {{count}} 保留 → exit 0', () => {
  const root = createTempProject()
  try {
    writeWebEn(root, {
      messages: {
        welcome: 'Hello {name}',
        count: 'You have {{count}} items',
      },
    })
    const r = runScript([], { cwd: root })
    assert.equal(r.status, 0, `占位符应 exit 0,实际 ${r.status}\nstdout: ${r.stdout}`)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 8. zh-CN.json 不扫描(只扫 en.json)────────────────
test('范围: zh-CN.json 含破碎英文但 en.json 干净 → exit 0(只扫 en.json)', () => {
  const root = createTempProject()
  try {
    // en.json 干净
    writeWebEn(root, { common: { save: 'Save' } })
    // zh-CN.json 含"破碎英文"(如果被扫描会违规,但脚本只扫 en.json)
    writeWebZhCN(root, { common: { save: 'AgentDevPlatform' } })
    const r = runScript([], { cwd: root })
    assert.equal(r.status, 0, `只扫 en.json,不应扫 zh-CN.json,实际 ${r.status}\nstdout: ${r.stdout}`)
    assert.match(r.stdout, /✅.*通过|0 处破碎英文/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 9. 批量扫描多个 key(多处违规)──────────────────────
test('批量: 多 key 含违规 → 报告全部 violations', () => {
  const root = createTempProject()
  try {
    writeWebEn(root, {
      a: { x: 'BigModelAppDev' }, // no-space-concat(不含白名单子串)
      b: { y: 'IconFileThing' }, // no-space-concat
      c: { z: 'Save' }, // 合法
      d: { w: '你好世界' }, // 中文残留
    })
    const r = runScript([], { cwd: root })
    assert.equal(r.status, 1, `多处违规应 exit 1,实际 ${r.status}`)
    assert.match(r.stdout, /发现\s*\d+\s*处破碎机翻英文/)
    // 应报告 a.x 和 b.y(no-space-concat)及 d.w(zh-residue)
    assert.match(r.stdout, /no-space-concat/)
    assert.match(r.stdout, /zh-residue/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 10. 嵌套 JSON 结构扫描 ─────────────────────────────
test('嵌套: 深层嵌套对象中的违规 → 被检测到', () => {
  const root = createTempProject()
  try {
    writeWebEn(root, {
      level1: {
        level2: {
          level3: {
            deep: 'BigModelAppDev', // no-space-concat(不含白名单子串)
          },
        },
      },
    })
    const r = runScript([], { cwd: root })
    assert.equal(r.status, 1, `深层嵌套违规应 exit 1,实际 ${r.status}`)
    // path 应反映嵌套层级
    assert.match(r.stdout, /level1\.level2\.level3\.deep/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 11. 空 en.json ({})→ 通过 ─────────────────────────
test('空 JSON: {} 无 leaf value → exit 0', () => {
  const root = createTempProject()
  try {
    writeWebEn(root, {})
    const r = runScript([], { cwd: root })
    assert.equal(r.status, 0, `空 JSON 应 exit 0,实际 ${r.status}\nstdout: ${r.stdout}`)
    assert.match(r.stdout, /✅.*通过|0 处破碎英文/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 12. JSON 解析失败 → 错误处理 exit 1 ────────────────
test('JSON 解析失败: 损坏 JSON → exit 1', () => {
  const root = createTempProject()
  try {
    const dir = join(root, 'packages', 'i18n', 'messages', 'web')
    mkdirSync(dir, { recursive: true })
    // 故意写损坏的 JSON(trailing comma)
    writeFileSync(join(dir, 'en.json'), '{ "common": { "save": "Save", } }')
    const r = runScript([], { cwd: root })
    assert.equal(r.status, 1, `损坏 JSON 应 exit 1,实际 ${r.status}`)
    // 注:JSON 解析失败消息输出到 stderr(console.error)
    assert.match(r.stderr, /JSON 解析失败/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 13. --target=extension 切换到 extension en.json ────
test('--target=extension: 切换到 extension en.json', () => {
  const root = createTempProject()
  try {
    // extension en.json 含违规(你好世界 ≥ 4 字符)
    writeExtensionEn(root, { common: { x: '你好世界' } })
    const r = runScript(['--target=extension'], { cwd: root })
    assert.equal(r.status, 1, `extension target 含中文应 exit 1,实际 ${r.status}`)
    assert.match(r.stdout, /zh-residue/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 14. --readme 模式扫描 README.en.md ─────────────────
test('--readme: 扫描 README.en.md 检测破碎英文', () => {
  const root = createTempProject()
  try {
    // README.en.md 含破碎英文 token(用 BigModelAppDevTest,不含白名单子串)
    writeReadmeEn(root, '# IHUI AI Platform\n\nThis is BigModelAppDevTest for testing.\n')
    const r = runScript(['--readme'], { cwd: root })
    assert.equal(r.status, 1, `README 含破碎英文应 exit 1,实际 ${r.status}`)
    assert.match(r.stdout, /no-space-concat|破碎英文/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 14b. --readme 模式: 代码块内容跳过 ─────────────────
test('--readme: 代码块内破碎英文被跳过(``` fence)', () => {
  const root = createTempProject()
  try {
    writeReadmeEn(
      root,
      [
        '# README',
        '',
        '```js',
        'const x = "AgentDevPlatformRole";',
        '```',
        '',
        'Normal text is fine.',
      ].join('\n'),
    )
    const r = runScript(['--readme'], { cwd: root })
    assert.equal(r.status, 0, `代码块内破碎英文应跳过,实际 ${r.status}\nstdout: ${r.stdout}`)
    assert.match(r.stdout, /✅.*通过|0 处破碎英文/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 15. --staged 模式(无 git repo → 跳过)─────────────
test('--staged: 无 git repo → 跳过 exit 0', () => {
  const root = createTempProject()
  try {
    writeWebEn(root, { common: { x: '你好' } }) // 含违规
    // 无 git init → getStagedChanges 返回 [] → 不在 staged 列表 → 跳过
    const r = runScript(['--staged'], { cwd: root })
    assert.equal(r.status, 0, `--staged 无 git 应跳过 exit 0,实际 ${r.status}`)
    assert.match(r.stdout, /跳过/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 16. --staged 模式(en.json 已 staged → 扫描)──────
test('--staged: en.json 已 staged → 触发扫描', () => {
  const root = createTempProject()
  try {
    initGitRepo(root)
    writeWebEn(root, { common: { x: '你好世界' } }) // 含违规(≥4 字符)
    execSync('git add packages/i18n/messages/web/en.json', { cwd: root, stdio: 'pipe' })
    const r = runScript(['--staged'], { cwd: root })
    assert.equal(r.status, 1, `staged en.json 含违规应 exit 1,实际 ${r.status}`)
    assert.match(r.stdout, /zh-residue/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 17. 跨语言品牌名标注(括号内附中文品牌名)→ 豁免 ────
test('豁免: "IHUI AI (智汇 AI)" 括号内品牌名 → exit 0', () => {
  const root = createTempProject()
  try {
    writeWebEn(root, {
      brand: { name: 'IHUI AI (智汇 AI)' },
    })
    const r = runScript([], { cwd: root })
    assert.equal(r.status, 0, `括号内品牌名应豁免,实际 ${r.status}\nstdout: ${r.stdout}`)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 18. 语言原生名称白名单(语言选择器本名)→ 豁免 ─────
test('豁免: "简体中文" / "日本語" 语言本名 → exit 0', () => {
  const root = createTempProject()
  try {
    writeWebEn(root, {
      languages: {
        zhCN: '简体中文',
        ja: '日本語',
        zhTW: '繁體中文',
      },
    })
    const r = runScript([], { cwd: root })
    assert.equal(r.status, 0, `语言本名应豁免,实际 ${r.status}\nstdout: ${r.stdout}`)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 19. --fix 模式(提供诊断,不写文件)──────────────────
test('--fix: 含违规时提供诊断建议(不自动写文件)', () => {
  const root = createTempProject()
  try {
    writeWebEn(root, { common: { x: 'BigModelAppDev' } })
    const r = runScript(['--fix'], { cwd: root })
    assert.equal(r.status, 1, `--fix 含违规仍 exit 1,实际 ${r.status}`)
    assert.match(r.stdout, /--fix 模式|不自动写文件|诊断/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
