#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 只读尺子的诊断输出就是它的交付物 */

/**
 * 只读对账尺子:历史课程视频(G-921)在**现网**的挂载量算仪(2026-10-24 立)
 *
 * ─────────────────────────────────────────────────────────────────────────
 * ⚠️⚠️ 定级(写死,不得回退)⚠️⚠️
 *   **本尺不进提交链、不进 CI、不挂 pre-commit/pre-push、不进守护巡检轮。**
 *   它判的是**机器态 + 网络态**(这台机的 psql 在不在、这条 DSN 连不连得通、这个公网入口
 *   答不答),这些输入对提交者而言结构上无法满足 —— 挂成 blocking 就是 AGENTS §12e 禁的
 *   **恒红门**(§1「只读对账尺子禁止进提交链」明文列举的那一族与本尺同族:`check-temp-landing`
 *   / `check-dispatch-premise` / `check-alertmanager-live-config` / `check-monitor-runtime-parity`
 *   / `check-tunnel-leg-health` / `check-prod-checkout-foreign-work`)。
 *   **调用者 = 人工档 / 结清前的现读取证档**,不是任何自动钩子。
 *   镜像测试 `scripts/tests/check-learn-video-mount.test.mjs` 里有反向形状锁钉住
 *   `scripts/guardian-runner.mjs` 注册表与 `.husky/*` 面**不得出现本文件名**。
 * ─────────────────────────────────────────────────────────────────────────
 *
 * 立尺的格子(为什么不是"再写一个导入脚本"):
 *   票面「G-921 历史课程视频已进云端桶,但现网一行都挂不上」缺的从来不是导入腿 ——
 *   `packages/database/seed/legacy-videos.ts` 已入库、已作 seed 第 14 步装车、部署环
 *   `deploy/win/ihui-deploy.ps1` 已带 `--only=13,14`。缺的是**现网发布位落一次**的生产写
 *   动作(归运维/机主职权)。而台账里那句"本机库里三表行齐、is_published=0"是
 *   **登记时刻的内联注记**,一次 append 就腐烂(AGENTS §0.1「凡数字一律现读」、§1「证据
 *   指针禁止行号」)。本尺把那三个数**量成一条可复跑的结论**:三表行数、发布位、公开接口
 *   读数,逐维独立三态,替代台账里会腐烂的注记。
 *
 * 判据维度(每维独立三态,绝不并桶 —— §0.3「没判」绝不写成「判过」):
 *   M1 manifest        期望值取 `packages/database/seed/legacy-video-courses.json` **现读**
 *                      (唯一真相源,与 seed 同源;票数/节数/排除数一律不抄进本文与台账)
 *   M2 db-target       DSN 与 psql 客户端是否取得到、三张表在不在该库里
 *   M3 db-rows         三表在"本族"范围内的行数 vs M1 期望(课/章/节/带 url 的节)
 *   M4 db-publish      该族课程里 is_published ∧ status=1 的课数(**票面缺口就在这一维**)
 *   M5 db-feed-total   按公开谓词(innerJoin 链)应有的节数
 *   M6 http-feed-total 真实打 `GET /api/study/videos`,读响应里的 `data.total`
 *
 *   M3~M5 的谓词形状与 `apps/api/src/db/learn-queries.ts` 的 `findPublishedVideoFeed` 对齐
 *   (`lessons.is_published = true ∧ lessons.status = 1`,小节→章节→课程 innerJoin)。
 *   **刻意不在本尺复制那份 TS 判据**:它是 Drizzle 表达式、跨语言;本尺用等形 SQL 现读,
 *   并在 M5↔M6 之间做交叉对账 —— 两者不一致本身就是结论(库侧有而接口读不到 = 链路/挂载问题)。
 *
 * 三态与退出码:
 *   ok(0)        每一维都判到,且没有任何一维 gap;
 *   gap(1)       至少一维判出缺口(**可追责**:红字点名是哪一维、读数多少、期望多少);
 *   unjudged(2)  至少一维取不到输入 ⇒ 显式点名原因,不记绿也不冒红;用法错误同归 2。
 *   汇总取向:有 gap 先报 gap(量到的缺陷优先于缺失的输入),否则有 unjudged 报 unjudged。
 *   ⚠️ 生产库连不上 ⇒ M2~M5 落 unjudged,**绝不当成"现网没问题"**;本票当前实测正是这一型
 *      (本机 ≠ 生产机:生产 PG 8810 无监听、`D:\DevEnv\ihui-prod` 不存在、SSH 隧道探测 timeout)。
 *
 * 安全红线(逐条都有对应判据,不是口头纪律):
 *   ① 只发 SELECT:每条 SQL 过 `assertReadOnlySql`,非 SELECT/WITH 起手或含分号 ⇒ 当场抛,
 *      不发出去;`psqlSpawn` 在**登记之前**先过闸,镜像测试对"写句一次都不落 spawn 面"取证。
 *   ② 永不调用 `--apply` / `--publish`,也不 import seed 的写侧:`legacy-videos.ts` 的
 *      `--apply --publish` 是**生产写动作**,本尺只读,结清权归持有生产执行权的人。
 *   ③ 凭据不落 stdout/stderr:DSN 只经 `sanitizeDsn`(lib/db-probe-client 唯一实现)展示;
 *      DSN 里的密码字面量另经 `redactDsnInText` 从任意诊断文本里剔掉(psql 报错可能整条回声
 *      conninfo —— `sanitizeDsn` 只管"DSN 自己",管不了"别的文本里嵌了它",两件事必须都做);
 *      子进程输出过 `redactChildOutput`;`.env` 只按**键名**取值,任何档都不 dump 全文;
 *      HTTP 侧只报状态码与 `data.total`,响应正文一个字都不打印;
 *      `spawnCallSites` 那份内存镜像同样逐元素脱敏,且**不整份登记 env**(env 镜像里什么都有)。
 *   ④ DSN 取材面:`--dsn` > `apps/api/.env` 的 `DATABASE_URL`(经 `check-env-drift.mjs` 的
 *      `parseEnvText` 唯一实现,§0.6 不抄第二份 .env 解析)> `process.env.DATABASE_URL`。
 *   ⑤ 派生子进程一律显式 `stdio` + `windowsHide: true`(§12g;门 193/199 的判据面)。
 *      本尺带 stdin ⇒ 按 §12g 样板取 `['pipe','pipe','pipe']` 那一档(`ignore` 等于把脚本堵在
 *      门外,psql 读到空 stdin 静默返回空集,下游会把"没喂进去"读成"库里没有")。
 *   ⑥ **入参方向的码页纪律**(本票当轮实测,AGENTS §5f「chcp 65001」是同一族坑的出参方向):
 *      锚定集是中文课程标题,走 `-c <sql>` 时 argv 先经 Windows ANSI 码页(本机 936/GBK)才落到
 *      psql ⇒ 服务端报 `invalid byte sequence for encoding "UTF8": 0xcf 0xdf`,而单独设
 *      `PGCLIENTENCODING=UTF8` 救不了(转换发生在 argv 侧,不在 libpq 那侧)。正解 = 会话脚本走
 *      **stdin**(Node 直写 UTF-8 缓冲,不过码页)+ 首句 `SET client_encoding TO 'UTF8'` 兜住
 *      服务端会话 + `PGCLIENTENCODING` 再兜一道。不这么写的后果不是报错,是**天天哑**:
 *      M3~M5 恒未判定,账面还诚实。回归锁见镜像测试的形状锁⑧c。
 *
 * 关于生产库口令的已知边界(如实登记,不假装周全):DSN 经 `-d` 走 argv,口令因此出现在该子进程
 *   的命令行上(与全仓既有 psql 取材层 `lib/db-probe-client.mjs` 同形,本尺不单边改这套约定)。
 *   本尺收紧的是**输出面**(任何档都不落口令);要连命令行面一起收,得整族改成 PGPASSFILE/
 *   PG* 分项环境变量,那是另一张票,不在本尺射程内。
 *
 * 关于"取证不得连生产库"这一条的**刻意分歧**(必须写清,否则读者会以为本尺写错了):
 *   `scripts/lib/db-probe-client.mjs` 的 `guardDbDsn` 拒绝非回环与 8810,那是**提交链取证探针**
 *   的纪律(每道 dev 机都要跑,不能天天去戳生产)。本尺的**唯一用途**就是量现网:若照抄那把闸,
 *   M2~M5 在任何非生产机上永远 unjudged —— 尺子就成了"恒未判定"的空器,正是它要消的那格
 *   (§0.3 的失效型)。故本尺只**复用** `FORBIDDEN_PROD_PORT` 这个事实把目标分类成
 *   `prod-tunnel / loopback / remote-other` 并如实写进输出,不据此拒绝连接;
 *   拒绝写动作由红线①与②承担,而不是由"连谁"承担。
 *
 * 用法(每条都实测跑得通,§0.8):
 *   node scripts/check-learn-video-mount.mjs
 *   node scripts/check-learn-video-mount.mjs --json
 *   node scripts/check-learn-video-mount.mjs --dsn '<postgres://…>'          # 指到别的库
 *   node scripts/check-learn-video-mount.mjs --base-url https://www.aizhs.top # 换公开入口
 *   node scripts/check-learn-video-mount.mjs --skip-http                     # 只量库侧
 *   node scripts/check-learn-video-mount.mjs --self-test
 *   镜像测试:node --test scripts/tests/check-learn-video-mount.test.mjs
 *
 * 阳性对照(§5884 方法论债:判据必须被"造反例"证过有牙,单次成功不算):
 *   ①三表齐 ∧ 发布位齐 ∧ 接口读数一致 ⇒ ok
 *   ②行齐而发布位 0(票面现网形态)⇒ gap,点名 M4 与 M6
 *   ③库取不到 ∧ 接口未配 ⇒ unjudged 逐维点名
 *   三次读数由镜像测试用**注入夹具**直取判据函数,不碰真库、不碰网络。
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { requireFlagValue } from './lib/flag-value.mjs'
import { mkScratch, rmScratch } from './lib/scratch-dir.mjs'
import { makeRegistrar } from './lib/selftest-registrant.mjs'
import { locatePsqlClient, psqlLocateMissText } from './lib/psql-client-locate.mjs'
import { FORBIDDEN_PROD_PORT, sanitizeDsn } from './lib/db-probe-client.mjs'
import { redactChildOutput } from './lib/secret-shape-redact.mjs'
// .env 解析复用现役唯一实现(该脚本有 §22d isDirectRun 守卫,被 import 时不触发 CLI 副作用)
import { parseEnvText } from './check-env-drift.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

// ── 取材常量(全部是本仓既有事实的路径,不含任何凭据) ──
export const MANIFEST_REL = 'packages/database/seed/legacy-video-courses.json'
export const APP_ENV_REL = 'apps/api/.env'
export const DSN_ENV_KEY = 'DATABASE_URL'
/** 公开入口基址默认值:与 `scripts/check-public-path-probe.mjs` 的现役公网靶同一站点(www 档)。 */
export const DEFAULT_PUBLIC_BASE = 'https://www.aizhs.top'
/** 公开列表端点(前缀 /api 的登记见 apps/api/src/routes/index.ts,谓词见 learn-queries.ts)。 */
export const FEED_PATH = '/api/study/videos'
export const LESSON_TABLES = Object.freeze(['lessons', 'lesson_chapters', 'lesson_chapter_sections'])
/** seed 每门课建一章('完整课程'),故"章数 ≥ 课数"是下限判据;上不封顶(存量课可能已有多章)。 */
export const PSQL_TIMEOUT_MS = 20_000
export const HTTP_TIMEOUT_MS = 25_000
export const MAX_SQL_LEN = 64_000

