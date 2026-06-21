'use strict';

const db = uniCloud.database();
const crypto = require('crypto');

// 检查数据库连接
async function checkDatabaseConnection() {
	try {
		await db.collection('chat_history').limit(1).get();
		return true;
	} catch (error) {
		console.error('数据库连接检查失败:', error);
		return false;
	}
}

exports.main = async (event, context) => {
	console.log('AI云函数收到请求:', event);
	
	const { action, params } = event;
	
	// 检查数据库连接
	const isConnected = await checkDatabaseConnection();
	if (!isConnected) {
		return {
			code: -1,
			msg: '数据库连接失败'
		};
	}
	
	switch (action) {
		case 'sendMessage':
			return await handleSendMessage(params);
		case 'getHistory':
			return await handleGetHistory(params);
		case 'clearHistory':
			return await handleClearHistory(params);
		case 'cozeChat':
			return await cozeChat(params);
		case 'proxyRequest':
			return await proxyRequest(params);
		case 'proxyCozeRequest':
			return await proxyCozeRequest(params);
		case 'callDeepSeekAPI':
			return await callDeepSeekAPI(params);
		default:
			return {
				code: -1,
				msg: '未知的操作类型'
			};
	}
};

// 处理发送消息
async function handleSendMessage(params) {
	try {
		const { message, userId } = params;
		
		if (!message || !userId) {
			return {
				code: -1,
				msg: '参数不完整'
			};
		}
		
		// 保存用户消息到历史记录
		await db.collection('chat_history').add({
			userId,
			role: 'user',
			content: message,
			timestamp: new Date()
		});
		
		// 检查用户VIP状态
		// const vipCheck = await checkVIPStatus(openid);
		// if (!vipCheck.isVIP) {
		// 	return {
		// 		code: 1,
		// 		msg: '请先开通VIP会员'
		// 	};
		// }
		
		// 生成AI回复
		const response = await generateAIResponse(message);
		
		// 保存AI回复到历史记录
		await db.collection('chat_history').add({
			userId,
			role: 'assistant',
			content: response,
			timestamp: new Date()
		});
		
		return {
			code: 0,
			msg: '发送成功',
			data: {
				reply: response
			}
		};
	} catch (error) {
		console.error('发送消息失败:', error);
		return {
			code: -1,
			msg: '发送失败，请重试'
		};
	}
}

// 处理获取历史记录
async function handleGetHistory(params) {
	try {
		const { userId } = params;
		
		if (!userId) {
			return {
				code: -1,
				msg: '用户ID不能为空'
			};
		}
		
		// 获取用户的历史记录
		const result = await db.collection('chat_history')
			.where({
				userId: userId
			})
			.orderBy('timestamp', 'asc')
			.get();
		
		return {
			code: 0,
			msg: '获取成功',
			data: {
				messages: result.data
			}
		};
	} catch (error) {
		console.error('获取历史记录失败:', error);
		return {
			code: -1,
			msg: '获取失败，请重试'
		};
	}
}

// 处理清空历史记录
async function handleClearHistory(params) {
	try {
		const { userId } = params;
		
		if (!userId) {
			return {
				code: -1,
				msg: '用户ID不能为空'
			};
		}
		
		// 删除用户的所有历史记录
		await db.collection('chat_history')
			.where({
				userId: userId
			})
			.remove();
		
		return {
			code: 0,
			msg: '清空成功'
		};
	} catch (error) {
		console.error('清空历史记录失败:', error);
		return {
			code: -1,
			msg: '清空失败，请重试'
		};
	}
}

