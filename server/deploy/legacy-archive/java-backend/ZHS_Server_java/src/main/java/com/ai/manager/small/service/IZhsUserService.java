package com.ai.manager.small.service;


import com.ai.manager.small.domain.ZhsUser;
import com.ai.manager.small.domain.Order;
import com.ai.manager.small.domain.User;

import java.util.List;
import java.util.Map;

/**
 * 用户Service接口
 * 
 * @author Raindrop_L
 * @date 2025-06-18
 */
public interface IZhsUserService 
{
    /**
     * 查询用户
     * 
     * @param id 用户主键
     * @return 用户
     */
    public ZhsUser selectZhsUserById(Integer id);

    /**
     * 查询用户列表
     * 
     * @param zhsUser 用户
     * @return 用户集合
     */
    public List<ZhsUser> selectZhsUserList(ZhsUser zhsUser);

    /**
     * 新增用户
     * 
     * @param zhsUser 用户
     * @return 结果
     */
    public int insertZhsUser(ZhsUser zhsUser);

    /**
     * 修改用户
     * 
     * @param zhsUser 用户
     * @return 结果
     */
    public int updateZhsUser(ZhsUser zhsUser);

    /**
     * 批量删除用户
     * 
     * @param ids 需要删除的用户主键集合
     * @return 结果
     */
    public int deleteZhsUserByIds(Integer[] ids);

    /**
     * 删除用户信息
     * 
     * @param id 用户主键
     * @return 结果
     */
    public int deleteZhsUserById(Integer id);

    /**
     * 根据openId获取用户
     * @param openId
     * @return
     */
    public User getByOpenId(String openId);

    /**
     * 支付修改状态
     * @param user
     * @param order
     * @return
     */
    public Map<String, Object> updatePayStatus(User user, Order order);

    /**
     * 根据订单回馈邀请人（分销）
     * @param user
     * @param order
     */
    public void feedbackInvite(User user, Order order);


    public void userPayNotify(Order order);

}
