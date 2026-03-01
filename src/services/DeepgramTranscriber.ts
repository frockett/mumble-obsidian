import { createClient, LiveTranscriptionEvents } from "@deepgram/sdk";

export class DeepgramTranscriber {
	private apiKey: string;
	private connection: any; // Deepgram LiveConnection
	private onTranscript?: (text: string, isFinal: boolean) => void;

	constructor(apiKey: string) {
		this.apiKey = apiKey;
	}

	async start(
		onTranscript: (text: string, isFinal: boolean) => void,
	): Promise<void> {
		this.onTranscript = onTranscript;

		// 1. Create Deepgram client
		const deepgram = createClient(this.apiKey);

		// 2. Create live transcription connection
		this.connection = deepgram.listen.live({
			model: "nova-3",
			language: "en",
			smart_format: true,
			interim_results: true, // Get partial results while speaking
			utterance_end_ms: 1000, // 1 second of silence ends utterance
		});

		// 3. Set up event handlers
		this.connection.on(LiveTranscriptionEvents.Open, () => {
			console.log("DeepgramTranscriber: Connection opened");
		});

		this.connection.on(LiveTranscriptionEvents.Transcript, (data: any) => {
			const transcript = data.channel?.alternatives?.[0]?.transcript;
			const isFinal = data.is_final;

			if (transcript && this.onTranscript) {
				console.log(
					`DeepgramTranscriber: ${isFinal ? "FINAL" : "INTERIM"}: "${transcript}"`,
				);
				this.onTranscript(transcript, isFinal);
			}
		});

		this.connection.on(LiveTranscriptionEvents.Error, (error: any) => {
			console.error("DeepgramTranscriber: Error", error);
		});

		this.connection.on(LiveTranscriptionEvents.Close, () => {
			console.log("DeepgramTranscriber: Connection closed");
		});
	}

	sendAudioChunk(chunk: Blob): void {
		if (this.connection) {
			this.connection.send(chunk);
		}
	}

	stop(): void {
		if (this.connection) {
			this.connection.requestClose();
		}
	}
}
