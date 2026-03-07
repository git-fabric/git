#!/usr/bin/env node
import { createApp } from '../dist/app.js';
import { Library } from '../dist/library.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { createServer } from 'node:http';

const app = createApp();
const library = new Library();

function buildServer() {
  const server = new Server({ name: app.name, version: app.version }, { capabilities: { tools: {} } });

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: app.tools.map((t) => ({ name: t.name, description: t.description, inputSchema: t.inputSchema })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const tool = app.tools.find((t) => t.name === req.params.name);
    if (!tool) return { content: [{ type: 'text', text: `Unknown tool: ${req.params.name}` }], isError: true };
    try {
      const result = await tool.execute(req.params.arguments ?? {});
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    } catch (e) {
      return { content: [{ type: 'text', text: String(e) }], isError: true };
    }
  });

  return server;
}

// ── Gateway registration ─────────────────────────────────────────────────────

const GATEWAY_URL = process.env.GATEWAY_URL;
const MCP_HTTP_PORT = process.env.MCP_HTTP_PORT ? Number(process.env.MCP_HTTP_PORT) : null;
const POD_IP = process.env.POD_IP || '0.0.0.0';

let sessionToken = null;

async function registerWithGateway() {
  if (!GATEWAY_URL) return;
  const mcpEndpoint = `http://${POD_IP}:${MCP_HTTP_PORT || 8200}/mcp`;
  const body = {
    fabric_id: 'fabric-git',
    as_number: 65001,
    version: app.version,
    mcp_endpoint: mcpEndpoint,
    ollama_endpoint: process.env.OLLAMA_ENDPOINT || 'http://ollama.fabric-sdk:11434',
    ollama_model: process.env.OLLAMA_MODEL || 'qwen2.5-coder:3b',
    supervisor: 'standalone',
    tailscale_node: 'fabric-git',
    worker_pool: { total: 0, healthy: 0, workers: [] },
    routes: [
      { prefix: 'fabric.git', local_pref: 100, description: 'Git and GitHub operations — repos, commits, branches, PRs, files' },
      { prefix: 'fabric.git.repos', local_pref: 100, description: 'Repository management — list, create, delete repos' },
      { prefix: 'fabric.git.commits', local_pref: 100, description: 'Commit operations — list, get, compare, push commits' },
      { prefix: 'fabric.git.branches', local_pref: 100, description: 'Branch management — list, create, delete, protect branches' },
      { prefix: 'fabric.git.pulls', local_pref: 100, description: 'Pull request operations — list, get, create, merge PRs' },
      { prefix: 'fabric.git.files', local_pref: 100, description: 'File operations — get file content, list directory trees' },
    ],
  };

  try {
    const res = await fetch(`${GATEWAY_URL}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (data.ok) {
      sessionToken = data.session_token;
      console.log(`[fabric-git] Registered with gateway: ${sessionToken} (${data.routes_accepted} routes)`);
    } else {
      console.warn(`[fabric-git] Registration rejected: ${JSON.stringify(data)}`);
    }
  } catch (err) {
    console.warn(`[fabric-git] Gateway registration failed (standalone mode): ${err.message}`);
  }
}

async function sendKeepalive() {
  if (!GATEWAY_URL || !sessionToken) return;
  try {
    const res = await fetch(`${GATEWAY_URL}/keepalive`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fabric_id: 'fabric-git',
        session_token: sessionToken,
        worker_pool: { total: 0, healthy: 0, workers: [] },
        timestamp: Math.floor(Date.now() / 1000),
      }),
    });
    if (res.status === 401) {
      console.log('[fabric-git] Session expired — re-registering');
      sessionToken = null;
      await registerWithGateway();
    }
  } catch {
    // Gateway unreachable — will retry next interval
  }
}

// ── Server startup ───────────────────────────────────────────────────────────

const httpPort = MCP_HTTP_PORT;

if (httpPort) {
  const httpServer = createServer(async (req, res) => {
    if (req.url === '/healthz' || req.url === '/health') {
      const h = await app.health();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(h));
      return;
    }
    if (req.url === '/tools') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(app.tools.map((t) => ({ name: t.name, description: t.description }))));
      return;
    }
    // MCP tool call endpoint for gateway DNS unicast resolution
    if ((req.url === '/mcp/tools/call' || req.url === '/tools/call') && req.method === 'POST') {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const body = JSON.parse(Buffer.concat(chunks).toString());

      // Handle aiana_query — gateway DNS resolver asks for context
      //
      // Two knowledge sources, checked in order:
      //   1. Live GitHub API (deterministic) — real-time repo/commit/branch/PR state
      //   2. Library (reference) — Git docs from git/git, fetched from GitHub on demand
      //
      // Live API answers "what IS the state" — library answers "how to" and "why"
      if (body.name === 'aiana_query') {
        const queryText = (body.arguments?.query_text || '').toLowerCase();
        try {
          let context = '';
          let confidence = 0;
          let source = 'github-api';

          // ── Live GitHub queries (real-time state) ──────────────────
          if (/\b(list|show|get|what)\b.*\b(repo|repositor)/.test(queryText) && !queryText.includes('how')) {
            const repos = await app.tools.find(t => t.name === 'git_repo_list')?.execute({});
            context = JSON.stringify(repos, null, 2);
            confidence = 0.95;
          } else if (/\b(list|show|get)\b.*\bcommit/.test(queryText) && !queryText.includes('how')) {
            // Try to extract owner/repo from query
            const ownerRepo = extractOwnerRepo(queryText);
            if (ownerRepo) {
              const commits = await app.tools.find(t => t.name === 'git_commit_list')?.execute(ownerRepo);
              context = JSON.stringify(commits, null, 2);
              confidence = 0.9;
            } else {
              context = 'Specify a repository to list commits (e.g., "list commits for owner/repo")';
              confidence = 0.5;
            }
          } else if (/\b(list|show|get)\b.*\bbranch/.test(queryText) && !queryText.includes('how')) {
            const ownerRepo = extractOwnerRepo(queryText);
            if (ownerRepo) {
              const branches = await app.tools.find(t => t.name === 'git_branch_list')?.execute(ownerRepo);
              context = JSON.stringify(branches, null, 2);
              confidence = 0.9;
            } else {
              context = 'Specify a repository to list branches (e.g., "list branches for owner/repo")';
              confidence = 0.5;
            }
          } else if (/\b(list|show|get|open)\b.*\b(pr|pull request|pull)/.test(queryText) && !queryText.includes('how')) {
            const ownerRepo = extractOwnerRepo(queryText);
            if (ownerRepo) {
              const prs = await app.tools.find(t => t.name === 'git_pr_list')?.execute(ownerRepo);
              context = JSON.stringify(prs, null, 2);
              confidence = 0.9;
            } else {
              context = 'Specify a repository to list pull requests (e.g., "list PRs for owner/repo")';
              confidence = 0.5;
            }
          } else if (/\b(list|show|get)\b.*\bfile/.test(queryText) && !queryText.includes('how')) {
            const ownerRepo = extractOwnerRepo(queryText);
            if (ownerRepo) {
              const files = await app.tools.find(t => t.name === 'git_file_list')?.execute(ownerRepo);
              context = JSON.stringify(files, null, 2);
              confidence = 0.85;
            } else {
              context = 'Specify a repository to list files (e.g., "list files for owner/repo")';
              confidence = 0.5;
            }
          } else {
            // ── Library queries (reference docs) ──────────────────────
            const libraryResult = await library.query(queryText);
            if (libraryResult && libraryResult.context) {
              context = libraryResult.context;
              confidence = libraryResult.confidence;
              source = 'library';
              console.log(`[fabric-git] Library hit: ${libraryResult.sources.join(', ')}`);
            } else {
              // Nothing in library either — return repo list as fallback
              const repos = await app.tools.find(t => t.name === 'git_repo_list')?.execute({});
              context = JSON.stringify(repos, null, 2);
              confidence = 0.5;
            }
          }

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ context, confidence, source }));
        } catch (err) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ context: `Error querying GitHub: ${err.message}`, confidence: 0 }));
        }
        return;
      }

      const tool = app.tools.find((t) => t.name === body.name);
      if (!tool) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: `Tool not found: ${body.name}` }));
        return;
      }
      try {
        const result = await tool.execute(body.arguments ?? {});
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
      return;
    }
    if (req.url === '/mcp' || req.url === '/') {
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
      const server = buildServer();
      await server.connect(transport);
      await transport.handleRequest(req, res, undefined);
      return;
    }
    res.writeHead(404).end('not found');
  });

  httpServer.listen(httpPort, () => {
    console.log(`[fabric-git] ${app.name} v${app.version} — ${app.tools.length} tools`);
    console.log(`[fabric-git] MCP server listening on :${httpPort}`);
    console.log(`[fabric-git] Endpoints: /health /tools /tools/call /mcp/tools/call /mcp`);
  });

  // Register with gateway after server is listening
  await registerWithGateway();

  // Keepalive every 30s
  if (GATEWAY_URL) {
    setInterval(sendKeepalive, 30_000);
  }
} else {
  const transport = new StdioServerTransport();
  const server = buildServer();
  await server.connect(transport);
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function extractOwnerRepo(query) {
  // Match "owner/repo" pattern in query text
  const match = query.match(/\b([a-z0-9_.-]+\/[a-z0-9_.-]+)\b/i);
  if (match) {
    const [owner, repo] = match[1].split('/');
    return { owner, repo };
  }
  return null;
}
