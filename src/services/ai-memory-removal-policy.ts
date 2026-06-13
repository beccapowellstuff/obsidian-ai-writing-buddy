export class AiMemoryRemovalPolicy {
	allowsRemoval(userMessage: string): boolean {
		return /\b(forget|remove|delete|clear|clean up|cleanup|prune|drop|stop remembering|no longer remember|no longer true|was wrong|replace the old)\b/i.test(userMessage);
	}
}
