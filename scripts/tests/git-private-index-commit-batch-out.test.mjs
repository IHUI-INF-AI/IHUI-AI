// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// DBG-98:私有索引提交脚本的守门批输出不得再用共享固定文件。
// 本测试只抽赋值与清理函数在 Git Bash 里跑,不执行脚本本体,因此不会真的提交。
// 跑法:node --test scripts/tests/git-private-index-commit-batch-out.test.mjs
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { test } from 'node:test'

const ROOT = resolve(import.meta.dirname, '..', '..')
const SH = join(ROOT, 'scripts', 'git-private-index-commit.sh')

const shCodeOf = (text) =>
  text
    .split(/\r?\n/)
    .filter((line) => !/^\s*#/.test(line))
    .join('\n')

const SRC = readFileSync(SH, 'utf8')
const CODE = shCodeOf(SRC)

function gitBash() {
  const list = []
  if (process.env.GIT_BASH) list.push(process.env.GIT_BASH)
  if (process.env.ProgramFiles) list.push(join(process.env.ProgramFiles, 'Git', 'bin', 'bash.exe'))
  if (process.env['ProgramFiles(x86)']) {
    list.push(join(process.env['ProgramFiles(x86)'], 'Git', 'bin', 'bash.exe'))
  }
  return list.find((p) => existsSync(p)) ?? null
}

function piece(re, label) {
  const found = CODE.match(re)
  assert.ok(found, label)
  return found[0]
}

test('可执行代码不再把守门批写进共享固定路径', () => {
  assert.equal(SRC.includes('/tmp/batch.out'), false)
  assert.equal(CODE.includes('/tmp/batch.out'), false)
  assert.match(CODE, /node scripts\/guardian-runner\.mjs --staged > "\$BATCH_OUT"/)
  assert.doesNotMatch(CODE, /os\.tmpdir/)
})

test('批次输出路径含本进程 pid,且在任何 exit 之前就挂上删除', () => {
  const assign = piece(/^BATCH_OUT=.*$/m, '缺少 BATCH_OUT 赋值')
  assert.match(assign, /\$\$/)
  assert.match(assign, /\/tmp\/ihui-git-priv-commit\./)
  const fn = piece(/cleanup_batch_out\(\) \{[\s\S]*?\n\}/, '缺少 cleanup_batch_out')
  assert.match(fn, /rm -f -- "\$BATCH_OUT"/)
  const trapAt = CODE.indexOf("trap 'cleanup_batch_out; backup_last_orphan' EXIT")
  const assignAt = CODE.indexOf('BATCH_OUT=$')
  assert.ok(trapAt >= 0 && assignAt > trapAt, '删除陷阱必须先于批次文件创建')
})

function runIsolated(bash, body) {
  return new Promise((done, reject) => {
    const child = spawn(bash, ['-c', body], {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    let out = ''
    let err = ''
    child.stdout.on('data', (chunk) => {
      out += chunk
    })
    child.stderr.on('data', (chunk) => {
      err += chunk
    })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code !== 0) reject(new Error(`bash exit ${code}: ${err || out}`))
      else done(out)
    })
  })
}

test('两次并发各用含 pid 的仓外文件,读完即删,且不落在仓库树内', async () => {
  const bash = gitBash()
  assert.ok(bash, '找不到 Git Bash,无法实测临时文件')
  const fn = piece(/cleanup_batch_out\(\) \{[\s\S]*?\n\}/, '缺少 cleanup_batch_out')
  const assign = piece(/^BATCH_OUT=.*$/m, '缺少 BATCH_OUT 赋值')
  const body = [
    'set -uo pipefail',
    fn,
    "trap 'cleanup_batch_out' EXIT",
    'cleanup_batch_out',
    assign,
    'pid=$$',
    'path="$BATCH_OUT"',
    'case "$path" in',
    '  /tmp/ihui-git-priv-commit."$pid".*) ;;',
    '  *) echo "BADPATH $path"; exit 1 ;;',
    'esac',
    'test -f "$path"',
    'win=$(cygpath -w "$path")',
    'cleanup_batch_out',
    'if [ -e "$path" ]; then echo STILL; exit 1; fi',
    'printf "%s\\n" "$pid"',
    'printf "%s\\n" "$path"',
    'printf "%s\\n" "$win"',
  ].join('\n')
  const [outA, outB] = await Promise.all([runIsolated(bash, body), runIsolated(bash, body)])
  const parse = (out) => out.trim().split(/\r?\n/)
  const [pidA, pathA, winA] = parse(outA)
  const [pidB, pathB, winB] = parse(outB)
  assert.notEqual(pathA, pathB)
  assert.notEqual(pidA, pidB)
  assert.match(pathA, new RegExp(`/tmp/ihui-git-priv-commit\\.${pidA}\\.`))
  assert.match(pathB, new RegExp(`/tmp/ihui-git-priv-commit\\.${pidB}\\.`))
  const repoWin = ROOT.replace(/\//g, '\\').toLowerCase()
  for (const win of [winA, winB]) {
    const norm = win.replace(/\//g, '\\').toLowerCase()
    assert.equal(norm.startsWith(repoWin), false, win)
    assert.equal(/\\ihui-ai\\/i.test(norm), false, win)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
