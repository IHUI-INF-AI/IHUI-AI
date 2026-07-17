/**
 * P1-6 Codebase Graph 增量索引模块测试。
 *
 * 覆盖:CodeGraphIndex / parser / IndexManager / persist
 *
 * 全部使用临时目录(os.tmpdir() + fs.mkdtempSync),测试后清理。
 */
import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { CodeGraphIndex } from '../src/codegraph/index.js'
import { parseFile } from '../src/codegraph/parser.js'
import { IndexManager, type FileEvent } from '../src/codegraph/manager.js'
import {
  saveCache,
  loadCache,
  getDefaultCachePath,
  CODEGRAPH_MAGIC,
  CODEGRAPH_SCHEMA_VERSION,
} from '../src/codegraph/persist.js'

// ============ CodeGraphIndex ============

describe('CodeGraphIndex', () => {
  let index: CodeGraphIndex

  beforeEach(() => {
    index = new CodeGraphIndex()
  })

  it('indexFile 添加定义', () => {
    index.indexFile('a.ts', 'function foo() {}\n', { size: 18, mtimeMs: 1000 })
    expect(index.hasDefinition('foo')).toBe(true)
    const defs = index.findDefinitions('foo')
    expect(defs.length).toBe(1)
    expect(defs[0]!.kind).toBe('function')
    expect(defs[0]!.filePath).toBe('a.ts')
    expect(defs[0]!.locations[0]!.line).toBe(1)
  })

  it('indexFile 添加引用', () => {
    // const x = 1; x + 1  → x 有定义(const)+ 引用(使用)
    index.indexFile('a.ts', 'const x = 1\nx + 1\n', { size: 18, mtimeMs: 1000 })
    const refs = index.findReferences('x')
    expect(refs.length).toBeGreaterThanOrEqual(1)
    // 引用位置应在第 2 行(使用处)
    const refLocations = refs[0]!.locations
    expect(refLocations.some((l) => l.line === 2)).toBe(true)
  })

  it('indexFile 重名符号(不同文件同名)', () => {
    index.indexFile('a.ts', 'function foo() {}\n', { size: 18, mtimeMs: 1000 })
    index.indexFile('b.ts', 'const foo = 1\n', { size: 13, mtimeMs: 2000 })
    const defs = index.findDefinitions('foo')
    expect(defs.length).toBe(2)
    const kinds = defs.map((d) => d.kind).sort()
    expect(kinds).toEqual(['const', 'function'])
    const files = defs.map((d) => d.filePath).sort()
    expect(files).toEqual(['a.ts', 'b.ts'])
  })

  it('removeFile 清除定义/引用', () => {
    index.indexFile('a.ts', 'function foo() {}\nfoo()\n', { size: 24, mtimeMs: 1000 })
    expect(index.hasDefinition('foo')).toBe(true)
    index.removeFile('a.ts')
    expect(index.hasDefinition('foo')).toBe(false)
    expect(index.findReferences('foo').length).toBe(0)
  })

  it('removeFile 不存在文件不抛错', () => {
    expect(() => index.removeFile('never-exists.ts')).not.toThrow()
  })

  it('isFileStale size 变化返回 true', () => {
    index.indexFile('a.ts', 'const x = 1\n', { size: 13, mtimeMs: 1000 })
    expect(index.isFileStale('a.ts', { size: 20, mtimeMs: 1000 })).toBe(true)
  })

  it('isFileStale mtime 变化返回 true', () => {
    index.indexFile('a.ts', 'const x = 1\n', { size: 13, mtimeMs: 1000 })
    expect(index.isFileStale('a.ts', { size: 13, mtimeMs: 2000 })).toBe(true)
  })

  it('isFileStale 未变化返回 false', () => {
    index.indexFile('a.ts', 'const x = 1\n', { size: 13, mtimeMs: 1000 })
    expect(index.isFileStale('a.ts', { size: 13, mtimeMs: 1000 })).toBe(false)
  })

  it('isFileStale 未索引文件返回 true', () => {
    expect(index.isFileStale('missing.ts', { size: 0, mtimeMs: 0 })).toBe(true)
  })

  it('findDefinitions 命中', () => {
    index.indexFile('a.ts', 'class Bar {}\n', { size: 12, mtimeMs: 1000 })
    const defs = index.findDefinitions('Bar')
    expect(defs.length).toBe(1)
    expect(defs[0]!.kind).toBe('class')
  })

  it('findDefinitions 未命中返回空数组', () => {
    index.indexFile('a.ts', 'const x = 1\n', { size: 13, mtimeMs: 1000 })
    expect(index.findDefinitions('missing')).toEqual([])
  })

  it('findReferences 命中', () => {
    index.indexFile('a.ts', 'import { foo } from "./x"\nfoo()\n', { size: 33, mtimeMs: 1000 })
    const refs = index.findReferences('foo')
    expect(refs.length).toBeGreaterThanOrEqual(1)
    // import 位置 + 使用位置
    const allLocs = refs.flatMap((r) => r.locations)
    expect(allLocs.length).toBeGreaterThanOrEqual(2)
  })

  it('hasDefinition 正确返回', () => {
    index.indexFile('a.ts', 'const x = 1\n', { size: 13, mtimeMs: 1000 })
    expect(index.hasDefinition('x')).toBe(true)
    expect(index.hasDefinition('y')).toBe(false)
  })

  it('listFileDefinitions 列出文件定义的符号', () => {
    index.indexFile('a.ts', 'function foo() {}\nconst bar = 1\n', { size: 32, mtimeMs: 1000 })
    const syms = index.listFileDefinitions('a.ts').sort()
    expect(syms).toEqual(['bar', 'foo'])
  })

  it('listFileDefinitions 未索引文件返回空', () => {
    expect(index.listFileDefinitions('missing.ts')).toEqual([])
  })

  it('allSymbols 列出所有符号', () => {
    index.indexFile('a.ts', 'function foo() {}\n', { size: 18, mtimeMs: 1000 })
    index.indexFile('b.ts', 'class Bar {}\n', { size: 12, mtimeMs: 2000 })
    const syms = index.allSymbols().sort()
    expect(syms).toEqual(['Bar', 'foo'])
  })

  it('snapshot + restore 往返一致', () => {
    index.indexFile('a.ts', 'function foo() {}\nfoo()\n', { size: 24, mtimeMs: 1000 })
    index.indexFile('b.ts', 'class Bar {}\n', { size: 12, mtimeMs: 2000 })

    const snap = index.snapshot()
    const newIndex = new CodeGraphIndex()
    newIndex.restore(snap)

    // 定义一致
    expect(newIndex.allSymbols().sort()).toEqual(['Bar', 'foo'])
    expect(newIndex.findDefinitions('foo').length).toBe(1)
    expect(newIndex.findDefinitions('Bar').length).toBe(1)
    // 引用一致
    expect(newIndex.findReferences('foo').length).toBe(index.findReferences('foo').length)
    // 元数据一致
    expect(newIndex.stats().files).toBe(2)
    // 深拷贝验证:修改新索引不影响原快照
    newIndex.removeFile('a.ts')
    expect(snap.definitions.get('foo')).toBeDefined()
  })

  it('clear 清空所有数据', () => {
    index.indexFile('a.ts', 'function foo() {}\n', { size: 18, mtimeMs: 1000 })
    expect(index.stats().files).toBe(1)
    index.clear()
    expect(index.stats().files).toBe(0)
    expect(index.allSymbols().length).toBe(0)
  })

  it('stats 统计正确', () => {
    index.indexFile('a.ts', 'function foo() {}\nconst bar = 1\n', { size: 32, mtimeMs: 1000 })
    index.indexFile('b.ts', 'class Baz {}\n', { size: 12, mtimeMs: 2000 })
    const s = index.stats()
    expect(s.files).toBe(2)
    expect(s.symbols).toBe(3) // foo, bar, Baz
    expect(s.definitions).toBe(3)
    expect(s.references).toBeGreaterThanOrEqual(0)
  })

  it('indexFile 幂等(重复索引同文件不重复)', () => {
    index.indexFile('a.ts', 'function foo() {}\n', { size: 18, mtimeMs: 1000 })
    index.indexFile('a.ts', 'function foo() {}\n', { size: 18, mtimeMs: 1000 })
    const defs = index.findDefinitions('foo')
    expect(defs.length).toBe(1)
    expect(index.stats().files).toBe(1)
  })
})

