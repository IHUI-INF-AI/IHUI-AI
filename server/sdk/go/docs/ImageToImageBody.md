# ImageToImageBody

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**InputImageUrl** | **string** | URL of the input image | 
**Prompt** | **string** | Text prompt guiding the transformation | 
**Model** | Pointer to **string** | Model name | [optional] [default to "wanx-v1"]

## Methods

### NewImageToImageBody

`func NewImageToImageBody(inputImageUrl string, prompt string, ) *ImageToImageBody`

NewImageToImageBody instantiates a new ImageToImageBody object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewImageToImageBodyWithDefaults

`func NewImageToImageBodyWithDefaults() *ImageToImageBody`

NewImageToImageBodyWithDefaults instantiates a new ImageToImageBody object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetInputImageUrl

`func (o *ImageToImageBody) GetInputImageUrl() string`

GetInputImageUrl returns the InputImageUrl field if non-nil, zero value otherwise.

### GetInputImageUrlOk

`func (o *ImageToImageBody) GetInputImageUrlOk() (*string, bool)`

GetInputImageUrlOk returns a tuple with the InputImageUrl field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetInputImageUrl

`func (o *ImageToImageBody) SetInputImageUrl(v string)`

SetInputImageUrl sets InputImageUrl field to given value.


### GetPrompt

`func (o *ImageToImageBody) GetPrompt() string`

GetPrompt returns the Prompt field if non-nil, zero value otherwise.

### GetPromptOk

`func (o *ImageToImageBody) GetPromptOk() (*string, bool)`

GetPromptOk returns a tuple with the Prompt field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetPrompt

`func (o *ImageToImageBody) SetPrompt(v string)`

SetPrompt sets Prompt field to given value.


### GetModel

`func (o *ImageToImageBody) GetModel() string`

GetModel returns the Model field if non-nil, zero value otherwise.

### GetModelOk

`func (o *ImageToImageBody) GetModelOk() (*string, bool)`

GetModelOk returns a tuple with the Model field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetModel

`func (o *ImageToImageBody) SetModel(v string)`

SetModel sets Model field to given value.

### HasModel

`func (o *ImageToImageBody) HasModel() bool`

HasModel returns a boolean if a field has been set.


[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


