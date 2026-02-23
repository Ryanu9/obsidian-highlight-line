# highlight-line

[English](README.md)

这是一个用于 Obsidian 的代码块综合增强插件。它不仅支持通过前缀对代码行进行高亮和 Diff 差异显示，还支持 ANSI 转义序列渲染、终端提示符高亮以及 Burp HTTP 报文可视化。

## 功能

- **代码行高亮与 Diff 显示**：通过在行首添加 `>>>> `（高亮）、`>>>+ `（添加）、`>>>- `（删除）前缀来实现代码行的背景着色。
  ![Diff View](diff.gif)
- **编辑与阅读模式双支持**：在实时预览（Live Preview）和阅读视图中均可完美渲染，并可自定义高亮颜色。
  ![Settings](setting.png)
- **自动隐藏前缀**：渲染时自动隐藏 `>>>` 标记，保持代码纯净。
- **ANSI 终端颜色渲染**：使用 `ansi` 语言块，完美解析并重现标准 SGR 转义序列（支持 256 色及 RGB 真彩色），内置对比度自动修正。
  ![ANSI Rendering](ansi.gif)
- **终端提示符高亮**：在常见的 Shell（bash、powershell、cmd 等）代码块中，自动识别并沉浸式高亮命令行提示符及后续参数。
  ![Terminal Prompt](terminal.gif)
- **Burp HTTP 报文视图**：使用 `burp` 语言块，通过 `===` 分隔符自动呈现请求与响应的左右并排对比视图，并自带专属语法高亮。
  ![Burp View](burp.gif)

## 致谢

本项目基于 [obsidian-sample-plugin](https://github.com/obsidianmd/obsidian-sample-plugin) 开发。
