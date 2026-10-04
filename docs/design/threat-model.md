# Threat model

Method: **STRIDE per element** on the data-flow diagrams, then **misuse cases** and **attack trees** for the highest-impact threats. Each threat names its mitigation in the code and the test that proves it. Residual risk is stated, including the risks that are *not* fully solved.

## 1. Scope, assets and assumptions

| Asset | Why it matters |
|---|---|
| **A1 Research data** (projects, questions, reviews, evidence) | The user's real work; only copy is in the browser |
| **A2 Researcher's privacy** | Search terms, and the contact email sent with them |
| **A3 Integrity of the app code** | If the code is altered, everything the app does is untrustworthy |
| **A4 Trust in displayed paper metadata** | Research conclusions rest on it |

**Assumptions.** One user per browser profile; no accounts, passwords, payments or personal data beyond the optional contact email; hosted as static files over HTTPS; the user's device and browser are not already compromised.

**Out of scope.** Attacks needing control of the user's device or browser profile; the security of OpenAlex, Crossref or GitHub themselves (treated as untrusted *data sources* or trusted *hosts* as shown below).

### Threat agents

| ID | Agent | Capability |
|---|---|---|
| TA1 | Compromised or malicious data source, or an on-path attacker | Controls the content of an API reply |
| TA2 | Author of a malicious backup file | Gets the user to restore a crafted file (shared by email or drive) |
| TA3 | Another web page | Frames the app, or runs on the same origin |
| TA4 | Supply-chain attacker | Compromises a dependency, action or hosting account |
| TA5 | Curious third party | Reads network traffic or API logs |
| TA6 | The user, by accident | Deletes or overwrites data, or loses the browser profile |

## 2. Trust boundaries

<!-- diagram: tm-trust-boundaries -->
```mermaid
flowchart LR
  subgraph TB2["Boundary: third-party services (data is UNTRUSTED)"]
    OA["OpenAlex API"]
    CR["Crossref API"]
  end

  subgraph TB3["Boundary: static host (code integrity)"]
    HOST["GitHub Pages<br/>serves index.html, css, js"]
  end

  subgraph TB4["Boundary: the user's files (UNTRUSTED input)"]
    BK["Backup JSON file"]
    SS["Spreadsheet app<br/>opens the CSV"]
  end

  subgraph TB1["Boundary: the user's browser (trusted code, the user's own data)"]
    APP["App code<br/>validate, normalise, escape"]
    IDB[("IndexedDB<br/>research data")]
    LS[("localStorage<br/>theme, last backup")]
    CSP{{"Content-Security-Policy<br/>allowlist"}}
  end

  OTHER["Other pages<br/>(framing, or same origin)"]

  OA -- "T01 T02 T07 hostile metadata or links" --> APP
  CR -- "T01 T02 T07" --> APP
  APP -- "T08 T09 search text and contact email" --> OA
  APP -- "T09" --> CR
  HOST -- "T12 code integrity" --> APP
  BK -- "T04 T05 crafted file" --> APP
  APP -- "T06 formula injection in CSV" --> SS
  APP <--> IDB
  APP <--> LS
  CSP -. "limits scripts and connections" .- APP
  OTHER -- "T11 same-origin access, T13 framing" --> IDB
  OTHER -. "T13" .-> APP

  classDef untrusted fill:#fdecea,stroke:#a11d33,stroke-width:2px,stroke-dasharray:6 4
  classDef trusted fill:#e8f5ee,stroke:#166534,stroke-width:2px
  class OA,CR,BK,OTHER untrusted
  class APP,IDB,LS,CSP trusted
```

Every arrow that crosses into the browser from outside carries data that is **checked before use**. The only data that leaves the browser is the search request (and CSV files the user chooses to save).

## 3. Defence in depth for untrusted data

<!-- diagram: tm-defence-layers -->
```mermaid
flowchart TB
  IN["Untrusted input<br/>API reply or backup file"]
  L1["1 Transport and policy<br/>HTTPS only. The Content-Security-Policy allows<br/>connections to the two APIs and nothing else"]
  L2["2 Shape check<br/>reject anything that is not the expected structure,<br/>size or record count"]
  L3["3 Normalise<br/>strip tags, decode entities, accept only http(s) links,<br/>normalise DOIs, bound lengths"]
  L4["4 Whitelist validation<br/>copy known fields one by one into new objects:<br/>unknown keys and __proto__ never survive"]
  L5["5 Integrity rules and atomic write<br/>references must resolve inside the file,<br/>one transaction: all or nothing"]
  STORE[("IndexedDB")]
  L6["6 Escape on output<br/>every dynamic value is HTML-escaped<br/>when drawn, never stored pre-escaped"]
  L7["7 Browser enforcement<br/>CSP blocks inline scripts and handlers,<br/>external scripts, and requests to other hosts"]
  L8["8 Safe links<br/>rel=noopener noreferrer on external links"]
  OUT["Screen"]

  IN --> L1 --> L2 --> L3 --> L4 --> L5 --> STORE --> L6 --> L7 --> L8 --> OUT

  classDef layer fill:#e8f5ee,stroke:#166534,stroke-width:1.5px
  class L1,L2,L3,L4,L5,L6,L7,L8 layer
```

