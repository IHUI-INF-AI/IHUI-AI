'use strict';

const db = uniCloud.database();
const collection = db.collection('common');

// 默认图标配置
const defaultIcons = {
	home: 'cloud://ai-zhihuishe.6169-ai-zhihuishe-1303000000/tabbar/home.png',
	homeActive: 'cloud://ai-zhihuishe.6169-ai-zhihuishe-1303000000/tabbar/home-active.png',
	chat: 'cloud://ai-zhihuishe.6169-ai-zhihuishe-1303000000/tabbar/chat.png',
	chatActive: 'cloud://ai-zhihuishe.6169-ai-zhihuishe-1303000000/tabbar/chat-active.png',
	member: 'cloud://ai-zhihuishe.6169-ai-zhihuishe-1303000000/tabbar/member.png',
	memberActive: 'cloud://ai-zhihuishe.6169-ai-zhihuishe-1303000000/tabbar/member-active.png',
	settings: 'cloud://ai-zhihuishe.6169-ai-zhihuishe-1303000000/tabbar/settings.png',
	settingsActive: 'cloud://ai-zhihuishe.6169-ai-zhihuishe-1303000000/tabbar/settings-active.png'
};

exports.main = async (event, context) => {
	const { action, data } = event;
	
	switch (action) {
		case 'getTabBarIcons':
			try {
				const result = await collection.doc('tabbar_icons').get();
				if (result.data && result.data.length > 0) {
					return {
						code: 0,
						msg: '获取成功',
						data: result.data[0]
					};
				}
				// 如果没有找到图标数据，返回默认图标
				return {
					code: 0,
					msg: '获取成功',
					data: defaultIcons
				};
			} catch (e) {
				return {
					code: 1,
					msg: e.message
				};
			}
		case 'saveTabBarIcons':
			try {
				// 检查文档是否存在
				const doc = await collection.doc('tabbar_icons').get();
				if (doc.data && doc.data.length > 0) {
					// 更新现有文档
					await collection.doc('tabbar_icons').update({
						...data,
						update_time: Date.now()
					});
				} else {
					// 创建新文档
					await collection.add({
						_id: 'tabbar_icons',
						...data,
						create_time: Date.now(),
						update_time: Date.now()
					});
				}
				return {
					code: 0,
					msg: '保存成功'
				};
			} catch (e) {
				return {
					code: 1,
					msg: e.message
				};
			}
		case 'initTabBarIcons':
			try {
				// 检查文档是否存在
				const doc = await collection.doc('tabbar_icons').get();
				if (!doc.data || doc.data.length === 0) {
					// 创建新文档
					await collection.add({
						_id: 'tabbar_icons',
						...defaultIcons,
						create_time: Date.now(),
						update_time: Date.now()
					});
				}
				return {
					code: 0,
					msg: '初始化成功'
				};
			} catch (e) {
				return {
					code: 1,
					msg: e.message
				};
			}
		default:
			return {
				code: 1,
				msg: '未知操作'
			};
	}
}; 