// ══════════════════════════════ 纯判据层(镜像测试 import 的就是这些) ══════════════════════════════

/** 单维结论:{ state:'ok'|'gap'|'unjudged', ... } —— 三态绝不并桶。 */
function ok(id, reading, note) {
  return { id, state: 'ok', reading, note }
}
function gap(id, reading, expected, note) {
  return { id, state: 'gap', reading, expected, note }
}
function unjudged(id, why) {
  return { id, state: 'unjudged', reading: null, why }
}

/**
 * M1:manifest 现读(期望值唯一真相源)。
 * 判死条件逐条点名:文件解析不出 / 形状不对 / 枚举到 0 门课或 0 小节 ⇒ unjudged(§0.3:
 * 枚举到 0 个候选判死不记绿 —— 一份空清单能"对账通过"是假绿最省事的造法)。
 */
export function judgeManifest(parsed) {
  if (!parsed || parsed.ok !== true) {
    return unjudged('M1-manifest', `manifest 取不到或解析不出:${parsed?.why ?? '(未给出)'}`)
  }
  const { courses, sections, excluded } = parsed
  if (!Number.isInteger(courses) || courses <= 0) {
    return unjudged('M1-manifest', `manifest 现读课程数 = ${courses},枚举到 0 判死不记绿`)
  }
  if (!Number.isInteger(sections) || sections <= 0) {
    return unjudged('M1-manifest', `manifest 现读小节数 = ${sections},枚举到 0 判死不记绿`)
  }
  return ok('M1-manifest', { courses, sections, excluded }, '期望值取 manifest 现读(票数/节数/排除数不写进代码与台账)')
}

