'use strict';

const db = uniCloud.database();

// 检查数据库连接
async function checkDatabaseConnection() {
    try {
        await db.collection('zhs-users').limit(1).get();
        return true;
    } catch (error) {
        console.error('数据库连接失败:', error);
        return false;
    }
}

// 处理更新用户信息
async function handleUpdateProfile(event) {
    try {
        const { userId, nickname, avatar } = event.params;
        
        if (!userId) {
            return {
                code: 1,
                msg: '缺少用户ID'
            };
        }
        
        // 更新用户信息
        const result = await db.collection('zhs-users').doc(userId).update({
            nickname: nickname || undefined,
            avatar: avatar || undefined,
            updated_at: new Date()
        });
        
        if (result.updated === 1) {
            return {
                code: 0,
                msg: '更新成功'
            };
        } else {
            return {
                code: 2,
                msg: '更新失败'
            };
        }
    } catch (error) {
        console.error('更新用户信息失败:', error);
        return {
            code: -1,
            msg: '更新用户信息失败'
        };
    }
}

// 主函数
exports.main = async (event, context) => {
    try {
        // 检查数据库连接
        const isConnected = await checkDatabaseConnection();
        if (!isConnected) {
            return {
                code: -1,
                msg: '数据库连接失败'
            };
        }
        
        // 根据action分发处理
        switch (event.action) {
            case 'updateProfile':
                return await handleUpdateProfile(event);
            default:
                return {
                    code: 1,
                    msg: '未知的操作类型'
                };
        }
    } catch (error) {
        console.error('云函数执行失败:', error);
        return {
            code: -1,
            msg: '云函数执行失败'
        };
    }
}; 