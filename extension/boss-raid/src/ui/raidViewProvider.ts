import * as vscode from "vscode";
import type { RaidSettings, RaidState } from "../multiplayer/raidClient";

export type RaidViewState = {
	isConnected: boolean;
	pendingCharacters: number;
	pendingLines: number;
	raid?: RaidState;
	freePlay: {
		enabled: boolean;
		level: number;
		xp: number;
		xpToNext: number;
		bossHp?: number;
		bossMaxHp?: number;
		endsAt?: number | undefined;
	};
};

type ViewMessage =
	| { type: "createRaid"; playerName: string; bossMaxHp: number; timeLimitSeconds?: number }
	| { type: "joinRaid"; playerName: string; roomCode: string }
	| { type: "markCompleted" }
	| { type: "leaveRaid" }
	| { type: "setFreePlay"; enabled: boolean };

/** Painel lateral com os controles principais da raid. */
export class RaidViewProvider implements vscode.WebviewViewProvider {
	public static readonly viewType = "bossRaid.dashboard";
	private view: vscode.WebviewView | undefined;
	private state: RaidViewState = { isConnected: false, pendingCharacters: 0, pendingLines: 0, freePlay: { enabled: false, level: 1, xp: 0, xpToNext: 100 } };

	public constructor(
		private readonly onCreateRaid: (playerName: string, settings: RaidSettings) => void,
		private readonly onJoinRaid: (playerName: string, roomCode: string) => void,
		private readonly onMarkCompleted: () => void,
		private readonly onLeaveRaid: () => void,
		private readonly onSetFreePlay: (enabled: boolean) => void,
	) {}

	public resolveWebviewView(webviewView: vscode.WebviewView): void {
		this.view = webviewView;
		webviewView.webview.options = { enableScripts: true };
		webviewView.webview.html = this.getHtml(webviewView.webview);
		webviewView.onDidDispose(() => { this.view = undefined; });
		webviewView.webview.onDidReceiveMessage((message: unknown) => this.handleMessage(message));
		void this.sendState();
	}

	public update(state: RaidViewState): void {
		this.state = state;
		void this.sendState();
	}

	private handleMessage(message: unknown): void {
		if (!this.isValidMessage(message)) {
			return;
		}
		if (message.type === "createRaid") {
			this.onCreateRaid(message.playerName.trim(), { bossMaxHp: message.bossMaxHp, timeLimitSeconds: message.timeLimitSeconds });
		} else if (message.type === "joinRaid") {
			this.onJoinRaid(message.playerName.trim(), message.roomCode.trim().toUpperCase());
		} else if (message.type === "markCompleted") {
			this.onMarkCompleted();
		} else if (message.type === "leaveRaid") {
			this.onLeaveRaid();
		} else {
			this.onSetFreePlay(message.enabled);
		}
	}

	private async sendState(): Promise<void> {
		await this.view?.webview.postMessage({ type: "state", state: this.state });
	}

	private isValidMessage(message: unknown): message is ViewMessage {
		if (typeof message !== "object" || message === null) {
			return false;
		}
		const candidate = message as Record<string, unknown>;
		if (candidate.type === "markCompleted" || candidate.type === "leaveRaid") {
			return true;
		}
		if (candidate.type === "joinRaid") {
			return typeof candidate.playerName === "string" && typeof candidate.roomCode === "string";
		}
		if (candidate.type === "setFreePlay") {return typeof candidate.enabled === "boolean";}
		return candidate.type === "createRaid" && typeof candidate.playerName === "string" && typeof candidate.bossMaxHp === "number" && (candidate.timeLimitSeconds === undefined || typeof candidate.timeLimitSeconds === "number");
	}

