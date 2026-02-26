// Rendering and UI interactions for Scoundrel (ported from js/ui.js)

import { MAX_HEALTH, Game, displayRank, Card } from './game';
import { el, save, load, prefersReducedMotion } from './utils';

import heartImg from '../assets/scoundrel/heart.jpg';
import club1Img from '../assets/scoundrel/club-1.jpg';
import club2Img from '../assets/scoundrel/club-2.jpg';
import club3Img from '../assets/scoundrel/club-3.jpg';
import spade1Img from '../assets/scoundrel/spade-1.jpg';
import spade2Img from '../assets/scoundrel/spade-2.jpg';
import spade3Img from '../assets/scoundrel/spade-3.jpg';
import diamond1Img from '../assets/scoundrel/diamond-1.jpg';
import diamond2Img from '../assets/scoundrel/diamond-2.jpg';
import diamond3Img from '../assets/scoundrel/diamond-3.jpg';
import deckImg from '../assets/scoundrel/deck.jpg';

const SAVE_KEY = 'scoundrel.save.v1';

type LogKind = 'good' | 'bad' | 'info' | 'turn';

interface UIRefs {
  healthBar: HTMLElement | null;
  healthText: HTMLElement | null;
  weaponValue: HTMLElement | null;
  lastDefeated: HTMLElement | null;
  turnCounter: HTMLElement | null;
  deckCount: HTMLElement | null;
  discardCount: HTMLElement | null;
  roomGrid: HTMLElement | null;
  roomActions: HTMLElement | null;
  log: HTMLElement | null;
  avoidBtn: HTMLElement | null;
  newGameBtn: HTMLButtonElement | null;
  helpBtn: HTMLButtonElement | null;
  toggleControlsBtn: HTMLButtonElement | null;
  topControls: HTMLElement | null;
  helpModal: HTMLDialogElement | HTMLElement | null;
  closeHelpBtn: HTMLButtonElement | null;
  endModal: HTMLDialogElement | HTMLElement | null;
  endTitle: HTMLElement | null;
  endSummary: HTMLElement | null;
  endNewBtn: HTMLButtonElement | null;
}

export class UI {
  root: HTMLElement | null;
  refs: UIRefs;
  game: Game | null;
  selected: Set<number>;

  constructor(root: HTMLElement | null) {
    this.root = root;
    this.refs = this.cacheRefs();
    this.game = null;
    this.selected = new Set();
    this.bindControls();
  }

  private cacheRefs(): UIRefs {
    return {
      healthBar: document.getElementById('healthBar'),
      healthText: document.getElementById('healthText'),
      weaponValue: document.getElementById('weaponValue'),
      lastDefeated: document.getElementById('lastDefeated'),
      turnCounter: document.getElementById('turnCounter'),
      deckCount: document.getElementById('deckCount'),
      discardCount: document.getElementById('discardCount'),
      roomGrid: document.getElementById('roomGrid'),
      roomActions: document.getElementById('roomActions'),
      log: document.getElementById('log'),
      avoidBtn: document.getElementById('avoidBtn'),
      newGameBtn: document.getElementById('newGameBtn') as HTMLButtonElement | null,
      helpBtn: document.getElementById('helpBtn') as HTMLButtonElement | null,
      toggleControlsBtn: document.getElementById('toggleControlsBtn') as HTMLButtonElement | null,
      topControls: document.getElementById('topControls'),
      helpModal: document.getElementById('helpModal') as HTMLDialogElement | HTMLElement | null,
      closeHelpBtn: document.getElementById('closeHelpBtn') as HTMLButtonElement | null,
      endModal: document.getElementById('endModal') as HTMLDialogElement | HTMLElement | null,
      endTitle: document.getElementById('endTitle'),
      endSummary: document.getElementById('endSummary'),
      endNewBtn: document.getElementById('endNewBtn') as HTMLButtonElement | null,
    };
  }

