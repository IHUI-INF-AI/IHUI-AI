package com.ai.manager.small.service;

import com.ai.manager.small.domain.ZhsUserAgentImage;

import java.util.List;

/**
 * 用户形象Service接口
 * 
 * @author Raindrop_L
 * @date 2025-09-30
 */
public interface IZhsUserAgentImageService
{
    /**
     * 查询用户形象
     * 
     * @param id 用户形象主键
     * @return 用户形象
     */
    public ZhsUserAgentImage getById(Long id);

    /**
     * 查询用户形象列表
     * 
     * @param zhsUserAgentImage 用户形象
     * @return 用户形象集合
     */
    public List<ZhsUserAgentImage> getList(ZhsUserAgentImage zhsUserAgentImage);

    /**
     * 新增用户形象
     * 
     * @param zhsUserAgentImage 用户形象
     * @return 结果
     */
    public int add(ZhsUserAgentImage zhsUserAgentImage);

    /**
     * 修改用户形象
     * 
     * @param zhsUserAgentImage 用户形象
     * @return 结果
     */
    public int edit(ZhsUserAgentImage zhsUserAgentImage);

    /**
     * 批量删除用户形象
     * 
     * @param ids 需要删除的用户形象主键集合
     * @return 结果
     */
    public int delByIds(Long[] ids);

    /**
     * 删除用户形象信息
     * 
     * @param id 用户形象主键
     * @return 结果
     */
    public int delById(Long id);
}
