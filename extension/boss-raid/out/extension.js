"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const changeTracker_1 = require("./editor/changeTracker");
const raidClient_1 = require("./multiplayer/raidClient");
const localRaid_1 = require("./raid/localRaid");
const raidViewProvider_1 = require("./ui/raidViewProvider");
const LINES_PER_ATTACK = 10;
const CHARACTERS_PER_DAMAGE = 5;
function activate(context) {
    let pendingLines = 0;
    let pendingCharacters = 0;
    let currentRaid;
    let isConnected = false;
    let freePlayEnabled = context.globalState.get("bossRaid.freePlayEnabled", false);
    let freePlayProfile = context.globalState.get("bossRaid.freePlayProfile", { level: 1, xp: 0 });
    let freePlayBoss;
    let freePlayStartTimer;
    let freePlayEndTimer;
    let raidViewProvider;
    const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    function updateBossUi() {
        if (currentRaid) {
            statusBar.text = `$(flame) Boss [${currentRaid.roomCode}]: ${currentRaid.bossHp} / ${currentRaid.bossMaxHp} HP | $(person) ${currentRaid.players.length} | $(edit) ${pendingLines}/${LINES_PER_ATTACK} linhas | $(symbol-string) ${pendingCharacters}/${CHARACTERS_PER_DAMAGE} caracteres`;
            statusBar.tooltip = `Raid ${currentRaid.roomCode}`;
        }
        else if (freePlayBoss) {
            statusBar.text = `$(flame) Free-play: ${freePlayBoss.raid.currentBossHp} / ${freePlayBoss.raid.bossMaxHp} HP`;
            statusBar.tooltip = "Boss local do modo free-play";
        }
        else if (isConnected) {
            statusBar.text = "$(radio-tower) Boss Raid: conectado — crie ou entre em uma raid";
            statusBar.tooltip = "Conectado ao servidor da raid";
        }
        else {
            statusBar.text = "$(debug-disconnect) Boss Raid: desconectado";
            statusBar.tooltip = "Inicie ou entre em uma raid para conectar";
        }
        statusBar.show();
        raidViewProvider?.update({
            isConnected,
            pendingCharacters,
            pendingLines,
            raid: currentRaid,
            freePlay: {
                enabled: freePlayEnabled,
                level: freePlayProfile.level,
                xp: freePlayProfile.xp,
                xpToNext: xpRequiredForLevel(freePlayProfile.level),
                bossHp: freePlayBoss?.raid.currentBossHp,
                bossMaxHp: freePlayBoss?.raid.bossMaxHp,
                endsAt: freePlayBoss?.endsAt,
            },
        });
    }
    function xpRequiredForLevel(level) {
        return 100 + (level - 1) * 50;
    }
    async function grantFreePlayXp(bossMaxHp) {
        const reward = Math.max(10, Math.round(bossMaxHp / 20));
        freePlayProfile.xp += reward;
        let leveledUp = false;
        while (freePlayProfile.xp >= xpRequiredForLevel(freePlayProfile.level)) {
            freePlayProfile.xp -= xpRequiredForLevel(freePlayProfile.level);
            freePlayProfile.level += 1;
            leveledUp = true;
        }
        await context.globalState.update("bossRaid.freePlayProfile", freePlayProfile);
        vscode.window.showInformationMessage(leveledUp
            ? `Boss derrotado! +${reward} XP. Nível ${freePlayProfile.level}!`
            : `Boss derrotado! +${reward} XP.`);
    }
    function clearFreePlayBoss() {
        if (freePlayEndTimer) {
            clearTimeout(freePlayEndTimer);
        }
        freePlayEndTimer = undefined;
        freePlayBoss = undefined;
    }
    function scheduleFreePlayBoss() {
        if (freePlayStartTimer) {
            clearTimeout(freePlayStartTimer);
        }
        if (!freePlayEnabled) {
            return;
        }
        freePlayStartTimer = setTimeout(() => {
            freePlayStartTimer = undefined;
            if (!freePlayEnabled || currentRaid || freePlayBoss) {
                scheduleFreePlayBoss();
                return;
            }
            const bossMaxHp = 400 + Math.floor(Math.random() * 17) * 100;
            const durationSeconds = 60 + Math.floor(Math.random() * 181);
            const raid = new localRaid_1.LocalRaid(bossMaxHp);
            raid.start();
            freePlayBoss = { raid, endsAt: Date.now() + durationSeconds * 1_000 };
            freePlayEndTimer = setTimeout(() => {
                if (!freePlayBoss?.raid.isDefeated) {
                    vscode.window.showWarningMessage("O tempo do free-play acabou. O boss venceu!");
                    clearFreePlayBoss();
                    scheduleFreePlayBoss();
                    updateBossUi();
                }
            }, durationSeconds * 1_000);
            vscode.window.showInformationMessage(`Boss free-play: ${bossMaxHp} HP e ${durationSeconds}s.`);
            updateBossUi();
        }, 45_000 + Math.floor(Math.random() * 75_000));
    }
    async function setFreePlayEnabled(enabled) {
        freePlayEnabled = enabled;
        await context.globalState.update("bossRaid.freePlayEnabled", enabled);
        if (enabled) {
            scheduleFreePlayBoss();
        }
        else {
            if (freePlayStartTimer) {
                clearTimeout(freePlayStartTimer);
            }
            clearFreePlayBoss();
        }
        updateBossUi();
    }
    const serverUrl = vscode.workspace
        .getConfiguration("bossRaid")
        .get("serverUrl", "https://boss-raid-for-vscode.onrender.com");
    function clearCurrentRaid() {
        currentRaid = undefined;
        pendingLines = 0;
        pendingCharacters = 0;
        updateBossUi();
        scheduleFreePlayBoss();
    }
    // O servidor é a fonte da verdade: a extensão apenas mostra o estado recebido.
    const raidClient = new raidClient_1.RaidClient(serverUrl, {
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
        onRaidLost: () => {
            vscode.window.showWarningMessage("O tempo acabou. O boss venceu a raid!");
            updateBossUi();
        },
        onRaidLeft: () => {
            clearCurrentRaid();
            vscode.window.showInformationMessage("Você saiu da raid.");
        },
        onError: (message) => vscode.window.showErrorMessage(message),
    });
    async function askForPlayerName() {
        return vscode.window.showInputBox({
            prompt: "Qual é o seu nome na raid?",
            placeHolder: "Ex.: Ana",
            ignoreFocusOut: true,
        });
    }
    function createRaid(playerName, settings) {
        if (freePlayBoss) {
            vscode.window.showWarningMessage("Termine ou aguarde o boss free-play antes de entrar em uma raid online.");
            return;
        }
        if (!playerName.trim()) {
            vscode.window.showWarningMessage("Digite seu nome para criar a raid.");
            return;
        }
        pendingLines = 0;
        pendingCharacters = 0;
        raidClient.createRaid(playerName.trim(), settings);
        updateBossUi();
    }
    function joinRaidByCode(playerName, roomCode) {
        if (freePlayBoss) {
            vscode.window.showWarningMessage("Termine ou aguarde o boss free-play antes de entrar em uma raid online.");
            return;
        }
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
    raidViewProvider = new raidViewProvider_1.RaidViewProvider(createRaid, joinRaidByCode, () => {
        if (!currentRaid) {
            vscode.window.showWarningMessage("Crie ou entre em uma raid primeiro.");
            return;
        }
        raidClient.markCompleted();
    }, () => {
        if (currentRaid) {
            raidClient.leaveRaid();
        }
    }, (enabled) => {
        void setFreePlayEnabled(enabled);
    });
    const raidViewRegistration = vscode.window.registerWebviewViewProvider(raidViewProvider_1.RaidViewProvider.viewType, raidViewProvider, 
    // Mantém a página viva ao alternar para o Explorer ou outro painel do VS Code.
    { webviewOptions: { retainContextWhenHidden: true } });
    const startRaid = vscode.commands.registerCommand("boss-raid.start", async () => {
        const playerName = await askForPlayerName();
        if (playerName) {
            createRaid(playerName, { bossMaxHp: 1_000 });
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
    const changeTracker = new changeTracker_1.ChangeTracker();
    const trackerDisposable = changeTracker.start((progress) => {
        if (currentRaid && currentRaid.outcome === "active") {
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
            if (progress.linesRemoved > 0) {
                raidClient.sendCodeProgress(0, progress.linesRemoved, 0);
            }
            updateBossUi();
            return;
        }
        if (!freePlayBoss) {
            return;
        }
        const damage = progress.linesAdded * 4 + progress.linesRemoved + Math.floor(progress.charactersAdded / CHARACTERS_PER_DAMAGE);
        const result = freePlayBoss.raid.attack(damage);
        if (result.isDefeated) {
            const bossMaxHp = freePlayBoss.raid.bossMaxHp;
            clearFreePlayBoss();
            void grantFreePlayXp(bossMaxHp);
            scheduleFreePlayBoss();
        }
        updateBossUi();
    });
    updateBossUi();
    if (freePlayEnabled) {
        scheduleFreePlayBoss();
    }
    if (!context.globalState.get("bossRaid.dashboardWasShown")) {
        void vscode.commands.executeCommand("workbench.view.extension.bossRaid");
        void context.globalState.update("bossRaid.dashboardWasShown", true);
    }
    context.subscriptions.push(statusBar, startRaid, joinRaid, attackBoss, trackerDisposable, raidViewRegistration, { dispose: () => raidClient.dispose() }, { dispose: () => { if (freePlayStartTimer) {
            clearTimeout(freePlayStartTimer);
        } clearFreePlayBoss(); } });
}
function deactivate() { }
//# sourceMappingURL=extension.js.map