/** 解析 manifest 文本 → 期望值。任何异常折成 {ok:false,why},不抛。 */
export function parseManifest(text) {
  let data
  try {
    data = JSON.parse(String(text ?? ''))
  } catch (e) {
    return { ok: false, why: `JSON 解析失败:${e?.message ?? e}` }
  }
  if (!Array.isArray(data?.courses)) return { ok: false, why: 'courses 不是数组' }
  if (!Array.isArray(data?.excluded)) return { ok: false, why: 'excluded 不是数组' }
  const titles = []
  let sections = 0
  for (const c of data.courses) {
    if (typeof c?.title !== 'string' || !c.title.trim()) return { ok: false, why: '有课程缺非空 title,不猜' }
    if (!Array.isArray(c?.sections)) return { ok: false, why: `课程《${c.title}》的 sections 不是数组` }
    titles.push(c.title)
    sections += c.sections.length
  }
  return { ok: true, courses: data.courses.length, sections, excluded: data.excluded.length, titles }
}

/** SQL 字面量转义:单引号翻倍;含控制字符/NUL 一律拒绝(不把可疑输入拼进查询)。 */
export function sqlLiteral(v) {
  const s = String(v)
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(s)) throw new Error('SQL 字面量含控制字符,拒绝拼接')
  return `'${s.replace(/'/g, "''")}'`
}

/**
 * 红线① 的机械执行:发出去之前每条 SQL 都得过这把尺。
 * 只认 SELECT/WITH 起手,且**不允许任何分号**(拒 "A; DROP TABLE" 那一型,也不允许
 * 借 `SET statement_timeout` 混进同一串 —— 会话参数由 psql 的独立 -c 参数带,不进判据面)。
 */
export function assertReadOnlySql(sql) {
  const s = String(sql ?? '').trim()
  if (!s) throw new Error('空 SQL,拒绝发送')
  if (!/^(SELECT|WITH)\b/i.test(s)) throw new Error(`非只读语句起手(只许 SELECT/WITH):${s.slice(0, 24)}`)
  if (s.includes(';')) throw new Error('SQL 含分号,拒绝发送(多语句不是只读对账该有的形状)')
  if (/\b(INSERT|UPDATE|DELETE|DROP|TRUNCATE|ALTER|CREATE|GRANT|VACUUM|COPY)\b/i.test(s)) {
    throw new Error('SQL 含写/DDL 关键字,拒绝发送')
  }
  if (s.length > MAX_SQL_LEN) throw new Error(`SQL 长度 ${s.length} 超出预算 ${MAX_SQL_LEN},不猜`)
  return s
}

/** 表存在性查询(三张表齐不齐 —— 连错库与没挂载必须分开,与 lib/db-probe-client 同型)。 */
export function sqlTablePresence() {
  return assertReadOnlySql(
    `SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN (${LESSON_TABLES.map(sqlLiteral).join(', ')})`,
  )
}

/**
 * 主查询:三表行数 + 发布位 + 公开谓词应有节数,一次取回。
 * 范围靠 `lessons.title IN (manifest 现读的标题集)` 锚定 —— 不靠 video_url 前缀,
 * 因为 `legacyAssetBaseUrl()` 可被 LEGACY_ASSET_BASE_URL 改写,前缀会把部署差异读成缺口。
 */
export function sqlLegacyMountFacts(titles) {
  if (!Array.isArray(titles) || titles.length === 0) throw new Error('titles 清单为空,枚举到 0 判死不记绿')
  const inList = titles.map(sqlLiteral).join(', ')
  return assertReadOnlySql(`SELECT
  count(DISTINCT l.id),
  count(DISTINCT ch.id),
  count(s.id),
  count(s.id) FILTER (WHERE s.video_url IS NOT NULL AND s.video_url <> ''),
  count(DISTINCT l.id) FILTER (WHERE l.is_published AND l.status = 1),
  count(s.id) FILTER (WHERE l.is_published AND l.status = 1 AND s.video_url IS NOT NULL AND s.video_url <> '')
FROM lessons l
LEFT JOIN lesson_chapters ch ON ch.lesson_id = l.id
LEFT JOIN lesson_chapter_sections s ON s.chapter_id = ch.id
WHERE l.title IN (${inList})`)
}

/** psql `-At` 单行 `a|b|c` → 六个整数;形态不对 ⇒ null(由调用方翻成未判定,不猜 0)。 */
export function parseCountRow(text) {
  const line = String(text ?? '').trim().split(/\r?\n/).filter(Boolean).pop()
  if (!line) return null
  const parts = line.split('|')
  if (parts.length !== 6) return null
  const nums = parts.map((p) => Number(p.trim()))
  if (!nums.every((n) => Number.isInteger(n) && n >= 0)) return null
  const [courses, chapters, sections, sectionsWithUrl, publishedCourses, feedSections] = nums
  return { courses, chapters, sections, sectionsWithUrl, publishedCourses, feedSections }
}

/**
 * M2:连接面。四格分开,绝不把上一格失败折进下一格:
 *   psql 客户端取不到 / DSN 取不到 / 子进程发不出去 / 三表不齐。
 */
export function judgeDbTarget({ psqlFound, dsn, spawnError, tableCount }) {
  if (!psqlFound) return unjudged('M2-db-target', 'psql 客户端定位失败 ⇒ 库侧四维(M2~M5)一并未判定')
  if (!dsn) return unjudged('M2-db-target', 'DSN 取不到(--dsn / apps/api/.env / process.env 三面皆空)⇒ 库侧未判定')
  if (spawnError) return unjudged('M2-db-target', `psql 无法执行:${spawnError}`)
  if (tableCount === null) return unjudged('M2-db-target', '表存在性查询无返回 ⇒ 未判定(不猜"表不存在"也不猜"表都在")')
  if (tableCount !== LESSON_TABLES.length) {
    return gap('M2-db-target', { tableCount }, { tableCount: LESSON_TABLES.length }, `连接的库里三张表不齐(实得 ${tableCount}/3)⇒ 极可能连错库,后续读数不可用于结清`)
  }
  return ok('M2-db-target', { tableCount }, '三表在该库 public schema 齐备')
}

