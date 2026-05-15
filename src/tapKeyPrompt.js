/**
 * Wire keys 1, 2, 3, 4 in the given scene so any single keypress fires
 * `onPress` exactly once. Used on menu / intro / result screens so the
 * player advances by tapping any tap key — keeps the input vocabulary
 * consistent with gameplay.
 *
 * Returns a teardown function callers can invoke to detach early (e.g.,
 * after handling the press themselves). Phaser tears the listener down
 * automatically when the scene shuts down, but the `once` semantics mean
 * subsequent presses are ignored regardless.
 */
export function onAnyTapKey(scene, onPress) {
  let fired = false;
  const fire = (event) => {
    if (fired) return;
    fired = true;
    onPress(event);
  };
  scene.input.keyboard.once('keydown-ONE', fire);
  scene.input.keyboard.once('keydown-TWO', fire);
  scene.input.keyboard.once('keydown-THREE', fire);
  scene.input.keyboard.once('keydown-FOUR', fire);

  return () => {
    fired = true;
    scene.input.keyboard.off('keydown-ONE', fire);
    scene.input.keyboard.off('keydown-TWO', fire);
    scene.input.keyboard.off('keydown-THREE', fire);
    scene.input.keyboard.off('keydown-FOUR', fire);
  };
}

export const TAP_KEY_HINT = 'press [1] [2] [3] or [4] to continue';