// ============ parser ============

describe('parser', () => {
  it('解析 function 定义', () => {
    const { definitions } = parseFile('a.ts', 'function foo() {}\n')
    const foo = definitions.find((d) => d.symbol === 'foo')
    expect(foo).toBeDefined()
    expect(foo!.kind).toBe('function')
    expect(foo!.locations[0]!.line).toBe(1)
  })

  it('解析 const 定义', () => {
    const { definitions } = parseFile('a.ts', 'const bar = 42\n')
    const bar = definitions.find((d) => d.symbol === 'bar')
    expect(bar).toBeDefined()
    expect(bar!.kind).toBe('const')
  })

  it('解析 class 定义', () => {
    const { definitions } = parseFile('a.ts', 'class MyClass {}\n')
    const cls = definitions.find((d) => d.symbol === 'MyClass')
    expect(cls).toBeDefined()
    expect(cls!.kind).toBe('class')
  })

  it('解析 interface 定义', () => {
    const { definitions } = parseFile('a.ts', 'interface IFoo {}\n')
    const iface = definitions.find((d) => d.symbol === 'IFoo')
    expect(iface).toBeDefined()
    expect(iface!.kind).toBe('interface')
  })

  it('解析 type 定义', () => {
    const { definitions } = parseFile('a.ts', 'type TName = string\n')
    const t = definitions.find((d) => d.symbol === 'TName')
    expect(t).toBeDefined()
    expect(t!.kind).toBe('type')
  })

  it('解析 enum 定义', () => {
    const { definitions } = parseFile('a.ts', 'enum Color { Red, Blue }\n')
    const e = definitions.find((d) => d.symbol === 'Color')
    expect(e).toBeDefined()
    expect(e!.kind).toBe('enum')
  })

  it('解析 import 产生定义和引用', () => {
    const { definitions, references } = parseFile('a.ts', 'import { foo } from "./x"\n')
    const def = definitions.find((d) => d.symbol === 'foo')
    expect(def).toBeDefined()
    expect(def!.kind).toBe('import')
    const ref = references.find((r) => r.symbol === 'foo')
    expect(ref).toBeDefined()
  })

  it('解析多行文件(行号正确)', () => {
    const content = 'const a = 1\n\nfunction b() {\n  return a\n}\n'
    const { definitions } = parseFile('a.ts', content)
    const a = definitions.find((d) => d.symbol === 'a')
    const b = definitions.find((d) => d.symbol === 'b')
    expect(a).toBeDefined()
    expect(a!.locations[0]!.line).toBe(1)
    expect(b).toBeDefined()
    expect(b!.locations[0]!.line).toBe(3)
  })

  it('关键字黑名单过滤(不把关键字当符号)', () => {
    const { definitions } = parseFile('a.ts', 'const type = 1\n')
    // "type" 在黑名单中,不应被识别
    const t = definitions.find((d) => d.symbol === 'type')
    expect(t).toBeUndefined()
  })

  it('let/var 解析为 variable kind', () => {
    const { definitions } = parseFile('a.ts', 'let x = 1\nvar y = 2\n')
    const x = definitions.find((d) => d.symbol === 'x')
    const y = definitions.find((d) => d.symbol === 'y')
    expect(x).toBeDefined()
    expect(x!.kind).toBe('variable')
    expect(y).toBeDefined()
    expect(y!.kind).toBe('variable')
  })
})

