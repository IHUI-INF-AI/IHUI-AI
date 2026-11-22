#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 测试输出即结论 */
// §22c 镜像测试:判据一律 import 源脚本 __test__ 出口,本文件不复制任何解析/对账实现。
// 与源 --self-test 的分工:--self-test 钉夹具逻辑;本镜像钉"装车面"——
// 源脚本必须导出判据、维度表不得为空、三态退出方向必须成对(同形=无漂移 / 改维=点名漂移 /
// 缺块=未判定),摘掉 import 锚点或改坏导出当场红。
import { spawnSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { __test__ as AM } from '../check-alertmanager-live-config.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const SRC = resolve(HERE, '..', 'check-alertmanager-live-config.mjs')
const cases = []
const eq = (label, got, want) => cases.push([label, JSON.stringify(got) === JSON.stringify(want), `got=${JSON.stringify(got)} want=${JSON.stringify(want)}`])

// ① 导出锚点(镜像测试 import 不到 __test__ 就已经在上面炸了;这里钉形状)
eq('__test__ 出口含全部判据函数', ['unquote', 'stripComment', 'splitFlow', 'parseYamlSubset', 'projectConfig', 'compareProjections', 'FIX_TMPL', 'FIX_LIVE', 'DIM_ORDER', 'TEMPLATE_REL', 'DEFAULT_URL'].every((k) => AM[k] !== undefined), true)
eq('审面锚点:现役模板路径逐字在', AM.TEMPLATE_REL, 'monitoring/alertmanager/alertmanager.yml.tmpl')
eq('生效面默认取 status API(不是磁盘猜测)', AM.DEFAULT_URL, 'http://127.0.0.1:9093/api/v2/status')
eq('维度表非空枚举(枚举到 0 判死)', AM.DIM_ORDER.length >= 8, true)

// ② 成对证明:同形 ⇒ 零漂移零未判定(引号/键序/<secret> 掩码差异都在夹具里故意造好)
const pt = AM.projectConfig(AM.parseYamlSubset(AM.FIX_TMPL))
const pl = AM.projectConfig(AM.parseYamlSubset(AM.FIX_LIVE))
const same = AM.compareProjections(pt, pl)
eq('同形两面 ⇒ 无漂移', same.hasDiff, false)
eq('同形两面 ⇒ 无未判定', same.hasUndetermined, false)
eq('逐维行数 = 维度表长度', same.rows.length, AM.DIM_ORDER.length)

// ③ 漂移方向:改一维只点名那一维
const drift = AM.compareProjections(pt, AM.projectConfig(AM.parseYamlSubset(AM.FIX_LIVE.replace('send_resolved: true', 'send_resolved: false'))))
eq('改 send_resolved ⇒ 判漂移', drift.hasDiff, true)
eq('点名维度恰为 receivers 一个', drift.rows.filter((r) => r.state === 'drift').map((r) => r.dim), ['receivers'])

// ④ 未判定方向:生效面缺 receivers 整块 ⇒ 该维 undetermined 且不得折成红或绿
const missing = AM.compareProjections(pt, AM.projectConfig(AM.parseYamlSubset(AM.FIX_LIVE.replace(/receivers:[\s\S]*?inhibit_rules:/, 'inhibit_rules:'))))
eq('生效面缺 receivers ⇒ 未判定置位', missing.hasUndetermined, true)
eq('缺块本身不得算漂移', missing.hasDiff, false)
eq('点名的恰是 receivers', missing.rows.filter((r) => r.state === 'undetermined').map((r) => r.dim), ['receivers'])

// ⑤ 三态退出码在真 CLI 上成对:死端口必须 2(未判定),不得 0/1
const dead = spawnSync(process.execPath, [SRC, '--url', 'http://127.0.0.1:1/api/v2/status', '--timeout-ms', '1500'], { encoding: 'utf8', windowsHide: true, timeout: 30000, stdio: ['ignore', 'pipe', 'pipe'] })
eq('连不上 ⇒ exit 2(不折绿也不冒红)', dead.status, 2)
eq('连不上时输出点名"未判定"', /未判定/.test(String(dead.stderr)), true)
eq('连不上的输出不得自称"一致"', /一致/.test(String(dead.stdout) + String(dead.stderr)), false)
const st = spawnSync(process.execPath, [SRC, '--self-test'], { encoding: 'utf8', windowsHide: true, timeout: 30000, stdio: ['ignore', 'pipe', 'pipe'] })
eq('--self-test 直跑 exit 0(装车证明:自检真能跑起来)', st.status, 0)

let bad = 0
for (const [label, pass, why] of cases) { if (!pass) bad++; console.log(`${pass ? '✓' : '✗'} ${label}${pass ? '' : `  ${why}`}`) }
console.log(`镜像 ${cases.length - bad}/${cases.length} 通过`)
process.exit(bad ? 1 : 0)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
