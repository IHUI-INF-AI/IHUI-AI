<template>
  <view class="publish_container">
    <navigation-bars :viscosity="true" color="#171717" font-size-30 title="发布作品"
                     @pack="backPage"
                     :image="'/static/images/back.svg'"/>
    <scroll-view class="publish_page" @click.stop="clearDialog" scroll-y>
      <Loading v-if="loading"></Loading>
      
      <!-- <view class="title_icon">
        <image class="title_icon-image" src="https://file.aizhs.top/sys-mini/backf2.png" />
        <view class="title_icon-text">发布作品</view>
      </view> -->
    
    <!-- 作品文件上传（如果有传入的作品信息则不显示上传按钮） -->
    <view v-if="!hasWorkInfo" class="f_n m_b18">
      <image class="icon_icon" src="https://file.aizhs.top/sys-mini/xtk/set_need_image.png" />
      <view class="font_hold">上传作品</view>
    </view>
    <view class="f_n m_b18 image_list">
      <view v-if="!hasWorkInfo" class="image_item" @click.stop="() => { up_bo_win = true }">
        <image class="icon_image" src="https://file.aizhs.top/sys-mini/xtk/set_need_addimage.png" />
      </view>
      <view class="image_item" v-for="(item, index) in fileList" :key="index">
        <image v-if="item.fileType === 'image'" class="icon_image" :src="item.fileUrl" />
        <view v-else-if="item.fileType === 'video'" class="video_preview">
          <image class="icon_image" :src="item.coverUrl || '/static/images/video-placeholder.png'" />
          <view class="video_play_icon">▶</view>
        </view>
        <view v-else-if="item.fileType === 'audio'" class="audio_preview">
          <image class="icon_image" :src="item.coverUrl || '/static/images/audio-icon.png'" />
          <view class="audio_label">音频</view>
        </view>
        <view v-if="!hasWorkInfo" class="file_remove" @click.stop="removeFile(index)">×</view>
      </view>
    </view>
    
    <!-- 文本输入框（当选择了文本时显示，在标题上方） -->
    <view v-if="hasText" class="text_input_container m_b18">
      <view class="f_n m_b12">
        <image class="icon_icon" src="https://file.aizhs.top/sys-mini/xtk/set_need_text.png" />
        <view class="font_hold">文本内容</view>
        <view class="text_remove_btn" @click="removeText">×</view>
      </view>
      <textarea 
        class="font_nomal text_content_area" 
        auto-height 
        :value="textContent" 
        @input="changeTextContent" 
        placeholder="请输入文本内容"
        maxlength="2000"
      ></textarea>
    </view>
    
    <!-- 音频封面上传（当有音频文件时显示，在标题上方） -->
    <view v-if="hasAudio" class="audio_cover_container m_b18">
      <view class="f_n m_b12">
        <image class="icon_icon" src="https://file.aizhs.top/sys-mini/xtk/set_need_image.png" />
        <view class="font_hold">音频封面</view>
      </view>
      <view class="audio_cover_upload_area" @click.stop="uploadAudioCover(currentAudioIndex)">
        <image v-if="currentAudioCoverUrl" class="audio_cover_image" :src="currentAudioCoverUrl" mode="aspectFill" />
        <view v-else class="audio_cover_placeholder">
          <image class="cover_upload_icon" src="https://file.aizhs.top/sys-mini/xtk/set_need_addimage.png" />
          <view class="cover_upload_text">点击上传封面</view>
        </view>
      </view>
    </view>
    
    <!-- 视频封面上传（当有视频文件时显示，在标题上方） -->
    <view v-if="hasVideo" class="audio_cover_container m_b18">
      <view class="f_n m_b12">
        <image class="icon_icon" src="https://file.aizhs.top/sys-mini/xtk/set_need_image.png" />
        <view class="font_hold">视频封面</view>
      </view>
      <view class="audio_cover_upload_area" @click.stop="uploadVideoCover(currentVideoIndex)">
        <image v-if="currentVideoCoverUrl" class="audio_cover_image" :src="currentVideoCoverUrl" mode="aspectFill" />
        <view v-else class="audio_cover_placeholder">
          <image class="cover_upload_icon" src="https://file.aizhs.top/sys-mini/xtk/set_need_addimage.png" />
          <view class="cover_upload_text">点击上传封面</view>
        </view>
      </view>
    </view>
    
    <!-- 标题 -->
    <view class="f_n m_b18">
      <image class="icon_icon" src="https://file.aizhs.top/sys-mini/xtk/set_need_work.png" />
      <view class="font_hold">作品标题</view>
    </view>
    <input class="m_b18 font_nomal need_title_input" maxlength="50" v-model="title" type="text" placeholder="请输入作品标题" />
    
    <!-- 简介 -->
    <view class="f_n m_b18">
      <image class="icon_icon" src="https://file.aizhs.top/sys-mini/xtk/set_need_text.png" />
      <view class="font_hold">作品简介</view>
    </view>
    <textarea class="m_b18 font_nomal text_area" auto-height :value="description" @input="changeDescription" placeholder="请输入作品简介"></textarea>
    
    <!-- 提示词 -->
    <view class="f_n m_b18">
      <image class="icon_icon" src="https://file.aizhs.top/sys-mini/xtk/set_need_text.png" />
      <view class="font_hold">提示词</view>
    </view>
    <textarea class="m_b18 font_nomal text_area" auto-height :value="prompt" @input="changePrompt" placeholder="请输入提示词"></textarea>

    <!-- 上传选择弹窗 -->
    <view class="up_bo_win" v-if="up_bo_win">
      <view class="flex_center item1" @click="handleIconClick('camera')">拍照</view>
      <view class="flex_center item1" @click="handleIconClick('album')">相册</view>
      <view class="flex_center item1" @click="handleIconClick('video')">视频</view>
      <view class="flex_center item1" @click="handleIconClick('audio')">音频</view>
      <view class="flex_center item1" @click="handleIconClick('text')">文本</view>
      <view class="flex_center item3"></view>
      <view class="flex_center item4" @click="() => { up_bo_win = false }">取消</view>
    </view>

    <!-- 提交按钮 -->
    <view class="sub_btn flex_center" @click.stop="submit">
      <text>发布作品</text>
    </view>
      <view style="height: 122rpx;"></view>
    </scroll-view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { onLoad } from "@dcloudio/uni-app"
