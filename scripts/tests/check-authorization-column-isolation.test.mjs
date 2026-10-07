// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 守门 188(check-authorization-column-isolation.mjs)的镜像测试 —— §22c 同型。
 *
 * 为什么不测判据本体:判据的对错由它自己的 `--self-test`(39 例,正反成对)与
 * `apps/ai-service/tests/` 侧的实测核验负责。这里只钉**门有没有把判据真的装上**,
 * 以及装上后**有没有牙** —— 三种"一路报绿"的失明各自单钉一列:
 *   ① 注册块缺失(脚本存在但无人调度);
 *   ② 判据被抄成第二份(本门必须只认自己那份`scanFile`,不得出现第二份列名黑名单);
 * ③ 取材回磁盘(共享工作树脏时结论漂移)⇒ 用夹具仓端到端跑 HEAD 面口径。
 *
 * 端到端夹具刻意复刻本会话的**真实踩坑**:守门首版对 25 处判红,其中 24 处是误报,
 * 根因是"WHERE 里有 user_id"被当成"在做授权判决"。F1/F2 两条就是那份教训的钉子。
 */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { copyScriptWithClosure } from '../lib/scratch-module-closure.mjs'
import { resolveGitBin } from '../lib/gitdir.mjs'

const GATE_REL = 'check-authorization-column-isolation.mjs'
const HERE = dirname(fileURLToPath(import.meta.url))
const SCRIPTS_DIR = resolve(HERE, '..')
const REPO = resolve(SCRIPTS_DIR, '..')
const RUNNER = join(SCRIPTS_DIR, 'guardian-runner.mjs')
const SRC = join(SCRIPTS_DIR, GATE_REL)
const GIT = resolveGitBin() || 'git'

/** 授权判据查询 + 存在性判决分支 + 展示列 ⇒ 必须判红。 */
const BAD_VERDICT = [
  'from fastapi import APIRouter, HTTPException',
  '',
  'router = APIRouter()',
  '',
  '@router.get("/a/{account_id}")',
  'async def read(account_id: int, user_id: str):',
  '    row = await conn.fetchrow(',
  '        "SELECT platform, display_name FROM publish_accounts WHERE id=$1 AND user_id=$2",',
  '        account_id, user_id,',
  '    )',
  '    if not row:',
  '        raise HTTPException(status_code=404, detail="账号不存在")',
  '    return row["platform"]',
  '',
].join('\n')

/** 同一形态但**没有判决分支** ⇒ 租户范围过滤,不得判红(首版 25 处里 11 处栽在这里)。 */
const LIST_NO_VERDICT = [
  'from fastapi import APIRouter',
  '',
  'router = APIRouter()',
  '',
  '@router.get("/a")',
  'async def list_all(user_id: str):',
  '    rows = await conn.fetch(',
  '        "SELECT id, title FROM memories WHERE user_id=$1",',
  '        user_id,',
  '    )',
  '    return {"items": [{"title": r["title"]} for r in rows]}',
  '',
].join('\n')

/** 正面:授权判据只取授权列(sso_identity_store 的真实形态)。 */
const NARROW_OK = [
  'from fastapi import APIRouter',
  '',
  'router = APIRouter()',
  '',
  '@router.get("/ident")',
  'async def ident(provider: str, subject: str):',
  '    row = await conn.fetchrow(',
  '        "SELECT id, user_uuid FROM sso_identities WHERE provider=$1 AND subject=$2",',
  '        provider, subject,',
  '    )',
  '    if not row:',
  '        return None',
  '    return row["user_uuid"]',
  '',
].join('\n')

/** 展示列同时是 WHERE 里的检索判据 ⇒ 豁免(memory_graph / metacognition 的真实形态)。 */
const WHERE_CLAUSE_EXEMPT = [
  'from fastapi import APIRouter',
  '',
  'router = APIRouter()',
  '',
  '@router.get("/search")',
  'async def search(user_id: str, kw: str):',
  '    rows = await conn.fetch(',
  '        "SELECT id, content FROM agent_memory_semantic WHERE user_id=$1 AND content ILIKE $2",',
  '        user_id, kw,',
  '    )',
  '    if not rows:',
  '        return []',
  '    return rows',
  '',
].join('\n')

