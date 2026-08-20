//HERC01X  JOB (GCC),'SYS2 PROC TEST',CLASS=A,MSGCLASS=Z,REGION=4096K,
//         USER=HERC01,PASSWORD=CUL8TR
//S1       EXEC GCCCLG
//COMP.SYSIN DD *
#include <stdio.h>

int main(void)
{
    printf("Testing the shipped SYS2.PROCLIB GCCCLG proc.\n");
    return (0);
}
/*
