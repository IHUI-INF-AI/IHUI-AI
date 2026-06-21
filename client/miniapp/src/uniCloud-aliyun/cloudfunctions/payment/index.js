'use strict';

// 从环境变量获取微信支付配置（禁止硬编码）
const appid = process.env.WX_PAY_APPID;
const mchid = process.env.WX_PAY_MCHID;
const apiKey = process.env.WX_PAY_API_KEY;
if (!appid || !mchid || !apiKey) {
	throw new Error('WX_PAY_APPID / WX_PAY_MCHID / WX_PAY_API_KEY 环境变量未配置');
}

// 引入工具函数
const crypto = require('crypto');

// 获取当前时间戳(秒)
function getTimestamp() {
	return Math.floor(Date.now() / 1000);
}

// 生成随机字符串
function getNonceStr(length = 32) {
	const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	let result = '';
	for (let i = 0; i < length; i++) {
		result += chars.charAt(Math.floor(Math.random() * chars.length));
	}
	return result;
}

// 生成签名
function generateSign(data, key) {
	// 对参数按照key=value的格式，并按照参数名ASCII字典序排序
	const sortedKeys = Object.keys(data).sort();
	let stringA = '';
	sortedKeys.forEach(key => {
		if (data[key] !== '' && data[key] !== undefined && data[key] !== null && key !== 'sign') {
			stringA += `${key}=${data[key]}&`;
		}
	});
	stringA += `key=${key}`;
	
	// MD5签名
	const sign = crypto.createHash('md5').update(stringA).digest('hex').toUpperCase();
	return sign;
}

// 生成订单号
function generateOrderNo() {
	const timestamp = Date.now().toString();
	const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
	return 'ZHS' + timestamp + random;
}

// 模拟数据库操作
let orderCollection = null;
let userCollection = null;

// 初始化数据库连接
function initDB() {
	if (!orderCollection || !userCollection) {
		const db = uniCloud.database();
		orderCollection = db.collection('zhs-orders');
		userCollection = db.collection('user');  // 使用user表
	}
}

// 创建订单
async function createOrder(data) {
	initDB();
	const { productId, payMethod, openid } = data;
	
	// 确保所有参数都有值
	if (!productId || !payMethod || !openid) {
		throw new Error('创建订单失败：参数不完整，请确保productId、payMethod和openid都有值');
	}
	
	// 使用openid获取用户信息
	const userResult = await userCollection.where({ openid: openid }).get();
	if (!userResult.data || userResult.data.length === 0) {
		throw new Error('用户不存在');
	}
	const user = userResult.data[0];
	
	// 商品列表
	const products = {
		'vip': {
			id: 'vip',
			name: 'AI智汇社 VIP会员',
			price: 588,
			original_price: 1288,
			duration: -1 // -1表示永久
		}
	};
	
	// 检查商品是否存在
	if (!products[productId]) {
		throw new Error('商品不存在');
	}
	
	// 商品信息
	const product = products[productId];
	
	// 订单号
	const orderNo = generateOrderNo();
	
	// 订单创建时间
	const createTime = new Date();
	
	// 计算支付金额（实际项目中可能需要考虑优惠券等）
	const totalAmount = product.price;
	
	// 创建订单记录
	const orderData = {
		order_no: orderNo,
		user_id: user._id,
		openid: openid,
		product_id: productId,
		product_name: product.name,
		product_duration: product.duration,
		total_amount: totalAmount,
		status: 'unpaid', // 未支付
		pay_method: payMethod,
		created_at: createTime,
		updated_at: createTime
	};
	
	// 保存订单到数据库
	await orderCollection.add(orderData);
	
	// 在实际项目中，这里应该调用微信支付接口获取预支付信息
	// 以下为模拟的支付参数
	const timeStamp = getTimestamp().toString();
	const nonceStr = getNonceStr();
	
	// 模拟微信支付参数 (实际项目中需要真实调用微信支付接口)
	const payParams = {
		appId: appid,
		timeStamp: timeStamp,
		nonceStr: nonceStr,
		package: 'prepay_id=wx' + timeStamp,
		signType: 'MD5',
		paySign: 'SIMULATED_PAY_SIGN' // 实际项目中需要真实签名
	};
	
	// 模拟本地测试环境支付成功
	// 注意：在实际项目中，不应该直接在前端模拟支付成功，这里仅为了演示
	if (process.env.NODE_ENV === 'development' || process.env.UNI_PLATFORM === 'mp-weixin-dev') {
		// 模拟5秒后更新订单状态为已支付
		setTimeout(async () => {
			try {
				await orderCollection.where({ order_no: orderNo }).update({
					status: 'paid',
					paid_at: new Date(),
					updated_at: new Date()
				});
				
				// 更新用户为永久VIP
				await userCollection.doc(user._id).update({
					is_VIP: 1,
					vip_expire_time: null, // 永久VIP不设置过期时间
					is_permanent_VIP: true, // 标记为永久VIP
					updated_at: new Date()
				});
				
				console.log('模拟支付成功，订单号:', orderNo);
			} catch (error) {
				console.error('模拟支付更新失败:', error);
			}
		}, 5000);
	}
	
	return {
		order_no: orderNo,
		product_name: product.name,
		total_amount: totalAmount,
		payParams: payParams
	};
}

