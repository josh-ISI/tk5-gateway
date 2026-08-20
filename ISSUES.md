# TK5-tools — working notes

## Current host

The MVS 3.8 system is currently at **192.168.1.XXX**.

The README and several scripts/JCL (`rexx.ps1` default, `auth-proxy/*`,
`source/concat-dump.jcl`, `source/proclib-dump.jcl`, `source/proclib-load.jcl`,
etc.) still hardcode the older address **192.168.1.XXX** — treat that as stale
unless told otherwise, and confirm the live IP before assuming either value.

## Critical incident — do not regress

A bug in the console's Explorer copy/rename/delete path **wiped
`SYS1.PROCLIB`** (fully scratched, not just emptied). Root cause: temporary
datasets used during copy/rename were hardcoded to `20 tracks / 20 directory
blocks` regardless of the source dataset's actual size, silently truncating
larger datasets.

Fix applied in commit `3a6b0c5` ("Fix Explorer copy/rename/delete..."):
temp dataset allocations bumped to `CYL(10,10,100)` everywhere, and
rename/copy now verify the save succeeded *before* deleting the original.
Recovery required rebuilding `SYS1.PROCLIB` and `SYS2.EXEC` from a clean
instance via tape handoff (see `source/proclib-dump.jcl` / `proclib-load.jcl`,
`source/concat-dump.jcl` / `concat-load.jcl`).

**When touching any copy/rename/delete logic in the console or WEBADM
backend: always size temp/scratch datasets from the source, and never
delete/overwrite an original before confirming the copy succeeded.**
