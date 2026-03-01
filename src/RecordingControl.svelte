<script lang="ts">
	import { RecordingManager } from "./services/RecordingManager";
	import type { RecordingState } from "./services/RecordingManager";
	import { NoteWriter } from "./services/NoteWriter";

	interface Props {
		apiKey: string;
		app: App;
	}

	let { apiKey, app }: Props = $props();

	let noteWriter: NoteWriter;

	let recordingState: RecordingState = $state("idle");
	let elapsed = $state("00:00");
	let manager: RecordingManager | null = null;
	let transcriptLines: string[] = $state([]);
	// let elapsed: string = "00:00";

	// Format milliseconds as MM:SS
	function formatTime(ms: number): string {
		const seconds = Math.floor(ms / 1000);
		const minutes = Math.floor(seconds / 60);
		const remainingSeconds = seconds % 60;
		return `${minutes.toString().padStart(2, "0")}:${remainingSeconds.toString().padStart(2, "0")}`;
	}

	function toggleRecording() {
		if (recordingState === "idle") {
			startRecording();
		} else if (recordingState === "recording") {
			stopRecording();
		}
	}

	function handleTranscript(text: string, isFinal: boolean) {
		if (isFinal) {
			transcriptLines = [...transcriptLines, text];
		}
	}

	async function startRecording() {
		noteWriter = new NoteWriter(app);
		manager = new RecordingManager(apiKey);

		// Update timer every second
		const timer = setInterval(() => {
			if (manager) {
				elapsed = formatTime(manager.getElapsedTime());
			}
		}, 100);

		try {
			await manager.start({
				onStateChange: (newState) => {
					recordingState = newState;
					if (newState === "idle") {
						clearInterval(timer);
					}
				},
				onError: (error) => {
					console.error("Recording error:", error);
				},
				onTranscript: (text: string, isFinal: boolean) => {
					handleTranscript(text, isFinal);
				},
			});
		} catch (error) {
			clearInterval(timer);
			console.error("Failed to start recording:", error);
		}
	}

	async function stopRecording() {
		const transcript = manager?.getTranscript();
		if (transcript) {
			await noteWriter?.insertAtCursor(transcript);
		}
		await manager?.stop();
	}
</script>

<div class="recording-control">
	<div class="status">
		{#if recordingState === "idle"}
			<span class="status-idle">Ready</span>
		{:else if recordingState === "recording"}
			<span class="status-recording">🔴 Recording</span>
			<span class="elapsed">{elapsed}</span>
		{:else}
			<span class="status-error">Error</span>
		{/if}
	</div>

	<button
		class={recordingState === "recording" ? "btn-stop" : "btn-start"}
		onclick={toggleRecording}
		disabled={recordingState === "error"}
	>
		{#if recordingState === "idle"}
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="16"
				height="16"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
				class="lucide lucide-mic-icon lucide-mic"
				><path d="M12 19v3" /><path
					d="M19 10v2a7 7 0 0 1-14 0v-2"
				/><rect x="9" y="2" width="6" height="13" rx="3" /></svg
			>
			Start Recording
		{:else}
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="16"
				height="16"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
				class="lucide lucide-mic-off-icon lucide-mic-off"
				><path d="M12 19v3" /><path
					d="M15 9.34V5a3 3 0 0 0-5.68-1.33"
				/><path d="M16.95 16.95A7 7 0 0 1 5 12v-2" /><path
					d="M18.89 13.23A7 7 0 0 0 19 12v-2"
				/><path d="m2 2 20 20" /><path
					d="M9 9v3a3 3 0 0 0 5.12 2.12"
				/></svg
			>
			Stop Recording
		{/if}
	</button>
	<div class="transcript-box">
		{#if transcriptLines.length > 0}
			{#each transcriptLines as line}
				<div class="transcript-line">{line}</div>
			{/each}{:else}
			<div class="transcript-line-placeholder">
				Your transcript will appear here...
			</div>
		{/if}
	</div>
</div>

<style>
	.recording-control {
		display: flex;
		flex-direction: column;
		gap: 16px;
		padding: 16px;
	}

	.transcript-box {
		height: 500px;
		overflow-y: auto;
		border: 1px solid var(--status-bar-border-color);
		background-color: var(--background-primary-alt);
		border-radius: 8px;
		padding: 16px;
	}

	.transcript-line-placeholder {
		color: var(--text-muted);
		font-style: italic;
	}

	.status {
		display: flex;
		align-items: center;
		gap: 12px;
		font-size: 14px;
	}

	.status-idle {
		color: var(--text-muted);
	}

	.status-recording {
		color: var(--color-red);
		font-weight: 600;
	}

	.status-error {
		color: var(--color-orange);
	}

	.elapsed {
		font-family: monospace;
		font-size: 16px;
	}

	button {
		padding: 12px 16px;
		border-radius: 8px;
		border: none;
		font-size: 14px;
		font-weight: 600;
		cursor: pointer;
		display: flex;
		align-items: center;
		gap: 8px;
		transition: all 0.2s;
	}

	.btn-start {
		background: var(--interactive-accent);
		color: var(--text-on-accent);
	}

	.btn-start:hover {
		background: var(--interactive-accent-hover);
	}

	.btn-stop {
		background: var(--color-red);
		color: white;
	}

	.btn-stop:hover {
		background: rgba(var(--color-red-rgb), 0.8);
	}

	button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	/* Mobile-specific adjustments */
	@media (max-width: 768px) {
		.recording-control {
			padding: 12px;
		}

		button {
			padding: 16px 20px;
			font-size: 16px;
		}
	}
</style>
