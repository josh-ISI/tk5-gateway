//HERC01C  JOB (GCC),'MY C PROGRAM',CLASS=A,MSGCLASS=Z,REGION=4096K,
//         USER=HERC01,PASSWORD=CUL8TR
//*
//*  Compile-link-go via the shipped SYS2.PROCLIB(GCCCLG) proc.
//*  Put your C source between the DD * and /* lines, then:
//*      .\submit-job.ps1 c-template.jcl
//*  Output (listing + program stdout) lands in c-template.out.
//*
//S1       EXEC GCCCLG
//COMP.SYSIN DD *
#include <stdio.h>

int main(void)
{
    printf("Hello from C on MVS 3.8!\n");
    return (0);
}
/*
