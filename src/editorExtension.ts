import { EditorView, Decoration, DecorationSet, ViewPlugin, ViewUpdate } from '@codemirror/view';
import { RangeSetBuilder, EditorState } from '@codemirror/state';
import type CodeHighlightPlugin from './main';

interface CodeBlock {
	from: number;
	to: number;
	startLine: number;
	endLine: number;
}

export function createEditorExtension(plugin: CodeHighlightPlugin) {
	return ViewPlugin.fromClass(
		class {
			decorations: DecorationSet;
			private codeBlocksCache: CodeBlock[] = [];
			private lastDocLength: number = 0;
			private lastCursorPos: number = -1;
			private cachedRgbaColor: string = '';

			constructor(view: EditorView) {
				this.cachedRgbaColor = this.getRgbaColor(plugin);
				this.updateCodeBlocksCache(view.state);
				this.decorations = this.buildDecorations(view);
			}

			update(update: ViewUpdate) {
				// 优化：只在必要时更新
				const docChanged = update.docChanged;
				const cursorPos = update.state.selection.main.head;
				const cursorMoved = cursorPos !== this.lastCursorPos;

				// 检查是否需要更新缓存的颜色
				const currentColor = this.getRgbaColor(plugin);
				if (currentColor !== this.cachedRgbaColor) {
					this.cachedRgbaColor = currentColor;
				}

				// 文档改变时，重新构建缓存
				if (docChanged) {
					this.updateCodeBlocksCache(update.state);
					this.decorations = this.buildDecorations(update.view);
					this.lastCursorPos = cursorPos;
					return;
				}

				// 光标移动时，只在进出代码块时更新
				if (cursorMoved) {
					const oldCursorInBlock = this.findCodeBlockContaining(this.lastCursorPos);
					const newCursorInBlock = this.findCodeBlockContaining(cursorPos);

					// 只有当光标进入或离开代码块时才更新
					if (oldCursorInBlock !== newCursorInBlock) {
						this.decorations = this.buildDecorations(update.view);
					}

					this.lastCursorPos = cursorPos;
				}

				// 视口改变时更新（滚动）
				if (update.viewportChanged) {
					this.decorations = this.buildDecorations(update.view);
				}
			}

			/**
			 * 更新代码块缓存 - 只在文档改变时调用
			 */
			updateCodeBlocksCache(state: EditorState) {
				this.codeBlocksCache = [];
				this.lastDocLength = state.doc.length;

				const doc = state.doc;
				let i = 1;

				while (i <= doc.lines) {
					const line = doc.line(i);
					const text = line.text.trim();

					// 找到代码块开始
					if (text.startsWith('```')) {
						const startLine = i;
						const startPos = line.from;

						// 查找代码块结束
						let endLine = -1;
						let endPos = -1;

						for (let j = i + 1; j <= doc.lines; j++) {
							const endLineCand = doc.line(j);
							const endText = endLineCand.text.trim();

							if (endText === '```') {
								endLine = j;
								endPos = endLineCand.to;
								break;
							}
						}

						if (endLine !== -1) {
							this.codeBlocksCache.push({
								from: startPos,
								to: endPos,
								startLine,
								endLine
							});
							i = endLine + 1;
							continue;
						}
					}

					i++;
				}
			}

			/**
			 * 查找包含指定位置的代码块
			 */
			findCodeBlockContaining(pos: number): CodeBlock | null {
				for (const block of this.codeBlocksCache) {
					if (pos >= block.from && pos <= block.to) {
						return block;
					}
				}
				return null;
			}

			buildDecorations(view: EditorView): DecorationSet {
				if (!plugin.settings.enabled) {
					return Decoration.none;
				}

				const builder = new RangeSetBuilder<Decoration>();
				const { state } = view;
				const cursorPos = state.selection.main.head;
				const cursorBlock = this.findCodeBlockContaining(cursorPos);

				// 只处理可见区域内的代码块（性能优化）
				const viewport = view.viewport;

				for (const block of this.codeBlocksCache) {
					// 跳过不在视口内的代码块
					if (block.to < viewport.from || block.from > viewport.to) {
						continue;
					}

					// 如果光标在当前代码块内，跳过高亮
					if (cursorBlock && cursorBlock.from === block.from) {
						continue;
					}

					// 遍历代码块内的行
					for (let lineNum = block.startLine + 1; lineNum < block.endLine; lineNum++) {
						const line = state.doc.line(lineNum);

						// 跳过不在视口内的行
						if (line.to < viewport.from || line.from > viewport.to) {
							continue;
						}

						const text = line.text;

						if (text.startsWith('>>>> ')) {
							// 添加行高亮装饰
							const lineDeco = Decoration.line({
								class: 'cm-code-highlight-line',
								attributes: {
									style: `background-color: ${this.cachedRgbaColor};`
								}
							});
							builder.add(line.from, line.from, lineDeco);

							// 隐藏 ">>>> " 前缀（5个字符）
							const hideDeco = Decoration.replace({});
							builder.add(line.from, line.from + 5, hideDeco);
						}
					}
				}

				return builder.finish();
			}

			getRgbaColor(plugin: CodeHighlightPlugin): string {
				const { backgroundColor, opacity } = plugin.settings;
				const hex = backgroundColor.replace('#', '');
				const r = parseInt(hex.substring(0, 2), 16);
				const g = parseInt(hex.substring(2, 4), 16);
				const b = parseInt(hex.substring(4, 6), 16);
				return `rgba(${r}, ${g}, ${b}, ${opacity})`;
			}
		},
		{
			decorations: v => v.decorations
		}
	);
}