	private getHtml(webview: vscode.Webview): string {
		const nonce = getNonce();
		const csp = ["default-src 'none'", "style-src " + webview.cspSource + " 'unsafe-inline'", "script-src 'nonce-" + nonce + "'"].join("; ");
		return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta http-equiv="Content-Security-Policy" content="${csp}"><style>
body{color:var(--vscode-foreground);font-family:var(--vscode-font-family);padding:0 12px}.hint{color:var(--vscode-descriptionForeground);font-size:12px;line-height:1.4}.card{border:1px solid var(--vscode-widget-border);border-radius:6px;margin:14px 0;padding:12px}label{display:block;font-size:12px;margin:10px 0 4px}input{box-sizing:border-box;width:100%;padding:7px;color:var(--vscode-input-foreground);background:var(--vscode-input-background);border:1px solid var(--vscode-input-border)}button{cursor:pointer;width:100%;margin-top:12px;padding:8px;color:var(--vscode-button-foreground);background:var(--vscode-button-background);border:0}.secondary{background:var(--vscode-button-secondaryBackground);color:var(--vscode-button-secondaryForeground)}progress{width:100%;height:14px}.defeated progress{accent-color:#d64545}.hidden{display:none}.stats{display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:12px}.player{display:flex;justify-content:space-between;border-top:1px solid var(--vscode-widget-border);padding:7px 0;font-size:12px}.done{color:var(--vscode-testing-iconPassed)}.victory{background:color-mix(in srgb,#d64545 20%,transparent);border:1px solid #d64545;border-radius:6px;color:var(--vscode-foreground);margin:12px 0;padding:12px;text-align:center}.victory strong{display:block;font-size:18px;margin-bottom:5px}
</style></head><body><h2>⚔️ Boss Raid</h2><p id="connection" class="hint">Conecte-se criando ou entrando em uma sala.</p>
<section id="raid-card" class="card hidden"><strong id="room-code"></strong><div id="victory" class="victory hidden"><strong>🏆 Boss derrotado!</strong><span>A raid venceu. Bom trabalho, equipe!</span></div><p id="boss-hp"></p><progress id="boss-progress" value="0" max="1000"></progress><div class="stats"><span id="players-count"></span><span id="progress-text"></span></div><p class="hint" id="limit-text"></p><button id="complete-button">Marcar minha parte como concluída</button><button id="leave-button" class="secondary">Sair da raid</button><h3>Jogadores</h3><div id="player-list"></div></section>
<section class="card"><strong>Modo free-play</strong><label><input id="free-toggle" type="checkbox"> Ativar modo offline</label><p id="free-profile" class="hint"></p><div id="free-boss" class="hidden"><strong>Boss local</strong><p id="free-hp"></p><progress id="free-progress" value="0" max="1000"></progress><p id="free-time" class="hint"></p></div><p id="free-waiting" class="hint">Ative o modo para um boss aparecer enquanto você programa.</p></section>
<section class="card"><strong>Criar uma nova raid</strong><label for="create-name">Seu nome</label><input id="create-name" maxlength="30" placeholder="Ex.: Ana"><label for="boss-hp-input">Vida do boss</label><input id="boss-hp-input" type="number" min="1" max="1000000" value="1000"><label for="time-limit-input">Tempo da raid em minutos (opcional)</label><input id="time-limit-input" type="number" min="1" max="1440" placeholder="Sem limite"><p class="hint">Se o tempo acabar antes de o HP chegar a zero, o boss vence.</p><p class="hint">O dano máximo é dividido automaticamente entre as pessoas na sala. Sozinho, você pode causar toda a vida do boss.</p><button id="create-button">Criar raid</button></section>
<section class="card"><strong>Entrar em uma raid</strong><label for="join-name">Seu nome</label><input id="join-name" maxlength="30" placeholder="Ex.: Bruno"><label for="room-input">Código da sala</label><input id="room-input" maxlength="12" placeholder="Ex.: 85WZXH"><button id="join-button">Entrar na raid</button></section>
<script nonce="${nonce}">const v=acquireVsCodeApi(),$=id=>document.getElementById(id);$('create-button').onclick=()=>{const m=Number($('time-limit-input').value);v.postMessage({type:'createRaid',playerName:$('create-name').value,bossMaxHp:Number($('boss-hp-input').value),timeLimitSeconds:m?m*60:undefined})};$('join-button').onclick=()=>v.postMessage({type:'joinRaid',playerName:$('join-name').value,roomCode:$('room-input').value});$('complete-button').onclick=()=>v.postMessage({type:'markCompleted'});$('leave-button').onclick=()=>v.postMessage({type:'leaveRaid'});$('free-toggle').onchange=e=>v.postMessage({type:'setFreePlay',enabled:e.target.checked});window.addEventListener('message',e=>{const s=e.data.state;if(e.data.type!=='state'||!s)return;const f=s.freePlay;$('free-toggle').checked=f.enabled;$('free-profile').textContent='Nível '+f.level+' · '+f.xp+' / '+f.xpToNext+' XP';const hasFree=!!f.bossMaxHp;$('free-boss').classList.toggle('hidden',!hasFree);$('free-waiting').classList.toggle('hidden',hasFree);if(hasFree){$('free-hp').textContent=f.bossHp+' / '+f.bossMaxHp+' HP';$('free-progress').max=f.bossMaxHp;$('free-progress').value=f.bossHp;$('free-time').textContent='Tempo restante: '+Math.max(0,Math.ceil((f.endsAt-Date.now())/1000))+'s'}$('connection').textContent=s.isConnected?'Conectado ao servidor da raid.':'Conectando ao servidor...';const card=$('raid-card');card.classList.toggle('hidden',!s.raid);if(!s.raid)return;const r=s.raid,cap=r.damagePerPlayer??0,defeated=r.bossHp===0;card.classList.toggle('defeated',defeated);$('victory').classList.toggle('hidden',!defeated);$('complete-button').disabled=defeated;$('room-code').textContent='Sala '+r.roomCode;$('boss-hp').textContent=defeated?'Boss: DERROTADO':'Boss: '+r.bossHp+' / '+r.bossMaxHp+' HP';$('boss-progress').max=r.bossMaxHp;$('boss-progress').value=r.bossHp;$('players-count').textContent='👥 '+r.players.length+' jogador(es)';$('progress-text').textContent=s.pendingLines+' linhas · '+s.pendingCharacters+' caracteres';$('limit-text').textContent='Teto atual por pessoa: '+cap+' de dano.';$('player-list').innerHTML=r.players.map(p=>'<div class="player"><span>'+esc(p.name)+(p.isCompleted?' <span class="done">✓ concluído</span>':'')+'</span><span>'+(p.damageDealt??0)+' / '+cap+'</span></div>').join('')});function esc(x){const d=document.createElement('div');d.textContent=x;return d.innerHTML}</script></body></html>`;
	}
}

function getNonce(): string {
	const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
	return Array.from({ length: 32 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
}
