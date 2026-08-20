HELLO    CSECT
         STM   14,12,12(13)      SAVE CALLER REGISTERS
         BALR  12,0              ESTABLISH BASE
         USING *,12
         ST    13,SAVEAREA+4     CHAIN SAVE AREAS
         LA    13,SAVEAREA
         WTO   'HELLO FROM IFOX00 VIA ASM.PS1'
         WTO   'ASSEMBLED, LINKED AND RUN FROM A PC'
         L     13,SAVEAREA+4     RESTORE
         LM    14,12,12(13)
         SR    15,15             RC=0
         BR    14
SAVEAREA DS    18F
         END   HELLO
