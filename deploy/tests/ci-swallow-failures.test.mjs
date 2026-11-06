// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 四处"真吞错"夹具(B 票 4)。用例直接抽取 workflow 里对应 step 的 `run:` 块,
 * 在临时目录用 `bash -e`(GitHub Actions 默认 shell 口径)执行 —— 测的是真 YAML 里的
 * 真脚本,不是复刻。
 *
 *   T1 release-cli.yml「Verify binary」:坏二进制(--version 非零)必须让 step 红,
 *      修前 `|| true` 会带着坏产物继续走 Release 上传;
 *   T2 style-spec.yml「跑高特异性选择器检测」:扫描根双双缺失时 grep rc=2 必须红,
 *      修前 `2>/dev/null || true` 把"读不到"吞成"零命中";
 *   T3 smoke-new-modules.yml「Detect new modules」:BASE 为空/不可达必须红,
 *      修前 `|| true` 把 git diff 失败吞成 COUNT=0,后续检查全被跳过;
 *   T4 loop-daily-triage.yml「commit & push (仅 *.md)」:回写目标缺失时 git add 失败
 *      必须点名真因。修前 `2>/dev/null || true` 把失败吞掉,日志里只剩一句误导性的
 *      「git commit 非零且不是『无变更』」,文件缺失这个真正原因完全消失。
 * 每个用例都带正控,证明修正没有把正常路径堵死。
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs'
import { spawn, spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..')
const WF = join(REPO, '.github', 'workflows')

function findBash() {
  const cands = [
    process.env.BASH_PATH,
    'C:/Program Files/Git/bin/bash.exe',
    'C:/Program Files/Git/usr/bin/bash.exe',
    '/bin/bash',
    '/usr/bin/bash',
  ].filter(Boolean)
  for (const c of cands) if (existsSync(c)) return c
  return null
}

/** 从 workflow 抽取指定 step 的 run 块,并按 YAML 缩进还原脚本文本。 */
function extractRun(file, stepName) {
  const lines = readFileSync(join(WF, file), 'utf8').split(/\r?\n/)
  const start = lines.findIndex((l) => l.trim() === `- name: ${stepName}`)
  assert.ok(start >= 0, `在 ${file} 里找不到 step「${stepName}」`)
  let runIdx = -1
  for (let i = start + 1; i < lines.length; i++) {
    if (/^\s*run:\s*\|\s*$/.test(lines[i])) {
      runIdx = i
      break
    }
    if (/^\s*- name:/.test(lines[i])) break
  }
  assert.ok(runIdx >= 0, `step「${stepName}」没有 run: | 块`)
  const runIndent = lines[runIdx].match(/^[ ]*/)[0].length
  const body = []
  for (let i = runIdx + 1; i < lines.length; i++) {
    const l = lines[i]
    if (l.trim() === '') {
      body.push('')
      continue
    }
    const ind = l.match(/^[ ]*/)[0].length
    if (ind <= runIndent) break
    body.push(l.slice(runIndent + 2))
  }
  return body.join('\n').replace(/\n+$/, '')
}

/**
 * 按 GitHub Actions 的口径执行:`bash -e <临时脚本文件>`。
 * 不能把脚本正文塞进 argv(Windows 会报 "File name too long")。
 */
function runBash(bash, script, cwd, env = {}, timeoutMs = 60_000) {
  // 脚本文件放仓库外:若落在被测 git 仓库里会变成未跟踪文件,把 git commit 的
  // "nothing to commit, working tree clean" 改成 "untracked files present",
  // 夹具就会歪打正着地让修前实现也退货,掩盖真正的吞错。
  const scriptFile = join(tmpdir(), `ihui-fixture-step-${Math.random().toString(36).slice(2)}.sh`)
  writeFileSync(scriptFile, `${script}\n`, 'utf8')
  return new Promise((done) => {
    const child = spawn(bash, ['-e', scriptFile], {
      cwd,
      env: { ...process.env, ...env },
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let out = ''
    child.stdout.on('data', (d) => (out += d))
    child.stderr.on('data', (d) => (out += d))
    let timedOut = false
    const timer = setTimeout(() => {
      timedOut = true
      child.kill()
    }, timeoutMs)
    child.on('close', (status, signal) => {
      clearTimeout(timer)
      rmSync(scriptFile, { force: true })
      done({ status, signal, timedOut, out })
    })
  })
}

function git(cwd, ...args) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', windowsHide: true })
  assert.equal(r.status, 0, `git ${args.join(' ')} 失败:${r.stderr}`)
  return r.stdout.trim()
}

const SKIP = '未判定:取不到 bash ⇒ 机器态未判定(§0.3)'

test('T1 release-cli「Verify binary」:坏二进制必须让 step 红', async (t) => {
  const bash = findBash()
  if (!bash) return t.skip(SKIP)
  const dir = mkdtempSync(join(tmpdir(), 'ihui-b4-release-'))
  try {
    const body = extractRun('release-cli.yml', 'Verify binary').replace(/\${{ matrix\.os }}/g, 'linux')
    const binDir = join(dir, 'apps', 'cli', 'dist-sea')
    mkdirSync(binDir, { recursive: true })

    writeFileSync(join(binDir, 'ihui'), '#!/bin/sh\nexit 1\n', 'utf8')
    const bad = await runBash(bash, body, dir)
    assert.notEqual(bad.status, 0, `坏二进制 --version 非零仍被判绿(修前 || true):\n${bad.out}`)

    writeFileSync(join(binDir, 'ihui'), '#!/bin/sh\necho v1.2.3\nexit 0\n', 'utf8')
    const good = await runBash(bash, body, dir)
    assert.equal(good.status, 0, `好二进制被误杀:\n${good.out}`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('T2 style-spec「高特异性检测」:扫描根双双缺失必须红', async (t) => {
  const bash = findBash()
  if (!bash) return t.skip(SKIP)
  const dir = mkdtempSync(join(tmpdir(), 'ihui-b4-style-'))
  try {
    const body = extractRun('style-spec.yml', '跑高特异性选择器检测')
    const env = { HIGH_SPECIFICITY_THRESHOLD: '4' }

    const missing = await runBash(bash, body, dir, env)
    assert.equal(missing.status, 1, `扫描根缺失时 grep rc=2 被吞成零命中(修前绿):\n${missing.out}`)
    assert.match(missing.out, /高特异性检测根不存在/, `红线没有点明扫描根缺失:\n${missing.out}`)

    mkdirSync(join(dir, 'apps', 'web', 'src'), { recursive: true })
    writeFileSync(join(dir, 'apps', 'web', 'src', 'a.css'), '.a { color: red; }\n', 'utf8')
    const clean = await runBash(bash, body, dir, env)
    assert.equal(clean.status, 0, `无命中被误判为红:\n${clean.out}`)

    writeFileSync(join(dir, 'apps', 'web', 'src', 'b.css'), '.a .b .c .d { color: red; }\n', 'utf8')
    const hit = await runBash(bash, body, dir, env)
    assert.equal(hit.status, 1, `高特异性命中被漏掉:\n${hit.out}`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('T3 smoke-new-modules「Detect new modules」:BASE 为空必须红', async (t) => {
  const bash = findBash()
  if (!bash) return t.skip(SKIP)
  const dir = mkdtempSync(join(tmpdir(), 'ihui-b4-smoke-'))
  try {
    git(dir, 'init', '-q')
    git(dir, 'config', 'user.email', 'fixture@example.com')
    git(dir, 'config', 'user.name', 'fixture')
    writeFileSync(join(dir, 'README.md'), '# fixture\n', 'utf8')
    git(dir, 'add', '.')
    git(dir, 'commit', '-q', '-m', 'base')
    const base = git(dir, 'rev-parse', 'HEAD')

    const body = extractRun('smoke-new-modules.yml', 'Detect new modules').replace(
      '${{ github.event.pull_request.base.sha || github.event.before }}',
      '${FIXTURE_BASE:-}',
    )
    const outFile = join(dir, 'gh-output.txt')

    const empty = await runBash(bash, body, dir, { GITHUB_OUTPUT: outFile, FIXTURE_BASE: '' })
    assert.equal(empty.status, 1, `BASE 为空时 git diff 失败被吞成 count=0(修前绿):\n${empty.out}`)
    assert.match(empty.out, /BASE 为空/, `红线没有点明 BASE 为空:\n${empty.out}`)

    // 不可达 BASE:git cat-file 失败同样必须红,不能只挡住空串
    const bogus = await runBash(bash, body, dir, { GITHUB_OUTPUT: outFile, FIXTURE_BASE: 'deadbeefdeadbeef' })
    assert.equal(bogus.status, 1, `不可达 BASE 被吞:\n${bogus.out}`)

    mkdirSync(join(dir, 'apps', 'api', 'src', 'routes'), { recursive: true })
    writeFileSync(join(dir, 'apps', 'api', 'src', 'routes', 'new.ts'), 'export const x = 1\n', 'utf8')
    git(dir, 'add', '.')
    git(dir, 'commit', '-q', '-m', 'new module')
    writeFileSync(outFile, '', 'utf8')
    const ok = await runBash(bash, body, dir, { GITHUB_OUTPUT: outFile, FIXTURE_BASE: base })
    assert.equal(ok.status, 0, `有新增模块时被误杀:\n${ok.out}`)
    assert.match(readFileSync(outFile, 'utf8'), /count=1/, '正控没有识别到新增模块')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('T4 loop-daily-triage「commit & push」:回写目标缺失必须红,不许冒充无变更', async (t) => {
  const bash = findBash()
  if (!bash) return t.skip(SKIP)
  const dir = mkdtempSync(join(tmpdir(), 'ihui-b4-loop-'))
  try {
    git(dir, 'init', '-q', '-b', 'main')
    git(dir, 'config', 'user.email', 'fixture@example.com')
    git(dir, 'config', 'user.name', 'fixture')
    writeFileSync(join(dir, 'README.md'), '# fixture\n', 'utf8')
    mkdirSync(join(dir, '.loop-tmp'), { recursive: true })
    writeFileSync(join(dir, '.loop-tmp', 'verdict.status'), 'ok\n', 'utf8')
    git(dir, 'add', '.')
    git(dir, 'commit', '-q', '-m', 'base')

    // 本地 bare 远端:正控要真的能把本轮回写推上去
    const remote = join(dir, '..', `${dir.split(/[\\/]/).pop()}-remote.git`)
    const r = spawnSync('git', ['init', '-q', '--bare', remote], { windowsHide: true })
    assert.equal(r.status, 0, `建 bare 远端失败:${r.stderr}`)
    git(dir, 'remote', 'add', 'origin', remote)
    git(dir, 'push', '-q', '-u', 'origin', 'main')

    const body = extractRun('loop-daily-triage.yml', 'commit & push (仅 *.md)')
    // 同样放在仓库外:未跟踪文件会改变 git commit 的措辞,影响"无变更"分支判定
    const summary = join(tmpdir(), `ihui-loop-summary-${Math.random().toString(36).slice(2)}.txt`)

    // 缺 STATE.md 与 loop-run-log.md:修前 git add 静默失败,真正原因被吞,
    // 只剩 commit 的"非零且不是无变更"这句误导性结论
    rmSync(join(dir, '.github'), { recursive: true, force: true })
    writeFileSync(summary, '', 'utf8')
    const missing = await runBash(bash, body, dir, { GITHUB_STEP_SUMMARY: summary })
    assert.equal(missing.status, 1, `回写目标缺失时应 exit 1:\n${missing.out}`)
    assert.match(missing.out, /loop 回写目标缺失/, `红线没有点明缺失文件:\n${missing.out}`)
    assert.doesNotMatch(readFileSync(summary, 'utf8'), /本轮无内容变更/, '还是把失败冒充成"无变更"')

    // 正控:两个文件都在且确有改动 → 生成提交并推送成功
    mkdirSync(join(dir, '.github', 'loop-runtime'), { recursive: true })
    writeFileSync(join(dir, '.github', 'loop-runtime', 'STATE.md'), '# STATE changed\n', 'utf8')
    writeFileSync(join(dir, '.github', 'loop-runtime', 'loop-run-log.md'), '# log changed\n', 'utf8')
    git(dir, 'add', '.github/loop-runtime')
    const ok = await runBash(bash, body, dir, { GITHUB_STEP_SUMMARY: summary })
    assert.equal(ok.status, 0, `正常回写被误杀:\n${ok.out}`)
    assert.match(readFileSync(summary, 'utf8'), /推送成功/, `正控没有推送成功:\n${readFileSync(summary, 'utf8')}`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
    const remote = join(dir, '..', `${dir.split(/[\\/]/).pop()}-remote.git`)
    rmSync(remote, { recursive: true, force: true })
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
