import type CodeHighlightPlugin from './main';
import { MarkdownView, Menu } from 'obsidian';
import { HIGHLIGHT_PREFIXES } from './settings';

// ========== Color references (CSS variables defined in styles.css) ==========

const REQ = {
	METHOD:      'var(--burp-req-method)',
	PATH:        'var(--burp-req-path)',
	VERSION:     'var(--burp-req-version)',
	HEADER_NAME: 'var(--burp-req-hdr-name)',
	HEADER_VAL:  'var(--burp-req-hdr-val)',
	BODY:        'var(--burp-req-body)',
	LINE_NUM:    'var(--burp-line-num)',
};

const RES = {
	VERSION:     'var(--burp-res-version)',
	HEADER_NAME: 'var(--burp-res-hdr-name)',
	HEADER_VAL:  'var(--burp-res-hdr-val)',
	BODY:        'var(--burp-res-body)',
	LINE_NUM:    'var(--burp-line-num)',
	TAG:         'var(--burp-tag)',
	ATTR_NAME:   'var(--burp-attr-name)',
	ATTR_VAL:    'var(--burp-attr-val)',
	COMMENT:     'var(--burp-comment)',
	STATUS_2XX:  'var(--burp-status-2xx)',
	STATUS_3XX:  'var(--burp-status-3xx)',
	STATUS_4XX:  'var(--burp-status-4xx)',
};

// ========== Utility ==========

