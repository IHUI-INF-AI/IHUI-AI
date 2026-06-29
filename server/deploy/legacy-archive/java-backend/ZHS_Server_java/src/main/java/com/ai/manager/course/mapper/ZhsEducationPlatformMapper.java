package com.ai.manager.course.mapper;

import java.util.List;
import com.ai.manager.course.domain.ZhsEducationPlatform;
import com.baomidou.dynamic.datasource.annotation.DS;
import org.apache.ibatis.annotations.Param;

/**
 * 平台发布管理Mapper接口
 * 
 * @author Raindrop_L
 * @date 2025-08-29
 */
@DS("course")
public interface ZhsEducationPlatformMapper 
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
    public int addZhsEducationPlatform(ZhsEducationPlatform zhsEducationPlatform);

    /**
     * 修改平台发布管理
     * 
     * @param zhsEducationPlatform 平台发布管理
     * @return 结果
     */
    public int edit(ZhsEducationPlatform zhsEducationPlatform);

    /**
     * 删除平台发布管理
     * 
     * @param id 平台发布管理主键
     * @return 结果
     */
    public int delBySort(Integer id);

    /**
     * 批量删除平台发布管理
     * 
     * @param ids 需要删除的数据主键集合
     * @return 结果
     */
    public int delBySorts(Integer[] ids);

    ZhsEducationPlatform getByCode(@Param("code") String code);
}
