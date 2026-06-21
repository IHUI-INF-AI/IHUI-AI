# AgentCacheApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**cacheClearApiV1AgentsClearPost**](AgentCacheApi.md#cacheClearApiV1AgentsClearPost) | **POST** /api/v1/agents/clear | Clear category cache |
| [**cacheInfoApiV1AgentsInfoGet**](AgentCacheApi.md#cacheInfoApiV1AgentsInfoGet) | **GET** /api/v1/agents/info | Get category cache info |
| [**cacheReloadApiV1AgentsReloadPost**](AgentCacheApi.md#cacheReloadApiV1AgentsReloadPost) | **POST** /api/v1/agents/reload | Reload category cache from DB |
| [**cacheSearchApiV1AgentsSearchGet**](AgentCacheApi.md#cacheSearchApiV1AgentsSearchGet) | **GET** /api/v1/agents/search | Search categories in cache |


<a id="cacheClearApiV1AgentsClearPost"></a>
# **cacheClearApiV1AgentsClearPost**
> Object cacheClearApiV1AgentsClearPost()

Clear category cache

Clear the in-memory category cache.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AgentCacheApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    AgentCacheApi apiInstance = new AgentCacheApi(defaultClient);
    try {
      Object result = apiInstance.cacheClearApiV1AgentsClearPost();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AgentCacheApi#cacheClearApiV1AgentsClearPost");
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

<a id="cacheInfoApiV1AgentsInfoGet"></a>
# **cacheInfoApiV1AgentsInfoGet**
> Object cacheInfoApiV1AgentsInfoGet()

Get category cache info

Return cache metadata: size, last reload time, version.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AgentCacheApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    AgentCacheApi apiInstance = new AgentCacheApi(defaultClient);
    try {
      Object result = apiInstance.cacheInfoApiV1AgentsInfoGet();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AgentCacheApi#cacheInfoApiV1AgentsInfoGet");
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

<a id="cacheReloadApiV1AgentsReloadPost"></a>
# **cacheReloadApiV1AgentsReloadPost**
> Object cacheReloadApiV1AgentsReloadPost()

Reload category cache from DB

Force-reload agent categories from database into memory cache.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AgentCacheApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    AgentCacheApi apiInstance = new AgentCacheApi(defaultClient);
    try {
      Object result = apiInstance.cacheReloadApiV1AgentsReloadPost();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AgentCacheApi#cacheReloadApiV1AgentsReloadPost");
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

<a id="cacheSearchApiV1AgentsSearchGet"></a>
# **cacheSearchApiV1AgentsSearchGet**
> Object cacheSearchApiV1AgentsSearchGet(keyword, group, type)

Search categories in cache

Search cached agent categories with optional filters.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AgentCacheApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    AgentCacheApi apiInstance = new AgentCacheApi(defaultClient);
    String keyword = "keyword_example"; // String | Search keyword for agent_id
    Integer group = 56; // Integer | Filter by group
    String type = "type_example"; // String | Filter by type
    try {
      Object result = apiInstance.cacheSearchApiV1AgentsSearchGet(keyword, group, type);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AgentCacheApi#cacheSearchApiV1AgentsSearchGet");
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
| **keyword** | **String**| Search keyword for agent_id | [optional] |
| **group** | **Integer**| Filter by group | [optional] |
| **type** | **String**| Filter by type | [optional] |

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

