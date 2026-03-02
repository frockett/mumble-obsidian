import { AudioRecorder } from "./AudioRecorder";
import { DeepgramTranscriber } from "./DeepgramTranscriber";
import { requestUrl, App, getAllTags } from "obsidian";

export type RecordingState =
	| "idle"
	| "connecting"
	| "recording"
	| "processing"
	| "error";

// Interface for defining keyword matches and getting info for sorting.
export interface KeywordMatch {
	path: string;
	basename: string;
	keyword: string;
	matchCount: number;
	inTitle: boolean;
	inTags: boolean;
}

export interface RecordingCallbacks {
	onTranscript?: (text: string, isFinal: boolean) => void;
	onStateChange?: (state: RecordingState) => void;
	onError?: (error: Error) => void;
}

export interface FormattedTranscriptResponse {
	transcript: string;
	tags: string[];
}

// Used to parse the json response from the LLM API
interface LLMFormattedResponse {
	markdown: string;
	keywords: string[];
	tags: string[];
}

function escapeRegex(str: string): string {
	return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export class RecordingManager {
	private transcriptBuffer: string[] = [];
	private state: RecordingState = "idle";
	private recorder: AudioRecorder | null = null;
	private transcriber: DeepgramTranscriber | null = null;
	private startTime: number = 0;
	private callbacks: RecordingCallbacks = {};

	constructor(
		private apiKey: string,
		private app: App,
		private llmApiKey?: string | null,
	) {}

	getState(): RecordingState {
		return this.state;
	}

	getElapsedTime(): number {
		return this.startTime > 0 ? Date.now() - this.startTime : 0;
	}

	async start(callbacks: RecordingCallbacks): Promise<void> {
		if (this.state !== "idle") {
			throw new Error(
				`Cannot start recording, current state: ${this.state}`,
			);
		}

		try {
			this.state = "connecting";
			this.startTime = Date.now();
			this.callbacks = callbacks;
			this.callbacks.onStateChange?.("connecting");

			this.recorder = new AudioRecorder();
			this.transcriber = new DeepgramTranscriber(this.apiKey);

			// Start transcriber first (waits for connection)
			await this.transcriber.start((text, isFinal) => {
				this.callbacks.onTranscript?.(text, isFinal);
				// Only capture final transcripts with proper punctuation
				if (isFinal) {
					this.transcriptBuffer.push(text);
				}
			});

			// Now start recording (after connection is ready)
			this.state = "recording";
			this.callbacks.onStateChange?.("recording");

			await this.recorder.start((chunk) => {
				this.transcriber?.sendAudioChunk(chunk);
			});
		} catch (error) {
			this.state = "error";
			this.callbacks.onError?.(error as Error);
			this.callbacks.onStateChange?.("error");
			throw error;
		}
	}

	getTranscript(): string {
		return this.transcriptBuffer.join(" ");
	}

	async stop(): Promise<void> {
		// Always attempt to stop, regardless of current state
		// This handles sync delays between devices and ensures cleanup happens
		this.recorder?.stop();
		this.transcriber?.stop();

		this.recorder = null;
		this.transcriber = null;

		// Only update state if we're actually recording or processing
		// Don't override "error" state if we're in it
		if (this.state === "recording" || this.state === "processing") {
			this.state = "idle";
			this.callbacks.onStateChange?.("idle");
		}
	}

	async getFormattedTranscript(
		includeKeywords: boolean,
	): Promise<FormattedTranscriptResponse> {
		const raw = this.transcriptBuffer.join(" ");

		if (this.llmApiKey && raw.trim()) {
			// Basic strategy here is that we create a string and keep accumulating it as we go,
			// adding the keywords if the option is enabled in settings. This the callsite just has to pass
			// the resulting string to the writer.
			try {
				let mdToWrite: string;
				this.state = "processing";
				this.callbacks.onStateChange?.("processing");
				const processed = await this.formatWithLLM(raw);

				mdToWrite = processed.markdown;

				if (includeKeywords) {
					const matches = await this.searchVault(
						processed.keywords,
						processed.tags,
					);
					if (matches.length > 0) {
						mdToWrite += "\n\n---\n## Related Notes\n\n";
						for (const match of matches) {
							mdToWrite += `- [[${match.path}|${match.basename}]] - Keyword: ${match.keyword} - Match Count: ${match.matchCount} - In Title: ${match.inTitle}\n`;
						}
					}
				}

				// Set back to idle when done
				this.state = "idle";
				this.callbacks.onStateChange?.("idle");

				return { transcript: mdToWrite, tags: processed.tags };
			} catch (error) {
				console.error(
					"LLM formatting failed, using raw transcript:",
					error,
				);
				this.state = "idle";
				this.callbacks.onStateChange?.("idle");
				return { transcript: raw, tags: [] };
			}
		}
		// We just want the raw transcript if there is no API key
		return { transcript: raw, tags: [] };
	}

	async searchVault(
		keywords: string[],
		generatedTags: string[],
	): Promise<KeywordMatch[]> {
		const files = this.app.vault.getMarkdownFiles();
		const results: KeywordMatch[] = [];

		for (const file of files) {
			try {
				// We get the file's content and make it all lowercase for easier search.
				const content = await this.app.vault.cachedRead(file);
				const lowerContent = content.toLowerCase();

				// AFAIK this is the best/only way to get the tags, but this is pretty poorly documented
				// in the Obsidian API documentation
				const cache = this.app.metadataCache.getFileCache(file);
				const fileTags = cache ? getAllTags(cache) : [];

				for (const tag of generatedTags) {
					if (fileTags?.contains(tag)) {
						results.push({
							path: file.path,
							basename: file.basename,
							keyword: tag,
							matchCount: 1,
							inTitle: false,
							inTags: true,
						});
					}
				}

				for (const keyword of keywords) {
					// case insensitive, word boundaries accounted for, and find all matches in the document
					const regex = new RegExp(
						`\\b${escapeRegex(keyword)}\\b`,
						"gi",
					);
					const matches = lowerContent.match(regex);

					if (matches) {
						const count = matches.length;
						// Check title for substring matches, e.g. "rice" matches the title "Rice Pudding Pie"
						const inTitle = new RegExp(
							escapeRegex(keyword),
							"i",
						).test(file.basename);

						results.push({
							path: file.path,
							basename: file.basename,
							keyword,
							matchCount: count,
							inTitle,
							inTags: false,
						});
					}
				}
			} catch (error) {
				console.error(`Error searching ${file.path}:`, error);
			}
		}

		const unique = new Map<string, KeywordMatch>();

		// Remove duplicate paths from results
		results.forEach((r) => unique.set(r.path, r));

		// Filter results to include only matches with count >= 2 or inTitle or inTags.
		// We prioritize inTags since hopefully this will surface more conceptually relevant results.
		// This solution should net relatively good results without too much trickery,
		// but it might be worth exploring keyword proximity later if results are still messy or too irrelevant.
		return Array.from(unique.values())
			.filter((r) => r.matchCount >= 2 || r.inTitle || r.inTags)
			.sort((a, b) => {
				if (a.inTags && !b.inTags) return -1;
				if (!a.inTags && b.inTags) return 1;
				if (a.inTitle && !b.inTitle) return -1;
				if (!a.inTitle && b.inTitle) return 1;
				return a.matchCount - b.matchCount;
			})
			.slice(0, 8);
	}

	async formatWithLLM(text: string): Promise<LLMFormattedResponse> {
		// Right now I just use OpenRouter, since we can make a direct request using Obsidian's requestUrl(),
		// to make this more flexible this should be rewritten to use OpenAI's sdk, since basically all LLM providers accept it.
		const response = await requestUrl({
			url: "https://openrouter.ai/api/v1/chat/completions",
			method: "POST",
			headers: {
				Authorization: `Bearer ${this.llmApiKey}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				model: "google/gemini-2.5-flash-lite-preview-09-2025",
				messages: [
					{
						role: "system",
						content: `You are a text formatter. Format this transcript with proper paragraph breaks and markdown. Keep ALL content exactly as spoken. Remove filler words like 'ah' and 'um' but DO NOT remove anything semantically meaningful. DO NOT add any introductions, summaries, explanations, or descriptions that were not in the original. You may add headings to organize the paragraphs. You may use markdown formatting like lists, headers, or bold text to improve readability.

						Return up to 8 specific, contextual keywords that would help find relevant notes. Focus on: topics, people, places, concepts, specific items, techniques, or themes. Avoid generic words like "made", "the", "improve", or "research". Instead, return meaningful single words or short phrases that relate closely to the topic of the transcript.

						Additionally, return a list of up to 3 conceptual tags related to the topic. Tags should be short, preferably one word each. Tags should be specific to the overall topic of the transcript.`,
					},
					{
						role: "user",
						content: text,
					},
				],
				response_format: {
					type: "json_schema",
					json_schema: {
						name: "formatted_note",
						strict: true,
						// Retrieve formatted, keywords, and tags, since we don't always use keywords and tags
						// but the overhead of generating them is negligible and this saves us writing multiple nearly
						// identical calls.
						schema: {
							type: "object",
							properties: {
								markdown: {
									type: "string",
									description:
										"the formatted markdown content",
								},
								keywords: {
									type: "array",
									items: {
										type: "string",
									},
									description:
										"an array of up to 8 keywords found in the note",
								},
								tags: {
									type: "array",
									items: {
										type: "string",
									},
									description:
										"Categorical tags for frontmatter (max 3). If longer than a single word, use kebab-case.",
								},
							},
							required: ["markdown", "keywords", "tags"],
							additionalProperties: false,
						},
					},
				},
			}),
		});

		const data = response.json;
		const responseContent = data.choices[0].message.content;

		// In case I forget, LLMFormattedReseponse is an interface defined at the top of this file.
		const parsed = JSON.parse(responseContent) as LLMFormattedResponse;

		console.log("KEYWORDS: ", parsed.keywords);

		return parsed;
	}
}
