import { EditorView, Decoration, DecorationSet, ViewPlugin, ViewUpdate } from '@codemirror/view';
import { RangeSetBuilder, EditorState } from '@codemirror/state';
import type CodeHighlightPlugin from './main';
import { HIGHLIGHT_PREFIXES, ALL_PREFIXES, HighlightType } from './settings';

function hexToRgba(hex: string, opacity: number): string {
	hex = hex.replace('#', '');
	const r = parseInt(hex.substring(0, 2), 16);
	const g = parseInt(hex.substring(2, 4), 16);
	const b = parseInt(hex.substring(4, 6), 16);
	return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

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
			private cachedColors: Record<HighlightType, string> = {
				'highlight': '',
				'diff-add': '',
				'diff-remove': '',
			};

			constructor(view: EditorView) {
				this.updateCachedColors();
				this.updateCodeBlocksCache(view.state);
				this.decorations = this.buildDecorations(view);
			}

			update(update: ViewUpdate) {
				// 优化：只在必要时更新
				const docChanged = update.docChanged;
				const cursorPos = update.state.selection.main.head;
				const cursorMoved = cursorPos !== this.lastCursorPos;

				// 检查是否需要更新缓存的颜色
				this.updateCachedColors();

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
						const matched = this.matchPrefix(text);

						if (matched) {
							const { type, prefixLength } = matched;
							const cmClass = this.getCmClass(type);
							const color = this.cachedColors[type];

							// 添加行高亮装饰
							const lineDeco = Decoration.line({
								class: cmClass,
								attributes: {
									style: `background-color: ${color};`
								}
							});
							builder.add(line.from, line.from, lineDeco);

							// 隐藏前缀
							const hideDeco = Decoration.replace({});
							builder.add(line.from, line.from + prefixLength, hideDeco);
						}
					}
				}

				return builder.finish();
			}

			matchPrefix(text: string): { type: HighlightType; prefixLength: number } | null {
				if (text.startsWith(HIGHLIGHT_PREFIXES.HIGHLIGHT)) {
					return { type: 'highlight', prefixLength: HIGHLIGHT_PREFIXES.HIGHLIGHT.length };
				}
				if (text.startsWith(HIGHLIGHT_PREFIXES.DIFF_ADD)) {
					return { type: 'diff-add', prefixLength: HIGHLIGHT_PREFIXES.DIFF_ADD.length };
				}
				if (text.startsWith(HIGHLIGHT_PREFIXES.DIFF_REMOVE)) {
					return { type: 'diff-remove', prefixLength: HIGHLIGHT_PREFIXES.DIFF_REMOVE.length };
				}
				return null;
			}

			getCmClass(type: HighlightType): string {
				switch (type) {
					case 'highlight': return 'cm-code-highlight-line';
					case 'diff-add': return 'cm-code-highlight-diff-add';
					case 'diff-remove': return 'cm-code-highlight-diff-remove';
				}
			}

			updateCachedColors() {
				const s = plugin.settings;
				this.cachedColors['highlight'] = hexToRgba(s.backgroundColor, s.opacity);
				this.cachedColors['diff-add'] = hexToRgba(s.diffAddColor, s.diffAddOpacity);
				this.cachedColors['diff-remove'] = hexToRgba(s.diffRemoveColor, s.diffRemoveOpacity);
			}
		},
		{
			decorations: v => v.decorations
		}
	);
}

