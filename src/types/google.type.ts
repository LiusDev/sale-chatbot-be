export interface GoogleProfile {
	id: string
	email: string
	name: string
	picture: string
	verified_email: boolean
}

export interface GoogleOAuthState {
	redirect_uri: string
	value: string
}
