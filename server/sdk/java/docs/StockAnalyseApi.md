# StockAnalyseApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**stockAnalysePostApiV1CozeZhsApiStockAnalysePost**](StockAnalyseApi.md#stockAnalysePostApiV1CozeZhsApiStockAnalysePost) | **POST** /api/v1/cozeZhsApi/stock/analyse | Stock Analyse Post |
| [**stockAnalysePostApiV1CozeZhsApiStockAnalysePost_0**](StockAnalyseApi.md#stockAnalysePostApiV1CozeZhsApiStockAnalysePost_0) | **POST** /api/v1/cozeZhsApi/stock/analyse | Stock Analyse Post |


<a id="stockAnalysePostApiV1CozeZhsApiStockAnalysePost"></a>
# **stockAnalysePostApiV1CozeZhsApiStockAnalysePost**
> Object stockAnalysePostApiV1CozeZhsApiStockAnalysePost(stockAnalyseRequest)

Stock Analyse Post

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.StockAnalyseApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    StockAnalyseApi apiInstance = new StockAnalyseApi(defaultClient);
    StockAnalyseRequest stockAnalyseRequest = new StockAnalyseRequest(); // StockAnalyseRequest | 
    try {
      Object result = apiInstance.stockAnalysePostApiV1CozeZhsApiStockAnalysePost(stockAnalyseRequest);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling StockAnalyseApi#stockAnalysePostApiV1CozeZhsApiStockAnalysePost");
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
| **stockAnalyseRequest** | [**StockAnalyseRequest**](StockAnalyseRequest.md)|  | |

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="stockAnalysePostApiV1CozeZhsApiStockAnalysePost_0"></a>
# **stockAnalysePostApiV1CozeZhsApiStockAnalysePost_0**
> Object stockAnalysePostApiV1CozeZhsApiStockAnalysePost_0(stockAnalyseRequest)

Stock Analyse Post

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.StockAnalyseApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    StockAnalyseApi apiInstance = new StockAnalyseApi(defaultClient);
    StockAnalyseRequest stockAnalyseRequest = new StockAnalyseRequest(); // StockAnalyseRequest | 
    try {
      Object result = apiInstance.stockAnalysePostApiV1CozeZhsApiStockAnalysePost_0(stockAnalyseRequest);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling StockAnalyseApi#stockAnalysePostApiV1CozeZhsApiStockAnalysePost_0");
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
| **stockAnalyseRequest** | [**StockAnalyseRequest**](StockAnalyseRequest.md)|  | |

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

