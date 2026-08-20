//PROCLOAD JOB (GCC),'LOAD PROCLIB',CLASS=A,MSGCLASS=H,
//         REGION=0M,USER=HERC01,PASSWORD=CUL8TR
//* Run this on the LIVE system, after hot-attaching the handoff tape
//* made by proclib-dump.jcl on the clean 192.168.1.XXX instance:
//*   .\oper.ps1 -MvsHost 192.168.1.XXX 'ATTACH 0480 3420 /path/to/proclib-handoff.aws'
//* (no leading / - Hercules command, not MVS/JES2).
//* SYS1.PROCLIB itself was scratched entirely on the live system (not
//* just emptied of members), so this allocates it fresh first, using
//* the exact attributes confirmed from the clean 192.168.1.XXX copy:
//* RECFM=FB, LRECL=80, BLKSIZE=27920, 2 CYLS primary/0 secondary,
//* 15 directory blocks, on volume TK5RES (the system residence
//* volume - matches where the original lived, rather than letting
//* SYSDA place it on an arbitrary pack). Then reloads all 62 members
//* from the tape.
//* Runs as HERC01 to match the authority the Explorer's own utility
//* jobs use against this dataset (all its generated jobs run as
//* HERC01, not YOURID).
//S1       EXEC PGM=IEBCOPY
//SYSPRINT DD SYSOUT=*
//IN       DD UNIT=480,DISP=(OLD,KEEP),LABEL=(1,NL)
//OUT      DD DSN=SYS1.PROCLIB,DISP=(NEW,CATLG,DELETE),
//            UNIT=3390,VOL=SER=TK5RES,SPACE=(CYL,(2,0,15)),
//            DCB=(RECFM=FB,LRECL=80,BLKSIZE=27920,DSORG=PO)
//SYSIN    DD *
  COPY INDD=IN,OUTDD=OUT
/*
