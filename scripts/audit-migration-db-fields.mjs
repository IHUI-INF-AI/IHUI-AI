#!/usr/bin/env node
/**
 * IHUI-AI 架构迁移审计 - 阶段 4:数据库 schema 字段级比对
 *
 * 比对策略:
 *   - 加载阶段 3 CSV(migration-audit-db-schema-2026-07-19T12-48-44.csv)中 80 张 migrated 表
 *   - 抽样 20 张关键业务表(user/order/member/message/ai/role/exam/comment 8 模块全覆盖)
 *   - 对每张表做字段级比对: D 盘旧表定义 vs 当前 Drizzle schema
 *   - 字段匹配: 按列名精确匹配
 *   - 类型映射: INT↔integer / BIGINT↔bigint / VARCHAR(N)↔varchar({N}) / TEXT↔text /
 *              TIMESTAMP↔timestamp / BOOLEAN↔boolean / JSON↔jsonb / DECIMAL↔decimal /
 *              DATE↔date / DATETIME↔timestamp / UUID↔uuid
 *   - 约束映射: NOT NULL↔notNull() / DEFAULT↔default() / UNIQUE↔unique() /
 *              PRIMARY KEY↔primaryKey() / AUTO_INCREMENT↔autoincrement()/serial
 *
 * 输出:
 *   - reports/migration-audit-db-fields-{timestamp}.csv: 每张表字段对照表
 *   - reports/migration-audit-db-fields-summary.json: 整体字段级覆盖率统计
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '..');

// 旧项目源路径 (D 盘)
const OLD_ROOT = 'D:\\历史项目存档';
const OLD_EDU_SQL = join(OLD_ROOT, 'code', 'edu', 'service', 'service', 'init_database.sql');
const OLD_ZHS_JAVA_DIR = join(OLD_ROOT, 'code', 'ljd-交接文件', 'ZHS_Server_java');
const OLD_ZHS_PY_SQL_DIR = join(OLD_ROOT, 'code', 'ljd-交接文件', 'coze_zhs_py', 'sql');
const OLD_RY_SQL_DIR = join(OLD_ROOT, 'code', 'ljd-交接文件', 'ai-smart-society-java', 'sql');

// 新项目 schema 路径
const NEW_SCHEMA_DIR = join(REPO_ROOT, 'packages', 'database', 'src', 'schema');

const REPORTS_DIR = join(REPO_ROOT, 'reports');
if (!existsSync(REPORTS_DIR)) mkdirSync(REPORTS_DIR, { recursive: true });

const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const CSV_PATH = join(REPORTS_DIR, `migration-audit-db-fields-${TIMESTAMP}.csv`);
const SUMMARY_PATH = join(REPORTS_DIR, 'migration-audit-db-fields-summary.json');

// 阶段 3 CSV (80 张 migrated 表清单来源)
const STAGE3_CSV = join(REPORTS_DIR, 'migration-audit-db-schema-2026-07-19T12-48-44.csv');

/**
 * 20 张抽样表 (覆盖 8 个关键业务模块)
 * - User (3): t_user, users, t_user_job
 * - Order (3): order_order, zhs_order, t_order_item
 * - Member (3): t_member_group, t_member_post, t_member_tag
 * - Message (3): t_announcement, t_notice, t_system_notice
 * - AI (2): zhs_agent_category, zhs_user_agent_free_times
 * - Role/Permission (3): t_role, t_role_authority, permissions
 * - Exam (2): t_paper, t_question
 * - Comment (1): t_comment
 */
const SAMPLE_TABLES = [
  { old: 't_user', new: 'edu_user', old_source: 'edu-init_database.sql', new_file: 'edu-full.ts', module: 'user' },
  { old: 'users', new: 'edu_user', old_source: 'ry-sql', new_file: 'edu-full.ts', module: 'user' },
  { old: 't_user_job', new: 'user_jobs', old_source: 'edu-init_database.sql', new_file: 'usercenter.ts', module: 'user' },
  { old: 'order_order', new: 'orders', old_source: 'edu-init_database.sql', new_file: 'billing.ts', module: 'order' },
  { old: 'zhs_order', new: 'orders', old_source: 'zhs-java-@Table', new_file: 'billing.ts', module: 'order' },
  { old: 't_order_item', new: 'edu_order_items', old_source: 'edu-init_database.sql', new_file: 'order.ts', module: 'order' },
  { old: 't_member_group', new: 'member_groups', old_source: 'edu-init_database.sql', new_file: 'member-extended.ts', module: 'member' },
  { old: 't_member_post', new: 'member_posts', old_source: 'edu-init_database.sql', new_file: 'member-extended.ts', module: 'member' },
  { old: 't_member_tag', new: 'member_tags', old_source: 'edu-init_database.sql', new_file: 'member-extended.ts', module: 'member' },
  { old: 't_announcement', new: 'announcements', old_source: 'edu-init_database.sql', new_file: 'content.ts', module: 'message' },
  { old: 't_notice', new: 'sys_notice', old_source: 'edu-init_database.sql', new_file: 'admin-sys.ts', module: 'message' },
  { old: 't_system_notice', new: 'message_system_notice', old_source: 'edu-init_database.sql', new_file: 'relation-tables.ts', module: 'message' },
  { old: 'zhs_agent_category', new: 'zhs_agent_category', old_source: 'zhs-py-sql', new_file: 'zhs-full.ts', module: 'ai' },
  { old: 'zhs_user_agent_free_times', new: 'zhs_user_agent_free_time', old_source: 'zhs-java-@Table', new_file: 'zhs-full.ts', module: 'ai' },
  { old: 't_role', new: 'edu_role', old_source: 'edu-init_database.sql', new_file: 'edu-full.ts', module: 'role' },
  { old: 't_role_authority', new: 'edu_role_authority', old_source: 'edu-init_database.sql', new_file: 'edu-full.ts', module: 'role' },
  { old: 'permissions', new: 'permissions', old_source: 'ry-sql', new_file: 'rbac.ts', module: 'permission' },
  { old: 't_paper', new: 'exam_papers', old_source: 'edu-init_database.sql', new_file: 'exam.ts', module: 'exam' },
  { old: 't_question', new: 'exam_questions', old_source: 'edu-init_database.sql', new_file: 'exam.ts', module: 'exam' },
  { old: 't_comment', new: 'comments', old_source: 'edu-init_database.sql', new_file: 'comments.ts', module: 'comment' },
];

