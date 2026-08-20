//HERC01C  JOB (GCC),'BROKEN.C',CLASS=A,MSGCLASS=H,REGION=4096K,
//         USER=HERC01,PASSWORD=CUL8TR
//S1       EXEC GCCCLG
//COMP.SYSIN DD DATA,DLM='##'
#include <stdio.h>

int main(void)
{
    printf("this will not compile\n")   /* missing semicolon */
    return (0);
}
##
