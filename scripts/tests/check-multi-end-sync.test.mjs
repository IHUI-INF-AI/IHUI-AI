// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execSync, spawnSync } from 'node:child_process'
import { writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { fileURLToPath, pathToFileURL } from 'node:url'
// AGENTS.md §22c/§22d: 判据(端清单 + 判定函数)直接 import 门体导出, 测试内不得自抄一份
// —— 门体已带 isDirectRun 入口守护, import 时零副作用(不会跑 main / 不会 process.exit)。
import { __test__ as gate } from '../check-multi-end-sync.mjs'

// ─── 路径推导(AGENTS.md §15:用 import.meta.url,不硬编码) ───
const __dirname = fileURLToPath(new URL('.', import.meta.url))
const SCRIPT_PATH = join(__dirname, '..', 'check-multi-end-sync.mjs')
// 真实仓库根(本测试文件在 scripts/tests/ 下, 用于取逐字真实路径)
const SELF_REL_PATH = 'scripts/tests/check-multi-end-sync.test.mjs'

// ─── 辅助:创建临时 git 仓库(含初始 commit) ──────────────
// check-multi-end-sync.mjs 调用 git diff --cached 读取 staged 文件,需 git 环境
function createTempRepo() {
  const dir = mkScratch('ihui-multi-end-')
  const opt = { cwd: dir, encoding: 'utf8' }
  spawnSync('git', ['init', '-b', 'main'], { ...opt, /* 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY */ stdio: ['ignore', 'pipe', 'pipe'] })
  spawnSync('git', ['config', 'user.email', 'test@ihui.local'], { ...opt, /* 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY */ stdio: ['ignore', 'pipe', 'pipe'] })
  spawnSync('git', ['config', 'user.name', 'Test'], { ...opt, /* 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY */ stdio: ['ignore', 'pipe', 'pipe'] })
  spawnSync('git', ['config', 'commit.gpgsign', 'false'], { ...opt, /* 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY */ stdio: ['ignore', 'pipe', 'pipe'] })
  writeFileSync(join(dir, 'README.md'), '# init\n')
  spawnSync('git', ['add', 'README.md'], { ...opt, /* 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY */ stdio: ['ignore', 'pipe', 'pipe'] })
  spawnSync('git', ['commit', '-q', '-m', 'init'], { ...opt, /* 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY */ stdio: ['ignore', 'pipe', 'pipe'] })
  return dir
}

// ─── 辅助:在工作仓库创建文件并 stage(不 commit) ─────────
// files: ['apps/web/a.ts', 'packages/ui/b.tsx', ...] (正斜杠路径)
function stageFiles(dir, files) {
  for (const f of files) {
    const fullPath = join(dir, f)
    mkdirSync(dirname(fullPath), { recursive: true })
    writeFileSync(fullPath, `content for ${f}\n`)
    execSync(`git add "${f}"`, { cwd: dir, /* 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY */ stdio: 'ignore' })
  }
}

// ─── 辅助:写入 PROJECT_PLAN.md(不 stage,仅供脚本读取) ──
function writePlan(dir, content) {
  writeFileSync(join(dir, 'PROJECT_PLAN.md'), content)
}

// ─── 辅助:运行 check-multi-end-sync.mjs ──────────────────
function runScript(opts = {}) {
  const r = spawnSync('node', [SCRIPT_PATH], {
    cwd: opts.cwd || process.cwd(),
    encoding: 'utf8',
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  // 去除 ANSI 颜色码,便于正则断言
  r.out = (r.stdout || '').replace(/\x1b\[[0-9;]*m/g, '')
  return r
}

// ═══════════════════════════════════════════════════════════
// CLI 行为
// ═══════════════════════════════════════════════════════════

// ─── 1. CLI: --help 不崩溃(脚本未实现 --help,按默认模式运行) ──
test('CLI: --help 不崩溃(脚本未实现 --help,按默认模式运行)', () => {
  const dir = createTempRepo()
  try {
    const r = runScript({ cwd: dir })
    // 无 --help 解析,直接走 main()(空 staged → 跳过)
    assert.equal(r.status, 0, `应 exit 0,实际 ${r.status}\nstderr: ${r.stderr}`)
    assert.ok(!r.stderr.includes('Error:'), `不应产生未捕获 Error`)
  } finally {
    rmScratch(dir)
  }
})

// ─── 2. 非 git: 非 git 仓库目录 → exit 0(getStagedFiles catch 返回空) ──
test('非 git: 非 git 仓库目录 → exit 0(跳过)', () => {
  const dir = mkScratch('ihui-nongit-')
  try {
    const r = runScript({ cwd: dir })
    assert.equal(r.status, 0, `非 git 应 exit 0,实际 ${r.status}`)
    assert.match(r.out, /无 staged 文件|跳过/)
  } finally {
    rmScratch(dir)
  }
})

// ─── 3. 空 staged: git 仓库无 staged 文件 → exit 0(跳过) ─────────────
test('空 staged: git 仓库无 staged 文件 → exit 0(跳过)', () => {
  const dir = createTempRepo()
  try {
    const r = runScript({ cwd: dir })
    assert.equal(r.status, 0, `空 staged 应 exit 0,实际 ${r.status}`)
    assert.match(r.out, /无 staged 文件|跳过/)
    assert.ok(!r.out.includes('warn-only'), '空 staged 不应触发警告')
  } finally {
    rmScratch(dir)
  }
})

// ═══════════════════════════════════════════════════════════
// 场景 1: 0 端 + 0 共享(纯豁免目录)→ pass
// ═══════════════════════════════════════════════════════════

// ─── 4. 场景1: 纯 scripts/ 文件 → exit 0 pass(豁免) ──────────────────
test('场景1: 纯 scripts/ 文件 → exit 0 pass(豁免,非端代码)', () => {
  const dir = createTempRepo()
  try {
    stageFiles(dir, ['scripts/check-foo.mjs', 'scripts/helpers/util.mjs'])
    const r = runScript({ cwd: dir })
    assert.equal(r.status, 0, `场景1 应 exit 0,实际 ${r.status}`)
    assert.match(r.out, /豁免/)
    assert.ok(!r.out.includes('warn-only'), '纯 scripts/ 不应触发警告')
  } finally {
    rmScratch(dir)
  }
})

// ─── 5. 场景1: 纯根目录文件(README.md + package.json)→ exit 0 pass ──
test('场景1: 纯根目录文件(README.md + package.json)→ exit 0 pass(豁免)', () => {
  const dir = createTempRepo()
  try {
    // README.md 已在初始 commit,修改使其 staged(Modified 走 diff-filter=M)
    writeFileSync(join(dir, 'README.md'), '# updated\n')
    writeFileSync(join(dir, 'package.json'), '{"name":"test"}\n')
    execSync('git add README.md package.json', { cwd: dir, /* 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY */ stdio: 'ignore' })
    const r = runScript({ cwd: dir })
    assert.equal(r.status, 0, `根目录文件应 exit 0,实际 ${r.status}`)
    assert.match(r.out, /豁免/)
    assert.ok(!r.out.includes('warn-only'), '根目录文件不应触发警告')
  } finally {
    rmScratch(dir)
  }
})

// ═══════════════════════════════════════════════════════════
// 场景 2: 触及 packages/* 未标注 → warn;已标注 → pass
// ═══════════════════════════════════════════════════════════

// ─── 6. 场景2: 仅 packages/types + 无 PROJECT_PLAN.md → exit 0 warn ──
test('场景2: 仅 packages/types + 无 PROJECT_PLAN.md → exit 0 warn(未标注共享包)', () => {
  const dir = createTempRepo()
  try {
    stageFiles(dir, ['packages/types/index.ts', 'packages/types/user.d.ts'])
    const r = runScript({ cwd: dir })
    // 2026-08-19 起脚本有意 exit 1 供 runner 计 warning(依据:scripts/check-multi-end-sync.mjs 内 "2026-08-19 立:warn-only 违规显式 exit 1" 注释 + runner id 21 mode=warn)
    assert.equal(r.status, 1, 'warn-only 违规应 exit 1')
    assert.match(r.out, /warn-only/, '应输出 warn-only')
    assert.match(r.out, /共享包改动未标注跨端验证/)
    assert.ok(!r.out.includes('豁免'), '不应走场景1 豁免路径')
  } finally {
    rmScratch(dir)
  }
})

// ─── 7. 场景2: 仅 packages/ui + PROJECT_PLAN.md 标注"共享包" → pass ──
test('场景2: 仅 packages/ui + PROJECT_PLAN.md 标注"共享包" → exit 0 pass', () => {
  const dir = createTempRepo()
  try {
    stageFiles(dir, ['packages/ui/button.tsx'])
    writePlan(
      dir,
      '# plan\n\n### 任务A(共享包改动)\n更新 packages/ui Button 组件,8 端引用已验证一致\n',
    )
    const r = runScript({ cwd: dir })
    assert.equal(r.status, 0, `已标注共享包应 exit 0,实际 ${r.status}`)
    assert.match(r.out, /已标注共享包|pass/)
    assert.ok(!r.out.includes('warn-only'), '已标注不应触发警告')
  } finally {
    rmScratch(dir)
  }
})

// ─── 8. 场景2: 仅 packages/database + 标注"packages/*" → pass ────────
test('场景2: 仅 packages/database + PROJECT_PLAN.md 标注"packages/*" → exit 0 pass', () => {
  const dir = createTempRepo()
  try {
    stageFiles(dir, ['packages/database/src/schema.ts'])
    writePlan(
      dir,
      '# plan\n\n### 任务A\npackages/* 单包改动(database schema 更新)\n',
    )
    const r = runScript({ cwd: dir })
    assert.equal(r.status, 0, `标注 packages/* 应 exit 0,实际 ${r.status}`)
    assert.match(r.out, /已标注共享包|pass/)
    assert.ok(!r.out.includes('warn-only'), '标注 packages/* 不应触发警告')
  } finally {
    rmScratch(dir)
  }
})

// ─── 9. 场景2: 仅 packages/auth + PROJECT_PLAN.md 未标注 → exit 0 warn
test('场景2: 仅 packages/auth + PROJECT_PLAN.md 未标注 → exit 0 warn', () => {
  const dir = createTempRepo()
  try {
    stageFiles(dir, ['packages/auth/src/jwt.ts'])
    writePlan(dir, '# plan\n\n### 任务A\n修复 auth 模块 JWT 验证逻辑\n')
    const r = runScript({ cwd: dir })
    // 2026-08-19 起脚本有意 exit 1 供 runner 计 warning(依据:scripts/check-multi-end-sync.mjs 内 "2026-08-19 立:warn-only 违规显式 exit 1" 注释 + runner id 21 mode=warn)
    assert.equal(r.status, 1, 'warn-only 违规应 exit 1')
    assert.match(r.out, /warn-only/)
    assert.match(r.out, /共享包改动未标注跨端验证/)
  } finally {
    rmScratch(dir)
  }
})

// ═══════════════════════════════════════════════════════════
// 场景 3: 触及 ≥2 端 → pass(满足跨端连通)
// ═══════════════════════════════════════════════════════════

// ─── 10. 场景3: apps/web + apps/api(2 端)→ exit 0 pass ──────────────
test('场景3: apps/web + apps/api(2 端)→ exit 0 pass(满足跨端连通)', () => {
  const dir = createTempRepo()
  try {
    stageFiles(dir, ['apps/web/page.tsx', 'apps/api/route.ts'])
    const r = runScript({ cwd: dir })
    assert.equal(r.status, 0, `2 端应 exit 0,实际 ${r.status}`)
    assert.match(r.out, /满足跨端连通|2 端/)
    assert.ok(!r.out.includes('warn-only'), '2 端连通不应触发警告')
  } finally {
    rmScratch(dir)
  }
})

// ─── 11. 场景3: 3 端(web + api + ai-service)→ exit 0 pass ───────────
test('场景3: 3 端(web + api + ai-service)→ exit 0 pass(满足跨端连通)', () => {
  const dir = createTempRepo()
  try {
    stageFiles(dir, [
      'apps/web/page.tsx',
      'apps/api/route.ts',
      'apps/ai-service/main.py',
    ])
    const r = runScript({ cwd: dir })
    assert.equal(r.status, 0, `3 端应 exit 0,实际 ${r.status}`)
    assert.match(r.out, /满足跨端连通|3 端/)
    assert.match(r.out, /web/, '应列出端名 web')
    assert.match(r.out, /api/, '应列出端名 api')
    assert.match(r.out, /ai-service/, '应列出端名 ai-service')
    assert.ok(!r.out.includes('warn-only'), '3 端连通不应触发警告')
  } finally {
    rmScratch(dir)
  }
})

// ═══════════════════════════════════════════════════════════
// 场景 4: 触及 1 端 → 检查标注(平台独占 / 跨端:仅 X 端 / X 独占)
// ═══════════════════════════════════════════════════════════

// ─── 12. 场景4: 仅 apps/web + 标注"平台独占" → exit 0 pass ────────────
test('场景4: 仅 apps/web + PROJECT_PLAN.md 标注"平台独占" → exit 0 pass', () => {
  const dir = createTempRepo()
  try {
    stageFiles(dir, ['apps/web/page.tsx'])
    writePlan(dir, '# plan\n\n### 任务A\n平台独占:web 端专属页面\n')
    const r = runScript({ cwd: dir })
    assert.equal(r.status, 0, `已标注平台独占应 exit 0,实际 ${r.status}`)
    assert.match(r.out, /已标注平台独占|pass/)
    assert.ok(!r.out.includes('warn-only'), '已标注不应触发警告')
  } finally {
    rmScratch(dir)
  }
})

// ─── 13. 场景4: 仅 apps/web + 标注"跨端:仅 web 端" → exit 0 pass ────
test('场景4: 仅 apps/web + 标注"跨端:仅 web 端" → exit 0 pass(端名匹配)', () => {
  const dir = createTempRepo()
  try {
    stageFiles(dir, ['apps/web/dashboard.tsx'])
    writePlan(dir, '# plan\n\n### 任务A\n跨端:仅 web 端(web 独占页面)\n')
    const r = runScript({ cwd: dir })
    assert.equal(r.status, 0, `端名匹配应 exit 0,实际 ${r.status}`)
    assert.match(r.out, /已标注平台独占|pass/)
    assert.ok(!r.out.includes('warn-only'), '端名匹配不应触发警告')
  } finally {
    rmScratch(dir)
  }
})

// ─── 14. 场景4: 仅 apps/api + 标注"web 独占"(端不匹配)→ warn ──────
test('场景4: 仅 apps/api + 标注"web 独占"(端不匹配)→ exit 0 warn', () => {
  const dir = createTempRepo()
  try {
    stageFiles(dir, ['apps/api/route.ts'])
    // 活跃任务标注 "web 独占",但 staged 触及 api 端 → 端名不匹配 → warn
    writePlan(dir, '# plan\n\n### 任务A\nweb 独占页面开发\n')
    const r = runScript({ cwd: dir })
    // 2026-08-19 起脚本有意 exit 1 供 runner 计 warning(依据:scripts/check-multi-end-sync.mjs 内 "2026-08-19 立:warn-only 违规显式 exit 1" 注释 + runner id 21 mode=warn)
    assert.equal(r.status, 1, 'warn-only 违规应 exit 1')
    assert.match(r.out, /warn-only/)
    assert.match(r.out, /单端改动未标注平台独占/)
    assert.match(r.out, /api/, '应报告触及 api 端')
  } finally {
    rmScratch(dir)
  }
})

// ─── 15. 场景4 边界: apps/web + packages/ui(1 端 + 共享)+ 无标注 → warn
test('场景4 边界: apps/web + packages/ui(1 端 + 共享)+ 无标注 → exit 0 warn(走场景4)', () => {
  const dir = createTempRepo()
  try {
    stageFiles(dir, ['apps/web/page.tsx', 'packages/ui/button.tsx'])
    writePlan(dir, '# plan\n\n### 任务A\n更新 web 页面引用的新 Button\n')
    const r = runScript({ cwd: dir })
    // endCount=1(web), sharedFiles=[packages/ui/...] → 命中场景4(endCount===1)
    // 共享包不影响场景4 判定,无标注 → warn
    // 2026-08-19 起脚本有意 exit 1 供 runner 计 warning(依据:scripts/check-multi-end-sync.mjs 内 "2026-08-19 立:warn-only 违规显式 exit 1" 注释 + runner id 21 mode=warn)
    assert.equal(r.status, 1, 'warn-only 违规应 exit 1')
    assert.match(r.out, /warn-only/)
    assert.match(r.out, /单端改动未标注平台独占/)
  } finally {
    rmScratch(dir)
  }
})

// ═══════════════════════════════════════════════════════════
// §22c/§22d: 判据单一真相(import 门体导出, 不在测试里自抄)
// ═══════════════════════════════════════════════════════════

// ─── 16. §22d: import 门体零副作用(入口守护丢了就会跑 main ⇒ 打横幅并 exit) ───
test('§22d: import 门体不触发 CLI 主流程(零输出 / exit 0)', () => {
  // 反证夹具: 临时仓库 staged 只触及 1 端且无 PROJECT_PLAN.md
  // ⇒ 若门体缺 isDirectRun 守护, import 会连带跑 main(): 打印 warn 横幅并 exit 1
  const dir = createTempRepo()
  try {
    stageFiles(dir, ['apps/web/page.tsx'])
    const probe = `await import(${JSON.stringify(pathToFileURL(SCRIPT_PATH).href)}); console.log('@@IMPORT_NO_SIDE_EFFECT')`
    const r = spawnSync('node', ['--input-type=module', '-e', probe], {
      cwd: dir,
      encoding: 'utf8',
      // AGENTS.md §12g: 派生子进程必须显式接管 stdio + windowsHide(本机 EBUSY 病灶)
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    })
    assert.equal(r.stdout, '@@IMPORT_NO_SIDE_EFFECT\n', `import 门体不应产生任何 CLI 输出, 实际 stdout: ${JSON.stringify(r.stdout)}`)
    assert.equal(r.stderr, '', `import 门体不应有 stderr: ${r.stderr}`)
    assert.equal(r.status, 0, `import 门体应 exit 0(实际 ${r.status} ⇒ main() 被 import 触发)`)
  } finally {
    rmScratch(dir)
  }
})

// ─── 17. §22c: __test__ 导出锚点齐全(端清单 + 判定函数), 测试唯一真相来自门体 ───
test('§22c: __test__ 导出锚点齐全且端清单为 8 端', () => {
  for (const key of ['END_MAP', 'ALL_ENDS', 'classifyFile', 'getActiveTaskEntry', 'isTaskLabeledSingleEnd', 'isTaskLabeledSharedPackage']) {
    assert.ok(key in gate, `__test__ 必须导出 ${key}(§22c 锚点)`)
  }
  assert.deepEqual(gate.ALL_ENDS, Object.values(gate.END_MAP), 'ALL_ENDS 必须是 END_MAP 的值面')
  assert.equal(gate.ALL_ENDS.length, 8, 'AGENTS.md §9 规定 8 端')
  assert.deepEqual(
    Object.keys(gate.END_MAP).sort(),
    ['apps/ai-service', 'apps/api', 'apps/cli', 'apps/desktop', 'apps/extension', 'apps/miniapp-taro', 'apps/mobile-rn', 'apps/web'].sort(),
    '端目录清单必须与 AGENTS.md §9 的 8 端目录一致',
  )
})

// ─── 18. 判据 classifyFile: 端 / 共享包 / 豁免 三态(直接门体函数, 非黑盒 CLI) ───
test('判据 classifyFile: 端、packages/* 共享、豁免目录三态', () => {
  const END = (end) => ({ end, isShared: false, isExempt: false })
  const SHARED = { end: null, isShared: true, isExempt: false }
  const EXEMPT = { end: null, isShared: false, isExempt: true }
  assert.deepEqual(gate.classifyFile('apps/miniapp-taro/src/app.config.ts'), END('miniapp-taro'))
  assert.deepEqual(gate.classifyFile('apps/cli'), END('cli'), '端目录本身也要计入')
  assert.deepEqual(gate.classifyFile('packages/ui/src/button.tsx'), SHARED)
  // 逐字取自本仓真实路径(AGENTS.md §1296): 测试文件自身就在 scripts/ 豁免面内
  assert.deepEqual(gate.classifyFile(SELF_REL_PATH), EXEMPT)
  assert.deepEqual(gate.classifyFile('docs/MULTI_END.md'), EXEMPT)
  assert.deepEqual(gate.classifyFile('PROJECT_PLAN.md'), EXEMPT, '根目录文件豁免')
  assert.deepEqual(gate.classifyFile('apps/not-an-end/index.ts'), EXEMPT, 'apps/ 下非 8 端目录不判端')
  // 前缀相似不得误判: apps/webview 不是 web 端(判据用的是 prefix + '/' 而非裸前缀)
  assert.equal(gate.classifyFile('apps/webview/x.ts').end, null, 'apps/webview 不得误判为 web 端')
})

// ─── 19. 判据 标注识别: 单端标注 / 共享包标注(含全角冒号与端名不匹配) ───
test('判据 isTaskLabeled*: 单端与共享包标注识别', () => {
  const e = (title, body) => ({ title, body })
  assert.equal(gate.isTaskLabeledSingleEnd(e('### 任务A', '跨端:仅 web 端(web 独占页面)'), 'web'), true, '半角冒号 + 端名匹配')
  assert.equal(gate.isTaskLabeledSingleEnd(e('### 任务A', '跨端：仅 api 端'), 'api'), true, '全角冒号也要认')
  assert.equal(gate.isTaskLabeledSingleEnd(e('### 任务A', '跨端:仅 web 端'), 'api'), false, '标注端名与触及端不一致 ⇒ 不算标注')
  assert.equal(gate.isTaskLabeledSingleEnd(e('### 任务A', 'desktop 独占工具链'), 'desktop'), true, 'X 独占')
  assert.equal(gate.isTaskLabeledSingleEnd(e('### 任务A', '平台独占:extension 插件'), 'extension'), true, '平台独占通用标注')
  assert.equal(gate.isTaskLabeledSingleEnd(e('### 任务A', '单端脚本:仅收口 docs'), 'cli'), true, '单端脚本标注')
  assert.equal(gate.isTaskLabeledSingleEnd(e('### 任务A', '更新 web 页面引用的新 Button'), 'web'), false, '没写标注词 ⇒ 判红')
  assert.equal(gate.isTaskLabeledSingleEnd(null, 'web'), false, '无活跃任务条目 ⇒ 判红')
  assert.equal(gate.isTaskLabeledSharedPackage(e('### 任务A(共享包改动)', 'x')), true, '共享包字样')
  assert.equal(gate.isTaskLabeledSharedPackage(e('### 任务A', 'packages/* 单包改动')), true, 'packages/* 写法')
  assert.equal(gate.isTaskLabeledSharedPackage(e('### 任务A', '本次为跨端共享改动')), true, '跨端共享字样')
  assert.equal(gate.isTaskLabeledSharedPackage(e('### 任务A', '更新 packages/ui Button 组件')), false, '只提包名不写标注 ⇒ 判红')
  assert.equal(gate.isTaskLabeledSharedPackage(null), false)
})

// ─── 20. 判据现读真实 PROJECT_PLAN.md(AGENTS.md §1296:输入逐字取自真实文件) ───
test('判据读真实 PROJECT_PLAN.md: 活跃条目须来自 "### " 标题式, 未写标注不得判为已标注', (t) => {
  const entry = gate.getActiveTaskEntry() // 门体读 process.cwd()/PROJECT_PLAN.md ⇒ 须在仓库根跑
  if (!entry) {
    t.skip('cwd 下无 PROJECT_PLAN.md 或未完成任务条目(请从仓库根运行 node --test)')
    return
  }
  assert.ok(entry.title.startsWith('### '), `活跃任务标题必须是 "### " 标题式, 实际: ${JSON.stringify(entry.title)}`)
  const text = `${entry.title}\n${entry.body}`
  const writesNoAnnotationAtAll = !/独占|单端文档|单端脚本|单端\s*配置|跨端\s*[:：]\s*仅|共享包|packages\/\*|packages\s*only|跨端共享/.test(text)
  if (writesNoAnnotationAtAll) {
    // 真实条目一个标注词都没写 ⇒ 8 端任何一端都不能被判为"已标注"(warn 路径必须成立)
    for (const end of gate.ALL_ENDS) {
      assert.equal(gate.isTaskLabeledSingleEnd(entry, end), false, `真实条目无标注 ⇒ ${end} 端不得判 pass`)
    }
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