import NavigationBars from "@/components/navigation-bars/index.vue"
import { uploadBusinessCarda, uploadBybase64 } from "@/service/businessCard.js"
import { agentCreationShare } from "@/service/pay.js"
import Loading from "@/components/loading/index.vue"

const loading = ref(false)
const fileList = ref([])
const up_bo_win = ref(false)
const title = ref('')
const description = ref('')
const prompt = ref('')
const textContent = ref('')
const hasText = ref(false)
const userInfo = ref({})
const hasWorkInfo = ref(false)
const contextId = ref('')

// 是否有音频文件
const hasAudio = computed(() => {
  return fileList.value.some(item => item.fileType === 'audio')
})

// 当前音频的索引
const currentAudioIndex = computed(() => {
  const audioIndex = fileList.value.findIndex(item => item.fileType === 'audio')
  return audioIndex >= 0 ? audioIndex : 0
})

// 当前音频的封面URL
const currentAudioCoverUrl = computed(() => {
  if (hasAudio.value && fileList.value[currentAudioIndex.value]) {
    return fileList.value[currentAudioIndex.value].coverUrl || ''
  }
  return ''
})

// 是否有视频文件
const hasVideo = computed(() => {
  return fileList.value.some(item => item.fileType === 'video')
})

// 当前视频的索引
const currentVideoIndex = computed(() => {
  const videoIndex = fileList.value.findIndex(item => item.fileType === 'video')
  return videoIndex >= 0 ? videoIndex : 0
})

// 当前视频的封面URL
const currentVideoCoverUrl = computed(() => {
  if (hasVideo.value && fileList.value[currentVideoIndex.value]) {
    return fileList.value[currentVideoIndex.value].coverUrl || ''
  }
  return ''
})

onMounted(() => {
  userInfo.value = uni.getStorageSync("data") || {}
})

// 接收页面跳转传入的作品信息（从 AIGC 结果页等带参跳转时启用）
onLoad((options) => {
  if (!options) return
  if (options.contextId || options.title || options.prompt) {
    hasWorkInfo.value = true

    if (options.contextId) {
      contextId.value = options.contextId
    }

    if (options.title) {
      title.value = decodeURIComponent(options.title)
    }

    if (options.prompt) {
      prompt.value = decodeURIComponent(options.prompt)
    }

    if (options.lists) {
      try {
        const lists = JSON.parse(decodeURIComponent(options.lists))
        if (Array.isArray(lists) && lists.length > 0) {
          lists.forEach(listItem => {
            if (listItem.type === 'image' && listItem.image) {
              fileList.value.push({
                fileUrl: listItem.image,
                fileType: 'image',
                coverUrl: listItem.image
              })
            } else if (listItem.type === 'text' && listItem.text) {
              if (!hasText.value) {
                hasText.value = true
                textContent.value = listItem.text
              } else {
                textContent.value += '\n\n' + listItem.text
              }
            }
          })
        }
      } catch (e) {
        console.error('解析列表信息失败:', e)
      }
    } else {
      if (options.content) {
        const content = decodeURIComponent(options.content)
        if (content && !content.startsWith('http') && !content.includes('.mp4') && !content.includes('.mp3') && !content.includes('.wav') && !content.includes('.m4a') && !content.includes('.aac')) {
          hasText.value = true
          textContent.value = content
        }
      }

      if (options.imgUrlList) {
        try {
          const imgUrlList = JSON.parse(decodeURIComponent(options.imgUrlList))
          if (Array.isArray(imgUrlList) && imgUrlList.length > 0) {
            imgUrlList.forEach(imgUrl => {
              fileList.value.push({
                fileUrl: imgUrl,
                fileType: 'image',
                coverUrl: imgUrl
              })
            })
          }
        } catch (e) {
          console.error('解析图片列表失败:', e)
        }
      }

      if (options.videoUrl) {
        const videoUrl = decodeURIComponent(options.videoUrl)
        if (videoUrl) {
          fileList.value.push({
            fileUrl: videoUrl,
            fileType: 'video',
            coverUrl: ''
          })
        }
      }

      if (options.audioUrl) {
        const audioUrl = decodeURIComponent(options.audioUrl)
        if (audioUrl) {
          fileList.value.push({
            fileUrl: audioUrl,
            fileType: 'audio',
            coverUrl: ''
          })
        }
      }
    }
  }
})