// 生成AI回复
async function generateAIResponse(message) {
	try {
		// 构建提示词
		const prompt = `你是一个专业的文案创作助手。请根据用户的需求生成高质量的营销文案。
用户需求：${message}

请按照以下格式生成文案：
1. 标题：吸引人的标题
2. 正文：详细的内容描述
3. 亮点：突出产品或服务的核心优势
4. 行动号召：引导用户采取行动

要求：
- 语言简洁有力
- 突出产品卖点
- 符合目标受众特点
- 具有感染力和说服力`;

		// 调用DeepSeek API
		const response = await uniCloud.httpclient.request('https://api.deepseek.com/v1/chat/completions', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`
			},
			data: {
				model: 'deepseek-chat',
				messages: [
					{
						role: 'system',
						content: '你是一个专业的文案创作助手，擅长生成各种营销文案。'
					},
					{
						role: 'user',
						content: prompt
					}
				],
				temperature: 0.7,
				max_tokens: 2000
			},
			dataType: 'json'
		});

		if (response.status === 200) {
			return response.data.choices[0].message.content;
		} else {
			throw new Error('AI服务调用失败');
		}
	} catch (error) {
		console.error('生成AI回复失败:', error);
		throw error;
	}
}

// 处理Coze API请求
async function cozeChat(params) {
	try {
		console.log('cozeChat函数收到参数:', JSON.stringify(params));
		
		if (!params || !params.content || !params.botId) {
			return {
				code: -1,
				msg: '参数不完整',
				data: null
			};
		}
		
		// 从环境变量或配置中获取TOKEN
		// 请替换为您自己的API密钥
		const COZE_API_TOKEN = process.env.COZE_API_TOKEN || 'pat_FHX5bLHixKT241Z6wKJJ2QpxiY3dDkBcj2xzWOZ0P8Egc6IDn7I9ANCVLWjdco42';
		
		// 请替换为您的工作流ID
		const WORKFLOW_ID = '7489740932666245159';
		
		// 确保用户ID只包含ASCII字符
		const safeUserId = (params.userId || '').replace(/[^\x00-\x7F]/g, '') || '123456';
		
		// 准备工作流请求数据
		const requestData = {
			workflow_id: WORKFLOW_ID,
			user_id: safeUserId,
			variables: {
				user_query: params.content
			}
		};
		
		// 如果有会话ID和Section ID，添加到请求中以维持上下文
		if (params.sessionId) {
			requestData.session_id = params.sessionId;
		}
		if (params.sectionId) {
			requestData.section_id = params.sectionId;
		}
		
		console.log('准备向Coze工作流API发送请求:', JSON.stringify(requestData));
		
		try {
			// 发送请求到工作流API
			const response = await uniCloud.httpclient.request('https://www.coze.cn/open_api/workflow/run', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${COZE_API_TOKEN}`,
					'Accept': 'application/json',
					'User-Agent': 'AIHuizheApp/1.0.0'
				},
				data: JSON.stringify(requestData),
				contentType: 'json',
				dataType: 'json',
				timeout: 60000 // 60秒超时
			});
			
			console.log('Coze工作流API响应状态码:', response.status);
			console.log('Coze工作流API响应数据类型:', typeof response.data);
			
			if (response.status === 200) {
				// 检查数据是否是HTML
				if (typeof response.data === 'string' && response.data.includes('<!doctype html>')) {
					console.error('收到HTML响应而非JSON数据');
					
					// 尝试提取错误信息
					let errorMessage = 'API返回HTML而非JSON，需要更新Token';
					try {
						const htmlSnippet = response.data.substring(0, 200);
						console.log('HTML响应片段:', htmlSnippet);
					} catch (e) {
						console.error('提取HTML片段失败:', e);
					}
					
					return {
						code: -1,
						msg: errorMessage,
						data: null
					};
				}
				
				if (response.data) {
					console.log('成功获取Coze工作流API回复');
					
					// 工作流API返回格式转换为聊天API格式，以保持前端兼容性
					const workflowResponse = response.data;
					
					// 构造与chat API类似的返回格式
					const chatFormatResponse = {
						message: {
							content: workflowResponse.result
						},
						session_id: workflowResponse.session_id || params.sessionId || `session_${Date.now()}`,
						section_id: workflowResponse.section_id || params.sectionId || `section_${Date.now()}`
					};
					
					return {
						code: 0,
						msg: '成功',
						data: chatFormatResponse
					};
				}
			}
			
			// 处理其他状态码
			let statusMessage = '未知错误';
			
			switch(response.status) {
				case 400:
					statusMessage = '请求参数错误';
					break;
				case 401:
					statusMessage = 'Token已过期或无效';
					break;
				case 403:
					statusMessage = '无权访问该工作流';
					break;
				case 404:
					statusMessage = '未找到指定工作流';
					break;
				case 429:
					statusMessage = '请求过于频繁';
					break;
				case 500:
					statusMessage = '服务器内部错误';
					break;
				default:
					statusMessage = `HTTP状态 ${response.status}`;
			}
			
			console.error('Coze工作流API响应错误:', response.status, statusMessage);
			return {
				code: response.status || -1,
				msg: `Coze工作流API响应异常: ${statusMessage}`,
				data: null
			};
		} catch (requestError) {
			console.error('Coze工作流API请求失败:', requestError);
			
			// 提供更详细的错误信息
			let errorMsg = '请求发送失败';
			if (requestError.code) {
				errorMsg += ` (错误代码: ${requestError.code})`;
			}
			if (requestError.message) {
				errorMsg += `: ${requestError.message}`;
			}
			
			return {
				code: 500,
				msg: errorMsg,
				data: null
			};
		}
	} catch (error) {
		console.error('Coze工作流API处理失败:', error);
		return {
			code: 500,
			msg: error.message || '云函数处理失败',
			data: null
		};
	}
}

