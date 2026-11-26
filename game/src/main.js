// Boot and the one loop: input is read every frame, the world advances in fixed
// 1/60 s steps (several in a slow frame, none in a fast one), and the renderer
// paints what is there. The game moves between six screens: title, sortie brief,
// play, paused, game over and victory. A sortie is one flight of the valley;
// finishing it lands the plane on a runway and briefs the next one.
//
// ?seed=N fixes the valley and the clouds. ?shot=start|flight|landing|complete
// (with &seed=N) stages that scene instead of running the loop, paints it twice
// and sets window.__shotReady for a screenshot.

import { BEST_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createTerrain } from './terrain.js';
import { createFlight, EVENT_CRASH, EVENT_DRUM, EVENT_FUEL_LOW, EVENT_LANDED, EVENT_OVER, EVENT_RING } from './flight.js';
import { createMissions } from './missions.js';
import { ACTION_CONFIRM, ACTION_MUTE, ACTION_PAUSE, createInput } from './input.js';
import { createAudio } from './audio.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_SORTIE, SCREEN_TITLE, SCREEN_VICTORY } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;
/** Seconds a banner line stays on the screen. */
const BANNER_SECONDS = 3.5;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 7;

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const terrain = createTerrain(createRandom(seed));
const flight = createFlight(terrain);
const missions = createMissions(terrain, flight);
const renderer = createRenderer(canvas);
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, flight, terrain, missions);
  let painted = 0;
  function paint() {
    renderer.draw(
      flight.state,
      terrain,
      missions,
      scene.screen,
      { time: 12, best: scene.best, banner: scene.banner, sortieName: '', sortieBrief: '' },
    );
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  let elapsed = 0;
  let banner = '';
  let bannerLeft = 0;
  let missionDoneMessage = '';
  let missionDoneAt = 0;

  // Screen readers (and anyone watching the page's text) hear the screen changes.
  function announce(message) {
    status.textContent = message;
  }

  function showBanner(message) {
    banner = message;
    bannerLeft = BANNER_SECONDS;
  }

  function startSortie() {
    flight.reset(missions.index);
    screen = SCREEN_SORTIE;
    announce(`${missions.name}. ${missions.brief}`);
  }

  function beginFlight() {
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce(`Flying. ${missions.name}.`);
  }

  function endGame() {
    screen = SCREEN_OVER;
    if (flight.plane.score > best) {
      best = flight.plane.score;
      saveBest(best);
    }
    announce(`Crashed. Score ${flight.plane.score}. Best ${best}.`);
  }

  function finishVictory() {
    screen = SCREEN_VICTORY;
    if (flight.plane.score > best) {
      best = flight.plane.score;
      saveBest(best);
    }
    announce(`All sorties complete. Score ${flight.plane.score}.`);
  }

  function runwayUnder(x) {
    for (const runway of terrain.runways) {
      if (x > runway.x0 && x < runway.x1) return runway.name;
    }
    return null;
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      const muted = audio.toggleMute();
      showBanner(muted ? 'Sound off' : 'Sound on');
      return;
    }
    if (actions & ACTION_CONFIRM && screen === SCREEN_TITLE) {
      audio.unlock();
      missions.reset();
      startSortie();
    } else if (actions & ACTION_CONFIRM && screen === SCREEN_SORTIE) {
      beginFlight();
    } else if (actions & ACTION_CONFIRM && screen === SCREEN_OVER) {
      missions.reset();
      startSortie();
    } else if (actions & ACTION_CONFIRM && screen === SCREEN_VICTORY) {
      missions.reset();
      startSortie();
    } else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
  }

  function step() {
    if (screen === SCREEN_TITLE) {
      flight.step(STEP, { throttle: 0, pitch: 0, brake: false });
      return;
    }
    if (screen !== SCREEN_PLAY) return;
    const pointerPitch = input.pointerPitch();
    const pitch = input.pitch() !== 0 ? input.pitch() : pointerPitch;
    const events = flight.step(STEP, {
      throttle: input.throttle(),
      pitch,
      brake: input.braking(),
    });
    const pickupEvents = missions.checkPickups();
    const all = events | pickupEvents;
    audio.engine(flight.plane.throttle, !flight.plane.onGround);
    if (all & EVENT_RING) {
      audio.ring();
      const message = missions.onRing();
      if (message) {
        missionDoneMessage = message;
        missionDoneAt = elapsed;
        showBanner(message);
        audio.fanfare();
      } else {
        showBanner(`Ring ${flight.state.ringsTaken} of 6 — nice flying!`);
      }
    }
    if (all & EVENT_DRUM) {
      audio.pickup();
      showBanner('Fuel drum — tank topped up +35.');
    }
    if (all & 4) {
      audio.pickup();
      showBanner('Parcel aboard — now land it at Eagle\u2019s Nest.');
    }
    if (all & 8) {
      audio.pickup();
      showBanner('Hiker aboard — now land at Eagle\u2019s Nest.');
    }
    if (all & EVENT_FUEL_LOW) showBanner('LOW FUEL — find a green drum or land to refuel.');
    if (all & EVENT_CRASH) {
      audio.crash();
      showBanner('Ouch — that one hurt. Two hits left, maybe.');
    }
    if (all & EVENT_LANDED) {
      audio.land();
      const runwayName = runwayUnder(flight.plane.x);
      const message = missions.onLanded(runwayName);
      if (message) {
        missionDoneMessage = message;
        missionDoneAt = elapsed;
        showBanner(message);
        audio.fanfare();
        if (missions.isVictory) {
          finishVictory();
          return;
        }
        return;
      }
      flight.plane.fuel = 100;
      showBanner(`Down safe at ${runwayName ?? 'a strip'} — refuelled. Throttle up to go again.`);
    }
    if (all & EVENT_OVER) endGame();
    // A finished sortie lingers on its banner, then the next sortie is briefed.
    if (missionDoneMessage && screen === SCREEN_PLAY && elapsed - missionDoneAt > 2.5) {
      missionDoneMessage = '';
      if (missions.isDone) {
        missions.nextSortie();
        startSortie();
      }
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    elapsed += dt;
    accumulator += dt;
    handleActions();
    if (bannerLeft > 0) bannerLeft -= dt;
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(flight.state, terrain, missions, screen, {
      time: elapsed,
      best,
      banner: bannerLeft > 0 ? banner : '',
      sortieName: missions.name,
      sortieBrief: missions.brief,
    });
  }

  // Leaving the tab pauses a running game rather than letting the valley fly by unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Sky Courier. Press Space or click to fly.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
