import { App, PluginSettingTab, Setting, ToggleComponent } from "obsidian";
import MyPlugin from "./main";

export interface MyPluginSettings {
	deepgramApiKey: string;
	enableLLMPostProcessing: boolean;
	openRouterApiKey: string;
	includeKeywordLinks: boolean;
	writeTagsToFile: boolean;
}

export const DEFAULT_SETTINGS: MyPluginSettings = {
	deepgramApiKey: "",
	enableLLMPostProcessing: false,
	openRouterApiKey: "",
	includeKeywordLinks: false,
	writeTagsToFile: false,
};

export class SampleSettingTab extends PluginSettingTab {
	plugin: MyPlugin;

	constructor(app: App, plugin: MyPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		let keywordLinksSetting: Setting;
		let keywordLinksToggle: ToggleComponent;
		let writeTagsToFileSetting: Setting;
		let writeTagsToFileToggle: ToggleComponent;

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
						keywordLinksSetting.setDisabled(!value);
						writeTagsToFileSetting.setDisabled(!value);
						if (!value) {
							this.plugin.settings.includeKeywordLinks = false;
							keywordLinksToggle.setValue(false);
							writeTagsToFileToggle.setValue(false);
						}
						await this.plugin.saveSettings();
					}),
			);

		keywordLinksSetting = new Setting(containerEl)
			.setName("Include keyword links")
			.setDesc(
				"Extract keywords during LLM post-processing and automatically include them in the note",
			)
			.addToggle((toggle) => {
				// Store reference to the toggle component
				keywordLinksToggle = toggle;
				return toggle
					.setValue(this.plugin.settings.includeKeywordLinks)
					.onChange(async (value) => {
						this.plugin.settings.includeKeywordLinks = value;
						await this.plugin.saveSettings();
					});
			})
			.setDisabled(!this.plugin.settings.enableLLMPostProcessing);

		writeTagsToFileSetting = new Setting(containerEl)
			.setName("Write tags to file")
			.setDesc(
				"Extract tags during LLM post-processing and automatically write them to the note's frontmatter",
			)
			.addToggle((toggle) => {
				// Store reference to the toggle component
				writeTagsToFileToggle = toggle;
				return toggle
					.setValue(this.plugin.settings.writeTagsToFile)
					.onChange(async (value) => {
						this.plugin.settings.writeTagsToFile = value;
						await this.plugin.saveSettings();
					});
			})
			.setDisabled(!this.plugin.settings.enableLLMPostProcessing);

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
	}
}
