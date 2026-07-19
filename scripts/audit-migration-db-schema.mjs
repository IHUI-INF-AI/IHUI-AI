#!/usr/bin/env node
/**
 * IHUI-AI 架构迁移审计 - 阶段 3:数据库 schema content-level 比对
 *
 * 比对来源:
 *   旧项目 (D:\历史项目存档):
 *     - edu service init_database.sql (CREATE TABLE 186 张)
 *     - ZHS_Server_java @Entity / @Table 注解 (含注释掉的)
 *     - coze_zhs_py/sql/*.sql (zhs_* 表)
 *     - ai-smart-society-java/sql/*.sql (ry_*, quartz_*, sys_* 表)
 *   新项目 (g:\IHUI-AI):
 *     - packages/database/src/schema/*.ts (pgTable 定义)
 *
 * 输出 4 类对照:
 *   - migrated (已迁移): 表名精确匹配
 *   - partial (部分迁移): 表名前缀或业务模块关键词匹配
 *   - missing (缺失): D 盘有但当前仓库无匹配
 *   - new (新增): 当前仓库新增表
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '..');

const OLD_ROOT = 'D:\\历史项目存档';
const OLD_EDU_SQL = join(OLD_ROOT, 'code', 'edu', 'service', 'service', 'init_database.sql');
const OLD_ZHS_JAVA_DIR = join(OLD_ROOT, 'code', 'ljd-交接文件', 'ZHS_Server_java');
const OLD_ZHS_PY_SQL_DIR = join(OLD_ROOT, 'code', 'ljd-交接文件', 'coze_zhs_py', 'sql');
const OLD_RY_SQL_DIR = join(OLD_ROOT, 'code', 'ljd-交接文件', 'ai-smart-society-java', 'sql');
const NEW_SCHEMA_DIR = join(REPO_ROOT, 'packages', 'database', 'src', 'schema');

const REPORTS_DIR = join(REPO_ROOT, 'reports');
if (!existsSync(REPORTS_DIR)) mkdirSync(REPORTS_DIR, { recursive: true });

const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const CSV_PATH = join(REPORTS_DIR, `migration-audit-db-schema-${TIMESTAMP}.csv`);
const SUMMARY_PATH = join(REPORTS_DIR, 'migration-audit-db-schema-summary.json');

/** 业务模块关键词清单 (来自任务约束边界) */
const BUSINESS_KEYWORDS = [
  'user', 'member', 'admin', 'role', 'permission', 'auth',
  'order', 'pay', 'payment', 'course', 'article', 'post',
  'comment', 'tag', 'category', 'ai', 'chat', 'model', 'agent',
  'market', 'file', 'upload', 'message', 'notification', 'log',
  'stat', 'behavior', 'watch', 'like', 'favorite', 'share',
  'sso', 'webrtc', 'ask', 'question', 'answer',
];

/** 旧项目常见表前缀 (归一化时去除) */
const OLD_PREFIXES = ['ed_', 't_', 'tbl_', 'edu_', 'circle_', 'content_', 'exam_',
  'learn_', 'live_', 'message_', 'order_', 'point_', 'resource_', 'search_',
  'setting_', 'zhs_', 'ry_', 'sys_', 'quartz_', 'qrtz_'];

/**
 * 调用 ripgrep (rg) 执行搜索,返回原始 stdout
 */
function rg(args) {
  try {
    return execFileSync('rg', args, {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      windowsHide: true,
    });
  } catch (err) {
    if (err.status === 1) return '';
    throw err;
  }
}

/**
 * 表名归一化:
 *  - 去除反引号、引号
 *  - 统一小写
 *  - 去除常见前缀
 *  - 单复数统一 (尽量转单数)
 */
