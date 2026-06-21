# JavaBackendMockApiApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**mockAddPlazaModel**](#mockaddplazamodel) | **POST** /api/category/addPlazaModel | Mock: 添加 Plaza 模型|
|[**mockAdminLogin**](#mockadminlogin) | **POST** /api/admin/login | Mock Admin Login|
|[**mockAdminMenus**](#mockadminmenus) | **GET** /api/admin/menus | Mock Admin Menus|
|[**mockAdminRoles**](#mockadminroles) | **GET** /api/admin/roles | Mock Admin Roles|
|[**mockAdminUsers**](#mockadminusers) | **GET** /api/admin/users | Mock Admin Users|
|[**mockAgentBylink**](#mockagentbylink) | **GET** /api/agent/rule/search/bylink | Mock Agent Bylink|
|[**mockAgentCategories**](#mockagentcategories) | **GET** /api/agent/categories | Mock Agent Categories|
|[**mockAgentCollect**](#mockagentcollect) | **POST** /api/agent/collect/{agent_id} | Mock Agent Collect|
|[**mockAgentLike**](#mockagentlike) | **POST** /api/agent/like/{agent_id} | Mock Agent Like|
|[**mockAgentsCategories**](#mockagentscategories) | **GET** /api/agents/categories | Mock Agents Categories|
|[**mockAiChat**](#mockaichat) | **POST** /api/ai/chat | Mock Ai Chat|
|[**mockAiGenerate**](#mockaigenerate) | **POST** /api/ai/generate | Mock Ai Generate|
|[**mockAiModels**](#mockaimodels) | **GET** /api/ai/models | Mock Ai Models|
|[**mockAiProgramLogin**](#mockaiprogramlogin) | **POST** /api/ai-program/login/pwd/login | Mock Ai Program Login|
|[**mockAiProgramPlaza**](#mockaiprogramplaza) | **GET** /api/ai-program/plaza | Mock Ai Program Plaza|
|[**mockAuditLogs**](#mockauditlogs) | **GET** /api/audit/logs | Mock Audit Logs|
|[**mockAuditStats**](#mockauditstats) | **GET** /api/audit/stats | Mock Audit Stats|
|[**mockAuthHealth**](#mockauthhealth) | **GET** /api/auth/health | Mock Auth Health|
|[**mockAuthLoginPost**](#mockauthloginpost) | **POST** /api/auth/login | Mock Auth Login Post|
|[**mockAuthLogoutPost**](#mockauthlogoutpost) | **POST** /api/auth/logout | Mock Auth Logout Post|
|[**mockAuthProfile**](#mockauthprofile) | **GET** /api/auth/profile | Mock Auth Profile|
|[**mockAuthRefreshPost**](#mockauthrefreshpost) | **POST** /api/auth/refresh | Mock Auth Refresh Post|
|[**mockAuthRegisterPost**](#mockauthregisterpost) | **POST** /api/auth/register | Mock Auth Register Post|
|[**mockAuthUserInfo**](#mockauthuserinfo) | **GET** /api/auth/user-info | Mock Auth User Info|
|[**mockCategoryList**](#mockcategorylist) | **GET** /api/category/list | Mock: 智能体分类列表|
|[**mockCoursesList**](#mockcourseslist) | **GET** /api/courses | Mock Courses List|
|[**mockCoursesMy**](#mockcoursesmy) | **GET** /api/courses/my | Mock Courses My|
|[**mockCsFaqs**](#mockcsfaqs) | **GET** /api/customer-service/faqs | Mock Cs Faqs|
|[**mockCsTickets**](#mockcstickets) | **GET** /api/customer-service/tickets | Mock Cs Tickets|
|[**mockDeveloperModels**](#mockdevelopermodels) | **GET** /api/developer/models | Mock: 开发者模型列表|
|[**mockFeatureFlags**](#mockfeatureflags) | **GET** /api/feature-flags | Mock Feature Flags|
|[**mockFfExperiments**](#mockffexperiments) | **GET** /api/feature-flags/experiments | Mock Ff Experiments|
|[**mockFundAliPay**](#mockfundalipay) | **POST** /api/fund/ali/pay | Mock Fund Ali Pay|
|[**mockFundWxPay**](#mockfundwxpay) | **POST** /api/fund/wx/pay | Mock Fund Wx Pay|
|[**mockLoginPwdLogin**](#mockloginpwdlogin) | **POST** /api/login/pwd/login | Mock Login Pwd Login|
|[**mockLoginPwdRefresh**](#mockloginpwdrefresh) | **POST** /api/login/pwd/refreshToken | Mock Login Pwd Refresh|
|[**mockLoginPwdRegister**](#mockloginpwdregister) | **POST** /api/login/pwd/registerLogin | Mock Login Pwd Register|
|[**mockLoginPwdSmsVerify**](#mockloginpwdsmsverify) | **POST** /api/login/pwd/smsVerify | Mock Login Pwd Sms Verify|
|[**mockLoginPwdVerify**](#mockloginpwdverify) | **POST** /api/login/pwd/verify | Mock Login Pwd Verify|
|[**mockMobileOrders**](#mockmobileorders) | **GET** /api/mobile/orders/list | Mock Mobile Orders|
|[**mockModelsPricing**](#mockmodelspricing) | **GET** /api/models/pricing | Mock Models Pricing|
|[**mockMonitorCollect**](#mockmonitorcollect) | **POST** /api/monitor/collect | Mock: 前端监控埋点|
|[**mockMonitorError**](#mockmonitorerror) | **POST** /api/monitor/error | Mock: 前端错误上报|
|[**mockMonitorPerf**](#mockmonitorperf) | **POST** /api/monitor/performance | Mock: 前端性能上报|
|[**mockOpenclawSessions**](#mockopenclawsessions) | **GET** /api/openclaw/sessions | Mock: OpenClaw 会话列表|
|[**mockOpenclawTools**](#mockopenclawtools) | **GET** /api/openclaw/tools | Mock: OpenClaw 工具列表|
|[**mockOrderCreate**](#mockordercreate) | **POST** /api/order/create | Mock Order Create|
|[**mockOrdersList**](#mockorderslist) | **GET** /api/orders | Mock Orders List|
|[**mockPaymentCheck**](#mockpaymentcheck) | **GET** /api/payment/checkOrderStatus | Mock Payment Check|
|[**mockPaymentCreate**](#mockpaymentcreate) | **POST** /api/payment/createOrder | Mock Payment Create|
|[**mockPlazaDemandDetail**](#mockplazademanddetail) | **GET** /api/ai-program/plaza/demands/{demand_id} | Mock Plaza Demand Detail|
|[**mockPlazaDemandsList**](#mockplazademandslist) | **GET** /api/ai-program/plaza/demands/list | Mock Plaza Demands List|
|[**mockPlazaInfo**](#mockplazainfo) | **GET** /api/category/getPlazaInfoById/{category_id} | Mock: Plaza 分类详情|
|[**mockPlazaList**](#mockplazalist) | **GET** /api/category/getPlazaList | Mock: Plaza 分类列表|
|[**mockRechargeConfig**](#mockrechargeconfig) | **GET** /api/recharge/config | Mock Recharge Config|
|[**mockRechargeCreate**](#mockrechargecreate) | **POST** /api/recharge/create | Mock Recharge Create|
|[**mockSaList**](#mocksalist) | **GET** /api/service-appointment | Mock Sa List|
|[**mockSkillsList**](#mockskillslist) | **GET** /api/skills/list | Mock Skills List|
|[**mockSkillsMetadata**](#mockskillsmetadata) | **GET** /api/skills/metadata | Mock Skills Metadata|
|[**mockSpeechToken**](#mockspeechtoken) | **GET** /api/speech/baidu/token | Mock Speech Token|
|[**mockStatsDashboard**](#mockstatsdashboard) | **GET** /api/statistics/dashboard | Mock: 仪表盘统计|
|[**mockStatsOverview**](#mockstatsoverview) | **GET** /api/statistics/overview | Mock: 总览统计|
|[**mockUnifiedAiCaps**](#mockunifiedaicaps) | **GET** /api/unified-ai/capabilities | Mock Unified Ai Caps|
|[**mockUnifiedAiInvoke**](#mockunifiedaiinvoke) | **POST** /api/unified-ai/invoke | Mock Unified Ai Invoke|
|[**mockUploadFileDelete**](#mockuploadfiledelete) | **DELETE** /api/upload/file/{file_id} | Mock Upload File Delete|
|[**mockUploadFiles**](#mockuploadfiles) | **POST** /api/upload/files | Mock Upload Files|
|[**mockUploadSingle**](#mockuploadsingle) | **POST** /api/upload/single | Mock Upload Single|
|[**mockUserApiBalance**](#mockuserapibalance) | **GET** /api/user/api-balance | Mock User Api Balance|
|[**mockUserApiTokens**](#mockuserapitokens) | **GET** /api/user/api-tokens | Mock User Api Tokens|
|[**mockUserApiUsageStats**](#mockuserapiusagestats) | **GET** /api/user/api-usage/stats | Mock User Api Usage Stats|
|[**mockUserGetInfo**](#mockusergetinfo) | **GET** /api/user/getUserInfo | Mock User Get Info|
|[**mockUserLoginPost**](#mockuserloginpost) | **POST** /api/user/login | Mock User Login Post|
|[**mockUserLogoutPost**](#mockuserlogoutpost) | **POST** /api/user/logout | Mock User Logout Post|
|[**mockUserProfile**](#mockuserprofile) | **GET** /api/user/profile | Mock User Profile|
|[**mockUserProfilePut**](#mockuserprofileput) | **PUT** /api/user/profile | Mock User Profile Put|
|[**mockVipLevels**](#mockviplevels) | **GET** /api/vip/levels | Mock Vip Levels|
|[**mockVipOrderCreate**](#mockvipordercreate) | **POST** /api/vip/order/create | Mock Vip Order Create|
|[**mockVipPlans**](#mockvipplans) | **GET** /api/vip/plans | Mock Vip Plans|
|[**mockVipPrivileges**](#mockvipprivileges) | **GET** /api/vip/privileges | Mock Vip Privileges|
|[**mockWalletInfo**](#mockwalletinfo) | **GET** /api/wallet/info | Mock Wallet Info|
|[**mockWalletTransactions**](#mockwallettransactions) | **GET** /api/wallet/transactions | Mock Wallet Transactions|

# **mockAddPlazaModel**
> any mockAddPlazaModel()


### Example

```typescript
import {
    JavaBackendMockApiApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new JavaBackendMockApiApi(configuration);

const { status, data } = await apiInstance.mockAddPlazaModel();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mockAdminLogin**
> any mockAdminLogin()


### Example

```typescript
import {
    JavaBackendMockApiApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new JavaBackendMockApiApi(configuration);

const { status, data } = await apiInstance.mockAdminLogin();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mockAdminMenus**
> any mockAdminMenus()


### Example

```typescript
import {
    JavaBackendMockApiApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new JavaBackendMockApiApi(configuration);

const { status, data } = await apiInstance.mockAdminMenus();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mockAdminRoles**
> any mockAdminRoles()


### Example

```typescript
import {
    JavaBackendMockApiApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new JavaBackendMockApiApi(configuration);

const { status, data } = await apiInstance.mockAdminRoles();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mockAdminUsers**
> any mockAdminUsers()


### Example

```typescript
import {
    JavaBackendMockApiApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new JavaBackendMockApiApi(configuration);

const { status, data } = await apiInstance.mockAdminUsers();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mockAgentBylink**
> any mockAgentBylink()

返回按主分类分组的智能体列表 (兼容前端 AgentsSquareList 期望格式).

### Example

```typescript
import {
    JavaBackendMockApiApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new JavaBackendMockApiApi(configuration);

const { status, data } = await apiInstance.mockAgentBylink();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mockAgentCategories**
> any mockAgentCategories()

返回智能体分类 (主分类 + 子分类).

### Example

```typescript
import {
    JavaBackendMockApiApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new JavaBackendMockApiApi(configuration);

const { status, data } = await apiInstance.mockAgentCategories();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mockAgentCollect**
> any mockAgentCollect()


### Example

```typescript
import {
    JavaBackendMockApiApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new JavaBackendMockApiApi(configuration);

let agentId: string; // (default to undefined)

const { status, data } = await apiInstance.mockAgentCollect(
    agentId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **agentId** | [**string**] |  | defaults to undefined|


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mockAgentLike**
> any mockAgentLike()


### Example

```typescript
import {
    JavaBackendMockApiApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new JavaBackendMockApiApi(configuration);

let agentId: string; // (default to undefined)

const { status, data } = await apiInstance.mockAgentLike(
    agentId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **agentId** | [**string**] |  | defaults to undefined|


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mockAgentsCategories**
> any mockAgentsCategories()


### Example

```typescript
import {
    JavaBackendMockApiApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new JavaBackendMockApiApi(configuration);

const { status, data } = await apiInstance.mockAgentsCategories();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mockAiChat**
> any mockAiChat()


### Example

```typescript
import {
    JavaBackendMockApiApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new JavaBackendMockApiApi(configuration);

const { status, data } = await apiInstance.mockAiChat();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mockAiGenerate**
> any mockAiGenerate()


### Example

```typescript
import {
    JavaBackendMockApiApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new JavaBackendMockApiApi(configuration);

const { status, data } = await apiInstance.mockAiGenerate();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mockAiModels**
> any mockAiModels()


### Example

```typescript
import {
    JavaBackendMockApiApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new JavaBackendMockApiApi(configuration);

const { status, data } = await apiInstance.mockAiModels();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mockAiProgramLogin**
> any mockAiProgramLogin()


### Example

```typescript
import {
    JavaBackendMockApiApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new JavaBackendMockApiApi(configuration);

const { status, data } = await apiInstance.mockAiProgramLogin();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mockAiProgramPlaza**
> any mockAiProgramPlaza()


### Example

```typescript
import {
    JavaBackendMockApiApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new JavaBackendMockApiApi(configuration);

const { status, data } = await apiInstance.mockAiProgramPlaza();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mockAuditLogs**
> any mockAuditLogs()


### Example

```typescript
import {
    JavaBackendMockApiApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new JavaBackendMockApiApi(configuration);

const { status, data } = await apiInstance.mockAuditLogs();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mockAuditStats**
> any mockAuditStats()


### Example

```typescript
import {
    JavaBackendMockApiApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new JavaBackendMockApiApi(configuration);

const { status, data } = await apiInstance.mockAuditStats();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mockAuthHealth**
> any mockAuthHealth()


### Example

```typescript
import {
    JavaBackendMockApiApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new JavaBackendMockApiApi(configuration);

const { status, data } = await apiInstance.mockAuthHealth();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mockAuthLoginPost**
> any mockAuthLoginPost()


### Example

```typescript
import {
    JavaBackendMockApiApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new JavaBackendMockApiApi(configuration);

const { status, data } = await apiInstance.mockAuthLoginPost();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mockAuthLogoutPost**
> any mockAuthLogoutPost()


### Example

```typescript
import {
    JavaBackendMockApiApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new JavaBackendMockApiApi(configuration);

const { status, data } = await apiInstance.mockAuthLogoutPost();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mockAuthProfile**
> any mockAuthProfile()


### Example

```typescript
import {
    JavaBackendMockApiApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new JavaBackendMockApiApi(configuration);

const { status, data } = await apiInstance.mockAuthProfile();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mockAuthRefreshPost**
> any mockAuthRefreshPost()


### Example

```typescript
import {
    JavaBackendMockApiApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new JavaBackendMockApiApi(configuration);

const { status, data } = await apiInstance.mockAuthRefreshPost();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mockAuthRegisterPost**
> any mockAuthRegisterPost()


### Example

```typescript
import {
    JavaBackendMockApiApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new JavaBackendMockApiApi(configuration);

const { status, data } = await apiInstance.mockAuthRegisterPost();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mockAuthUserInfo**
> any mockAuthUserInfo()


### Example

```typescript
import {
    JavaBackendMockApiApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new JavaBackendMockApiApi(configuration);

const { status, data } = await apiInstance.mockAuthUserInfo();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mockCategoryList**
> any mockCategoryList()


### Example

```typescript
import {
    JavaBackendMockApiApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new JavaBackendMockApiApi(configuration);

const { status, data } = await apiInstance.mockCategoryList();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mockCoursesList**
> any mockCoursesList()


### Example

```typescript
import {
    JavaBackendMockApiApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new JavaBackendMockApiApi(configuration);

const { status, data } = await apiInstance.mockCoursesList();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mockCoursesMy**
> any mockCoursesMy()


### Example

```typescript
import {
    JavaBackendMockApiApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new JavaBackendMockApiApi(configuration);

const { status, data } = await apiInstance.mockCoursesMy();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mockCsFaqs**
> any mockCsFaqs()


### Example

```typescript
import {
    JavaBackendMockApiApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new JavaBackendMockApiApi(configuration);

const { status, data } = await apiInstance.mockCsFaqs();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mockCsTickets**
> any mockCsTickets()


### Example

```typescript
import {
    JavaBackendMockApiApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new JavaBackendMockApiApi(configuration);

const { status, data } = await apiInstance.mockCsTickets();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mockDeveloperModels**
> any mockDeveloperModels()


### Example

```typescript
import {
    JavaBackendMockApiApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new JavaBackendMockApiApi(configuration);

const { status, data } = await apiInstance.mockDeveloperModels();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mockFeatureFlags**
> any mockFeatureFlags()


### Example

```typescript
import {
    JavaBackendMockApiApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new JavaBackendMockApiApi(configuration);

const { status, data } = await apiInstance.mockFeatureFlags();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mockFfExperiments**
> any mockFfExperiments()


### Example

```typescript
import {
    JavaBackendMockApiApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new JavaBackendMockApiApi(configuration);

const { status, data } = await apiInstance.mockFfExperiments();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mockFundAliPay**
> any mockFundAliPay()


### Example

```typescript
import {
    JavaBackendMockApiApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new JavaBackendMockApiApi(configuration);

const { status, data } = await apiInstance.mockFundAliPay();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mockFundWxPay**
> any mockFundWxPay()


### Example

```typescript
import {
    JavaBackendMockApiApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new JavaBackendMockApiApi(configuration);

const { status, data } = await apiInstance.mockFundWxPay();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mockLoginPwdLogin**
> any mockLoginPwdLogin()


### Example

```typescript
import {
    JavaBackendMockApiApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new JavaBackendMockApiApi(configuration);

const { status, data } = await apiInstance.mockLoginPwdLogin();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mockLoginPwdRefresh**
> any mockLoginPwdRefresh()

刷新 token - mock 返回真实 JWT, 让前端后续请求能通过鉴权.

### Example

```typescript
import {
    JavaBackendMockApiApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new JavaBackendMockApiApi(configuration);

const { status, data } = await apiInstance.mockLoginPwdRefresh();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mockLoginPwdRegister**
> any mockLoginPwdRegister()


### Example

```typescript
import {
    JavaBackendMockApiApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new JavaBackendMockApiApi(configuration);

const { status, data } = await apiInstance.mockLoginPwdRegister();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mockLoginPwdSmsVerify**
> any mockLoginPwdSmsVerify()

发送手机验证码 - mock 始终返回成功, 但有 60s 限流 (Redis 持久化).

### Example

```typescript
import {
    JavaBackendMockApiApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new JavaBackendMockApiApi(configuration);

const { status, data } = await apiInstance.mockLoginPwdSmsVerify();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mockLoginPwdVerify**
> any mockLoginPwdVerify()

验证手机验证码 - mock 始终返回临时密钥.

### Example

```typescript
import {
    JavaBackendMockApiApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new JavaBackendMockApiApi(configuration);

const { status, data } = await apiInstance.mockLoginPwdVerify();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mockMobileOrders**
> any mockMobileOrders()


### Example

```typescript
import {
    JavaBackendMockApiApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new JavaBackendMockApiApi(configuration);

const { status, data } = await apiInstance.mockMobileOrders();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mockModelsPricing**
> any mockModelsPricing()


### Example

```typescript
import {
    JavaBackendMockApiApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new JavaBackendMockApiApi(configuration);

const { status, data } = await apiInstance.mockModelsPricing();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mockMonitorCollect**
> any mockMonitorCollect()


### Example

```typescript
import {
    JavaBackendMockApiApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new JavaBackendMockApiApi(configuration);

const { status, data } = await apiInstance.mockMonitorCollect();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mockMonitorError**
> any mockMonitorError()


### Example

```typescript
import {
    JavaBackendMockApiApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new JavaBackendMockApiApi(configuration);

const { status, data } = await apiInstance.mockMonitorError();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mockMonitorPerf**
> any mockMonitorPerf()


### Example

```typescript
import {
    JavaBackendMockApiApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new JavaBackendMockApiApi(configuration);

const { status, data } = await apiInstance.mockMonitorPerf();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mockOpenclawSessions**
> any mockOpenclawSessions()


### Example

```typescript
import {
    JavaBackendMockApiApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new JavaBackendMockApiApi(configuration);

const { status, data } = await apiInstance.mockOpenclawSessions();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mockOpenclawTools**
> any mockOpenclawTools()


### Example

```typescript
import {
    JavaBackendMockApiApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new JavaBackendMockApiApi(configuration);

const { status, data } = await apiInstance.mockOpenclawTools();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mockOrderCreate**
> any mockOrderCreate()


### Example

```typescript
import {
    JavaBackendMockApiApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new JavaBackendMockApiApi(configuration);

const { status, data } = await apiInstance.mockOrderCreate();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mockOrdersList**
> any mockOrdersList()


### Example

```typescript
import {
    JavaBackendMockApiApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new JavaBackendMockApiApi(configuration);

const { status, data } = await apiInstance.mockOrdersList();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mockPaymentCheck**
> any mockPaymentCheck()


### Example

```typescript
import {
    JavaBackendMockApiApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new JavaBackendMockApiApi(configuration);

const { status, data } = await apiInstance.mockPaymentCheck();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mockPaymentCreate**
> any mockPaymentCreate()


### Example

```typescript
import {
    JavaBackendMockApiApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new JavaBackendMockApiApi(configuration);

const { status, data } = await apiInstance.mockPaymentCreate();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mockPlazaDemandDetail**
> any mockPlazaDemandDetail()


### Example

```typescript
import {
    JavaBackendMockApiApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new JavaBackendMockApiApi(configuration);

let demandId: number; // (default to undefined)

const { status, data } = await apiInstance.mockPlazaDemandDetail(
    demandId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **demandId** | [**number**] |  | defaults to undefined|


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mockPlazaDemandsList**
> any mockPlazaDemandsList()


### Example

```typescript
import {
    JavaBackendMockApiApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new JavaBackendMockApiApi(configuration);

const { status, data } = await apiInstance.mockPlazaDemandsList();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mockPlazaInfo**
> any mockPlazaInfo()


### Example

```typescript
import {
    JavaBackendMockApiApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new JavaBackendMockApiApi(configuration);

let categoryId: number; // (default to undefined)

const { status, data } = await apiInstance.mockPlazaInfo(
    categoryId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **categoryId** | [**number**] |  | defaults to undefined|


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mockPlazaList**
> any mockPlazaList()


### Example

```typescript
import {
    JavaBackendMockApiApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new JavaBackendMockApiApi(configuration);

const { status, data } = await apiInstance.mockPlazaList();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mockRechargeConfig**
> any mockRechargeConfig()


### Example

```typescript
import {
    JavaBackendMockApiApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new JavaBackendMockApiApi(configuration);

const { status, data } = await apiInstance.mockRechargeConfig();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mockRechargeCreate**
> any mockRechargeCreate()


### Example

```typescript
import {
    JavaBackendMockApiApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new JavaBackendMockApiApi(configuration);

const { status, data } = await apiInstance.mockRechargeCreate();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mockSaList**
> any mockSaList()


### Example

```typescript
import {
    JavaBackendMockApiApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new JavaBackendMockApiApi(configuration);

const { status, data } = await apiInstance.mockSaList();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mockSkillsList**
> any mockSkillsList()


### Example

```typescript
import {
    JavaBackendMockApiApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new JavaBackendMockApiApi(configuration);

const { status, data } = await apiInstance.mockSkillsList();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mockSkillsMetadata**
> any mockSkillsMetadata()


### Example

```typescript
import {
    JavaBackendMockApiApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new JavaBackendMockApiApi(configuration);

const { status, data } = await apiInstance.mockSkillsMetadata();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mockSpeechToken**
> any mockSpeechToken()


### Example

```typescript
import {
    JavaBackendMockApiApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new JavaBackendMockApiApi(configuration);

const { status, data } = await apiInstance.mockSpeechToken();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mockStatsDashboard**
> any mockStatsDashboard()


### Example

```typescript
import {
    JavaBackendMockApiApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new JavaBackendMockApiApi(configuration);

const { status, data } = await apiInstance.mockStatsDashboard();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mockStatsOverview**
> any mockStatsOverview()


### Example

```typescript
import {
    JavaBackendMockApiApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new JavaBackendMockApiApi(configuration);

const { status, data } = await apiInstance.mockStatsOverview();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mockUnifiedAiCaps**
> any mockUnifiedAiCaps()


### Example

```typescript
import {
    JavaBackendMockApiApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new JavaBackendMockApiApi(configuration);

const { status, data } = await apiInstance.mockUnifiedAiCaps();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mockUnifiedAiInvoke**
> any mockUnifiedAiInvoke()


### Example

```typescript
import {
    JavaBackendMockApiApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new JavaBackendMockApiApi(configuration);

const { status, data } = await apiInstance.mockUnifiedAiInvoke();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mockUploadFileDelete**
> any mockUploadFileDelete()


### Example

```typescript
import {
    JavaBackendMockApiApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new JavaBackendMockApiApi(configuration);

let fileId: string; // (default to undefined)

const { status, data } = await apiInstance.mockUploadFileDelete(
    fileId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **fileId** | [**string**] |  | defaults to undefined|


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mockUploadFiles**
> any mockUploadFiles()


### Example

```typescript
import {
    JavaBackendMockApiApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new JavaBackendMockApiApi(configuration);

const { status, data } = await apiInstance.mockUploadFiles();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mockUploadSingle**
> any mockUploadSingle()


### Example

```typescript
import {
    JavaBackendMockApiApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new JavaBackendMockApiApi(configuration);

const { status, data } = await apiInstance.mockUploadSingle();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mockUserApiBalance**
> any mockUserApiBalance()


### Example

```typescript
import {
    JavaBackendMockApiApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new JavaBackendMockApiApi(configuration);

const { status, data } = await apiInstance.mockUserApiBalance();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mockUserApiTokens**
> any mockUserApiTokens()


### Example

```typescript
import {
    JavaBackendMockApiApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new JavaBackendMockApiApi(configuration);

const { status, data } = await apiInstance.mockUserApiTokens();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mockUserApiUsageStats**
> any mockUserApiUsageStats()


### Example

```typescript
import {
    JavaBackendMockApiApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new JavaBackendMockApiApi(configuration);

const { status, data } = await apiInstance.mockUserApiUsageStats();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mockUserGetInfo**
> any mockUserGetInfo()


### Example

```typescript
import {
    JavaBackendMockApiApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new JavaBackendMockApiApi(configuration);

const { status, data } = await apiInstance.mockUserGetInfo();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mockUserLoginPost**
> any mockUserLoginPost()


### Example

```typescript
import {
    JavaBackendMockApiApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new JavaBackendMockApiApi(configuration);

const { status, data } = await apiInstance.mockUserLoginPost();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mockUserLogoutPost**
> any mockUserLogoutPost()


### Example

```typescript
import {
    JavaBackendMockApiApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new JavaBackendMockApiApi(configuration);

const { status, data } = await apiInstance.mockUserLogoutPost();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mockUserProfile**
> any mockUserProfile()


### Example

```typescript
import {
    JavaBackendMockApiApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new JavaBackendMockApiApi(configuration);

const { status, data } = await apiInstance.mockUserProfile();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mockUserProfilePut**
> any mockUserProfilePut()


### Example

```typescript
import {
    JavaBackendMockApiApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new JavaBackendMockApiApi(configuration);

const { status, data } = await apiInstance.mockUserProfilePut();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mockVipLevels**
> any mockVipLevels()


### Example

```typescript
import {
    JavaBackendMockApiApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new JavaBackendMockApiApi(configuration);

const { status, data } = await apiInstance.mockVipLevels();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mockVipOrderCreate**
> any mockVipOrderCreate()


### Example

```typescript
import {
    JavaBackendMockApiApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new JavaBackendMockApiApi(configuration);

const { status, data } = await apiInstance.mockVipOrderCreate();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mockVipPlans**
> any mockVipPlans()


### Example

```typescript
import {
    JavaBackendMockApiApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new JavaBackendMockApiApi(configuration);

const { status, data } = await apiInstance.mockVipPlans();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mockVipPrivileges**
> any mockVipPrivileges()


### Example

```typescript
import {
    JavaBackendMockApiApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new JavaBackendMockApiApi(configuration);

const { status, data } = await apiInstance.mockVipPrivileges();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mockWalletInfo**
> any mockWalletInfo()


### Example

```typescript
import {
    JavaBackendMockApiApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new JavaBackendMockApiApi(configuration);

const { status, data } = await apiInstance.mockWalletInfo();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mockWalletTransactions**
> any mockWalletTransactions()


### Example

```typescript
import {
    JavaBackendMockApiApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new JavaBackendMockApiApi(configuration);

const { status, data } = await apiInstance.mockWalletTransactions();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

