-- workflows/recon.lua — composable recon pipeline (Lua, runtime-extensible)
--
-- Host helpers: binary(name, args, opts), parse_json(str), json_fetch(url).
-- Reads global `profile`, writes `_result`.

function run(profile)
  _result = { ok = true, steps = {} }
  log("recon:start domain=" .. tostring(profile.domain))

  -- 1. subfinder (passive subdomains), fall back to common hosts on empty.
  local subs = binary("subfinder", { "-silent", "-d", tostring(profile.domain) })
  local domains = {}
  for _, l in ipairs(subs.lines or subs.lines) do
    local s = (l ~= nil and tostring(l):gsub("%s+", "") or "")
    if #s > 0 then domains[#domains + 1] = s end
  end
  if #domains == 0 then
    domains = { profile.domain, "www." .. profile.domain, "api." .. profile.domain }
  end
  _result.steps.subdomains = domains

  -- 2. dnsx records, flattened by the host (returns "host ip TYPE" strings).
  local rec = profile.recordTypes or "A,AAAA,CNAME,MX,NS,TXT"
  _result.steps.dns = dns_records(domains, rec)

  -- 3. optional httpx probe.
  if profile.probe == true then
    local urls = {}
    for _, d in ipairs(domains) do urls[#urls + 1] = "https://" .. d end
    local hx = binary("httpx", { "-json", "-silent", "-title", "-status-code" },
      { timeoutMs = 60000, stdin = table.concat(urls, "\n") .. "\n" })
    local hs = {}
    for _, l in ipairs(hx.lines) do
      local obj = parse_json(l)
      if obj then hs[#hs + 1] = obj end
    end
    _result.steps.httpx = hs
  end

  _result.count = #domains
  return _result
end