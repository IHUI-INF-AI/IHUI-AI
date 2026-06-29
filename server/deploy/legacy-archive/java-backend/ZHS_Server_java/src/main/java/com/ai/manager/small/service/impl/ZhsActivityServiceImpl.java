package com.ai.manager.small.service.impl;

import com.ai.manager.small.domain.ZhsActivity;
import com.ai.manager.small.mapper.ZhsActivityMapper;
import com.ai.manager.small.service.IZhsActivityService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * 活动Service业务层处理
 * 
 * @author raindrop_l
 * @date 2025-06-05
 */
@Service
public class ZhsActivityServiceImpl implements IZhsActivityService
{
    @Autowired
    private ZhsActivityMapper zhsActivityMapper;

    /**
     * 查询活动
     * 
     * @param id 活动主键
     * @return 活动
     */
    @Override
    public ZhsActivity selectZhsActivityById(String id)
    {
        return zhsActivityMapper.selectZhsActivityById(id);
    }

    /**
     * 查询活动列表
     * 
     * @param zhsActivity 活动
     * @return 活动
     */
    @Override
    public List<ZhsActivity> selectZhsActivityList(ZhsActivity zhsActivity)
    {
        return zhsActivityMapper.selectZhsActivityList(zhsActivity);
    }

    /**
     * 新增活动
     * 
     * @param zhsActivity 活动
     * @return 结果
     */
    @Override
    public int insertZhsActivity(ZhsActivity zhsActivity)
    {
        return zhsActivityMapper.insertZhsActivity(zhsActivity);
    }

    /**
     * 修改活动
     * 
     * @param zhsActivity 活动
     * @return 结果
     */
    @Override
    public int updateZhsActivity(ZhsActivity zhsActivity)
    {
        return zhsActivityMapper.updateZhsActivity(zhsActivity);
    }

    /**
     * 批量删除活动
     * 
     * @param ids 需要删除的活动主键
     * @return 结果
     */
    @Override
    public int deleteZhsActivityByIds(String[] ids)
    {
        return zhsActivityMapper.deleteZhsActivityByIds(ids);
    }

    /**
     * 删除活动信息
     * 
     * @param id 活动主键
     * @return 结果
     */
    @Override
    public int deleteZhsActivityById(String id)
    {
        return zhsActivityMapper.deleteZhsActivityById(id);
    }
}
