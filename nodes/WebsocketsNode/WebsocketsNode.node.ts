import {
	INodeType,
	INodeTypeDescription,
	NodeConnectionType,
	NodeOperationError,
} from 'n8n-workflow';
import { ITriggerFunctions, ITriggerResponse } from 'n8n-workflow/dist/Interfaces';
// @ts-ignore
import WebSocket from 'ws';

export class WebsocketsNode implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Websockets Node',
		name: 'websocketsNode',
		group: ['trigger'],
		version: 1,
		description: 'Basic Websockets Node using Socket.io',
		defaults: {
			name: 'Websockets Node',
		},
		inputs: [NodeConnectionType.Main],
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
			// {
			// 	displayName: 'Auth Token',
			// 	name: 'token',
			// 	type: 'string',
			// 	default: '',
			// 	description: 'auth token',
			// },
			// {
			// 	displayName: 'Event Name',
			// 	name: 'eventName',
			// 	type: 'string',
			// 	default: '',
			// 	description: 'The name of the event to listen for',
			// },
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
				description: '返回的数据格式',
			},
			{
				displayName: 'Init Send Data',
				name: 'initData',
				type: 'string',
				default: '',
				description: '链接成功后初始化发送的消息，如token等，为空不发送',
			},
			{
				displayName: 'Ping Data',
				name: 'pingData',
				type: 'string',
				default: '',
				description: '定时心跳数据，为空不发送',
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

		const socket = new WebSocket(websocketUrl, {});

		console.log('init trigger websocketUrl', websocketUrl);

		const transformData = async (data: any) => {
			if (returnDataType === 'json') {
				return JSON.parse(data);
			}
			if (returnDataType === 'binary') {
				return this.helpers.prepareBinaryData(data);
			}
			return data.toString("utf8");
		}

		socket.on('message', async (data: any) => {
			const resultData = {event: 'message', data: await transformData(data)};
			this.emit([this.helpers.returnJsonArray([resultData])]);
		});

		let pingTimer: boolean | any = false;

		socket.on('open', () => {
			const resultData = { event: 'open' };
			this.emit([this.helpers.returnJsonArray([resultData])]);

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
			const errorData = {
				message: 'WebSocket connection error',
				description: error.message,
			};
			throw new NodeOperationError(this.getNode(), errorData);
		});

		return {
			closeFunction: async () => {
				if (pingTimer) {
					clearInterval(pingTimer);
				}
				socket.close();
			},
		};
	};

}
