//JPCOPY2  JOB (GCC),'COPY SYS2.EXEC',CLASS=A,MSGCLASS=H,
//         REGION=0M,USER=YOURID,PASSWORD=YOURPW
//* Copies all members of SYS2.EXEC into YOURID.EXEC (already exists,
//* per the DSLIST 'YOURID.*' run earlier).
//* CAVEAT: SYS2.EXEC is RECFM=U, LRECL=255. If YOURID.EXEC has
//* different attributes (e.g. FB/80, more typical for a CLIST/EXEC
//* library), IEBCOPY will reject this with an attribute-mismatch
//* message (something like IEB1035I or IDC-style incompatible attrs).
//* If that happens, paste the message back - the fix is to instead
//* allocate a new, separate library matching SYS2.EXEC's own
//* attributes (RECFM=U,LRECL=255,BLKSIZE=15050) and add THAT to your
//* SYSPROC concatenation alongside YOURID.EXEC, rather than merging.
//S1       EXEC PGM=IEBCOPY
//SYSPRINT DD SYSOUT=*
//IN       DD DSN=SYS2.EXEC,DISP=SHR
//OUT      DD DSN=YOURID.EXEC,DISP=SHR
//SYSIN    DD *
  COPY INDD=IN,OUTDD=OUT
/*
