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
