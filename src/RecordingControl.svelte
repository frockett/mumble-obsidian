<script lang="ts">
	import { RecordingManager } from "./services/RecordingManager";
	import type { RecordingState } from "./services/RecordingManager";

	interface Props {
		apiKey: string;
	}

	let { apiKey }: Props = $props();

	let recordingState: RecordingState = $state("idle");
	let elapsed = $state("00:00");
	let manager: RecordingManager | null = null;
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

	async function startRecording() {
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
			});
		} catch (error) {
			clearInterval(timer);
			console.error("Failed to start recording:", error);
		}
	}

	async function stopRecording() {
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
			<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
				<path
					d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3s3 1.34 3 3v6c0 1.66 1.34 3 3 3s3-1.34 3-3V8c0-1.66-1.34-3-3-3s-3 1.34-3 3v4zm0 2c.55 0 1 .45 1 1s-.45 1-1 1-1-.55 0-1-.45-1-1s.45-1 1-1 1c.55 0 1 .45 1 1s-.45 1-1 1-1-.55 0-1-.45-1-1s.45-1 1-1 1z"
				/>
			</svg>
			Start Recording
		{:else}
			<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
				<rect x="6" y="6" width="12" height="12" rx="2" />
			</svg>
			Stop Recording
		{/if}
	</button>
</div>

<style>
	.recording-control {
		display: flex;
		flex-direction: column;
		gap: 16px;
		padding: 16px;
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
		background: var(--color-red-1);
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