function sh(cmd, args, cwd) {
  // `-c safe.directory=*` 与 `-c core.autocrlf=false` 是必需的:夹具仓在系统临时目录,
  // 而本机 git 走 PortableGit,不带这两个参数时 `init/add` 会因 ownership 校验失败,
  // 而 execFileSync 抛出后 sh 的调用点全在测试函数里,错误被截断成"断言失败"——
  // 实测:少这两个参数时 F1~F5 五条端到端用例全部表现为一律 RC=1(2026-10-03)。
  return execFileSync(cmd, ['-c', 'safe.directory=*', '-c', 'core.autocrlf=false', ...args], {
    cwd,
    encoding: 'utf8',
    windowsHide: true,
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    // （返回的 stdout 要被调用方吃，故 stdout 仍留 pipe；只把 stdin 断开）
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

/** 建一个夹具仓:按 **import 闭包**把判据及其依赖整体搬过去,再放待审文件。 */
function makeFixture(files) {
  const dir = mkScratch('authz-col-iso-test-')
  mkdirSync(join(dir, 'scripts'), { recursive: true })
  // 闭包拷贝而非"只搬 scripts/lib/":face-reader→lib/gitdir→scripts/seal-c-root-stray
  // 是一跳以上的依赖链,少拷一跳就是 ERR_MODULE_NOT_FOUND(2026-10-03 实测踩到)。
  copyScriptWithClosure(SCRIPTS_DIR, GATE_REL, join(dir, 'scripts'), [
    'lib/face-reader.mjs',
    'lib/gitdir.mjs',
    'seal-c-root-stray.mjs',
  ])
  for (const [rel, content] of Object.entries(files)) {
    const abs = join(dir, ...rel.split('/'))
    mkdirSync(dirname(abs), { recursive: true })
    writeFileSync(abs, content, 'utf8')
  }
  sh(GIT, ['init', '-q', '.'], dir)
  sh(GIT, ['add', '-A', '--'], dir)
  sh(GIT, ['-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '-m', 'fixture'], dir)
  return dir
}

/** F9 用:先落一个含死展示列的 HEAD,故夹具骨架与 makeFixture 相同但不提交。 */
function makeBareFixture() {
  const dir = mkScratch('authz-col-iso-heal-')
  mkdirSync(join(dir, 'scripts'), { recursive: true })
  copyScriptWithClosure(SCRIPTS_DIR, GATE_REL, join(dir, 'scripts'), [
    'lib/face-reader.mjs',
    'lib/gitdir.mjs',
    'seal-c-root-stray.mjs',
  ])
  return dir
}

function runGate(dir, extra = []) {
  try {
    const out = execFileSync(process.execPath, [join(dir, 'scripts', GATE_REL), ...extra], {
      cwd: dir,
      encoding: 'utf8',
      windowsHide: true,
      // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
      // （out 要被 return 出去，故 stdout 仍留 pipe；只把 stdin 断开）
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    return { rc: 0, out }
  } catch (e) {
    return { rc: e.status ?? -1, out: String(e.stdout ?? ''), err: String(e.stderr ?? '') }
  }
}

const SCAN_REL = 'apps/ai-service/app/services/publish/account_groups.py'

// ---------------------------------------------------------------------------
test('T1 注册块存在:门188 在 guardian-runner 里有条目且指向本脚本', () => {
  const runner = readFileSync(RUNNER, 'utf8')
  assert.ok(runner.includes(GATE_REL), `guardian-runner.mjs 未引用 ${GATE_REL}`)
  assert.match(runner, /id:\s*'188'/, '未找到 id 188 注册条目')
})

test('T2 注册块与脚本同面:标签/触发目录/跳过开关齐备', () => {
  const runner = readFileSync(RUNNER, 'utf8')
  const idx = runner.indexOf(`id: '188'`)
  assert.ok(idx > 0, '未找到 id 188')
  const block = runner.slice(idx, idx + 1200)
  assert.ok(block.includes(GATE_REL), '注册条目未指向本脚本')
  assert.ok(block.includes('HUSKY_SKIP_AUTHZ_COLUMN_ISOLATION'), '注册条目缺跳过开关')
  assert.ok(block.includes('apps/ai-service/'), '注册条目缺 stagedTriggers')
})

test('T3 反向锁:判据只有一份 —— 脚本内不得出现第二份展示列黑名单', () => {
  const src = readFileSync(SRC, 'utf8')
  const decls = src.match(/const\s+DISPLAY_COLUMNS\s*=/g) ?? []
  assert.equal(decls.length, 1, `DISPLAY_COLUMNS 声明了 ${decls.length} 份,判据必须单份`)
  const scannerDecls = src.match(/function\s+scanFile\b/g) ?? []
  assert.equal(scannerDecls.length, 1, 'scanFile 必须单份(两处算同一件事必漂移)')
})

test('T4 自检 39 例全绿(判据自身正反成对)', () => {
  const r = runGate(REPO, ['--self-test'])
  assert.equal(r.rc, 0, `自检未过:\n${r.out}\n${r.err ?? ''}`)
  assert.match(r.out, /pass \d+ \/ fail 0/)
})

test('F1 端到端:授权判据查询带展示列 ⇒ HEAD 面判红', () => {
  const dir = makeFixture({ [SCAN_REL]: BAD_VERDICT })
  try {
    const r = runGate(dir, [])
    assert.equal(r.rc, 1, `应判红却没红:\n${r.out}`)
    assert.match(r.out, /display_name/, '判红未点名展示列')
  } finally {
    rmScratch(dir)
  }
})

test('F2 端到端:同一形态但无判决分支 ⇒ 不得判红(首版 25 处误报的教训)', () => {
  const dir = makeFixture({ [SCAN_REL]: LIST_NO_VERDICT })
  try {
    const r = runGate(dir, [])
    assert.equal(r.rc, 0, `无判决分支的列表查询被判红(误报):\n${r.out}`)
    assert.match(r.out, /结论:通过/)
  } finally {
    rmScratch(dir)
  }
})

test('F3 端到端:窄查询(只取授权列)⇒ 通过', () => {
  const dir = makeFixture({ [SCAN_REL]: NARROW_OK })
  try {
    const r = runGate(dir, [])
    assert.equal(r.rc, 0, `窄查询被误判:\n${r.out}`)
  } finally {
    rmScratch(dir)
  }
})

test('F4 端到端:展示列同在WHERE 里(检索判据)⇒ 豁免通过', () => {
  const dir = makeFixture({ [SCAN_REL]: WHERE_CLAUSE_EXEMPT })
  try {
    const r = runGate(dir, [])
    assert.equal(r.rc, 0, `WHERE 判据列未豁免:\n${r.out}`)
    assert.match(r.out, /WHERE 判据列豁免 1 处/)
  } finally {
    rmScratch(dir)
  }
})

test('F5 取材面:磁盘改脏而 HEAD 未改 ⇒ 结论仍按 HEAD(不随工作树漂移)', () => {
  const dir = makeFixture({ [SCAN_REL]: NARROW_OK })
  try {
    const before = runGate(dir, [])
    assert.equal(before.rc, 0)
    // 把工作树改成判红形态,HEAD 面结论必须不变
    writeFileSync(join(dir, ...SCAN_REL.split('/')), BAD_VERDICT, 'utf8')
    const after = runGate(dir, [])
    assert.equal(after.rc, 0, `结论随磁盘漂移了(HEAD 面口径失效):\n${after.out}`)
  } finally {
    rmScratch(dir)
  }
})

test('F6 失明即判死:射程内枚举 0 个候选 ⇒ exit 2,不得静默通过', () => {
  const dir = makeFixture({ 'README.md': '# 空仓\n' })
  try {
    const r = runGate(dir, [])
    assert.equal(r.rc, 2, `枚举 0 候选未判死:\n${r.out}`)
    assert.match(r.out, /枚举 0 个候选文件/)
  } finally {
    rmScratch(dir)
  }
})

test('F7 面旗矛盾(--staged --worktree 同给)⇒ exit 2', () => {
  const dir = makeFixture({ [SCAN_REL]: NARROW_OK })
  try {
    const r = runGate(dir, ['--staged', '--worktree'])
    assert.equal(r.rc, 2, `面旗矛盾未判死:\n${r.out}`)
  } finally {
    rmScratch(dir)
  }
})

test('F8 应急跳过开关生效,且跳过时不冒充合格证', () => {
  const dir = makeFixture({ [SCAN_REL]: BAD_VERDICT })
  try {
    const out = execFileSync(process.execPath, [join(dir, 'scripts', GATE_REL)], {
      cwd: dir,
      encoding: 'utf8',
      windowsHide: true,
      // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
      // （out 要被下面的 assert.match 吃，故 stdout 仍留 pipe；只把 stdin 断开）
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, HUSKY_SKIP_AUTHZ_COLUMN_ISOLATION: '1' },
    })
    assert.match(out, /HUSKY_SKIP_AUTHZ_COLUMN_ISOLATION=1 应急跳过/)
    assert.match(out, /未经本判据核验/, '跳过必须点名"未经核验",不得冒充合格证')
  } finally {
    rmScratch(dir)
  }
})

test('F9 真修复必须放行:存量命中因摘掉展示列而消失 ⇒ 不判红', () => {
  // 先造一个含死展示列的 HEAD,再提交一个摘掉它的版本,--staged 档看增量。
  const dir = makeBareFixture()
  try {
    const abs = join(dir, ...SCAN_REL.split('/'))
    mkdirSync(dirname(abs), { recursive: true })
    writeFileSync(abs, BAD_VERDICT, 'utf8')
    sh(GIT, ['init', '-q', '.'], dir)
    sh(GIT, ['add', '-A', '--'], dir)
    sh(GIT, ['-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '-m', 'bad'], dir)
    // 修成窄查询并暂存
    writeFileSync(abs, NARROW_OK, 'utf8')
    sh(GIT, ['add', '-A', '--'], dir)
    const r = runGate(dir, ['--staged'])
    assert.equal(r.rc, 0, `真修复被护栏当成了"删查询消红"而误伤:\n${r.out}\n${r.err ?? ''}`)
    assert.match(r.out, /既有命中消失 1 处:形态为「展示列被摘掉」\(真修复\)—— 放行/)
  } finally {
    rmScratch(dir)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
