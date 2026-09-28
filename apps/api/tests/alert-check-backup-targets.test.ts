// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 备份监控清单与"按库分开告警"的回归锁(2026-09-29 立)。
//
// 为什么要有它(实测,不是假想):`alert-check-service.ts` 的 BACKUP_TARGETS 曾只有
// `ihui_dev_` 一条,而同一条 runner(deploy/win/ihui-pg-backup.ps1)自 2026-09-28 起每天
// 往同一个目录产 `keycloak_*.dump` —— 于是 keycloak 的档缺失 / 0 字节 / 停更**一条都不判**,
// 且 typecheck / lint / 其余门全都不会红(监控面少一个库,账面与"没有库要盯"完全同形)。
// 本文件钉三件事:① 监控清单与 runner 清单逐库对齐(改一边忘另一边必红);
// ② "目录读不到"落未判定而不是落"没问题"(静默方向必须是要人看,不是宣布一切正常);
// ③ 告警身份含库名 ⇒ 两个库不会被同一条去重窗口吞掉。
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import {
  buildBackupAlert,
  checkBackupTarget,
  listBackupTargets,
  type BackupTarget,
} from '../src/services/alert-check-service.js'

const NOW = new Date('2026-09-29T04:00:00Z')

function target(over: Partial<BackupTarget>): BackupTarget {
  // 前缀默认跟着库名走:探针若不带自己的归属前缀,就会拿隔壁库的档替自己作证 ——
  // 那正是 keycloak 在监控面里"永远绿"的机制,所以这里不允许留空。
  const name = over.name ?? 'probe'
  return { name, dir: '.', label: '探针目标', suffix: '.dump', namePrefix: `${name}_`, ...over }
}

describe('备份监控清单:与 runner 的库清单逐库对齐', () => {
  const names = listBackupTargets().map((t) => t.name)

  it('keycloak 确实在监控清单里(本票要修的就是这一格)', () => {
    expect(names).toContain('keycloak')
  })

  it('主库 ihui_dev 未被"加新库"顶掉(清单收窄是静默的,只有逐名断言看得见)', () => {
    expect(names).toContain('ihui_dev')
  })

  it('库名不重复:重名 = 一个库的两条身份互相去重', () => {
    expect(new Set(names).size).toBe(names.length)
  })

  it('每个库的识别式指向它自己那个库(拿别人的档替自己作证 = 第二个库永远绿)', () => {
    for (const t of listBackupTargets()) {
      expect(t.prefix, `${t.name} 缺前缀 ⇒ 会把别人的档算成自己的`).toBeTruthy()
      expect(t.prefix.startsWith(t.name), `${t.name} 的前缀不是它自己的库名`).toBe(true)
    }
  })

  it('runner 的 $backupDatabases 与监控清单是同一批库(读被审文件,不抄第二份名单)', () => {
    const runner = readFileSync(
      fileURLToPath(new URL('../../../deploy/win/ihui-pg-backup.ps1', import.meta.url)),
      'utf8',
    )
    const line = /\$backupDatabases\s*=\s*@\(([^)]*)\)/.exec(runner)
    expect(
      line,
      'runner 里找不到 $backupDatabases 那一行 ⇒ 监控清单失去对照对象,不得当通过',
    ).toBeTruthy()
    // 逐项:引号字面量直接取,`$dbName` 走同文件的兜底字面量(与 cadence-audit 同一取向)
    const literals = [...line![1].matchAll(/'([^']+)'|"([^"]+)"/g)].map((m) => m[1] ?? m[2])
    const fallback = /if\s*\(\s*-not\s+\$dbName\s*\)\s*\{\s*\$dbName\s*=\s*"([^"]+)"\s*\}/.exec(
      runner,
    )
    expect(fallback, '$dbName 的兜底字面量不在同一份文件里 ⇒ 主库名无从解析').toBeTruthy()
    const runnerDbs = new Set<string>([fallback![1], ...literals])
    expect([...runnerDbs].sort()).toEqual([...names].sort())
  })
})

