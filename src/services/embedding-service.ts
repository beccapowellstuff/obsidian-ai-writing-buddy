import type { AiWritingBuddySettings } from "../config/default-settings";

type EmbeddingResponse = {
	data?: Array<{
		embedding?: number[];
		index?: number;
	}>;
};

export type EmbeddingServiceResult = {
	model: string;
	embeddings: number[][];
	dimension: number;
};

export class EmbeddingService {
	private readonly batchSize = 24;

	constructor(private readonly settings: AiWritingBuddySettings) {}

	isConfigured(): boolean {
		return this.getEmbeddingModel().length > 0 && this.getBaseUrl().length > 0;
	}

	getEmbeddingModel(): string {
		return this.settings.embeddingModelName.trim();
	}

	async embedTexts(texts: string[]): Promise<EmbeddingServiceResult> {
		const model = this.getEmbeddingModel();

		if (!model) {
			throw new Error("Embedding model is not configured.");
		}

		const embeddings: number[][] = [];

		for (let index = 0; index < texts.length; index += this.batchSize) {
			const batch = texts.slice(index, index + this.batchSize);
			const batchEmbeddings = await this.requestEmbeddingBatch(batch, model);

			embeddings.push(...batchEmbeddings);
			await this.yieldToUi();
		}

		const dimension = embeddings[0]?.length ?? 0;

		if (dimension === 0 || embeddings.some((embedding) => embedding.length !== dimension)) {
			throw new Error("Embedding provider returned invalid vector dimensions.");
		}

		return {
			model,
			embeddings,
			dimension,
		};
	}

	async testConnection(): Promise<string> {
		const result = await this.embedTexts(["AI Writing Buddy embedding connection test."]);

		return `Embedding connection succeeded. Dimension: ${result.dimension}.`;
	}

	private async requestEmbeddingBatch(texts: string[], model: string): Promise<number[][]> {
		const baseUrl = this.getBaseUrl();

		if (!baseUrl) {
			throw new Error("Embedding server address is required.");
		}

		const headers: Record<string, string> = {
			"Content-Type": "application/json",
		};
		const apiKey = this.getApiKey();

		if (apiKey) {
			headers.Authorization = `Bearer ${apiKey}`;
		}

		const response = await window.fetch(`${baseUrl}/embeddings`, {
			method: "POST",
			headers,
			body: JSON.stringify({
				model,
				input: texts,
			}),
		});

		if (response.status < 200 || response.status >= 300) {
			throw new Error(`Embedding request failed with status ${response.status}.`);
		}

		const data = (await response.json()) as EmbeddingResponse;
		const rows = data.data ?? [];
		const embeddings = rows
			.slice()
			.sort((left, right) => (left.index ?? 0) - (right.index ?? 0))
			.map((row) => row.embedding)
			.filter((embedding): embedding is number[] => Array.isArray(embedding));

		if (embeddings.length !== texts.length) {
			throw new Error("Embedding provider returned an unexpected number of vectors.");
		}

		return embeddings;
	}

	private getBaseUrl(): string {
		return (this.settings.embeddingBaseUrl.trim() || this.settings.baseUrl.trim()).replace(/\/$/, "");
	}

	private getApiKey(): string {
		return this.settings.embeddingApiKey.trim() || this.settings.apiKey.trim();
	}

	private async yieldToUi(): Promise<void> {
		await new Promise<void>((resolve) => {
			window.setTimeout(resolve, 0);
		});
	}
}
