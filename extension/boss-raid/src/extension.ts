import * as vscode from "vscode";
import { ChangeTracker } from "./editor/changeTracker";
import { RaidClient, type RaidSettings, type RaidState } from "./multiplayer/raidClient";
import { RaidViewProvider } from "./ui/raidViewProvider";

const LINES_PER_ATTACK = 10;
const CHARACTERS_PER_DAMAGE = 5;

export function activate(context: vscode.ExtensionContext) {
	let pendingLines = 0;
	let pendingCharacters = 0;
	let currentRaid: RaidState | undefined;
	let isConnected = false;
	let raidViewProvider: RaidViewProvider;
	const statusBar = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    100,
  );

	function updateBossUi() {
		if (currentRaid) {
			statusBar.text = `$(flame) Boss [${currentRaid.roomCode}]: ${currentRaid.bossHp} / ${currentRaid.bossMaxHp} HP | $(person) ${currentRaid.players.length} | $(edit) ${pendingLines}/${LINES_PER_ATTACK} linhas | $(symbol-string) ${pendingCharacters}/${CHARACTERS_PER_DAMAGE} caracteres`;
			statusBar.tooltip = `Raid ${currentRaid.roomCode}`;
		} else if (isConnected) {
			statusBar.text = "$(radio-tower) Boss Raid: conectado — crie ou entre em uma raid";
			statusBar.tooltip = "Conectado ao servidor da raid";
		} else {
			statusBar.text = "$(debug-disconnect) Boss Raid: desconectado";
			statusBar.tooltip = "Inicie ou entre em uma raid para conectar";
		}

		statusBar.show();
		raidViewProvider?.update({
			isConnected,
			pendingCharacters,
			pendingLines,
			raid: currentRaid,
		});
	}

	const serverUrl = vscode.workspace
		.getConfiguration("bossRaid")
		.get<string>("serverUrl", "https://boss-raid-for-vscode.onrender.com");

	// O servidor é a fonte da verdade: a extensão apenas mostra o estado recebido.
	const raidClient = new RaidClient(serverUrl, {
		onConnectionChanged: (connected) => {
			isConnected = connected;
			updateBossUi();
		},
		onRaidState: (raid) => {
			currentRaid = raid;
			updateBossUi();
		},
		onDamageApplied: () => updateBossUi(),
		onBossDefeated: () => {
			// The server currently identifies the winner by a technical socket ID.
			// The extension shows a friendly victory message until player profiles exist.
			vscode.window.showInformationMessage("Boss derrotado! 🎉");
		},
		onError: (message) => vscode.window.showErrorMessage(message),
	});

	async function askForPlayerName(): Promise<string | undefined> {
		return vscode.window.showInputBox({
			prompt: "Qual é o seu nome na raid?",
			placeHolder: "Ex.: Ana",
			ignoreFocusOut: true,
		});
	}

	function createRaid(playerName: string, settings: RaidSettings) {
		if (!playerName.trim()) {
			vscode.window.showWarningMessage("Digite seu nome para criar a raid.");
			return;
		}

		pendingLines = 0;
		pendingCharacters = 0;
		raidClient.createRaid(playerName.trim(), settings);
		updateBossUi();
	}

	function joinRaidByCode(playerName: string, roomCode: string) {
		if (!playerName.trim() || !roomCode.trim()) {
			vscode.window.showWarningMessage("Digite seu nome e o código da raid.");
			return;
		}

		pendingLines = 0;
		pendingCharacters = 0;
		raidClient.joinRaid(roomCode.trim().toUpperCase(), playerName.trim());
		updateBossUi();
	}

	// A barra lateral é a interface principal; os comandos continuam como atalho opcional.
	raidViewProvider = new RaidViewProvider(createRaid, joinRaidByCode, () => {
		if (!currentRaid) {
			vscode.window.showWarningMessage("Crie ou entre em uma raid primeiro.");
			return;
		}
		raidClient.markCompleted();
	});
	const raidViewRegistration = vscode.window.registerWebviewViewProvider(
		RaidViewProvider.viewType,
		raidViewProvider,
		// Mantém a página viva ao alternar para o Explorer ou outro painel do VS Code.
		{ webviewOptions: { retainContextWhenHidden: true } },
	);

	const startRaid = vscode.commands.registerCommand("boss-raid.start", async () => {
		const playerName = await askForPlayerName();
		if (playerName) {
			createRaid(playerName, { bossMaxHp: 1_000, damagePerPlayer: 500 });
		}
	});

	const joinRaid = vscode.commands.registerCommand("boss-raid.join", async () => {
		const playerName = await askForPlayerName();
		if (!playerName) {
			return;
		}
		const roomCode = await vscode.window.showInputBox({ prompt: "Digite o código da raid", placeHolder: "Ex.: 85WZXH" });
		if (roomCode) {
			joinRaidByCode(playerName, roomCode);
		}
	});

	const attackBoss = vscode.commands.registerCommand("boss-raid.attack", () => {
		if (!currentRaid) {
			vscode.window.showWarningMessage("Crie ou entre em uma raid primeiro.");
			return;
		}

		// A test attack helps validate the multiplayer connection before editing code.
		raidClient.sendCodeProgress(LINES_PER_ATTACK, 0, 0);
	});

	const changeTracker = new ChangeTracker();
	const trackerDisposable = changeTracker.start((progress) => {
		if (!currentRaid || currentRaid.bossHp === 0) {
			return;
		}

		pendingCharacters += progress.charactersAdded;
		while (pendingCharacters >= CHARACTERS_PER_DAMAGE) {
			pendingCharacters -= CHARACTERS_PER_DAMAGE;
			raidClient.sendCodeProgress(0, 0, CHARACTERS_PER_DAMAGE);
		}

		pendingLines += progress.linesAdded;
		while (pendingLines >= LINES_PER_ATTACK && currentRaid.bossHp > 0) {
			pendingLines -= LINES_PER_ATTACK;
			raidClient.sendCodeProgress(LINES_PER_ATTACK, 0, 0);
		}

		// Removals can contribute too, even if the player has not added ten new lines.
		if (progress.linesRemoved > 0) {
			raidClient.sendCodeProgress(0, progress.linesRemoved, 0);
		}

		updateBossUi();
	});

	updateBossUi();
	if (!context.globalState.get<boolean>("bossRaid.dashboardWasShown")) {
		void vscode.commands.executeCommand("workbench.view.extension.bossRaid");
		void context.globalState.update("bossRaid.dashboardWasShown", true);
	}
	context.subscriptions.push(
		statusBar,
		startRaid,
		joinRaid,
		attackBoss,
		trackerDisposable,
		raidViewRegistration,
		{ dispose: () => raidClient.dispose() },
	);
}

export function deactivate() {}
