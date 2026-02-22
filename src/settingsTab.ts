import { App, PluginSettingTab, Setting } from 'obsidian';
import type CodeHighlightPlugin from './main';
import type { CodeHighlightSettings } from './settings';

type SettingsKey = keyof CodeHighlightSettings;
type TabId = 'ansi' | 'diff' | 'burp';

export class CodeHighlightSettingTab extends PluginSettingTab {
	plugin: CodeHighlightPlugin;
	private previewBox: HTMLElement | null = null;
	private activeTab: TabId = 'ansi';
	private tabButtons: Map<TabId, HTMLElement> = new Map();
	private tabPanels: Map<TabId, HTMLElement> = new Map();

	constructor(app: App, plugin: CodeHighlightPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		// Tab bar
		const tabBar = containerEl.createDiv({ cls: 'ch-tab-bar' });
		const tabs: { id: TabId; label: string }[] = [
			{ id: 'ansi', label: 'ANSI Highlight' },
			{ id: 'diff', label: 'Code Diff Highlight' },
			{ id: 'burp', label: 'Burp Highlight' },
		];

		for (const tab of tabs) {
			const btn = tabBar.createEl('button', { text: tab.label, cls: 'ch-tab-btn' });
			btn.addEventListener('click', () => this.switchTab(tab.id));
			this.tabButtons.set(tab.id, btn);
		}

		// Panels
		const panelContainer = containerEl.createDiv({ cls: 'ch-tab-panels' });

		const ansiPanel = panelContainer.createDiv({ cls: 'ch-tab-panel' });
		this.tabPanels.set('ansi', ansiPanel);
		this.createAnsiSection(ansiPanel);

		const diffPanel = panelContainer.createDiv({ cls: 'ch-tab-panel' });
		this.tabPanels.set('diff', diffPanel);
		this.createDiffSection(diffPanel);

		const burpPanel = panelContainer.createDiv({ cls: 'ch-tab-panel' });
		this.tabPanels.set('burp', burpPanel);
		this.createBurpSection(burpPanel);

		this.switchTab(this.activeTab);
	}

	private switchTab(id: TabId): void {
		this.activeTab = id;
		for (const [tabId, btn] of this.tabButtons) {
			btn.toggleClass('ch-tab-active', tabId === id);
		}
		for (const [tabId, panel] of this.tabPanels) {
			panel.style.display = tabId === id ? '' : 'none';
		}
	}

	// ==================== ANSI Highlight ====================
	private createAnsiSection(el: HTMLElement): void {
		new Setting(el)
			.setName('Enable ANSI code blocks')
			.setDesc('Render ANSI escape codes in ```ansi code blocks')
			.addToggle(t => t
				.setValue(this.plugin.settings.ansiEnabled)
				.onChange(async v => {
					this.plugin.settings.ansiEnabled = v;
					await this.plugin.saveSettings();
					this.plugin.refreshViews();
				}));

		this.addBgSetting(el, 'Light theme background', 'ansiLightBg');
		this.addBgSetting(el, 'Dark theme background', 'ansiDarkBg');
		this.addFontSetting(el, 'Font family', 'ansiFont');
		this.addFontSizeSetting(el, 'Font size', 'ansiFontSize');
	}

