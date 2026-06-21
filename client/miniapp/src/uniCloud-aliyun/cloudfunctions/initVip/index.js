'use strict';

const db = uniCloud.database();
const userCollection = db.collection('user');
const orderCollection = db.collection('order');
const feedCollection = db.collection('feed');

exports.main = async (event, context) => {
	console.log('initVip function received params:', event);
	
	const { action, params } = event;
	
	switch (action) {
		case 'createOrder':
			return await createOrder(params);
		case 'confirmPayment':
			return await confirmPayment(params);
		case 'activateVip':
			return await activateVip(params);
		default:
			return {
				code: -1,
				msg: '未知操作'
			};
	}
};

// 创建订单
async function createOrder(params) {
	const { userId, productId, amount } = params;
	
	if (!userId || !productId || !amount) {
		return {
			code: -1,
			msg: '参数不完整'
		};
	}
	
	try {
		// 检查用户是否存在
		const userResult = await userCollection.doc(userId).get();
		if (!userResult.data || userResult.data.length === 0) {
			return {
				code: -1,
				msg: '用户不存在'
			};
		}
		
		// 创建订单
		const now = new Date();
		const orderNo = generateOrderNo();
		
		const orderResult = await orderCollection.add({
			orderNo,
			userId,
			productId,
			amount,
			status: 'pending', // pending, paid, cancelled
			createdAt: now,
			updatedAt: now
		});
		
		// 记录订单创建信息到feed
		await feedCollection.add({
			userId,
			action: 'create_order',
			orderNo,
			productId,
			amount,
			createdAt: now
		});
		
		// 生成支付参数 (这里只是模拟，实际应对接真实支付API)
		const payParams = {
			orderNo,
			amount,
			timeStamp: Date.now().toString(),
			nonceStr: Math.random().toString(36).substring(2),
			productId
		};
		
		return {
			code: 0,
			msg: '创建订单成功',
			data: {
				orderId: orderResult.id,
				orderNo,
				payParams
			}
		};
	} catch (error) {
		console.error('创建订单错误:', error);
		return {
			code: -1,
			msg: '创建订单失败'
		};
	}
}

// 确认支付
async function confirmPayment(params) {
	const { orderNo, paymentId } = params;
	
	if (!orderNo) {
		return {
			code: -1,
			msg: '订单号不能为空'
		};
	}
	
	try {
		// 查询订单
		const orderResult = await orderCollection.where({
			orderNo
		}).get();
		
		if (!orderResult.data || orderResult.data.length === 0) {
			return {
				code: -1,
				msg: '订单不存在'
			};
		}
		
		const order = orderResult.data[0];
		
		// 更新订单状态
		await orderCollection.doc(order._id).update({
			status: 'paid',
			paymentId,
			paidAt: new Date(),
			updatedAt: new Date()
		});
		
		// 记录支付信息到feed
		await feedCollection.add({
			userId: order.userId,
			action: 'payment_success',
			orderNo,
			productId: order.productId,
			amount: order.amount,
			createdAt: new Date()
		});
		
		// 如果是VIP会员订单，激活VIP
		if (order.productId === 'vip_membership') {
			await activateVip({
				userId: order.userId
			});
		}
		
		return {
			code: 0,
			msg: '支付成功'
		};
	} catch (error) {
		console.error('确认支付错误:', error);
		return {
			code: -1,
			msg: '确认支付失败'
		};
	}
}

// 激活VIP
async function activateVip(params) {
	const { userId } = params;
	
	if (!userId) {
		return {
			code: -1,
			msg: '用户ID不能为空'
		};
	}
	
	try {
		// 查询用户
		const userResult = await userCollection.doc(userId).get();
		
		if (!userResult.data || userResult.data.length === 0) {
			return {
				code: -1,
				msg: '用户不存在'
			};
		}
		
		// 激活VIP状态 (设置为永久VIP，无过期时间)
		await userCollection.doc(userId).update({
			isVip: true,
			vipExpireTime: null, // null表示永久，不过期
			updatedAt: new Date()
		});
		
		// 记录VIP激活信息到feed
		await feedCollection.add({
			userId,
			action: 'vip_activated',
			createdAt: new Date()
		});
		
		return {
			code: 0,
			msg: 'VIP激活成功'
		};
	} catch (error) {
		console.error('激活VIP错误:', error);
		return {
			code: -1,
			msg: '激活VIP失败'
		};
	}
}

// 生成订单号
function generateOrderNo() {
	const now = new Date();
	const year = now.getFullYear();
	const month = String(now.getMonth() + 1).padStart(2, '0');
	const day = String(now.getDate()).padStart(2, '0');
	const hour = String(now.getHours()).padStart(2, '0');
	const minute = String(now.getMinutes()).padStart(2, '0');
	const second = String(now.getSeconds()).padStart(2, '0');
	const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
	
	return `${year}${month}${day}${hour}${minute}${second}${random}`;
} 