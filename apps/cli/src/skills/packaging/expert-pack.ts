// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 专家包生成器:一组技能 id + 规则/提示模板 + 模型档位 ⇒ 可安装的 expert-pack。
 *
 * 三个硬约束:
 *   1. **引用必须真实存在**:每个 skill id 都要在当前技能源里找到 manifest.json,
 *      找不到就 SKILL_PKG_EXPERT_SKILL_NOT_FOUND 并点名该 id —— 不生成"看起来完整"的空包;
 *   2. **可重现**:manifest 无时间戳;tar 写入端固定 mtime/属主/模式并排序;
 *      checksums 走 canonicalJson(递归排序 + 固定缩进);ed25519 签名确定性。
 *      同一输入两次生成 ⇒ checksums.json 逐字节相同(整包也逐字节相同);
 *   3. **闭环**:生成即用同一个 ManifestGate 自检;产物结构=技能包 (manifest.json +
 *      checksums.json + signature.json + payload),可直接被 verify/install 消费。
 *
 * 本文件同样不执行任何被引用技能里的代码:只读文件字节,不 import 它们。
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import * as crypto from 'node:crypto'
import { SkillPackageError } from './errors.js'
import { buildChecksums, canonicalJson, CHECKSUM_EXCLUDED_FILES, CHECKSUMS_FILE, MANIFEST_FILE, SIGNATURE_FILE, sha256Hex, signChecksums } from './canonical.js'
import { writeTar, type TarEntry } from './tar.js'
import { assertManifestGate, createStructuralManifestGate, type ManifestGate } from './manifest-gate.js'

export interface ExpertPackSkillSource {
  id: string
  /** 该技能已安装目录(内含 manifest.json 与 payload) */
  dir: string
}

export interface GenerateExpertPackInput {
  id: string
  name: string
  version: string
  /** 被引用的技能 id(生成时会排序去重,保证同一集合产物一致) */
  skillIds: readonly string[]
  /** 提示模板(写进 manifest.promptTemplate) */
  promptTemplate: string
  /** 规则条目(写进 manifest.rules) */
  rules: readonly string[]
  /** 模型档位(写进 manifest.modelTiers.min;枚举归并行会话的能力分档校验器) */
  modelTier: string
  /** 可选扩展 manifest 字段,原样交给 ManifestGate */
  entryCapabilities?: readonly string[]
  activationEvents?: readonly string[]
  permissions?: readonly string[]
  description?: string
  /** 技能源: id → 已安装目录 */
  skillSources: ReadonlyMap<string, string> | readonly ExpertPackSkillSource[]
  /** 私钥(ed25519) */
  signingKey: crypto.KeyObject
  /** 签名 keyId,必须已登记在接收方 trustedKeys */
  keyId: string
  outputPath: string
  manifestGate?: ManifestGate
}

export interface GeneratedExpertPack {
  ok: true
  outputPath: string
  /** checksums.json 的规范化字节(可重现性验收直接比对它) */
  checksumsBytes: Buffer
  /** 整包 tar 字节 */
  packageBytes: Buffer
  packageSha256: string
  /** 包内常规文件列表 */
  files: string[]
  manifest: Record<string, unknown>
}

function normalizeSources(
  sources: ReadonlyMap<string, string> | readonly ExpertPackSkillSource[],
): Map<string, string> {
  const map = new Map<string, string>()
  if (Array.isArray(sources)) {
    for (const source of sources as readonly ExpertPackSkillSource[]) map.set(source.id, source.dir)
  } else {
    for (const [id, dir] of sources as ReadonlyMap<string, string>) map.set(id, dir)
  }
  return map
}

/** 读取一个已安装技能目录;拒绝符号链接,跳过包元数据(checksums/signature)。 */
function collectSkillFiles(skillId: string, sourceDir: string): Map<string, Buffer> {
  const collected = new Map<string, Buffer>()
  const walk = (relative: string): void => {
    const absolute = path.join(sourceDir, ...relative.split('/').filter(Boolean))
    for (const entry of fs.readdirSync(absolute, { withFileTypes: true })) {
      const child = relative ? `${relative}/${entry.name}` : entry.name
      if (entry.isSymbolicLink()) {
        throw new SkillPackageError('SKILL_PKG_PATH_LINK', `技能源含符号链接,拒绝打包:${skillId}/${child}`, {
          skillId,
          path: child,
        })
      }
      if (entry.isDirectory()) {
        walk(child)
        continue
      }
      if (CHECKSUM_EXCLUDED_FILES.includes(child)) continue
      const key = `skills/${skillId}/${child}`
      if (collected.has(key)) {
        throw new SkillPackageError('SKILL_PKG_PATH_DUPLICATE', `技能源出现重复文件:${key}`, { file: key })
      }
      const absoluteFile = path.join(sourceDir, ...child.split('/'))
      collected.set(key, fs.readFileSync(absoluteFile))

    }
  }
  walk('')
  return collected
}

