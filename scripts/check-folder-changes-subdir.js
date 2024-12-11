import { execSync } from 'child_process';
import path from 'path';
import { Octokit } from '@octokit/rest';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Define the path constant
const PATH_TO_CHECK = 'folder-to-commit';

async function getChangedFiles(octokit, owner, repo, base, head) {
  console.log('Debug: getChangedFiles called with:', { owner, repo, base, head });
  try {
    const response = await octokit.rest.repos.compareCommits({
      owner,
      repo,
      base,
      head,
    });
    console.log('Debug: Got response from GitHub API');
    console.log('Debug: Number of files changed:', response.data.files.length);
    return response.data.files;
  } catch (error) {
    console.error('Debug: Error in getChangedFiles:', error);
    throw error;
  }
}

function pushChanges() {
  try {
    // Use a shell command to list all files under PATH_TO_CHECK
    const allFiles = execSync(`find ${PATH_TO_CHECK} -type f`).toString().trim().split('\n');
    if (allFiles.length === 0) {
      console.log('No files to push');
      return false;
    }

    console.log('Debug: Filenames to process:', allFiles);

    const commitMsg = execSync('git log -1 --pretty=%B').toString().trim();
    const branchName = process.env.GITHUB_REF_NAME || 'main';

    // Set up Git configuration
    const authorName = execSync('git log -1 --pretty=format:"%an"').toString().trim();
    const authorEmail = execSync('git log -1 --pretty=format:"%ae"').toString().trim();

    // Fetch and checkout the correct commit
    console.log('Debug: Fetching repository');
    execSync('git fetch origin');
    execSync(`git checkout main`);

    // Create and switch to a new branch from the current HEAD
    const tempBranch = `temp-branch-${Date.now()}`;
    console.log('Debug: Creating temp branch:', tempBranch);
    execSync(`git checkout -b ${tempBranch}`);

    execSync(`git config user.name "${authorName}"`);
    execSync(`git config user.email "${authorEmail}"`);

    // Create all necessary directories at once
    const uniqueDirs = [...new Set(allFiles.map((file) => path.dirname(file)))];
    uniqueDirs.forEach((dir) => {
      console.log('Debug: Creating directory:', dir);
      execSync(`mkdir -p "${dir}"`);
    });

    // Add files to git and commit without checking status
    allFiles.forEach((file) => {
      console.log('Debug: Adding file:', file);
      execSync(`git add "${file}"`);
    });

        // Print git status before commit
        console.log('Debug: Git status before commit:');
        console.log(execSync('git status').toString());
    

    // Proceed with commit directly
    try {
      execSync(`git commit --allow-empty -m "${commitMsg}"`);
    } catch (error) {
      console.error('Commit failed:', error.stdout?.toString());
      throw error;
    }

    execSync(
      'git remote add destination git@github.com:anerishah97/test-oss-destination.git || true',
    );
    execSync(`git push -f destination ${tempBranch}:${branchName}`);

    return true;
  } catch (error) {
    console.error('Error pushing changes:', error, error.message);
    return false;
  }
}

// Wrap the execution code in an async function
async function main() {
  console.log('Debug: Initializing Octokit');
  const octokit = new Octokit({
    auth: process.env.GITHUB_TOKEN,
  });

  // Debugging: Log environment variables
  console.log('Debug: Environment Variables:', {
    BASE_COMMIT: process.env.BASE_COMMIT,
    HEAD_COMMIT: process.env.HEAD_COMMIT,
  });

  // Parse repository information
  const [owner, repo] = process.env.GITHUB_REPOSITORY.split('/');
  console.log('Debug: Repository info:', { owner, repo });

  const files = await getChangedFiles(
    octokit,
    owner,
    repo,
    process.env.BASE_COMMIT,
    process.env.HEAD_COMMIT,
  );

  const hasChanges = files.length > 0;
  console.log('Has changes in path:', hasChanges);

  if (hasChanges) {
    const pushed = pushChanges();
    console.log('Changes pushed successfully:', pushed);
  }

  // Output handling
  console.log('Debug: Starting change detection');
  console.log('Debug: GITHUB_OUTPUT =', process.env.GITHUB_OUTPUT);
  console.log('Debug: hasChanges =', hasChanges);
  console.log('Debug: Setting output has_changes =', hasChanges);
  console.log(`has_changes=${hasChanges}` >> process.env.GITHUB_OUTPUT);
  console.log('Debug: Script completed');
}

// Call the main function
main().catch((error) => {
  console.error('Error in main:', error);
  process.exit(1);
});
