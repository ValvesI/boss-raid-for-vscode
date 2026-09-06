import * as vscode from "vscode";
import type { RaidSettings, RaidState } from "../multiplayer/raidClient";

/** Dados enviados do processo da extensão para a página exibida na barra lateral. */
export type RaidViewState = {
	isConnected: boolean;
	pendingCharacters: number;
	pendingLines: number;
	raid?: RaidState;
};

type CreateRaidMessage = {
	type: "createRaid";
	playerName: string;
	bossMaxHp: number;
	damagePerPlayer: number;
};

type JoinRaidMessage = { type: "joinRaid"; playerName: string; roomCode: string };
type CompleteMessage = { type: "markCompleted" };
type ViewMessage = CreateRaidMessage | JoinRaidMessage | CompleteMessage;

/**
 * Cria a barra lateral do Boss Raid. Um WebviewView é uma pequena página segura
 * dentro do VS Code; assim o jogador usa botões em vez de comandos.
 */
export class RaidViewProvider implements vscode.WebviewViewProvider {
	public static readonly viewType = "bossRaid.dashboard";
	private view: vscode.WebviewView | undefined;
	private state: RaidViewState = { isConnected: false, pendingCharacters: 0, pendingLines: 0 };

	public constructor(
		private readonly onCreateRaid: (playerName: string, settings: RaidSettings) => void,
		private readonly onJoinRaid: (playerName: string, roomCode: string) => void,
		private readonly onMarkCompleted: () => void,
	) {}

	public resolveWebviewView(webviewView: vscode.WebviewView): void {
		this.view = webviewView;
		webviewView.webview.options = { enableScripts: true };
		webviewView.webview.html = this.getHtml(webviewView.webview);
		webviewView.onDidDispose(() => {
			this.view = undefined;
		});

		webviewView.webview.onDidReceiveMessage((message: unknown) => {
			if (!this.isValidMessage(message)) {
				return;
			}
			if (message.type === "createRaid") {
				this.onCreateRaid(message.playerName.trim(), {
					bossMaxHp: message.bossMaxHp,
					damagePerPlayer: message.damagePerPlayer,
				});
			} else if (message.type === "joinRaid") {
				this.onJoinRaid(message.playerName.trim(), message.roomCode.trim().toUpperCase());
			} else {
				this.onMarkCompleted();
			}
		});
		void this.sendState();
	}

	/** Guarda o estado mais novo e atualiza a barra lateral quando ela está visível. */
	public update(state: RaidViewState): void {
		this.state = state;
		void this.sendState();
	}

	private async sendState(): Promise<void> {
		await this.view?.webview.postMessage({ type: "state", state: this.state });
	}

	private isValidMessage(message: unknown): message is ViewMessage {
		if (typeof message !== "object" || message === null) {
			return false;
		}
		const candidate = message as Record<string, unknown>;
		if (candidate.type === "markCompleted") {
			return true;
		}
		if (candidate.type === "joinRaid") {
			return typeof candidate.playerName === "string" && typeof candidate.roomCode === "string";
		}
		return candidate.type === "createRaid" && typeof candidate.playerName === "string"
			&& typeof candidate.bossMaxHp === "number" && typeof candidate.damagePerPlayer === "number";
	}

