// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

//
// hook-run-hidden.vbs 并发日志争用的可复现夹具(第一笔提交的验收尺)。
//
// 实测动因(会话 cc7876c2 登记):多个钩子并发运行时,全部对同一个固定日志做 `cmd >>`
// 追加。cmd.exe 的重定向句柄不共享写 ⇒ 后到者打开失败,整条 node 不启动,钩子"莫名其妙"
// 失败且日志里一个字节都没有。旧规避是"日志静默 >= 20s 再提交",那是规避不是治本。
//
// 本夹具压的是**日志层**:子进程恒 exit 0,所以任何非零 rc 都只能是"写日志失败"。
// 判据(全部成立才算绿):
//   ① 每个 wscript 的 rc 都是 0(钩子自身成败另由第二类夹具负责);
//   ② 每个调用的轮次标记 `==== ... ====` 一行不少;
//   ③ 子进程 stdout 的 N*LINES 行一行不少,且每个 tag 的序号完整(不丢行、不截断);
//   ④ 子进程 stderr 的 N 行一行不少。
//
// 跑法:`node --test scripts/tests/hook-log-concurrency.test.mjs`
// 并发度/行长可用环境变量抬高(默认 16 / 60 行 / 每次 300ms 忙等窗口)。
import { spawn } from 'node:child_process'
import assert from 'node:assert/strict'
import { existsSync, readFileSync, rmSync, rmdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const VBS = join(ROOT, 'scripts', 'hook-run-hidden.vbs')
const CHILD_REL = 'scripts/tests/fixtures/hook-log-race-child.mjs'
const LOG_DIR = join(ROOT, '.ihui-agent', 'state', 'hook-logs')

const N = Math.max(8, Number(process.env.IHUI_HOOK_RACE_N || 16))
const LINES = Math.max(10, Number(process.env.IHUI_HOOK_RACE_LINES || 60))
const SLEEP_MS = Math.max(0, Number(process.env.IHUI_HOOK_RACE_SLEEP_MS || 300))

function runHidden(logName, tag, exitCode = 0) {
  return new Promise((done) => {
    const cp = spawn(
      'wscript.exe',
      ['//nologo', VBS, logName, CHILD_REL, tag, String(LINES), String(SLEEP_MS), String(exitCode)],
      { cwd: ROOT, windowsHide: true },
    )
    let out = ''
    let err = ''
    cp.stdout.on('data', (b) => {
      out += String(b)
    })
    cp.stderr.on('data', (b) => {
      err += String(b)
    })
    cp.on('error', (e) => done({ rc: null, out, err: `${err}${e?.message ?? e}`, spawnError: true }))
    cp.on('close', (rc) => done({ rc, out, err }))
  })
}

test(`并发 ${N} 路 wscript 打同一固定日志:rc 全 0、轮次标记/输出行一行不丢`, async () => {
  assert.ok(existsSync(VBS), `缺少 ${VBS}`)
  const logName = `race-${process.pid}-${Date.now()}`
  const logPath = join(LOG_DIR, `${logName}.log`)
  try {
    const tags = Array.from({ length: N }, (_, i) => `t${i}-${process.pid}`)
    const rs = await Promise.all(tags.map((t) => runHidden(logName, t)))

    const failed = rs.filter((r) => r.rc !== 0)
    if (failed.length > 0 && existsSync(logPath)) {
      const t = readFileSync(logPath, 'utf8')
      console.error(
        `[fixture] ${failed.length}/${N} 失败; 日志 ${t.length} B, 轮次标记 ${
          (t.match(/^==== .* ====$/gm) || []).length
        }/${N}, 内容行 ${(t.match(/^RACE /gm) || []).length}/${N * (LINES + 1)}`,
      )
    }
    assert.equal(
      failed.length,
      0,
      `日志层不得让钩子判红:${failed.length}/${N} 路失败;rc=${JSON.stringify(
        failed.map((r) => r.rc),
      )}; stderr=${JSON.stringify(failed.map((r) => r.err.trim()).slice(0, 3))}`,
    )

    assert.ok(existsSync(logPath), `日志文件未生成:${logPath}`)
    const text = readFileSync(logPath, 'utf8')

    const markerCount = (text.match(/^==== .* ====$/gm) || []).length
    assert.equal(markerCount, N, `轮次标记丢了:${markerCount}/${N} 行(日志被截断/覆盖)`)

    const stderrCount = (text.match(/^RACE \S+ stderr$/gm) || []).length
    assert.equal(stderrCount, N, `stderr 行丢了:${stderrCount}/${N}`)

    const trailerCount = (text.match(/^\[hook-run-hidden\] rc=0 log=append$/gm) || []).length
    assert.equal(trailerCount, N, `合并回写不完整:${trailerCount}/${N} 轮未落 canonical`)

    for (const tag of tags) {
      const got = new Set()
      for (const line of text.split(/\r?\n/)) {
        const m = new RegExp(`^RACE ${tag} (\\d+)$`).exec(line)
        if (m) got.add(Number(m[1]))
      }
      assert.equal(got.size, LINES, `tag ${tag} 输出行不完整:${got.size}/${LINES}`)
      for (let i = 0; i < LINES; i += 1) assert.ok(got.has(i), `tag ${tag} 缺行 ${i}`)
    }
  } finally {
    // 夹具自己产生的日志/目录不留在现场(并发失败时也删,避免污染 next run 的读数)。
    rmSync(logPath, { force: true })
    try {
      rmdirSync(join(LOG_DIR, logName))
    } catch {
      // 清理不是断言:目录可能已被别的轮次复用/不存在
    }
  }
})

test('钩子自身失败:rc 原样传播(75=中断可重试),日志层不得改写它', async () => {
  assert.ok(existsSync(VBS), `缺少 ${VBS}`)
  const logName = `race-rc-${process.pid}-${Date.now()}`
  const logPath = join(LOG_DIR, `${logName}.log`)
  try {
    const r = await runHidden(logName, `rc-${process.pid}`, 75)
    assert.equal(r.rc, 75, `钩子 rc 必须原样传播,实际 ${r.rc}`)
    const text = readFileSync(logPath, 'utf8')
    assert.match(text, /^==== .* ====$/m, '轮次标记缺失')
    assert.match(
      text,
      /^\[hook-run-hidden\] rc=75 log=append$/m,
      '日志里必须能分辨出"这是钩子自己的失败",而不是日志层失败',
    )
  } finally {
    rmSync(logPath, { force: true })
    try {
      rmdirSync(join(LOG_DIR, logName))
    } catch {
      // 清理不是断言:目录可能已被别的轮次复用/不存在
    }
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
