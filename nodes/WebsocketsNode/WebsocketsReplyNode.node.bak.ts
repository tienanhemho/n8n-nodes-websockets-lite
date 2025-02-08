import {
	INodeType,
	INodeTypeDescription,
	NodeConnectionType,
	NodeOperationError
} from 'n8n-workflow';
import { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow/dist/Interfaces';
// @ts-ignore
import WebSocket from 'ws';

export class WebsocketsReplyNode implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Websockets Reply Node',
		name: 'websocketsReplyNode',
		group: ['transform'],
		version: 1,
		description: 'Websockets Reply',
		defaults: {
			name: 'Websockets Reply Node',
		},
		inputs: [NodeConnectionType.Main],
		outputs: [NodeConnectionType.Main],
		properties: [
			{
				displayName: 'Reply Content',
				name: 'replyContent',
				type: 'string',
				default: '',
			},
		],
	};

	// @ts-ignore
	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		// 处理响应
		const connectedNodes = this.getParentNodes("WebsocketsNode");
		if (!connectedNodes){
			throw new NodeOperationError(
				this.getNode(),
				new Error('No Websocket node found in the workflow'),
				{
					description:
						'Insert a Websocket node to your workflow and set the “Respond” parameter to “Using Respond to Websocket Node” ',
				},
			);
		}

		const replyContent = this.getNodeParameter('replyContent', 0) as string;

		this.sendResponse({
			content: replyContent
		})

		return [[]]
	}
}
