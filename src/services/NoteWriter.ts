import { App, Editor, MarkdownView } from "obsidian";

export class NoteWriter {
	constructor(private app: App) {}

	async insertAtCursor(text: string): Promise<void> {
		if (!this.app?.workspace) {
			throw new Error("Obsidian workspace not available");
		}

		const activeFile = this.app.workspace.getActiveFile();
		const editor = this.getEditor();

		if (!activeFile || !editor) {
			throw new Error("Please open a note first");
		}

		// Get current cursor position
		const cursor = editor.getCursor();

		if (cursor.line === 0 && cursor.ch === 0) {
			await this.append(text);
			return;
		}

		// Insert text at cursor position
		editor.replaceRange(text, cursor);

		// Move cursor to end of inserted text
		const newCursor = {
			line: cursor.line,
			ch: cursor.ch + text.length,
		};
		editor.setCursor(newCursor);
	}

	async append(text: string): Promise<void> {
		const activeFile = this.app.workspace.getActiveFile();
		const editor = this.getEditor();

		if (!activeFile || !editor) {
			throw new Error("Please open a note first");
		}

		// Get end of document
		const lastLine = editor.lastLine();
		const lastLineText = editor.getLine(lastLine);
		const endPos = { line: lastLine, ch: lastLineText.length };

		// Add newline if file doesn't end with one
		const prefix = lastLineText ? "\n\n" : "";

		editor.replaceRange(prefix + text, endPos);
	}

	private getEditor(): Editor | null {
		if (!this.app?.workspace) {
			return null;
		}

		const leaves = this.app.workspace.getLeavesOfType("markdown");

		for (const leaf of leaves) {
			const view = leaf.view;
			if (view instanceof MarkdownView) {
				// Switch to edit mode if in read mode
				if (view.getState().mode === "preview") {
					void view.setState({ mode: "source" }, { history: false });
				}

				if (view.editor) {
					return view.editor;
				}
			}
		}

		return null;
	}
}
