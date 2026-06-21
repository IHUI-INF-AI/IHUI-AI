'use strict';

// 引入微信云开发 SDK
const cloud = require('wx-server-sdk');
const https = require('https');

// 初始化云环境
cloud.init({
	env: 'cloud1-5gszljn762dc4719'  
});

// HTTPS请求辅助函数
function httpsRequest(options) {
	return new Promise((resolve, reject) => {
		const req = https.request(options, (res) => {
			let data = '';
			
			res.on('data', (chunk) => {
				data += chunk;
			});
			
			res.on('end', () => {
				try {
					let result = data;
					// 尝试解析JSON
					try {
						result = JSON.parse(data);
					} catch (e) {
					}
					
					resolve({
						statusCode: res.statusCode,
						data: result,
						headers: res.headers
					});
				} catch (error) {
					reject(error);
				}
			});
		});
		
		req.on('error', (error) => {
			reject(error);
		});
		
		req.end();
	});
}

/**
 * Coze API 工作进程云函数
 * 用于查询任务执行状态和结果
 */
exports.main = async (event, context) => {
	// 记录请求开始时间，用于计算处理时长
	const startTime = Date.now();
	
	// 获取环境信息和用户ID
	const { OPENID, APPID, UNIONID } = cloud.getWXContext();
	const userId = event.user_id || OPENID;
	
	// 创建用户标识信息
	const userIdentity = {
		userId: userId,
		openId: OPENID,
		timestamp: Date.now()
	};
	
	// 记录用户访问信息
	
	// 检查必要参数
	if (!event.token || !event.workflowId || !event.execute_id) {
		return {
			code: 400,
			msg: '缺少必要参数',
			data: {
				userIdentity,  
				error: '缺少必要参数'
			}
		};
	}

	try {
		// 构建请求URL
		const hostname = 'api.coze.cn';
		const path = `/v1/workflows/${event.workflowId}/run_histories/${event.execute_id}`;
		
		// 构建Authorization头
		const accessToken = event.token;
		
		// 设置请求选项
		const options = {
			hostname: hostname,
			port: 443,
			path: path,
			method: 'GET',
			headers: {
				'Authorization': `Bearer ${accessToken}`,
				'Accept': 'application/json'
			}
		};
		
		// 发送请求
		const response = await httpsRequest(options);
		
		
		// 检查响应状态码
		if (response.statusCode !== 200) {
			throw new Error(`查询任务执行状态失败，HTTP状态码: ${response.statusCode}`);
		}
		
		// 解析响应数据
		let result = response.data;
		
		// 检查API响应状态
		if (result.code !== 0) {
			throw new Error(`API返回错误: ${result.msg || '未知错误'}`);
		}
		
		// 从返回的数据结构中提取任务信息
		const taskInfo = result.data && result.data.length > 0 ? result.data[0] : null;
		if (!taskInfo) {
			throw new Error('API返回数据格式异常，未找到任务信息');
		}
		
		
		let outputData = null;
		let imageUrls = [];
		
		try {
			if (taskInfo.output) {
				const parsedOutput = JSON.parse(taskInfo.output);
				
				if (parsedOutput && parsedOutput.Output && parsedOutput.Output !== "null") {
					try {
						outputData = JSON.parse(parsedOutput.Output);
						
						if (outputData && Array.isArray(outputData.picture_urls)) {
							imageUrls = outputData.picture_urls;
						}
					} catch (innerError) {
					}
				}
			}
		} catch (outputError) {
		}
		
		if (taskInfo.execute_status === 'Success' && imageUrls.length === 0) {
			try {
				if (taskInfo.result && taskInfo.result.picture_urls) {
					imageUrls = taskInfo.result.picture_urls;
				}
			} catch (e) {
			}
		}
		
		return {
			code: 0,
			msg: '查询任务执行状态成功',
			data: {
				userIdentity,  
				taskId: event.execute_id,
				status: taskInfo.execute_status,
				image_urls: imageUrls,
				debug_url: taskInfo.debug_url || null,
				error: taskInfo.error_code !== "0" ? taskInfo.error_code : null,
				createTime: taskInfo.create_time,
				updateTime: taskInfo.update_time,
				rawOutput: outputData,
				originalData: taskInfo,
				// 返回token值
				token: taskInfo.token || 0
			}
		};
	} catch (error) {
		
		return {
			code: 500,
			msg: '查询任务执行状态失败: ' + error.message,
			data: {
				userIdentity,  
				error: error.message,
				originalData: null
			}
		};
	}
};