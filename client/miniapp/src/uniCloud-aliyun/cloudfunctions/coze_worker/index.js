'use strict';

/**
 * Coze API 工作进程云函数
 * 用于查询任务执行状态和结果
 */
exports.main = async (event, context) => {
	console.log('工作进程启动，参数:', JSON.stringify(event));
	
	// 检查必要参数
	if (!event.token || !event.workflowId || !event.execute_id) {
		console.error('缺少必要参数');
		return {
			code: 400,
			msg: '缺少必要参数',
			data: null
		};
	}
	
	try {
		// 构建请求URL
		const url = `https://api.coze.cn/v1/workflows/${event.workflowId}/run_histories/${event.execute_id}`;
		console.log('请求URL:', url);
		
		// 构建Authorization头
		const accessToken = event.token;
		console.log('使用访问令牌:', accessToken.substring(0, 5) + '*****' + accessToken.substring(accessToken.length-5));
		
		// 调用 workflow_run_history 接口查询任务执行状态
		const response = await uniCloud.httpclient.request(
			url,
			{
				method: 'GET',
				headers: {
					'Authorization': `Bearer ${accessToken}`,
					'Accept': 'application/json'
				},
				timeout: 30000 // 30秒超时
			}
		);
		
		console.log('查询任务执行状态响应码:', response.status);
		console.log('查询任务执行状态响应数据类型:', typeof response.data);
		
		// 检查响应状态码
		if (response.status !== 200) {
			console.error('响应状态码错误:', response.status);
			console.error('响应数据:', response.data.toString());
			throw new Error(`查询任务执行状态失败，HTTP状态码: ${response.status}`);
		}
		
		let result;
		try {
			// 尝试解析JSON响应
			if (typeof response.data === 'string') {
				result = JSON.parse(response.data);
			} else if (Buffer.isBuffer(response.data)) {
				result = JSON.parse(response.data.toString());
			} else {
				result = response.data;
			}
			console.log('解析后的响应数据:', JSON.stringify(result));
		} catch (parseError) {
			console.error('解析响应数据失败:', parseError);
			console.error('原始响应数据:', response.data.toString());
			throw new Error('解析响应数据失败，返回的数据不是有效的JSON');
		}
		
		// 检查API响应状态
		if (result.code !== 0) {
			console.error('API返回错误:', result.code, result.msg);
			throw new Error(`API返回错误: ${result.msg || '未知错误'}`);
		}
		
		// 从返回的数据结构中提取任务信息
		const taskInfo = result.data && result.data.length > 0 ? result.data[0] : null;
		if (!taskInfo) {
			console.error('API返回数据格式异常，未找到任务信息');
			throw new Error('API返回数据格式异常，未找到任务信息');
		}
		
		console.log('任务详情:', JSON.stringify(taskInfo));
		console.log('任务状态:', taskInfo.execute_status);
		
		// 解析输出数据，如果有的话
		let outputData = null;
		let imageUrls = [];
		
		try {
			if (taskInfo.output) {
				console.log('原始输出数据:', taskInfo.output);
				// 尝试解析输出数据
				const parsedOutput = JSON.parse(taskInfo.output);
				console.log('解析后的输出数据:', JSON.stringify(parsedOutput));
				
				if (parsedOutput && parsedOutput.Output && parsedOutput.Output !== "null") {
					try {
						outputData = JSON.parse(parsedOutput.Output);
						console.log('输出数据内容:', JSON.stringify(outputData));
						
						// 检查是否包含图片URL
						if (outputData && Array.isArray(outputData.picture_urls)) {
							imageUrls = outputData.picture_urls;
							console.log('找到图片URLs:', imageUrls);
						}
					} catch (innerError) {
						console.warn('解析输出数据内容时出错:', innerError);
					}
				}
			}
		} catch (outputError) {
			console.warn('解析输出数据时出错:', outputError);
			console.warn('输出数据原文:', taskInfo.output);
		}
		
		// 如果状态是成功但没有图片URLs，尝试从其他地方查找
		if (taskInfo.execute_status === 'Success' && imageUrls.length === 0) {
			try {
				// 检查其他可能的位置
				if (taskInfo.result && taskInfo.result.picture_urls) {
					imageUrls = taskInfo.result.picture_urls;
					console.log('从result找到图片URLs:', imageUrls);
				}
			} catch (e) {
				console.warn('尝试查找备用图片URL时出错:', e);
			}
		}
		
		// 返回查询结果
		return {
			code: 0,
			msg: '查询任务执行状态成功',
			data: {
				taskId: event.execute_id,
				status: taskInfo.execute_status,
				image_urls: imageUrls,
				debug_url: taskInfo.debug_url || null,
				error: taskInfo.error_code !== "0" ? taskInfo.error_code : null,
				createTime: taskInfo.create_time,
				updateTime: taskInfo.update_time,
				rawOutput: outputData,
				originalData: taskInfo
			}
		};
	} catch (error) {
		console.error('查询任务执行状态失败:', error);
		return {
			code: 500,
			msg: error.message || '查询任务执行状态失败',
			data: null
		};
	}
};