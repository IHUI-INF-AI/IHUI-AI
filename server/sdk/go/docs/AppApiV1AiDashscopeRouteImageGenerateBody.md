# AppApiV1AiDashscopeRouteImageGenerateBody

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**Prompt** | **string** | Text prompt for image generation | 
**NegativePrompt** | Pointer to **NullableString** | Negative prompt | [optional] 
**Size** | Pointer to **NullableString** | Image size, e.g. 1024*1024 | [optional] 
**N** | Pointer to **NullableInt32** | Number of images to generate | [optional] 
**Style** | Pointer to **NullableString** | Style preset | [optional] 
**Sync** | Pointer to **bool** | If true, poll until the task completes and return image URLs directly | [optional] [default to false]
**Zidingyican** | Pointer to **[]map[string]interface{}** | Extra custom parameters as name/value pairs | [optional] 

## Methods

### NewAppApiV1AiDashscopeRouteImageGenerateBody

`func NewAppApiV1AiDashscopeRouteImageGenerateBody(prompt string, ) *AppApiV1AiDashscopeRouteImageGenerateBody`

NewAppApiV1AiDashscopeRouteImageGenerateBody instantiates a new AppApiV1AiDashscopeRouteImageGenerateBody object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewAppApiV1AiDashscopeRouteImageGenerateBodyWithDefaults

`func NewAppApiV1AiDashscopeRouteImageGenerateBodyWithDefaults() *AppApiV1AiDashscopeRouteImageGenerateBody`

NewAppApiV1AiDashscopeRouteImageGenerateBodyWithDefaults instantiates a new AppApiV1AiDashscopeRouteImageGenerateBody object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetPrompt

`func (o *AppApiV1AiDashscopeRouteImageGenerateBody) GetPrompt() string`

GetPrompt returns the Prompt field if non-nil, zero value otherwise.

### GetPromptOk

`func (o *AppApiV1AiDashscopeRouteImageGenerateBody) GetPromptOk() (*string, bool)`

GetPromptOk returns a tuple with the Prompt field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetPrompt

`func (o *AppApiV1AiDashscopeRouteImageGenerateBody) SetPrompt(v string)`

SetPrompt sets Prompt field to given value.


### GetNegativePrompt

`func (o *AppApiV1AiDashscopeRouteImageGenerateBody) GetNegativePrompt() string`

GetNegativePrompt returns the NegativePrompt field if non-nil, zero value otherwise.

### GetNegativePromptOk

`func (o *AppApiV1AiDashscopeRouteImageGenerateBody) GetNegativePromptOk() (*string, bool)`

GetNegativePromptOk returns a tuple with the NegativePrompt field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetNegativePrompt

`func (o *AppApiV1AiDashscopeRouteImageGenerateBody) SetNegativePrompt(v string)`

SetNegativePrompt sets NegativePrompt field to given value.

### HasNegativePrompt

`func (o *AppApiV1AiDashscopeRouteImageGenerateBody) HasNegativePrompt() bool`

HasNegativePrompt returns a boolean if a field has been set.

### SetNegativePromptNil

`func (o *AppApiV1AiDashscopeRouteImageGenerateBody) SetNegativePromptNil(b bool)`

 SetNegativePromptNil sets the value for NegativePrompt to be an explicit nil

### UnsetNegativePrompt
`func (o *AppApiV1AiDashscopeRouteImageGenerateBody) UnsetNegativePrompt()`

UnsetNegativePrompt ensures that no value is present for NegativePrompt, not even an explicit nil
### GetSize

`func (o *AppApiV1AiDashscopeRouteImageGenerateBody) GetSize() string`

GetSize returns the Size field if non-nil, zero value otherwise.

### GetSizeOk

`func (o *AppApiV1AiDashscopeRouteImageGenerateBody) GetSizeOk() (*string, bool)`

GetSizeOk returns a tuple with the Size field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetSize

`func (o *AppApiV1AiDashscopeRouteImageGenerateBody) SetSize(v string)`

SetSize sets Size field to given value.

### HasSize

`func (o *AppApiV1AiDashscopeRouteImageGenerateBody) HasSize() bool`

HasSize returns a boolean if a field has been set.

### SetSizeNil

`func (o *AppApiV1AiDashscopeRouteImageGenerateBody) SetSizeNil(b bool)`

 SetSizeNil sets the value for Size to be an explicit nil

