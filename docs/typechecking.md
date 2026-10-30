# TypeScript baseline

The app keeps `strict: true` while existing TypeScript errors are resolved. The
baseline was measured from clean commit `8f06985` after `npm ci` with the committed
`package-lock.json`. The check regenerates Expo Router's ignored
`.expo/types/router.d.ts` from `src/app` before running the full TypeScript program,
so an old local route declaration cannot change the comparison.

At that commit, TypeScript 5.3.3 reported **2,875 diagnostics** across 67 route files:

| Source area | Diagnostics |
| --- | ---: |
| `src/app` | 2,037 |
| `src/components` | 707 |
| `src/hooks` | 62 |
| `src/lib` | 44 |
| `tamagui.config.ts` | 21 |
| `src/state` | 2 |
| `src/utils.ts` | 2 |

The most common diagnostic codes were TS2322 (2,088), TS2339 (151), TS7006
(142), TS7031 (100), TS18048 (94), TS2345 (76), and TS2747 (51). The complete
counts by code and source area are printed on every check.

Run `npm ci` and then:

```sh
npm run check:ts       # pass only if diagnostics exactly match the baseline
npm run check:ts:full  # print every error; exits nonzero while errors remain
```

The committed `typecheck-baseline.json` stores a count for each file, diagnostic
code, and offending source line/span. File paths are relative to the project.
Line numbers and diagnostic message text are excluded: moving an existing error
or adding a route does not make it look new. A repeated identical error in the
same file is still guarded by its count. A changed error with the same code and
source span can evade this comparison; review the full diagnostic report when
changing a problematic expression.

When a fix removes existing errors, `check:ts` fails until you run
`npm run check:ts:update` and commit the smaller baseline with that fix. The
update command refuses any new diagnostic group or increase in an existing
group. Changing TypeScript versions requires a separate review of the baseline.
CI runs `npm ci` and `npm run check:ts` on pushes and PRs to `main`.
