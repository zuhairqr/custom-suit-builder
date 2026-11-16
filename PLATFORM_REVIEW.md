# Tailoring platform review

Reviewed 16 November 2026. This is a product comparison of accessible official
pages and the local application, not a purchase, fit assessment or complete
audit of competitors' private account and checkout flows.

## What the references make clear

| Platform and evidence | Useful principle | Application to Form Atelier |
| --- | --- | --- |
| [Suitsupply Custom Made](https://suitsupply.com/en-us/journal/custom-made.html) presents fabric selection, construction choices and Size Passport as distinct parts of designing. | Help shoppers understand cloth, design and fit as separate decisions. | Existing piece controls and Size Passport stay separate. New visible season shortcuts make the large fabric catalogue easier to enter. |
| [Proper Cloth's style and size guide](https://propercloth.com/reference/the-difference-between-size-profiles-and-style/) explains optional style changes, saved sizes and reviewing details before adding to the bag. | Make a design easy to review and reuse without losing fit information. | New Design details view lists actual garment specifications, price components and edit links. The new notebook reuses named configurations without copying or overwriting bag measurements. |
| [INDOCHINO's suit catalogue](https://www.indochino.com/product/howell-wool-stretch-gray-suit) exposes season and occasion discovery; its [production explanation](https://www.indochino.com/production?currency=CAD) describes measurement-profile validation. | Reduce choice overload and treat sizing as a real workflow. | Seasonal shortcuts complement existing material, color, pattern and price filters. Existing required measurements and body-feature validation remain in place. This is not claimed to match their production validation. |
| [Hockerty configurator](https://www.hockerty.com/en/men/custom-suits/personalize) and the user's supplied screenshots. | Keep the model prominent, with clear fabric and styling controls. | Existing central preview and responsive Fabric/Tailoring panels follow that goal. Direct live requests returned HTTP 403 during this review; unseen interactions were not assessed. |

These references informed priorities. The notebook and its comparison table are
our own implementation, not a claim that each competitor has the same feature.
No competitor garment imagery was imported for this pass.

## Changes delivered

- **Save & compare:** up to three named looks, alongside the current design;
  fabric swatches, prices and a table highlighting different choices. Restore
  or remove a look. Restoring keeps bag items and their Size Passports intact.
- **Design details:** current cloth, base price, cloth surcharge and total;
  effective jacket, trouser and waistcoat options; direct edit links. Preview
  shirt/tie accessories are explicitly separate from ordered garments.
- **Fabric discovery:** one-click year-round, summer and winter filters,
  synchronized with the existing facets and Clear filters.
- **Presentation:** consistent notebook cards and review sections, improved
  text contrast, keyboard-accessible native dialogs, and mobile layouts with
  horizontal scrolling contained inside the comparison table.

## Remaining gap to a production tailoring platform

The largest visual gap is still the garment imagery. The local preview composites
fixed photographs and generated clothing details; it is not a true 3D garment or
a physical fit prediction. More CSS cannot supply natural drape or consistent
collar, lapel and shoulder geometry across arbitrary cuts. The next substantial
rendering step needs a coherent set of garment photographs or a fitted 3D asset
pipeline, followed by reference-image validation across all supported choices.

The app also remains a local demo: named looks and measurements do not sync to
an account, payment and fulfilment are not connected, and delivery promises and
alteration guarantees are not implemented. This pass adds no invented business
claims, reviews, fabric-mill provenance or fit guarantees.

## Validation

Playwright regression coverage includes named-look persistence, restoring without
changing bag measurements, the three-look limit, removal, malformed saved data,
escaped labels, storage failure feedback, review totals and edit navigation,
season-filter synchronization, and mobile card placement. The existing suite
covers garment rendering, shirt styling, measurement persistence, unit conversion
and demo checkout. Screenshot review covers desktop and mobile; page-width
checks cover 360, 390, 820, 1024 and 1440 pixels. No live order or paid API was used.