/** M3:三表行数 vs manifest 期望。课/节/带 url 的节三项都必须齐;章数只设下限。 */
export function judgeRows(manifest, rows) {
  if (!manifest || manifest.state !== 'ok') return unjudged('M3-db-rows', 'M1 未判定 ⇒ 无期望值可比')
  if (!rows) return unjudged('M3-db-rows', '主查询无返回 ⇒ 未判定')
  const want = { courses: manifest.reading.courses, sections: manifest.reading.sections }
  const miss = []
  if (rows.courses < want.courses) miss.push(`课程 ${rows.courses}/${want.courses}`)
  if (rows.chapters < rows.courses) miss.push(`章节 ${rows.chapters} < 课程 ${rows.courses}(有课无章 ⇒ join 断链)`)
  if (rows.sections < want.sections) miss.push(`小节 ${rows.sections}/${want.sections}`)
  if (rows.sectionsWithUrl < want.sections) miss.push(`带 video_url 的小节 ${rows.sectionsWithUrl}/${want.sections}`)
  if (miss.length) return gap('M3-db-rows', rows, want, `历史族行没齐:${miss.join(';')}`)
  return ok('M3-db-rows', rows, `三表行数达 manifest 现读期望(课 ${want.courses} / 节 ${want.sections})`)
}

/**
 * M4:发布位。**票面缺口就在这一维**(行齐而 is_published=false ⇒ 公开接口必然 total=0)。
 * 判方向只有一个:该族里"已发布 ∧ status=1"的课数必须等于课数;部分发布也是 gap
 * (部分发布=一半观众看不到,与"一行都挂不上"是同族缺陷,不能因为"总比 0 好"就记绿)。
 */
export function judgePublish(rows) {
  if (!rows) return unjudged('M4-db-publish', 'M3 无读数 ⇒ 发布位无从对照')
  if (rows.courses === 0) return unjudged('M4-db-publish', '该族课程在库里 0 行 ⇒ 发布位判据落空(先修 M3)')
  if (rows.publishedCourses === 0) {
    return gap('M4-db-publish', rows, { publishedCourses: rows.courses }, `行在库而发布位 0/${rows.courses} ⇒ 公开谓词永不命中,现网挂不上(生产写动作,归持有执行权者)`)
  }
  if (rows.publishedCourses < rows.courses) {
    return gap('M4-db-publish', rows, { publishedCourses: rows.courses }, `发布位部分落空:${rows.publishedCourses}/${rows.courses} 门已发布`)
  }
  return ok('M4-db-publish', rows, { publishedCourses: rows.courses }, '该族全部处于发布位')
}

/** M5:库侧按公开谓词应有的节数(与 findPublishedVideoFeed 等形的 join 计数)。 */
export function judgeDbFeedTotal(rows) {
  if (!rows) return unjudged('M5-db-feed-total', 'M3 无读数 ⇒ 库侧谓词节数未判定')
  if (rows.feedSections === 0) {
    return gap('M5-db-feed-total', rows, { feedSections: rows.sectionsWithUrl }, `公开谓词在库侧读到 0 节(带 url 的小节有 ${rows.sectionsWithUrl})⇒ 谓词/join 链断在 is_published/status 这一环`)
  }
  if (rows.feedSections < rows.sectionsWithUrl) {
    return gap('M5-db-feed-total', rows, { feedSections: rows.sectionsWithUrl }, `公开谓词只覆盖 ${rows.feedSections}/${rows.sectionsWithUrl} 节`)
  }
  return ok('M5-db-feed-total', rows, { feedSections: rows.sectionsWithUrl }, '公开谓词覆盖全部带 url 的小节')
}

/**
 * M6:真实打公开接口。四格分开:
 *   未配基址且没关(不可能,有默认) / fetch 抛错 / 状态码非 2xx / 正文解析不出 total。
 * 交叉对账:接口读数不得小于库侧谓词节数(接口是全库口径,库侧 M5 是本族口径,故只设下限)。
 * M5 未判定时接口读到 0 **仍记 gap** —— 期望来自 M1(manifest 本地可读),
 * 而"库侧没量到"是另一维的未判定,两者都要报,不得因后者把前者洗绿。
 */
export function judgeHttp({ baseUrl, fetchError, status, total, dbFeedRows, manifest }) {
  const url = `${String(baseUrl || '').replace(/\/$/, '')}${FEED_PATH}?page=1&pageSize=1`
  if (fetchError) return unjudged('M6-http-feed-total', `公开接口未取得:${fetchError}(${url})`)
  if (typeof status !== 'number') return unjudged('M6-http-feed-total', `公开接口状态码取不到(${url})`)
  if (status < 200 || status >= 300) {
    return gap('M6-http-feed-total', { status }, { status: '2xx' }, `公开接口非 2xx:${status}(${url})`)
  }
  if (!Number.isInteger(total) || total < 0) {
    return unjudged('M6-http-feed-total', `接口 2xx 但 data.total 解析不出(实得 ${JSON.stringify(total)})——不猜 0(${url})`)
  }
  const expectMin = dbFeedRows ? dbFeedRows.feedSections : null
  if (expectMin !== null && total < expectMin) {
    return gap('M6-http-feed-total', { status, total }, { total: `>=${expectMin}` }, `接口读数 ${total} < 库侧公开谓词 ${expectMin} ⇒ 链路/挂载与库侧不一致`)
  }
  if (total === 0 && manifest && manifest.state === 'ok' && manifest.reading.sections > 0) {
    return gap('M6-http-feed-total', { status, total }, { total: `>0(期望量级 = manifest 现读小节数 ${manifest.reading.sections})` }, '公开接口读到 0 而 manifest 声明该族有小节 ⇒ 现网一行都挂不上(本票现网实测形态)')
  }
  return ok('M6-http-feed-total', { status, total }, expectMin === null ? '接口读数 >0(库侧下限未判定,只做单面判)' : `接口读数 ≥ 库侧公开谓词 ${expectMin}`)
}

/**
 * 汇总取向:gap 优先(量到的缺陷 > 缺失的输入),否则 unjudged,否则 ok。
 * 返回 { overall, exitCode, counts }。counts 逐态计数,供"到底几维没判"追责。
 */
