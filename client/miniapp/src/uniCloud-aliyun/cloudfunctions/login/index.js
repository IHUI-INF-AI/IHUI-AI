'use strict';

const crypto = require('crypto');
const db = uniCloud.database();

// 检查数据库连接
async function checkDatabaseConnection() {
	try {
		// 尝试获取一条记录来测试连接
		console.log('检查数据库连接 zhs-users');
		await db.collection('zhs-users').limit(1).get();
		console.log('数据库连接成功');
		return true;
	} catch (error) {
		console.error('数据库连接失败:', error);
		return false;
	}
}

// 生成邀请码
function generateInviteCode() {
	return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// 生成token
function generateToken(userId) {
	const timestamp = Date.now();
	const random = Math.random().toString(36).substring(2);
	const data = `${userId}-${timestamp}-${random}`;
	const hash = crypto.createHash('sha256').update(data).digest('hex');
	return `${hash}.${timestamp}.${random}`;
}

// 解析token
function parseToken(token) {
	try {
		const [hash, timestamp, random] = token.split('.');
		if (!hash || !timestamp || !random) {
			return null;
		}
		return {
			hash,
			timestamp: parseInt(timestamp),
			random
		};
	} catch (error) {
		console.error('解析token失败:', error);
		return null;
	}
}

// 处理微信登录
async function handleWxLogin(event) {
	try {
		const { code, device } = event.params;
		console.log('微信登录参数:', { code, device });
		
		if (!code) {
			return {
				code: 1,
				msg: '缺少code参数'
			};
		}

		// 从环境变量获取微信小程序配置（禁止硬编码）
	const appid = process.env.WX_MINIAPP_APPID;
	const secret = process.env.WX_MINIAPP_SECRET;
	if (!appid || !secret) {
		return { code: 1, msg: 'WX_MINIAPP_APPID 或 WX_MINIAPP_SECRET 环境变量未配置' };
	}

	console.log('开始请求微信接口，参数:', {
		appid,
		js_code: code,
		grant_type: 'authorization_code'
	});
		
		const wxLoginResult = await uniCloud.httpclient.request(
			'https://api.weixin.qq.com/sns/jscode2session',
			{
				method: 'GET',
				data: {
					appid,
					secret,
					js_code: code,
					grant_type: 'authorization_code'
				},
				dataType: 'json'
			}
		);
		
		console.log('微信接口返回结果:', wxLoginResult);

		if (!wxLoginResult.data) {
			console.error('微信接口返回数据为空');
			return {
				code: 2,
				msg: '获取微信用户信息失败: 接口返回数据为空'
			};
		}
		
		if (wxLoginResult.data.errcode) {
			console.error('微信接口返回错误:', wxLoginResult.data);
			return {
				code: 2,
				msg: `获取微信用户信息失败: ${wxLoginResult.data.errmsg || '未知错误'}`
			};
		}

		if (!wxLoginResult.data.openid) {
			console.error('微信接口返回数据中没有openid:', wxLoginResult.data);
			return {
				code: 2,
				msg: '获取微信用户信息失败: 未获取到openid'
			};
		}

		const { openid } = wxLoginResult.data;
		console.log('成功获取openid:', openid);
		
		// 查询用户是否已存在
		const userCollection = db.collection('zhs-users');
		let user = await userCollection.where({
			openid: openid
		}).get();
		
		console.log('查询用户结果:', user);

		if (user.data && user.data.length > 0) {
			// 用户已存在，更新登录时间
			user = user.data[0];
			console.log('用户已存在，更新登录时间:', user._id);
			await userCollection.doc(user._id).update({
				updated_at: new Date()
			});
		} else {
			// 用户不存在，创建新用户
			console.log('用户不存在，创建新用户');
			const newUser = {
				openid: openid,
				nickname: `用户${Math.floor(Math.random() * 10000)}`,
				avatar: '',
				invite_code: generateInviteCode(),
				parent_id: '',
				balance: 0,
				total_earnings: 0,
				created_at: new Date(),
				updated_at: new Date(),
				is_VIP: 0,
				identity_typy: 0
			};
			
			console.log('准备创建新用户:', newUser);
			const result = await userCollection.add(newUser);
			console.log('新用户创建结果:', result);
			
			user = {
				_id: result.id,
				...newUser
			};
		}

		// 生成token
		const token = generateToken(user._id);
		console.log('生成token成功');

		return {
			code: 0,
			msg: '登录成功',
			data: {
				token,
				userInfo: {
					_id: user._id,
					nickname: user.nickname,
					avatar: user.avatar,
					is_VIP: user.is_VIP,
					identity_typy: user.identity_typy,
					balance: user.balance,
					total_earnings: user.total_earnings,
					invite_code: user.invite_code
				}
			}
		};
	} catch (error) {
		console.error('微信登录失败，详细错误:', error);
		return {
			code: 3,
			msg: '登录失败: ' + (error.message || '未知错误')
		};
	}
}

// 处理更新用户信息
async function handleUpdateProfile(event) {
	try {
		console.log('更新用户信息参数:', event.params);
		
		const { userId, nickname, avatar } = event.params;
		
		if (!userId) {
			console.error('缺少用户ID');
			return {
				code: 1,
				msg: '缺少用户ID'
			};
		}
		
		// 检查用户是否存在
		const user = await db.collection('zhs-users').doc(userId).get();
		console.log('查询用户结果:', user);
		
		if (!user.data || user.data.length === 0) {
			console.error('用户不存在');
			return {
				code: 3,
				msg: '用户不存在'
			};
		}
		
		// 更新用户信息
		const updateData = {
			updated_at: new Date()
		};
		
		if (nickname !== undefined && nickname !== null) {
			updateData.nickname = nickname;
		}
		
		if (avatar !== undefined && avatar !== null) {
			updateData.avatar = avatar;
		}
		
		console.log('更新用户表zhs-users，ID:', userId, '数据:', updateData);
		
		const result = await db.collection('zhs-users').doc(userId).update(updateData);
		
		console.log('更新结果:', result);
		
		if (result.updated === 1) {
			// 获取更新后的用户信息
			const updatedUser = await db.collection('zhs-users').doc(userId).get();
			console.log('更新后的用户信息:', updatedUser.data[0]);
			
			return {
				code: 0,
				msg: '更新成功',
				data: {
					userInfo: {
						_id: updatedUser.data[0]._id,
						nickname: updatedUser.data[0].nickname,
						avatar: updatedUser.data[0].avatar,
						is_VIP: updatedUser.data[0].is_VIP,
						identity_typy: updatedUser.data[0].identity_typy,
						balance: updatedUser.data[0].balance,
						total_earnings: updatedUser.data[0].total_earnings,
						invite_code: updatedUser.data[0].invite_code,
						phone: updatedUser.data[0].phone || ''
					}
				}
			};
		} else {
			console.error('更新失败，影响行数为0');
			return {
				code: 2,
				msg: '更新失败'
			};
		}
	} catch (error) {
		console.error('更新用户信息失败:', error);
		return {
			code: -1,
			msg: '更新用户信息失败: ' + error.message
		};
	}
}

// 处理ping请求
async function handlePing() {
	try {
		const isConnected = await checkDatabaseConnection();
		return {
			code: isConnected ? 0 : 1,
			msg: isConnected ? '连接成功' : '连接失败'
		};
	} catch (error) {
		console.error('Ping失败:', error);
		return {
			code: 1,
			msg: '连接失败: ' + (error.message || '未知错误')
		};
	}
}

// 主函数
exports.main = async (event, context) => {
	console.log('云函数收到的参数:', event);
	
	// 检查数据库连接
	const isConnected = await checkDatabaseConnection();
	if (!isConnected) {
		return {
			code: 1,
			msg: '数据库连接失败'
		};
	}
	
	// 根据action处理不同的请求
	const { action, params = {} } = event;
	
	switch (action) {
		case 'wxLogin':
			return await handleWxLogin(event);
		case 'updateProfile':
			return await handleUpdateProfile(event);
		case 'ping':
			return await handlePing();
		default:
			return {
				code: 1,
				msg: '未知的action: ' + action
			};
	}
}; 