No single layer is trusted to be perfect: layers 3, 4 and 6 are the primary protections; layers 1 and 7 mean that if one of them ever had a flaw, the browser would still block the most harmful outcomes.

## 4. Misuse cases

Read each row left to right: a **threat agent** (red) performs a **misuse case** (heavy red outline) that *threatens* a legitimate **use case** (white). A **mitigation** (green) is aimed at the misuse case; an **amber** box means the app has **no mitigation of its own** and the risk is handled outside it.

<!-- diagram: tm-misuse-cases -->
```mermaid
flowchart TB
  subgraph r1["T01"]
    direction LR
    A1(["Malicious data source<br/>or on-path attacker"]) --> M1(["T01 T02 Inject a script or<br/>dangerous link via metadata"])
    G1["Strip tags, whitelist fields,<br/>escape on output, safe URLs,<br/>CSP blocks inline script"] ==> M1
    M1 -. threatens .-> U1(["UC3 Search for papers"])
  end
  subgraph r2["T07"]
    direction LR
    A2(["Malicious data source<br/>or on-path attacker"]) --> M2(["T07 Feed misleading<br/>papers"])
    G2["NONE in the app: verify key<br/>papers at the publisher (DOI)"] ==> M2
    M2 -. threatens .-> U2(["UC3 Search for papers"])
  end
  subgraph r3["T04"]
    direction LR
    A3(["Backup file author"]) --> M3(["T04 T05 Restore a crafted<br/>or huge file"])
    G3["Validate every record, limits,<br/>atomic import, preview"] ==> M3
    M3 -. threatens .-> U3(["UC13 Restore data"])
  end
  subgraph r4["T06"]
    direction LR
    A4(["Backup file author<br/>or hostile paper text"]) --> M4(["T06 Formula in an<br/>exported CSV cell"])
    G4["Neutralise cells that start<br/>with = + - @"] ==> M4
    M4 -. threatens .-> U4(["UC14 Export CSV"])
  end
  subgraph r5["T08"]
    direction LR
    A5(["Curious third party"]) --> M5(["T08 T09 Learn what<br/>is searched or send data out"])
    G5["Minimal request, optional email,<br/>no accounts, CSP allowlist"] ==> M5
    M5 -. threatens .-> U5(["UC3 Search for papers"])
  end
  subgraph r6["T10"]
    direction LR
    A6(["Researcher<br/>(by accident)"]) --> M6(["T10 Lose all data"])
    G6["Backup file, reminder, restore,<br/>confirmations on delete"] ==> M6
    M6 -. threatens .-> U6(["UC12 Back up data"])
  end
  subgraph r7["T13"]
    direction LR
    A7(["Other web page"]) --> M7(["T13 Frame the app<br/>to trick a click"])
    G7["Confirm dialogs with Cancel<br/>focused (framing not preventable)"] ==> M7
    M7 -. threatens .-> U7(["UC1 to UC11 Work with<br/>projects, papers, evidence"])
  end
  subgraph r8["T11"]
    direction LR
    A8(["Other page on<br/>the same origin"]) --> M8(["T11 Read or change<br/>the database"])
    G8["NONE in the app: host only<br/>trusted sites on the origin"] ==> M8
    M8 -. threatens .-> U8(["UC1 to UC11 Work with<br/>projects, papers, evidence"])
  end
  subgraph r9["T12"]
    direction LR
    A9(["Supply-chain attacker"]) --> M9(["T12 Alter the code<br/>that is served"])
    G9["No runtime dependencies,<br/>tests gate deployment"] ==> M9
    M9 -. threatens .-> U9(["UC1 to UC11 Work with<br/>projects, papers, evidence"])
  end
  r1 ~~~ r2
  r2 ~~~ r3
  r3 ~~~ r4
  r4 ~~~ r5
  r5 ~~~ r6
  r6 ~~~ r7
  r7 ~~~ r8
  r8 ~~~ r9

  classDef agent fill:#fdecea,stroke:#a11d33,stroke-width:1.5px
  classDef bad fill:#fdecea,stroke:#a11d33,stroke-width:3px
  classDef good fill:#e8f5ee,stroke:#166534,stroke-width:2px
  classDef gap fill:#fff4d6,stroke:#8a5300,stroke-width:2px
  classDef uc fill:#ffffff,stroke:#444,stroke-width:2px
  class A1,A2,A3,A4,A5,A6,A7,A8,A9 agent
  class M1,M2,M3,M4,M5,M6,M7,M8,M9 bad
  class U1,U2,U3,U4,U5,U6,U7,U8,U9 uc
  class G1,G3,G4,G5,G6,G7,G9 good
  class G2,G8 gap
```

