# AuthenticationApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**cancelAccountApiV1AuthAuthCancelDelete**](#cancelaccountapiv1authauthcanceldelete) | **DELETE** /api/v1/auth/auth/cancel | User account cancellation (soft delete)|
|[**cancelAccountApiV1AuthAuthCancelDelete_0**](#cancelaccountapiv1authauthcanceldelete_0) | **DELETE** /api/v1/auth/auth/cancel | User account cancellation (soft delete)|
|[**changePasswordApiV1AuthAuthProfilePasswordPut**](#changepasswordapiv1authauthprofilepasswordput) | **PUT** /api/v1/auth/auth/profile/password | Change password|
|[**changePasswordApiV1AuthAuthProfilePasswordPut_0**](#changepasswordapiv1authauthprofilepasswordput_0) | **PUT** /api/v1/auth/auth/profile/password | Change password|
|[**checkPhoneExistsApiV1AuthAuthExistPhoneGet**](#checkphoneexistsapiv1authauthexistphoneget) | **GET** /api/v1/auth/auth/exist/{phone} | Check if phone is registered|
|[**checkPhoneExistsApiV1AuthAuthExistPhoneGet_0**](#checkphoneexistsapiv1authauthexistphoneget_0) | **GET** /api/v1/auth/auth/exist/{phone} | Check if phone is registered|
|[**getProfileApiV1AuthAuthProfileGet**](#getprofileapiv1authauthprofileget) | **GET** /api/v1/auth/auth/profile | Get personal profile with roles and posts|
|[**getProfileApiV1AuthAuthProfileGet_0**](#getprofileapiv1authauthprofileget_0) | **GET** /api/v1/auth/auth/profile | Get personal profile with roles and posts|
|[**getUserInfoApiV1AuthAuthInfoGet**](#getuserinfoapiv1authauthinfoget) | **GET** /api/v1/auth/auth/info | Get current user info|
|[**getUserInfoApiV1AuthAuthInfoGet_0**](#getuserinfoapiv1authauthinfoget_0) | **GET** /api/v1/auth/auth/info | Get current user info|
|[**loginApiV1AuthAuthLoginPost**](#loginapiv1authauthloginpost) | **POST** /api/v1/auth/auth/login | Password login|
|[**loginApiV1AuthAuthLoginPost_0**](#loginapiv1authauthloginpost_0) | **POST** /api/v1/auth/auth/login | Password login|
|[**loginSmsApiV1AuthAuthLoginSmsPost**](#loginsmsapiv1authauthloginsmspost) | **POST** /api/v1/auth/auth/login/sms | SMS code login|
|[**loginSmsApiV1AuthAuthLoginSmsPost_0**](#loginsmsapiv1authauthloginsmspost_0) | **POST** /api/v1/auth/auth/login/sms | SMS code login|
|[**logoutApiV1AuthAuthLogoutPost**](#logoutapiv1authauthlogoutpost) | **POST** /api/v1/auth/auth/logout | Logout|
|[**logoutApiV1AuthAuthLogoutPost_0**](#logoutapiv1authauthlogoutpost_0) | **POST** /api/v1/auth/auth/logout | Logout|
|[**refreshTokenApiV1AuthAuthRefreshPost**](#refreshtokenapiv1authauthrefreshpost) | **POST** /api/v1/auth/auth/refresh | Refresh access token (rotate)|
|[**refreshTokenApiV1AuthAuthRefreshPost_0**](#refreshtokenapiv1authauthrefreshpost_0) | **POST** /api/v1/auth/auth/refresh | Refresh access token (rotate)|
|[**registerApiV1AuthAuthRegisterPost**](#registerapiv1authauthregisterpost) | **POST** /api/v1/auth/auth/register | Register new user|
|[**registerApiV1AuthAuthRegisterPost_0**](#registerapiv1authauthregisterpost_0) | **POST** /api/v1/auth/auth/register | Register new user|
|[**sendCodeApiV1AuthAuthSmsCodePost**](#sendcodeapiv1authauthsmscodepost) | **POST** /api/v1/auth/auth/sms/code | Send SMS verification code|
|[**sendCodeApiV1AuthAuthSmsCodePost_0**](#sendcodeapiv1authauthsmscodepost_0) | **POST** /api/v1/auth/auth/sms/code | Send SMS verification code|
|[**updateProfileApiV1AuthAuthProfilePut**](#updateprofileapiv1authauthprofileput) | **PUT** /api/v1/auth/auth/profile | Update personal profile|
|[**updateProfileApiV1AuthAuthProfilePut_0**](#updateprofileapiv1authauthprofileput_0) | **PUT** /api/v1/auth/auth/profile | Update personal profile|
|[**uploadAvatarApiV1AuthAuthProfileAvatarPost**](#uploadavatarapiv1authauthprofileavatarpost) | **POST** /api/v1/auth/auth/profile/avatar | Upload avatar|
|[**uploadAvatarApiV1AuthAuthProfileAvatarPost_0**](#uploadavatarapiv1authauthprofileavatarpost_0) | **POST** /api/v1/auth/auth/profile/avatar | Upload avatar|

# **cancelAccountApiV1AuthAuthCancelDelete**
> any cancelAccountApiV1AuthAuthCancelDelete()

Cancel user account -- soft delete user and mask phone.  Matches Java SQL:   UPDATE users u LEFT JOIN user_auth_info uai ON u.uuid = uai.user_uuid   SET u.status = 3, uai.cancel_phone = uai.phone, uai.phone = NULL   WHERE u.uuid = #{uuid}  Note: Java does NOT delete third-party bindings on cancel, only masks phone.

### Example

```typescript
import {
    AuthenticationApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AuthenticationApi(configuration);

const { status, data } = await apiInstance.cancelAccountApiV1AuthAuthCancelDelete();
```

### Parameters
This endpoint does not have any parameters.


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

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **cancelAccountApiV1AuthAuthCancelDelete_0**
> any cancelAccountApiV1AuthAuthCancelDelete_0()

Cancel user account -- soft delete user and mask phone.  Matches Java SQL:   UPDATE users u LEFT JOIN user_auth_info uai ON u.uuid = uai.user_uuid   SET u.status = 3, uai.cancel_phone = uai.phone, uai.phone = NULL   WHERE u.uuid = #{uuid}  Note: Java does NOT delete third-party bindings on cancel, only masks phone.

### Example

```typescript
import {
    AuthenticationApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AuthenticationApi(configuration);

const { status, data } = await apiInstance.cancelAccountApiV1AuthAuthCancelDelete_0();
```

### Parameters
This endpoint does not have any parameters.


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

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **changePasswordApiV1AuthAuthProfilePasswordPut**
> any changePasswordApiV1AuthAuthProfilePasswordPut(bodyChangePasswordApiV1AuthAuthProfilePasswordPut)

Change user password — verifies old password before setting new one.

### Example

```typescript
import {
    AuthenticationApi,
    Configuration,
    BodyChangePasswordApiV1AuthAuthProfilePasswordPut
} from './api';

const configuration = new Configuration();
const apiInstance = new AuthenticationApi(configuration);

let bodyChangePasswordApiV1AuthAuthProfilePasswordPut: BodyChangePasswordApiV1AuthAuthProfilePasswordPut; //

const { status, data } = await apiInstance.changePasswordApiV1AuthAuthProfilePasswordPut(
    bodyChangePasswordApiV1AuthAuthProfilePasswordPut
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **bodyChangePasswordApiV1AuthAuthProfilePasswordPut** | **BodyChangePasswordApiV1AuthAuthProfilePasswordPut**|  | |


### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **changePasswordApiV1AuthAuthProfilePasswordPut_0**
> any changePasswordApiV1AuthAuthProfilePasswordPut_0(bodyChangePasswordApiV1AuthAuthProfilePasswordPut)

Change user password — verifies old password before setting new one.

### Example

```typescript
import {
    AuthenticationApi,
    Configuration,
    BodyChangePasswordApiV1AuthAuthProfilePasswordPut
} from './api';

const configuration = new Configuration();
const apiInstance = new AuthenticationApi(configuration);

let bodyChangePasswordApiV1AuthAuthProfilePasswordPut: BodyChangePasswordApiV1AuthAuthProfilePasswordPut; //

const { status, data } = await apiInstance.changePasswordApiV1AuthAuthProfilePasswordPut_0(
    bodyChangePasswordApiV1AuthAuthProfilePasswordPut
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **bodyChangePasswordApiV1AuthAuthProfilePasswordPut** | **BodyChangePasswordApiV1AuthAuthProfilePasswordPut**|  | |


### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **checkPhoneExistsApiV1AuthAuthExistPhoneGet**
> any checkPhoneExistsApiV1AuthAuthExistPhoneGet()


### Example

```typescript
import {
    AuthenticationApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AuthenticationApi(configuration);

let phone: string; // (default to undefined)

const { status, data } = await apiInstance.checkPhoneExistsApiV1AuthAuthExistPhoneGet(
    phone
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **phone** | [**string**] |  | defaults to undefined|


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

# **checkPhoneExistsApiV1AuthAuthExistPhoneGet_0**
> any checkPhoneExistsApiV1AuthAuthExistPhoneGet_0()


### Example

```typescript
import {
    AuthenticationApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AuthenticationApi(configuration);

let phone: string; // (default to undefined)

const { status, data } = await apiInstance.checkPhoneExistsApiV1AuthAuthExistPhoneGet_0(
    phone
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **phone** | [**string**] |  | defaults to undefined|


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

# **getProfileApiV1AuthAuthProfileGet**
> any getProfileApiV1AuthAuthProfileGet()

Get detailed profile including roles and posts.

### Example

```typescript
import {
    AuthenticationApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AuthenticationApi(configuration);

const { status, data } = await apiInstance.getProfileApiV1AuthAuthProfileGet();
```

### Parameters
This endpoint does not have any parameters.


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

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **getProfileApiV1AuthAuthProfileGet_0**
> any getProfileApiV1AuthAuthProfileGet_0()

Get detailed profile including roles and posts.

### Example

```typescript
import {
    AuthenticationApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AuthenticationApi(configuration);

const { status, data } = await apiInstance.getProfileApiV1AuthAuthProfileGet_0();
```

### Parameters
This endpoint does not have any parameters.


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

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **getUserInfoApiV1AuthAuthInfoGet**
> any getUserInfoApiV1AuthAuthInfoGet()


### Example

```typescript
import {
    AuthenticationApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AuthenticationApi(configuration);

const { status, data } = await apiInstance.getUserInfoApiV1AuthAuthInfoGet();
```

### Parameters
This endpoint does not have any parameters.


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

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **getUserInfoApiV1AuthAuthInfoGet_0**
> any getUserInfoApiV1AuthAuthInfoGet_0()


### Example

```typescript
import {
    AuthenticationApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AuthenticationApi(configuration);

const { status, data } = await apiInstance.getUserInfoApiV1AuthAuthInfoGet_0();
```

### Parameters
This endpoint does not have any parameters.


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

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **loginApiV1AuthAuthLoginPost**
> any loginApiV1AuthAuthLoginPost()


### Example

```typescript
import {
    AuthenticationApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AuthenticationApi(configuration);

let phone: string; // (default to undefined)
let password: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.loginApiV1AuthAuthLoginPost(
    phone,
    password
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **phone** | [**string**] |  | defaults to undefined|
| **password** | [**string**] |  | (optional) defaults to undefined|


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

# **loginApiV1AuthAuthLoginPost_0**
> any loginApiV1AuthAuthLoginPost_0()


### Example

```typescript
import {
    AuthenticationApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AuthenticationApi(configuration);

let phone: string; // (default to undefined)
let password: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.loginApiV1AuthAuthLoginPost_0(
    phone,
    password
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **phone** | [**string**] |  | defaults to undefined|
| **password** | [**string**] |  | (optional) defaults to undefined|


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

# **loginSmsApiV1AuthAuthLoginSmsPost**
> any loginSmsApiV1AuthAuthLoginSmsPost()


### Example

```typescript
import {
    AuthenticationApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AuthenticationApi(configuration);

let phone: string; // (default to undefined)
let code: string; // (default to undefined)

const { status, data } = await apiInstance.loginSmsApiV1AuthAuthLoginSmsPost(
    phone,
    code
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **phone** | [**string**] |  | defaults to undefined|
| **code** | [**string**] |  | defaults to undefined|


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

# **loginSmsApiV1AuthAuthLoginSmsPost_0**
> any loginSmsApiV1AuthAuthLoginSmsPost_0()


### Example

```typescript
import {
    AuthenticationApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AuthenticationApi(configuration);

let phone: string; // (default to undefined)
let code: string; // (default to undefined)

const { status, data } = await apiInstance.loginSmsApiV1AuthAuthLoginSmsPost_0(
    phone,
    code
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **phone** | [**string**] |  | defaults to undefined|
| **code** | [**string**] |  | defaults to undefined|


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

# **logoutApiV1AuthAuthLogoutPost**
> any logoutApiV1AuthAuthLogoutPost()

登出 - 把当前 token 加入黑名单, 立即失效.

### Example

```typescript
import {
    AuthenticationApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AuthenticationApi(configuration);

const { status, data } = await apiInstance.logoutApiV1AuthAuthLogoutPost();
```

### Parameters
This endpoint does not have any parameters.


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

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **logoutApiV1AuthAuthLogoutPost_0**
> any logoutApiV1AuthAuthLogoutPost_0()

登出 - 把当前 token 加入黑名单, 立即失效.

### Example

```typescript
import {
    AuthenticationApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AuthenticationApi(configuration);

const { status, data } = await apiInstance.logoutApiV1AuthAuthLogoutPost_0();
```

### Parameters
This endpoint does not have any parameters.


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

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **refreshTokenApiV1AuthAuthRefreshPost**
> any refreshTokenApiV1AuthAuthRefreshPost()

使用 refresh token 轮转颁发新 access + refresh.  安全机制 (Bug-53 rotate_refresh):   - 旧 refresh 立即进入黑名单 (Redis SET, 7 天 TTL)   - 检测同 jti 二次使用 → 整 family 失效 + 上报重放告警   - 同 family 内的旧 jti 都失效, 用户必须重新登录

### Example

```typescript
import {
    AuthenticationApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AuthenticationApi(configuration);

let refreshToken: string; // (default to undefined)

const { status, data } = await apiInstance.refreshTokenApiV1AuthAuthRefreshPost(
    refreshToken
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **refreshToken** | [**string**] |  | defaults to undefined|


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

# **refreshTokenApiV1AuthAuthRefreshPost_0**
> any refreshTokenApiV1AuthAuthRefreshPost_0()

使用 refresh token 轮转颁发新 access + refresh.  安全机制 (Bug-53 rotate_refresh):   - 旧 refresh 立即进入黑名单 (Redis SET, 7 天 TTL)   - 检测同 jti 二次使用 → 整 family 失效 + 上报重放告警   - 同 family 内的旧 jti 都失效, 用户必须重新登录

### Example

```typescript
import {
    AuthenticationApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AuthenticationApi(configuration);

let refreshToken: string; // (default to undefined)

const { status, data } = await apiInstance.refreshTokenApiV1AuthAuthRefreshPost_0(
    refreshToken
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **refreshToken** | [**string**] |  | defaults to undefined|


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

# **registerApiV1AuthAuthRegisterPost**
> any registerApiV1AuthAuthRegisterPost()


### Example

```typescript
import {
    AuthenticationApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AuthenticationApi(configuration);

let phone: string; // (default to undefined)
let password: string; // (default to undefined)
let nickname: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.registerApiV1AuthAuthRegisterPost(
    phone,
    password,
    nickname
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **phone** | [**string**] |  | defaults to undefined|
| **password** | [**string**] |  | defaults to undefined|
| **nickname** | [**string**] |  | (optional) defaults to undefined|


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

# **registerApiV1AuthAuthRegisterPost_0**
> any registerApiV1AuthAuthRegisterPost_0()


### Example

```typescript
import {
    AuthenticationApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AuthenticationApi(configuration);

let phone: string; // (default to undefined)
let password: string; // (default to undefined)
let nickname: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.registerApiV1AuthAuthRegisterPost_0(
    phone,
    password,
    nickname
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **phone** | [**string**] |  | defaults to undefined|
| **password** | [**string**] |  | defaults to undefined|
| **nickname** | [**string**] |  | (optional) defaults to undefined|


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

# **sendCodeApiV1AuthAuthSmsCodePost**
> any sendCodeApiV1AuthAuthSmsCodePost()


### Example

```typescript
import {
    AuthenticationApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AuthenticationApi(configuration);

let phone: string; // (default to undefined)

const { status, data } = await apiInstance.sendCodeApiV1AuthAuthSmsCodePost(
    phone
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **phone** | [**string**] |  | defaults to undefined|


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

# **sendCodeApiV1AuthAuthSmsCodePost_0**
> any sendCodeApiV1AuthAuthSmsCodePost_0()


### Example

```typescript
import {
    AuthenticationApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AuthenticationApi(configuration);

let phone: string; // (default to undefined)

const { status, data } = await apiInstance.sendCodeApiV1AuthAuthSmsCodePost_0(
    phone
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **phone** | [**string**] |  | defaults to undefined|


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

# **updateProfileApiV1AuthAuthProfilePut**
> any updateProfileApiV1AuthAuthProfilePut()

Update user profile fields (nickname, email, gender).

### Example

```typescript
import {
    AuthenticationApi,
    Configuration,
    BodyUpdateProfileApiV1AuthAuthProfilePut
} from './api';

const configuration = new Configuration();
const apiInstance = new AuthenticationApi(configuration);

let bodyUpdateProfileApiV1AuthAuthProfilePut: BodyUpdateProfileApiV1AuthAuthProfilePut; // (optional)

const { status, data } = await apiInstance.updateProfileApiV1AuthAuthProfilePut(
    bodyUpdateProfileApiV1AuthAuthProfilePut
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **bodyUpdateProfileApiV1AuthAuthProfilePut** | **BodyUpdateProfileApiV1AuthAuthProfilePut**|  | |


### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **updateProfileApiV1AuthAuthProfilePut_0**
> any updateProfileApiV1AuthAuthProfilePut_0()

Update user profile fields (nickname, email, gender).

### Example

```typescript
import {
    AuthenticationApi,
    Configuration,
    BodyUpdateProfileApiV1AuthAuthProfilePut
} from './api';

const configuration = new Configuration();
const apiInstance = new AuthenticationApi(configuration);

let bodyUpdateProfileApiV1AuthAuthProfilePut: BodyUpdateProfileApiV1AuthAuthProfilePut; // (optional)

const { status, data } = await apiInstance.updateProfileApiV1AuthAuthProfilePut_0(
    bodyUpdateProfileApiV1AuthAuthProfilePut
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **bodyUpdateProfileApiV1AuthAuthProfilePut** | **BodyUpdateProfileApiV1AuthAuthProfilePut**|  | |


### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **uploadAvatarApiV1AuthAuthProfileAvatarPost**
> any uploadAvatarApiV1AuthAuthProfileAvatarPost()

Upload avatar image to MinIO and update user record.

### Example

```typescript
import {
    AuthenticationApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AuthenticationApi(configuration);

let file: File; // (default to undefined)

const { status, data } = await apiInstance.uploadAvatarApiV1AuthAuthProfileAvatarPost(
    file
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **file** | [**File**] |  | defaults to undefined|


### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: multipart/form-data
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **uploadAvatarApiV1AuthAuthProfileAvatarPost_0**
> any uploadAvatarApiV1AuthAuthProfileAvatarPost_0()

Upload avatar image to MinIO and update user record.

### Example

```typescript
import {
    AuthenticationApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AuthenticationApi(configuration);

let file: File; // (default to undefined)

const { status, data } = await apiInstance.uploadAvatarApiV1AuthAuthProfileAvatarPost_0(
    file
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **file** | [**File**] |  | defaults to undefined|


### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: multipart/form-data
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

