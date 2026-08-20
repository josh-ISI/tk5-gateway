# TK5 Tools — remote job submission and output retrieval

All scripts, JCL, and the console sources live in **`source/`** — `cd source`
before running any of the commands below; every file mentioned by bare name
in this README (`console.html`, `submit-job.ps1`, etc.) is in that folder.

## Installation instructions

1. **Build Hercules from source.**

   Download and build the SDL Hercules-390 fork, follow the instructions
   located here - https://sdl-hercules-390.github.io/html/hercinst.html
   
   Verify with `hercules --version`.

3. **Get TK5** ("Turnkey MVS 3.8j, update 5" — a prebuilt, pre-IPL'd MVS
   3.8j DASD image plus a matching Hercules config).
   
   `curl -L -o mvs-tk5.zip https://www.prince-webdesign.nl/images/downloads/mvs-tk5.zip`
   
   The distribution's own README explains its startup script and exact
   layout — `conf/tk5.cnf` (referenced throughout this README) is where
   you'll come back to for the sockdev printer change in step 4.

4. **First boot.** Run TK5's own startup script per its docs — it
   launches Hercules against `conf/tk5.cnf` and auto-IPLs. Once JES2 is
   up, log on via any TN3270 client (x3270, PCOMM, c3270…) to port 3270
   with the default user ID and password `HERC01` / `CUL8TR`.

5. **Confirm networking and make the sockdev printer permanent.** Every
   port this toolkit needs is listed in "Ports on 192.168.1.XXX" just
   below — confirm each is reachable. Then follow "IMPORTANT: making the
   sockdev printer permanent" further down to convert device 00F in
   `conf/tk5.cnf`; skip this and `MSGCLASS=Z` capture won't survive a
   restart.

6. **Start the HTTPD started task.** Not auto-started — bring it up from
   the operator console after every IPL with `S HTTPD` (or, once you've
   got this far, `.\oper.ps1 '/S HTTPD'`). Confirm with a plain
   `GET http://<host>:8080/` — you should get a page back (the stock TK5
   welcome page before step 6, this repo's console after).

7. **Deploy this toolkit.** Follow "How it's built / deploying changes"
   below for the exact commands to FTP `console.html` into the UFS root
   and deploy `WEBADM.rexx` into `HTTPD.BREXX`, and allocate
   `HERC01.WEBSTG` (same section) before Submit will work.

8. **Verify.** `http://<host>:8080/` should redirect straight into the
   console, the green "backend ready (read/write)" dot should light up,
   and Datasets → List should populate with HERC01's PDS list.

## Open ports

| Port | What it is |
|------|------------|
| 3270 | TN3270 (TSO, logon HERC01) |
| 3505 | Hercules **sockdev card reader** — pipe ASCII JCL at it to submit a job |
| 4000 | Hercules **sockdev printer** (device 00F = JES2 PRINTER2, class **Z**) — legacy capture path |
| 8038 | Hercules web console — `GET /cgi-bin/tasks/syslog?command=...` executes console commands; prefix MVS/JES2 commands with `/` |
| 8080 | **TK5 HTTPD** (MVS started task) — web UI plus the **HTTPJES2 REST API** under `/jes/*` |
| 8021 | HTTPD's MVS-side FTP server (datasets + UFS; logon HERC01) |
| 21   | vsFTPd on the Linux host (real credentials required; anonymous denied) |

## Web console (served by the mainframe)

`http://<hostip>:8080/console.html` — a modern single-page admin UI
hosted on the HTTPD's UFS filesystem (source: `console.html`, uploaded via
the 8021 FTP in **ASCII mode** — `curl -T file "ftp://<hostip>:8021/console.html;type=a"`;
binary mode stores mojibake). Working now, no local process needed:

- Datasets: list by HLQ, browse PDS members, view member/PS content
- Jobs: live status list, view job output, purge
- All via the existing `/dsl/*` and `/jes/*` endpoints (same origin).

