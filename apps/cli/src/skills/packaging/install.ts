// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 技能包 install / uninstall —— 原子落位与彻底卸载。
 *
 * **安装期不执行包内代码**的落盘侧证据:
 *   - 本文件只 import `node:fs` / `node:path` / `node:crypto` 与同目录纯函数;
 *   - 不 import `node:child_process`,不出现 spawn/exec/execFile/eval/new Function;
 *   - 落盘只有 `mkdirSync` / `writeFileSync` / `chmodSync` / `renameSync` / `rmSync`,
 *     且一律写常规文件、强制 0644(可执行位在 verify 阶段已被拒绝);
 *   - 落位顺序:先在同一安装根下的 `.staging-*` 写完,再三步换名提交;
 *     任一失败都清理 staging 并恢复旧目录 ⇒ 不会留下"半个技能"。
 */

import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { randomUUID } from 'node:crypto'
import { getIhuiRoot } from '../../plugins/paths.js'
import { SkillPackageError } from './errors.js'
import { verifySkillPackage, type VerifySkillPackageOptions } from './verify.js'

export interface SkillPackagePaths {
  /** 技能安装根;缺省 ~/.ihui/installed-skills */
  installRoot?: string
}

export function getDefaultSkillInstallRoot(): string {
  return path.join(getIhuiRoot(), 'installed-skills')
}

export interface InstalledSkillPackage {
  ok: true
  id: string
  version: string
  installedPath: string
  /** 实际落盘的常规文件列表(相对安装目录) */
  files: string[]
  /** 是否替换了同 id 旧版本 */
  replacedExisting: boolean
}

type InstallOptions = VerifySkillPackageOptions & SkillPackagePaths

function stagingId(): string {
  return `${process.pid}-${randomUUID().slice(0, 8)}`
}