// ============ IndexManager ============

describe('IndexManager', () => {
  let tmpDir: string
  let manager: IndexManager

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-cg-mgr-'))
    manager = new IndexManager(tmpDir)
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  function writeRel(rel: string, content: string): string {
    const abs = path.join(tmpDir, rel)
    fs.mkdirSync(path.dirname(abs), { recursive: true })
    fs.writeFileSync(abs, content, 'utf-8')
    return rel
  }

  it('handleEvent created 索引新文件', () => {
    const rel = writeRel('a.ts', 'function foo() {}\n')
    manager.handleEvent({ type: 'created', filePath: rel })
    const index = manager.getIndex()
    expect(index.hasDefinition('foo')).toBe(true)
  })

  it('handleEvent modified 更新索引', () => {
    const rel = writeRel('a.ts', 'function foo() {}\n')
    manager.handleEvent({ type: 'created', filePath: rel })
    // 修改:foo 改成 bar
    fs.writeFileSync(path.join(tmpDir, rel), 'function bar() {}\n', 'utf-8')
    manager.handleEvent({ type: 'modified', filePath: rel })
    const index = manager.getIndex()
    expect(index.hasDefinition('foo')).toBe(false)
    expect(index.hasDefinition('bar')).toBe(true)
  })

  it('handleEvent removed 移除索引', () => {
    const rel = writeRel('a.ts', 'function foo() {}\n')
    manager.handleEvent({ type: 'created', filePath: rel })
    expect(manager.getIndex().hasDefinition('foo')).toBe(true)
    manager.handleEvent({ type: 'removed', filePath: rel })
    expect(manager.getIndex().hasDefinition('foo')).toBe(false)
  })

  it('handleEvent renamed 移除旧路径索引新路径', () => {
    const oldRel = writeRel('old.ts', 'function foo() {}\n')
    manager.handleEvent({ type: 'created', filePath: oldRel })
    // 重命名:old.ts → new.ts
    const newRel = 'new.ts'
    fs.renameSync(path.join(tmpDir, oldRel), path.join(tmpDir, newRel))
    manager.handleEvent({ type: 'renamed', oldPath: oldRel, newPath: newRel })
    const index = manager.getIndex()
    // 旧路径不应有定义
    expect(index.listFileDefinitions(oldRel)).toEqual([])
    // 新路径应有 foo 定义
    expect(index.hasDefinition('foo')).toBe(true)
    const newDefs = index.findDefinitions('foo')
    expect(newDefs[0]!.filePath).toBe('new.ts')
  })

  it('handleEvents 合并 created+removed = cancel', () => {
    const rel = 'a.ts'
    // created 但文件不存在(模拟创建后立即删除)
    const events: FileEvent[] = [
      { type: 'created', filePath: rel },
      { type: 'removed', filePath: rel },
    ]
    manager.handleEvents(events)
    // 索引中不应有该文件
    expect(manager.getIndex().stats().files).toBe(0)
  })

  it('handleEvents 合并 removed+created = modified', () => {
    const rel = writeRel('a.ts', 'function foo() {}\n')
    manager.handleEvent({ type: 'created', filePath: rel })
    // 删除后重新创建(内容变 bar)
    fs.unlinkSync(path.join(tmpDir, rel))
    fs.writeFileSync(path.join(tmpDir, rel), 'function bar() {}\n', 'utf-8')
    const events: FileEvent[] = [
      { type: 'removed', filePath: rel },
      { type: 'created', filePath: rel },
    ]
    manager.handleEvents(events)
    const index = manager.getIndex()
    expect(index.hasDefinition('foo')).toBe(false)
    expect(index.hasDefinition('bar')).toBe(true)
  })

  it('handleEvents 批量处理多文件', () => {
    writeRel('a.ts', 'function foo() {}\n')
    writeRel('b.ts', 'class Bar {}\n')
    const events: FileEvent[] = [
      { type: 'created', filePath: 'a.ts' },
      { type: 'created', filePath: 'b.ts' },
    ]
    manager.handleEvents(events)
    const index = manager.getIndex()
    expect(index.hasDefinition('foo')).toBe(true)
    expect(index.hasDefinition('Bar')).toBe(true)
    expect(index.stats().files).toBe(2)
  })

  it('indexDirectory 扫描目录', async () => {
    writeRel('a.ts', 'function foo() {}\n')
    writeRel('b.ts', 'class Bar {}\n')
    writeRel('sub/c.ts', 'const baz = 1\n')
    // 非代码文件应被忽略
    writeRel('readme.md', '# readme\n')
    // node_modules 应被跳过
    writeRel('node_modules/pkg/index.ts', 'function skip() {}\n')

    const result = await manager.indexDirectory()
    expect(result.files).toBe(3) // a.ts, b.ts, sub/c.ts
    const index = manager.getIndex()
    expect(index.hasDefinition('foo')).toBe(true)
    expect(index.hasDefinition('Bar')).toBe(true)
    expect(index.hasDefinition('baz')).toBe(true)
    expect(index.hasDefinition('skip')).toBe(false)
    expect(result.elapsedMs).toBeGreaterThanOrEqual(0)
  })

  it('indexDirectory 指定子目录', async () => {
    writeRel('a.ts', 'function foo() {}\n')
    writeRel('sub/b.ts', 'class Bar {}\n')
    writeRel('sub/c.ts', 'const baz = 1\n')

    const result = await manager.indexDirectory('sub')
    expect(result.files).toBe(2)
    const index = manager.getIndex()
    expect(index.hasDefinition('foo')).toBe(false)
    expect(index.hasDefinition('Bar')).toBe(true)
    expect(index.hasDefinition('baz')).toBe(true)
  })

  it('reindexFile 对不存在文件不抛错', () => {
    expect(() => manager.reindexFile('missing.ts')).not.toThrow()
  })

  it('reindexFile 对非代码文件不索引', () => {
    writeRel('a.txt', 'function foo() {}\n')
    manager.reindexFile('a.txt')
    expect(manager.getIndex().stats().files).toBe(0)
  })

  it('构造函数接受外部 CodeGraphIndex', () => {
    const externalIndex = new CodeGraphIndex()
    externalIndex.indexFile('pre.ts', 'function pre() {}\n', { size: 18, mtimeMs: 1000 })
    const mgr = new IndexManager(tmpDir, externalIndex)
    expect(mgr.getIndex()).toBe(externalIndex)
    expect(mgr.getIndex().hasDefinition('pre')).toBe(true)
  })
})

