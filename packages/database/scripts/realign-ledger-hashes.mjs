// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * realign-ledger-hashes.mjs —— 把 drizzle 账本记录与现文件对齐（**只改记账，不执行任何迁移 SQL**）。
 *
 * 立因（2026-11-10 两次实测）：
 *   已应用的历史迁移件被"幂等化/补哨兵/排版"改写后，文件 sha256 变了，而账本里那行的 hash 还是
 *   旧内容的。此时：
 *     · `scripts/check-migrations-landed.mjs`（部署环切流前硬闸）判 `missing` ⇒ 拒绝上线；
 *     · `scripts/check-db-migration-gaps.mjs` 报 `hashDrift=N`。
 *   两次都是我手工写临时脚本对齐的 —— 这套动作必须固化成器物，否则下次还要重写一遍。
 *
 * 为什么"对齐 hash"是如实的、而不是掩盖：
 *   ① 账本里那行本就在 ⇒ 记录为"该迁移已应用"；
 *   ② `migrate()` 运行期只比 `created_at` 与 `folderMillis`，**从不校验 hash**，hash 纯属记账身份；
 *   ③ DDL 是否真在库，由 `--probe` 之外的手段证明（本器不假装能证明它）：先用
 *      `apply-migration.mjs` 的事务内幂等执行，或直接查 information_schema 确认对象存在。
 *
 * 口径（与各门同源，不得另抄一份）：
 *   · 候选形态 = `scripts/check-migration-bookkeeping.mjs` 的 `b11ComparableForms`（含全文/剥水印等 5 形态）；
 *     账本实际记录的是 drizzle 自己的口径 ⇒ 取 cand[0]（整份文件全文）作为写入值。
 *   · 判"是否已对齐" = 账本 hash ∈ 该文件任一候选形态。
 *
 * 用法：
 *   node scripts/realign-ledger-hashes.mjs              # dry-run，只报不改（默认）
 *   node scripts/realign-ledger-hashes.mjs --apply      # CAS 写库，逐条打印回滚 SQL
 *   node scripts/realign-ledger-hashes.mjs --json       # 机器可读
 *
 * 退出码：0=一致或已修复 / 1=存在漂移但未 --apply / 2=无法判定（缺 DSN、文件缺失、库读不出）。
 * 环境：DATABASE_URL（必填）。生产口令只从进程环境读，绝不落盘、不回显。
 */

import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import postgres from 'postgres';
import { b11ComparableForms } from '../../../scripts/check-migration-bookkeeping.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const MIG_DIR = join(ROOT, 'drizzle');
const JOURNAL = join(MIG_DIR, 'meta', '_journal.json');

const sha256Hex = (s) => createHash('sha256').update(s).digest('hex');

function parseArgs(argv) {
  const out = { apply: false, json: false };
  for (const a of argv.slice(2)) {
    if (a === '--apply') out.apply = true;
    else if (a === '--json') out.json = true;
    else if (a === '--help' || a === '-h') out.help = true;
    else if (a.startsWith('--')) throw new Error(`未知参数 ${a}`);
  }
  return out;
}

function die(msg) {
  console.error(`❌ ${msg}`);
  process.exit(2);
}

const args = parseArgs(process.argv);
if (args.help) {
  console.log('node scripts/realign-ledger-hashes.mjs [--apply] [--json]');
  process.exit(0);
}

const dsn = String(process.env.DATABASE_URL ?? '').trim();
if (!dsn) die('缺 DATABASE_URL —— 本器不接受命令行明文口令，请用环境变量注入');
if (!fs.existsSync(JOURNAL)) die(`找不到 journal：${JOURNAL}`);

const journal = JSON.parse(fs.readFileSync(JOURNAL, 'utf8'));
const entries = Array.isArray(journal.entries) ? journal.entries : [];

const sql = postgres(dsn, { max: 1, onnotice: () => {} });
let rows;
try {
  rows = await sql`select created_at, hash from drizzle.__drizzle_migrations`;
} catch (e) {
  await sql.end();
  die(`读账本失败：${e.message}`);
}

const byCreatedAt = new Map(rows.map((r) => [String(r.created_at), String(r.hash).toLowerCase()]));

const report = { ok: [], drift: [], absent: [], missingFile: [], orphan: [] };
const pending = [];

