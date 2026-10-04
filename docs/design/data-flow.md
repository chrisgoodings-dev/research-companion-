# Data flow and data model

Notation (Yourdon/DeMarco style): **rectangles** are external entities, **circles** are processes (numbered), **cylinders** are data stores (D1…), arrows are labelled data flows. Dashed borders mark data that comes from **outside the trust boundary** (untrusted until checked).

## 1. Context diagram (level 0)

<!-- diagram: dfd-level-0 -->
```mermaid
flowchart LR
  R["Researcher"]
  OA["OpenAlex API"]
  CR["Crossref API"]
  HOST["Static host<br/>GitHub Pages"]
  FILES["Researcher's files<br/>downloads and uploads"]

  SYS((("0<br/>SE Research Hub<br/>runs in the browser")))

  R -- "search criteria, projects, questions,<br/>reviews, evidence, choices" --> SYS
  SYS -- "results, library, matrix,<br/>progress, notices" --> R

  SYS -- "search request:<br/>keywords, filters, page, contact email" --> OA
  OA -- "works: titles, authors,<br/>abstracts, DOIs" --> SYS
  SYS -- "search request" --> CR
  CR -- "works" --> SYS

  HOST -- "page, styles, code modules" --> SYS
  SYS -- "file requests<br/>no user data" --> HOST

  SYS -- "backup JSON, CSV" --> FILES
  FILES -- "backup file to restore" --> SYS

  classDef ext fill:#ffffff,stroke:#444,stroke-width:2px
  classDef untrusted fill:#ffffff,stroke:#444,stroke-width:2px,stroke-dasharray:6 4
  class R,HOST ext
  class OA,CR,FILES untrusted
```

What never leaves the browser: the Researcher's projects, questions, reviews and evidence. Only the **search request** is sent to a third party (the two scholarly APIs), plus the contact email set in `js/config.js`. The static host sees only requests for the app's own files.

## 2. Level 1: main processes and data stores

<!-- diagram: dfd-level-1 -->
```mermaid
flowchart LR
  R["Researcher"]
  APIS["OpenAlex and<br/>Crossref APIs"]
  FILES["Researcher's files"]

  P1((1.0<br/>Discover<br/>papers))
  P2((2.0<br/>Manage projects<br/>and questions))
  P3((3.0<br/>Save and<br/>review papers))
  P4((4.0<br/>Record<br/>evidence))
  P5((5.0<br/>Synthesise<br/>evidence, matrix,<br/>progress))
  P6((6.0<br/>Back up, restore<br/>and export))

  subgraph IDB["IndexedDB database: se-research-hub"]
    direction TB
    D1[("D1 projects")]
    D2[("D2 researchQuestions")]
    D3[("D3 papers")]
    D4[("D4 projectPapers<br/>link, status, review")]
    D5[("D5 evidenceNotes")]
  end

  R <-->|"criteria / results"| P1
  P1 <-->|"requests / works"| APIS
  R <-->|"details / lists"| P2
  R <-->|"choices and notes / library"| P3
  R <-->|"relationship, evidence / list"| P4
  R <-->|"filters / matrix, progress"| P5
  R <-->|"choices / confirmations"| P6
  P6 <-->|"backup, CSV / file to restore"| FILES

  P1 -->|"read: names, saved status"| D1
  P1 --> D4
  P2 <-->|"read, write"| D1
  P2 <-->|"read, write"| D2
  P3 <-->|"read, write"| D3
  P3 <-->|"read, write"| D4
  P3 -->|"read"| D1
  P4 -->|"read"| D2
  P4 -->|"read: is it saved here?"| D4
  P4 -->|"write"| D5
  P5 -->|"read all"| IDB
  P6 <-->|"read all, restore in<br/>one transaction"| IDB

  classDef ext fill:#ffffff,stroke:#444,stroke-width:2px
  classDef untrusted fill:#ffffff,stroke:#444,stroke-width:2px,stroke-dasharray:6 4
  class R ext
  class APIS,FILES untrusted
```

