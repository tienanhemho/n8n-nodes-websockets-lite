import {
  ICredentialType,
  INodeProperties,
  IHttpRequestOptions,
  IHttpRequestMethods,
	IAuthenticateGeneric,
	ICredentialTestRequest,
	IHttpRequestHelper,
	ICredentialDataDecryptedObject,
} from 'n8n-workflow';

export class WebSocketApi implements ICredentialType {
  name = 'webSocketApi';
  displayName = 'webSocket API';
  properties: INodeProperties[] = [
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
      default: '',
      placeholder: '{"Accept": "application/json"}',
			description: 'Headers to send with the login request',
    },
  ];

  async preAuthentication(this: IHttpRequestHelper, credentials: ICredentialDataDecryptedObject): Promise<{ cookie: string }> {
		const bodyContentType = credentials.bodyContentType as string;
		const jsonBody = credentials.jsonBody as string;
		const headers = credentials.headers as string;
		const parsedHeaders = headers ? JSON.parse(headers) : {};
		const parsedBody = jsonBody ? JSON.parse(jsonBody) : {};
		const parsedBodyString = bodyContentType === 'json' ? JSON.stringify(parsedBody) : new URLSearchParams(parsedBody).toString();
		const parsedHeadersContentType = bodyContentType === 'json' ? 'application/json' : 'application/x-www-form-urlencoded';
    const requestOptions: IHttpRequestOptions = {
      method: 'POST' as IHttpRequestMethods,
      url: credentials.loginEndpoint as string,
			headers: {
				...parsedHeaders,
				'Content-Type': parsedHeadersContentType,
			},
			body: parsedBodyString,
			json: bodyContentType === 'json',
    };

    const response = await this.helpers.httpRequest!(requestOptions);

    const cookie = response.headers['set-cookie']?.[0];
    if (!cookie) {
      throw new Error('No cookie returned from login request');
    }

    return { cookie };
  }
	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				'Cookie': '={{$credentials.cookie}}',
			},
		},
	};
	test: ICredentialTestRequest = {
		request: {
			baseURL: 'https://example.com/api',
			url: '/test',
			method: 'GET',
		},
	};
}
