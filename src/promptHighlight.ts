import { MarkdownPostProcessorContext } from 'obsidian';
import type CodeHighlightPlugin from './main';

/**
 * Command prompt highlighter for bash/powershell code blocks
 * 命令提示符高亮，仅在阅读模式下生效
 * コマンドプロンプトのハイライト（閲覧モードのみ）
 */

// Color definitions
const COLORS = {
    // PowerShell prompt
    PS_PROMPT: '#E5E510',    // PS 黄色
    PS_PATH: '#4188D6',      // 路径蓝色

    // Windows CMD prompt
    WIN_CMD_PATH: '#4188D6', // 路径蓝色
    WIN_CMD_ARROW: '#4188D6', // > 符号蓝色（与路径一致）

    // Evil-WinRM prompt
    EVIL_WINRM: '#F14C4C',   // *Evil-WinRM* 红色

    // Linux user prompt ($ symbol) - green
    USER_PROMPT: '#0DBC79',  // 绿色 (用户 $)
    USER_PATH: '#0DBC79',    // 路径绿色（与提示符一致）

    // Linux root prompt (# symbol) - red
    ROOT_PROMPT: '#F14742',  // 红色 (root #)
    ROOT_PATH: '#F14742',    // 路径红色（与提示符一致）

    // Kali Linux prompt
    KALI_USER: '#F14742',    // root㏿㉿kali 红色
    KALI_BRACKET: '#2472C8', // ┌──()-[] └─ 蓝色
    KALI_PATH: '#dadada',    // 路径白色

    // Pwncat shell prefix
    PWNCAT_PREFIX: '#E5E510', // (remote) (local) 黄色
    PWNCAT_LOCAL: '#E5E510',  // pwncat 黄色

    // Command syntax highlighting
    CMD_COMMAND: '#11A8CD',  // 命令 浅黄色
    CMD_TEXT: '#DCDCDC',     // 普通文本 浅黄色
    CMD_PARAM: '#0DB374',    // 参数 蓝色
    CMD_STRING: '#E5D818',   // 字符串 橙色
    CMD_SYMBOL: '#236EC0',   // 符号 | > { } () $ 紫色
};

// Optional highlight prefix pattern (matches >>>> , >>>+ , >>>- , or nothing)
const HIGHLIGHT_PREFIX = /^(>>>>\ |>>>\+\ |>>>-\ )?/;

// Regex patterns for different prompt types (with optional highlight prefix)
const HIGHLIGHT_PREFIX_PATTERN = '(>>>> |>>>\\+ |>>>- )?';
const PATTERNS = {
    // PowerShell: PS E:\path\to\dir>
    POWERSHELL: new RegExp(`^${HIGHLIGHT_PREFIX_PATTERN}(PS\\s+)([A-Za-z]:\\\\[^>]*)(>)`),

    // Windows CMD: C:\Users\Administrator>
    WINDOWS_CMD: new RegExp(`^${HIGHLIGHT_PREFIX_PATTERN}([A-Za-z]:\\\\[^>]*)(>)`),

    // Evil-WinRM: *Evil-WinRM* PS C:\Users\path>
    EVIL_WINRM: new RegExp(`^${HIGHLIGHT_PREFIX_PATTERN}(\\*Evil-WinRM\\*)(\\s+)(PS\\s+)([A-Za-z]:\\\\[^>]*)(>)`),

    // Linux user: user@host:/path$ or user@host:path$ (with optional (remote)/(local) prefix)
    LINUX_USER: new RegExp(`^${HIGHLIGHT_PREFIX_PATTERN}(\\((?:remote|local)\\) )?([a-zA-Z_][a-zA-Z0-9_-]*)(@)([a-zA-Z0-9._-]+)(:\\s*)([^\\$#]*)(\\$)`),

    // Linux root: root@host:/path# or root@host:path# (with optional (remote)/(local) prefix)
    LINUX_ROOT: new RegExp(`^${HIGHLIGHT_PREFIX_PATTERN}(\\((?:remote|local)\\) )?(root)(@)([a-zA-Z0-9._-]+)(:\\s*)([^#]*)(#)`),

    // Pwncat local prompt: (local) pwncat$
    PWNCAT_LOCAL: new RegExp(`^${HIGHLIGHT_PREFIX_PATTERN}(\\(local\\) )(pwncat)(\\$)`),

    // Kali prompt line 1: ┌──(user㉿kali)-[path] 
    KALI_LINE1: new RegExp(`^${HIGHLIGHT_PREFIX_PATTERN}(┌──\\()([^㉿]+)(㉿)([^\\)]+)(\\)-\\[)([^\\]]+)(\\])`),

    // Kali prompt line 2: └─# or └─$
    KALI_LINE2: new RegExp(`^${HIGHLIGHT_PREFIX_PATTERN}(└─)([$#])(\\s*)`),
};

