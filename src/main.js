import Phaser from 'phaser';
import BootScene from './scenes/BootScene.js';
import MenuScene from './scenes/MenuScene.js';
import LevelIntroScene from './scenes/LevelIntroScene.js';
import GameScene from './scenes/GameScene.js';
import LevelResultScene from './scenes/LevelResultScene.js';
import NameEntryScene from './scenes/NameEntryScene.js';
import ScoreboardScene from './scenes/ScoreboardScene.js';

const config = {
  type: Phaser.AUTO,
  parent: 'game',
  width: 800,
  height: 600,
  pixelArt: true,
  backgroundColor: '#1a1612',
  scene: [
    BootScene,
    MenuScene,
    LevelIntroScene,
    GameScene,
    LevelResultScene,
    NameEntryScene,
    ScoreboardScene,
  ],
};

// Wait for the pixel font to be ready before booting so the very first
// text frame already uses it (avoids a one-frame flash of fallback monospace).
async function boot() {
  if (document.fonts?.load) {
    try {
      await document.fonts.load('16px PixelOperator');
    } catch {
      // Font failed to load — fall through to the monospace fallback.
    }
  }
  new Phaser.Game(config);
}

boot();
