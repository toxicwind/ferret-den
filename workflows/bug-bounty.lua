-- workflows/bug-bounty.lua — full bug bounty pipeline (Lua, runtime).
-- Host helpers: binary(name, args, opts), dns_records(domains, types),
--              parse_json(str), log(...). Reads `profile`, writes `_result`.
--
-- Pipeline: subfinder -> dnsx(records) -> httpx(probe) -> naabu(ports) -> nuclei(optional, gated).

function run(profile)
  _result = { ok = true, steps = {} }
  local domain = tostring(profile.domain or profile.target)
  log("bug-bounty:start domain=" .. domain)

  -- 1. subfinder
  local subs = binary("subfinder", { "-silent", "-d", domain })
  local domains = {}
  for _, l in ipairs(subs.lines) do
    local s = tostring(l):gsub("%s+", "")
    if #s > 0 then domains[#domains + 1] = s end
  end
  if #domains == 0 then
    domains = { domain, "www." .. domain, "api." .. domain, "auth." .. domain }
  end
  _result.steps.subdomains = domains

  -- 2. dnsx records (host -> flat "host ip TYPE")
  local rec = profile.recordTypes or "A,AAAA,CNAME,MX,NS,TXT"
  _result.steps.dns = dns_records(domains, rec)

  -- 3. httpx probe (no crawl unless asked; bounded to top N)
  local n = math.min(#domains, profile.maxProbe or 25)
  local urls = {}
  for i = 1, n do urls[i] = "https://" .. domains[i] end
  local hx = binary("httpx", { "-silent", "-title", "-status-code", "-tech-detect", "-cdn" },
    { timeoutMs = 120000, stdin = table.concat(urls, "\n") .. "\n" })
  _result.steps.httpx = hx.lines

  -- 4. naabu ports on live hosts (bounded, top N)
  _result.steps.ports = {}
  local hosts = {}
  for i = 1, n do hosts[i] = domains[i] end
  local na = binary("naabu", { "-silent", "-p", profile.ports or "80,443,8080,8443,3000,5000,8000" },
    { timeoutMs = 120000, stdin = table.concat(hosts, "\n") .. "\n" })
  for _, l in ipairs(na.lines) do
    local host = nil
    local port = nil
    local m = string.match(l, "^(.-):(%d+)$")
    if m then
      local s = m:match("[%w%.%-]+(?:%.[%w%-]+)+")
      local pn = m:match(":(%d+)$")
      if s and pn then
        _result.steps.ports[#_result.steps.ports + 1] = s .. ":" .. pn
      end
    end
  end

  -- 5. optional nuclei (only when profile.scan == true; gated upstream anyway)
  if profile.scan == true then
    local tgt = {}
    for i = 1, n do tgt[i] = "https://" .. domains[i] end
    local nu = binary("nuclei", { "-silent", "-jsonl" },
      { timeoutMs = 600000, stdin = table.concat(tgt, "\n") .. "\n" })
    local findings = {}
    for _, l in ipairs(nu.lines) do
      local o = parse_json(l)
      if o and o["template-id"] then findings[#findings + 1] = o["template-id"] end
    end
    _result.steps.nuclei = findings
  end

  _result.count = #domains
  return _result
end