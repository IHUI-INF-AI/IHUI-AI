// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

/**
 * `scripts/lib/desktop-victims.mjs` 的镜像测试(§22c:直接 import 源实现,不维护镜像常量)。
 *
 * 这组用例的存在理由是一条真实事故:开发脚本按**镜像名**停"旧实例",于是把用户已安装的
 * `D:\智汇AI\ihui-desktop.exe` 一起杀了(当天该应用被重启 18 次,用户报"点哪个页面就崩")。
 * 所以每条用例都在问同一句话:**这一份该不该停**。既有"必须停"的正例,也有"绝不停"的反例 ——
 * 只测前者会让判据在"扩大清理范围"的那一次改动上静默失效。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeWinPath, selectDesktopVictims } from '../lib/desktop-victims.mjs'

const TARGET = 'G:/IHUI-AI/apps/desktop/src-tauri/target'
const row = (pid, exe) => `${pid}|${exe}`

test('本仓 target 下的 debug/release 实例必须被列为可停(否则 cargo 链接必败)', () => {
  const out = [
    row('1001', 'G:\\IHUI-AI\\apps\\desktop\\src-tauri\\target\\debug\\ihui-desktop.exe'),
    row('1002', 'G:/IHUI-AI/apps/desktop/src-tauri/target/release/ihui-desktop.exe'),
  ].join('\r\n')
  const { mine, foreign } = selectDesktopVictims(out, TARGET)
  assert.deepEqual(mine, ['1001', '1002'], '正斜杠与反斜杠两种形态都要认(归一化只有一份)')
  assert.deepEqual(foreign, [])
})

test('用户已安装的那一份绝不可被列为可停 —— 本判据存在的全部理由', () => {
  const out = [
    row('2001', 'D:\\智汇AI\\ihui-desktop.exe'),
    row('2002', 'C:\\Program Files\\智汇AI\\ihui-desktop.exe'),
    row('2003', 'E:\\other-checkout\\IHUI-AI\\apps\\desktop\\src-tauri\\target\\release\\ihui-desktop.exe'),
  ].join('\n')
  const { mine, foreign } = selectDesktopVictims(out, TARGET)
  assert.deepEqual(mine, [], '另一目录/另一份 checkout 的同名进程一律不停(旧 /IM 写法正是死在这里)')
  assert.equal(foreign.length, 3)
})

test('路径前缀相似不等于子目录:targetX 不得被当成 target 之下', () => {
  const { mine, foreign } = selectDesktopVictims(
    row('3001', 'G:\\IHUI-AI\\apps\\desktop\\src-tauri\\targetX\\ihui-desktop.exe'),
    TARGET,
  )
  assert.deepEqual(mine, [])
  assert.equal(foreign.length, 1, '必须报名,不得静默丢弃')
})

test('大小写不敏感(Windows 文件系统),但不得因此放宽到别的目录', () => {
  const out = [
    row('4001', 'g:\\ihui-ai\\apps\\DESKTOP\\src-tauri\\TARGET\\debug\\IHUI-Desktop.exe'),
    row('4002', 'g:\\ihui-ai\\apps\\desktop\\src-tauri\\taRgetCache\\x.exe'),
  ].join('\n')
  const { mine, foreign } = selectDesktopVictims(out, TARGET)
  assert.deepEqual(mine, ['4001'])
  assert.equal(foreign.length, 1)
})

test('问不到路径 ⇒ 归"不动它们"并点名,绝不按名字猜(少停可诊断,多停是用户事故)', () => {
  const out = [row('5001', ''), row('5002', 'NULL'), 'garbage-without-separator', '', '   '].join('\n')
  const { mine, foreign } = selectDesktopVictims(out, TARGET)
  assert.deepEqual(mine, [], '空路径与占位串都不构成"在本仓 target 之下"的证据 ⇒ 一个都不停')
  assert.equal(foreign.length, 2, '两条都要报名(无 `|` 的行与空行整行跳过,不计入)')
  assert.ok(foreign[0].includes('路径问不到'), '空路径必须写明"问不到",不得伪装成一个真实路径')
})

test('非数字 pid 与空输入不得产出任何可停项(防把表头/异常行当进程)', () => {
  assert.deepEqual(selectDesktopVictims('ProcessId|ExecutablePath', TARGET).mine, [])
  assert.deepEqual(selectDesktopVictims('', TARGET), { mine: [], foreign: [] })
  assert.deepEqual(selectDesktopVictims(undefined, TARGET), { mine: [], foreign: [] })
})

test('normalizeWinPath: 混合分隔符折叠、首尾空白去掉、undefined 不炸', () => {
  assert.equal(normalizeWinPath('C:\\\\a\\\\b'), 'c:/a/b')
  assert.equal(normalizeWinPath('  C:/a//b  '), 'c:/a/b')
  assert.equal(normalizeWinPath(undefined), '')
})
