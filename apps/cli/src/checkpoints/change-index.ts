// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 变更索引 / 变更明细 / 请求文件树的判读(自 ./snapshot-store-host.ts 纯抽档,落 AGENTS §3「每页 < 250 行」)。
 * 职责:只判输入形状与指针一致性,不读写盘、不碰检查点存储;判定结果原样(reason/disposition)返回。
 * 这三个入口历史在宿主层,现独立成模块;对外仍从 ./snapshot-store-host.ts 原样转出。
 */

export type ChangeIndexRow = {
  id: string;
  requestId: string;
  summary: string;
  fileCount: number;
  additions: number;
  deletions: number;
  detailRef: string;
};

export type ChangeIndexPlan = {
  disposition: 'projected' | 'unjudged';
  reason: 'projected' | 'changes-unmeasured' | 'row-unreadable' | 'count-mismatch' | 'ref-mismatch';
  rows: ChangeIndexRow[] | null;
};

export type ChangeDetailPlan = {
  disposition: 'read' | 'unjudged' | 'refused';
  reason: 'read' | 'ref-invalid' | 'request-mismatch' | 'detail-unmeasured' | 'path-invalid' | 'count-mismatch';
  files: string[] | null;
};

const CHANGE_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,80}$/;
const CHANGE_PATH = /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[A-Za-z0-9_./-]+$/;

function changeCountOk(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

/**
 * 变更列表只留摘要、计数和明细指针，不带文件名。
 * 声明的 fileCount 和量到的文件名条数不一致，整份列表不投影。
 */
export function projectChangeIndex(changes: unknown): ChangeIndexPlan {
  const blank = (reason: ChangeIndexPlan['reason']): ChangeIndexPlan => ({
    disposition: 'unjudged',
    reason,
    rows: null,
  });
  if (!Array.isArray(changes)) return blank('changes-unmeasured');
  const rows: ChangeIndexRow[] = [];
  for (const value of changes) {
    if (value === null || typeof value !== 'object') return blank('row-unreadable');
    const row = value as Record<string, unknown>;
    if (typeof row.id !== 'string' || !CHANGE_ID.test(row.id)) return blank('row-unreadable');
    if (typeof row.requestId !== 'string' || !CHANGE_ID.test(row.requestId)) return blank('row-unreadable');
    if (typeof row.summary !== 'string') return blank('row-unreadable');
    if (!Array.isArray(row.fileNames) || !row.fileNames.every((name) => typeof name === 'string' && CHANGE_PATH.test(name))) {
      return blank('row-unreadable');
    }
    if (!changeCountOk(row.additions) || !changeCountOk(row.deletions)) return blank('row-unreadable');
    if (!changeCountOk(row.fileCount) || row.fileCount !== row.fileNames.length) return blank('count-mismatch');
    const detailRef = `${row.id}.${row.requestId}`;
    if (row.detailRef !== undefined && row.detailRef !== detailRef) return blank('ref-mismatch');
    rows.push({
      id: row.id,
      requestId: row.requestId,
      summary: row.summary,
      fileCount: row.fileCount,
      additions: row.additions,
      deletions: row.deletions,
      detailRef,
    });
  }
  return { disposition: 'projected', reason: 'projected', rows };
}

/**
 * 明细只认指针指向的那一份。明细没量到时，不用列表里的文件名顶上。
 */
export function readChangeDetail(input: {
  detailRef: unknown;
  requestId: unknown;
  detail: unknown;
}): ChangeDetailPlan {
  const blank = (reason: ChangeDetailPlan['reason'], disposition: ChangeDetailPlan['disposition'] = 'unjudged'): ChangeDetailPlan => ({
    disposition,
    reason,
    files: null,
  });
  if (typeof input.detailRef !== 'string') return blank('ref-invalid', 'refused');
  const dot = input.detailRef.indexOf('.');
  const changeId = dot > 0 ? input.detailRef.slice(0, dot) : '';
  const refRequest = dot > 0 ? input.detailRef.slice(dot + 1) : '';
  if (!CHANGE_ID.test(changeId) || !CHANGE_ID.test(refRequest) || input.detailRef !== `${changeId}.${refRequest}`) {
    return blank('ref-invalid', 'refused');
  }
  if (input.requestId !== refRequest) return blank('request-mismatch', 'refused');
  if (input.detail === null || input.detail === undefined) return blank('detail-unmeasured');
  if (typeof input.detail !== 'object') return blank('detail-unmeasured');
  const detail = input.detail as Record<string, unknown>;
  if (!Array.isArray(detail.files) || !detail.files.every((name) => typeof name === 'string' && CHANGE_PATH.test(name))) {
    return blank('path-invalid', 'refused');
  }
  if (detail.fileCount !== undefined && (!changeCountOk(detail.fileCount) || detail.fileCount !== detail.files.length)) {
    return blank('count-mismatch', 'unjudged');
  }
  return { disposition: 'read', reason: 'read', files: detail.files };
}

export type RequestFileTreePlan = {
  disposition: 'read' | 'unjudged' | 'refused';
  reason: 'read' | 'request-invalid' | 'memo-unmeasured' | 'request-absent' | 'entry-unreadable' | 'clock-unmeasured';
  files: Array<{ path: string; name: string; size: number }> | null;
};

const REQUEST_FILE_TREE_ID = /^[a-f0-9]{32}$/;

/**
 * 文件树按请求号取。别的请求的树不能顶上，体积没量到也不写成 0。
 */
export function readRequestFileTree(input: { requestId: unknown; memo: unknown }): RequestFileTreePlan {
  const blank = (
    reason: RequestFileTreePlan['reason'],
    disposition: RequestFileTreePlan['disposition'] = 'unjudged',
  ): RequestFileTreePlan => ({ disposition, reason, files: null });
  if (typeof input.requestId !== 'string' || !REQUEST_FILE_TREE_ID.test(input.requestId)) {
    return blank('request-invalid', 'refused');
  }
  if (input.memo === null || input.memo === undefined || typeof input.memo !== 'object' || Array.isArray(input.memo)) {
    return blank('memo-unmeasured');
  }
  const memo = input.memo as Record<string, unknown>;
  if (!Object.prototype.hasOwnProperty.call(memo, input.requestId)) return blank('request-absent', 'refused');
  const entry = memo[input.requestId];
  if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) return blank('entry-unreadable');
  const row = entry as Record<string, unknown>;
  if (typeof row.createdAt !== 'string' || Number.isNaN(Date.parse(row.createdAt))) return blank('clock-unmeasured');
  if (!Array.isArray(row.files)) return blank('entry-unreadable');
  const files: Array<{ path: string; name: string; size: number }> = [];
  for (const item of row.files) {
    if (item === null || typeof item !== 'object') return blank('entry-unreadable');
    const file = item as Record<string, unknown>;
    if (typeof file.path !== 'string' || !CHANGE_PATH.test(file.path)) return blank('entry-unreadable');
    if (typeof file.name !== 'string' || file.name.trim() === '' || /[\\/]/.test(file.name)) return blank('entry-unreadable');
    if (typeof file.size !== 'number' || !Number.isInteger(file.size) || file.size < 0) return blank('entry-unreadable');
    files.push({ path: file.path, name: file.name, size: file.size });
  }
  return { disposition: 'read', reason: 'read', files };
}
