export class AudioRecorder {
	private mediaRecorder: MediaRecorder | null = null;
	private stream: MediaStream | null = null;
	private onChunk?: (chunk: Blob) => void;

	constructor() {
		// No dependencies needed yet
	}

	async start(onChunk: (chunk: Blob) => void): Promise<void> {
		this.onChunk = onChunk;

		// Get microphone access
		this.stream = await navigator.mediaDevices.getUserMedia({
			audio: true,
		});

		// Log audio track information
		const audioTrack = this.stream.getAudioTracks()[0];
		if (!audioTrack) {
			throw new Error("No audio track found in media stream");
		}
		const settings = audioTrack.getSettings();
		console.log("AudioRecorder: Stream obtained", {
			trackLabel: audioTrack.label,
			trackEnabled: audioTrack.enabled,
			trackMuted: audioTrack.muted,
			sampleRate: settings.sampleRate,
			channelCount: settings.channelCount,
			deviceId: settings.deviceId,
		});

		// Create recorder
		this.mediaRecorder = new MediaRecorder(this.stream);

		// Hook up chunk handler
		this.mediaRecorder.ondataavailable = (event) => {
			if (event.data.size > 0 && this.onChunk) {
				console.log(
					`Audio chunk: ${event.data.size} bytes, type: ${event.data.type}`,
				);
				this.onChunk(event.data);
			}
		};

		// Start recording
		this.mediaRecorder.start(250); // 250ms chunks
		console.debug("AudioRecorder: Started recording");
	}

	stop(): void {
		if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") {
			this.mediaRecorder.stop();
			console.debug("AudioRecorder: Stopped recording");
		}

		if (this.stream) {
			this.stream.getTracks().forEach((track) => track.stop());
			this.stream = null;
		}
	}
}
