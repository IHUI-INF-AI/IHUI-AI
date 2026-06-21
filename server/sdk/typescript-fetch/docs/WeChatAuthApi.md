# WeChatAuthApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**getWechatPhoneApiV1AuthAuthWechatMiniPhonePost**](WeChatAuthApi.md#getwechatphoneapiv1authauthwechatminiphonepost) | **POST** /api/v1/auth/auth/wechat/mini/phone | Get WeChat phone number |
| [**getWechatPhoneApiV1AuthAuthWechatMiniPhonePost_0**](WeChatAuthApi.md#getwechatphoneapiv1authauthwechatminiphonepost_0) | **POST** /api/v1/auth/auth/wechat/mini/phone | Get WeChat phone number |
| [**getWechatQrcodeApiV1AuthAuthWechatMiniQrcodeGet**](WeChatAuthApi.md#getwechatqrcodeapiv1authauthwechatminiqrcodeget) | **GET** /api/v1/auth/auth/wechat/mini/qrcode | Get WeChat mini-program QR code |
| [**getWechatQrcodeApiV1AuthAuthWechatMiniQrcodeGet_0**](WeChatAuthApi.md#getwechatqrcodeapiv1authauthwechatminiqrcodeget_0) | **GET** /api/v1/auth/auth/wechat/mini/qrcode | Get WeChat mini-program QR code |
| [**wechatMiniLoginApiV1AuthAuthWechatMiniLoginGet**](WeChatAuthApi.md#wechatminiloginapiv1authauthwechatminiloginget) | **GET** /api/v1/auth/auth/wechat/mini/login | WeChat mini-program login |
| [**wechatMiniLoginApiV1AuthAuthWechatMiniLoginGet_0**](WeChatAuthApi.md#wechatminiloginapiv1authauthwechatminiloginget_0) | **GET** /api/v1/auth/auth/wechat/mini/login | WeChat mini-program login |
| [**wechatRebindApiV1AuthAuthWechatMiniRebindPost**](WeChatAuthApi.md#wechatrebindapiv1authauthwechatminirebindpost) | **POST** /api/v1/auth/auth/wechat/mini/rebind | Rebind WeChat mini-program account |
| [**wechatRebindApiV1AuthAuthWechatMiniRebindPost_0**](WeChatAuthApi.md#wechatrebindapiv1authauthwechatminirebindpost_0) | **POST** /api/v1/auth/auth/wechat/mini/rebind | Rebind WeChat mini-program account |
| [**wechatRebindByPhoneApiV1AuthAuthWechatMiniRebindByPhonePost**](WeChatAuthApi.md#wechatrebindbyphoneapiv1authauthwechatminirebindbyphonepost) | **POST** /api/v1/auth/auth/wechat/mini/rebind_by_phone | Rebind WeChat by phone number |
| [**wechatRebindByPhoneApiV1AuthAuthWechatMiniRebindByPhonePost_0**](WeChatAuthApi.md#wechatrebindbyphoneapiv1authauthwechatminirebindbyphonepost_0) | **POST** /api/v1/auth/auth/wechat/mini/rebind_by_phone | Rebind WeChat by phone number |



## getWechatPhoneApiV1AuthAuthWechatMiniPhonePost

> any getWechatPhoneApiV1AuthAuthWechatMiniPhonePost(code)

Get WeChat phone number

Get phone number via WeChat mini-program getuserphonenumber API.  Matches Java LoginService.getPhoneNumber(code, openId): 1. Get access_token, call getuserphonenumber API 2. If phone exists with no openId (visitor): delete visitor, bind phone to current user 3. If phone exists with same openId: return existing user 4. If phone exists with different openId: error \&#39;already bound\&#39; 5. Otherwise: update user\&#39;s phone and set isVIP&#x3D;0

### Example

```ts
import {
  Configuration,
  WeChatAuthApi,
} from '';
import type { GetWechatPhoneApiV1AuthAuthWechatMiniPhonePostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new WeChatAuthApi(config);

  const body = {
    // string | Code from wx.getPhoneNumber component
    code: code_example,
  } satisfies GetWechatPhoneApiV1AuthAuthWechatMiniPhonePostRequest;

  try {
    const data = await api.getWechatPhoneApiV1AuthAuthWechatMiniPhonePost(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **code** | `string` | Code from wx.getPhoneNumber component | [Defaults to `undefined`] |

### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## getWechatPhoneApiV1AuthAuthWechatMiniPhonePost_0

> any getWechatPhoneApiV1AuthAuthWechatMiniPhonePost_0(code)

Get WeChat phone number

Get phone number via WeChat mini-program getuserphonenumber API.  Matches Java LoginService.getPhoneNumber(code, openId): 1. Get access_token, call getuserphonenumber API 2. If phone exists with no openId (visitor): delete visitor, bind phone to current user 3. If phone exists with same openId: return existing user 4. If phone exists with different openId: error \&#39;already bound\&#39; 5. Otherwise: update user\&#39;s phone and set isVIP&#x3D;0

### Example

```ts
import {
  Configuration,
  WeChatAuthApi,
} from '';
import type { GetWechatPhoneApiV1AuthAuthWechatMiniPhonePost0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new WeChatAuthApi(config);

  const body = {
    // string | Code from wx.getPhoneNumber component
    code: code_example,
  } satisfies GetWechatPhoneApiV1AuthAuthWechatMiniPhonePost0Request;

  try {
    const data = await api.getWechatPhoneApiV1AuthAuthWechatMiniPhonePost_0(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **code** | `string` | Code from wx.getPhoneNumber component | [Defaults to `undefined`] |

### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## getWechatQrcodeApiV1AuthAuthWechatMiniQrcodeGet

> any getWechatQrcodeApiV1AuthAuthWechatMiniQrcodeGet(scene, page)

Get WeChat mini-program QR code

Generate WeChat mini-program unlimited QR code via getwxacodeunlimit.

### Example

```ts
import {
  Configuration,
  WeChatAuthApi,
} from '';
import type { GetWechatQrcodeApiV1AuthAuthWechatMiniQrcodeGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new WeChatAuthApi(config);

  const body = {
    // string | Scene string for QR code
    scene: scene_example,
    // string | Mini-program page path (optional)
    page: page_example,
  } satisfies GetWechatQrcodeApiV1AuthAuthWechatMiniQrcodeGetRequest;

  try {
    const data = await api.getWechatQrcodeApiV1AuthAuthWechatMiniQrcodeGet(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **scene** | `string` | Scene string for QR code | [Defaults to `undefined`] |
| **page** | `string` | Mini-program page path | [Optional] [Defaults to `&#39;pages/index/index&#39;`] |

### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## getWechatQrcodeApiV1AuthAuthWechatMiniQrcodeGet_0

> any getWechatQrcodeApiV1AuthAuthWechatMiniQrcodeGet_0(scene, page)

Get WeChat mini-program QR code

Generate WeChat mini-program unlimited QR code via getwxacodeunlimit.

### Example

```ts
import {
  Configuration,
  WeChatAuthApi,
} from '';
import type { GetWechatQrcodeApiV1AuthAuthWechatMiniQrcodeGet0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new WeChatAuthApi(config);

  const body = {
    // string | Scene string for QR code
    scene: scene_example,
    // string | Mini-program page path (optional)
    page: page_example,
  } satisfies GetWechatQrcodeApiV1AuthAuthWechatMiniQrcodeGet0Request;

  try {
    const data = await api.getWechatQrcodeApiV1AuthAuthWechatMiniQrcodeGet_0(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **scene** | `string` | Scene string for QR code | [Defaults to `undefined`] |
| **page** | `string` | Mini-program page path | [Optional] [Defaults to `&#39;pages/index/index&#39;`] |

### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## wechatMiniLoginApiV1AuthAuthWechatMiniLoginGet

> any wechatMiniLoginApiV1AuthAuthWechatMiniLoginGet(code, parentId)

WeChat mini-program login

WeChat mini-program login.  Matches Java LoginService.login(openId, parentId): - If user not found: create new user with invite_code, nickname \&#39;AI_\&#39; + 4 random chars,   is_vip&#x3D;-1 (guest), parent_id, isVIP defaults. - If user exists and parent_id is set but user has no parent: update parent_id. - If user exists but has no phone: return 40101 \&#39;未验证手机号\&#39;. - Returns JWT token with user info.

### Example

```ts
import {
  Configuration,
  WeChatAuthApi,
} from '';
import type { WechatMiniLoginApiV1AuthAuthWechatMiniLoginGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new WeChatAuthApi();

  const body = {
    // string
    code: code_example,
    // string | Parent invite code for referral (optional)
    parentId: parentId_example,
  } satisfies WechatMiniLoginApiV1AuthAuthWechatMiniLoginGetRequest;

  try {
    const data = await api.wechatMiniLoginApiV1AuthAuthWechatMiniLoginGet(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **code** | `string` |  | [Defaults to `undefined`] |
| **parentId** | `string` | Parent invite code for referral | [Optional] [Defaults to `&#39;&#39;`] |

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## wechatMiniLoginApiV1AuthAuthWechatMiniLoginGet_0

> any wechatMiniLoginApiV1AuthAuthWechatMiniLoginGet_0(code, parentId)

WeChat mini-program login

WeChat mini-program login.  Matches Java LoginService.login(openId, parentId): - If user not found: create new user with invite_code, nickname \&#39;AI_\&#39; + 4 random chars,   is_vip&#x3D;-1 (guest), parent_id, isVIP defaults. - If user exists and parent_id is set but user has no parent: update parent_id. - If user exists but has no phone: return 40101 \&#39;未验证手机号\&#39;. - Returns JWT token with user info.

### Example

```ts
import {
  Configuration,
  WeChatAuthApi,
} from '';
import type { WechatMiniLoginApiV1AuthAuthWechatMiniLoginGet0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new WeChatAuthApi();

  const body = {
    // string
    code: code_example,
    // string | Parent invite code for referral (optional)
    parentId: parentId_example,
  } satisfies WechatMiniLoginApiV1AuthAuthWechatMiniLoginGet0Request;

  try {
    const data = await api.wechatMiniLoginApiV1AuthAuthWechatMiniLoginGet_0(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **code** | `string` |  | [Defaults to `undefined`] |
| **parentId** | `string` | Parent invite code for referral | [Optional] [Defaults to `&#39;&#39;`] |

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## wechatRebindApiV1AuthAuthWechatMiniRebindPost

> any wechatRebindApiV1AuthAuthWechatMiniRebindPost(code)

Rebind WeChat mini-program account

Rebind WeChat: unbind old openid, bind new one from code.

### Example

```ts
import {
  Configuration,
  WeChatAuthApi,
} from '';
import type { WechatRebindApiV1AuthAuthWechatMiniRebindPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new WeChatAuthApi(config);

  const body = {
    // string | New WeChat login code
    code: code_example,
  } satisfies WechatRebindApiV1AuthAuthWechatMiniRebindPostRequest;

  try {
    const data = await api.wechatRebindApiV1AuthAuthWechatMiniRebindPost(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **code** | `string` | New WeChat login code | [Defaults to `undefined`] |

### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## wechatRebindApiV1AuthAuthWechatMiniRebindPost_0

> any wechatRebindApiV1AuthAuthWechatMiniRebindPost_0(code)

Rebind WeChat mini-program account

Rebind WeChat: unbind old openid, bind new one from code.

### Example

```ts
import {
  Configuration,
  WeChatAuthApi,
} from '';
import type { WechatRebindApiV1AuthAuthWechatMiniRebindPost0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new WeChatAuthApi(config);

  const body = {
    // string | New WeChat login code
    code: code_example,
  } satisfies WechatRebindApiV1AuthAuthWechatMiniRebindPost0Request;

  try {
    const data = await api.wechatRebindApiV1AuthAuthWechatMiniRebindPost_0(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **code** | `string` | New WeChat login code | [Defaults to `undefined`] |

### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## wechatRebindByPhoneApiV1AuthAuthWechatMiniRebindByPhonePost

> any wechatRebindByPhoneApiV1AuthAuthWechatMiniRebindByPhonePost(phone, openId)

Rebind WeChat by phone number

Rebind WeChat open_id by phone number.  Matches Java LoginService.editWxOpenId(phone, openId):   UPDATE zhs_user SET open_id &#x3D; #{openId} WHERE phone &#x3D; #{phone}  This is the original ZHS phone-based rebind endpoint.

### Example

```ts
import {
  Configuration,
  WeChatAuthApi,
} from '';
import type { WechatRebindByPhoneApiV1AuthAuthWechatMiniRebindByPhonePostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new WeChatAuthApi();

  const body = {
    // string | User phone number
    phone: phone_example,
    // string | New WeChat open_id to bind
    openId: openId_example,
  } satisfies WechatRebindByPhoneApiV1AuthAuthWechatMiniRebindByPhonePostRequest;

  try {
    const data = await api.wechatRebindByPhoneApiV1AuthAuthWechatMiniRebindByPhonePost(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **phone** | `string` | User phone number | [Defaults to `undefined`] |
| **openId** | `string` | New WeChat open_id to bind | [Defaults to `undefined`] |

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## wechatRebindByPhoneApiV1AuthAuthWechatMiniRebindByPhonePost_0

> any wechatRebindByPhoneApiV1AuthAuthWechatMiniRebindByPhonePost_0(phone, openId)

Rebind WeChat by phone number

Rebind WeChat open_id by phone number.  Matches Java LoginService.editWxOpenId(phone, openId):   UPDATE zhs_user SET open_id &#x3D; #{openId} WHERE phone &#x3D; #{phone}  This is the original ZHS phone-based rebind endpoint.

### Example

```ts
import {
  Configuration,
  WeChatAuthApi,
} from '';
import type { WechatRebindByPhoneApiV1AuthAuthWechatMiniRebindByPhonePost0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new WeChatAuthApi();

  const body = {
    // string | User phone number
    phone: phone_example,
    // string | New WeChat open_id to bind
    openId: openId_example,
  } satisfies WechatRebindByPhoneApiV1AuthAuthWechatMiniRebindByPhonePost0Request;

  try {
    const data = await api.wechatRebindByPhoneApiV1AuthAuthWechatMiniRebindByPhonePost_0(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **phone** | `string` | User phone number | [Defaults to `undefined`] |
| **openId** | `string` | New WeChat open_id to bind | [Defaults to `undefined`] |

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

