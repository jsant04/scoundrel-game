// Core game model and rules for Scoundrel (ported from js/game.js)

import { makeRNG, shuffle, clamp, sum } from './utils';

export const MAX_HEALTH = 20;

export type CardSuit = '♣' | '♠' | '♦' | '♥';
export type CardRank = 2|3|4|5|6|7|8|9|10|'J'|'Q'|'K'|'A';
export type CardType = 'monster' | 'weapon' | 'potion';

export interface Card {
  suit: CardSuit;
  rank: CardRank | number;
  value: number;
  type: CardType;
  id: string;
}

export interface WeaponState {
  card: Card;
  value: number;
  stack: Card[];
  lastDefeated: number | null;
}

export interface SerializedGame {
  turn: number;
  health: number;
  weapon: WeaponState | null;
  potionUsedThisRoom: boolean;
  avoidedLastTurn: boolean;
  carryCard: Card | null;
  killerCard: Card | null;
  deck: Card[];
  discard: Card[];
  room: Card[];
  log: { t: number; msg: string; kind: string }[];
  status: 'playing' | 'won' | 'lost';
}

export function rankToValue(rank: CardRank | number): number {
  if (typeof rank === 'number') return rank;
  return { J: 11, Q: 12, K: 13, A: 14 }[rank] ?? 0;
}

export function makeDeck(): Card[] {
  const suits: CardSuit[] = ['♣', '♠', '♦', '♥'];
  const ranks: (CardRank)[] = [2,3,4,5,6,7,8,9,10,'J','Q','K','A'];
  const all: Card[] = [];
  let idCounter = 0;
  for (const s of suits) {
    for (const r of ranks) {
      const v = rankToValue(r);
      const type: CardType = s === '♦' ? 'weapon' : s === '♥' ? 'potion' : 'monster';
      all.push({ suit: s, rank: r, value: v, type, id: `${s}${r}-${idCounter++}` });
    }
  }
  const filtered = all.filter((c) => {
    if (c.suit === '♦' || c.suit === '♥') {
      if (['J','Q','K','A'].includes(String(c.rank))) return false;
    }
    return true;
  });
  return filtered;
}

function canUseWeaponOn(weapon: WeaponState | null, monsterValue: number): boolean {
  if (!weapon) return false;
  if (weapon.lastDefeated == null) return true;
  return monsterValue <= weapon.lastDefeated;
}

export class Game {
  rng: (() => number) & { seed?: number };
  turn!: number;
  health!: number;
  weapon!: WeaponState | null;
  potionUsedThisRoom!: boolean;
  avoidedLastTurn!: boolean;
  carryCard!: Card | null;
  killerCard!: Card | null;
  deck!: Card[];
  discard!: Card[];
  room!: Card[];
  log!: { t: number; msg: string; kind: string }[];
  status!: 'playing' | 'won' | 'lost';

  constructor() {
    this.rng = makeRNG(Date.now());
    this.resetState();
  }

  resetState() {
    this.turn = 1;
    this.health = MAX_HEALTH;
    this.weapon = null;
    this.potionUsedThisRoom = false;
    this.avoidedLastTurn = false;
    this.carryCard = null;
    this.killerCard = null;

    const base = makeDeck();
    this.deck = shuffle([...base], this.rng);
    this.discard = [];
    this.room = [];
    this.log = [];
    this.status = 'playing';
  }

  static fromSaved(data: SerializedGame): Game {
    const g = new Game();
    Object.assign(g, data);
    g.rng = makeRNG(Date.now());

    if (g.weapon && !g.weapon.card) {
      const value = g.weapon.value;
      g.weapon = {
        card: { suit: '♦', rank: value, value, type: 'weapon', id: `restored-♦${value}` },
        value,
        stack: [],
        lastDefeated: g.weapon.lastDefeated ?? null,
      };
    }
    if (typeof g.killerCard === 'undefined') g.killerCard = null;
    return g;
  }

  serialize(): SerializedGame {
    return {
      turn: this.turn,
      health: this.health,
      weapon: this.weapon,
      potionUsedThisRoom: this.potionUsedThisRoom,
      avoidedLastTurn: this.avoidedLastTurn,
      carryCard: this.carryCard,
      killerCard: this.killerCard,
      deck: this.deck,
      discard: this.discard,
      room: this.room,
      log: this.log,
      status: this.status,
    };
  }

  drawToRoom() {
    if (this.room.length === 0 && this.carryCard) {
      this.room.push(this.carryCard);
      this.carryCard = null;
    }
    while (this.room.length < 4 && this.deck.length > 0) {
      this.room.push(this.deck.shift() as Card);
    }
  }

  startTurn() {
    if (this.status !== 'playing') return;
    this.potionUsedThisRoom = false;
    this.logMsg(`Turn ${this.turn}`, 'turn');
    this.drawToRoom();
  }

  logMsg(msg: string, kind: string = 'info') {
    const line = { t: Date.now(), msg, kind };
    this.log.push(line);
    return line;
  }

