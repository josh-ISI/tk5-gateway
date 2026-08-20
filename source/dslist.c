#include <stdio.h>
#include <string.h>
static int wildmatch(const char *p, const char *s) {
    const char *star = NULL, *ss = s;
    while (*s != '\0') {
        if (*p == '?') { p++; s++; continue; }
        if (*p == *s) { p++; s++; continue; }
        if (*p == '*') { star = p; p++; ss = s; continue; }
        if (star != NULL) { p = star + 1; ss++; s = ss; continue; }
        return 0;
    }
    while (*p == '*') p++;
    return (*p == '\0');
}
int main(int argc, char *argv[]) {
    FILE *in;
    char line[256], pattern[100], dsn[80], *p;
    int i, len, hits, scanned;
    if (argc < 2) {
        printf("DSLIST: no pattern supplied via PARM\n");
        return (16);
    }
    pattern[0] = '\0';
    for (i = 1; i < argc; i++) {
        if (i > 1) {
            strncat(pattern, " ", sizeof(pattern) - strlen(pattern) - 1);
        }
        strncat(pattern, argv[i], sizeof(pattern) - strlen(pattern) - 1);
    }
    in = fopen("DD:INPUT", "r");
    if (in == NULL) {
        printf("DSLIST: fopen(DD:INPUT) failed\n");
        return (12);
    }
    printf("DSLIST '%s'\n", pattern);
    hits = 0;
    scanned = 0;
    while (fgets(line, sizeof(line), in) != NULL) {
        p = strstr(line, "NONVSAM");
        if (p == NULL) {
            continue;
        }
        if ((p - line) > 10) {
            continue;
        }
        p += 7;
        for (;;) {
            if (*p == ' ') { p++; continue; }
            if (*p == '-') { p++; continue; }
            break;
        }
        len = 0;
        for (;;) {
            if (len >= 78) break;
            if (p[len] == '\0') break;
            if (p[len] == ' ') break;
            if (p[len] == '\n') break;
            if (p[len] == '\r') break;
            len++;
        }
        if (len == 0) {
            continue;
        }
        strncpy(dsn, p, len);
        dsn[len] = '\0';
        scanned++;
        if (wildmatch(pattern, dsn)) {
            hits++;
            printf("%s\n", dsn);
        }
    }
    fclose(in);
    printf("DSLIST: %d match(es), %d dataset(s) cataloged\n",
           hits, scanned);
    return (hits > 0 ? 0 : 4);
}
