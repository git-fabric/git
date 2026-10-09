/**
 * @git-fabric/git — FabricApp factory
 *
 * Implements the FabricApp interface from @git-fabric/gateway.
 * Exposes all git and GitHub operations as a single composable layer.
 *
 * Tools:
 *   Repos   : git_repo_list, git_repo_get, git_repo_create, git_repo_delete
 *   Files   : git_file_get, git_file_list
 *   Commits : git_commit_list, git_commit_get, git_commit_compare, git_commit_push
 *   Branches: git_branch_list, git_branch_create, git_branch_delete, git_branch_protect
 *   Pulls   : git_pr_list, git_pr_get, git_pr_create, git_pr_merge
 */
import type { GitHubAdapter } from "./types.js";
interface FabricTool {
    name: string;
    description: string;
    inputSchema: Record<string, unknown>;
    annotations?: {
        readOnlyHint?: boolean;
        destructiveHint?: boolean;
        idempotentHint?: boolean;
        openWorldHint?: boolean;
    };
    execute: (args: Record<string, unknown>) => Promise<unknown>;
}
interface FabricApp {
    name: string;
    version: string;
    description: string;
    tools: FabricTool[];
    health: () => Promise<{
        app: string;
        status: "healthy" | "degraded" | "unavailable";
        latencyMs?: number;
        details?: Record<string, unknown>;
    }>;
}
export declare function createApp(githubOverride?: GitHubAdapter): FabricApp;
export {};
//# sourceMappingURL=app.d.ts.map