Misuse cases **without** a green mitigation are the honest gaps: **T07** (misleading data cannot be detected by the app), **T11** (same-origin pages) and, partly, **T13** (framing). They are discussed in section 7.

## 5. Attack trees

### 5.1 Goal: run attacker script inside the app (and so read or change all research data)

<!-- diagram: tm-attack-tree-script -->
```mermaid
flowchart TD
  G["GOAL<br/>run attacker script in the app origin"]
  OR1{"OR"}
  G --- OR1

  B1["A hostile paper title, author,<br/>venue or abstract from an API"]
  B2["A dangerous link scheme<br/>javascript: or data:"]
  B3["Hostile text inside a restored<br/>backup file"]
  B4["Crafted address after the #<br/>route or query parameters"]
  B5["Load a script from another host"]
  B6["Tamper with the served code<br/>or a dependency"]
  B7["A page on the same origin<br/>runs its own script"]

  OR1 --- B1
  OR1 --- B2
  OR1 --- B3
  OR1 --- B4
  OR1 --- B5
  OR1 --- B6
  OR1 --- B7

  M1["BLOCKED: tags stripped when normalising,<br/>every value escaped when drawn"]
  M2["BLOCKED: only http(s) links accepted,<br/>checked again before storing and on import"]
  M3["BLOCKED: validated and stored as plain text,<br/>escaped when drawn"]
  M4["BLOCKED: route lookup uses own properties only,<br/>address shown escaped"]
  M5["BLOCKED: CSP script-src is this site only,<br/>no inline scripts or handlers"]
  M6["REDUCED: no runtime dependencies, no CDN,<br/>tests must pass before deployment"]
  M7["NOT PREVENTED BY THE APP:<br/>depends on what else is hosted on the origin"]

  B1 --> M1
  B2 --> M2
  B3 --> M3
  B4 --> M4
  B5 --> M5
  B6 --> M6
  B7 --> M7

  classDef goal fill:#fdecea,stroke:#a11d33,stroke-width:3px
  classDef gate fill:#ffffff,stroke:#444,stroke-width:2px
  classDef blocked fill:#e8f5ee,stroke:#166534,stroke-width:2px
  classDef gap fill:#fff4d6,stroke:#8a5300,stroke-width:2px
  class G goal
  class OR1 gate
  class M1,M2,M3,M4,M5,M6 blocked
  class M7 gap
```

### 5.2 Goal: corrupt or take over the user's data through a restore

<!-- diagram: tm-attack-tree-restore -->
```mermaid
flowchart TD
  G["GOAL<br/>corrupt, overwrite or abuse data<br/>by getting a crafted file restored"]
  OR1{"OR"}
  G --- OR1

  B1["File so large it freezes the browser"]
  B2["Not JSON, or not this app's format"]
  B3["Extra fields or __proto__ keys<br/>to change behaviour"]
  B4["Records pointing at things that do not exist"]
  B5["Valid-looking file that fails half way,<br/>leaving mixed data"]
  B6["Trick the user into Replace<br/>so their data is wiped"]
  B7["Fields too long, or wrong types and dates"]

  OR1 --- B1
  OR1 --- B2
  OR1 --- B3
  OR1 --- B4
  OR1 --- B5
  OR1 --- B6
  OR1 --- B7

  M1["BLOCKED: 20 MB and 50,000 record limits,<br/>error list capped at 25"]
  M2["BLOCKED: parse and envelope check<br/>before anything else"]
  M3["BLOCKED: fields copied one by one<br/>into new objects"]
  M4["BLOCKED: every reference must resolve<br/>inside the file"]
  M5["BLOCKED: one transaction, all or nothing"]
  M6["REDUCED: preview, Merge is the default,<br/>Replace needs a confirmation with Cancel focused"]
  M7["BLOCKED: same validators as the forms,<br/>ISO dates, bounded lengths"]

  B1 --> M1
  B2 --> M2
  B3 --> M3
  B4 --> M4
  B5 --> M5
  B6 --> M6
  B7 --> M7

  classDef goal fill:#fdecea,stroke:#a11d33,stroke-width:3px
  classDef gate fill:#ffffff,stroke:#444,stroke-width:2px
  classDef blocked fill:#e8f5ee,stroke:#166534,stroke-width:2px
  classDef gap fill:#fff4d6,stroke:#8a5300,stroke-width:2px
  class G goal
  class OR1 gate
  class M1,M2,M3,M4,M5,M7 blocked
  class M6 gap
```

