# BotsApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**createBotApiV1BotsCreatePost**](BotsApi.md#createBotApiV1BotsCreatePost) | **POST** /api/v1/bots/create | 创建 Bot |
| [**deleteBotApiV1BotsDeletePost**](BotsApi.md#deleteBotApiV1BotsDeletePost) | **POST** /api/v1/bots/delete | 删除 Bot |
| [**getBotApiV1BotsBotIdGet**](BotsApi.md#getBotApiV1BotsBotIdGet) | **GET** /api/v1/bots/{bot_id} | Bot 详情 |
| [**listBotsApiV1BotsListGet**](BotsApi.md#listBotsApiV1BotsListGet) | **GET** /api/v1/bots/list | Bot 列表 |
| [**listDatasetsApiV1BotsDatasetsListGet**](BotsApi.md#listDatasetsApiV1BotsDatasetsListGet) | **GET** /api/v1/bots/datasets/list | Bot 关联知识库列表 |
| [**publishBotApiV1BotsPublishPost**](BotsApi.md#publishBotApiV1BotsPublishPost) | **POST** /api/v1/bots/publish | 发布 Bot |
| [**updateBotApiV1BotsUpdatePost**](BotsApi.md#updateBotApiV1BotsUpdatePost) | **POST** /api/v1/bots/update | 更新 Bot |


<a id="createBotApiV1BotsCreatePost"></a>
# **createBotApiV1BotsCreatePost**
> Object createBotApiV1BotsCreatePost(name, description, persona)

创建 Bot

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.BotsApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    BotsApi apiInstance = new BotsApi(defaultClient);
    String name = "name_example"; // String | 
    String description = ""; // String | 
    String persona = ""; // String | Bot 人设描述
    try {
      Object result = apiInstance.createBotApiV1BotsCreatePost(name, description, persona);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling BotsApi#createBotApiV1BotsCreatePost");
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
| **name** | **String**|  | |
| **description** | **String**|  | [optional] [default to ] |
| **persona** | **String**| Bot 人设描述 | [optional] [default to ] |

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

<a id="deleteBotApiV1BotsDeletePost"></a>
# **deleteBotApiV1BotsDeletePost**
> Object deleteBotApiV1BotsDeletePost(botId)

删除 Bot

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.BotsApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    BotsApi apiInstance = new BotsApi(defaultClient);
    String botId = "botId_example"; // String | 
    try {
      Object result = apiInstance.deleteBotApiV1BotsDeletePost(botId);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling BotsApi#deleteBotApiV1BotsDeletePost");
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
| **botId** | **String**|  | |

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

<a id="getBotApiV1BotsBotIdGet"></a>
# **getBotApiV1BotsBotIdGet**
> Object getBotApiV1BotsBotIdGet(botId)

Bot 详情

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.BotsApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    BotsApi apiInstance = new BotsApi(defaultClient);
    String botId = "botId_example"; // String | 
    try {
      Object result = apiInstance.getBotApiV1BotsBotIdGet(botId);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling BotsApi#getBotApiV1BotsBotIdGet");
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
| **botId** | **String**|  | |

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

<a id="listBotsApiV1BotsListGet"></a>
# **listBotsApiV1BotsListGet**
> Object listBotsApiV1BotsListGet(page, pageSize, spaceId)

Bot 列表

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.BotsApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    BotsApi apiInstance = new BotsApi(defaultClient);
    Integer page = 1; // Integer | 
    Integer pageSize = 20; // Integer | 
    String spaceId = ""; // String | 空间 ID，默认使用 settings.COZE_ACCOUNT_ID
    try {
      Object result = apiInstance.listBotsApiV1BotsListGet(page, pageSize, spaceId);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling BotsApi#listBotsApiV1BotsListGet");
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
| **pageSize** | **Integer**|  | [optional] [default to 20] |
| **spaceId** | **String**| 空间 ID，默认使用 settings.COZE_ACCOUNT_ID | [optional] [default to ] |

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

<a id="listDatasetsApiV1BotsDatasetsListGet"></a>
# **listDatasetsApiV1BotsDatasetsListGet**
> Object listDatasetsApiV1BotsDatasetsListGet(page, pageSize)

Bot 关联知识库列表

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.BotsApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    BotsApi apiInstance = new BotsApi(defaultClient);
    Integer page = 1; // Integer | 
    Integer pageSize = 20; // Integer | 
    try {
      Object result = apiInstance.listDatasetsApiV1BotsDatasetsListGet(page, pageSize);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling BotsApi#listDatasetsApiV1BotsDatasetsListGet");
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
| **pageSize** | **Integer**|  | [optional] [default to 20] |

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

<a id="publishBotApiV1BotsPublishPost"></a>
# **publishBotApiV1BotsPublishPost**
> Object publishBotApiV1BotsPublishPost(botId, version)

发布 Bot

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.BotsApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    BotsApi apiInstance = new BotsApi(defaultClient);
    String botId = "botId_example"; // String | 
    String version = ""; // String | 
    try {
      Object result = apiInstance.publishBotApiV1BotsPublishPost(botId, version);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling BotsApi#publishBotApiV1BotsPublishPost");
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
| **botId** | **String**|  | |
| **version** | **String**|  | [optional] [default to ] |

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

<a id="updateBotApiV1BotsUpdatePost"></a>
# **updateBotApiV1BotsUpdatePost**
> Object updateBotApiV1BotsUpdatePost(botId, name, description, persona)

更新 Bot

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.BotsApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    BotsApi apiInstance = new BotsApi(defaultClient);
    String botId = "botId_example"; // String | 
    String name = "name_example"; // String | 
    String description = "description_example"; // String | 
    String persona = "persona_example"; // String | 
    try {
      Object result = apiInstance.updateBotApiV1BotsUpdatePost(botId, name, description, persona);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling BotsApi#updateBotApiV1BotsUpdatePost");
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
| **botId** | **String**|  | |
| **name** | **String**|  | [optional] |
| **description** | **String**|  | [optional] |
| **persona** | **String**|  | [optional] |

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

