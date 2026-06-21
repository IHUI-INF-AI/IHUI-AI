# VipApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**checkVipApiV1UserCheckGet**](VipApi.md#checkVipApiV1UserCheckGet) | **GET** /api/v1/user/check | Check current user VIP status |
| [**getMyVipApiV1UserMyGet**](VipApi.md#getMyVipApiV1UserMyGet) | **GET** /api/v1/user/my | Get current user VIP info |
| [**getVipLevelDetailApiV1UserLevelVipIdGet**](VipApi.md#getVipLevelDetailApiV1UserLevelVipIdGet) | **GET** /api/v1/user/level/{vip_id} | Get VIP level detail |
| [**getVipLevelsApiV1UserLevelsGet**](VipApi.md#getVipLevelsApiV1UserLevelsGet) | **GET** /api/v1/user/levels | Get all VIP levels |
| [**subscribeVipApiV1UserSubscribePost**](VipApi.md#subscribeVipApiV1UserSubscribePost) | **POST** /api/v1/user/subscribe | Subscribe VIP (create order) |


<a id="checkVipApiV1UserCheckGet"></a>
# **checkVipApiV1UserCheckGet**
> Object checkVipApiV1UserCheckGet()

Check current user VIP status

Quickly check whether the current user is an active VIP and what level.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.VipApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    VipApi apiInstance = new VipApi(defaultClient);
    try {
      Object result = apiInstance.checkVipApiV1UserCheckGet();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling VipApi#checkVipApiV1UserCheckGet");
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

<a id="getMyVipApiV1UserMyGet"></a>
# **getMyVipApiV1UserMyGet**
> Object getMyVipApiV1UserMyGet()

Get current user VIP info

Return the current user&#39;s VIP subscription: level, expiration, and benefits.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.VipApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    VipApi apiInstance = new VipApi(defaultClient);
    try {
      Object result = apiInstance.getMyVipApiV1UserMyGet();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling VipApi#getMyVipApiV1UserMyGet");
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

<a id="getVipLevelDetailApiV1UserLevelVipIdGet"></a>
# **getVipLevelDetailApiV1UserLevelVipIdGet**
> Object getVipLevelDetailApiV1UserLevelVipIdGet(vipId)

Get VIP level detail

Return details of a single VIP level by its ID.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.VipApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    VipApi apiInstance = new VipApi(defaultClient);
    Integer vipId = 56; // Integer | 
    try {
      Object result = apiInstance.getVipLevelDetailApiV1UserLevelVipIdGet(vipId);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling VipApi#getVipLevelDetailApiV1UserLevelVipIdGet");
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
| **vipId** | **Integer**|  | |

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

<a id="getVipLevelsApiV1UserLevelsGet"></a>
# **getVipLevelsApiV1UserLevelsGet**
> Object getVipLevelsApiV1UserLevelsGet()

Get all VIP levels

Return the list of all active VIP levels.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.VipApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    VipApi apiInstance = new VipApi(defaultClient);
    try {
      Object result = apiInstance.getVipLevelsApiV1UserLevelsGet();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling VipApi#getVipLevelsApiV1UserLevelsGet");
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

<a id="subscribeVipApiV1UserSubscribePost"></a>
# **subscribeVipApiV1UserSubscribePost**
> Object subscribeVipApiV1UserSubscribePost(subscribeRequest)

Subscribe VIP (create order)

Create a new VIP subscription for the current user.  If the user already has an active subscription that hasn&#39;t expired, the new subscription starts after the existing one ends.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.VipApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    VipApi apiInstance = new VipApi(defaultClient);
    SubscribeRequest subscribeRequest = new SubscribeRequest(); // SubscribeRequest | 
    try {
      Object result = apiInstance.subscribeVipApiV1UserSubscribePost(subscribeRequest);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling VipApi#subscribeVipApiV1UserSubscribePost");
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
| **subscribeRequest** | [**SubscribeRequest**](SubscribeRequest.md)|  | |

### Return type

**Object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

