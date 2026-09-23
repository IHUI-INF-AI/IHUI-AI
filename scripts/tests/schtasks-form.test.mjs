// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 计划任务形态判定回归测试(纯函数,不依赖本机任务状态)
//
// 钉住 2026-09-23 的两起真实缺陷:
//  ① 自检拿不到 LogonType 就判"漂移" ⇒ 每 2 分钟重注册一次 git 存续守护(把自己打坏);
//  ② 只认 S4U ⇒ 把"InteractiveToken + wscript + ASCII .vbs"这个**合法无弹窗回退**判成漂移。
// 反例(必须仍判 drift):InteractiveToken 且直跑 node.exe —— 那才是 09-20 的闪黑窗回归。
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { judgeTaskForm, taskFormAcceptable } from '../lib/schtasks-form.mjs'

const xml = (inner) => `<Task version="1.2"><RegistrationInfo/><Triggers/><Principals><Principal><LogonType>${inner}</LogonType></Principal></Principals></Task>`

test('S4U ⇒ ok(session 0,结构上无弹窗)', () => {
  assert.equal(judgeTaskForm(xml('S4U')), 'ok')
})

test('InteractiveToken + wscript + 我们的 .vbs ⇒ ok-vbs(合法回退,不是漂移)', () => {
  const x = `${xml('InteractiveToken')}<Actions><Exec><Command>wscript.exe</Command><Arguments>"D:\\IHUI-AI\\scripts\\git-guardian-hidden.vbs"</Arguments></Exec></Actions>`
  assert.equal(judgeTaskForm(x), 'ok-vbs')
  assert.ok(taskFormAcceptable('ok-vbs'), '回退形态必须被接受,否则就是今天的每 2 分钟空转重注册')
})

test('InteractiveToken 直跑 node.exe ⇒ drift(09-20 闪黑窗回归,必须报警)', () => {
  const x = `${xml('InteractiveToken')}<Actions><Exec><Command>C:\\Program Files\\nodejs\\node.exe</Command></Exec></Actions>`
  assert.equal(judgeTaskForm(x), 'drift')
  assert.equal(taskFormAcceptable('drift'), false)
})

test('有 wscript 但包装文件不是我们那个 ⇒ drift(防"随便套个 vbs"蒙过判据)', () => {
  const x = `${xml('InteractiveToken')}<Actions><Exec><Command>wscript.exe</Command><Arguments>"D:\\other\\x.vbs"</Arguments></Exec></Actions>`
  assert.equal(judgeTaskForm(x), 'drift')
})

test('拿不到 XML / 非任务体 ⇒ unknown,且 unknown 绝不去改任务', () => {
  for (const bad of ['', '   ', '系统找不到指定的文件', '<html>']) {
    assert.equal(judgeTaskForm(bad), 'unknown', `输入 ${JSON.stringify(bad)} 应判 unknown`)
  }
  assert.ok(taskFormAcceptable('unknown'), '信息不足时不动任务(宁可不动也不误动)')
})

test('UTF-16 带 NUL 原文也能判(调用方去 NUL 前的真实字节形态)', () => {
  const withNul = xml('S4U').replace(/(.)/g, '$1\0')
  assert.equal(judgeTaskForm(withNul.replace(/\0/g, '')), 'ok')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
