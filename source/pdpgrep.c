/* PDPGREP.c - search any DD-allocated dataset for a substring.
   PARM supplies the search phrase (words rejoined with single spaces,
   since MVS splits PARM on blanks before handing it to argv).
   Reads DD:INPUT line by line; matching lines are printed to SYSPRINT
   (with line numbers) and also written out to DD:OUTPUT, so this
   demonstrates real dataset read AND write via PDPCLIB stdio. */
#include <stdio.h>
#include <string.h>

int main(int argc, char *argv[])
{
    FILE *in, *out;
    char line[256];
    char needle[100];
    int lineno, hits, i;

    if (argc < 2)
    {
        printf("PDPGREP: no search string supplied via PARM\n");
        return (16);
    }

    needle[0] = '\0';
    for (i = 1; i < argc; i++)
    {
        if (i > 1)
        {
            strncat(needle, " ", sizeof(needle) - strlen(needle) - 1);
        }
        strncat(needle, argv[i], sizeof(needle) - strlen(needle) - 1);
    }

    in = fopen("DD:INPUT", "r");
    if (in == NULL)
    {
        printf("PDPGREP: fopen(DD:INPUT) failed\n");
        return (12);
    }

    out = fopen("DD:OUTPUT", "w");
    if (out == NULL)
    {
        printf("PDPGREP: fopen(DD:OUTPUT) failed\n");
        fclose(in);
        return (12);
    }

    printf("PDPGREP searching for \"%s\"\n", needle);

    lineno = 0;
    hits = 0;
    while (fgets(line, sizeof(line), in) != NULL)
    {
        lineno++;
        if (strstr(line, needle) != NULL)
        {
            hits++;
            printf("%5d: %s", lineno, line);
            fputs(line, out);
        }
    }

    fclose(in);
    fclose(out);

    printf("PDPGREP: %d match(es) out of %d line(s) scanned\n", hits, lineno);
    return (hits > 0 ? 0 : 4);
}
