<script lang="ts">
	import { RecordingManager } from "./services/RecordingManager";
	import type {
		RecordingState,
		FormattedTranscriptResponse,
	} from "./services/RecordingManager";
	import { NoteWriter } from "./services/NoteWriter";
	import type { MyPluginSettings } from "./settings";

	interface Props {
		app: App;
		settings: MyPluginSettings;
	}

	let { app, settings }: Props = $props();

	let noteWriter: NoteWriter;

	let recordingState: RecordingState = $state("idle");
	let elapsed = $state("00:00");
	let manager: RecordingManager | null = null;
	let currentTranscript: string = $state("");
	let timer: number | null = null;

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
			currentTranscript = currentTranscript + " " + text;
		}
	}

	async function startRecording() {
		noteWriter = new NoteWriter(app);
		if (settings.enableLLMPostProcessing) {
			manager = new RecordingManager(
				settings.deepgramApiKey,
				app,
				settings.openRouterApiKey,
			);
		} else {
			manager = new RecordingManager(settings.deepgramApiKey, app);
		}

		try {
			await manager.start({
				onStateChange: (newState) => {
					recordingState = newState;

					if (newState === "recording") {
						// Start timer only when actually recording
						timer = window.setInterval(() => {
							if (manager) {
								elapsed = formatTime(manager.getElapsedTime());
							}
						}, 100);
					} else {
						// Stop timer when not recording
						if (timer) {
							clearInterval(timer);
							timer = null;
						}
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
			console.error("Failed to start recording:", error);
		}
	}

	async function stopRecording() {
		await manager?.stop();
		let transcript;
		let tags;
		let title;
		if (settings.enableLLMPostProcessing) {
			const formattedResponse: FormattedTranscriptResponse =
				await manager?.getFormattedTranscript(
					settings.includeKeywordLinks,
				);

			title = formattedResponse.title;
			transcript = formattedResponse.transcript;
			tags = formattedResponse.tags;

			console.log("TRANSCRIPT TO WRITE: ", transcript);
			console.log("TAGS: ", tags);
		} else {
			transcript = manager?.getTranscript();
		}

		// We need to write the transcript BEFORE we write the tags.
		// It's not 100% clear why, but it seems there is some kind of RACE condition
		// created by the way that processFrontMatter() in addTagsToNote() behaves
		// WRT reading the file from disk and then reloading it after changes.
		// Writing Tags first and then writing the transcript deletes the tags.

		if (transcript) {
			console.log("WE HAVE TRANSCRIPT");
			await noteWriter?.insertAtCursor(transcript);
		}

		if (tags) {
			await noteWriter?.addTagsToNote(tags);
		}

		await noteWriter?.addDateToNote();

		if (title) {
			await noteWriter?.updateTitle(title);
		}

		currentTranscript = "";
	}
</script>

<div class="recording-control">
	<button
		class={recordingState === "recording" ? "btn-stop" : "btn-start"}
		onclick={toggleRecording}
		disabled={recordingState === "error" || recordingState === "processing"}
	>
		{#if recordingState === "idle"}
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="24"
				height="24"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="1.5"
				stroke-linecap="round"
				stroke-linejoin="round"
				class="lucide lucide-mic-icon lucide-mic"
				><path d="M12 19v3" /><path
					d="M19 10v2a7 7 0 0 1-14 0v-2"
				/><rect x="9" y="2" width="6" height="13" rx="3" /></svg
			>
			Start
		{:else if recordingState == "connecting"}
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="24"
				height="24"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="1.5"
				stroke-linecap="round"
				stroke-linejoin="round"
				class="lucide lucide-loader-circle-icon lucide-loader-circle animate-spin"
				><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg
			>
			Connecting
		{:else if recordingState == "processing"}
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="24"
				height="24"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="1.5"
				stroke-linecap="round"
				stroke-linejoin="round"
				class="lucide lucide-loader-circle-icon lucide-loader-circle animate-spin"
				><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg
			>
			Processing
		{:else}
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="24"
				height="24"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="1.5"
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
			Stop
		{/if}
	</button>
	<div class="status">
		{#if recordingState === "idle"}
			<span class="status-idle">Ready</span>
		{:else if recordingState === "connecting"}
			<span class="status-connecting">Connecting...</span>
		{:else if recordingState === "recording"}
			<span class="status-recording">🔴 </span>
			<span class="elapsed">{elapsed}</span>
		{:else if recordingState === "processing"}
			<span class="status-connecting">Processing...</span>
		{:else}
			<span class="status-error">Error</span>
		{/if}
	</div>
	<div class="preview-container">
		<button
			class="clear-transcript-btn"
			aria-label="Clear transcript preview"
			onclick={() => {
				currentTranscript = "";
			}}
		>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="20"
				height="20"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="1.5"
				stroke-linecap="round"
				stroke-linejoin="round"
				class="lucide lucide-x-icon lucide-x"
				><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg
			>
		</button>
		<div class="transcript-box">
			{#if currentTranscript.length > 0}
				<div class="transcript-line">{currentTranscript}</div>
			{:else}
				<div class="transcript-line-placeholder">
					Transcript preview will appear here...
				</div>
			{/if}
		</div>
	</div>
</div>

<style>
	.recording-control {
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
		gap: 1.5rem;
		padding: 16px;
		height: 100%;
	}

	.transcript-box {
		height: 12rem;
		overflow-y: auto;
		border: 1px solid var(--status-bar-border-color);
		background-color: var(--background-primary-alt);
		border-radius: 8px;
		padding: 16px;
		width: 100%;
	}

	.preview-container {
		position: relative;
	}

	button.clear-transcript-btn {
		position: absolute;
		top: 2px;
		right: 2px;
		cursor: pointer;
		background-color: transparent;
		border-color: transparent;
		outline: none;
		border: none;
		padding: 0;
		background: none;
		margin: 0;
	}

	.transcript-line-placeholder {
		color: var(--text-muted);
		font-style: italic;
	}

	.status {
		display: flex;
		align-items: center;
		justify-content: center;
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

	.status-connecting {
		color: var(--text-accent);
		font-weight: 600;
	}

	.elapsed {
		font-family: monospace;
		font-size: 16px;
	}

	button:not(.clear-transcript-btn) {
		padding: 4px;
		border-radius: 50%;
		border: none;
		font-size: 14px;
		font-weight: 600;
		cursor: pointer;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 12px;
		transition: all 0.2s;
		height: 8rem;
		width: 8rem;
		margin: 0 auto;
		position: relative;
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

	@keyframes spin {
		from {
			transform: rotate(0deg);
		}
		to {
			transform: rotate(360deg);
		}
	}

	.animate-spin {
		animation: spin 1s ease-in-out infinite;
	}

	.btn-stop::before {
		content: "";
		position: absolute;
		inset: -6px;
		border-radius: 50%;
		border-top: 2px solid var(--color-orange);
		animation: spin 1.5s ease-in-out infinite;
	}

	/*.animate-spin {
		animation: spin 1s linear infinite;
	}*/

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
