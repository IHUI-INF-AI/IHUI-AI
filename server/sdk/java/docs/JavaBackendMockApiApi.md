# JavaBackendMockApiApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**mockAddPlazaModel**](JavaBackendMockApiApi.md#mockAddPlazaModel) | **POST** /api/category/addPlazaModel | Mock: 添加 Plaza 模型 |
| [**mockAdminLogin**](JavaBackendMockApiApi.md#mockAdminLogin) | **POST** /api/admin/login | Mock Admin Login |
| [**mockAdminMenus**](JavaBackendMockApiApi.md#mockAdminMenus) | **GET** /api/admin/menus | Mock Admin Menus |
| [**mockAdminRoles**](JavaBackendMockApiApi.md#mockAdminRoles) | **GET** /api/admin/roles | Mock Admin Roles |
| [**mockAdminUsers**](JavaBackendMockApiApi.md#mockAdminUsers) | **GET** /api/admin/users | Mock Admin Users |
| [**mockAgentBylink**](JavaBackendMockApiApi.md#mockAgentBylink) | **GET** /api/agent/rule/search/bylink | Mock Agent Bylink |
| [**mockAgentCategories**](JavaBackendMockApiApi.md#mockAgentCategories) | **GET** /api/agent/categories | Mock Agent Categories |
| [**mockAgentCollect**](JavaBackendMockApiApi.md#mockAgentCollect) | **POST** /api/agent/collect/{agent_id} | Mock Agent Collect |
| [**mockAgentLike**](JavaBackendMockApiApi.md#mockAgentLike) | **POST** /api/agent/like/{agent_id} | Mock Agent Like |
| [**mockAgentsCategories**](JavaBackendMockApiApi.md#mockAgentsCategories) | **GET** /api/agents/categories | Mock Agents Categories |
| [**mockAiChat**](JavaBackendMockApiApi.md#mockAiChat) | **POST** /api/ai/chat | Mock Ai Chat |
| [**mockAiGenerate**](JavaBackendMockApiApi.md#mockAiGenerate) | **POST** /api/ai/generate | Mock Ai Generate |
| [**mockAiModels**](JavaBackendMockApiApi.md#mockAiModels) | **GET** /api/ai/models | Mock Ai Models |
| [**mockAiProgramLogin**](JavaBackendMockApiApi.md#mockAiProgramLogin) | **POST** /api/ai-program/login/pwd/login | Mock Ai Program Login |
| [**mockAiProgramPlaza**](JavaBackendMockApiApi.md#mockAiProgramPlaza) | **GET** /api/ai-program/plaza | Mock Ai Program Plaza |
| [**mockAuditLogs**](JavaBackendMockApiApi.md#mockAuditLogs) | **GET** /api/audit/logs | Mock Audit Logs |
| [**mockAuditStats**](JavaBackendMockApiApi.md#mockAuditStats) | **GET** /api/audit/stats | Mock Audit Stats |
| [**mockAuthHealth**](JavaBackendMockApiApi.md#mockAuthHealth) | **GET** /api/auth/health | Mock Auth Health |
| [**mockAuthLoginPost**](JavaBackendMockApiApi.md#mockAuthLoginPost) | **POST** /api/auth/login | Mock Auth Login Post |
| [**mockAuthLogoutPost**](JavaBackendMockApiApi.md#mockAuthLogoutPost) | **POST** /api/auth/logout | Mock Auth Logout Post |
| [**mockAuthProfile**](JavaBackendMockApiApi.md#mockAuthProfile) | **GET** /api/auth/profile | Mock Auth Profile |
| [**mockAuthRefreshPost**](JavaBackendMockApiApi.md#mockAuthRefreshPost) | **POST** /api/auth/refresh | Mock Auth Refresh Post |
| [**mockAuthRegisterPost**](JavaBackendMockApiApi.md#mockAuthRegisterPost) | **POST** /api/auth/register | Mock Auth Register Post |
| [**mockAuthUserInfo**](JavaBackendMockApiApi.md#mockAuthUserInfo) | **GET** /api/auth/user-info | Mock Auth User Info |
| [**mockCategoryList**](JavaBackendMockApiApi.md#mockCategoryList) | **GET** /api/category/list | Mock: 智能体分类列表 |
| [**mockCoursesList**](JavaBackendMockApiApi.md#mockCoursesList) | **GET** /api/courses | Mock Courses List |
| [**mockCoursesMy**](JavaBackendMockApiApi.md#mockCoursesMy) | **GET** /api/courses/my | Mock Courses My |
| [**mockCsFaqs**](JavaBackendMockApiApi.md#mockCsFaqs) | **GET** /api/customer-service/faqs | Mock Cs Faqs |
| [**mockCsTickets**](JavaBackendMockApiApi.md#mockCsTickets) | **GET** /api/customer-service/tickets | Mock Cs Tickets |
| [**mockDeveloperModels**](JavaBackendMockApiApi.md#mockDeveloperModels) | **GET** /api/developer/models | Mock: 开发者模型列表 |
| [**mockFeatureFlags**](JavaBackendMockApiApi.md#mockFeatureFlags) | **GET** /api/feature-flags | Mock Feature Flags |
| [**mockFfExperiments**](JavaBackendMockApiApi.md#mockFfExperiments) | **GET** /api/feature-flags/experiments | Mock Ff Experiments |
| [**mockFundAliPay**](JavaBackendMockApiApi.md#mockFundAliPay) | **POST** /api/fund/ali/pay | Mock Fund Ali Pay |
| [**mockFundWxPay**](JavaBackendMockApiApi.md#mockFundWxPay) | **POST** /api/fund/wx/pay | Mock Fund Wx Pay |
| [**mockLoginPwdLogin**](JavaBackendMockApiApi.md#mockLoginPwdLogin) | **POST** /api/login/pwd/login | Mock Login Pwd Login |
| [**mockLoginPwdRefresh**](JavaBackendMockApiApi.md#mockLoginPwdRefresh) | **POST** /api/login/pwd/refreshToken | Mock Login Pwd Refresh |
| [**mockLoginPwdRegister**](JavaBackendMockApiApi.md#mockLoginPwdRegister) | **POST** /api/login/pwd/registerLogin | Mock Login Pwd Register |
| [**mockLoginPwdSmsVerify**](JavaBackendMockApiApi.md#mockLoginPwdSmsVerify) | **POST** /api/login/pwd/smsVerify | Mock Login Pwd Sms Verify |
| [**mockLoginPwdVerify**](JavaBackendMockApiApi.md#mockLoginPwdVerify) | **POST** /api/login/pwd/verify | Mock Login Pwd Verify |
| [**mockMobileOrders**](JavaBackendMockApiApi.md#mockMobileOrders) | **GET** /api/mobile/orders/list | Mock Mobile Orders |
| [**mockModelsPricing**](JavaBackendMockApiApi.md#mockModelsPricing) | **GET** /api/models/pricing | Mock Models Pricing |
| [**mockMonitorCollect**](JavaBackendMockApiApi.md#mockMonitorCollect) | **POST** /api/monitor/collect | Mock: 前端监控埋点 |
| [**mockMonitorError**](JavaBackendMockApiApi.md#mockMonitorError) | **POST** /api/monitor/error | Mock: 前端错误上报 |
| [**mockMonitorPerf**](JavaBackendMockApiApi.md#mockMonitorPerf) | **POST** /api/monitor/performance | Mock: 前端性能上报 |
| [**mockOpenclawSessions**](JavaBackendMockApiApi.md#mockOpenclawSessions) | **GET** /api/openclaw/sessions | Mock: OpenClaw 会话列表 |
| [**mockOpenclawTools**](JavaBackendMockApiApi.md#mockOpenclawTools) | **GET** /api/openclaw/tools | Mock: OpenClaw 工具列表 |
| [**mockOrderCreate**](JavaBackendMockApiApi.md#mockOrderCreate) | **POST** /api/order/create | Mock Order Create |
| [**mockOrdersList**](JavaBackendMockApiApi.md#mockOrdersList) | **GET** /api/orders | Mock Orders List |
| [**mockPaymentCheck**](JavaBackendMockApiApi.md#mockPaymentCheck) | **GET** /api/payment/checkOrderStatus | Mock Payment Check |
| [**mockPaymentCreate**](JavaBackendMockApiApi.md#mockPaymentCreate) | **POST** /api/payment/createOrder | Mock Payment Create |
| [**mockPlazaDemandDetail**](JavaBackendMockApiApi.md#mockPlazaDemandDetail) | **GET** /api/ai-program/plaza/demands/{demand_id} | Mock Plaza Demand Detail |
| [**mockPlazaDemandsList**](JavaBackendMockApiApi.md#mockPlazaDemandsList) | **GET** /api/ai-program/plaza/demands/list | Mock Plaza Demands List |
| [**mockPlazaInfo**](JavaBackendMockApiApi.md#mockPlazaInfo) | **GET** /api/category/getPlazaInfoById/{category_id} | Mock: Plaza 分类详情 |
| [**mockPlazaList**](JavaBackendMockApiApi.md#mockPlazaList) | **GET** /api/category/getPlazaList | Mock: Plaza 分类列表 |
| [**mockRechargeConfig**](JavaBackendMockApiApi.md#mockRechargeConfig) | **GET** /api/recharge/config | Mock Recharge Config |
| [**mockRechargeCreate**](JavaBackendMockApiApi.md#mockRechargeCreate) | **POST** /api/recharge/create | Mock Recharge Create |
| [**mockSaList**](JavaBackendMockApiApi.md#mockSaList) | **GET** /api/service-appointment | Mock Sa List |
| [**mockSkillsList**](JavaBackendMockApiApi.md#mockSkillsList) | **GET** /api/skills/list | Mock Skills List |
| [**mockSkillsMetadata**](JavaBackendMockApiApi.md#mockSkillsMetadata) | **GET** /api/skills/metadata | Mock Skills Metadata |
| [**mockSpeechToken**](JavaBackendMockApiApi.md#mockSpeechToken) | **GET** /api/speech/baidu/token | Mock Speech Token |
| [**mockStatsDashboard**](JavaBackendMockApiApi.md#mockStatsDashboard) | **GET** /api/statistics/dashboard | Mock: 仪表盘统计 |
| [**mockStatsOverview**](JavaBackendMockApiApi.md#mockStatsOverview) | **GET** /api/statistics/overview | Mock: 总览统计 |
| [**mockUnifiedAiCaps**](JavaBackendMockApiApi.md#mockUnifiedAiCaps) | **GET** /api/unified-ai/capabilities | Mock Unified Ai Caps |
| [**mockUnifiedAiInvoke**](JavaBackendMockApiApi.md#mockUnifiedAiInvoke) | **POST** /api/unified-ai/invoke | Mock Unified Ai Invoke |
| [**mockUploadFileDelete**](JavaBackendMockApiApi.md#mockUploadFileDelete) | **DELETE** /api/upload/file/{file_id} | Mock Upload File Delete |
| [**mockUploadFiles**](JavaBackendMockApiApi.md#mockUploadFiles) | **POST** /api/upload/files | Mock Upload Files |
| [**mockUploadSingle**](JavaBackendMockApiApi.md#mockUploadSingle) | **POST** /api/upload/single | Mock Upload Single |
| [**mockUserApiBalance**](JavaBackendMockApiApi.md#mockUserApiBalance) | **GET** /api/user/api-balance | Mock User Api Balance |
| [**mockUserApiTokens**](JavaBackendMockApiApi.md#mockUserApiTokens) | **GET** /api/user/api-tokens | Mock User Api Tokens |
| [**mockUserApiUsageStats**](JavaBackendMockApiApi.md#mockUserApiUsageStats) | **GET** /api/user/api-usage/stats | Mock User Api Usage Stats |
| [**mockUserGetInfo**](JavaBackendMockApiApi.md#mockUserGetInfo) | **GET** /api/user/getUserInfo | Mock User Get Info |
| [**mockUserLoginPost**](JavaBackendMockApiApi.md#mockUserLoginPost) | **POST** /api/user/login | Mock User Login Post |
| [**mockUserLogoutPost**](JavaBackendMockApiApi.md#mockUserLogoutPost) | **POST** /api/user/logout | Mock User Logout Post |
| [**mockUserProfile**](JavaBackendMockApiApi.md#mockUserProfile) | **GET** /api/user/profile | Mock User Profile |
| [**mockUserProfilePut**](JavaBackendMockApiApi.md#mockUserProfilePut) | **PUT** /api/user/profile | Mock User Profile Put |
| [**mockVipLevels**](JavaBackendMockApiApi.md#mockVipLevels) | **GET** /api/vip/levels | Mock Vip Levels |
| [**mockVipOrderCreate**](JavaBackendMockApiApi.md#mockVipOrderCreate) | **POST** /api/vip/order/create | Mock Vip Order Create |
| [**mockVipPlans**](JavaBackendMockApiApi.md#mockVipPlans) | **GET** /api/vip/plans | Mock Vip Plans |
| [**mockVipPrivileges**](JavaBackendMockApiApi.md#mockVipPrivileges) | **GET** /api/vip/privileges | Mock Vip Privileges |
| [**mockWalletInfo**](JavaBackendMockApiApi.md#mockWalletInfo) | **GET** /api/wallet/info | Mock Wallet Info |
| [**mockWalletTransactions**](JavaBackendMockApiApi.md#mockWalletTransactions) | **GET** /api/wallet/transactions | Mock Wallet Transactions |


<a id="mockAddPlazaModel"></a>
# **mockAddPlazaModel**
> Object mockAddPlazaModel()

Mock: 添加 Plaza 模型

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.JavaBackendMockApiApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    JavaBackendMockApiApi apiInstance = new JavaBackendMockApiApi(defaultClient);
    try {
      Object result = apiInstance.mockAddPlazaModel();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling JavaBackendMockApiApi#mockAddPlazaModel");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

<a id="mockAdminLogin"></a>
# **mockAdminLogin**
> Object mockAdminLogin()

Mock Admin Login

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.JavaBackendMockApiApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    JavaBackendMockApiApi apiInstance = new JavaBackendMockApiApi(defaultClient);
    try {
      Object result = apiInstance.mockAdminLogin();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling JavaBackendMockApiApi#mockAdminLogin");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

<a id="mockAdminMenus"></a>
# **mockAdminMenus**
> Object mockAdminMenus()

Mock Admin Menus

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.JavaBackendMockApiApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    JavaBackendMockApiApi apiInstance = new JavaBackendMockApiApi(defaultClient);
    try {
      Object result = apiInstance.mockAdminMenus();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling JavaBackendMockApiApi#mockAdminMenus");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

<a id="mockAdminRoles"></a>
# **mockAdminRoles**
> Object mockAdminRoles()

Mock Admin Roles

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.JavaBackendMockApiApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    JavaBackendMockApiApi apiInstance = new JavaBackendMockApiApi(defaultClient);
    try {
      Object result = apiInstance.mockAdminRoles();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling JavaBackendMockApiApi#mockAdminRoles");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

<a id="mockAdminUsers"></a>
# **mockAdminUsers**
> Object mockAdminUsers()

Mock Admin Users

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.JavaBackendMockApiApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    JavaBackendMockApiApi apiInstance = new JavaBackendMockApiApi(defaultClient);
    try {
      Object result = apiInstance.mockAdminUsers();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling JavaBackendMockApiApi#mockAdminUsers");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

<a id="mockAgentBylink"></a>
# **mockAgentBylink**
> Object mockAgentBylink()

Mock Agent Bylink

返回按主分类分组的智能体列表 (兼容前端 AgentsSquareList 期望格式).

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.JavaBackendMockApiApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    JavaBackendMockApiApi apiInstance = new JavaBackendMockApiApi(defaultClient);
    try {
      Object result = apiInstance.mockAgentBylink();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling JavaBackendMockApiApi#mockAgentBylink");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

<a id="mockAgentCategories"></a>
# **mockAgentCategories**
> Object mockAgentCategories()

Mock Agent Categories

返回智能体分类 (主分类 + 子分类).

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.JavaBackendMockApiApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    JavaBackendMockApiApi apiInstance = new JavaBackendMockApiApi(defaultClient);
    try {
      Object result = apiInstance.mockAgentCategories();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling JavaBackendMockApiApi#mockAgentCategories");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

<a id="mockAgentCollect"></a>
# **mockAgentCollect**
> Object mockAgentCollect(agentId)

Mock Agent Collect

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.JavaBackendMockApiApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    JavaBackendMockApiApi apiInstance = new JavaBackendMockApiApi(defaultClient);
    String agentId = "agentId_example"; // String | 
    try {
      Object result = apiInstance.mockAgentCollect(agentId);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling JavaBackendMockApiApi#mockAgentCollect");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters

| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **agentId** | **String**|  | |

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="mockAgentLike"></a>
# **mockAgentLike**
> Object mockAgentLike(agentId)

Mock Agent Like

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.JavaBackendMockApiApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    JavaBackendMockApiApi apiInstance = new JavaBackendMockApiApi(defaultClient);
    String agentId = "agentId_example"; // String | 
    try {
      Object result = apiInstance.mockAgentLike(agentId);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling JavaBackendMockApiApi#mockAgentLike");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters

| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **agentId** | **String**|  | |

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="mockAgentsCategories"></a>
# **mockAgentsCategories**
> Object mockAgentsCategories()

Mock Agents Categories

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.JavaBackendMockApiApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    JavaBackendMockApiApi apiInstance = new JavaBackendMockApiApi(defaultClient);
    try {
      Object result = apiInstance.mockAgentsCategories();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling JavaBackendMockApiApi#mockAgentsCategories");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

<a id="mockAiChat"></a>
# **mockAiChat**
> Object mockAiChat()

Mock Ai Chat

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.JavaBackendMockApiApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    JavaBackendMockApiApi apiInstance = new JavaBackendMockApiApi(defaultClient);
    try {
      Object result = apiInstance.mockAiChat();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling JavaBackendMockApiApi#mockAiChat");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

<a id="mockAiGenerate"></a>
# **mockAiGenerate**
> Object mockAiGenerate()

Mock Ai Generate

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.JavaBackendMockApiApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    JavaBackendMockApiApi apiInstance = new JavaBackendMockApiApi(defaultClient);
    try {
      Object result = apiInstance.mockAiGenerate();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling JavaBackendMockApiApi#mockAiGenerate");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

<a id="mockAiModels"></a>
# **mockAiModels**
> Object mockAiModels()

Mock Ai Models

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.JavaBackendMockApiApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    JavaBackendMockApiApi apiInstance = new JavaBackendMockApiApi(defaultClient);
    try {
      Object result = apiInstance.mockAiModels();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling JavaBackendMockApiApi#mockAiModels");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

<a id="mockAiProgramLogin"></a>
# **mockAiProgramLogin**
> Object mockAiProgramLogin()

Mock Ai Program Login

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.JavaBackendMockApiApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    JavaBackendMockApiApi apiInstance = new JavaBackendMockApiApi(defaultClient);
    try {
      Object result = apiInstance.mockAiProgramLogin();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling JavaBackendMockApiApi#mockAiProgramLogin");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

<a id="mockAiProgramPlaza"></a>
# **mockAiProgramPlaza**
> Object mockAiProgramPlaza()

Mock Ai Program Plaza

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.JavaBackendMockApiApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    JavaBackendMockApiApi apiInstance = new JavaBackendMockApiApi(defaultClient);
    try {
      Object result = apiInstance.mockAiProgramPlaza();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling JavaBackendMockApiApi#mockAiProgramPlaza");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

<a id="mockAuditLogs"></a>
# **mockAuditLogs**
> Object mockAuditLogs()

Mock Audit Logs

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.JavaBackendMockApiApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    JavaBackendMockApiApi apiInstance = new JavaBackendMockApiApi(defaultClient);
    try {
      Object result = apiInstance.mockAuditLogs();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling JavaBackendMockApiApi#mockAuditLogs");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

<a id="mockAuditStats"></a>
# **mockAuditStats**
> Object mockAuditStats()

Mock Audit Stats

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.JavaBackendMockApiApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    JavaBackendMockApiApi apiInstance = new JavaBackendMockApiApi(defaultClient);
    try {
      Object result = apiInstance.mockAuditStats();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling JavaBackendMockApiApi#mockAuditStats");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

<a id="mockAuthHealth"></a>
# **mockAuthHealth**
> Object mockAuthHealth()

Mock Auth Health

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.JavaBackendMockApiApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    JavaBackendMockApiApi apiInstance = new JavaBackendMockApiApi(defaultClient);
    try {
      Object result = apiInstance.mockAuthHealth();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling JavaBackendMockApiApi#mockAuthHealth");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

<a id="mockAuthLoginPost"></a>
# **mockAuthLoginPost**
> Object mockAuthLoginPost()

Mock Auth Login Post

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.JavaBackendMockApiApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    JavaBackendMockApiApi apiInstance = new JavaBackendMockApiApi(defaultClient);
    try {
      Object result = apiInstance.mockAuthLoginPost();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling JavaBackendMockApiApi#mockAuthLoginPost");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

<a id="mockAuthLogoutPost"></a>
# **mockAuthLogoutPost**
> Object mockAuthLogoutPost()

Mock Auth Logout Post

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.JavaBackendMockApiApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    JavaBackendMockApiApi apiInstance = new JavaBackendMockApiApi(defaultClient);
    try {
      Object result = apiInstance.mockAuthLogoutPost();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling JavaBackendMockApiApi#mockAuthLogoutPost");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

<a id="mockAuthProfile"></a>
# **mockAuthProfile**
> Object mockAuthProfile()

Mock Auth Profile

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.JavaBackendMockApiApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    JavaBackendMockApiApi apiInstance = new JavaBackendMockApiApi(defaultClient);
    try {
      Object result = apiInstance.mockAuthProfile();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling JavaBackendMockApiApi#mockAuthProfile");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

<a id="mockAuthRefreshPost"></a>
# **mockAuthRefreshPost**
> Object mockAuthRefreshPost()

Mock Auth Refresh Post

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.JavaBackendMockApiApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    JavaBackendMockApiApi apiInstance = new JavaBackendMockApiApi(defaultClient);
    try {
      Object result = apiInstance.mockAuthRefreshPost();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling JavaBackendMockApiApi#mockAuthRefreshPost");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

<a id="mockAuthRegisterPost"></a>
# **mockAuthRegisterPost**
> Object mockAuthRegisterPost()

Mock Auth Register Post

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.JavaBackendMockApiApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    JavaBackendMockApiApi apiInstance = new JavaBackendMockApiApi(defaultClient);
    try {
      Object result = apiInstance.mockAuthRegisterPost();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling JavaBackendMockApiApi#mockAuthRegisterPost");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

<a id="mockAuthUserInfo"></a>
# **mockAuthUserInfo**
> Object mockAuthUserInfo()

Mock Auth User Info

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.JavaBackendMockApiApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    JavaBackendMockApiApi apiInstance = new JavaBackendMockApiApi(defaultClient);
    try {
      Object result = apiInstance.mockAuthUserInfo();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling JavaBackendMockApiApi#mockAuthUserInfo");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

<a id="mockCategoryList"></a>
# **mockCategoryList**
> Object mockCategoryList()

Mock: 智能体分类列表

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.JavaBackendMockApiApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    JavaBackendMockApiApi apiInstance = new JavaBackendMockApiApi(defaultClient);
    try {
      Object result = apiInstance.mockCategoryList();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling JavaBackendMockApiApi#mockCategoryList");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

<a id="mockCoursesList"></a>
# **mockCoursesList**
> Object mockCoursesList()

Mock Courses List

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.JavaBackendMockApiApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    JavaBackendMockApiApi apiInstance = new JavaBackendMockApiApi(defaultClient);
    try {
      Object result = apiInstance.mockCoursesList();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling JavaBackendMockApiApi#mockCoursesList");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

<a id="mockCoursesMy"></a>
# **mockCoursesMy**
> Object mockCoursesMy()

Mock Courses My

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.JavaBackendMockApiApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    JavaBackendMockApiApi apiInstance = new JavaBackendMockApiApi(defaultClient);
    try {
      Object result = apiInstance.mockCoursesMy();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling JavaBackendMockApiApi#mockCoursesMy");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

<a id="mockCsFaqs"></a>
# **mockCsFaqs**
> Object mockCsFaqs()

Mock Cs Faqs

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.JavaBackendMockApiApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    JavaBackendMockApiApi apiInstance = new JavaBackendMockApiApi(defaultClient);
    try {
      Object result = apiInstance.mockCsFaqs();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling JavaBackendMockApiApi#mockCsFaqs");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

<a id="mockCsTickets"></a>
# **mockCsTickets**
> Object mockCsTickets()

Mock Cs Tickets

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.JavaBackendMockApiApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    JavaBackendMockApiApi apiInstance = new JavaBackendMockApiApi(defaultClient);
    try {
      Object result = apiInstance.mockCsTickets();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling JavaBackendMockApiApi#mockCsTickets");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

<a id="mockDeveloperModels"></a>
# **mockDeveloperModels**
> Object mockDeveloperModels()

Mock: 开发者模型列表

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.JavaBackendMockApiApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    JavaBackendMockApiApi apiInstance = new JavaBackendMockApiApi(defaultClient);
    try {
      Object result = apiInstance.mockDeveloperModels();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling JavaBackendMockApiApi#mockDeveloperModels");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

<a id="mockFeatureFlags"></a>
# **mockFeatureFlags**
> Object mockFeatureFlags()

Mock Feature Flags

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.JavaBackendMockApiApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    JavaBackendMockApiApi apiInstance = new JavaBackendMockApiApi(defaultClient);
    try {
      Object result = apiInstance.mockFeatureFlags();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling JavaBackendMockApiApi#mockFeatureFlags");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

<a id="mockFfExperiments"></a>
# **mockFfExperiments**
> Object mockFfExperiments()

Mock Ff Experiments

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.JavaBackendMockApiApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    JavaBackendMockApiApi apiInstance = new JavaBackendMockApiApi(defaultClient);
    try {
      Object result = apiInstance.mockFfExperiments();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling JavaBackendMockApiApi#mockFfExperiments");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

<a id="mockFundAliPay"></a>
# **mockFundAliPay**
> Object mockFundAliPay()

Mock Fund Ali Pay

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.JavaBackendMockApiApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    JavaBackendMockApiApi apiInstance = new JavaBackendMockApiApi(defaultClient);
    try {
      Object result = apiInstance.mockFundAliPay();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling JavaBackendMockApiApi#mockFundAliPay");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

<a id="mockFundWxPay"></a>
# **mockFundWxPay**
> Object mockFundWxPay()

Mock Fund Wx Pay

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.JavaBackendMockApiApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    JavaBackendMockApiApi apiInstance = new JavaBackendMockApiApi(defaultClient);
    try {
      Object result = apiInstance.mockFundWxPay();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling JavaBackendMockApiApi#mockFundWxPay");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

<a id="mockLoginPwdLogin"></a>
# **mockLoginPwdLogin**
> Object mockLoginPwdLogin()

Mock Login Pwd Login

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.JavaBackendMockApiApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    JavaBackendMockApiApi apiInstance = new JavaBackendMockApiApi(defaultClient);
    try {
      Object result = apiInstance.mockLoginPwdLogin();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling JavaBackendMockApiApi#mockLoginPwdLogin");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

<a id="mockLoginPwdRefresh"></a>
# **mockLoginPwdRefresh**
> Object mockLoginPwdRefresh()

Mock Login Pwd Refresh

刷新 token - mock 返回真实 JWT, 让前端后续请求能通过鉴权.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.JavaBackendMockApiApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    JavaBackendMockApiApi apiInstance = new JavaBackendMockApiApi(defaultClient);
    try {
      Object result = apiInstance.mockLoginPwdRefresh();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling JavaBackendMockApiApi#mockLoginPwdRefresh");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

<a id="mockLoginPwdRegister"></a>
# **mockLoginPwdRegister**
> Object mockLoginPwdRegister()

Mock Login Pwd Register

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.JavaBackendMockApiApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    JavaBackendMockApiApi apiInstance = new JavaBackendMockApiApi(defaultClient);
    try {
      Object result = apiInstance.mockLoginPwdRegister();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling JavaBackendMockApiApi#mockLoginPwdRegister");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

<a id="mockLoginPwdSmsVerify"></a>
# **mockLoginPwdSmsVerify**
> Object mockLoginPwdSmsVerify()

Mock Login Pwd Sms Verify

发送手机验证码 - mock 始终返回成功, 但有 60s 限流 (Redis 持久化).

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.JavaBackendMockApiApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    JavaBackendMockApiApi apiInstance = new JavaBackendMockApiApi(defaultClient);
    try {
      Object result = apiInstance.mockLoginPwdSmsVerify();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling JavaBackendMockApiApi#mockLoginPwdSmsVerify");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

<a id="mockLoginPwdVerify"></a>
# **mockLoginPwdVerify**
> Object mockLoginPwdVerify()

Mock Login Pwd Verify

验证手机验证码 - mock 始终返回临时密钥.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.JavaBackendMockApiApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    JavaBackendMockApiApi apiInstance = new JavaBackendMockApiApi(defaultClient);
    try {
      Object result = apiInstance.mockLoginPwdVerify();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling JavaBackendMockApiApi#mockLoginPwdVerify");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

<a id="mockMobileOrders"></a>
# **mockMobileOrders**
> Object mockMobileOrders()

Mock Mobile Orders

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.JavaBackendMockApiApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    JavaBackendMockApiApi apiInstance = new JavaBackendMockApiApi(defaultClient);
    try {
      Object result = apiInstance.mockMobileOrders();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling JavaBackendMockApiApi#mockMobileOrders");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

<a id="mockModelsPricing"></a>
# **mockModelsPricing**
> Object mockModelsPricing()

Mock Models Pricing

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.JavaBackendMockApiApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    JavaBackendMockApiApi apiInstance = new JavaBackendMockApiApi(defaultClient);
    try {
      Object result = apiInstance.mockModelsPricing();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling JavaBackendMockApiApi#mockModelsPricing");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

<a id="mockMonitorCollect"></a>
# **mockMonitorCollect**
> Object mockMonitorCollect()

Mock: 前端监控埋点

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.JavaBackendMockApiApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    JavaBackendMockApiApi apiInstance = new JavaBackendMockApiApi(defaultClient);
    try {
      Object result = apiInstance.mockMonitorCollect();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling JavaBackendMockApiApi#mockMonitorCollect");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

<a id="mockMonitorError"></a>
# **mockMonitorError**
> Object mockMonitorError()

Mock: 前端错误上报

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.JavaBackendMockApiApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    JavaBackendMockApiApi apiInstance = new JavaBackendMockApiApi(defaultClient);
    try {
      Object result = apiInstance.mockMonitorError();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling JavaBackendMockApiApi#mockMonitorError");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

<a id="mockMonitorPerf"></a>
# **mockMonitorPerf**
> Object mockMonitorPerf()

Mock: 前端性能上报

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.JavaBackendMockApiApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    JavaBackendMockApiApi apiInstance = new JavaBackendMockApiApi(defaultClient);
    try {
      Object result = apiInstance.mockMonitorPerf();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling JavaBackendMockApiApi#mockMonitorPerf");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

<a id="mockOpenclawSessions"></a>
# **mockOpenclawSessions**
> Object mockOpenclawSessions()

Mock: OpenClaw 会话列表

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.JavaBackendMockApiApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    JavaBackendMockApiApi apiInstance = new JavaBackendMockApiApi(defaultClient);
    try {
      Object result = apiInstance.mockOpenclawSessions();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling JavaBackendMockApiApi#mockOpenclawSessions");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

<a id="mockOpenclawTools"></a>
# **mockOpenclawTools**
> Object mockOpenclawTools()

Mock: OpenClaw 工具列表

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.JavaBackendMockApiApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    JavaBackendMockApiApi apiInstance = new JavaBackendMockApiApi(defaultClient);
    try {
      Object result = apiInstance.mockOpenclawTools();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling JavaBackendMockApiApi#mockOpenclawTools");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

<a id="mockOrderCreate"></a>
# **mockOrderCreate**
> Object mockOrderCreate()

Mock Order Create

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.JavaBackendMockApiApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    JavaBackendMockApiApi apiInstance = new JavaBackendMockApiApi(defaultClient);
    try {
      Object result = apiInstance.mockOrderCreate();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling JavaBackendMockApiApi#mockOrderCreate");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

<a id="mockOrdersList"></a>
# **mockOrdersList**
> Object mockOrdersList()

Mock Orders List

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.JavaBackendMockApiApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    JavaBackendMockApiApi apiInstance = new JavaBackendMockApiApi(defaultClient);
    try {
      Object result = apiInstance.mockOrdersList();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling JavaBackendMockApiApi#mockOrdersList");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

<a id="mockPaymentCheck"></a>
# **mockPaymentCheck**
> Object mockPaymentCheck()

Mock Payment Check

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.JavaBackendMockApiApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    JavaBackendMockApiApi apiInstance = new JavaBackendMockApiApi(defaultClient);
    try {
      Object result = apiInstance.mockPaymentCheck();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling JavaBackendMockApiApi#mockPaymentCheck");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

<a id="mockPaymentCreate"></a>
# **mockPaymentCreate**
> Object mockPaymentCreate()

Mock Payment Create

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.JavaBackendMockApiApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    JavaBackendMockApiApi apiInstance = new JavaBackendMockApiApi(defaultClient);
    try {
      Object result = apiInstance.mockPaymentCreate();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling JavaBackendMockApiApi#mockPaymentCreate");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

<a id="mockPlazaDemandDetail"></a>
# **mockPlazaDemandDetail**
> Object mockPlazaDemandDetail(demandId)

Mock Plaza Demand Detail

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.JavaBackendMockApiApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    JavaBackendMockApiApi apiInstance = new JavaBackendMockApiApi(defaultClient);
    Integer demandId = 56; // Integer | 
    try {
      Object result = apiInstance.mockPlazaDemandDetail(demandId);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling JavaBackendMockApiApi#mockPlazaDemandDetail");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters

| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **demandId** | **Integer**|  | |

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="mockPlazaDemandsList"></a>
# **mockPlazaDemandsList**
> Object mockPlazaDemandsList()

Mock Plaza Demands List

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.JavaBackendMockApiApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    JavaBackendMockApiApi apiInstance = new JavaBackendMockApiApi(defaultClient);
    try {
      Object result = apiInstance.mockPlazaDemandsList();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling JavaBackendMockApiApi#mockPlazaDemandsList");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

<a id="mockPlazaInfo"></a>
# **mockPlazaInfo**
> Object mockPlazaInfo(categoryId)

Mock: Plaza 分类详情

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.JavaBackendMockApiApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    JavaBackendMockApiApi apiInstance = new JavaBackendMockApiApi(defaultClient);
    Integer categoryId = 56; // Integer | 
    try {
      Object result = apiInstance.mockPlazaInfo(categoryId);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling JavaBackendMockApiApi#mockPlazaInfo");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters

| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **categoryId** | **Integer**|  | |

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="mockPlazaList"></a>
# **mockPlazaList**
> Object mockPlazaList()

Mock: Plaza 分类列表

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.JavaBackendMockApiApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    JavaBackendMockApiApi apiInstance = new JavaBackendMockApiApi(defaultClient);
    try {
      Object result = apiInstance.mockPlazaList();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling JavaBackendMockApiApi#mockPlazaList");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

<a id="mockRechargeConfig"></a>
# **mockRechargeConfig**
> Object mockRechargeConfig()

Mock Recharge Config

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.JavaBackendMockApiApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    JavaBackendMockApiApi apiInstance = new JavaBackendMockApiApi(defaultClient);
    try {
      Object result = apiInstance.mockRechargeConfig();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling JavaBackendMockApiApi#mockRechargeConfig");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

<a id="mockRechargeCreate"></a>
# **mockRechargeCreate**
> Object mockRechargeCreate()

Mock Recharge Create

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.JavaBackendMockApiApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    JavaBackendMockApiApi apiInstance = new JavaBackendMockApiApi(defaultClient);
    try {
      Object result = apiInstance.mockRechargeCreate();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling JavaBackendMockApiApi#mockRechargeCreate");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

<a id="mockSaList"></a>
# **mockSaList**
> Object mockSaList()

Mock Sa List

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.JavaBackendMockApiApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    JavaBackendMockApiApi apiInstance = new JavaBackendMockApiApi(defaultClient);
    try {
      Object result = apiInstance.mockSaList();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling JavaBackendMockApiApi#mockSaList");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

<a id="mockSkillsList"></a>
# **mockSkillsList**
> Object mockSkillsList()

Mock Skills List

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.JavaBackendMockApiApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    JavaBackendMockApiApi apiInstance = new JavaBackendMockApiApi(defaultClient);
    try {
      Object result = apiInstance.mockSkillsList();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling JavaBackendMockApiApi#mockSkillsList");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

<a id="mockSkillsMetadata"></a>
# **mockSkillsMetadata**
> Object mockSkillsMetadata()

Mock Skills Metadata

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.JavaBackendMockApiApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    JavaBackendMockApiApi apiInstance = new JavaBackendMockApiApi(defaultClient);
    try {
      Object result = apiInstance.mockSkillsMetadata();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling JavaBackendMockApiApi#mockSkillsMetadata");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

<a id="mockSpeechToken"></a>
# **mockSpeechToken**
> Object mockSpeechToken()

Mock Speech Token

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.JavaBackendMockApiApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    JavaBackendMockApiApi apiInstance = new JavaBackendMockApiApi(defaultClient);
    try {
      Object result = apiInstance.mockSpeechToken();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling JavaBackendMockApiApi#mockSpeechToken");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

<a id="mockStatsDashboard"></a>
# **mockStatsDashboard**
> Object mockStatsDashboard()

Mock: 仪表盘统计

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.JavaBackendMockApiApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    JavaBackendMockApiApi apiInstance = new JavaBackendMockApiApi(defaultClient);
    try {
      Object result = apiInstance.mockStatsDashboard();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling JavaBackendMockApiApi#mockStatsDashboard");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

<a id="mockStatsOverview"></a>
# **mockStatsOverview**
> Object mockStatsOverview()

Mock: 总览统计

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.JavaBackendMockApiApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    JavaBackendMockApiApi apiInstance = new JavaBackendMockApiApi(defaultClient);
    try {
      Object result = apiInstance.mockStatsOverview();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling JavaBackendMockApiApi#mockStatsOverview");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

<a id="mockUnifiedAiCaps"></a>
# **mockUnifiedAiCaps**
> Object mockUnifiedAiCaps()

Mock Unified Ai Caps

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.JavaBackendMockApiApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    JavaBackendMockApiApi apiInstance = new JavaBackendMockApiApi(defaultClient);
    try {
      Object result = apiInstance.mockUnifiedAiCaps();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling JavaBackendMockApiApi#mockUnifiedAiCaps");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

<a id="mockUnifiedAiInvoke"></a>
# **mockUnifiedAiInvoke**
> Object mockUnifiedAiInvoke()

Mock Unified Ai Invoke

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.JavaBackendMockApiApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    JavaBackendMockApiApi apiInstance = new JavaBackendMockApiApi(defaultClient);
    try {
      Object result = apiInstance.mockUnifiedAiInvoke();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling JavaBackendMockApiApi#mockUnifiedAiInvoke");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

<a id="mockUploadFileDelete"></a>
# **mockUploadFileDelete**
> Object mockUploadFileDelete(fileId)

Mock Upload File Delete

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.JavaBackendMockApiApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    JavaBackendMockApiApi apiInstance = new JavaBackendMockApiApi(defaultClient);
    String fileId = "fileId_example"; // String | 
    try {
      Object result = apiInstance.mockUploadFileDelete(fileId);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling JavaBackendMockApiApi#mockUploadFileDelete");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters

| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **fileId** | **String**|  | |

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="mockUploadFiles"></a>
# **mockUploadFiles**
> Object mockUploadFiles()

Mock Upload Files

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.JavaBackendMockApiApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    JavaBackendMockApiApi apiInstance = new JavaBackendMockApiApi(defaultClient);
    try {
      Object result = apiInstance.mockUploadFiles();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling JavaBackendMockApiApi#mockUploadFiles");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

<a id="mockUploadSingle"></a>
# **mockUploadSingle**
> Object mockUploadSingle()

Mock Upload Single

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.JavaBackendMockApiApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    JavaBackendMockApiApi apiInstance = new JavaBackendMockApiApi(defaultClient);
    try {
      Object result = apiInstance.mockUploadSingle();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling JavaBackendMockApiApi#mockUploadSingle");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

<a id="mockUserApiBalance"></a>
# **mockUserApiBalance**
> Object mockUserApiBalance()

Mock User Api Balance

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.JavaBackendMockApiApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    JavaBackendMockApiApi apiInstance = new JavaBackendMockApiApi(defaultClient);
    try {
      Object result = apiInstance.mockUserApiBalance();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling JavaBackendMockApiApi#mockUserApiBalance");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

<a id="mockUserApiTokens"></a>
# **mockUserApiTokens**
> Object mockUserApiTokens()

Mock User Api Tokens

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.JavaBackendMockApiApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    JavaBackendMockApiApi apiInstance = new JavaBackendMockApiApi(defaultClient);
    try {
      Object result = apiInstance.mockUserApiTokens();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling JavaBackendMockApiApi#mockUserApiTokens");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

<a id="mockUserApiUsageStats"></a>
# **mockUserApiUsageStats**
> Object mockUserApiUsageStats()

Mock User Api Usage Stats

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.JavaBackendMockApiApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    JavaBackendMockApiApi apiInstance = new JavaBackendMockApiApi(defaultClient);
    try {
      Object result = apiInstance.mockUserApiUsageStats();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling JavaBackendMockApiApi#mockUserApiUsageStats");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

<a id="mockUserGetInfo"></a>
# **mockUserGetInfo**
> Object mockUserGetInfo()

Mock User Get Info

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.JavaBackendMockApiApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    JavaBackendMockApiApi apiInstance = new JavaBackendMockApiApi(defaultClient);
    try {
      Object result = apiInstance.mockUserGetInfo();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling JavaBackendMockApiApi#mockUserGetInfo");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

<a id="mockUserLoginPost"></a>
# **mockUserLoginPost**
> Object mockUserLoginPost()

Mock User Login Post

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.JavaBackendMockApiApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    JavaBackendMockApiApi apiInstance = new JavaBackendMockApiApi(defaultClient);
    try {
      Object result = apiInstance.mockUserLoginPost();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling JavaBackendMockApiApi#mockUserLoginPost");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

<a id="mockUserLogoutPost"></a>
# **mockUserLogoutPost**
> Object mockUserLogoutPost()

Mock User Logout Post

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.JavaBackendMockApiApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    JavaBackendMockApiApi apiInstance = new JavaBackendMockApiApi(defaultClient);
    try {
      Object result = apiInstance.mockUserLogoutPost();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling JavaBackendMockApiApi#mockUserLogoutPost");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

<a id="mockUserProfile"></a>
# **mockUserProfile**
> Object mockUserProfile()

Mock User Profile

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.JavaBackendMockApiApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    JavaBackendMockApiApi apiInstance = new JavaBackendMockApiApi(defaultClient);
    try {
      Object result = apiInstance.mockUserProfile();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling JavaBackendMockApiApi#mockUserProfile");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

<a id="mockUserProfilePut"></a>
# **mockUserProfilePut**
> Object mockUserProfilePut()

Mock User Profile Put

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.JavaBackendMockApiApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    JavaBackendMockApiApi apiInstance = new JavaBackendMockApiApi(defaultClient);
    try {
      Object result = apiInstance.mockUserProfilePut();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling JavaBackendMockApiApi#mockUserProfilePut");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

<a id="mockVipLevels"></a>
# **mockVipLevels**
> Object mockVipLevels()

Mock Vip Levels

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.JavaBackendMockApiApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    JavaBackendMockApiApi apiInstance = new JavaBackendMockApiApi(defaultClient);
    try {
      Object result = apiInstance.mockVipLevels();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling JavaBackendMockApiApi#mockVipLevels");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

<a id="mockVipOrderCreate"></a>
# **mockVipOrderCreate**
> Object mockVipOrderCreate()

Mock Vip Order Create

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.JavaBackendMockApiApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    JavaBackendMockApiApi apiInstance = new JavaBackendMockApiApi(defaultClient);
    try {
      Object result = apiInstance.mockVipOrderCreate();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling JavaBackendMockApiApi#mockVipOrderCreate");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

<a id="mockVipPlans"></a>
# **mockVipPlans**
> Object mockVipPlans()

Mock Vip Plans

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.JavaBackendMockApiApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    JavaBackendMockApiApi apiInstance = new JavaBackendMockApiApi(defaultClient);
    try {
      Object result = apiInstance.mockVipPlans();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling JavaBackendMockApiApi#mockVipPlans");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

<a id="mockVipPrivileges"></a>
# **mockVipPrivileges**
> Object mockVipPrivileges()

Mock Vip Privileges

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.JavaBackendMockApiApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    JavaBackendMockApiApi apiInstance = new JavaBackendMockApiApi(defaultClient);
    try {
      Object result = apiInstance.mockVipPrivileges();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling JavaBackendMockApiApi#mockVipPrivileges");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

<a id="mockWalletInfo"></a>
# **mockWalletInfo**
> Object mockWalletInfo()

Mock Wallet Info

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.JavaBackendMockApiApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    JavaBackendMockApiApi apiInstance = new JavaBackendMockApiApi(defaultClient);
    try {
      Object result = apiInstance.mockWalletInfo();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling JavaBackendMockApiApi#mockWalletInfo");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

<a id="mockWalletTransactions"></a>
# **mockWalletTransactions**
> Object mockWalletTransactions()

Mock Wallet Transactions

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.JavaBackendMockApiApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    JavaBackendMockApiApi apiInstance = new JavaBackendMockApiApi(defaultClient);
    try {
      Object result = apiInstance.mockWalletTransactions();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling JavaBackendMockApiApi#mockWalletTransactions");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

