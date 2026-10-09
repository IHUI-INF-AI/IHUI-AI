// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execSync, execFileSync, spawnSync } from 'node:child_process'
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { fileURLToPath, pathToFileURL } from 'node:url'

// ─── 路径推导(AGENTS.md §15:用 import.meta.url,不硬编码) ───
const __dirname = fileURLToPath(new URL('.', import.meta.url))
const SCRIPT_PATH = join(__dirname, '..', 'check-i18n-keys.mjs')

// ─── 辅助:创建临时项目根目录 ─────────────────────────────
function createTempProject() {
  return mkScratch('ihui-i18n-')
}

// 辅助:写入 web messages(packages/i18n/messages/web/<lang>.json)
function writeWebMessages(root, msgs) {
  const dir = join(root, 'packages', 'i18n', 'messages', 'web')
  mkdirSync(dir, { recursive: true })
  for (const [lang, content] of Object.entries(msgs)) {
    writeFileSync(join(dir, `${lang}.json`), JSON.stringify(content, null, 2))
  }
}

// 辅助:写入 shared messages
function writeSharedMessages(root, msgs) {
  const dir = join(root, 'packages', 'i18n', 'messages', 'shared')
  mkdirSync(dir, { recursive: true })
  for (const [lang, content] of Object.entries(msgs)) {
    writeFileSync(join(dir, `${lang}.json`), JSON.stringify(content, null, 2))
  }
}

// 辅助:写入 extension messages
function writeExtensionMessages(root, msgs) {
  const dir = join(root, 'packages', 'i18n', 'messages', 'extension')
  mkdirSync(dir, { recursive: true })
  for (const [lang, content] of Object.entries(msgs)) {
    writeFileSync(join(dir, `${lang}.json`), JSON.stringify(content, null, 2))
  }
}

// 辅助:创建空的 apps/web/src 目录(让 collectSourceFiles 找到 .ts 文件)
function createEmptyWebSource(root) {
  const dir = join(root, 'apps', 'web', 'src')
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'index.ts'), 'export const x = 1\n')
}

// 辅助:初始化 git 仓库
function initGitRepo(root) {
  // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
  execSync('git init -b main', { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] })
  // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
  execSync('git config user.email test@test.com', { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] })
  // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
  execSync('git config user.name test', { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] })
  // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
  execSync('git config commit.gpgsign false', { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] })
}

// 辅助:运行 check-i18n-keys.mjs
// ⚠️ 2026-09-26:本门默认判定面从"磁盘"改成 **HEAD blob**(见下 F 组用例)。
// 本文件绝大多数用例的夹具是 `mkdtempSync` 造的**合成目录、没有 .git**,语言包只存在于磁盘上 ——
// 按 HEAD 判就必然"列到 0 个包 ⇒ 无法判定 exit 2",于是 30+ 条判据用例会集体翻红,
// 而红的理由是"取材面里没有这份输入",不是判据本身。所以这里默认补 `--worktree`
// (门提供的**人工/夹具**逃生舱),让夹具继续测它们要测的那件事:判据形态。
// 判定面本身**不靠这一条兜过去**:它由下面 F1–F4 在一棵**真临时 git 仓**上直接测,
// 那几例一律显式传面旗,不走这里的默认注入。
const FACE_FLAGS = ['--staged', '--worktree']
function runScript(args = [], opts = {}) {
  const finalArgs = FACE_FLAGS.some((f) => args.includes(f)) ? args : [...args, '--worktree']
  // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
  return spawnSync('node', [SCRIPT_PATH, ...finalArgs], {
    cwd: opts.cwd || process.cwd(),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, ...opts.env },
  })
}

/** 判定面用例专用:**不**注入 --worktree,面旗必须由调用方显式给出。 */
function runFaceScript(args, opts = {}) {
  // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
  return spawnSync('node', [SCRIPT_PATH, ...args], {
    cwd: opts.cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, ...opts.env },
  })
}

// 5 语言一致的 key 集合(zh-CN 为基准)
const PARITY_OK = {
  'zh-CN': { common: { save: '保存', cancel: '取消' }, nav: { home: '首页' } },
  'zh-TW': { common: { save: '儲存', cancel: '取消' }, nav: { home: '首頁' } },
  ko: { common: { save: '저장', cancel: '취소' }, nav: { home: '홈' } },
  ja: { common: { save: '保存', cancel: 'キャンセル' }, nav: { home: 'ホーム' } },
  en: { common: { save: 'Save', cancel: 'Cancel' }, nav: { home: 'Home' } },
}

// ─── 1. CLI --help ───────────────────────────────────────
test('CLI: --help 不崩溃(脚本未实现 --help,按默认模式运行)', () => {
  const root = createTempProject()
  try {
    // 无 messages 目录 + **没**指名 target → 脚本输出"…语言包,跳过"并 exit 0(默认档跳过)。
    // 【原为"待拍板 · 两侧互斥",合并时收口】两路的结论并不真的互斥,因为它们各自答的是不同输入:
    //   · 本路答的是"没指名要查哪一端"(空仓 / 部分 checkout / 尚未建 messages)——合法形态,判死就是
    //     一台与本次提交无关的恒红门(AGENTS §12e ⇒ 逼出 --no-verify,一次作废约 185 道门)。
    //   · 另一路答的是"显式 --target=api 而根读不到"——那一族一次也没被扫过却回身打印通过,
    //     回落就是把"没判"写成"判过了"(G-304 的立项事故形态)。
    // 所以合并件按"处置动作不同的两种输入"分两手,两侧各自的修复都还在:本条测没指名那一手,
    // 下面 1b 测指名那一手(指名 ⇒ exit 2)。谁都不许被折成对方的默认值。
    const r = runScript(['--help'], { cwd: root })
    assert.equal(
      r.status,
      0,
      `--help 应 exit 0,实际 ${r.status}\nstdout: ${r.stdout}\nstderr: ${r.stderr}`,
    )
    assert.ok(!r.stderr.includes('Error:'), `--help 不应产生未捕获 Error`)
    assert.match(
      `${r.stdout}\n${r.stderr}`,
      /端目录漂移对账未判定/,
      '取不到端目录时必须自报"未对账",不得把"没判"写成"判过了"(另一路实现的反腐烂意图)',
    )
  } finally {
    rmScratch(root)
  }
})

// ─── 1b. 同一个"读不到 messages 根"的输入,按有没有指名 target 分两手(两侧分歧的收口处)──
test('根取不到:没指名 target ⇒ exit 0 且自报未对账;指名了 ⇒ exit 2,不冒绿也不回落 web', () => {
  const root = createTempProject()
  try {
    const bare = runScript(['--worktree'], { cwd: root })
    assert.equal(
      bare.status,
      0,
      `没指名 target 时空仓是合法形态,判死就是恒红门(AGENTS §12e);实得 ${bare.status}\n${bare.stdout}\n${bare.stderr}`,
    )
    assert.match(`${bare.stdout}\n${bare.stderr}`, /端目录漂移对账未判定/, '放过必须喊得出来')
    const named = runScript(['--target=api', '--worktree'], { cwd: root })
    assert.equal(
      named.status,
      2,
      `指名要查 api 而根目录读不到 ⇒ 那一族一次也没被扫过,必须按"无法判定"判死;实得 ${named.status}\n${named.stdout}\n${named.stderr}`,
    )
    assert.match(
      `${named.stdout}\n${named.stderr}`,
      /无法判定/,
      'exit 2 要给可诊断原因,不能只留一个码',
    )
    assert.doesNotMatch(
      `${named.stdout}\n${named.stderr}`,
      /parity OK|通过,parity 比对/,
      '判死那一趟同时打出「通过」= 自相矛盾的合格证',
    )
  } finally {
    rmScratch(root)
  }
})

// ─── 2. CLI --staged 模式(无 staged 文件 → 跳过) ────────
test('CLI: --staged 模式(无 staged 文件 → 跳过 exit 0)', () => {
  const root = createTempProject()
  try {
    initGitRepo(root)
    writeWebMessages(root, PARITY_OK)
    // 不 stage 任何文件 → "无源文件变更,跳过"
    const r = runScript(['--staged'], { cwd: root })
    assert.equal(r.status, 0, `--staged 无 staged 文件应 exit 0,实际 ${r.status}`)
    assert.match(r.stdout, /无源文件变更|跳过/)
  } finally {
    rmScratch(root)
  }
})

// ─── 3. CLI 无参数运行(默认全量检查) ───────────────────
test('CLI: 无参数运行(有 apps/web 源码 + parity OK → exit 0)', () => {
  const root = createTempProject()
  try {
    writeWebMessages(root, PARITY_OK)
    createEmptyWebSource(root)
    const r = runScript([], { cwd: root })
    assert.equal(r.status, 0, `默认模式 parity OK 应 exit 0,实际 ${r.status}\nstdout: ${r.stdout}`)
    assert.match(r.stdout, /parity OK/)
  } finally {
    rmScratch(root)
  }
})

// ─── 4. 5 语言 parity 校验(一致 → 通过) ─────────────────
test('parity: 5 语言 key 集合一致 → exit 0', () => {
  const root = createTempProject()
  try {
    writeWebMessages(root, PARITY_OK)
    const r = runScript(['--parity-only'], { cwd: root })
    assert.equal(r.status, 0, `5 语言 parity 一致应 exit 0,实际 ${r.status}\nstdout: ${r.stdout}`)
    assert.match(r.stdout, /parity OK/)
  } finally {
    rmScratch(root)
  }
})

// ─── 5. zh-CN 是基准语言 ────────────────────────────────
test('基准: zh-CN 是基准语言(其他 4 语言对比 zh-CN)', () => {
  const root = createTempProject()
  try {
    // ko 缺失 common.save(zh-CN 有)→ base-only 命中
    const msgs = JSON.parse(JSON.stringify(PARITY_OK))
    delete msgs.ko.common.save
    writeWebMessages(root, msgs)
    const r = runScript(['--parity-only'], { cwd: root })
    assert.equal(r.status, 1, `ko 缺失 zh-CN 的 key 应 exit 1,实际 ${r.status}`)
    assert.match(r.stdout, /zh-CN 有但 ko 缺失/)
  } finally {
    rmScratch(root)
  }
})

// ─── 6. 缺失 key 检测(zh-CN 有,ko 缺失) ────────────────
test('缺失 key: zh-CN 有 common.save,ko 缺失 → exit 1 (base-only)', () => {
  const root = createTempProject()
  try {
    const msgs = JSON.parse(JSON.stringify(PARITY_OK))
    delete msgs.ko.common.save
    writeWebMessages(root, msgs)
    const r = runScript(['--parity-only'], { cwd: root })
    assert.equal(r.status, 1)
    assert.match(r.stdout, /base-only|zh-CN 有但 ko 缺失/)
    assert.match(r.stdout, /common\.save/)
  } finally {
    rmScratch(root)
  }
})

// ─── 7. 多余 key 检测(ko 有,zh-CN 没有) ────────────────
test('多余 key: ko 有 common.extra,zh-CN 没有 → exit 1 (lang-only)', () => {
  const root = createTempProject()
  try {
    const msgs = JSON.parse(JSON.stringify(PARITY_OK))
    msgs.ko.common.extra = '추가'
    writeWebMessages(root, msgs)
    const r = runScript(['--parity-only'], { cwd: root })
    assert.equal(r.status, 1)
    assert.match(r.stdout, /lang-only|ko 有但 zh-CN 无/)
    assert.match(r.stdout, /common\.extra/)
  } finally {
    rmScratch(root)
  }
})

