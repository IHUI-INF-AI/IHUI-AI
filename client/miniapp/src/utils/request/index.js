/**
 * Ripple_Yu
 * 云函数请求工具
 * 封装统一的云函数调用方法，支持loading显示、错误处理等
 */

/**
 * 调用云函数的通用方法
 * @param {String} name - 云函数名称
 * @param {Object} data - 传递给云函数的数据
 * @param {Object} options - 配置选项
 * @param {Boolean} options.showLoading - 是否显示加载提示，默认false
 * @param {String} options.loadingText - 加载提示文字，默认为"加载中..."
 * @param {Boolean} options.showError - 是否自动显示错误提示，默认true
 * @returns {Promise} 返回Promise对象，resolve时返回云函数结果
 */
export const callCloudFunction = (name, data = {}, options = {}) => {
    // 默认配置
    const defaultOptions = {
      showLoading: false,
      loadingText: '加载中...',
      showError: true
    }
    
    // 合并配置
    const finalOptions = {...defaultOptions, ...options}
    
    // 显示加载提示
    if (finalOptions.showLoading) {
      uni.showLoading({
        title: finalOptions.loadingText,
        mask: true
      })
    }
    
    // 调用云函数
    return new Promise((resolve, reject) => {
      wx.cloud.callFunction({
        name,
        data
      }).then(res => {
        if (finalOptions.showLoading) {
          uni.hideLoading()
        }
        
        // 这里可以根据你的后端接口规范，统一处理返回结果
        // 例如，如果你的云函数返回格式为 {code: 0, data: xxx, message: 'xxx'}
        // 可以在这里统一判断code是否为0，非0则视为业务错误
        if (res.result && res.result.code !== undefined && res.result.code !== 0) {
          // 业务逻辑错误处理
          
          // 自动显示错误提示
          if (finalOptions.showError) {
            uni.showToast({
              title: res.result.message || '请求失败',
              icon: 'none',
              duration: 2000
            })
          }
          
          // 将业务错误作为Promise错误抛出
          reject(res.result)
          return
        }
        
        resolve(res.result)
      }).catch(err => {
        if (finalOptions.showLoading) {
          uni.hideLoading()
        }
        
        // 自动显示错误提示
        if (finalOptions.showError) {
          uni.showToast({
            title: err.message || '网络异常，请稍后再试',
            icon: 'none',
            duration: 2000
          })
        }
        
        reject(err)
      })
    })
  }
  
  /**
   * 简化版调用方法，自动显示loading
   * @param {String} name - 云函数名称
   * @param {Object} data - 传递给云函数的数据
   * @param {String} loadingText - 加载提示文字
   * @returns {Promise} 返回Promise对象
   */
  export const callCloudFunctionWithLoading = (name, data = {}, loadingText = '加载中...') => {
    return callCloudFunction(name, data, {
      showLoading: true,
      loadingText
    })
  }