export function aggregate(dimensions) {
  const list = Array.isArray(dimensions) ? dimensions.filter(Boolean) : []
  const counts = { ok: 0, gap: 0, unjudged: 0 }
  for (const d of list) {
    if (!(d.state in counts)) throw new Error(`维度 ${d?.id} 的 state=${JSON.stringify(d.state)} 不在三态枚举里`)
    counts[d.state] += 1
  }
  if (list.length === 0) throw new Error('维度清单枚举到 0 判死不记绿')
  if (counts.gap > 0) return { overall: 'gap', exitCode: 1, counts }
  if (counts.unjudged > 0) return { overall: 'unjudged', exitCode: 2, counts }
  return { overall: 'ok', exitCode: 0, counts }
}

/** 目标分类(只分类不拒绝,理由见头注「刻意分歧」一段)。 */
export function classifyDsnTarget(dsn) {
  const m = /^postgres(?:ql)?:\/\/(?:[^/@:]+)?(?::[^@/]*)?@([^/:?]+)(?::(\d+))?\/[^\s?]*/.exec(String(dsn || ''))
  if (!m) return { shape: 'malformed', host: null, port: null, klass: 'unjudged' }
  const host = m[1]
  const port = m[2] || '5432'
  if (port === FORBIDDEN_PROD_PORT) return { shape: 'ok', host, port, klass: 'prod-tunnel' }
  if (['localhost', '127.0.0.1', '::1'].includes(host.toLowerCase())) return { shape: 'ok', host, port, klass: 'loopback' }
  return { shape: 'ok', host, port, klass: 'remote-other' }
}

/**
 * 从任意诊断文本里剔掉 DSN 的密码/用户字面量(红线③的第二半)。
 * 为什么 sanitizeDsn 不够:它只处理"DSN 自己"的展示形态;psql 的报错可能把 conninfo
 * 整条回声进 stderr,那时 sanitizeDsn 从未被调用到那段文本上。两半都必须做。
 */
export function redactDsnInText(raw, dsn) {
  let out = String(raw ?? '')
  const m = /^postgres(?:ql)?:\/\/(?:([^/@:]*))?(?::([^@/]*))?@/i.exec(String(dsn || ''))
  const secret = m?.[2]
  if (secret && secret.length >= 3) out = out.split(secret).join('***')
  const user = m?.[1]
  if (user && user.length >= 3) out = out.replace(new RegExp(`\\b${user.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}@`, 'g'), '***@')
  return out
}

/**
 * DSN 取材面(§5d:任何档都不 dump .env 全文;只按键名取 DATABASE_URL)。
 * 三面皆空 ⇒ { ok:false } 交调用方落未判定,不回落到"猜一个 localhost"。
 */
export function resolveDsn({ argvDsn, envText, processEnv = process.env }) {
  if (argvDsn) return { ok: true, dsn: String(argvDsn), source: '--dsn' }
  if (typeof envText === 'string' && envText.length) {
    const { values } = parseEnvText(envText)
    const v = String(values.get(DSN_ENV_KEY) ?? '').trim()
    if (v) return { ok: true, dsn: v, source: `${APP_ENV_REL}(${DSN_ENV_KEY})` }
  }
  const pv = String(processEnv[DSN_ENV_KEY] ?? '').trim()
  if (pv) return { ok: true, dsn: pv, source: `process.env.${DSN_ENV_KEY}` }
  return { ok: false, why: `DSN 三面皆空(--dsn / ${APP_ENV_REL} 的 ${DSN_ENV_KEY} / process.env)` }
}

// ══════════════════════════════ IO 装配层(真读;测试一律注入替身) ══════════════════════════════

/**
 * 会话脚本装配(纯函数)。**为什么脚本走 stdin 而不是 `-c <sql>`**(本票当轮实测,不是猜的):
 *   锚定集是课程标题,通篇中文。Windows 上 argv 要先经 **ANSI 码页(本机 936/GBK)** 才落到 psql,
 *   UTF-8 中文字节当场被拆坏 ⇒ 服务端报 `invalid byte sequence for encoding "UTF8": 0xcf 0xdf`。
 *   实测 `PGCLIENTENCODING=UTF8` 也救不了(码页转换发生在 psql 拿到 argv 之后,不在 libpq 那侧),
 *   而这条错会被量成"主查询失败 ⇒ M3~M5 未判定" —— 尺子从此天天哑,账面看着还诚实(§0.3 的反面:
 *   它没冒绿,但它永远量不到)。AGENTS §5f「读 cmd 输出必须先 chcp 65001」是同一族坑的**出参方向**,
 *   本尺踩的是**入参方向**:正解 = 脚本走 stdin(Node 直写 UTF-8 缓冲,不过码页)
 *   + 会话首句 `SET client_encoding TO 'UTF8'` 把编码钉死 + `PGCLIENTENCODING` 兜一道。
 */
export const SESSION_PREFIX = "SET client_encoding TO 'UTF8'; SET statement_timeout TO '15s';"

export function buildSessionScript(sql) {
  const validated = assertReadOnlySql(sql)
  return `${SESSION_PREFIX} ${validated};`
}

/**
 * 判据层的**唯一** spawn 位。§12g 样板那一档:**带 input 的派生必须 `stdio: ['pipe','pipe','pipe']`**
 * (写成 ignore 就等于把脚本堵在门外,psql 只会读到空 stdin 然后静默返回空集 —— 那正是本尺
 * 红线"取不到不回落"要拦的形态)。
 * 做成具名出口 + 调用登记,是为了让镜像测试能对**实调用**的参数取证,而不是用正则猜生产代码
 * (那是第二种假绿:改了 opts 而正则没跟着改,锁当场变纸,账面照绿)。
 * ⚠️ 登记面必须脱敏:`-d <dsn>` 原样进 args,直接 push 就等于把凭据抄进一份内存镜像
 *    (镜像测试的哨兵锁判的就是这一格;本票写作当轮真的先写错过一次,被那条锁当场抓住)。
 *    登记里只留 `clientEncoding` 这一格标量,**不整份登记 env**(env 镜像里什么都有)。
 */
export const spawnCallSites = []

/**
 * 子进程结果归一(纯函数,镜像测试直刺 —— 这一格里真踩过雷):
 * ⚠️ 空串**不得**过 `redactChildOutput` —— 那条出口对空输入返回字面量 '(无输出)',它是给人看的
 *    诊断词,不是"有内容"的证据。一旦无条件套在 stderr/lost 上,`lost || ...` 就恒真 ⇒ 每一次 psql
 *    **成功**都被读成"psql 无法执行"(本票写作当轮实测踩过,暴露形态是 M2 假未判定 + M3~M5 连坐,
 *    而夹具因为手写了 `lost:''` 打不到这一格 —— 所以判据必须留成可被直接刺到的纯函数)。
 */