// ─── 8. 白名单机制(脚本无白名单,parity 严格检查) ───────
test('白名单: 脚本无白名单机制,所有 key 严格 parity 检查', () => {
  const root = createTempProject()
  try {
    // 即使是 "common.technical" 这种看起来像技术术语的 key,也必须 parity
    const msgs = JSON.parse(JSON.stringify(PARITY_OK))
    msgs['zh-CN'].common.technical = '技术'
    // ko 不加这个 key → 应该报 base-only(无白名单跳过)
    writeWebMessages(root, msgs)
    const r = runScript(['--parity-only'], { cwd: root })
    assert.equal(r.status, 1, `无白名单机制,任何 key 缺失都应 exit 1`)
    assert.match(r.stdout, /common\.technical/)
  } finally {
    rmScratch(root)
  }
})

// ─── 9. JSON 解析失败(zh-CN 基准损坏 → 无法判定,不是"跳过") ───────────
test('JSON 解析失败: zh-CN.json 损坏 → exit 2「无法判定」(旧政策 exit 0 跳过 = 假绿)', () => {
  const root = createTempProject()
  try {
    const dir = join(root, 'packages', 'i18n', 'messages', 'web')
    mkdirSync(dir, { recursive: true })
    // zh-CN.json 是损坏的 JSON(trailing comma)
    writeFileSync(join(dir, 'zh-CN.json'), '{ "common": { "save": "保存", } }')
    for (const lang of ['zh-TW', 'ko', 'ja', 'en']) {
      writeFileSync(join(dir, `${lang}.json`), JSON.stringify(PARITY_OK[lang]))
    }
    const r = runScript(['--parity-only'], { cwd: root })
    // —— 2026-09-26 收紧并完成:旧期望是 exit 0 + "messages 文件不存在或不完整,跳过",
    // 它把两种完全不同的事实并进同一种绿:
    //   ① 这个端在判定面上根本没有语言包(无事可查,skip 正当);
    //   ② **基准语言 zh-CN 读坏了**(parity 没有可比的那一侧 —— 判据失明)。
    // ② 恰恰是本文件对 ko.json 已经反转过的假绿形态(见 9b:非基准语言损坏从"跳过"改成
    // "判红并点名"),基准侧却还留着旧绿 —— 基准比所有语言都更要紧:它坏了等于整道门没跑。
    // 现按面纪律判 exit 2「无法判定」:既不冒红成"判据失败"(仓库没坏,是输入坏),
    // 也绝不记绿(把"没判"写成"判过了")。上一轮派单在停摆前把门改成了这个行为,
    // 期望值差最后一步没跟上 —— 本条就是那句"只剩一条我故意收紧的期望待更新"的落地。
    assert.equal(
      r.status,
      2,
      `zh-CN 基准损坏应 exit 2「无法判定」,实际 ${r.status}:${r.stdout}${r.stderr}`,
    )
    assert.match(r.stderr, /无法判定|拿不到基准语言/, 'exit 2 必须给可诊断原因,不静默')
  } finally {
    rmScratch(root)
  }
})

// ─── 9b. JSON 解析失败(非基准语言损坏 → 该语言被跳过) ──
test('JSON 解析失败: ko.json 损坏(非基准)⇒ 判红并点名(旧政策"跳过该语言"就是假绿)', () => {
  const root = createTempProject()
  try {
    const dir = join(root, 'packages', 'i18n', 'messages', 'web')
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'zh-CN.json'), JSON.stringify(PARITY_OK['zh-CN']))
    // ko 损坏
    writeFileSync(join(dir, 'ko.json'), '{ broken json }')
    for (const lang of ['zh-TW', 'ja', 'en']) {
      writeFileSync(join(dir, `${lang}.json`), JSON.stringify(PARITY_OK[lang]))
    }
    const r = runScript(['--parity-only'], { cwd: root })
    // 本门在 2026-09-24 把"读不出即跳过"改成"读不出即判红"(脚本第 213 行注释记着变异实测:
    // 一个拼错的 revspec 让五语言变四语言而全绿)。旧断言"exit 0 + 跳过 ko"编码的正是
    // 那个被堵掉的假绿 —— 少一门就少一门的漏检,绝不能算通过。
    assert.equal(r.status, 1, `ko 读不出必须判红,实际 ${r.status}\n${r.stdout}`)
    const out = `${r.stdout}\n${r.stderr}`
    assert.match(out, /读不出来/, '应说明是"读不出"而非普通 parity 差异')
    assert.match(out, /拒绝当作通过/, '结论行必须明写不记为通过')
    assert.match(out, /ko/, '必须点名是哪一门')
    // 变异对照:把 ko 修好即应绿 ⇒ 证明上面那枚红确实是"读不出"造成的,不是夹具恒红
    writeFileSync(join(dir, 'ko.json'), JSON.stringify(PARITY_OK['ko']))
    const ok = runScript(['--parity-only'], { cwd: root })
    assert.equal(ok.status, 0, `ko 修好后应通过(否则本用例是空判据):\n${ok.stdout}`)
  } finally {
    rmScratch(root)
  }
})

// ─── 10. JSON 重复 key(AGENTS.md §18 禁止;2026-09-20 起本脚本显式检测) ─────
test('JSON 重复 key: 同层两个同名 key → exit 1(前值被 JSON.parse 静默遮蔽)', () => {
  const root = createTempProject()
  try {
    const dir = join(root, 'packages', 'i18n', 'messages', 'web')
    mkdirSync(dir, { recursive: true })
    // 手写 JSON 字符串含重复 key(save 出现两次)
    // JSON.parse 解析后 save = "저장2"(最后一个),flatten 式 parity 看起来"一致",
    // 但 저장1 已经静默丢失 —— 这正是 §18 禁止重复 key 的原因,故必须显式拦。
    writeFileSync(
      join(dir, 'ko.json'),
      '{"common":{"save":"저장1","save":"저장2","cancel":"취소"},"nav":{"home":"홈"}}',
    )
    for (const lang of ['zh-CN', 'zh-TW', 'ja', 'en']) {
      writeFileSync(join(dir, `${lang}.json`), JSON.stringify(PARITY_OK[lang]))
    }
    const r = runScript(['--parity-only'], { cwd: root })
    assert.equal(r.status, 1, `同层重复 key 应 exit 1,实际 ${r.status}\nstdout: ${r.stdout}`)
    assert.match(r.stdout, /重复 key/, `应报告重复 key 问题,stdout: ${r.stdout}`)
    assert.match(r.stdout, /common\.save/, `应点名重复键路径,stdout: ${r.stdout}`)
  } finally {
    rmScratch(root)
  }
})

// ─── 11. 空 JSON 文件({}) ──────────────────────────────
test('空 JSON: {} → 无 leaf key,5 语言一致 → exit 0', () => {
  const root = createTempProject()
  try {
    writeWebMessages(root, {
      'zh-CN': {},
      'zh-TW': {},
      ko: {},
      ja: {},
      en: {},
    })
    const r = runScript(['--parity-only'], { cwd: root })
    assert.equal(r.status, 0, `空 JSON 5 语言一致应 exit 0,实际 ${r.status}`)
  } finally {
    rmScratch(root)
  }
})

// ─── 12. 完整 5 语言文件 fixture(嵌套结构) ──────────────
test('fixture: 完整 5 语言文件(zh-CN/zh-TW/ko/ja/en)嵌套 parity OK', () => {
  const root = createTempProject()
  try {
    // 嵌套结构,多命名空间
    const msgs = {
      'zh-CN': {
        common: { save: '保存', cancel: '取消', delete: '删除' },
        nav: { home: '首页', settings: '设置' },
        models: { user: { name: '用户名', email: '邮箱' } },
      },
      'zh-TW': {
        common: { save: '儲存', cancel: '取消', delete: '刪除' },
        nav: { home: '首頁', settings: '設定' },
        models: { user: { name: '使用者名稱', email: '電子郵件' } },
      },
      ko: {
        common: { save: '저장', cancel: '취소', delete: '삭제' },
        nav: { home: '홈', settings: '설정' },
        models: { user: { name: '사용자 이름', email: '이메일' } },
      },
      ja: {
        common: { save: '保存', cancel: 'キャンセル', delete: '削除' },
        nav: { home: 'ホーム', settings: '設定' },
        models: { user: { name: 'ユーザー名', email: 'メール' } },
      },
      en: {
        common: { save: 'Save', cancel: 'Cancel', delete: 'Delete' },
        nav: { home: 'Home', settings: 'Settings' },
        models: { user: { name: 'Username', email: 'Email' } },
      },
    }
    writeWebMessages(root, msgs)
    const r = runScript(['--parity-only'], { cwd: root })
    assert.equal(
      r.status,
      0,
      `完整 5 语言 fixture parity OK 应 exit 0,实际 ${r.status}\nstdout: ${r.stdout}`,
    )
    assert.match(r.stdout, /parity OK/)
    // 验证检查了 5 语言
    assert.match(r.stdout, /5 语言/)
  } finally {
    rmScratch(root)
  }
})

// ─── 13. --target=extension 切换到 extension messages ──
test('--target=extension: 切换到 extension messages 目录', () => {
  const root = createTempProject()
  try {
    // 创建 extension messages(不创建 web messages)
    writeExtensionMessages(root, PARITY_OK)
    // --target=extension → 读 extension 目录,不读 web
    const r = runScript(['--target=extension', '--parity-only'], { cwd: root })
    assert.equal(r.status, 0, `extension target parity OK 应 exit 0,实际 ${r.status}`)
    assert.match(r.stdout, /\[extension\]/)
  } finally {
    rmScratch(root)
  }
})

// ─── 14. --target=shared 切换到 shared messages ─────────
test('--target=shared: 切换到 shared messages 目录', () => {
  const root = createTempProject()
  try {
    writeSharedMessages(root, PARITY_OK)
    const r = runScript(['--target=shared', '--parity-only'], { cwd: root })
    assert.equal(r.status, 0, `shared target parity OK 应 exit 0,实际 ${r.status}`)
    assert.match(r.stdout, /\[shared\]/)
  } finally {
    rmScratch(root)
  }
})

// ─── 15. shared + web 合并(方案 A) ────────────────────
test('合并: shared 有 common.save,web 无 → 合并后 parity OK', () => {
  const root = createTempProject()
  try {
    // shared 有 common.save
    writeSharedMessages(root, {
      'zh-CN': { common: { save: '保存' } },
      'zh-TW': { common: { save: '儲存' } },
      ko: { common: { save: '저장' } },
      ja: { common: { save: '保存' } },
      en: { common: { save: 'Save' } },
    })
    // web 有 nav.home(shared 没有)
    writeWebMessages(root, {
      'zh-CN': { nav: { home: '首页' } },
      'zh-TW': { nav: { home: '首頁' } },
      ko: { nav: { home: '홈' } },
      ja: { nav: { home: 'ホーム' } },
      en: { nav: { home: 'Home' } },
    })
    // web 模式:shared + web 合并 → common.save + nav.home 都在合并集中
    // 5 语言合并集一致 → parity OK
    const r = runScript(['--parity-only'], { cwd: root })
    assert.equal(
      r.status,
      0,
      `shared+web 合并 parity OK 应 exit 0,实际 ${r.status}\nstdout: ${r.stdout}`,
    )
  } finally {
    rmScratch(root)
  }
})