A double-headed line is one flow in each direction (the labels read "in / out"). Arrows into a store are writes, arrows out of a store are reads; a double-headed line to a store is both. **D6 preferences** (`localStorage`: theme, last project, last backup date) is used by the page shell and by 3.0 and 6.0 and is left off the diagram for clarity.

### Flow dictionary (level 1)

| Process | Inputs | Outputs | Reads | Writes |
|---|---|---|---|---|
| 1.0 Discover papers | Keywords, years, sort, open-access flag, chosen sources | Merged results, source notices, "saved to" status | D1 (project names), D4 (what is saved) | none |
| 2.0 Manage projects and questions | Project name and description; question text | Project and question lists, counts | D1, D2 | D1, D2 |
| 3.0 Save and review papers | Chosen paper and project; reading status; structured review text | Library, paper pages | D1, D3, D4 | D3 (paper), D4 (link, status, review) |
| 4.0 Record evidence | Question, relationship, evidence, interpretation, location, tags | Evidence list for the paper | D2, D4 (integrity checks) | D5 |
| 5.0 Synthesise | Filters; project choice | Evidence page, matrix, progress | D1 to D5 | none |
| 6.0 Back up, restore and export | Choice of export; a backup file; confirmation | Backup JSON, CSV files; restore result | D1 to D5 | D1 to D5 (restore only, all-or-nothing) |

## 3. Level 2: process 1.0 Discover papers

This is where untrusted data first enters. Every step between the API reply and the screen exists to make it safe and consistent.

<!-- diagram: dfd-level-2-discover -->
```mermaid
flowchart TB
  R["Researcher<br/>(enters the search)"]
  R2["Researcher<br/>(reads the results)"]
  OA["OpenAlex API"]
  CR["Crossref API"]
  D1[("D1 projects")]
  D4[("D4 projectPapers")]

  P11((1.1<br/>Validate and<br/>record search))
  P12((1.2<br/>Build<br/>requests))
  P13((1.3<br/>Call APIs<br/>in parallel))
  P14((1.4<br/>Check, clean<br/>and normalise))
  P15((1.5<br/>Merge and<br/>de-duplicate))
  P16((1.6<br/>Escape and<br/>present))

  R -- "keywords, years,<br/>open access, sort, sources" --> P11
  P11 -- "valid query and<br/>address update" --> P12
  P12 -- "URLs with encoded<br/>parameters" --> P13
  P13 -- "search request" --> OA
  P13 -- "search request" --> CR
  OA -. "works JSON<br/>UNTRUSTED" .-> P13
  CR -. "works JSON<br/>UNTRUSTED" .-> P13
  P13 -- "raw records or<br/>typed error" --> P14
  P14 -- "Paper objects: tags stripped,<br/>links checked, DOI normalised,<br/>abstract rebuilt" --> P15
  P15 -- "one list, sources noted,<br/>notices for failures" --> P16
  D1 -- "project names" --> P16
  D4 -- "which papers are saved" --> P16
  P16 -- "results, notices,<br/>status announcements" --> R2

  classDef ext fill:#ffffff,stroke:#444,stroke-width:2px
  classDef untrusted fill:#ffffff,stroke:#444,stroke-width:2px,stroke-dasharray:6 4
  class R,R2 ext
  class OA,CR untrusted
```

| Step | What it does | Code |
|---|---|---|
| 1.1 | Accessible validation (keywords 2 to 200, years, at least one source); search stored in the address with `pushState` | `js/ui/forms.js`, `js/views/discover.js` |
| 1.2 | Builds each provider's URL (filters, sort, paging, contact email) with `URLSearchParams`, so text is always encoded | `js/api/openalex.js`, `js/api/crossref.js` (`buildSearchUrl`) |
| 1.3 | Runs both requests together; 15 s timeout; cancellable; maps failures to typed errors | `js/api/search.js` (`searchAll`) |
| 1.4 | Checks the response shape; strips markup from titles; decodes entities; accepts only http(s) links; normalises DOIs; rebuilds OpenAlex's inverted-index abstract; cleans Crossref's JATS XML | `js/api/paper.js`, `normaliseWork`, `normaliseItem` |
| 1.5 | Same DOI (or same title and year) becomes one paper; the preferred source wins conflicts and gaps are filled | `js/api/merge.js` |
| 1.6 | Everything is HTML-escaped when drawn; the result count is announced to screen readers | `js/ui/dom.js` (`esc`), `js/ui/announcer.js` |

