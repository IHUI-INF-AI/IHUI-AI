# WeChatAuthApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**getWechatPhoneApiV1AuthAuthWechatMiniPhonePost**](WeChatAuthApi.md#getWechatPhoneApiV1AuthAuthWechatMiniPhonePost) | **POST** /api/v1/auth/auth/wechat/mini/phone | Get WeChat phone number |
| [**getWechatPhoneApiV1AuthAuthWechatMiniPhonePost_0**](WeChatAuthApi.md#getWechatPhoneApiV1AuthAuthWechatMiniPhonePost_0) | **POST** /api/v1/auth/auth/wechat/mini/phone | Get WeChat phone number |
| [**getWechatQrcodeApiV1AuthAuthWechatMiniQrcodeGet**](WeChatAuthApi.md#getWechatQrcodeApiV1AuthAuthWechatMiniQrcodeGet) | **GET** /api/v1/auth/auth/wechat/mini/qrcode | Get WeChat mini-program QR code |
| [**getWechatQrcodeApiV1AuthAuthWechatMiniQrcodeGet_0**](WeChatAuthApi.md#getWechatQrcodeApiV1AuthAuthWechatMiniQrcodeGet_0) | **GET** /api/v1/auth/auth/wechat/mini/qrcode | Get WeChat mini-program QR code |
| [**wechatMiniLoginApiV1AuthAuthWechatMiniLoginGet**](WeChatAuthApi.md#wechatMiniLoginApiV1AuthAuthWechatMiniLoginGet) | **GET** /api/v1/auth/auth/wechat/mini/login | WeChat mini-program login |
| [**wechatMiniLoginApiV1AuthAuthWechatMiniLoginGet_0**](WeChatAuthApi.md#wechatMiniLoginApiV1AuthAuthWechatMiniLoginGet_0) | **GET** /api/v1/auth/auth/wechat/mini/login | WeChat mini-program login |
| [**wechatRebindApiV1AuthAuthWechatMiniRebindPost**](WeChatAuthApi.md#wechatRebindApiV1AuthAuthWechatMiniRebindPost) | **POST** /api/v1/auth/auth/wechat/mini/rebind | Rebind WeChat mini-program account |
| [**wechatRebindApiV1AuthAuthWechatMiniRebindPost_0**](WeChatAuthApi.md#wechatRebindApiV1AuthAuthWechatMiniRebindPost_0) | **POST** /api/v1/auth/auth/wechat/mini/rebind | Rebind WeChat mini-program account |
| [**wechatRebindByPhoneApiV1AuthAuthWechatMiniRebindByPhonePost**](WeChatAuthApi.md#wechatRebindByPhoneApiV1AuthAuthWechatMiniRebindByPhonePost) | **POST** /api/v1/auth/auth/wechat/mini/rebind_by_phone | Rebind WeChat by phone number |
| [**wechatRebindByPhoneApiV1AuthAuthWechatMiniRebindByPhonePost_0**](WeChatAuthApi.md#wechatRebindByPhoneApiV1AuthAuthWechatMiniRebindByPhonePost_0) | **POST** /api/v1/auth/auth/wechat/mini/rebind_by_phone | Rebind WeChat by phone number |


<a id="getWechatPhoneApiV1AuthAuthWechatMiniPhonePost"></a>
# **getWechatPhoneApiV1AuthAuthWechatMiniPhonePost**
> Object getWechatPhoneApiV1AuthAuthWechatMiniPhonePost(code)

Get WeChat phone number

Get phone number via WeChat mini-program getuserphonenumber API.  Matches Java LoginService.getPhoneNumber(code, openId): 1. Get access_token, call getuserphonenumber API 2. If phone exists with no openId (visitor): delete visitor, bind phone to current user 3. If phone exists with same openId: return existing user 4. If phone exists with different openId: error &#39;already bound&#39; 5. Otherwise: update user&#39;s phone and set isVIP&#x3D;0

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.WeChatAuthApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    WeChatAuthApi apiInstance = new WeChatAuthApi(defaultClient);
    String code = "code_example"; // String | Code from wx.getPhoneNumber component
    try {
      Object result = apiInstance.getWechatPhoneApiV1AuthAuthWechatMiniPhonePost(code);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling WeChatAuthApi#getWechatPhoneApiV1AuthAuthWechatMiniPhonePost");
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
| **code** | **String**| Code from wx.getPhoneNumber component | |

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

<a id="getWechatPhoneApiV1AuthAuthWechatMiniPhonePost_0"></a>
# **getWechatPhoneApiV1AuthAuthWechatMiniPhonePost_0**
> Object getWechatPhoneApiV1AuthAuthWechatMiniPhonePost_0(code)

Get WeChat phone number

Get phone number via WeChat mini-program getuserphonenumber API.  Matches Java LoginService.getPhoneNumber(code, openId): 1. Get access_token, call getuserphonenumber API 2. If phone exists with no openId (visitor): delete visitor, bind phone to current user 3. If phone exists with same openId: return existing user 4. If phone exists with different openId: error &#39;already bound&#39; 5. Otherwise: update user&#39;s phone and set isVIP&#x3D;0

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.WeChatAuthApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    WeChatAuthApi apiInstance = new WeChatAuthApi(defaultClient);
    String code = "code_example"; // String | Code from wx.getPhoneNumber component
    try {
      Object result = apiInstance.getWechatPhoneApiV1AuthAuthWechatMiniPhonePost_0(code);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling WeChatAuthApi#getWechatPhoneApiV1AuthAuthWechatMiniPhonePost_0");
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
| **code** | **String**| Code from wx.getPhoneNumber component | |

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

<a id="getWechatQrcodeApiV1AuthAuthWechatMiniQrcodeGet"></a>
# **getWechatQrcodeApiV1AuthAuthWechatMiniQrcodeGet**
> Object getWechatQrcodeApiV1AuthAuthWechatMiniQrcodeGet(scene, page)

Get WeChat mini-program QR code

Generate WeChat mini-program unlimited QR code via getwxacodeunlimit.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.WeChatAuthApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    WeChatAuthApi apiInstance = new WeChatAuthApi(defaultClient);
    String scene = "scene_example"; // String | Scene string for QR code
    String page = "pages/index/index"; // String | Mini-program page path
    try {
      Object result = apiInstance.getWechatQrcodeApiV1AuthAuthWechatMiniQrcodeGet(scene, page);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling WeChatAuthApi#getWechatQrcodeApiV1AuthAuthWechatMiniQrcodeGet");
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
| **scene** | **String**| Scene string for QR code | |
| **page** | **String**| Mini-program page path | [optional] [default to pages/index/index] |

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

<a id="getWechatQrcodeApiV1AuthAuthWechatMiniQrcodeGet_0"></a>
# **getWechatQrcodeApiV1AuthAuthWechatMiniQrcodeGet_0**
> Object getWechatQrcodeApiV1AuthAuthWechatMiniQrcodeGet_0(scene, page)

Get WeChat mini-program QR code

Generate WeChat mini-program unlimited QR code via getwxacodeunlimit.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.WeChatAuthApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    WeChatAuthApi apiInstance = new WeChatAuthApi(defaultClient);
    String scene = "scene_example"; // String | Scene string for QR code
    String page = "pages/index/index"; // String | Mini-program page path
    try {
      Object result = apiInstance.getWechatQrcodeApiV1AuthAuthWechatMiniQrcodeGet_0(scene, page);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling WeChatAuthApi#getWechatQrcodeApiV1AuthAuthWechatMiniQrcodeGet_0");
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
| **scene** | **String**| Scene string for QR code | |
| **page** | **String**| Mini-program page path | [optional] [default to pages/index/index] |

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

<a id="wechatMiniLoginApiV1AuthAuthWechatMiniLoginGet"></a>
# **wechatMiniLoginApiV1AuthAuthWechatMiniLoginGet**
> Object wechatMiniLoginApiV1AuthAuthWechatMiniLoginGet(code, parentId)

WeChat mini-program login

WeChat mini-program login.  Matches Java LoginService.login(openId, parentId): - If user not found: create new user with invite_code, nickname &#39;AI_&#39; + 4 random chars,   is_vip&#x3D;-1 (guest), parent_id, isVIP defaults. - If user exists and parent_id is set but user has no parent: update parent_id. - If user exists but has no phone: return 40101 &#39;未验证手机号&#39;. - Returns JWT token with user info.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.WeChatAuthApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    WeChatAuthApi apiInstance = new WeChatAuthApi(defaultClient);
    String code = "code_example"; // String | 
    String parentId = ""; // String | Parent invite code for referral
    try {
      Object result = apiInstance.wechatMiniLoginApiV1AuthAuthWechatMiniLoginGet(code, parentId);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling WeChatAuthApi#wechatMiniLoginApiV1AuthAuthWechatMiniLoginGet");
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
| **code** | **String**|  | |
| **parentId** | **String**| Parent invite code for referral | [optional] [default to ] |

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

<a id="wechatMiniLoginApiV1AuthAuthWechatMiniLoginGet_0"></a>
# **wechatMiniLoginApiV1AuthAuthWechatMiniLoginGet_0**
> Object wechatMiniLoginApiV1AuthAuthWechatMiniLoginGet_0(code, parentId)

WeChat mini-program login

WeChat mini-program login.  Matches Java LoginService.login(openId, parentId): - If user not found: create new user with invite_code, nickname &#39;AI_&#39; + 4 random chars,   is_vip&#x3D;-1 (guest), parent_id, isVIP defaults. - If user exists and parent_id is set but user has no parent: update parent_id. - If user exists but has no phone: return 40101 &#39;未验证手机号&#39;. - Returns JWT token with user info.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.WeChatAuthApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    WeChatAuthApi apiInstance = new WeChatAuthApi(defaultClient);
    String code = "code_example"; // String | 
    String parentId = ""; // String | Parent invite code for referral
    try {
      Object result = apiInstance.wechatMiniLoginApiV1AuthAuthWechatMiniLoginGet_0(code, parentId);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling WeChatAuthApi#wechatMiniLoginApiV1AuthAuthWechatMiniLoginGet_0");
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
| **code** | **String**|  | |
| **parentId** | **String**| Parent invite code for referral | [optional] [default to ] |

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

<a id="wechatRebindApiV1AuthAuthWechatMiniRebindPost"></a>
# **wechatRebindApiV1AuthAuthWechatMiniRebindPost**
> Object wechatRebindApiV1AuthAuthWechatMiniRebindPost(code)

Rebind WeChat mini-program account

Rebind WeChat: unbind old openid, bind new one from code.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.WeChatAuthApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    WeChatAuthApi apiInstance = new WeChatAuthApi(defaultClient);
    String code = "code_example"; // String | New WeChat login code
    try {
      Object result = apiInstance.wechatRebindApiV1AuthAuthWechatMiniRebindPost(code);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling WeChatAuthApi#wechatRebindApiV1AuthAuthWechatMiniRebindPost");
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
| **code** | **String**| New WeChat login code | |

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

<a id="wechatRebindApiV1AuthAuthWechatMiniRebindPost_0"></a>
# **wechatRebindApiV1AuthAuthWechatMiniRebindPost_0**
> Object wechatRebindApiV1AuthAuthWechatMiniRebindPost_0(code)

Rebind WeChat mini-program account

Rebind WeChat: unbind old openid, bind new one from code.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.WeChatAuthApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    WeChatAuthApi apiInstance = new WeChatAuthApi(defaultClient);
    String code = "code_example"; // String | New WeChat login code
    try {
      Object result = apiInstance.wechatRebindApiV1AuthAuthWechatMiniRebindPost_0(code);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling WeChatAuthApi#wechatRebindApiV1AuthAuthWechatMiniRebindPost_0");
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
| **code** | **String**| New WeChat login code | |

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

<a id="wechatRebindByPhoneApiV1AuthAuthWechatMiniRebindByPhonePost"></a>
# **wechatRebindByPhoneApiV1AuthAuthWechatMiniRebindByPhonePost**
> Object wechatRebindByPhoneApiV1AuthAuthWechatMiniRebindByPhonePost(phone, openId)

Rebind WeChat by phone number

Rebind WeChat open_id by phone number.  Matches Java LoginService.editWxOpenId(phone, openId):   UPDATE zhs_user SET open_id &#x3D; #{openId} WHERE phone &#x3D; #{phone}  This is the original ZHS phone-based rebind endpoint.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.WeChatAuthApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    WeChatAuthApi apiInstance = new WeChatAuthApi(defaultClient);
    String phone = "phone_example"; // String | User phone number
    String openId = "openId_example"; // String | New WeChat open_id to bind
    try {
      Object result = apiInstance.wechatRebindByPhoneApiV1AuthAuthWechatMiniRebindByPhonePost(phone, openId);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling WeChatAuthApi#wechatRebindByPhoneApiV1AuthAuthWechatMiniRebindByPhonePost");
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
| **phone** | **String**| User phone number | |
| **openId** | **String**| New WeChat open_id to bind | |

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

<a id="wechatRebindByPhoneApiV1AuthAuthWechatMiniRebindByPhonePost_0"></a>
# **wechatRebindByPhoneApiV1AuthAuthWechatMiniRebindByPhonePost_0**
> Object wechatRebindByPhoneApiV1AuthAuthWechatMiniRebindByPhonePost_0(phone, openId)

Rebind WeChat by phone number

Rebind WeChat open_id by phone number.  Matches Java LoginService.editWxOpenId(phone, openId):   UPDATE zhs_user SET open_id &#x3D; #{openId} WHERE phone &#x3D; #{phone}  This is the original ZHS phone-based rebind endpoint.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.WeChatAuthApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    WeChatAuthApi apiInstance = new WeChatAuthApi(defaultClient);
    String phone = "phone_example"; // String | User phone number
    String openId = "openId_example"; // String | New WeChat open_id to bind
    try {
      Object result = apiInstance.wechatRebindByPhoneApiV1AuthAuthWechatMiniRebindByPhonePost_0(phone, openId);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling WeChatAuthApi#wechatRebindByPhoneApiV1AuthAuthWechatMiniRebindByPhonePost_0");
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
| **phone** | **String**| User phone number | |
| **openId** | **String**| New WeChat open_id to bind | |

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