// ─── 16. --staged + staged JSON 文件触发 parity ─────────
test('--staged: staged messages JSON → 触发 parity 检查', () => {
  const root = createTempProject()
  try {
    initGitRepo(root)
    writeWebMessages(root, PARITY_OK)
    // stage JSON 文件
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    execSync('git add packages/i18n/messages/web/', { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] })
    const r = runScript(['--staged'], { cwd: root })
    // staged JSON → messagesChanged = true → 跑 parity → exit 0
    assert.equal(
      r.status,
      0,
      `staged JSON + parity OK 应 exit 0,实际 ${r.status}\nstdout: ${r.stdout}`,
    )
  } finally {
    rmScratch(root)
  }
})

// ─── 17. 源码引用缺失键 → blocking(2026-08-20 收紧为硬性契约) ─
test('缺失键阻塞: 源码 useTranslations 引用未定义 key → exit 1', () => {
  const root = createTempProject()
  try {
    writeWebMessages(root, PARITY_OK)
    // 创建源码文件,引用 common.tools 命名空间下未定义的 key
    const srcDir = join(root, 'apps', 'web', 'src')
    mkdirSync(srcDir, { recursive: true })
    writeFileSync(
      join(srcDir, 'page.tsx'),
      "const t = useTranslations('common.tools')\nt('categoryEfficiency')\n",
    )
    // 全量模式: 扫描到缺失键 → 应 exit 1(此前只 warning exit 0)
    const r = runScript([], { cwd: root })
    assert.equal(r.status, 1, `源码引用缺失键应 exit 1,实际 ${r.status}\nstdout: ${r.stdout}`)
    assert.match(r.stdout, /categoryEfficiency/)
    assert.match(r.stdout, /拒绝提交|缺失键问题/)
  } finally {
    rmScratch(root)
  }
})

// ─── 18. 源码缺键补齐后 → 通过(防回归:补齐即恢复绿色) ────
test('缺失键通关: 补齐消息定义后同源码 → exit 0', () => {
  const root = createTempProject()
  try {
    const msgs = JSON.parse(JSON.stringify(PARITY_OK))
    for (const lang of Object.keys(msgs)) {
      msgs[lang].common.tools = { categoryEfficiency: '효율' }
    }
    writeWebMessages(root, msgs)
    const srcDir = join(root, 'apps', 'web', 'src')
    mkdirSync(srcDir, { recursive: true })
    writeFileSync(
      join(srcDir, 'page.tsx'),
      "const t = useTranslations('common.tools')\nt('categoryEfficiency')\n",
    )
    const r = runScript([], { cwd: root })
    assert.equal(r.status, 0, `补齐消息定义后应 exit 0,实际 ${r.status}\nstdout: ${r.stdout}`)
  } finally {
    rmScratch(root)
  }
})

// ─── 19. 含点键检测(next-intl 按 "." 解析路径,字面含点 key 永不渲染) ───
// 真实事故:web 语言包 84 个含点键,en/ko 各 22 个在 UI 上回显成原始键名(subAgentFeed.lane.*
// / agentHooks.event.* / integrations.event.*),而 flatten 式 parity 守门全绿看不出问题。
test('含点键: 顶层含点 key → exit 1 且提示改写为嵌套', () => {
  const root = createTempProject()
  try {
    const msgs = JSON.parse(JSON.stringify(PARITY_OK))
    for (const lang of Object.keys(msgs)) {
      msgs[lang].common['lane.architect'] = 'Architect'
    }
    writeWebMessages(root, msgs)
    const srcDir = join(root, 'apps', 'web', 'src')
    mkdirSync(srcDir, { recursive: true })
    writeFileSync(
      join(srcDir, 'page.tsx'),
      "const t = useTranslations('common')\nt('lane.architect')\n",
    )
    const r = runScript(['--target=web'], { cwd: root })
    assert.equal(r.status, 1, `含点键应 exit 1,实际 ${r.status}\nstdout: ${r.stdout}`)
    assert.match(r.stdout, /含点键/, `应报告含点键问题,stdout: ${r.stdout}`)
    assert.match(r.stdout, /lane\.architect/, `应点名具体键,stdout: ${r.stdout}`)
    assert.match(r.stdout, /改写为嵌套/, `应给出修复方法,stdout: ${r.stdout}`)
  } finally {
    rmScratch(root)
  }
})

test('含点键: 等价的嵌套结构 → exit 0(不误报)', () => {
  const root = createTempProject()
  try {
    const msgs = JSON.parse(JSON.stringify(PARITY_OK))
    for (const lang of Object.keys(msgs)) {
      msgs[lang].common.lane = { architect: 'Architect' }
    }
    writeWebMessages(root, msgs)
    const srcDir = join(root, 'apps', 'web', 'src')
    mkdirSync(srcDir, { recursive: true })
    writeFileSync(
      join(srcDir, 'page.tsx'),
      "const t = useTranslations('common')\nt('lane.architect')\n",
    )
    const r = runScript(['--target=web'], { cwd: root })
    assert.equal(r.status, 0, `嵌套写法不应误报,实际 ${r.status}\nstdout: ${r.stdout}`)
  } finally {
    rmScratch(root)
  }
})

// ─── 22. 同层重复 key(AGENTS.md §18:JSON.parse 静默保留最后一个,§18 此前无闸门)─────
// 真实触发场景:给含点键补嵌套时,同层若已有真身嵌套块就会造出重复 key,
// flatten 式 parity 检查按路径集合比对看不出"前面的值被后面覆盖"。
test('同层重复 key: 同一对象内两个同名 key → exit 1 并点名路径与行号', () => {
  const root = createTempProject()
  try {
    const dir = join(root, 'packages', 'i18n', 'messages', 'web')
    mkdirSync(dir, { recursive: true })
    // 手写原文(不能用 JSON.stringify 生成,它无法产出重复 key)
    const withDup = {
      'zh-CN': {
        common: { save: '保存', cancel: '取消' },
        nav: { home: '首页' },
      },
      'zh-TW': PARITY_OK['zh-TW'],
      ko: PARITY_OK.ko,
      ja: PARITY_OK.ja,
      en: PARITY_OK.en,
    }
    for (const [lang, content] of Object.entries(withDup)) {
      if (lang === 'zh-CN') {
        writeFileSync(
          join(dir, 'zh-CN.json'),
          '{\n  "common": {\n    "save": "保存",\n    "cancel": "取消"\n  },\n  "nav": {\n    "home": "首页",\n    "home": "首頁"\n  }\n}\n',
        )
      } else {
        writeFileSync(join(dir, `${lang}.json`), JSON.stringify(content, null, 2))
      }
    }
    const srcDir = join(root, 'apps', 'web', 'src')
    mkdirSync(srcDir, { recursive: true })
    writeFileSync(join(srcDir, 'page.tsx'), "const t = useTranslations('nav')\nt('home')\n")
    const r = runScript(['--target=web'], { cwd: root })
    assert.equal(r.status, 1, `同层重复 key 应 exit 1,实际 ${r.status}\nstdout: ${r.stdout}`)
    assert.match(r.stdout, /重复 key/, `应报告重复 key 问题,stdout: ${r.stdout}`)
    assert.match(r.stdout, /nav\.home/, `应点名重复键路径,stdout: ${r.stdout}`)
  } finally {
    rmScratch(root)
  }
})

test('同层重复 key: 不同层的同名 key 不算重复(不误报)', () => {
  const root = createTempProject()
  try {
    // PARITY_OK 里 zh-CN/zh-TW/ja 的 save/cancel 值相同但分层不同;这里显式构造跨层同名
    const msgs = {}
    for (const lang of Object.keys(PARITY_OK)) {
      msgs[lang] = {
        common: { save: PARITY_OK[lang].common.save, cancel: PARITY_OK[lang].common.cancel },
        nav: { home: PARITY_OK[lang].nav.home, common: { save: 'sub' } },
      }
    }
    writeWebMessages(root, msgs)
    const srcDir = join(root, 'apps', 'web', 'src')
    mkdirSync(srcDir, { recursive: true })
    writeFileSync(join(srcDir, 'page.tsx'), "const t = useTranslations('nav')\nt('home')\n")
    const r = runScript(['--target=web'], { cwd: root })
    assert.equal(r.status, 0, `跨层同名 key 不应误报,实际 ${r.status}\nstdout: ${r.stdout}`)
  } finally {
    rmScratch(root)
  }
})

test('动态键: 点分隔前缀在某语言不是对象 → exit 1(今晚 44 处回显键名的那一类)', () => {
  const root = createTempProject()
  try {
    const dir = join(root, 'packages', 'i18n', 'messages', 'web')
    mkdirSync(dir, { recursive: true })
    for (const lang of Object.keys(PARITY_OK)) {
      const msgs = JSON.parse(JSON.stringify(PARITY_OK[lang]))
      // 4 种语言给正确的嵌套 lane,en 故意只留扁平含点键(即缺陷原貌)
      if (lang === 'en') msgs.common['lane.architect'] = 'Architect'
      else msgs.common.lane = { architect: 'A' }
      writeFileSync(join(dir, `${lang}.json`), JSON.stringify(msgs, null, 2))
    }
    const srcDir = join(root, 'apps', 'web', 'src')
    mkdirSync(srcDir, { recursive: true })
    writeFileSync(
      join(srcDir, 'feed.tsx'),
      "const t = useTranslations('common')\n{t(`lane.${k}`)}\n",
    )
    const r = runScript(['--target=web'], { cwd: root })
    assert.equal(r.status, 1, `前缀不可达应 exit 1,实际 ${r.status}\nstdout: ${r.stdout}`)
    assert.match(r.stdout, /静态前缀/, `应报告静态前缀问题,stdout: ${r.stdout}`)
  } finally {
    rmScratch(root)
  }
})

test('动态键: 点分隔前缀在五语言都是对象 → exit 0(不误报)', () => {
  const root = createTempProject()
  try {
    const msgs = {}
    for (const lang of Object.keys(PARITY_OK)) {
      msgs[lang] = {
        ...PARITY_OK[lang],
        common: { ...PARITY_OK[lang].common, lane: { architect: 'A' } },
      }
    }
    writeWebMessages(root, msgs)
    const srcDir = join(root, 'apps', 'web', 'src')
    mkdirSync(srcDir, { recursive: true })
    writeFileSync(
      join(srcDir, 'feed.tsx'),
      "const t = useTranslations('common')\n{t(`lane.${k}`)}\n{t('lane.architect')}\n",
    )
    const r = runScript(['--target=web'], { cwd: root })
    assert.equal(r.status, 0, `前缀可达不应误报,实际 ${r.status}\nstdout: ${r.stdout}`)
  } finally {
    rmScratch(root)
  }
})