export function normalizeChildResult(r, dsn) {
  const lostRaw = r?.error ? String(r.error.message || r.error) : ''
  const errRaw = String(r?.stderr ?? '')
  return {
    status: r?.status ?? null,
    stdout: String(r?.stdout ?? ''),
    // 红线③:子进程任何一侧的输出都先过脱敏两把尺,再进诊断文本
    stderr: errRaw ? redactDsnInText(redactChildOutput(errRaw), dsn) : '',
    lost: lostRaw ? redactDsnInText(redactChildOutput(lostRaw), dsn) : '',
  }
}

export function psqlSpawn(psql, dsn, sql) {
  const script = buildSessionScript(sql)
  const args = ['-At', '-q', '-X', '-v', 'ON_ERROR_STOP=1', '-d', dsn]
  const opts = {
    input: Buffer.from(script, 'utf8'),
    encoding: 'utf8',
    windowsHide: true,
    timeout: PSQL_TIMEOUT_MS,
    stdio: ['pipe', 'pipe', 'pipe'],
    maxBuffer: 4 * 1024 * 1024,
    env: { ...process.env, PGCONNECT_TIMEOUT: '8', PGCLIENTENCODING: 'UTF8' },
  }
  spawnCallSites.push({
    bin: psql,
    // 逐元素脱敏:DSN 那一格换成 sanitizeDsn 形态;script/sql 本身不含凭据,原样留证
    args: args.map((a) => (a === dsn ? sanitizeDsn(dsn) : a)),
    script,
    stdio: opts.stdio,
    windowsHide: opts.windowsHide,
    timeout: opts.timeout,
    maxBuffer: opts.maxBuffer,
    clientEncoding: opts.env.PGCLIENTENCODING,
  })
  return normalizeChildResult(spawnSync(psql, args, opts), dsn)
}

/** 运行档的 psql 执行器:唯一动作就是转调那个受闸的 spawn 位。 */
export function makePsqlRunner() {
  return (psql, dsn, sql) => psqlSpawn(psql, dsn, sql)
}

/** 公开接口取数:只回 {status,total},正文一律不外传(红线③)。 */
export async function defaultHttpFetcher(url) {
  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      headers: { accept: 'application/json', 'user-agent': 'ihui-learn-video-mount-ruler/1' },
      signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
    })
    const text = await res.text()
    let total
    try {
      const j = JSON.parse(text)
      total = j?.data?.total
    } catch {
      total = undefined
    }
    return { status: res.status, total: typeof total === 'number' ? total : undefined }
  } catch (e) {
    return { fetchError: String(e?.message || e || 'fetch 失败') }
  }
}

/**
 * 量一轮(可注入全部输入,便于夹具直取判据 —— 镜像测试因此**不碰真库、不碰网络、不探盘)。
 * psql 定位之所以也做成注入点:它探的是**这台机**的安装位,真探一次就把"夹具判三态"变成了
 * "判本机有没有装 PostgreSQL",三态阳性对照当场失去可控性(与 §22c 的"判据 import 源脚本"同理)。
 * @returns {{dimensions:object[], target:object, overall:string, exitCode:number, counts:object}}
 */
export async function collect({
  env = process.env,
  argvDsn = null,
  baseUrl = DEFAULT_PUBLIC_BASE,
  skipHttp = false,
  fsImpl = { existsSync, readFileSync },
  psqlRunner = null,
  httpFetcher = defaultHttpFetcher,
  locateClient = null,
  envFilePath = join(ROOT, APP_ENV_REL),
  manifestPath = join(ROOT, MANIFEST_REL),
} = {}) {
  const dims = []

  // M1
  let manifestParsed = null
  try {
    manifestParsed = fsImpl.existsSync(manifestPath)
      ? parseManifest(fsImpl.readFileSync(manifestPath, 'utf8'))
      : { ok: false, why: `manifest 文件不在位:${manifestPath}` }
  } catch (e) {
    manifestParsed = { ok: false, why: `manifest 读取抛错:${e?.message ?? e}` }
  }
  const m1 = judgeManifest(manifestParsed)
  dims.push(m1)

  // M2~M5(库侧)
  const dsnRes = resolveDsn({
    argvDsn,
    envText: (() => {
      try {
        return fsImpl.existsSync(envFilePath) ? fsImpl.readFileSync(envFilePath, 'utf8') : ''
      } catch {
        return ''
      }
    })(),
    processEnv: env,
  })
  const located = (locateClient || ((e) => locatePsqlClient(e)))(env)
  const target = dsnRes.ok
    ? { klass: classifyDsnTarget(dsnRes.dsn).klass, dsnShape: sanitizeDsn(dsnRes.dsn), source: dsnRes.source }
    : { klass: 'unjudged', dsnShape: null, source: null }

  if (!located.psql) {
    dims.push(judgeDbTarget({ psqlFound: false, dsn: null, spawnError: null, tableCount: null }))
    // 下游三维各自的 why 必须**自足**(只写"M2 未判定"会让读到那行的人还得回头猜上游坏在哪)
    const dbWhy = `库侧取不到输入:${psqlLocateMissText(located.tried)}`
    dims.push(unjudged('M3-db-rows', dbWhy))
    dims.push(unjudged('M4-db-publish', dbWhy))
    dims.push(unjudged('M5-db-feed-total', dbWhy))
  } else if (!dsnRes.ok) {
    dims.push(judgeDbTarget({ psqlFound: true, dsn: null, spawnError: null, tableCount: null }))
    dims.push(unjudged('M3-db-rows', `库侧取不到输入:${dsnRes.why}`))
    dims.push(unjudged('M4-db-publish', `库侧取不到输入:${dsnRes.why}`))
    dims.push(unjudged('M5-db-feed-total', `库侧取不到输入:${dsnRes.why}`))
  } else if (m1.state !== 'ok') {
    // 期望集为空 ⇒ 主查询根本发不出去(枚举到 0 判死,不拿空 IN 清单去库里"对账")
    const dbWhy = `库侧取不到输入:M1 未判定(${m1.why})⇒ 主查询无锚定集`
    dims.push(unjudged('M2-db-target', dbWhy))
    dims.push(unjudged('M3-db-rows', dbWhy))
    dims.push(unjudged('M4-db-publish', dbWhy))
    dims.push(unjudged('M5-db-feed-total', dbWhy))
  } else {
    const run = psqlRunner || makePsqlRunner()
    const presence = run(located.psql, dsnRes.dsn, sqlTablePresence())
    let tableCount = null
    let spawnError = presence.lost || null
    if (presence.status === 0 && !presence.lost) {
      const n = Number(String(presence.stdout).trim())
      // 空/非数一律 null(未判定),**绝不 `|| 0`** —— 那会把"取不到"折成"表不存在"那一型 gap
      tableCount = Number.isInteger(n) && n >= 0 ? n : null
    } else if (!spawnError) {
      spawnError = presence.stderr || `psql exit ${presence.status}`
    }
    const m2 = judgeDbTarget({ psqlFound: true, dsn: dsnRes.dsn, spawnError, tableCount })
    dims.push(m2)
    if (m2.state !== 'ok') {
      const dbWhy = `主查询不发送(理由来自 M2:${m2.why || m2.note})`
      dims.push(unjudged('M3-db-rows', dbWhy))
      dims.push(unjudged('M4-db-publish', dbWhy))
      dims.push(unjudged('M5-db-feed-total', dbWhy))
    } else {
      const main = run(located.psql, dsnRes.dsn, sqlLegacyMountFacts(manifestParsed.titles))
      const parsedRows = main.status === 0 && !main.lost ? parseCountRow(main.stdout) : null
      if (!parsedRows) {
        const why = parsedRows === null && main.status === 0 && !main.lost
          ? `主查询返回形态不是 6 段整数(实得首行截断:${redactDsnInText(String(main.stdout).slice(0, 40), dsnRes.dsn)})⇒ 未判定,不猜 0`
          : `主查询失败:${redactDsnInText(main.stderr || main.lost || `psql exit ${main.status}`, dsnRes.dsn)}`
        dims.push(unjudged('M3-db-rows', why))
        dims.push(unjudged('M4-db-publish', why))
        dims.push(unjudged('M5-db-feed-total', why))
      } else {
        dims.push(judgeRows(m1, parsedRows))
        dims.push(judgePublish(parsedRows))
        dims.push(judgeDbFeedTotal(parsedRows))
      }
    }
  }

  // M6
  if (skipHttp) {
    dims.push(unjudged('M6-http-feed-total', '本轮 --skip-http ⇒ 接口面未判定(不是"没问题")'))
  } else {
    const url = `${String(baseUrl).replace(/\/$/, '')}${FEED_PATH}?page=1&pageSize=1`
    const got = await httpFetcher(url)
    const dbRows = dims.find((d) => d.id === 'M3-db-rows')?.reading || null
    dims.push(judgeHttp({ baseUrl, ...got, dbFeedRows: dbRows, manifest: m1 }))
  }

  const agg = aggregate(dims)
  return { dimensions: dims, target, overall: agg.overall, exitCode: agg.exitCode, counts: agg.counts }
}

