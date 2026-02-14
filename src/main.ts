import { Plugin } from 'obsidian';
import { CodeHighlightSettings, DEFAULT_SETTINGS, HIGHLIGHT_PREFIXES } from './settings';
import { CodeHighlightSettingTab } from './settingsTab';
import { registerReadingViewProcessor } from './readingViewProcessor';
import { createEditorExtension } from './editorExtension';
import { registerToggleHighlightCommand } from './toggleHighlightCommand';
import { registerPromptHighlightProcessor } from './promptHighlight';

export default class CodeHighlightPlugin extends Plugin {
	settings: CodeHighlightSettings;
	private editorExtension: any;

	async onload() {
		await this.loadSettings();

		// 注册阅读视图处理器
		registerReadingViewProcessor(this);

		// 注册命令提示符高亮处理器 (仅阅读模式)
		registerPromptHighlightProcessor(this);

		// 注册编辑视图扩展
		this.editorExtension = createEditorExtension(this);
		this.registerEditorExtension(this.editorExtension);

		// 添加设置面板
		this.addSettingTab(new CodeHighlightSettingTab(this.app, this));

		// 注册快捷键命令 (默认无快捷键，需用户手动配置)
		registerToggleHighlightCommand(this);

		// 添加初始样式
		this.updateStyles();
	}

	onunload() {
		// 清理样式
		this.removeStyles();
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	updateStyles() {
		this.removeStyles();

		const { backgroundColor, opacity, diffAddColor, diffAddOpacity, diffRemoveColor, diffRemoveOpacity } = this.settings;
		const rgbaHighlight = this.hexToRgba(backgroundColor, opacity);
		const rgbaDiffAdd = this.hexToRgba(diffAddColor, diffAddOpacity);
		const rgbaDiffRemove = this.hexToRgba(diffRemoveColor, diffRemoveOpacity);

		const style = document.createElement('style');
		style.id = 'code-highlight-plugin-styles';
		style.textContent = `
			/* >>>> highlight */
			.code-highlight-line {
				display: block;
				background-color: ${rgbaHighlight} !important;
				padding: 0 4px;
				margin: 0 -4px;
			}
			.cm-code-highlight-line {
				background-color: ${rgbaHighlight} !important;
			}

			/* >>>+ diff add */
			.code-highlight-diff-add {
				display: block;
				background-color: ${rgbaDiffAdd} !important;
				padding: 0 4px;
				margin: 0 -4px;
			}
			.cm-code-highlight-diff-add {
				background-color: ${rgbaDiffAdd} !important;
			}

			/* >>>- diff remove */
			.code-highlight-diff-remove {
				display: block;
				background-color: ${rgbaDiffRemove} !important;
				padding: 0 4px;
				margin: 0 -4px;
			}
			.cm-code-highlight-diff-remove {
				background-color: ${rgbaDiffRemove} !important;
			}

			.highlight-preview-container {
				margin-top: 20px;
				padding: 15px;
				background-color: var(--background-secondary);
				border-radius: 5px;
			}
			
			.highlight-preview-box {
				padding: 10px;
				border: 1px solid var(--background-modifier-border);
				border-radius: 3px;
				background-color: var(--background-primary);
				font-family: var(--font-monospace);
			}
			
			.highlight-preview-box code {
				padding: 2px 4px;
				border-radius: 3px;
			}
		`;
		document.head.appendChild(style);
	}

	removeStyles() {
		const existingStyle = document.getElementById('code-highlight-plugin-styles');
		if (existingStyle) {
			existingStyle.remove();
		}
	}

	refreshViews() {
		// 刷新所有视图以应用设置变更
		this.app.workspace.trigger('parse');
	}

	hexToRgba(hex: string, opacity: number): string {
		hex = hex.replace('#', '');
		const r = parseInt(hex.substring(0, 2), 16);
		const g = parseInt(hex.substring(2, 4), 16);
		const b = parseInt(hex.substring(4, 6), 16);
		return `rgba(${r}, ${g}, ${b}, ${opacity})`;
	}
}


