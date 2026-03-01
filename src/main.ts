import {
	App,
	Editor,
	MarkdownView,
	Modal,
	Notice,
	Plugin,
	ItemView,
	WorkspaceLeaf,
} from "obsidian";
import { AudioRecorder } from "./services/AudioRecorder";
import { DeepgramTranscriber } from "./services/DeepgramTranscriber";
import { RecordingManager } from "services/RecordingManager";
import RecordingControl from "./RecordingControl.svelte";
import { DEFAULT_SETTINGS, SampleSettingTab } from "./settings";
import type { MyPluginSettings } from "./settings";
import { mount, unmount } from "svelte";

// Remember to rename these classes and interfaces!

export default class MyPlugin extends Plugin {
	settings: MyPluginSettings;

	async onload() {
		await this.loadSettings();

		// Add ribbon icon for quick access
		this.addRibbonIcon("microphone", "Recording control", async () => {
			await this.openRecordingControl();
		});

		this.addCommand({
			id: "test-audio-recorder",
			name: "Test audio recorder (console only)",
			callback: async () => {
				const apiKey = this.settings.deepgramApiKey;

				if (!apiKey) {
					new Notice(
						"Please enter your Deepgram API key in the settings.",
					);
					return;
				}

				const recorder = new AudioRecorder();
				const transcriber = new DeepgramTranscriber(apiKey);

				await transcriber.start((text, isFinal) => {
					console.log(
						`Transcript: ${isFinal ? "FINAL" : "INTERIM"}: ${text}`,
					);
				});

				await recorder.start((chunk) => {
					console.log("Got chunk:", chunk);
					transcriber.sendAudioChunk(chunk);
				});

				console.log("Recording started. Speak into your microphone!");

				setTimeout(() => {
					recorder.stop();
					transcriber.stop();
				}, 7000);
			},
		});

		// This adds a status bar item to the bottom of the app. Does not work on mobile apps.
		const statusBarItemEl = this.addStatusBarItem();
		statusBarItemEl.setText("Status bar text");

		// This adds a simple command that can be triggered anywhere
		this.addCommand({
			id: "open-modal-simple",
			name: "Open modal (simple)",
			callback: () => {
				new SampleModal(this.app).open();
			},
		});
		// This adds an editor command that can perform some operation on the current editor instance
		this.addCommand({
			id: "replace-selected",
			name: "Replace selected content",
			editorCallback: (editor: Editor, view: MarkdownView) => {
				editor.replaceSelection("Sample editor command");
			},
		});
		// This adds a complex command that can check whether the current state of the app allows execution of the command
		this.addCommand({
			id: "open-modal-complex",
			name: "Open modal (complex)",
			checkCallback: (checking: boolean) => {
				// Conditions to check
				const markdownView =
					this.app.workspace.getActiveViewOfType(MarkdownView);
				if (markdownView) {
					// If checking is true, we're simply "checking" if the command can be run.
					// If checking is false, then we want to actually perform the operation.
					if (!checking) {
						new SampleModal(this.app).open();
					}

					// This command will only show up in Command Palette when the check function returns true
					return true;
				}
				return false;
			},
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new SampleSettingTab(this.app, this));

		// When registering intervals, this function will automatically clear the interval when the plugin is disabled.
		this.registerInterval(
			window.setInterval(() => console.log("setInterval"), 5 * 60 * 1000),
		);

		this.registerView(
			VIEW_TYPE_RECORDING,
			(leaf) => new RecordingView(leaf, this),
		);

		this.addCommand({
			id: "open-recording-control",
			name: "Open recording control",
			callback: async () => {
				await this.openRecordingControl();
			},
		});
	}

	async openRecordingControl() {
		const { workspace } = this.app;
		let leaf: WorkspaceLeaf | null = null;
		const leaves = workspace.getLeavesOfType(VIEW_TYPE_RECORDING);

		if (leaves.length > 0) {
			leaf = leaves[0] ?? null;
		} else {
			leaf = workspace.getRightLeaf(false);
			if (leaf) {
				await leaf.setViewState({
					type: VIEW_TYPE_RECORDING,
					active: true,
				});
			}
		}

		if (leaf) {
			await workspace.revealLeaf(leaf);
		}
	}

	onunload() {}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			(await this.loadData()) as Partial<MyPluginSettings>,
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class SampleModal extends Modal {
	constructor(app: App) {
		super(app);
	}

	onOpen() {
		let { contentEl } = this;
		contentEl.setText("Woah!");
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

export const VIEW_TYPE_RECORDING = "recording-view";

export class RecordingView extends ItemView {
	private component: ReturnType<typeof RecordingControl> | undefined;

	constructor(
		leaf: WorkspaceLeaf,
		private plugin: MyPlugin,
	) {
		super(leaf);
	}

	getViewType() {
		return VIEW_TYPE_RECORDING;
	}

	getDisplayText() {
		return "Recording Control";
	}

	async onOpen() {
		const apiKey = this.plugin.settings.deepgramApiKey;

		if (!apiKey) {
			this.contentEl.createEl("p", {
				text: "Please set Deepgram API key in settings",
			});
			return;
		}

		this.component = mount(RecordingControl, {
			target: this.contentEl,
			props: {
				apiKey,
				app: this.plugin.app,
			},
		});
	}

	async onClose() {
		if (this.component) {
			unmount(this.component);
		}
	}
}
