//DSLIST   JOB (GCC),'DSLIST',CLASS=A,MSGCLASS=H,
//         REGION=0M,USER=YOURID,PASSWORD=YOURPW
//* Wildcard dataset-name search across the whole catalog, MVS 3.8
//* doesn't have z/OS's Catalog Search Interface so this does it in
//* two parts: LISTCAT dumps every catalog entry to a temp dataset,
//* then DSLIST.c reads that dump and wildcard-matches full names
//* against the PARM pattern (* = any run of chars, ? = one char).
//* Examples: PARM='HERC01.*'   PARM='*.SOURCE'   PARM='*.GCC.*'
//* A bare LISTCAT only dumps the master catalog (SYS1.MCAT.TK5).
//* YOURID's own datasets live in the separate user catalog
//* SYS1.UCAT.TSO, so that gets listed explicitly too below.
//S1 EXEC GCCCL,
//  INFILE='YOURID.GCC.SOURCE(DSLIST)',
//  OUTFILE='YOURID.TEST.LOADLIB(DSLIST)',
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
//S3 EXEC PGM=DSLIST,PARM='YOURID.*'
//STEPLIB  DD DSN=YOURID.TEST.LOADLIB,DISP=SHR
//INPUT    DD DSN=&&CATDUMP,DISP=(OLD,DELETE)
//SYSIN    DD DUMMY
//SYSPRINT DD SYSOUT=*
//SYSTERM  DD SYSOUT=*
