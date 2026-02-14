import { Editor, MarkdownView } from 'obsidian';
import type CodeHighlightPlugin from './main';
import { HIGHLIGHT_PREFIXES, ALL_PREFIXES } from './settings';

/**
 * Register toggle highlight commands for all three prefix types
 * 注册三种高亮前缀的切换命令
 */
export function registerToggleHighlightCommand(plugin: CodeHighlightPlugin): void {
    plugin.addCommand({
        id: 'toggle-highlight-prefix',
        name: 'Toggle highlight (>>>> )',
        editorCallback: (editor: Editor, _view: MarkdownView) => {
            togglePrefix(editor, HIGHLIGHT_PREFIXES.HIGHLIGHT);
        }
    });

    plugin.addCommand({
        id: 'toggle-diff-add-prefix',
        name: 'Toggle diff add (>>>+ )',
        editorCallback: (editor: Editor, _view: MarkdownView) => {
            togglePrefix(editor, HIGHLIGHT_PREFIXES.DIFF_ADD);
        }
    });

    plugin.addCommand({
        id: 'toggle-diff-remove-prefix',
        name: 'Toggle diff remove (>>>- )',
        editorCallback: (editor: Editor, _view: MarkdownView) => {
            togglePrefix(editor, HIGHLIGHT_PREFIXES.DIFF_REMOVE);
        }
    });
}

/**
 * Toggle a specific prefix for selected lines.
 * If the line already has a different prefix, replace it.
 * If all lines already have the target prefix, remove it.
 */
function togglePrefix(editor: Editor, targetPrefix: string): void {
    const { from, to } = getLineRange(editor);

    // Get all lines in selection
    const lines: string[] = [];
    for (let i = from; i <= to; i++) {
        lines.push(editor.getLine(i));
    }

    // Check if all lines already have the target prefix
    const allHaveTarget = lines.every(line => line.startsWith(targetPrefix));

    const newLines = lines.map(line => {
        if (allHaveTarget) {
            // Remove target prefix
            return line.substring(targetPrefix.length);
        } else {
            // Remove any existing prefix first, then add target
            const stripped = stripAnyPrefix(line);
            return line.startsWith(targetPrefix) ? line : targetPrefix + stripped;
        }
    });

    // Replace all lines at once
    const startPos = { line: from, ch: 0 };
    const endPos = { line: to, ch: editor.getLine(to).length };
    editor.replaceRange(newLines.join('\n'), startPos, endPos);

    // Restore selection
    const newEndCh = editor.getLine(to).length;
    editor.setSelection(
        { line: from, ch: 0 },
        { line: to, ch: newEndCh }
    );
}

/**
 * Remove any known highlight prefix from a line
 */
function stripAnyPrefix(line: string): string {
    for (const prefix of ALL_PREFIXES) {
        if (line.startsWith(prefix)) {
            return line.substring(prefix.length);
        }
    }
    return line;
}

/**
 * Get the line range of the current selection
 */
function getLineRange(editor: Editor): { from: number; to: number } {
    const selection = editor.listSelections()[0];
    const anchor = selection.anchor;
    const head = selection.head;

    const fromLine = Math.min(anchor.line, head.line);
    const toLine = Math.max(anchor.line, head.line);

    return { from: fromLine, to: toLine };
}
