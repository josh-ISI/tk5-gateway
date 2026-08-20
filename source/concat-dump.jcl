//CONCDUMP JOB (GCC),'DUMP CONCAT',CLASS=A,MSGCLASS=Z,
//         REGION=0M,USER=HERC01,PASSWORD=CUL8TR
//* Run this on the CLEAN instance at 192.168.1.XXX (or wherever the
//* real, correct $CONCAT lives). Dumps just that one member of
//* SYS2.EXEC to tape in IEBCOPY unload format - byte-for-byte, so
//* the "|" characters that keep getting mangled to "]" via manual
//* 3270 copy-paste survive intact this time.
//* Attach the tape device first, e.g.:
//*   ATTACH 0480 3420 /home/youruser/concat-handoff.aws
//S1       EXEC PGM=IEBCOPY
//SYSPRINT DD SYSOUT=*
//IN       DD DSN=SYS2.EXEC,DISP=SHR
//OUT      DD UNIT=480,DISP=(NEW,KEEP),LABEL=(1,NL)
//SYSIN    DD *
  COPY INDD=IN,OUTDD=OUT
  SELECT MEMBER=($CONCAT)
/*
