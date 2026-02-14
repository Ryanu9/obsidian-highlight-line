export interface CodeHighlightSettings {
	enabled: boolean;
	backgroundColor: string;
	opacity: number;
	diffAddColor: string;
	diffAddOpacity: number;
	diffRemoveColor: string;
	diffRemoveOpacity: number;
	showPrefixInReadingMode: boolean;
	codeBlockBg: string;
}

export const DEFAULT_SETTINGS: CodeHighlightSettings = {
	enabled: true,
	backgroundColor: '#4d4d4d', // 默认灰色 (R:77, G:77, B:77)
	opacity: 0.5, // 默认 50% 透明度
	diffAddColor: '#2ea043', // 默认绿色
	diffAddOpacity: 0.3,
	diffRemoveColor: '#f85149', // 默认红色
	diffRemoveOpacity: 0.3,
	showPrefixInReadingMode: false,
	codeBlockBg: ''
};

// 高亮前缀定义
export const HIGHLIGHT_PREFIXES = {
	HIGHLIGHT: '>>>> ',  // 通用高亮
	DIFF_ADD: '>>>+ ',   // diff 添加（绿色）
	DIFF_REMOVE: '>>>- ', // diff 删除（红色）
} as const;

export const ALL_PREFIXES = [
	HIGHLIGHT_PREFIXES.HIGHLIGHT,
	HIGHLIGHT_PREFIXES.DIFF_ADD,
	HIGHLIGHT_PREFIXES.DIFF_REMOVE,
];

export type HighlightType = 'highlight' | 'diff-add' | 'diff-remove';

export function getPrefixForType(type: HighlightType): string {
	switch (type) {
		case 'highlight': return HIGHLIGHT_PREFIXES.HIGHLIGHT;
		case 'diff-add': return HIGHLIGHT_PREFIXES.DIFF_ADD;
		case 'diff-remove': return HIGHLIGHT_PREFIXES.DIFF_REMOVE;
	}
}

export function getTypeForPrefix(prefix: string): HighlightType | null {
	switch (prefix) {
		case HIGHLIGHT_PREFIXES.HIGHLIGHT: return 'highlight';
		case HIGHLIGHT_PREFIXES.DIFF_ADD: return 'diff-add';
		case HIGHLIGHT_PREFIXES.DIFF_REMOVE: return 'diff-remove';
		default: return null;
	}
}