  avoidRoom() {
    if (this.status !== 'playing') return { ok: false as const, reason: 'not-playing' as const };
    if (this.avoidedLastTurn) return { ok: false as const, reason: 'avoid-twice' as const };
    if (this.room.length < 4) this.drawToRoom();
    const toBottom = [...this.room];
    this.room = [];
    this.deck.push(...toBottom);
    this.avoidedLastTurn = true;
    this.turn += 1;
    this.logMsg('Avoided the room. The four cards go to the bottom.', 'info');
    this.checkEnd();
    return { ok: true as const };
  }

  canResolveCard(index: number): boolean {
    if (this.status !== 'playing') return false;
    if (index < 0 || index >= this.room.length) return false;
    return true;
  }

  resolveCard(index: number) {
    if (!this.canResolveCard(index)) return { ok: false };
    const card = this.room.splice(index, 1)[0];
    let summary = '';

    if (card.type === 'weapon') {
      if (this.weapon) {
        this.discard.push(this.weapon.card, ...this.weapon.stack);
      }
      this.weapon = { card, value: card.value, stack: [], lastDefeated: null };
      summary = `Equipped ♦${card.value}`;
      this.logMsg(summary, 'good');
    } else if (card.type === 'potion') {
      if (this.potionUsedThisRoom) {
        summary = `Discarded extra potion ♥${card.value}`;
        this.discard.push(card);
        this.logMsg(summary, 'info');
      } else {
        const before = this.health;
        this.health = clamp(this.health + card.value, 0, MAX_HEALTH);
        const healed = this.health - before;
        summary = `Drank ♥${card.value} and healed ${healed}`;
        this.potionUsedThisRoom = true;
        this.discard.push(card);
        this.logMsg(summary, 'good');
      }
    } else if (card.type === 'monster') {
      const monsterValue = card.value;
      if (!this.weapon) {
        this.health -= monsterValue;
        summary = `Bare-handed vs ${card.suit}${displayRank(card)} → took ${monsterValue} damage`;
        this.discard.push(card);
        this.logMsg(summary, 'bad');
      } else {
        if (!canUseWeaponOn(this.weapon, monsterValue)) {
          this.health -= monsterValue;
          summary = `Weapon blocked (last ${this.weapon.lastDefeated}). Took ${monsterValue} from ${card.suit}${displayRank(card)}`;
          this.discard.push(card);
          this.logMsg(summary, 'bad');
        } else {
          const damage = Math.max(0, monsterValue - this.weapon.value);
          if (damage > 0) {
            this.health -= damage;
            summary = `Hit ${card.suit}${displayRank(card)} with ♦${this.weapon.value} → took ${damage}`;
            this.discard.push(card);
            this.logMsg(summary, 'bad');
          } else {
            this.weapon.stack.push(card);
            this.weapon.lastDefeated = monsterValue;
            summary = `Defeated ${card.suit}${displayRank(card)} with ♦${this.weapon.value}`;
            this.logMsg(summary, 'good');
          }
        }
      }
    }

    if (this.health <= 0) {
      if (card && card.type === 'monster' && !this.killerCard) {
        this.killerCard = card;
      }
      this.status = 'lost';
      this.logMsg('You died…', 'bad');
    }

    return { ok: true, card, summary };
  }

  faceRoom(selectedIndices: number[]) {
    if (this.status !== 'playing') return { ok: false as const, reason: 'not-playing' as const };
    if (this.room.length === 0) return { ok: false as const, reason: 'no-cards' as const };
    this.drawToRoom();
    const need = Math.min(3, this.room.length);
    if (selectedIndices.length !== need) return { ok: false as const, reason: 'need-n' as const };

    const original = [...this.room];
    const chosen = selectedIndices.map((i) => original[i]);
    const carry =
      original.length === 4
        ? original.find((_, idx) => !selectedIndices.includes(idx)) ?? null
        : null;

    this.potionUsedThisRoom = false;

    for (const chosenCard of chosen) {
      if (this.status !== 'playing') break;
      const index = this.room.findIndex((c) => c.id === chosenCard.id);
      if (index !== -1) this.resolveCard(index);
    }

    if (this.status === 'playing') {
      this.carryCard = carry;
      this.room = [];
      this.turn += 1;
      this.avoidedLastTurn = false;
      if (carry) this.logMsg(`Carrying ${carry.suit}${displayRank(carry)} forward`, 'info');
    }

    this.checkEnd();
    return { ok: true as const };
  }

  checkEnd() {
    if (this.status !== 'playing') return;
    if (this.health <= 0) {
      this.status = 'lost';
      return;
    }
    if (this.deck.length === 0 && this.room.length === 0 && !this.carryCard) {
      this.status = 'won';
      return;
    }
  }

  computeScore(): number {
    if (this.status === 'won') return this.health;
    if (this.status === 'lost') {
      const remainingMonsters = [...this.deck, ...this.room, ...(this.carryCard ? [this.carryCard] : [])]
        .filter((c) => c.type === 'monster')
        .map((c) => c.value);
      return -sum(remainingMonsters);
    }
    return 0;
  }
}

export function displayRank(card: Card): string {
  return typeof card.rank === 'number' ? String(card.rank) : card.rank;
}