// 全仓实测:10 处"疑似违规"全部来自 JSDoc 注释里的历史说明
// ("i18n 静态映射表 — 用于消除 t(`status.${var}`) 动态拼接"),必须先去注释再判定,
// 否则这条 blocking 规则会全线误拦。
test('动态键: 仅出现在注释里的拼接示例不得报警(去注释回归)', () => {
  const root = createTempProject()
  try {
    writeWebMessages(root, PARITY_OK)
    const srcDir = join(root, 'apps', 'web', 'src')
    mkdirSync(srcDir, { recursive: true })
    writeFileSync(
      join(srcDir, 'page.tsx'),
      "/** i18n 静态映射表 — 用于消除 `t(`status.${var}`)` 动态拼接 */\nconst t = useTranslations('common')\nt('save')\n",
    )
    const r = runScript(['--target=web'], { cwd: root })
    assert.equal(r.status, 0, `注释里的示例不应触发,实际 ${r.status}\nstdout: ${r.stdout}`)
    assert.ok(!/静态前缀/.test(r.stdout), `不应报静态前缀,stdout: ${r.stdout}`)
  } finally {
    rmScratch(root)
  }
})

// ─── miniapp-taro 端 hook 形态识别(2026-09-21 补盲)─────────────────
// 背景:extractHookKeys 旧版只匹配"解构且 `{` 后紧跟 t|tt 且立刻 `}`",
// 于是 `const tt = useTt()`(实测 miniapp-taro 155 文件)和
// `const { t, tList } = useI18n()`(实测 14 处)整体不匹配 —— 这些文件的
// 引用键一个都没被查过。useTt 在"值===键"时回退内联简体中文,所以缺键在
// en/ko/ja/zh-TW 下恒显示简体,是真实用户可见缺陷(非洁癖问题)。
function writeTaroMessages(root, msgs) {
  const dir = join(root, 'packages', 'i18n', 'messages', 'miniapp-taro')
  mkdirSync(dir, { recursive: true })
  for (const [lang, content] of Object.entries(msgs)) {
    writeFileSync(join(dir, `${lang}.json`), JSON.stringify(content, null, 2))
  }
}

function writeTaroSource(root, name, body) {
  const dir = join(root, 'apps', 'miniapp-taro', 'src', 'pages', 'login')
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, name), body)
}

// 5 语言 key 集合一致、且只含 login.save / login.title 的基准词典
const TARO_OK = {
  'zh-CN': { login: { save: '保存', title: '登录' } },
  'zh-TW': { login: { save: '儲存', title: '登入' } },
  ko: { login: { save: '저장', title: '로그인' } },
  ja: { login: { save: 'ストック', title: 'ログイン' } },
  en: { login: { save: 'Save', title: 'Login' } },
}

test('useTt: const tt = useTt() 的缺键必须检出(旧版整文件漏检)', () => {
  const root = createTempProject()
  try {
    writeTaroMessages(root, TARO_OK)
    writeTaroSource(
      root,
      'login.tsx',
      "const { t } = useI18n()\nconst tt = useTt()\n{tt('login.email', '邮箱')}\n{tt('login.save', '保存')}\n",
    )
    const r = runScript(['--target=miniapp-taro'], { cwd: root })
    assert.equal(r.status, 1, `tt() 引用缺键应 exit 1,实际 ${r.status}\nstdout: ${r.stdout}`)
    assert.match(r.stdout, /login\.email/, `报告应点名 login.email,stdout: ${r.stdout}`)
    assert.ok(!/login\.save/.test(r.stdout), '已存在的 login.save 不该被列为缺失')
  } finally {
    rmScratch(root)
  }
})

test('useTt: 键齐全时 exit 0(补齐即转绿,不放宽规则)', () => {
  const root = createTempProject()
  try {
    writeTaroMessages(root, TARO_OK)
    writeTaroSource(
      root,
      'login.tsx',
      "const { t } = useI18n()\nconst tt = useTt()\n{tt('login.save', '保存')}\n{tt('login.title', '登录')}\n",
    )
    const r = runScript(['--target=miniapp-taro'], { cwd: root })
    assert.equal(r.status, 0, `键齐全应 exit 0,实际 ${r.status}\nstdout: ${r.stdout}`)
    assert.match(r.stdout, /miniapp-taro/, `应实际扫描 miniapp-taro,stdout: ${r.stdout}`)
  } finally {
    rmScratch(root)
  }
})

test('多键解构: const { t, tList } = useI18n() 的 t() 引用不得漏检', () => {
  const root = createTempProject()
  try {
    writeTaroMessages(root, TARO_OK)
    writeTaroSource(
      root,
      'login.tsx',
      "const { t, tList } = useI18n()\n{t('login.ghost')}\n{tList('login.save')}\n",
    )
    const r = runScript(['--target=miniapp-taro'], { cwd: root })
    assert.equal(r.status, 1, `多键解构的缺键应 exit 1,实际 ${r.status}\nstdout: ${r.stdout}`)
    assert.match(r.stdout, /login\.ghost/, `报告应点名 login.ghost,stdout: ${r.stdout}`)
  } finally {
    rmScratch(root)
  }
})

// 补齐即转绿:同一多键解构文件把 login.ghost 补进 5 语言词典 → exit 0。
// (与上一条配对,证明"检出"不是靠放宽规则凑出来的红。)
test('多键解构: 补齐缺失键后 exit 0', () => {
  const root = createTempProject()
  try {
    const msgs = JSON.parse(JSON.stringify(TARO_OK))
    for (const lang of Object.keys(msgs)) msgs[lang].login.ghost = '幽灵键'
    writeTaroMessages(root, msgs)
    writeTaroSource(
      root,
      'login.tsx',
      "const { t, tList } = useI18n()\n{t('login.ghost')}\n{tList('login.save')}\n",
    )
    const r = runScript(['--target=miniapp-taro'], { cwd: root })
    assert.equal(r.status, 0, `补齐后应 exit 0,实际 ${r.status}\nstdout: ${r.stdout}`)
  } finally {
    rmScratch(root)
  }
})

// tf 别名:miniapp-taro 端把 useTt() 的返回值命名为 tt 之外的名字(实测 tf / tx 变体)。
// 直接赋值形态必须按"任意变量名"识别,否则该文件整体漏检 —— 与 tt 同构的锁死用例。
test('tf 别名: const tf = useTt() 的缺键必须检出', () => {
  const root = createTempProject()
  try {
    writeTaroMessages(root, TARO_OK)
    writeTaroSource(
      root,
      'login.tsx',
      "const tf = useTt()\n{tf('login.email', '邮箱')}\n{tf('login.save', '保存')}\n",
    )
    const r = runScript(['--target=miniapp-taro'], { cwd: root })
    assert.equal(r.status, 1, `tf() 引用缺键应 exit 1,实际 ${r.status}\nstdout: ${r.stdout}`)
    assert.match(r.stdout, /login\.email/, `报告应点名 login.email,stdout: ${r.stdout}`)
    assert.ok(!/login\.save\b/.test(r.stdout), '已存在的 login.save 不该被列为缺失')
  } finally {
    rmScratch(root)
  }
})

test('tf 别名: 键齐全时 exit 0(补齐即转绿,不放宽规则)', () => {
  const root = createTempProject()
  try {
    writeTaroMessages(root, TARO_OK)
    writeTaroSource(
      root,
      'login.tsx',
      "const tf = useTt()\n{tf('login.save', '保存')}\n{tf('login.title', '登录')}\n",
    )
    const r = runScript(['--target=miniapp-taro'], { cwd: root })
    assert.equal(r.status, 0, `tf() 键齐全应 exit 0,实际 ${r.status}\nstdout: ${r.stdout}`)
  } finally {
    rmScratch(root)
  }
})

// 扩视野必须"只扩真翻译函数":useTts 是 text-to-speech,不是翻译 hook。
// 若被当成 t/tt 绑定,全仓 web 端相关写法会被误扫 → 该用例锁死不误报。
test('不误报: const tts = useTts() 不得被识别为翻译函数绑定', () => {
  const root = createTempProject()
  try {
    writeTaroMessages(root, TARO_OK)
    writeTaroSource(
      root,
      'login.tsx',
      "const tts = useTts()\n{tts('login.notAKey')}\n{tt('login.save')}\n",
    )
    const r = runScript(['--target=miniapp-taro'], { cwd: root })
    assert.equal(r.status, 0, `useTts 不应产生缺失键,实际 ${r.status}\nstdout: ${r.stdout}`)
    assert.ok(!/login\.notAKey/.test(r.stdout), `useTts 的参数不该被查,stdout: ${r.stdout}`)
  } finally {
    rmScratch(root)
  }
})

// 扩视野后 miniapp-taro 受检文件从 91 涨到 212,注释里的示例也会被扫到。
// 真实事故形态:并行会话在源码里写了
//   // 禁止 "…后重" + tt('p1','发') 这种把词劈成两半的拼接
// 该 `tt('p1', …)` 是文档注释,不是引用 → 必须先去注释再提键,否则 blocking 规则误拦。
test('不误报: tt() 仅出现在注释里的示例键不得被检出(去注释回归)', () => {
  const root = createTempProject()
  try {
    writeTaroMessages(root, TARO_OK)
    writeTaroSource(
      root,
      'login.tsx',
      "const tt = useTt()\n// 禁止劈词拼接 tt('login.ghost', '发')\n/* 块注释里也不查 tt('login.phantom') */\n{tt('login.save', '保存')}\n",
    )
    const r = runScript(['--target=miniapp-taro'], { cwd: root })
    assert.equal(r.status, 0, `注释里的键不该触发缺失,实际 ${r.status}\nstdout: ${r.stdout}`)
    assert.ok(!/login\.ghost/.test(r.stdout), `行注释示例不该被检出,stdout: ${r.stdout}`)
    assert.ok(!/login\.phantom/.test(r.stdout), `块注释示例不该被检出,stdout: ${r.stdout}`)
  } finally {
    rmScratch(root)
  }
})

