// The plane and the sky around it: speed, pitch, lift, sink, fuel, damage and the
// ground itself. No drawing and no browser here, only numbers: step() advances one
// fixed step and returns what happened as bit flags, so the caller can react.

import { DAMAGE, FIELD, FUEL, PLANE, RING, TOUCHDOWN, WORLD_LENGTH } from './config.js';

export const EVENT_RING = 1;
export const EVENT_DRUM = 2;
export const EVENT_PICKUP = 4;
export const EVENT_BEACON = 8;
export const EVENT_LANDED = 16;
export const EVENT_CRASH = 32;
export const EVENT_OVER = 64;
export const EVENT_FUEL_LOW = 128;

const HALF_W = PLANE.width / 2;
const HALF_H = PLANE.height / 2;

export function createFlight(terrain) {
  const plane = {
    x: 0,
    y: 0,
    speed: 0,
    pitch: 0,
    throttle: 0,
    fuel: FUEL.start,
    damage: 0,
    invulnerable: 0,
    score: 0,
    onGround: true,
    crashed: false,
    sinkVel: 0,
    distance: 0,
    fuelWarned: false,
    // East is +1, west is -1. The valley ends turn the plane around instead of
    // letting it stall into the hills: a missed runway is a go-around, not a crash.
    dir: 1,
  };
  const state = { plane, ringsTaken: 0, drumsTaken: 0 };

  function reset(sortie) {
    const runway = terrain.runways[0];
    plane.x = runway.x0 + 120;
    plane.y = runway.y - HALF_H;
    plane.speed = 0;
    plane.pitch = 0;
    plane.throttle = 0;
    plane.fuel = FUEL.start;
    plane.damage = 0;
    plane.invulnerable = 0;
    plane.score = sortie === 0 ? 0 : plane.score;
    plane.onGround = true;
    plane.crashed = false;
    plane.sinkVel = 0;
    plane.distance = 0;
    plane.fuelWarned = false;
    plane.dir = 1;
    state.ringsTaken = 0;
    state.drumsTaken = 0;
    for (const ring of terrain.rings) ring.taken = false;
    for (const drum of terrain.drums) drum.taken = false;
    terrain.parcel.taken = false;
  }

  function runwayUnder(x) {
    for (const runway of terrain.runways) {
      if (x > runway.x0 && x < runway.x1) return runway;
    }
    return null;
  }

  function hitGround(events) {
    // A hard touch on anything but a runway, or a bad landing, costs a life.
    plane.damage += 1;
    plane.invulnerable = DAMAGE.invulnerable;
    plane.speed *= 0.45;
    plane.y = terrain.groundHeight(plane.x) - HALF_H - 6;
    plane.sinkVel = -140;
    events |= EVENT_CRASH;
    if (plane.damage >= DAMAGE.max) {
      plane.crashed = true;
      events |= EVENT_OVER;
    }
    return events;
  }

  function step(dt, controls) {
    let events = 0;
    if (plane.crashed) return events;

    // Throttle: up and down keys, held. Out of fuel the engine is dead.
    if (plane.fuel > 0) {
      plane.throttle = Math.min(1, Math.max(0, plane.throttle + controls.throttle * 0.7 * dt));
    } else {
      plane.throttle = 0;
    }
    if (controls.brake) plane.throttle = Math.max(0, plane.throttle - 1.5 * dt);

    // Pitch: left climbs, right dives, eased toward level when untouched.
    plane.pitch += controls.pitch * PLANE.turnRate * dt;
    if (controls.pitch === 0) plane.pitch *= Math.max(0, 1 - 1.6 * dt);
    plane.pitch = Math.min(0.6, Math.max(-0.6, plane.pitch));

    // Speed chases the throttle setting; climbing bleeds it, drag trims it.
    const target = PLANE.minSpeed + plane.throttle * (PLANE.maxSpeed - PLANE.minSpeed);
    plane.speed += (target - plane.speed) * PLANE.accel * dt;
    if (plane.pitch < 0) plane.speed -= -Math.sin(plane.pitch) * PLANE.climbPenalty * plane.speed * dt;
    plane.speed *= 1 - PLANE.drag * dt * 0.4;
    if (plane.onGround) plane.speed = Math.max(0, plane.speed - 12 * dt);

    // Sink when slow: below stall speed the wing gives up and the plane drops.
    if (!plane.onGround && plane.speed < PLANE.stallSpeed) {
      plane.sinkVel += (PLANE.stallSpeed - plane.speed) * PLANE.sinkFactor * dt;
    } else {
      plane.sinkVel *= Math.max(0, 1 - 2 * dt);
    }

    const vx = plane.dir * Math.cos(plane.pitch) * plane.speed;
    const vy = Math.sin(plane.pitch) * plane.speed + plane.sinkVel;
    plane.x += vx * dt;
    plane.y += vy * dt;
    plane.distance += Math.abs(vx) * dt;

    // The valley ends: turn around and fly back. The turn costs a little speed,
    // and the heading (and the sprite, in render.js) follows plane.dir.
    if (plane.x > WORLD_LENGTH - 120) {
      plane.x = WORLD_LENGTH - 120;
      plane.dir = -1;
      plane.speed *= 0.9;
    }
    if (plane.x < 40) {
      plane.x = 40;
      plane.dir = 1;
      plane.speed *= 0.9;
    }

    // Fuel burns with the throttle; warn once when it runs low.
    plane.fuel -= (FUEL.burnIdle + plane.throttle * (FUEL.burnFull - FUEL.burnIdle)) * dt;
    plane.fuel = Math.max(0, plane.fuel);
    if (plane.fuel <= FUEL.warningAt && !plane.fuelWarned) {
      plane.fuelWarned = true;
      events |= EVENT_FUEL_LOW;
    }
    if (plane.invulnerable > 0) plane.invulnerable = Math.max(0, plane.invulnerable - dt);

    const groundY = terrain.groundHeight(plane.x);

    // Take-off: fast enough on the ground and pulling up lifts off.
    if (plane.onGround) {
      plane.y = groundY - HALF_H;
      if (plane.speed > 110 && plane.pitch < -0.05) plane.onGround = false;
    } else {
      // Rings and fuel drums: fly through the circle to collect.
      for (const ring of terrain.rings) {
        if (ring.taken) continue;
        const dx = plane.x - ring.x;
        const dy = plane.y - ring.y;
        if (dx * dx + dy * dy < RING.radius * RING.radius) {
          ring.taken = true;
          state.ringsTaken += 1;
          plane.score += RING.points;
          events |= EVENT_RING;
        }
      }
      for (const drum of terrain.drums) {
        if (drum.taken) continue;
        const dx = plane.x - drum.x;
        const dy = plane.y - drum.y;
        if (dx * dx + dy * dy < RING.radius * RING.radius) {
          drum.taken = true;
          state.drumsTaken += 1;
          plane.fuel = Math.min(100, plane.fuel + FUEL.drumRefill);
          plane.score += 25;
          events |= EVENT_DRUM;
        }
      }

      // The ground: land on a runway, or take damage.
      if (plane.y + HALF_H >= groundY) {
        const runway = runwayUnder(plane.x);
        const gentle = vy <= TOUCHDOWN.maxSink && Math.abs(plane.pitch) <= TOUCHDOWN.maxPitch;
        const speedOk = plane.speed >= TOUCHDOWN.minSpeed && plane.speed <= TOUCHDOWN.maxSpeed;
        if (runway && gentle && speedOk) {
          plane.onGround = true;
          plane.y = groundY - HALF_H;
          plane.sinkVel = 0;
          plane.pitch = 0;
          events |= EVENT_LANDED;
        } else if (plane.invulnerable === 0) {
          events = hitGround(events);
        } else {
          plane.y = groundY - HALF_H - 2;
          plane.sinkVel = -60;
        }
      }

      // The river: water is not a runway.
      if (!plane.crashed && plane.x > terrain.river.x0 && plane.x < terrain.river.x1 && plane.y + HALF_H >= terrain.river.y) {
        if (plane.invulnerable === 0) events = hitGround(events);
      }

      // Pine trees: clipping one costs a life, like the ground.
      if (!plane.crashed && plane.invulnerable === 0) {
        for (const tree of terrain.trees) {
          if (Math.abs(plane.x - tree.x) < 14 && plane.y + HALF_H > tree.y - tree.h) {
            events = hitGround(events);
            break;
          }
        }
      }
    }

    return events;
  }

  reset(0);
  return { state, plane, reset, step };
}
