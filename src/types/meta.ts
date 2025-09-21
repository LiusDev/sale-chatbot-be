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

export interface MetaFanpageList {
	data: MetaFanpage[]
	paging: {
		cursors: {
			before: string
			after: string
		}
	}
}
