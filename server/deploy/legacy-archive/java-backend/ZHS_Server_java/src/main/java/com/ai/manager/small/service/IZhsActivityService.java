package com.ai.manager.small.service;


import com.ai.manager.small.domain.ZhsActivity;

import java.util.List;

/**
 * 活动Service接口
 * 
 * @author raindrop_l
 * @date 2025-06-05
 */
public interface IZhsActivityService 
{
    /**
     * 查询活动
     * 
     * @param id 活动主键
     * @return 活动
     */
    public ZhsActivity selectZhsActivityById(String id);

    /**
     * 查询活动列表
     * 
     * @param zhsActivity 活动
     * @return 活动集合
     */
    public List<ZhsActivity> selectZhsActivityList(ZhsActivity zhsActivity);

    /**
     * 新增活动
     * 
     * @param zhsActivity 活动
     * @return 结果
     */
    public int insertZhsActivity(ZhsActivity zhsActivity);

    /**
     * 修改活动
     * 
     * @param zhsActivity 活动
     * @return 结果
     */
    public int updateZhsActivity(ZhsActivity zhsActivity);

    /**
     * 批量删除活动
     * 
     * @param ids 需要删除的活动主键集合
     * @return 结果
     */
    public int deleteZhsActivityByIds(String[] ids);

    /**
     * 删除活动信息
     * 
     * @param id 活动主键
     * @return 结果
     */
    public int deleteZhsActivityById(String id);
}
