// Keyboard and pointer input. Held keys give throttle and pitch; one-shot presses
// (start, restart, pause, mute) are queued as bit flags and taken once by the loop,
// so a press between two frames is never lost and never counted twice. Holding the
// mouse steers the plane toward the pointer's height on the screen.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_MUTE = 4;

const THROTTLE_UP = new Set(['ArrowUp', 'KeyW']);
const THROTTLE_DOWN = new Set(['ArrowDown', 'KeyS']);
const PITCH_UP = new Set(['ArrowLeft', 'KeyA']);
const PITCH_DOWN = new Set(['ArrowRight', 'KeyD']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const MUTE = new Set(['KeyM']);
const BRAKE = new Set(['Space']);

export function createInput(target) {
  let throttleUp = false;
  let throttleDown = false;
  let pitchUp = false;
  let pitchDown = false;
  let brake = false;
  let actions = 0;
  let pointerDown = false;
  let pointerY = 0;
  let pointerHeight = 1;

  window.addEventListener('keydown', (event) => {
    if (BRAKE.has(event.code)) brake = true;
    if (THROTTLE_UP.has(event.code)) throttleUp = true;
    else if (THROTTLE_DOWN.has(event.code)) throttleDown = true;
    else if (PITCH_UP.has(event.code)) pitchUp = true;
    else if (PITCH_DOWN.has(event.code)) pitchDown = true;
    else if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else if (MUTE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_MUTE;
    } else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    if (BRAKE.has(event.code)) brake = false;
    if (THROTTLE_UP.has(event.code)) throttleUp = false;
    else if (THROTTLE_DOWN.has(event.code)) throttleDown = false;
    else if (PITCH_UP.has(event.code)) pitchUp = false;
    else if (PITCH_DOWN.has(event.code)) pitchDown = false;
  });
  window.addEventListener('blur', () => {
    throttleUp = false;
    throttleDown = false;
    pitchUp = false;
    pitchDown = false;
    pointerDown = false;
  });
  target.addEventListener('pointerdown', (event) => {
    pointerDown = true;
    pointerY = event.clientY;
    pointerHeight = target.clientHeight || 1;
    actions |= ACTION_CONFIRM;
  });
  window.addEventListener('pointermove', (event) => {
    pointerY = event.clientY;
    pointerHeight = target.clientHeight || 1;
  });
  window.addEventListener('pointerup', () => {
    pointerDown = false;
  });

  return {
    /** -1 for throttle down, 1 for up, 0 for neither or both. */
    throttle() {
      return (throttleUp ? 1 : 0) - (throttleDown ? 1 : 0);
    },
    /** -1 for climb, 1 for dive, 0 for neither or both. */
    pitch() {
      return (pitchDown ? 1 : 0) - (pitchUp ? 1 : 0);
    },
    /** Held airbrake (Space). */
    braking() {
      return brake;
    },
    /** While the pointer is held, -1..1 steering toward its height; 0 otherwise. */
    pointerPitch() {
      if (!pointerDown) return 0;
      const f = pointerY / pointerHeight - 0.5;
      return Math.min(1, Math.max(-1, f * 2.4));
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
