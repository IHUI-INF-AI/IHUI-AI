// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// G-70(2026-10-26)常驻锁:scripts/backup-pg-local.ps1 的备份落点与 pg_dump 落点必须是探测式。
// 立因(实测,不是假想):换机后 D 盘旧卷整体失踪(D:\DevEnv\backups\pg、D:\ihui-pg\16、
// D:\DevEnv\runtimes\pgsql 全部不存在),旧版把这三处写死 ⇒ 守卫只能永远报"请更新本文件路径",
// 而经 wscript 拉起的计划任务看不到 stderr —— 2026-10-25"静默烂一个月"的教训在每次换机后重演。
// 修法样板:deploy/win/ihui-pg-backup.ps1 的既有实现(G-298 DevEnvRoot 派生 + 2026-10-25 P0
// pg_dump 候选链),本文件把同一条纪律钉在 backup-pg-local.ps1 上。
// 运行:`node --test scripts/tests/backup-pg-local-path-probe.test.mjs`
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const TARGET = join(REPO, 'scripts', 'backup-pg-local.ps1')
const SRC = readFileSync(TARGET, 'utf8')

// 判据只扫**会被执行的那一份**:`#` 起头整行不执行,注释/头注里合法地出现 D:\DevEnv 等历史
// 路径说明(立因记录),整文件 includes 会把"写下这条禁令"当成"犯了这条禁令"。
const codeOf = (text) =>
  text
    .replace(/<#[\s\S]*?#>/g, ' ')
    .split(/\r?\n/)
    .filter((l) => !/^\s*#/.test(l))
    .join('\n')

const CODE = codeOf(SRC)

// ① 可执行面不得再有盘符字面量(Env:\ 是 PS 提供器盘,前置 (?<![\w]) 排除 'v:\' 误命中)。
const driveLiterals = (code) => code.match(/(?<![\w])[A-Za-z]:[\\/]/g) || []

// ② DevEnvRoot 派生(G-298 同纪律):IHUI_DEVENV_ROOT 覆盖优先,否则按仓根所在盘符派生。
const hasDevEnvDerivation = (code) =>
  /\$DevEnvRoot\s*=\s*if\s*\(\s*\$env:IHUI_DEVENV_ROOT\s*\)/.test(code) &&
  /Split-Path -Qualifier \$RepoRoot/.test(code) &&
  /\$BackupDir\s*=\s*Join-Path\s+\$DevEnvRoot\s+'backups\\pg'/.test(code)

// ③ pg_dump 候选链四档全在位(①env 覆盖 ②运行中服务 ImagePath 反查 ③ProgramFiles 版本降序 ④PATH)。
const hasProbeChain = (code) =>
  /\$env:IHUI_PG_BIN_DIR/.test(code) &&
  /Get-CimInstance Win32_Service/.test(code) &&
  /pg_ctl\\\.exe/.test(code) &&
  /Join-Path \$env:ProgramFiles 'PostgreSQL'/.test(code) &&
  /Get-Command pg_dump\.exe/.test(code)

// ④ 失踪守卫:先写 backup.log 再 exit 1(2026-10-25 立的纪律不许回退),出路指向 IHUI_PG_BIN_DIR
// 而不是"更新本文件路径"(写死时代的处置语,探测式下会把人带回旧坑)。
const hasGuard = (code) => {
  const i = code.indexOf('pg_dump 不在位')
  if (i < 0) return false
  const before = code.slice(Math.max(0, i - 200), i)
  const after = code.slice(i, i + 400)
  return (
    /Write-Log/.test(before) &&
    after.includes('IHUI_PG_BIN_DIR') &&
    /exit 1/.test(after) &&
    !/请更新本文件路径/.test(code)
  )
}

// ⑤ 命名契约:ihui-dev-*.dump 是 pg-backup-cadence-audit.mjs / check-ops-patrol.mjs 的旁族
// (FOREIGN_ONLY)识别式,改落点不得顺手改产物命名。
const hasNamingContract = (code) => /ihui-dev-\$Stamp\.dump/.test(code)

test('backup-pg-local:可执行面无盘符字面量', () => {
  assert.deepEqual(driveLiterals(CODE), [], `代码里又出现盘符字面量: ${driveLiterals(CODE).join(', ')}`)
  // 变异对照:把派生落点改回旧写死形态,判据必须翻假。
  const mutant = CODE.replace(/\$BackupDir\s*=\s*Join-Path[^\r\n]*/, () => "$BackupDir = 'D:\\DevEnv\\backups\\pg'")
  assert.notDeepEqual(driveLiterals(mutant), [], '变异对照失效:盘符字面写死没被抓到')
})

test('backup-pg-local:DevEnvRoot 派生与 pg_dump 候选链在位', () => {
  assert.ok(hasDevEnvDerivation(CODE), '缺 IHUI_DEVENV_ROOT 覆盖 / 仓根盘符派生 / Join-Path 落点')
  assert.ok(hasProbeChain(CODE), 'pg_dump 候选链缺档(env 覆盖/服务反查/ProgramFiles/PATH)')
  // 变异对照:摘掉显式覆盖入口,候选链判据必须翻假。
  assert.ok(!hasProbeChain(CODE.replace(/\$env:IHUI_PG_BIN_DIR/g, '$env:XXX')), '变异对照失效:候选链对缺覆盖入口不敏感')
})

test('backup-pg-local:守卫先留痕再退,出路不指回写死时代;旁族命名契约不变', () => {
  assert.ok(hasGuard(CODE), '守卫缺失/未先写 backup.log 就退,或出路写回"请更新本文件路径"')
  assert.ok(hasNamingContract(CODE), 'ihui-dev-*.dump 命名被改(cadence-audit 旁族识别式会失配)')
})
