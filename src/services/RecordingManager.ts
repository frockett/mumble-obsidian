import { AudioRecorder } from "./AudioRecorder";
import { DeepgramTranscriber } from "./DeepgramTranscriber";
import { requestUrl } from "obsidian";

export type RecordingState =
	| "idle"
	| "connecting"
	| "recording"
	| "processing"
	| "error";

export interface RecordingCallbacks {
	onTranscript?: (text: string, isFinal: boolean) => void;
	onStateChange?: (state: RecordingState) => void;
	onError?: (error: Error) => void;
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

	async getFormattedTranscript(): Promise<string> {
		const raw = this.transcriptBuffer.join(" ");

		if (this.llmApiKey && raw.trim()) {
			try {
				this.state = "processing";
				this.callbacks.onStateChange?.("processing");
				const formatted = await this.formatWithLLM(raw);

				// Set back to idle when done
				this.state = "idle";
				this.callbacks.onStateChange?.("idle");

				return formatted;
			} catch (error) {
				console.error(
					"LLM formatting failed, using raw transcript:",
					error,
				);
				this.state = "idle";
				this.callbacks.onStateChange?.("idle");
				return raw; // Fallback to raw if LLM fails
			}
		}
		return raw;
	}

	async formatWithLLM(text: string): Promise<string> {
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
						content:
							"You are a text formatter. Format this transcript with proper paragraph breaks and markdown. Keep ALL the content exactly as spoken. Remove filler words like 'ah' and 'um' but DO NOT remove anything semantically meaningful. DO NOT add any introductions, summaries, explanations, or descriptions that were not in the original. You may add headings to organize the paragraphs. You should organize into paragraphs and use markdown formatting like lists, headers, or bold text to improve readability.",
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
						schema: {
							type: "object",
							properties: {
								markdown: {
									type: "string",
									description: "City or location name",
								},
							},
							required: ["markdown"],
							additionalProperties: false,
						},
					},
				},
			}),
		});

		const data = response.json;
		const responseContent = data.choices[0].message.content;
		const parsed = JSON.parse(responseContent);

		return parsed.markdown;
	}
}
