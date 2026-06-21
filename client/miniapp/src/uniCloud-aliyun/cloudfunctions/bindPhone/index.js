'use strict';

// 设置云数据库对象
let db;
try {
	db = uniCloud.database();
	console.log('数据库初始化成功');
} catch (dbError) {
	console.error('数据库初始化失败:', dbError);
}

// 确保数据库对象可用
function getDB() {
	if (!db) {
		console.log('重新初始化数据库连接');
		try {
			db = uniCloud.database();
		} catch (err) {
			console.error('重新初始化数据库失败:', err);
			throw new Error('无法连接数据库');
		}
	}
	return db;
}

// 微信解密手机号
async function decryptWxPhoneNumber(params) {
	try {
		const { code, encryptedData, iv } = params;
		
		if (!code || !encryptedData || !iv) {
			return {
				code: -1,
				msg: '参数不完整'
			};
		}
		
		console.log('开始解密手机号');
		
		// 获取session_key
		const appid = process.env.WX_APPID || 'wxfca5c875c72fe3c4';
		const secret = process.env.WX_SECRET || '16a65f9771f51ad61df16025ad9d023e';
		
		const url = `https://api.weixin.qq.com/sns/jscode2session?appid=${appid}&secret=${secret}&js_code=${code}&grant_type=authorization_code`;
		
		const res = await uniCloud.httpclient.request(url, {
			method: 'GET',
			dataType: 'json',
			timeout: 10000
		});
		
		if (!res.data || !res.data.session_key) {
			console.error('获取session_key失败:', res.data);
			return {
				code: -1,
				msg: '获取微信session_key失败'
			};
		}
		
		const sessionKey = res.data.session_key;
		
		// 使用微信提供的解密方法
		const crypto = require('crypto');
		
		// 对称解密使用的算法
		const algorithm = 'aes-128-cbc';
		// 对Base64编码的sessionKey进行解码
		const sessionKeyBuffer = Buffer.from(sessionKey, 'base64');
		// 对Base64编码的iv进行解码
		const ivBuffer = Buffer.from(iv, 'base64');
		// 对Base64编码的encryptedData进行解码
		const encryptedDataBuffer = Buffer.from(encryptedData, 'base64');
		
		// 创建解密器实例
		const decipher = crypto.createDecipheriv(algorithm, sessionKeyBuffer, ivBuffer);
		// 禁用自动填充模式
		decipher.setAutoPadding(true);
		
		// 解密
		let decrypted = decipher.update(encryptedDataBuffer, 'binary', 'utf8');
		decrypted += decipher.final('utf8');
		
		const phoneInfo = JSON.parse(decrypted);
		
		if (!phoneInfo.phoneNumber) {
			return {
				code: -1,
				msg: '解密手机号失败'
			};
		}
		
		console.log('解密获取的手机号:', phoneInfo.phoneNumber);
		
		return {
			code: 0,
			msg: '解密成功',
			data: {
				phone: phoneInfo.phoneNumber,
				countryCode: phoneInfo.countryCode || '',
				purePhoneNumber: phoneInfo.purePhoneNumber || phoneInfo.phoneNumber
			}
		};
	} catch (error) {
		console.error('解密手机号出错:', error);
		return {
			code: -1,
			msg: '解密手机号出错: ' + (error.message || error)
		};
	}
}

// 生成6位数字验证码
function generateVerificationCode() {
	return Math.floor(100000 + Math.random() * 900000).toString();
}

// 检查验证码请求频率
async function checkVerificationFrequency(userId) {
	try {
		const db = getDB();
		const userCollection = db.collection('user');
		
		const user = await userCollection.doc(userId).get();
		if (!user.data || user.data.length === 0) {
			return {
				canRequest: false,
				msg: '用户不存在'
			};
		}
		
		const userData = user.data[0];
		const now = new Date();
		const lastRequest = userData.last_verification_request;
		
		// 如果上次请求时间存在且在60秒内，则拒绝请求
		if (lastRequest && (now.getTime() - new Date(lastRequest).getTime() < 60000)) {
			return {
				canRequest: false,
				msg: '请求过于频繁，请稍后再试',
				remainingSeconds: Math.ceil((60000 - (now.getTime() - new Date(lastRequest).getTime())) / 1000)
			};
		}
		
		return {
			canRequest: true
		};
	} catch (error) {
		console.error('检查验证码频率出错:', error);
		// 出错时默认允许请求，避免阻塞用户
		return {
			canRequest: true
		};
	}
}

