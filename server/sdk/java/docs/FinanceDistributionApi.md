# FinanceDistributionApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**commissionDetailApiV1FinanceCommissionDetailGet**](FinanceDistributionApi.md#commissionDetailApiV1FinanceCommissionDetailGet) | **GET** /api/v1/finance/commission-detail | 佣金明细 |
| [**inviteeOrderStatsApiV1FinanceInviteeOrderStatsGet**](FinanceDistributionApi.md#inviteeOrderStatsApiV1FinanceInviteeOrderStatsGet) | **GET** /api/v1/finance/invitee-order-stats | 下级用户订单统计 |
| [**inviteeStatsApiV1FinanceInviteeStatsGet**](FinanceDistributionApi.md#inviteeStatsApiV1FinanceInviteeStatsGet) | **GET** /api/v1/finance/invitee-stats | 邀请统计 |
| [**listSubordinatesApiV1FinanceSubordinatesGet**](FinanceDistributionApi.md#listSubordinatesApiV1FinanceSubordinatesGet) | **GET** /api/v1/finance/subordinates | 我的下级用户列表 |
| [**listTeamApiV1FinanceTeamGet**](FinanceDistributionApi.md#listTeamApiV1FinanceTeamGet) | **GET** /api/v1/finance/team | 我的团队（下属列表+搜索排序） |
| [**operatorDataCardApiV1FinanceOperatorCardGet**](FinanceDistributionApi.md#operatorDataCardApiV1FinanceOperatorCardGet) | **GET** /api/v1/finance/operator-card | 操盘手数据卡片统计 |
| [**teamCenterApiV1FinanceTeamCenterGet**](FinanceDistributionApi.md#teamCenterApiV1FinanceTeamCenterGet) | **GET** /api/v1/finance/team/center | 个人中心我的团队（概要） |
| [**userAndChildrenOrdersApiV1FinanceUserAndChildrenOrdersGet**](FinanceDistributionApi.md#userAndChildrenOrdersApiV1FinanceUserAndChildrenOrdersGet) | **GET** /api/v1/finance/user-and-children-orders | 用户及下级的订单列表 |


<a id="commissionDetailApiV1FinanceCommissionDetailGet"></a>
# **commissionDetailApiV1FinanceCommissionDetailGet**
> Object commissionDetailApiV1FinanceCommissionDetailGet(page, limit)

佣金明细

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.FinanceDistributionApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    FinanceDistributionApi apiInstance = new FinanceDistributionApi(defaultClient);
    Integer page = 1; // Integer | 
    Integer limit = 20; // Integer | 
    try {
      Object result = apiInstance.commissionDetailApiV1FinanceCommissionDetailGet(page, limit);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling FinanceDistributionApi#commissionDetailApiV1FinanceCommissionDetailGet");
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
| **page** | **Integer**|  | [optional] [default to 1] |
| **limit** | **Integer**|  | [optional] [default to 20] |

### Return type

**Object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="inviteeOrderStatsApiV1FinanceInviteeOrderStatsGet"></a>
# **inviteeOrderStatsApiV1FinanceInviteeOrderStatsGet**
> Object inviteeOrderStatsApiV1FinanceInviteeOrderStatsGet(page, limit)

下级用户订单统计

Mirrors Java getUserInviteeOrderStats.  For each invitee, return their order count, total amount, and latest order time.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.FinanceDistributionApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    FinanceDistributionApi apiInstance = new FinanceDistributionApi(defaultClient);
    Integer page = 1; // Integer | 
    Integer limit = 20; // Integer | 
    try {
      Object result = apiInstance.inviteeOrderStatsApiV1FinanceInviteeOrderStatsGet(page, limit);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling FinanceDistributionApi#inviteeOrderStatsApiV1FinanceInviteeOrderStatsGet");
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
| **page** | **Integer**|  | [optional] [default to 1] |
| **limit** | **Integer**|  | [optional] [default to 20] |

### Return type

**Object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="inviteeStatsApiV1FinanceInviteeStatsGet"></a>
# **inviteeStatsApiV1FinanceInviteeStatsGet**
> Object inviteeStatsApiV1FinanceInviteeStatsGet()

邀请统计

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.FinanceDistributionApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    FinanceDistributionApi apiInstance = new FinanceDistributionApi(defaultClient);
    try {
      Object result = apiInstance.inviteeStatsApiV1FinanceInviteeStatsGet();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling FinanceDistributionApi#inviteeStatsApiV1FinanceInviteeStatsGet");
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

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

<a id="listSubordinatesApiV1FinanceSubordinatesGet"></a>
# **listSubordinatesApiV1FinanceSubordinatesGet**
> Object listSubordinatesApiV1FinanceSubordinatesGet(page, limit)

我的下级用户列表

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.FinanceDistributionApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    FinanceDistributionApi apiInstance = new FinanceDistributionApi(defaultClient);
    Integer page = 1; // Integer | 
    Integer limit = 20; // Integer | 
    try {
      Object result = apiInstance.listSubordinatesApiV1FinanceSubordinatesGet(page, limit);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling FinanceDistributionApi#listSubordinatesApiV1FinanceSubordinatesGet");
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
| **page** | **Integer**|  | [optional] [default to 1] |
| **limit** | **Integer**|  | [optional] [default to 20] |

### Return type

**Object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="listTeamApiV1FinanceTeamGet"></a>
# **listTeamApiV1FinanceTeamGet**
> Object listTeamApiV1FinanceTeamGet(page, limit, keyword, sortBy, sortOrder)

我的团队（下属列表+搜索排序）

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.FinanceDistributionApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    FinanceDistributionApi apiInstance = new FinanceDistributionApi(defaultClient);
    Integer page = 1; // Integer | 
    Integer limit = 20; // Integer | 
    String keyword = "keyword_example"; // String | 搜索关键词（昵称/UUID）
    String sortBy = "created_at"; // String | 排序字段: created_at / is_vip
    String sortOrder = "desc"; // String | 排序方向: asc / desc
    try {
      Object result = apiInstance.listTeamApiV1FinanceTeamGet(page, limit, keyword, sortBy, sortOrder);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling FinanceDistributionApi#listTeamApiV1FinanceTeamGet");
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
| **page** | **Integer**|  | [optional] [default to 1] |
| **limit** | **Integer**|  | [optional] [default to 20] |
| **keyword** | **String**| 搜索关键词（昵称/UUID） | [optional] |
| **sortBy** | **String**| 排序字段: created_at / is_vip | [optional] [default to created_at] |
| **sortOrder** | **String**| 排序方向: asc / desc | [optional] [default to desc] |

### Return type

**Object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="operatorDataCardApiV1FinanceOperatorCardGet"></a>
# **operatorDataCardApiV1FinanceOperatorCardGet**
> Object operatorDataCardApiV1FinanceOperatorCardGet()

操盘手数据卡片统计

Mirrors Java getOperatorDataCardData.  Returns commission stats (today/month/total), order stats of invitees, invited user counts, and withdrawal stats.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.FinanceDistributionApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    FinanceDistributionApi apiInstance = new FinanceDistributionApi(defaultClient);
    try {
      Object result = apiInstance.operatorDataCardApiV1FinanceOperatorCardGet();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling FinanceDistributionApi#operatorDataCardApiV1FinanceOperatorCardGet");
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

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

<a id="teamCenterApiV1FinanceTeamCenterGet"></a>
# **teamCenterApiV1FinanceTeamCenterGet**
> Object teamCenterApiV1FinanceTeamCenterGet()

个人中心我的团队（概要）

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.FinanceDistributionApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    FinanceDistributionApi apiInstance = new FinanceDistributionApi(defaultClient);
    try {
      Object result = apiInstance.teamCenterApiV1FinanceTeamCenterGet();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling FinanceDistributionApi#teamCenterApiV1FinanceTeamCenterGet");
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

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

<a id="userAndChildrenOrdersApiV1FinanceUserAndChildrenOrdersGet"></a>
# **userAndChildrenOrdersApiV1FinanceUserAndChildrenOrdersGet**
> Object userAndChildrenOrdersApiV1FinanceUserAndChildrenOrdersGet(page, limit)

用户及下级的订单列表

Mirrors Java getUserAndChildrenOrders.  Returns orders from the current user AND all invitees, paginated.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.FinanceDistributionApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    FinanceDistributionApi apiInstance = new FinanceDistributionApi(defaultClient);
    Integer page = 1; // Integer | 
    Integer limit = 20; // Integer | 
    try {
      Object result = apiInstance.userAndChildrenOrdersApiV1FinanceUserAndChildrenOrdersGet(page, limit);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling FinanceDistributionApi#userAndChildrenOrdersApiV1FinanceUserAndChildrenOrdersGet");
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
| **page** | **Integer**|  | [optional] [default to 1] |
| **limit** | **Integer**|  | [optional] [default to 20] |

### Return type

**Object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

