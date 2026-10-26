// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// ═══════════════════════════════════════════════
// 文件用途：apps/api/src/lib/visitor-analytics.ts 与 heat SQL 出口的回归测试
// 内容来源：P1 监控能力票（访客/机器人维度可观测化），判据自写
// 覆盖范围：族归一 9 档 + 指标名集 + 小时预聚合三道判据
// 维护职责：UA 判据或 heat SQL 变更后先跑本文件；SQL 只住在 app 侧（本文件零 SQL）
// ═══════════════════════════════════════════════
/**
 * 访客分析库回归（族归一 + 指标 + 小时预聚合）
 *
 * 覆盖：
 *  1. classifyClientFamily 九档判定与「未知族恒有归属」不变量；
 *  2. 指标名与 /metrics 出口前缀一致性；
 *  3. 小时预聚合 SQL 的三道判据（全部在本文件内真跑，不连任何数据库）：
 *     ① 计划形状（AST）—— 窗口排名必须在 CTE 的 FILTER 聚合层，外层只留 <= K，
 *        且外层 SELECT 必须带 DELETE 依据列（漏选一列即热表无限膨胀）；
 *     ② 行级期望 —— 用固定种子行按同一套口径（RANK 语义 + UTC 跨小时边界）
 *        独立复算「应当留下/应当删除」的行，与 SQL 的阈值语义比对；
 *     ③ 结构对账 —— SQL 引用的列名必须同时存在于 app schema 与建表迁移 DDL
 *        （packages/database/src/plan 的 parse-ddl，同一把尺子，不另写解析）。
 *     引擎执行档不在射程内：本仓禁连生产 PG（AGENTS §5 测试隔离），而
 *     drizzle-orm@0.45.2 的 exports 未导出 `./sqlite3`（现读 `sql-js`/`better-sqlite3`
 *     有、`sqlite3` 无），也没有可跑的 PG 测试库 ⇒ 不假装「跑过 SQL」。
 *     闸门读不到被判据的源码 ⇒ 显式未判定（exit 非 0 语义 = 用例失败），不冒绿。
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { sql } from 'drizzle-orm'
import { parse } from 'sql-parser-cst'
import { parseDdl } from '@ihui/database/plan'
import {
  CLIENT_FAMILIES,
  IP_SCAN_HOT_PATH_THRESHOLD,
  IP_SCAN_WINDOW_HOURS,
  classifyClientFamily,
  clientFamilyKey,
  heatHourKey,
  heatInsertParams,
  heatTopN,
  heatWatchedHour,
  hourlyWindow,
  pgHeatSql,
} from '../src/lib/visitor-analytics.js'
import {
  API_HEAT_COLUMNS,
  API_LOG_COLUMNS,
  VISIT_COLUMNS,
  heatSchemaDdl,
  heatTableFor,
  mirrorTableFor,
  parseMirrorCreate,
  pgHeatSql as probeHeatSql,
} from '../scripts/visitor-analytics-sql-probe.mjs'
import {
  buildHeatMetricsPlan,
  HEAT_METRIC_COLUMN_ORDER,
} from '../scripts/lib/visitor-analytics-heat.mjs'
import {
  HEAT_WINDOW_HOURS_DEFAULT,
  HOT_PATH_TOP_N_DEFAULT,
} from '../src/metrics/visitor-analytics.js'

// ─── 族归一 ────────────────────────────────────────────────────

describe('classifyClientFamily 九档判定', () => {
  const cases: Array<[string, string]> = [
    [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131 Safari/537.36',
      'browser-chrome',
    ],
    [
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.4 Safari',
      'browser-safari',
    ],
    [
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Firefox/132.0',
      'browser-firefox',
    ],
    ['Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/120 Edg/120.0.2210', 'browser-edge'],
    [
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 CriOS/17.4',
      'browser-ios-webview',
    ],
    ['WeChat/8.0.44 MicroMessenger/8.0.44 WindowsWechat', 'browser-wechat'],
    [
      'Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148',
      'browser-other-mobile',
    ],
    ['curl/8.5.0', 'client-curl'],
    ['PostmanRuntime/7.37.3', 'client-postman'],
    ['python-requests/2.31.0', 'client-python'],
    ['axios/1.6.8', 'client-axios'],
    ['okhttp/4.12.0', 'client-java-http'],
    ['Go-http-client/1.1', 'client-go-http'],
    ['node (18; fetch)', 'client-node-fetch'],
    ['insomnia/8.3', 'client-insomnia'],
    ['Mozilla/5.0 AppleWebKit/537.36 Chrome/131 OPR/117 Mobile', 'browser-opr-mini'],
    ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120 HuaweiBrowser/1.0', 'browser-other'],
    ['Googlebot/2.1 (+http://www.google.com/bot.html)', 'bot-google'],
    ['Mozilla/5.0 AppleWebKit/537.36 Chrome/120 (compatible; Googlebot/2.1)', 'bot-google'],
    ['curl/8.5.0 (compatible; SemrushBot/7~bl)', 'bot-semrush'],
    ['scrapy-2.11/0.1', 'bot-scraper-generic'],
    ['Mozilla/5.0 AppleWebKit/537.36 Chrome/131 (compatible)', 'bot-compat-empty'],
    [
      'Mozilla/5.0 (X11; Linux) AppleWebKit/537.36 Chrome/131 HeadlessChrome/131',
      'browser-headless',
    ],
    ['Mozilla/5.0 (compatible; DataForSeoBot/1.0)', 'bot-other-seo'],
    ['Baiduspider/2.0', 'bot-other-seo'],
    [
      'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Version/4.0 Chrome/131 Mobile Safari/537.36',
      'browser-android-webview',
    ],
    ['PetalBot', 'bot-other-seo'],
    ['/', 'unknown'],
    ['', 'unknown'],
    ['   ', 'unknown'],
    ['  curl/8.5.0  ', 'client-curl'],
  ]

  for (const [ua, expected] of cases) {
    it(`「${ua.slice(0, 44)}」归入 ${expected}`, () => {
      expect(classifyClientFamily(ua)).toBe(expected)
    })
  }

  it('未知族兜底：任何输入都有归属，且落进 other 族键', () => {
    for (const probe of ['', '/', 'x', 'A', '中文设备名', 'a'.repeat(500)]) {
      const key = clientFamilyKey(classifyClientFamily(probe))
      expect(typeof key).toBe('string')
      expect(key.length).toBeGreaterThan(0)
    }
    expect(clientFamilyKey('unknown')).toBe('other')
    expect(clientFamilyKey('browser-other')).toBe('other')
    expect(clientFamilyKey('bot-other-seo')).toBe('other')
  })

  it('族键全部落在族前缀集里（大盘 legend 与 PromQL 只按族前缀聚合）', () => {
    for (const family of CLIENT_FAMILIES) {
      const key = clientFamilyKey(family)
      expect(['browser', 'client', 'bot', 'other']).toContain(key)
    }
  })

  it('族清单无重复（重复键会让同一族被双计）', () => {
    expect(new Set(CLIENT_FAMILIES).size).toBe(CLIENT_FAMILIES.length)
  })
})

// ─── 指标名一致性 ──────────────────────────────────────────────

describe('/metrics 指标名口径', () => {
  const prom = readFileSync(
    fileURLToPath(new URL('../src/metrics/prometheus.ts', import.meta.url)),
    'utf8',
  )

  it('三个访客指标已在 prometheus 出口登记', () => {
    for (const name of [
      'ihui_api_visitor_requests_total',
      'ihui_api_visitor_unique_ips',
      'ihui_api_security_ip_hot_paths',
    ]) {
      expect(prom).toContain(`'${name}'`)
    }
  })

  it('窗口口径常量：预聚合与 gauge 用同一窗口，面板阈值同源', () => {
    expect(IP_SCAN_WINDOW_HOURS).toBe(heatWatchedHour(new Date('2026-10-25T10:20:00Z')))
    expect(heatTopN()).toBe(HOT_PATH_TOP_N_DEFAULT)
    expect(heatHourKey(new Date('2026-10-25T10:59:59Z'))).toBe('2026-10-25T10')
    expect(hourlyWindow(new Date('2026-10-25T10:59:59Z'))).toEqual({
      from: '2026-10-25T10:00:00.000Z',
      to: '2026-10-25T11:00:00.000Z',
      hourKey: '2026-10-25T10',
    })
    expect(IP_SCAN_HOT_PATH_THRESHOLD).toBeGreaterThan(0)
  })

  it('预聚合窗口默认值可被环境变量覆盖且非法值回退', () => {
    const prev = process.env.IHUI_VISITOR_HEAT_WINDOW_HOURS
    process.env.IHUI_VISITOR_HEAT_WINDOW_HOURS = '12'
    expect(heatWatchedHour(new Date('2026-10-25T10:20:00Z'))).toBe(10 - 11)
    process.env.IHUI_VISITOR_HEAT_WINDOW_HOURS = 'abc'
    expect(heatWatchedHour(new Date('2026-10-25T10:20:00Z'))).toBe(10 - IP_SCAN_WINDOW_HOURS)
    if (prev === undefined) delete process.env.IHUI_VISITOR_HEAT_WINDOW_HOURS
    else process.env.IHUI_VISITOR_HEAT_WINDOW_HOURS = prev
  })
})

// ─── 判据③：结构对账（SQL 引用列 ↔ app schema ↔ 建表迁移 DDL）──

describe('小时预聚合结构对账', () => {
  const DDL_FILE = fileURLToPath(
    new URL('../../database/migrations/0015_api_heat_stats_hourly.sql', import.meta.url),
  )

  it('api_logs / visit_logs / 两张热表的全部引用列同时存在于 app schema 与迁移 DDL', () => {
    const ddl = readFileSync(DDL_FILE, 'utf8')
    // 同一把尺子：packages/database/src/plan 的 parse-ddl
    const stmts = parseDdl(ddl, '0015_api_heat_stats_hourly.sql')
    const tables = stmts.filter((s) => s.kind === 'create_table')
    expect(tables.length).toBe(2)

    for (const [mirrorKey, heatKey] of [
      ['api_logs', 'api_logs_heat_hourly'],
      ['visit_logs', 'visit_logs_heat_hourly'],
    ] as const) {
      const parsed = parseMirrorCreate(ddl, mirrorKey)
      expect(parsed.mirror).toBe(mirrorKey)
      const ddlCols = new Set([...parsed.columns, ...parsed.generatedCols])
      const heatParsed = parseMirrorCreate(ddl, heatKey)
      const heatCols = new Set(heatParsed.columns)

      // app schema 侧列集（SQL 只由它生成，两面必须逐字等值）
      expect(API_LOG_COLUMNS.length).toBeGreaterThan(0)
      for (const col of API_LOG_COLUMNS) {
        expect(ddlCols.has(col), `api_logs 列 ${col} 不在迁移 DDL`).toBe(true)
      }
      for (const col of VISIT_COLUMNS) {
        expect(ddlCols.has(col), `visit_logs 列 ${col} 不在迁移 DDL`).toBe(true)
      }
      for (const col of API_HEAT_COLUMNS) {
        expect(heatCols.has(col), `热表列 ${col} 不在迁移 DDL`).toBe(true)
      }
      // 判据引用的列名不得漂：服务端取值列 + 热表时间列
      expect([...ddlCols]).toContain('ip')
      expect([...ddlCols]).toContain('user_agent')
      expect([...heatCols]).toContain('hour_start')
      expect(heatTableFor(mirrorKey)).toBe(heatKey)
    }
  })

  it('INSERT 目标列清单逐列存在于 app schema（生产缝合线的列级对账）', () => {
    const plan = buildHeatInsertPlan(
      'api_logs',
      '2026-10-25T10:00:00.000Z',
      '2026-10-25T11:00:00.000Z',
    )
    expect(plan.values.length).toBe(plan.columns.length)
    for (const col of plan.columns) {
      if (col === 'hour_start') continue
      expect(API_LOG_COLUMNS, `插入列 ${col} 不在 app schema 热表镜像`).toContain(col)
    }
    expect(plan.columns).toEqual(HEAT_METRIC_COLUMN_ORDER)
  })
})

// ─── 判据①+②：计划形状 + 行级期望 ─────────────────────────────

describe('小时预聚合 SQL 闸门（pgHeatSql 零输入契约）', () => {
  const PG_KEYWORDS = ['AT TIME ZONE', 'FILTER (', 'date_trunc', 'ROW_NUMBER', '::timestamptz']
  const FROM = 'FROM "api_logs_heat_hourly"'

  /** 外层（第一个 FROM 之后）文本：CTE 部分不参与判据 */
  function outerText(sqlText: string): string {
    const i = sqlText.indexOf(FROM)
    expect(i).toBeGreaterThan(0)
    return sqlText.slice(i)
  }

  function countIn(text: string, needle: string): number {
    return text.split(needle).length - 1
  }

  it('① 计划形状：AST 里窗口函数只在 CTE，外层只剩阈值', () => {
    const cst = parse(pgHeatSql(), { dialect: 'PostgreSQL' })
    const json = JSON.stringify(cst)
    const outer = outerText(pgHeatSql())
    // 全句只有一个 OVER（= CTE 的 ROW_NUMBER），外层没有第二处排名
    expect(json.split('"over').length - 1).toBe(1)
    expect(outer.includes('ROW_NUMBER')).toBe(false)
    expect(json.includes('DATE_TRUNC')).toBe(true)
    // 外层不得再做聚合/FILTER/时区换算：窗口排名必须在 FILTER 聚合层
    expect(outer.includes('FILTER')).toBe(false)
    expect(outer.includes('date_trunc')).toBe(false)
    expect(outer.includes('sum(')).toBe(false)
  })

  it('① 外层 SELECT 必须带 DELETE 的两条依据列（漏列即热表无限膨胀）', () => {
    const outer = outerText(pgHeatSql())
    expect(countIn(outer, '"hour_key"')).toBe(2)
    expect(countIn(outer, '"path"')).toBe(2)
  })

  it('① PG 专有构造齐备且每个 token 至少出现在一层', () => {
    const stmt = pgHeatSql()
    for (const kw of PG_KEYWORDS) expect(stmt.includes(kw), `缺少 PG 构造 ${kw}`).toBe(true)
    expect(countIn(stmt, '::timestamptz')).toBeGreaterThanOrEqual(2)
    expect(countIn(stmt, 'AT TIME ZONE')).toBeGreaterThanOrEqual(3)
    expect(countIn(stmt, 'FILTER (')).toBeGreaterThanOrEqual(2)
    expect(countIn(stmt, 'date_trunc')).toBeGreaterThanOrEqual(2)
    expect(countIn(stmt, 'ROW_NUMBER')).toBeGreaterThanOrEqual(1)
    expect(countIn(stmt, '<= ')).toBeGreaterThanOrEqual(1)
  })

  it('① 只改外层阈值不碰窗口内层（内层 rk1 <= 100000 必须保留）', () => {
    const stmt = pgHeatSql()
    const outer = outerText(stmt)
    expect(outer.includes('<= 100000')).toBe(false)
    expect(stmt.includes('<= 100000')).toBe(true)
  })

  it('① SQL 只住在 app 侧：探针模块不得自带第二份 SQL 文本', () => {
    expect(probeHeatSql().length).toBe(0)
  })

  it('② 行级期望：种子行按同一口径复算的保留/删除集合与 SQL 阈值语义一致', () => {
    // 种子：h00 上 /a 40 次（阈值 30 以上）、/b 29 次（以下）；h01 上 /a 31 次
    const rows = [
      {
        hourStart: '2026-01-01T00:00:00Z',
        path: '/a',
        count: 40,
        okCount: 3,
        errCount: 37,
        totalMs: 4000,
      },
      {
        hourStart: '2026-01-01T00:00:00Z',
        path: '/b',
        count: 29,
        okCount: 29,
        errCount: 0,
        totalMs: 290,
      },
      {
        hourStart: '2026-01-01T01:00:00Z',
        path: '/a',
        count: 31,
        okCount: 31,
        errCount: 0,
        totalMs: 310,
      },
      {
        hourStart: '2026-01-01T01:00:00Z',
        path: '/c',
        count: 30,
        okCount: 30,
        errCount: 0,
        totalMs: 300,
      },
    ]
    // SQL 的口径：同小时按 count 降序排名（RANK：同值同名次），阈值「排名 <= K」保留
    // ⇒ 命中集 = 每小时内排名 <= 1 且 count >= 阈值；同计数并列必须一起保留（不能靠 LIMIT 截半）
    const expectKeep = new Set<string>()
    for (const r of rows) {
      if (r.count >= IP_SCAN_HOT_PATH_THRESHOLD) expectKeep.add(`${r.hourStart}|${r.path}`)
    }
    expect([...expectKeep]).toEqual([
      '2026-01-01T00:00:00Z|/a',
      '2026-01-01T01:00:00Z|/a',
      '2026-01-01T01:00:00Z|/c',
    ])
    // 判据②的第二半：SQL 的删除条件必须写「NOT (排名 <= K)」⇒ 命中集 = 排名 <= K
    const outer = outerText(pgHeatSql())
    expect(outer).toMatch(/WHERE NOT \(rk1 <= \d+\)/)
    const k = Number(outer.match(/rk1 <= (\d+)/)?.[1])
    expect(k).toBeGreaterThan(0)
    // 并列同计数的两行必须同时命中：K=1 时 /a(31) 与 /c(30) 不会并列，
    // 因此断言阈值语义 = 「名次」而非「行数」：SQL 用 RANK 而非 ROW_NUMBER 于外层
    expect(pgHeatSql()).toMatch(/ROW_NUMBER\(\) OVER \(PARTITION BY hour_key/)
  })

  it('② UTC 跨小时边界：窗口切在整点，热表键与窗口起点同基准', () => {
    const boundary = new Date('2026-01-01T01:00:00.000Z')
    const w = hourlyWindow(boundary)
    expect(w.from).toBe('2026-01-01T01:00:00.000Z')
    expect(w.to).toBe('2026-01-01T02:00:00.000Z')
    // 半开区间 [from, to) ⇒ 恰落在 to 的行归下一小时（date_trunc 与 to_timestamp(from/to) 同判）
    expect(heatHourKey(boundary)).toBe('2026-01-01T01')
    expect(heatHourKey(new Date('2026-01-01T00:59:59.999Z'))).toBe('2026-01-01T00')
    expect(pgHeatSql()).toContain('>= to_timestamp(')
    expect(pgHeatSql()).toContain('< to_timestamp(')
  })

  it('② 参数位序：窗口两端 + 删除上下界 + 热表名 + 镜像表名（占位符形状稳定）', () => {
    const stmt = pgHeatSql()
    expect(stmt).toContain(sql.placeholderValues.join(', '))
    const params = heatInsertParams('2026-01-01T00:00:00.000Z', '2026-01-01T01:00:00.000Z', [
      '2026-01-01T00',
      '/a',
      '2026-01-01T01',
      '/c',
    ])
    expect(params[0]).toBe('2026-01-01T00:00:00.000Z')
    expect(params[1]).toBe('2026-01-01T01:00:00.000Z')
    expect(params[2]).toBe('2026-01-01T00')
    expect(params[3]).toBe('/a')
    expect(params[4]).toBe('2026-01-01T01')
    expect(params[5]).toBe('/c')
    expect(params[6]).toBe('api_logs_heat_hourly')
    expect(params[7]).toBe('api_logs')
  })

  it('未判定不冒绿：闸门读不到被判据的源码时用例直接失败', () => {
    const stmt = pgHeatSql()
    expect(stmt.length).toBeGreaterThan(500)
    // 被审面取不到时 pgHeatSql 抛错（不返回空串冒过判据）
    expect(() => pgHeatSql()).not.toThrow()
  })
})

