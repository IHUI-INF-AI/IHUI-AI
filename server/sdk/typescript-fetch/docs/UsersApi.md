# UsersApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**getProfileApiV1UserInfoGet**](UsersApi.md#getprofileapiv1userinfoget) | **GET** /api/v1/user/info | Get current user profile |
| [**updateProfileApiV1UserUpdatePut**](UsersApi.md#updateprofileapiv1userupdateput) | **PUT** /api/v1/user/update | Update user profile |



## getProfileApiV1UserInfoGet

> any getProfileApiV1UserInfoGet()

Get current user profile

### Example

```ts
import {
  Configuration,
  UsersApi,
} from '';
import type { GetProfileApiV1UserInfoGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new UsersApi(config);

  try {
    const data = await api.getProfileApiV1UserInfoGet();
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


## updateProfileApiV1UserUpdatePut

> any updateProfileApiV1UserUpdatePut(nickname, avatar, gender)

Update user profile

### Example

```ts
import {
  Configuration,
  UsersApi,
} from '';
import type { UpdateProfileApiV1UserUpdatePutRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new UsersApi(config);

  const body = {
    // string (optional)
    nickname: nickname_example,
    // string (optional)
    avatar: avatar_example,
    // number (optional)
    gender: 56,
  } satisfies UpdateProfileApiV1UserUpdatePutRequest;

  try {
    const data = await api.updateProfileApiV1UserUpdatePut(body);
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
| **nickname** | `string` |  | [Optional] [Defaults to `undefined`] |
| **avatar** | `string` |  | [Optional] [Defaults to `undefined`] |
| **gender** | `number` |  | [Optional] [Defaults to `undefined`] |

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

