// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
/**
 * F-536 回归锁(2026-11-14,按 db21c929c66 落地的上传登记实现)。
 *
 * 病灶:/workbook/open 只认 /save 写的 storage sidecar,普通 /api/files/upload/*
 * 上传的 xlsx 没有归属记录 ⇒ 打开恒 WORKBOOK_FILE_NOT_FOUND。
 *
 * 修复(上传登记方案):
 *  ① 新增 upload-file-registry:registerUploadedFile 原子写登记(ownerId/storedPath);
 *  ② findUploadedFile 对未登记/损坏/路径越界/文件已删一律返回 null;
 *  ③ 上传路由三处落盘后登记 ownerId=request.userId 与真实 storedPath;
 *  ④ open 在 storage 未命中时回落到登记,归属逐字比 ownerId,字节从 storedPath 读。
 *
 * 本锁为源码接线锁,不连库/不落盘。
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(here, '..', '..', '..')
const registrySrc = readFileSync(
  resolve(REPO_ROOT, 'apps/api/src/services/upload-file-registry.ts'),
  'utf8',
)
const workbookSrc = readFileSync(
  resolve(REPO_ROOT, 'apps/api/src/services/workbook-service.ts'),
  'utf8',
)
const filesRouteSrc = readFileSync(resolve(REPO_ROOT, 'apps/api/src/routes/files.ts'), 'utf8')

function openSegment(): string {
  const start = workbookSrc.indexOf('export async function openWorkbook')
  expect(start).toBeGreaterThan(-1)
  return workbookSrc.slice(start, workbookSrc.indexOf('export interface ReadRangeData', start))
}

describe('F-536:workbook/open 必须能打开普通上传的 xlsx', () => {
  it('登记层:registerUploadedFile 只信 server 侧 ownerId,并校验上传根与 fileId 形态', () => {
    expect(registrySrc).toMatch(/export function registerUploadedFile\(/)
    expect(registrySrc).toMatch(/export function findUploadedFile\(/)
    expect(registrySrc).toMatch(/if \(!ownerId\) throw new Error\('ownerId 不能为空'\)/)
    expect(registrySrc).toMatch(/if \(!isInsideAnyRoot\(storedPath, roots\)\)/)
    // 原子写:tmp + rename,并发读不会读到半截 JSON
    expect(registrySrc).toMatch(/renameSync\(tmp, target\)/)
  })

  it('读回层:未登记/记录损坏/路径越界一律 null(与 file-not-found 同形)', () => {
    const idx = registrySrc.indexOf('export function findUploadedFile')
    expect(idx).toBeGreaterThan(-1)
    const seg = registrySrc.slice(idx)
    expect(seg).toMatch(/return null/)
    expect(seg).toMatch(/JSON\.parse\(readFileSync\(file, 'utf-8'\)\)/)
    expect(seg).toMatch(/isInsideAnyRoot\(rec\.storedPath, roots\)/)
  })

  it('接线锁:上传路由三处落盘后都登记 ownerId=request.userId 与 storedPath', () => {
    const calls = filesRouteSrc.match(/registerUpload\(\{/g) ?? []
    expect(calls.length).toBe(3)
    expect(filesRouteSrc).toMatch(/ownerId: params\.request\.userId!/)
    expect(filesRouteSrc).toMatch(/storedPath: params\.storedPath/)
  })

  it('缺陷锁:open 在 getFileInfo 未命中时回落到上传登记', () => {
    const seg = openSegment()
    expect(seg).toMatch(/const storageInfo = getFileInfo\(fileId\)/)
    expect(seg).toMatch(/const uploaded = findUploadedFile\(fileId\)/)
    expect(seg).toMatch(/sourcePath = uploaded\.storedPath/)
  })

  it('归属锁:普通上传按登记 ownerId 逐字比 subjectId,不符与不存在同形', () => {
    const seg = openSegment()
    expect(seg).toMatch(/!uploaded \|\| uploaded\.ownerId !== subjectId/)
    expect(seg).toMatch(/WORKBOOK_FILE_NOT_FOUND/)
  })

  it('字节锁:普通上传从登记的真实路径读,不从 storage 目录按 id 读', () => {
    const seg = openSegment()
    expect(seg).toMatch(
      /sourcePath \? await readDiskFileOrNull\(sourcePath\) : await readWorkbookBytes\(fileId\)/,
    )
  })
})
