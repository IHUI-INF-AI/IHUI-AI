# JavaBackendMockApiApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**mockAddPlazaModel**](JavaBackendMockApiApi.md#mockaddplazamodel) | **POST** /api/category/addPlazaModel | Mock: 添加 Plaza 模型 |
| [**mockAdminLogin**](JavaBackendMockApiApi.md#mockadminlogin) | **POST** /api/admin/login | Mock Admin Login |
| [**mockAdminMenus**](JavaBackendMockApiApi.md#mockadminmenus) | **GET** /api/admin/menus | Mock Admin Menus |
| [**mockAdminRoles**](JavaBackendMockApiApi.md#mockadminroles) | **GET** /api/admin/roles | Mock Admin Roles |
| [**mockAdminUsers**](JavaBackendMockApiApi.md#mockadminusers) | **GET** /api/admin/users | Mock Admin Users |
| [**mockAgentBylink**](JavaBackendMockApiApi.md#mockagentbylink) | **GET** /api/agent/rule/search/bylink | Mock Agent Bylink |
| [**mockAgentCategories**](JavaBackendMockApiApi.md#mockagentcategories) | **GET** /api/agent/categories | Mock Agent Categories |
| [**mockAgentCollect**](JavaBackendMockApiApi.md#mockagentcollect) | **POST** /api/agent/collect/{agent_id} | Mock Agent Collect |
| [**mockAgentLike**](JavaBackendMockApiApi.md#mockagentlike) | **POST** /api/agent/like/{agent_id} | Mock Agent Like |
| [**mockAgentsCategories**](JavaBackendMockApiApi.md#mockagentscategories) | **GET** /api/agents/categories | Mock Agents Categories |
| [**mockAiChat**](JavaBackendMockApiApi.md#mockaichat) | **POST** /api/ai/chat | Mock Ai Chat |
| [**mockAiGenerate**](JavaBackendMockApiApi.md#mockaigenerate) | **POST** /api/ai/generate | Mock Ai Generate |
| [**mockAiModels**](JavaBackendMockApiApi.md#mockaimodels) | **GET** /api/ai/models | Mock Ai Models |
| [**mockAiProgramLogin**](JavaBackendMockApiApi.md#mockaiprogramlogin) | **POST** /api/ai-program/login/pwd/login | Mock Ai Program Login |
| [**mockAiProgramPlaza**](JavaBackendMockApiApi.md#mockaiprogramplaza) | **GET** /api/ai-program/plaza | Mock Ai Program Plaza |
| [**mockAuditLogs**](JavaBackendMockApiApi.md#mockauditlogs) | **GET** /api/audit/logs | Mock Audit Logs |
| [**mockAuditStats**](JavaBackendMockApiApi.md#mockauditstats) | **GET** /api/audit/stats | Mock Audit Stats |
| [**mockAuthHealth**](JavaBackendMockApiApi.md#mockauthhealth) | **GET** /api/auth/health | Mock Auth Health |
| [**mockAuthLoginPost**](JavaBackendMockApiApi.md#mockauthloginpost) | **POST** /api/auth/login | Mock Auth Login Post |
| [**mockAuthLogoutPost**](JavaBackendMockApiApi.md#mockauthlogoutpost) | **POST** /api/auth/logout | Mock Auth Logout Post |
| [**mockAuthProfile**](JavaBackendMockApiApi.md#mockauthprofile) | **GET** /api/auth/profile | Mock Auth Profile |
| [**mockAuthRefreshPost**](JavaBackendMockApiApi.md#mockauthrefreshpost) | **POST** /api/auth/refresh | Mock Auth Refresh Post |
| [**mockAuthRegisterPost**](JavaBackendMockApiApi.md#mockauthregisterpost) | **POST** /api/auth/register | Mock Auth Register Post |
| [**mockAuthUserInfo**](JavaBackendMockApiApi.md#mockauthuserinfo) | **GET** /api/auth/user-info | Mock Auth User Info |
| [**mockCategoryList**](JavaBackendMockApiApi.md#mockcategorylist) | **GET** /api/category/list | Mock: 智能体分类列表 |
| [**mockCoursesList**](JavaBackendMockApiApi.md#mockcourseslist) | **GET** /api/courses | Mock Courses List |
| [**mockCoursesMy**](JavaBackendMockApiApi.md#mockcoursesmy) | **GET** /api/courses/my | Mock Courses My |
| [**mockCsFaqs**](JavaBackendMockApiApi.md#mockcsfaqs) | **GET** /api/customer-service/faqs | Mock Cs Faqs |
| [**mockCsTickets**](JavaBackendMockApiApi.md#mockcstickets) | **GET** /api/customer-service/tickets | Mock Cs Tickets |
| [**mockDeveloperModels**](JavaBackendMockApiApi.md#mockdevelopermodels) | **GET** /api/developer/models | Mock: 开发者模型列表 |
| [**mockFeatureFlags**](JavaBackendMockApiApi.md#mockfeatureflags) | **GET** /api/feature-flags | Mock Feature Flags |
| [**mockFfExperiments**](JavaBackendMockApiApi.md#mockffexperiments) | **GET** /api/feature-flags/experiments | Mock Ff Experiments |
| [**mockFundAliPay**](JavaBackendMockApiApi.md#mockfundalipay) | **POST** /api/fund/ali/pay | Mock Fund Ali Pay |
| [**mockFundWxPay**](JavaBackendMockApiApi.md#mockfundwxpay) | **POST** /api/fund/wx/pay | Mock Fund Wx Pay |
| [**mockLoginPwdLogin**](JavaBackendMockApiApi.md#mockloginpwdlogin) | **POST** /api/login/pwd/login | Mock Login Pwd Login |
| [**mockLoginPwdRefresh**](JavaBackendMockApiApi.md#mockloginpwdrefresh) | **POST** /api/login/pwd/refreshToken | Mock Login Pwd Refresh |
| [**mockLoginPwdRegister**](JavaBackendMockApiApi.md#mockloginpwdregister) | **POST** /api/login/pwd/registerLogin | Mock Login Pwd Register |
| [**mockLoginPwdSmsVerify**](JavaBackendMockApiApi.md#mockloginpwdsmsverify) | **POST** /api/login/pwd/smsVerify | Mock Login Pwd Sms Verify |
| [**mockLoginPwdVerify**](JavaBackendMockApiApi.md#mockloginpwdverify) | **POST** /api/login/pwd/verify | Mock Login Pwd Verify |
| [**mockMobileOrders**](JavaBackendMockApiApi.md#mockmobileorders) | **GET** /api/mobile/orders/list | Mock Mobile Orders |
| [**mockModelsPricing**](JavaBackendMockApiApi.md#mockmodelspricing) | **GET** /api/models/pricing | Mock Models Pricing |
| [**mockMonitorCollect**](JavaBackendMockApiApi.md#mockmonitorcollect) | **POST** /api/monitor/collect | Mock: 前端监控埋点 |
| [**mockMonitorError**](JavaBackendMockApiApi.md#mockmonitorerror) | **POST** /api/monitor/error | Mock: 前端错误上报 |
| [**mockMonitorPerf**](JavaBackendMockApiApi.md#mockmonitorperf) | **POST** /api/monitor/performance | Mock: 前端性能上报 |
| [**mockOpenclawSessions**](JavaBackendMockApiApi.md#mockopenclawsessions) | **GET** /api/openclaw/sessions | Mock: OpenClaw 会话列表 |
| [**mockOpenclawTools**](JavaBackendMockApiApi.md#mockopenclawtools) | **GET** /api/openclaw/tools | Mock: OpenClaw 工具列表 |
| [**mockOrderCreate**](JavaBackendMockApiApi.md#mockordercreate) | **POST** /api/order/create | Mock Order Create |
| [**mockOrdersList**](JavaBackendMockApiApi.md#mockorderslist) | **GET** /api/orders | Mock Orders List |
| [**mockPaymentCheck**](JavaBackendMockApiApi.md#mockpaymentcheck) | **GET** /api/payment/checkOrderStatus | Mock Payment Check |
| [**mockPaymentCreate**](JavaBackendMockApiApi.md#mockpaymentcreate) | **POST** /api/payment/createOrder | Mock Payment Create |
| [**mockPlazaDemandDetail**](JavaBackendMockApiApi.md#mockplazademanddetail) | **GET** /api/ai-program/plaza/demands/{demand_id} | Mock Plaza Demand Detail |
| [**mockPlazaDemandsList**](JavaBackendMockApiApi.md#mockplazademandslist) | **GET** /api/ai-program/plaza/demands/list | Mock Plaza Demands List |
| [**mockPlazaInfo**](JavaBackendMockApiApi.md#mockplazainfo) | **GET** /api/category/getPlazaInfoById/{category_id} | Mock: Plaza 分类详情 |
| [**mockPlazaList**](JavaBackendMockApiApi.md#mockplazalist) | **GET** /api/category/getPlazaList | Mock: Plaza 分类列表 |
| [**mockRechargeConfig**](JavaBackendMockApiApi.md#mockrechargeconfig) | **GET** /api/recharge/config | Mock Recharge Config |
| [**mockRechargeCreate**](JavaBackendMockApiApi.md#mockrechargecreate) | **POST** /api/recharge/create | Mock Recharge Create |
| [**mockSaList**](JavaBackendMockApiApi.md#mocksalist) | **GET** /api/service-appointment | Mock Sa List |
| [**mockSkillsList**](JavaBackendMockApiApi.md#mockskillslist) | **GET** /api/skills/list | Mock Skills List |
| [**mockSkillsMetadata**](JavaBackendMockApiApi.md#mockskillsmetadata) | **GET** /api/skills/metadata | Mock Skills Metadata |
| [**mockSpeechToken**](JavaBackendMockApiApi.md#mockspeechtoken) | **GET** /api/speech/baidu/token | Mock Speech Token |
| [**mockStatsDashboard**](JavaBackendMockApiApi.md#mockstatsdashboard) | **GET** /api/statistics/dashboard | Mock: 仪表盘统计 |
| [**mockStatsOverview**](JavaBackendMockApiApi.md#mockstatsoverview) | **GET** /api/statistics/overview | Mock: 总览统计 |
| [**mockUnifiedAiCaps**](JavaBackendMockApiApi.md#mockunifiedaicaps) | **GET** /api/unified-ai/capabilities | Mock Unified Ai Caps |
| [**mockUnifiedAiInvoke**](JavaBackendMockApiApi.md#mockunifiedaiinvoke) | **POST** /api/unified-ai/invoke | Mock Unified Ai Invoke |
| [**mockUploadFileDelete**](JavaBackendMockApiApi.md#mockuploadfiledelete) | **DELETE** /api/upload/file/{file_id} | Mock Upload File Delete |
| [**mockUploadFiles**](JavaBackendMockApiApi.md#mockuploadfiles) | **POST** /api/upload/files | Mock Upload Files |
| [**mockUploadSingle**](JavaBackendMockApiApi.md#mockuploadsingle) | **POST** /api/upload/single | Mock Upload Single |
| [**mockUserApiBalance**](JavaBackendMockApiApi.md#mockuserapibalance) | **GET** /api/user/api-balance | Mock User Api Balance |
| [**mockUserApiTokens**](JavaBackendMockApiApi.md#mockuserapitokens) | **GET** /api/user/api-tokens | Mock User Api Tokens |
| [**mockUserApiUsageStats**](JavaBackendMockApiApi.md#mockuserapiusagestats) | **GET** /api/user/api-usage/stats | Mock User Api Usage Stats |
| [**mockUserGetInfo**](JavaBackendMockApiApi.md#mockusergetinfo) | **GET** /api/user/getUserInfo | Mock User Get Info |
| [**mockUserLoginPost**](JavaBackendMockApiApi.md#mockuserloginpost) | **POST** /api/user/login | Mock User Login Post |
| [**mockUserLogoutPost**](JavaBackendMockApiApi.md#mockuserlogoutpost) | **POST** /api/user/logout | Mock User Logout Post |
| [**mockUserProfile**](JavaBackendMockApiApi.md#mockuserprofile) | **GET** /api/user/profile | Mock User Profile |
| [**mockUserProfilePut**](JavaBackendMockApiApi.md#mockuserprofileput) | **PUT** /api/user/profile | Mock User Profile Put |
| [**mockVipLevels**](JavaBackendMockApiApi.md#mockviplevels) | **GET** /api/vip/levels | Mock Vip Levels |
| [**mockVipOrderCreate**](JavaBackendMockApiApi.md#mockvipordercreate) | **POST** /api/vip/order/create | Mock Vip Order Create |
| [**mockVipPlans**](JavaBackendMockApiApi.md#mockvipplans) | **GET** /api/vip/plans | Mock Vip Plans |
| [**mockVipPrivileges**](JavaBackendMockApiApi.md#mockvipprivileges) | **GET** /api/vip/privileges | Mock Vip Privileges |
| [**mockWalletInfo**](JavaBackendMockApiApi.md#mockwalletinfo) | **GET** /api/wallet/info | Mock Wallet Info |
| [**mockWalletTransactions**](JavaBackendMockApiApi.md#mockwallettransactions) | **GET** /api/wallet/transactions | Mock Wallet Transactions |



## mockAddPlazaModel

> any mockAddPlazaModel()

Mock: 添加 Plaza 模型

### Example

```ts
import {
  Configuration,
  JavaBackendMockApiApi,
} from '';
import type { MockAddPlazaModelRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new JavaBackendMockApiApi();

  try {
    const data = await api.mockAddPlazaModel();
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

This endpoint does not need any parameter.

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## mockAdminLogin

> any mockAdminLogin()

Mock Admin Login

### Example

```ts
import {
  Configuration,
  JavaBackendMockApiApi,
} from '';
import type { MockAdminLoginRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new JavaBackendMockApiApi();

  try {
    const data = await api.mockAdminLogin();
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

This endpoint does not need any parameter.

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## mockAdminMenus

> any mockAdminMenus()

Mock Admin Menus

### Example

```ts
import {
  Configuration,
  JavaBackendMockApiApi,
} from '';
import type { MockAdminMenusRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new JavaBackendMockApiApi();

  try {
    const data = await api.mockAdminMenus();
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

This endpoint does not need any parameter.

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## mockAdminRoles

> any mockAdminRoles()

Mock Admin Roles

### Example

```ts
import {
  Configuration,
  JavaBackendMockApiApi,
} from '';
import type { MockAdminRolesRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new JavaBackendMockApiApi();

  try {
    const data = await api.mockAdminRoles();
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

This endpoint does not need any parameter.

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## mockAdminUsers

> any mockAdminUsers()

Mock Admin Users

### Example

```ts
import {
  Configuration,
  JavaBackendMockApiApi,
} from '';
import type { MockAdminUsersRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new JavaBackendMockApiApi();

  try {
    const data = await api.mockAdminUsers();
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

This endpoint does not need any parameter.

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## mockAgentBylink

> any mockAgentBylink()

Mock Agent Bylink

返回按主分类分组的智能体列表 (兼容前端 AgentsSquareList 期望格式).

### Example

```ts
import {
  Configuration,
  JavaBackendMockApiApi,
} from '';
import type { MockAgentBylinkRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new JavaBackendMockApiApi();

  try {
    const data = await api.mockAgentBylink();
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

This endpoint does not need any parameter.

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## mockAgentCategories

> any mockAgentCategories()

Mock Agent Categories

返回智能体分类 (主分类 + 子分类).

### Example

```ts
import {
  Configuration,
  JavaBackendMockApiApi,
} from '';
import type { MockAgentCategoriesRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new JavaBackendMockApiApi();

  try {
    const data = await api.mockAgentCategories();
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

This endpoint does not need any parameter.

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## mockAgentCollect

> any mockAgentCollect(agentId)

Mock Agent Collect

### Example

```ts
import {
  Configuration,
  JavaBackendMockApiApi,
} from '';
import type { MockAgentCollectRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new JavaBackendMockApiApi();

  const body = {
    // string
    agentId: agentId_example,
  } satisfies MockAgentCollectRequest;

  try {
    const data = await api.mockAgentCollect(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **agentId** | `string` |  | [Defaults to `undefined`] |

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## mockAgentLike

> any mockAgentLike(agentId)

Mock Agent Like

### Example

```ts
import {
  Configuration,
  JavaBackendMockApiApi,
} from '';
import type { MockAgentLikeRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new JavaBackendMockApiApi();

  const body = {
    // string
    agentId: agentId_example,
  } satisfies MockAgentLikeRequest;

  try {
    const data = await api.mockAgentLike(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **agentId** | `string` |  | [Defaults to `undefined`] |

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## mockAgentsCategories

> any mockAgentsCategories()

Mock Agents Categories

### Example

```ts
import {
  Configuration,
  JavaBackendMockApiApi,
} from '';
import type { MockAgentsCategoriesRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new JavaBackendMockApiApi();

  try {
    const data = await api.mockAgentsCategories();
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

This endpoint does not need any parameter.

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## mockAiChat

> any mockAiChat()

Mock Ai Chat

### Example

```ts
import {
  Configuration,
  JavaBackendMockApiApi,
} from '';
import type { MockAiChatRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new JavaBackendMockApiApi();

  try {
    const data = await api.mockAiChat();
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

This endpoint does not need any parameter.

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## mockAiGenerate

> any mockAiGenerate()

Mock Ai Generate

### Example

```ts
import {
  Configuration,
  JavaBackendMockApiApi,
} from '';
import type { MockAiGenerateRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new JavaBackendMockApiApi();

  try {
    const data = await api.mockAiGenerate();
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

This endpoint does not need any parameter.

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## mockAiModels

> any mockAiModels()

Mock Ai Models

### Example

```ts
import {
  Configuration,
  JavaBackendMockApiApi,
} from '';
import type { MockAiModelsRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new JavaBackendMockApiApi();

  try {
    const data = await api.mockAiModels();
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

This endpoint does not need any parameter.

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## mockAiProgramLogin

> any mockAiProgramLogin()

Mock Ai Program Login

### Example

```ts
import {
  Configuration,
  JavaBackendMockApiApi,
} from '';
import type { MockAiProgramLoginRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new JavaBackendMockApiApi();

  try {
    const data = await api.mockAiProgramLogin();
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

This endpoint does not need any parameter.

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## mockAiProgramPlaza

> any mockAiProgramPlaza()

Mock Ai Program Plaza

### Example

```ts
import {
  Configuration,
  JavaBackendMockApiApi,
} from '';
import type { MockAiProgramPlazaRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new JavaBackendMockApiApi();

  try {
    const data = await api.mockAiProgramPlaza();
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

This endpoint does not need any parameter.

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## mockAuditLogs

> any mockAuditLogs()

Mock Audit Logs

### Example

```ts
import {
  Configuration,
  JavaBackendMockApiApi,
} from '';
import type { MockAuditLogsRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new JavaBackendMockApiApi();

  try {
    const data = await api.mockAuditLogs();
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

This endpoint does not need any parameter.

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## mockAuditStats

> any mockAuditStats()

Mock Audit Stats

### Example

```ts
import {
  Configuration,
  JavaBackendMockApiApi,
} from '';
import type { MockAuditStatsRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new JavaBackendMockApiApi();

  try {
    const data = await api.mockAuditStats();
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

This endpoint does not need any parameter.

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## mockAuthHealth

> any mockAuthHealth()

Mock Auth Health

### Example

```ts
import {
  Configuration,
  JavaBackendMockApiApi,
} from '';
import type { MockAuthHealthRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new JavaBackendMockApiApi();

  try {
    const data = await api.mockAuthHealth();
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

This endpoint does not need any parameter.

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## mockAuthLoginPost

> any mockAuthLoginPost()

Mock Auth Login Post

### Example

```ts
import {
  Configuration,
  JavaBackendMockApiApi,
} from '';
import type { MockAuthLoginPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new JavaBackendMockApiApi();

  try {
    const data = await api.mockAuthLoginPost();
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

This endpoint does not need any parameter.

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## mockAuthLogoutPost

> any mockAuthLogoutPost()

Mock Auth Logout Post

### Example

```ts
import {
  Configuration,
  JavaBackendMockApiApi,
} from '';
import type { MockAuthLogoutPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new JavaBackendMockApiApi();

  try {
    const data = await api.mockAuthLogoutPost();
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

This endpoint does not need any parameter.

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## mockAuthProfile

> any mockAuthProfile()

Mock Auth Profile

### Example

```ts
import {
  Configuration,
  JavaBackendMockApiApi,
} from '';
import type { MockAuthProfileRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new JavaBackendMockApiApi();

  try {
    const data = await api.mockAuthProfile();
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

This endpoint does not need any parameter.

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## mockAuthRefreshPost

> any mockAuthRefreshPost()

Mock Auth Refresh Post

### Example

```ts
import {
  Configuration,
  JavaBackendMockApiApi,
} from '';
import type { MockAuthRefreshPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new JavaBackendMockApiApi();

  try {
    const data = await api.mockAuthRefreshPost();
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

This endpoint does not need any parameter.

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## mockAuthRegisterPost

> any mockAuthRegisterPost()

Mock Auth Register Post

### Example

```ts
import {
  Configuration,
  JavaBackendMockApiApi,
} from '';
import type { MockAuthRegisterPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new JavaBackendMockApiApi();

  try {
    const data = await api.mockAuthRegisterPost();
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

This endpoint does not need any parameter.

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## mockAuthUserInfo

> any mockAuthUserInfo()

Mock Auth User Info

### Example

```ts
import {
  Configuration,
  JavaBackendMockApiApi,
} from '';
import type { MockAuthUserInfoRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new JavaBackendMockApiApi();

  try {
    const data = await api.mockAuthUserInfo();
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

This endpoint does not need any parameter.

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## mockCategoryList

> any mockCategoryList()

Mock: 智能体分类列表

### Example

```ts
import {
  Configuration,
  JavaBackendMockApiApi,
} from '';
import type { MockCategoryListRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new JavaBackendMockApiApi();

  try {
    const data = await api.mockCategoryList();
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

This endpoint does not need any parameter.

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## mockCoursesList

> any mockCoursesList()

Mock Courses List

### Example

```ts
import {
  Configuration,
  JavaBackendMockApiApi,
} from '';
import type { MockCoursesListRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new JavaBackendMockApiApi();

  try {
    const data = await api.mockCoursesList();
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

This endpoint does not need any parameter.

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## mockCoursesMy

> any mockCoursesMy()

Mock Courses My

### Example

```ts
import {
  Configuration,
  JavaBackendMockApiApi,
} from '';
import type { MockCoursesMyRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new JavaBackendMockApiApi();

  try {
    const data = await api.mockCoursesMy();
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

This endpoint does not need any parameter.

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## mockCsFaqs

> any mockCsFaqs()

Mock Cs Faqs

### Example

```ts
import {
  Configuration,
  JavaBackendMockApiApi,
} from '';
import type { MockCsFaqsRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new JavaBackendMockApiApi();

  try {
    const data = await api.mockCsFaqs();
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

This endpoint does not need any parameter.

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## mockCsTickets

> any mockCsTickets()

Mock Cs Tickets

### Example

```ts
import {
  Configuration,
  JavaBackendMockApiApi,
} from '';
import type { MockCsTicketsRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new JavaBackendMockApiApi();

  try {
    const data = await api.mockCsTickets();
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

This endpoint does not need any parameter.

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## mockDeveloperModels

> any mockDeveloperModels()

Mock: 开发者模型列表

### Example

```ts
import {
  Configuration,
  JavaBackendMockApiApi,
} from '';
import type { MockDeveloperModelsRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new JavaBackendMockApiApi();

  try {
    const data = await api.mockDeveloperModels();
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

This endpoint does not need any parameter.

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## mockFeatureFlags

> any mockFeatureFlags()

Mock Feature Flags

### Example

```ts
import {
  Configuration,
  JavaBackendMockApiApi,
} from '';
import type { MockFeatureFlagsRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new JavaBackendMockApiApi();

  try {
    const data = await api.mockFeatureFlags();
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

This endpoint does not need any parameter.

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## mockFfExperiments

> any mockFfExperiments()

Mock Ff Experiments

### Example

```ts
import {
  Configuration,
  JavaBackendMockApiApi,
} from '';
import type { MockFfExperimentsRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new JavaBackendMockApiApi();

  try {
    const data = await api.mockFfExperiments();
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

This endpoint does not need any parameter.

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## mockFundAliPay

> any mockFundAliPay()

Mock Fund Ali Pay

### Example

```ts
import {
  Configuration,
  JavaBackendMockApiApi,
} from '';
import type { MockFundAliPayRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new JavaBackendMockApiApi();

  try {
    const data = await api.mockFundAliPay();
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

This endpoint does not need any parameter.

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## mockFundWxPay

> any mockFundWxPay()

Mock Fund Wx Pay

### Example

```ts
import {
  Configuration,
  JavaBackendMockApiApi,
} from '';
import type { MockFundWxPayRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new JavaBackendMockApiApi();

  try {
    const data = await api.mockFundWxPay();
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

This endpoint does not need any parameter.

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## mockLoginPwdLogin

> any mockLoginPwdLogin()

Mock Login Pwd Login

### Example

```ts
import {
  Configuration,
  JavaBackendMockApiApi,
} from '';
import type { MockLoginPwdLoginRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new JavaBackendMockApiApi();

  try {
    const data = await api.mockLoginPwdLogin();
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

This endpoint does not need any parameter.

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## mockLoginPwdRefresh

> any mockLoginPwdRefresh()

Mock Login Pwd Refresh

刷新 token - mock 返回真实 JWT, 让前端后续请求能通过鉴权.

### Example

```ts
import {
  Configuration,
  JavaBackendMockApiApi,
} from '';
import type { MockLoginPwdRefreshRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new JavaBackendMockApiApi();

  try {
    const data = await api.mockLoginPwdRefresh();
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

This endpoint does not need any parameter.

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## mockLoginPwdRegister

> any mockLoginPwdRegister()

Mock Login Pwd Register

### Example

```ts
import {
  Configuration,
  JavaBackendMockApiApi,
} from '';
import type { MockLoginPwdRegisterRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new JavaBackendMockApiApi();

  try {
    const data = await api.mockLoginPwdRegister();
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

This endpoint does not need any parameter.

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## mockLoginPwdSmsVerify

> any mockLoginPwdSmsVerify()

Mock Login Pwd Sms Verify

发送手机验证码 - mock 始终返回成功, 但有 60s 限流 (Redis 持久化).

### Example

```ts
import {
  Configuration,
  JavaBackendMockApiApi,
} from '';
import type { MockLoginPwdSmsVerifyRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new JavaBackendMockApiApi();

  try {
    const data = await api.mockLoginPwdSmsVerify();
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

This endpoint does not need any parameter.

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## mockLoginPwdVerify

> any mockLoginPwdVerify()

Mock Login Pwd Verify

验证手机验证码 - mock 始终返回临时密钥.

### Example

```ts
import {
  Configuration,
  JavaBackendMockApiApi,
} from '';
import type { MockLoginPwdVerifyRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new JavaBackendMockApiApi();

  try {
    const data = await api.mockLoginPwdVerify();
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

This endpoint does not need any parameter.

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## mockMobileOrders

> any mockMobileOrders()

Mock Mobile Orders

### Example

```ts
import {
  Configuration,
  JavaBackendMockApiApi,
} from '';
import type { MockMobileOrdersRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new JavaBackendMockApiApi();

  try {
    const data = await api.mockMobileOrders();
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

This endpoint does not need any parameter.

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## mockModelsPricing

> any mockModelsPricing()

Mock Models Pricing

### Example

```ts
import {
  Configuration,
  JavaBackendMockApiApi,
} from '';
import type { MockModelsPricingRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new JavaBackendMockApiApi();

  try {
    const data = await api.mockModelsPricing();
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

This endpoint does not need any parameter.

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## mockMonitorCollect

> any mockMonitorCollect()

Mock: 前端监控埋点

### Example

```ts
import {
  Configuration,
  JavaBackendMockApiApi,
} from '';
import type { MockMonitorCollectRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new JavaBackendMockApiApi();

  try {
    const data = await api.mockMonitorCollect();
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

This endpoint does not need any parameter.

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## mockMonitorError

> any mockMonitorError()

Mock: 前端错误上报

### Example

```ts
import {
  Configuration,
  JavaBackendMockApiApi,
} from '';
import type { MockMonitorErrorRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new JavaBackendMockApiApi();

  try {
    const data = await api.mockMonitorError();
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

This endpoint does not need any parameter.

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## mockMonitorPerf

> any mockMonitorPerf()

Mock: 前端性能上报

### Example

```ts
import {
  Configuration,
  JavaBackendMockApiApi,
} from '';
import type { MockMonitorPerfRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new JavaBackendMockApiApi();

  try {
    const data = await api.mockMonitorPerf();
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

This endpoint does not need any parameter.

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## mockOpenclawSessions

> any mockOpenclawSessions()

Mock: OpenClaw 会话列表

### Example

```ts
import {
  Configuration,
  JavaBackendMockApiApi,
} from '';
import type { MockOpenclawSessionsRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new JavaBackendMockApiApi();

  try {
    const data = await api.mockOpenclawSessions();
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

This endpoint does not need any parameter.

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## mockOpenclawTools

> any mockOpenclawTools()

Mock: OpenClaw 工具列表

### Example

```ts
import {
  Configuration,
  JavaBackendMockApiApi,
} from '';
import type { MockOpenclawToolsRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new JavaBackendMockApiApi();

  try {
    const data = await api.mockOpenclawTools();
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

This endpoint does not need any parameter.

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## mockOrderCreate

> any mockOrderCreate()

Mock Order Create

### Example

```ts
import {
  Configuration,
  JavaBackendMockApiApi,
} from '';
import type { MockOrderCreateRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new JavaBackendMockApiApi();

  try {
    const data = await api.mockOrderCreate();
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

This endpoint does not need any parameter.

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## mockOrdersList

> any mockOrdersList()

Mock Orders List

### Example

```ts
import {
  Configuration,
  JavaBackendMockApiApi,
} from '';
import type { MockOrdersListRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new JavaBackendMockApiApi();

  try {
    const data = await api.mockOrdersList();
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

This endpoint does not need any parameter.

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## mockPaymentCheck

> any mockPaymentCheck()

Mock Payment Check

### Example

```ts
import {
  Configuration,
  JavaBackendMockApiApi,
} from '';
import type { MockPaymentCheckRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new JavaBackendMockApiApi();

  try {
    const data = await api.mockPaymentCheck();
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

This endpoint does not need any parameter.

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## mockPaymentCreate

> any mockPaymentCreate()

Mock Payment Create

### Example

```ts
import {
  Configuration,
  JavaBackendMockApiApi,
} from '';
import type { MockPaymentCreateRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new JavaBackendMockApiApi();

  try {
    const data = await api.mockPaymentCreate();
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

This endpoint does not need any parameter.

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## mockPlazaDemandDetail

> any mockPlazaDemandDetail(demandId)

Mock Plaza Demand Detail

### Example

```ts
import {
  Configuration,
  JavaBackendMockApiApi,
} from '';
import type { MockPlazaDemandDetailRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new JavaBackendMockApiApi();

  const body = {
    // number
    demandId: 56,
  } satisfies MockPlazaDemandDetailRequest;

  try {
    const data = await api.mockPlazaDemandDetail(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **demandId** | `number` |  | [Defaults to `undefined`] |

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## mockPlazaDemandsList

> any mockPlazaDemandsList()

Mock Plaza Demands List

### Example

```ts
import {
  Configuration,
  JavaBackendMockApiApi,
} from '';
import type { MockPlazaDemandsListRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new JavaBackendMockApiApi();

  try {
    const data = await api.mockPlazaDemandsList();
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

This endpoint does not need any parameter.

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## mockPlazaInfo

> any mockPlazaInfo(categoryId)

Mock: Plaza 分类详情

### Example

```ts
import {
  Configuration,
  JavaBackendMockApiApi,
} from '';
import type { MockPlazaInfoRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new JavaBackendMockApiApi();

  const body = {
    // number
    categoryId: 56,
  } satisfies MockPlazaInfoRequest;

  try {
    const data = await api.mockPlazaInfo(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **categoryId** | `number` |  | [Defaults to `undefined`] |

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## mockPlazaList

> any mockPlazaList()

Mock: Plaza 分类列表

### Example

```ts
import {
  Configuration,
  JavaBackendMockApiApi,
} from '';
import type { MockPlazaListRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new JavaBackendMockApiApi();

  try {
    const data = await api.mockPlazaList();
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

This endpoint does not need any parameter.

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## mockRechargeConfig

> any mockRechargeConfig()

Mock Recharge Config

### Example

```ts
import {
  Configuration,
  JavaBackendMockApiApi,
} from '';
import type { MockRechargeConfigRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new JavaBackendMockApiApi();

  try {
    const data = await api.mockRechargeConfig();
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

This endpoint does not need any parameter.

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## mockRechargeCreate

> any mockRechargeCreate()

Mock Recharge Create

### Example

```ts
import {
  Configuration,
  JavaBackendMockApiApi,
} from '';
import type { MockRechargeCreateRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new JavaBackendMockApiApi();

  try {
    const data = await api.mockRechargeCreate();
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

This endpoint does not need any parameter.

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## mockSaList

> any mockSaList()

Mock Sa List

### Example

```ts
import {
  Configuration,
  JavaBackendMockApiApi,
} from '';
import type { MockSaListRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new JavaBackendMockApiApi();

  try {
    const data = await api.mockSaList();
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

This endpoint does not need any parameter.

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## mockSkillsList

> any mockSkillsList()

Mock Skills List

### Example

```ts
import {
  Configuration,
  JavaBackendMockApiApi,
} from '';
import type { MockSkillsListRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new JavaBackendMockApiApi();

  try {
    const data = await api.mockSkillsList();
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

This endpoint does not need any parameter.

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## mockSkillsMetadata

> any mockSkillsMetadata()

Mock Skills Metadata

### Example

```ts
import {
  Configuration,
  JavaBackendMockApiApi,
} from '';
import type { MockSkillsMetadataRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new JavaBackendMockApiApi();

  try {
    const data = await api.mockSkillsMetadata();
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

This endpoint does not need any parameter.

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## mockSpeechToken

> any mockSpeechToken()

Mock Speech Token

### Example

```ts
import {
  Configuration,
  JavaBackendMockApiApi,
} from '';
import type { MockSpeechTokenRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new JavaBackendMockApiApi();

  try {
    const data = await api.mockSpeechToken();
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

This endpoint does not need any parameter.

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## mockStatsDashboard

> any mockStatsDashboard()

Mock: 仪表盘统计

### Example

```ts
import {
  Configuration,
  JavaBackendMockApiApi,
} from '';
import type { MockStatsDashboardRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new JavaBackendMockApiApi();

  try {
    const data = await api.mockStatsDashboard();
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

This endpoint does not need any parameter.

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## mockStatsOverview

> any mockStatsOverview()

Mock: 总览统计

### Example

```ts
import {
  Configuration,
  JavaBackendMockApiApi,
} from '';
import type { MockStatsOverviewRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new JavaBackendMockApiApi();

  try {
    const data = await api.mockStatsOverview();
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

This endpoint does not need any parameter.

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## mockUnifiedAiCaps

> any mockUnifiedAiCaps()

Mock Unified Ai Caps

### Example

```ts
import {
  Configuration,
  JavaBackendMockApiApi,
} from '';
import type { MockUnifiedAiCapsRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new JavaBackendMockApiApi();

  try {
    const data = await api.mockUnifiedAiCaps();
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

This endpoint does not need any parameter.

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## mockUnifiedAiInvoke

> any mockUnifiedAiInvoke()

Mock Unified Ai Invoke

### Example

```ts
import {
  Configuration,
  JavaBackendMockApiApi,
} from '';
import type { MockUnifiedAiInvokeRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new JavaBackendMockApiApi();

  try {
    const data = await api.mockUnifiedAiInvoke();
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

This endpoint does not need any parameter.

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## mockUploadFileDelete

> any mockUploadFileDelete(fileId)

Mock Upload File Delete

### Example

```ts
import {
  Configuration,
  JavaBackendMockApiApi,
} from '';
import type { MockUploadFileDeleteRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new JavaBackendMockApiApi();

  const body = {
    // string
    fileId: fileId_example,
  } satisfies MockUploadFileDeleteRequest;

  try {
    const data = await api.mockUploadFileDelete(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **fileId** | `string` |  | [Defaults to `undefined`] |

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## mockUploadFiles

> any mockUploadFiles()

Mock Upload Files

### Example

```ts
import {
  Configuration,
  JavaBackendMockApiApi,
} from '';
import type { MockUploadFilesRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new JavaBackendMockApiApi();

  try {
    const data = await api.mockUploadFiles();
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

This endpoint does not need any parameter.

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## mockUploadSingle

> any mockUploadSingle()

Mock Upload Single

### Example

```ts
import {
  Configuration,
  JavaBackendMockApiApi,
} from '';
import type { MockUploadSingleRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new JavaBackendMockApiApi();

  try {
    const data = await api.mockUploadSingle();
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

This endpoint does not need any parameter.

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## mockUserApiBalance

> any mockUserApiBalance()

Mock User Api Balance

### Example

```ts
import {
  Configuration,
  JavaBackendMockApiApi,
} from '';
import type { MockUserApiBalanceRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new JavaBackendMockApiApi();

  try {
    const data = await api.mockUserApiBalance();
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

This endpoint does not need any parameter.

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## mockUserApiTokens

> any mockUserApiTokens()

Mock User Api Tokens

### Example

```ts
import {
  Configuration,
  JavaBackendMockApiApi,
} from '';
import type { MockUserApiTokensRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new JavaBackendMockApiApi();

  try {
    const data = await api.mockUserApiTokens();
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

This endpoint does not need any parameter.

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## mockUserApiUsageStats

> any mockUserApiUsageStats()

Mock User Api Usage Stats

### Example

```ts
import {
  Configuration,
  JavaBackendMockApiApi,
} from '';
import type { MockUserApiUsageStatsRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new JavaBackendMockApiApi();

  try {
    const data = await api.mockUserApiUsageStats();
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

This endpoint does not need any parameter.

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## mockUserGetInfo

> any mockUserGetInfo()

Mock User Get Info

### Example

```ts
import {
  Configuration,
  JavaBackendMockApiApi,
} from '';
import type { MockUserGetInfoRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new JavaBackendMockApiApi();

  try {
    const data = await api.mockUserGetInfo();
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

This endpoint does not need any parameter.

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## mockUserLoginPost

> any mockUserLoginPost()

Mock User Login Post

### Example

```ts
import {
  Configuration,
  JavaBackendMockApiApi,
} from '';
import type { MockUserLoginPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new JavaBackendMockApiApi();

  try {
    const data = await api.mockUserLoginPost();
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

This endpoint does not need any parameter.

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## mockUserLogoutPost

> any mockUserLogoutPost()

Mock User Logout Post

### Example

```ts
import {
  Configuration,
  JavaBackendMockApiApi,
} from '';
import type { MockUserLogoutPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new JavaBackendMockApiApi();

  try {
    const data = await api.mockUserLogoutPost();
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

This endpoint does not need any parameter.

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## mockUserProfile

> any mockUserProfile()

Mock User Profile

### Example

```ts
import {
  Configuration,
  JavaBackendMockApiApi,
} from '';
import type { MockUserProfileRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new JavaBackendMockApiApi();

  try {
    const data = await api.mockUserProfile();
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

This endpoint does not need any parameter.

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## mockUserProfilePut

> any mockUserProfilePut()

Mock User Profile Put

### Example

```ts
import {
  Configuration,
  JavaBackendMockApiApi,
} from '';
import type { MockUserProfilePutRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new JavaBackendMockApiApi();

  try {
    const data = await api.mockUserProfilePut();
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

This endpoint does not need any parameter.

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## mockVipLevels

> any mockVipLevels()

Mock Vip Levels

### Example

```ts
import {
  Configuration,
  JavaBackendMockApiApi,
} from '';
import type { MockVipLevelsRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new JavaBackendMockApiApi();

  try {
    const data = await api.mockVipLevels();
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

This endpoint does not need any parameter.

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## mockVipOrderCreate

> any mockVipOrderCreate()

Mock Vip Order Create

### Example

```ts
import {
  Configuration,
  JavaBackendMockApiApi,
} from '';
import type { MockVipOrderCreateRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new JavaBackendMockApiApi();

  try {
    const data = await api.mockVipOrderCreate();
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

This endpoint does not need any parameter.

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## mockVipPlans

> any mockVipPlans()

Mock Vip Plans

### Example

```ts
import {
  Configuration,
  JavaBackendMockApiApi,
} from '';
import type { MockVipPlansRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new JavaBackendMockApiApi();

  try {
    const data = await api.mockVipPlans();
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

This endpoint does not need any parameter.

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## mockVipPrivileges

> any mockVipPrivileges()

Mock Vip Privileges

### Example

```ts
import {
  Configuration,
  JavaBackendMockApiApi,
} from '';
import type { MockVipPrivilegesRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new JavaBackendMockApiApi();

  try {
    const data = await api.mockVipPrivileges();
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

This endpoint does not need any parameter.

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## mockWalletInfo

> any mockWalletInfo()

Mock Wallet Info

### Example

```ts
import {
  Configuration,
  JavaBackendMockApiApi,
} from '';
import type { MockWalletInfoRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new JavaBackendMockApiApi();

  try {
    const data = await api.mockWalletInfo();
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

This endpoint does not need any parameter.

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## mockWalletTransactions

> any mockWalletTransactions()

Mock Wallet Transactions

### Example

```ts
import {
  Configuration,
  JavaBackendMockApiApi,
} from '';
import type { MockWalletTransactionsRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new JavaBackendMockApiApi();

  try {
    const data = await api.mockWalletTransactions();
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

This endpoint does not need any parameter.

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