// 请求验证码
async function requestVerificationCode(params) {
	try {
		const { userId, phone } = params;
		
		if (!userId || !phone) {
			return {
				code: -1,
				msg: '参数不完整'
			};
		}
		
		console.log('请求验证码, userId:', userId, 'phone:', phone);
		
		// 检查手机号格式
		if (!/^1\d{10}$/.test(phone)) {
			return {
				code: -1,
				msg: '手机号格式不正确'
			};
		}
		
		// 检查该手机号是否已被其他用户绑定
		const db = getDB();
		const phoneExist = await db.collection('user').where({
			phone: phone,
			_id: { $ne: userId } // 排除当前用户
		}).get();
		
		if (phoneExist.data && phoneExist.data.length > 0) {
			return {
				code: -1,
				msg: '该手机号已被其他账号绑定'
			};
		}
		
		// 检查请求频率
		const frequencyCheck = await checkVerificationFrequency(userId);
		if (!frequencyCheck.canRequest) {
			return {
				code: -1,
				msg: frequencyCheck.msg,
				data: {
					remainingSeconds: frequencyCheck.remainingSeconds
				}
			};
		}
		
		// 生成验证码
		const verificationCode = generateVerificationCode();
		console.log('生成的验证码:', verificationCode);
		
		// 设置验证码有效期为5分钟
		const now = new Date();
		const expireTime = new Date(now.getTime() + 5 * 60 * 1000);
		
		// 更新用户表中的验证码信息
		await db.collection('user').doc(userId).update({
			phone: phone, // 先保存手机号，但未验证
			verification_code: verificationCode,
			verification_code_expired_at: expireTime,
			last_verification_request: now,
			phone_verified: false,
			updatedAt: now
		});
		
		// TODO: 实际项目中应该调用短信服务商API发送验证码短信
		// 这里仅模拟
		console.log('向手机号', phone, '发送验证码:', verificationCode);
		
		// 返回脱敏手机号
		const maskedPhone = phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2');
		
		return {
			code: 0,
			msg: '验证码已发送',
			data: {
				maskedPhone,
				expireMinutes: 5
			}
		};
	} catch (error) {
		console.error('请求验证码出错:', error);
		return {
			code: -1,
			msg: '请求验证码出错: ' + (error.message || error)
		};
	}
}

// 验证手机号
async function verifyPhone(params) {
	try {
		const { userId, phone, code } = params;
		
		if (!userId || !phone || !code) {
			return {
				code: -1,
				msg: '参数不完整'
			};
		}
		
		console.log('验证手机号, userId:', userId, 'phone:', phone, 'code:', code);
		
		const db = getDB();
		const userResult = await db.collection('user').doc(userId).get();
		
		if (!userResult.data || userResult.data.length === 0) {
			return {
				code: -1,
				msg: '用户不存在'
			};
		}
		
		const user = userResult.data[0];
		
		// 验证手机号是否匹配
		if (user.phone !== phone) {
			return {
				code: -1,
				msg: '手机号与请求验证的号码不匹配'
			};
		}
		
		// 检查验证码是否正确
		if (user.verification_code !== code) {
			return {
				code: -1,
				msg: '验证码错误'
			};
		}
		
		// 检查验证码是否过期
		const now = new Date();
		if (!user.verification_code_expired_at || now > new Date(user.verification_code_expired_at)) {
			return {
				code: -1,
				msg: '验证码已过期，请重新获取'
			};
		}
		
		// 验证通过，更新用户手机号状态
		await db.collection('user').doc(userId).update({
			phone_verified: true,
			updatedAt: now
		});
		
		// 返回脱敏手机号
		const maskedPhone = phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2');
		
		return {
			code: 0,
			msg: '手机号验证成功',
			data: {
				phone: maskedPhone,
				verified: true
			}
		};
	} catch (error) {
		console.error('验证手机号出错:', error);
		return {
			code: -1,
			msg: '验证手机号出错: ' + (error.message || error)
		};
	}
}

// 生成VIP会员卡号
function generateVipCardNumber() {
	const prefix = 'VIP';
	const timestamp = Date.now().toString().slice(-8);
	const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
	return `${prefix}${timestamp}${random}`;
}