	// ==================== Code Diff Highlight ====================
	private createDiffSection(el: HTMLElement): void {
		new Setting(el)
			.setName('Enable highlighting')
			.setDesc('Turn on/off >>>> line highlighting')
			.addToggle(t => t
				.setValue(this.plugin.settings.enabled)
				.onChange(async v => {
					this.plugin.settings.enabled = v;
					await this.plugin.saveSettings();
					this.plugin.refreshViews();
				}));

		new Setting(el)
			.setName('Show prefix in Reading Mode')
			.setDesc('Show the >>>> prefix in Reading Mode')
			.addToggle(t => t
				.setValue(this.plugin.settings.showPrefixInReadingMode)
				.onChange(async v => {
					this.plugin.settings.showPrefixInReadingMode = v;
					await this.plugin.saveSettings();
					this.plugin.refreshViews();
				}));

		this.addColorSetting(el, {
			name: '>>>> Highlight',
			desc: 'Background color and opacity for highlighted lines',
			colorKey: 'backgroundColor',
			opacityKey: 'opacity',
		});

		this.addColorSetting(el, {
			name: '>>>+ Diff Add',
			desc: 'Background color and opacity for diff-add lines',
			colorKey: 'diffAddColor',
			opacityKey: 'diffAddOpacity',
		});

		this.addColorSetting(el, {
			name: '>>>- Diff Remove',
			desc: 'Background color and opacity for diff-remove lines',
			colorKey: 'diffRemoveColor',
			opacityKey: 'diffRemoveOpacity',
		});

		this.addBgSetting(el, 'Light theme code block background', 'codeLightBg');
		this.addBgSetting(el, 'Dark theme code block background', 'codeDarkBg');

		// Preview
		const previewContainer = el.createDiv('highlight-preview-container');
		previewContainer.createEl('h3', { text: 'Preview' });
		this.previewBox = previewContainer.createDiv('highlight-preview-box');
		this.refreshPreview();
	}

	// ==================== Burp Highlight ====================
	private createBurpSection(el: HTMLElement): void {
		new Setting(el)
			.setName('Enable Burp code blocks')
			.setDesc('Render side-by-side HTTP request/response in ```burp blocks')
			.addToggle(t => t
				.setValue(this.plugin.settings.burpEnabled)
				.onChange(async v => {
					this.plugin.settings.burpEnabled = v;
					await this.plugin.saveSettings();
					this.plugin.refreshViews();
				}));

		this.addBgSetting(el, 'Light theme background', 'burpLightBg');
		this.addBgSetting(el, 'Dark theme background', 'burpDarkBg');
		this.addFontSetting(el, 'Font family', 'burpFont');
		this.addFontSizeSetting(el, 'Font size', 'burpFontSize');
	}

	// ==================== Helper: Color + Opacity ====================
	private addColorSetting(containerEl: HTMLElement, opts: {
		name: string;
		desc: string;
		colorKey: SettingsKey;
		opacityKey: SettingsKey;
	}): void {
		const setting = new Setting(containerEl)
			.setName(opts.name)
			.setDesc(opts.desc);

		const controlEl = setting.controlEl;
		controlEl.empty();
		controlEl.addClass('ch-color-control');

		const currentColor = this.plugin.settings[opts.colorKey] as string;
		const currentOpacity = this.plugin.settings[opts.opacityKey] as number;

		const swatchWrapper = controlEl.createDiv('ch-swatch-wrapper');
		const swatch = swatchWrapper.createEl('input', { type: 'color' });
		swatch.addClass('ch-color-swatch');
		swatch.value = currentColor;

		const hexInput = controlEl.createEl('input', { type: 'text' });
		hexInput.addClass('ch-hex-input');
		hexInput.value = currentColor;
		hexInput.maxLength = 7;
		hexInput.spellcheck = false;

		const opacityWrapper = controlEl.createDiv('ch-opacity-wrapper');
		const opacitySlider = opacityWrapper.createEl('input', { type: 'range' });
		opacitySlider.addClass('ch-opacity-slider');
		opacitySlider.min = '0';
		opacitySlider.max = '1';
		opacitySlider.step = '0.05';
		opacitySlider.value = String(currentOpacity);

		const opacityLabel = opacityWrapper.createEl('span', { text: `${Math.round(currentOpacity * 100)}%` });
		opacityLabel.addClass('ch-opacity-label');

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

	// ==================== Helper: Background Color ====================
	private addBgSetting(containerEl: HTMLElement, name: string, key: SettingsKey): void {
		const setting = new Setting(containerEl)
			.setName(name)
			.setDesc('Leave empty for theme default');

		const controlEl = setting.controlEl;
		controlEl.empty();
		controlEl.addClass('ch-color-control');

		const currentColor = (this.plugin.settings[key] as string) || '#1e1e1e';

		const swatchWrapper = controlEl.createDiv('ch-swatch-wrapper');
		const swatch = swatchWrapper.createEl('input', { type: 'color' });
		swatch.addClass('ch-color-swatch');
		swatch.value = currentColor;

		const hexInput = controlEl.createEl('input', { type: 'text' });
		hexInput.addClass('ch-hex-input');
		hexInput.value = (this.plugin.settings[key] as string) || '';
		hexInput.maxLength = 7;
		hexInput.spellcheck = false;
		hexInput.placeholder = 'theme default';

		const resetBtn = controlEl.createEl('button', { text: 'Reset' });
		resetBtn.addClass('ch-reset-btn');

		const update = async (val: string) => {
			(this.plugin.settings as any)[key] = val;
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
			if (val === '') { await update(''); return; }
			if (!val.startsWith('#')) val = '#' + val;
			if (/^#[0-9a-fA-F]{6}$/.test(val)) {
				swatch.value = val;
				await update(val);
			} else {
				hexInput.value = (this.plugin.settings[key] as string) || '';
			}
		});

		resetBtn.addEventListener('click', async () => {
			hexInput.value = '';
			await update('');
		});
	}

