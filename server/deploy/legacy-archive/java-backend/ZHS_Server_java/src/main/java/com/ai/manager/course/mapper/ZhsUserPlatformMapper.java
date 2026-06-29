package com.ai.manager.course.mapper;

import java.util.List;
import com.ai.manager.course.domain.ZhsUserPlatform;
import com.baomidou.dynamic.datasource.annotation.DS;
import org.apache.ibatis.annotations.Param;

/**
 * 用户与平台关系Mapper接口
 * 
 * @author Raindrop_L
 * @date 2025-08-29
 */
@DS("course")
public interface ZhsUserPlatformMapper
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
     * @return 结果
     */
    public int addZhsUserPlatform(ZhsUserPlatform zhsUserPlatform);

    /**
     * 修改用户与平台关系
     * 
     * @param zhsUserPlatform 用户与平台关系
     * @return 结果
     */
    public int edit(ZhsUserPlatform zhsUserPlatform);

    /**
     * 删除用户与平台关系
     * 
     * @param id 用户与平台关系主键
     * @return 结果
     */
    public int delById(Integer id);

    /**
     * 批量删除用户与平台关系
     * 
     * @param ids 需要删除的数据主键集合
     * @return 结果
     */
    public int delByIds(Integer[] ids);

    ZhsUserPlatform getByUserId(@Param("userId") Integer userId, @Param("platformCode") String platformCode);
}