// 获取兼容的文件系统管理器
function getFileSystemManagerCompat() {
  try {
    // #ifdef APP-PLUS
    // APP平台使用plus.io
    return {
      readFile: (options) => {
        let filePath = options.filePath
        if (filePath && !filePath.startsWith('/') && !filePath.startsWith('file://')) {
          if (!filePath.startsWith('file://')) {
            filePath = 'file://' + filePath
          }
        }

        console.log('APP端读取文件，路径:', filePath)

        const isExternalStorage = filePath && (
          filePath.startsWith('/storage/') ||
          filePath.startsWith('/sdcard/') ||
          filePath.includes('/emulated/') ||
          filePath.includes('/Download/')
        )

        const readFileFromEntry = (entry) => {
          entry.file((file) => {
            console.log('成功获取文件对象，文件大小:', file.size)

            if (file.size > 50 * 1024 * 1024) {
              options.fail && options.fail({
                code: -1,
                message: '文件过大，请选择小于50MB的文件'
              })
              return
            }

            const fileReader = new plus.io.FileReader()
            let isCompleted = false

            const handleSuccess = (result) => {
              if (isCompleted) return
              isCompleted = true

              try {
                if (!result) {
                  options.fail && options.fail({
                    code: -1,
                    message: '文件读取结果为空'
                  })
                  return
                }

                if (options.encoding === 'base64') {
                  if (typeof result === 'string' && result.includes(',')) {
                    result = result.split(',')[1]
                  }
                }
                console.log('文件读取成功，数据长度:', result ? (typeof result === 'string' ? result.length : '非字符串') : 0)
                options.success && options.success({ data: result })
              } catch (err) {
                console.error('处理文件数据失败:', err)
                options.fail && options.fail({
                  code: -1,
                  message: '处理文件数据失败: ' + (err.message || '未知错误')
                })
              }
            }

            const handleError = (e, errorMessage) => {
              if (isCompleted) return

              console.error('FileReader错误:', e)
              console.error('错误详情:', JSON.stringify(e))

              const isAndroid10Error = e && e.error && e.error.code === 15

              if (isAndroid10Error) {
                isCompleted = true
                options.fail && options.fail({
                  code: 15,
                  message: '无法读取外部存储路径的文件（Android 10+ 限制）。请将文件移动到应用可访问的位置后重试，或使用其他方式选择文件。'
                })
                return
              }

              if (options.encoding === 'base64' && !isCompleted) {
                console.log('尝试使用readAsArrayBuffer作为备用方案')
                try {
                  const arrayBufferReader = new plus.io.FileReader()
                  let arrayBufferCompleted = false

                  arrayBufferReader.onloadend = (e) => {
                    if (arrayBufferCompleted || isCompleted) return
                    arrayBufferCompleted = true

                    try {
                      if (e.target.error) {
                        console.error('ArrayBuffer读取错误:', e.target.error)
                        isCompleted = true
                        if (e.target.error.code === 15) {
                          options.fail && options.fail({
                            code: 15,
                            message: '无法读取外部存储路径的文件（Android 10+ 限制）。请将文件移动到应用可访问的位置后重试。'
                          })
                        } else {
                          options.fail && options.fail({
                            code: e.target.error.code || -1,
                            message: 'ArrayBuffer读取失败: ' + (e.target.error.message || '未知错误')
                          })
                        }
                        return
                      }

                      const arrayBuffer = e.target.result
                      if (!arrayBuffer) {
                        isCompleted = true
                        options.fail && options.fail({
                          code: -1,
                          message: 'ArrayBuffer读取结果为空'
                        })
                        return
                      }

                      const bytes = new Uint8Array(arrayBuffer)
                      let binary = ''
                      const chunkSize = 8192
                      for (let i = 0; i < bytes.byteLength; i += chunkSize) {
                        const chunk = bytes.subarray(i, i + chunkSize)
                        binary += String.fromCharCode.apply(null, chunk)
                      }
                      const base64 = btoa(binary)
                      console.log('ArrayBuffer转base64成功，长度:', base64.length)
                      handleSuccess(base64)
                    } catch (convertErr) {
                      console.error('ArrayBuffer转base64失败:', convertErr)
                      isCompleted = true
                      options.fail && options.fail({
                        code: -1,
                        message: '文件格式转换失败: ' + (convertErr.message || '未知错误')
                      })
                    }
                  }

                  arrayBufferReader.onerror = (e) => {
                    if (arrayBufferCompleted || isCompleted) return
                    arrayBufferCompleted = true
                    isCompleted = true
                    options.fail && options.fail({
                      code: -1,
                      message: '读取文件失败: ' + (e.message || errorMessage || '未知错误')
                    })
                  }

                  arrayBufferReader.readAsArrayBuffer(file)
                  return
                } catch (arrayBufferErr) {
                  console.error('启动ArrayBuffer备用方案失败:', arrayBufferErr)
                }
              }

              isCompleted = true
              const error = {
                code: e && (e.code || e.type) || -1,
                message: e && e.message || errorMessage || '文件读取失败'
              }
              options.fail && options.fail(error)
            }

            fileReader.onloadend = (e) => {
              handleSuccess(e.target.result)
            }

            fileReader.onerror = (e) => {
              handleError(e, '文件读取失败')
            }

            try {
              if (options.encoding === 'base64') {
                fileReader.readAsDataURL(file)
              } else {
                fileReader.readAsText(file)
              }
            } catch (err) {
              console.error('调用readAsDataURL失败:', err)
              handleError(err, '读取文件方法调用失败')
            }
          }, (e) => {
            console.error('获取文件对象失败:', e)
            options.fail && options.fail({
              code: e.code || -1,
              message: e.message || '获取文件对象失败'
            })
          })
        }

        if (isExternalStorage) {
          console.log('检测到外部存储路径，需要复制到应用运行路径')
          plus.io.resolveLocalFileSystemURL(filePath, (sourceEntry) => {
            console.log('成功解析外部文件路径')
            plus.io.resolveLocalFileSystemURL('_doc', (docEntry) => {
              const fileName = filePath.split('/').pop() || 'temp_' + Date.now() + '.tmp'
              console.log('准备复制文件到应用运行路径，文件名:', fileName)

              sourceEntry.copyTo(docEntry, fileName, (targetEntry) => {
                console.log('文件复制成功，新路径:', targetEntry.fullPath)
                readFileFromEntry(targetEntry)
              }, (copyErr) => {
                console.error('文件复制失败:', copyErr)
                const errorMsg = '无法访问外部存储文件（Android 10+ 限制）。\n\n建议：\n1. 将音频文件移动到"下载"文件夹外的其他位置\n2. 或使用应用内的录音功能（如果支持）\n3. 或通过其他应用分享文件到本应用'
                options.fail && options.fail({
                  code: copyErr.code || 15,
                  message: errorMsg
                })
              })
            }, (docErr) => {
              console.error('获取应用运行路径失败:', docErr)
              options.fail && options.fail({
                code: docErr.code || -1,
                message: '获取应用运行路径失败: ' + (docErr.message || '未知错误')
              })
            })
          }, (resolveErr) => {
            console.error('解析外部文件路径失败:', resolveErr)
            options.fail && options.fail({
              code: resolveErr.code || -1,
              message: '解析文件路径失败: ' + (resolveErr.message || '未知错误')
            })
          })
        } else {
          plus.io.resolveLocalFileSystemURL(filePath, (entry) => {
            console.log('成功解析文件路径')
            readFileFromEntry(entry)
          }, (e) => {
            console.error('解析文件路径失败:', e)
            if (filePath !== options.filePath) {
              console.log('尝试使用原始路径:', options.filePath)
              plus.io.resolveLocalFileSystemURL(options.filePath, (entry) => {
                readFileFromEntry(entry)
              }, (e2) => {
                options.fail && options.fail({
                  code: e2.code || -1,
                  message: e2.message || '解析文件路径失败'
                })
              })
            } else {
              options.fail && options.fail({
                code: e.code || -1,
                message: e.message || '解析文件路径失败'
              })
            }
          })
        }
      }
    }
    // #endif

    // #ifndef APP-PLUS
    return uni.getFileSystemManager()
    // #endif
  } catch (error) {
    console.error('获取文件系统管理器失败:', error)
    return null
  }
}

