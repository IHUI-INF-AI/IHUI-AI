'use strict';
exports.main = async (event, context) => {
	const db = uniCloud.database();
	try {
		// 从请求中获取参数
		const { user_id, product_id, quantity, total_amount } = event;
		
		// 验证必要参数
		if (!user_id || !product_id || !quantity || !total_amount) {
			return {
				code: 400,
				msg: '参数不完整'
			};
		}
		
		// 生成订单编号
		const date = new Date();
		const year = date.getFullYear();
		const month = String(date.getMonth() + 1).padStart(2, '0');
		const day = String(date.getDate()).padStart(2, '0');
		
		// 获取当前最大订单号以生成新的序列号
		const orderCountRes = await db.collection('zhs-order')
			.where({
				order_code: new RegExp(`VIP${year}${month}${day}`)
			})
			.count();
		const count = orderCountRes.total;
		const serialNum = String(count + 1).padStart(4, '0');
		
		const order_code = `VIP${year}${month}${day}${serialNum}`;
		
		// 创建当前时间
		const now = new Date().toISOString();
		
		// 构建订单数据
		const orderData = {
			user_id,
			order_code,
			product_id,
			quantity,
			total_amount,
			status: 1, // 默认状态：已下单
			payment_status: 1, // 默认支付状态：已支付
			created_at: now,
			updated_at: now
		};
		
		// 插入订单数据
		const result = await db.collection('zhs-order').add(orderData);
		
		return {
			code: 200,
			msg: '订单创建成功',
			data: {
				order_id: result.id,
				order_code
			}
		};
	} catch (error) {
		return {
			code: 500,
			msg: '创建订单失败',
			error: error.message
		}
	}
};