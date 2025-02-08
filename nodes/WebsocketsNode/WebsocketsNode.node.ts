import {
	INodeType,
	INodeTypeDescription,
	NodeApiError,
	NodeConnectionType,
	NodeOperationError,
} from 'n8n-workflow';
import { io, Socket } from 'socket.io-client';
import { ITriggerFunctions, ITriggerResponse } from 'n8n-workflow/dist/Interfaces';

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
			},
			{
				displayName: 'Auth Token',
				name: 'token',
				type: 'string',
				default: '',
				description: 'auth token',
			},
			{
				displayName: 'Event Name',
				name: 'eventName',
				type: 'string',
				default: '',
				description: 'The name of the event to listen for',
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
		const eventName = this.getNodeParameter('eventName', '') as string;
		const token = this.getNodeParameter('token', '') as string;
		const initData = this.getNodeParameter('initData', '') as string;
		if (!websocketUrl) {
			throw new NodeOperationError(this.getNode(), '未配置websocketUrl');
		}

		const socket: Socket = io(websocketUrl, {
			reconnectionDelayMax: 10000,
			auth: {
				token: token,
			},
		});

		// Connect to the WebSocket server
		socket.connect();

		if (eventName) {
			// Listen for the specified event
			socket.on(eventName, (data: any) => {
				const resultData = { event: eventName, data };
				this.emit([this.helpers.returnJsonArray([resultData])]);
			});
		} else {
			socket.onAny((event, ...args) => {
				const resultData = { event: eventName, data: args };
				this.emit([this.helpers.returnJsonArray([resultData])]);
			});
		}

		let pingTimer : boolean | any = false;
		if (initData) {
			socket.on('connect', () => {
				socket.send(initData);

				if (pingData){
					pingTimer = setInterval(() => {
						socket.send(pingData);
					}, 5000);
				}
			});
		}

		const pingData = this.getNodeParameter('pingData', '') as string;


		// Handle connection errors
		socket.on('connect_error', (error) => {
			if (pingTimer){
				clearInterval(pingTimer);
			}
			const errorData = {
				message: 'WebSocket connection error',
				description: error.message,
			};
			throw new NodeApiError(this.getNode(), errorData);
		});

		socket.on("disconnect", (reason) => {
			if (pingTimer){
				clearInterval(pingTimer);
			}
			const errorData = {
				message: 'WebSocket Disconnect',
				description: reason,
			};
			throw new NodeApiError(this.getNode(), errorData);
		});

		return {
			closeFunction: async () => {
				if (pingTimer){
					clearInterval(pingTimer);
				}
				socket.disconnect();
			},
		};
	}
}
