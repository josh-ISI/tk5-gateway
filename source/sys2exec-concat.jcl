//CONCAT   JOB (GCC),'ADD CONCAT',CLASS=A,MSGCLASS=H,
//         REGION=0M,USER=YOURID,PASSWORD=YOURPW
//* Adds member $CONCAT to SYS2.EXEC directly from inline JCL data -
//* bypasses the WEBADM Explorer save's ~4KB limit (silently corrupts
//* or outright fails on anything this size). Submit via
//* submit-job.ps1 (card reader, port 3505), NOT the web console.
//* Uses DD DATA,DLM='##' instead of plain DD * because the source
//* has /* comments starting in column 1, which would otherwise
//* prematurely end a plain DD * inline data stream.
//* Source below is pasted EXACTLY as supplied - not corrected.
//S1       EXEC PGM=IEBGENER
//SYSPRINT DD SYSOUT=*
//SYSUT1   DD DATA,DLM='##'
/******************************************************************/
/*                                                                */
/*    NAME: SYS2.EXEC($CONCAT)                                    */
/*                                                                */
/*    DESC: ALLOCATE USER DATASETS TO a DDNAME concatenation      */
/*          The $CONCAT REXX exec takes 3 parameters              */
/*                                                                */
/*          PARM1 (REQUIRED)   : THE DDNAME TO BE ACTED UPON      */
/*                               IF THE DDNAME IS NOT ALLOCATED,  */
/*                               THE CONCAT REQUEST WILL BE       */
/*                               TREATED AS AN ALLOC REQUEST      */
/*          PARM2 (REQUIRED)   : THE DSNAME TO BE ADDED. MUST BE  */
/*                               GIVEN AS A FULLY QUALIFIED       */
/*                               UNQUOTED DSNAME                  */
/*                               IF THE DATASET DOES NOT EXIST,   */
/*                               THE CONCAT REQUEST WILL BE       */
/*                               SILENTLY IGNORED                 */
/*          PARM3 (OPTIONAL)   : POSTION WITHIN THE CONCATENATION */
/*                                                                */
/*                               "BOTTOM"  MEANS AT THE END OF    */
/*                               THE CONCATENTAION                */
/*                                                                */
/*                               "TOP" PLACES THE DATASET AT      */
/*                               BEGINNING OF THE CONCATENATION   */
/*                               THIS IS THE DEFAULT              */
/*                                                                */
/*                               "N", where N is a number WITH    */
/*                               N > 0 MEANS THE Dataset name     */
/*                               will BE PLACED AT POSITION N     */
/*                               IN THE CONCATENATION             */
/*                               IF N > NUMBER OF DATASETS IN THE */
/*                               CONCATENATION, THIS DEFAULTS     */
/*                               TO "BOTTOM"                      */
/*                               IF N < 1 this defaults to "TOP"  */
/*                                                                */
/*                               "TOP" AND "BOTTOM" CAN BE        */
/*                               ABBREVIATED                      */
/*                                                                */
/*                                                                */
/*   EXAMPLE:   $CONCAT ISPPLIB VOLKER.TEST.PLIB                  */
/*              $CONCAT SYSPROC SYS2.TEST.CMDPROC BOT             */
/*              $CONCAT SYSEXEC PRIVATE.REXX.PROC 3               */
/*                                                                */
/*                                                                */
/******************************************************************/
 ARG The_File The_Dsn The_Pos
 SIGNAL ON NOVALUE
 CALL Initialize
 /*----------------------------------------------------------------*/
 /*                                                                */
 /* If no DSN was given, or the given DSN does not exist, just     */
 /* return to the caller, no error msg will be shown, no return    */
 /* code will be set                                               */
 /*                                                                */
 /*----------------------------------------------------------------*/
 IF Length(The_DSN) = 0 ,
  ] ^EXISTS(QUOTED(The_DSN)) THEN RETURN
 /*----------------------------------------------------------------*/
 /*                                                                */
 /* Check The_File, The_Dsn and The_pos for plausibility.          */
 /* if something doesn't make sense, show the syntax diagram       */
 /* and get out                                                    */
 /*                                                                */
 /*----------------------------------------------------------------*/
 IF ArgCheck()^=0 THEN
    DO
       CALL DISPLAY_SYNTAX
       CALL GetOut
    END
 /* END IF ArgCheck()^=0  */
 /*----------------------------------------------------------------*/
 /*                                                                */
 /*  use RXLIB LISTALC() function to get a list of allocated files */
 /*  and place the result into 2 stems:                            */
 /*     DDNAMEs go into ListAlcDDN.                                */
 /*     DSNAMES go into ListAlcDSN.                                */
 /*                                                                */
 /*----------------------------------------------------------------*/
 NumFiles=ListAlc("NOPRINT")
 /*----------------------------------------------------------------*/
 /*                                                                */
 /*  Loop through the allocated DDNAMEs and search for the         */
 /*  DDNAME to be processed (The_File).  If found,  set            */
 /*  a flag and leave the loop.  The variable I will then          */
 /*  contain the entry number for The_file, i.e. ListALCDDN.I      */
 /*  contains The_File, and ListAlcDSN.I contains a dsname         */
 /*                                                                */
 /*----------------------------------------------------------------*/
 DO I = 1 TO NumFiles
    IF ListAlcDDN.i = LEFT(The_File,8) THEN
       DO
          Found = true
          LEAVE
       END
    /* END IF ListAlcDDN.i = LEFT(The_File,8) */
 END
 DROP cmd.
 c = 0 ; cmd.c = 0                /* Number of commands to be run   */
 IF Found THEN
    DO
    /*-------------------------------------------------------------*/
    /*                                                             */
    /* We found a matching (allocated) DDNMAE, this means that we  */
    /* will have to deallocate that fiel later                     */
    /* Increase the command cound and add a command to the         */
    /* command table                                               */
    /*                                                             */
    /*-------------------------------------------------------------*/
       c=c+1; cmd.c="FREE FILE(" ]] The_File ]] ")"
    /*-------------------------------------------------------------*/
    /*                                                             */
    /* Continue to loop through the list of allocated files.       */
    /* A non-blank DDNAME means that we can leave the loop, all    */
    /* DSNAMEs for the concatenation have been found.              */
    /* The Variable K-1 is now the entry number for the last       */
    /* DSNAME in the concatenation                                 */
    /*                                                             */
    /*-------------------------------------------------------------*/
       DO k = i+1 TO NumFiles
          IF ListAlcDDN.k ^= "  " THEN LEAVE
       END
    /*-------------------------------------------------------------*/
    /*                                                             */
    /* Scan through all the entries belonging to The_File          */
    /* concatenation.  If the requsted The_Dsn is found, i.e.      */
    /* already allocated, ignore it to avoid a duplicate DSNAME    */
    /* in the concatenation                                        */
    /* Otherwise, place the DSNAME into the DSN. stem              */
    /* Increase the variable D for every DSNAME we find            */
    /*                                                             */
    /*-------------------------------------------------------------*/
       DROP dsn.
       d = 0 ; dsn.0 = d    /* Number of DSNs to be processed */
       DO n=I to K-1
          IF ListAlcDSN.n = The_Dsn THEN ITERATE
          d=d+1;dsn.0=d;dsn.d=ListAlcDSN.n
       END
    /*-------------------------------------------------------------*/
    /*                                                             */
    /* If there were no DSNAMES, just get out without a msg        */
    /*                                                             */
    /*-------------------------------------------------------------*/
       IF Dsn.0=0 THEN RETURN
    /*-------------------------------------------------------------*/
    /*                                                             */
    /* Loop through all the DSNAMES, create a list of the          */
    /* DSNs to be concatenated, and place The_Dsn into             */
    /* the correct position.  Note that for TSO commands the       */
    /* DSNAMEs need to be in single quotest, thus we provide them  */
    /*                                                             */
    /*-------------------------------------------------------------*/
       DsnSeq = ""
       DO d=1 TO Dsn.0
          IF The_Loc = d THEN
             DO
                DsnSeq = DsnSeq ]] QUOTED(The_Dsn) ]] ","
             END
          /* END IF The_Loc = d */
          DsnSeq = DsnSeq  ]] QUOTED(dsn.d)  ]] ","
       END
       IF The_Loc > Dsn.0 THEN
          DO
            DsnSeq = DsnSeq  ]] QUOTED(The_Dsn) ]] ","
          END
       /* END IF The_Loc > Dsn.0 */
    /*-------------------------------------------------------------*/
    /*                                                             */
    /* Remove the trailing comma from the DsnSeq                   */
    /*                                                             */
    /*-------------------------------------------------------------*/
       DsnSeq = SUBSTR(DsnSeq,1,LENGTH(DsnSeq)-1)
    END
 ELSE
    /*-------------------------------------------------------------*/
    /*                                                             */
    /* If The_File was not found in the allocation list, the concat*/
    /* request is just a simple allocate request, i.e. the DsnSeq  */
    /* contains only one DSNAME (in quotes, again)                 */
    /*                                                             */
    /*-------------------------------------------------------------*/
    DO
       DsnSeq = QUOTED(The_Dsn)
    END
 /* END IF Found */
 /*----------------------------------------------------------------*/
 /*                                                                */
 /* Now create the ALLOCATE command for the new concatenation      */
 /*                                                                */
 /*----------------------------------------------------------------*/
 c=c+1; cmd.0=c; cmd.c = "ALLOC  DD(" ]] The_File ]] ") " ,
                            ]] "DSN(" ]] DsnSeq   ]] ") SHR"
 /*----------------------------------------------------------------*/
 /*                                                                */
 /* Run FREE/ALLOC commands                                        */
 /*                                                                */
 /*----------------------------------------------------------------*/
 DO c = 1 TO cmd.0
 /*   SAY cmd.c     */
    ADDRESS "TSO" cmd.c
 END
 RETURN
 NOVALUE:
    SAY "Uninitialized variable in Line" SIGL
    SAY SOURCELINE(SIGL)
    CALL PAUSE
    EXIT 20
 INITIALIZE:
    GLOBAL=""
    GLOBAL=GLOBAL "True"
    GLOBAL=GLOBAL "False"
    GLOBAL=GLOBAL "The_Loc"
    GLOBAL=GLOBAL "RxName"
    PARSE SOURCE . . RxName .
    True=(1=1)
    False=(1=0)
    Found=False
    DsnList = ""
    RETURN
 ARGCHECK:
    IF LENGTH(The_File) = 0 ,
     ] LENGTH(The_File) > 8 ,
     ] DATATYPE(SUBSTR(The_File,1),"N") THEN
      DO
        SAY "Filename invalid or missing"
        RETURN 12
      END
    /* END IF LENGTH(The_File) = 0 */
    SELECT
       WHEN LENGTH(The_Pos)=0 THEN The_Loc=1
       WHEN DATATYPE(The_Pos,"N") THEN The_Loc=The_Pos
       WHEN ABBREV("BOTTOM",The_Pos,1) THEN The_Loc=999
       WHEN ABBREV("TOP",The_Pos,1) THEN The_Loc=1
       OTHERWISE
          DO
             SAY "Position" The_Pos " is invalid"
             RETURN 12
          END
    END /* SELECT */
    RETURN 0
 QUOTED: PROCEDURE EXPOSE (GLOBAL)
    ARG dsn
    IF SUBSTR(dsn,1,1) = "'" THEN RETURN dsn
                             ELSE RETURN "'" ]] dsn ]] "'"
 PAUSE: PROCEDURE
    PULL DUMMY
    RETURN
 GETOUT: PROCEDURE
    CALL PAUSE
    EXIT
 DISPLAY_SYNTAX: PROCEDURE EXPOSE (GLOBAL)
    SAY "Syntax Error!, invalid Arguments passed.  Correct Syntax is:"
    SAY "  "
    SAY "                                    +- TOP -------+ "
    SAY "                                    ]             ] "
    SAY " >--- " ]] CENTER(RxName,8) ,
                 ]] " -- ddname-- dsname --+-------------] "
    SAY "                                    ]             ] "
    SAY "                                    +- BOTTOM ----] "
    SAY "                                    ]             ] "
    SAY "                                    +- location  -+ "
    SAY " "
    SAY " Where 'location' is the position (>=1) within then"
    SAY " Concatenation.   'TOP' and 'BOT' can be upper or "
    SAY " lower case and can be abbreviated.               "
    SAY " "
    SAY "Example:"
    SAY " "
    SAY "  " ]]  RIGHT(RxName,8) ]] " ISPPLIB MY.PRIVATE.ISPPLIB"
    SAY " "
    SAY "  " ]]  RIGHT(RxName,8) ]] " SYSPROC SECRET.CMDPROC BOT"
    SAY " "
    SAY "  " ]]  RIGHT(RxName,8) ]] " SYSEXEC TEST.EXEC 2"
    SAY " "
    SAY " "
    RETURN
##
//SYSUT2   DD DSN=SYS2.EXEC($CONCAT),DISP=SHR
//SYSIN    DD DUMMY