function clearDialog() {
  up_bo_win.value = false
}

function changeDescription(e) {
  description.value = e.detail.value
}

function changePrompt(e) {
  prompt.value = e.detail.value
}

function changeTextContent(e) {
  textContent.value = e.detail.value
}

function removeText() {
  hasText.value = false
  textContent.value = ''
}

function removeFile(index) {
  fileList.value.splice(index, 1)
}

function handleIconClick(type) {
  up_bo_win.value = false

  if (fileList.value.length >= 5) {
    uni.showToast({
      title: '最多上传5个文件',
      icon: 'none',
      duration: 2000
    })
    return
  }

  switch (type) {
    case 'camera':
      uni.chooseImage({
        count: 1,
        sourceType: ['camera'],
        success: (res) => {
          uploadImage(res.tempFilePaths[0], 'image')
        }
      })
      break
    case 'album':
      uni.chooseImage({
        count: 1,
        sourceType: ['album'],
        success: (res) => {
          uploadImage(res.tempFilePaths[0], 'image')
        }
      })
      break
    case 'video':
      uni.chooseVideo({
        sourceType: ['album', 'camera'],
        maxDuration: 60,
        camera: 'back',
        success: (res) => {
          uploadVideo(res.tempFilePath, res.thumbTempFilePath)
        }
      })
      break
    case 'audio':
      chooseAudioFile()
      break
    case 'text':
      if (hasText.value) {
        uni.showToast({
          title: '已选择文本',
          icon: 'none'
        })
        return
      }
      hasText.value = true
      textContent.value = ''
      break
  }
}

function uploadImage(imgPath, fileType) {
  uni.showLoading({
    title: '上传中...'
  })

  const fileSystemManager = getFileSystemManagerCompat()
  if (!fileSystemManager) {
    uni.hideLoading()
    uni.showToast({
      title: '文件系统不可用',
      icon: 'none',
      duration: 2000
    })
    return
  }

  fileSystemManager.readFile({
    filePath: imgPath,
    encoding: 'base64',
    success: (data) => {
      const base64Str = data.data
      const fileName = imgPath.split('/').pop()
      const { uuid } = userInfo.value

      uploadBusinessCarda(base64Str, fileName)
        .then((res) => {
          if (res.code === "200" && res.data) {
            fileList.value.push({
              fileUrl: res.data,
              fileType: fileType,
              coverUrl: res.data
            })
            uni.hideLoading()
            uni.showToast({
              title: '上传成功',
              icon: 'success',
              duration: 2000
            })
          } else {
            throw new Error('上传失败')
          }
        })
        .catch((err) => {
          uni.hideLoading()
          uni.showToast({
            title: '上传失败',
            icon: 'none',
            duration: 2000
          })
          console.error("上传失败", err)
        })
    },
    fail: () => {
      uni.hideLoading()
      uni.showToast({
        title: '读取文件失败',
        icon: 'none'
      })
    }
  })
}

