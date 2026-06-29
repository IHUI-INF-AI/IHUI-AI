package com.ai.manager.course.service;

import java.util.List;
import com.ai.manager.course.domain.ZhsUserPlatform;

/**
 * 用户与平台关系Service接口
 * 
 * @author Raindrop_L
 * @date 2025-08-29
 */
public interface IZhsUserPlatformService
{
    /**
     * 查询用户与平台关系
     * 
     * @param id 用户与平台关系主键
     * @return 用户与平台关系
     */
    public ZhsUserPlatform getById(Integer id);

    /**
     * 查询用户与平台关系列表
     * 
     * @param zhsUserPlatform 用户与平台关系
     * @return 用户与平台关系集合
     */
    public List<ZhsUserPlatform> getList(ZhsUserPlatform zhsUserPlatform);

    /**
     * 新增用户与平台关系
     *
     * @param zhsUserPlatform 用户与平台关系
     * @param courseHeader
     * @return 结果
     */
    public int add(ZhsUserPlatform zhsUserPlatform, String courseHeader);

    /**
     * 修改用户与平台关系
     * 
     * @param zhsUserPlatform 用户与平台关系
     * @return 结果
     */
    public int edit(ZhsUserPlatform zhsUserPlatform);

    /**
     * 批量删除用户与平台关系
     * 
     * @param ids 需要删除的用户与平台关系主键集合
     * @return 结果
     */
    public int delByIds(Integer[] ids);

    /**
     * 删除用户与平台关系信息
     * 
     * @param id 用户与平台关系主键
     * @return 结果
     */
    public int delById(Integer id);

    ZhsUserPlatform getByUserId(Integer id, String courseHeader);
}
