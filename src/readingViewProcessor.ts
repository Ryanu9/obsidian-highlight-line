import { MarkdownPostProcessorContext } from 'obsidian';
import type CodeHighlightPlugin from './main';

export function registerReadingViewProcessor(plugin: CodeHighlightPlugin) {
	plugin.registerMarkdownPostProcessor((element: HTMLElement, context: MarkdownPostProcessorContext) => {
		if (!plugin.settings.enabled) return;

		const codeBlocks = element.querySelectorAll('pre > code');
		codeBlocks.forEach((codeEl: HTMLElement) => {
			// Find text content to check if it needs highlighting
			const text = codeEl.textContent || "";
			if (!text.includes('>>>> ')) return;

			// If already processed, skip to avoid double processing
			if (codeEl.dataset.lineHighlighted === 'true') return;

			const html = codeEl.innerHTML;
			const lines = html.split('\n');
			let hasHighlight = false;

			const newLines = lines.map(line => {
				// Use a temporary div to get the plain text version of this HTML-encoded line
				const tempDiv = document.createElement('div');
				tempDiv.innerHTML = line;
				const plainText = tempDiv.textContent || "";

				// Stay consistent with editorExtension.ts: look for exactly ">>>> " at start
				if (plainText.startsWith('>>>> ')) {
					hasHighlight = true;
					// Remove the ">>>> " prefix. Match either raw or HTML entity version.
					let newLine = line.replace(/(&gt;|>){4}\s?/, "");
					return `<span class="code-highlight-line">${newLine}</span>`;
				}
				return line;
			});

			if (hasHighlight) {
				codeEl.innerHTML = newLines.join('\n');
				codeEl.dataset.lineHighlighted = 'true';
				// Add a class to the parent pre for further styling if needed
				codeEl.parentElement?.classList.add('has-line-highlight');
			}
		});
	});
}
