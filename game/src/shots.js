// The screenshot scenes behind ?shot=start|flight|landing|complete. Each one plays
// the real rules forward from a fresh world for a fixed number of steps, steered by
// a simple autopilot (hold a target altitude, chase the next ring, glide onto the
// runway), so the frame is what a short game really looks like and the same seed
// always gives the same frame.

import { RING, STEP } from './config.js';
import { EVENT_LANDED, EVENT_OVER } from './flight.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const START_SECONDS = 5;
const FLIGHT_SECONDS = 26;
const LANDING_LIMIT_SECONDS = 240;
const COMPLETE_LIMIT_SECONDS = 240;
const SAMPLE = 1 / 30;

/** Steer toward a target height with a two-loop controller: the outer loop turns
 *  the height error into a desired pitch (steeper the further off), the inner
 *  loop drives the pitch there. A single proportional loop seesaws — the pitch
 *  takes half a second to answer, so it overshoots and arrives at the runway
 *  nose-down, which the touchdown check (max pitch 0.14) refuses. */
function pitchToward(plane, targetY) {
  const gap = targetY - plane.y;
  const desiredPitch = Math.max(-0.5, Math.min(0.5, gap * 0.004));
  return Math.max(-1, Math.min(1, (desiredPitch - plane.pitch) * 3));
}

/** The next ring still standing, or null when the run is done. */
function nextRing(terrain) {
  for (const ring of terrain.rings) if (!ring.taken) return ring;
  return null;
}

/**
 * One autopilot step for open flight: chase the next ring, otherwise cruise 200 px
 * above the ground ahead. Throttle is returned too, as { pitch, throttle }.
 */
function flyToward(terrain, plane, throttle) {
  const ring = nextRing(terrain);
  const ahead = terrain.groundHeight(plane.x + 420);
  const targetY = ring !== null ? ring.y : Math.min(ahead - 200, 300);
  return { pitch: pitchToward(plane, targetY), throttle };
}

/** Glide onto a runway: cruise above the valley, descend on a shallow slope to
 *  the threshold, then settle onto the strip itself — the target height converges
 *  on the runway surface, so pitch and sink are near zero at touchdown. */
function landToward(terrain, plane, runway) {
  const distance = runway.x0 - plane.x;
  let targetY;
  if (distance > 1500) targetY = runway.y - 260;
  else if (plane.x < runway.x0) targetY = runway.y - 60 - Math.max(0, distance) * 0.12;
  else targetY = runway.y - 8;
  return { pitch: pitchToward(plane, targetY), throttle: distance > 500 ? 0.45 : 0.2 };
}

function applyControls(flight, controls, dt) {
  // The flight step reads throttle as a -1..1 nudge, so drive it toward the target.
  const current = flight.plane.throttle;
  const nudge = controls.throttle > current ? 1 : controls.throttle < current - 0.05 ? -1 : 0;
  return { throttle: nudge, pitch: controls.pitch, brake: false };
}

/**
 * Set the flight to the named scene (start, flight, landing, complete; any other
 * name is start) and return the screen to draw over it, the best score to show
 * and a banner line, if the scene earned one.
 */
export function stageShot(name, flight, terrain, missions) {
  flight.reset(0);
  missions.reset();
  if (name !== 'flight' && name !== 'landing' && name !== 'complete') {
    for (let index = 0; index < START_SECONDS / STEP; index += 1) {
      flight.step(STEP, { throttle: 0, pitch: 0, brake: false });
    }
    return { screen: SCREEN_TITLE, best: 0, banner: '' };
  }

  if (name === 'flight') {
    for (let index = 0; index < FLIGHT_SECONDS / STEP; index += 1) {
      const controls = applyControls(flight, flyToward(terrain, flight.plane, 0.75), STEP);
      if (flight.step(STEP, controls) & EVENT_OVER) break;
    }
    const over = flight.plane.crashed;
    return { screen: over ? SCREEN_OVER : SCREEN_PLAY, best: flight.plane.score, banner: '' };
  }

  if (name === 'landing') {
    const runway = terrain.runways[1];
    for (let index = 0; index < LANDING_LIMIT_SECONDS / STEP; index += 1) {
      const controls = applyControls(flight, landToward(terrain, flight.plane, runway), STEP);
      const events = flight.step(STEP, controls);
      if (events & EVENT_LANDED) break;
      if (events & EVENT_OVER) break;
    }
    const over = flight.plane.crashed;
    return {
      screen: over ? SCREEN_OVER : SCREEN_PLAY,
      best: flight.plane.score,
      banner: flight.plane.onGround ? "Touchdown at Eagle's Nest — welcome home." : '',
    };
  }

  // complete: fly the whole ring run, then hold the frame on the finished run.
  for (let index = 0; index < COMPLETE_LIMIT_SECONDS / STEP; index += 1) {
    const controls = applyControls(flight, flyToward(terrain, flight.plane, 0.75), STEP);
    const events = flight.step(STEP, controls);
    if (flight.state.ringsTaken >= RING.count) break;
    if (events & EVENT_OVER) break;
  }
  const over = flight.plane.crashed;
  return {
    screen: over ? SCREEN_OVER : SCREEN_PLAY,
    best: flight.plane.score,
    banner: flight.state.ringsTaken >= RING.count ? `Ring Run complete — all ${RING.count} rings!` : '',
  };
}
