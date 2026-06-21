'use strict';

/**
 * Coze API 请求云函数
 * 用于发送异步任务请求
 */
exports.main = async (event, context) => {
	console.log('请求云函数启动，参数:', JSON.stringify(event));
	
	// 检查必要参数
	if (!event.token || !event.workflowId || !event.parameters) {
		console.error('缺少必要参数');
		return {
			code: 400,
			msg: '缺少必要参数',
			data: null
		};
	}
	
	try {
		// 构建请求URL
		const url = 'https://api.coze.cn/v1/workflow/run';
		console.log('请求URL:', url);
		
		// 发送异步任务请求
		const response = await uniCloud.httpclient.request(
			url,
			{
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${event.token}`
				},
				data: {
					workflow_id: event.workflowId,
					parameters: {
						input: event.parameters.prompt
					},
					is_async: true
				}
			}
		);
		
		console.log('请求响应码:', response.status);
		console.log('请求响应数据:', response.data);
		
		if (response.status !== 200) {
			throw new Error(`请求失败: ${response.status} ${response.data}`);
		}
		
		// 解析响应数据
		let result;
		try {
			result = JSON.parse(response.data.toString());
			console.log('成功解析响应数据:', JSON.stringify(result));
		} catch (error) {
			console.error('解析响应数据失败:', error);
			throw new Error('解析响应数据失败');
		}
		
		// 检查响应状态
		if (result.code !== 0) {
			throw new Error(`API返回错误: ${result.msg}`);
		}
		
		// 获取执行ID
		const executeId = result.execute_id;
		if (!executeId) {
			console.error('响应数据:', JSON.stringify(result));
			throw new Error('未获取到执行ID');
		}
		
		// 返回结果
		return {
			code: 0,
			msg: '请求成功',
			data: {
				execute_id: executeId,
				debugUrl: result.debug_url
			}
		};
		
	} catch (error) {
		console.error('请求执行错误:', error);
		return {
			code: 500,
			msg: error.message || '请求执行错误',
			data: null
		};
	}
};
