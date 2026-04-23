import { Octokit } from '@octokit/rest';
import { Competitor, CompetitorsData } from './types';

const owner = process.env.GITHUB_OWNER || '';
const repo = process.env.GITHUB_REPO || 'mexhome-competitor-intel';
const branch = process.env.GITHUB_BRANCH || 'main';
const token = process.env.GITHUB_TOKEN || '';

function client(): Octokit {
  if (!token) {
    throw new Error('GITHUB_TOKEN is not set');
  }
  return new Octokit({ auth: token });
}

export function isGithubConfigured(): boolean {
  return Boolean(token && owner && repo);
}

export async function commitCompetitorsFile(
  competitors: Competitor[],
  message: string
): Promise<void> {
  const octokit = client();
  const filePath = 'data/competitors.json';

  const data: CompetitorsData = { competitors };
  const newContent = JSON.stringify(data, null, 2) + '\n';
  const newContentBase64 = Buffer.from(newContent).toString('base64');

  let sha: string | undefined;
  try {
    const existing = await octokit.repos.getContent({
      owner,
      repo,
      path: filePath,
      ref: branch,
    });
    if ('sha' in existing.data) {
      sha = existing.data.sha;
    }
  } catch (err: unknown) {
    if ((err as { status?: number }).status !== 404) {
      throw err;
    }
  }

  await octokit.repos.createOrUpdateFileContents({
    owner,
    repo,
    path: filePath,
    message,
    content: newContentBase64,
    branch,
    sha,
  });
}

export interface WorkflowRunInfo {
  id: number;
  status: string;
  conclusion: string | null;
  htmlUrl: string;
  createdAt: string;
}

export async function dispatchWorkflow(
  workflowFileName: string = 'weekly-report.yml'
): Promise<void> {
  const octokit = client();
  await octokit.actions.createWorkflowDispatch({
    owner,
    repo,
    workflow_id: workflowFileName,
    ref: branch,
  });
}

export async function findLatestWorkflowRun(
  workflowFileName: string,
  sinceISO: string,
  attempts: number = 10
): Promise<WorkflowRunInfo | null> {
  const octokit = client();
  for (let i = 0; i < attempts; i++) {
    const res = await octokit.actions.listWorkflowRuns({
      owner,
      repo,
      workflow_id: workflowFileName,
      branch,
      per_page: 5,
    });
    const sinceTime = new Date(sinceISO).getTime();
    const recent = res.data.workflow_runs.find(
      (r) => new Date(r.created_at).getTime() >= sinceTime - 5000
    );
    if (recent) {
      return {
        id: recent.id,
        status: recent.status || 'queued',
        conclusion: recent.conclusion,
        htmlUrl: recent.html_url,
        createdAt: recent.created_at,
      };
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  return null;
}

export async function getWorkflowRun(runId: number): Promise<WorkflowRunInfo> {
  const octokit = client();
  const res = await octokit.actions.getWorkflowRun({
    owner,
    repo,
    run_id: runId,
  });
  return {
    id: res.data.id,
    status: res.data.status || 'queued',
    conclusion: res.data.conclusion,
    htmlUrl: res.data.html_url,
    createdAt: res.data.created_at,
  };
}

export async function uploadDataFile(
  filePath: string,
  contentBase64: string,
  message: string
): Promise<void> {
  const octokit = client();

  let sha: string | undefined;
  try {
    const existing = await octokit.repos.getContent({
      owner,
      repo,
      path: filePath,
      ref: branch,
    });
    if ('sha' in existing.data) {
      sha = existing.data.sha;
    }
  } catch (err: unknown) {
    if ((err as { status?: number }).status !== 404) {
      throw err;
    }
  }

  await octokit.repos.createOrUpdateFileContents({
    owner,
    repo,
    path: filePath,
    message,
    content: contentBase64,
    branch,
    sha,
  });
}
