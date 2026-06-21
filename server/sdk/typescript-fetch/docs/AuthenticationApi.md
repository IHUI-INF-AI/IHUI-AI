# AuthenticationApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**cancelAccountApiV1AuthAuthCancelDelete**](AuthenticationApi.md#cancelaccountapiv1authauthcanceldelete) | **DELETE** /api/v1/auth/auth/cancel | User account cancellation (soft delete) |
| [**cancelAccountApiV1AuthAuthCancelDelete_0**](AuthenticationApi.md#cancelaccountapiv1authauthcanceldelete_0) | **DELETE** /api/v1/auth/auth/cancel | User account cancellation (soft delete) |
| [**changePasswordApiV1AuthAuthProfilePasswordPut**](AuthenticationApi.md#changepasswordapiv1authauthprofilepasswordput) | **PUT** /api/v1/auth/auth/profile/password | Change password |
| [**changePasswordApiV1AuthAuthProfilePasswordPut_0**](AuthenticationApi.md#changepasswordapiv1authauthprofilepasswordput_0) | **PUT** /api/v1/auth/auth/profile/password | Change password |
| [**checkPhoneExistsApiV1AuthAuthExistPhoneGet**](AuthenticationApi.md#checkphoneexistsapiv1authauthexistphoneget) | **GET** /api/v1/auth/auth/exist/{phone} | Check if phone is registered |
| [**checkPhoneExistsApiV1AuthAuthExistPhoneGet_0**](AuthenticationApi.md#checkphoneexistsapiv1authauthexistphoneget_0) | **GET** /api/v1/auth/auth/exist/{phone} | Check if phone is registered |
| [**getProfileApiV1AuthAuthProfileGet**](AuthenticationApi.md#getprofileapiv1authauthprofileget) | **GET** /api/v1/auth/auth/profile | Get personal profile with roles and posts |
| [**getProfileApiV1AuthAuthProfileGet_0**](AuthenticationApi.md#getprofileapiv1authauthprofileget_0) | **GET** /api/v1/auth/auth/profile | Get personal profile with roles and posts |
| [**getUserInfoApiV1AuthAuthInfoGet**](AuthenticationApi.md#getuserinfoapiv1authauthinfoget) | **GET** /api/v1/auth/auth/info | Get current user info |
| [**getUserInfoApiV1AuthAuthInfoGet_0**](AuthenticationApi.md#getuserinfoapiv1authauthinfoget_0) | **GET** /api/v1/auth/auth/info | Get current user info |
| [**loginApiV1AuthAuthLoginPost**](AuthenticationApi.md#loginapiv1authauthloginpost) | **POST** /api/v1/auth/auth/login | Password login |
| [**loginApiV1AuthAuthLoginPost_0**](AuthenticationApi.md#loginapiv1authauthloginpost_0) | **POST** /api/v1/auth/auth/login | Password login |
| [**loginSmsApiV1AuthAuthLoginSmsPost**](AuthenticationApi.md#loginsmsapiv1authauthloginsmspost) | **POST** /api/v1/auth/auth/login/sms | SMS code login |
| [**loginSmsApiV1AuthAuthLoginSmsPost_0**](AuthenticationApi.md#loginsmsapiv1authauthloginsmspost_0) | **POST** /api/v1/auth/auth/login/sms | SMS code login |
| [**logoutApiV1AuthAuthLogoutPost**](AuthenticationApi.md#logoutapiv1authauthlogoutpost) | **POST** /api/v1/auth/auth/logout | Logout |
| [**logoutApiV1AuthAuthLogoutPost_0**](AuthenticationApi.md#logoutapiv1authauthlogoutpost_0) | **POST** /api/v1/auth/auth/logout | Logout |
| [**refreshTokenApiV1AuthAuthRefreshPost**](AuthenticationApi.md#refreshtokenapiv1authauthrefreshpost) | **POST** /api/v1/auth/auth/refresh | Refresh access token (rotate) |
| [**refreshTokenApiV1AuthAuthRefreshPost_0**](AuthenticationApi.md#refreshtokenapiv1authauthrefreshpost_0) | **POST** /api/v1/auth/auth/refresh | Refresh access token (rotate) |
| [**registerApiV1AuthAuthRegisterPost**](AuthenticationApi.md#registerapiv1authauthregisterpost) | **POST** /api/v1/auth/auth/register | Register new user |
| [**registerApiV1AuthAuthRegisterPost_0**](AuthenticationApi.md#registerapiv1authauthregisterpost_0) | **POST** /api/v1/auth/auth/register | Register new user |
| [**sendCodeApiV1AuthAuthSmsCodePost**](AuthenticationApi.md#sendcodeapiv1authauthsmscodepost) | **POST** /api/v1/auth/auth/sms/code | Send SMS verification code |
| [**sendCodeApiV1AuthAuthSmsCodePost_0**](AuthenticationApi.md#sendcodeapiv1authauthsmscodepost_0) | **POST** /api/v1/auth/auth/sms/code | Send SMS verification code |
| [**updateProfileApiV1AuthAuthProfilePut**](AuthenticationApi.md#updateprofileapiv1authauthprofileput) | **PUT** /api/v1/auth/auth/profile | Update personal profile |
| [**updateProfileApiV1AuthAuthProfilePut_0**](AuthenticationApi.md#updateprofileapiv1authauthprofileput_0) | **PUT** /api/v1/auth/auth/profile | Update personal profile |
| [**uploadAvatarApiV1AuthAuthProfileAvatarPost**](AuthenticationApi.md#uploadavatarapiv1authauthprofileavatarpost) | **POST** /api/v1/auth/auth/profile/avatar | Upload avatar |
| [**uploadAvatarApiV1AuthAuthProfileAvatarPost_0**](AuthenticationApi.md#uploadavatarapiv1authauthprofileavatarpost_0) | **POST** /api/v1/auth/auth/profile/avatar | Upload avatar |



## cancelAccountApiV1AuthAuthCancelDelete

> any cancelAccountApiV1AuthAuthCancelDelete()

User account cancellation (soft delete)

Cancel user account -- soft delete user and mask phone.  Matches Java SQL:   UPDATE users u LEFT JOIN user_auth_info uai ON u.uuid &#x3D; uai.user_uuid   SET u.status &#x3D; 3, uai.cancel_phone &#x3D; uai.phone, uai.phone &#x3D; NULL   WHERE u.uuid &#x3D; #{uuid}  Note: Java does NOT delete third-party bindings on cancel, only masks phone.

### Example

```ts
import {
  Configuration,
  AuthenticationApi,
} from '';
import type { CancelAccountApiV1AuthAuthCancelDeleteRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AuthenticationApi(config);

  try {
    const data = await api.cancelAccountApiV1AuthAuthCancelDelete();
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

This endpoint does not need any parameter.

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

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## cancelAccountApiV1AuthAuthCancelDelete_0

> any cancelAccountApiV1AuthAuthCancelDelete_0()

User account cancellation (soft delete)

Cancel user account -- soft delete user and mask phone.  Matches Java SQL:   UPDATE users u LEFT JOIN user_auth_info uai ON u.uuid &#x3D; uai.user_uuid   SET u.status &#x3D; 3, uai.cancel_phone &#x3D; uai.phone, uai.phone &#x3D; NULL   WHERE u.uuid &#x3D; #{uuid}  Note: Java does NOT delete third-party bindings on cancel, only masks phone.

### Example

```ts
import {
  Configuration,
  AuthenticationApi,
} from '';
import type { CancelAccountApiV1AuthAuthCancelDelete0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AuthenticationApi(config);

  try {
    const data = await api.cancelAccountApiV1AuthAuthCancelDelete_0();
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

This endpoint does not need any parameter.

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

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## changePasswordApiV1AuthAuthProfilePasswordPut

> any changePasswordApiV1AuthAuthProfilePasswordPut(bodyChangePasswordApiV1AuthAuthProfilePasswordPut)

Change password

Change user password — verifies old password before setting new one.

### Example

```ts
import {
  Configuration,
  AuthenticationApi,
} from '';
import type { ChangePasswordApiV1AuthAuthProfilePasswordPutRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AuthenticationApi(config);

  const body = {
    // BodyChangePasswordApiV1AuthAuthProfilePasswordPut
    bodyChangePasswordApiV1AuthAuthProfilePasswordPut: ...,
  } satisfies ChangePasswordApiV1AuthAuthProfilePasswordPutRequest;

  try {
    const data = await api.changePasswordApiV1AuthAuthProfilePasswordPut(body);
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
| **bodyChangePasswordApiV1AuthAuthProfilePasswordPut** | [BodyChangePasswordApiV1AuthAuthProfilePasswordPut](BodyChangePasswordApiV1AuthAuthProfilePasswordPut.md) |  | |

### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## changePasswordApiV1AuthAuthProfilePasswordPut_0

> any changePasswordApiV1AuthAuthProfilePasswordPut_0(bodyChangePasswordApiV1AuthAuthProfilePasswordPut)

Change password

Change user password — verifies old password before setting new one.

### Example

```ts
import {
  Configuration,
  AuthenticationApi,
} from '';
import type { ChangePasswordApiV1AuthAuthProfilePasswordPut0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AuthenticationApi(config);

  const body = {
    // BodyChangePasswordApiV1AuthAuthProfilePasswordPut
    bodyChangePasswordApiV1AuthAuthProfilePasswordPut: ...,
  } satisfies ChangePasswordApiV1AuthAuthProfilePasswordPut0Request;

  try {
    const data = await api.changePasswordApiV1AuthAuthProfilePasswordPut_0(body);
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
| **bodyChangePasswordApiV1AuthAuthProfilePasswordPut** | [BodyChangePasswordApiV1AuthAuthProfilePasswordPut](BodyChangePasswordApiV1AuthAuthProfilePasswordPut.md) |  | |

### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## checkPhoneExistsApiV1AuthAuthExistPhoneGet

> any checkPhoneExistsApiV1AuthAuthExistPhoneGet(phone)

Check if phone is registered

### Example

```ts
import {
  Configuration,
  AuthenticationApi,
} from '';
import type { CheckPhoneExistsApiV1AuthAuthExistPhoneGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AuthenticationApi();

  const body = {
    // string
    phone: phone_example,
  } satisfies CheckPhoneExistsApiV1AuthAuthExistPhoneGetRequest;

  try {
    const data = await api.checkPhoneExistsApiV1AuthAuthExistPhoneGet(body);
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
| **phone** | `string` |  | [Defaults to `undefined`] |

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


## checkPhoneExistsApiV1AuthAuthExistPhoneGet_0

> any checkPhoneExistsApiV1AuthAuthExistPhoneGet_0(phone)

Check if phone is registered

### Example

```ts
import {
  Configuration,
  AuthenticationApi,
} from '';
import type { CheckPhoneExistsApiV1AuthAuthExistPhoneGet0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AuthenticationApi();

  const body = {
    // string
    phone: phone_example,
  } satisfies CheckPhoneExistsApiV1AuthAuthExistPhoneGet0Request;

  try {
    const data = await api.checkPhoneExistsApiV1AuthAuthExistPhoneGet_0(body);
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
| **phone** | `string` |  | [Defaults to `undefined`] |

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


## getProfileApiV1AuthAuthProfileGet

> any getProfileApiV1AuthAuthProfileGet()

Get personal profile with roles and posts

Get detailed profile including roles and posts.

### Example

```ts
import {
  Configuration,
  AuthenticationApi,
} from '';
import type { GetProfileApiV1AuthAuthProfileGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AuthenticationApi(config);

  try {
    const data = await api.getProfileApiV1AuthAuthProfileGet();
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

This endpoint does not need any parameter.

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

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## getProfileApiV1AuthAuthProfileGet_0

> any getProfileApiV1AuthAuthProfileGet_0()

Get personal profile with roles and posts

Get detailed profile including roles and posts.

### Example

```ts
import {
  Configuration,
  AuthenticationApi,
} from '';
import type { GetProfileApiV1AuthAuthProfileGet0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AuthenticationApi(config);

  try {
    const data = await api.getProfileApiV1AuthAuthProfileGet_0();
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

This endpoint does not need any parameter.

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

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## getUserInfoApiV1AuthAuthInfoGet

> any getUserInfoApiV1AuthAuthInfoGet()

Get current user info

### Example

```ts
import {
  Configuration,
  AuthenticationApi,
} from '';
import type { GetUserInfoApiV1AuthAuthInfoGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AuthenticationApi(config);

  try {
    const data = await api.getUserInfoApiV1AuthAuthInfoGet();
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

This endpoint does not need any parameter.

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

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## getUserInfoApiV1AuthAuthInfoGet_0

> any getUserInfoApiV1AuthAuthInfoGet_0()

Get current user info

### Example

```ts
import {
  Configuration,
  AuthenticationApi,
} from '';
import type { GetUserInfoApiV1AuthAuthInfoGet0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AuthenticationApi(config);

  try {
    const data = await api.getUserInfoApiV1AuthAuthInfoGet_0();
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

This endpoint does not need any parameter.

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

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## loginApiV1AuthAuthLoginPost

> any loginApiV1AuthAuthLoginPost(phone, password)

Password login

### Example

```ts
import {
  Configuration,
  AuthenticationApi,
} from '';
import type { LoginApiV1AuthAuthLoginPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AuthenticationApi();

  const body = {
    // string
    phone: phone_example,
    // string (optional)
    password: password_example,
  } satisfies LoginApiV1AuthAuthLoginPostRequest;

  try {
    const data = await api.loginApiV1AuthAuthLoginPost(body);
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
| **phone** | `string` |  | [Defaults to `undefined`] |
| **password** | `string` |  | [Optional] [Defaults to `undefined`] |

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


## loginApiV1AuthAuthLoginPost_0

> any loginApiV1AuthAuthLoginPost_0(phone, password)

Password login

### Example

```ts
import {
  Configuration,
  AuthenticationApi,
} from '';
import type { LoginApiV1AuthAuthLoginPost0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AuthenticationApi();

  const body = {
    // string
    phone: phone_example,
    // string (optional)
    password: password_example,
  } satisfies LoginApiV1AuthAuthLoginPost0Request;

  try {
    const data = await api.loginApiV1AuthAuthLoginPost_0(body);
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
| **phone** | `string` |  | [Defaults to `undefined`] |
| **password** | `string` |  | [Optional] [Defaults to `undefined`] |

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


## loginSmsApiV1AuthAuthLoginSmsPost

> any loginSmsApiV1AuthAuthLoginSmsPost(phone, code)

SMS code login

### Example

```ts
import {
  Configuration,
  AuthenticationApi,
} from '';
import type { LoginSmsApiV1AuthAuthLoginSmsPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AuthenticationApi();

  const body = {
    // string
    phone: phone_example,
    // string
    code: code_example,
  } satisfies LoginSmsApiV1AuthAuthLoginSmsPostRequest;

  try {
    const data = await api.loginSmsApiV1AuthAuthLoginSmsPost(body);
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
| **phone** | `string` |  | [Defaults to `undefined`] |
| **code** | `string` |  | [Defaults to `undefined`] |

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


## loginSmsApiV1AuthAuthLoginSmsPost_0

> any loginSmsApiV1AuthAuthLoginSmsPost_0(phone, code)

SMS code login

### Example

```ts
import {
  Configuration,
  AuthenticationApi,
} from '';
import type { LoginSmsApiV1AuthAuthLoginSmsPost0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AuthenticationApi();

  const body = {
    // string
    phone: phone_example,
    // string
    code: code_example,
  } satisfies LoginSmsApiV1AuthAuthLoginSmsPost0Request;

  try {
    const data = await api.loginSmsApiV1AuthAuthLoginSmsPost_0(body);
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
| **phone** | `string` |  | [Defaults to `undefined`] |
| **code** | `string` |  | [Defaults to `undefined`] |

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


## logoutApiV1AuthAuthLogoutPost

> any logoutApiV1AuthAuthLogoutPost()

Logout

登出 - 把当前 token 加入黑名单, 立即失效.

### Example

```ts
import {
  Configuration,
  AuthenticationApi,
} from '';
import type { LogoutApiV1AuthAuthLogoutPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AuthenticationApi();

  try {
    const data = await api.logoutApiV1AuthAuthLogoutPost();
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

This endpoint does not need any parameter.

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

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## logoutApiV1AuthAuthLogoutPost_0

> any logoutApiV1AuthAuthLogoutPost_0()

Logout

登出 - 把当前 token 加入黑名单, 立即失效.

### Example

```ts
import {
  Configuration,
  AuthenticationApi,
} from '';
import type { LogoutApiV1AuthAuthLogoutPost0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AuthenticationApi();

  try {
    const data = await api.logoutApiV1AuthAuthLogoutPost_0();
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

This endpoint does not need any parameter.

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

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## refreshTokenApiV1AuthAuthRefreshPost

> any refreshTokenApiV1AuthAuthRefreshPost(refreshToken)

Refresh access token (rotate)

使用 refresh token 轮转颁发新 access + refresh.  安全机制 (Bug-53 rotate_refresh):   - 旧 refresh 立即进入黑名单 (Redis SET, 7 天 TTL)   - 检测同 jti 二次使用 → 整 family 失效 + 上报重放告警   - 同 family 内的旧 jti 都失效, 用户必须重新登录

### Example

```ts
import {
  Configuration,
  AuthenticationApi,
} from '';
import type { RefreshTokenApiV1AuthAuthRefreshPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AuthenticationApi();

  const body = {
    // string
    refreshToken: refreshToken_example,
  } satisfies RefreshTokenApiV1AuthAuthRefreshPostRequest;

  try {
    const data = await api.refreshTokenApiV1AuthAuthRefreshPost(body);
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
| **refreshToken** | `string` |  | [Defaults to `undefined`] |

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


## refreshTokenApiV1AuthAuthRefreshPost_0

> any refreshTokenApiV1AuthAuthRefreshPost_0(refreshToken)

Refresh access token (rotate)

使用 refresh token 轮转颁发新 access + refresh.  安全机制 (Bug-53 rotate_refresh):   - 旧 refresh 立即进入黑名单 (Redis SET, 7 天 TTL)   - 检测同 jti 二次使用 → 整 family 失效 + 上报重放告警   - 同 family 内的旧 jti 都失效, 用户必须重新登录

### Example

```ts
import {
  Configuration,
  AuthenticationApi,
} from '';
import type { RefreshTokenApiV1AuthAuthRefreshPost0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AuthenticationApi();

  const body = {
    // string
    refreshToken: refreshToken_example,
  } satisfies RefreshTokenApiV1AuthAuthRefreshPost0Request;

  try {
    const data = await api.refreshTokenApiV1AuthAuthRefreshPost_0(body);
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
| **refreshToken** | `string` |  | [Defaults to `undefined`] |

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


## registerApiV1AuthAuthRegisterPost

> any registerApiV1AuthAuthRegisterPost(phone, password, nickname)

Register new user

### Example

```ts
import {
  Configuration,
  AuthenticationApi,
} from '';
import type { RegisterApiV1AuthAuthRegisterPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AuthenticationApi();

  const body = {
    // string
    phone: phone_example,
    // string
    password: password_example,
    // string (optional)
    nickname: nickname_example,
  } satisfies RegisterApiV1AuthAuthRegisterPostRequest;

  try {
    const data = await api.registerApiV1AuthAuthRegisterPost(body);
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
| **phone** | `string` |  | [Defaults to `undefined`] |
| **password** | `string` |  | [Defaults to `undefined`] |
| **nickname** | `string` |  | [Optional] [Defaults to `undefined`] |

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


## registerApiV1AuthAuthRegisterPost_0

> any registerApiV1AuthAuthRegisterPost_0(phone, password, nickname)

Register new user

### Example

```ts
import {
  Configuration,
  AuthenticationApi,
} from '';
import type { RegisterApiV1AuthAuthRegisterPost0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AuthenticationApi();

  const body = {
    // string
    phone: phone_example,
    // string
    password: password_example,
    // string (optional)
    nickname: nickname_example,
  } satisfies RegisterApiV1AuthAuthRegisterPost0Request;

  try {
    const data = await api.registerApiV1AuthAuthRegisterPost_0(body);
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
| **phone** | `string` |  | [Defaults to `undefined`] |
| **password** | `string` |  | [Defaults to `undefined`] |
| **nickname** | `string` |  | [Optional] [Defaults to `undefined`] |

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


## sendCodeApiV1AuthAuthSmsCodePost

> any sendCodeApiV1AuthAuthSmsCodePost(phone)

Send SMS verification code

### Example

```ts
import {
  Configuration,
  AuthenticationApi,
} from '';
import type { SendCodeApiV1AuthAuthSmsCodePostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AuthenticationApi();

  const body = {
    // string
    phone: phone_example,
  } satisfies SendCodeApiV1AuthAuthSmsCodePostRequest;

  try {
    const data = await api.sendCodeApiV1AuthAuthSmsCodePost(body);
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
| **phone** | `string` |  | [Defaults to `undefined`] |

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


## sendCodeApiV1AuthAuthSmsCodePost_0

> any sendCodeApiV1AuthAuthSmsCodePost_0(phone)

Send SMS verification code

### Example

```ts
import {
  Configuration,
  AuthenticationApi,
} from '';
import type { SendCodeApiV1AuthAuthSmsCodePost0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AuthenticationApi();

  const body = {
    // string
    phone: phone_example,
  } satisfies SendCodeApiV1AuthAuthSmsCodePost0Request;

  try {
    const data = await api.sendCodeApiV1AuthAuthSmsCodePost_0(body);
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
| **phone** | `string` |  | [Defaults to `undefined`] |

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


## updateProfileApiV1AuthAuthProfilePut

> any updateProfileApiV1AuthAuthProfilePut(bodyUpdateProfileApiV1AuthAuthProfilePut)

Update personal profile

Update user profile fields (nickname, email, gender).

### Example

```ts
import {
  Configuration,
  AuthenticationApi,
} from '';
import type { UpdateProfileApiV1AuthAuthProfilePutRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AuthenticationApi(config);

  const body = {
    // BodyUpdateProfileApiV1AuthAuthProfilePut (optional)
    bodyUpdateProfileApiV1AuthAuthProfilePut: ...,
  } satisfies UpdateProfileApiV1AuthAuthProfilePutRequest;

  try {
    const data = await api.updateProfileApiV1AuthAuthProfilePut(body);
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
| **bodyUpdateProfileApiV1AuthAuthProfilePut** | [BodyUpdateProfileApiV1AuthAuthProfilePut](BodyUpdateProfileApiV1AuthAuthProfilePut.md) |  | [Optional] |

### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## updateProfileApiV1AuthAuthProfilePut_0

> any updateProfileApiV1AuthAuthProfilePut_0(bodyUpdateProfileApiV1AuthAuthProfilePut)

Update personal profile

Update user profile fields (nickname, email, gender).

### Example

```ts
import {
  Configuration,
  AuthenticationApi,
} from '';
import type { UpdateProfileApiV1AuthAuthProfilePut0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AuthenticationApi(config);

  const body = {
    // BodyUpdateProfileApiV1AuthAuthProfilePut (optional)
    bodyUpdateProfileApiV1AuthAuthProfilePut: ...,
  } satisfies UpdateProfileApiV1AuthAuthProfilePut0Request;

  try {
    const data = await api.updateProfileApiV1AuthAuthProfilePut_0(body);
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
| **bodyUpdateProfileApiV1AuthAuthProfilePut** | [BodyUpdateProfileApiV1AuthAuthProfilePut](BodyUpdateProfileApiV1AuthAuthProfilePut.md) |  | [Optional] |

### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## uploadAvatarApiV1AuthAuthProfileAvatarPost

> any uploadAvatarApiV1AuthAuthProfileAvatarPost(file)

Upload avatar

Upload avatar image to MinIO and update user record.

### Example

```ts
import {
  Configuration,
  AuthenticationApi,
} from '';
import type { UploadAvatarApiV1AuthAuthProfileAvatarPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AuthenticationApi(config);

  const body = {
    // Blob
    file: BINARY_DATA_HERE,
  } satisfies UploadAvatarApiV1AuthAuthProfileAvatarPostRequest;

  try {
    const data = await api.uploadAvatarApiV1AuthAuthProfileAvatarPost(body);
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
| **file** | `Blob` |  | [Defaults to `undefined`] |

### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: `multipart/form-data`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## uploadAvatarApiV1AuthAuthProfileAvatarPost_0

> any uploadAvatarApiV1AuthAuthProfileAvatarPost_0(file)

Upload avatar

Upload avatar image to MinIO and update user record.

### Example

```ts
import {
  Configuration,
  AuthenticationApi,
} from '';
import type { UploadAvatarApiV1AuthAuthProfileAvatarPost0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AuthenticationApi(config);

  const body = {
    // Blob
    file: BINARY_DATA_HERE,
  } satisfies UploadAvatarApiV1AuthAuthProfileAvatarPost0Request;

  try {
    const data = await api.uploadAvatarApiV1AuthAuthProfileAvatarPost_0(body);
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
| **file** | `Blob` |  | [Defaults to `undefined`] |

### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: `multipart/form-data`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