Edit + Submit are wired to `POST /rexx/WEBADM` and light up automatically
once that CGI is installed. **Blocker:** RAKF denies HERC01 write to the CGI
library `HTTPD.BREXX` (class PROD, `S913`), so the backend must be installed
by an admin (IBMUSER) or after a RAKF PERMIT. Backend source: `WEBADM.rexx`
(untested — can't be installed/run as HERC01). Alternative write path without
touching RAKF: a small local bridge (not built yet).

`deploy-member.ps1 <file> <DSN> <MEMBER>` deploys a text file into a PDS
member via IEBUPDTE (DISP=SHR, so it coexists with a task holding the PDS).
Only works for datasets HERC01 is allowed to write.

## HTTPJES2 REST API (port 8080, needs the HTTPD task started)

- `GET /jes/status?job=NAME` — JSON job/STC/TSU status (patterns ok: `herc*`)
- `GET /jes/print?jobid=JOB00123` — full job output as plain text (no banners)
- `GET /jes/ddlist?jobid=...` — JSON incl. spool dataset list (dsid values)
- `POST /jes/purge` with form body `jobname=X&jobid=Y` — purge job output
- `GET /jes/help` — full verb list. No submit verb — submission stays on 3505.

`submit-job.ps1` uses this automatically for `MSGCLASS=H` jobs: submit via
3505 → poll status → fetch print → purge. No printers involved, spool stays
clean. `MSGCLASS=Z` still selects the legacy sockdev-printer capture.

## Why job output "disappears"

All three JES2 printers show INACTIVE — in JES2 that means **started and idle**,
not drained. Class A output prints immediately to `prt/prt00e.txt` on the Linux
host and is purged from the spool, so there is nothing left to view from TSO.

Three ways to see output, pick per job:

1. **Stream it back to the PC** (this toolkit): submit with `MSGCLASS=Z` and
   `SYSOUT=Z`; PRINTER2 is now a sockdev on port 4000 and `submit-job.ps1`
   captures it to a file.
2. **Browse on the spool from TSO**: submit with a class no printer serves
   (e.g. `MSGCLASS=H`), then in TSO run `RFE` and use option **Q (QUEUE)** to
   browse/purge job output — the closest thing to SDSF on MVS 3.8. Zero
   system changes needed.
3. **Read the print files on the Linux host**: class A keeps landing in
   `<tk5dir>/prt/prt00e.txt` (all jobs concatenated).

## Web console (browser admin UI)

** IMPORTANT - Update all *.ps1 files in the /source directory to have the
IP address of your machine, otherwise none of the *.ps1 scripts will work.

Open **http://<hostip>:8080/** (needs the HTTPD started task up) — the
root now redirects straight to `/console.html`. The redirect lives in the
UFS file `/index.html` (that's what the HTTPD serves as root, uploaded via
8021 FTP like console.html); the original TK5 welcome page is preserved in
`HTTPD.HTML.TK5(INDEX)` and locally as `httpd-index-original.html`.
A single-page console with two tabs — Datasets and Jobs. Editing and
submitting JCL both live inside the Datasets tab's explorer now (no
separate Editor/Submit tabs; removed 2026-07-06 once the explorer covered
everything they did).

- **Datasets** — list by HLQ; clicking a dataset opens the **Explorer**, a
  VS Code-style full-screen view (`#explorer`) with:
  - **Tree** (left) — PO datasets expand to show members (with a
    *+ new member* entry); PS datasets and members open directly.
  - **Tabs** (top of the edit pane) — every file opened stays open in its
    own tab, VS Code-style: click to switch, × to close (confirms if
    unsaved), an amber dot marks unsaved tabs. Tab state persists across
    closing/reopening the explorer.
  - **Right-click, Zowe-style** — right-click a PO/PS dataset or a member
    in the tree for **Open** / **Submit JCL**; right-click inside the open
    editor or an editor tab for **Save** / **Submit JCL**. Submit reads
    from the tree/API directly (tree items) or from the live editor buffer
    (open tabs) — no save required first. **Ctrl+S** still saves the
    active tab via WEBADM.
  - Unsaved-changes dot + confirm guards on tab-close, explorer-close, and
    tab switch. Browser Back (or ← Console) returns to the console without
    losing open tabs.
  - **New…** (dataset list toolbar) allocates a dataset. Type dropdown
    offers **PDS** (default), **Sequential (PS)**, and **Direct (DA)** —
    the only types MVS 3.8j can create. PDSE, VSAM, and zFS/HFS are shown
    but disabled: PDSE and zFS/HFS postdate this OS (need DFSMS / USS),
    and VSAM has no VSAM-owned volume configured here (0 clusters exist;
    `DEFINE CLUSTER` fails `IDC3033I VOLUME RECORD NOT FOUND`). Create is
    done entirely client-side: builds an IEFBR14 alloc job, submits via
    WEBADM, waits for it on the spool, checks the output for `CATALOGED`,
    purges the job, and refreshes the list.
