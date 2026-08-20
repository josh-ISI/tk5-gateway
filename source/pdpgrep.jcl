//PDPGREP  JOB (GCC),'PDPGREP',CLASS=C,REGION=0K,MSGCLASS=H,
//         USER=YOURID,PASSWORD=YOURPW
//* Compile/link/run PDPGREP against any dataset:
//*   INPUT  - the dataset (or member) to search, DISP=SHR
//*   OUTPUT - where matching lines get written; DISP=SHR works for a
//*            brand new PDS member (MVS creates it on first write)
//*   PARM   - the search phrase (spaces ok, gets rejoined from argv)
//*   Links against the stock PDPCLIB.NCALIB - no shim library needed.
//S1 EXEC GCCCL,
//  INFILE='YOURID.GCC.SOURCE(PDPGREP)',
//  OUTFILE='YOURID.TEST.LOADLIB(PDPGREP)',
//  LOPTS='MAP'
//LKED.SYSLIB DD DSN=PDPCLIB.NCALIB,DISP=SHR
//*
//S2 EXEC PGM=PDPGREP,PARM='printf'
//STEPLIB  DD DSN=YOURID.TEST.LOADLIB,DISP=SHR
//INPUT    DD DSN=YOURID.GCC.SOURCE(GCCTEST),DISP=SHR
//OUTPUT   DD DSN=YOURID.GCC.SOURCE(GREPOUT),DISP=SHR
//SYSIN    DD DUMMY
//SYSPRINT DD SYSOUT=*
//SYSTERM  DD SYSOUT=*