function uploadVideo(videoPath, thumbPath) {
  uni.showLoading({
    title: '上传中...'
  })

  const fileSystemManager = getFileSystemManagerCompat()
  if (!fileSystemManager) {
    uni.hideLoading()
    uni.showToast({
      title: '文件系统不可用',
      icon: 'none',
      duration: 2000
    })
    return
  }

  fileSystemManager.readFile({
    filePath: thumbPath,
    encoding: 'base64',
    success: (data) => {
      const base64Str = data.data
      const fileName = thumbPath.split('/').pop()
      const { uuid } = userInfo.value

      uploadBusinessCarda(base64Str, fileName)
        .then((res) => {
          if (res.code === "200" && res.data) {
            uni.uploadFile({
              url: 'https://bsm.aizhs.top/prod-api/file/upload',
              filePath: videoPath,
              name: 'file',
              success: (uploadRes) => {
                const uploadData = JSON.parse(uploadRes.data)
                if (uploadData.code === 200 && uploadData.data) {
                  fileList.value.push({
                    fileUrl: uploadData.data.url || uploadData.data,
                    fileType: 'video',
                    coverUrl: res.data
                  })
                  uni.hideLoading()
                  uni.showToast({
                    title: '上传成功',
                    icon: 'success',
                    duration: 2000
                  })
                } else {
                  throw new Error('视频上传失败')
                }
              },
              fail: () => {
                uni.hideLoading()
                uni.showToast({
                  title: '视频上传失败',
                  icon: 'none'
                })
              }
            })
          } else {
            throw new Error('缩略图上传失败')
          }
        })
        .catch((err) => {
          uni.hideLoading()
          uni.showToast({
            title: '上传失败',
            icon: 'none',
            duration: 2000
          })
          console.error("上传失败", err)
        })
    },
    fail: () => {
      uni.hideLoading()
      uni.showToast({
        title: '读取缩略图失败',
        icon: 'none'
      })
    }
  })
}

function chooseAudioFile() {
  // #ifdef MP-WEIXIN
  wx.chooseMessageFile({
    count: 1,
    type: 'file',
    extension: ['mp3', 'wav', 'm4a', 'aac'],
    success: (res) => {
      uploadAudio(res.tempFiles[0].path)
    },
    fail: (err) => {
      console.error('选择音频文件失败:', err)
      uni.showToast({
        title: '选择音频文件失败',
        icon: 'none'
      })
    }
  })
  // #endif

  // #ifdef APP-PLUS
  chooseAudioFromNative()
  // #endif

  // #ifdef H5
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'audio/*,.mp3,.wav,.m4a,.aac'
  input.onchange = (e) => {
    const file = e.target.files[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (event) => {
        uni.showToast({
          title: 'H5环境音频上传功能开发中',
          icon: 'none'
        })
      }
      reader.readAsDataURL(file)
    }
  }
  input.click()
  // #endif
}

function chooseAudioFromNative() {
  // #ifdef APP-PLUS
  if (typeof plus === 'undefined') {
    uni.showToast({
      title: 'APP环境未准备好',
      icon: 'none'
    })
    return
  }

  plus.io.chooseFile(
    {
      title: '选择音频文件',
      filter: ['.mp3', '.wav', '.m4a', '.aac'],
      multiple: false
    },
    (res) => {
      console.log('plus.io.chooseFile 返回结果:', res)

      if (res && res.files && res.files.length > 0) {
        const fileInfo = res.files[0]
        console.log('文件信息:', fileInfo)
        console.log('文件信息类型:', typeof fileInfo)
        console.log('文件信息键:', fileInfo && typeof fileInfo === 'object' ? Object.keys(fileInfo) : '不是对象')

        let localPath = null

        if (typeof fileInfo === 'string') {
          localPath = fileInfo
          console.log('fileInfo 是字符串路径:', localPath)
        } else if (fileInfo && typeof fileInfo === 'object') {
          localPath = fileInfo.path || fileInfo.fullPath || fileInfo.name || fileInfo.url || fileInfo.filePath

          if (!localPath) {
            for (let key in fileInfo) {
              const value = fileInfo[key]
              if (typeof value === 'string') {
                if (value.startsWith('/') || value.startsWith('file://') ||
                    value.includes('/storage/') || value.includes('/data/') ||
                    value.includes('Download') || value.includes('Music')) {
                  localPath = value
                  console.log('从属性中找到路径:', key, localPath)
                  break
                }
              }
            }
          }
        }

        if (!localPath && fileInfo) {
          const fileInfoStr = String(fileInfo)
          if (fileInfoStr && (fileInfoStr.startsWith('/') || fileInfoStr.startsWith('file://') ||
              fileInfoStr.includes('/storage/') || fileInfoStr.includes('/data/') ||
              fileInfoStr.includes('Download') || fileInfoStr.includes('Music'))) {
            localPath = fileInfoStr
            console.log('直接使用 fileInfo 字符串作为路径:', localPath)
          }
        }

        if (!localPath) {
          console.error('无法获取文件路径，文件信息:', fileInfo)
          console.error('文件信息字符串化:', JSON.stringify(fileInfo))
          uni.showToast({
            title: '获取文件路径失败',
            icon: 'none'
          })
          return
        }

        console.log('获取到的原始路径:', localPath)

        try {
          if (localPath.startsWith('/storage') || localPath.startsWith('/data')) {
            if (!localPath.startsWith('file://')) {
              localPath = 'file://' + localPath
            }
          }

          if (plus.io && plus.io.convertLocalFileSystemURL) {
            try {
              const convertedPath = plus.io.convertLocalFileSystemURL(localPath)
              if (convertedPath) {
                localPath = convertedPath
              }
            } catch (convertErr) {
              console.warn('路径转换失败，使用原始路径:', convertErr)
            }
          }

          console.log('处理后的文件路径:', localPath)

          uploadAudio(localPath)
        } catch (err) {
          console.error('处理文件路径失败:', err)
          uni.showToast({
            title: '处理文件路径失败',
            icon: 'none'
          })
        }
      } else {
        console.warn('未选择文件或文件列表为空')
        uni.showToast({
          title: '未选择文件',
          icon: 'none'
        })
      }
    },
    (err) => {
      console.error('选择音频文件失败:', err)
      if (err && err.code === -2) {
        console.log('用户取消选择文件')
        return
      }
      uni.showToast({
        title: '选择文件失败，请重试',
        icon: 'none'
      })
    }
  )
  // #endif
}

