// Generate state for OAuth
export function generateState(): string {
	return crypto.randomUUID()
}