/**
 * Register the prompt highlight processor
 */
export function registerPromptHighlightProcessor(plugin: CodeHighlightPlugin): void {
    plugin.registerMarkdownPostProcessor((element: HTMLElement, _context: MarkdownPostProcessorContext) => {
        if (!plugin.settings.enabled) return;

        // Only process bash, sh, shell, powershell, pwsh code blocks
        const codeBlocks = element.querySelectorAll('pre > code');
        codeBlocks.forEach((codeEl: Element) => {
            const htmlCodeEl = codeEl as HTMLElement;
            const language = getCodeBlockLanguage(htmlCodeEl);

            if (!isShellLanguage(language)) return;

            // Use setTimeout to ensure we run after Obsidian's syntax highlighting
            setTimeout(() => {
                // Skip if already processed
                if (htmlCodeEl.dataset.promptHighlighted === 'true') return;
                processCodeBlock(htmlCodeEl);
            }, 0);
        });
    });
}

/**
 * Get the language of the code block from class name
 */
function getCodeBlockLanguage(codeEl: HTMLElement): string {
    const classList = codeEl.className.split(' ');
    for (const cls of classList) {
        if (cls.startsWith('language-')) {
            return cls.replace('language-', '').toLowerCase();
        }
    }
    return '';
}

/**
 * Check if the language is a shell language
 */
function isShellLanguage(language: string): boolean {
    const shellLanguages = ['bash', 'sh', 'shell', 'zsh', 'powershell', 'pwsh', 'ps1', 'console', 'terminal', 'cmd'];
    return shellLanguages.includes(language);
}

/**
 * Process a code block and highlight prompts
 */
function processCodeBlock(codeEl: HTMLElement): void {
    const html = codeEl.innerHTML;
    const lines = html.split('\n');
    let hasHighlight = false;

    const newLines = lines.map(line => {
        // Get plain text version for pattern matching
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = line;
        const plainText = tempDiv.textContent || '';

        const result = highlightPrompt(plainText);
        if (result) {
            hasHighlight = true;
            return result;
        }
        return line;
    });

    if (hasHighlight) {
        codeEl.innerHTML = newLines.join('\n');
        codeEl.dataset.promptHighlighted = 'true';
    }
}

/**
 * Highlight prompt in a line, returns null if no match
 */
