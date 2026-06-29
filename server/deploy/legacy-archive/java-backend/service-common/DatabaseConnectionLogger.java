package com.yjs.cloud.learning.common;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.autoconfigure.jdbc.DataSourceProperties;
import org.springframework.stereotype.Component;

/**
 * 数据库连接信息打印工具类
 * 用于在服务启动时打印当前使用的数据库连接信息
 */
@Component
public class DatabaseConnectionLogger implements CommandLineRunner {

    private static final Logger logger = LoggerFactory.getLogger(DatabaseConnectionLogger.class);

    @Autowired
    private DataSourceProperties dataSourceProperties;

    @Override
    public void run(String... args) throws Exception {
        String url = dataSourceProperties.getUrl();
        String username = dataSourceProperties.getUsername();

        // 隐藏密码信息，只显示前两位和最后一位
        String password = dataSourceProperties.getPassword();
        String maskedPassword = "";
        if (password != null && password.length() > 3) {
            maskedPassword = password.substring(0, 2) + "*****" + password.substring(password.length() - 1);
        } else if (password != null && password.length() > 0) {
            maskedPassword = "*****";
        }

        logger.info("===============================================");
        logger.info("数据库连接信息:");
        logger.info("URL: {}", url);
        logger.info("用户名: {}", username);
        logger.info("密码: {}", maskedPassword);
        logger.info("===============================================");
    }
}
