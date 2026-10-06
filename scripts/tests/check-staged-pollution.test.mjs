// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execSync, spawnSync } from 'node:child_process'
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { fileURLToPath, pathToFileURL } from 'node:url'

// §22c/§22d(G-1058651):判据单元一律取门体 `__test__` 导出 —— 阈值 / 分组 / 裁定函数
// 都不在测试里重述(此前测试把 `4` / `>15` / `≥3` 三条边界抄成断言,正是 §22c 禁的两份真相)。
// 门体已加 isDirectRun 守卫,故本行 import 不再触发 CLI 主流程(由 T0 用例实测钉住)。
import { __test__ as gate } from '../check-staged-pollution.mjs'

const {
  DIR_GATE,
  FILE_GATE,
  BIG_CHANGE_DIR_GATE,
  PREVIEW_LIMIT,
  getTopGroup,
  groupStagedByTopDir,
  judgePollution,
} = gate

// ─── 路径推导(AGENTS.md §15:用 import.meta.url,不硬编码) ───
const __dirname = fileURLToPath(new URL('.', import.meta.url))
const SCRIPT_PATH = join(__dirname, '..', 'check-staged-pollution.mjs')

// ─── 夹具辅助:n 个目录组(组的区分性由生产 getTopGroup 判,测试不重述分组规则) ───
const GROUP_POOL = [
  'apps/web',
  'apps/api',
  'packages/ui',
  'scripts',
  'docs',
  '.husky',
  'apps/ai-service',
  'packages/core',
]

function groupKeys(n) {
  const keys = GROUP_POOL.slice(0, n)
  assert.equal(keys.length, n, `夹具池只有 ${keys.length} 个目录键,不够 ${n} 组 —— 请扩 GROUP_POOL`)
  const distinct = new Set(keys.map((k) => getTopGroup(`${k}/f0.ts`)))
  assert.equal(
    distinct.size,
    n,
    `夹具需要 ${n} 个互不相同的目录组,门体 getTopGroup 只判出 ${distinct.size} 个`,
  )
  return keys
}

/** 造 staged 面:groupCount 个目录组、fileCount 个文件(轮转平摊) */
function stagedFace(groupCount, fileCount) {
  const keys = groupKeys(groupCount)
  const out = []
  for (let i = 0; i < fileCount; i++) out.push(`${keys[i % keys.length]}/f${i}.ts`)
  return out
}

// ─── 辅助:创建临时 git 仓库(含初始 commit) ──────────────
function createTempRepo() {
  const dir = mkScratch('ihui-staged-')
  execSync('git init -b main', { cwd: dir, /* 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY */ stdio: 'ignore' })
  execSync('git config user.email test@test.com', { cwd: dir, /* 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY */ stdio: 'ignore' })
  execSync('git config user.name test', { cwd: dir, /* 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY */ stdio: 'ignore' })
  execSync('git config commit.gpgsign false', { cwd: dir, /* 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY */ stdio: 'ignore' })
  writeFileSync(join(dir, 'README.md'), '# init\n')
  execSync('git add README.md', { cwd: dir, /* 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY */ stdio: 'ignore' })
  execSync('git commit -m "init"', { cwd: dir, /* 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY */ stdio: 'ignore' })
  return dir
}

// ─── 辅助:在工作仓库创建文件并 stage(不 commit) ─────────
// files: ['apps/web/a.ts', 'apps/api/b.ts', ...] (正斜杠路径)
function stageFiles(dir, files) {
  for (const f of files) {
    const fullPath = join(dir, f)
    mkdirSync(dirname(fullPath), { recursive: true })
    writeFileSync(fullPath, `content for ${f}\n`)
    // git add 用正斜杠路径(Windows 上 git 也接受)
    execSync(`git add "${f}"`, { cwd: dir, /* 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY */ stdio: 'ignore' })
  }
}

