# \TestAPI

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**DocsPageApiV1TestDocsPageGet**](TestAPI.md#DocsPageApiV1TestDocsPageGet) | **Get** /api/v1/test/docs-page | API文档页面
[**DocsPageApiV1TestDocsPageGet_0**](TestAPI.md#DocsPageApiV1TestDocsPageGet_0) | **Get** /api/v1/test/docs-page | API文档页面
[**HealthApiV1TestHealthGet**](TestAPI.md#HealthApiV1TestHealthGet) | **Get** /api/v1/test/health | 健康检查
[**HealthApiV1TestHealthGet_0**](TestAPI.md#HealthApiV1TestHealthGet_0) | **Get** /api/v1/test/health | 健康检查
[**IndexApiV1TestGet**](TestAPI.md#IndexApiV1TestGet) | **Get** /api/v1/test | 测试页面首页
[**IndexApiV1TestGet_0**](TestAPI.md#IndexApiV1TestGet_0) | **Get** /api/v1/test | 测试页面首页



## DocsPageApiV1TestDocsPageGet

> string DocsPageApiV1TestDocsPageGet(ctx).Execute()

API文档页面

### Example

```go
package main

import (
	"context"
	"fmt"
	"os"
	openapiclient "github.com/GIT_USER_ID/GIT_REPO_ID"
)

func main() {

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.TestAPI.DocsPageApiV1TestDocsPageGet(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `TestAPI.DocsPageApiV1TestDocsPageGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `DocsPageApiV1TestDocsPageGet`: string
	fmt.Fprintf(os.Stdout, "Response from `TestAPI.DocsPageApiV1TestDocsPageGet`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiDocsPageApiV1TestDocsPageGetRequest struct via the builder pattern


### Return type

**string**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: text/html

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## DocsPageApiV1TestDocsPageGet_0

> string DocsPageApiV1TestDocsPageGet_0(ctx).Execute()

API文档页面

### Example

```go
package main

import (
	"context"
	"fmt"
	"os"
	openapiclient "github.com/GIT_USER_ID/GIT_REPO_ID"
)

func main() {

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.TestAPI.DocsPageApiV1TestDocsPageGet_0(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `TestAPI.DocsPageApiV1TestDocsPageGet_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `DocsPageApiV1TestDocsPageGet_0`: string
	fmt.Fprintf(os.Stdout, "Response from `TestAPI.DocsPageApiV1TestDocsPageGet_0`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiDocsPageApiV1TestDocsPageGet_1Request struct via the builder pattern


### Return type

**string**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: text/html

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## HealthApiV1TestHealthGet

> interface{} HealthApiV1TestHealthGet(ctx).Execute()

健康检查

### Example

```go
package main

import (
	"context"
	"fmt"
	"os"
	openapiclient "github.com/GIT_USER_ID/GIT_REPO_ID"
)

func main() {

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.TestAPI.HealthApiV1TestHealthGet(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `TestAPI.HealthApiV1TestHealthGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `HealthApiV1TestHealthGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `TestAPI.HealthApiV1TestHealthGet`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiHealthApiV1TestHealthGetRequest struct via the builder pattern


### Return type

**interface{}**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## HealthApiV1TestHealthGet_0

> interface{} HealthApiV1TestHealthGet_0(ctx).Execute()

健康检查

### Example

```go
package main

import (
	"context"
	"fmt"
	"os"
	openapiclient "github.com/GIT_USER_ID/GIT_REPO_ID"
)

func main() {

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.TestAPI.HealthApiV1TestHealthGet_0(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `TestAPI.HealthApiV1TestHealthGet_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `HealthApiV1TestHealthGet_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `TestAPI.HealthApiV1TestHealthGet_0`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiHealthApiV1TestHealthGet_2Request struct via the builder pattern


### Return type

**interface{}**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## IndexApiV1TestGet

> string IndexApiV1TestGet(ctx).Execute()

测试页面首页

### Example

```go
package main

import (
	"context"
	"fmt"
	"os"
	openapiclient "github.com/GIT_USER_ID/GIT_REPO_ID"
)

func main() {

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.TestAPI.IndexApiV1TestGet(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `TestAPI.IndexApiV1TestGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `IndexApiV1TestGet`: string
	fmt.Fprintf(os.Stdout, "Response from `TestAPI.IndexApiV1TestGet`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiIndexApiV1TestGetRequest struct via the builder pattern


### Return type

**string**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: text/html

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## IndexApiV1TestGet_0

> string IndexApiV1TestGet_0(ctx).Execute()

测试页面首页

### Example

```go
package main

import (
	"context"
	"fmt"
	"os"
	openapiclient "github.com/GIT_USER_ID/GIT_REPO_ID"
)

func main() {

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.TestAPI.IndexApiV1TestGet_0(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `TestAPI.IndexApiV1TestGet_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `IndexApiV1TestGet_0`: string
	fmt.Fprintf(os.Stdout, "Response from `TestAPI.IndexApiV1TestGet_0`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiIndexApiV1TestGet_3Request struct via the builder pattern


### Return type

**string**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: text/html

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)

