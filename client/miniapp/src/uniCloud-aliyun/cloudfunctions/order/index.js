'use strict';

const db = uniCloud.database()
const dbCmd = db.command
const $ = dbCmd.aggregate

exports.main = async (event, context) => {
	const { action, params = {} } = event
	
	// 获取当前用户ID
	const { USERID, OPENID } = context
	// 允许未登录的情况下调用createOrder方法
	if (!USERID && action !== 'createOrder') {
		return {
			code: 401,
			msg: '未登录'
		}
	}
	
	// 根据action执行不同的操作
	switch (action) {
		case 'create':
			return await createOrder(USERID, params)
		case 'getList':
			return await getOrderList(USERID, params)
		case 'getDetail':
			return await getOrderDetail(USERID, params)
		case 'cancel':
			return await cancelOrder(USERID, params)
		case 'handlePayment':
			return await handlePayment(params)
		case 'createOrder':
			return await createVipOrder(params.orderData)
		default:
			return {
				code: 403,
				msg: '未知操作'
			}
	}
}

// 创建订单
async function createOrder(userId, { productId, productName, amount }) {
	if (!productId || !productName || !amount) {
		return {
			code: 400,
			msg: '参数不完整'
		}
	}
	
	try {
		const orderNo = generateOrderNo()
		const orderData = {
			orderNo,
			userId,
			productId,
			productName,
			amount,
			status: 'pending',
			createdAt: new Date(),
			updatedAt: new Date()
		}
		
		const res = await db.collection('order').add(orderData)
		
		return {
			code: 0,
			msg: '创建订单成功',
			data: {
				orderId: res.id,
				orderNo
			}
		}
	} catch (e) {
		console.error('创建订单失败:', e)
		return {
			code: 500,
			msg: '创建订单失败'
		}
	}
}

// 获取订单列表
async function getOrderList(userId, { status, page = 1, pageSize = 10 }) {
	const query = {
		userId
	}
	if (status) {
		query.status = status
	}
	
	try {
		const countResult = await db.collection('order').where(query).count()
		const total = countResult.total
		
		const list = await db.collection('order')
			.where(query)
			.orderBy('createdAt', 'desc')
			.skip((page - 1) * pageSize)
			.limit(pageSize)
			.get()
		
		return {
			code: 0,
			msg: '获取成功',
			data: {
				list: list.data,
				pagination: {
					page,
					pageSize,
					total
				}
			}
		}
	} catch (e) {
		console.error('获取订单列表失败:', e)
		return {
			code: 500,
			msg: '获取订单列表失败'
		}
	}
}

// 获取订单详情
async function getOrderDetail(userId, { orderId }) {
	if (!orderId) {
		return {
			code: 400,
			msg: '参数不完整'
		}
	}
	
	try {
		const order = await db.collection('order')
			.where({
				_id: orderId,
				userId
			})
			.limit(1)
			.get()
		
		if (!order.data.length) {
			return {
				code: 404,
				msg: '订单不存在'
			}
		}
		
		return {
			code: 0,
			msg: '获取成功',
			data: order.data[0]
		}
	} catch (e) {
		console.error('获取订单详情失败:', e)
		return {
			code: 500,
			msg: '获取订单详情失败'
		}
	}
}

// 取消订单
async function cancelOrder(userId, { orderId, reason }) {
	if (!orderId) {
		return {
			code: 400,
			msg: '参数不完整'
		}
	}
	
	try {
		const order = await db.collection('order')
			.where({
				_id: orderId,
				userId,
				status: 'pending'
			})
			.limit(1)
			.get()
		
		if (!order.data.length) {
			return {
				code: 404,
				msg: '订单不存在或已完成/取消'
			}
		}
		
		await db.collection('order').doc(orderId).update({
			status: 'cancelled',
			cancelReason: reason || '用户取消',
			cancelledAt: new Date(),
			updatedAt: new Date()
		})
		
		return {
			code: 0,
			msg: '取消成功'
		}
	} catch (e) {
		console.error('取消订单失败:', e)
		return {
			code: 500,
			msg: '取消订单失败'
		}
	}
}

// 处理支付回调
async function handlePayment({ orderNo, paymentMethod, paymentId }) {
	if (!orderNo || !paymentMethod || !paymentId) {
		return {
			code: 400,
			msg: '参数不完整'
		}
	}
	
	const transaction = await db.startTransaction()
	try {
		const order = await transaction.collection('order')
			.where({
				orderNo,
				status: 'pending'
			})
			.limit(1)
			.get()
		
		if (!order.data.length) {
			await transaction.rollback()
			return {
				code: 404,
				msg: '订单不存在或已完成/取消'
			}
		}
		
		// 更新订单状态
		await transaction.collection('order').doc(order.data[0]._id).update({
			status: 'paid',
			paymentMethod,
			paymentId,
			paidAt: new Date(),
			updatedAt: new Date()
		})
		
		// 如果是VIP订单，更新用户VIP状态
		if (order.data[0].productId === 'vip_membership') {
			await transaction.collection('user').doc(order.data[0].userId).update({
				isVip: true,
				vipExpireTime: null, // 永久会员
				updatedAt: new Date()
			})
		}
		
		await transaction.commit()
		
		return {
			code: 0,
			msg: '支付成功'
		}
	} catch (e) {
		await transaction.rollback()
		console.error('处理支付失败:', e)
		return {
			code: 500,
			msg: '处理支付失败'
		}
	}
}

// 创建VIP订单（支付成功后调用，直接记录已支付状态）
async function createVipOrder(orderData) {
	if (!orderData) {
		return {
			code: 400,
			msg: '订单数据不能为空'
		}
	}
	
	try {
		// 确保orderNo存在
		if (!orderData.orderNo) {
			orderData.orderNo = generateOrderNo();
		}
		
		// 添加必要字段
		orderData.status = 'paid'; // 直接设为已支付
		orderData.paidAt = new Date(); // 支付时间
		orderData.createdAt = new Date(); // 创建时间
		orderData.updatedAt = new Date(); // 更新时间
		
		// 将订单记录存入云数据库
		const res = await db.collection('order').add(orderData);
		
		console.log('VIP订单创建成功:', res.id);
		
		// 更新用户VIP状态
		try {
			await db.collection('user').where({
				_id: orderData.userId
			}).update({
				isVip: true,
				vipExpireTime: orderData.expireTime,
				updatedAt: new Date()
			});
			
			console.log('用户VIP状态已更新', orderData.userId);
		} catch (userUpdateError) {
			console.error('更新用户VIP状态失败:', userUpdateError);
			// 不阻止主流程，仍然返回订单创建成功
		}
		
		return {
			code: 0,
			msg: '订单创建成功',
			data: {
				orderId: res.id,
				orderNo: orderData.orderNo
			}
		}
	} catch (e) {
		console.error('创建VIP订单失败:', e);
		return {
			code: 500,
			msg: '创建VIP订单失败',
			error: e.message
		}
	}
}

// 生成订单号
function generateOrderNo() {
	const date = new Date()
	const year = date.getFullYear()
	const month = String(date.getMonth() + 1).padStart(2, '0')
	const day = String(date.getDate()).padStart(2, '0')
	const random = Math.floor(Math.random() * 1000000).toString().padStart(6, '0')
	return `${year}${month}${day}${random}`
} 