'use strict';

const db = uniCloud.database();
const feedCollection = db.collection('feed');
const $ = db.command.aggregate;

exports.main = async (event, context) => {
	console.log('getFeedList function received params:', event);
	
	const { userId, type, page = 1, pageSize = 20 } = event;
	
	if (!userId) {
		return {
			code: -1,
			msg: '用户ID不能为空'
		};
	}
	
	try {
		let query = feedCollection.aggregate().match({
			userId
		});
		
		// 筛选类型
		if (type) {
			query = query.match({
				action: type
			});
		}
		
		// 查询总数
		const countResult = await query.count('total').end();
		const total = countResult.data[0] ? countResult.data[0].total : 0;
		
		// 分页查询
		const result = await query
			.sort({ createdAt: -1 })
			.skip((page - 1) * pageSize)
			.limit(pageSize)
			.end();
		
		// 格式化数据
		const list = result.data.map(item => {
			let content = '';
			let icon = '';
			
			// 根据不同的action类型，设置不同的描述
			switch (item.action) {
				case 'login':
					content = `登录系统 (设备: ${item.device || '未知'})`;
					icon = '🔑';
					break;
				case 'register':
					content = `注册账号 (设备: ${item.device || '未知'})`;
					icon = '📝';
					break;
				case 'vip_activated':
					content = `开通VIP会员`;
					icon = '👑';
					break;
				case 'create_order':
					content = `创建订单 (${item.productId}) 金额: ¥${item.amount}`;
					icon = '🛒';
					break;
				case 'payment_success':
					content = `支付成功 (${item.productId}) 金额: ¥${item.amount}`;
					icon = '💰';
					break;
				default:
					content = `${item.action} 操作`;
					icon = '📋';
			}
			
			return {
				id: item._id,
				time: item.createdAt,
				content,
				icon,
				rawData: item
			};
		});
		
		return {
			code: 0,
			msg: '获取成功',
			data: {
				list,
				page,
				pageSize,
				total,
				totalPage: Math.ceil(total / pageSize)
			}
		};
	} catch (error) {
		console.error('获取feed记录错误:', error);
		return {
			code: -1,
			msg: '获取记录失败'
		};
	}
}; 