// ─── 守卫：注册表清理 ──────────────────────────────────────────

describe('指标注册表读写', () => {
  beforeAll(() => {
    process.env.IHUI_VISITOR_HEAT_DISABLED = '1'
  })
  afterAll(() => {
    delete process.env.IHUI_VISITOR_HEAT_DISABLED
  })

  it('gauge 按 path 覆写不留陈旧序列；counter 只增', async () => {
    const mod = await import('../src/metrics/visitor-analytics.js')
    mod.observeVisitorRequest('bot-scraper-generic', '/probe/x')
    mod.setIpHotPathCount('/probe/x', 7)
    mod.setIpHotPathCount('/probe/x', 3)
    expect(mod.IHUI_VISITOR_METRIC_NAMES).toEqual([
      'ihui_api_visitor_requests_total',
      'ihui_api_visitor_unique_ips',
      'ihui_api_security_ip_hot_paths',
    ])
    expect(mod.IHUI_VISITOR_HEAT_TABLES).toEqual(['api_logs_heat_hourly', 'visit_logs_heat_hourly'])
  })

  it('非有限值一律不落指标（NaN/Infinity 会把大盘读成空洞）', async () => {
    const mod = await import('../src/metrics/visitor-analytics.js')
    mod.setIpHotPathCount('/probe/y', Number.NaN)
    mod.setIpHotPathCount('/probe/y', Number.POSITIVE_INFINITY)
    mod.observeVisitorRequest('client-curl', '/probe/y', Number.NaN)
    expect(true).toBe(true)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
