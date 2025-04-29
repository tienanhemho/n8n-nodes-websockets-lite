import {
	INodeType,
	INodeTypeDescription,
	NodeConnectionType,
	NodeOperationError,
} from 'n8n-workflow';
import {
	ITriggerFunctions,
	ITriggerResponse,
} from 'n8n-workflow/dist/Interfaces';
// @ts-ignore
import WebSocket from 'ws';

export class WebsocketsNode implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Websockets Node',
		name: 'websocketsNode',
		group: ['trigger'],
		version: 2,
		description: 'Websockets Node',
		defaults: {
			name: 'Websockets Node',
		},
		inputs: [],
		outputs: [NodeConnectionType.Main],
		credentials: [
			{
				name: 'websocketsApi',
				required: false,
			},
		],
		properties: [
			{
				displayName: 'Websocket URL',
				name: 'websocketUrl',
				type: 'string',
				default: '',
				placeholder: 'ws://example.com/my-namespace',
				description: 'The URL of the websocket server to connect to',
				required: true,
			},
			{
				displayName: 'Websocket Headers',
				name: 'headers',
				type: 'fixedCollection',
				typeOptions: {
					multipleValues: true,
				},
				placeholder: 'Add Parameter',
				default: {
					parameters: [],
				},
				options: [
					{
						name: 'parameters',
						displayName: 'Parameter',
						values: [
							{
								displayName: 'Name',
								name: 'name',
								type: 'string',
								default: '',
							},
							{
								displayName: 'Value',
								name: 'value',
								type: 'string',
								default: '',
							},
						],
					},
				],
			},
			{
				displayName: 'Return Data Type',
				name: 'returnDataType',
				type: 'options',
				options: [
					{
						name: 'String',
						value: 'string',
					},
					{
						name: 'Json',
						value: 'json',
					},
					{
						name: 'Binary',
						value: 'binary',
					},
				],
				default: 'string',
				description: 'Returned data format',
			},
			{
				displayName: 'Init Send Data',
				name: 'initData',
				type: 'string',
				default: '',
				description: 'Initialize the message to be sent after the link is successful, such as token, if it is empty, it will not be sent',
			},
			{
				displayName: 'Ping Data',
				name: 'pingData',
				type: 'string',
				default: '',
				description: 'Timing heartbeat data, if it is empty, it will not be sent',
			},
			{
				displayName: 'Ping Timer(s)',
				name: 'pingTimerSeconds',
				type: 'number',
				default: 60,
				description: 'Timing heartbeat data, if it is empty, it will not be sent',
			},
			{
				displayName: 'ReConnect Times',
				name: 'maxReConnectTimes',
				type: 'number',
				default: 5,
			},
		],
	};

	lastSocket: any = null;

	async trigger(this: ITriggerFunctions): Promise<ITriggerResponse> {
		const websocketUrl = this.getNodeParameter('websocketUrl', '') as string;
		const initData = this.getNodeParameter('initData', '') as string;
		const returnDataType = this.getNodeParameter('returnDataType', 'string') as string;
		if (!websocketUrl) {
			throw new NodeOperationError(this.getNode(), '未配置websocketUrl');
		}

		let socket : any = null;

		const headersParamter = this.getNodeParameter('headers', {}) as {
			parameters: { name: string; value: string }[];
		};
		const headers = headersParamter.parameters.reduce(
			(prev: any, current: { name: string; value: string }) => {
				if (!current.name) return prev;
				prev[current.name] = current.value;
				return prev;
			},
			{},
		);

		// add headers from credentials
		const credentials = await this.getCredentials('websocketsApi');
		// if (this.getMode() === 'manual') console.log(JSON.stringify(credentials));
		if (credentials) {
			//credentials have object { "cookie": "cookie" }
			if ((credentials as any).cookie) {
				headers['Cookie'] = credentials.cookie;
			}
		}

		const isManual = this.getMode() === 'manual';

		let isConfirmClose = false;

		const run = async (reconnectTimes=0) => {

			socket = new WebSocket(websocketUrl, {
				headers: headers,
			});


			console.log('init trigger websocketUrl', websocketUrl, headers, this.getMode(), this.getActivationMode());

			const transformData = async (data: any) => {
				if (returnDataType === 'json') {
					return JSON.parse(data);
				}
				if (returnDataType === 'binary') {
					return this.helpers.prepareBinaryData(data);
				}
				return data.toString('utf8');
			};

			const pingData = this.getNodeParameter('pingData', '') as string;
			const pingTimerSeconds = this.getNodeParameter('pingTimerSeconds', 60) as number;
			const maxReConnectTimes = this.getNodeParameter('maxReConnectTimes', 5) as number;

			socket.on('message', async (data: any) => {
				const resultData = {
					event: 'message',
					ws: socket,
					data: await transformData(data)
				};
				this.emit([this.helpers.returnJsonArray([resultData])]);

				if (isManual){
					// 断开连接
					socket.terminate();
				}
			});

			let pingTimer: boolean | any = false;

			socket.on('open', async () => {
				const resultData = {
					event: 'open',
					ws: socket
				};
				this.emit([this.helpers.returnJsonArray([resultData])]);

				if (initData) {
					socket.send(initData);
				}
				if (pingData) {
					pingTimer = setInterval(() => {
						socket.send(pingData);
					}, pingTimerSeconds * 1000);
				}
			});

			// Handle connection errors
			socket.on('error', (error: any) => {
				if (pingTimer) {
					clearInterval(pingTimer);
				}
				console.error('WebSocket connection error', error);
				// const errorData = {
				// 	message: 'WebSocket connection error',
				// 	description: error.message,
				// };

				this.emitError(new Error('Connection got error: ' + error.message));
			});

			socket.on('close', async (code: any, reason: any) => {
				console.log('WebSocket connection closed', code);

				if (pingTimer) {
					clearInterval(pingTimer);
				}

				const resultData = {event: 'close', code};
				this.emit([this.helpers.returnJsonArray([resultData])]);

				// 手动关闭的
				if (isConfirmClose){
					console.log("confirm close");
					return;
				}

				if (maxReConnectTimes && reconnectTimes < maxReConnectTimes){
					// console.log('reconnect', reconnectTimes);
					await run(reconnectTimes + 1);
				}
			})
		}

		const closeFunction = async () => {
			if (socket) {
				isConfirmClose = true;
				console.log('closeFunction socket');
				socket.terminate();
			}
		}

		await run();

		return {
			closeFunction: closeFunction,
		};
	}
}
