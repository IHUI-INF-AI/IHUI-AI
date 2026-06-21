'use strict';

const crypto = require('crypto');
const https = require('https');

// 腾讯云API密钥
const secretId = 'AKIDseJn5JLCqIWWHqCJEwQnzxhtsc7NRL4a';
const secretKey = 'PaXFi181g9OOAi182iCSUL3c0CC4hCTX';

// 混元API配置
const host = 'hunyuan.tencentcloudapi.com';
const service = 'hunyuan';
const region = 'ap-guangzhou';
const action = 'SubmitHunyuanImageJob';
const version = '2023-09-01';

// 生成签名
function getSignature(params, timestamp) {
    const date = new Date(timestamp * 1000);
    const dateStr = date.toISOString().split('T')[0];
    
    // 1. 生成规范请求串
    const canonicalHeaders = [
        'content-type:application/json',
        'host:' + host
    ].join('\n') + '\n';
    
    const canonicalRequest = [
        'POST',
        '/',
        '',
        canonicalHeaders,
        'content-type;host',
        crypto.createHash('sha256').update(JSON.stringify(params)).digest('hex')
    ].join('\n');
    
    // 2. 生成待签名字符串
    const credentialScope = dateStr + '/' + service + '/tc3_request';
    const stringToSign = [
        'TC3-HMAC-SHA256',
        timestamp.toString(),
        credentialScope,
        crypto.createHash('sha256').update(canonicalRequest).digest('hex')
    ].join('\n');
    
    // 3. 计算签名
    const secretDate = crypto.createHmac('sha256', 'TC3' + secretKey)
        .update(dateStr)
        .digest();
    const secretService = crypto.createHmac('sha256', secretDate)
        .update(service)
        .digest();
    const secretSigning = crypto.createHmac('sha256', secretService)
        .update('tc3_request')
        .digest();
    const signature = crypto.createHmac('sha256', secretSigning)
        .update(stringToSign)
        .digest('hex');
    
    return {
        signature,
        credentialScope
    };
}

// 发送请求
function sendRequest(params) {
    return new Promise((resolve, reject) => {
        const timestamp = Math.floor(Date.now() / 1000);
        const { signature, credentialScope } = getSignature(params, timestamp);
        
        const options = {
            hostname: host,
            path: '/',
            method: 'POST',
            headers: {
                'Host': host,
                'Content-Type': 'application/json',
                'X-TC-Action': action,
                'X-TC-Region': region,
                'X-TC-Timestamp': timestamp.toString(),
                'X-TC-Version': version,
                'Authorization': `TC3-HMAC-SHA256 Credential=${secretId}/${credentialScope}, SignedHeaders=content-type;host, Signature=${signature}`
            }
        };
        
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                try {
                    const response = JSON.parse(data);
                    resolve(response);
                } catch (error) {
                    reject(error);
                }
            });
        });
        
        req.on('error', (error) => {
            reject(error);
        });
        
        req.write(JSON.stringify(params));
        req.end();
    });
}

exports.main = async (event, context) => {
    try {
        // 验证参数
        if (!event.Prompt) {
            return {
                Error: {
                    Code: 'InvalidParameter',
                    Message: '缺少必要参数：Prompt'
                }
            };
        }
        
        // 构建请求参数
        const params = {
            Prompt: event.Prompt
        };
        
        // 发送请求
        const response = await sendRequest(params);
        
        // 记录日志
        console.log('混元API响应：', response);
        
        return response;
        
    } catch (error) {
        console.error('混元API调用错误：', error);
        return {
            Error: {
                Code: 'InternalError',
                Message: error.message || '调用混元API失败'
            }
        };
    }
}; 