// 创建会员
async function createMembership(params) {
	try {
		const { userId, vipLevel, months } = params;
		
		if (!userId || !vipLevel || !months) {
			return {
				code: -1,
				msg: '参数不完整'
			};
		}
		
		console.log('创建会员, userId:', userId, 'vipLevel:', vipLevel, 'months:', months);
		
		const db = getDB();
		const userResult = await db.collection('user').doc(userId).get();
		
		if (!userResult.data || userResult.data.length === 0) {
			return {
				code: -1,
				msg: '用户不存在'
			};
		}
		
		const user = userResult.data[0];
		
		// 检查手机号是否已验证
		if (!user.phone_verified) {
			return {
				code: -1,
				msg: '请先验证手机号'
			};
		}
		
		const now = new Date();
		let expireDate;
		
		// 计算到期日期
		if (user.isVip && user.vipExpireTime && new Date(user.vipExpireTime) > now) {
			// 已是会员，在原到期日基础上增加
			expireDate = new Date(user.vipExpireTime);
		} else {
			// 不是会员或已过期，从当前日期开始计算
			expireDate = new Date();
		}
		
		// 增加月份
		expireDate.setMonth(expireDate.getMonth() + parseInt(months));
		
		// 生成会员卡号
		const vipCardNumber = user.vipCardNumber || generateVipCardNumber();
		
		// 更新用户会员信息
		await db.collection('user').doc(userId).update({
			isVip: true,
			vipLevel: parseInt(vipLevel),
			vipExpireTime: expireDate,
			vipCardNumber: vipCardNumber,
			updatedAt: now
		});
		
		// 格式化日期为YYYY-MM-DD
		const formatDate = (date) => {
			const year = date.getFullYear();
			const month = (date.getMonth() + 1).toString().padStart(2, '0');
			const day = date.getDate().toString().padStart(2, '0');
			return `${year}-${month}-${day}`;
		};
		
		return {
			code: 0,
			msg: '会员创建成功',
			data: {
				vipLevel: parseInt(vipLevel),
				vipCardNumber: vipCardNumber,
				expireDate: formatDate(expireDate),
				isVip: true
			}
		};
	} catch (error) {
		console.error('创建会员出错:', error);
		return {
			code: -1,
			msg: '创建会员出错: ' + (error.message || error)
		};
	}
}

// 获取会员信息
async function getMemberInfo(params) {
	try {
		const { userId } = params;
		
		if (!userId) {
			return {
				code: -1,
				msg: '参数不完整'
			};
		}
		
		console.log('获取会员信息, userId:', userId);
		
		const db = getDB();
		const userResult = await db.collection('user').doc(userId).get();
		
		if (!userResult.data || userResult.data.length === 0) {
			return {
				code: -1,
				msg: '用户不存在'
			};
		}
		
		const user = userResult.data[0];
		const now = new Date();
		
		// 检查会员是否过期
		const isExpired = user.vipExpireTime && new Date(user.vipExpireTime) < now;
		
		// 如果会员已过期，更新状态
		if (user.isVip && isExpired) {
			await db.collection('user').doc(userId).update({
				isVip: false,
				updatedAt: now
			});
			user.isVip = false;
		}
		
		// 格式化日期为YYYY-MM-DD
		const formatDate = (date) => {
			if (!date) return null;
			date = new Date(date);
			const year = date.getFullYear();
			const month = (date.getMonth() + 1).toString().padStart(2, '0');
			const day = date.getDate().toString().padStart(2, '0');
			return `${year}-${month}-${day}`;
		};
		
		// 处理手机号脱敏
		const maskedPhone = user.phone ? user.phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2') : null;
		
		return {
			code: 0,
			msg: '获取会员信息成功',
			data: {
				isVip: user.isVip || false,
				vipLevel: user.vipLevel || 0,
				vipCardNumber: user.vipCardNumber || null,
				expireDate: formatDate(user.vipExpireTime),
				phone: maskedPhone,
				phoneVerified: user.phone_verified || false
			}
		};
	} catch (error) {
		console.error('获取会员信息出错:', error);
		return {
			code: -1,
			msg: '获取会员信息出错: ' + (error.message || error)
		};
	}
}

// 云函数入口
module.exports = {
	main: async function(event, context) {
		console.log('bindPhone function received params:', JSON.stringify(event));
		
		const { action, params } = event;
		
		if (!action || !params) {
			return {
				code: -1,
				msg: '缺少必要参数'
			};
		}
		
		switch (action) {
			case 'decryptPhone':
				return await decryptWxPhoneNumber(params);
			case 'requestCode':
				return await requestVerificationCode(params);
			case 'verifyPhone':
				return await verifyPhone(params);
			case 'createMembership':
				return await createMembership(params);
			case 'getMemberInfo':
				return await getMemberInfo(params);
			default:
				return {
					code: -1,
					msg: '未知操作'
				};
		}
	}
}; 