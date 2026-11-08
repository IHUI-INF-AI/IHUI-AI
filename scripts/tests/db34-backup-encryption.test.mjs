// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// DB-34 夹具:备份产物必须走静态加密,且无密钥时 fail-closed 不产出明文。
//
// 判据只用**会执行的代码**:两条脚本里都写了 "age 加密" 的说明文案,
// 整文件 includes 会把"写下要求"当成"做到了要求",所以先剥注释再量。
//
// 运行:`node --test scripts/tests/db34-backup-encryption.test.mjs`
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const SH_REL = join('deploy', 'scripts', 'backup-db.sh')
const MJS_REL = join('apps', 'api', 'scripts', 'pg-backup.mjs')

const SH_SRC = readFileSync(join(REPO, SH_REL), 'utf8')
const MJS_SRC = readFileSync(join(REPO, MJS_REL), 'utf8')

/** shell:整行以 # 开头的是注释;行尾 # 不动(本脚本代码段无行尾注释) */
const shCodeOf = (text) =>
  text
    .split(/\r?\n/)
    .filter((l) => !/^\s*#/.test(l))
    .join('\n')

/** js:剥 // 行注释与 /* *\/ 块注释(本脚本代码段无 URL 字面量,不会误伤) */
const jsCodeOf = (text) =>
  text
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .split(/\r?\n/)
    .filter((l) => !/^\s*\/\//.test(l))
    .join('\n')

const SH = shCodeOf(SH_SRC)
const MJS = jsCodeOf(MJS_SRC)

// ── 判据(纯函数,变异面用同一把尺子)────────────────────────────
const shHas = {
  pipelineEncrypts: (code) =>
    /pg_dump[\s\S]{0,400}--format=plain[\s\S]{0,200}\|\s*gzip -9\s*\|\s*age -r "\$\{BACKUP_ENC_RECIPIENT\}"/.test(
      code,
    ) && /tar -czf - -C "\$\{WAL_ARCHIVE_DIR\}" .[\s\S]{0,120}\|\s*age -r "\$\{BACKUP_ENC_RECIPIENT\}"/.test(code),
  failClosedWithoutKey: (code) => {
    const fn = code.indexOf('backup_enc_mode()')
    if (fn < 0) return false
    const seg = code.slice(fn, fn + 1600)
    const msg = seg.indexOf('BACKUP_ENC_RECIPIENT 未配置')
    const exitAfterMsg = msg >= 0 ? seg.indexOf('exit 1', msg) : -1
    // 无公钥 + 未显式放行明文 ⇒ 必须 exit 1(不是"继续跑"也不是"空返回")
    return (
      /BACKUP_ALLOW_PLAINTEXT\}" == "1"/.test(seg) &&
      msg >= 0 &&
      exitAfterMsg > msg &&
      /command -v age/.test(seg)
    )
  },
  encryptedSuffix: (code) =>
    /enc_mode.*age.*\.age/s.test(code) &&
    /gen_filename full "\$\{enc_mode\}"/.test(code) &&
    /gen_filename wal "\$\{enc_mode\}"/.test(code),
  verifyCiphertext: (code) =>
    /verify_artifact\(/.test(code) &&
    /age-encryption\.org\/v1/.test(code) &&
    /age -d -i "\$\{BACKUP_AGE_IDENTITY\}"/.test(code),
  retentionCoversCiphertext: (code) => code.includes('(\\.[a-z]+)?$'),
}

const mjsHas = {
  pipelineEncrypts: (code) => /spawn\('age', \['-r', encRecipient, '-o', outFile\]/.test(code),
  failClosedWithoutKey: (code) =>
    /BACKUP_ENC_RECIPIENT/.test(code) &&
    /BACKUP_ALLOW_PLAINTEXT/.test(code) &&
    /process\.exit\(1\)/.test(code) &&
    /拒绝产出明文备份/.test(code),
  encryptedSuffix: (code) => /encrypted \? '.age' : ''/.test(code),
  verifyCiphertext: (code) =>
    /age-encryption\.org\/v1/.test(code) && /BACKUP_AGE_IDENTITY/.test(code) && /spawn\('age', \['-d', '-i', ageIdentity, outFile\]/.test(code),
  retentionCoversCiphertext: (code) => /endsWith\('\.sql\.gz\.age'\)/.test(code),
}

function shHealth(code) {
  return Object.entries(shHas)
    .filter(([, fn]) => !fn(code))
    .map(([k]) => k)
}
function mjsHealth(code) {
  return Object.entries(mjsHas)
    .filter(([, fn]) => !fn(code))
    .map(([k]) => k)
}

test('D34-1 shell 全量/增量都走 age 加密链路,且有密钥缺失时的 fail-closed', () => {
  assert.deepEqual(shHealth(SH), [], `backup-db.sh 判据未成立:${shHealth(SH).join(',')}`)
})

test('D34-2 Node 导出脚本同样默认 age 加密 + 拒绝明文 + 可复原的自检', () => {
  assert.deepEqual(mjsHealth(MJS), [], `pg-backup.mjs 判据未成立:${mjsHealth(MJS).join(',')}`)
})

test('D34-3 变异对照:摘掉加密管道 / 摘掉 fail-closed / 摘掉密文自检,同一把尺子必须逐条翻假', () => {
  // 臂 A:把 shell 全量管道里的 age 段摘掉(退回明文落盘)
  const shNoAge = SH.replace('| gzip -9 | age -r "${BACKUP_ENC_RECIPIENT}" -o "${filepath}"', '| gzip -9 > "${filepath}"')
  assert.notEqual(shNoAge, SH, '夹具自证:臂 A 确实动过全量管道')
  assert.ok(shHealth(shNoAge).includes('pipelineEncrypts'), '摘掉 age 管道后 pipelineEncrypts 必须翻假')

  // 臂 B:把"无密钥即 exit 1"改成悄悄放行(摘掉拒绝分支里的 exit)
  const shNoFail = SH.replace(/\n\s*log_persist ERROR "backup FAILED at encryption-not-configured"\r?\n\s*exit 1/, '\n  log_persist ERROR "backup FAILED at encryption-not-configured"')
  assert.notEqual(shNoFail, SH, '夹具自证:臂 B 确实动过 fail-closed 分支')
  assert.ok(shHealth(shNoFail).includes('failClosedWithoutKey'), '摘掉 exit 1 后 failClosedWithoutKey 必须翻假')

  // 臂 C:Node 产物后缀退回 .sql.gz(密文写成明文名)
  const mjsNoSuffix = MJS.replace("encrypted ? '.age' : ''", "''")
  assert.notEqual(mjsNoSuffix, MJS, '夹具自证:臂 C 确实动过产物后缀')
  assert.ok(mjsHealth(mjsNoSuffix).includes('encryptedSuffix'), '后缀退回后 encryptedSuffix 必须翻假')

  // 臂 D:Node 去掉 age 文件头自检(损坏密文会被当成功)
  const mjsNoVerify = MJS.replace(/if \(!head\.includes\('age-encryption\.org\/v1'\)\)[\s\S]{0,120}/, '')
  assert.notEqual(mjsNoVerify, MJS, '夹具自证:臂 D 确实动过密文自检')
  assert.ok(mjsHealth(mjsNoVerify).includes('verifyCiphertext'), '摘掉文件头自检后 verifyCiphertext 必须翻假')
})
