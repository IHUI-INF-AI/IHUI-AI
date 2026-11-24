// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { spawnSync } from 'node:child_process'
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { test } from 'node:test'
import assert from 'node:assert/strict'

/**
 * bare-sentinel 注册路径判据(2026-11-05 立)。
 *
 * 病灶:旧脚本把 VBS 写死成 `G:\IHUI-AI\...`,本机仓在 D:;schtasks /create、/run、/query
 * 决定性地全返回 0(实测),计划任务实际空转,脚本末行仍打印 DONE —— 假成功。
 *
 * 两格:
 *   T1 正向 —— 仓内跑 --dry-run:推导出的仓根 = 本仓,启动器存在,exit 0;
 *   T2 反向 —— 把脚本拷到没有启动器的临时仓:必须 exit 2「未判定」,不许自报成功;
 *   T3 静态 —— 源码不得再出现写死的 G:\IHUI-AI。
 */

const ROOT = resolve(import.meta.dirname, '../..')
const SCRIPT = resolve(ROOT, 'scripts/bare-sentinel-register.mjs')
const RUN_OPTS = { encoding: 'utf8', windowsHide: true, timeout: 30_000, maxBuffer: 16 << 20 }

test('T1 仓内 --dry-run:仓根/启动器由脚本位置推导且存在', () => {
  const r = spawnSync(process.execPath, [SCRIPT, '--dry-run'], { ...RUN_OPTS, cwd: ROOT })
  assert.equal(r.status, 0, `期望 exit 0,实得 ${r.status};stderr=${r.stderr}`)
  const vbs = join(ROOT, 'scripts', 'bare-sentinel-hidden.vbs')
  assert.ok(r.stdout.includes(`vbs=${vbs}`), `dry-run 未打印推导路径 ${vbs}:${r.stdout}`)
})

test('T2 无启动器的临时仓 ⇒ exit 2 未判定,不自报成功', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ihui-bare-sentinel-'))
  try {
    mkdirSync(join(dir, 'scripts'), { recursive: true })
    const copied = join(dir, 'scripts', 'bare-sentinel-register.mjs')
    copyFileSync(SCRIPT, copied)
    const r = spawnSync(process.execPath, [copied, '--dry-run'], { ...RUN_OPTS, cwd: dir })
    assert.equal(r.status, 2, `期望 exit 2,实得 ${r.status};stdout=${r.stdout};stderr=${r.stderr}`)
    assert.match(r.stderr, /未判定/)
    assert.ok(!r.stdout.includes('DONE'), '未判定时不得打印 DONE')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('T3 源码不再写死 G:\\IHUI-AI', () => {
  const src = readFileSync(SCRIPT, 'utf8')
  assert.ok(!/G:\\\\IHUI-AI/.test(src), '仍存在写死的 G:\\IHUI-AI 路径')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
