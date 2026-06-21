// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({
  env: 'cloud1-5gszljn762dc4719'
})

// 云函数入口函数
exports.main = async (event, context) => {
  
  return {
    code: 0,
    msg: 'pong',
    data: {
      timestamp: Date.now(),
      env: 'cloud1-5gszljn762dc4719'
    }
  }
} 