// 检查订单状态
async function checkOrderStatus(data) {
	initDB();
	const { openid } = data;
	
	// 确保openid有值
	if (!openid) {
		throw new Error('查询订单失败：openid不能为空');
	}
	
	// 查询用户最近的订单
	const orderResult = await orderCollection.where({
		openid: openid
	}).orderBy('created_at', 'desc').limit(1).get();
	
	if (!orderResult.data || orderResult.data.length === 0) {
		return {
			isPaid: false,
			message: '未找到订单'
		};
	}
	
	const order = orderResult.data[0];
	
	return {
		order_no: order.order_no,
		isPaid: order.status === 'paid',
		status: order.status,
		product_name: order.product_name,
		total_amount: order.total_amount,
		created_at: order.created_at
	};
}

// 检查用户VIP状态
async function checkVIPStatus(data) {
	initDB();
	const { openid } = data;
	
	// 确保openid有值
	if (!openid) {
		throw new Error('查询VIP状态失败：openid不能为空');
	}
	
	// 根据openid查询用户
	const userResult = await userCollection.where({ openid: openid }).get();
	
	if (!userResult.data || userResult.data.length === 0) {
		return {
			isVIP: false,
			message: '用户不存在'
		};
	}
	
	const user = userResult.data[0];
	
	// 检查是否是VIP
	const isVIP = user.is_VIP === 1;
	
	// 检查是否是永久VIP
	const isPermanentVIP = user.is_permanent_VIP === true;
	
	// 如果是永久VIP，直接返回true
	if (isVIP && isPermanentVIP) {
		return {
			isVIP: true,
			isPermanentVIP: true,
			userId: user._id
		};
	}
	
	// 如果是普通VIP，检查是否过期
	let isExpired = false;
	if (isVIP && !isPermanentVIP && user.vip_expire_time) {
		const now = new Date();
		const expireTime = new Date(user.vip_expire_time);
		isExpired = now > expireTime;
	}
	
	return {
		isVIP: isVIP && !isExpired,
		isPermanentVIP: isPermanentVIP,
		vipExpireTime: user.vip_expire_time,
		userId: user._id
	};
}

// 云函数入口
exports.main = async (event, context) => {
	try {
		const { action, params } = event;
		
		// 确保操作和参数存在
		if (!action) {
			return {
				code: 1,
				message: '缺少操作类型'
			};
		}
		
		if (!params) {
			return {
				code: 1,
				message: '缺少参数'
			};
		}
		
		let result = null;
		
		// 根据操作类型分发处理
		switch (action) {
			case 'createOrder':
				result = await createOrder(params);
				break;
			case 'checkOrderStatus':
				result = await checkOrderStatus(params);
				break;
			case 'checkVIPStatus':
				result = await checkVIPStatus(params);
				break;
			default:
				return {
					code: 1,
					message: `未知操作: ${action}`
				};
		}
		
		return {
			code: 0,
			message: '操作成功',
			data: result
		};
	} catch (error) {
		console.error('支付操作失败:', error);
		return {
			code: 1,
			message: error.message || '操作失败'
		};
	}
}; 