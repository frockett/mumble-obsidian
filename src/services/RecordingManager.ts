import { AudioRecorder } from "./AudioRecorder";
import { DeepgramTranscriber } from "./DeepgramTranscriber";

export type RecordingState = "idle" | "recording" | "error";

export interface RecordingCallbacks {
	onTranscript?: (text: string, isFinal: boolean) => void;
	onStateChange?: (state: RecordingState) => void;
	onError?: (error: Error) => void;
}

export class RecordingManager {
	private state: RecordingState = "idle";
	private recorder: AudioRecorder | null = null;
	private transcriber: DeepgramTranscriber | null = null;
	private startTime: number = 0;
	private callbacks: RecordingCallbacks = {};

	constructor(private apiKey: string) {}

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
			this.state = "recording";
			this.startTime = Date.now();
			this.callbacks = callbacks;
			this.callbacks.onStateChange?.("recording");

			this.recorder = new AudioRecorder();
			this.transcriber = new DeepgramTranscriber(this.apiKey);

			// Start transcriber first (waits for connection)
			await this.transcriber.start((text, isFinal) => {
				this.callbacks.onTranscript?.(text, isFinal);
			});

			// Start recording and stream to transcriber
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

	async stop(): Promise<void> {
		if (this.state !== "recording") {
			return;
		}

		this.recorder?.stop();
		this.transcriber?.stop();

		this.recorder = null;
		this.transcriber = null;
		this.state = "idle";
		this.callbacks.onStateChange?.("idle");
	}
}
