import { App, PluginSettingTab, Setting } from "obsidian";
import MyPlugin from "./main";

export interface MyPluginSettings {
	deepgramApiKey: string;
	enableLLMPostProcessing: boolean;
	openRouterApiKey: string;
	mySetting: string;
}

export const DEFAULT_SETTINGS: MyPluginSettings = {
	deepgramApiKey: "",
	enableLLMPostProcessing: false,
	openRouterApiKey: "",
	mySetting: "default",
};

export class SampleSettingTab extends PluginSettingTab {
	plugin: MyPlugin;

	constructor(app: App, plugin: MyPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName("Deepgram API Key")
			.setDesc("Enter your Deepgram API key")
			.addText((text) =>
				text
					.setPlaceholder("Enter your Deepgram API key")
					.setValue(this.plugin.settings.deepgramApiKey)
					.onChange(async (value) => {
						this.plugin.settings.deepgramApiKey = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Enable LLM Post Processing")
			.setDesc("Enable post processing of transcriptions using an LLM")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.enableLLMPostProcessing)
					.onChange(async (value) => {
						this.plugin.settings.enableLLMPostProcessing = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("OpenRouter API Key")
			.setDesc("Enter your OpenRouter API key")
			.addText((text) =>
				text
					.setPlaceholder("Enter your OpenRouter API key")
					.setValue(this.plugin.settings.openRouterApiKey)
					.onChange(async (value) => {
						this.plugin.settings.openRouterApiKey = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Settings #1")
			.setDesc("It's a secret")
			.addText((text) =>
				text
					.setPlaceholder("Enter your secret")
					.setValue(this.plugin.settings.mySetting)
					.onChange(async (value) => {
						this.plugin.settings.mySetting = value;
						await this.plugin.saveSettings();
					}),
			);
	}
}
