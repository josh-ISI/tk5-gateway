/* demo.c - column-1 comment to prove the DLM trick works */
#include <stdio.h>

int main(void)
{
    int i;

    printf("gcc.ps1 wrapper test on MVS 3.8 TK5\n");
    for (i = 1; i <= 3; i++)
    {
        printf("  iteration %d of 3\n", i);
    }
    printf("done.\n");
    return (0);
}
