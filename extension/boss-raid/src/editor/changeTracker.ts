import * as vscode from "vscode";

const IGNORED_FOLDERS = new Set([".git", "coverage", "dist", "node_modules", "out"]);

function shouldTrack(document: vscode.TextDocument): boolean {
	if (document.uri.scheme !== "file") {
		return false;
	}

	const pathParts = document.uri.fsPath.toLowerCase().split(/[\\/]+/);
	return !pathParts.some((part) => IGNORED_FOLDERS.has(part));
}

export type CodeProgress = {
	charactersAdded: number;
	linesAdded: number;
	linesRemoved: number;
};

function countAddedCharacters(text: string): number {
	return Array.from(text).filter((character) => !/\s/.test(character)).length;
}

function countNonEmptyLines(document: vscode.TextDocument): number {
	let count = 0;

	for (let lineIndex = 0; lineIndex < document.lineCount; lineIndex += 1) {
		if (document.lineAt(lineIndex).text.trim().length > 0) {
			count += 1;
		}
	}

	return count;
}

/** Observa linhas inseridas e removidas pelo usuário em arquivos do projeto. */
export class ChangeTracker {
	public start(onProgress: (progress: CodeProgress) => void): vscode.Disposable {
		const nonEmptyLineCounts = new Map<string, number>();

		function rememberDocument(document: vscode.TextDocument): void {
			if (shouldTrack(document)) {
				nonEmptyLineCounts.set(document.uri.toString(), countNonEmptyLines(document));
			}
		}

		for (const document of vscode.workspace.textDocuments) {
			rememberDocument(document);
		}

		const openDocumentDisposable = vscode.workspace.onDidOpenTextDocument(rememberDocument);
		const changeDocumentDisposable = vscode.workspace.onDidChangeTextDocument((event) => {
			if (!shouldTrack(event.document)) {
				return;
			}

			const documentKey = event.document.uri.toString();
			const previousNonEmptyLines = nonEmptyLineCounts.get(documentKey) ?? 0;
			const currentNonEmptyLines = countNonEmptyLines(event.document);
			nonEmptyLineCounts.set(documentKey, currentNonEmptyLines);

			const charactersAdded = event.contentChanges.reduce(
				(total, change) => total + countAddedCharacters(change.text),
				0,
			);
			const lineDifference = currentNonEmptyLines - previousNonEmptyLines;
			const progress: CodeProgress = {
				charactersAdded,
				linesAdded: Math.max(0, lineDifference),
				linesRemoved: Math.max(0, -lineDifference),
			};

			if (
				progress.charactersAdded > 0 ||
				progress.linesAdded > 0 ||
				progress.linesRemoved > 0
			) {
				onProgress(progress);
			}
		});

		return vscode.Disposable.from(openDocumentDisposable, changeDocumentDisposable);
	}
}