## 6. Threat register (STRIDE)

Likelihood (L) and impact (I): **L**ow, **M**edium, **H**igh. *Residual* is the risk after the mitigations listed.

| ID | STRIDE | Threat | L | I | Mitigation (where) | Evidence | Residual |
|---|---|---|---|---|---|---|---|
| **T01** | Tampering, Elevation | Script injection through paper metadata (titles, authors, venue, abstract) from an API | M | H | Tags stripped on normalising (`js/api/paper.js`); all dynamic values escaped (`esc` in every view); project names set with `textContent`; CSP forbids inline scripts and handlers | `tests/unit/openalex.test.js`, `crossref.test.js`; `tests/e2e/discover.mjs` (hostile author `<img onerror>`; fails when escaping is removed); `security.mjs` | **Low** |
| **T02** | Elevation | `javascript:` or `data:` links in a paper's URL fields | M | H | `safeUrl` allows only http(s) at normalisation, again in `validatePaper`, and on import; CSP | `openalex.test.js`; `discover.mjs`; `backup.test.js` (mutation-checked) | **Low** |
| **T03** | Info disclosure, Tampering | Reverse tabnabbing or referrer leakage through external links | M | M | `target="_blank"` always with `rel="noopener noreferrer"`; link text says it opens a new tab | `security.mjs` | **Low** |
| **T04** | Tampering, Elevation | Crafted backup file: extra fields, `__proto__`, dangling references, wrong types | M | H | Strict validator copies field by field, enforces references, ISO dates, bounded text (`js/backup.js`); atomic import (`js/db/repository.js`); preview before applying | `tests/unit/backup.test.js` (hostile files, round trip, atomic failure; mutation-checked); `tests/e2e/backup.mjs` | **Low** |
| **T05** | Denial of service | Huge or record-heavy backup file | L | M | 20 MB and 50,000-record limits; error list capped at 25 | `backup.test.js` | **Low** |
| **T06** | Tampering (on the user's spreadsheet) | Formula injection through exported CSV cells (`=HYPERLINK(...)`) | M | M | Cells starting `= + - @` tab or CR are prefixed with an apostrophe; RFC 4180 escaping (`js/export.js`) | `backup.test.js`, `backup.mjs` (mutation-checked) | **Low** |
| **T07** | Tampering | On-path attacker or compromised API returns misleading papers | L | M | HTTPS only (CSP lists only `https` API hosts; GitHub Pages enforces HTTPS); response shape checks; treated as untrusted for T01 | `openalex.test.js` (bad shapes), `security.mjs` | **Medium**: the app cannot tell true metadata from false. Verify key papers at the publisher via their DOI. |
| **T08** | Info disclosure | Research data sent to a third party (analytics, injected request) | L | H | No third-party scripts or analytics; CSP `connect-src` allows only the two APIs | `security.mjs` (a `fetch` to another origin is blocked and reported) | **Low** |
| **T09** | Info disclosure | Search terms and the contact email visible to API operators, network tools and (if public) the source | H | L | Only the search request and an optional contact address are sent; no cookies, accounts or identifiers; address is a single config value and may be blank | `docs/deployment.md` warns before deploying | **Medium-Low**: accepted. Use a dedicated address, not a personal one. |
| **T10** | Denial of service (availability), accident | Loss of all data (clear site data, browser eviction, new device, mistaken delete or replace) | H | H | JSON backup and tested restore; dashboard shows last backup; destructive actions confirm with Cancel focused; deletes and imports are transactional | `backup.mjs`, `projects.mjs`, `library.mjs` | **Medium**: the user must actually make backups. |
| **T11** | Spoofing, Tampering, Info disclosure | Another page on the same origin reads or changes the IndexedDB database. On GitHub Pages every project site of one account shares `<user>.github.io`, and storage is per origin, not per path | L | H | None in the app. Keep only trusted sites on that origin; use a custom domain or a separate account to isolate; store no secrets (the app has none) | None (an environment risk) | **Medium** (depends on hosting) |
| **T12** | Tampering | Compromised dependency, GitHub Action or hosting account alters the served code | L | H | **Zero runtime dependencies** and no CDN: all served code is first-party; dev dependencies run only locally and in CI; lockfile committed; deployment is gated on the full test suite | `npm audit`: 0 vulnerabilities; `npm ls --omit=dev` empty | **Low-Medium**: Actions are pinned to major tags, not commit hashes. |
| **T13** | Spoofing, Tampering | Clickjacking: a hostile page frames the app to trick a click | L | M | Static hosting cannot send `X-Frame-Options` or `frame-ancestors` (the `<meta>` form ignores it). Destructive actions need an explicit confirmation | None automated | **Low-Medium** |
| **T14** | Denial of service | API throttling or outage; a slow search blocks the user | M | L | 15 s timeout; partial results; specific messages; no automatic retries; superseded searches cancelled; polite-pool identification | `discover.mjs`, `save.mjs`, `openalex.test.js` | **Low** |
| **T15** | Tampering | Abuse of the address: `#/__proto__`, malformed `%` escapes, markup in the hash | M | L | Route lookup with `Object.hasOwn`; `URLSearchParams`; safe decoding; the address is escaped when shown | `tests/unit/router.test.js`, `polish.mjs` | **Low** |
| **T16** | Tampering, Info disclosure | Someone with the user's browser profile or DevTools reads or edits stored data | L | M | Out of scope: there is no login to protect, and the data is the user's own. Use the device's own login and profile separation | n/a | **Accepted** |
| **T17** | Repudiation | No audit trail of changes | L | L | Single-user local data; every record carries created and updated times | n/a | **Accepted** |

### STRIDE coverage

| Category | Threats |
|---|---|
| **S**poofing | T11, T13 |
| **T**ampering | T01, T02, T03, T04, T06, T07, T11, T12, T13, T15, T16 |
| **R**epudiation | T17 |
| **I**nformation disclosure | T03, T08, T09, T11, T16 |
| **D**enial of service | T05, T10, T14 |
| **E**levation of privilege | T01, T02, T04 |

## 7. Residual risks and recommended next steps

Honest summary: the data-handling risks (T01, T02, T04, T05, T06, T08, T14, T15) are mitigated and tested. The remaining risks are mostly about **where and how it is hosted**, and **user behaviour**:

1. **T11 same-origin sharing (Medium).** The live site is at `https://<user>.github.io/research-companion-/`. Any other Pages site on the same account shares its origin and could read the database. Keep only trusted sites there, or move to a custom domain or a dedicated account for isolation.
2. **T10 data loss (Medium).** Back up regularly. Possible improvement: ask the browser for persistent storage (`navigator.storage.persist()`) and warn when a backup is old.
3. **T07 data truthfulness (Medium).** Treat search results as leads, and check key papers at the publisher through their DOI link.
4. **T09 contact email (Medium-Low).** The address is visible to anyone using the site. Use a dedicated address, or leave it blank.
5. **T12 pipeline (Low-Medium).** Pin GitHub Actions to full commit hashes and enable Dependabot alerts.
6. **T13 framing (Low-Medium).** If the site moves to Cloudflare Pages, add a `_headers` file with `X-Frame-Options: DENY` and a `frame-ancestors 'none'` policy, and move the policy from the `<meta>` tag into a real header.
7. **Not tested by anyone yet:** a professional penetration test or a live-site scan. The automated tests prove the controls work as designed, not that no other flaw exists.

## 8. Security tests at a glance

| Control | Test |
|---|---|
| Hostile metadata is inert | `discover.mjs` (hostile author), `openalex.test.js`, `crossref.test.js`, `security.mjs` |
| Unsafe URLs removed | `openalex.test.js`, `discover.mjs`, `backup.test.js` |
| Backup validation and atomic restore | `backup.test.js` (15+ hostile and broken cases), `backup.mjs` |
| CSV formula safety | `backup.test.js`, `backup.mjs` |
| CSP present, no violations in normal use, injections blocked | `security.mjs` |
| External links safe | `security.mjs` |
| Route and address abuse | `router.test.js`, `polish.mjs` |
| Failure handling for APIs | `discover.mjs`, `save.mjs`, `openalex.test.js`, `merge.test.js` |
| Dependencies | `npm audit` (0 vulnerabilities), zero runtime dependencies |

Several of these were **mutation-checked**: the protection was temporarily removed and the tests were shown to fail, so a passing result is meaningful.
