// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 门 61 新增判据的成对用例:默认安装目录不得回退成「无条件写死盘符」。
 *
 * 为什么需要:这条判据是为了守住 2026-11-22 的修法(固定盘探测 + 归集目录 + 兜底)。
 * 判据本身若被改坏(正则放宽、条件写反),会静默放行回潮 —— 所以正反两态都要钉住。
 * 判据单源 = scripts/check-installer-assets.mjs 的 checkInstallDirPolicy(本文件直接 import,
 * 不复制判据;AGENTS §0.6 单一真相源)。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { checkInstallDirPolicy } from '../check-installer-assets.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const BEGIN = '    ; ==== IHUI 定制:默认安装目录(向导首屏即生效)===='
const END = '    ; ==== IHUI 定制结束 ===='

/** 用单引号数组拼接,避免 NSIS 的 $ 语法被模板字符串插值 */
function withBlock(bodyLines) {
  return [
    '; 上游前文',
    BEGIN,
    ...bodyLines,
    END,
    '; 后文',
  ].join('\n')
}

test('真实 installer.nsi:固定盘探测形态判绿', () => {
  const text = readFileSync(
    join(ROOT, 'apps/desktop/src-tauri/windows/installer.nsi'),
    'utf8',
  )
  const res = checkInstallDirPolicy(text)
  assert.equal(res.state, 'ok', `当前仓库安装器应判绿,实际:${JSON.stringify(res)}`)
})

test('回退成纯写死盘符:必须判红,并同时点名盘型探测与兜底两项缺失', () => {
  const text = withBlock([
    '    StrCpy $INSTDIR "D:\\智汇AI"',
    '',
    '    Call RestorePreviousInstallLocation',
  ])
  const res = checkInstallDirPolicy(text)
  assert.equal(res.state, 'fail')
  const joined = res.fails.join('\n')
  assert.match(joined, /盘型探测/)
  assert.match(joined, /LOCALAPPDATA/)
  assert.match(joined, /CreateDirectory/)
})

test('有盘型探测但缺兜底:仍判红(半修等于没修)', () => {
  const text = withBlock([
    '    System::Call \'kernel32::GetDriveTypeW(w "D:\\") i .R0\'',
    '    StrCpy $INSTDIR "D:\\software\\智汇AI"',
    '',
    '    Call RestorePreviousInstallLocation',
  ])
  const res = checkInstallDirPolicy(text)
  assert.equal(res.state, 'fail')
  assert.match(res.fails.join('\n'), /LOCALAPPDATA/)
  assert.doesNotMatch(res.fails.join('\n'), /盘型探测/)
})

test('有兜底但缺盘型探测:仍判红(无法证明字面盘符是有条件使用的)', () => {
  const text = withBlock([
    '    StrCpy $INSTDIR "D:\\software\\智汇AI"',
    '    StrCpy $INSTDIR "$LOCALAPPDATA\\Programs\\智汇AI"',
    '',
    '    Call RestorePreviousInstallLocation',
  ])
  const res = checkInstallDirPolicy(text)
  assert.equal(res.state, 'fail')
  assert.match(res.fails.join('\n'), /盘型探测/)
})

test('探测 + 兜底 + 条件化字面盘符:判绿(允许有条件使用 D: 字面)', () => {
  const text = withBlock([
    '    System::Call \'kernel32::GetDriveTypeW(w "D:\\") i .R0\'',
    '    StrCpy $INSTDIR `D:\\software\\智汇AI`',
    '    StrCpy $INSTDIR "$LOCALAPPDATA\\Programs\\智汇AI"',
    '',
    '    Call RestorePreviousInstallLocation',
  ])
  assert.equal(checkInstallDirPolicy(text).state, 'ok')
})

test('摘掉 RestorePreviousInstallLocation:判红(升级沿用旧位置的语义不得丢)', () => {
  const text = withBlock([
    '    System::Call \'kernel32::GetDriveTypeW(w "D:\\") i .R0\'',
    '    StrCpy $INSTDIR "$LOCALAPPDATA\\Programs\\智汇AI"',
  ])
  const res = checkInstallDirPolicy(text)
  assert.equal(res.state, 'fail')
  assert.match(res.fails.join('\n'), /RestorePreviousInstallLocation/)
})

test('起止标记缺失:未判定(既不是绿也不是红)', () => {
  const text = ['; 上游前文', '    StrCpy $INSTDIR "D:\\智汇AI"', '; 后文'].join('\n')
  const res = checkInstallDirPolicy(text)
  assert.equal(res.state, 'undetermined')
  assert.match(res.detail, /P0 定制段标记/)
})

test('标记顺序颠倒:未判定(不能拿半段文本下结论)', () => {
  const text = [END, '    StrCpy $INSTDIR "D:\\智汇AI"', BEGIN].join('\n')
  assert.equal(checkInstallDirPolicy(text).state, 'undetermined')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
