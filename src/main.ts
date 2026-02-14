import { Plugin, Menu, MarkdownView } from 'obsidian';
import { CodeHighlightSettings, DEFAULT_SETTINGS, HIGHLIGHT_PREFIXES } from './settings';
import { CodeHighlightSettingTab } from './settingsTab';
import { registerReadingViewProcessor } from './readingViewProcessor';
import { createEditorExtension } from './editorExtension';
import { registerToggleHighlightCommand } from './toggleHighlightCommand';
import { registerPromptHighlightProcessor } from './promptHighlight';
import { renderAnsi } from './ansi';
import { ansiEditorExtension } from './ansiEditor';

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

		// 注册 ANSI 代码块处理器 (阅读模式)
		this.registerMarkdownCodeBlockProcessor("ansi", (source, el, ctx) => {
			const container = el.createEl("pre", { cls: "ansi-block" });

			// 逐行处理，支持 >>>> / >>>+ / >>>- 高亮前缀
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

				// 非最后一行添加换行（高亮行已有 display:block，不需要额外换行）
				if (index < lines.length - 1 && !cssClass) {
					container.appendChild(document.createTextNode('\n'));
				}
			});

			const enterEditMode = () => {
				const sectionInfo = ctx.getSectionInfo(el);
				if (sectionInfo) {
					const view = this.app.workspace.getActiveViewOfType(MarkdownView);
					if (view) {
						const visibleLine = sectionInfo.lineStart + 1;
						view.editor.setCursor({ line: visibleLine, ch: 0 });
						view.editor.focus();
					}
				}
			};

			container.addEventListener("click", (event) => {
				if (event.ctrlKey) {
					enterEditMode();
					event.preventDefault();
				}
			});

			container.addEventListener("contextmenu", (event) => {
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
		});

		// 注册 ANSI 编辑器扩展 (Live Preview)
		this.registerEditorExtension(ansiEditorExtension);

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


