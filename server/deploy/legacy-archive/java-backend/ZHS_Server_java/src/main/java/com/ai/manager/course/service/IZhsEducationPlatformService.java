package com.ai.manager.course.service;

import java.util.List;
import com.ai.manager.course.domain.ZhsEducationPlatform;

/**
 * 平台发布管理Service接口
 * 
 * @author Raindrop_L
 * @date 2025-08-29
 */
public interface IZhsEducationPlatformService
{
    /**
     * 查询平台发布管理
     * 
     * @param sort 平台发布管理主键
     * @return 平台发布管理
     */
    public ZhsEducationPlatform getBySort(Integer sort);

    /**
     * 查询平台发布管理列表
     * 
     * @param zhsEducationPlatform 平台发布管理
     * @return 平台发布管理集合
     */
    public List<ZhsEducationPlatform> getList(ZhsEducationPlatform zhsEducationPlatform);

    /**
     * 新增平台发布管理
     * 
     * @param zhsEducationPlatform 平台发布管理
     * @return 结果
     */
    public int add(ZhsEducationPlatform zhsEducationPlatform);

    /**
     * 修改平台发布管理
     * 
     * @param zhsEducationPlatform 平台发布管理
     * @return 结果
     */
    public int edit(ZhsEducationPlatform zhsEducationPlatform);

    /**
     * 批量删除平台发布管理
     * 
     * @param sorts 需要删除的平台发布管理主键集合
     * @return 结果
     */
    public int delBySorts(Integer[] sorts);

    /**
     * 删除平台发布管理信息
     * 
     * @param sort 平台发布管理主键
     * @return 结果
     */
    public int delBySort(Integer sort);

}
