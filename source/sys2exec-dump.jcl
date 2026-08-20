//SYS2DUMP JOB (GCC),'DUMP SYS2EXEC',CLASS=A,MSGCLASS=Z,
//         REGION=0M,USER=HERC01,PASSWORD=CUL8TR
//* Run this on the TEMPORARY Hercules instance booted from the
//* pristine mvs-tk5 copy (NOT the live system). Dumps SYS2.EXEC to
//* tape in IEBCOPY unload format - preserves RECFM=U (and everything
//* else) exactly, unlike any text-based copy, so it reloads byte-
//* for-byte identical on the live system afterward.
//* Attach the tape device on the temp instance first, e.g.:
//*   ATTACH 0480 3420 /home/youruser/sys2exec-handoff.aws
//S1       EXEC PGM=IEBCOPY
//SYSPRINT DD SYSOUT=*
//IN       DD DSN=SYS2.EXEC,DISP=SHR
//OUT      DD UNIT=480,DISP=(NEW,KEEP),LABEL=(1,NL)
//SYSIN    DD *
  COPY INDD=IN,OUTDD=OUT
/*
