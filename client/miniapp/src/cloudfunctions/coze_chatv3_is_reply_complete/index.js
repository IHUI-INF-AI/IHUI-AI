'use strict';

/**
 * 检查会话状态的云函数
 * 根据chat_id和conversation_id查询对话是否完成
 */
exports.main = async (event, context) => {

    // 参数校验
    const requiredParams = ['token', 'conversation_id', 'chat_id'];
    const missingParams = requiredParams.filter(param => !event[param] || (typeof event[param] === 'string' && !event[param].trim()));
    if (missingParams.length > 0) {
        return { 
            code: 400, 
            msg: `缺少必要参数或参数为空: ${missingParams.join(', ')}`,
            data: null 
        };
    }

    try {
        // 构造API请求
        const apiUrl = `https://api.coze.cn/v3/chat/retrieve?${new URLSearchParams({
            conversation_id: event.conversation_id,
            chat_id: event.chat_id
        })}`;


        // 使用axios发送请求
        const axios = require('axios');
        const response = await axios({
            method: 'GET',
            url: apiUrl,
            headers: {
                'Authorization': `Bearer ${event.token}`,
                'Content-Type': 'application/json'
            }
        });


        // 处理HTTP错误
        if (response.status !== 200) {
            throw new Error(`API请求失败: ${response.status}`);
        }

        const result = response.data;
        
        // 处理业务错误
        if (result.code !== 0) {
            return {
                code: result.code || 500,
                msg: `业务错误: ${result.msg}`,
                data: null
            };
        }

        // 构造标准化响应
        const chatData = result.data;
        const responseData = {
            status: chatData.status,
            is_completed: ['completed', 'failed', 'canceled'].includes(chatData.status),
            usage: chatData.usage,
            last_error: chatData.last_error,
            completed_at: chatData.completed_at,
            token: {
                input_count: chatData.usage?.input_count || 0,
                output_count: chatData.usage?.output_count || 0,
                token_count: chatData.usage?.token_count || 0
            }
        };

        
        return {
            code: 0,
            msg: '查询成功',
            data: responseData
        };

    } catch (error) {
        return {
            code: 500,
            msg: error.message.includes('API') ? error.message : `服务端错误: ${error.message}`,
            data: null
        };
    }
};