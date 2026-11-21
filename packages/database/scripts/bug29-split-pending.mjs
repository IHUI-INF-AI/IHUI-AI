// BUG-29 入链准备：把隔离迁移按三前置拆成 3 个独立幂等脚本。
// 前置①按包分批(索引/唯一索引/FK 各一件,单件失败不连坐)；
// 前置②能并发建的索引一律 CONCURRENTLY(故必须事务外跑,不得回 journal —— 与①互斥,如实标注)；
// 前置③由 DBA 在生产库克隆逐件跑到 rc=0 后才 renumber(本步不改 journal)。
// 幂等:普通索引 IF NOT EXISTS;唯一索引保留原 DO+EXCEPTION;FK 保留原 DO+EXCEPTION。
import fs from 'node:fs'

const SRC = 'packages/database/drizzle-pending-review/20261106150000_fix_missing_indexes_fks.sql'
const OUT_DIR = 'packages/database/drizzle-pending-review'
const src = fs.readFileSync(SRC, 'utf8')
const lines = src.split('\n')

// 三段边界(0-based)
const s1 = lines.findIndex(l => /^-- ---------- ①/.test(l))
const s2 = lines.findIndex(l => /^-- ---------- ②/.test(l))
const s3 = lines.findIndex(l => /^-- ---------- ③/.test(l))
const s3End = lines.findIndex(l => /^-- ③ 实际生成 FK/.test(l)) + 1
if (s1 < 0 || s2 < 0 || s3 < 0 || s3End < 0) throw new Error('段边界解析失败')

// ①段:区分普通索引(→CONCURRENTLY)与唯一索引 DO 块(原样保留)
function splitSection(start, end) {
  const out = []
  let i = start
  while (i < end) {
    const l = lines[i]
    if (/^CREATE INDEX IF NOT EXISTS/.test(l)) {
      out.push({ kind: 'plain', text: l })
      i++
    } else if (/^DO \$\$/.test(l)) {
      // 收集到对应 END $$; —— 支持 `END $$;` 单独成行，也支持内嵌在
      // `EXCEPTION WHEN others THEN NULL; END $$;` 行（行首是 EXCEPTION），
      // 故用行内匹配 /\bEND \$\$;/ 兼容两种形态。
      const buf = [l]
      i++
      while (i < end && !/\bEND \$\$;/.test(lines[i])) { buf.push(lines[i]); i++ }
      if (i < end) buf.push(lines[i]) // END $$; 所在行
      i++
      out.push({ kind: 'unique', text: buf.join('\n') })
    } else {
      i++ // 空行/注释行跳过(注释由新文件头统一写)
    }
  }
  return out
}

const sec1 = splitSection(s1, s2)
const sec2 = splitSection(s2, s3).filter(x => x.kind === 'plain')
const sec3 = splitSection(s3, s3End).filter(x => x.kind === 'unique') // FK DO 块

console.log(`①普通 ${sec1.filter(x=>x.kind==='plain').length} + 唯一 ${sec1.filter(x=>x.kind==='unique').length}`)
console.log(`②普通 ${sec2.length}`)
console.log(`③FK DO块 ${sec3.length}`)

const PROVENANCE = `-- © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
-- Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。`

const HEADER = (pkg, desc, n, extra) => `-- BUG-29 入链准备 包 ${pkg}/3:${desc}
-- 拆自 20261106150000_fix_missing_indexes_fks.sql(隔离待审件),按三前置改写:
--   ① 按包分批 —— 本件单跑,失败不连坐其它两件;
--   ② ${extra}
--   ③ 执行通道 —— 本件**不进 drizzle journal**。CONCURRENTLY 不能在事务块内跑,
--     而 drizzle-kit migrate 在事务内跑迁移 ⇒ 本件只能由 DBA 用 psql 在事务外逐件执行:
--       psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f <本件>
--     每件跑到 rc=0 才继续下一件;三件全绿后由机主决定是否 renumber 回 journal。
-- 幂等:全部 IF NOT EXISTS / DO+EXCEPTION 守卫,可重复执行。
-- 共 ${n} 条对象。本件只补齐,不删除任何既有对象、不改数据。
${PROVENANCE}
`

// 包1:索引包(①段普通索引 + ②段全部普通索引,均 CONCURRENTLY)
const pkg1Plain = [...sec1.filter(x=>x.kind==='plain'), ...sec2]
const pkg1Lines = pkg1Plain.map(x => x.text.replace(
  /^CREATE INDEX IF NOT EXISTS /, 'CREATE INDEX CONCURRENTLY IF NOT EXISTS '))
const pkg1 = HEADER('1', '为无索引的外键列/声明缺失列补普通 btree 索引(全部 CONCURRENTLY 零锁在线建)',
  pkg1Lines.length,
  '能并发建的一律 CONCURRENTLY —— 故本件**必须事务外** psql 执行,不得回 journal'
) + pkg1Lines.map(l => l + '\n').join('') +
`\n-- 包1 实际生成索引语句数: ${pkg1Lines.length}\n`

// 包2:唯一索引包(①段 3 个唯一索引 DO 块,原样保留 —— 非 CONCURRENTLY,语义不同)
const pkg2Unique = sec1.filter(x=>x.kind==='unique')
const pkg2 = HEADER('2', '补齐 schema 声明但迁移链缺失的唯一索引(保留 DO+EXCEPTION 守卫)',
  pkg2Unique.length,
  '唯一索引用 DO+EXCEPTION 而非 CONCURRENTLY:存量重复行会抛 unique_violation 被捕获成 NOTICE,待 DBA 清理后补建(语义与普通索引不同)'
) + pkg2Unique.map(x => x.text + '\n\n').join('') +
`-- 包2 实际生成唯一索引语句数: ${pkg2Unique.length}\n`

// 包3:FK 包(③段 28 个 DO 块原样保留)
const pkg3 = HEADER('3', '为无 FK 的 userId 列补外键(DO 块守卫 + EXCEPTION 防脏数据中断)',
  sec3.length,
  'FK 用 DO+EXCEPTION(IF NOT EXISTS 守卫 + 脏数据不中断),与索引包分件使 FK 失败不连坐索引'
) + sec3.map(x => x.text + '\n\n').join('') +
`-- 包3 实际生成 FK 语句数: ${sec3.length}\n`

fs.writeFileSync(`${OUT_DIR}/20261119120000_bug29_pkg1_indexes_concurrently.sql`, pkg1)
fs.writeFileSync(`${OUT_DIR}/20261119120001_bug29_pkg2_unique_indexes.sql`, pkg2)
fs.writeFileSync(`${OUT_DIR}/20261119120002_bug29_pkg3_foreign_keys.sql`, pkg3)
console.log('3 packages written to', OUT_DIR)