function esc(t: string): string {
	return t
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

function cs(text: string, color: string, bold = false): string {
	if (!text) return '';
	const st = bold ? `color:${color};font-weight:bold` : `color:${color}`;
	return `<span style="${st}">${esc(text)}</span>`;
}

function statusColor(code: number): string {
	if (code < 300) return RES.STATUS_2XX;
	if (code < 400) return RES.STATUS_3XX;
	return RES.STATUS_4XX;
}

// ========== Content Parsing ==========

function parseContent(source: string): { request: string; response: string } {
	const lines = source.split('\n');
	for (let i = 0; i < lines.length; i++) {
		if (/^={3,}\s*$/.test(lines[i]!)) {
			return {
				request: lines.slice(0, i).join('\n'),
				response: lines.slice(i + 1).join('\n'),
			};
		}
	}
	return { request: source, response: '' };
}

// ========== HTTP Syntax Highlighting ==========

const RE_REQ = /^(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS|TRACE|CONNECT)\s+(\S+)\s+(HTTP\/[\d.]+)$/;
const RE_STA = /^(HTTP\/[\d.]+)\s+(\d{3})\s*(.*)$/;
const RE_HDR = /^([A-Za-z][A-Za-z0-9\-]*)\s*(:)\s*(.*)$/;

type Phase = 'first' | 'headers' | 'body';

function hlRequest(lines: string[]): string[] {
	let phase: Phase = 'first';
	return lines.map(line => {
		if (phase === 'first') {
			phase = 'headers';
			const m = line.match(RE_REQ);
			if (m) {
				return cs(m[1]!, REQ.METHOD, true) + ' ' +
					cs(m[2]!, REQ.PATH, true) + ' ' +
					cs(m[3]!, REQ.VERSION, true);
			}
		}
		if (phase === 'headers') {
			if (!line.trim()) { phase = 'body'; return ''; }
			const m = line.match(RE_HDR);
			if (m) {
				return cs(m[1]!, REQ.HEADER_NAME, true) +
					cs(':', REQ.HEADER_NAME, true) + ' ' +
					cs(m[3]!, REQ.HEADER_VAL, true);
			}
			return cs(line, REQ.HEADER_VAL, true);
		}
		if (!line.trim()) return '';
		return cs(line, REQ.BODY, true);
	});
}

function hlResponse(lines: string[]): string[] {
	let phase: Phase = 'first';
	return lines.map(line => {
		if (phase === 'first') {
			phase = 'headers';
			const m = line.match(RE_STA);
			if (m) {
				const c = statusColor(parseInt(m[2]!));
				return cs(m[1]!, RES.VERSION, true) + ' ' +
					cs(m[2]!, c, true) + ' ' +
					cs(m[3]!, c, true);
			}
		}
		if (phase === 'headers') {
			if (!line.trim()) { phase = 'body'; return ''; }
			const m = line.match(RE_HDR);
			if (m) {
				return cs(m[1]!, RES.HEADER_NAME, true) +
					cs(':', RES.HEADER_NAME, true) + ' ' +
					cs(m[3]!, RES.HEADER_VAL, true);
			}
			return cs(line, RES.HEADER_VAL, true);
		}
		if (!line.trim()) return '';
		return hlHtmlLine(line);
	});
}

// ========== HTML Body Highlighting ==========

function hlHtmlLine(line: string): string {
	const r: string[] = [];
	let i = 0;
	while (i < line.length) {
		if (line[i] === '<') {
			const dt = line.substring(i).match(/^<!DOCTYPE[^>]*>/i);
			if (dt) { r.push(cs(dt[0], RES.COMMENT, true)); i += dt[0].length; continue; }
			const cm = line.substring(i).match(/^<!--[\s\S]*?-->/);
			if (cm) { r.push(cs(cm[0], RES.COMMENT)); i += cm[0].length; continue; }
			const tg = line.substring(i).match(/^<\/?[a-zA-Z][a-zA-Z0-9]*(?:\s[^>]*)?\/?>/);
			if (tg) { r.push(hlTag(tg[0])); i += tg[0].length; continue; }
			r.push(esc('<')); i++; continue;
		}
		let txt = '';
		while (i < line.length && line[i] !== '<') { txt += line[i]; i++; }
		r.push(cs(txt, RES.BODY, true));
	}
	return r.join('');
}

function hlTag(tag: string): string {
	const r: string[] = [];
	let i: number;
	if (tag[1] === '/') {
		r.push(cs('</', RES.TAG, true));
		i = 2;
	} else {
		r.push(cs('<', RES.TAG, true));
		i = 1;
	}

	let name = '';
	while (i < tag.length && /[a-zA-Z0-9\-]/.test(tag[i]!)) { name += tag[i]; i++; }
	r.push(cs(name, RES.TAG, true));

	while (i < tag.length) {
		if (tag[i] === '>' || (tag[i] === '/' && tag[i + 1] === '>')) {
			r.push(cs(tag.substring(i), RES.TAG, true));
			break;
		}
		if (/\s/.test(tag[i]!)) { r.push(tag[i]!); i++; continue; }
		if (tag[i] === '=') {
			r.push(cs('=', RES.BODY, true));
			i++;
			if (i < tag.length && (tag[i] === '"' || tag[i] === "'")) {
				const q = tag[i]; let v = q!; i++;
				while (i < tag.length && tag[i] !== q) { v += tag[i]; i++; }
				if (i < tag.length) { v += tag[i]; i++; }
				r.push(cs(v, RES.ATTR_VAL, true));
			}
			continue;
		}
		let attr = '';
		while (i < tag.length && !/[\s=>"'/]/.test(tag[i]!)) { attr += tag[i]; i++; }
		if (attr) r.push(cs(attr, RES.ATTR_NAME, true));
	}
	return r.join('');
}

// ========== Highlight Prefix Support ==========

const PREFIXES = [
	{ p: HIGHLIGHT_PREFIXES.HIGHLIGHT, c: 'code-highlight-line' },
	{ p: HIGHLIGHT_PREFIXES.DIFF_ADD, c: 'code-highlight-diff-add' },
	{ p: HIGHLIGHT_PREFIXES.DIFF_REMOVE, c: 'code-highlight-diff-remove' },
];

function stripPfx(line: string): { text: string; pfx: string; cls: string } {
	for (const e of PREFIXES) {
		if (line.startsWith(e.p)) {
			return { text: line.substring(e.p.length), pfx: e.p, cls: e.c };
		}
	}
	return { text: line, pfx: '', cls: '' };
}

// ========== Panel Rendering ==========

function renderPanel(
	parent: HTMLElement,
	title: string,
	content: string,
	panelCls: string,
	mode: 'request' | 'response',
	plugin: CodeHighlightPlugin
): void {
	const panel = parent.createDiv({ cls: `burp-panel ${panelCls}` });
	panel.createDiv({ cls: 'burp-panel-header', text: title });

	const pre = panel.createEl('pre', { cls: 'burp-content' });
	const rawLines = content.split('\n');

	// Trim trailing empty lines
	while (rawLines.length > 1 && !rawLines[rawLines.length - 1]!.trim()) rawLines.pop();

	// Strip prefixes
	const processed = rawLines.map(l => stripPfx(l));
	const stripped = processed.map(p => p.text);

	// Highlight
	const highlighted = mode === 'request' ? hlRequest(stripped) : hlResponse(stripped);
	const lineNumColor = mode === 'request' ? REQ.LINE_NUM : RES.LINE_NUM;

	for (let i = 0; i < rawLines.length; i++) {
		const div = pre.createDiv({ cls: 'burp-line' });
		if (processed[i]!.cls) div.addClass(processed[i]!.cls);

		const num = div.createSpan({ cls: 'burp-line-num' });
		num.style.color = lineNumColor;
		num.textContent = String(i + 1);

		const txt = div.createSpan({ cls: 'burp-line-text' });
		let html = highlighted[i] || '';
		if (processed[i]!.pfx && plugin.settings.showPrefixInReadingMode) {
			html = esc(processed[i]!.pfx) + html;
		}
		txt.innerHTML = html || '&nbsp;';
	}
}

// ========== Main Registration ==========

export function registerBurpProcessor(plugin: CodeHighlightPlugin): void {
	plugin.registerMarkdownCodeBlockProcessor('burp', (source, el, ctx) => {
		if (!plugin.settings.burpEnabled) {
			el.createEl('pre').createEl('code', { text: source });
			return;
		}
		const { request, response } = parseContent(source);
		const container = el.createDiv({ cls: 'burp-container' });

		if (request.trim()) {
			renderPanel(container, 'Request', request, 'burp-request', 'request', plugin);
		}
		if (response.trim()) {
			renderPanel(container, 'Response', response, 'burp-response', 'response', plugin);
		}

		// If both empty, show empty request panel
		if (!request.trim() && !response.trim()) {
			renderPanel(container, 'Request', '', 'burp-request', 'request', plugin);
		}

		// Ctrl+Click / Right-click to edit
		const enterEdit = () => {
			const info = ctx.getSectionInfo(el);
			if (info) {
				const view = plugin.app.workspace.getActiveViewOfType(MarkdownView);
				if (view) {
					view.editor.setCursor({ line: info.lineStart + 1, ch: 0 });
					view.editor.focus();
				}
			}
		};

		container.addEventListener('click', (e) => {
			if (e.ctrlKey) { enterEdit(); e.preventDefault(); }
		});

		container.addEventListener('contextmenu', (e) => {
			const menu = new Menu();
			menu.addItem(item =>
				item.setTitle('✏️ Edit Code Block')
					.setIcon('pencil')
					.onClick(enterEdit)
			);
			menu.showAtPosition({ x: e.pageX, y: e.pageY });
			e.preventDefault();
		});
	});
}
