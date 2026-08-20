//DSLINK   JOB (GCC),'DSLIST INSTALL',CLASS=A,MSGCLASS=H,
//         REGION=0M,USER=YOURID,PASSWORD=YOURPW
//* Installs DSLIST as a system-wide command: compiles/links straight
//* into SYS1.LINKLIB, which is already part of every LNKLST search,
//* so afterward "DSLIST 'pattern'" works from ANY TSO command line or
//* batch job with NO STEPLIB needed. S3 below proves this by running
//* it with no STEPLIB at all, right after the link.
//* NOTE: SYS1.LINKLIB is a shared system library - this needs update
//* authority on it (RAKF may deny this the same way it denied writes
//* to PDPCLIB.LINKLIB/HTTPD.BREXX earlier - watch for S913). Rerunning
//* this job just replaces the DSLIST member, it doesn't grow the
//* directory further.
//S1 EXEC GCCCL,
//  INFILE='YOURID.GCC.SOURCE(DSLIST)',
//  OUTFILE='SYS1.LINKLIB(DSLIST)',
//  LOPTS='MAP'
//LKED.SYSLIB DD DSN=PDPCLIB.NCALIB,DISP=SHR
//*
//S2      EXEC PGM=IDCAMS
//SYSPRINT DD DSN=&&CATDUMP,DISP=(NEW,PASS,DELETE),
//            UNIT=SYSALLDA,SPACE=(TRK,(50,50)),
//            DCB=(LRECL=133,BLKSIZE=13300,RECFM=FB)
//SYSIN    DD *
  LISTCAT
  LISTCAT CATALOG(SYS1.UCAT.TSO)
/*
//*
//* No STEPLIB here on purpose - proves DSLIST resolves via LNKLST.
//S3 EXEC PGM=DSLIST,PARM='YOURID.*'
//INPUT    DD DSN=&&CATDUMP,DISP=(OLD,DELETE)
//SYSIN    DD DUMMY
//SYSPRINT DD SYSOUT=*
//SYSTERM  DD SYSOUT=*
