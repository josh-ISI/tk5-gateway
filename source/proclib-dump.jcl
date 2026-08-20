//PROCDUMP JOB (GCC),'DUMP PROCLIB',CLASS=A,MSGCLASS=H,
//         REGION=0M,USER=HERC01,PASSWORD=CUL8TR
//* Run this on the CLEAN instance at 192.168.1.XXX. Dumps the WHOLE
//* SYS1.PROCLIB to tape in IEBCOPY unload format - byte-for-byte,
//* since the live system's copy was scratched entirely (whole dataset
//* gone, not just its members) after a rename attempt.
//* MSGCLASS=H (not Z) - a clean/stock instance won't have device 00F
//* converted to the sockdev printer the live system uses, so capture
//* via submit-job.ps1 relies on the HTTPD REST path (port 8080)
//* instead, which any stock TK5 instance has by default.
//* Attach the tape device first, e.g.:
//*   .\oper.ps1 -MvsHost 192.168.1.XXX 'ATTACH 0480 3420 /home/youruser/proclib-handoff.aws'
//S1       EXEC PGM=IEBCOPY
//SYSPRINT DD SYSOUT=*
//IN       DD DSN=SYS1.PROCLIB,DISP=SHR
//OUT      DD UNIT=480,DISP=(NEW,KEEP),LABEL=(1,NL)
//SYSIN    DD *
  COPY INDD=IN,OUTDD=OUT
/*
