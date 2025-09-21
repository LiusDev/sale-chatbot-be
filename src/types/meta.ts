export interface MetaListResponse<T> {
	data: T[]
	paging: {
		cursors: {
			before: string
			after: string
		}
	}
}

export interface MetaFanpage {
	access_token: string
	category: string
	category_list: {
		id: string
		name: string
	}[]
	name: string
	id: string
	tasks: string[]
}

export interface MetaPageConversationMessage {
	id: string
	created_time: string
	from: {
		id: string
		name: string
	}
	message: string
	attachments?: MetaListResponse<{
		id: string
		mime_type: string
		name: string
		size: number
		image_data?: {
			url: string
		}
		video_data?: {
			url: string
		}
	}>
}

export interface MetaPageConversation {
	id: string
	// participants: {
	// 	data: {
	// 		id: string
	// 		name: string
	// 	}[]
	// }
	messages?: MetaListResponse<MetaPageConversationMessage>
}
