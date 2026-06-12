export type AiWritingBuddyVisibleMemoryContext = {
	filePath: string;
	content: string;
	wasTruncated: boolean;
};

export type AiWritingBuddyUsedMemory = {
	filePath: string;
	wasTruncated: boolean;
};

export type AiWritingBuddyManagedMemoryBlock = {
	filePath: string;
	content: string;
};

export type AiWritingBuddyManagedMemoryWriteResult = "updated" | "missing" | "markers-missing" | "changed";
