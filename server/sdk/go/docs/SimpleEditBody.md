# SimpleEditBody

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**Images** | **string** | Image URL | 
**Prompt** | **string** | Editing instruction / operation | 
**Model** | Pointer to **string** | Model name | [optional] [default to "qwen-image-edit"]
**NegativePrompt** | Pointer to **string** | Negative prompt | [optional] [default to ""]
**PromptExtend** | Pointer to **bool** | Whether to extend the prompt | [optional] [default to true]
**Watermark** | Pointer to **bool** | Whether to add watermark | [optional] [default to false]
**Sync** | Pointer to **bool** | If true, wait for completion and return image URL | [optional] [default to false]

## Methods

### NewSimpleEditBody

`func NewSimpleEditBody(images string, prompt string, ) *SimpleEditBody`

NewSimpleEditBody instantiates a new SimpleEditBody object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewSimpleEditBodyWithDefaults

`func NewSimpleEditBodyWithDefaults() *SimpleEditBody`

NewSimpleEditBodyWithDefaults instantiates a new SimpleEditBody object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetImages

`func (o *SimpleEditBody) GetImages() string`

GetImages returns the Images field if non-nil, zero value otherwise.

### GetImagesOk

`func (o *SimpleEditBody) GetImagesOk() (*string, bool)`

GetImagesOk returns a tuple with the Images field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetImages

`func (o *SimpleEditBody) SetImages(v string)`

SetImages sets Images field to given value.


### GetPrompt

`func (o *SimpleEditBody) GetPrompt() string`

GetPrompt returns the Prompt field if non-nil, zero value otherwise.

### GetPromptOk

`func (o *SimpleEditBody) GetPromptOk() (*string, bool)`

GetPromptOk returns a tuple with the Prompt field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetPrompt

`func (o *SimpleEditBody) SetPrompt(v string)`

SetPrompt sets Prompt field to given value.


### GetModel

`func (o *SimpleEditBody) GetModel() string`

GetModel returns the Model field if non-nil, zero value otherwise.

### GetModelOk

`func (o *SimpleEditBody) GetModelOk() (*string, bool)`

GetModelOk returns a tuple with the Model field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetModel

`func (o *SimpleEditBody) SetModel(v string)`

SetModel sets Model field to given value.

### HasModel

`func (o *SimpleEditBody) HasModel() bool`

HasModel returns a boolean if a field has been set.

### GetNegativePrompt

`func (o *SimpleEditBody) GetNegativePrompt() string`

GetNegativePrompt returns the NegativePrompt field if non-nil, zero value otherwise.

### GetNegativePromptOk

`func (o *SimpleEditBody) GetNegativePromptOk() (*string, bool)`

GetNegativePromptOk returns a tuple with the NegativePrompt field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetNegativePrompt

`func (o *SimpleEditBody) SetNegativePrompt(v string)`

SetNegativePrompt sets NegativePrompt field to given value.

### HasNegativePrompt

`func (o *SimpleEditBody) HasNegativePrompt() bool`

HasNegativePrompt returns a boolean if a field has been set.

### GetPromptExtend

`func (o *SimpleEditBody) GetPromptExtend() bool`

GetPromptExtend returns the PromptExtend field if non-nil, zero value otherwise.

### GetPromptExtendOk

`func (o *SimpleEditBody) GetPromptExtendOk() (*bool, bool)`

GetPromptExtendOk returns a tuple with the PromptExtend field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetPromptExtend

`func (o *SimpleEditBody) SetPromptExtend(v bool)`

SetPromptExtend sets PromptExtend field to given value.

### HasPromptExtend

`func (o *SimpleEditBody) HasPromptExtend() bool`

HasPromptExtend returns a boolean if a field has been set.

### GetWatermark

`func (o *SimpleEditBody) GetWatermark() bool`

GetWatermark returns the Watermark field if non-nil, zero value otherwise.

### GetWatermarkOk

`func (o *SimpleEditBody) GetWatermarkOk() (*bool, bool)`

GetWatermarkOk returns a tuple with the Watermark field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetWatermark

`func (o *SimpleEditBody) SetWatermark(v bool)`

SetWatermark sets Watermark field to given value.

### HasWatermark

`func (o *SimpleEditBody) HasWatermark() bool`

HasWatermark returns a boolean if a field has been set.

### GetSync

`func (o *SimpleEditBody) GetSync() bool`

GetSync returns the Sync field if non-nil, zero value otherwise.

### GetSyncOk

`func (o *SimpleEditBody) GetSyncOk() (*bool, bool)`

GetSyncOk returns a tuple with the Sync field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetSync

`func (o *SimpleEditBody) SetSync(v bool)`

SetSync sets Sync field to given value.

### HasSync

`func (o *SimpleEditBody) HasSync() bool`

HasSync returns a boolean if a field has been set.


[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


