import { Plugin, Menu, MarkdownView } from 'obsidian';

import { CodeHighlightSettings, DEFAULT_SETTINGS, HIGHLIGHT_PREFIXES } from './settings';

import { CodeHighlightSettingTab } from './settingsTab';

import { registerReadingViewProcessor } from './readingViewProcessor';

import { createEditorExtension } from './editorExtension';

import { registerToggleHighlightCommand } from './toggleHighlightCommand';

import { registerPromptHighlightProcessor } from './promptHighlight';

import { renderAnsi } from './ansi';

import { ansiEditorExtension } from './ansiEditor';

import { registerBurpProcessor } from './burpBlock';



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



		// 注册 ANSI 代码块处理器 (阅读模式) - ansi 和 a 别名
		const ansiHandler = (source: string, el: HTMLElement, ctx: import('obsidian').MarkdownPostProcessorContext) => this.processAnsiBlock(source, el, ctx);
		this.registerMarkdownCodeBlockProcessor("ansi", ansiHandler);
		this.registerMarkdownCodeBlockProcessor("a", ansiHandler);



		// 注册 ANSI 编辑器扩展 (Live Preview)

		this.registerEditorExtension(ansiEditorExtension);



		// 注册 Burp HTTP 代码块处理器 (阅读模式 + Live Preview)

		registerBurpProcessor(this);



		// 添加设置面板

		this.addSettingTab(new CodeHighlightSettingTab(this.app, this));



		// 注册快捷键命令 (默认无快捷键，需用户手动配置)

		registerToggleHighlightCommand(this);



		// 注册 ANSI Join Lines 命令

		this.addCommand({

			id: "join-ansi-lines",

			name: "Join lines (Smart ANSI merge)",

			editorCallback: (editor) => {

				this.joinAnsiLines(editor);

			},

		});



		// 注册 ANSI Join Lines 右键菜单

		this.registerEvent(

			this.app.workspace.on("editor-menu", (menu, editor) => {

				if (editor.getSelection().length > 0) {

					menu.addItem((item) => {

						item

							.setTitle("Join ANSI lines")

							.setIcon("merge")

							.onClick(() => {

								this.joinAnsiLines(editor);

							});

					});

				}

			})

		);



		// 添加初始样式

		this.updateStyles();

	}



	private processAnsiBlock(source: string, el: HTMLElement, ctx: import('obsidian').MarkdownPostProcessorContext) {
		if (!this.settings.ansiEnabled) {
			el.createEl('pre').createEl('code', { text: source });
			return;
		}
		const container = el.createEl("pre", { cls: "ansi-block" });

		const lines = source.split('\n');
		const prefixMap = [
			{ prefix: HIGHLIGHT_PREFIXES.HIGHLIGHT, cssClass: 'code-highlight-line' },
			{ prefix: HIGHLIGHT_PREFIXES.DIFF_ADD, cssClass: 'code-highlight-diff-add' },
			{ prefix: HIGHLIGHT_PREFIXES.DIFF_REMOVE, cssClass: 'code-highlight-diff-remove' },
		];

		lines.forEach((line, index) => {
			let cssClass = '';
			let content = line;

			for (const entry of prefixMap) {
				if (line.startsWith(entry.prefix)) {
					cssClass = entry.cssClass;
					if (!this.settings.showPrefixInReadingMode) {
						content = line.substring(entry.prefix.length);
					}
					break;
				}
			}

			const lineEl = renderAnsi(content);

			if (cssClass) {
				const wrapper = document.createElement('span');
				wrapper.className = cssClass;
				wrapper.appendChild(lineEl);
				container.appendChild(wrapper);
			} else {
				container.appendChild(lineEl);
			}

			if (index < lines.length - 1 && !cssClass) {
				container.appendChild(document.createTextNode('\n'));
			}
		});

		const enterEditMode = () => {
			const sectionInfo = ctx.getSectionInfo(el) || ctx.getSectionInfo(container);
			if (sectionInfo) {
				const view = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (view) {
					const visibleLine = sectionInfo.lineStart + 1;
					view.editor.setCursor({ line: visibleLine, ch: 0 });
					view.editor.focus();
				}
			}
		};

		el.addEventListener("click", (event) => {
			if (event.ctrlKey) {
				enterEditMode();
				event.preventDefault();
			}
		});

		el.addEventListener("contextmenu", (event) => {
			const menu = new Menu();
			menu.addItem((item) => {
				item
					.setTitle("✏️ Edit Code Block")
					.setIcon("pencil")
					.onClick(() => {
						enterEditMode();
					});
			});
			menu.showAtPosition({ x: event.pageX, y: event.pageY });
			event.preventDefault();
		});
	}

	joinAnsiLines(editor: any) {

		const selection = editor.getSelection();

		if (!selection) return;

		const merged = selection.replace(/(\x1b\[0m)?\s*[\r\n]+\s*/g, "");

		editor.replaceSelection(merged);

	}



	onunload() {

		// 清理样式

		this.removeStyles();

	}



	async loadSettings() {

		const data = await this.loadData();

		this.settings = Object.assign({}, DEFAULT_SETTINGS, data);

		// Migrate old codeBlockBg → codeDarkBg

		if (data && data.codeBlockBg && !data.codeDarkBg) {

			this.settings.codeDarkBg = data.codeBlockBg;

		}

	}



	async saveSettings() {

		await this.saveData(this.settings);

	}



	updateStyles() {

		this.removeStyles();

		const s = this.settings;



		const rgbaHL = this.hexToRgba(s.backgroundColor, s.opacity);

		const rgbaAdd = this.hexToRgba(s.diffAddColor, s.diffAddOpacity);

		const rgbaRem = this.hexToRgba(s.diffRemoveColor, s.diffRemoveOpacity);



		let css = `

			.code-highlight-line { display:block; background-color:${rgbaHL}!important; padding:0 4px; margin:0 -4px; }

			.cm-code-highlight-line { background-color:${rgbaHL}!important; }

			.code-highlight-diff-add { display:block; background-color:${rgbaAdd}!important; padding:0 4px; margin:0 -4px; }

			.cm-code-highlight-diff-add { background-color:${rgbaAdd}!important; }

			.code-highlight-diff-remove { display:block; background-color:${rgbaRem}!important; padding:0 4px; margin:0 -4px; }

			.cm-code-highlight-diff-remove { background-color:${rgbaRem}!important; }

		`;



		// Code block background (theme-aware)

		if (s.codeLightBg) {

			css += `.theme-light .markdown-rendered pre, .theme-light .cm-s-obsidian .HyperMD-codeblock-bg { background-color:${s.codeLightBg}!important; }`;

		}

		if (s.codeDarkBg) {

			css += `.theme-dark .markdown-rendered pre, .theme-dark .cm-s-obsidian .HyperMD-codeblock-bg { background-color:${s.codeDarkBg}!important; }`;

		}



		// ANSI block styling

		if (s.ansiLightBg) css += `.theme-light .ansi-block { background-color:${s.ansiLightBg}!important; }`;

		if (s.ansiDarkBg) css += `.theme-dark .ansi-block { background-color:${s.ansiDarkBg}!important; }`;

		if (s.ansiFont) {

			const af = s.ansiFont.startsWith('var(') ? s.ansiFont : `"${s.ansiFont}",monospace`;

			css += `.ansi-block, .ansi-block span { font-family:${af}!important; }`;

		}

		if (s.ansiFontSize > 0) css += `.ansi-block { font-size:${s.ansiFontSize}px!important; }`;



		// Burp block styling

		if (s.burpLightBg) css += `.theme-light .burp-content { background-color:${s.burpLightBg}!important; }`;

		if (s.burpDarkBg) css += `.theme-dark .burp-content { background-color:${s.burpDarkBg}!important; }`;

		if (s.burpFont) {

			const bf = s.burpFont.startsWith('var(') ? s.burpFont : `"${s.burpFont}",monospace`;

			css += `.burp-container { font-family:${bf}!important; }`;

		}

		if (s.burpFontSize > 0) css += `.burp-container { font-size:${s.burpFontSize}px!important; }`;



		const style = document.createElement('style');

		style.id = 'code-highlight-plugin-styles';

		style.textContent = css;

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





