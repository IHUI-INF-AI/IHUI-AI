// 格式化时间
export function formatTime(date, format = 'YYYY-MM-DD HH:mm:ss') {
    const d = new Date(date)
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    const hours = String(d.getHours()).padStart(2, '0')
    const minutes = String(d.getMinutes()).padStart(2, '0')
    const seconds = String(d.getSeconds()).padStart(2, '0')
    
    return format
        .replace('YYYY', year)
        .replace('MM', month)
        .replace('DD', day)
        .replace('HH', hours)
        .replace('mm', minutes)
        .replace('ss', seconds)
}

// 格式化智汇值显示（大于五位数时显示为万单位，不四舍五入）
export function formatTokenValue(value) {
    if (!value) return '0';
    const num = parseInt(value);
    if (num >= 10000) {
        // 不使用toFixed(2)进行四舍五入，而是直接截断小数部分
        const divided = num / 10000;
        // 截断到两位小数（不四舍五入）
        const truncated = Math.floor(divided * 100) / 100;
        return truncated + '万';
    }
    return num.toString();
}

// 防抖函数
export function debounce(func, wait = 500) {
    let timeout
    return function (...args) {
        clearTimeout(timeout)
        timeout = setTimeout(() => {
            func.apply(this, args)
        }, wait)
    }
}

// 节流函数
export function throttle(func, wait = 500) {
    let previous = 0
    return function (...args) {
        const now = Date.now()
        if (now - previous > wait) {
            func.apply(this, args)
            previous = now
        }
    }
}

// 深拷贝
export function deepClone(obj) {
    if (obj === null || typeof obj !== 'object') return obj
    const clone = Array.isArray(obj) ? [] : {}
    for (let key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            clone[key] = deepClone(obj[key])
        }
    }
    return clone
}

// 检查是否为空
export function isEmpty(value) {
    if (value === null || value === undefined) return true
    if (typeof value === 'string' && value.trim() === '') return true
    if (Array.isArray(value) && value.length === 0) return true
    if (typeof value === 'object' && Object.keys(value).length === 0) return true
    return false
}

// 金额格式化
export function formatMoney(amount, decimals = 2) {
    return Number(amount).toFixed(decimals)
}

// 手机号格式化
export function formatPhone(phone) {
    return phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2')
}

// 获取文件大小
export function formatFileSize(bytes) {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}