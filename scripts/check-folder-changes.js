const { execSync } = require('child_process');
const path = require('path');

// Define the path constant
const PATH_TO_CHECK = 'folder-to-commit';

function getChangedFiles() {
    try {
        const diffOutput = execSync('git diff --name-only origin/main...HEAD').toString();
        const changedFiles = diffOutput.split('\n').filter(Boolean);
        
        // Filter only files from our target directory
        const targetFiles = changedFiles.filter(file => 
            file.startsWith(PATH_TO_CHECK + '/')
        );
        
        console.log('Changed files in target directory:', targetFiles);
        return targetFiles;
    } catch (error) {
        console.error('Error checking for changes:', error);
        return [];
    }
}

function pushChanges(files) {
    if (files.length === 0) {
        console.log('No changes to push');
        return false;
    }

    try {
        // Get the latest commit message
        const commitMsg = execSync('git log -1 --pretty=%B').toString().trim();
        const branchName = process.env.GITHUB_REF_NAME || 'main';

        // Create a temporary branch for our changes
        const tempBranch = `temp-branch-${Date.now()}`;
        execSync('git checkout --orphan ' + tempBranch);
        
        // Reset the working directory
        execSync('git rm -rf .');
        
        // Copy only the changed files
        files.forEach(file => {
            const dir = path.dirname(file);
            execSync(`mkdir -p "${dir}"`);
            execSync(`git show HEAD:"${file}" > "${file}"`);
            execSync(`git add "${file}"`);
        });

        // Commit the changes with the same commit message
        execSync(`git commit -m "${commitMsg}"`);
        
        // Push to the destination with the same branch name
        execSync('git remote add destination git@github.com:anerishah97/test-oss-destination.git || true');
        execSync(`git push -f destination ${tempBranch}:${branchName}`);
        
        return true;
    } catch (error) {
        console.error('Error pushing changes:', error);
        return false;
    }
}

// Run the script
const changedFiles = getChangedFiles();
const hasChanges = changedFiles.length > 0;
console.log('Has changes in path:', hasChanges);

if (hasChanges) {
    const pushed = pushChanges(changedFiles);
    console.log('Changes pushed successfully:', pushed);
}

// New way
console.log(`GITHUB_OUTPUT=${hasChanges}` >> $GITHUB_OUTPUT); 