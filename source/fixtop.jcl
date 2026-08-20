//HERC01F  JOB (GCC),'FIX PDPTOP S370',CLASS=A,MSGCLASS=Z,
//         USER=HERC01,PASSWORD=CUL8TR
//UPD      EXEC PGM=IEBUPDTE,PARM=MOD
//SYSPRINT DD SYSOUT=Z
//SYSUT1   DD DSN=HERC01.PDPCLIB.MACLIB,DISP=OLD
//SYSUT2   DD DSN=HERC01.PDPCLIB.MACLIB,DISP=OLD
//SYSIN    DD *
./ REPL NAME=PDPTOP,LIST=ALL
**********************************************************************
*                                                                    *
*  This macro was written by Paul Edwards                            *
*  Released to the public domain                                     *
*                                                                    *
**********************************************************************
**********************************************************************
*                                                                    *
*  PDPTOP - standard code for the start of every assembler file.     *
*                                                                    *
*  (S/370 configuration for MVS 3.8 / IFOX00 - was S/380)            *
*                                                                    *
**********************************************************************
*
* Is the GCC or IBM C calling convention being used?
*
         GBLC &COMP               Declare compiler switch
*
* What system are the compiles being done for?
*
         GBLC &ZSYS               Declare variable for system
*
* Do we want to support environments like MVS/XA needing step down?
*
         GBLC &STEPD              Declare variable for step-down
*
* Which OS are we targetting?
*
         GBLC &OS                 Declare compiler switch
*
* Are PUTs done in locate or move mode?
*
         GBLC &OUTM
*
&COMP    SETC 'GCC'               Indicate that this is for GCC
&ZSYS    SETC 'S370'              Define either S370, S380 or S390
&STEPD   SETC 'YES'               Indicate we want to step down
&OUTM    SETC 'M'                 Indicate move mode
&OS      SETC 'UNKNOWN'           Indicate that the OS is not known
*
* AMODE ANY / RMODE ANY removed - not valid for IFOX00 (S/370)
*
./ ENDUP
/*
