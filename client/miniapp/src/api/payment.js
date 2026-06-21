import request from '@/utils/request'

// 创建订单
export function createOrder(data) {
	return request({
		url: '/api/order/create',
		method: 'post',
		data
	})
}

// 查询订单状态
export function queryOrderStatus(orderId) {
	return request({
		url: '/api/order/status',
		method: 'get',
		params: { orderId }
	})
}

// 更新会员状态
export function updateMemberStatus(data) {
	return request({
		url: '/api/member/update',
		method: 'post',
		data
	})
}

// 获取会员信息
export function getMemberInfo() {
	return request({
		url: '/api/member/info',
		method: 'get'
	})
}