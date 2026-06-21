import request from '@/utils/service/index.js'

export function getGroupList (data) {
  return request({
    url: `/course/list`,
    header: {
      'COURSE-PLATFORM': 'system_wechat'
    },
    method: 'GET',
    data,
    base: 1
  })
}

// 根据子赛道id获取主赛道
export function parentquery (ids) {
  return request({
    url: `/categoryDictionary/get/parent?ids=${ids}`,
    header: {
      'COURSE-PLATFORM': 'system_wechat'
    },
    method: 'GET',
    base: 1
  })
}

// 查询 集合详情，暂时用不到
export function getGroupDetail (id) {
  return request({
    url: `/course/${id}`,
    header: {
      'COURSE-PLATFORM': 'system_wechat'
    },
    method: 'GET',
    base: 1
  })
}

// 查询 视频详情
export function getVideoDetail (id) {
  return request({
    url: `/courseVideo/${id}`,
    header: {
      'COURSE-PLATFORM': 'system_wechat'
    },
    method: 'GET',
    base: 1
  })
}

// 查询 合集详情
export function getCourseDetail (id) {
  return request({
    url: `/course/${id}`,
    header: {
      'COURSE-PLATFORM': 'system_wechat'
    },
    method: 'GET',
    base: 1
  })
}

// 点赞、收藏、分享
export function userVideoLogOperate (videoId, type) {
  return request({
    url: `/userVideoLog/operate/${videoId}/${type}`,
    header: {
      'COURSE-PLATFORM': 'system_wechat'
    },
    method: 'GET',
    base: 1
  })
}

// 取消点赞、收藏
export function userVideoLog (ids) {
  return request({
    url: `/userVideoLog/${ids}`,
    header: {
      'COURSE-PLATFORM': 'system_wechat'
    },
    method: 'DELETE',
    base: 1
  })
}

// 查询 评论列表
export function getUserVideoCommentList (data) {
  return request({
    url: `/userVideoComment/list`,
    header: {
      'COURSE-PLATFORM': 'system_wechat'
    },
    data,
    method: 'GET',
    base: 1
  })
}

// 新增评论
export function userVideoComment (data) {
  return request({
    url: `/userVideoComment`,
    header: {
      'content-type': 'application/json',
      'COURSE-PLATFORM': 'system_wechat'
    },
    method: 'POST',
    data,
    base: 1
  })
}

// 获取智能体列表
export function getAgentsAlllist (data) {
  return request({
    url: `/cozeZhsApi/agents/Alllist`,
    method: 'GET',
    data,
    base: 3
  })
}

export function getVideoList (data) {
  return request({
    url: `/courseVideo/list`,
    header: {
      'COURSE-PLATFORM': 'system_wechat'
    },
    method: 'GET',
    data,
    base: 1
  })
}

// 发布合集
export function addGroup (data) {
  return request({
    url: `/course`,
    header: {
      'content-type': 'application/json',
      'COURSE-PLATFORM': 'system_wechat'
    },
    method: 'POST',
    data,
    base: 1
  })
}

// 修改合集
export function coursePut (data) {
  return request({
    url: `/course`,
    header: {
      'content-type': 'application/json',
      'COURSE-PLATFORM': 'system_wechat'
    },
    data,
    method: 'PUT',
    base: 1
  })
}

// 删除合集
export function courseDelete (ids) {
  return request({
    url: `/course/${ids}`,
    header: {
      'COURSE-PLATFORM': 'system_wechat'
    },
    method: 'DELETE',
    base: 1
  })
}

// 添加视频
export function addVideo (data) {
  return request({
    url: `/courseVideo`,
    header: {
      'content-type': 'application/json',
      'COURSE-PLATFORM': 'system_wechat'
    },
    method: 'POST',
    data,
    base: 1
  })
}

// 修改视频
export function videoPut (data) {
  return request({
    url: `/courseVideo`,
    header: {
      'content-type': 'application/json',
      'COURSE-PLATFORM': 'system_wechat'
    },
    method: 'PUT',
    data,
    base: 1
  })
}

// 删除视频
export function videoDelete (ids) {
  return request({
    url: `/courseVideo/${ids}`,
    header: {
      'COURSE-PLATFORM': 'system_wechat'
    },
    method: 'DELETE',
    base: 1
  })
}

// 分片上传
export function uploadChunkedFile (param, length) {
  return request({
    url: `/file/uploadChunkedFile`,
    header: {
      // "Content-Type": "multipart/form-data",
      'Content-Type': 'application/octet-stream',
      'Content-Length': length,
      fileName: param.fileName,
      chunkNumber: param.chunkNumber,
      totalChunks: param.totalChunks,
      fileMD5: param.fileMD5,
      fileType: param.fileType
    },
    method: 'POST',
    data: param.file,
    base: 4
  })
}

// 分片上传 pc
export function uploadChunkedFilePC (param) {
  const boundary =
    '----WebKitFormBoundary' + Math.random().toString(36).substr(2, 10)

  return request({
    url: `/file/uploadChunkedFile/pc`,
    header: {
      // 手动指定 multipart 格式，包含边界符
      'Content-Type': `multipart/form-data; boundary=${boundary}`
    },
    method: 'POST',
    data: param,
    base: 4
  })
}

// 获取分片视频完整地址
export function uploadChunkedFileJoint (data) {
  return request({
    url: `/file/uploadChunkedFile/joint`,
    header: {
      'content-type': 'application/json',
      'COURSE-PLATFORM': 'system_wechat'
    },
    method: 'POST',
    data,
    base: 4
  })
}

// 视频预加载
export function videoPreload (data) {
  return request({
    url: `/general/api/video/preload`,
    header: {
      'content-type': 'application/json',
      'COURSE-PLATFORM': 'system_wechat'
    },
    method: 'POST',
    data,
    base: 4
  })
}

// 上架
export function issue (ids) {
  return request({
    url: `/courseVideo/issue/${ids}`,
    header: {
      'content-type': 'application/json',
      'COURSE-PLATFORM': 'system_wechat'
    },
    method: 'POST',
    base: 1
  })
}

// 下架
export function delist (ids) {
  return request({
    url: `/course/delist/${ids}`,
    header: {
      'content-type': 'application/json',
      'COURSE-PLATFORM': 'system_wechat'
    },
    method: 'POST',
    base: 1
  })
}

// 反馈
export function userFeedback (data) {
  return request({
    url: `/userFeedback`,
    header: {
      'content-type': 'application/json'
    },
    data,
    method: 'POST',
    base: 1
  })
}

// 反馈
export function userFeedbackList (data) {
  return request({
    url: `/userFeedback/list`,
    data,
    method: 'GET',
    base: 1
  })
}