	private getHtml(webview: vscode.Webview): string {
		const nonce = getNonce();
		const csp = ["default-src 'none'", "style-src " + webview.cspSource + " 'unsafe-inline'", "script-src 'nonce-" + nonce + "'"].join("; ");
		return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta http-equiv="Content-Security-Policy" content="${csp}"><meta name="viewport" content="width=device-width, initial-scale=1.0"><style>
body{color:var(--vscode-foreground);font-family:var(--vscode-font-family);padding:0 12px}.hint{color:var(--vscode-descriptionForeground);font-size:12px;line-height:1.4}.card{border:1px solid var(--vscode-widget-border);border-radius:6px;margin:14px 0;padding:12px}label{display:block;font-size:12px;margin:10px 0 4px}input{box-sizing:border-box;width:100%;padding:7px;color:var(--vscode-input-foreground);background:var(--vscode-input-background);border:1px solid var(--vscode-input-border)}button{cursor:pointer;width:100%;margin-top:12px;padding:8px;color:var(--vscode-button-foreground);background:var(--vscode-button-background);border:0}button:disabled{opacity:.55;cursor:default}progress{width:100%;height:14px}.hidden{display:none}.stats{display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:12px}.player{display:flex;justify-content:space-between;border-top:1px solid var(--vscode-widget-border);padding:7px 0;font-size:12px}.done{color:var(--vscode-testing-iconPassed)}
</style></head><body>
<h2>⚔️ Boss Raid</h2><p id="connection" class="hint">Conecte-se criando ou entrando em uma sala.</p>
<section id="raid-card" class="card hidden"><strong id="room-code"></strong><p id="boss-hp"></p><progress id="boss-progress" value="0" max="1000"></progress><div class="stats"><span id="players-count"></span><span id="progress-text"></span></div><p class="hint" id="limit-text"></p><button id="complete-button">Marcar minha parte como concluída</button><h3>Jogadores</h3><div id="player-list"></div></section>
<section class="card"><strong>Criar uma nova raid</strong><label for="create-name">Seu nome</label><input id="create-name" maxlength="30" placeholder="Ex.: Ana"><label for="boss-hp-input">Vida do boss</label><input id="boss-hp-input" type="number" min="1" max="1000000" value="1000"><label for="damage-cap-input">Dano máximo por jogador</label><input id="damage-cap-input" type="number" min="1" max="1000000" value="500"><p class="hint">Para derrotar um boss de 1000 HP, duas pessoas precisam contribuir 500 de dano cada.</p><button id="create-button">Criar raid</button></section>
<section class="card"><strong>Entrar em uma raid</strong><label for="join-name">Seu nome</label><input id="join-name" maxlength="30" placeholder="Ex.: Bruno"><label for="room-input">Código da sala</label><input id="room-input" maxlength="12" placeholder="Ex.: 85WZXH"><button id="join-button">Entrar na raid</button></section>
<script nonce="${nonce}">const vscode=acquireVsCodeApi(),$=id=>document.getElementById(id);$('create-button').onclick=()=>vscode.postMessage({type:'createRaid',playerName:$('create-name').value,bossMaxHp:Number($('boss-hp-input').value),damagePerPlayer:Number($('damage-cap-input').value)});$('join-button').onclick=()=>vscode.postMessage({type:'joinRaid',playerName:$('join-name').value,roomCode:$('room-input').value});$('complete-button').onclick=()=>vscode.postMessage({type:'markCompleted'});window.addEventListener('message',event=>{const s=event.data.state;if(event.data.type!=='state'||!s)return;$('connection').textContent=s.isConnected?'Conectado ao servidor da raid.':'Conectando ao servidor...';const card=$('raid-card');card.classList.toggle('hidden',!s.raid);if(!s.raid)return;const r=s.raid,cap=r.damagePerPlayer??0;$('room-code').textContent='Sala '+r.roomCode;$('boss-hp').textContent='Boss: '+r.bossHp+' / '+r.bossMaxHp+' HP';$('boss-progress').max=r.bossMaxHp;$('boss-progress').value=r.bossHp;$('players-count').textContent='👥 '+r.players.length+' jogador(es)';$('progress-text').textContent=s.pendingLines+' linhas · '+s.pendingCharacters+' caracteres';$('limit-text').textContent='Cada jogador pode causar no máximo '+cap+' de dano.';$('player-list').innerHTML=r.players.map(p=>'<div class="player"><span>'+escapeHtml(p.name)+(p.isCompleted?' <span class="done">✓ concluído</span>':'')+'</span><span>'+(p.damageDealt??0)+' / '+cap+'</span></div>').join('');});function escapeHtml(v){const d=document.createElement('div');d.textContent=v;return d.innerHTML}</script>
</body></html>`;
	}
}

function getNonce(): string {
	const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
	return Array.from({ length: 32 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
}
