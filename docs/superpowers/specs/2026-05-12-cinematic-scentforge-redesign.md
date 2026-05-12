# Cinematic ScentForge Redesign

## Approved Direction

Use the Trémoille reference as inspiration for the public storefront: dark cinematic fragrance stage, thin editorial typography, sparse navigation, product-as-sculpture composition, and framed campaign sections.

Keep authenticated product surfaces warm, structured, and operational. The dashboard and Atelier must remain readable for hackathon judges and technical evaluators checking live metrics, validation isolation, Codex generation, and publish gates.

## Surface Plan

### Public Storefront

- Shift the first viewport from warm ivory editorial to a black fragrance-stage hero.
- Preserve ScentForge content and product imagery, but make the first signal feel like luxury perfume commerce.
- Add compact proof copy around generation, validation, and affiliate attribution.
- Make product cards feel like a premium collection shelf rather than a generic card grid.
- Keep checkout and cart usable with clear contrast and accessible controls.

### Dashboard

- Keep a warm ivory workspace, but make hierarchy tighter and calmer.
- Reduce repeated bordered-panel monotony.
- Use dark metric blocks selectively for live business numbers.
- Make validation exclusion copy feel like operational proof, not a footer note.

### Atelier

- Reframe the page as a workshop with a clear sequence: prompt, generation status, validation gate, preview, console.
- Keep the preview large and useful.
- Make the validation checklist and publish gate easier to scan.
- Avoid decorative dark treatment on logs and controls where readability matters.

### Auth

- Match the warmer product app style while giving the login/register pages a more intentional atelier entry feel.
- Keep demo credentials obvious and form controls stable.

## Constraints

- Do not commit generated storefront artifacts under `generated/affiliates/**`.
- Keep live metrics sourced only from LIVE orders.
- Do not fake validation or checkout success.
- Before handing the app back for testing, run `npm run demo:reset`.
