// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 灰度产物来源判据的镜像用例(§22c:判据只许住一份,本文件 import 源脚本的 __test__)。
 *
 * 它钉的是 2026-11-01 那一次实测的回归面:ihui-deploy.ps1 换流用 Move-Item 把 .next-staging
 * 整份搬进目标色目录,而灰度实例排在换流之后才起 ⇒ 生产日志连续 20 轮
 * 「未判定:.next-staging 没有 BUILD_ID」却照样「依据=判定通过 ⇒ ramp-1 → ramp-2」。
 * 正解分两半:来源换成换流前镜像出来的 .next-canary(A1–A4c),在位实例必须先核对产物 buildId(A5/A5b)。
 * "灰度缺席时不得记判定通过"那一格由 deploy/win/ihui-canary-wiring.mjs 的 W10 钉,不在本文件重复。
 */
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import assert from 'node:assert/strict'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..', '..')
const ARTIFACT_CLI = join(ROOT, 'deploy', 'win', 'ihui-canary-artifact.mjs')
const { artifactGaps, DEPLOY_PS1, GRAY_PS1 } = await import(
  `file://${ARTIFACT_CLI.replace(/\\/g, '/')}`
)

const run = (exe, args) => {
  const r = spawnSync(exe, args, {
    cwd: ROOT,
    encoding: 'utf8',
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  return { rc: r.status, out: `${r.stdout ?? ''}${r.stderr ?? ''}` }
}
const ids = (r) => r.gaps.map((g) => g.id)

test('真仓两面:来源与顺序全格命中', () => {
  const r = artifactGaps({
    deployText: readFileSync(DEPLOY_PS1, 'utf8'),
    grayText: readFileSync(GRAY_PS1, 'utf8'),
  })
  assert.equal(r.undetermined, false, '被审面取不到就是本锁自己瞎了')
  assert.deepEqual(r.gaps, [], `实得缺口 ${JSON.stringify(ids(r))}`)
})

test('被审面取不到 ⇒ 未判定(既不记绿也不冒红,§0.3)', () => {
  assert.equal(artifactGaps({ deployText: null, grayText: 'x' }).undetermined, true)
  assert.equal(artifactGaps({ deployText: 'x', grayText: null }).undetermined, true)
})

test('A1+A2:没有镜像动作、或镜像排在换流之后,都各自翻红', () => {
  const gray = readFileSync(GRAY_PS1, 'utf8')
  const d = readFileSync(DEPLOY_PS1, 'utf8')
  const noMirror = d.replace(/& robocopy\.exe/g, '& 已摘镜像.exe')
  assert.notEqual(noMirror, d, '夹具前提:deploy 里没有 robocopy 调用')
  assert.ok(
    ids(artifactGaps({ deployText: noMirror, grayText: gray })).includes('A1'),
    '摘掉镜像仍判绿',
  )
  const mv = /(Move-Item "\$WebDir\\\.next-staging"[^\n]*)/
  const m0 = d.match(/\r?\n(\s*& robocopy\.exe[^\n]*)/)
  assert.ok(m0 && d.match(mv), '夹具前提:找不到可挪的镜像行或换流行')
  const late = d.replace(/\r?\n\s*& robocopy\.exe[^\n]*/, '').replace(mv, `$1${m0[0]}`)
  const g = ids(artifactGaps({ deployText: late, grayText: gray }))
  assert.ok(g.includes('A2'), `镜像挪到换流之后仍判绿(实得 ${JSON.stringify(g)})`)
})

test('A4b/A4c:灰度来源退回 staging 或环境变量与判据分家,都翻红', () => {
  const deploy = readFileSync(DEPLOY_PS1, 'utf8')
  const g0 = readFileSync(GRAY_PS1, 'utf8')
  const backToStaging = g0.replace(/\$GrayDist = '\.next-canary'/, "$GrayDist = '.next-staging'")
  assert.notEqual(backToStaging, g0, '夹具前提:gray 里没有 $GrayDist 赋值')
  assert.ok(
    ids(artifactGaps({ deployText: deploy, grayText: backToStaging })).includes('A4b'),
    '来源退回 .next-staging 仍判绿 —— 那就是 20/20 轮空转的原样回潮',
  )
  const distSplit = g0.replace(
    /\$env:IHUI_BUILD_DIST = \$GrayDist/,
    "$env:IHUI_BUILD_DIST = '.next'",
  )
  assert.notEqual(distSplit, g0, '夹具前提:找不到 IHUI_BUILD_DIST 赋值')
  assert.ok(
    ids(artifactGaps({ deployText: deploy, grayText: distSplit })).includes('A4c'),
    '两份 dist 来源仍判绿',
  )
})

test('A5/A5b:在位实例不核对产物 buildId、或核对却不先停旧进程,都翻红', () => {
  const deploy = readFileSync(DEPLOY_PS1, 'utf8')
  const g0 = readFileSync(GRAY_PS1, 'utf8')
  const noCompare = g0.replace(/\$served -eq \$artifact/, '$served -ne $artifact')
  assert.notEqual(noCompare, g0, '夹具前提:找不到 buildId 比对')
  assert.ok(
    ids(artifactGaps({ deployText: deploy, grayText: noCompare })).includes('A5'),
    '不比对产物也照常记在位 ⇒ 仍判绿',
  )
  const noStop = g0.replace(
    /Stop-GrayProcess -PidFile \$CanaryPidFile -What '灰度实例' \| Out-Null/,
    '# 已摘停旧实例',
  )
  assert.notEqual(noStop, g0, '夹具前提:找不到停旧实例那一行')
  assert.ok(
    ids(artifactGaps({ deployText: deploy, grayText: noStop })).includes('A5b'),
    '比对不等却不停旧实例 ⇒ 仍判绿',
  )
})

test('CLI 两档:自检 rc=0,真仓判定 rc=0 且 --json 出结构化结论', () => {
  const node = process.execPath
  const st = run(node, [ARTIFACT_CLI, '--self-test'])
  assert.equal(st.rc, 0, st.out.slice(-400))
  assert.match(st.out, /失败 0/)
  const ok = run(node, [ARTIFACT_CLI, '--check', '--json'])
  assert.equal(ok.rc, 0, ok.out.slice(-400))
  const parsed = JSON.parse(ok.out)
  assert.equal(parsed.undetermined, false, '--json 把未判定当通过')
  assert.deepEqual(parsed.gaps, [], `CLI 与纯函数读得不一致:${ok.out.slice(0, 200)}`)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
