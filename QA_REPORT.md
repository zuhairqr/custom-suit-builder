# SuitCraft deep QA review — 18 November 2026

## Scope and team

A renderer agent, camera/try-on agent and workflow agent audited separate owning
files. The integrating agent reviewed their diffs, expanded rendering regressions,
rebuilt the visual matrix and verified the combined product. The user's marked
light-blue suit is the visual reference; passing unit tests is not treated as
proof of photographic quality.

## Defects addressed

| Area | Root cause | Change / evidence |
| --- | --- | --- |
| Upper collar and lapel | A tall flat overlay was painted over collar material already present in the source photograph. | Common notch/peak/shawl styles keep the photographed upper cloth with a subtle roll, rather than another standing strip. Self-cloth shadow/edge contrast is reduced. |
| Cuff/hand fringe | Near-transparent chroma spill and almost-opaque source pixels became visible through repeated resampling/compositing. | Source matte removes nearly invisible specks, restores solid interiors and keeps intermediate antialiasing. |
| Crotch and ankle dark patches | Neutral-black trouser folds were excluded by a mask that recognized only blue-toned pixels. | Actual deep fabric folds inherit the selected cloth; the true gap between legs remains transparent. |
| Trouser-to-shoe alignment | Studio calls passed ankle anchors to a function whose extra parameters had been removed. | Backward-compatible ankle anchoring restored and used for both suit outfits. All four cuts are exercised. |
| Fit comparison | Choosing a silhouette opened a construction close-up and hid the dressed model. | The dressed model stays visible when changing its cut. |
| Size Passport autofill | Unit/navigation changes could rebuild fields before collecting browser-filled values. | Flush autofill on unit changes, navigation and page exit; preserve underlying centimetres when a rounded display is unchanged. |
| Bag editing | Previous hidden-garment/zoom/3D state leaked into the item being edited. | Editing restores garments and default framing, without duplicating the bag item. |
| Camera capture race | An older rejected live inspection could cancel a newer manual capture. | Revision ownership prevents stale results/errors from taking over newer validation. |
| Camera lost frame | Video copying could throw before a live inspection or manual capture reached its error handler. | Copying and validation startup are guarded; retry controls and track cleanup recover. |
| Photo replacement | Decoded bitmaps could leak on canvas errors, and an old face draft remained applicable during replacement loading. | Guaranteed bitmap release and guarded pending replacement state. |

## Verification boundaries

The current suite covers local workflow/model behavior, actual browser rendering,
synthetic native camera playback, deterministic pose UI fixtures, malformed input,
storage failures and mobile layout. The optional actual MediaPipe smoke check is
separate from these offline tests. Physical webcam permission/capture and real
phone cameras are not established by the synthetic tests.

The visual matrix captures 28 cases per fabric, including single/double closures,
common lapels, cuts, two-/three-piece trousers and front/inside/back views. Native
transparent and neutral-background PNGs reveal alpha problems that can disappear
against the page background. Artifacts are generated locally rather than stored
as large binaries in the repository.

This remains a fixed-photo composite with generated details. Some lapel shading
and fixed-pose drape still look synthetic; this pass does not claim production
cloth simulation, physical fit accuracy, account synchronization, payment or
fulfilment integration.

## Final observed results

- Combined workflow, camera, fitting and pose suite: **57/57 passed**.
- Added mobile readability and Single-preset consistency guards: **2 additional
  distinct cases passed**; the fit-comparison regression was rerun with them.
- **59 current automated checks** in total; no skipped or failed checks in these
  final runs. All 43 JavaScript files passed syntax checking.
- **56 native rendering cases captured**, 28 each for Blue Rough Linen and
  Midnight Windowpane, with zero runtime errors in either manifest. Key collar,
  cuff/hand, crotch, ankle and mobile panels were reviewed from screenshots.
- Mobile widths checked from 360px to 1440px. Below 520px, fabric and construction
  controls now use full-width panels instead of breaking labels into letters.
- The Single quick preset now selects the editable two-button configuration.
- No physical webcam capture, paid API, production order, deployment or push was
  performed during this team pass. Browser camera regression video is synthetic.
