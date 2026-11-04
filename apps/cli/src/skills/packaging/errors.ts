// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 技能包安装安全链 — 稳定错误码与结构化错误。
 *
 * 判据纪律:
 *   - 每个校验阶段只产出一个**稳定**错误码(封闭联合,TS 编译期穷尽),调用方按码分流,
 *     不靠 message 文本猜流程;
 *   - `detail` 带出被点名的文件/路径/技能 id —— 反向例验收要求"篡改包内 1 文件"时
 *     必须点名该文件,信息不能只藏在中文文案里。
 */

export const SKILL_PACKAGE_ERROR_CODES = [
  /** tar 结构不可解析(截断/头字段非法/长度不是 512 的倍数) */
  'SKILL_PKG_ARCHIVE_INVALID',
  /** 包内缺 checksums.json */
  'SKILL_PKG_CHECKSUMS_MISSING',
  /** checksums.json 不是合法 JSON 或形状不对 */
  'SKILL_PKG_CHECKSUMS_INVALID',
  /** 包内存在文件但 checksums 未登记(清单缺项) */
  'SKILL_PKG_CHECKSUM_MISSING_ENTRY',
  /** checksums 登记了包内不存在的文件(清单多项) */
  'SKILL_PKG_CHECKSUM_EXTRA_ENTRY',
  /** 逐文件 sha256 不匹配(detail.file 点名) */
  'SKILL_PKG_CHECKSUM_MISMATCH',
  /** 包内缺 manifest.json */
  'SKILL_PKG_MANIFEST_MISSING',
  /** manifest 解析失败或未通过校验器 */
  'SKILL_PKG_MANIFEST_INVALID',
  /** 包内缺 signature.json */
  'SKILL_PKG_SIGNATURE_MISSING',
  /** signature.json 形状/算法/签名值非法 */
  'SKILL_PKG_SIGNATURE_INVALID',
  /** signature.keyId 不在 trustedKeys 内 */
  'SKILL_PKG_SIGNATURE_KEY_UNTRUSTED',
  /** trustedKeys 配置文件不存在(缺省即拒,不存在"没配置就跳过") */
  'SKILL_PKG_TRUST_STORE_MISSING',
  /** trustedKeys 配置文件损坏或形状不对 */
  'SKILL_PKG_TRUST_STORE_INVALID',
  /** 包内存在绝对路径(含 Windows 盘符) */
  'SKILL_PKG_PATH_ABSOLUTE',
  /** 包内存在 `..` 越界段 */
  'SKILL_PKG_PATH_TRAVERSAL',
  /** 包内存在符号链接/硬链接/特殊档形 */
  'SKILL_PKG_PATH_LINK',
  /** 常规文件带可执行位 */
  'SKILL_PKG_PATH_EXECUTABLE',
  /** 同一路径在包内出现多次 */
  'SKILL_PKG_PATH_DUPLICATE',
  /** 安装提交(落位)失败,已回滚/清理 */
  'SKILL_PKG_INSTALL_COMMIT_FAILED',
  /** 卸载后仍有残留 */
  'SKILL_PKG_UNINSTALL_RESIDUE',
  /** 专家包引用的技能 id 不存在 */
  'SKILL_PKG_EXPERT_SKILL_NOT_FOUND',
] as const

export type SkillPackageErrorCode = (typeof SKILL_PACKAGE_ERROR_CODES)[number]

export interface SkillPackageErrorDetail {
  /** 被点名的文件(相对包根) */
  file?: string
  /** 被点名的路径(路径安全阶段) */
  path?: string
  /** 被点名的技能 id(专家包生成阶段) */
  skillId?: string
  /** 附加机器可读信息(如 expected/actual 摘要) */
  [key: string]: unknown
}

export class SkillPackageError extends Error {
  readonly code: SkillPackageErrorCode
  readonly detail: SkillPackageErrorDetail
  constructor(code: SkillPackageErrorCode, message: string, detail: SkillPackageErrorDetail = {}) {
    super(message)
    this.name = 'SkillPackageError'
    this.code = code
    this.detail = detail
  }
}

/** 一个校验阶段的结论(成功/失败都留痕,便于报告逐条打印)。 */
export interface SkillPackageCheck {
  /** 阶段号(1..4,与验收要求的校验顺序一致) */
  stage: number
  /** 该阶段被检验的项 */
  item: string
  ok: boolean
  /** 失败时的稳定错误码 */
  code?: SkillPackageErrorCode
  message?: string
}

export function isSkillPackageError(value: unknown): value is SkillPackageError {
  return value instanceof SkillPackageError
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
