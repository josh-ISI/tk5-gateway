//SYS2LOAD JOB (GCC),'LOAD SYS2EXEC',CLASS=A,MSGCLASS=H,
//         REGION=0M,USER=YOURID,PASSWORD=YOURPW
//* Run this on the LIVE system, after hot-attaching the handoff tape
//* made by sys2exec-dump.jcl on the temporary instance:
//*   .\oper.ps1 'ATTACH 0480 3420 /home/youruser/sys2exec-handoff.aws'
//* (no leading / - this is a Hercules command, not MVS/JES2, so it
//* does NOT get the / prefix oper.ps1 normally needs for those).
//* Reloads SYS2.EXEC's members from the unload tape - SYS2.EXEC
//* itself still exists (only its members were deleted), so this is
//* DISP=SHR, not a fresh allocation.
//S1       EXEC PGM=IEBCOPY
//SYSPRINT DD SYSOUT=*
//IN       DD UNIT=480,DISP=(OLD,KEEP),LABEL=(1,NL)
//OUT      DD DSN=SYS2.EXEC,DISP=SHR
//SYSIN    DD *
  COPY INDD=IN,OUTDD=OUT
/*
