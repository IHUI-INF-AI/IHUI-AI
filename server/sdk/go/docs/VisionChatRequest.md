# VisionChatRequest

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**Images** | [**[]VisionImageInfo**](VisionImageInfo.md) | 图片列表，至少一张 | 
**Prompt** | **string** | 文本提示词 | 
**Model** | Pointer to **string** | 视觉模型名称 | [optional] [default to "qwen-vl-plus"]
**MaxTokens** | Pointer to **int32** | 最大生成token数 | [optional] [default to 1500]

## Methods

### NewVisionChatRequest

`func NewVisionChatRequest(images []VisionImageInfo, prompt string, ) *VisionChatRequest`

NewVisionChatRequest instantiates a new VisionChatRequest object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewVisionChatRequestWithDefaults

`func NewVisionChatRequestWithDefaults() *VisionChatRequest`

NewVisionChatRequestWithDefaults instantiates a new VisionChatRequest object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetImages

`func (o *VisionChatRequest) GetImages() []VisionImageInfo`

GetImages returns the Images field if non-nil, zero value otherwise.

### GetImagesOk

`func (o *VisionChatRequest) GetImagesOk() (*[]VisionImageInfo, bool)`

GetImagesOk returns a tuple with the Images field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetImages

`func (o *VisionChatRequest) SetImages(v []VisionImageInfo)`

SetImages sets Images field to given value.


### GetPrompt

`func (o *VisionChatRequest) GetPrompt() string`

GetPrompt returns the Prompt field if non-nil, zero value otherwise.

### GetPromptOk

`func (o *VisionChatRequest) GetPromptOk() (*string, bool)`

GetPromptOk returns a tuple with the Prompt field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetPrompt

`func (o *VisionChatRequest) SetPrompt(v string)`

SetPrompt sets Prompt field to given value.


### GetModel

`func (o *VisionChatRequest) GetModel() string`

GetModel returns the Model field if non-nil, zero value otherwise.

### GetModelOk

`func (o *VisionChatRequest) GetModelOk() (*string, bool)`

GetModelOk returns a tuple with the Model field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetModel

`func (o *VisionChatRequest) SetModel(v string)`

SetModel sets Model field to given value.

### HasModel

`func (o *VisionChatRequest) HasModel() bool`

HasModel returns a boolean if a field has been set.

### GetMaxTokens

`func (o *VisionChatRequest) GetMaxTokens() int32`

GetMaxTokens returns the MaxTokens field if non-nil, zero value otherwise.

### GetMaxTokensOk

`func (o *VisionChatRequest) GetMaxTokensOk() (*int32, bool)`

GetMaxTokensOk returns a tuple with the MaxTokens field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetMaxTokens

`func (o *VisionChatRequest) SetMaxTokens(v int32)`

SetMaxTokens sets MaxTokens field to given value.

### HasMaxTokens

`func (o *VisionChatRequest) HasMaxTokens() bool`

HasMaxTokens returns a boolean if a field has been set.


[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


