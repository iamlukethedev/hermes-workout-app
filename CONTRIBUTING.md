# Contributing

Thanks for your interest in improving Hermes Workout.

## Development setup

```sh
pnpm install
pnpm dev
```

Before opening a pull request, make sure these all pass (CI runs the same checks):

```sh
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Guidelines

- **Keep it local-first.** The app must work fully offline with no account or server. Don't add analytics, trackers or third-party network requests.
- **Don't break saved data.** Logs live in users' browsers. If you change the shape of `State` in `src/lib/training.ts`, keep old data loading (make new fields optional or migrate them in `src/lib/storage.ts`) and add a test.
- **Exercise content is safety-sensitive.** Changes to cues, steps or progression rules should stay conservative and beginner-friendly. Explain your reasoning in the PR.
- **Test the 3D studio** in both WebGL and the CPU fallback when touching `MovementDemo`, `trainer-rig` or `software-scene`. Rig changes should keep `tests/trainer-rig.test.ts` passing.
- Keep pull requests focused, and include screenshots for UI changes.

## Reporting bugs

Open an issue with steps to reproduce, your browser and device, and whether the movement studio was using WebGL or the CPU renderer.
