const STATUS_STYLE: Record<string, string> = {
  accepted: 'bg-muted text-muted-foreground',
  running: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  success: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  failed: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
}

const STATUS_LABEL: Record<string, string> = {
  accepted: '已受理',
  running: '生成中',
  success: '已完成',
  failed: '失败',
}

export function VideoTaskStatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[status] ?? STATUS_STYLE.accepted}`}
    >
      {STATUS_LABEL[status] ?? status}
    </span>
  )
}

export function getVideoTaskStatusLabel(status: string): string {
  return STATUS_LABEL[status] ?? status
}
