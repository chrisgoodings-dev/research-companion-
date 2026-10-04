# Design documentation

Design documentation for **SE Research Hub**, written to match the application **as built** and checked against its code and tests. Live site: https://chrisgoodings-dev.github.io/research-companion-/

| Document | What it contains |
|---|---|
| [Wireframes](wireframes.md) | Annotated wireframes of every page and overlay, desktop and phone, plus the shared component rules |
| [Site map](site-map.md) | Site map, page inventory, URL scheme, navigation by screen size, the main journey and cross-links |
| [Use cases](use-cases.md) | Actors, use case diagram, use case list, and specifications for the key flows |
| [Data flow](data-flow.md) | Data flow diagrams at levels 0, 1 and 2 (search), the data model, and data-store dictionary |
| [Threat model](threat-model.md) | Trust boundaries, defence in depth, misuse cases, attack trees and a STRIDE threat register with mitigations, evidence and residual risks |
| [Sequence diagrams](sequence-diagrams.md) | Interaction sequences including the exact OpenAlex and Crossref API calls, failure handling, saving, evidence, matrix and backup/restore, and an API contract table |

## Diagrams

All diagrams are written as [Mermaid](https://mermaid.js.org/) text inside the Markdown files, so GitHub draws them inline and every change is reviewable as text. `npm run diagrams` extracts each one, **fails on any syntax error**, and renders `diagrams/<name>.svg` (vector) and `diagrams/<name>.png` (2x) for use in Word or slides. Wireframes are drawn by `npm run wireframes`. `npm run design` does both.

## Notes

- **Notation.** The data flow diagrams use Yourdon/DeMarco symbols (external entities, numbered processes, data stores). The use case diagram uses UML conventions drawn as a flowchart (system boundary, actors, `include` and `extend`). The misuse cases follow the misuse-case technique (threats shown against the use cases they threaten, with mitigations).
- **As built, not as proposed.** These documents describe what exists. The earlier design images (colour palette, early dashboard and discover mock-ups, comparative-site screenshots) belong to the project's planning documents and are not duplicated here.
- **Honest gaps.** The threat model lists residual risks that the application does not fully solve (hosting-origin sharing, user backups, data truthfulness, framing), and says what was and was not tested.
