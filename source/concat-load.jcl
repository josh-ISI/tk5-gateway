//CONCLOAD JOB (GCC),'LOAD CONCAT',CLASS=A,MSGCLASS=H,
//         REGION=0M,USER=YOURID,PASSWORD=YOURPW
//* Run this on the LIVE system, after hot-attaching the handoff tape
//* made by concat-dump.jcl on the clean 192.168.1.XXX instance:
//*   .\oper.ps1 'ATTACH 0480 3420 /path/to/concat-handoff.aws'
//* (no leading / - Hercules command, not MVS/JES2).
//* Reloads just the $CONCAT member into the existing SYS2.EXEC,
//* leaving the member you already got working alone.
//S1       EXEC PGM=IEBCOPY
//SYSPRINT DD SYSOUT=*
//IN       DD UNIT=480,DISP=(OLD,KEEP),LABEL=(1,NL)
//OUT      DD DSN=SYS2.EXEC,DISP=SHR
//SYSIN    DD *
  COPY INDD=IN,OUTDD=OUT
  SELECT MEMBER=($CONCAT)
/*