test('含点键: 深层嵌套内部含点 key 也要检出(递归覆盖)', () => {
  const root = createTempProject()
  try {
    const msgs = JSON.parse(JSON.stringify(PARITY_OK))
    for (const lang of Object.keys(msgs)) {
      // 真实事故形态:ai.subAgentFeed 之下再挂含点键
      msgs[lang].common.deep = { event: { 'tool.before': 'Before tool call' }, list: ['a', 'b'] }
    }
    writeWebMessages(root, msgs)
    const srcDir = join(root, 'apps', 'web', 'src')
    mkdirSync(srcDir, { recursive: true })
    writeFileSync(
      join(srcDir, 'page.tsx'),
      "const t = useTranslations('common.deep')\nt('event.tool.before')\n",
    )
    const r = runScript(['--target=web'], { cwd: root })
    assert.equal(r.status, 1, `深层含点键应 exit 1,实际 ${r.status}\nstdout: ${r.stdout}`)
    assert.match(r.stdout, /common\.deep/, `报告应带父路径,stdout: ${r.stdout}`)
    assert.match(r.stdout, /tool\.before/, `应点名深层含点键,stdout: ${r.stdout}`)
  } finally {
    rmScratch(root)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// ─── F 组:判定面(2026-09-26 收口的兑现) ─────────────────────────────
// 上面 runScript 的默认 `--worktree` 注入只保夹具测"判据形态";**面本身**必须在一棵
// 真临时 git 仓上三面各出各的答案 —— 这正是本文件头部注释承诺却缺位的那组用例。
// 立因(真仓实测):语言包已按面读,而**源文件清单/正文一直是磁盘遍历**,于是
// "HEAD 的包 × 磁盘 WIP 组件"造出 HEAD 面上根本不存在的红(sideQueued/sideAnswerNow
// 型,归因层当日量到"复跑仍红但不点名本次文件")。F1/F6 的绿臂就是那台混合尺子的反证。
test('F1–F5 同一棵临时仓三面三答:磁盘脏不污染 HEAD 面;入索引才转红;两面旗同给判死', () => {
  const root = createTempProject()
  try {
    initGitRepo(root)
    writeWebMessages(root, PARITY_OK)
    const srcDir = join(root, 'apps', 'web', 'src')
    mkdirSync(srcDir, { recursive: true })
    writeFileSync(join(srcDir, 'index.ts'), 'export const x = 1\n')
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    execSync('git add -A && git commit -m base', { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] })
    // 三面对齐的基线:先证明默认面确实绿(否则后面的"绿"没有对照价值)
    const g = runFaceScript([], { cwd: root })
    assert.equal(g.status, 0, `基线(三面一致)默认面必须绿:${g.stdout}${g.stderr}`)

    // 只在磁盘上弄脏:en 包失去 common.cancel(并行会话未暂存 WIP 的形态)
    const enPath = join(root, 'packages', 'i18n', 'messages', 'web', 'en.json')
    const broken = JSON.parse(readFileSync(enPath, 'utf8'))
    delete broken.common.cancel
    writeFileSync(enPath, JSON.stringify(broken, null, 2))

    // F1 默认 = HEAD 面:磁盘脏不得进结论(迁移前的混合尺子在这里会判红 —— 假红即本型)
    const f1 = runFaceScript([], { cwd: root })
    assert.equal(f1.status, 0, `F1 磁盘污染不得影响 HEAD 面:\n${f1.stdout}${f1.stderr}`)
    assert.match(f1.stdout, /判定面:HEAD blob/u, 'F1 末行必须自称 HEAD blob')

    // F2 --worktree:磁盘面必须看见这份脏(它就是给人查磁盘的,但永不是提交门禁)
    const f2 = runFaceScript(['--worktree'], { cwd: root })
    assert.equal(f2.status, 1, `F2 磁盘面必须按脏副本判红:\n${f2.stdout}${f2.stderr}`)
    assert.match(f2.stdout, /判定面:工作树/u, 'F2 末行必须自称工作树档')

    // F3 --staged(索引仍是干净副本):必须绿。若 index 规格少了冒号(裸路径 ⇒ git 报
    // missing),这里会变成"一个可比语言包都没取到 ⇒ exit 2" —— 本枚改动第一版正是这样炸的。
    const f3 = runFaceScript(['--staged'], { cwd: root })
    assert.equal(f3.status, 0, `F3 索引面(脏未入索引)必须绿:\n${f3.stdout}${f3.stderr}`)

    // F4 两面旗同给:判死,不猜哪一面
    const f4 = runFaceScript(['--staged', '--worktree'], { cwd: root })
    assert.equal(f4.status, 2, 'F4 两面旗同给必须 exit 2')
    assert.match(String(f4.stderr), /不得同用|互斥/u, 'F4 判死必须带原因')

    // F5 把脏放进索引:--staged 必须随之转红 —— 证明 F3 的绿不是"staged 永远绿",
    // 索引面确实在读索引(与守门 90 镜像 ⑩ 同一条"条件式,不赌仓库此刻内容"的规矩)。
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    execSync('git add -A', { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] })
    const f5 = runFaceScript(['--staged'], { cwd: root })
    assert.equal(f5.status, 1, `F5 索引含脏副本时 --staged 必须判红:\n${f5.stdout}${f5.stderr}`)
    assert.match(f5.stdout, /判定面:索引 blob/u, 'F5 末行必须自称索引 blob')
  } finally {
    rmScratch(root)
  }
})

test('F6 源文件面:只在磁盘上的 WIP 组件不得把 HEAD 面顶红(混合尺子的根治证明)', () => {
  const root = createTempProject()
  try {
    initGitRepo(root)
    writeWebMessages(root, PARITY_OK)
    const srcDir = join(root, 'apps', 'web', 'src')
    mkdirSync(srcDir, { recursive: true })
    writeFileSync(join(srcDir, 'index.ts'), 'export const x = 1\n')
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    execSync('git add -A && git commit -m base', { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] })
    // 磁盘上再放一个**未提交**组件,引用五语言包都没有的键 —— 这就是 sideQueued 现场:
    // 磁盘枚举(旧)会把它算进"本提交引用未登记键",而它结构上进不了任何一面提交。
    writeFileSync(
      join(srcDir, 'wip-only-disk.tsx'),
      "const t = useTranslations('common')\nt('keyOnlyOnDiskWipComponent')\n",
    )
    const head = runFaceScript([], { cwd: root })
    assert.equal(head.status, 0, `F6 HEAD 面不得被磁盘 WIP 组件顶红:\n${head.stdout}${head.stderr}`)
    assert.doesNotMatch(
      head.stdout,
      /keyOnlyOnDiskWipComponent/,
      'F6 红因文本竟出现磁盘专属键 ⇒ 源清单没按面枚举',
    )
    const wt = runFaceScript(['--worktree'], { cwd: root })
    assert.equal(
      wt.status,
      1,
      `F6 对照:同一份脏在 --worktree 面必须可见(否则 F6 只是恒绿)\n${wt.stdout}${wt.stderr}`,
    )
    assert.match(wt.stdout, /keyOnlyOnDiskWipComponent/, 'worktree 面必须点名 WIP 组件的缺失键')
  } finally {
    rmScratch(root)
  }
})

