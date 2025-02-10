import {
	INodeType,
	INodeTypeDescription,
	NodeConnectionType,
	NodeOperationError,
} from 'n8n-workflow';
import {
	IExecuteResponsePromiseData,
	ITriggerFunctions,
	ITriggerResponse,
} from 'n8n-workflow/dist/Interfaces';
// @ts-ignore
import WebSocket from 'ws';

export class WebsocketsTriggerNode implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Websockets Node',
		name: 'websocketsNode',
		group: ['trigger'],
		version: 1,
		description: 'Websockets Node',
		defaults: {
			name: 'Websockets Node',
		},
		inputs: [],
		outputs: [NodeConnectionType.Main],
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
						name: 'string',
						value: 'string',
					},
					{
						name: 'json',
						value: 'json',
					},
					{
						name: 'binary',
						value: 'binary',
					},
				],
				default: 'string',
				description: 'returned data format.',
			},
			{
				displayName: 'Init Send Data',
				name: 'initData',
				type: 'string',
				default: '',
				description:
					'initialize the message to be sent after the link is successful, such as token, if it is empty, it will not be sent.',
			},
			{
				displayName: 'Ping Data',
				name: 'pingData',
				type: 'string',
				default: '',
				description: 'timing heartbeat data, if it is empty, it will not be sent.',
			},
		],
	};

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

		const run = async () => {
			socket = new WebSocket(websocketUrl, {
				headers: headers,
			});

			console.log('init trigger websocketUrl', websocketUrl, headers);

			const transformData = async (data: any) => {
				if (returnDataType === 'json') {
					return JSON.parse(data);
				}
				if (returnDataType === 'binary') {
					return this.helpers.prepareBinaryData(data);
				}
				return data.toString('utf8');
			};

			const creatreResponsePromise = async () => {
				const responsePromise = await this.helpers.createDeferredPromise<IExecuteResponsePromiseData>();

				// @ts-ignore
				responsePromise.promise.then((data) => {
					console.log('responsePromise send', data);
					socket.send(data.content);
				});

				return responsePromise;
			}


			socket.on('message', async (data: any) => {
				const resultData = { event: 'message', data: await transformData(data) };
				this.emit([this.helpers.returnJsonArray([resultData])], await creatreResponsePromise());
			});

			let pingTimer: boolean | any = false;

			socket.on('open', async () => {
				const resultData = {event: 'open'};
				this.emit([this.helpers.returnJsonArray([resultData])], await creatreResponsePromise());

				if (initData) {
					socket.send(initData);
				}
				if (pingData) {
					pingTimer = setInterval(() => {
						socket.send(pingData);
					}, 5000);
				}
			});

			const pingData = this.getNodeParameter('pingData', '') as string;

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
				if (pingTimer) {
					clearInterval(pingTimer);
				}

				const resultData = {event: 'close', code, reason};
				this.emit([this.helpers.returnJsonArray([resultData])], await creatreResponsePromise());
			})
		}

		const closeFunction = async () => {
			if (socket) {
				socket.close();
			}
		}

		await run();

		return {
			closeFunction: closeFunction,
			manualTriggerFunction: run,
		};
	}
}