function uploadAudio(audioPath) {
  uni.showLoading({
    title: '上传中...'
  })

  const fileName = audioPath.split('/').pop()

  uni.uploadFile({
    url: 'https://bsm.aizhs.top/prod-api/file/upload',
    filePath: audioPath,
    name: 'file',
    success: (uploadRes) => {
      try {
        const uploadData = typeof uploadRes.data === 'string' ? JSON.parse(uploadRes.data) : uploadRes.data
        if (uploadData && (uploadData.code === 200 || uploadData.code === '200') && uploadData.data) {
          const fileUrl = uploadData.data.url || uploadData.data
          fileList.value.push({
            fileUrl: fileUrl,
            fileType: 'audio',
            coverUrl: ''
          })
          uni.hideLoading()
          uni.showToast({
            title: '上传成功',
            icon: 'success',
            duration: 2000
          })
          return
        }
      } catch (parseErr) {
        console.error('解析上传响应失败:', parseErr)
      }

      uploadAudioAsBase64(audioPath, fileName)
    },
    fail: (uploadErr) => {
      console.log('直接上传失败，尝试使用 base64 方式:', uploadErr)
      uploadAudioAsBase64(audioPath, fileName)
    }
  })
}

function uploadAudioAsBase64(audioPath, fileName) {
  const fileSystemManager = getFileSystemManagerCompat()
  if (!fileSystemManager) {
    uni.hideLoading()
    uni.showToast({
      title: '文件系统不可用',
      icon: 'none',
      duration: 2000
    })
    return
  }

  fileSystemManager.readFile({
    filePath: audioPath,
    encoding: 'base64',
    success: (data) => {
      const base64Str = data.data

      uploadBybase64(base64Str, fileName)
        .then((res) => {
          if (res.url) {
            fileList.value.push({
              fileUrl: res.url,
              fileType: 'audio',
              coverUrl: ''
            })
            uni.hideLoading()
            uni.showToast({
              title: '上传成功',
              icon: 'success',
              duration: 2000
            })
          } else {
            throw new Error('返回的路径无效')
          }
        })
        .catch((err) => {
          uni.hideLoading()
          uni.showToast({
            title: '上传失败',
            icon: 'none',
            duration: 2000
          })
          console.error("上传失败", err)
        })
    },
    fail: (err) => {
      uni.hideLoading()
      if (err && err.code === -2) {
        console.log('用户取消选择文件')
        return
      }

      const isAndroid10Error = err && (err.code === 15 || err.code === 10 || err.message?.includes('Android 10+') || err.message?.includes('应用运行路径') || err.message?.includes('文件复制失败'))

      if (isAndroid10Error) {
        uni.showModal({
          title: '文件访问受限',
          content: '由于 Android 10+ 系统限制，无法直接访问外部存储文件。\n\n这是系统安全限制，无法绕过。\n\n建议：\n1. 将音频文件移动到应用可访问的位置\n2. 或通过其他应用分享文件到本应用',
          showCancel: false,
          confirmText: '知道了'
        })
      } else {
        uni.showToast({
          title: err.message || '读取文件失败',
          icon: 'none',
          duration: 2000
        })
      }
      console.error("读取文件失败", err)
    }
  })
}

function uploadAudioCover(audioIndex) {
  const index = audioIndex !== undefined ? audioIndex : currentAudioIndex.value
  const audioItem = fileList.value[index]
  if (!audioItem || audioItem.fileType !== 'audio') {
    uni.showToast({
      title: '音频文件不存在',
      icon: 'none'
    })
    return
  }

  uni.showActionSheet({
    itemList: ['拍照', '相册'],
    success: (res) => {
      const sourceType = res.tapIndex === 0 ? ['camera'] : ['album']
      uni.chooseImage({
        count: 1,
        sourceType: sourceType,
        success: (chooseRes) => {
          uploadImageForAudioCover(chooseRes.tempFilePaths[0], index)
        }
      })
    }
  })
}

function uploadImageForAudioCover(imgPath, audioIndex) {
  uni.showLoading({
    title: '上传封面中...'
  })

  const fileSystemManager = getFileSystemManagerCompat()
  if (!fileSystemManager) {
    uni.hideLoading()
    uni.showToast({
      title: '文件系统不可用',
      icon: 'none',
      duration: 2000
    })
    return
  }

  fileSystemManager.readFile({
    filePath: imgPath,
    encoding: 'base64',
    success: (data) => {
      const base64Str = data.data
      const fileName = imgPath.split('/').pop()
      const { uuid } = userInfo.value

      uploadBusinessCarda(base64Str, fileName)
        .then((res) => {
          if (res.code === "200" && res.data) {
            const targetIndex = audioIndex !== undefined ? audioIndex : currentAudioIndex.value
            if (fileList.value[targetIndex]) {
              fileList.value[targetIndex].coverUrl = res.data
            }
            uni.hideLoading()
            uni.showToast({
              title: '封面上传成功',
              icon: 'success',
              duration: 2000
            })
          } else {
            throw new Error('封面上传失败')
          }
        })
        .catch((err) => {
          uni.hideLoading()
          uni.showToast({
            title: '封面上传失败',
            icon: 'none',
            duration: 2000
          })
          console.error("封面上传失败", err)
        })
    },
    fail: () => {
      uni.hideLoading()
      uni.showToast({
        title: '读取文件失败',
        icon: 'none'
      })
    }
  })
}

