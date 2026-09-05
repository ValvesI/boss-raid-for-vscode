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

/** Observa linhas novas inseridas pelo usuário em arquivos do projeto. */
export class ChangeTracker {
	public start(onLinesAdded: (linesAdded: number) => void): vscode.Disposable {
		return vscode.workspace.onDidChangeTextDocument((event) => {
			if (!shouldTrack(event.document)) {
				return;
			}

			const linesAdded = event.contentChanges.reduce(
				(total, change) => total + countNewLines(change.text),
				0,
			);

			if (linesAdded > 0) {
				onLinesAdded(linesAdded);
			}
		});
	}
}
