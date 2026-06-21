# AlipayFundApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**alipayFundNotify**](AlipayFundApi.md#alipayFundNotify) | **POST** /api/v1/payments/alipay/notify | Alipay Notify |
| [**alipayFundNotify_0**](AlipayFundApi.md#alipayFundNotify_0) | **POST** /api/v1/payments/alipay/notify | Alipay Notify |
| [**alipayReturnApiV1PaymentsAlipayReturnGet**](AlipayFundApi.md#alipayReturnApiV1PaymentsAlipayReturnGet) | **GET** /api/v1/payments/alipay/return | Alipay Return |
| [**alipayReturnApiV1PaymentsAlipayReturnGet_0**](AlipayFundApi.md#alipayReturnApiV1PaymentsAlipayReturnGet_0) | **GET** /api/v1/payments/alipay/return | Alipay Return |
| [**createPayApiV1PaymentsCreatePost**](AlipayFundApi.md#createPayApiV1PaymentsCreatePost) | **POST** /api/v1/payments/create | Create Pay |
| [**createPayApiV1PaymentsCreatePost_0**](AlipayFundApi.md#createPayApiV1PaymentsCreatePost_0) | **POST** /api/v1/payments/create | Create Pay |
| [**createPayJsonApiV1PaymentsCreate2Post**](AlipayFundApi.md#createPayJsonApiV1PaymentsCreate2Post) | **POST** /api/v1/payments/create2 | Create Pay Json |
| [**createPayJsonApiV1PaymentsCreate2Post_0**](AlipayFundApi.md#createPayJsonApiV1PaymentsCreate2Post_0) | **POST** /api/v1/payments/create2 | Create Pay Json |
| [**payFailApiV1PaymentsFailGet**](AlipayFundApi.md#payFailApiV1PaymentsFailGet) | **GET** /api/v1/payments/fail | Pay Fail |
| [**payFailApiV1PaymentsFailGet_0**](AlipayFundApi.md#payFailApiV1PaymentsFailGet_0) | **GET** /api/v1/payments/fail | Pay Fail |
| [**paySuccessApiV1PaymentsSuccessGet**](AlipayFundApi.md#paySuccessApiV1PaymentsSuccessGet) | **GET** /api/v1/payments/success | Pay Success |
| [**paySuccessApiV1PaymentsSuccessGet_0**](AlipayFundApi.md#paySuccessApiV1PaymentsSuccessGet_0) | **GET** /api/v1/payments/success | Pay Success |


<a id="alipayFundNotify"></a>
# **alipayFundNotify**
> Object alipayFundNotify()

Alipay Notify

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AlipayFundApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AlipayFundApi apiInstance = new AlipayFundApi(defaultClient);
    try {
      Object result = apiInstance.alipayFundNotify();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AlipayFundApi#alipayFundNotify");
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

<a id="alipayFundNotify_0"></a>
# **alipayFundNotify_0**
> Object alipayFundNotify_0()

Alipay Notify

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AlipayFundApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AlipayFundApi apiInstance = new AlipayFundApi(defaultClient);
    try {
      Object result = apiInstance.alipayFundNotify_0();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AlipayFundApi#alipayFundNotify_0");
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

<a id="alipayReturnApiV1PaymentsAlipayReturnGet"></a>
# **alipayReturnApiV1PaymentsAlipayReturnGet**
> Object alipayReturnApiV1PaymentsAlipayReturnGet()

Alipay Return

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AlipayFundApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AlipayFundApi apiInstance = new AlipayFundApi(defaultClient);
    try {
      Object result = apiInstance.alipayReturnApiV1PaymentsAlipayReturnGet();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AlipayFundApi#alipayReturnApiV1PaymentsAlipayReturnGet");
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

<a id="alipayReturnApiV1PaymentsAlipayReturnGet_0"></a>
# **alipayReturnApiV1PaymentsAlipayReturnGet_0**
> Object alipayReturnApiV1PaymentsAlipayReturnGet_0()

Alipay Return

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AlipayFundApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AlipayFundApi apiInstance = new AlipayFundApi(defaultClient);
    try {
      Object result = apiInstance.alipayReturnApiV1PaymentsAlipayReturnGet_0();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AlipayFundApi#alipayReturnApiV1PaymentsAlipayReturnGet_0");
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

<a id="createPayApiV1PaymentsCreatePost"></a>
# **createPayApiV1PaymentsCreatePost**
> Object createPayApiV1PaymentsCreatePost()

Create Pay

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AlipayFundApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    AlipayFundApi apiInstance = new AlipayFundApi(defaultClient);
    try {
      Object result = apiInstance.createPayApiV1PaymentsCreatePost();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AlipayFundApi#createPayApiV1PaymentsCreatePost");
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

<a id="createPayApiV1PaymentsCreatePost_0"></a>
# **createPayApiV1PaymentsCreatePost_0**
> Object createPayApiV1PaymentsCreatePost_0()

Create Pay

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AlipayFundApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    AlipayFundApi apiInstance = new AlipayFundApi(defaultClient);
    try {
      Object result = apiInstance.createPayApiV1PaymentsCreatePost_0();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AlipayFundApi#createPayApiV1PaymentsCreatePost_0");
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

<a id="createPayJsonApiV1PaymentsCreate2Post"></a>
# **createPayJsonApiV1PaymentsCreate2Post**
> Object createPayJsonApiV1PaymentsCreate2Post()

Create Pay Json

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AlipayFundApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    AlipayFundApi apiInstance = new AlipayFundApi(defaultClient);
    try {
      Object result = apiInstance.createPayJsonApiV1PaymentsCreate2Post();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AlipayFundApi#createPayJsonApiV1PaymentsCreate2Post");
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

<a id="createPayJsonApiV1PaymentsCreate2Post_0"></a>
# **createPayJsonApiV1PaymentsCreate2Post_0**
> Object createPayJsonApiV1PaymentsCreate2Post_0()

Create Pay Json

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AlipayFundApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    AlipayFundApi apiInstance = new AlipayFundApi(defaultClient);
    try {
      Object result = apiInstance.createPayJsonApiV1PaymentsCreate2Post_0();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AlipayFundApi#createPayJsonApiV1PaymentsCreate2Post_0");
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

<a id="payFailApiV1PaymentsFailGet"></a>
# **payFailApiV1PaymentsFailGet**
> Object payFailApiV1PaymentsFailGet()

Pay Fail

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AlipayFundApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AlipayFundApi apiInstance = new AlipayFundApi(defaultClient);
    try {
      Object result = apiInstance.payFailApiV1PaymentsFailGet();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AlipayFundApi#payFailApiV1PaymentsFailGet");
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

<a id="payFailApiV1PaymentsFailGet_0"></a>
# **payFailApiV1PaymentsFailGet_0**
> Object payFailApiV1PaymentsFailGet_0()

Pay Fail

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AlipayFundApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AlipayFundApi apiInstance = new AlipayFundApi(defaultClient);
    try {
      Object result = apiInstance.payFailApiV1PaymentsFailGet_0();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AlipayFundApi#payFailApiV1PaymentsFailGet_0");
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

<a id="paySuccessApiV1PaymentsSuccessGet"></a>
# **paySuccessApiV1PaymentsSuccessGet**
> Object paySuccessApiV1PaymentsSuccessGet(orderNo)

Pay Success

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AlipayFundApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AlipayFundApi apiInstance = new AlipayFundApi(defaultClient);
    String orderNo = ""; // String | order number
    try {
      Object result = apiInstance.paySuccessApiV1PaymentsSuccessGet(orderNo);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AlipayFundApi#paySuccessApiV1PaymentsSuccessGet");
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
| **orderNo** | **String**| order number | [optional] [default to ] |

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

<a id="paySuccessApiV1PaymentsSuccessGet_0"></a>
# **paySuccessApiV1PaymentsSuccessGet_0**
> Object paySuccessApiV1PaymentsSuccessGet_0(orderNo)

Pay Success

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AlipayFundApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AlipayFundApi apiInstance = new AlipayFundApi(defaultClient);
    String orderNo = ""; // String | order number
    try {
      Object result = apiInstance.paySuccessApiV1PaymentsSuccessGet_0(orderNo);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AlipayFundApi#paySuccessApiV1PaymentsSuccessGet_0");
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
| **orderNo** | **String**| order number | [optional] [default to ] |

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