// 代理请求，用于绕过小程序的跨域限制
async function proxyRequest(params) {
	try {
		if (!params || !params.url) {
			return {
				code: -1,
				msg: '缺少必要参数',
				data: null
			};
		}
		
		console.log('proxyRequest收到参数:', JSON.stringify(params));
		
		// 如果包含app_id等字段但没有sign，帮助生成签名
		if (params.data && params.data.app_id && !params.data.sign && params.appSecret) {
			params.data.sign = calculateMD5Signature(params.data, params.appSecret);
			// 删除appSecret防止泄露
			delete params.appSecret;
		}
		
		// 设置默认方法为GET
		const method = params.method || 'GET';
		// 设置默认超时时间为30秒
		const timeout = params.timeout || 30000;
		// 请求头
		const headers = params.headers || {};
		// 请求数据
		const data = params.data || null;
		
		console.log(`准备发送${method}请求到${params.url}`);
		
		// 发送请求
		const response = await uniCloud.httpclient.request(params.url, {
			method: method,
			headers: headers,
			data: typeof data === 'object' ? JSON.stringify(data) : data,
			contentType: 'json',
			dataType: 'json',
			timeout: timeout
		});
		
		console.log('请求响应状态码:', response.status);
		
		// 如果返回的是字符串且包含HTML标签，按原样返回
		if (typeof response.data === 'string' && response.data.includes('<!doctype html>')) {
			console.log('收到HTML响应');
			return {
				code: response.status === 200 ? 1 : response.status,
				msg: '接收到HTML而非JSON数据',
				data: response.data
			};
		}
		
		// 返回处理结果
		return {
			code: 0,
			msg: '成功',
			data: response.data
		};
	} catch (error) {
		console.error('代理请求失败:', error);
		return {
			code: -1,
			msg: error.message || '代理请求失败',
			data: null
		};
	}
}

// 计算MD5签名
function calculateMD5Signature(params, appSecret) {
	try {
		const crypto = require('crypto');
		
		// 1. 按字典顺序排序参数
		const sortedKeys = Object.keys(params).sort();
		
		// 2. 拼接成key=value格式，用&连接
		let stringToSign = '';
		for (const key of sortedKeys) {
			// 跳过sign字段
			if (key === 'sign') continue;
			
			// 将复杂对象序列化为JSON字符串
			let value = params[key];
			if (typeof value === 'object') {
				value = JSON.stringify(value);
			}
			
			if (stringToSign.length > 0) {
				stringToSign += '&';
			}
			stringToSign += `${key}=${value}`;
		}
		
		// 3. 拼接上app_secret
		stringToSign += appSecret;
		
		console.log('待签名字符串:', stringToSign);
		
		// 4. 计算MD5
		const md5Hash = crypto.createHash('md5').update(stringToSign).digest('hex');
		console.log('生成的MD5签名:', md5Hash);
		
		return md5Hash;
	} catch (error) {
		console.error('MD5签名计算失败:', error);
		// 如果失败，返回一个固定字符串作为替代
		return 'md5_signature_error';
	}
}

