package com.ai.manager.core.constants;

public class BeanConfig {

    // 开通身份订单
    public final static String PRODUCT_IDENTITY_VIP = "fc56ee79-c7a9-4fef-8d04-5e450dc27d0e";
    public final static String PRODUCT_IDENTITY_VIP_NAME = "VIP";
    public final static Integer PRODUCT_IDENTITY_VIPTOKEN = 8000000;
    public final static String PRODUCT_IDENTITY_OPERATE = "35cc6b0c-5006-4fd6-84eb-e4c5ead1783c";
    public final static String PRODUCT_IDENTITY_OPERATE_NAME = "35cc6b0c-5006-4fd6-84eb-e4c5ead1783c";

    // 会员等级
    public  final static String BASE_VIP_ID = "08331881-bddb-4f82-b932-519089fe2562";// 基础会员id
    public  final static String MAX_VIP_ID = "87f48230-9a5b-4679-98a7-4606c415788c";// 满级会员ID

    public  final static String ZHS_CERT_TIME_KEY = "ZHS_CERT_TIME";// 创建认证时间戳
    public  final static String ZHS_AUTHORIZATION = "Authorization";// 认证id
    public static final String ZHS_ACCESS_PREFIX = "Bearer %s";
    public  final static String ZHS_CONTENT_TYPE = "Content-Type";// 内容类型
    public static final String ZHS_CONTENT_TYPE_JSON = "application/json;charset=UTF-8";
}
