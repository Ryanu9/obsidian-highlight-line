# highlight-line

[中文](readme-zh.md)


An Obsidian plugin that highlights specific lines in code blocks using a simple prefix syntax.

## Features
- **Editor Mode Support**: Real-time highlighting in Live Preview.
- **Reading Mode Support**: Highlight remains visible in Reading View and exported documents.
- **Automatic Prefix Hiding**: The `>>>> ` prefix is naturally hidden. In Reading Mode, you can choose whether to display it via settings.
- **Customizable Appearance**: Configure the highlight background color and opacity in settings.
![alt text](image-1.png)
![alt text](image.png)

## Usage
Add `>>>> ` (four angle brackets and a space) at the beginning of any line you want to highlight within a code block:

````markdown
```javascript
function example() {
>>>> 	console.log("This line will be highlighted");
	console.log("This line is normal");
>>>> 	return true;
}
```
````

## Credits
This project is built upon the [obsidian-sample-plugin](https://github.com/obsidianmd/obsidian-sample-plugin).