function highlightPrompt(plainText: string): string | null {
    // Try each pattern (order matters - more specific patterns first)

    // Evil-WinRM (check before PowerShell since it contains PS)
    const evilWinRMMatch = plainText.match(PATTERNS.EVIL_WINRM);
    if (evilWinRMMatch) {
        return highlightEvilWinRM(evilWinRMMatch, plainText);
    }

    // PowerShell
    const psMatch = plainText.match(PATTERNS.POWERSHELL);
    if (psMatch) {
        return highlightPowerShell(psMatch, plainText);
    }

    // Windows CMD (check after PowerShell since PS has 'PS ' prefix)
    const cmdMatch = plainText.match(PATTERNS.WINDOWS_CMD);
    if (cmdMatch) {
        return highlightWindowsCmd(cmdMatch, plainText);
    }

    // Kali line 1
    const kaliLine1Match = plainText.match(PATTERNS.KALI_LINE1);
    if (kaliLine1Match) {
        return highlightKaliLine1(kaliLine1Match, plainText);
    }

    // Kali line 2
    const kaliLine2Match = plainText.match(PATTERNS.KALI_LINE2);
    if (kaliLine2Match) {
        return highlightKaliLine2(kaliLine2Match, plainText);
    }

    // Pwncat local prompt (check before Linux user)
    const pwncatLocalMatch = plainText.match(PATTERNS.PWNCAT_LOCAL);
    if (pwncatLocalMatch) {
        return highlightPwncatLocal(pwncatLocalMatch, plainText);
    }

    // Linux root (check before user since root is more specific)
    const rootMatch = plainText.match(PATTERNS.LINUX_ROOT);
    if (rootMatch) {
        return highlightLinuxRoot(rootMatch, plainText);
    }

    // Linux user
    const userMatch = plainText.match(PATTERNS.LINUX_USER);
    if (userMatch) {
        return highlightLinuxUser(userMatch, plainText);
    }

    return null;
}

/**
 * Create a colored span
 */
