/**
 * 轻量消息工具，替代 ElMessage / ElMessageBox
 * 使用原生 DOM + 项目 CSS 变量，无第三方依赖
 */
type MessageType = 'success' | 'error' | 'warning' | 'info'

let toastContainer: HTMLElement | null = null

function getContainer(): HTMLElement {
  if (!toastContainer) {
    toastContainer = document.createElement('div')
    toastContainer.style.cssText =
      'position:fixed;top:20px;left:50%;transform:translateX(-50%);z-index:9999;display:flex;flex-direction:column;gap:8px;pointer-events:none;'
    document.body.appendChild(toastContainer)
  }
  return toastContainer
}

const borderColor: Record<MessageType, string> = {
  success: 'hsl(var(--primary))',
  error: 'hsl(0 84% 60%)',
  warning: 'hsl(38 92% 50%)',
  info: 'hsl(217 91% 60%)',
}

function show(text: string, type: MessageType) {
  const container = getContainer()
  const toast = document.createElement('div')
  toast.style.cssText = `background:hsl(var(--background));color:hsl(var(--foreground));border-left:4px solid ${borderColor[type]};padding:12px 16px;border-radius:6px;box-shadow:0 4px 12px rgba(0,0,0,0.15);min-width:240px;max-width:420px;pointer-events:auto;opacity:0;transition:opacity 0.25s;font-size:14px;`
  toast.textContent = text
  container.appendChild(toast)
  requestAnimationFrame(() => {
    toast.style.opacity = '1'
  })
  setTimeout(() => {
    toast.style.opacity = '0'
    setTimeout(() => toast.remove(), 250)
  }, 3000)
}

export const message = {
  success: (text: string) => show(text, 'success'),
  error: (text: string) => show(text, 'error'),
  warning: (text: string) => show(text, 'warning'),
  info: (text: string) => show(text, 'info'),
}

interface ConfirmOptions {
  type?: MessageType
  confirmButtonText?: string
  cancelButtonText?: string
}

export function confirm(
  message: string,
  title?: string,
  _options?: ConfirmOptions,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const overlay = document.createElement('div')
    overlay.style.cssText =
      'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:10000;display:flex;align-items:center;justify-content:center;'

    const modal = document.createElement('div')
    modal.style.cssText =
      'background:hsl(var(--background));color:hsl(var(--foreground));border-radius:8px;padding:24px;min-width:320px;max-width:480px;box-shadow:0 8px 24px rgba(0,0,0,0.2);'

    if (title) {
      const titleEl = document.createElement('div')
      titleEl.style.cssText = 'font-size:16px;font-weight:600;margin-bottom:12px;'
      titleEl.textContent = title
      modal.appendChild(titleEl)
    }

    const msgEl = document.createElement('div')
    msgEl.style.cssText = 'font-size:14px;color:hsl(var(--muted-foreground));margin-bottom:20px;line-height:1.5;'
    msgEl.textContent = message
    modal.appendChild(msgEl)

    const btnContainer = document.createElement('div')
    btnContainer.style.cssText = 'display:flex;justify-content:flex-end;gap:8px;'

    const cancelBtn = document.createElement('button')
    cancelBtn.textContent = '取消'
    cancelBtn.style.cssText =
      'padding:6px 16px;border:1px solid hsl(var(--border));border-radius:4px;background:transparent;color:hsl(var(--foreground));cursor:pointer;font-size:14px;'
    cancelBtn.onclick = () => {
      overlay.remove()
      reject(new Error('cancel'))
    }

    const okBtn = document.createElement('button')
    okBtn.textContent = '确定'
    okBtn.style.cssText =
      'padding:6px 16px;border:none;border-radius:4px;background:hsl(var(--primary));color:hsl(var(--primary-foreground));cursor:pointer;font-size:14px;'
    okBtn.onclick = () => {
      overlay.remove()
      resolve()
    }

    btnContainer.appendChild(cancelBtn)
    btnContainer.appendChild(okBtn)
    modal.appendChild(btnContainer)
    overlay.appendChild(modal)
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.remove()
        reject(new Error('cancel'))
      }
    })
    document.body.appendChild(overlay)
  })
}

// 兼容导出，方便平滑迁移
export const ElMessage = message
export const ElMessageBox = { confirm }
