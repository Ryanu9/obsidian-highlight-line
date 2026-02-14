import { MarkdownPostProcessorContext } from 'obsidian';
import type CodeHighlightPlugin from './main';
import { HIGHLIGHT_PREFIXES } from './settings';

// 前缀到 CSS 类名的映射
const PREFIX_CLASS_MAP: { prefix: string; cssClass: string }[] = [
	{ prefix: HIGHLIGHT_PREFIXES.HIGHLIGHT, cssClass: 'code-highlight-line' },
	{ prefix: HIGHLIGHT_PREFIXES.DIFF_ADD, cssClass: 'code-highlight-diff-add' },
	{ prefix: HIGHLIGHT_PREFIXES.DIFF_REMOVE, cssClass: 'code-highlight-diff-remove' },
];

/**
 * Strip N characters from the beginning of an HTML fragment using DOM traversal.
 * This correctly handles text split across multiple <span> tags by syntax highlighting.
 */
function stripHtmlPrefix(html: string, prefixLength: number): string {
	const container = document.createElement('span');
	container.innerHTML = html;

	let charsToRemove = prefixLength;
	const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);

	while (walker.nextNode() && charsToRemove > 0) {
		const node = walker.currentNode as Text;
		const len = node.textContent!.length;
		if (len <= charsToRemove) {
			charsToRemove -= len;
			node.textContent = '';
		} else {
			node.textContent = node.textContent!.substring(charsToRemove);
			charsToRemove = 0;
		}
	}

	// Clean up empty elements left behind
	container.querySelectorAll('span:empty').forEach(el => el.remove());

	return container.innerHTML;
}

export function registerReadingViewProcessor(plugin: CodeHighlightPlugin) {
	plugin.registerMarkdownPostProcessor((element: HTMLElement, context: MarkdownPostProcessorContext) => {
		if (!plugin.settings.enabled) return;

		const codeBlocks = element.querySelectorAll('pre > code');
		codeBlocks.forEach((codeEl: Element) => {
			const htmlCodeEl = codeEl as HTMLElement;

			// Use setTimeout to ensure we run after Obsidian's syntax highlighting
			setTimeout(() => {
				const text = htmlCodeEl.textContent || "";
				// Check if any prefix is present
				const hasAnyPrefix = PREFIX_CLASS_MAP.some(p => text.includes(p.prefix));
				if (!hasAnyPrefix) return;

				const html = htmlCodeEl.innerHTML;
				const lines = html.split('\n');
				let hasHighlight = false;

				const highlightedIndices = new Set<number>();
				const newLines = lines.map((line, index) => {
					const tempDiv = document.createElement('div');
					tempDiv.innerHTML = line;
					const plainText = tempDiv.textContent || "";

					for (const entry of PREFIX_CLASS_MAP) {
						if (plainText.startsWith(entry.prefix)) {
							hasHighlight = true;
							highlightedIndices.add(index);
							let newLine = line;
							if (!plugin.settings.showPrefixInReadingMode) {
								newLine = stripHtmlPrefix(line, entry.prefix.length);
							}
							return `<span class="${entry.cssClass}">${newLine}</span>`;
						}
					}
					return line;
				});

				if (hasHighlight) {
					// Join lines, but omit \n after display:block highlight spans
					// to avoid extra blank lines in <pre> context
					let joined = newLines[0];
					for (let i = 1; i < newLines.length; i++) {
						if (!highlightedIndices.has(i - 1)) {
							joined += '\n';
						}
						joined += newLines[i];
					}
					htmlCodeEl.innerHTML = joined;
					htmlCodeEl.dataset.lineHighlighted = 'true';
					htmlCodeEl.parentElement?.classList.add('has-line-highlight');
				}
			}, 0);
		});
	});
}
