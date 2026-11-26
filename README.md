# Sky Courier — Alpine Airlift

[![make.fun](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/Kkajasd/flight-game-20261126/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/Kkajasd/flight-game-20261126/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)

An original 2D flight game for the make.fun **best flight game** bounty ($500, 50 paid places).

Fly a courier plane through an alpine valley: thread six golden rings, deliver a
parcel to the mountain airstrip at Eagle's Nest, and bring a stranded hiker home.
Throttle and pitch discipline matter — climb too steeply and you bleed speed,
fly too slow and the wing gives up. Fuel burns with the throttle, and a hard
touchdown on anything but a runway costs the plane.

## Play

Serve `game/` with any static server (`node serve.ts`, then open
http://localhost:8080) and play in a desktop browser. No build step, no network
requests at run time — every file the game loads lives under `game/`.

- **↑ / W** throttle up · **↓ / S** throttle down
- **← / A** climb · **→ / D** dive · **Space** airbrake
- Hold the mouse to steer toward the pointer · **P** pause · **M** mute

The HUD shows altitude, airspeed and heading on a lit compass, a fuel gauge,
damage pips, and the current sortie's objective. Three sorties, one valley:
Ring Run, Courier Delivery, Mountain Rescue.

## Layout

- `main.ts` — the hand-in program: copies `game/` and `screenshots/` to
  `/output` and writes `dossier.json` with the kit's vendored library.
- `game/` — the game itself, plain static files: `index.html` plus one
  clear job per file under `src/` (config, random, terrain, flight, missions,
  input, audio, render, shots, main).
- `screenshots/` — four real renders of the game's own code in a browser.
- `vendor/makefun-game.ts` — the kit's dossier library, unchanged.
- `serve.ts` — a tiny static server for local play.
- `shots.json` — the four screenshot scenes and their URLs.

## License

MIT — see `LICENSE`.