// ─── 辅助:运行 check-staged-pollution.mjs ────────────────
function runScript(opts = {}) {
  return spawnSync('node', [SCRIPT_PATH], {
    cwd: opts.cwd || process.cwd(),
    encoding: 'utf8',
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

// ─── 辅助:去除 ANSI 颜色码(脚本输出含 \x1B[31m 等) ────
function stripAnsi(s) {
  return s.replace(/\x1B\[[0-9;]*m/g, '')
}

// ─── T0. §22d 使能条件:import 门体必须零副作用(改前实测打 26 行并 exit 1) ───
test('T0 §22d:import 门体零输出零退出码污染(rc=0)', () => {
  const probe = `await import(${JSON.stringify(pathToFileURL(SCRIPT_PATH).href)})`
  const r = spawnSync(process.execPath, ['--input-type=module', '-e', probe], {
    cwd: process.cwd(),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })
  assert.equal(r.stdout, '', `import 门体不得打印(实际 stdout=${JSON.stringify(r.stdout)})`)
  assert.equal(r.stderr, '', `import 门体不得报错(实际 stderr=${JSON.stringify(r.stderr)})`)
  assert.equal(r.status, 0, `import 门体不得 process.exit(实际 rc=${r.status})`)
})

// ─── T0b. §22d 位置判据:__test__ 的 export 必须在 if (isDirectRun) 之后 ───
test('T0b §22d:__test__ 导出位于 isDirectRun 守卫之后(位置本身是判据)', () => {
  const src = readFileSync(SCRIPT_PATH, 'utf8')
  const guardIdx = src.indexOf('if (isDirectRun)')
  const exportIdx = src.indexOf('export const __test__')
  assert.ok(guardIdx > -1, '门体必须含 §22d isDirectRun 守卫')
  assert.ok(exportIdx > guardIdx, `__test__ 导出必须在守卫之后(guard=${guardIdx} export=${exportIdx})`)
  assert.ok(src.includes('pathToFileURL(process.argv[1])'), '守卫必须经 pathToFileURL(Windows 反斜杠)')
  assert.ok(!/^main\(\)\s*$/m.test(src), '顶层不得再裸调 main()')
})

// ─── T0c. 双形态另一半:CLI 直跑仍须执行 main()(守卫不能把 CLI 洗成静默) ───
test('T0c §22d:CLI 直跑仍执行 main()(输出含本门读数)', () => {
  const r = runScript()
  const out = stripAnsi(r.stdout)
  assert.ok(
    /staged 污染预警|Staged 污染预警/.test(out),
    `CLI 直跑必须打印读数,实际 stdout=${JSON.stringify(r.stdout)}`,
  )
  assert.ok(r.status === 0 || r.status === 1, `CLI 直跑退出码须为 0/1,实际 ${r.status}`)
})

// ─── T1. 判据单元:阈值常量本身(§22c 材料由门体出,测试只断言其自洽) ───
test('T1 判据常量:DIR_GATE > BIG_CHANGE_DIR_GATE、FILE_GATE 为正、PREVIEW_LIMIT 为正', () => {
  assert.ok(DIR_GATE > BIG_CHANGE_DIR_GATE, '跨目录硬门槛必须高于"大改"分支的目录门槛')
  assert.ok(FILE_GATE > 0 && PREVIEW_LIMIT > 0)
})

// ─── T2. 判据单元:分组(经生产 getTopGroup / groupStagedByTopDir,不抄规则) ───
test('T2 判据单元:groupStagedByTopDir 按门体分组口径聚合', () => {
  const staged = ['apps/web/a.ts', 'apps/web/b.ts', 'scripts/c.mjs', 'README.md']
  const groups = groupStagedByTopDir(staged)
  assert.equal(groups.size, judgePollution(staged).uniqueGroups, '分组数须与裁定口径同源')
  assert.equal(groups.get(getTopGroup('apps/web/a.ts')).length, 2)
  assert.deepEqual([...groups.keys()], staged.map(getTopGroup).filter((k, i, a) => a.indexOf(k) === i))
})

// ─── T3. 判据单元:污染裁定正反边界(全部由门体常量推导,不写死数字) ───
test('T3 判据单元:judgePollution 四条边界与常量同形', () => {
  // ① 跨目录硬门槛:DIR_GATE-1 组不触发 / DIR_GATE 组触发
  assert.equal(judgePollution(stagedFace(DIR_GATE - 1, DIR_GATE - 1)).shouldWarn, false)
  assert.equal(judgePollution(stagedFace(DIR_GATE, DIR_GATE)).shouldWarn, true)
  // ② 大改分支:FILE_GATE 文件(=15 不 >15)不触发 / FILE_GATE+1 触发
  assert.equal(judgePollution(stagedFace(BIG_CHANGE_DIR_GATE, FILE_GATE)).shouldWarn, false)
  assert.equal(judgePollution(stagedFace(BIG_CHANGE_DIR_GATE, FILE_GATE + 1)).shouldWarn, true)
  // ③ 大改但目录不够:FILE_GATE+1 文件跨 BIG_CHANGE_DIR_GATE-1 组不触发
  assert.equal(judgePollution(stagedFace(BIG_CHANGE_DIR_GATE - 1, FILE_GATE + 1)).shouldWarn, false)
  // ④ 单目录大改(单 agent 重构)不触发
  assert.equal(judgePollution(stagedFace(1, FILE_GATE + 5)).shouldWarn, false)
  // 空面
  assert.equal(judgePollution([]).shouldWarn, false)
})

// ─── 1. 非 git: 非 git 仓库目录 → exit 0(getStagedFiles catch 返回空) ──
test('非 git: 非 git 仓库目录 → exit 0(跳过)', () => {
  const dir = mkScratch('ihui-nongit-')
  try {
    const r = runScript({ cwd: dir })
    assert.equal(r.status, 0, `非 git 应 exit 0,实际 ${r.status}`)
    const out = stripAnsi(r.stdout)
    assert.match(out, /无 staged 文件|跳过/)
  } finally {
    rmScratch(dir)
  }
})

// ─── 2. 空 staged: git 仓库无 staged 文件 → exit 0(跳过) ─────────────
test('空 staged: git 仓库无 staged 文件 → exit 0(跳过)', () => {
  const dir = createTempRepo()
  try {
    const r = runScript({ cwd: dir })
    assert.equal(r.status, 0, `空 staged 应 exit 0,实际 ${r.status}`)
    const out = stripAnsi(r.stdout)
    assert.match(out, /无 staged 文件|跳过/)
    assert.ok(!out.includes('warn-only'), '空 staged 不应触发警告')
  } finally {
    rmScratch(dir)
  }
})

// ─── 3. 单文件: 1 个 apps/web 文件 → exit 0(未触发) ─────────────────
test('单文件: 1 个 apps/web 文件 → exit 0(未触发)', () => {
  const dir = createTempRepo()
  try {
    stageFiles(dir, ['apps/web/index.ts'])
    const r = runScript({ cwd: dir })
    assert.equal(r.status, 0, `单文件应 exit 0,实际 ${r.status}`)
    const out = stripAnsi(r.stdout)
    assert.match(out, /未触发/)
    assert.ok(!out.includes('warn-only'), '单文件不应触发警告')
  } finally {
    rmScratch(dir)
  }
})

// ─── 4. 单目录多文件: 3 个 apps/web 文件(1 组)→ exit 0(未触发) ──
test('单目录多文件: 3 个 apps/web 文件(1 组)→ exit 0(未触发)', () => {
  const dir = createTempRepo()
  try {
    stageFiles(dir, [
      'apps/web/index.ts',
      'apps/web/button.tsx',
      'apps/web/utils.ts',
    ])
    const r = runScript({ cwd: dir })
    assert.equal(r.status, 0)
    const out = stripAnsi(r.stdout)
    assert.match(out, /未触发/)
    assert.ok(!out.includes('warn-only'))
  } finally {
    rmScratch(dir)
  }
})

// ─── 5. 跨 2 目录小改: 1 apps/web + 1 apps/api → exit 0(未触发) ───
test('跨 2 目录小改: 1 apps/web + 1 apps/api → exit 0(未触发)', () => {
  const dir = createTempRepo()
  try {
    stageFiles(dir, ['apps/web/index.ts', 'apps/api/route.ts'])
    const r = runScript({ cwd: dir })
    assert.equal(r.status, 0)
    const out = stripAnsi(r.stdout)
    assert.match(out, /未触发/)
    assert.ok(!out.includes('warn-only'))
  } finally {
    rmScratch(dir)
  }
})

// ─── 6. 边界(硬门槛减一):跨 DIR_GATE-1 个目录、每目录 1 文件 → exit 0 ──
test(`边界: 跨 ${DIR_GATE - 1} 个目录(硬门槛减一)→ exit 0(未触发)`, () => {
  const dir = createTempRepo()
  try {
    const files = stagedFace(DIR_GATE - 1, DIR_GATE - 1)
    assert.equal(judgePollution(files).uniqueGroups, DIR_GATE - 1, '夹具组数由门体判定')
    assert.equal(judgePollution(files).shouldWarn, false, '门体自判:此面不应触发')
    stageFiles(dir, files)
    const r = runScript({ cwd: dir })
    assert.equal(r.status, 0)
    const out = stripAnsi(r.stdout)
    assert.match(out, /未触发/)
    assert.ok(!out.includes('warn-only'), '未到硬门槛不应触发')
  } finally {
    rmScratch(dir)
  }
})

// ─── 7. 违规:跨满 DIR_GATE 个目录(每目录 1 文件)→ warn-only, exit 1 ──
test(`违规: 跨 ${DIR_GATE} 个目录 → 触发污染预警(warn-only, exit 1)`, () => {
  const dir = createTempRepo()
  try {
    const files = stagedFace(DIR_GATE, DIR_GATE)
    assert.equal(judgePollution(files).shouldWarn, true, '门体自判:此面应触发')
    stageFiles(dir, files)
    const r = runScript({ cwd: dir })
    // exit 1 依据:门体 return 1(2026-08-19 立,供 guardian-runner id 19 mode=warn 计数)
    assert.equal(r.status, 1, 'warn-only 违规应 exit 1')
    const out = stripAnsi(r.stdout)
    assert.match(out, /Staged 污染预警/)
    assert.match(out, /warn-only/)
    // CLI 读数里的阈值必须与判据常量同源(§22c:否则门体改了常量、测试还在钉旧数字)
    assert.ok(
      out.includes(
        `跨 ${DIR_GATE} 个一级子目录 (≥ ${DIR_GATE} 或 >${FILE_GATE}+≥${BIG_CHANGE_DIR_GATE})`,
      ),
      `读数应含与常量同源的阈值面,实际输出:\n${out}`,
    )
    assert.ok(!out.includes('未触发'), '触发时不应输出未触发')
  } finally {
    rmScratch(dir)
  }
})

// ─── 8. 违规:跨 BIG_CHANGE_DIR_GATE 个目录 + FILE_GATE+1 文件 → 触发 ─────
test(`违规: 跨 ${BIG_CHANGE_DIR_GATE} 个目录 + ${FILE_GATE + 1} 文件(> ${FILE_GATE} 且 ≥ ${BIG_CHANGE_DIR_GATE})→ 触发污染预警`, () => {
  const dir = createTempRepo()
  try {
    const files = stagedFace(BIG_CHANGE_DIR_GATE, FILE_GATE + 1)
    assert.equal(judgePollution(files).shouldWarn, true, '门体自判:此面应触发')
    stageFiles(dir, files)
    const r = runScript({ cwd: dir })
    assert.equal(r.status, 1, 'warn-only 违规应 exit 1')
    const out = stripAnsi(r.stdout)
    assert.match(out, /Staged 污染预警/)
    assert.match(out, /warn-only/)
    assert.ok(out.includes(`跨 ${BIG_CHANGE_DIR_GATE} 个一级子目录`), '读数应报出实际组数')
  } finally {
    rmScratch(dir)
  }
})

// ─── 9. 边界:跨 BIG_CHANGE_DIR_GATE 个目录 + FILE_GATE 文件(不 >)→ exit 0 ─
test(`边界: 跨 ${BIG_CHANGE_DIR_GATE} 个目录 + ${FILE_GATE} 文件(= ${FILE_GATE}, not > ${FILE_GATE})→ exit 0(未触发)`, () => {
  const dir = createTempRepo()
  try {
    const files = stagedFace(BIG_CHANGE_DIR_GATE, FILE_GATE)
    assert.equal(judgePollution(files).fileCount, FILE_GATE, '夹具文件数由门体判定')
    assert.equal(judgePollution(files).shouldWarn, false, '门体自判:=阈值不触发')
    stageFiles(dir, files)
    const r = runScript({ cwd: dir })
    assert.equal(r.status, 0)
    const out = stripAnsi(r.stdout)
    assert.match(out, /未触发/)
    assert.ok(!out.includes('warn-only'), `= ${FILE_GATE} 不应触发(需 > ${FILE_GATE})`)
  } finally {
    rmScratch(dir)
  }
})

// ─── 10. 边界:文件够多但组数不够(BIG_CHANGE_DIR_GATE-1)→ exit 0 ────────
test(`边界: 跨 ${BIG_CHANGE_DIR_GATE - 1} 个目录 + ${FILE_GATE + 5} 文件(组数 < ${BIG_CHANGE_DIR_GATE})→ exit 0(未触发)`, () => {
  const dir = createTempRepo()
  try {
    const files = stagedFace(BIG_CHANGE_DIR_GATE - 1, FILE_GATE + 5)
    assert.equal(judgePollution(files).uniqueGroups, BIG_CHANGE_DIR_GATE - 1, '夹具组数由门体判定')
    assert.equal(judgePollution(files).shouldWarn, false, '门体自判:组数不够不触发')
    stageFiles(dir, files)
    const r = runScript({ cwd: dir })
    assert.equal(r.status, 0)
    const out = stripAnsi(r.stdout)
    assert.match(out, /未触发/)
    assert.ok(!out.includes('warn-only'), `组数 < ${BIG_CHANGE_DIR_GATE} 不应触发第二条`)
  } finally {
    rmScratch(dir)
  }
})

// ─── 11. 单目录大改(单 agent 重构)→ exit 0(未触发) ───────────────────
test(`单目录 + ${FILE_GATE + 5} 文件(单 agent 大改)→ exit 0(未触发)`, () => {
  const dir = createTempRepo()
  try {
    const files = stagedFace(1, FILE_GATE + 5)
    assert.equal(judgePollution(files).uniqueGroups, 1, '夹具须确为单组')
    assert.equal(judgePollution(files).shouldWarn, false, '门体自判:单组不触发')
    stageFiles(dir, files)
    const r = runScript({ cwd: dir })
    assert.equal(r.status, 0)
    const out = stripAnsi(r.stdout)
    assert.match(out, /未触发/)
    assert.ok(!out.includes('warn-only'))
  } finally {
    rmScratch(dir)
  }
})

// ─── 11b. 预览折叠:每组只展示 PREVIEW_LIMIT 个,余量折叠行数由常量推 ────
test('预览折叠:超出 PREVIEW_LIMIT 的文件按门体常量折叠为「还有 N 个」', () => {
  const dir = createTempRepo()
  try {
    const files = stagedFace(BIG_CHANGE_DIR_GATE, FILE_GATE + 1)
    const counts = [...groupStagedByTopDir(files).values()].map((a) => a.length)
    const folded = counts.filter((c) => c > PREVIEW_LIMIT).map((c) => c - PREVIEW_LIMIT)
    assert.ok(folded.length > 0, `夹具须至少有一组超过 ${PREVIEW_LIMIT} 个,否则本例无牙`)
    stageFiles(dir, files)
    const r = runScript({ cwd: dir })
    assert.equal(r.status, 1)
    const out = stripAnsi(r.stdout)
    for (const n of folded) {
      assert.ok(out.includes(`... 还有 ${n} 个`), `应打印折叠行「还有 ${n} 个」,实际:\n${out}`)
    }
  } finally {
    rmScratch(dir)
  }
})

// ─── 12. 违规:真实跨端形态(apps/web + apps/api + packages/ui + scripts)────
test('违规: 混合 apps/web + apps/api + packages/ui + scripts → 触发预警并逐组报出', () => {
  const dir = createTempRepo()
  try {
    const files = ['apps/web/a.ts', 'apps/api/b.ts', 'packages/ui/c.tsx', 'scripts/d.mjs']
    // 组数/是否触发都由门体判,测试只负责钉住"这副真实形态确实该报"
    const verdict = judgePollution(files)
    assert.equal(verdict.uniqueGroups, DIR_GATE, `夹具须恰为硬门槛组数,门体判出 ${verdict.uniqueGroups}`)
    assert.equal(verdict.shouldWarn, true, '门体自判:此面应触发')
    stageFiles(dir, files)
    const r = runScript({ cwd: dir })
    assert.equal(r.status, 1, 'warn-only 违规应 exit 1')
    const out = stripAnsi(r.stdout)
    assert.match(out, /Staged 污染预警/)
    assert.match(out, /warn-only/)
    assert.ok(out.includes(`跨 ${DIR_GATE} 个一级子目录`), '读数组数须与常量同源')
    // 验证分组正确:每组按门体 getTopGroup 的键逐条出现在读数里
    for (const key of groupStagedByTopDir(files).keys()) {
      assert.ok(out.includes(key), `分布里应列出分组「${key}」`)
    }
  } finally {
    rmScratch(dir)
  }
})

// ─── 13. 边界:全 .md 文件跨 docs + 根目录(文档任务)→ exit 0(未触发) ──
test('边界: 全 .md 文件(docs/ 2 篇 + README.md)→ exit 0(未触发)', () => {
  const dir = createTempRepo()
  try {
    const files = ['docs/guide.md', 'docs/api.md', 'README.md']
    const verdict = judgePollution(files)
    assert.ok(verdict.uniqueGroups < DIR_GATE, `夹具须低于硬门槛,门体判出 ${verdict.uniqueGroups} 组`)
    assert.equal(verdict.shouldWarn, false, '门体自判:文档小改不应触发')
    stageFiles(dir, files)
    const r = runScript({ cwd: dir })
    assert.equal(r.status, 0)
    const out = stripAnsi(r.stdout)
    assert.match(out, /未触发/)
    assert.ok(!out.includes('warn-only'))
  } finally {
    rmScratch(dir)
  }
})

// ─── 14. 根目录文件分组:README.md(modified)+ LICENSE(added)→ exit 0 ─
test('根目录文件: README.md(modified) + LICENSE(added)→ exit 0(未触发)', () => {
  const dir = createTempRepo()
  try {
    // README.md 已在初始 commit,修改使其 staged(Modified 走 diff-filter=M)
    writeFileSync(join(dir, 'README.md'), '# updated\n')
    writeFileSync(join(dir, 'LICENSE'), 'MIT\n')
    execSync('git add README.md LICENSE', { cwd: dir, /* 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY */ stdio: 'ignore' })
    const verdict = judgePollution(['README.md', 'LICENSE'])
    assert.ok(verdict.uniqueGroups < DIR_GATE, `根目录夹具须低于硬门槛,门体判出 ${verdict.uniqueGroups} 组`)
    const r = runScript({ cwd: dir })
    assert.equal(r.status, 0)
    const out = stripAnsi(r.stdout)
    assert.match(out, /未触发/)
    assert.ok(!out.includes('warn-only'))
  } finally {
    rmScratch(dir)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
