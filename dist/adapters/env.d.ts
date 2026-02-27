/**
 * Environment adapter
 *
 * Creates a GitHubAdapter from environment variables.
 * Used by the CLI, the gateway loader, and GitHub Actions workflows.
 *
 * Required env vars:
 *   GITHUB_TOKEN or GIT_STEER_TOKEN  — GitHub API access
 *
 * Optional:
 *   GITHUB_ORG  — default org for repo operations (e.g. cortex-io)
 */
import type { GitHubAdapter } from "../types.js";
export declare function createAdapterFromEnv(): GitHubAdapter;
//# sourceMappingURL=env.d.ts.map