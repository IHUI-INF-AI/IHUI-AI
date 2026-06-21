# \TBoxAPI

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**ActivateDeviceApiV1TboxDeviceDeviceNoActivatePost**](TBoxAPI.md#ActivateDeviceApiV1TboxDeviceDeviceNoActivatePost) | **Post** /api/v1/tbox/device/{device_no}/activate | 激活设备
[**ActivateDeviceApiV1TboxDeviceDeviceNoActivatePost_0**](TBoxAPI.md#ActivateDeviceApiV1TboxDeviceDeviceNoActivatePost_0) | **Post** /api/v1/tbox/device/{device_no}/activate | 激活设备
[**GetDeviceApiV1TboxDeviceDeviceNoGet**](TBoxAPI.md#GetDeviceApiV1TboxDeviceDeviceNoGet) | **Get** /api/v1/tbox/device/{device_no} | 设备详情
[**GetDeviceApiV1TboxDeviceDeviceNoGet_0**](TBoxAPI.md#GetDeviceApiV1TboxDeviceDeviceNoGet_0) | **Get** /api/v1/tbox/device/{device_no} | 设备详情
[**HeartbeatApiV1TboxDeviceHeartbeatPost**](TBoxAPI.md#HeartbeatApiV1TboxDeviceHeartbeatPost) | **Post** /api/v1/tbox/device/heartbeat | 设备心跳
[**HeartbeatApiV1TboxDeviceHeartbeatPost_0**](TBoxAPI.md#HeartbeatApiV1TboxDeviceHeartbeatPost_0) | **Post** /api/v1/tbox/device/heartbeat | 设备心跳
[**ListCommandsApiV1TboxCommandListGet**](TBoxAPI.md#ListCommandsApiV1TboxCommandListGet) | **Get** /api/v1/tbox/command/list | 指令列表
[**ListCommandsApiV1TboxCommandListGet_0**](TBoxAPI.md#ListCommandsApiV1TboxCommandListGet_0) | **Get** /api/v1/tbox/command/list | 指令列表
[**ListDevicesApiV1TboxDeviceListGet**](TBoxAPI.md#ListDevicesApiV1TboxDeviceListGet) | **Get** /api/v1/tbox/device/list | 设备列表
[**ListDevicesApiV1TboxDeviceListGet_0**](TBoxAPI.md#ListDevicesApiV1TboxDeviceListGet_0) | **Get** /api/v1/tbox/device/list | 设备列表
[**RegisterDeviceApiV1TboxDevicePost**](TBoxAPI.md#RegisterDeviceApiV1TboxDevicePost) | **Post** /api/v1/tbox/device | 注册设备
[**RegisterDeviceApiV1TboxDevicePost_0**](TBoxAPI.md#RegisterDeviceApiV1TboxDevicePost_0) | **Post** /api/v1/tbox/device | 注册设备
[**SendCommandApiV1TboxDeviceDeviceNoCommandPost**](TBoxAPI.md#SendCommandApiV1TboxDeviceDeviceNoCommandPost) | **Post** /api/v1/tbox/device/{device_no}/command | 下发指令
[**SendCommandApiV1TboxDeviceDeviceNoCommandPost_0**](TBoxAPI.md#SendCommandApiV1TboxDeviceDeviceNoCommandPost_0) | **Post** /api/v1/tbox/device/{device_no}/command | 下发指令



## ActivateDeviceApiV1TboxDeviceDeviceNoActivatePost

> interface{} ActivateDeviceApiV1TboxDeviceDeviceNoActivatePost(ctx, deviceNo).UserId(userId).UserName(userName).Execute()

激活设备

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
	deviceNo := "deviceNo_example" // string | 
	userId := "userId_example" // string | 
	userName := "userName_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.TBoxAPI.ActivateDeviceApiV1TboxDeviceDeviceNoActivatePost(context.Background(), deviceNo).UserId(userId).UserName(userName).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `TBoxAPI.ActivateDeviceApiV1TboxDeviceDeviceNoActivatePost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ActivateDeviceApiV1TboxDeviceDeviceNoActivatePost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `TBoxAPI.ActivateDeviceApiV1TboxDeviceDeviceNoActivatePost`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**deviceNo** | **string** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiActivateDeviceApiV1TboxDeviceDeviceNoActivatePostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------

 **userId** | **string** |  | 
 **userName** | **string** |  | 

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


## ActivateDeviceApiV1TboxDeviceDeviceNoActivatePost_0

> interface{} ActivateDeviceApiV1TboxDeviceDeviceNoActivatePost_0(ctx, deviceNo).UserId(userId).UserName(userName).Execute()

激活设备

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
	deviceNo := "deviceNo_example" // string | 
	userId := "userId_example" // string | 
	userName := "userName_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.TBoxAPI.ActivateDeviceApiV1TboxDeviceDeviceNoActivatePost_0(context.Background(), deviceNo).UserId(userId).UserName(userName).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `TBoxAPI.ActivateDeviceApiV1TboxDeviceDeviceNoActivatePost_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ActivateDeviceApiV1TboxDeviceDeviceNoActivatePost_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `TBoxAPI.ActivateDeviceApiV1TboxDeviceDeviceNoActivatePost_0`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**deviceNo** | **string** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiActivateDeviceApiV1TboxDeviceDeviceNoActivatePost_1Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------

 **userId** | **string** |  | 
 **userName** | **string** |  | 

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


## GetDeviceApiV1TboxDeviceDeviceNoGet

> interface{} GetDeviceApiV1TboxDeviceDeviceNoGet(ctx, deviceNo).Execute()

设备详情

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
	deviceNo := "deviceNo_example" // string | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.TBoxAPI.GetDeviceApiV1TboxDeviceDeviceNoGet(context.Background(), deviceNo).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `TBoxAPI.GetDeviceApiV1TboxDeviceDeviceNoGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GetDeviceApiV1TboxDeviceDeviceNoGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `TBoxAPI.GetDeviceApiV1TboxDeviceDeviceNoGet`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**deviceNo** | **string** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiGetDeviceApiV1TboxDeviceDeviceNoGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------


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


## GetDeviceApiV1TboxDeviceDeviceNoGet_0

> interface{} GetDeviceApiV1TboxDeviceDeviceNoGet_0(ctx, deviceNo).Execute()

设备详情

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
	deviceNo := "deviceNo_example" // string | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.TBoxAPI.GetDeviceApiV1TboxDeviceDeviceNoGet_0(context.Background(), deviceNo).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `TBoxAPI.GetDeviceApiV1TboxDeviceDeviceNoGet_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GetDeviceApiV1TboxDeviceDeviceNoGet_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `TBoxAPI.GetDeviceApiV1TboxDeviceDeviceNoGet_0`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**deviceNo** | **string** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiGetDeviceApiV1TboxDeviceDeviceNoGet_2Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------


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


## HeartbeatApiV1TboxDeviceHeartbeatPost

> interface{} HeartbeatApiV1TboxDeviceHeartbeatPost(ctx).DeviceNo(deviceNo).IsOnline(isOnline).SignalStrength(signalStrength).Battery(battery).Location(location).Execute()

设备心跳

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
	deviceNo := "deviceNo_example" // string | 
	isOnline := true // bool |  (optional) (default to true)
	signalStrength := int32(56) // int32 |  (optional) (default to 0)
	battery := int32(56) // int32 |  (optional) (default to 0)
	location := "location_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.TBoxAPI.HeartbeatApiV1TboxDeviceHeartbeatPost(context.Background()).DeviceNo(deviceNo).IsOnline(isOnline).SignalStrength(signalStrength).Battery(battery).Location(location).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `TBoxAPI.HeartbeatApiV1TboxDeviceHeartbeatPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `HeartbeatApiV1TboxDeviceHeartbeatPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `TBoxAPI.HeartbeatApiV1TboxDeviceHeartbeatPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiHeartbeatApiV1TboxDeviceHeartbeatPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **deviceNo** | **string** |  | 
 **isOnline** | **bool** |  | [default to true]
 **signalStrength** | **int32** |  | [default to 0]
 **battery** | **int32** |  | [default to 0]
 **location** | **string** |  | 

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


## HeartbeatApiV1TboxDeviceHeartbeatPost_0

> interface{} HeartbeatApiV1TboxDeviceHeartbeatPost_0(ctx).DeviceNo(deviceNo).IsOnline(isOnline).SignalStrength(signalStrength).Battery(battery).Location(location).Execute()

设备心跳

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
	deviceNo := "deviceNo_example" // string | 
	isOnline := true // bool |  (optional) (default to true)
	signalStrength := int32(56) // int32 |  (optional) (default to 0)
	battery := int32(56) // int32 |  (optional) (default to 0)
	location := "location_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.TBoxAPI.HeartbeatApiV1TboxDeviceHeartbeatPost_0(context.Background()).DeviceNo(deviceNo).IsOnline(isOnline).SignalStrength(signalStrength).Battery(battery).Location(location).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `TBoxAPI.HeartbeatApiV1TboxDeviceHeartbeatPost_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `HeartbeatApiV1TboxDeviceHeartbeatPost_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `TBoxAPI.HeartbeatApiV1TboxDeviceHeartbeatPost_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiHeartbeatApiV1TboxDeviceHeartbeatPost_3Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **deviceNo** | **string** |  | 
 **isOnline** | **bool** |  | [default to true]
 **signalStrength** | **int32** |  | [default to 0]
 **battery** | **int32** |  | [default to 0]
 **location** | **string** |  | 

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


## ListCommandsApiV1TboxCommandListGet

> interface{} ListCommandsApiV1TboxCommandListGet(ctx).Page(page).Limit(limit).DeviceNo(deviceNo).Status(status).Execute()

指令列表

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
	deviceNo := "deviceNo_example" // string |  (optional)
	status := int32(56) // int32 |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.TBoxAPI.ListCommandsApiV1TboxCommandListGet(context.Background()).Page(page).Limit(limit).DeviceNo(deviceNo).Status(status).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `TBoxAPI.ListCommandsApiV1TboxCommandListGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListCommandsApiV1TboxCommandListGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `TBoxAPI.ListCommandsApiV1TboxCommandListGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiListCommandsApiV1TboxCommandListGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int32** |  | [default to 1]
 **limit** | **int32** |  | [default to 20]
 **deviceNo** | **string** |  | 
 **status** | **int32** |  | 

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


## ListCommandsApiV1TboxCommandListGet_0

> interface{} ListCommandsApiV1TboxCommandListGet_0(ctx).Page(page).Limit(limit).DeviceNo(deviceNo).Status(status).Execute()

指令列表

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
	deviceNo := "deviceNo_example" // string |  (optional)
	status := int32(56) // int32 |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.TBoxAPI.ListCommandsApiV1TboxCommandListGet_0(context.Background()).Page(page).Limit(limit).DeviceNo(deviceNo).Status(status).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `TBoxAPI.ListCommandsApiV1TboxCommandListGet_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListCommandsApiV1TboxCommandListGet_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `TBoxAPI.ListCommandsApiV1TboxCommandListGet_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiListCommandsApiV1TboxCommandListGet_4Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int32** |  | [default to 1]
 **limit** | **int32** |  | [default to 20]
 **deviceNo** | **string** |  | 
 **status** | **int32** |  | 

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


## ListDevicesApiV1TboxDeviceListGet

> interface{} ListDevicesApiV1TboxDeviceListGet(ctx).Page(page).Limit(limit).UserId(userId).DeviceType(deviceType).Status(status).IsOnline(isOnline).Execute()

设备列表

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
	userId := "userId_example" // string |  (optional)
	deviceType := "deviceType_example" // string |  (optional)
	status := int32(56) // int32 |  (optional)
	isOnline := true // bool |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.TBoxAPI.ListDevicesApiV1TboxDeviceListGet(context.Background()).Page(page).Limit(limit).UserId(userId).DeviceType(deviceType).Status(status).IsOnline(isOnline).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `TBoxAPI.ListDevicesApiV1TboxDeviceListGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListDevicesApiV1TboxDeviceListGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `TBoxAPI.ListDevicesApiV1TboxDeviceListGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiListDevicesApiV1TboxDeviceListGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int32** |  | [default to 1]
 **limit** | **int32** |  | [default to 20]
 **userId** | **string** |  | 
 **deviceType** | **string** |  | 
 **status** | **int32** |  | 
 **isOnline** | **bool** |  | 

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


## ListDevicesApiV1TboxDeviceListGet_0

> interface{} ListDevicesApiV1TboxDeviceListGet_0(ctx).Page(page).Limit(limit).UserId(userId).DeviceType(deviceType).Status(status).IsOnline(isOnline).Execute()

设备列表

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
	userId := "userId_example" // string |  (optional)
	deviceType := "deviceType_example" // string |  (optional)
	status := int32(56) // int32 |  (optional)
	isOnline := true // bool |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.TBoxAPI.ListDevicesApiV1TboxDeviceListGet_0(context.Background()).Page(page).Limit(limit).UserId(userId).DeviceType(deviceType).Status(status).IsOnline(isOnline).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `TBoxAPI.ListDevicesApiV1TboxDeviceListGet_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListDevicesApiV1TboxDeviceListGet_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `TBoxAPI.ListDevicesApiV1TboxDeviceListGet_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiListDevicesApiV1TboxDeviceListGet_5Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int32** |  | [default to 1]
 **limit** | **int32** |  | [default to 20]
 **userId** | **string** |  | 
 **deviceType** | **string** |  | 
 **status** | **int32** |  | 
 **isOnline** | **bool** |  | 

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


## RegisterDeviceApiV1TboxDevicePost

> interface{} RegisterDeviceApiV1TboxDevicePost(ctx).DeviceNo(deviceNo).DeviceName(deviceName).DeviceType(deviceType).Model(model).Brand(brand).Iccid(iccid).Imei(imei).Firmware(firmware).Execute()

注册设备

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
	deviceNo := "deviceNo_example" // string | 
	deviceName := "deviceName_example" // string |  (optional)
	deviceType := "deviceType_example" // string |  (optional) (default to "tbox")
	model := "model_example" // string |  (optional)
	brand := "brand_example" // string |  (optional)
	iccid := "iccid_example" // string |  (optional)
	imei := "imei_example" // string |  (optional)
	firmware := "firmware_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.TBoxAPI.RegisterDeviceApiV1TboxDevicePost(context.Background()).DeviceNo(deviceNo).DeviceName(deviceName).DeviceType(deviceType).Model(model).Brand(brand).Iccid(iccid).Imei(imei).Firmware(firmware).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `TBoxAPI.RegisterDeviceApiV1TboxDevicePost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `RegisterDeviceApiV1TboxDevicePost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `TBoxAPI.RegisterDeviceApiV1TboxDevicePost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiRegisterDeviceApiV1TboxDevicePostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **deviceNo** | **string** |  | 
 **deviceName** | **string** |  | 
 **deviceType** | **string** |  | [default to &quot;tbox&quot;]
 **model** | **string** |  | 
 **brand** | **string** |  | 
 **iccid** | **string** |  | 
 **imei** | **string** |  | 
 **firmware** | **string** |  | 

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


## RegisterDeviceApiV1TboxDevicePost_0

> interface{} RegisterDeviceApiV1TboxDevicePost_0(ctx).DeviceNo(deviceNo).DeviceName(deviceName).DeviceType(deviceType).Model(model).Brand(brand).Iccid(iccid).Imei(imei).Firmware(firmware).Execute()

注册设备

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
	deviceNo := "deviceNo_example" // string | 
	deviceName := "deviceName_example" // string |  (optional)
	deviceType := "deviceType_example" // string |  (optional) (default to "tbox")
	model := "model_example" // string |  (optional)
	brand := "brand_example" // string |  (optional)
	iccid := "iccid_example" // string |  (optional)
	imei := "imei_example" // string |  (optional)
	firmware := "firmware_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.TBoxAPI.RegisterDeviceApiV1TboxDevicePost_0(context.Background()).DeviceNo(deviceNo).DeviceName(deviceName).DeviceType(deviceType).Model(model).Brand(brand).Iccid(iccid).Imei(imei).Firmware(firmware).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `TBoxAPI.RegisterDeviceApiV1TboxDevicePost_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `RegisterDeviceApiV1TboxDevicePost_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `TBoxAPI.RegisterDeviceApiV1TboxDevicePost_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiRegisterDeviceApiV1TboxDevicePost_6Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **deviceNo** | **string** |  | 
 **deviceName** | **string** |  | 
 **deviceType** | **string** |  | [default to &quot;tbox&quot;]
 **model** | **string** |  | 
 **brand** | **string** |  | 
 **iccid** | **string** |  | 
 **imei** | **string** |  | 
 **firmware** | **string** |  | 

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


## SendCommandApiV1TboxDeviceDeviceNoCommandPost

> interface{} SendCommandApiV1TboxDeviceDeviceNoCommandPost(ctx, deviceNo).Command(command).Params(params).Execute()

下发指令

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
	deviceNo := "deviceNo_example" // string | 
	command := "command_example" // string | 
	params := "params_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.TBoxAPI.SendCommandApiV1TboxDeviceDeviceNoCommandPost(context.Background(), deviceNo).Command(command).Params(params).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `TBoxAPI.SendCommandApiV1TboxDeviceDeviceNoCommandPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `SendCommandApiV1TboxDeviceDeviceNoCommandPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `TBoxAPI.SendCommandApiV1TboxDeviceDeviceNoCommandPost`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**deviceNo** | **string** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiSendCommandApiV1TboxDeviceDeviceNoCommandPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------

 **command** | **string** |  | 
 **params** | **string** |  | 

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


## SendCommandApiV1TboxDeviceDeviceNoCommandPost_0

> interface{} SendCommandApiV1TboxDeviceDeviceNoCommandPost_0(ctx, deviceNo).Command(command).Params(params).Execute()

下发指令

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
	deviceNo := "deviceNo_example" // string | 
	command := "command_example" // string | 
	params := "params_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.TBoxAPI.SendCommandApiV1TboxDeviceDeviceNoCommandPost_0(context.Background(), deviceNo).Command(command).Params(params).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `TBoxAPI.SendCommandApiV1TboxDeviceDeviceNoCommandPost_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `SendCommandApiV1TboxDeviceDeviceNoCommandPost_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `TBoxAPI.SendCommandApiV1TboxDeviceDeviceNoCommandPost_0`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**deviceNo** | **string** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiSendCommandApiV1TboxDeviceDeviceNoCommandPost_7Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------

 **command** | **string** |  | 
 **params** | **string** |  | 

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