function normalizeTableName(raw) {
  if (!raw) return '';
  let t = raw.replace(/[`"'[\]]/g, '').trim().toLowerCase();
  for (const p of OLD_PREFIXES) {
    if (t.startsWith(p) && t.length > p.length) {
      t = t.slice(p.length);
      break;
    }
  }
  // 单复数归一 (粗略: 末尾 s 去掉,但避开 ss/us/is 等)
  if (t.length > 3 && t.endsWith('s') && !t.endsWith('ss') &&
      !t.endsWith('us') && !t.endsWith('is') && !t.endsWith('as')) {
    t = t.slice(0, -1);
  }
  return t;
}

/**
 * 提取业务模块关键词 (从表名中)
 */
function extractBusinessKeys(raw) {
  const t = raw.replace(/[`"'[\]]/g, '').toLowerCase();
  const hits = [];
  for (const kw of BUSINESS_KEYWORDS) {
    if (t.includes(kw)) hits.push(kw);
  }
  return hits;
}

/**
 * 从旧 edu init_database.sql 提取 CREATE TABLE
 */
function scanOldEduSql() {
  const tables = [];
  if (!existsSync(OLD_EDU_SQL)) {
    console.warn(`[warn] missing: ${OLD_EDU_SQL}`);
    return tables;
  }
  const content = readFileSync(OLD_EDU_SQL, 'utf8');
  const re = /CREATE\s+TABLE\s+[`"]?([a-zA-Z0-9_]+)[`"]?\s*\(/gi;
  let m;
  while ((m = re.exec(content)) !== null) {
    tables.push({
      source: 'edu-init_database.sql',
      table: m[1],
      file: OLD_EDU_SQL,
      kind: 'sql',
    });
  }
  return tables;
}

/**
 * 从 ZHS_Server_java @Table 注解提取 (包含被注释的)
 * 同时回退: 从 .java 文件名推断
 */
function scanOldZhsJava() {
  const tables = [];
  if (!existsSync(OLD_ZHS_JAVA_DIR)) {
    console.warn(`[warn] missing: ${OLD_ZHS_JAVA_DIR}`);
    return tables;
  }

  // 1. @Table(name = "...") 注解 (含注释掉的 //)
  const out = rg([
    '--no-heading', '-n', '-I',
    '--glob', '*.java',
    '-e', '@Table\\s*\\(\\s*name\\s*=\\s*["\']([a-zA-Z0-9_]+)["\']',
    '-r', '$1',
    OLD_ZHS_JAVA_DIR,
  ]);
  if (out) {
    for (const line of out.split(/\r?\n/)) {
      if (!line.trim()) continue;
      // rg -I 输出格式就是表名,但如果用了 -r 替换,需要单独获取文件路径
      tables.push({
        source: 'zhs-java-@Table',
        table: line.trim(),
        file: 'ZHS_Server_java',
        kind: 'java',
      });
    }
  }

  // 2. 用文件路径 + 行号模式重新扫描,获取 (table, file, line)
  const out2 = rg([
    '--no-heading', '-n',
    '--glob', '*.java',
    '-e', '@Table\\s*\\(\\s*name\\s*=\\s*["\']([a-zA-Z0-9_]+)["\']',
    OLD_ZHS_JAVA_DIR,
  ]);
  if (out2) {
    const enriched = [];
    for (const line of out2.split(/\r?\n/)) {
      if (!line.trim()) continue;
      // 注意:Windows 路径含盘符冒号,不能用 [^:]+,需用 .+? 非贪婪 + 行号锚定
      const m = line.match(/^(.+?):(\d+):.*?@Table\s*\(\s*name\s*=\s*["']([a-zA-Z0-9_]+)["']/);
      if (m) {
        enriched.push({
          source: 'zhs-java-@Table',
          table: m[3],
          file: m[1],
          line: Number(m[2]),
          kind: 'java',
        });
      }
    }
    if (enriched.length > 0) return enriched;
  }
  return tables;
}

/**
 * 从 coze_zhs_py/sql/*.sql 提取 CREATE TABLE
 */
function scanOldZhsPySql() {
  const tables = [];
  if (!existsSync(OLD_ZHS_PY_SQL_DIR)) {
    console.warn(`[warn] missing: ${OLD_ZHS_PY_SQL_DIR}`);
    return tables;
  }
  const out = rg([
    '--no-heading', '-n',
    '--glob', '*.sql',
    '-e', 'CREATE\\s+TABLE\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?[`"]?([a-zA-Z0-9_]+)[`"]?\\s*\\(',
    OLD_ZHS_PY_SQL_DIR,
  ]);
  if (!out) return tables;
  for (const line of out.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const m = line.match(/^(.+?):(\d+):.*?CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?[`"]?([a-zA-Z0-9_]+)[`"]?\s*\(/i);
    if (m) {
      tables.push({
        source: 'zhs-py-sql',
        table: m[3],
        file: m[1],
        line: Number(m[2]),
        kind: 'sql',
      });
    }
  }
  return tables;
}

/**
 * 从 ai-smart-society-java/sql/*.sql 提取 CREATE TABLE (RuoYi/Quartz)
 */
function scanOldRySql() {
  const tables = [];
  if (!existsSync(OLD_RY_SQL_DIR)) {
    console.warn(`[warn] missing: ${OLD_RY_SQL_DIR}`);
    return tables;
  }
  const out = rg([
    '--no-heading', '-n',
    '--glob', '*.sql',
    '-e', 'CREATE\\s+TABLE\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?[`"]?([a-zA-Z0-9_]+)[`"]?\\s*\\(',
    OLD_RY_SQL_DIR,
  ]);
  if (!out) return tables;
  for (const line of out.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const m = line.match(/^(.+?):(\d+):.*?CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?[`"]?([a-zA-Z0-9_]+)[`"]?\s*\(/i);
    if (m) {
      tables.push({
        source: 'ry-sql',
        table: m[3],
        file: m[1],
        line: Number(m[2]),
        kind: 'sql',
      });
    }
  }
  return tables;
}

/**
 * 从新仓库 Drizzle schema 提取 pgTable 定义
 */
function scanNewDrizzle() {
  const tables = [];
  if (!existsSync(NEW_SCHEMA_DIR)) {
    console.warn(`[warn] missing: ${NEW_SCHEMA_DIR}`);
    return tables;
  }
  const out = rg([
    '--no-heading', '-n',
    '--glob', '*.ts',
    '-e', "pgTable\\s*\\(\\s*['\"`]([a-zA-Z0-9_]+)['\"`]",
    NEW_SCHEMA_DIR,
  ]);
  if (!out) return tables;
  for (const line of out.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const m = line.match(/^(.+?):(\d+):.*?pgTable\s*\(\s*['"`]([a-zA-Z0-9_]+)['"`]/);
    if (m) {
      tables.push({
        source: 'drizzle',
        table: m[3],
        file: m[1],
        line: Number(m[2]),
        kind: 'ts',
      });
    }
  }
  return tables;
}

/**
 * 匹配策略:
 *  - exact: 表名归一化后完全相等
 *  - prefix: 一方是另一方的前缀 (长度 >= 4)
 *  - business: 共享至少一个业务关键词
 */
function findMatch(oldTable, newTables) {
  const oldNorm = normalizeTableName(oldTable);
  const oldKeys = new Set(extractBusinessKeys(oldTable));

  // 1. exact
  for (const n of newTables) {
    if (normalizeTableName(n.table) === oldNorm) {
      return { matchType: 'exact', matched: n };
    }
  }
  // 2. prefix
  for (const n of newTables) {
    const nNorm = normalizeTableName(n.table);
    if (oldNorm.length >= 4 && nNorm.length >= 4 &&
        (oldNorm.startsWith(nNorm) || nNorm.startsWith(oldNorm))) {
      return { matchType: 'prefix', matched: n };
    }
  }
  // 3. business keyword
  if (oldKeys.size > 0) {
    for (const n of newTables) {
      const nKeys = new Set(extractBusinessKeys(n.table));
      for (const k of oldKeys) {
        if (nKeys.has(k)) {
          return { matchType: 'business', matched: n };
        }
      }
    }
  }
  return null;
}

function main() {
  console.log('=== IHUI-AI DB Schema Migration Audit ===\n');

  console.log('[1/4] Scanning old project (D drive)...');
  const oldEdu = scanOldEduSql();
  const oldZhsJava = scanOldZhsJava();
  const oldZhsPy = scanOldZhsPySql();
  const oldRy = scanOldRySql();
  console.log(`  edu init_database.sql: ${oldEdu.length} tables`);
  console.log(`  ZHS_Server_java @Table: ${oldZhsJava.length} tables`);
  console.log(`  coze_zhs_py/sql: ${oldZhsPy.length} tables`);
  console.log(`  ai-smart-society-java/sql: ${oldRy.length} tables`);

  // 去重: 同一表名只保留一条 (优先级 sql > java)
  const oldMap = new Map();
  for (const t of [...oldEdu, ...oldZhsPy, ...oldRy, ...oldZhsJava]) {
    const key = t.table.toLowerCase();
    if (!oldMap.has(key)) oldMap.set(key, t);
  }
  const oldTables = [...oldMap.values()];
  console.log(`  Old total (deduped): ${oldTables.length}\n`);

  console.log('[2/4] Scanning new repo (Drizzle schema)...');
  const newTables = scanNewDrizzle();
  console.log(`  New total: ${newTables.length}\n`);

  console.log('[3/4] Matching & categorizing...');
  const migrated = [];   // exact
  const partial = [];    // prefix or business
  const missing = [];    // old only
  const matchedNewKeys = new Set();

  for (const old of oldTables) {
    const r = findMatch(old.table, newTables);
    if (!r) {
      missing.push({
        old_table: old.table,
        old_source: old.source,
        old_file: old.file,
        normalized: normalizeTableName(old.table),
      });
    } else if (r.matchType === 'exact') {
      migrated.push({
        old_table: old.table,
        new_table: r.matched.table,
        old_source: old.source,
        new_file: r.matched.file,
        match_type: r.matchType,
      });
      matchedNewKeys.add(r.matched.table.toLowerCase());
    } else {
      partial.push({
        old_table: old.table,
        new_table: r.matched.table,
        old_source: old.source,
        new_file: r.matched.file,
        match_type: r.matchType,
      });
      matchedNewKeys.add(r.matched.table.toLowerCase());
    }
  }

  // 新增表: 新仓库中没被任何 old 匹配的
  const newOnly = [];
  for (const n of newTables) {
    if (!matchedNewKeys.has(n.table.toLowerCase())) {
      // 二次校验: 是否被作为 partial/exact 反向匹配过
      const nNorm = normalizeTableName(n.table);
      let alreadyMatched = false;
      for (const old of oldTables) {
        if (normalizeTableName(old.table) === nNorm) {
          alreadyMatched = true;
          break;
        }
      }
      if (!alreadyMatched) {
        newOnly.push({
          new_table: n.table,
          new_file: n.file,
          normalized: nNorm,
        });
      }
    }
  }

  console.log(`  migrated (exact):   ${migrated.length}`);
  console.log(`  partial (prefix/biz): ${partial.length}`);
  console.log(`  missing (old only): ${missing.length}`);
  console.log(`  new (new only):     ${newOnly.length}\n`);

  console.log('[4/4] Writing reports...');

  // CSV: 全量对照
  const csvLines = [
    'category,old_table,new_table,old_source,new_file,match_type,normalized_old,normalized_new',
  ];
  for (const r of migrated) {
    csvLines.push(`migrated,${r.old_table},${r.new_table},${r.old_source},${r.new_file},${r.match_type},${normalizeTableName(r.old_table)},${normalizeTableName(r.new_table)}`);
  }
  for (const r of partial) {
    csvLines.push(`partial,${r.old_table},${r.new_table},${r.old_source},${r.new_file},${r.match_type},${normalizeTableName(r.old_table)},${normalizeTableName(r.new_table)}`);
  }
  for (const r of missing) {
    csvLines.push(`missing,${r.old_table},,${r.old_source},,,${r.normalized},`);
  }
  for (const r of newOnly) {
    csvLines.push(`new,,${r.new_table},,${r.new_file},,${r.normalized},`);
  }
  writeFileSync(CSV_PATH, csvLines.join('\n') + '\n', 'utf8');
  console.log(`  CSV: ${CSV_PATH}`);

  // 关键业务表完整性检查 (针对 user/order/course/payment/ai 等)
  // 注意: 关键业务关键词独立于 BUSINESS_KEYWORDS,直接用 substring 匹配,
  // 这样可以覆盖 exam/learn/circle/live/content 等教育核心模块 (即使它们不在
  // BUSINESS_KEYWORDS 列表里)
  const criticalBizKeys = ['user', 'order', 'course', 'payment', 'pay', 'ai',
    'member', 'exam', 'learn', 'message', 'notification', 'circle', 'live',
    'content', 'resource', 'point'];
  const substringHits = (name, kw) => {
    const n = String(name).toLowerCase();
    // word-boundary-ish: 用 _ 或字符串边界包裹 keyword 后匹配,避免 sso/lesson 误报
    return n === kw || n.startsWith(kw + '_') || n.endsWith('_' + kw) ||
      n.includes('_' + kw + '_') || n.startsWith(kw) && !n.startsWith(kw + 'ly');
  };
  const criticalCoverage = [];
  for (const kw of criticalBizKeys) {
    const oldHits = oldTables.filter(t => substringHits(t.table, kw));
    const newHits = newTables.filter(t => substringHits(t.table, kw));
    const migratedHits = migrated.filter(r => substringHits(r.old_table, kw));
    const partialHits = partial.filter(r => substringHits(r.old_table, kw));
    const missingHits = missing.filter(r => substringHits(r.old_table, kw));
    criticalCoverage.push({
      keyword: kw,
      old_count: oldHits.length,
      new_count: newHits.length,
      migrated_count: migratedHits.length,
      partial_count: partialHits.length,
      missing_count: missingHits.length,
      coverage_pct: oldHits.length === 0 ? 100 :
        Math.round(((migratedHits.length + partialHits.length) / oldHits.length) * 1000) / 10,
    });
  }

  // 缺失分析: 区分 "语言迁移" (Java->TS 模式变化导致概念合并) vs "真实缺失"
  // 启发式:
  //   - 如果 missing 表的归一化名包含 relation/relation 等关联表关键词 -> 多半被合并为 Drizzle relation
  //   - 如果归一化名以 _bak/_log/_record 等后缀,且新仓库有同名主表 -> 已被合并
  //   - 其余 -> 真实缺失
  const missingAnalysis = missing.map(m => {
    const norm = m.normalized;
    let reason = 'real_missing';
    if (/relation$/.test(norm) || /_relation$/.test(norm)) reason = 'merged_into_drizzle_relation';
    else if (/_bak$/.test(norm) || /_log$/.test(norm)) {
      // 看新仓库是否有去掉 _bak/_log 后缀的主表
      const stem = norm.replace(/_bak$/, '').replace(/_log$/, '');
      const hasMain = newTables.some(n => normalizeTableName(n.table) === stem);
      if (hasMain) reason = 'merged_into_main_table';
    } else if (/record$/.test(norm) || /_record$/.test(norm)) {
      const stem = norm.replace(/_record$/, '');
      const hasMain = newTables.some(n => normalizeTableName(n.table) === stem ||
        normalizeTableName(n.table).startsWith(stem));
      if (hasMain) reason = 'merged_into_main_table';
    }
    return { ...m, analysis: reason };
  });

  const summary = {
    generated_at: new Date().toISOString(),
    old_project: {
      root: OLD_ROOT,
      sources: {
        'edu-init_database.sql': oldEdu.length,
        'zhs-java-@Table': oldZhsJava.length,
        'zhs-py-sql': oldZhsPy.length,
        'ry-sql (RuoYi/Quartz)': oldRy.length,
      },
      total_unique: oldTables.length,
    },
    new_project: {
      repo: REPO_ROOT,
      schema_dir: NEW_SCHEMA_DIR,
      total_tables: newTables.length,
    },
    categories: {
      migrated: migrated.length,
      partial: partial.length,
      missing: missing.length,
      new: newOnly.length,
    },
    coverage_pct: oldTables.length === 0 ? 100 :
      Math.round(((migrated.length + partial.length) / oldTables.length) * 1000) / 10,
    critical_business_coverage: criticalCoverage,
    missing_analysis: {
      merged_into_drizzle_relation: missingAnalysis.filter(m => m.analysis === 'merged_into_drizzle_relation').length,
      merged_into_main_table: missingAnalysis.filter(m => m.analysis === 'merged_into_main_table').length,
      real_missing: missingAnalysis.filter(m => m.analysis === 'real_missing').length,
      details: missingAnalysis,
    },
    csv_path: CSV_PATH,
  };

  writeFileSync(SUMMARY_PATH, JSON.stringify(summary, null, 2), 'utf8');
  console.log(`  Summary: ${SUMMARY_PATH}\n`);

  console.log('=== Audit Complete ===');
  console.log(`Coverage: ${summary.coverage_pct}% (migrated+partial / old_total)`);
  console.log(`Missing breakdown: relation-merged=${summary.missing_analysis.merged_into_drizzle_relation}, ` +
    `main-merged=${summary.missing_analysis.merged_into_main_table}, ` +
    `real=${summary.missing_analysis.real_missing}`);
}

main();
