'use strict';

// 引入微信云开发 SDK
const cloud = require('wx-server-sdk');
const https = require('https');

// 初始化云环境
cloud.init({
	env: 'cloud1-5gszljn762dc4719' // 直接使用环境ID
});

// HTTPS请求辅助函数
function httpsRequest(options, postData) {
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
		
		if (postData) {
			req.write(postData);
		}
		
		req.end();
	});
}

/**
 * Coze API 请求云函数
 * 用于发送异步任务请求
 */
exports.main = async (event, context) => {
	
	// 检查必要参数
	if (!event.token || !event.workflowId) {
		return {
			code: 400,
			msg: '缺少必要参数: token或workflowId',
			data: null
		};
	}
	
	// 确保parameters存在
	if (!event.parameters) {
		return {
			code: 400,
			msg: '缺少必要参数: parameters',
			data: null
		};
	}
	
	// 获取prompt，支持多种格式
	let inputPrompt = '';
	if (typeof event.parameters === 'string') {
		inputPrompt = event.parameters;
	} else if (event.parameters.prompt) {
		inputPrompt = event.parameters.prompt;
	} else if (event.parameters.input) {
		inputPrompt = event.parameters.input;
	} else {
		// 如果无法获取输入，使用parameters作为输入
		inputPrompt = JSON.stringify(event.parameters);
	}
	
	try {
		// 构建请求URL
		const hostname = 'api.coze.cn';
		const path = '/v1/workflow/run';
		
		const postData = JSON.stringify({
			workflow_id: event.workflowId,
			parameters: {
				input: inputPrompt
			},
			is_async: true
		});
		
		
		// 设置请求选项
		const options = {
			hostname: hostname,
			port: 443,
			path: path,
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Content-Length': Buffer.byteLength(postData),
				'Authorization': `Bearer ${event.token}`
			}
		};
		
		// 发送请求
		const response = await httpsRequest(options, postData);
		
		
		if (response.statusCode !== 200) {
			throw new Error(`请求失败: ${response.statusCode} ${JSON.stringify(response.data)}`);
		}
		
		// 解析响应数据
		const result = response.data;
		
		// 检查响应状态
		if (result.code !== 0) {
			throw new Error(`API返回错误: ${result.code} - ${result.msg || '未知错误'}`);
		}
		
		// 获取执行ID
		const executeId = result.execute_id;
		if (!executeId) {
			throw new Error('未获取到执行ID');
		}
		
		// 返回结果
		return {
			code: 0,
			msg: '请求成功',
			data: {
				execute_id: executeId,
				debugUrl: result.debug_url || null
			}
		};
		
	} catch (error) {
		// 返回更详细的错误信息
		return {
			code: 500,
			msg: `请求执行错误: ${error.message || '未知错误'}`,
			data: null
		};
	}
};