### UnsetSize
`func (o *AppApiV1AiDashscopeRouteImageGenerateBody) UnsetSize()`

UnsetSize ensures that no value is present for Size, not even an explicit nil
### GetN

`func (o *AppApiV1AiDashscopeRouteImageGenerateBody) GetN() int32`

GetN returns the N field if non-nil, zero value otherwise.

### GetNOk

`func (o *AppApiV1AiDashscopeRouteImageGenerateBody) GetNOk() (*int32, bool)`

GetNOk returns a tuple with the N field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetN

`func (o *AppApiV1AiDashscopeRouteImageGenerateBody) SetN(v int32)`

SetN sets N field to given value.

### HasN

`func (o *AppApiV1AiDashscopeRouteImageGenerateBody) HasN() bool`

HasN returns a boolean if a field has been set.

### SetNNil

`func (o *AppApiV1AiDashscopeRouteImageGenerateBody) SetNNil(b bool)`

 SetNNil sets the value for N to be an explicit nil

### UnsetN
`func (o *AppApiV1AiDashscopeRouteImageGenerateBody) UnsetN()`

UnsetN ensures that no value is present for N, not even an explicit nil
### GetStyle

`func (o *AppApiV1AiDashscopeRouteImageGenerateBody) GetStyle() string`

GetStyle returns the Style field if non-nil, zero value otherwise.

### GetStyleOk

`func (o *AppApiV1AiDashscopeRouteImageGenerateBody) GetStyleOk() (*string, bool)`

GetStyleOk returns a tuple with the Style field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetStyle

`func (o *AppApiV1AiDashscopeRouteImageGenerateBody) SetStyle(v string)`

SetStyle sets Style field to given value.

### HasStyle

`func (o *AppApiV1AiDashscopeRouteImageGenerateBody) HasStyle() bool`

HasStyle returns a boolean if a field has been set.

### SetStyleNil

`func (o *AppApiV1AiDashscopeRouteImageGenerateBody) SetStyleNil(b bool)`

 SetStyleNil sets the value for Style to be an explicit nil

### UnsetStyle
`func (o *AppApiV1AiDashscopeRouteImageGenerateBody) UnsetStyle()`

UnsetStyle ensures that no value is present for Style, not even an explicit nil
### GetSync

`func (o *AppApiV1AiDashscopeRouteImageGenerateBody) GetSync() bool`

GetSync returns the Sync field if non-nil, zero value otherwise.

### GetSyncOk

`func (o *AppApiV1AiDashscopeRouteImageGenerateBody) GetSyncOk() (*bool, bool)`

GetSyncOk returns a tuple with the Sync field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetSync

`func (o *AppApiV1AiDashscopeRouteImageGenerateBody) SetSync(v bool)`

SetSync sets Sync field to given value.

### HasSync

`func (o *AppApiV1AiDashscopeRouteImageGenerateBody) HasSync() bool`

HasSync returns a boolean if a field has been set.

### GetZidingyican

`func (o *AppApiV1AiDashscopeRouteImageGenerateBody) GetZidingyican() []map[string]interface{}`

GetZidingyican returns the Zidingyican field if non-nil, zero value otherwise.

### GetZidingyicanOk

`func (o *AppApiV1AiDashscopeRouteImageGenerateBody) GetZidingyicanOk() (*[]map[string]interface{}, bool)`

GetZidingyicanOk returns a tuple with the Zidingyican field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetZidingyican

`func (o *AppApiV1AiDashscopeRouteImageGenerateBody) SetZidingyican(v []map[string]interface{})`

SetZidingyican sets Zidingyican field to given value.

### HasZidingyican

`func (o *AppApiV1AiDashscopeRouteImageGenerateBody) HasZidingyican() bool`

HasZidingyican returns a boolean if a field has been set.

### SetZidingyicanNil

`func (o *AppApiV1AiDashscopeRouteImageGenerateBody) SetZidingyicanNil(b bool)`

 SetZidingyicanNil sets the value for Zidingyican to be an explicit nil

### UnsetZidingyican
`func (o *AppApiV1AiDashscopeRouteImageGenerateBody) UnsetZidingyican()`

UnsetZidingyican ensures that no value is present for Zidingyican, not even an explicit nil

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


