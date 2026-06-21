# VideoGenerateBody

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**Prompt** | **string** |  | 
**ModelName** | Pointer to **string** |  | [optional] [default to "kling-v1"]
**Duration** | Pointer to **string** |  | [optional] [default to "5"]
**Mode** | Pointer to **string** |  | [optional] [default to "std"]
**AspectRatio** | Pointer to **string** |  | [optional] [default to "16:9"]
**CfgScale** | Pointer to **float32** |  | [optional] [default to 0.5]
**NegativePrompt** | Pointer to **NullableString** |  | [optional] 
**CameraControl** | Pointer to **map[string]interface{}** |  | [optional] 

## Methods

### NewVideoGenerateBody

`func NewVideoGenerateBody(prompt string, ) *VideoGenerateBody`

NewVideoGenerateBody instantiates a new VideoGenerateBody object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewVideoGenerateBodyWithDefaults

`func NewVideoGenerateBodyWithDefaults() *VideoGenerateBody`

NewVideoGenerateBodyWithDefaults instantiates a new VideoGenerateBody object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetPrompt

`func (o *VideoGenerateBody) GetPrompt() string`

GetPrompt returns the Prompt field if non-nil, zero value otherwise.

### GetPromptOk

`func (o *VideoGenerateBody) GetPromptOk() (*string, bool)`

GetPromptOk returns a tuple with the Prompt field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetPrompt

`func (o *VideoGenerateBody) SetPrompt(v string)`

SetPrompt sets Prompt field to given value.


### GetModelName

`func (o *VideoGenerateBody) GetModelName() string`

GetModelName returns the ModelName field if non-nil, zero value otherwise.

### GetModelNameOk

`func (o *VideoGenerateBody) GetModelNameOk() (*string, bool)`

GetModelNameOk returns a tuple with the ModelName field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetModelName

`func (o *VideoGenerateBody) SetModelName(v string)`

SetModelName sets ModelName field to given value.

### HasModelName

`func (o *VideoGenerateBody) HasModelName() bool`

HasModelName returns a boolean if a field has been set.

### GetDuration

`func (o *VideoGenerateBody) GetDuration() string`

GetDuration returns the Duration field if non-nil, zero value otherwise.

### GetDurationOk

`func (o *VideoGenerateBody) GetDurationOk() (*string, bool)`

GetDurationOk returns a tuple with the Duration field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetDuration

`func (o *VideoGenerateBody) SetDuration(v string)`

SetDuration sets Duration field to given value.

### HasDuration

`func (o *VideoGenerateBody) HasDuration() bool`

HasDuration returns a boolean if a field has been set.

### GetMode

`func (o *VideoGenerateBody) GetMode() string`

GetMode returns the Mode field if non-nil, zero value otherwise.

### GetModeOk

`func (o *VideoGenerateBody) GetModeOk() (*string, bool)`

GetModeOk returns a tuple with the Mode field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetMode

`func (o *VideoGenerateBody) SetMode(v string)`

SetMode sets Mode field to given value.

### HasMode

`func (o *VideoGenerateBody) HasMode() bool`

HasMode returns a boolean if a field has been set.

### GetAspectRatio

`func (o *VideoGenerateBody) GetAspectRatio() string`

GetAspectRatio returns the AspectRatio field if non-nil, zero value otherwise.

### GetAspectRatioOk

`func (o *VideoGenerateBody) GetAspectRatioOk() (*string, bool)`

GetAspectRatioOk returns a tuple with the AspectRatio field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetAspectRatio

`func (o *VideoGenerateBody) SetAspectRatio(v string)`

SetAspectRatio sets AspectRatio field to given value.

### HasAspectRatio

`func (o *VideoGenerateBody) HasAspectRatio() bool`

HasAspectRatio returns a boolean if a field has been set.

### GetCfgScale

`func (o *VideoGenerateBody) GetCfgScale() float32`

GetCfgScale returns the CfgScale field if non-nil, zero value otherwise.

### GetCfgScaleOk

`func (o *VideoGenerateBody) GetCfgScaleOk() (*float32, bool)`

GetCfgScaleOk returns a tuple with the CfgScale field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetCfgScale

`func (o *VideoGenerateBody) SetCfgScale(v float32)`

SetCfgScale sets CfgScale field to given value.

### HasCfgScale

`func (o *VideoGenerateBody) HasCfgScale() bool`

HasCfgScale returns a boolean if a field has been set.

### GetNegativePrompt

`func (o *VideoGenerateBody) GetNegativePrompt() string`

GetNegativePrompt returns the NegativePrompt field if non-nil, zero value otherwise.

### GetNegativePromptOk

`func (o *VideoGenerateBody) GetNegativePromptOk() (*string, bool)`

GetNegativePromptOk returns a tuple with the NegativePrompt field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetNegativePrompt

`func (o *VideoGenerateBody) SetNegativePrompt(v string)`

SetNegativePrompt sets NegativePrompt field to given value.

### HasNegativePrompt

`func (o *VideoGenerateBody) HasNegativePrompt() bool`

HasNegativePrompt returns a boolean if a field has been set.

### SetNegativePromptNil

`func (o *VideoGenerateBody) SetNegativePromptNil(b bool)`

 SetNegativePromptNil sets the value for NegativePrompt to be an explicit nil

### UnsetNegativePrompt
`func (o *VideoGenerateBody) UnsetNegativePrompt()`

UnsetNegativePrompt ensures that no value is present for NegativePrompt, not even an explicit nil
### GetCameraControl

`func (o *VideoGenerateBody) GetCameraControl() map[string]interface{}`

GetCameraControl returns the CameraControl field if non-nil, zero value otherwise.

### GetCameraControlOk

`func (o *VideoGenerateBody) GetCameraControlOk() (*map[string]interface{}, bool)`

GetCameraControlOk returns a tuple with the CameraControl field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetCameraControl

`func (o *VideoGenerateBody) SetCameraControl(v map[string]interface{})`

SetCameraControl sets CameraControl field to given value.

### HasCameraControl

`func (o *VideoGenerateBody) HasCameraControl() bool`

HasCameraControl returns a boolean if a field has been set.

### SetCameraControlNil

`func (o *VideoGenerateBody) SetCameraControlNil(b bool)`

 SetCameraControlNil sets the value for CameraControl to be an explicit nil

### UnsetCameraControl
`func (o *VideoGenerateBody) UnsetCameraControl()`

UnsetCameraControl ensures that no value is present for CameraControl, not even an explicit nil

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


