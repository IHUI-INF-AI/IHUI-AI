/**
 * LongTermMemory — 跨 session 持久化,读写 <workspace>/.trae-cn/memory/MEMORY.md。
 * 平台独占:仅 cli(W2-1 四层记忆第 2 层,对标 OpenClaw Mem episodic memory)。
 * 格式与 memory/index.ts MEMORY.md 一致:# Memory + ## <分类> + - <条目>。
 * append 追加到分类段(段不存在则新建),search 关键词子串匹配(大小写不敏感)。
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

export interface LongTermEntry {
  text: string;
  category: string;
  ts: number;
}

export class LongTermMemory {
  private readonly filePath: string;

  constructor(workspacePath: string) {
    this.filePath = path.join(workspacePath, '.trae-cn', 'memory', 'MEMORY.md');
  }

  /** 追加条目到指定分类段(段不存在则新建),返回条目。 */
  append(text: string, category = '通用'): LongTermEntry {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    let content = '';
    if (fs.existsSync(this.filePath)) {
      content = fs.readFileSync(this.filePath, 'utf-8');
    } else {
      content = `# Memory\n\n`;
    }
    const sectionHeader = `## ${category}`;
    if (content.includes(sectionHeader)) {
      const lines = content.split('\n');
      let insertIdx = lines.length;
      let found = false;
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!;
        if (!found) {
          if (line.trim() === sectionHeader) found = true;
          continue;
        }
        if (line.trim().startsWith('## ')) {
          insertIdx = i;
          break;
        }
        insertIdx = i + 1;
      }
      while (insertIdx > 0 && lines[insertIdx - 1]!.trim() === '') {
        insertIdx--;
      }
      lines.splice(insertIdx, 0, `- ${text}`);
      content = lines.join('\n');
    } else {
      if (!content.endsWith('\n\n')) {
        content += content.endsWith('\n') ? '\n' : '\n\n';
      }
      content += `${sectionHeader}\n\n- ${text}\n`;
    }
    fs.writeFileSync(this.filePath, content, 'utf-8');
    return { text, category, ts: Date.now() };
  }

  /** 关键词搜索(子串匹配,大小写不敏感),返回命中条目。 */
  search(query: string): LongTermEntry[] {
    const q = query.toLowerCase();
    return this.load().filter((e) => e.text.toLowerCase().includes(q));
  }

  /** 读取全部条目(解析 ## 分类 + - 条目)。 */
  load(): LongTermEntry[] {
    if (!fs.existsSync(this.filePath)) return [];
    let content: string;
    try {
      content = fs.readFileSync(this.filePath, 'utf-8');
    } catch {
      return [];
    }
    const entries: LongTermEntry[] = [];
    let category = '未分类';
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (trimmed.startsWith('## ')) {
        category = trimmed.slice(3).trim() || '未分类';
        continue;
      }
      if (trimmed.startsWith('- ')) {
        const text = trimmed.slice(2).trim();
        if (text) entries.push({ text, category, ts: 0 });
      }
    }
    return entries;
  }

  /** 文件路径(供 dream / 外部诊断使用)。 */
  get path(): string {
    return this.filePath;
  }
}
