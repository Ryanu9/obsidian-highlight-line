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

		new Setting(containerEl)
			.setName('Show prefix in Reading Mode')
			.setDesc('Show the prefix in Reading Mode. When disabled, the prefix is hidden but the line is still highlighted.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.showPrefixInReadingMode)
				.onChange(async (value) => {
					this.plugin.settings.showPrefixInReadingMode = value;
					await this.plugin.saveSettings();
					this.plugin.refreshViews();
				}));

		// ---- >>>> Highlight ----
		this.addColorSetting(containerEl, {
			name: '>>>> Highlight',
			desc: 'Background color and opacity for highlighted lines',
			colorKey: 'backgroundColor',
			opacityKey: 'opacity',
		});

		// ---- >>>+ Diff Add ----
		this.addColorSetting(containerEl, {
			name: '>>>+ Diff Add',
			desc: 'Background color and opacity for diff-add lines',
			colorKey: 'diffAddColor',
			opacityKey: 'diffAddOpacity',
		});

		// ---- >>>- Diff Remove ----
		this.addColorSetting(containerEl, {
			name: '>>>- Diff Remove',
			desc: 'Background color and opacity for diff-remove lines',
			colorKey: 'diffRemoveColor',
			opacityKey: 'diffRemoveOpacity',
		});

		// 预览区域
		const previewContainer = containerEl.createDiv('highlight-preview-container');
		previewContainer.createEl('h3', { text: 'Preview' });

		const previewBox = previewContainer.createDiv('highlight-preview-box');

		this.addPreviewLine(previewBox, '>>>> Highlighted line',
			this.plugin.settings.backgroundColor, this.plugin.settings.opacity);
		this.addPreviewLine(previewBox, '>>>+ Added line',
			this.plugin.settings.diffAddColor, this.plugin.settings.diffAddOpacity);
		this.addPreviewLine(previewBox, '>>>- Removed line',
			this.plugin.settings.diffRemoveColor, this.plugin.settings.diffRemoveOpacity, true);
	}

	/**
	 * Style Settings 风格的颜色选择器：色块 + hex 输入框 + 透明度滑块
	 */
	private addColorSetting(containerEl: HTMLElement, opts: {
		name: string;
		desc: string;
		colorKey: keyof CodeHighlightPlugin['settings'];
		opacityKey: keyof CodeHighlightPlugin['settings'];
	}): void {
		const setting = new Setting(containerEl)
			.setName(opts.name)
			.setDesc(opts.desc);

		const controlEl = setting.controlEl;
		controlEl.empty();
		controlEl.addClass('ch-color-control');

		const currentColor = this.plugin.settings[opts.colorKey] as string;
		const currentOpacity = this.plugin.settings[opts.opacityKey] as number;

		// 颜色预览色块 + native color picker
		const swatchWrapper = controlEl.createDiv('ch-swatch-wrapper');
		const swatch = swatchWrapper.createEl('input', { type: 'color' });
		swatch.addClass('ch-color-swatch');
		swatch.value = currentColor;

		// Hex 文本输入框
		const hexInput = controlEl.createEl('input', { type: 'text' });
		hexInput.addClass('ch-hex-input');
		hexInput.value = currentColor;
		hexInput.maxLength = 7;
		hexInput.spellcheck = false;

		// 透明度滑块
		const opacityWrapper = controlEl.createDiv('ch-opacity-wrapper');
		const opacitySlider = opacityWrapper.createEl('input', { type: 'range' });
		opacitySlider.addClass('ch-opacity-slider');
		opacitySlider.min = '0';
		opacitySlider.max = '1';
		opacitySlider.step = '0.05';
		opacitySlider.value = String(currentOpacity);

		const opacityLabel = opacityWrapper.createEl('span', { text: `${Math.round(currentOpacity * 100)}%` });
		opacityLabel.addClass('ch-opacity-label');

		// --- Events ---
		swatch.addEventListener('input', async (e) => {
			const val = (e.target as HTMLInputElement).value;
			hexInput.value = val;
			(this.plugin.settings as any)[opts.colorKey] = val;
			await this.plugin.saveSettings();
			this.plugin.updateStyles();
		});

		hexInput.addEventListener('change', async () => {
			let val = hexInput.value.trim();
			if (!val.startsWith('#')) val = '#' + val;
			if (/^#[0-9a-fA-F]{6}$/.test(val)) {
				swatch.value = val;
				(this.plugin.settings as any)[opts.colorKey] = val;
				await this.plugin.saveSettings();
				this.plugin.updateStyles();
			} else {
				hexInput.value = this.plugin.settings[opts.colorKey] as string;
			}
		});

		opacitySlider.addEventListener('input', async () => {
			const val = parseFloat(opacitySlider.value);
			opacityLabel.textContent = `${Math.round(val * 100)}%`;
			(this.plugin.settings as any)[opts.opacityKey] = val;
			await this.plugin.saveSettings();
			this.plugin.updateStyles();
		});
	}

	private addPreviewLine(container: HTMLElement, text: string, color: string, opacity: number, last = false): void {
		const line = container.createEl('div');
		line.createEl('code', { text });
		line.style.backgroundColor = this.hexToRgba(color, opacity);
		line.style.padding = '2px 4px';
		if (!last) line.style.marginBottom = '4px';
	}

	hexToRgba(hex: string, opacity: number): string {
		hex = hex.replace('#', '');
		const r = parseInt(hex.substring(0, 2), 16);
		const g = parseInt(hex.substring(2, 4), 16);
		const b = parseInt(hex.substring(4, 6), 16);
		return `rgba(${r}, ${g}, ${b}, ${opacity})`;
	}
}



