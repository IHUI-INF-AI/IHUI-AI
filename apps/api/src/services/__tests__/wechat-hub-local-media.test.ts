// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 归档本地媒体直读测试（2026-11-25）：
 *  - 目录在 WECHAT_HUB_MEDIA_ROOT 内才读，越界一律 null；
 *  - 只列真实文件，文件名不合法/子目录跳过；
 *  - 二进制按扩展名回 Content-Type，缺文件返回 null，不补占位图。
 * 不连库：dbRead.select 只回一条 metadata。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

const state = vi.hoisted(() => ({
  metadata: {} as Record<string, unknown>,
}))

vi.mock('../../db/index.js', () => ({
  dbRead: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => [{ metadata: state.metadata }],
        }),
      }),
    }),
  },
  db: {},
}))

import {
  confinedMediaDir,
  configuredMediaRoot,
  listArchivedMomentMedia,
  readArchivedMomentMedia,
} from '../wechat-hub/local-media'

const MOMENT_ID = '15062370617321329370'
let root = ''
const previousRoot = process.env.WECHAT_HUB_MEDIA_ROOT

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'ihui-wechat-media-'))
  process.env.WECHAT_HUB_MEDIA_ROOT = root
  state.metadata = {}
})

afterEach(async () => {
  if (previousRoot === undefined) delete process.env.WECHAT_HUB_MEDIA_ROOT
  else process.env.WECHAT_HUB_MEDIA_ROOT = previousRoot
  await rm(root, { recursive: true, force: true })
})

describe('wechat-hub local media', () => {
  it('只列真实文件，按文件名排序并给出真实 Content-Type', async () => {
    const dir = path.join(root, MOMENT_ID)
    await mkdir(dir, { recursive: true })
    await writeFile(path.join(dir, 'b.mp4'), Buffer.from('video'))
    await writeFile(path.join(dir, 'a.jpg'), Buffer.from('image'))
    await writeFile(path.join(dir, 'space name.jpg'), Buffer.from('bad-name'))
    state.metadata = { mediaLocalDir: dir }

    const files = await listArchivedMomentMedia('account-1', MOMENT_ID)

    expect(files).not.toBeNull()
    expect(files?.map((file) => file.name)).toEqual(['a.jpg', 'b.mp4'])
    expect(files?.[0]).toMatchObject({ contentType: 'image/jpeg', size: 5 })
    expect(files?.[1]).toMatchObject({ contentType: 'video/mp4', size: 5 })
  })

  it('读真实二进制；缺文件返回 null，不拿别的文件顶替', async () => {
    const dir = path.join(root, MOMENT_ID)
    await mkdir(dir, { recursive: true })
    await writeFile(path.join(dir, 'a.jpg'), Buffer.from('image-bytes'))
    state.metadata = { mediaLocalDir: dir }

    const media = await readArchivedMomentMedia('account-1', MOMENT_ID, 'a.jpg')
    expect(media?.contentType).toBe('image/jpeg')
    expect(media?.data.toString()).toBe('image-bytes')

    expect(await readArchivedMomentMedia('account-1', MOMENT_ID, 'missing.jpg')).toBeNull()
  })

  it('mediaLocalDir 越出配置根目录时拒绝读取', async () => {
    const outside = path.resolve(root, '..', 'outside-media')
    state.metadata = { mediaLocalDir: outside }

    expect(confinedMediaDir(root, outside)).toBeNull()
    expect(await listArchivedMomentMedia('account-1', MOMENT_ID)).toBeNull()
  })

  it('非法 momentId 不触发数据库路径读取', async () => {
    state.metadata = { mediaLocalDir: root }
    expect(await listArchivedMomentMedia('account-1', '../escape')).toBeNull()
  })

  it('未配置根目录时一律不读本机文件', () => {
    delete process.env.WECHAT_HUB_MEDIA_ROOT
    expect(configuredMediaRoot()).toBeNull()
  })
})