// 添加代理Coze请求的函数
async function proxyCozeRequest(params) {
	console.log('代理Coze请求: ', params);
	
	try {
		// 检查必要参数
		if (!params.token) {
			return {
				error: {
					message: '缺少必要参数: token'
				}
			};
		}
		
		if (!params.requestData || !params.requestData.bot_id) {
			return {
				error: {
					message: '缺少必要参数: requestData.bot_id'
				}
			};
		}
		
		// 准备请求参数
		const requestData = params.requestData;
		
		// 发起HTTP请求到Coze API
		const response = await uniCloud.httpclient.request('https://www.coze.cn/open_api/bot/chat', {
			method: 'POST',
			data: requestData,
			headers: {
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${params.token}`,
				'Accept': 'application/json'
			},
			dataType: 'json',
			timeout: 60000 // 60秒超时
		});
		
		console.log('Coze API响应状态: ', response.status);
		
		// 如果返回的不是JSON，可能是HTML错误页面
		if (response.status !== 200 || !response.data) {
			// 检查响应类型
			if (typeof response.data === 'string' && response.data.includes('<!doctype html>')) {
				console.error('收到HTML响应而非JSON数据');
				
				// 创建一个模拟响应
				return {
					data: {
						message: {
							content: `抱歉，AI智能助手暂时无法连接到服务器。请稍后再试。`
						},
						session_id: `proxy_session_${Date.now()}`,
						section_id: `proxy_section_${Date.now()}`
					}
				};
			}
			
			return {
				error: {
					message: '服务器返回错误',
					status: response.status,
					data: response.data
				}
			};
		}
		
		// 返回响应数据
		return {
			data: response.data
		};
	} catch (error) {
		console.error('代理Coze请求出错: ', error);
		
		return {
			error: {
				message: error.message || '请求处理失败'
			}
		};
	}
}

// 调用DeepSeek API
async function callDeepSeekAPI(params) {
	try {
		console.log('调用DeepSeek API，参数:', JSON.stringify(params));
		
		if (!params || !params.messages || params.messages.length === 0) {
			return {
				code: -1,
				msg: '消息参数不能为空'
			};
		}
		
		// 从环境变量获取API密钥（禁止硬编码）
	const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
	if (!DEEPSEEK_API_KEY) {
		return { code: -1, msg: 'DEEPSEEK_API_KEY 环境变量未配置' };
	}
		
		// 设置请求参数
		const apiParams = {
			model: params.model || 'deepseek-chat',
			messages: params.messages,
			temperature: params.temperature !== undefined ? params.temperature : 0.7,
			max_tokens: params.max_tokens || 2000
		};
		
		console.log('准备请求DeepSeek API，请求数据:', JSON.stringify(apiParams));
		
		// 发送请求到DeepSeek API
		const response = await uniCloud.httpclient.request('https://api.deepseek.com/v1/chat/completions', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
			},
			data: apiParams,
			dataType: 'json',
			timeout: 60000 // 60秒超时
		});
		
		console.log('DeepSeek API响应状态码:', response.status);
		
		if (response.status === 200 && response.data) {
			// 成功响应
			console.log('DeepSeek API响应:', response.data);
			
			// 提取内容
			const content = response.data.choices && 
				response.data.choices.length > 0 && 
				response.data.choices[0].message ? 
				response.data.choices[0].message.content : '';
			
			return {
				code: 0,
				msg: '成功',
				data: {
					content: content,
					raw: response.data
				}
			};
		} else {
			// 处理错误响应
			console.error('DeepSeek API错误:', response.status, response.data);
			
			return {
				code: response.status,
				msg: response.data && response.data.error ? 
					`API错误: ${response.data.error.message || '未知错误'}` : 
					`请求失败 (${response.status})`,
				data: response.data
			};
		}
	} catch (error) {
		console.error('调用DeepSeek API失败:', error);
		
		return {
			code: -9,
			msg: '云函数执行错误: ' + (error.message || JSON.stringify(error)),
			data: null
		};
	}
} 