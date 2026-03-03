import { App, Editor, MarkdownView } from "obsidian";

export class NoteWriter {
	constructor(private app: App) {}

	async insertAtCursor(text: string): Promise<void> {
		if (!this.app?.workspace) {
			throw new Error("Obsidian workspace not available");
		}

		const activeFile = this.app.workspace.getActiveFile();

		console.log("Active File: ", activeFile?.basename);

		const editor = this.getEditor();

		if (!activeFile || !editor) {
			throw new Error("Please open a note first");
		}

		// Get current cursor position
		const cursor = editor.getCursor();

		if (cursor.line === 0 && cursor.ch === 0) {
			await this.append(text);

			// We must explicity save the editor buffer to the file since adding the tags modifies the file too and creates a RACE
			// condition.
			await this.app.vault.modify(activeFile, editor.getValue());
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

		// Same reason as above, make sure we always save the active file!
		await this.app.vault.modify(activeFile, editor.getValue());
	}

	async addTagsToNote(newTags: string[]): Promise<void> {
		const activeFile = this.app.workspace.getActiveFile();

		if (!activeFile) {
			return;
		}

		await this.app.fileManager.processFrontMatter(
			activeFile,
			(frontmatter) => {
				const existingTags: string[] = frontmatter.tags || [];

				console.log("EXISTING TAGS:", existingTags);

				const tagsToAdd = newTags.filter(
					(t) => !existingTags.includes(t),
				);

				console.log("TAGS TO ADD:", tagsToAdd);

				if (tagsToAdd.length > 0) {
					frontmatter.tags = [...existingTags, ...tagsToAdd];
				}

				return frontmatter;
			},
		);
	}

	async append(text: string): Promise<void> {
		const activeFile = this.app.workspace.getActiveFile();
		const editor = this.getEditor();

		console.log("ACTIVE FILE IN APPEND: ", activeFile?.basename);
		if (!activeFile || !editor) {
			throw new Error("Please open a note first");
		}

		const content = editor.getValue();
		const isEmpty = content.trim().length === 0;
		console.log("IS EMPTY: ", isEmpty);

		if (isEmpty) {
			// File is empty, insert at position 0
			editor.replaceRange(text, { line: 0, ch: 0 });
			return;
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

		const activeFile = this.app.workspace.getActiveFile();

		if (!activeFile) {
			return null;
		}

		const leaves = this.app.workspace.getLeavesOfType("markdown");

		for (const leaf of leaves) {
			const view = leaf.view;

			// Make sure we return the leaf that is the active file.
			// Previously we didn't include the view.file === activeFile check, which resulted in text
			// being appended to the first active leaf found, which was usually a previously open note in an earlier tab.
			//
			if (view instanceof MarkdownView && view.file === activeFile) {
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
