import { ApplicationError } from 'n8n-workflow';
import type {
  ICredentialType,
  INodeProperties,
  IHttpRequestOptions,
  IHttpRequestMethods,
	IAuthenticateGeneric,
	ICredentialTestRequest,
	IHttpRequestHelper,
	ICredentialDataDecryptedObject,
} from 'n8n-workflow';

export class WebsocketsApi implements ICredentialType {
  name = 'websocketsApi';
  displayName = 'Websockets API';
  properties: INodeProperties[] = [{
		displayName: 'Cookie',
			name: 'cookie',
			type: 'hidden',
			typeOptions: {
				expirable: true,
			},
			default: '',
		},
    {
      displayName: 'Login Endpoint',
      name: 'loginEndpoint',
      type: 'string',
      default: '',
      placeholder: 'https://example.com/api/login',
      required: true,
    },
    {
      displayName: 'Body Object',
      name: 'jsonBody',
      type: 'json',
      default: '',
      placeholder: '{"username": "user", "password": "pass"}',
      required: true,
			description: 'JSON body to send with the login request',
    },
		{
			displayName: 'Body Content Type',
			name: 'bodyContentType',
			type: 'options',
			options: [
				{
					name: 'JSON',
					value: 'json',
				},
				{
					name: 'Form URL Encoded',
					value: 'formUrlEncoded',
				}
			],
			default: 'json',
			description: 'The content type of the body to send with the login request',
		},
    {
      displayName: 'Headers',
      name: 'headers',
      type: 'json',
      default: '{}',
      placeholder: '{"Accept": "application/json"}',
			description: 'Headers to send with the login request',
    },
		{
      displayName: 'Test Endpoint',
      name: 'testEndpoint',
      type: 'string',
      default: '',
      placeholder: 'https://example.com/api/test'
    },
  ];

  async preAuthentication(this: IHttpRequestHelper, credentials: ICredentialDataDecryptedObject) {
		const bodyContentType = credentials.bodyContentType as string;
		const jsonBody = credentials.jsonBody as string;
		const headers = credentials.headers as string;
		const parsedHeaders = headers ? JSON.parse(headers) : {};
		const parsedBody = jsonBody ? JSON.parse(jsonBody) : {};
		const parsedBodyString = bodyContentType === 'json' ? JSON.stringify(parsedBody) : new URLSearchParams(parsedBody).toString();
    const requestOptions: IHttpRequestOptions = {
      method: 'POST' as IHttpRequestMethods,
      url: credentials.loginEndpoint as string,
			headers: {
				...parsedHeaders
			},
			body: parsedBodyString,
			json: bodyContentType === 'json',
			returnFullResponse: true,
			disableFollowRedirect: true,
			ignoreHttpStatusErrors: true
    };

    const response = await this.helpers.httpRequest(requestOptions);
		const rPHeaders = response.headers;
		const cookie = (rPHeaders['set-cookie'] as string[])
			?.map((cookie) => cookie.split(';')[0])
			?.join('; ')
			?.trim();

			if (!cookie) {
				throw new ApplicationError('No cookie returned. Please check your credentials.' + JSON.stringify(response.headers), {
					level: 'warning',
					tags: {},
					extra: {},
				});
			}

    return { cookie };
  }
	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Cookie: '={{$credentials.cookie}}',
			},
		},
	};
	test: ICredentialTestRequest = {
		request: {
			url: '={{$credentials.testEndpoint}}',
			method: 'POST',
			headers: {
				"X-Requested-With": "XMLHttpRequest",
				"Accept": "application/json",
				"Accept-Language": "vi,en;q=0.9",
				"Cookie": "={{$credentials.cookie}}",
			},
			disableFollowRedirect: true,
		},
		rules: [
			{
				type: 'responseCode',
				properties: {
					value: 302,
					message: 'Response code is not 2xx'
				},
			},
			{
				type: 'responseCode',
				properties: {
					value: 601,
					message: 'Lỗi đăng nhập',
				},
			},
			{
				type: 'responseCode',
				properties: {
					value: 404,
					message: 'Không thấy trang',
				},
			},
		],
	};
}
