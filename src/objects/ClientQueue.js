import Phaser from 'phaser';
import { GAME_CONFIG } from '../config.js';
import Client from './Client.js';

const C = GAME_CONFIG.clients;

/**
 * Per-tap queue of bar patrons. Holds up to `C.queueSize` visible clients.
 * Spawns new clients into empty rear slots after a randomized delay.
 *
 * GameScene calls:
 *   .update(deltaMs)           — tick patience timers, dequeue angry leavers
 *   .front()                   — current front-of-line client (or null)
 *   .serveFront()              — pop the front, returns tip earned
 *   .onAngryLeave(callback)    — register score-penalty callback
 */
export default class ClientQueue {
  constructor(scene, anchorX, availableBeerStyles = []) {
    this.scene = scene;
    this.anchorX = anchorX;
    this.availableBeerStyles = availableBeerStyles;
    this.clients = []; // index 0 = front
    this.nextSpawnAt = scene.time.now + C.initialSpawnDelayMs;
    this.angryCb = null;
  }

  onAngryLeave(cb) {
    this.angryCb = cb;
  }

  front() {
    return this.clients[0] || null;
  }

  update(deltaMs) {
    // Tick patience for everyone (only the front actually drains visibly,
    // but back clients lose patience too — they spawned earlier, they wait).
    for (let i = this.clients.length - 1; i >= 0; i--) {
      const c = this.clients[i];
      const expired = c.updatePatience(deltaMs);
      if (expired) {
        this.removeClient(i, /* angry */ true);
      }
    }

    // Spawn into rear slots if there's space and the cooldown has elapsed.
    if (this.clients.length < C.queueSize && this.scene.time.now >= this.nextSpawnAt) {
      this.spawnClient();
      this.nextSpawnAt =
        this.scene.time.now +
        Phaser.Math.Between(C.spawnMinDelayMs, C.spawnMaxDelayMs);
    }
  }

  spawnClient() {
    const slot = this.clients.length;
    // Spawn slightly off to the side of the target slot so spawnAnim slides in.
    const spawnX = this.anchorX + slot * C.queueXOffset;
    const spawnY = C.frontBottomY + slot * C.queueYOffset;
    const wantedStyle = this.pickRandomAvailableStyle();
    const client = new Client(this.scene, spawnX, spawnY, wantedStyle);
    this.clients.push(client);
    client.applyQueueSlot(slot, this.anchorX);
  }

  pickRandomAvailableStyle() {
    if (!this.availableBeerStyles.length) return null;
    const idx = Math.floor(Math.random() * this.availableBeerStyles.length);
    return this.availableBeerStyles[idx];
  }

  /**
   * Pop the front client (served), return { tip, preference } so the
   * caller can score against the client's preference. tipMultiplier
   * scales the tip (1.0 = neutral, <1 = bad pour, >1 = exceeded expectations).
   */
  serveFront(tipMultiplier = 1) {
    const front = this.clients[0];
    if (!front) return { tip: 0, preference: null };
    const baseTip = front.collectTip();
    const tip = Math.max(0, Math.round(baseTip * tipMultiplier));
    const preference = front.preference;
    front.leaveServed();
    this.clients.shift();
    this.reflow();
    return { tip, preference };
  }

  /** Peek at the front client's preference without removing them. */
  frontPreference() {
    return this.clients[0]?.preference || null;
  }

  /** Peek at the front client's wanted beer style without removing them. */
  frontWantedBeerStyle() {
    return this.clients[0]?.wantedBeerStyle || null;
  }

  removeClient(index, angry) {
    const client = this.clients[index];
    if (!client) return;
    this.clients.splice(index, 1);
    if (angry) {
      if (this.angryCb) this.angryCb(client);
      client.leaveAngry();
    } else {
      client.leaveServed();
    }
    this.reflow();
  }

  reflow() {
    this.clients.forEach((c, i) => c.applyQueueSlot(i, this.anchorX));
  }

  destroy() {
    this.clients.forEach((c) => c.destroy());
    this.clients = [];
  }
}