function uploadVideoCover(videoIndex) {
  const index = videoIndex !== undefined ? videoIndex : currentVideoIndex.value
  const videoItem = fileList.value[index]
  if (!videoItem || videoItem.fileType !== 'video') {
    uni.showToast({
      title: '视频文件不存在',
      icon: 'none'
    })
    return
  }

  uni.showActionSheet({
    itemList: ['拍照', '相册'],
    success: (res) => {
      const sourceType = res.tapIndex === 0 ? ['camera'] : ['album']
      uni.chooseImage({
        count: 1,
        sourceType: sourceType,
        success: (chooseRes) => {
          uploadImageForVideoCover(chooseRes.tempFilePaths[0], index)
        }
      })
    }
  })
}

function uploadImageForVideoCover(imgPath, videoIndex) {
  uni.showLoading({
    title: '上传封面中...'
  })

  const fileSystemManager = getFileSystemManagerCompat()
  if (!fileSystemManager) {
    uni.hideLoading()
    uni.showToast({
      title: '文件系统不可用',
      icon: 'none',
      duration: 2000
    })
    return
  }

  fileSystemManager.readFile({
    filePath: imgPath,
    encoding: 'base64',
    success: (data) => {
      const base64Str = data.data
      const fileName = imgPath.split('/').pop()
      const { uuid } = userInfo.value

      uploadBusinessCarda(base64Str, fileName)
        .then((res) => {
          if (res.code === "200" && res.data) {
            const targetIndex = videoIndex !== undefined ? videoIndex : currentVideoIndex.value
            if (fileList.value[targetIndex]) {
              fileList.value[targetIndex].coverUrl = res.data
            }
            uni.hideLoading()
            uni.showToast({
              title: '封面上传成功',
              icon: 'success',
              duration: 2000
            })
          } else {
            throw new Error('封面上传失败')
          }
        })
        .catch((err) => {
          uni.hideLoading()
          uni.showToast({
            title: '封面上传失败',
            icon: 'none',
            duration: 2000
          })
          console.error("封面上传失败", err)
        })
    },
    fail: () => {
      uni.hideLoading()
      uni.showToast({
        title: '读取文件失败',
        icon: 'none'
      })
    }
  })
}

function validateForm() {
  if (fileList.value.length === 0 && !hasText.value) {
    uni.showToast({
      title: '请上传作品文件或添加文本',
      icon: 'none'
    })
    return false
  }

  if (hasText.value && (!textContent.value || textContent.value.trim() === '')) {
    uni.showToast({
      title: '请输入文本内容',
      icon: 'none'
    })
    return false
  }

  if (!title.value || title.value.trim() === '') {
    uni.showToast({
      title: '请输入作品标题',
      icon: 'none'
    })
    return false
  }

  if (!description.value || description.value.trim() === '') {
    uni.showToast({
      title: '请输入作品简介',
      icon: 'none'
    })
    return false
  }

  if (!prompt.value || prompt.value.trim() === '') {
    uni.showToast({
      title: '请输入提示词',
      icon: 'none'
    })
    return false
  }

  return true
}

function backPage() {
  uni.navigateBack()
}

function submit() {
  if (!validateForm()) {
    return
  }

  loading.value = true

  let coverUrl = ''
  const imageFile = fileList.value.find(item => item.fileType === 'image')
  if (imageFile) {
    coverUrl = imageFile.fileUrl || imageFile.coverUrl || ''
  } else {
    const videoFile = fileList.value.find(item => item.fileType === 'video')
    if (videoFile) {
      coverUrl = videoFile.coverUrl || ''
    } else {
      const audioFile = fileList.value.find(item => item.fileType === 'audio')
      if (audioFile) {
        coverUrl = audioFile.coverUrl || ''
      }
    }
  }

  let fileUrl = ''
  if (fileList.value.length > 0) {
    fileUrl = fileList.value[0].fileUrl || ''
  }

  console.log('发布参数:', {
    contextId: "",
    title: title.value,
    coverUrl: coverUrl,
    subtitle: description.value,
    fileUrl: fileUrl,
    problem: prompt.value,
    answer: hasText.value ? textContent.value : ''
  })

  agentCreationShare(
    contextId.value || "",
    title.value,
    coverUrl,
    description.value,
    fileUrl,
    prompt.value,
    hasText.value ? textContent.value : ''
  ).then(res => {
    console.log('发布接口响应:', res)
    if (res && (res.code == 200 || res.code === 200 || res.code === '200' || res.data?.code == 200 || res.data?.code === 200)) {
      uni.showToast({
        title: '发布成功',
        icon: 'success'
      })
      setTimeout(() => {
        uni.navigateBack()
      }, 1500)
    } else {
      const errorMsg = res?.data?.msg || res?.data?.message || res?.msg || res?.message || '发布失败'
      console.error('发布失败，错误信息:', errorMsg, res)
      uni.showToast({
        title: errorMsg,
        icon: 'none',
        duration: 2000
      })
    }
  }).catch(err => {
    console.error('发布失败:', err)
    const errorMsg = err?.data?.msg || err?.data?.message || err?.msg || err?.message || err?.message || '发布失败，请重试'
    uni.showToast({
      title: errorMsg,
      icon: 'none',
      duration: 2000
    })
  }).finally(() => {
    loading.value = false
  })
}
</script>

