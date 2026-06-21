# AlipayFundApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**alipayFundNotify**](AlipayFundApi.md#alipayfundnotify) | **POST** /api/v1/payments/alipay/notify | Alipay Notify |
| [**alipayFundNotify_0**](AlipayFundApi.md#alipayfundnotify_0) | **POST** /api/v1/payments/alipay/notify | Alipay Notify |
| [**alipayReturnApiV1PaymentsAlipayReturnGet**](AlipayFundApi.md#alipayreturnapiv1paymentsalipayreturnget) | **GET** /api/v1/payments/alipay/return | Alipay Return |
| [**alipayReturnApiV1PaymentsAlipayReturnGet_0**](AlipayFundApi.md#alipayreturnapiv1paymentsalipayreturnget_0) | **GET** /api/v1/payments/alipay/return | Alipay Return |
| [**createPayApiV1PaymentsCreatePost**](AlipayFundApi.md#createpayapiv1paymentscreatepost) | **POST** /api/v1/payments/create | Create Pay |
| [**createPayApiV1PaymentsCreatePost_0**](AlipayFundApi.md#createpayapiv1paymentscreatepost_0) | **POST** /api/v1/payments/create | Create Pay |
| [**createPayJsonApiV1PaymentsCreate2Post**](AlipayFundApi.md#createpayjsonapiv1paymentscreate2post) | **POST** /api/v1/payments/create2 | Create Pay Json |
| [**createPayJsonApiV1PaymentsCreate2Post_0**](AlipayFundApi.md#createpayjsonapiv1paymentscreate2post_0) | **POST** /api/v1/payments/create2 | Create Pay Json |
| [**payFailApiV1PaymentsFailGet**](AlipayFundApi.md#payfailapiv1paymentsfailget) | **GET** /api/v1/payments/fail | Pay Fail |
| [**payFailApiV1PaymentsFailGet_0**](AlipayFundApi.md#payfailapiv1paymentsfailget_0) | **GET** /api/v1/payments/fail | Pay Fail |
| [**paySuccessApiV1PaymentsSuccessGet**](AlipayFundApi.md#paysuccessapiv1paymentssuccessget) | **GET** /api/v1/payments/success | Pay Success |
| [**paySuccessApiV1PaymentsSuccessGet_0**](AlipayFundApi.md#paysuccessapiv1paymentssuccessget_0) | **GET** /api/v1/payments/success | Pay Success |



## alipayFundNotify

> any alipayFundNotify()

Alipay Notify

### Example

```ts
import {
  Configuration,
  AlipayFundApi,
} from '';
import type { AlipayFundNotifyRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AlipayFundApi();

  try {
    const data = await api.alipayFundNotify();
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


## alipayFundNotify_0

> any alipayFundNotify_0()

Alipay Notify

### Example

```ts
import {
  Configuration,
  AlipayFundApi,
} from '';
import type { AlipayFundNotify0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AlipayFundApi();

  try {
    const data = await api.alipayFundNotify_0();
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


## alipayReturnApiV1PaymentsAlipayReturnGet

> any alipayReturnApiV1PaymentsAlipayReturnGet()

Alipay Return

### Example

```ts
import {
  Configuration,
  AlipayFundApi,
} from '';
import type { AlipayReturnApiV1PaymentsAlipayReturnGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AlipayFundApi();

  try {
    const data = await api.alipayReturnApiV1PaymentsAlipayReturnGet();
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


## alipayReturnApiV1PaymentsAlipayReturnGet_0

> any alipayReturnApiV1PaymentsAlipayReturnGet_0()

Alipay Return

### Example

```ts
import {
  Configuration,
  AlipayFundApi,
} from '';
import type { AlipayReturnApiV1PaymentsAlipayReturnGet0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AlipayFundApi();

  try {
    const data = await api.alipayReturnApiV1PaymentsAlipayReturnGet_0();
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


## createPayApiV1PaymentsCreatePost

> any createPayApiV1PaymentsCreatePost()

Create Pay

### Example

```ts
import {
  Configuration,
  AlipayFundApi,
} from '';
import type { CreatePayApiV1PaymentsCreatePostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AlipayFundApi(config);

  try {
    const data = await api.createPayApiV1PaymentsCreatePost();
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


## createPayApiV1PaymentsCreatePost_0

> any createPayApiV1PaymentsCreatePost_0()

Create Pay

### Example

```ts
import {
  Configuration,
  AlipayFundApi,
} from '';
import type { CreatePayApiV1PaymentsCreatePost0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AlipayFundApi(config);

  try {
    const data = await api.createPayApiV1PaymentsCreatePost_0();
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


## createPayJsonApiV1PaymentsCreate2Post

> any createPayJsonApiV1PaymentsCreate2Post()

Create Pay Json

### Example

```ts
import {
  Configuration,
  AlipayFundApi,
} from '';
import type { CreatePayJsonApiV1PaymentsCreate2PostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AlipayFundApi(config);

  try {
    const data = await api.createPayJsonApiV1PaymentsCreate2Post();
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


## createPayJsonApiV1PaymentsCreate2Post_0

> any createPayJsonApiV1PaymentsCreate2Post_0()

Create Pay Json

### Example

```ts
import {
  Configuration,
  AlipayFundApi,
} from '';
import type { CreatePayJsonApiV1PaymentsCreate2Post0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AlipayFundApi(config);

  try {
    const data = await api.createPayJsonApiV1PaymentsCreate2Post_0();
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


## payFailApiV1PaymentsFailGet

> any payFailApiV1PaymentsFailGet()

Pay Fail

### Example

```ts
import {
  Configuration,
  AlipayFundApi,
} from '';
import type { PayFailApiV1PaymentsFailGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AlipayFundApi();

  try {
    const data = await api.payFailApiV1PaymentsFailGet();
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


## payFailApiV1PaymentsFailGet_0

> any payFailApiV1PaymentsFailGet_0()

Pay Fail

### Example

```ts
import {
  Configuration,
  AlipayFundApi,
} from '';
import type { PayFailApiV1PaymentsFailGet0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AlipayFundApi();

  try {
    const data = await api.payFailApiV1PaymentsFailGet_0();
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


## paySuccessApiV1PaymentsSuccessGet

> any paySuccessApiV1PaymentsSuccessGet(orderNo)

Pay Success

### Example

```ts
import {
  Configuration,
  AlipayFundApi,
} from '';
import type { PaySuccessApiV1PaymentsSuccessGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AlipayFundApi();

  const body = {
    // string | order number (optional)
    orderNo: orderNo_example,
  } satisfies PaySuccessApiV1PaymentsSuccessGetRequest;

  try {
    const data = await api.paySuccessApiV1PaymentsSuccessGet(body);
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
| **orderNo** | `string` | order number | [Optional] [Defaults to `&#39;&#39;`] |

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


## paySuccessApiV1PaymentsSuccessGet_0

> any paySuccessApiV1PaymentsSuccessGet_0(orderNo)

Pay Success

### Example

```ts
import {
  Configuration,
  AlipayFundApi,
} from '';
import type { PaySuccessApiV1PaymentsSuccessGet0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AlipayFundApi();

  const body = {
    // string | order number (optional)
    orderNo: orderNo_example,
  } satisfies PaySuccessApiV1PaymentsSuccessGet0Request;

  try {
    const data = await api.paySuccessApiV1PaymentsSuccessGet_0(body);
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
| **orderNo** | `string` | order number | [Optional] [Defaults to `&#39;&#39;`] |

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

