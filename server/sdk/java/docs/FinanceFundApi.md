# FinanceFundApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**agentTransferNotifyApiV1FinanceFundAgentTransferNotifyPost**](FinanceFundApi.md#agentTransferNotifyApiV1FinanceFundAgentTransferNotifyPost) | **POST** /api/v1/finance/fund/agent/transfer/notify | Agent Transfer Notify |
| [**fileToStreamApiV1FinanceFundFileToStreamPost**](FinanceFundApi.md#fileToStreamApiV1FinanceFundFileToStreamPost) | **POST** /api/v1/finance/fund/file/to/stream | File To Stream |
| [**fundAppNotifyApiV1FinanceFundAppNotifyPost**](FinanceFundApi.md#fundAppNotifyApiV1FinanceFundAppNotifyPost) | **POST** /api/v1/finance/fund/app/notify | Fund App Notify |
| [**fundNotifyApiV1FinanceFundNotifyPost**](FinanceFundApi.md#fundNotifyApiV1FinanceFundNotifyPost) | **POST** /api/v1/finance/fund/notify | Fund Notify |
| [**getInfoApiV1FinanceFundGetInfoGet**](FinanceFundApi.md#getInfoApiV1FinanceFundGetInfoGet) | **GET** /api/v1/finance/fund/getInfo | Get Info |
| [**getProductApiV1FinanceFundGetProductGet**](FinanceFundApi.md#getProductApiV1FinanceFundGetProductGet) | **GET** /api/v1/finance/fund/getProduct | Get Product |
| [**getStatisticsApiV1FinanceFundGetStatisticsGet**](FinanceFundApi.md#getStatisticsApiV1FinanceFundGetStatisticsGet) | **GET** /api/v1/finance/fund/getStatistics | Get Statistics |
| [**useTokenApiV1FinanceFundUseTokenPost**](FinanceFundApi.md#useTokenApiV1FinanceFundUseTokenPost) | **POST** /api/v1/finance/fund/useToken | Use Token |


<a id="agentTransferNotifyApiV1FinanceFundAgentTransferNotifyPost"></a>
# **agentTransferNotifyApiV1FinanceFundAgentTransferNotifyPost**
> Object agentTransferNotifyApiV1FinanceFundAgentTransferNotifyPost()

Agent Transfer Notify

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.FinanceFundApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    FinanceFundApi apiInstance = new FinanceFundApi(defaultClient);
    try {
      Object result = apiInstance.agentTransferNotifyApiV1FinanceFundAgentTransferNotifyPost();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling FinanceFundApi#agentTransferNotifyApiV1FinanceFundAgentTransferNotifyPost");
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

<a id="fileToStreamApiV1FinanceFundFileToStreamPost"></a>
# **fileToStreamApiV1FinanceFundFileToStreamPost**
> Object fileToStreamApiV1FinanceFundFileToStreamPost()

File To Stream

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.FinanceFundApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    FinanceFundApi apiInstance = new FinanceFundApi(defaultClient);
    try {
      Object result = apiInstance.fileToStreamApiV1FinanceFundFileToStreamPost();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling FinanceFundApi#fileToStreamApiV1FinanceFundFileToStreamPost");
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

<a id="fundAppNotifyApiV1FinanceFundAppNotifyPost"></a>
# **fundAppNotifyApiV1FinanceFundAppNotifyPost**
> Object fundAppNotifyApiV1FinanceFundAppNotifyPost()

Fund App Notify

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.FinanceFundApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    FinanceFundApi apiInstance = new FinanceFundApi(defaultClient);
    try {
      Object result = apiInstance.fundAppNotifyApiV1FinanceFundAppNotifyPost();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling FinanceFundApi#fundAppNotifyApiV1FinanceFundAppNotifyPost");
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

<a id="fundNotifyApiV1FinanceFundNotifyPost"></a>
# **fundNotifyApiV1FinanceFundNotifyPost**
> Object fundNotifyApiV1FinanceFundNotifyPost()

Fund Notify

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.FinanceFundApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    FinanceFundApi apiInstance = new FinanceFundApi(defaultClient);
    try {
      Object result = apiInstance.fundNotifyApiV1FinanceFundNotifyPost();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling FinanceFundApi#fundNotifyApiV1FinanceFundNotifyPost");
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

<a id="getInfoApiV1FinanceFundGetInfoGet"></a>
# **getInfoApiV1FinanceFundGetInfoGet**
> Object getInfoApiV1FinanceFundGetInfoGet(token)

Get Info

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.FinanceFundApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    FinanceFundApi apiInstance = new FinanceFundApi(defaultClient);
    String token = "token_example"; // String | user uuid
    try {
      Object result = apiInstance.getInfoApiV1FinanceFundGetInfoGet(token);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling FinanceFundApi#getInfoApiV1FinanceFundGetInfoGet");
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
| **token** | **String**| user uuid | |

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

<a id="getProductApiV1FinanceFundGetProductGet"></a>
# **getProductApiV1FinanceFundGetProductGet**
> Object getProductApiV1FinanceFundGetProductGet()

Get Product

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.FinanceFundApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    FinanceFundApi apiInstance = new FinanceFundApi(defaultClient);
    try {
      Object result = apiInstance.getProductApiV1FinanceFundGetProductGet();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling FinanceFundApi#getProductApiV1FinanceFundGetProductGet");
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

<a id="getStatisticsApiV1FinanceFundGetStatisticsGet"></a>
# **getStatisticsApiV1FinanceFundGetStatisticsGet**
> Object getStatisticsApiV1FinanceFundGetStatisticsGet()

Get Statistics

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.FinanceFundApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    FinanceFundApi apiInstance = new FinanceFundApi(defaultClient);
    try {
      Object result = apiInstance.getStatisticsApiV1FinanceFundGetStatisticsGet();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling FinanceFundApi#getStatisticsApiV1FinanceFundGetStatisticsGet");
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

<a id="useTokenApiV1FinanceFundUseTokenPost"></a>
# **useTokenApiV1FinanceFundUseTokenPost**
> Object useTokenApiV1FinanceFundUseTokenPost(platform)

Use Token

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.FinanceFundApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    FinanceFundApi apiInstance = new FinanceFundApi(defaultClient);
    String platform = "WEB"; // String | 
    try {
      Object result = apiInstance.useTokenApiV1FinanceFundUseTokenPost(platform);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling FinanceFundApi#useTokenApiV1FinanceFundUseTokenPost");
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
| **platform** | **String**|  | [optional] [default to WEB] |

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