  private bindControls() {
    const r = this.refs;

    r.newGameBtn?.addEventListener('click', () => this.newGame());

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (r.helpModal) this.hideDialog(r.helpModal);
        if (r.endModal) this.hideDialog(r.endModal);
      }
    });

    r.helpBtn?.addEventListener('click', () => {
      if (r.helpModal) this.showDialog(r.helpModal);
    });
    r.closeHelpBtn?.addEventListener('click', () => {
      if (r.helpModal) this.hideDialog(r.helpModal);
    });

    r.endNewBtn?.addEventListener('click', () => {
      if (r.endModal) this.hideDialog(r.endModal);
      this.newGame();
    });

    if (r.toggleControlsBtn && r.topControls) {
      r.toggleControlsBtn.addEventListener('click', () => {
        const expanded = r.toggleControlsBtn!.getAttribute('aria-expanded') === 'true';
        const next = !expanded;
        r.toggleControlsBtn!.setAttribute('aria-expanded', String(next));
        r.topControls!.classList.toggle('open', next);
      });
    }
  }

  private showDialog(dialog: HTMLDialogElement | HTMLElement) {
    if ('showModal' in dialog && typeof (dialog as HTMLDialogElement).showModal === 'function') {
      (dialog as HTMLDialogElement).showModal();
    } else {
      dialog.classList.add('dialog-open');
      dialog.setAttribute('open', '');
    }
  }

  private hideDialog(dialog: HTMLDialogElement | HTMLElement) {
    if ('close' in dialog && typeof (dialog as HTMLDialogElement).close === 'function') {
      if ((dialog as HTMLDialogElement).open) (dialog as HTMLDialogElement).close();
    } else {
      dialog.classList.remove('dialog-open');
      dialog.removeAttribute('open');
    }
  }

  newGame() {
    this.game = new Game();
    this.game.startTurn();
    this.selected.clear();
    save(SAVE_KEY, this.game.serialize());
    this.renderAll(true);
    this.logLine('New game started.', 'info');
  }

  resumeOrNew() {
    const saved = load<ReturnType<Game['serialize']>>(SAVE_KEY);
    if (saved) {
      this.game = Game.fromSaved(saved as any);
      this.renderAll(false);
    } else {
      this.newGame();
    }
  }

  private onAvoid() {
    if (!this.game || this.game.status !== 'playing') return;
    const res = this.game.avoidRoom();
    if (!res.ok) {
      if (res.reason === 'avoid-twice') this.logLine('You cannot avoid two rooms in a row.', 'bad');
      return;
    }
    this.selected.clear();
    this.afterAction();
  }

  private onFace() {
    if (!this.game || this.game.status !== 'playing') return;
    const need = Math.min(3, this.game.room.length);
    if (this.selected.size !== need) {
      this.logLine(`Select exactly ${need} card${need === 1 ? '' : 's'} to face.`, 'info');
      return;
    }
    const indices = Array.from(this.selected);
    this.game.faceRoom(indices);
    this.selected.clear();
    this.afterAction();
  }

  private afterAction() {
    if (!this.game) return;
    this.game.startTurn();
    save(SAVE_KEY, this.game.serialize());
    this.renderAll(true);
    this.checkEnd();
  }

  private checkEnd() {
    if (!this.game || (this.game.status !== 'won' && this.game.status !== 'lost')) return;

    this.renderAll(false);
    const score = this.game.computeScore();
    const container = this.refs.endSummary;
    if (!container) return;
    container.innerHTML = '';

    if (this.refs.endTitle) {
      this.refs.endTitle.textContent = this.game.status === 'won' ? 'You Win!' : 'Game Over';
    }

    if (this.game.status === 'won') {
      const p = el('p', { text: `You cleared the dungeon with ${this.game.health} health.` });
      container.appendChild(p);
      const s = el('h3', { class: 'score', text: `Score: ${score}` });
      container.appendChild(s);

      const g = this.game;
      const lastDefeatedCard = g.weapon && g.weapon.stack && g.weapon.stack.length > 0
        ? g.weapon.stack[g.weapon.stack.length - 1]
        : null;
      if (lastDefeatedCard) {
        const wrap = el('div', { class: 'end-killer' });
        wrap.appendChild(el('div', { class: 'small', text: 'Last enemy defeated' }));
        wrap.appendChild(this.renderMiniCard(lastDefeatedCard));
        container.appendChild(wrap);
      }
    } else {
      const killer = this.game.killerCard;
      const p = el('p', { text: killer ? `You were defeated by ${killer.suit}${displayRank(killer)}.` : `You died.` });
      container.appendChild(p);
      const s = el('h3', { class: 'score', text: `Score: ${score}` });
      container.appendChild(s);
      if (killer) {
        const wrap = el('div', { class: 'end-killer' });
        wrap.appendChild(this.renderMiniCard(killer));
        container.appendChild(wrap);
      }
    }

    if (this.refs.endModal) this.showDialog(this.refs.endModal);
  }

  private renderMiniCard(card: Card): HTMLElement {
    const li = el('div', {
      class: 'card mini',
      attrs: { role: 'img', 'aria-label': `${card.suit}${displayRank(card)} ${labelFor(card)}` },
    });
    li.classList.add(card.type);
    if (card.suit === '♣') li.classList.add('club');
    if (card.suit === '♠') li.classList.add('spade');
    if (card.suit === '♦') li.classList.add('diamond');
    if (card.suit === '♥') li.classList.add('heart');

    const inner = el('div', { class: 'card-inner' });
    const art = el('div', { class: 'art' });
    art.style.backgroundImage = `url('${this.artFor(card)}')`;
    inner.append(el('div', { class: 'suit', text: card.suit }));
    inner.append(el('div', { class: 'value', text: displayRank(card) }));
    inner.append(el('div', { class: 'badge', text: labelFor(card) }));
    li.append(art, inner);
    return li;
  }

  private renderAll(animate = false) {
    this.renderHUD();
    this.renderRoom(animate);
    this.renderLog();
    this.updateActions();
  }

  private renderHUD() {
    const g = this.game;
    if (!g) return;
    const r = this.refs;
    const pct = (g.health / MAX_HEALTH) * 100;
    if (r.healthBar) {
      (r.healthBar as HTMLElement).style.width = pct + '%';
      r.healthBar.setAttribute('aria-valuenow', String(g.health));
    }
    if (r.healthText) r.healthText.textContent = `${g.health} / ${MAX_HEALTH}`;

    if (r.weaponValue && r.lastDefeated) {
      if (g.weapon) {
        r.weaponValue.textContent = `♦${g.weapon.value}`;
        r.lastDefeated.textContent = g.weapon.lastDefeated != null ? `last ${g.weapon.lastDefeated}` : '—';
      } else {
        r.weaponValue.textContent = '—';
        r.lastDefeated.textContent = '—';
      }
    }

    if (r.turnCounter) r.turnCounter.textContent = String(g.turn);
    if (r.deckCount) r.deckCount.textContent = String(g.deck.length);
    if (r.discardCount) r.discardCount.textContent = String(g.discard.length);
  }

  private renderRoom(animate: boolean) {
    const grid = this.refs.roomGrid;
    if (!grid || !this.game) return;

    grid.innerHTML = '';
    const g = this.game;
    const cards = [...g.room];
    while (cards.length < 4) cards.push(null as any);

    cards.forEach((card, idx) => {
      const item = this.renderCard(card as Card | null, idx, animate);
      grid.appendChild(item);
    });

    const actions = this.refs.roomActions;
    if (!actions) return;
    actions.innerHTML = '';
    const realCount = g.room.length;
    if (g.status === 'playing' && realCount > 0) {
      const needNow = Math.max(0, Math.min(3, realCount) - this.selected.size);
      const btnText = needNow === 0 ? 'Face Selected' : `Face Selected (${needNow} more)`;
      const btn = el('button', { class: 'btn primary', text: btnText, attrs: { type: 'button' } });
      btn.addEventListener('click', () => this.onFace());
      actions.appendChild(btn);

      const canAvoid = !g.avoidedLastTurn && g.room.length === 4;
      const avoid = el('button', { class: 'btn danger', text: 'Avoid Room', attrs: { type: 'button' } });
      (avoid as HTMLButtonElement).disabled = !canAvoid;
      avoid.title = canAvoid ? '' : 'You cannot avoid now';
      avoid.addEventListener('click', () => this.onAvoid());
      actions.appendChild(avoid);

      const need = Math.min(3, realCount);
      const hint = el('p', { class: 'hint' });
      hint.textContent = `Choose ${need} card${need === 1 ? '' : 's'} to resolve. ${
        realCount === 4 ? '1 will carry forward.' : 'No carry at deck end.'
      }`;
      actions.appendChild(hint);
    }
  }

  private renderCard(card: Card | null, idx: number, animate: boolean): HTMLElement {
    const isPlaceholder = !card;
    const li = el('div', {
      class: 'card',
      attrs: { role: 'listitem', tabindex: isPlaceholder ? '-1' : '0' },
    });

    if (isPlaceholder) {
      li.classList.add('disabled', 'placeholder');
      const art = el('div', { class: 'art' });
      art.style.backgroundImage = `url('${deckImg}')`;
      const inner = el('div', { class: 'card-inner' });
      inner.append(el('div', { class: 'suit', text: '' }));
      inner.append(el('div', { class: 'value', text: '' }));
      inner.append(el('div', { class: 'badge', text: '' }));
      li.append(art, inner);
      return li;
    }

    li.classList.add(card.type);
    if (card.suit === '♣') li.classList.add('club');
    if (card.suit === '♠') li.classList.add('spade');
    if (card.suit === '♦') li.classList.add('diamond');
    if (card.suit === '♥') li.classList.add('heart');

    const flip = el('div', { class: 'flip' });
    const back = el('div', { class: 'face back' });
    const backArt = el('div', { class: 'art' });
    backArt.style.backgroundImage = `url('${deckImg}')`;
    back.append(backArt);

    const front = el('div', { class: 'face front' });
    const art = el('div', { class: 'art' });
    art.style.backgroundImage = `url('${this.artFor(card)}')`;
    const inner = el('div', { class: 'card-inner' });
    inner.append(el('div', { class: 'suit', text: card.suit }));
    inner.append(el('div', { class: 'value', text: displayRank(card) }));
    inner.append(el('div', { class: 'badge', text: labelFor(card) }));
    front.append(art, inner);

    flip.append(back, front);
    li.append(flip);

    const selectable = this.game?.status === 'playing' && this.game.room.length > 0;
    if (selectable) {
      li.addEventListener('click', () => this.toggleSelect(idx));
      li.addEventListener('keydown', (e: KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          this.toggleSelect(idx);
        }
      });
      li.setAttribute('aria-pressed', this.selected.has(idx) ? 'true' : 'false');
    }

    if (this.selected.has(idx)) li.classList.add('selected');
    if (animate && !prefersReducedMotion())
      requestAnimationFrame(() => {
        li.classList.add('flip-enter');
        requestAnimationFrame(() => li.classList.add('flip-enter-active'));
        window.setTimeout(() => {
          li.classList.remove('flip-enter');
          li.classList.remove('flip-enter-active');
        }, 760);
      });

    return li;
  }

  private artFor(card: Card): string {
    const v = card.value;
    switch (card.suit) {
      case '♥':
        return heartImg;
      case '♣': {
        const tier = v <= 5 ? 1 : v <= 10 ? 2 : 3;
        return tier === 1 ? club1Img : tier === 2 ? club2Img : club3Img;
      }
      case '♠': {
        const tier = v <= 5 ? 1 : v <= 10 ? 2 : 3;
        return tier === 1 ? spade1Img : tier === 2 ? spade2Img : spade3Img;
      }
      case '♦': {
        const tier = v <= 4 ? 1 : v <= 7 ? 2 : 3;
        return tier === 1 ? diamond1Img : tier === 2 ? diamond2Img : diamond3Img;
      }
      default:
        return deckImg;
    }
  }

  private toggleSelect(idx: number) {
    if (this.selected.has(idx)) this.selected.delete(idx);
    else this.selected.add(idx);

    if (this.selected.size > 3) {
      const first = this.selected.values().next().value as number | undefined;
      if (typeof first === 'number') this.selected.delete(first);
    }
    this.renderRoom(false);
    this.updateActions();
  }

  private updateActions() {
    if (!this.game || !this.refs.roomActions) return;
    const realCount = this.game.room.length;
    const btn = this.refs.roomActions.querySelector('button');
    if (!btn) return;
    const needed = Math.max(0, Math.min(3, realCount) - this.selected.size);
    btn.textContent = needed === 0 ? 'Face Selected' : `Face Selected (${needed} more)`;
    (btn as HTMLButtonElement).disabled = needed !== 0;
  }

  private renderLog() {
    if (!this.game || !this.refs.log) return;
    const log = this.refs.log;
    log.innerHTML = '';
    const frag = document.createDocumentFragment();
    this.game.log.slice(-200).forEach((entry) => {
      const p = el('p', { text: entry.msg });
      p.classList.add((entry.kind as LogKind) || 'info');
      frag.appendChild(p);
    });
    log.appendChild(frag);
    (log as HTMLElement).scrollTop = log.scrollHeight;
  }

  private logLine(msg: string, kind: LogKind = 'info') {
    if (!this.refs.log) return;
    const p = el('p', { text: msg });
    p.classList.add(kind);
    this.refs.log.appendChild(p);
    (this.refs.log as HTMLElement).scrollTop = this.refs.log.scrollHeight;
  }
}

function labelFor(card: Card): string {
  if (card.type === 'weapon') return 'Weapon';
  if (card.type === 'potion') return 'Potion';
  return card.suit === '♣' || card.suit === '♠' ? 'Monster' : '';
}