// ---------------------------------------------------------------------------
// 类型与约束归一化映射
// ---------------------------------------------------------------------------

/** SQL 类型 → canonical 类型 */
function canonicalSqlType(raw) {
  if (!raw) return 'unknown';
  const t = raw.toLowerCase().trim();
  // int(10) unsigned / int / integer
  if (/^int(\(\d+\))?( unsigned)?$/.test(t) || t === 'integer') return 'integer';
  if (/^bigint(\(\d+\))?( unsigned)?$/.test(t)) return 'bigint';
  if (/^smallint(\(\d+\))?( unsigned)?$/.test(t)) return 'smallint';
  if (/^tinyint(\(\d+\))?( unsigned)?$/.test(t)) return 'boolean'; // tinyint(1) → boolean
  if (/^varchar\((\d+)\)$/.test(t)) return 'varchar';
  if (/^char\((\d+)\)$/.test(t)) return 'char';
  if (t === 'text' || t === 'longtext' || t === 'mediumtext' || t === 'tinytext') return 'text';
  if (t === 'timestamp') return 'timestamp';
  if (t === 'datetime') return 'timestamp'; // datetime → timestamp (PG)
  if (t === 'date') return 'date';
  if (t === 'time') return 'time';
  if (t === 'boolean' || t === 'bool') return 'boolean';
  if (t === 'json' || t === 'jsonb') return 'jsonb';
  if (/^decimal\(/.test(t) || /^numeric\(/.test(t)) return 'decimal';
  if (/^float/.test(t)) return 'real';
  if (/^double/.test(t)) return 'double';
  if (/^real/.test(t)) return 'real';
  if (t === 'blob' || t === 'longblob' || t === 'mediumblob') return 'blob';
  if (t === 'uuid') return 'uuid';
  return t;
}

/** Java 类型 → canonical 类型 */
function canonicalJavaType(raw) {
  if (!raw) return 'unknown';
  const t = raw.toLowerCase().trim();
  if (t === 'long') return 'bigint';
  if (t === 'integer' || t === 'int') return 'integer';
  if (t === 'string') return 'varchar';
  if (t === 'boolean') return 'boolean';
  if (t === 'date' || t === 'localdatetime' || t === 'localdate') return 'timestamp';
  if (t === 'bigdecimal') return 'decimal';
  if (t === 'double') return 'double';
  if (t === 'float') return 'real';
  if (t === 'object' || t === 'map' || t === 'list') return 'jsonb';
  return 'varchar'; // 默认 String-like
}

/** Drizzle 类型 → canonical 类型 (从函数名) */
function canonicalDrizzleType(fnName) {
  if (!fnName) return 'unknown';
  const t = fnName.toLowerCase().trim();
  if (t === 'serial' || t === 'bigserial') return 'integer'; // serial = integer + autoincrement
  if (t === 'integer' || t === 'int4' || t === 'int') return 'integer';
  if (t === 'bigint' || t === 'int8') return 'bigint';
  if (t === 'smallint' || t === 'int2') return 'smallint';
  if (t === 'varchar') return 'varchar';
  if (t === 'char') return 'char';
  if (t === 'text') return 'text';
  if (t === 'timestamp' || t === 'timestamptz') return 'timestamp';
  if (t === 'date') return 'date';
  if (t === 'time') return 'time';
  if (t === 'boolean' || t === 'bool') return 'boolean';
  if (t === 'json' || t === 'jsonb') return 'jsonb';
  if (t === 'decimal' || t === 'numeric') return 'decimal';
  if (t === 'real' || t === 'float4') return 'real';
  if (t === 'doubleprecision' || t === 'float8') return 'double';
  if (t === 'uuid') return 'uuid';
  if (t === 'blob' || t === 'bytea') return 'blob';
  return t;
}

/** 提取类型长度(varchar(N) → N) */
function extractLength(raw, type) {
  if (!raw) return null;
  const m = String(raw).match(/\((\d+)\)/);
  if (m) return Number(m[1]);
  return null;
}

// ---------------------------------------------------------------------------
// SQL DDL 解析器 (MySQL CREATE TABLE)
// ---------------------------------------------------------------------------

/**
 * 从 SQL 文件内容中提取指定表的字段定义
 * 返回: [{ name, rawType, canonicalType, length, notNull, hasDefault, defaultValue, isUnique, isPrimaryKey, isAutoIncrement }]
 */
function parseSqlCreateTable(content, tableName) {
  // 匹配 CREATE TABLE `tableName` ( ... ) 或 CREATE TABLE tableName ( ... )
  // 注意: 表定义可能跨多行,需要平衡括号
  const tableRe = new RegExp(
    `CREATE\\s+TABLE\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?[\`"]?${escapeRegex(tableName)}[\`"]?\\s*\\(`,
    'i',
  );
  const startMatch = tableRe.exec(content);
  if (!startMatch) return null;

  // 从 `(` 后开始,平衡括号找闭合
  const start = startMatch.index + startMatch[0].length;
  let depth = 1;
  let end = start;
  let inString = null;
  while (end < content.length && depth > 0) {
    const ch = content[end];
    if (inString) {
      if (ch === inString && content[end - 1] !== '\\') inString = null;
    } else {
      if (ch === "'" || ch === '"' || ch === '`') inString = ch;
      else if (ch === '(') depth++;
      else if (ch === ')') depth--;
    }
    end++;
  }
  if (depth !== 0) return null;

  const body = content.slice(start, end - 1);

  // 拆分字段定义 (按逗号,但忽略括号内和字符串内)
  const lines = splitSqlDefinition(body);

  const fields = [];
  const primaryKeys = new Set();
  const uniqueFields = new Set();

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // 跳过约束定义: PRIMARY KEY/UNIQUE KEY/KEY/INDEX/CONSTRAINT/FOREIGN KEY/CHECK/FULLTEXT
    if (/^(PRIMARY\s+KEY|UNIQUE\s+KEY|UNIQUE\s+INDEX|UNIQUE\s+|KEY\s+|INDEX\s+|CONSTRAINT\s+|FOREIGN\s+KEY|CHECK\s+|FULLTEXT\s+)/i.test(trimmed)) {
      // 提取 PRIMARY KEY (`id`, `code`) 中的字段
      const pkMatch = trimmed.match(/PRIMARY\s+KEY\s*\(([^)]+)\)/i);
      if (pkMatch) {
        const cols = pkMatch[1].split(',').map(s => s.replace(/[`"']/g, '').trim());
        cols.forEach(c => primaryKeys.add(c));
      }
      // UNIQUE INDEX `uk_xxx` (`field`)
      const uqMatch = trimmed.match(/UNIQUE\s+(?:KEY|INDEX)?\s*(?:[\`"][^]+?[\`"])?\s*\(([^)]+)\)/i);
      if (uqMatch) {
        const cols = uqMatch[1].split(',').map(s => s.replace(/[`"']/g, '').trim());
        // 单列 unique 标记到字段;多列 unique 忽略(表级约束)
        if (cols.length === 1) uniqueFields.add(cols[0]);
      }
      continue;
    }

    // 字段定义: `field_name` type [(N)] [UNSIGNED] [CHARACTER SET ...] [COLLATE ...] [NULL|NOT NULL] [DEFAULT xxx] [AUTO_INCREMENT] [UNIQUE] [PRIMARY KEY] [COMMENT '...']
    const fieldMatch = trimmed.match(
      /^[\`"]?([a-zA-Z0-9_]+)[\`"]?\s+([a-zA-Z]+(?:\([^)]+\))?)(.*)$/i,
    );
    if (!fieldMatch) continue;

    const fieldName = fieldMatch[1];
    const rawType = fieldMatch[2].trim();
    const rest = fieldMatch[3] || '';

    // 跳过明显的非字段行 (如 ) ENGINE=)
    if (/^(ENGINE|CHARACTER|COLLATE|ROW_FORMAT|AUTO_INCREMENT|COMMENT)\s*=/i.test(trimmed)) continue;

    const canonicalType = canonicalSqlType(rawType);
    const length = extractLength(rawType);

    const notNull = /NOT\s+NULL/i.test(rest) && !/NULL\s+DEFAULT/i.test(rest.replace(/NOT\s+NULL/i, ''));
    // 处理 "NULL DEFAULT NULL" 和 "NOT NULL DEFAULT ''" 等情况
    const hasNull = /\bNULL\b/i.test(rest) && !/NOT\s+NULL/i.test(rest);
    const hasDefault = /DEFAULT\s+/i.test(rest);
    let defaultValue = null;
    if (hasDefault) {
      const dm = rest.match(/DEFAULT\s+('([^']*)'|"([^"]*)"|NULL|CURRENT_TIMESTAMP|CURRENT_DATE|CURRENT_TIME|[\d.]+|\w+)/i);
      if (dm) {
        defaultValue = dm[2] !== undefined ? dm[2] : (dm[3] !== undefined ? dm[3] : dm[1]);
      }
    }
    const isAutoIncrement = /AUTO_INCREMENT/i.test(rest);
    const isUnique = /UNIQUE/i.test(rest) || uniqueFields.has(fieldName);
    const isPrimaryKey = /PRIMARY\s+KEY/i.test(rest) || primaryKeys.has(fieldName);

    fields.push({
      name: fieldName,
      rawType,
      canonicalType,
      length,
      notNull: notNull || isPrimaryKey, // PK 默认 NOT NULL
      hasDefault,
      defaultValue,
      isUnique,
      isPrimaryKey,
      isAutoIncrement,
    });
  }

  // 二次回填 PK/UNIQUE 到字段
  for (const f of fields) {
    if (primaryKeys.has(f.name)) f.isPrimaryKey = true;
    if (uniqueFields.has(f.name)) f.isUnique = true;
  }

  return fields;
}

/** 拆分 SQL 定义体 (按逗号,忽略括号内和字符串内) */
function splitSqlDefinition(body) {
  const parts = [];
  let depth = 0;
  let current = '';
  let inString = null;
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (inString) {
      current += ch;
      if (ch === inString && body[i - 1] !== '\\') inString = null;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      inString = ch;
      current += ch;
      continue;
    }
    if (ch === '(') { depth++; current += ch; continue; }
    if (ch === ')') { depth--; current += ch; continue; }
    if (ch === ',' && depth === 0) {
      parts.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  if (current.trim()) parts.push(current);
  return parts;
}

// ---------------------------------------------------------------------------
// Java Entity 解析器 (@Table 注解 + 字段声明)
// ---------------------------------------------------------------------------

/**
 * 在 ZHS_Server_java 目录中查找 @Table(name="tableName") 对应的 Java 文件
 * 支持被注释的 // @Table(name = "xxx")
 */
function findJavaEntityFile(tableName) {
  let out;
  try {
    out = execFileSync('rg', [
      '--no-heading', '-l',
      '--glob', '*.java',
      '-e', `@Table\\s*\\(\\s*name\\s*=\\s*["']${escapeRegex(tableName)}["']`,
      OLD_ZHS_JAVA_DIR,
    ], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, windowsHide: true });
  } catch (err) {
    if (err.status === 1) return null;
    throw err;
  }
  if (!out || !out.trim()) return null;
  return out.split(/\r?\n/)[0].trim();
}

/**
 * 从 Java 文件解析实体字段
 * 处理 @Column(name = "col_name") 注解 (含注释掉的 //)
 * Java 类型映射到 canonical SQL 类型
 */
function parseJavaEntity(filePath) {
  if (!filePath || !existsSync(filePath)) return null;
  const content = readFileSync(filePath, 'utf8', 'utf8');

  const fields = [];
  const lines = content.split(/\r?\n/);

  // 上下文: 当前字段最近的 @Column(name="...") 注解
  let pendingColumnName = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // 匹配 @Column(name = "col_name") (含被 // 注释的)
    const colMatch = trimmed.match(/@Column\s*\(\s*name\s*=\s*["']([a-zA-Z0-9_]+)["']\s*\)/i);
    if (colMatch) {
      pendingColumnName = colMatch[1];
      continue;
    }
    // 如果是 @Id 注解 (含注释)
    const isId = /@Id\b/.test(trimmed);

    // 匹配字段声明: [private|protected|public] Type fieldName;
    // 类型可能是 Long/Integer/String/Date/Boolean/BigDecimal/Double/Float/Object 等
    const fieldMatch = trimmed.match(
      /^(?:private|protected|public)\s+(?:final\s+)?([A-Za-z][A-Za-z0-9_<>,\s]*?)\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*(?:=[^;]+)?;/,
    );
    if (fieldMatch) {
      const javaType = fieldMatch[1].trim();
      const javaField = fieldMatch[2];
      // 列名: @Column(name=...) > camelCase 转 snake_case
      const columnName = pendingColumnName || camelToSnake(javaField);
      const canonicalType = canonicalJavaType(javaType);
      fields.push({
        name: columnName,
        rawType: javaType,
        canonicalType,
        length: null,
        notNull: false, // Java 不显式声明 NOT NULL
        hasDefault: false,
        defaultValue: null,
        isUnique: false,
        isPrimaryKey: isId,
        isAutoIncrement: false,
        _javaField: javaField,
      });
      pendingColumnName = null;
    } else if (trimmed && !trimmed.startsWith('//') && !trimmed.startsWith('/*') && !trimmed.startsWith('*')) {
      // 非注释非字段行,清空 pendingColumnName 上下文 (避免误关联)
      // 但保留 import/注解等行的上下文
      if (!trimmed.startsWith('@') && !trimmed.startsWith('import') && !trimmed.startsWith('package')) {
        pendingColumnName = null;
      }
    }
  }

  return fields;
}

/** camelCase → snake_case */
function camelToSnake(s) {
  return s.replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase();
}

// ---------------------------------------------------------------------------
// Drizzle schema 解析器 (pgTable)
// ---------------------------------------------------------------------------

/**
 * 从 Drizzle schema 文件中提取指定表的字段定义
 * 匹配 pgTable('tableName', { ... }) 或 pgTable('tableName', { ... }, (t) => ({...}))
 */
function parseDrizzleSchema(filePath, tableName) {
  if (!filePath || !existsSync(filePath)) return null;
  const content = readFileSync(filePath, 'utf8');

  // 匹配 pgTable('tableName', { 或 pgTable('tableName',\n  {
  const tableRe = new RegExp(
    `pgTable\\s*\\(\\s*['"\`]${escapeRegex(tableName)}['"\`]\\s*,\\s*\\{`,
    'i',
  );
  const startMatch = tableRe.exec(content);
  if (!startMatch) return null;

  // 找到 `{` 后平衡花括号
  const braceStart = startMatch.index + startMatch[0].lastIndexOf('{');
  let depth = 1;
  let end = braceStart + 1;
  let inString = null;
  while (end < content.length && depth > 0) {
    const ch = content[end];
    if (inString) {
      if (ch === inString && content[end - 1] !== '\\') inString = null;
    } else {
      if (ch === "'" || ch === '"' || ch === '`') inString = ch;
      else if (ch === '{') depth++;
      else if (ch === '}') depth--;
    }
    end++;
  }
  if (depth !== 0) return null;

  const body = content.slice(braceStart + 1, end - 1);

  // 拆分字段定义 (按逗号,忽略括号/花括号/方括号内和字符串内)
  const lines = splitTsObjectBody(body);

  const fields = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // 字段定义: propertyName: type('column_name', { length: N }).modifier().modifier()
    // type 可能是 serial/integer/varchar/text/timestamp/boolean/jsonb/uuid/decimal/...
    const fieldMatch = trimmed.match(
      /^([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*([a-zA-Z]+)\s*\(\s*['"`]([a-zA-Z0-9_]+)['"`]\s*(,\s*\{([^}]*)\})?\s*\)([\s\S]*)$/,
    );
    if (!fieldMatch) continue;

    const propertyName = fieldMatch[1];
    const drizzleFn = fieldMatch[2];
    const columnName = fieldMatch[3];
    const optsStr = fieldMatch[5] || '';
    const chain = fieldMatch[6] || '';

    const canonicalType = canonicalDrizzleType(drizzleFn);

    // 提取 length: N
    let length = null;
    const lenMatch = optsStr.match(/length\s*:\s*(\d+)/);
    if (lenMatch) length = Number(lenMatch[1]);

    const notNull = /\.notNull\s*\(\s*\)/.test(chain);
    const hasDefault = /\.default\s*\(/.test(chain) || /\.defaultNow\s*\(\s*\)/.test(chain) || /\.defaultRandom\s*\(\s*\)/.test(chain);
    let defaultValue = null;
    if (hasDefault) {
      const dm = chain.match(/\.default\s*\(\s*([^)]+?)\s*\)/);
      if (dm) defaultValue = dm[1].trim();
      else if (/\.defaultNow\s*\(\s*\)/.test(chain)) defaultValue = 'now()';
      else if (/\.defaultRandom\s*\(\s*\)/.test(chain)) defaultValue = 'random()';
    }
    const isUnique = /\.unique\s*\(\s*\)/.test(chain);
    const isPrimaryKey = /\.primaryKey\s*\(\s*\)/.test(chain);
    const isAutoIncrement = drizzleFn === 'serial' || drizzleFn === 'bigserial' || /\.autoincrement\s*\(\s*\)/.test(chain);

    fields.push({
      name: columnName,
      rawType: drizzleFn,
      canonicalType,
      length,
      notNull: notNull || isPrimaryKey,
      hasDefault,
      defaultValue,
      isUnique,
      isPrimaryKey,
      isAutoIncrement,
      _propertyName: propertyName,
    });
  }

  return fields;
}

/** 拆分 TS 对象体 (按逗号,忽略 ()/{} /[] 内和字符串内) */
function splitTsObjectBody(body) {
  const parts = [];
  let depth = 0;
  let current = '';
  let inString = null;
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (inString) {
      current += ch;
      if (ch === inString && body[i - 1] !== '\\') inString = null;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      inString = ch;
      current += ch;
      continue;
    }
    if (ch === '(' || ch === '{' || ch === '[') { depth++; current += ch; continue; }
    if (ch === ')' || ch === '}' || ch === ']') { depth--; current += ch; continue; }
    if (ch === ',' && depth === 0) {
      parts.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  if (current.trim()) parts.push(current);
  return parts;
}

// ---------------------------------------------------------------------------
// 字段级比对
// ---------------------------------------------------------------------------

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 类型是否匹配
 * - varchar 与 varchar(N): 长度可不同但都视为 varchar
 * - serial 与 integer: serial = integer + autoincrement
 */
function typeMatch(oldField, newField) {
  if (!oldField || !newField) return false;
  // serial 视为 integer
  const oldT = oldField.canonicalType;
  const newT = newField.canonicalType;
  if (oldT === newT) return true;
  // bigint ↔ integer (宽容: Drizzle 部分表可能用 integer 替代 bigint)
  if ((oldT === 'bigint' && newT === 'integer') || (oldT === 'integer' && newT === 'bigint')) return true;
  // serial(old: int auto_increment) ↔ integer (new: serial)
  // 此处已在 canonical 化为 integer
  return false;
}

/** 约束是否匹配 */
function constraintMatch(oldField, newField) {
  if (!oldField || !newField) return { notNull: false, hasDefault: false, isUnique: false, isPrimaryKey: false, all: false };
  const notNull = oldField.notNull === newField.notNull;
  const hasDefault = oldField.hasDefault === newField.hasDefault;
  const isUnique = oldField.isUnique === newField.isUnique;
  const isPrimaryKey = oldField.isPrimaryKey === newField.isPrimaryKey;
  // autoincrement 宽松匹配 (serial 隐含)
  const all = notNull && isPrimaryKey; // 核心约束: NOT NULL + PK
  return { notNull, hasDefault, isUnique, isPrimaryKey, all };
}

/**
 * 比对单张表
 * 返回 { oldTable, newTable, oldSource, newFile, fields: [...], stats: {...} }
 */
function compareTable(sample) {
  const { old: oldTable, new: newTable, old_source: oldSource, new_file: newFile, module } = sample;

  // 1. 提取旧表字段
  let oldFields = null;
  let oldFilePath = '';
  if (oldSource === 'edu-init_database.sql') {
    oldFilePath = OLD_EDU_SQL;
    if (existsSync(OLD_EDU_SQL)) {
      const content = readFileSync(OLD_EDU_SQL, 'utf8');
      oldFields = parseSqlCreateTable(content, oldTable);
    }
  } else if (oldSource === 'zhs-py-sql') {
    // 在 zhs-py-sql 目录中扫描所有 .sql 文件
    const sqlFiles = readdirSync(OLD_ZHS_PY_SQL_DIR).filter(f => f.endsWith('.sql'));
    for (const f of sqlFiles) {
      const fp = join(OLD_ZHS_PY_SQL_DIR, f);
      const content = readFileSync(fp, 'utf8');
      oldFields = parseSqlCreateTable(content, oldTable);
      if (oldFields) { oldFilePath = fp; break; }
    }
  } else if (oldSource === 'ry-sql') {
    const sqlFiles = readdirSync(OLD_RY_SQL_DIR).filter(f => f.endsWith('.sql'));
    for (const f of sqlFiles) {
      const fp = join(OLD_RY_SQL_DIR, f);
      const content = readFileSync(fp, 'utf8');
      oldFields = parseSqlCreateTable(content, oldTable);
      if (oldFields) { oldFilePath = fp; break; }
    }
  } else if (oldSource === 'zhs-java-@Table') {
    oldFilePath = findJavaEntityFile(oldTable) || '';
    if (oldFilePath) {
      oldFields = parseJavaEntity(oldFilePath);
    }
  }

  // 2. 提取新表字段
  let newFields = null;
  const newFilePath = join(NEW_SCHEMA_DIR, newFile);
  if (existsSync(newFilePath)) {
    newFields = parseDrizzleSchema(newFilePath, newTable);
  }

  // 3. 字段匹配与比对
  const fieldRows = [];
  const oldMap = new Map();
  const newMap = new Map();
  if (oldFields) oldFields.forEach(f => oldMap.set(f.name.toLowerCase(), f));
  if (newFields) newFields.forEach(f => newMap.set(f.name.toLowerCase(), f));

  const allNames = new Set([...oldMap.keys(), ...newMap.keys()]);
  let matchedCount = 0;
  let typeMatchedCount = 0;
  let notNullMatchedCount = 0;
  let defaultMatchedCount = 0;
  let uniqueMatchedCount = 0;
  let pkMatchedCount = 0;

  for (const name of allNames) {
    const o = oldMap.get(name);
    const n = newMap.get(name);
    let status, typeMatchStr = '', notNullMatchStr = '', defaultMatchStr = '', uniqueMatchStr = '', pkMatchStr = '';

    if (o && n) {
      status = 'matched';
      matchedCount++;
      const tm = typeMatch(o, n);
      typeMatchStr = tm ? 'yes' : 'no';
      if (tm) typeMatchedCount++;
      const cm = constraintMatch(o, n);
      notNullMatchStr = cm.notNull ? 'yes' : 'no';
      if (cm.notNull) notNullMatchedCount++;
      defaultMatchStr = cm.hasDefault ? 'yes' : 'no';
      if (cm.hasDefault) defaultMatchedCount++;
      uniqueMatchStr = cm.isUnique ? 'yes' : 'no';
      if (cm.isUnique) uniqueMatchedCount++;
      pkMatchStr = cm.isPrimaryKey ? 'yes' : 'no';
      if (cm.isPrimaryKey) pkMatchedCount++;
    } else if (o && !n) {
      status = 'missing_in_new'; // D 盘有但当前仓库无
    } else {
      status = 'new_in_new'; // 当前仓库有但 D 盘无
    }

    fieldRows.push({
      old_table: oldTable,
      new_table: newTable,
      module,
      field_name: name,
      status,
      old_type: o ? o.canonicalType : '',
      old_raw_type: o ? o.rawType : '',
      old_length: o && o.length ? String(o.length) : '',
      old_not_null: o ? (o.notNull ? 'yes' : 'no') : '',
      old_has_default: o ? (o.hasDefault ? 'yes' : 'no') : '',
      old_default: o ? String(o.defaultValue || '') : '',
      old_unique: o ? (o.isUnique ? 'yes' : 'no') : '',
      old_pk: o ? (o.isPrimaryKey ? 'yes' : 'no') : '',
      old_auto_inc: o ? (o.isAutoIncrement ? 'yes' : 'no') : '',
      new_type: n ? n.canonicalType : '',
      new_raw_type: n ? n.rawType : '',
      new_length: n && n.length ? String(n.length) : '',
      new_not_null: n ? (n.notNull ? 'yes' : 'no') : '',
      new_has_default: n ? (n.hasDefault ? 'yes' : 'no') : '',
      new_default: n ? String(n.defaultValue || '') : '',
      new_unique: n ? (n.isUnique ? 'yes' : 'no') : '',
      new_pk: n ? (n.isPrimaryKey ? 'yes' : 'no') : '',
      new_auto_inc: n ? (n.isAutoIncrement ? 'yes' : 'no') : '',
      type_match: typeMatchStr,
      not_null_match: notNullMatchStr,
      default_match: defaultMatchStr,
      unique_match: uniqueMatchStr,
      pk_match: pkMatchStr,
    });
  }

  const oldFieldCount = oldFields ? oldFields.length : 0;
  const newFieldCount = newFields ? newFields.length : 0;

  return {
    oldTable, newTable, oldSource, newFile, module,
    oldFilePath, newFilePath,
    oldFieldCount, newFieldCount,
    matchedCount,
    typeMatchedCount,
    notNullMatchedCount,
    defaultMatchedCount,
    uniqueMatchedCount,
    pkMatchedCount,
    fields: fieldRows,
  };
}

// ---------------------------------------------------------------------------
// 主流程
// ---------------------------------------------------------------------------

function main() {
  console.log('=== IHUI-AI DB Schema Field-Level Migration Audit ===\n');

  // 1. 加载阶段 3 CSV,确认 80 张 migrated 表
  console.log('[1/4] Loading stage 3 CSV...');
  if (!existsSync(STAGE3_CSV)) {
    console.error(`[fatal] Stage 3 CSV not found: ${STAGE3_CSV}`);
    process.exit(1);
  }
  const csvContent = readFileSync(STAGE3_CSV, 'utf8');
  const csvLines = csvContent.split(/\r?\n/).filter(l => l.trim());
  const migratedFromCsv = [];
  for (let i = 1; i < csvLines.length; i++) {
    const cols = parseCsvLine(csvLines[i]);
    if (cols[0] === 'migrated') {
      migratedFromCsv.push({
        old_table: cols[1], new_table: cols[2],
        old_source: cols[3], new_file: cols[4],
      });
    }
  }
  console.log(`  Stage 3 migrated tables: ${migratedFromCsv.length}\n`);

  // 2. 校验 20 张抽样表都在 migrated 清单中
  console.log('[2/4] Validating 20 sample tables...');
  for (const s of SAMPLE_TABLES) {
    const found = migratedFromCsv.find(m =>
      m.old_table === s.old && m.new_table === s.new && m.old_source === s.old_source
    );
    if (!found) {
      console.warn(`  [warn] sample not in stage 3 migrated: ${s.old} → ${s.new} (${s.old_source})`);
    }
  }
  console.log(`  Sample size: ${SAMPLE_TABLES.length} tables\n`);

  // 3. 字段级比对
  console.log('[3/4] Field-level comparison...');
  const results = [];
  for (const s of SAMPLE_TABLES) {
    const r = compareTable(s);
    results.push(r);
    console.log(`  ${s.module.padEnd(10)} ${s.old.padEnd(28)} → ${s.new.padEnd(28)} ` +
      `old=${r.oldFieldCount}f new=${r.newFieldCount}f matched=${r.matchedCount} ` +
      `type_ok=${r.typeMatchedCount} notnull_ok=${r.notNullMatchedCount} pk_ok=${r.pkMatchedCount}`);
  }
  console.log('');

  // 4. 写报告
  console.log('[4/4] Writing reports...');

  // CSV: 字段级对照
  const csvHeader = [
    'old_table', 'new_table', 'module', 'field_name', 'status',
    'old_type', 'old_raw_type', 'old_length', 'old_not_null', 'old_has_default', 'old_default', 'old_unique', 'old_pk', 'old_auto_inc',
    'new_type', 'new_raw_type', 'new_length', 'new_not_null', 'new_has_default', 'new_default', 'new_unique', 'new_pk', 'new_auto_inc',
    'type_match', 'not_null_match', 'default_match', 'unique_match', 'pk_match',
  ];
  const csvRows = [csvHeader.join(',')];
  for (const r of results) {
    for (const f of r.fields) {
      csvRows.push([
        f.old_table, f.new_table, f.module, f.field_name, f.status,
        f.old_type, f.old_raw_type, f.old_length, f.old_not_null, f.old_has_default, csvEscape(f.old_default), f.old_unique, f.old_pk, f.old_auto_inc,
        f.new_type, f.new_raw_type, f.new_length, f.new_not_null, f.new_has_default, csvEscape(f.new_default), f.new_unique, f.new_pk, f.new_auto_inc,
        f.type_match, f.not_null_match, f.default_match, f.unique_match, f.pk_match,
      ].join(','));
    }
  }
  writeFileSync(CSV_PATH, csvRows.join('\n') + '\n', 'utf8');
  console.log(`  CSV: ${CSV_PATH}`);

  // summary.json
  const totalOldFields = results.reduce((s, r) => s + r.oldFieldCount, 0);
  const totalNewFields = results.reduce((s, r) => s + r.newFieldCount, 0);
  const totalMatched = results.reduce((s, r) => s + r.matchedCount, 0);
  const totalTypeMatched = results.reduce((s, r) => s + r.typeMatchedCount, 0);
  const totalNotNullMatched = results.reduce((s, r) => s + r.notNullMatchedCount, 0);
  const totalDefaultMatched = results.reduce((s, r) => s + r.defaultMatchedCount, 0);
  const totalUniqueMatched = results.reduce((s, r) => s + r.uniqueMatchedCount, 0);
  const totalPkMatched = results.reduce((s, r) => s + r.pkMatchedCount, 0);

  // 字段缺失列表 (D 盘有但当前仓库无)
  const missingFields = [];
  const newFields = [];
  for (const r of results) {
    for (const f of r.fields) {
      if (f.status === 'missing_in_new') {
        missingFields.push({ table: r.oldTable, field: f.field_name, old_type: f.old_type });
      } else if (f.status === 'new_in_new') {
        newFields.push({ table: r.newTable, field: f.field_name, new_type: f.new_type });
      }
    }
  }

  const fieldCoveragePct = totalMatched === 0 ? 0 :
    Math.round((totalMatched / totalOldFields) * 1000) / 10;
  const typeMatchPct = totalMatched === 0 ? 0 :
    Math.round((totalTypeMatched / totalMatched) * 1000) / 10;
  const notNullMatchPct = totalMatched === 0 ? 0 :
    Math.round((totalNotNullMatched / totalMatched) * 1000) / 10;
  const defaultMatchPct = totalMatched === 0 ? 0 :
    Math.round((totalDefaultMatched / totalMatched) * 1000) / 10;
  const uniqueMatchPct = totalMatched === 0 ? 0 :
    Math.round((totalUniqueMatched / totalMatched) * 1000) / 10;
  const pkMatchPct = totalMatched === 0 ? 0 :
    Math.round((totalPkMatched / totalMatched) * 1000) / 10;

  // 按模块汇总
  const moduleStats = {};
  for (const r of results) {
    if (!moduleStats[r.module]) {
      moduleStats[r.module] = {
        tables: 0, oldFields: 0, newFields: 0, matched: 0,
        typeMatched: 0, notNullMatched: 0, pkMatched: 0,
      };
    }
    const m = moduleStats[r.module];
    m.tables++;
    m.oldFields += r.oldFieldCount;
    m.newFields += r.newFieldCount;
    m.matched += r.matchedCount;
    m.typeMatched += r.typeMatchedCount;
    m.notNullMatched += r.notNullMatchedCount;
    m.pkMatched += r.pkMatchedCount;
  }

  const summary = {
    generated_at: new Date().toISOString(),
    stage: 'field-level',
    stage3_csv: STAGE3_CSV,
    stage3_migrated_total: migratedFromCsv.length,
    sample_size: SAMPLE_TABLES.length,
    sample_modules: ['user', 'order', 'member', 'message', 'ai', 'role', 'permission', 'exam', 'comment'],
    sample_tables: results.map(r => ({
      module: r.module,
      old_table: r.oldTable,
      new_table: r.newTable,
      old_source: r.oldSource,
      old_file: r.oldFilePath,
      new_file: r.newFilePath,
      old_field_count: r.oldFieldCount,
      new_field_count: r.newFieldCount,
      matched: r.matchedCount,
      type_matched: r.typeMatchedCount,
      not_null_matched: r.notNullMatchedCount,
      pk_matched: r.pkMatchedCount,
    })),
    overall: {
      total_old_fields: totalOldFields,
      total_new_fields: totalNewFields,
      total_matched_fields: totalMatched,
      field_coverage_pct: fieldCoveragePct,
      type_match_pct: typeMatchPct,
      not_null_match_pct: notNullMatchPct,
      default_match_pct: defaultMatchPct,
      unique_match_pct: uniqueMatchPct,
      pk_match_pct: pkMatchPct,
      missing_fields_count: missingFields.length,
      new_fields_count: newFields.length,
    },
    module_stats: moduleStats,
    missing_fields: missingFields,
    new_fields: newFields,
    type_mapping_rules: {
      'INT/int': 'integer',
      'BIGINT': 'bigint',
      'TINYINT(1)': 'boolean',
      'VARCHAR(N)': 'varchar',
      'TEXT/LONGTEXT/MEDIUMTEXT': 'text',
      'TIMESTAMP/DATETIME': 'timestamp',
      'DATE': 'date',
      'BOOLEAN/BOOL': 'boolean',
      'JSON': 'jsonb',
      'DECIMAL/NUMERIC': 'decimal',
      'FLOAT': 'real',
      'UUID': 'uuid',
    },
    constraint_mapping_rules: {
      'NOT NULL': 'notNull()',
      'DEFAULT xxx': 'default(xxx)',
      'UNIQUE': 'unique()',
      'PRIMARY KEY': 'primaryKey()',
      'AUTO_INCREMENT': 'serial/autoincrement()',
    },
    csv_path: CSV_PATH,
  };

  writeFileSync(SUMMARY_PATH, JSON.stringify(summary, null, 2), 'utf8');
  console.log(`  Summary: ${SUMMARY_PATH}\n`);

  console.log('=== Field-Level Audit Complete ===');
  console.log(`Sample: ${SAMPLE_TABLES.length} tables | Old fields: ${totalOldFields} | New fields: ${totalNewFields} | Matched: ${totalMatched}`);
  console.log(`Field coverage: ${fieldCoveragePct}% | Type match: ${typeMatchPct}% | NOT NULL match: ${notNullMatchPct}% | PK match: ${pkMatchPct}%`);
  console.log(`Missing fields (D-only): ${missingFields.length} | New fields (new-only): ${newFields.length}`);
}

/** CSV 行解析 (处理引号转义) */
function parseCsvLine(line) {
  const result = [];
  let current = '';
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuote) {
      if (ch === '"' && line[i + 1] === '"') { current += '"'; i++; }
      else if (ch === '"') inQuote = false;
      else current += ch;
    } else {
      if (ch === '"') inQuote = true;
      else if (ch === ',') { result.push(current); current = ''; }
      else current += ch;
    }
  }
  result.push(current);
  return result;
}

/** CSV 字段转义 */
function csvEscape(s) {
  if (s == null) return '';
  s = String(s);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

main();