/** 人读渲染:逐维一行 + 结论行。**任何一行都不含凭据**(镜像测试有哨兵锁)。 */
export function render(report) {
  const ICON = { ok: '✅', gap: '✗', unjudged: '⚠' }
  const lines = [
    `历史课程视频挂载对账(G-921 同族)· 只读尺子 · 目标 ${report.target.klass}${report.target.dsnShape ? ` ← ${report.target.dsnShape}` : ''}`,
  ]
  for (const d of report.dimensions) {
    const detail = d.state === 'unjudged' ? d.why : d.note
    const reading = d.reading === null || d.reading === undefined ? '' : ` · 读数 ${JSON.stringify(d.reading)}`
    const expected = d.expected === undefined ? '' : ` · 期望 ${JSON.stringify(d.expected)}`
    lines.push(`  ${ICON[d.state]} ${d.id}${reading}${expected}${detail ? ` —— ${detail}` : ''}`)
  }
  lines.push(
    `MOUNT-RESULT state=${report.overall} ok=${report.counts.ok} gap=${report.counts.gap} unjudged=${report.counts.unjudged} exit=${report.exitCode}`,
  )
  return lines.join('\n')
}

// ══════════════════════════════ --self-test ══════════════════════════════

export async function runSelfTest() {
  const { t, report } = makeRegistrar()
  const scratch = mkScratch('learn-mount-selftest-')
  const manifestText = JSON.stringify({
    courses: [{ title: '甲课', sections: [{ rel: 'a/1.mp4' }, { rel: 'a/2.mp4' }] }],
    excluded: ['x.f1.mp4'],
  })
  try {
    writeFileSync(join(scratch, 'manifest.json'), manifestText)
    const fsImpl = { existsSync: () => true, readFileSync: () => manifestText }
    const locator = (found) => () => ({ psql: found ? 'psql-fixture' : null, tried: ['self-test'] })
    const runner = (full) => (psql, dsn2, sql) =>
      sql.includes('information_schema.tables')
        ? { status: 0, stdout: '3', stderr: '', lost: '' }
        : { status: 0, stdout: full ? '1|1|2|2|1|2' : '1|1|2|2|0|0', stderr: '', lost: '' }
    const dsn = 'postgres://u:p@127.0.0.1:5432/d'

    // 三态阳性对照必须真跑一轮 collect:它是 async,而登记器把"结论仍是 Promise"读成
    // 取不到 ⇒ 归失败(lib/selftest-registrant 的 NEVER_EVALUATED 那一族),所以先 await 取数
    // 再登记布尔结论 —— 不是为了好看,是为了这条锁不会自咬。
    const r1 = await collect({ fsImpl, locateClient: locator(true), psqlRunner: runner(true), httpFetcher: async () => ({ status: 200, total: 2 }), argvDsn: dsn, baseUrl: 'https://fixture.invalid' })
    const r2 = await collect({ fsImpl, locateClient: locator(true), psqlRunner: runner(false), httpFetcher: async () => ({ status: 200, total: 0 }), argvDsn: dsn, baseUrl: 'https://fixture.invalid' })
    const r3 = await collect({ fsImpl, locateClient: locator(false), psqlRunner: runner(true), httpFetcher: async () => ({ fetchError: '夹具:不发网络' }), argvDsn: null, env: { DATABASE_URL: '' }, baseUrl: 'https://fixture.invalid' })

    t('① manifest 解析出 1 门 2 节', parseManifest(manifestText).sections === 2)
    t('② 发布位 0 ⇒ gap', judgePublish({ courses: 1, chapters: 1, sections: 2, sectionsWithUrl: 2, publishedCourses: 0, feedSections: 0 }).state === 'gap')
    t('③ 行没齐 ⇒ gap', judgeRows(judgeManifest(parseManifest(manifestText)), { courses: 1, chapters: 1, sections: 1, sectionsWithUrl: 1, publishedCourses: 1, feedSections: 1 }).state === 'gap')
    t('④ 全齐 ⇒ ok', judgePublish({ courses: 1, chapters: 1, sections: 2, sectionsWithUrl: 2, publishedCourses: 1, feedSections: 2 }).state === 'ok')
    t('⑤ psql 取不到 ⇒ unjudged 且下游不记绿', judgeDbTarget({ psqlFound: false }).state === 'unjudged')
    t('⑥ 非只读 SQL 当场抛', (() => { try { assertReadOnlySql('SELECT 1; DROP TABLE lessons') } catch { return true } return false })())
    t('⑦ 密码字面量不落文本', redactDsnInText('password authentication failed for "s3cr3tpw"@host', 'postgres://u:s3cr3tpw@h:5432/d').includes('***'))
    t('⑧ gap 优先于 unjudged', aggregate([{ state: 'gap' }, { state: 'unjudged' }]).exitCode === 1)
    t('⑨ 空清单 manifest 判死不记绿', judgeManifest(parseManifest('{"courses":[],"excluded":[]}')).state === 'unjudged')
    t('⑩ 维度清单枚举到 0 ⇒ 抛', (() => { try { aggregate([]) } catch { return true } return false })())
    t('⑪ 夹具 manifest 落 scratch 可读', parseManifest(readFileSync(join(scratch, 'manifest.json'), 'utf8')).ok === true)
    t('⑫ 阳性对照①全齐 ⇒ ok(exit 0)', r1.overall === 'ok' && r1.exitCode === 0, JSON.stringify(r1.counts))
    t('⑬ 阳性对照②发布位 0 ⇒ gap 且点名 M4', r2.overall === 'gap' && r2.dimensions.some((d) => d.id === 'M4-db-publish' && d.state === 'gap'), JSON.stringify(r2.counts))
    t('⑭ 阳性对照③库与接口都取不到 ⇒ unjudged(≥5 维点名)', r3.overall === 'unjudged' && r3.exitCode === 2 && r3.counts.unjudged >= 5, JSON.stringify(r3.counts))
    t('⑮ 空 stdout 不被折成"表不存在"', judgeDbTarget({ psqlFound: true, dsn: 'postgres://u:p@h:5432/d', spawnError: null, tableCount: null }).state === 'unjudged')
    t('⑯ 未判定轮次里除 M1 外不得有 ok', r3.dimensions.every((d) => d.state !== 'ok' || d.id === 'M1-manifest'))
    const r = report()
    for (const c of r.cases) if (!c.pass) console.log(`  ✗ ${c.name} · got=${c.got}`)
    console.log(`自检 ${r.pass}/${r.cases.length} 通过`)
    return r.fail ? 1 : 0
  } finally {
    rmScratch(scratch, { bestEffort: true })
  }
}

