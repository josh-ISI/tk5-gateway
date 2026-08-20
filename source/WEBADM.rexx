/* BREXX - WEBADM - write-side backend for the TK5 web console       */
/* Install as member WEBADM in the HTTPD CGI library HTTPD.BREXX      */
/* (served by HTTPREXX as /rexx/WEBADM).                              */
/*                                                                    */
/* Actions (POST form fields; ?action=ping for health check):        */
/*   ping                                    -> health check          */
/*   save   dsn member count line1..lineN    -> rewrite member / PS   */
/*   submit count line1..lineN               -> submit JCL to INTRDR  */
/*                                                                    */
/* Uses only BREXX interpreter built-ins (open/read/write/close/eof) */
/* because the HTTPD started task has no RXLIB DD, so RXLIB functions */
/* like readall/writeall are NOT available here. Idioms copied from   */
/* BREXX.V2R5M3.RXLIB(READALL/WRITEALL): open(f,'RT'/'WT'), DSN names */
/* quoted, DD names bare, open returns <0 on failure.                 */
nl = '15'x
call httpsay 'HTTP/1.0 200 OK'
call httpsay 'Content-Type: text/plain'
call httpsay ''

/* ---- load request variables from HTTPVARS DD into the V. stem ---- */
V. = ''
R.0 = 0
fh = open('HTTPVARS','RT')
if fh >= 0 then do
  R.1 = read(fh)
  do i = 2 until eof(fh)
    R.i = read(fh)
  end
  if R.i = '' then i = i - 1
  R.0 = i
  call close fh
end
do k = 1 to R.0
  call parseVar R.k
end

action = V.QUERY_action
if action = '' then action = V.POST_action
action = translate(strip(action))

select
  when action = 'PING'   then call httpsay 'WEBADM ok'
  when action = 'SAVE'   then call doSave
  when action = 'SUBMIT' then call doSubmit
  when action = 'DUMP'   then do
    call httpsay 'records='R.0
    do d = 1 to R.0
      call httpsay d': 'R.d
    end
  end
  otherwise call httpsay 'ERR unknown action "'action'"'
end
exit

/* Strip the leading '~' guard the client adds so a line's real first  */
/* character (e.g. the '/' of a JCL '//' card) is never the first byte  */
/* of the value - the HTTPD form decoder collapses a leading '//'.      */
deSentinel: procedure
  s = arg(1)
  if left(s,1) = '~' then s = substr(s,2)
return s

/* ------------------------------------------------------------------ */
parseVar:
  rec = arg(1)
  eq = pos('=',rec)
  if eq = 0 then return
  nm = translate(strip(left(rec,eq-1)))   /* upper: REXX tails are upper */
  vv = substr(rec,eq+1)
  if left(vv,1)  = '"' then vv = substr(vv,2)
  if right(vv,1) = '"' then vv = left(vv,length(vv)-1)
  V.nm = vv
return

/* ------------------------------------------------------------------ */
doSave:
  dsn = V.POST_dsn
  mbr = V.POST_member
  cnt = V.POST_count
  if datatype(cnt) <> 'NUM' then do
    call httpsay 'ERR bad count'
    return
  end
  if dsn = '' then do; call httpsay 'ERR no dsn'; return; end
  if mbr <> '' then tgt = "'"dsn"("mbr")'"
               else tgt = "'"dsn"'"
  fo = open(tgt,'WT')
  if fo < 0 then do; call httpsay 'ERR open 'tgt' rc='fo; return; end
  do i = 1 to cnt
    vn = 'POST_LINE'i
    call write fo, deSentinel(V.vn), nl
  end
  call close fo
  call httpsay 'SAVE rc=0 wrote 'cnt' lines to 'tgt
return

/* ------------------------------------------------------------------ */
doSubmit:
  cnt = V.POST_count
  if datatype(cnt) <> 'NUM' then do
    call httpsay 'ERR bad count'
    return
  end
  /* stage the JCL into a scratch member (proven open/write path), then   */
  /* submit that dataset - BREXX SUBMIT() takes a dsname like TSO SUBMIT. */
  /* Dedicated staging dataset, deliberately NOT HERC01.JCL: that's the   */
  /* user's own hand-edited library, and a 3270 edit session holding a    */
  /* member there blocks this open (rc=-1) until they close it - */
  tgt = "'HERC01.WEBSTG(WEBJOB)'"
  fo = open(tgt,'WT')
  if fo < 0 then do; call httpsay 'ERR stage open 'tgt' rc='fo; return; end
  jn = ''
  do i = 1 to cnt
    vn = 'POST_LINE'i
    ln = deSentinel(V.vn)
    call write fo, ln, nl
    if i = 1 then parse var ln '//' jn ' '
  end
  call close fo
  signal on syntax name subErr
  r = submit(tgt)
  call httpsay 'SUBMIT rc='r' job='jn' ('cnt' cards) - see Jobs tab'
  return
  subErr:
  call httpsay 'ERR SUBMIT() failed rc='rc' line 'sigl
  return
  fo = open('WEBRDR','WT')
  call httpsay 'submit: open rc='fo
  if fo < 0 then do; address TSO "FREE FI(WEBRDR)"; return; end
  jn = ''
  do i = 1 to cnt
    vn = 'POST_LINE'i
    ln = deSentinel(V.vn)
    call write fo, ln, nl
    if i = 1 then parse var ln '//' jn ' '
  end
  call close fo
  address TSO "FREE FI(WEBRDR)"
  call httpsay 'SUBMIT rc=0 job='jn' ('cnt' cards) - see Jobs tab'
return