// ============ persist ============

describe('persist', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-cg-persist-'))
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('saveCache + loadCache 往返一致', async () => {
    const index = new CodeGraphIndex()
    index.indexFile('a.ts', 'function foo() {}\nfoo()\n', { size: 24, mtimeMs: 1000 })
    index.indexFile('b.ts', 'class Bar {}\n', { size: 12, mtimeMs: 2000 })

    const cachePath = path.join(tmpDir, 'cache.json')
    await saveCache(index, cachePath)

    // 验证文件已创建
    expect(fs.existsSync(cachePath)).toBe(true)

    const loaded = await loadCache(cachePath)
    expect(loaded).toBeDefined()
    const loadedIndex = loaded!

    // 验证符号一致
    expect(loadedIndex.allSymbols().sort()).toEqual(['Bar', 'foo'])
    // 验证定义一致
    const fooDefs = loadedIndex.findDefinitions('foo')
    expect(fooDefs.length).toBe(1)
    expect(fooDefs[0]!.kind).toBe('function')
    expect(fooDefs[0]!.filePath).toBe('a.ts')
    // 验证引用一致
    const fooRefs = loadedIndex.findReferences('foo')
    expect(fooRefs.length).toBe(index.findReferences('foo').length)
    // 验证元数据一致
    const stats = loadedIndex.stats()
    expect(stats.files).toBe(2)
    expect(stats.symbols).toBe(2)
  })

  it('loadCache 不存在文件返回 undefined', async () => {
    const cachePath = path.join(tmpDir, 'missing.json')
    const loaded = await loadCache(cachePath)
    expect(loaded).toBeUndefined()
  })

  it('loadCache magic 不符返回 undefined', async () => {
    const cachePath = path.join(tmpDir, 'bad.json')
    const badData = {
      magic: 'WRONG-MAGIC',
      version: CODEGRAPH_SCHEMA_VERSION,
      savedAt: '2026-01-01T00:00:00.000Z',
      snapshot: { definitions: [], references: [], fileMeta: [], version: 1 },
    }
    fs.writeFileSync(cachePath, JSON.stringify(badData), 'utf-8')
    const loaded = await loadCache(cachePath)
    expect(loaded).toBeUndefined()
  })

  it('loadCache 损坏 JSON 返回 undefined', async () => {
    const cachePath = path.join(tmpDir, 'corrupt.json')
    fs.writeFileSync(cachePath, '{ not valid json', 'utf-8')
    const loaded = await loadCache(cachePath)
    expect(loaded).toBeUndefined()
  })

  it('saveCache 自动创建父目录', async () => {
    const index = new CodeGraphIndex()
    index.indexFile('a.ts', 'function foo() {}\n', { size: 18, mtimeMs: 1000 })
    const cachePath = path.join(tmpDir, 'deep', 'nested', 'dir', 'cache.json')
    await saveCache(index, cachePath)
    expect(fs.existsSync(cachePath)).toBe(true)
  })

  it('getDefaultCachePath 返回确定路径', () => {
    const p1 = getDefaultCachePath('/some/workspace')
    const p2 = getDefaultCachePath('/some/workspace')
    expect(p1).toBe(p2)
    // 不同工作区应返回不同路径
    const p3 = getDefaultCachePath('/other/workspace')
    expect(p3).not.toBe(p1)
    // 应包含 codegraph 目录
    expect(p1).toContain('codegraph')
    expect(p1).toContain('.json')
  })

  it('persisted 文件包含 magic 和 version 头', async () => {
    const index = new CodeGraphIndex()
    index.indexFile('a.ts', 'const x = 1\n', { size: 13, mtimeMs: 1000 })
    const cachePath = path.join(tmpDir, 'cache.json')
    await saveCache(index, cachePath)

    const raw = JSON.parse(fs.readFileSync(cachePath, 'utf-8'))
    expect(raw.magic).toBe(CODEGRAPH_MAGIC)
    expect(raw.version).toBe(CODEGRAPH_SCHEMA_VERSION)
    expect(typeof raw.savedAt).toBe('string')
    expect(raw.snapshot).toBeDefined()
    expect(Array.isArray(raw.snapshot.definitions)).toBe(true)
  })
})