// ══════════════════════════════ CLI ══════════════════════════════

async function main() {
  const argv = process.argv.slice(2)
  // ⚠️ 一律走 `process.exitCode`,**不用 process.exit()**:本尺会留下一条 undici keep-alive 套接字
  //    与一个刚关掉的 stdio 管道,Windows 上带着"正在关闭的 handle"强退会撞
  //    `Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)`(本票当轮实测:结论已经打在 stdout,
  //    退出码却被 abort 顶成 127 —— 等于把量到的 gap 洗成一条谁也读不懂的崩溃)。
  if (argv.includes('--self-test')) {
    process.exitCode = await runSelfTest()
    return
  }
  const dsnFlag = requireFlagValue(argv, '--dsn', { noun: 'postgres:// 连接串' })
  const baseFlag = requireFlagValue(argv, '--base-url', { noun: 'https:// 基址' })
  const flagError = dsnFlag.error || baseFlag.error
  if (flagError) {
    console.error(`✗ 未判定:${flagError}`)
    process.exitCode = 2
    return
  }
  const known = new Set(['--json', '--self-test', '--skip-http', '--dsn', '--base-url'])
  const bad = argv.filter((a) => (a.startsWith('--') ? !known.has(a) : false))
  if (bad.length) {
    console.error(`✗ 未判定:未知选项 ${bad.join(' ')} —— 本尺只接受 --json / --skip-http / --dsn / --base-url / --self-test`)
    process.exitCode = 2
    return
  }
  const report = await collect({
    argvDsn: dsnFlag.value,
    baseUrl: baseFlag.value || process.env.IHUI_LEARN_FEED_BASE_URL || DEFAULT_PUBLIC_BASE,
    skipHttp: argv.includes('--skip-http'),
  })
  console.log(argv.includes('--json') ? JSON.stringify(report, null, 2) : render(report))
  process.exitCode = report.exitCode
}

// §22c 出口:镜像测试直接 import,不复制判据
export const __test__ = {
  ROOT,
  MANIFEST_REL,
  APP_ENV_REL,
  DSN_ENV_KEY,
  DEFAULT_PUBLIC_BASE,
  FEED_PATH,
  LESSON_TABLES,
  MAX_SQL_LEN,
  PSQL_TIMEOUT_MS,
  HTTP_TIMEOUT_MS,
  parseManifest,
  judgeManifest,
  sqlLiteral,
  sqlTablePresence,
  sqlLegacyMountFacts,
  assertReadOnlySql,
  parseCountRow,
  judgeDbTarget,
  judgeRows,
  judgePublish,
  judgeDbFeedTotal,
  judgeHttp,
  aggregate,
  classifyDsnTarget,
  redactDsnInText,
  resolveDsn,
  render,
  collect,
  normalizeChildResult,
  buildSessionScript,
  SESSION_PREFIX,
  // 受闸 spawn 位(§12g 取证用):测试对**实调用登记的参数**取证,不用正则猜生产代码
  psqlSpawn,
  spawnCallSites,
  PSQL_TIMEOUT_MS,
  HTTP_TIMEOUT_MS,
  // 复用的既有唯一实现:展示脱敏 + 生产隧道端口(本尺不重抄)
  sanitizeDsn,
  prodTunnelPort: FORBIDDEN_PROD_PORT,
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  main().catch((e) => {
    console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exitCode = 2
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