- **Jobs** — spool queue with live status, output viewer, and purge
  (`/jes/status`, `/jes/print`, `/jes/purge`).
- **Copy/move/rename** (Zowe-explorer style) — right-click a member, a whole PO
  dataset, or a sequential/direct dataset for Copy/Cut/rename; right-click a
  destination (a PDS, a specific member, a sequential dataset, empty tree
  space, an open tab, or inside the editor) for Paste. "Paste into new
  dataset…" allocates the destination for you. A clipboard bar in the
  sidebar shows what's pending. Built entirely on the existing read/save
  endpoints plus small submitted utility jobs — see the `exClip*`/`exPaste*`
  functions and the comment above them for how member deletion works
  (IEHPROGM SCRATCH can't demand-mount a resident volume on this Hercules
  setup; the working technique is IEBCOPY EXCLUDE into a temp PDS, delete
  original, recreate under the same name, copy back, delete temp).
- **Line numbers + syntax highlighting** — a synced gutter plus a
  classic transparent-textarea-over-highlighted-`<pre>` overlay
  (`exRefreshEditorView`/`exHighlight`, no external libraries or CDN
  dependency). One combined regex tokenizes JCL/REXX/ASM comments,
  strings, keywords, and numbers well enough to be useful without being
  language-exact.

### How it's built / deploying changes

- **Frontend**: three files on the HTTPD UFS filesystem —
  `console.html` (markup + `<link>`/`<script src>`), `console.css` (all
  styling), `console.js` (all logic; split out of one monolithic
  `console.html` on 2026-07-07 once the file got unwieldy). All three
  deploy the same way, **ASCII-mode** FTP puts (the HTTPD serves UFS files
  EBCDIC→ASCII, so upload must translate ASCII→EBCDIC):
  
  `curl -T console.html "ftp://<hostip>:8021/console.html;type=a" --user HERC01:CUL8TR`
  
  (repeat for `console.css`/`console.js`; binary/`;type=i` stores raw ASCII
  and serves as garbage — must be `;type=a`). The HTTPD correctly serves
  `.css`/`.js` with sane content-types (`text/css`, `application/x-javascript`
  — confirmed by uploading test files, not assumed).
  **This FTP silently hard-wraps any line longer than ~254 chars** — no
  error, it just splits the line in two, which is fatal if it lands inside
  a regex/string literal (broke syntax highlighting once already). After
  any edit, check all three: `awk 'length>240{print length,NR}' console.html console.css console.js`
  and keep long generated content (e.g. big regex alternations) built via
  string concatenation split across short lines instead of one long
  literal.
  **Deployed files must also be pure ASCII.** The ASCII/EBCDIC translation
  turns some non-ASCII (UTF-8 multi-byte) bytes into a newline mid-line —
  e.g. raw `★`/`☆` in `console.js` each became a line break inside a string
  literal and broke the whole script on 2026-07-07 (froze on "connecting…").
  Use `\uXXXX` in JS and `&#NNNN;` entities in HTML; never paste raw
  non-ASCII glyphs. Verify with `LC_ALL=C grep -n '[^ -~\t]' console.js` and,
  after upload, fetch the served file back and confirm `node --check` passes
  and its line count matches local (a mismatch = a line got split). A local
  static-server test will NOT catch this — the corruption is FTP-path only.
- **Backend**: `WEBADM.rexx` is a BREXX CGI in `HTTPD.BREXX`, reached at
  `/rexx/WEBADM`. Deploy with `.\deploy-member.ps1 WEBADM.rexx HTTPD.BREXX WEBADM`.
  Actions: `ping`, `save` (open/write to a dsn), `submit` (stage to
  `HERC01.WEBSTG(WEBJOB)` then BREXX `SUBMIT()` the dsn). Reads request vars
  from the `HTTPVARS` DD; POST fields arrive as `POST_xxx`, query as `QUERY_xxx`.
  **`HERC01.WEBSTG`** is a small dedicated PDS (FB/80, matches `HERC01.JCL`)
  that exists only for this staging write — deliberately *not* `HERC01.JCL`
  itself (added 2026-07-06 after a live TSO 3270 session with a `HERC01.JCL`
  member open blocked every submit action with `ERR stage open rc=-1` until
  the session closed). Never open a member of `HERC01.WEBSTG` interactively.

