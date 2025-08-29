import fs from "node:fs";
import path from "node:path";

function readJson(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw);
}

function exists(filePath) {
  try {
    fs.accessSync(filePath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
}

function main() {
  const repoRoot = process.cwd();
  const contractPath = path.join(repoRoot, "docs", "route-contract.json");

  if (!exists(contractPath)) {
    fail(`Missing route contract: ${path.relative(repoRoot, contractPath)}`);
    return;
  }

  const contract = readJson(contractPath);
  const routerPath = path.join(repoRoot, contract.routerFile);

  if (!exists(routerPath)) {
    fail(
      `Missing router file: ${contract.routerFile}\n` +
        `If the app isn't scaffolded yet, this is expected. Re-run after scaffolding.`
    );
    return;
  }

  const routerText = fs.readFileSync(routerPath, "utf8");

  for (const page of contract.requiredPageComponents ?? []) {
    const pageFilePath = path.join(repoRoot, page.file);

    if (!exists(pageFilePath)) {
      fail(`Missing required page file: ${page.file}`);
      continue;
    }

    const componentRegex = new RegExp(`\\b${page.component}\\b`, "m");
    if (!componentRegex.test(routerText)) {
      fail(
        `Router does not reference required page component: ${page.component}\n` +
          `Expected to find '${page.component}' in ${contract.routerFile}`
      );
    }
  }

  if (process.exitCode === 1) return;
  process.stdout.write("Route contract OK (primary surfaces kept as separate pages).\n");
}

main();