function writeStagedTree(targetDir: string, contents: ReadonlyMap<string, Buffer>): string[] {
  const files: string[] = []
  for (const [relative, bytes] of [...contents.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    const absolute = path.join(targetDir, ...relative.split('/'))
    fs.mkdirSync(path.dirname(absolute), { recursive: true })
    fs.writeFileSync(absolute, bytes, { mode: 0o644 })
    fs.chmodSync(absolute, 0o644)
    files.push(relative)
  }
  return files
}

function assertSafePackageId(id: string): void {
  if (!/^[a-z0-9][a-z0-9._-]{0,63}$/.test(id)) {
    throw new SkillPackageError('SKILL_PKG_INSTALL_COMMIT_FAILED', `非法技能包 id(拒绝作为目录名):${id}`, { id })
  }
}

/**
 * 安装:整包校验全部通过后才落盘;落盘在 staging,提交用"旧名让位 → 新名上位 →
 * 清旧名"的三步换名。任何一步失败都会恢复旧版本并删 staging。
 */
export function installSkillPackage(packagePath: string, options: InstallOptions = {}): InstalledSkillPackage {
  const installRoot = options.installRoot ?? getDefaultSkillInstallRoot()
  const verification = verifySkillPackage(packagePath, options)
  if (!verification.ok) {
    throw verification.error ?? new SkillPackageError('SKILL_PKG_MANIFEST_INVALID', '包校验未通过')
  }
  const identity = verification.identity
  const contents = verification.contents
  if (!identity || !contents) {
    throw new SkillPackageError('SKILL_PKG_MANIFEST_INVALID', '包校验结果缺少 manifest 身份或文件内容')
  }

  const id = identity.id
  assertSafePackageId(id)
  const stagingDir = path.join(installRoot, `.staging-${stagingId()}`)
  const finalPath = path.join(installRoot, id)
  const supersededPath = path.join(installRoot, `.superseded-${id}-${stagingId()}`)
  let movedOld = false
  let committed = false
  let files: string[] = []
  try {
    fs.mkdirSync(installRoot, { recursive: true })
    fs.mkdirSync(stagingDir, { recursive: true })
    files = writeStagedTree(stagingDir, contents)

    if (fs.existsSync(finalPath)) {
      fs.renameSync(finalPath, supersededPath)
      movedOld = true
    }
    fs.renameSync(stagingDir, finalPath)
    committed = true
    if (movedOld) fs.rmSync(supersededPath, { recursive: true, force: true })
    return {
      ok: true,
      id,
      version: identity.version,
      installedPath: finalPath,
      files,
      replacedExisting: movedOld,
    }
  } catch (err) {
    // 回滚:新目录未提交 ⇒ 删 staging;旧目录已让位 ⇒ 原样搬回。
    try {
      if (!committed && movedOld) fs.renameSync(supersededPath, finalPath)
      if (!committed && fs.existsSync(stagingDir)) fs.rmSync(stagingDir, { recursive: true, force: true })
    } catch {
      // 恢复失败也不能吞掉原始错误;rollback 详情进 detail 供报告点名
    }
    throw new SkillPackageError(
      'SKILL_PKG_INSTALL_COMMIT_FAILED',
      `技能包落位失败并已回滚:${err instanceof Error ? err.message : String(err)}`,
      {
        id,
        installRoot,
        staging: stagingDir,
        finalPath,
        cause: err instanceof Error ? err.message : String(err),
        stagingRemoved: !fs.existsSync(stagingDir),
        oldRestored: !movedOld || fs.existsSync(finalPath),
      },
    )
  }
}

export interface UninstallResult {
  ok: true
  id: string
  removed: boolean
  /** 逐项删除的文件清单(相对安装目录) */
  removedFiles: string[]
  /** 删除后再次枚举的残留(必须为空) */
  residual: string[]
}

function listEntriesRecursively(root: string): { files: string[]; dirs: string[] } {
  const files: string[] = []
  const dirs: string[] = []
  const walk = (relative: string): void => {
    const absolute = path.join(root, ...relative.split('/').filter(Boolean))
    for (const entry of fs.readdirSync(absolute, { withFileTypes: true })) {
      const child = relative ? `${relative}/${entry.name}` : entry.name
      if (entry.isDirectory()) {
        dirs.push(child)
        walk(child)
      } else {
        files.push(child)
      }
    }
  }
  walk('')
  return { files, dirs }
}

/**
 * 卸载:先列清单,再逐个文件删除,最后自底向上删目录,并复枚举确认无残留。
 * 残留非空 ⇒ SKILL_PKG_UNINSTALL_RESIDUE(带 residual 清单),绝不"看起来删掉了"。
 */
export function uninstallSkillPackage(id: string, options: SkillPackagePaths = {}): UninstallResult {
  assertSafePackageId(id)
  const installRoot = options.installRoot ?? getDefaultSkillInstallRoot()
  const target = path.join(installRoot, id)
  if (!fs.existsSync(target)) {
    return { ok: true, id, removed: false, removedFiles: [], residual: [] }
  }
  if (!fs.statSync(target).isDirectory()) {
    throw new SkillPackageError('SKILL_PKG_UNINSTALL_RESIDUE', `安装路径不是目录,拒绝递归删除:${target}`, {
      id,
      path: target,
    })
  }

  const { files, dirs } = listEntriesRecursively(target)
  for (const file of files) fs.rmSync(path.join(target, ...file.split('/')), { force: true })
  for (const dir of dirs.sort((a, b) => b.length - a.length)) {
    fs.rmdirSync(path.join(target, ...dir.split('/')))
  }
  fs.rmdirSync(target)

  const residual = fs.existsSync(target) ? listEntriesRecursively(target).files : []
  if (residual.length > 0) {
    throw new SkillPackageError('SKILL_PKG_UNINSTALL_RESIDUE', `卸载后仍有残留:${residual.join(', ')}`, {
      id,
      residual,
    })
  }
  return { ok: true, id, removed: true, removedFiles: files, residual }
}

/** 就绪性探针:安装根是否可写(CLI 在安装前给一句人话,不改变判定)。 */
export function describeDefaultSkillInstallRoot(): string {
  const root = getDefaultSkillInstallRoot()
  return `技能安装根:${root}(家目录:${os.homedir()})`
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
