/* BREXX - WEBSUB probe - test internal reader submit */
call httpsay 'HTTP/1.0 200 OK'
call httpsay 'Content-Type: text/plain'
call httpsay ''
jcl.1 = "//WEBTESTX JOB (WEB),'WEB SUB TEST',CLASS=A,MSGCLASS=H"
jcl.2 = "//S1       EXEC PGM=IEFBR14"
jcl.0 = 2
address TSO
xx = msg('off')
"ALLOC FI(WEBRDR) SYSOUT(A) WRITER(INTRDR) RECFM(F,B) LRECL(80)"
call httpsay 'alloc rc='rc
r2 = writeall('WEBRDR','JCL.','DDN')
call httpsay 'writeall='r2
"FREE FI(WEBRDR)"
call httpsay 'free rc='rc
