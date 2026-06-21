
# CaptchaVerifyRequest

Request model for captcha verification.

## Properties

Name | Type
------------ | -------------
`captchaKey` | string
`code` | string

## Example

```typescript
import type { CaptchaVerifyRequest } from ''

// TODO: Update the object below with actual values
const example = {
  "captchaKey": null,
  "code": null,
} satisfies CaptchaVerifyRequest

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as CaptchaVerifyRequest
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


