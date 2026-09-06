import * as vscode from "vscode";

const IGNORED_FOLDERS = new Set([".git", "coverage", "dist", "node_modules", "out"]);

function shouldTrack(document: vscode.TextDocument): boolean {
	if (document.uri.scheme !== "file") {
		return false;
	}

	const pathParts = document.uri.fsPath.toLowerCase().split(/[\\/]+/);
	return !pathParts.some((part) => IGNORED_FOLDERS.has(part));
}

function countNewLines(text: string): number {
	return (text.match(/\r?\n/g) ?? []).length;
}

export type CodeProgress = {
	linesAdded: number;
	linesRemoved: number;
};

/** Observa linhas inseridas e removidas pelo usuário em arquivos do projeto. */
export class ChangeTracker {
	public start(onProgress: (progress: CodeProgress) => void): vscode.Disposable {
		return vscode.workspace.onDidChangeTextDocument((event) => {
			if (!shouldTrack(event.document)) {
				return;
			}

			const progress = event.contentChanges.reduce<CodeProgress>(
				(total, change) => ({
					linesAdded: total.linesAdded + countNewLines(change.text),
					// The changed range belongs to the document before this edit.
					linesRemoved: total.linesRemoved + change.range.end.line - change.range.start.line,
				}),
				{ linesAdded: 0, linesRemoved: 0 },
			);

			if (progress.linesAdded > 0 || progress.linesRemoved > 0) {
				onProgress(progress);
			}
		});
	}
}
