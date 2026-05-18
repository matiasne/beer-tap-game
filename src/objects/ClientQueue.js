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
  constructor(scene, anchorX, availableBeerStyles = [], opts = {}) {
    this.scene = scene;
    this.anchorX = anchorX;
    this.availableBeerStyles = availableBeerStyles;
    this.clients = []; // index 0 = front
    this.nextSpawnAt = scene.time.now + C.initialSpawnDelayMs;
    this.angryCb = null;
    // Tanda-mode options: cap the total spawn count and disable the
    // front-client patience drain so clients only leave when served.
    this.maxTotalSpawns = opts.maxTotalSpawns ?? null; // null = unlimited
    this.noPatienceDecay = !!opts.noPatienceDecay;
    this.totalSpawned = 0;
    // Idle-chatter scheduler — back clients occasionally turn to each other
    // and play a short talking animation so the queue feels alive. Only the
    // back clients (slot >= 1) chat; the front client stays focused on the
    // tap. State: { speakerIdx, ms } tracks the active conversation; null
    // when nobody is chatting.
    this.chatter = null;
    this.nextChatterAt = scene.time.now + Phaser.Math.Between(2000, 5000);
  }

  onAngryLeave(cb) {
    this.angryCb = cb;
  }

  front() {
    return this.clients[0] || null;
  }

  update(deltaMs) {
    // Patience drain — disabled in Tanda where clients only leave when served.
    const front = this.clients[0];
    if (front && !this.noPatienceDecay) {
      const expired = front.updatePatience(deltaMs);
      if (expired) {
        this.removeClient(0, /* angry */ true);
      }
    }

    // Spawn into rear slots if there's space, cooldown elapsed, and the
    // total-spawn cap (if any) has not been reached.
    const canSpawn = this.maxTotalSpawns == null
      || this.totalSpawned < this.maxTotalSpawns;
    if (canSpawn && this.clients.length < C.queueSize && this.scene.time.now >= this.nextSpawnAt) {
      this.spawnClient();
      this.nextSpawnAt =
        this.scene.time.now +
        Phaser.Math.Between(C.spawnMinDelayMs, C.spawnMaxDelayMs);
    }

    this.updateChatter(deltaMs);
  }

  /**
   * True when the queue has spawned its full roster AND the visible queue
   * is empty — i.e. every scheduled client has been served. Used by
   * GameScene for Tanda's "clear the bar" win condition. Returns false
   * for queues with no spawn cap (infinite spawn loop never exhausts).
   */
  isExhausted() {
    if (this.maxTotalSpawns == null) return false;
    return this.totalSpawned >= this.maxTotalSpawns && this.clients.length === 0;
  }

  /** Number of clients still to be served (in-queue + not-yet-spawned). */
  remaining() {
    if (this.maxTotalSpawns == null) return this.clients.length;
    return Math.max(0, this.maxTotalSpawns - this.totalSpawned) + this.clients.length;
  }

  /**
   * Drives the idle-chatter state machine: clients in slots 1+ occasionally
   * turn toward a neighbor and play their talking animation. Lasts a short
   * burst, then we wait a random cooldown before the next chat.
   */
  updateChatter(deltaMs) {
    if (this.chatter) {
      this.chatter.ms -= deltaMs;
      // If either party left the queue mid-conversation, end it gracefully.
      const left = this.clients[this.chatter.leftIdx];
      const right = this.clients[this.chatter.rightIdx];
      if (!left || !right || this.chatter.ms <= 0) {
        if (left && left.isAlive) left.setTalking(null);
        if (right && right.isAlive) right.setTalking(null);
        this.chatter = null;
        this.nextChatterAt = this.scene.time.now + Phaser.Math.Between(2500, 6000);
      }
      return;
    }
    if (this.scene.time.now < this.nextChatterAt) return;
    // Need at least 2 back clients (slots 1 and 2) for them to chat with
    // each other. The front client stays focused on the tap.
    if (this.clients.length < 3) {
      this.nextChatterAt = this.scene.time.now + 1500;
      return;
    }
    const leftIdx = 1;
    const rightIdx = 2;
    const left = this.clients[leftIdx];
    const right = this.clients[rightIdx];
    if (!left || !right) return;
    // slotIndex grows from front→back, but in screen-space "right of" the
    // slot-1 client is slot-2 (per queueXOffset). So slot 1 talks RIGHT and
    // slot 2 talks LEFT to face each other.
    left.setTalking('right');
    right.setTalking('left');
    this.chatter = {
      leftIdx,
      rightIdx,
      ms: Phaser.Math.Between(1800, 3500),
    };
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
    this.totalSpawned += 1;
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
    // Slot indices changed — any active chatter is now stale. End it; a
    // fresh chat will start on the next cooldown.
    if (this.chatter) {
      this.clients.forEach((c) => c.isAlive && c.setTalking(null));
      this.chatter = null;
      this.nextChatterAt = this.scene.time.now + Phaser.Math.Between(1500, 3500);
    }
  }

  destroy() {
    this.clients.forEach((c) => c.destroy());
    this.clients = [];
  }
}
