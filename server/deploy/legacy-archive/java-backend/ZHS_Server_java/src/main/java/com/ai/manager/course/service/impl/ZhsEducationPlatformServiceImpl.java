package com.ai.manager.course.service.impl;

import java.util.List;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import com.ai.manager.course.mapper.ZhsEducationPlatformMapper;
import com.ai.manager.course.domain.ZhsEducationPlatform;
import com.ai.manager.course.service.IZhsEducationPlatformService;

/**
 * 平台发布管理Service业务层处理
 * 
 * @author Raindrop_L
 * @date 2025-08-29
 */
@Service
public class ZhsEducationPlatformServiceImpl implements IZhsEducationPlatformService 
{
    @Autowired
    private ZhsEducationPlatformMapper zhsEducationPlatformMapper;

    /**
     * 查询平台发布管理
     * 
     * @param sort 平台发布管理主键
     * @return 平台发布管理
     */
    @Override
    public ZhsEducationPlatform getBySort(Integer sort)
    {
        return zhsEducationPlatformMapper.getBySort(sort);
    }

    /**
     * 查询平台发布管理列表
     * 
     * @param zhsEducationPlatform 平台发布管理
     * @return 平台发布管理
     */
    @Override
    public List<ZhsEducationPlatform> getList(ZhsEducationPlatform zhsEducationPlatform)
    {
        return zhsEducationPlatformMapper.getList(zhsEducationPlatform);
    }

    /**
     * 新增平台发布管理
     * 
     * @param zhsEducationPlatform 平台发布管理
     * @return 结果
     */
    @Override
    public int add(ZhsEducationPlatform zhsEducationPlatform)
    {
        return zhsEducationPlatformMapper.addZhsEducationPlatform(zhsEducationPlatform);
    }

    /**
     * 修改平台发布管理
     * 
     * @param zhsEducationPlatform 平台发布管理
     * @return 结果
     */
    @Override
    public int edit(ZhsEducationPlatform zhsEducationPlatform)
    {
        return zhsEducationPlatformMapper.edit(zhsEducationPlatform);
    }

    /**
     * 批量删除平台发布管理
     * 
     * @param sorts 需要删除的平台发布管理主键
     * @return 结果
     */
    @Override
    public int delBySorts(Integer[] sorts)
    {
        return zhsEducationPlatformMapper.delBySorts(sorts);
    }

    /**
     * 删除平台发布管理信息
     * 
     * @param sort 平台发布管理主键
     * @return 结果
     */
    @Override
    public int delBySort(Integer sort)
    {
        return zhsEducationPlatformMapper.delBySort(sort);
    }
}