describe('checkBackupTarget:已判定问题与"没看清"分两桶,都不静默', () => {
  it('目录读不到 ⇒ 落未判定,且不得被算成"没有问题"(静默 OK 是本票要根治的那一型)', async () => {
    const res = await checkBackupTarget(
      target({ name: 'no-such-db', dir: join(process.cwd(), 'no-such-dir-9f2c1d') }),
      NOW,
    )
    expect(res.issues).toEqual([])
    expect(res.undetermined).toHaveLength(1)
    expect(res.undetermined[0]).toContain('无法判定')
  })

  it('目录在、但没有该库的档 ⇒ 判"无任何备份文件"(这是已判定缺失,不是未判定)', async () => {
    // process.cwd() = apps/api:目录确实读得到,里面却没有 absent_*.dump
    const res = await checkBackupTarget(target({ name: 'absent', dir: process.cwd() }), NOW)
    expect(res.undetermined).toEqual([])
    expect(res.issues).toEqual(['探针目标: 无任何备份文件'])
  })

  it('识别式不吃别的库的档(前缀不属于本库时不得判"有备份")', async () => {
    // 真目录里躺着的是 keycloak_* / ihui_dev_*;给探针换一个谁都不匹配的前缀 ⇒ 必判缺失,
    // 而不是"目录里有档所以一切正常" —— 那正是第二个库永远绿的机制。
    const res = await checkBackupTarget(
      target({ name: 'zz-no-such-db', dir: 'D:\\DevEnv\\backups\\pg' }),
      NOW,
    )
    expect(res.issues).toEqual(['探针目标: 无任何备份文件'])
    expect(res.undetermined).toEqual([])
  })

  it('前缀给空 ⇒ 未判定(不得退化成"整个目录都算本库的")', async () => {
    // 类型已把 namePrefix 收成必填,但 `''` 仍是合法字面量 ⇒ 运行时这一道栅栏不能省
    const res = await checkBackupTarget(
      target({ name: 'keycloak', dir: 'D:\\DevEnv\\backups\\pg', namePrefix: '' }),
      NOW,
    )
    expect(res.issues).toEqual([])
    expect(res.undetermined).toHaveLength(1)
    expect(res.undetermined[0]).toContain('无法判定归属')
  })
})

describe('buildBackupAlert:告警身份按库分开', () => {
  it('无事可报 ⇒ null(不冒领一条空告警)', () => {
    expect(buildBackupAlert('ihui_dev', { issues: [], undetermined: [] })).toBeNull()
  })

  it('两个库各自一条,标题含自己的库名 ⇒ 去重身份不互相吞', () => {
    const a = buildBackupAlert('ihui_dev', { issues: ['x 过期'], undetermined: [] })
    const b = buildBackupAlert('keycloak', { issues: ['y 为空文件'], undetermined: [] })
    expect(a && b && a.title !== b.title, '两库标题相同 = 共用一个去重身份').toBe(true)
    expect(a!.title).toContain('ihui_dev')
    expect(b!.title).toContain('keycloak')
  })

  it('未判定单独出现时标题写"无法判定",不与"缺失"混成一个词(处置动作不同)', () => {
    const only = buildBackupAlert('keycloak', { issues: [], undetermined: ['读不到目录'] })
    expect(only!.title).toContain('无法判定')
    expect(only!.title).not.toContain('缺失/空备份/过期')
    const both = buildBackupAlert('keycloak', { issues: ['过期'], undetermined: ['stat 失败'] })
    expect(both!.title).toContain('缺失/空备份/过期')
    expect(both!.title).toContain('无法判定')
    expect(both!.lines).toEqual(['过期', 'stat 失败'])
  })
})

describe('升级口径与调度侧接线(源码面:机制在位且真被调用)', () => {
  const svc = readFileSync(
    fileURLToPath(new URL('../src/services/alert-check-service.ts', import.meta.url)),
    'utf8',
  )
  const worker = readFileSync(
    fileURLToPath(new URL('../src/workers/scheduler-worker.ts', import.meta.url)),
    'utf8',
  )

  it('escalated 必须同时看 backupIssues 与 backupUndetermined', () => {
    expect(svc).toMatch(/backupUndetermined\.length > 0 \? 1 : 0/)
  })

  it('worker 按 backupAlerts 逐条发,标题取自服务(不在 worker 里再拼第二份)', () => {
    expect(worker).toMatch(/for \(const one of result\.backupAlerts\)/)
    expect(worker).toMatch(/title: one\.title/)
    // 反向锁:worker 里不得再手写一条"不分库"的备份标题(那会重新把两库并成一个身份)
    expect(worker).not.toMatch(/title: '数据库备份监控告警\(缺失\/空备份\/过期\)'/)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
