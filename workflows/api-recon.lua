-- workflows/api-recon.lua — universal OpenAI-compatible /v1 endpoint recon (Lua).
-- Uses json_fetch(url, {method,headers,body,timeoutMs}) (wasmoon awaitable).
-- Probes /v1/models, chat round-trip, embeddings, and reports status/latency.
-- Reads `profile` {baseUrl, apiKey, model, chatProbePrompt}; writes `_result`.

local function base(u)
  return (u:gsub("/+$", ""))
end

function run(profile)
  _result = { ok = true, findings = {} }
  local b = base(tostring(profile.baseUrl or ""))
  local key = tostring(profile.apiKey or "")
  local model = tostring(profile.model or "Atria-Dawn")
  local h = { ["Content-Type"] = "application/json" }
  if #key > 0 then h["Authorization"] = "Bearer " .. key end
  _result.base = b

  -- 1. /v1/models
  local m = json_fetch(b .. "/v1/models", { method = "GET", headers = h, timeoutMs = 30000 })
  _result.models = { ok = m.ok, status = m.status, latencyMs = m.latencyMs }
  if m.ok and type(m.body) == "table" then
    local ids = {}
    if type(m.body.data) == "table" then
      for _, d in ipairs(m.body.data) do
        if d and d.id then ids[#ids + 1] = tostring(d.id) end
      end
    end
    _result.models.ids = ids
  end

  -- 2. chat round-trip (use generous max_tokens — reasoning models return
  --    content=null at small budgets!)
  local chat = json_fetch(b .. "/v1/chat/completions", {
    method = "POST",
    headers = h,
    body = { model = model, messages = { { role = "user", content = "Reply with exactly: STRICT_OK" } }, max_tokens = 64 },
    timeoutMs = 90000,
  })
  _result.chat = { ok = chat.ok, status = chat.status, latencyMs = chat.latencyMs }
  if chat.ok and type(chat.body) == "table" then
    local c = chat.body.choices
    if type(c) == "table" and c[1] and c[1].message then
      _result.chat.content = tostring(c[1].message.content or "")
      _result.chat.reasoning = (c[1].message.reasoning_content ~= nil) and "present" or "absent"
    end
    _result.chat.usage = chat.body.usage
  end

  -- 3. embeddings probe (many providers don't implement)
  local em = json_fetch(b .. "/v1/embeddings", {
    method = "POST",
    headers = h,
    body = { model = "text-embedding", input = "hi" },
    timeoutMs = 30000,
  })
  _result.embeddings = { ok = em.ok, status = em.status }

  -- 4. header/alt-auth probe: try x-api-key (Anthropic-style) on a tiny GET
  local hx = {}
  if #key > 0 then hx["x-api-key"] = key end
  local alt = json_fetch(b .. "/v1/models", { method = "GET", headers = hx, timeoutMs = 20000 })
  _result.altAuth = { status = alt.status, okInAlt = alt.ok }

  _result.ok = true
  return _result
end