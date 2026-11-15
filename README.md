# Hermes Workout

A local-first home strength tracker with an interactive 3D movement guide. Designed for a pair of adjustable dumbbells, a bench and bodyweight training, with a gentle, back-friendly beginner programme.

Your training log never leaves your browser: no account, no server and no tracking.

## Features

- **Eight-week A/B programme.** Three strength sessions a week (Monday, Wednesday, Friday) with gradual set progression and walking days in between.
- **Session logging.** Sets, reps and per-dumbbell weight, a rest timer, session notes, and an optional third set from week five.
- **Check-ins.** Sleep, energy, and back comfort before, after and the morning following each session.
- **Progress history.** Per-exercise weight charts, weekly summaries and a walking log.
- **3D movement studio.** A rigged human trainer demonstrates every exercise, with orbit, zoom, camera presets, slow motion, pose scrubbing, left/right views and body-region highlights.
- **Works everywhere.** WebGL with a CPU fallback renderer for browsers without it, reduced-motion support, and a mobile layout you can add to your home screen.
- **Your data, portable.** Export a JSON backup or a CSV of every set; import the backup on another device.

## Exercises

| Workout A            | Workout B             |
| -------------------- | --------------------- |
| Sit-to-stand         | Supported split squat |
| Dumbbell bench press | Wall push-up          |
| Chest-supported row  | Chest-supported row   |
| Glute bridge         | Glute bridge          |
| Heel slide           | Bird dog · leg slide  |
| Supported calf raise | Seated dumbbell curl  |

## Getting started

Requires Node.js 20.19+ (22 recommended) and [pnpm](https://pnpm.io).

```sh
pnpm install
pnpm dev
```

Then open the URL Vite prints (usually http://localhost:5173).

### Scripts

| Command          | What it does                         |
| ---------------- | ------------------------------------ |
| `pnpm dev`       | Start the dev server with hot reload |
| `pnpm build`     | Type-check and build to `dist/`      |
| `pnpm preview`   | Serve the production build locally   |
| `pnpm test`      | Run the unit tests (Vitest)          |
| `pnpm lint`      | Lint with ESLint                     |
| `pnpm typecheck` | Type-check without building          |
| `pnpm format`    | Format with Prettier                 |

## Deployment

The build is a static site, so it can be hosted anywhere (GitHub Pages, Netlify, Vercel, Cloudflare Pages, or any static file server). Asset paths are relative, so it also works from a sub-path.

A GitHub Pages workflow is included in `.github/workflows/deploy.yml`. To use it, enable **Settings → Pages → Source: GitHub Actions** in your repository, then push to `main`.

## How data is stored

The whole log is a single JSON document in `localStorage` under the key `hermes-workout:state`. It is validated with [Zod](https://zod.dev) when loaded or imported (see `src/lib/storage.ts`). Clearing site data in your browser deletes the log, so export a backup from **Settings → Your data** regularly.

## Project structure

```
src/
  App.tsx                  App shell, state and persistence
  components/              Tabs, modals and the 3D MovementDemo studio
  lib/training.ts          Exercises, programme schedule and progression rules
  lib/storage.ts           localStorage persistence and backup validation
  lib/trainer-rig.ts       Skeletal posing with two-bone inverse kinematics
  lib/software-scene.ts    CPU fallback renderer for the same skinned mesh
public/models/trainer.glb  CC0 rigged human model
tests/                     Vitest unit tests
```

`components/MovementDemo.tsx` owns the studio, lighting and playback. `lib/trainer-rig.ts` drives fixed-length bone rotations with two-bone inverse kinematics, and `lib/software-scene.ts` projects the same posed mesh when WebGL is unavailable. See [docs/3D-ASSETS.md](docs/3D-ASSETS.md) for details on the model.

## Disclaimer

Hermes Workout is a general fitness tool, not medical advice. The animations are illustrative demonstrations, not motion-captured clinical instruction or an assessment of your technique, and body-region highlights are approximate. Talk to a doctor or physiotherapist before starting a new exercise programme, especially if you have a history of pain or injury, and stop if anything causes sharp, spreading or increasing pain.

## Contributing

Contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

Code is released under the [MIT License](LICENSE). The human model is by [Quaternius](https://quaternius.com) and is [CC0 1.0](public/models/QUATERNIUS-LICENSE.txt).
