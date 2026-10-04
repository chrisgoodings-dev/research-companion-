# Interaction sequence diagrams

Each diagram shows who talks to whom, in order, with the **actual requests** the app makes. Solid arrows are calls or requests; dashed arrows are replies.

Participants used throughout:

| Participant | Meaning |
|---|---|
| Researcher | The person using the app |
| Page | The view in the browser (HTML, CSS and the view's JavaScript) |
| Router | `js/router.js`, which shows the page for the address after `#` |
| Search | `js/api/search.js`, which runs the sources in parallel and merges |
| OpenAlex / Crossref clients | `js/api/openalex.js`, `js/api/crossref.js` |
| Repo | `js/db/repository.js`, the only code that touches IndexedDB |
| IndexedDB | The browser's database (`se-research-hub`) |
| GitHub Pages | The static host that serves the app's own files |

## 1. Loading the app and opening a page

<!-- diagram: seq-page-load -->
```mermaid
sequenceDiagram
  autonumber
  actor R as Researcher
  participant B as Browser
  participant H as GitHub Pages
  participant Rt as Router
  participant DB as IndexedDB

  R->>B: opens the site address
  B->>H: GET /research-companion-/ (index.html)
  H-->>B: 200 HTML with Content-Security-Policy meta tag
  B->>B: runs the hashed inline snippet that applies the saved theme before first paint
  par styles and code in parallel
    B->>H: GET css/tokens.css, base.css, layout.css, components.css
    B->>H: GET js/main.js and the preloaded modules (modulepreload)
  end
  H-->>B: 200 files
  B->>Rt: main.js starts the router
  Rt->>Rt: reads the address, for example #/dashboard, finds the route
  Rt->>H: dynamic import of js/views/dashboard.js (first visit only)
  H-->>Rt: 200 module
  Rt->>B: draws the page skeleton, moves focus to the heading, announces the page
  Rt->>DB: open se-research-hub, count the five stores
  DB-->>Rt: counts
  Rt->>B: fills in the numbers
  Note over B,H: No user data is ever sent to the host. Later visits to the same page reuse the downloaded module.
  alt a module download fails
    H--xRt: network error
    Rt->>B: shows Something went wrong with advice
    R->>Rt: visits the page again
    Rt->>H: GET module with ?retry=1 (a fresh address, because browsers remember failures)
  end
```

## 2. Searching: the API calls

<!-- diagram: seq-search -->
```mermaid
sequenceDiagram
  autonumber
  actor R as Researcher
  participant P as Page (Discover)
  participant S as Search
  participant OC as OpenAlex client
  participant CC as Crossref client
  participant OA as api.openalex.org
  participant CR as api.crossref.org
  participant DB as IndexedDB

  R->>P: submits the search form
  P->>P: validates: keywords 2 to 200 characters, years in range and earliest not after latest, at least one source
  alt invalid
    P-->>R: focus moves to the first problem, count of problems announced
  else valid
    P->>P: pushState so the address becomes /discover?q=...&from=...&oa=1&sort=...
    P->>S: searchAll(query, sources, abort signal)
    opt Open access only is on
      S->>S: skip Crossref and add a notice (Crossref has no open access flag)
    end
    par OpenAlex
      S->>OC: searchOpenAlex(query)
      OC->>OA: GET /works<br/>search=keywords<br/>per-page=20 and page=n<br/>sort=relevance_score:desc or publication_date:desc or cited_by_count:desc<br/>filter=publication_year:2020-2024,is_oa:true<br/>select=id,doi,title,authors,primary_location,open_access,abstract_inverted_index,...<br/>mailto=contact address
      OA-->>OC: 200 JSON with meta.count and results
      OC->>OC: checks the shape, then for each work: strips tags from the title, accepts only http(s) links, normalises the DOI, rebuilds the abstract from the inverted index
      OC-->>S: total, pages, Paper objects
    and Crossref
      S->>CC: searchCrossref(query)
      CC->>CR: GET /works<br/>query=keywords<br/>rows=20 and offset=(page-1)*20<br/>sort=score or published or is-referenced-by-count, order=desc<br/>filter=type:journal-article,type:proceedings-article,from-pub-date:2020,until-pub-date:2024<br/>select=DOI,title,author,issued,container-title,abstract,URL,...<br/>mailto=contact address
      CR-->>CC: 200 JSON with message.total-results and message.items
      CC->>CC: checks the shape, strips JATS tags, decodes entities, drops the Abstract label, normalises the DOI
      CC-->>S: total, pages, Paper objects
    end
    S->>S: merge: same DOI becomes one paper, preferred source wins, gaps filled, relevance interleaved or sorted by year or citations
    S-->>P: papers, total, pages, notices, which sources answered
    P->>DB: read the projects and which papers are already saved
    DB-->>P: project names, saved status
    P->>P: draws every value HTML-escaped, shows Found in OpenAlex and Crossref
    P-->>R: result summary announced to screen readers, results shown
  end
  Note over P,CR: Both requests are cross-origin. The browser allows them because the APIs send CORS headers, and the page's Content-Security-Policy lists exactly these two hosts in connect-src.
```

## 3. Searching: when something goes wrong

<!-- diagram: seq-search-errors -->
```mermaid
sequenceDiagram
  autonumber
  actor R as Researcher
  participant P as Page (Discover)
  participant S as Search
  participant C as API client
  participant API as OpenAlex or Crossref

  P->>S: searchAll(query)
  S->>C: run each chosen source (15 second timeout each)
  C->>API: GET /works ...
  alt reply never arrives within 15 seconds
    C--xS: ApiError timeout
  else browser cannot connect (offline, blocked)
    C--xS: ApiError network
  else HTTP 429
    API-->>C: 429 Too Many Requests
    C--xS: ApiError rate-limit
  else HTTP 500 or above
    API-->>C: 5xx
    C--xS: ApiError server
  else other HTTP error
    API-->>C: 4xx
    C--xS: ApiError http
  else not JSON, or not the expected shape
    API-->>C: 200 with unexpected body
    C--xS: ApiError bad-response
  else Researcher searches again first
    R->>P: a newer search
    P->>S: abort the earlier request
    C--xS: ApiError aborted (its late reply is ignored)
  else 200 and valid
    API-->>C: 200 JSON
    C-->>S: papers
  end
  alt every chosen source failed
    S--xP: throws the first error
    P-->>R: alert card: what happened and what to do, with Try again
  else some sources failed but others returned papers
    S-->>P: papers plus a notice per failed source
    P-->>R: results with a visible notice such as Crossref could not be searched
  else sources answered but a source also failed and there are no papers
    S--xP: throws the error (a failure must never look like No results)
    P-->>R: alert card with Try again
  else all sources answered with zero papers
    S-->>P: empty list
    P-->>R: No results, with advice to widen the search
  end
```

## 4. Saving a paper to a project

<!-- diagram: seq-save-paper -->
```mermaid
sequenceDiagram
  autonumber
  actor R as Researcher
  participant P as Page (Discover)
  participant D as Save dialog
  participant Rp as Repo
  participant DB as IndexedDB

  R->>P: presses Save to project on a result
  P->>D: open with the paper title and the projects that do not have it yet
  D-->>R: dialog, last used project preselected, Cancel and Save
  alt Cancel or Esc
    R->>D: cancel
    D-->>P: no project chosen, focus returns to the button
  else Save
    R->>D: chooses a project and saves
    D-->>P: project id (remembered in localStorage for next time)
    P->>Rp: papers.saveToProject(projectId, paper)
    Rp->>Rp: validatePaper: whitelist fields, blank unsafe links, bound lengths
    Rp->>DB: get project
    DB-->>Rp: project (or missing, which is an error)
    Rp->>DB: begin read-write transaction on papers and projectPapers
    Rp->>DB: get link projectId:paperId
    Rp->>DB: put the paper (one shared record, refreshed)
    opt no link yet
      Rp->>DB: add link with status unread and no review
    end
    DB-->>Rp: commit
    Rp-->>P: created or already present
    P->>Rp: refresh saved status
    P-->>R: card shows Saved to: project name, confirmation announced, focus stays on the card
  end
```

## 5. Recording evidence

<!-- diagram: seq-evidence -->
```mermaid
sequenceDiagram
  autonumber
  actor R as Researcher
  participant P as Page (Paper, Evidence tab)
  participant Rp as Repo
  participant DB as IndexedDB

  R->>P: submits the evidence form
  P->>P: checks: question chosen, relationship chosen, evidence not blank, tags at most 10
  alt invalid
    P-->>R: messages next to the fields, focus on the first, problem count announced
  else valid
    P->>Rp: evidence.create(projectId, paperId, questionId, relationship, evidence, interpretation, location, tags)
    Rp->>Rp: validateEvidence: lengths, relationship allowed, tags normalised
    Rp->>DB: get the research question
    DB-->>Rp: question
    Rp->>Rp: the question must belong to this project
    Rp->>DB: get link projectId:paperId
    DB-->>Rp: link
    Rp->>Rp: the paper must be saved in this project
    Rp->>DB: add evidence record
    DB-->>Rp: ok
    Rp-->>P: record
    P->>Rp: evidence.listByPaper(projectId, paperId)
    Rp->>DB: read by paperId index
    DB-->>P: records
    P-->>R: list updated, form cleared, focus on the first field, Evidence added announced
  end
```

## 6. Viewing the evidence matrix

<!-- diagram: seq-matrix -->
```mermaid
sequenceDiagram
  autonumber
  actor R as Researcher
  participant Rt as Router
  participant P as Page (Matrix)
  participant Rp as Repo
  participant DB as IndexedDB

  R->>Rt: opens the Matrix (or chooses another project)
  Rt->>P: loads js/views/matrix.js on first visit and draws the heading
  P->>Rp: projects.list()
  Rp->>DB: read projects
  DB-->>P: projects
  par three reads for the chosen project
    P->>Rp: questions.listByProject
    Rp->>DB: read by projectId index
  and
    P->>Rp: papers.listByProject
    Rp->>DB: read links, then each paper
  and
    P->>Rp: evidence.listByProject
    Rp->>DB: read by projectId index
  end
  DB-->>P: questions, papers with status, evidence
  P->>P: buildMatrix: papers sorted by title, a cell per question counting each relationship, summary row, conflict flags, gaps
  P-->>R: table with caption and scoped headers, What stands out, key
  P-->>R: choosing a project is announced: Evidence matrix for the project name
```

## 7. Backing up and restoring data

<!-- diagram: seq-backup -->
```mermaid
sequenceDiagram
  autonumber
  actor R as Researcher
  participant P as Page (Backup)
  participant Rp as Repo
  participant DB as IndexedDB
  participant F as File system

  R->>P: presses Download backup
  P->>Rp: exportAll()
  Rp->>DB: read all five stores in one read transaction
  DB-->>Rp: projects, questions, papers, links, evidence
  Rp-->>P: data
  P->>P: buildBackup: app name, version 1, date, data
  P->>F: downloads se-research-hub-backup-date.json (a blob link, nothing is uploaded)
  P->>P: remembers the date in localStorage
  P-->>R: Backup downloaded
```

<!-- diagram: seq-restore -->
```mermaid
sequenceDiagram
  autonumber
  actor R as Researcher
  participant P as Page (Backup)
  participant V as Validator
  participant Rp as Repo
  participant DB as IndexedDB
  participant F as File system

  R->>P: chooses a backup file
  P->>F: reads the file (File API, nothing leaves the device)
  F-->>P: text
  P->>V: parseBackupText(text)
  V->>V: size at most 20 MB, valid JSON, right app and version, at most 50000 records
  V->>V: every record checked and copied field by field into new objects, unknown keys dropped
  V->>V: references checked inside the file, duplicate ids and bad dates refused
  alt not valid
    V-->>P: up to 25 problems with exact locations
    P-->>R: alert listing them, Nothing was changed
  else valid
    V-->>P: clean data and counts
    P-->>R: preview of what the file contains, Merge (default) or Replace
    alt Replace chosen
      P-->>R: confirmation dialog, Cancel focused, cannot be undone
      R->>P: confirms (or cancels, which stops here)
    end
    P->>Rp: importData(clean, mode)
    Rp->>DB: begin ONE read-write transaction on all five stores
    opt mode is replace
      Rp->>DB: clear all five stores
    end
    loop each record
      opt mode is merge and the id already exists
        Rp->>DB: skip it
      end
      Rp->>DB: add record
    end
    alt every write succeeded
      DB-->>Rp: commit
      Rp-->>P: records added and skipped
      P-->>R: Restore complete, counts refreshed
    else any write failed
      DB--xRp: error
      Rp->>DB: abort, so nothing at all changes
      P-->>R: Restore failed, Nothing was changed
    end
  end
```

## 8. API contract summary

| | OpenAlex | Crossref |
|---|---|---|
| **Endpoint** | `GET https://api.openalex.org/works` | `GET https://api.crossref.org/works` |
| **Search text** | `search` | `query` |
| **Paging** | `per-page=20`, `page=n` (the app stops at 10,000 results, 500 pages) | `rows=20`, `offset=(n-1)*20` (same cap) |
| **Sort** | `sort=relevance_score:desc`, `publication_date:desc`, `cited_by_count:desc` | `sort=score`, `published`, `is-referenced-by-count` with `order=desc` |
| **Year filter** | `filter=publication_year:2020-2024` (or `>2019`, `<2025`) | `filter=from-pub-date:2020,until-pub-date:2024` |
| **Open access** | `filter=is_oa:true` | not supported, so the source is skipped when requested |
| **Types** | all | `filter=type:journal-article,type:proceedings-article` |
| **Fields requested** | `select=id,doi,title,display_name,publication_year,type,cited_by_count,authorships,primary_location,open_access,abstract_inverted_index` | `select=DOI,title,author,issued,container-title,abstract,URL,is-referenced-by-count,type` |
| **Identification** | `mailto=<contact address>` (polite pool) | `mailto=<contact address>` (polite pool) |
| **Response shape the app requires** | `{ meta: { count }, results: [...] }` | `{ message: { "total-results", items: [...] } }` |
| **Abstract** | an *inverted index* (`word: [positions]`) rebuilt into text | JATS XML text, tags removed, entities decoded |
| **Credentials** | none | none |
| **Failure handling** | timeout 15 s, network, 429, 5xx, other HTTP, bad response, cancelled (see diagram 3) | same |

Notes
- The formats above are the providers' documented ones. The app's tests use recorded sample responses, and the author confirmed on the live site that real searches return results.
- No API keys exist anywhere in the app, so there is nothing secret to leak. The only identifying value sent is the optional contact address.
- Nothing is retried automatically. A rate-limited or failed search shows what happened and a **Try again** button, so the app never hammers a struggling service.
- The static host is the only other server contacted, and only for the app's own files (diagram 1).
