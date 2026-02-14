import { App, PluginSettingTab, Setting } from 'obsidian';
import type CodeHighlightPlugin from './main';

export class CodeHighlightSettingTab extends PluginSettingTab {
	plugin: CodeHighlightPlugin;
	private previewBox: HTMLElement | null = null;

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

		// ---- Code Block Background ----
		this.addBgColorSetting(containerEl);

		// 预览区域
		const previewContainer = containerEl.createDiv('highlight-preview-container');
		previewContainer.createEl('h3', { text: 'Preview' });
		this.previewBox = previewContainer.createDiv('highlight-preview-box');
		this.refreshPreview();
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
			this.refreshPreview();
		});

		hexInput.addEventListener('change', async () => {
			let val = hexInput.value.trim();
			if (!val.startsWith('#')) val = '#' + val;
			if (/^#[0-9a-fA-F]{6}$/.test(val)) {
				swatch.value = val;
				(this.plugin.settings as any)[opts.colorKey] = val;
				await this.plugin.saveSettings();
				this.plugin.updateStyles();
				this.refreshPreview();
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
			this.refreshPreview();
		});
	}

	private addBgColorSetting(containerEl: HTMLElement): void {
		const setting = new Setting(containerEl)
			.setName('Code block background')
			.setDesc('Custom background color for code blocks. Leave empty to use theme default.');

		const controlEl = setting.controlEl;
		controlEl.empty();
		controlEl.addClass('ch-color-control');

		const currentColor = this.plugin.settings.codeBlockBg || '#1e1e1e';

		const swatchWrapper = controlEl.createDiv('ch-swatch-wrapper');
		const swatch = swatchWrapper.createEl('input', { type: 'color' });
		swatch.addClass('ch-color-swatch');
		swatch.value = currentColor;

		const hexInput = controlEl.createEl('input', { type: 'text' });
		hexInput.addClass('ch-hex-input');
		hexInput.value = this.plugin.settings.codeBlockBg;
		hexInput.maxLength = 7;
		hexInput.spellcheck = false;
		hexInput.placeholder = 'theme default';

		const resetBtn = controlEl.createEl('button', { text: 'Reset' });
		resetBtn.addClass('ch-reset-btn');

		const update = async (val: string) => {
			this.plugin.settings.codeBlockBg = val;
			await this.plugin.saveSettings();
			this.plugin.updateStyles();
			this.refreshPreview();
		};

		swatch.addEventListener('input', async (e) => {
			const val = (e.target as HTMLInputElement).value;
			hexInput.value = val;
			await update(val);
		});

		hexInput.addEventListener('change', async () => {
			let val = hexInput.value.trim();
			if (val === '') {
				await update('');
				return;
			}
			if (!val.startsWith('#')) val = '#' + val;
			if (/^#[0-9a-fA-F]{6}$/.test(val)) {
				swatch.value = val;
				await update(val);
			} else {
				hexInput.value = this.plugin.settings.codeBlockBg;
			}
		});

		resetBtn.addEventListener('click', async () => {
			hexInput.value = '';
			this.plugin.settings.codeBlockBg = '';
			await this.plugin.saveSettings();
			this.plugin.updateStyles();
			this.refreshPreview();
		});
	}

	private refreshPreview(): void {
		if (!this.previewBox) return;
		const box = this.previewBox;
		box.empty();

		if (this.plugin.settings.codeBlockBg) {
			box.style.backgroundColor = this.plugin.settings.codeBlockBg;
		} else {
			box.style.backgroundColor = '';
		}

		const s = this.plugin.settings;

		const kw = 'var(--color-blue)';       // keyword: function, const, return
		const fn = 'var(--color-yellow)';      // function name / call
		const str = 'var(--color-green)';      // string / template literal
		const pr = 'var(--color-purple)';      // property
		const cm = 'var(--text-faint)';        // punctuation / plain
		const nm = 'var(--text-normal)';       // normal text

		const span = (text: string, color: string) =>
			`<span style="color:${color}">${text}</span>`;

		const lines: { html: string; bg?: string }[] = [
			{ html: `${span('function', kw)} ${span('greet', fn)}${span('(', cm)}${span('name', nm)}${span(') {', cm)}` },
			{ html: `  ${span('const', kw)} ${span('msg', nm)} ${span('=', cm)} ${span('`Hello, ${', str)}${span('name', nm)}${span('}!`', str)}${span(';', cm)}`,
			  bg: this.hexToRgba(s.backgroundColor, s.opacity) },
			{ html: `  ${span('console', nm)}${span('.', cm)}${span('log', fn)}${span('(', cm)}${span('msg', pr)}${span(');', cm)}`,
			  bg: this.hexToRgba(s.backgroundColor, s.opacity) },
			{ html: `  ${span('return', kw)} ${span('msg', pr)}${span(';', cm)}` },
			{ html: span('}', cm) },
			{ html: '\u00A0' },
			{ html: `${span('-', cm)} ${span('const', kw)} ${span('old', nm)} ${span('=', cm)} ${span('getOld', fn)}${span('();', cm)}`,
			  bg: this.hexToRgba(s.diffRemoveColor, s.diffRemoveOpacity) },
			{ html: `${span('+', cm)} ${span('const', kw)} ${span('val', nm)} ${span('=', cm)} ${span('getNew', fn)}${span('();', cm)}`,
			  bg: this.hexToRgba(s.diffAddColor, s.diffAddOpacity) },
			{ html: `  ${span('process', fn)}${span('(', cm)}${span('val', pr)}${span(');', cm)}` },
		];

		for (const l of lines) {
			const lineEl = box.createDiv('ch-preview-line');
			lineEl.innerHTML = l.html;
			if (l.bg) {
				lineEl.style.backgroundColor = l.bg;
			}
		}
	}

	hexToRgba(hex: string, opacity: number): string {
		hex = hex.replace('#', '');
		const r = parseInt(hex.substring(0, 2), 16);
		const g = parseInt(hex.substring(2, 4), 16);
		const b = parseInt(hex.substring(4, 6), 16);
		return `rgba(${r}, ${g}, ${b}, ${opacity})`;
	}
}



