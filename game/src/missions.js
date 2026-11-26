// The three sorties of a Sky Courier shift: what the pilot is asked to do, how the
// game knows it is done, and what it pays. A sortie ends when its goal is met; the
// next one starts from the home runway with a full tank.

import { MISSION_POINTS, RING } from './config.js';

export const SORTIES = [
  {
    name: 'Ring Run',
    brief: 'Fly the valley and thread all six golden rings.',
    target: "Eagle's Nest",
  },
  {
    name: 'Courier Delivery',
    brief: 'Collect the parcel at Alpine Field, then land it at Eagle\u2019s Nest.',
    target: "Eagle's Nest",
  },
  {
    name: 'Mountain Rescue',
    brief: 'Pick up the stranded hiker at the beacon, then land at Eagle\u2019s Nest.',
    target: "Eagle's Nest",
  },
];

export function createMissions(terrain, flight) {
  let index = 0;
  let pickedUp = false;
  let done = false;

  function objective() {
    const plane = flight.plane;
    if (index === 0) return `Rings ${flight.state.ringsTaken} / ${RING.count} — thread the gold rings`;
    if (index === 1) {
      return pickedUp
        ? 'Parcel aboard — land gently at Eagle\u2019s Nest'
        : 'Fly through the parcel ring at Alpine Field to collect it';
    }
    return pickedUp
      ? 'Hiker aboard — land gently at Eagle\u2019s Nest'
      : 'Fly low through the beacon ring to pick up the hiker';
  }

  function reset() {
    index = 0;
    pickedUp = false;
    done = false;
  }

  /** Check pickups that need the plane's position; call every frame while flying. */
  function checkPickups() {
    const plane = flight.plane;
    if (plane.onGround || plane.crashed) return 0;
    let events = 0;
    if (index === 1 && !terrain.parcel.taken) {
      const dx = plane.x - terrain.parcel.x;
      const dy = plane.y - terrain.parcel.y;
      if (dx * dx + dy * dy < RING.radius * RING.radius) {
        terrain.parcel.taken = true;
        pickedUp = true;
        plane.score += MISSION_POINTS.pickup;
        events |= 4; // EVENT_PICKUP
      }
    }
    if (index === 2 && !pickedUp) {
      const dx = plane.x - terrain.beacon.x;
      const dy = plane.y - terrain.beacon.y;
      if (dx * dx + dy * dy < (RING.radius + 20) * (RING.radius + 20)) {
        pickedUp = true;
        plane.score += MISSION_POINTS.pickup;
        events |= 8; // EVENT_BEACON
      }
    }
    return events;
  }

  /**
   * React to a landing: the sortie is done when the plane lands on its target
   * runway with its job finished. Returns a message for the banner, or ''.
   */
  function onLanded(runwayName) {
    const plane = flight.plane;
    if (runwayName === null) return '';
    if (index === 0) return ''; // Ring Run is finished in the air.
    if (!pickedUp) return '';
    if (runwayName !== SORTIES[index].target) return '';
    plane.score += MISSION_POINTS.landing;
    plane.fuel = 100;
    done = true;
    if (index === 2) {
      plane.score += MISSION_POINTS.victory;
      return 'All sorties complete — the valley is safe. Outstanding flying!';
    }
    return `${SORTIES[index].name} complete — +${MISSION_POINTS.landing} pts.`;
  }

  /** Ring Run finishes the moment the last ring is threaded. */
  function onRing() {
    if (index !== 0) return '';
    if (flight.state.ringsTaken < RING.count) return '';
    flight.plane.score += MISSION_POINTS.landing;
    flight.plane.fuel = 100;
    done = true;
    return `Ring Run complete — all ${RING.count} rings! Press Space for the next sortie.`;
  }

  function nextSortie() {
    index = Math.min(SORTIES.length - 1, index + 1);
    pickedUp = false;
    done = false;
  }

  return {
    get index() {
      return index;
    },
    get name() {
      return SORTIES[index].name;
    },
    get brief() {
      return SORTIES[index].brief;
    },
    get isDone() {
      return done;
    },
    get isVictory() {
      return index === SORTIES.length - 1 && done;
    },
    get hasPickedUp() {
      return pickedUp;
    },
    objective,
    reset,
    checkPickups,
    onLanded,
    onRing,
    nextSortie,
  };
}