test('F7 形状锁:清单/正文/源文件必须全部经 face-reader 按面取,不得再回磁盘混合', () => {
  // 与守门 118 的 half-wired 档同族:按文件整体分类的"面纪律门"看不见同文件里另一处错面
  // (它把"import 了层"当合规),所以这里锁**代码形态**。剥掉整行注释后才判 ——
  // 注释在描述被推翻的旧写法,不剥就是替旧写法背书(守门 57⑤"注释式摘线"同族)。
  const src = readFileSync(SCRIPT_PATH, 'utf8')
  const code = src
    .split('\n')
    .filter((l) => !/^\s*(\/\/|\/?\*)/.test(l))
    .join('\n')
  assert.match(
    code,
    /import\s*\{[^}]*\bcatBatch\b[^}]*\}\s*from\s*['"]\.\/lib\/face-reader\.mjs['"]/u,
    'catBatch 未从层里来(半接线)',
  )
  assert.match(code, /gitRaw\(\['ls-files', '--', `\$\{relDir\}\/`\]/u, '索引面清单未走 ls-files')
  assert.match(code, /ls-tree', '-r', '--name-only', 'HEAD'/u, 'HEAD 面源清单未走 ls-tree -r')
  assert.match(
    code,
    /listSourceFilesOnFace\(APP_SRC_DIR\)|listSourceFilesOnFace\(WEB_DIR\)/u,
    '源文件枚举未经按面出口(还在磁盘遍历)',
  )
  assert.match(
    code,
    /function faceSpecOf|const faceSpecOf = /u,
    'faceSpecOf 不在位(规格组装又散落两处)',
  )
  // 反向锁:冒号必须在三元外 —— `? '' : 'HEAD:'}` 这一支在守门 90 与本门各炸过一次,
  // 只靠"跑一遍"防不住回归,必须锁字面量。
  assert.ok(
    !/\? '' : 'HEAD:'\}/u.test(code),
    '规格冒号又并进了三元 ⇒ index 面退化成裸路径,暂存区永远"读不到"',
  )
  // 反向锁:旧的磁盘混合形态不得回来。
  assert.ok(
    !/src = readFileSync\(file/u.test(code),
    '源文件正文又改回磁盘 readFileSync(混合面假红的成因)',
  )
  assert.ok(!/text = readFileSync\(file/u.test(code), '重复键判据的原文又改回磁盘 readFileSync')
  assert.ok(
    !/readdirSync\(MESSAGES_DIR\)\.filter/u.test(code),
    '重复键判据的语言包清单又回到磁盘 readdirSync',
  )
})

// ─── KR:语言包相对其父提交丢键(2026-09-27 立) ──────────────────
// 本门其余判据全是**横向**比(语言之间)或查引用(键有没有人用),所以"五语言一致缩水"
// 结构上看不见 —— 而语言包少键的端上表现是**直接回显键名**。这四条锁的是纵向那一维。
function writeCliMessages(root, msgs) {
  const dir = join(root, 'packages', 'i18n', 'messages', 'cli')
  mkdirSync(dir, { recursive: true })
  for (const [lang, content] of Object.entries(msgs)) {
    writeFileSync(join(dir, `${lang}.json`), JSON.stringify(content, null, 2) + '\n')
  }
}
function gitAt(root, cmd) {
  return execSync(`git ${cmd}`, { cwd: root, stdio: 'pipe' })
}
function dropLeaf(obj, path) {
  const segs = path.split('.')
  const last = segs.pop()
  let cur = obj
  for (const s of segs) cur = cur?.[s]
  if (cur) delete cur[last]
  return obj
}

test('KR-1 五语言一致丢同一键 ⇒ parity 全绿而 KR 判红并点名(本判据存在的全部理由)', () => {
  const root = createTempProject()
  try {
    initGitRepo(root)
    writeCliMessages(root, PARITY_OK)
    gitAt(root, 'add -A')
    gitAt(root, '-c user.email=t@t.com -c user.name=t commit -m base --no-verify')
    const lossy = structuredClone(PARITY_OK)
    for (const lang of Object.keys(lossy)) dropLeaf(lossy[lang], 'nav.home')
    writeCliMessages(root, lossy)
    gitAt(root, 'add -A')
    const r = runFaceScript(['--staged', '--target=cli'], { cwd: root })
    assert.equal(r.status, 1, `一致丢键必须判红,实得 ${r.status}:\n${r.stdout}${r.stderr}`)
    assert.match(r.stdout, /相对 HEAD 少了 1 个键/)
    assert.match(r.stdout, /nav\.home/)
    // 关键对照:同一份输入 parity **不红** —— 若哪天 parity 也红了,说明 KR 这条纵向判据可以被删掉
    assert.doesNotMatch(r.stdout, /parity 问题/, 'parity 不应判红(它比的是语言之间)')
  } finally {
    rmScratch(root)
  }
})

test('KR-2 台账逐条声明(reason + 未过期 until)⇒ 同一批键不再计债', () => {
  const root = createTempProject()
  try {
    initGitRepo(root)
    writeCliMessages(root, PARITY_OK)
    gitAt(root, 'add -A')
    gitAt(root, '-c user.email=t@t.com -c user.name=t commit -m base --no-verify')
    const lossy = structuredClone(PARITY_OK)
    for (const lang of Object.keys(lossy)) dropLeaf(lossy[lang], 'nav.home')
    writeCliMessages(root, lossy)
    const ledgerDir = join(root, 'scripts', 'data')
    mkdirSync(ledgerDir, { recursive: true })
    writeFileSync(
      join(ledgerDir, 'i18n-key-removals.json'),
      JSON.stringify(
        {
          removals: Object.keys(lossy).map((lang) => ({
            // 声明是**逐文件**的:一次清理动五门语言就要写五条 —— 刻意不做目录级通配,
            // 那等于让一条理由给五个文件背书,而五个文件的丢键集合本来可以各不相同。
            file: `packages/i18n/messages/cli/${lang}.json`,
            keys: ['nav.home'],
            reason: '该端导航改为图标,不再显示文案(死键清理)',
            until: '2099-01-01',
          })),
        },
        null,
        2,
      ),
    )
    gitAt(root, 'add -A')
    const r = runFaceScript(['--staged', '--target=cli'], { cwd: root })
    assert.equal(r.status, 0, `已声明的删除应放过,实得 ${r.status}:\n${r.stdout}${r.stderr}`)
    assert.match(r.stdout, /已声明放过 5 键/, '五门语言各声明一次 ⇒ 计数按文件累加,不是一键一条')
  } finally {
    rmScratch(root)
  }
})

test('KR-3 声明已过期 / reason 过短 ⇒ 不得继续放行(豁免不得只出生不死亡)', () => {
  const root = createTempProject()
  try {
    initGitRepo(root)
    writeCliMessages(root, PARITY_OK)
    gitAt(root, 'add -A')
    gitAt(root, '-c user.email=t@t.com -c user.name=t commit -m base --no-verify')
    const lossy = structuredClone(PARITY_OK)
    for (const lang of Object.keys(lossy)) dropLeaf(lossy[lang], 'nav.home')
    writeCliMessages(root, lossy)
    const ledgerDir = join(root, 'scripts', 'data')
    mkdirSync(ledgerDir, { recursive: true })
    writeFileSync(
      join(ledgerDir, 'i18n-key-removals.json'),
      JSON.stringify(
        {
          removals: [
            {
              file: 'packages/i18n/messages/cli/zh-CN.json',
              keys: ['nav.home'],
              reason: '去年的清理,到期未复核',
              until: '2020-01-01',
            },
          ],
        },
        null,
        2,
      ),
    )
    gitAt(root, 'add -A')
    const r = runFaceScript(['--staged', '--target=cli'], { cwd: root })
    assert.equal(r.status, 1, `过期声明必须仍判红,实得 ${r.status}:\n${r.stdout}`)
    assert.match(r.stdout, /台账声明本身不可用/)
    assert.match(r.stdout, /已过期\(2020-01-01\)/)
  } finally {
    rmScratch(root)
  }
})

test('KR-4 形状锁:判据必须挂在主流程上且只在被审面有父可比时判', () => {
  const code = readFileSync(SCRIPT_PATH, 'utf8')
  assert.match(code, /const KR_LEDGER_REL = 'scripts\/data\/i18n-key-removals\.json'/)
  assert.match(code, /if \(FACE === 'index'\)/, 'KR 必须只在索引档判(全量档的"父"只能是 HEAD^)')
  assert.match(code, /已核\(索引 vs 父提交\)/, '绿路径必须打印 KR 确实跑过,否则"没判"与"判过"同形')
  assert.match(code, /KR\(语言包相对父提交丢键\)\*\*无法判定\*\*/, '取不到面时必须喊无法判定,不得静默')
  assert.match(code, /process\.exit\(2\)\n\}\nif \(removalIssues\.length\)/, '未判定必须 exit 2 且早于判红')
})

/**
 * KR-5 跨层形状锁:本门每一条判红结论行,都必须被**提交归因层**认作"结论行"。
 *
 * 为什么这道锁不住在门内、而要跨到 scripts/lib/commit-gate-attribution.mjs:
 * safe-commit 判"这枚红是不是本次提交自己的"靠的是 findingLines() 的 FINDING_LINE_RE
 * (error|违规|❌|判定|…)。本门原先五条判红写的是「发现 N 处…」,一条都不沾那个字集 ——
 * 于是**本门自己的红被洗成 not-ours、照样跳门**(2026-09-27 实测:删 i18n 键触发 KR 判红,
 * 归因层打印"未点名本次任何文件",而那条红 100% 是本次内容)。
 * 门把结论说得越具体、铰链反而越松,是同一条禁令的反方向(§12 findingLines 续行教训)。
 * 判据一字未动,动的只是"把结论喊成结论"。
 */
test('KR-5 跨层形状锁:每条判红结论行必须被归因层认作结论(否则本门的红会被洗成别人的)', async () => {
  const { pathToFileURL } = await import('node:url')
  const { findingLines } = await import(
    pathToFileURL(join(__dirname, '..', 'lib', 'commit-gate-attribution.mjs')).href
  )
  const code = readFileSync(SCRIPT_PATH, 'utf8')
  const reds = code.split(/\r?\n/).filter((l) => l.includes('${C.red}[i18n 键检查]'))
  // 空集不得让本锁"通过"——那是判据漂了的第一种表现(守门 70/76/81 同族)
  assert.ok(reds.length >= 5, `红色结论行只找到 ${reds.length} 条 = 输出形态漂了,本锁失去对象`)
  const blind = reds.filter((l) => findingLines(l).length === 0)
  assert.deepEqual(
    blind.map((l) => l.trim().slice(0, 90)),
    [],
    '这些判红结论行归因层看不见 ⇒ 本门自己的红会被判成 not-ours 并放行跳门',
  )
})

// ─── G-304: --target 未匹配时**绝不回落 web**(2026-09-28 立) ─────────
/**
 * 病灶(实测,不是假想):改前 `--target=api` 与 `--target=nosuch-xyz` 打印的是
 * **web 那一族**的读数 —— 末行逐字等于 `--target=web` 的输出,于是 packages/i18n/messages/api/**
 * 在门 [2] 上根本没有 parity 覆盖,而账面读起来像"这个端扫过了"。
 * 「看起来扫过了」是本仓记过最多次的失效形态(守门 70/76/81/118 同族):判据没跑的伪装成跑过,
 * 比少一道闸更糟,因为它替人做出了"这一格已收口"的判断。
 * 同族的 i18n-diff.mjs / i18n-apply.mjs 在 2026-09-25 已按同一口径修过(未知 target 直接 exit 2),
 * 本组用例锁的就是"本门不许再退回去"。
 */

// 真仓根:从测试文件位置向上找含 web 语言包的目录(不依赖 `node --test` 从哪儿跑)
const REAL_REPO = (() => {
  let dir = __dirname
  for (let i = 0; i < 10; i++) {
    try {
      readFileSync(join(dir, 'packages', 'i18n', 'messages', 'web', 'zh-CN.json'), 'utf8')
      return dir
    } catch {
      const parent = join(dir, '..')
      if (parent === dir) break
      dir = parent
    }
  }
  return null
})()

// 独立 oracle:自己数 HEAD 面上某族 zh-CN 的叶子键数,不读脚本的结论
// (否则断言只是在复读实现 —— §22c"镜像测试只复读实现就是复读机")
function leafCountOfHeadPack(repoRoot, relPack) {
  const raw = execSync(`git show HEAD:${relPack}`, {
    cwd: repoRoot,
    encoding: 'utf8',
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  const walk = (o) => {
    let n = 0
    for (const v of Object.values(o)) {
      n += v && typeof v === 'object' && !Array.isArray(v) ? walk(v) : 1
    }
    return n
  }
  return walk(JSON.parse(raw))
}

test('G304-1 --target=api 必须扫 api 那一族并报出**它自己**的读数(正向:不再复读 web)', () => {
  assert.ok(REAL_REPO, '找不到真仓 packages/i18n —— 本条是阳性对照,缺对象就是判据失明')
  const r = runFaceScript(['--target=api'], { cwd: REAL_REPO })
  assert.equal(r.status, 0, `api parity 应 exit 0,实际 ${r.status}\n${r.stdout}${r.stderr}`)
  // 末行必须带 [api] 前缀 + parity 档计数(表里的 label 列)
  assert.match(r.stdout, /\[api\] 通过/, `末行未点名 api: ${r.stdout}`)
  const m = r.stdout.match(/parity 比对 5 语言 × (\d+) 键路径/)
  assert.ok(m, `未报出 api 自己的键路径数: ${r.stdout}`)
  // 独立 oracle(自己数 HEAD 面上的 api/zh-CN)必须与门报出的数一致
  const apiLeaves = leafCountOfHeadPack(REAL_REPO, 'packages/i18n/messages/api/zh-CN.json')
  assert.equal(
    Number(m[1]),
    apiLeaves,
    `门报 ${m[1]} 键路径 vs 独立数出的 api 叶子 ${apiLeaves} —— 对不上就是还在读别的端`,
  )
  // 反向对照:web 那一族的读数**绝不得**出现在 api 档里(改前这一条正是失败点)
  const web = runFaceScript(['--target=web'], { cwd: REAL_REPO })
  assert.equal(web.status, 0, `web 档应 exit 0: ${web.stdout}${web.stderr}`)
  const wm = web.stdout.match(/已检查 \d+ 文件, (\d+) 键/)
  assert.ok(wm, `web 档末行形态漂了,本对照失去对象: ${web.stdout}`)
  assert.notEqual(
    Number(m[1]),
    Number(wm[1]),
    `api 报的键数(${m[1]})与 web 的(${wm[1]})相同 —— 两族同值的可能极低,更可能是回落`,
  )
  assert.ok(
    !web.stdout.includes('[api]'),
    'web 档不得带 [api] 前缀(两档输出必须可区分,否则"扫过哪一族"无从判断)',
  )
})

test('G304-2 未登记 / 拼错的 target 一律 exit 2 并点名可用清单(不得按 web 报绿)', () => {
  const cases = [
    ['nosuch-xyz', '不存在的端名'],
    ['Mobile-RN', '大小写陷阱'],
    ['mobile_rn', '下划线陷阱'],
    ['', '--target= 空值'],
  ]
  for (const [t, why] of cases) {
    const r = runFaceScript([`--target=${t}`], { cwd: REAL_REPO || process.cwd() })
    assert.equal(
      r.status,
      2,
      `--target=${JSON.stringify(t)}(${why})应 exit 2「无法判定」,实际 ${r.status}\n${r.stdout}`,
    )
    assert.match(
      r.stderr,
      /不是受支持的端/,
      `exit 2 必须点名原因(${why}),不得只留一个码: ${r.stderr}`,
    )
    // 判死必须列出可选端 —— 否则下一个人只能猜哪个拼法对
    for (const name of ['web', 'extension', 'shared', 'cli', 'mobile-rn', 'miniapp-taro', 'api']) {
      assert.match(r.stderr, new RegExp(`\\b${name}\\b`), `清单里缺 ${name}: ${r.stderr}`)
    }
    assert.ok(!/通过/.test(r.stdout), `判死时 stdout 不得出现任何"通过"字样: ${r.stdout}`)
  }
})

test('G304-3 形状锁:目录只能从 TARGET_CONFIG 来,回落 web 那一支不得回来', () => {
  const src = readFileSync(SCRIPT_PATH, 'utf8')
  const code = src
    .split('\n')
    .filter((l) => !/^\s*(\/\/|\/?\*)/.test(l))
    .join('\n')
  // 正向:三件装车事实
  assert.match(code, /const TARGET_CONFIG = \{/u, 'target 表不见了(端名单又散回 if 链的成因)')
  assert.match(code, /const MESSAGES_DIR = join\(REPO_ROOT, CFG\.dir\)/u, 'MESSAGES_DIR 不再由表给')
  assert.match(code, /function resolveTarget\(/u, 'resolveTarget 不在位')
  assert.match(code, /const CFG = resolveTarget\(TARGET, fatalTargetLines\)/u, '解析出口没被调用')
  // 判死必须早于任何取材 —— 与 i18n-diff 同一位置约束("未读任何语言包"这句才成立)
  assert.ok(
    code.indexOf('const CFG = resolveTarget(') < code.indexOf('const MESSAGES_DIR'),
    'resolveTarget 晚于 MESSAGES_DIR ⇒ 判死前已经读过语言包,拒绝执行的承诺落空',
  )
  // 反向锁:旧写法是"一条末支落回 web 的嵌套三元"。这个字面量在表里以 dir: '...' 出现,
  // 只在 join(REPO_ROOT, …) 的位置上才是被禁止的回落形态 —— 所以两边都能精确判定。
  assert.ok(
    !/:\s*join\(REPO_ROOT,\s*'packages\/i18n\/messages\/web'\s*\)/u.test(code),
    '"target 未匹配 ⇒ 落回 web"那一支又回来了(G-304 的本体)',
  )
  // 反向锁:parity-only / 合并 shared 不得再用手写端名单(加一端忘改一条 if 就是本票成因)
  assert.ok(!/isShared \|\| isCli/u.test(code), 'mergeShared 判断又退回手写端名单')
  assert.ok(
    !/isExtension \|\| isShared \|\| isCli/u.test(code),
    'parityOnly 判断又退回手写端名单',
  )
  // 空枚举不得被算成通过:显式点了名而该族一个包都没有 ⇒ 必须是 exit 2 那一支
  assert.match(
    code,
    /if \(TARGET_IS_EXPLICIT\)/u,
    'TARGET_IS_EXPLICIT 判死分支不见了(点了名还"无事可查"就是静默放行)',
  )
})

test('G304-4 显式点了名而该族枚举到 0 个包 ⇒ 判死;没点名而目录缺失 ⇒ 如实跳过', () => {
  // 成对用例:两臂的**唯一差别**是有没有点名,结论必须相反。
  // 只留"判死"那一臂,就允许有人把默认档也一并判红(空仓/部分 checkout 会被顶红);
  // 只留"跳过"那一臂,就是本次要修的洞。
  const root = createTempProject()
  try {
    writeWebMessages(root, PARITY_OK) // 只给 web 一族,api 族在磁盘上不存在
    const named = runScript(['--target=api', '--worktree'], { cwd: root })
    assert.equal(
      named.status,
      2,
      `点名 api 而它一个包都没有 ⇒ 应 exit 2,实际 ${named.status}\n${named.stdout}${named.stderr}`,
    )
    assert.match(named.stderr, /一个语言包都没枚举到/, `判死原因没点名: ${named.stderr}`)
    assert.match(named.stderr, /packages\/i18n\/messages\/api/, `必须点名是哪一族: ${named.stderr}`)
    assert.ok(!/通过/.test(named.stdout), `判死臂不得出现"通过": ${named.stdout}`)

    const unnamed = runScript(['--worktree'], { cwd: root })
    assert.equal(
      unnamed.status,
      0,
      `未点名走默认 web(该族在位)应照常判 parity 通过,实际 ${unnamed.status}\n${unnamed.stdout}`,
    )

    const empty = createTempProject()
    try {
      // 未点名 + 连 web 都没有:空仓 / 部分 checkout 的合法形态,必须是"跳过"而不是判死
      const skip = runScript(['--worktree'], { cwd: empty })
      assert.equal(skip.status, 0, `空仓未点名应 exit 0 跳过,实际 ${skip.status}`)
      assert.match(skip.stdout, /语言包,跳过/, `跳过要喊出原因: ${skip.stdout}`)
      assert.ok(!/通过/.test(skip.stdout), '跳过不得伪装成"通过"')
    } finally {
      rmScratch(empty)
    }
  } finally {
    rmScratch(root)
  }
})

// ─── G304-5 / G304-6 / G304-7:合并进来的另一路实现(G-304 的另一份写法)────────
// 裁决记录:另一路对同一张票给了**另一套实现**(白名单从 messages/ 目录现读 + argv 校验),
// 它的三条行为断言与本路可共存,原样保留(仅把报错文案适配到留下那一侧的措辞 —— 文案是契约的
// 一部分,而留下的是本路的 `不是受支持的端` / `可用目标(…)`)。
// 它那三条**形状锁**(readdirSync(MESSAGES_ROOT / knownTargets.includes(TARGET) /
// if (!knownTargets) exit 2)锁的是**被否决的那一侧的写法**:把 argv 校验挂回磁盘目录清单,
// 正是"两处算同一件事必漂移"的成因,故不照抄 —— 改锁合并后的**实际形态**(见 G304-7),
// 并把它真正要防的那件事(清单腐烂)以判据形式留下(见 DRIFT-1 / DRIFT-2)。
test('G304-5(另一路用例并入)未知 target 判死那一趟不得同时打出任何通过读数', () => {
  const r = runFaceScript(['--target=__no_such_end__'], { cwd: REAL_REPO || process.cwd() })
  assert.equal(
    r.status,
    2,
    `未知 target 必须判死,实得 status=${r.status} stderr=${String(r.stderr || '').slice(0, 160)}`,
  )
  assert.match(
    r.stderr || '',
    /--target="__no_such_end__"/,
    `结论行必须点名那个 target,否则等于没给出路: ${String(r.stderr).slice(0, 200)}`,
  )
  assert.match(
    r.stderr || '',
    /可用目标/,
    `必须列出可用端清单(措辞随实现,但必须存在): ${String(r.stderr).slice(0, 200)}`,
  )
  assert.doesNotMatch(
    `${r.stdout || ''}${r.stderr || ''}`,
    /parity OK|通过,parity 比对/,
    '判死那一趟同时打出「通过」= 两态同屏的自相矛盾合格证',
  )
})

test('G304-6(另一路阳性对照并入)同档形对比:api 与 web 的 parity 键路径数不得相同', () => {
  // 与 G304-1 的差别不是重复:那条拿"api 的 parity 数 vs web 的源码检查数"比不同量纲,
  // 这条把两端逼到**同一模式(--parity-only)**再比同一字段 —— 回落回来时两数必逐字相同。
  const api = runFaceScript(['--target=api', '--parity-only'], { cwd: REAL_REPO || process.cwd() })
  const web = runFaceScript(['--target=web', '--parity-only'], { cwd: REAL_REPO || process.cwd() })
  assert.equal(api.status, 0, `api 档应通过,stderr=${String(api.stderr || '').slice(0, 200)}`)
  assert.equal(web.status, 0, `web 档应通过,stderr=${String(web.stderr || '').slice(0, 200)}`)
  const numOf = (out) => (String(out).match(/parity 比对 5 语言 × (\d+) 键路径/) || [])[1]
  const a = numOf(api.stdout)
  const w = numOf(web.stdout)
  assert.ok(
    a && w,
    `两档都必须量到自己的键路径数,实得 api=${a} web=${w}(量不到=判据看不见那一族)`,
  )
  assert.notEqual(a, w, `api 与 web 报了同一个数(${a})⇒ 静默回落回来了,本票的立项事故形态`)
})

test('G304-7(合并形状锁)目录只能从表来,而表必须与磁盘端目录对账 —— 两条出口都在位', () => {
  const src = readFileSync(SCRIPT_PATH, 'utf8')
  const code = src
    .split('\n')
    .filter((l) => !/^\s*(\/\/|\/?\*)/.test(l))
    .join('\n')
  // 本路:表是唯一出口
  assert.match(code, /const VALID_TARGETS = Object\.keys\(TARGET_CONFIG\)/u, '清单不再由表导出')
  assert.match(code, /!VALID_TARGETS\.includes\(d\)/u, '磁盘端目录未反查表 ⇒ 腐烂无人对账')
  // 另一路的反腐烂意图(以判据形式留下):磁盘清单必须被真的读一次并在装载期对账
  assert.match(code, /function readEndpointDirs\(/u, '端目录读取出口不见了(对账失去对象)')
  assert.match(
    code,
    /reportEndpointDrift\(readEndpointDirs\(MESSAGES_ROOT\),\s*\{[\s\S]{0,240}?strict:\s*isStrictFlag[\s\S]{0,240}?explicitTarget:\s*TARGET_IS_EXPLICIT[\s\S]{0,240}?\}\s*\)/u,
    '对账没挂在装载路径上,或 --strict / 显式 --target 没接进去(问责档与 G-304 那一半形同虚设)',
  )
  // 反向锁:另一路那套"argv 校验挂回磁盘清单"的写法不得进来(两处算同一件事必漂移)
  assert.ok(!/knownTargets/u.test(code), 'argv 校验又挂回磁盘端目录清单 ⇒ 与 TARGET_CONFIG 两处并存')
  assert.ok(
    !/readdirSync\(MESSAGES_ROOT\)[\s\S]{0,80}\.includes\(TARGET\)/u.test(code),
    '未知 target 又改回"现读目录白名单" ⇒ 表与目录谁说了算再次分叉',
  )
})

// ─── DRIFT:表 ↔ 磁盘端目录对账的行为面(另一路"手工清单必然腐烂"的意图落地)───
test('DRIFT-1 未进表的端目录:默认档大声点名 + 计数,但不改判定结论(可能是别人的在飞新端)', () => {
  const root = createTempProject()
  try {
    writeWebMessages(root, PARITY_OK)
    mkdirSync(join(root, 'packages', 'i18n', 'messages', 'brand-new-end'), { recursive: true })
    // --parity-only:让本次判定本身是一行可读的绿(默认全量档在"无源码"夹具里走的是跳过档,
    // 那样这条用例就只是在测跳过 —— 漂移点名必须与一次**真实判定**同屏才说明它没顶掉判定)
    const r = runScript(['--worktree', '--parity-only'], { cwd: root })
    const out = `${r.stdout}\n${r.stderr}`
    assert.match(out, /brand-new-end 未登记进 TARGET_CONFIG/, `必须点名那个目录:\n${out}`)
    assert.match(out, /零覆盖/, `必须说清后果(那一族本门零覆盖):\n${out}`)
    assert.match(out, /端目录未进表:brand-new-end/, '汇总行必须带计数,否则多条漂移看不全')
    assert.equal(r.status, 0, `默认档不得因别人的在飞新端判红,实际 ${r.status}\n${out}`)
    assert.match(r.stdout, /通过,parity 比对/, `点名漂移不得挤掉本次判定:\n${r.stdout}`)
  } finally {
    rmScratch(root)
  }
})

test('DRIFT-2 --strict 才把漂移判死(问责档),且判死那一趟不得打出通过读数', () => {
  const root = createTempProject()
  try {
    writeWebMessages(root, PARITY_OK)
    mkdirSync(join(root, 'packages', 'i18n', 'messages', 'brand-new-end'), { recursive: true })
    const r = runScript(['--worktree', '--parity-only', '--strict'], { cwd: root })
    assert.equal(
      r.status,
      2,
      `--strict 下漂移必须 exit 2,实际 ${r.status}\n${r.stdout}${r.stderr}`,
    )
    assert.match(r.stderr, /brand-new-end/, '判死必须点名是哪个端目录')
    assert.doesNotMatch(
      `${r.stdout}\n${r.stderr}`,
      /通过,parity 比对|parity OK/,
      '判死与合格证不得同屏(两态同屏=读不出哪个作数)',
    )
    // 变异对照:把那个目录删掉 ⇒ 同一份表立刻不判红 ⇒ 上面的红不是恒红(§12e)
    rmScratch(root)
    const clean = createTempProject()
    try {
      writeWebMessages(clean, PARITY_OK)
      const ok = runScript(['--worktree', '--parity-only', '--strict'], { cwd: clean })
      assert.equal(ok.status, 0, `没有漂移却仍判红 = 恒红门:${ok.stdout}${ok.stderr}`)
    } finally {
      rmScratch(clean)
    }
  } finally {
    rmScratch(root)
  }
})

// ─── FL:G-1079148 键流追踪(t(变量) 与"键作为值穿过 helper"两型)────────────
// 票面要求的是三条成对用例 + 变异锁。这里额外把"归属不猜"那一格也钉住,因为它是本门
// 唯一可能把"没判"写成"判过了"的新地方。真实形态取自 HEAD 面(§22c 的取材口径),
// 不用工作树副本 —— 该文件此刻由他席持有(` M`),按磁盘取会让断言随别人在飞改动漂动。
const REPO_ROOT_FOR_FL = join(__dirname, '..', '..')
const TOOLBAR_REL = 'apps/web/src/components/ai/markdown-table-toolbar.tsx'
function toolbarFromHead() {
  // 2026-10-04 本机纪律:派生 git 必须显式 stdio;取整面必须带 maxBuffer
  return execFileSync('git', ['-C', REPO_ROOT_FOR_FL, 'show', `HEAD:${TOOLBAR_REL}`], {
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 64 * 1024 * 1024,
  }).toString('utf8')
}
// 把 chat.markdownTable.<leaf> 铺进五语言(保持 parity 干净,让红只能来自"缺键"这一维)
function webMsgsToolbar(leaves) {
  const out = {}
  for (const [lang, base] of Object.entries(PARITY_OK)) {
    const mt = {}
    for (const leaf of leaves) mt[leaf] = `${lang}/${leaf}`
    out[lang] = { ...base, chat: { markdownTable: mt } }
  }
  return out
}
const FLOW_SRC = [
  "const t = useTranslations('chat')",
  "const [notice, setNotice] = React.useState('')",
  'const flashNotice = React.useCallback((key) => { setNotice(key) }, [])',
  "flashNotice('markdownTable.empty')",
  "return <div>{notice ? <span>{t(notice)}</span> : null}{t('markdownTable.copy')}</div>",
].join('\n')

function webFlowCase(root, src, leaves) {
  writeWebMessages(root, webMsgsToolbar(leaves))
  const srcDir = join(root, 'apps', 'web', 'src')
  mkdirSync(srcDir, { recursive: true })
  writeFileSync(join(srcDir, 'flow-case.tsx'), src)
}

test('FL-1 流进的键不在包里必须点名(旧版只认字面量实参 ⇒ 该键整型隐身)', () => {
  const root = createTempProject()
  try {
    webFlowCase(root, FLOW_SRC, ['copy'])
    const r = runScript(['--target=web'], { cwd: root })
    assert.equal(r.status, 1, `流键缺失必须判红,实得 ${r.status}:\n${r.stdout}`)
    assert.match(r.stdout, /markdownTable\.empty/, `必须点名那个流进来的键:\n${r.stdout}`)
  } finally {
    rmScratch(root)
  }
})

test('FL-2 同一份源码补齐流键后 exit 0(判据有牙但不误报)', () => {
  const root = createTempProject()
  try {
    webFlowCase(root, FLOW_SRC, ['copy', 'empty'])
    const r = runScript(['--target=web'], { cwd: root })
    assert.equal(r.status, 0, `补齐后不应误报,实得 ${r.status}:\n${r.stdout}${r.stderr}`)
  } finally {
    rmScratch(root)
  }
})

test('FL-3 lib 的汇点语义钉成规格:喂 setter 命中 4 键,喂源函数名必须为空', async () => {
  // 这一条钉的是接线时最容易静默失效的那一步(2026-10-09 接线前置实测 ②):
  // 名字喂错不报错,只返回空 ⇒ 门对着同一个文件继续报绿。所以"喂错=空"必须是规格而不是意外。
  const { traceKeyFlow } = await import(
    pathToFileURL(join(REPO_ROOT_FOR_FL, 'scripts', 'lib', 'i18n-key-flow.mjs')).href
  )
  const src = toolbarFromHead()
  const right = traceKeyFlow(src, ['setNotice'])
  const wrong = traceKeyFlow(src, ['flashNotice'])
  assert.equal(
    right.undetermined.length,
    0,
    `真汇点不应留下未判定:${JSON.stringify(right.undetermined)}`,
  )
  const got = right.keys.map((k) => k.key).sort()
  assert.deepEqual(
    got,
    [
      'markdownTable.copyFailed',
      'markdownTable.csvFailed',
      'markdownTable.empty',
      'markdownTable.unsupported',
    ],
    `汇点喂对必须命中票面那 4 个键,实得 ${JSON.stringify(got)}`,
  )
  assert.deepEqual(
    wrong.keys,
    [],
    `喂源函数名必须为空 —— 这条若翻绿,说明 lib 语义变了,本门的派生逻辑要重审`,
  )
})

test('FL-4 state 没被任何翻译变量用作整实参 ⇒ 不产流键也不报名(不误报)', () => {
  const root = createTempProject()
  try {
    const src = [
      "const t = useTranslations('chat')",
      'const [open, setOpen] = React.useState(false)',
      'setOpen(true)',
      "return <div>{t('markdownTable.copy')}</div>",
    ].join('\n')
    webFlowCase(root, src, ['copy'])
    const r = runScript(['--target=web'], { cwd: root })
    assert.equal(r.status, 0, `布尔位不该被算成流键,实得 ${r.status}:\n${r.stdout}`)
    assert.doesNotMatch(
      r.stdout,
      /键流未判定/,
      `没有流键站点却报名 = 把"与翻译无关"读成"判不出":\n${r.stdout}`,
    )
  } finally {
    rmScratch(root)
  }
})

test('FL-5 同一 reader 被两个翻译变量用作整实参 ⇒ 只点名不猜归属;--strict 才拒出合格证', () => {
  const root = createTempProject()
  try {
    const src = [
      "const t = useTranslations('chat')",
      "const t2 = useTranslations('nav')",
      "const [notice, setNotice] = React.useState('')",
      'const flashNotice = React.useCallback((key) => { setNotice(key) }, [])',
      "flashNotice('markdownTable.mystery')",
      "return <div>{t(notice)}{t2(notice)}{t('markdownTable.copy')}</div>",
    ].join('\n')
    webFlowCase(root, src, ['copy'])
    const warn = runScript(['--target=web'], { cwd: root })
    assert.equal(
      warn.status,
      0,
      `归属判不出不得冒红(恒红门,§12e),实得 ${warn.status}:\n${warn.stdout}`,
    )
    assert.match(warn.stdout, /键流未判定 1 处/, `必须点名那一处未判定:\n${warn.stdout}`)
    assert.doesNotMatch(
      warn.stdout,
      /markdownTable\.mystery.*缺失|缺失.*markdownTable\.mystery/s,
      `不得替人挑一个命名空间把未判定洗成结论:\n${warn.stdout}`,
    )
    const strict = runScript(['--target=web', '--strict'], { cwd: root })
    assert.equal(
      strict.status,
      2,
      `问责档下有未判定必须拒出合格证,实得 ${strict.status}:\n${strict.stdout}`,
    )
  } finally {
    rmScratch(root)
  }
})

test('FL-6 真实形态阳性对照:HEAD 那份组件在包齐时读到 8 键(不是旧版的 4)', () => {
  const root = createTempProject()
  try {
    writeWebMessages(
      root,
      webMsgsToolbar([
        'copy',
        'downloadCsv',
        'fullscreen',
        'fullscreenTitle',
        'empty',
        'unsupported',
        'copyFailed',
        'csvFailed',
      ]),
    )
    const srcDir = join(root, 'apps', 'web', 'src')
    mkdirSync(srcDir, { recursive: true })
    writeFileSync(join(srcDir, 'markdown-table-toolbar.tsx'), toolbarFromHead())
    const r = runScript(['--target=web'], { cwd: root })
    assert.equal(r.status, 0, `包齐时不得判红,实得 ${r.status}:\n${r.stdout}${r.stderr}`)
    assert.match(
      r.stdout,
      /1 文件, 8 键/,
      `票面那句"8 而不是 4"必须能在真实形态上量到:\n${r.stdout}`,
    )
  } finally {
    rmScratch(root)
  }
})

test('FL-8 形状锁:汇点派生只能引 lib 那一份,门内不得再抄一个同名函数', () => {
  // 本票接线当天真实踩到的自伤:门里抄了一份写窄的 useState 正则 ⇒ `useState` 整族不匹配 ⇒
  // 门继续报 4 键而账面一切正常。判据行为已被 FL-6/FL-7 钉住,这一条只是让"再抄一份"这件事
  // 在提交时就红,而不是等到下一个人重新踩。
  const gate = readFileSync(SCRIPT_PATH, 'utf8')
  assert.match(
    gate,
    /import\s*\{[^}]*deriveStatePairs[^}]*\}\s*from\s*'\.\/lib\/i18n-key-flow\.mjs'/,
  )
  assert.doesNotMatch(
    gate,
    /^function deriveStatePairs\b/m,
    '门内重新声明同名函数 = 第二个真相(§22c:两处算同一件事必然漂开)',
  )
})

test('FL-7 变异锁:真实形态里摘掉那一个流键必须翻红并点名(证明并集真进了判定面,不只进计数)', () => {
  const root = createTempProject()
  try {
    writeWebMessages(
      root,
      webMsgsToolbar([
        'copy',
        'downloadCsv',
        'fullscreen',
        'fullscreenTitle',
        'unsupported',
        'copyFailed',
        'csvFailed',
      ]),
    )
    const srcDir = join(root, 'apps', 'web', 'src')
    mkdirSync(srcDir, { recursive: true })
    writeFileSync(join(srcDir, 'markdown-table-toolbar.tsx'), toolbarFromHead())
    const r = runScript(['--target=web'], { cwd: root })
    assert.equal(r.status, 1, `摘掉流键必须判红,实得 ${r.status}:\n${r.stdout}`)
    assert.match(r.stdout, /markdownTable\.empty/, `必须点名被摘的那个流键:\n${r.stdout}`)
    // 计数仍是 8 —— 被引用而包里缺,不等于"没被引用"。这一条同时钉住两件事:
    // 判定与计数来自同一份并集(不是各算一遍),而"缺键"这一红只能由包侧缺叶造成。
    assert.match(r.stdout, /1 文件, 8 键/, `引用计数不得因包里缺叶而掉:\n${r.stdout}`)
  } finally {
    rmScratch(root)
  }
})

