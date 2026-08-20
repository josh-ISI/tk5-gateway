-- LUA - WTEST : probe io.open() write access against real MVS datasets
if (http and http.print) then
   http.oprint = print
   print = http.print
end

local function tryopen(desc, dsn, mode)
  print("Trying " .. desc .. ": io.open('" .. dsn .. "','" .. mode .. "')")
  local f, err = io.open(dsn, mode)
  if f then
    print("  open OK")
    local ok, werr = pcall(function() f:write("LUA WRITE TEST\n") end)
    if ok then
      print("  write() OK")
    else
      print("  write() FAILED: " .. tostring(werr))
    end
    local cok, cerr = pcall(function() f:close() end)
    if cok then
      print("  close() OK")
    else
      print("  close() FAILED: " .. tostring(cerr))
    end
  else
    print("  open FAILED: " .. tostring(err))
  end
  print("-------------------------------")
end

tryopen("plain dsn(member)",        "HERC01.TEST.ASM(LUATEST)",   "w")
tryopen("quoted dsn(member)",       "'HERC01.TEST.ASM(LUATEST)'", "w")
tryopen("MVS //-quoted dsn(member)","//'HERC01.TEST.ASM(LUATEST)'","w")
tryopen("plain PS-style",           "HERC01.TEST.CNTL",           "w")