function colorSpan(text: string, color: string, bold: boolean = false): string {
    const style = bold ? `color: ${color}; font-weight: bold` : `color: ${color}`;
    return `<span style="${style}">${escapeHtml(text)}</span>`;
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Special symbols: | > < { } () $ [] * & !
// Pipe symbol | resets command recognition (next token is new command)
const PIPE_SYMBOLS = '|';
const SPECIAL_SYMBOLS = '|><{}()$[]*&!';

/**
 * Highlight command syntax (command, params, strings, brackets)
 * 高亮命令语法：命令、参数、字符串、括号
 * - 管道符 | 后面的第一个词识别为新命令
 * - 特殊符号加粗
 * - ! 高亮后面所有文本
 */
function highlightCommandSyntax(commandText: string): string {
    if (!commandText || !commandText.trim()) {
        return escapeHtml(commandText);
    }

    const result: string[] = [];
    let i = 0;
    let isFirstToken = true;

    while (i < commandText.length) {
        const char = commandText[i];

        // Handle whitespace
        if (/\s/.test(char)) {
            result.push(escapeHtml(char));
            i++;
            continue;
        }

        // Handle ! - highlight until whitespace (bold)
        if (char === '!') {
            let bangText = '!';
            i++;
            // Continue until whitespace
            while (i < commandText.length && !/\s/.test(commandText[i])) {
                bangText += commandText[i];
                i++;
            }
            result.push(colorSpan(bangText, COLORS.CMD_SYMBOL, true));
            isFirstToken = false;
            continue;
        }

        // Handle strings (single or double quotes)
        // Note: In bash, single quotes do NOT support escape, double quotes do
        if (char === '"' || char === "'") {
            const quote = char;
            let str = quote;
            i++;
            if (quote === '"') {
                // Double quotes: handle escape characters
                while (i < commandText.length && commandText[i] !== quote) {
                    if (commandText[i] === '\\' && i + 1 < commandText.length) {
                        str += commandText[i] + commandText[i + 1];
                        i += 2;
                    } else {
                        str += commandText[i];
                        i++;
                    }
                }
            } else {
                // Single quotes: no escape, just find closing quote
                while (i < commandText.length && commandText[i] !== quote) {
                    str += commandText[i];
                    i++;
                }
            }
            if (i < commandText.length) {
                str += commandText[i]; // closing quote
                i++;
            }
            result.push(colorSpan(str, COLORS.CMD_STRING));
            isFirstToken = false;
            continue;
        }

        // Handle pipe symbol | - next token is a new command
        if (PIPE_SYMBOLS.includes(char)) {
            result.push(colorSpan(char, COLORS.CMD_SYMBOL, true));
            i++;
            isFirstToken = true; // Reset for new command after pipe
            continue;
        }

        // Handle other special symbols: > < { } () $ [] * &
        if (SPECIAL_SYMBOLS.includes(char)) {
            result.push(colorSpan(char, COLORS.CMD_SYMBOL, true));
            i++;
            isFirstToken = false;
            continue;
        }

        // Handle parameters (starts with - or --)
        if (char === '-') {
            let param = '';
            while (i < commandText.length && !/[\s"'()\[\]{}|<>*&!]/.test(commandText[i])) {
                param += commandText[i];
                i++;
            }
            result.push(colorSpan(param, COLORS.CMD_PARAM));
            isFirstToken = false;
            continue;
        }

        // Handle regular tokens (command or arguments)
        let token = '';
        while (i < commandText.length && !/[\s"'()\[\]{}\-|<>*&!]/.test(commandText[i])) {
            token += commandText[i];
            i++;
        }
        // Check if next char is - but token is not empty (like in filenames with -)
        while (i < commandText.length && commandText[i] === '-' && !/[\s"'()\[\]{}|<>*&!]/.test(commandText[i])) {
            token += commandText[i];
            i++;
            while (i < commandText.length && !/[\s"'()\[\]{}\-|<>*&!]/.test(commandText[i])) {
                token += commandText[i];
                i++;
            }
        }

        if (token) {
            if (isFirstToken) {
                // First token is the command
                result.push(colorSpan(token, COLORS.CMD_COMMAND));
                isFirstToken = false;
            } else {
                // Subsequent tokens are regular text (file paths, etc.)
                result.push(colorSpan(token, COLORS.CMD_TEXT));
            }
        }
    }

    return result.join('');
}

/**
 * Highlight PowerShell prompt: PS E:\path>
 * PS 颜色为蓝色
 */
function highlightPowerShell(match: RegExpMatchArray, plainText: string): string {
    const [fullMatch, prefix, ps, path, arrow] = match;
    const rest = plainText.substring(fullMatch.length);

    return (prefix ? escapeHtml(prefix) : '') +
        colorSpan(ps, COLORS.PS_PROMPT, true) +
        colorSpan(path, COLORS.PS_PATH, true) +
        colorSpan(arrow, COLORS.PS_PATH, true) +
        highlightCommandSyntax(rest);
}

/**
 * Highlight Windows CMD prompt: C:\Users\Administrator>
 * 路径蓝色
 */
function highlightWindowsCmd(match: RegExpMatchArray, plainText: string): string {
    const [fullMatch, prefix, path, arrow] = match;
    const rest = plainText.substring(fullMatch.length);

    return (prefix ? escapeHtml(prefix) : '') +
        colorSpan(path, COLORS.WIN_CMD_PATH, true) +
        colorSpan(arrow, COLORS.WIN_CMD_ARROW, true) +
        highlightCommandSyntax(rest);
}

/**
 * Highlight Evil-WinRM prompt: *Evil-WinRM* PS C:\Users\path>
 * *Evil-WinRM* 红色 (#F14C4C)，PS 和路径参考 PowerShell 高亮
 */
function highlightEvilWinRM(match: RegExpMatchArray, plainText: string): string {
    const [fullMatch, prefix, evilWinRM, space1, ps, path, arrow] = match;
    const rest = plainText.substring(fullMatch.length);

    return (prefix ? escapeHtml(prefix) : '') +
        colorSpan(evilWinRM, COLORS.EVIL_WINRM, true) +
        escapeHtml(space1) +
        colorSpan(ps, COLORS.PS_PROMPT, true) +
        colorSpan(path, COLORS.PS_PATH, true) +
        colorSpan(arrow, COLORS.PS_PATH, true) +
        highlightCommandSyntax(rest);
}

/**
 * Highlight Linux user prompt: user@host:path$ (with optional (remote)/(local) prefix)
 * $ 符号表示普通用户，使用绿色
 */
function highlightLinuxUser(match: RegExpMatchArray, plainText: string): string {
    const [fullMatch, prefix, pwncatPrefix, user, at, host, colon, path, dollar] = match;
    const rest = plainText.substring(fullMatch.length);

    return (prefix ? escapeHtml(prefix) : '') +
        (pwncatPrefix ? colorSpan(pwncatPrefix, COLORS.PWNCAT_PREFIX, true) : '') +
        colorSpan(user + at + host + colon, COLORS.USER_PROMPT, true) +
        colorSpan(path, COLORS.USER_PATH, true) +
        colorSpan(dollar, COLORS.USER_PROMPT, true) +
        highlightCommandSyntax(rest);
}

/**
 * Highlight Linux root prompt: root@host:path# (with optional (remote)/(local) prefix)
 * # 符号表示 root 用户，使用红色
 */
function highlightLinuxRoot(match: RegExpMatchArray, plainText: string): string {
    const [fullMatch, prefix, pwncatPrefix, root, at, host, colon, path, hash] = match;
    const rest = plainText.substring(fullMatch.length);

    return (prefix ? escapeHtml(prefix) : '') +
        (pwncatPrefix ? colorSpan(pwncatPrefix, COLORS.PWNCAT_PREFIX, true) : '') +
        colorSpan(root + at + host + colon, COLORS.ROOT_PROMPT, true) +
        colorSpan(path, COLORS.ROOT_PATH, true) +
        colorSpan(hash, COLORS.ROOT_PROMPT, true) +
        highlightCommandSyntax(rest);
}

/**
 * Highlight Pwncat local prompt: (local) pwncat$
 * 黄色显示
 */
function highlightPwncatLocal(match: RegExpMatchArray, plainText: string): string {
    const [fullMatch, prefix, localPrefix, pwncat, dollar] = match;
    const rest = plainText.substring(fullMatch.length);

    return (prefix ? escapeHtml(prefix) : '') +
        colorSpan(localPrefix, COLORS.PWNCAT_PREFIX, true) +
        colorSpan(pwncat, COLORS.PWNCAT_LOCAL, true) +
        colorSpan(dollar, COLORS.PWNCAT_LOCAL, true) +
        highlightCommandSyntax(rest);
}

/**
 * Highlight Kali line 1: ┌──(user㉿kali)-[path]
 * 括号蓝色，user㉿kali 红色，路径白色
 */
function highlightKaliLine1(match: RegExpMatchArray, plainText: string): string {
    const [fullMatch, prefix, openBracket, user, separator, host, middle, path, closeBracket] = match;
    const rest = plainText.substring(fullMatch.length);

    // ┌──( 蓝色 | user㉿host 红色 | )-[ 蓝色 | path 白色 | ] 蓝色
    return (prefix ? escapeHtml(prefix) : '') +
        colorSpan(openBracket, COLORS.KALI_BRACKET, true) +
        colorSpan(user + separator + host, COLORS.KALI_USER, true) +
        colorSpan(middle, COLORS.KALI_BRACKET, true) +
        colorSpan(path, COLORS.KALI_PATH, true) +
        colorSpan(closeBracket, COLORS.KALI_BRACKET, true) +
        escapeHtml(rest);
}

/**
 * Highlight Kali line 2: └─# or └─$
 * └─ 蓝色，# 红色，$ 绿色
 */
function highlightKaliLine2(match: RegExpMatchArray, plainText: string): string {
    const [fullMatch, prefix, line, symbol, space] = match;
    const rest = plainText.substring(fullMatch.length);

    // 根据符号选择颜色：# 红色，$ 绿色
    const symbolColor = symbol === '#' ? COLORS.ROOT_PROMPT : COLORS.USER_PROMPT;

    return (prefix ? escapeHtml(prefix) : '') +
        colorSpan(line, COLORS.KALI_BRACKET, true) +
        colorSpan(symbol, symbolColor, true) +
        (space || '') +
        highlightCommandSyntax(rest);
}