### Quirks worth knowing (all handled in code)

- `/dsl/list?hlq=` lists datasets *under* a qualifier node — passing a full
  leaf name (e.g. `SYS1.PARMLIB`) returns 501 "no datasets found". The console
  queries the first qualifier and prefix-filters client-side, so any prefix
  typed in the HLQ box works.
- `/dsl/pds` returns **404 "No members found" for an empty PDS** — normal for
  a freshly created one. The web console shows "empty PDS" with an
  *add first member* shortcut (opens the Editor prefilled).
- The HTTPD form decoder **collapses a leading `//`** in a value to `/`. The
  console prefixes every saved/submitted line with a `~` guard that WEBADM
  strips (`deSentinel`). Slashes elsewhere are fine.
- BREXX compound-variable tails are uppercased, so HTTPVARS names are stored
  uppercased and line fields referenced via `vn='POST_LINE'i; V.vn`.
- The HTTPD started-task BREXX has **no TSO/command host environment**
  (`address TSO` → rc -3), so dynamic alloc is out; job submission uses the
  native `SUBMIT('dsn')` function instead of an internal-reader DD.
- `HTTPD.BREXX` is **VB/255**, so members are deployed with **IEBGENER**
  (DISP=SHR), not IEBUPDTE (whose fixed-80 assumption can't open it).

## PDPCLIB version skew (GCC jobs from PDPCLIB.SOURCE)

`PDPCLIB.SOURCE`/`DOC`/`LINKLIB` are a June-2026 drop (TSO001), but the
runtime the GCCCL/GCCCLG procs link against — `PDPCLIB.INCLUDE`/`MACLIB`/
`NCALIB` (TK5002) — is the 2023 TK5 original. Newer source can reference
runtime symbols the old NCALIB lacks: `PDPTEST` calls `__getam()` and the
linkedit fails `IEW0132 @@GETAM`, leaving the module not executable (S706
at run time). Fix in place: `HERC01.NCALIB(MVSGETAM)` is an NCAL shim of
the newer `@@GETAM` (lifted from `PDPCLIB.SOURCE(MVSSUPA)`, `ALIAS
@@GETAM`); concat it ahead of the stock runtime in the job:

    //LKED.SYSLIB DD DSN=HERC01.NCALIB,DISP=SHR
    //            DD DSN=PDPCLIB.NCALIB,DISP=SHR

If another `@@...` symbol comes up unresolved, extract that routine from
`PDPCLIB.SOURCE(MVSSUPA)` the same way and add it to `HERC01.NCALIB`.

`gcctest.jcl` (= `HERC01.JCL(GCCTEST)`) is the working version of the
stock `WEBJOB` PDPCLIB sample: `MSGCLASS=H` so output stays visible on
the spool, `OUTFILE`/`STEPLIB` moved to `HERC01.LINKLIB` (the original's
`PDPCLIB.LINKLIB` is RAKF PROD → `S913`), SYSLIB concat above, and the
`AMODE=31,RMODE=ANY` link options dropped (invalid on the 3.8 linkage
editor). `HERC01.JCL(WEBJOB)` is ordinary now (was WEBADM's submit
staging area until 2026-07-06; that moved to `HERC01.WEBSTG` — see
"How it's built" above — so editing this member freely is fine).

## Scripts

- `asm.ps1 <file.asm>` — one-command IFOX00 assemble-link-run using the
  stock ASMFCLG proc. Shows WTO output and anything written to GO SYSPRINT.
- `rexx.ps1 <file.rexx>` — runs a REXX script under BREXX V2R5M3: writes it
  to `HERC01.RXBATCH.EXEC(RXTEMP)` then executes via the RXBATCH proc.
  Uses a dedicated library because `HERC01.EXEC` is enqueued by any active
  TSO logon and the batch job would wait forever on the dataset.
- `gcc.ps1 <file.c>` — one-command C compile-link-run on the mainframe:
  wraps the source in JCL (SYS2.PROCLIB GCCCLG proc, REGION=4096K,
  `DD DATA,DLM='##'` so column-1 `/*` comments are safe), submits, and shows
  step return codes plus the program's output (or compiler diagnostics on
  failure). Full listing kept in `<file>.out`. Add `-Full` to dump it all.
