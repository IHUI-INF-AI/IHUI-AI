import { ElNotification, ElMessageBox, ElLoading } from 'element-plus'

export function error(tips: string) {
  ElNotification({ title: '错误', message: tips, type: 'error' })
}

export function info(tips: string) {
  ElNotification({ title: '消息', message: tips, type: 'info' })
}

export function success(tips: string) {
  ElNotification({ title: '成功', message: tips, type: 'success' })
}

export function warning(tips: string) {
  ElNotification({ title: '提示', message: tips, type: 'warning' })
}

// 兼容两种调用：confirm(tips, title, submit, cancel) 或 confirm(tips, submit, cancel)
export function confirm(tips: string, title: any, submit?: any, cancel?: any) {
  let realTitle = title
  let realSubmit = submit
  let realCancel = cancel
  if (typeof title === 'function') {
    realCancel = submit
    realSubmit = title
    realTitle = '提示'
  }
  return ElMessageBox.confirm(tips, realTitle || '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  })
    .then(() => {
      realSubmit && realSubmit()
    })
    .catch(() => {
      realCancel && realCancel()
    })
}

export function loading(tips: string) {
  return ElLoading.service({
    lock: true,
    text: tips,
    background: 'rgba(255, 255, 255, 0.7)'
  })
}