<style lang="scss" scoped>
.publish_container {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.publish_page {
  box-sizing: border-box;
  width: 100%;
  flex: 1;
  padding: 0 18rpx;
}

.title_icon {
  display: flex;
  align-items: center;
  margin-top: 18rpx;

  .title_icon-image {
    width: 41rpx;
    height: 41rpx;
    margin-right: 13rpx;
  }

  .title_icon-text {
    font-family: AlimamaFangYuanTi !important;
    font-size: 28rpx;
    color: #000;
    font-weight: bold;
  }
}

.need_title_input {
  width: 100%;
  box-sizing: border-box;
  border: 1rpx solid #D8D8D8;
  border-radius: 8rpx;
  padding: 12rpx 12rpx 14rpx 14rpx;
  min-height: 72rpx;
}

.text_area {
  width: 100%;
  box-sizing: border-box;
  border: 1rpx solid #D8D8D8;
  border-radius: 8rpx;
  padding: 18rpx 14rpx;
  min-height: 188rpx;
}

.text_input_container {
  width: 100%;
  box-sizing: border-box;
  border: 1rpx solid #D8D8D8;
  border-radius: 8rpx;
  padding: 18rpx 14rpx;
  background: #f9f9f9;
  position: relative;
  
  .text_remove_btn {
    position: absolute;
    top: 18rpx;
    right: 18rpx;
    width: 40rpx;
    height: 40rpx;
    background: #f44;
    color: #fff;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 32rpx;
    font-weight: bold;
    z-index: 10;
    line-height: 1;
  }
}

.text_content_area {
  width: 100%;
  box-sizing: border-box;
  border: 1rpx solid #D8D8D8;
  border-radius: 8rpx;
  padding: 18rpx 14rpx;
  min-height: 200rpx;
  background: #fff;
}

.audio_cover_container {
  width: 100%;
  box-sizing: border-box;
  
  .audio_cover_upload_area {
    width: 100%;
    height: 300rpx;
    border: 1rpx solid #D8D8D8;
    border-radius: 8rpx;
    overflow: hidden;
    position: relative;
    background: #f5f5f5;
    
    .audio_cover_image {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    
    .audio_cover_placeholder {
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: #f5f5f5;
      
      .cover_upload_icon {
        width: 80rpx;
        height: 80rpx;
        margin-bottom: 16rpx;
      }
      
      .cover_upload_text {
        font-size: 28rpx;
        color: #999;
      }
    }
  }
}

.image_list {
  .image_item {
    width: 100rpx;
    height: 100rpx;
    box-sizing: border-box;
    overflow: hidden;
    margin-right: 18rpx;
    position: relative;
    border-radius: 8rpx;

    .icon_image {
      width: 100%;
      height: 100%;
    }
    
    .video_preview {
      width: 100%;
      height: 100%;
      position: relative;
      
      .video_play_icon {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        color: #fff;
        font-size: 32rpx;
        background: rgb(0 0 0 / 0.5);
        border-radius: 50%;
        width: 40rpx;
        height: 40rpx;
        display: flex;
        align-items: center;
        justify-content: center;
      }
    }
    
    .audio_preview {
      width: 100%;
      height: 100%;
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: #f5f5f5;
      overflow: hidden;
      
      .audio_label {
        font-size: 20rpx;
        color: #666;
        margin-top: 4rpx;
        z-index: 2;
      }
      
      .audio_cover_upload {
        position: absolute;
        bottom: 4rpx;
        right: 4rpx;
        width: 32rpx;
        height: 32rpx;
        background: rgb(0 0 0 / 0.6);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 3;
        
        .cover_upload_icon {
          width: 20rpx;
          height: 20rpx;
        }
      }
    }
    
    
    .file_remove {
      position: absolute;
      top: -8rpx;
      right: -8rpx;
      width: 32rpx;
      height: 32rpx;
      background: #f44;
      color: #fff;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24rpx;
      font-weight: bold;
      z-index: 10;
    }
  }
}

.sub_btn {
  width: 600rpx;
  height: 88rpx;
  border-radius: 15rpx;
  font-family: AlimamaFangYuanTi !important;
  font-size: 48rpx;
  font-weight: bold;
  color: #fff;
  text-transform: uppercase;
  border: none;
  background: #000;
  box-shadow: 0 1px 3px rgb(0 0 0 / 0.06);
  animation: bouncea 0.5s ease-in-out infinite;
  margin: 41rpx auto 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.up_bo_win {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  height: 400rpx;
  display: flex;
  flex-direction: column;
  border-radius: 20rpx 20rpx 0 0;
  background: #E4E7ED;
  z-index: 980;

  .item1 {
    background: #FFF;
    font-family: AlimamaFangYuanTi !important;
    font-size: 36rpx;
    font-weight: normal;
    letter-spacing: 0.1em;
    color: #3D3D3D;
    border-bottom: 1rpx solid #E4E7ED;
    width: 100%;
    height: 120rpx;
  }

  .item3 {
    background: #E4E7ED;
    width: 100%;
    flex: 1;
  }

  .item4 {
    width: 100%;
    height: 120rpx;
    background: #F4F4F4;
    font-family: AlimamaFangYuanTi !important;
    font-size: 36rpx;
    font-weight: normal;
    letter-spacing: 0.1em;
    color: #979797;
  }
}

.icon_icon {
  width: 42rpx;
  height: 42rpx;
  margin-right: 12rpx;
}

.m_b18 {
  margin-bottom: 18rpx;
}

.f_n {
  display: flex;
  align-items: center;
}

.flex_center {
  display: flex;
  align-items: center;
  justify-content: center;
}

.font_nomal {
  font-family: AlimamaFangYuanTi !important;
  font-size: 28rpx;
  font-weight: normal;
  color: #000;
}

.font_hold {
  font-family: AlimamaFangYuanTi !important;
  font-size: 28rpx;
  font-weight: bold !important;
  color: #000;
}

@keyframes bouncea {
  0% {
    box-shadow: none;
    transform: translate(3rpx, 3rpx);
  }

  50% {
    box-shadow: 0 1px 3px rgb(0 0 0 / 0.06);
    transform: translate(0, 0);
  }

  100% {
    box-shadow: none;
    transform: translate(3rpx, 3rpx);
  }
}
</style>