/**
 * 生成专家包。流程:
 *   校验 id → 校验引用技能存在 → 读字节 → 组 manifest → 门自检 → checksums → 签名 → tar → 原子写盘
 */
export function generateExpertPack(input: GenerateExpertPackInput): GeneratedExpertPack {
  const sources = normalizeSources(input.skillSources)
  const skillIds = [...new Set(input.skillIds)].sort()
  if (skillIds.length === 0) {
    throw new SkillPackageError('SKILL_PKG_EXPERT_SKILL_NOT_FOUND', '专家包必须至少引用一个已安装技能', {
      skillId: '',
    })
  }
  const files = new Map<string, Buffer>()
  for (const skillId of skillIds) {
    const sourceDir = sources.get(skillId)
    if (!sourceDir || !fs.existsSync(path.join(sourceDir, MANIFEST_FILE))) {
      throw new SkillPackageError(
        'SKILL_PKG_EXPERT_SKILL_NOT_FOUND',
        `专家包引用的技能不存在或未安装:${skillId}`,
        { skillId, searchedIn: [...sources.keys()].sort() },
      )
    }
    for (const [file, bytes] of collectSkillFiles(skillId, sourceDir)) {
      if (files.has(file)) {
        throw new SkillPackageError('SKILL_PKG_PATH_DUPLICATE', `专家包内文件重复:${file}`, { file })
      }
      files.set(file, bytes)
    }
  }

  const manifest: Record<string, unknown> = {
    id: input.id,
    name: input.name,
    version: input.version,
    kind: 'expert-pack',
    description: input.description ?? '',
    entryCapabilities: [...(input.entryCapabilities ?? [])],
    activationEvents: [...(input.activationEvents ?? ['onSkillInvoke'])],
    permissions: [...(input.permissions ?? [])],
    modelTiers: { min: input.modelTier },
    skills: skillIds,
    promptTemplate: input.promptTemplate,
    rules: [...input.rules],
  }
  const gate = input.manifestGate ?? createStructuralManifestGate()
  assertManifestGate(gate, manifest)
  const manifestBytes = canonicalJson(manifest)
  files.set(MANIFEST_FILE, manifestBytes)

  const checksumsBytes = buildChecksums(files)
  const signatureBytes = canonicalJson(signChecksums(checksumsBytes, input.signingKey, input.keyId))

  const entries: TarEntry[] = []
  for (const [file, content] of files) entries.push({ path: file, content })
  entries.push({ path: CHECKSUMS_FILE, content: checksumsBytes })
  entries.push({ path: SIGNATURE_FILE, content: signatureBytes })
  const packageBytes = writeTar(entries)

  const outputPath = path.resolve(input.outputPath)
  fs.mkdirSync(path.dirname(outputPath), { recursive: true })
  const tmpPath = `${outputPath}.tmp-${process.pid}-${crypto.randomUUID().slice(0, 8)}`
  try {
    fs.writeFileSync(tmpPath, packageBytes, { mode: 0o644 })
    fs.renameSync(tmpPath, outputPath)
  } finally {
    if (fs.existsSync(tmpPath)) fs.rmSync(tmpPath, { force: true })
  }

  return {
    ok: true,
    outputPath,
    checksumsBytes,
    packageBytes,
    packageSha256: sha256Hex(packageBytes),
    files: [...files.keys()].sort(),
    manifest,
  }
}

/**
 * 从安装根发现技能源(id → 目录)。CLI `skills pack` 不额外要路径,直接复用安装台账。
 * 坏 manifest 的目录跳过(不能把一个读不懂的目录当成"存在的技能")。
 */
export function discoverInstalledSkillSources(installRoot: string): Map<string, string> {
  const sources = new Map<string, string>()
  if (!fs.existsSync(installRoot)) return sources
  for (const entry of fs.readdirSync(installRoot, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue
    const manifestPath = path.join(installRoot, entry.name, MANIFEST_FILE)
    if (!fs.existsSync(manifestPath)) continue
    try {
      const raw = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as { id?: unknown }
      if (typeof raw.id === 'string') sources.set(raw.id, path.join(installRoot, entry.name))
    } catch {
      // 读不懂的安装目录不进技能源;它本身就是坏的,不能拿来生成专家包
    }
  }
  return sources
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
