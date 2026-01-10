import { App, PluginSettingTab, Setting } from 'obsidian';
import type CodeHighlightPlugin from './main';

export class CodeHighlightSettingTab extends PluginSettingTab {
	plugin: CodeHighlightPlugin;

	constructor(app: App, plugin: CodeHighlightPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl('h2', { text: 'Code Highlight Settings' });

		// 开关设置
		new Setting(containerEl)
			.setName('Enable highlighting')
			.setDesc('Turn on/off code block highlighting')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.enabled)
				.onChange(async (value) => {
					this.plugin.settings.enabled = value;
					await this.plugin.saveSettings();
					this.plugin.refreshViews();
				}));

		// 背景颜色设置
		new Setting(containerEl)
			.setName('Background color')
			.setDesc('Select the highlight background color')
			.addColorPicker(color => color
				.setValue(this.plugin.settings.backgroundColor)
				.onChange(async (value) => {
					this.plugin.settings.backgroundColor = value;
					await this.plugin.saveSettings();
					this.plugin.updateStyles();
				}));

		// 透明度设置
		new Setting(containerEl)
			.setName('Opacity')
			.setDesc('Adjust the transparency of the highlight (0 = transparent, 1 = opaque)')
			.addSlider(slider => slider
				.setLimits(0, 1, 0.05)
				.setValue(this.plugin.settings.opacity)
				.setDynamicTooltip()
				.onChange(async (value) => {
					this.plugin.settings.opacity = value;
					await this.plugin.saveSettings();
					this.plugin.updateStyles();
				}));

		// 预览区域
		const previewContainer = containerEl.createDiv('highlight-preview-container');
		previewContainer.createEl('h3', { text: 'Preview' });
		
		const previewBox = previewContainer.createDiv('highlight-preview-box');
		previewBox.createEl('code', { text: 'This is a highlighted line' });
		
		this.updatePreview(previewBox);
	}

	updatePreview(previewBox: HTMLElement): void {
		const { backgroundColor, opacity } = this.plugin.settings;
		previewBox.style.backgroundColor = this.hexToRgba(backgroundColor, opacity);
	}

	hexToRgba(hex: string, opacity: number): string {
		// 移除 # 号
		hex = hex.replace('#', '');
		
		// 将 hex 转换为 RGB
		const r = parseInt(hex.substring(0, 2), 16);
		const g = parseInt(hex.substring(2, 4), 16);
		const b = parseInt(hex.substring(4, 6), 16);
		
		return `rgba(${r}, ${g}, ${b}, ${opacity})`;
	}
}



