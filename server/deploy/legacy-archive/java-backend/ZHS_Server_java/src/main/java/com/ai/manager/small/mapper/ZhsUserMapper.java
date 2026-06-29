package com.ai.manager.small.mapper;


import com.ai.manager.small.domain.User;
import com.ai.manager.small.domain.ZhsUser;
import org.apache.ibatis.annotations.Param;

import java.util.List;

/**
 * 微信用户表 数据层
 * 
 * @author Raindrop_L
 * @date 2025-06-18
 */
public interface ZhsUserMapper
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
     * 删除用户
     * 
     * @param id 用户主键
     * @return 结果
     */
    public int deleteZhsUserById(Integer id);

    /**
     * 批量删除用户
     * 
     * @param ids 需要删除的数据主键集合
     * @return 结果
     */
    public int deleteZhsUserByIds(Integer[] ids);

    User getByUuid(@Param("uuid") String uuid);
}
