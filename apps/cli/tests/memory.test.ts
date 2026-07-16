/**
 * Memory 持久记忆测试
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  loadMemory,
  searchMemory,
  addMemoryEntry,
  clearMemory,
  getMemoryStore,
  getProjectMemoryDir,
  setMemoryEnabled,
  formatMemoryForPrompt,
  type MemoryEntry,
} from '../src/memory/index.js';

describe('Memory 持久记忆', () => {
  let tmpDir: string;
  let tmpHome: string;
  let origHome: string;
  let origUserProfile: string | undefined;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-memory-test-'));
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-memory-home-'));
    // Windows 下 os.homedir() 优先 USERPROFILE
    origHome = process.env.HOME ?? '';
    origUserProfile = process.env.USERPROFILE;
    process.env.HOME = tmpHome;
    process.env.USERPROFILE = tmpHome;
  });

  afterEach(() => {
    process.env.HOME = origHome;
    if (origUserProfile !== undefined) {
      process.env.USERPROFILE = origUserProfile;
    } else {
      delete process.env.USERPROFILE;
    }
    fs.rmSync(tmpDir, { recursive: true, force: true });
    fs.rmSync(tmpHome, { recursive: true, force: true });
  });

  describe('getProjectMemoryDir', () => {
    it('返回 basename-hash8 格式目录名', () => {
      const dir = getProjectMemoryDir(path.join('foo', 'bar', 'myproject'));
      expect(dir).toMatch(/^myproject-[a-f0-9]{8}$/);
    });

    it('同一路径返回同一目录名(确定性)', () => {
      const p = path.join(tmpDir, 'stable-project');
      const dir1 = getProjectMemoryDir(p);
      const dir2 = getProjectMemoryDir(p);
      expect(dir1).toBe(dir2);
    });

    it('不同路径返回不同目录名', () => {
      const dir1 = getProjectMemoryDir(path.join(tmpDir, 'proj-a'));
      const dir2 = getProjectMemoryDir(path.join(tmpDir, 'proj-b'));
      expect(dir1).not.toBe(dir2);
    });

    it('basename 相同但路径不同,hash 部分不同', () => {
      const dir1 = getProjectMemoryDir(path.join(tmpDir, 'sub1', 'same-name'));
      const dir2 = getProjectMemoryDir(path.join(tmpDir, 'sub2', 'same-name'));
      expect(dir1).not.toBe(dir2);
      expect(dir1.startsWith('same-name-')).toBe(true);
      expect(dir2.startsWith('same-name-')).toBe(true);
    });
  });

  describe('getMemoryStore', () => {
    it('返回全局和项目路径', () => {
      const store = getMemoryStore(tmpDir);
      expect(store.globalPath).toContain('memory');
      expect(store.globalPath.endsWith('MEMORY.md')).toBe(true);
      expect(store.projectPath.endsWith('MEMORY.md')).toBe(true);
    });

    it('默认 enabled=true', () => {
      const store = getMemoryStore(tmpDir);
      expect(store.enabled).toBe(true);
    });

    it('写入 .memory-enabled=false 后 enabled=false', () => {
      setMemoryEnabled(false);
      const store = getMemoryStore(tmpDir);
      expect(store.enabled).toBe(false);
    });

    it('写入 .memory-enabled=true 后 enabled=true', () => {
      setMemoryEnabled(false);
      setMemoryEnabled(true);
      const store = getMemoryStore(tmpDir);
      expect(store.enabled).toBe(true);
    });

    it('flagFile 内容非 "false" 视为启用', () => {
      const flagFile = path.join(tmpHome, '.ihui', 'memory', '.memory-enabled');
      fs.mkdirSync(path.dirname(flagFile), { recursive: true });
      fs.writeFileSync(flagFile, 'true', 'utf-8');
      const store = getMemoryStore(tmpDir);
      expect(store.enabled).toBe(true);
    });
  });

  describe('setMemoryEnabled', () => {
    it('创建目录并写入 flag 文件', () => {
      setMemoryEnabled(true);
      const flagFile = path.join(tmpHome, '.ihui', 'memory', '.memory-enabled');
      expect(fs.existsSync(flagFile)).toBe(true);
      expect(fs.readFileSync(flagFile, 'utf-8')).toBe('true');
    });

    it('切换 false 后再切换 true', () => {
      setMemoryEnabled(false);
      setMemoryEnabled(true);
      const flagFile = path.join(tmpHome, '.ihui', 'memory', '.memory-enabled');
      expect(fs.readFileSync(flagFile, 'utf-8')).toBe('true');
    });
  });

  describe('loadMemory', () => {
    it('无文件返回空数组', () => {
      const entries = loadMemory(tmpDir);
      expect(entries).toEqual([]);
    });

    it('disabled 时返回空数组', () => {
      setMemoryEnabled(false);
      // 即使写入文件也不应加载
      const store = getMemoryStore(tmpDir);
      fs.mkdirSync(path.dirname(store.globalPath), { recursive: true });
      fs.writeFileSync(store.globalPath, '# Memory\n\n## 通用\n\n- 全局条目\n', 'utf-8');
      const entries = loadMemory(tmpDir);
      expect(entries).toEqual([]);
    });

    it('加载全局 memory', () => {
      const store = getMemoryStore(tmpDir);
      fs.mkdirSync(path.dirname(store.globalPath), { recursive: true });
      fs.writeFileSync(
        store.globalPath,
        '# Memory\n\n## 用户偏好\n\n- 喜欢简洁代码\n- 不喜欢蓝色边框\n',
        'utf-8',
      );
      const entries = loadMemory(tmpDir);
      expect(entries).toHaveLength(2);
      expect(entries[0]!.text).toBe('喜欢简洁代码');
      expect(entries[0]!.source).toBe('global');
      expect(entries[0]!.category).toBe('用户偏好');
      expect(entries[1]!.text).toBe('不喜欢蓝色边框');
    });

    it('加载项目 memory', () => {
      const store = getMemoryStore(tmpDir);
      fs.mkdirSync(path.dirname(store.projectPath), { recursive: true });
      fs.writeFileSync(
        store.projectPath,
        '# Memory\n\n## 项目约定\n\n- 使用 TypeScript\n',
        'utf-8',
      );
      const entries = loadMemory(tmpDir);
      expect(entries).toHaveLength(1);
      expect(entries[0]!.text).toBe('使用 TypeScript');
      expect(entries[0]!.source).toBe('project');
      expect(entries[0]!.category).toBe('项目约定');
    });

    it('全局在前,项目在后(合并顺序)', () => {
      const store = getMemoryStore(tmpDir);
      fs.mkdirSync(path.dirname(store.globalPath), { recursive: true });
      fs.writeFileSync(store.globalPath, '# Memory\n\n- 全局A\n', 'utf-8');
      fs.mkdirSync(path.dirname(store.projectPath), { recursive: true });
      fs.writeFileSync(store.projectPath, '# Memory\n\n- 项目B\n', 'utf-8');
      const entries = loadMemory(tmpDir);
      expect(entries).toHaveLength(2);
      expect(entries[0]!.text).toBe('全局A');
      expect(entries[0]!.source).toBe('global');
      expect(entries[1]!.text).toBe('项目B');
      expect(entries[1]!.source).toBe('project');
    });

    it('多分类解析正确', () => {
      const store = getMemoryStore(tmpDir);
      fs.mkdirSync(path.dirname(store.globalPath), { recursive: true });
      fs.writeFileSync(
        store.globalPath,
        '# Memory\n\n## 分类A\n\n- 条目1\n\n## 分类B\n\n- 条目2\n- 条目3\n',
        'utf-8',
      );
      const entries = loadMemory(tmpDir);
      expect(entries).toHaveLength(3);
      expect(entries[0]!.category).toBe('分类A');
      expect(entries[1]!.category).toBe('分类B');
      expect(entries[2]!.category).toBe('分类B');
    });

    it('无分类标题的条目归入"未分类"', () => {
      const store = getMemoryStore(tmpDir);
      fs.mkdirSync(path.dirname(store.globalPath), { recursive: true });
      fs.writeFileSync(store.globalPath, '# Memory\n\n- 没有分类的条目\n', 'utf-8');
      const entries = loadMemory(tmpDir);
      expect(entries).toHaveLength(1);
      expect(entries[0]!.category).toBe('未分类');
    });

    it('忽略空条目和格式错误的行', () => {
      const store = getMemoryStore(tmpDir);
      fs.mkdirSync(path.dirname(store.globalPath), { recursive: true });
      fs.writeFileSync(
        store.globalPath,
        '# Memory\n\n- \n- 有效条目\n非条目行\n',
        'utf-8',
      );
      const entries = loadMemory(tmpDir);
      expect(entries).toHaveLength(1);
      expect(entries[0]!.text).toBe('有效条目');
    });
  });

  describe('searchMemory', () => {
    const entries: MemoryEntry[] = [
      { raw: '- TypeScript', text: 'TypeScript', source: 'global', category: '语言' },
      { raw: '- JavaScript', text: 'JavaScript', source: 'global', category: '语言' },
      { raw: '- Python', text: 'Python', source: 'project', category: '语言' },
    ];

    it('关键词匹配返回结果', () => {
      const result = searchMemory(entries, 'type');
      expect(result).toHaveLength(1);
      expect(result[0]!.text).toBe('TypeScript');
    });

    it('不区分大小写', () => {
      const result = searchMemory(entries, 'PYTHON');
      expect(result).toHaveLength(1);
      expect(result[0]!.text).toBe('Python');
    });

    it('无匹配返回空数组', () => {
      const result = searchMemory(entries, 'rust');
      expect(result).toEqual([]);
    });

    it('空 query 返回全部', () => {
      const result = searchMemory(entries, '');
      expect(result).toHaveLength(3);
    });

    it('跨来源搜索', () => {
      const result = searchMemory(entries, 'script');
      expect(result).toHaveLength(2);
      expect(result.some((e) => e.source === 'global' && e.text === 'TypeScript')).toBe(true);
      expect(result.some((e) => e.source === 'global' && e.text === 'JavaScript')).toBe(true);
    });
  });

  describe('addMemoryEntry', () => {
    it('文件不存在时创建新文件', () => {
      const store = getMemoryStore(tmpDir);
      const filePath = store.globalPath;
      expect(fs.existsSync(filePath)).toBe(false);
      addMemoryEntry(filePath, '第一条记忆', '通用');
      expect(fs.existsSync(filePath)).toBe(true);
      const content = fs.readFileSync(filePath, 'utf-8');
      expect(content).toContain('# Memory');
      expect(content).toContain('## 通用');
      expect(content).toContain('- 第一条记忆');
    });

    it('分类已存在则追加到该段末尾', () => {
      const store = getMemoryStore(tmpDir);
      const filePath = store.globalPath;
      addMemoryEntry(filePath, '条目A', '通用');
      addMemoryEntry(filePath, '条目B', '通用');
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');
      const aIdx = lines.findIndex((l) => l.includes('条目A'));
      const bIdx = lines.findIndex((l) => l.includes('条目B'));
      expect(aIdx).toBeGreaterThanOrEqual(0);
      expect(bIdx).toBeGreaterThan(aIdx);
    });

    it('新分类追加到文件末尾', () => {
      const store = getMemoryStore(tmpDir);
      const filePath = store.globalPath;
      addMemoryEntry(filePath, '条目A', '分类1');
      addMemoryEntry(filePath, '条目B', '分类2');
      const content = fs.readFileSync(filePath, 'utf-8');
      const idx1 = content.indexOf('## 分类1');
      const idx2 = content.indexOf('## 分类2');
      expect(idx1).toBeGreaterThanOrEqual(0);
      expect(idx2).toBeGreaterThan(idx1);
    });

    it('添加后能被 loadMemory 加载', () => {
      const store = getMemoryStore(tmpDir);
      addMemoryEntry(store.globalPath, '测试条目', '测试分类');
      const entries = loadMemory(tmpDir);
      expect(entries).toHaveLength(1);
      expect(entries[0]!.text).toBe('测试条目');
      expect(entries[0]!.category).toBe('测试分类');
      expect(entries[0]!.source).toBe('global');
    });

    it('添加到项目文件', () => {
      const store = getMemoryStore(tmpDir);
      addMemoryEntry(store.projectPath, '项目条目', '项目约定');
      const entries = loadMemory(tmpDir);
      expect(entries).toHaveLength(1);
      expect(entries[0]!.source).toBe('project');
    });
  });

  describe('clearMemory', () => {
    it('清空已有文件内容', () => {
      const store = getMemoryStore(tmpDir);
      addMemoryEntry(store.globalPath, '条目1', '通用');
      expect(fs.existsSync(store.globalPath)).toBe(true);
      clearMemory(store.globalPath);
      const content = fs.readFileSync(store.globalPath, 'utf-8');
      expect(content).toBe('# Memory\n\n');
      const entries = loadMemory(tmpDir);
      expect(entries).toEqual([]);
    });

    it('文件不存在时不创建', () => {
      const store = getMemoryStore(tmpDir);
      const filePath = store.globalPath;
      expect(fs.existsSync(filePath)).toBe(false);
      clearMemory(filePath);
      expect(fs.existsSync(filePath)).toBe(false);
    });
  });

  describe('formatMemoryForPrompt', () => {
    it('空数组返回空字符串', () => {
      expect(formatMemoryForPrompt([])).toBe('');
    });

    it('包含标题和分类信息', () => {
      const entries: MemoryEntry[] = [
        { raw: '- 条目1', text: '条目1', source: 'global', category: '用户偏好' },
      ];
      const result = formatMemoryForPrompt(entries);
      expect(result).toContain('## Memory');
      expect(result).toContain('全局记忆');
      expect(result).toContain('[用户偏好]');
      expect(result).toContain('条目1');
    });

    it('按来源分组展示', () => {
      const entries: MemoryEntry[] = [
        { raw: '- 全局1', text: '全局1', source: 'global', category: 'A' },
        { raw: '- 项目1', text: '项目1', source: 'project', category: 'B' },
      ];
      const result = formatMemoryForPrompt(entries);
      expect(result).toContain('### 全局记忆(1 条)');
      expect(result).toContain('### 项目记忆(1 条)');
      expect(result.indexOf('全局记忆')).toBeLessThan(result.indexOf('项目记忆'));
    });

    it('只有全局条目时不显示项目段', () => {
      const entries: MemoryEntry[] = [
        { raw: '- 全局1', text: '全局1', source: 'global', category: 'A' },
      ];
      const result = formatMemoryForPrompt(entries);
      expect(result).toContain('全局记忆');
      expect(result).not.toContain('项目记忆');
    });

    it('只有项目条目时不显示全局段', () => {
      const entries: MemoryEntry[] = [
        { raw: '- 项目1', text: '项目1', source: 'project', category: 'A' },
      ];
      const result = formatMemoryForPrompt(entries);
      expect(result).not.toContain('全局记忆');
      expect(result).toContain('项目记忆');
    });
  });

  describe('集成场景', () => {
    it('添加 → 加载 → 搜索 → 清空 完整流程', () => {
      const store = getMemoryStore(tmpDir);
      addMemoryEntry(store.globalPath, '用户喜欢 TypeScript', '偏好');
      addMemoryEntry(store.globalPath, '用户喜欢简洁代码', '偏好');
      addMemoryEntry(store.projectPath, '项目使用 pnpm workspace', '约定');

      const all = loadMemory(tmpDir);
      expect(all).toHaveLength(3);

      const scriptResults = searchMemory(all, 'TypeScript');
      expect(scriptResults).toHaveLength(1);

      const codeResults = searchMemory(all, '代码');
      expect(codeResults).toHaveLength(1);
      expect(codeResults[0]!.text).toBe('用户喜欢简洁代码');

      clearMemory(store.globalPath);
      clearMemory(store.projectPath);
      expect(loadMemory(tmpDir)).toEqual([]);
    });

    it('禁用后 add 仍生效但 load 返回空', () => {
      const store = getMemoryStore(tmpDir);
      addMemoryEntry(store.globalPath, '条目A', '通用');
      setMemoryEnabled(false);
      expect(loadMemory(tmpDir)).toEqual([]);
      // 重新启用后应能加载
      setMemoryEnabled(true);
      const entries = loadMemory(tmpDir);
      expect(entries).toHaveLength(1);
      expect(entries[0]!.text).toBe('条目A');
    });
  });
});
