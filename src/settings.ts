import { App, PluginSettingTab, Setting } from "obsidian";
import MyPlugin from "./main";

export interface MyPluginSettings {
	deepgramApiKey: string;
	mySetting: string;
}

export const DEFAULT_SETTINGS: MyPluginSettings = {
	deepgramApiKey: "",
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
