import { readFileToBase64 } from '@/utils/readFileToBase64.js'

export function uploadPictures(maxCount = 9) {
  return new Promise((resolve, reject) => {
    uni.chooseImage({
      count: maxCount,
      sizeType: ["original", "compressed"],
      sourceType: ["album", "camera"],
      success: (chooseImageRes) => {
        const tempFiles = Array.isArray(chooseImageRes.tempFiles) ? chooseImageRes.tempFiles : []
        const tempPaths = Array.isArray(chooseImageRes.tempFilePaths) ? chooseImageRes.tempFilePaths : []
        const total = tempPaths.length > 0 ? tempPaths.length : tempFiles.length
        const pictures = []
        const fsm = (typeof wx !== 'undefined' && wx.getFileSystemManager) ? wx.getFileSystemManager() : (uni.getFileSystemManager && uni.getFileSystemManager())
        const readPromises = Array.from({ length: total }).map((_, index) => {
          return new Promise((readResolve, readReject) => {
            const tf = tempFiles[index] || {}
            const filePath = (tempPaths[index]) || tf.path
            if (!filePath) { readReject(new Error('无效图片路径')); return }
            const baseName = filePath.substring(filePath.lastIndexOf('/') + 1).split('?')[0]
            const dotIdx = baseName.lastIndexOf('.')
            const fileExt = dotIdx > -1 ? baseName.substring(dotIdx + 1).toLowerCase() : 'jpg'
            const finalName = tf.name || `wx_${Date.now()}_${index}.${fileExt}`
            const mimeType = fileExt === 'png' ? 'image/png' : fileExt === 'gif' ? 'image/gif' : 'image/jpeg'
            const doRead = (p) => {
              readFileToBase64(p)
                .then((base64Str) => {
                  const base64Data = `data:${mimeType};base64,` + base64Str
                  pictures.push({ base64: base64Data, fileName: finalName })
                  readResolve()
                })
                .catch((err) => {
                  const msg = String((err && err.errMsg) || (err && err.message) || '').toLowerCase()
                  if (fsm && fsm.saveFile && p.startsWith('http://tmp/')) {
                    fsm.saveFile({
                      tempFilePath: p,
                      success: (r) => {
                        readFileToBase64(r.savedFilePath)
                          .then((base64Str) => {
                            const base64Data = `data:${mimeType};base64,` + base64Str
                            pictures.push({ base64: base64Data, fileName: finalName })
                            readResolve()
                          })
                          .catch((e2) => readReject(e2))
                      },
                      fail: () => { readReject(err) }
                    })
                  } else {
                    readReject(err)
                  }
                })
            }
            const isHttp = /^https?:\/\//.test(filePath)
            if (isHttp) {
              // 检查是否是本地地址（127.0.0.1、localhost、0.0.0.0、::1 或内网地址）
              // 注意：这里只检测常见的本地地址，避免误判公网 IP
              const isLocalhost = /^https?:\/\/(127\.0\.0\.1|localhost|0\.0\.0\.0|::1|192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.)/i.test(filePath)
              if (isLocalhost) {
                // 本地地址不在微信小程序合法域名列表中，直接提示用户
                readReject(new Error('不支持从本地服务器选择图片，请从相册或相机选择图片'))
                return
              }
              
              uni.compressImage({
                src: filePath,
                quality: 80,
                success: (cRes) => {
                  const p = cRes.tempFilePath || cRes.apFilePath || filePath
                  if (/^https?:\/\//.test(p)) {
                    if (typeof wx !== 'undefined' && wx.arrayBufferToBase64) {
                      uni.request({
                        url: filePath,
                        responseType: 'arraybuffer',
                        success: (resp) => {
                          if (resp && resp.statusCode === 200) {
                            const base = wx.arrayBufferToBase64(resp.data)
                            const base64Data = `data:${mimeType};base64,` + base
                            pictures.push({ base64: base64Data, fileName: finalName })
                            readResolve()
                          } else {
                            readReject(new Error('网络读取失败'))
                          }
                        },
                        fail: (reqErr) => { 
                          // 如果请求失败，可能是域名不在合法列表中，尝试使用 downloadFile
                          uni.downloadFile({
                            url: filePath,
                            success: (downloadRes) => {
                              if (downloadRes.statusCode === 200) {
                                const tempFilePath = downloadRes.tempFilePath
                                doRead(tempFilePath)
                              } else {
                                readReject(new Error('下载图片失败'))
                              }
                            },
                            fail: () => { readReject(reqErr) }
                          })
                        }
                      })
                    } else {
                      readReject(new Error('不支持网络读取'))
                    }
                  } else {
                    doRead(p)
                  }
                },
                fail: () => {
                  if (typeof wx !== 'undefined' && wx.arrayBufferToBase64) {
                    uni.request({
                      url: filePath,
                      responseType: 'arraybuffer',
                      success: (resp) => {
                        if (resp && resp.statusCode === 200) {
                          const base = wx.arrayBufferToBase64(resp.data)
                          const base64Data = `data:${mimeType};base64,` + base
                          pictures.push({ base64: base64Data, fileName: finalName })
                          readResolve()
                        } else {
                          readReject(new Error('网络读取失败'))
                        }
                      },
                      fail: (reqErr) => { 
                        // 如果请求失败，可能是域名不在合法列表中，尝试使用 downloadFile
                        uni.downloadFile({
                          url: filePath,
                          success: (downloadRes) => {
                            if (downloadRes.statusCode === 200) {
                              const tempFilePath = downloadRes.tempFilePath
                              doRead(tempFilePath)
                            } else {
                              readReject(new Error('下载图片失败'))
                            }
                          },
                          fail: () => { readReject(reqErr) }
                        })
                      }
                    })
                  } else {
                    readReject(new Error('不支持网络读取'))
                  }
                }
              })
            } else {
              doRead(filePath)
            }
          })
        })
        Promise.all(readPromises)
          .then(() => { resolve(pictures) })
          .catch(err => { reject(err) })
      },
      fail: (err) => {
        const msg = String((err && err.errMsg) || '').toLowerCase()
        if (msg.includes('cancel')) { resolve([]); return }
        reject(err)
      }
    })
  })
}

/**
 * 上传单张本地图片到服务器（读取 filePath 为 base64 后调用 uploadBybase64）
 * 用于已通过 uni.chooseImage 获取 tempFilePath 后的单张上传场景
 * @param {string} filePath 本地图片路径（来自 uni.chooseImage 的 tempFilePath）
 * @returns {Promise<{url: string}>} 上传成功后的图片 URL 对象
 */
export async function uploadSinglePicture(filePath) {
  if (!filePath) {
    throw new Error('uploadSinglePicture: filePath 不能为空')
  }

  // 1. 读取文件为 base64
  const base64Str = await readFileToBase64(filePath)

  // 2. 生成文件名
  const baseName = filePath.substring(filePath.lastIndexOf('/') + 1).split('?')[0]
  const dotIdx = baseName.lastIndexOf('.')
  const fileExt = dotIdx > -1 ? baseName.substring(dotIdx + 1).toLowerCase() : 'jpg'
  const fileName = `wx_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${fileExt}`

  // 3. 动态导入 uploadBybase64 避免循环依赖
  const { uploadBybase64 } = await import('@/service/businessCard.js')

  // 4. 上传到服务器
  const result = await uploadBybase64(base64Str, fileName)

  // 5. 解析返回 URL
  const url = (result && result.url) || ''
  if (!url) {
    throw new Error('uploadSinglePicture: 上传成功但未返回 url')
  }
  return { url }
}