- `submit-job.ps1 <file.jcl>` — submits via port 3505; if the JCL contains
  `MSGCLASS=Z` it also connects to port 4000 first and saves the returned
  output to `<file>.out`. Manages PRINTER2 automatically: `$S` on connect,
  `$P` (drain) before disconnect, so the printer never faces an empty socket.
- `oper.ps1 '<command>'` — runs an operator command via the web console,
  e.g. `.\oper.ps1 '/$DA'` or `.\oper.ps1 'devlist PRT'`. Single-quote it.
- `c-template.jcl` / `hello2.jcl` — C job templates (shipped proc / inline
  proc for the newer TSO001 GCCMVS). `sockdev.jcl` — class-Z test job.

## Troubleshooting: Purge doesn't remove output (class-Z stuck on PRINTER2)

The console Purge button (and `/jes/purge` / HTTPJES2) can only remove output
that is on the spool queue. Output **assigned to a printer device** — anything
routed to JES2 class **Z**, which maps to PRINTER2 (the drained sockdev on port
4000) — cannot be purged this way; HTTPJES2 returns rc=0 but the output stays.
This is why e.g. the SHUTDOWN STC output lingers. The console now verifies after
purge and tells you when this happens.

Fix: **`.\drain-printer2.ps1`** — connects a listener, starts PRINTER2 so the
queued output prints (its disposition is PURGE, so it clears itself), then
re-drains the printer. Add `-Save out.txt` to keep a copy of what printed.

## Troubleshooting: PRINTER2 stuck with `IEA000A 00F,INT REQ`

Happens if JES2 tries to print class Z while no client is connected to port
4000 (shouldn't occur anymore — PRINTER2 stays DRAINED between captures).
Recovery: connect a listener to port 4000, then `.\oper.ps1 'i 000F'` to
raise the device-end interrupt MVS is waiting for. Note the queued output
may reprint immediately; make sure the listener is attached first.

## IMPORTANT: making the sockdev printer permanent

Device 00F was converted at runtime with `devinit 000F 4000 sockdev`
(2026-07-02). **This does not survive a Hercules restart.** To make it
permanent, edit the TK5 config on the Linux host (`conf/tk5.cnf`) and change
the 000F line from something like:

    000F 1403 prt/prt00f.txt crlf

to:

    000F 1403 4000 sockdev

To revert at runtime instead: `.\oper.ps1 'devinit 000F prt/prt00f.txt crlf'`

Note: if a class-Z job prints while no client is connected to port 4000, the
printer waits (intervention required) until a client connects — nothing is
lost, but the job sits there. `submit-job.ps1` connects before submitting to
avoid this.

## Troubleshooting: HTTPD won't rebind after restart (`EADDRINUSE`, error=48)

Restarting the HTTPD started task can fail to rebind port 8080 right away:

    HTTPD030E bind() failed for HTTP port, rc=-1, error=48
    HTTPD030I EADDRINUSE, waiting for TCPIP to release HTTP port=8080

This is normal TCP/IP linger behavior, not a real failure: the previous
task's listening socket doesn't disappear the instant the task ends —
TCPIP holds the port reserved for a short TIME_WAIT-style period first
(more likely if the old task was canceled rather than shut down cleanly,
or still had client connections open). HTTPD's own retry loop handles
this by design, logging `HTTPD030I` every ~10 seconds and rebinding as
soon as TCPIP actually frees the port.

Fix: nothing to do but wait — no need to cancel and resubmit the started
task again, since that just restarts the same wait from scratch.

## Troubleshooting: `S106` ABEND ("MODULE ACCESSED GCC") on GCCCL compiles

Compiling C source (GCCCL proc, `PGM=GCC`) can abend `S106` even when the
source and JCL are otherwise fine and worked moments earlier. Confirmed
fix: add **`REGION=0M`** to the job card. Without it, the default region
is too small for the GCC compiler module under some load conditions and
it aborts with `S106`; with `REGION=0M` (no region limit) the same JCL and
source runs clean. All the JCL in this repo (`dslist.jcl`, `pdpgrep.jcl`,
`gcc.ps1`'s generated JCL) sets this on the job card — if you hand-write
a GCCCL job, always include it:

    //MYJOB    JOB (GCC),'MYJOB',CLASS=A,MSGCLASS=H,
    //         REGION=0M,USER=YOURID,PASSWORD=YOURPW