	// ==================== Helper: Font Family ====================
	private addFontSetting(containerEl: HTMLElement, name: string, key: SettingsKey): void {
		new Setting(containerEl)
			.setName(name)
			.setDesc('Leave empty for theme default')
			.addText(text => text
				.setPlaceholder('e.g. Consolas, monospace')
				.setValue((this.plugin.settings[key] as string) || '')
				.onChange(async (value) => {
					(this.plugin.settings as any)[key] = value.trim();
					await this.plugin.saveSettings();
					this.plugin.updateStyles();
				}));
	}

	// ==================== Helper: Font Size ====================
	private addFontSizeSetting(containerEl: HTMLElement, name: string, key: SettingsKey): void {
		const currentSize = (this.plugin.settings[key] as number) || 0;
		const setting = new Setting(containerEl)
			.setName(name)
			.setDesc(currentSize ? `${currentSize}px` : 'Theme default');

		setting.addSlider(slider => slider
			.setLimits(0, 24, 1)
			.setValue(currentSize)
			.setDynamicTooltip()
			.onChange(async (value) => {
				(this.plugin.settings as any)[key] = value;
				setting.setDesc(value ? `${value}px` : 'Theme default');
				await this.plugin.saveSettings();
				this.plugin.updateStyles();
			}));
	}

	// ==================== Preview ====================
	private refreshPreview(): void {
		if (!this.previewBox) return;
		const box = this.previewBox;
		box.empty();

		const isDark = document.body.classList.contains('theme-dark');
		const bg = isDark ? this.plugin.settings.codeDarkBg : this.plugin.settings.codeLightBg;
		box.style.backgroundColor = bg || '';

		const s = this.plugin.settings;

		const kw = 'var(--color-blue)';
		const fn = 'var(--color-yellow)';
		const str = 'var(--color-green)';
		const pr = 'var(--color-purple)';
		const cm = 'var(--text-faint)';
		const nm = 'var(--text-normal)';

		const span = (text: string, color: string) =>
			`<span style="color:${color}">${text}</span>`;

		const lines: { html: string; bg?: string }[] = [
			{ html: `${span('function', kw)} ${span('greet', fn)}${span('(', cm)}${span('name', nm)}${span(') {', cm)}` },
			{ html: `  ${span('const', kw)} ${span('msg', nm)} ${span('=', cm)} ${span('\`Hello, \${', str)}${span('name', nm)}${span('}\`', str)}${span(';', cm)}`,
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

