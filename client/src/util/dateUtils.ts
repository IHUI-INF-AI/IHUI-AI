// @ts-nocheck
function padLeftZero(str: string) {
  return ('00' + str).substr(str.length)
}

export function dateFormat(date: any) {
  return date ? ('' + date).replace('T', ' ') : date
}

export function formatDate(timestamp: any, fmt?: string) {
  const date = new Date(timestamp)
  if (!fmt) {
    fmt = 'yyyy-MM-dd hh:mm:ss'
  }
  if (/(y+)/.test(fmt)) {
    fmt = fmt.replace(RegExp.$1, (date.getFullYear() + '').substr(4 - RegExp.$1.length))
  }
  const o: any = {
    'M+': date.getMonth() + 1,
    'd+': date.getDate(),
    'h+': date.getHours(),
    'm+': date.getMinutes(),
    's+': date.getSeconds()
  }
  for (const k in o) {
    if (new RegExp(`(${k})`).test(fmt)) {
      const str = o[k] + ''
      fmt = fmt.replace(RegExp.$1, RegExp.$1.length === 1 ? str : padLeftZero(str))
    }
  }
  return fmt
}

export function friendlyDate(date: any) {
  const formats: any = {
    year: '%n% 年前',
    month: '%n% 月前',
    day: '%n% 天前',
    hour: '%n% 小时前',
    minute: '%n% 分钟前',
    second: '%n% 秒前'
  }
  const timestamp = Date.parse(dateFormat(date))
  const now = Date.now()
  let seconds = Math.floor((now - timestamp) / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  const months = Math.floor(days / 30)
  const years = Math.floor(months / 12)

  let diffType = ''
  let diffValue = 0
  if (years > 0) {
    return formatDate(timestamp)
  } else {
    if (months > 0) {
      diffType = 'month'
      diffValue = months
    } else if (days > 0) {
      diffType = 'day'
      diffValue = days
    } else if (hours > 0) {
      diffType = 'hour'
      diffValue = hours
    } else if (minutes > 0) {
      diffType = 'minute'
      diffValue = minutes
    } else {
      diffType = 'second'
      diffValue = seconds === 0 ? (seconds = 1) : seconds
    }
  }
  return formats[diffType].replace('%n%', diffValue)
}

export function formatSeconds(seconds: any) {
  seconds = Math.floor(seconds)
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60

  let result = ''
  if (h > 0) result += `${h}时`
  if (m > 0) result += `${m}分`
  if (s > 0 || result === '') result += `${s}秒`

  return result
}

// 将秒数格式化为可读时长 (别名, 旧教育平台使用)
export function formatMinutes(seconds: any) {
  return formatSeconds(seconds)
}

// 将分钟数格式化为可读时长
export function formatMinute(minutes: any) {
  minutes = Math.floor(Number(minutes) || 0)
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  let result = ''
  if (h > 0) result += `${h}小时`
  if (m > 0 || result === '') result += `${m}分钟`
  return result
}
