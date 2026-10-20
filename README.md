# Operator Risk Control Centre

An anonymised offshore operator demonstration linking asset risk reviews, control evidence, portfolio dependencies and board decisions.

All assets, records, figures and model criteria are illustrative. No live company systems are connected. The demonstration does not grant authority to operate.

## GitHub Pages

The complete static website is in `docs/`. No build or package installation is required.

Select **Settings → Pages → Deploy from a branch → main → /docs → Save**. GitHub displays the published website link when deployment completes.

## Reporting views

Start with **Asset review pack → Asset Bravo → Executive leadership → Board oversight**. Four fictional assets show risks, critical controls, evidence, actions and escalation. The executive pack covers treatment, resources and cross-business intervention. The board opens with an oversight summary covering appetite, material exposure, assurance confidence and reserved matters; supporting detail is expandable. Word-compatible export and print/save PDF are available.

Changes are saved in each browser, not in a shared database. Export a JSON backup before changing browser or hosting origin. Previously saved browser records do not transfer automatically between website addresses.

## Validation

Run `node checks.cjs`, `node asset-checks.cjs`, `node leadership-checks.cjs`, `node analysis-checks.cjs`, `node matrix-checks.cjs`, `node od-checks.cjs` and `node import-checks.cjs` from the repository root. Browser layout and actual downloads require browser verification.

## Future Azure hosting

The same `docs/` directory can be deployed to Azure Static Web Apps with no build step. Authentication and a shared database can be added separately.

Third-party PDF.js and JSZip licence files are retained in `docs/vendor/`.
