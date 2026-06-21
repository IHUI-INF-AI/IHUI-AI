# TBoxApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**activateDeviceApiV1TboxDeviceDeviceNoActivatePost**](TBoxApi.md#activateDeviceApiV1TboxDeviceDeviceNoActivatePost) | **POST** /api/v1/tbox/device/{device_no}/activate | 激活设备 |
| [**activateDeviceApiV1TboxDeviceDeviceNoActivatePost_0**](TBoxApi.md#activateDeviceApiV1TboxDeviceDeviceNoActivatePost_0) | **POST** /api/v1/tbox/device/{device_no}/activate | 激活设备 |
| [**getDeviceApiV1TboxDeviceDeviceNoGet**](TBoxApi.md#getDeviceApiV1TboxDeviceDeviceNoGet) | **GET** /api/v1/tbox/device/{device_no} | 设备详情 |
| [**getDeviceApiV1TboxDeviceDeviceNoGet_0**](TBoxApi.md#getDeviceApiV1TboxDeviceDeviceNoGet_0) | **GET** /api/v1/tbox/device/{device_no} | 设备详情 |
| [**heartbeatApiV1TboxDeviceHeartbeatPost**](TBoxApi.md#heartbeatApiV1TboxDeviceHeartbeatPost) | **POST** /api/v1/tbox/device/heartbeat | 设备心跳 |
| [**heartbeatApiV1TboxDeviceHeartbeatPost_0**](TBoxApi.md#heartbeatApiV1TboxDeviceHeartbeatPost_0) | **POST** /api/v1/tbox/device/heartbeat | 设备心跳 |
| [**listCommandsApiV1TboxCommandListGet**](TBoxApi.md#listCommandsApiV1TboxCommandListGet) | **GET** /api/v1/tbox/command/list | 指令列表 |
| [**listCommandsApiV1TboxCommandListGet_0**](TBoxApi.md#listCommandsApiV1TboxCommandListGet_0) | **GET** /api/v1/tbox/command/list | 指令列表 |
| [**listDevicesApiV1TboxDeviceListGet**](TBoxApi.md#listDevicesApiV1TboxDeviceListGet) | **GET** /api/v1/tbox/device/list | 设备列表 |
| [**listDevicesApiV1TboxDeviceListGet_0**](TBoxApi.md#listDevicesApiV1TboxDeviceListGet_0) | **GET** /api/v1/tbox/device/list | 设备列表 |
| [**registerDeviceApiV1TboxDevicePost**](TBoxApi.md#registerDeviceApiV1TboxDevicePost) | **POST** /api/v1/tbox/device | 注册设备 |
| [**registerDeviceApiV1TboxDevicePost_0**](TBoxApi.md#registerDeviceApiV1TboxDevicePost_0) | **POST** /api/v1/tbox/device | 注册设备 |
| [**sendCommandApiV1TboxDeviceDeviceNoCommandPost**](TBoxApi.md#sendCommandApiV1TboxDeviceDeviceNoCommandPost) | **POST** /api/v1/tbox/device/{device_no}/command | 下发指令 |
| [**sendCommandApiV1TboxDeviceDeviceNoCommandPost_0**](TBoxApi.md#sendCommandApiV1TboxDeviceDeviceNoCommandPost_0) | **POST** /api/v1/tbox/device/{device_no}/command | 下发指令 |


<a id="activateDeviceApiV1TboxDeviceDeviceNoActivatePost"></a>
# **activateDeviceApiV1TboxDeviceDeviceNoActivatePost**
> Object activateDeviceApiV1TboxDeviceDeviceNoActivatePost(deviceNo, userId, userName)

激活设备

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.TBoxApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    TBoxApi apiInstance = new TBoxApi(defaultClient);
    String deviceNo = "deviceNo_example"; // String | 
    String userId = "userId_example"; // String | 
    String userName = "userName_example"; // String | 
    try {
      Object result = apiInstance.activateDeviceApiV1TboxDeviceDeviceNoActivatePost(deviceNo, userId, userName);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling TBoxApi#activateDeviceApiV1TboxDeviceDeviceNoActivatePost");
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
| **deviceNo** | **String**|  | |
| **userId** | **String**|  | |
| **userName** | **String**|  | [optional] |

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

<a id="activateDeviceApiV1TboxDeviceDeviceNoActivatePost_0"></a>
# **activateDeviceApiV1TboxDeviceDeviceNoActivatePost_0**
> Object activateDeviceApiV1TboxDeviceDeviceNoActivatePost_0(deviceNo, userId, userName)

激活设备

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.TBoxApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    TBoxApi apiInstance = new TBoxApi(defaultClient);
    String deviceNo = "deviceNo_example"; // String | 
    String userId = "userId_example"; // String | 
    String userName = "userName_example"; // String | 
    try {
      Object result = apiInstance.activateDeviceApiV1TboxDeviceDeviceNoActivatePost_0(deviceNo, userId, userName);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling TBoxApi#activateDeviceApiV1TboxDeviceDeviceNoActivatePost_0");
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
| **deviceNo** | **String**|  | |
| **userId** | **String**|  | |
| **userName** | **String**|  | [optional] |

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

<a id="getDeviceApiV1TboxDeviceDeviceNoGet"></a>
# **getDeviceApiV1TboxDeviceDeviceNoGet**
> Object getDeviceApiV1TboxDeviceDeviceNoGet(deviceNo)

设备详情

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.TBoxApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    TBoxApi apiInstance = new TBoxApi(defaultClient);
    String deviceNo = "deviceNo_example"; // String | 
    try {
      Object result = apiInstance.getDeviceApiV1TboxDeviceDeviceNoGet(deviceNo);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling TBoxApi#getDeviceApiV1TboxDeviceDeviceNoGet");
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
| **deviceNo** | **String**|  | |

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

<a id="getDeviceApiV1TboxDeviceDeviceNoGet_0"></a>
# **getDeviceApiV1TboxDeviceDeviceNoGet_0**
> Object getDeviceApiV1TboxDeviceDeviceNoGet_0(deviceNo)

设备详情

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.TBoxApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    TBoxApi apiInstance = new TBoxApi(defaultClient);
    String deviceNo = "deviceNo_example"; // String | 
    try {
      Object result = apiInstance.getDeviceApiV1TboxDeviceDeviceNoGet_0(deviceNo);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling TBoxApi#getDeviceApiV1TboxDeviceDeviceNoGet_0");
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
| **deviceNo** | **String**|  | |

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

<a id="heartbeatApiV1TboxDeviceHeartbeatPost"></a>
# **heartbeatApiV1TboxDeviceHeartbeatPost**
> Object heartbeatApiV1TboxDeviceHeartbeatPost(deviceNo, isOnline, signalStrength, battery, location)

设备心跳

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.TBoxApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    TBoxApi apiInstance = new TBoxApi(defaultClient);
    String deviceNo = "deviceNo_example"; // String | 
    Boolean isOnline = true; // Boolean | 
    Integer signalStrength = 0; // Integer | 
    Integer battery = 0; // Integer | 
    String location = "location_example"; // String | 
    try {
      Object result = apiInstance.heartbeatApiV1TboxDeviceHeartbeatPost(deviceNo, isOnline, signalStrength, battery, location);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling TBoxApi#heartbeatApiV1TboxDeviceHeartbeatPost");
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
| **deviceNo** | **String**|  | |
| **isOnline** | **Boolean**|  | [optional] [default to true] |
| **signalStrength** | **Integer**|  | [optional] [default to 0] |
| **battery** | **Integer**|  | [optional] [default to 0] |
| **location** | **String**|  | [optional] |

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

<a id="heartbeatApiV1TboxDeviceHeartbeatPost_0"></a>
# **heartbeatApiV1TboxDeviceHeartbeatPost_0**
> Object heartbeatApiV1TboxDeviceHeartbeatPost_0(deviceNo, isOnline, signalStrength, battery, location)

设备心跳

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.TBoxApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    TBoxApi apiInstance = new TBoxApi(defaultClient);
    String deviceNo = "deviceNo_example"; // String | 
    Boolean isOnline = true; // Boolean | 
    Integer signalStrength = 0; // Integer | 
    Integer battery = 0; // Integer | 
    String location = "location_example"; // String | 
    try {
      Object result = apiInstance.heartbeatApiV1TboxDeviceHeartbeatPost_0(deviceNo, isOnline, signalStrength, battery, location);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling TBoxApi#heartbeatApiV1TboxDeviceHeartbeatPost_0");
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
| **deviceNo** | **String**|  | |
| **isOnline** | **Boolean**|  | [optional] [default to true] |
| **signalStrength** | **Integer**|  | [optional] [default to 0] |
| **battery** | **Integer**|  | [optional] [default to 0] |
| **location** | **String**|  | [optional] |

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

<a id="listCommandsApiV1TboxCommandListGet"></a>
# **listCommandsApiV1TboxCommandListGet**
> Object listCommandsApiV1TboxCommandListGet(page, limit, deviceNo, status)

指令列表

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.TBoxApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    TBoxApi apiInstance = new TBoxApi(defaultClient);
    Integer page = 1; // Integer | 
    Integer limit = 20; // Integer | 
    String deviceNo = "deviceNo_example"; // String | 
    Integer status = 56; // Integer | 
    try {
      Object result = apiInstance.listCommandsApiV1TboxCommandListGet(page, limit, deviceNo, status);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling TBoxApi#listCommandsApiV1TboxCommandListGet");
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
| **deviceNo** | **String**|  | [optional] |
| **status** | **Integer**|  | [optional] |

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

<a id="listCommandsApiV1TboxCommandListGet_0"></a>
# **listCommandsApiV1TboxCommandListGet_0**
> Object listCommandsApiV1TboxCommandListGet_0(page, limit, deviceNo, status)

指令列表

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.TBoxApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    TBoxApi apiInstance = new TBoxApi(defaultClient);
    Integer page = 1; // Integer | 
    Integer limit = 20; // Integer | 
    String deviceNo = "deviceNo_example"; // String | 
    Integer status = 56; // Integer | 
    try {
      Object result = apiInstance.listCommandsApiV1TboxCommandListGet_0(page, limit, deviceNo, status);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling TBoxApi#listCommandsApiV1TboxCommandListGet_0");
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
| **deviceNo** | **String**|  | [optional] |
| **status** | **Integer**|  | [optional] |

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

<a id="listDevicesApiV1TboxDeviceListGet"></a>
# **listDevicesApiV1TboxDeviceListGet**
> Object listDevicesApiV1TboxDeviceListGet(page, limit, userId, deviceType, status, isOnline)

设备列表

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.TBoxApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    TBoxApi apiInstance = new TBoxApi(defaultClient);
    Integer page = 1; // Integer | 
    Integer limit = 20; // Integer | 
    String userId = "userId_example"; // String | 
    String deviceType = "deviceType_example"; // String | 
    Integer status = 56; // Integer | 
    Boolean isOnline = true; // Boolean | 
    try {
      Object result = apiInstance.listDevicesApiV1TboxDeviceListGet(page, limit, userId, deviceType, status, isOnline);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling TBoxApi#listDevicesApiV1TboxDeviceListGet");
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
| **userId** | **String**|  | [optional] |
| **deviceType** | **String**|  | [optional] |
| **status** | **Integer**|  | [optional] |
| **isOnline** | **Boolean**|  | [optional] |

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

<a id="listDevicesApiV1TboxDeviceListGet_0"></a>
# **listDevicesApiV1TboxDeviceListGet_0**
> Object listDevicesApiV1TboxDeviceListGet_0(page, limit, userId, deviceType, status, isOnline)

设备列表

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.TBoxApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    TBoxApi apiInstance = new TBoxApi(defaultClient);
    Integer page = 1; // Integer | 
    Integer limit = 20; // Integer | 
    String userId = "userId_example"; // String | 
    String deviceType = "deviceType_example"; // String | 
    Integer status = 56; // Integer | 
    Boolean isOnline = true; // Boolean | 
    try {
      Object result = apiInstance.listDevicesApiV1TboxDeviceListGet_0(page, limit, userId, deviceType, status, isOnline);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling TBoxApi#listDevicesApiV1TboxDeviceListGet_0");
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
| **userId** | **String**|  | [optional] |
| **deviceType** | **String**|  | [optional] |
| **status** | **Integer**|  | [optional] |
| **isOnline** | **Boolean**|  | [optional] |

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

<a id="registerDeviceApiV1TboxDevicePost"></a>
# **registerDeviceApiV1TboxDevicePost**
> Object registerDeviceApiV1TboxDevicePost(deviceNo, deviceName, deviceType, model, brand, iccid, imei, firmware)

注册设备

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.TBoxApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    TBoxApi apiInstance = new TBoxApi(defaultClient);
    String deviceNo = "deviceNo_example"; // String | 
    String deviceName = "deviceName_example"; // String | 
    String deviceType = "tbox"; // String | 
    String model = "model_example"; // String | 
    String brand = "brand_example"; // String | 
    String iccid = "iccid_example"; // String | 
    String imei = "imei_example"; // String | 
    String firmware = "firmware_example"; // String | 
    try {
      Object result = apiInstance.registerDeviceApiV1TboxDevicePost(deviceNo, deviceName, deviceType, model, brand, iccid, imei, firmware);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling TBoxApi#registerDeviceApiV1TboxDevicePost");
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
| **deviceNo** | **String**|  | |
| **deviceName** | **String**|  | [optional] |
| **deviceType** | **String**|  | [optional] [default to tbox] |
| **model** | **String**|  | [optional] |
| **brand** | **String**|  | [optional] |
| **iccid** | **String**|  | [optional] |
| **imei** | **String**|  | [optional] |
| **firmware** | **String**|  | [optional] |

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

<a id="registerDeviceApiV1TboxDevicePost_0"></a>
# **registerDeviceApiV1TboxDevicePost_0**
> Object registerDeviceApiV1TboxDevicePost_0(deviceNo, deviceName, deviceType, model, brand, iccid, imei, firmware)

注册设备

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.TBoxApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    TBoxApi apiInstance = new TBoxApi(defaultClient);
    String deviceNo = "deviceNo_example"; // String | 
    String deviceName = "deviceName_example"; // String | 
    String deviceType = "tbox"; // String | 
    String model = "model_example"; // String | 
    String brand = "brand_example"; // String | 
    String iccid = "iccid_example"; // String | 
    String imei = "imei_example"; // String | 
    String firmware = "firmware_example"; // String | 
    try {
      Object result = apiInstance.registerDeviceApiV1TboxDevicePost_0(deviceNo, deviceName, deviceType, model, brand, iccid, imei, firmware);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling TBoxApi#registerDeviceApiV1TboxDevicePost_0");
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
| **deviceNo** | **String**|  | |
| **deviceName** | **String**|  | [optional] |
| **deviceType** | **String**|  | [optional] [default to tbox] |
| **model** | **String**|  | [optional] |
| **brand** | **String**|  | [optional] |
| **iccid** | **String**|  | [optional] |
| **imei** | **String**|  | [optional] |
| **firmware** | **String**|  | [optional] |

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

<a id="sendCommandApiV1TboxDeviceDeviceNoCommandPost"></a>
# **sendCommandApiV1TboxDeviceDeviceNoCommandPost**
> Object sendCommandApiV1TboxDeviceDeviceNoCommandPost(deviceNo, command, params)

下发指令

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.TBoxApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    TBoxApi apiInstance = new TBoxApi(defaultClient);
    String deviceNo = "deviceNo_example"; // String | 
    String command = "command_example"; // String | 
    String params = "params_example"; // String | 
    try {
      Object result = apiInstance.sendCommandApiV1TboxDeviceDeviceNoCommandPost(deviceNo, command, params);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling TBoxApi#sendCommandApiV1TboxDeviceDeviceNoCommandPost");
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
| **deviceNo** | **String**|  | |
| **command** | **String**|  | |
| **params** | **String**|  | [optional] |

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

<a id="sendCommandApiV1TboxDeviceDeviceNoCommandPost_0"></a>
# **sendCommandApiV1TboxDeviceDeviceNoCommandPost_0**
> Object sendCommandApiV1TboxDeviceDeviceNoCommandPost_0(deviceNo, command, params)

下发指令

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.TBoxApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    TBoxApi apiInstance = new TBoxApi(defaultClient);
    String deviceNo = "deviceNo_example"; // String | 
    String command = "command_example"; // String | 
    String params = "params_example"; // String | 
    try {
      Object result = apiInstance.sendCommandApiV1TboxDeviceDeviceNoCommandPost_0(deviceNo, command, params);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling TBoxApi#sendCommandApiV1TboxDeviceDeviceNoCommandPost_0");
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
| **deviceNo** | **String**|  | |
| **command** | **String**|  | |
| **params** | **String**|  | [optional] |

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