for (const e of entries) {
  const file = join(MIG_DIR, `${e.tag}.sql`);
  const createdAt = String(e.when);
  const recorded = byCreatedAt.get(createdAt);

  if (!fs.existsSync(file)) {
    report.missingFile.push({ tag: e.tag, idx: e.idx, when: e.when });
    continue;
  }
  const text = fs.readFileSync(file, 'utf8');
  const candidates = b11ComparableForms(text).candidates.map(sha256Hex);

  if (recorded === undefined) {
    report.absent.push({ tag: e.tag, idx: e.idx, when: e.when, want: candidates[0] });
    continue;
  }
  if (candidates.includes(recorded)) {
    report.ok.push({ tag: e.tag, idx: e.idx, when: e.when });
    continue;
  }
  report.drift.push({ tag: e.tag, idx: e.idx, when: e.when, from: recorded, to: candidates[0] });
  pending.push({ createdAt: e.when, from: recorded, to: candidates[0], tag: e.tag });
}

const journalWhens = new Set(entries.map((e) => String(e.when)));
for (const [createdAt, hash] of byCreatedAt) {
  if (!journalWhens.has(createdAt)) report.orphan.push({ when: Number(createdAt), hash });
}

const updated = [];
if (args.apply && pending.length) {
  await sql.begin(async (tx) => {
    await tx`select pg_advisory_xact_lock(hashtext('ihui:ledger-hash-align'))`;
    for (const p of pending) {
      const r = await tx`
        update drizzle.__drizzle_migrations
           set hash = ${p.to}
         where created_at = ${p.createdAt} and hash = ${p.from}
        returning created_at`;
      if (r.length === 1) updated.push(p);
    }
  });
}

if (args.json) {
  console.log(
    JSON.stringify(
      {
        verdict: report.drift.length || report.absent.length || report.orphan.length ? (args.apply ? 'realigned' : 'drift') : 'aligned',
        counts: {
          journal: entries.length,
          ledger: rows.length,
          ok: report.ok.length,
          drift: report.drift.length,
          absent: report.absent.length,
          missingFile: report.missingFile.length,
          orphan: report.orphan.length,
          updated: updated.length,
        },
        report,
        rollback: updated.map((p) => `UPDATE drizzle."__drizzle_migrations" SET hash='${p.from}' WHERE created_at=${p.createdAt};`),
      },
      null,
      2,
    ),
  );
} else {
  for (const p of report.drift) {
    console.log(`DRIFT  ${p.tag}  when=${p.when}\n       账本=${p.from}\n       现文件候选=${p.to}`);
  }
  for (const p of report.absent) console.log(`ABSENT ${p.tag}  when=${p.when}  —— 账本无该水位行（须走 apply-migration.mjs 补录，本器不代替它）`);
  for (const p of report.missingFile) console.log(`NOFILE ${p.tag}  idx=${p.idx}  —— journal 有条目但 .sql 缺失(db:migrate 会 ENOENT)`);
  for (const p of report.orphan) console.log(`ORPHAN when=${p.when}  hash=${p.hash}  —— 账本有行/journal 无对应条目`);

  const head = `journal=${entries.length} / ledger=${rows.length} / 一致=${report.ok.length} / 漂移=${report.drift.length} / 缺行=${report.absent.length} / 缺文件=${report.missingFile.length} / 孤儿=${report.orphan.length}`;
  if (args.apply) {
    console.log(`\n${head}\n✅ 已对齐 ${updated.length} 条（逐条 CAS：created_at + 旧 hash 双条件命中才改）`);
    for (const p of updated) {
      console.log(`ROLLBACK: UPDATE drizzle."__drizzle_migrations" SET hash='${p.from}' WHERE created_at=${p.createdAt};`);
    }
  } else {
    console.log(`\n${head}`);
    if (report.drift.length || report.absent.length || report.orphan.length || report.missingFile.length) {
      console.log('ℹ 本轮 dry-run 未改库。确认 DDL 实物在库后加 --apply 才写账本（只改记账，不执行 SQL）。');
    } else {
      console.log('✅ 账本与现文件一致');
    }
  }
}

await sql.end();

const red = report.drift.length + report.absent.length + report.orphan.length + report.missingFile.length;
if (!red) process.exit(0);
process.exit(args.apply && report.orphan.length + report.absent.length + report.missingFile.length === 0 ? 0 : 1);
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