## 4. Data model

<!-- diagram: data-model -->
```mermaid
erDiagram
  PROJECT ||--o{ RESEARCH_QUESTION : "has"
  PROJECT ||--o{ PROJECT_PAPER : "contains"
  PAPER ||--o{ PROJECT_PAPER : "is saved as"
  PROJECT_PAPER ||--o{ EVIDENCE : "is the source of"
  RESEARCH_QUESTION ||--o{ EVIDENCE : "is answered by"

  PROJECT {
    string id PK
    string name
    string description
    string createdAt
    string updatedAt
  }
  RESEARCH_QUESTION {
    string id PK
    string projectId FK
    string text
    int position
    string createdAt
    string updatedAt
  }
  PAPER {
    string id PK "doi:... or openalex:..."
    string title
    string doi
    string authors "list"
    int year
    string venue
    string abstract
    string url
    string oaUrl
    bool isOa
    string oaStatus
    int citedBy
    string sources "list: openalex, crossref"
  }
  PROJECT_PAPER {
    string id PK "projectId:paperId"
    string projectId FK
    string paperId FK
    string addedAt
    string status "unread, reading, read"
    object review "studyAim, methodology, participants, keyFindings, limitations, notes"
    string reviewedAt
  }
  EVIDENCE {
    string id PK
    string projectId FK
    string paperId FK
    string researchQuestionId FK
    string relationship "supports, contradicts, mixed, contextual, none"
    string evidence "what the paper reports"
    string interpretation "what the researcher makes of it"
    string location
    string tags "list"
    string createdAt
    string updatedAt
  }
```

### Data stores

| Store | Key | Indexes | Notes |
|---|---|---|---|
| D1 `projects` | `id` (UUID) |  | Deleting a project removes its D2, D4 and D5 rows, then any D3 paper nothing links to |
| D2 `researchQuestions` | `id` | `projectId` | Numbered by `position` (RQ1, RQ2…); deleting removes its D5 rows |
| D3 `papers` | `id` (`doi:…`, or `openalex:…` when there is no DOI) | `doi` | **One shared record per paper**, however many projects use it |
| D4 `projectPapers` | `projectId:paperId` | `projectId`, `paperId` | Holds the **per-project** reading status and structured review, so the same paper can be read differently in two projects; the composite key makes duplicate saves impossible |
| D5 `evidenceNotes` | `id` | `projectId`, `paperId`, `researchQuestionId` | Integrity: the paper must be saved in the project and the question must belong to it; removing the paper link removes this project's evidence for that paper only |
| D6 preferences | n/a (`localStorage`) | | `seh-theme`, `seh-last-project`, `seh-last-backup`: small conveniences only, never research data |

### Why this shape
- **Evidence and interpretation are separate fields** so the method (report versus infer) is built into the data, and exports keep them apart.
- **Review and status live on the link (D4), not on the paper (D3)**, because they belong to a paper *in a project*.
- **One paper record, many links** avoids duplicated metadata and lets a paper be refreshed once.
- **IndexedDB, not `localStorage`**: structured records, indexes for lookups, much larger quota, and transactions (used for atomic restore and cascade deletes).

## 5. Data flow rules that matter for safety

| Rule | Where enforced |
|---|---|
| Nothing from an API reaches D3 without passing step 1.4, then the field whitelist `validatePaper` | `js/api/*`, `js/validation.js` |
| Nothing from a backup file reaches any store without full validation and a field-by-field copy | `js/backup.js` |
| Writes that span stores happen in **one transaction** (restore, project delete, remove-paper) | `js/db/repository.js` |
| Untrusted text is escaped at the moment it is drawn, never stored pre-escaped | `esc()` in every view |
| Exported CSV cells that look like formulas are neutralised | `js/export.js` (`csvCell`) |
