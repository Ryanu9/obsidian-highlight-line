import { Plugin } from 'obsidian';
import { CodeHighlightSettings, DEFAULT_SETTINGS } from './settings';
import { CodeHighlightSettingTab } from './settingsTab';
import { registerReadingViewProcessor } from './readingViewProcessor';
import { createEditorExtension } from './editorExtension';

export default class CodeHighlightPlugin extends Plugin {
	settings: CodeHighlightSettings;
	private editorExtension: any;

	async onload() {
		await this.loadSettings();

		// 注册阅读视图处理器
		registerReadingViewProcessor(this);

		// 注册编辑视图扩展
		this.editorExtension = createEditorExtension(this);
		this.registerEditorExtension(this.editorExtension);

		// 添加设置面板
		this.addSettingTab(new CodeHighlightSettingTab(this.app, this));

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

		const { backgroundColor, opacity } = this.settings;
		const rgba = this.hexToRgba(backgroundColor, opacity);

		const style = document.createElement('style');
		style.id = 'code-highlight-plugin-styles';
		style.textContent = `
			.code-highlight-line {
				display: block;
				background-color: ${rgba} !important;
				padding: 0 4px;
				margin: 0 -4px;
			}
			
			.cm-code-highlight-line {
				background-color: ${rgba} !important;
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
				background-color: ${rgba};
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


