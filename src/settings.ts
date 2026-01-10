export interface CodeHighlightSettings {
	enabled: boolean;
	backgroundColor: string;
	opacity: number;
	showPrefixInReadingMode: boolean;
}

export const DEFAULT_SETTINGS: CodeHighlightSettings = {
	enabled: true,
	backgroundColor: '#4d4d4d', // 默认灰色 (R:77, G:77, B:77)
	opacity: 0.5, // 默认 50% 透明度
	showPrefixInReadingMode: false
};



