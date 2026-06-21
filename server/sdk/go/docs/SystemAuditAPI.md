# \SystemAuditAPI

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**CleanLoginInfoApiV1SystemAuditLogininforCleanPost**](SystemAuditAPI.md#CleanLoginInfoApiV1SystemAuditLogininforCleanPost) | **Post** /api/v1/system/audit/logininfor/clean | 清理登录日志
[**CleanOperLogApiV1SystemAuditOperlogCleanPost**](SystemAuditAPI.md#CleanOperLogApiV1SystemAuditOperlogCleanPost) | **Post** /api/v1/system/audit/operlog/clean | 清理 N 天前的操作日志
[**CreateLoginInfoApiV1SystemAuditLogininforCreatePost**](SystemAuditAPI.md#CreateLoginInfoApiV1SystemAuditLogininforCreatePost) | **Post** /api/v1/system/audit/logininfor/create | 记录一条登录日志
[**CreateOperLogApiV1SystemAuditOperlogCreatePost**](SystemAuditAPI.md#CreateOperLogApiV1SystemAuditOperlogCreatePost) | **Post** /api/v1/system/audit/operlog/create | 写入一条操作日志（内部调用）
[**ExportLoginInfoApiV1SystemAuditLogininforExportGet**](SystemAuditAPI.md#ExportLoginInfoApiV1SystemAuditLogininforExportGet) | **Get** /api/v1/system/audit/logininfor/export | 导出登录日志到Excel
[**ExportOperLogsApiV1SystemAuditOperlogExportGet**](SystemAuditAPI.md#ExportOperLogsApiV1SystemAuditOperlogExportGet) | **Get** /api/v1/system/audit/operlog/export | 导出操作日志到Excel
[**ListLoginInfoApiV1SystemAuditLogininforListGet**](SystemAuditAPI.md#ListLoginInfoApiV1SystemAuditLogininforListGet) | **Get** /api/v1/system/audit/logininfor/list | 登录日志列表
[**ListOperLogsApiV1SystemAuditOperlogListGet**](SystemAuditAPI.md#ListOperLogsApiV1SystemAuditOperlogListGet) | **Get** /api/v1/system/audit/operlog/list | 操作日志列表



## CleanLoginInfoApiV1SystemAuditLogininforCleanPost

> interface{} CleanLoginInfoApiV1SystemAuditLogininforCleanPost(ctx).Days(days).Execute()

清理登录日志

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
	days := int32(56) // int32 |  (optional) (default to 90)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.SystemAuditAPI.CleanLoginInfoApiV1SystemAuditLogininforCleanPost(context.Background()).Days(days).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `SystemAuditAPI.CleanLoginInfoApiV1SystemAuditLogininforCleanPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `CleanLoginInfoApiV1SystemAuditLogininforCleanPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `SystemAuditAPI.CleanLoginInfoApiV1SystemAuditLogininforCleanPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiCleanLoginInfoApiV1SystemAuditLogininforCleanPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **days** | **int32** |  | [default to 90]

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


## CleanOperLogApiV1SystemAuditOperlogCleanPost

> interface{} CleanOperLogApiV1SystemAuditOperlogCleanPost(ctx).Days(days).Execute()

清理 N 天前的操作日志

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
	days := int32(56) // int32 | 保留天数 (optional) (default to 90)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.SystemAuditAPI.CleanOperLogApiV1SystemAuditOperlogCleanPost(context.Background()).Days(days).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `SystemAuditAPI.CleanOperLogApiV1SystemAuditOperlogCleanPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `CleanOperLogApiV1SystemAuditOperlogCleanPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `SystemAuditAPI.CleanOperLogApiV1SystemAuditOperlogCleanPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiCleanOperLogApiV1SystemAuditOperlogCleanPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **days** | **int32** | 保留天数 | [default to 90]

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


## CreateLoginInfoApiV1SystemAuditLogininforCreatePost

> interface{} CreateLoginInfoApiV1SystemAuditLogininforCreatePost(ctx).UserName(userName).Ipaddr(ipaddr).LoginLocation(loginLocation).Browser(browser).Os(os).Status(status).Msg(msg).Execute()

记录一条登录日志

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
	userName := "userName_example" // string | 
	ipaddr := "ipaddr_example" // string |  (optional) (default to "")
	loginLocation := "loginLocation_example" // string |  (optional) (default to "")
	browser := "browser_example" // string |  (optional) (default to "")
	os := "os_example" // string |  (optional) (default to "")
	status := "status_example" // string |  (optional) (default to "0")
	msg := "msg_example" // string |  (optional) (default to "")

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.SystemAuditAPI.CreateLoginInfoApiV1SystemAuditLogininforCreatePost(context.Background()).UserName(userName).Ipaddr(ipaddr).LoginLocation(loginLocation).Browser(browser).Os(os).Status(status).Msg(msg).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `SystemAuditAPI.CreateLoginInfoApiV1SystemAuditLogininforCreatePost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `CreateLoginInfoApiV1SystemAuditLogininforCreatePost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `SystemAuditAPI.CreateLoginInfoApiV1SystemAuditLogininforCreatePost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiCreateLoginInfoApiV1SystemAuditLogininforCreatePostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **userName** | **string** |  | 
 **ipaddr** | **string** |  | [default to &quot;&quot;]
 **loginLocation** | **string** |  | [default to &quot;&quot;]
 **browser** | **string** |  | [default to &quot;&quot;]
 **os** | **string** |  | [default to &quot;&quot;]
 **status** | **string** |  | [default to &quot;0&quot;]
 **msg** | **string** |  | [default to &quot;&quot;]

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


## CreateOperLogApiV1SystemAuditOperlogCreatePost

> interface{} CreateOperLogApiV1SystemAuditOperlogCreatePost(ctx).Title(title).BusinessType(businessType).Method(method).RequestMethod(requestMethod).OperUrl(operUrl).OperName(operName).OperIp(operIp).Status(status).ErrorMsg(errorMsg).Execute()

写入一条操作日志（内部调用）

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
	title := "title_example" // string | 
	businessType := int32(56) // int32 | 0 其它 1 新增 2 修改 3 删除 4 查询 (optional) (default to 0)
	method := "method_example" // string |  (optional) (default to "")
	requestMethod := "requestMethod_example" // string |  (optional) (default to "")
	operUrl := "operUrl_example" // string |  (optional) (default to "")
	operName := "operName_example" // string |  (optional) (default to "system")
	operIp := "operIp_example" // string |  (optional) (default to "127.0.0.1")
	status := int32(56) // int32 | 0 成功 1 失败 (optional) (default to 0)
	errorMsg := "errorMsg_example" // string |  (optional) (default to "")

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.SystemAuditAPI.CreateOperLogApiV1SystemAuditOperlogCreatePost(context.Background()).Title(title).BusinessType(businessType).Method(method).RequestMethod(requestMethod).OperUrl(operUrl).OperName(operName).OperIp(operIp).Status(status).ErrorMsg(errorMsg).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `SystemAuditAPI.CreateOperLogApiV1SystemAuditOperlogCreatePost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `CreateOperLogApiV1SystemAuditOperlogCreatePost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `SystemAuditAPI.CreateOperLogApiV1SystemAuditOperlogCreatePost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiCreateOperLogApiV1SystemAuditOperlogCreatePostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **title** | **string** |  | 
 **businessType** | **int32** | 0 其它 1 新增 2 修改 3 删除 4 查询 | [default to 0]
 **method** | **string** |  | [default to &quot;&quot;]
 **requestMethod** | **string** |  | [default to &quot;&quot;]
 **operUrl** | **string** |  | [default to &quot;&quot;]
 **operName** | **string** |  | [default to &quot;system&quot;]
 **operIp** | **string** |  | [default to &quot;127.0.0.1&quot;]
 **status** | **int32** | 0 成功 1 失败 | [default to 0]
 **errorMsg** | **string** |  | [default to &quot;&quot;]

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


## ExportLoginInfoApiV1SystemAuditLogininforExportGet

> interface{} ExportLoginInfoApiV1SystemAuditLogininforExportGet(ctx).UserName(userName).Status(status).Execute()

导出登录日志到Excel

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
	userName := "userName_example" // string |  (optional)
	status := "status_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.SystemAuditAPI.ExportLoginInfoApiV1SystemAuditLogininforExportGet(context.Background()).UserName(userName).Status(status).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `SystemAuditAPI.ExportLoginInfoApiV1SystemAuditLogininforExportGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ExportLoginInfoApiV1SystemAuditLogininforExportGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `SystemAuditAPI.ExportLoginInfoApiV1SystemAuditLogininforExportGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiExportLoginInfoApiV1SystemAuditLogininforExportGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **userName** | **string** |  | 
 **status** | **string** |  | 

### Return type

**interface{}**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## ExportOperLogsApiV1SystemAuditOperlogExportGet

> interface{} ExportOperLogsApiV1SystemAuditOperlogExportGet(ctx).Title(title).OperName(operName).BusinessType(businessType).Execute()

导出操作日志到Excel

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
	title := "title_example" // string |  (optional)
	operName := "operName_example" // string |  (optional)
	businessType := int32(56) // int32 |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.SystemAuditAPI.ExportOperLogsApiV1SystemAuditOperlogExportGet(context.Background()).Title(title).OperName(operName).BusinessType(businessType).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `SystemAuditAPI.ExportOperLogsApiV1SystemAuditOperlogExportGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ExportOperLogsApiV1SystemAuditOperlogExportGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `SystemAuditAPI.ExportOperLogsApiV1SystemAuditOperlogExportGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiExportOperLogsApiV1SystemAuditOperlogExportGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **title** | **string** |  | 
 **operName** | **string** |  | 
 **businessType** | **int32** |  | 

### Return type

**interface{}**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## ListLoginInfoApiV1SystemAuditLogininforListGet

> interface{} ListLoginInfoApiV1SystemAuditLogininforListGet(ctx).Page(page).Limit(limit).UserName(userName).Status(status).Execute()

登录日志列表

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
	page := int32(56) // int32 |  (optional) (default to 1)
	limit := int32(56) // int32 |  (optional) (default to 20)
	userName := "userName_example" // string |  (optional)
	status := "status_example" // string | 0 成功 1 失败 (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.SystemAuditAPI.ListLoginInfoApiV1SystemAuditLogininforListGet(context.Background()).Page(page).Limit(limit).UserName(userName).Status(status).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `SystemAuditAPI.ListLoginInfoApiV1SystemAuditLogininforListGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListLoginInfoApiV1SystemAuditLogininforListGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `SystemAuditAPI.ListLoginInfoApiV1SystemAuditLogininforListGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiListLoginInfoApiV1SystemAuditLogininforListGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int32** |  | [default to 1]
 **limit** | **int32** |  | [default to 20]
 **userName** | **string** |  | 
 **status** | **string** | 0 成功 1 失败 | 

### Return type

**interface{}**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## ListOperLogsApiV1SystemAuditOperlogListGet

> interface{} ListOperLogsApiV1SystemAuditOperlogListGet(ctx).Page(page).Limit(limit).Title(title).OperName(operName).BusinessType(businessType).Execute()

操作日志列表

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
	page := int32(56) // int32 |  (optional) (default to 1)
	limit := int32(56) // int32 |  (optional) (default to 20)
	title := "title_example" // string |  (optional)
	operName := "operName_example" // string |  (optional)
	businessType := int32(56) // int32 |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.SystemAuditAPI.ListOperLogsApiV1SystemAuditOperlogListGet(context.Background()).Page(page).Limit(limit).Title(title).OperName(operName).BusinessType(businessType).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `SystemAuditAPI.ListOperLogsApiV1SystemAuditOperlogListGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListOperLogsApiV1SystemAuditOperlogListGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `SystemAuditAPI.ListOperLogsApiV1SystemAuditOperlogListGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiListOperLogsApiV1SystemAuditOperlogListGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int32** |  | [default to 1]
 **limit** | **int32** |  | [default to 20]
 **title** | **string** |  | 
 **operName** | **string** |  | 
 **businessType** | **int32** |  | 

### Return type

**interface{}**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)

