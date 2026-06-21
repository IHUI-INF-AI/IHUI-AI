# WeChatAuthApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**getWechatPhoneApiV1AuthAuthWechatMiniPhonePost**](#getwechatphoneapiv1authauthwechatminiphonepost) | **POST** /api/v1/auth/auth/wechat/mini/phone | Get WeChat phone number|
|[**getWechatPhoneApiV1AuthAuthWechatMiniPhonePost_0**](#getwechatphoneapiv1authauthwechatminiphonepost_0) | **POST** /api/v1/auth/auth/wechat/mini/phone | Get WeChat phone number|
|[**getWechatQrcodeApiV1AuthAuthWechatMiniQrcodeGet**](#getwechatqrcodeapiv1authauthwechatminiqrcodeget) | **GET** /api/v1/auth/auth/wechat/mini/qrcode | Get WeChat mini-program QR code|
|[**getWechatQrcodeApiV1AuthAuthWechatMiniQrcodeGet_0**](#getwechatqrcodeapiv1authauthwechatminiqrcodeget_0) | **GET** /api/v1/auth/auth/wechat/mini/qrcode | Get WeChat mini-program QR code|
|[**wechatMiniLoginApiV1AuthAuthWechatMiniLoginGet**](#wechatminiloginapiv1authauthwechatminiloginget) | **GET** /api/v1/auth/auth/wechat/mini/login | WeChat mini-program login|
|[**wechatMiniLoginApiV1AuthAuthWechatMiniLoginGet_0**](#wechatminiloginapiv1authauthwechatminiloginget_0) | **GET** /api/v1/auth/auth/wechat/mini/login | WeChat mini-program login|
|[**wechatRebindApiV1AuthAuthWechatMiniRebindPost**](#wechatrebindapiv1authauthwechatminirebindpost) | **POST** /api/v1/auth/auth/wechat/mini/rebind | Rebind WeChat mini-program account|
|[**wechatRebindApiV1AuthAuthWechatMiniRebindPost_0**](#wechatrebindapiv1authauthwechatminirebindpost_0) | **POST** /api/v1/auth/auth/wechat/mini/rebind | Rebind WeChat mini-program account|
|[**wechatRebindByPhoneApiV1AuthAuthWechatMiniRebindByPhonePost**](#wechatrebindbyphoneapiv1authauthwechatminirebindbyphonepost) | **POST** /api/v1/auth/auth/wechat/mini/rebind_by_phone | Rebind WeChat by phone number|
|[**wechatRebindByPhoneApiV1AuthAuthWechatMiniRebindByPhonePost_0**](#wechatrebindbyphoneapiv1authauthwechatminirebindbyphonepost_0) | **POST** /api/v1/auth/auth/wechat/mini/rebind_by_phone | Rebind WeChat by phone number|

# **getWechatPhoneApiV1AuthAuthWechatMiniPhonePost**
> any getWechatPhoneApiV1AuthAuthWechatMiniPhonePost()

Get phone number via WeChat mini-program getuserphonenumber API.  Matches Java LoginService.getPhoneNumber(code, openId): 1. Get access_token, call getuserphonenumber API 2. If phone exists with no openId (visitor): delete visitor, bind phone to current user 3. If phone exists with same openId: return existing user 4. If phone exists with different openId: error \'already bound\' 5. Otherwise: update user\'s phone and set isVIP=0

### Example

```typescript
import {
    WeChatAuthApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new WeChatAuthApi(configuration);

let code: string; //Code from wx.getPhoneNumber component (default to undefined)

const { status, data } = await apiInstance.getWechatPhoneApiV1AuthAuthWechatMiniPhonePost(
    code
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **code** | [**string**] | Code from wx.getPhoneNumber component | defaults to undefined|


### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **getWechatPhoneApiV1AuthAuthWechatMiniPhonePost_0**
> any getWechatPhoneApiV1AuthAuthWechatMiniPhonePost_0()

Get phone number via WeChat mini-program getuserphonenumber API.  Matches Java LoginService.getPhoneNumber(code, openId): 1. Get access_token, call getuserphonenumber API 2. If phone exists with no openId (visitor): delete visitor, bind phone to current user 3. If phone exists with same openId: return existing user 4. If phone exists with different openId: error \'already bound\' 5. Otherwise: update user\'s phone and set isVIP=0

### Example

```typescript
import {
    WeChatAuthApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new WeChatAuthApi(configuration);

let code: string; //Code from wx.getPhoneNumber component (default to undefined)

const { status, data } = await apiInstance.getWechatPhoneApiV1AuthAuthWechatMiniPhonePost_0(
    code
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **code** | [**string**] | Code from wx.getPhoneNumber component | defaults to undefined|


### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **getWechatQrcodeApiV1AuthAuthWechatMiniQrcodeGet**
> any getWechatQrcodeApiV1AuthAuthWechatMiniQrcodeGet()

Generate WeChat mini-program unlimited QR code via getwxacodeunlimit.

### Example

```typescript
import {
    WeChatAuthApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new WeChatAuthApi(configuration);

let scene: string; //Scene string for QR code (default to undefined)
let page: string; //Mini-program page path (optional) (default to 'pages/index/index')

const { status, data } = await apiInstance.getWechatQrcodeApiV1AuthAuthWechatMiniQrcodeGet(
    scene,
    page
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **scene** | [**string**] | Scene string for QR code | defaults to undefined|
| **page** | [**string**] | Mini-program page path | (optional) defaults to 'pages/index/index'|


### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **getWechatQrcodeApiV1AuthAuthWechatMiniQrcodeGet_0**
> any getWechatQrcodeApiV1AuthAuthWechatMiniQrcodeGet_0()

Generate WeChat mini-program unlimited QR code via getwxacodeunlimit.

### Example

```typescript
import {
    WeChatAuthApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new WeChatAuthApi(configuration);

let scene: string; //Scene string for QR code (default to undefined)
let page: string; //Mini-program page path (optional) (default to 'pages/index/index')

const { status, data } = await apiInstance.getWechatQrcodeApiV1AuthAuthWechatMiniQrcodeGet_0(
    scene,
    page
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **scene** | [**string**] | Scene string for QR code | defaults to undefined|
| **page** | [**string**] | Mini-program page path | (optional) defaults to 'pages/index/index'|


### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **wechatMiniLoginApiV1AuthAuthWechatMiniLoginGet**
> any wechatMiniLoginApiV1AuthAuthWechatMiniLoginGet()

WeChat mini-program login.  Matches Java LoginService.login(openId, parentId): - If user not found: create new user with invite_code, nickname \'AI_\' + 4 random chars,   is_vip=-1 (guest), parent_id, isVIP defaults. - If user exists and parent_id is set but user has no parent: update parent_id. - If user exists but has no phone: return 40101 \'未验证手机号\'. - Returns JWT token with user info.

### Example

```typescript
import {
    WeChatAuthApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new WeChatAuthApi(configuration);

let code: string; // (default to undefined)
let parentId: string; //Parent invite code for referral (optional) (default to '')

const { status, data } = await apiInstance.wechatMiniLoginApiV1AuthAuthWechatMiniLoginGet(
    code,
    parentId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **code** | [**string**] |  | defaults to undefined|
| **parentId** | [**string**] | Parent invite code for referral | (optional) defaults to ''|


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **wechatMiniLoginApiV1AuthAuthWechatMiniLoginGet_0**
> any wechatMiniLoginApiV1AuthAuthWechatMiniLoginGet_0()

WeChat mini-program login.  Matches Java LoginService.login(openId, parentId): - If user not found: create new user with invite_code, nickname \'AI_\' + 4 random chars,   is_vip=-1 (guest), parent_id, isVIP defaults. - If user exists and parent_id is set but user has no parent: update parent_id. - If user exists but has no phone: return 40101 \'未验证手机号\'. - Returns JWT token with user info.

### Example

```typescript
import {
    WeChatAuthApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new WeChatAuthApi(configuration);

let code: string; // (default to undefined)
let parentId: string; //Parent invite code for referral (optional) (default to '')

const { status, data } = await apiInstance.wechatMiniLoginApiV1AuthAuthWechatMiniLoginGet_0(
    code,
    parentId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **code** | [**string**] |  | defaults to undefined|
| **parentId** | [**string**] | Parent invite code for referral | (optional) defaults to ''|


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **wechatRebindApiV1AuthAuthWechatMiniRebindPost**
> any wechatRebindApiV1AuthAuthWechatMiniRebindPost()

Rebind WeChat: unbind old openid, bind new one from code.

### Example

```typescript
import {
    WeChatAuthApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new WeChatAuthApi(configuration);

let code: string; //New WeChat login code (default to undefined)

const { status, data } = await apiInstance.wechatRebindApiV1AuthAuthWechatMiniRebindPost(
    code
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **code** | [**string**] | New WeChat login code | defaults to undefined|


### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **wechatRebindApiV1AuthAuthWechatMiniRebindPost_0**
> any wechatRebindApiV1AuthAuthWechatMiniRebindPost_0()

Rebind WeChat: unbind old openid, bind new one from code.

### Example

```typescript
import {
    WeChatAuthApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new WeChatAuthApi(configuration);

let code: string; //New WeChat login code (default to undefined)

const { status, data } = await apiInstance.wechatRebindApiV1AuthAuthWechatMiniRebindPost_0(
    code
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **code** | [**string**] | New WeChat login code | defaults to undefined|


### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **wechatRebindByPhoneApiV1AuthAuthWechatMiniRebindByPhonePost**
> any wechatRebindByPhoneApiV1AuthAuthWechatMiniRebindByPhonePost()

Rebind WeChat open_id by phone number.  Matches Java LoginService.editWxOpenId(phone, openId):   UPDATE zhs_user SET open_id = #{openId} WHERE phone = #{phone}  This is the original ZHS phone-based rebind endpoint.

### Example

```typescript
import {
    WeChatAuthApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new WeChatAuthApi(configuration);

let phone: string; //User phone number (default to undefined)
let openId: string; //New WeChat open_id to bind (default to undefined)

const { status, data } = await apiInstance.wechatRebindByPhoneApiV1AuthAuthWechatMiniRebindByPhonePost(
    phone,
    openId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **phone** | [**string**] | User phone number | defaults to undefined|
| **openId** | [**string**] | New WeChat open_id to bind | defaults to undefined|


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **wechatRebindByPhoneApiV1AuthAuthWechatMiniRebindByPhonePost_0**
> any wechatRebindByPhoneApiV1AuthAuthWechatMiniRebindByPhonePost_0()

Rebind WeChat open_id by phone number.  Matches Java LoginService.editWxOpenId(phone, openId):   UPDATE zhs_user SET open_id = #{openId} WHERE phone = #{phone}  This is the original ZHS phone-based rebind endpoint.

### Example

```typescript
import {
    WeChatAuthApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new WeChatAuthApi(configuration);

let phone: string; //User phone number (default to undefined)
let openId: string; //New WeChat open_id to bind (default to undefined)

const { status, data } = await apiInstance.wechatRebindByPhoneApiV1AuthAuthWechatMiniRebindByPhonePost_0(
    phone,
    openId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **phone** | [**string**] | User phone number | defaults to undefined|
| **openId** | [**string**] | New WeChat open_id to bind | defaults to undefined|


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

