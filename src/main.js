import Phaser from 'phaser';
import BootScene from './scenes/BootScene.js';
import MenuScene from './scenes/MenuScene.js';
import LevelIntroScene from './scenes/LevelIntroScene.js';
import GameScene from './scenes/GameScene.js';
import LevelResultScene from './scenes/LevelResultScene.js';

const config = {
  type: Phaser.AUTO,
  parent: 'game',
  width: 800,
  height: 600,
  pixelArt: true,
  backgroundColor: '#1a1612',
  scene: [BootScene, MenuScene, LevelIntroScene, GameScene, LevelResultScene],
};

new Phaser.Game(config);
