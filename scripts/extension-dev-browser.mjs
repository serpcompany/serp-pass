import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  appendFile,
  mkdir,
  open as openFile,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  unlink,
  watch,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const scriptPath = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(scriptPath), '..');
const configPath = path.join(projectRoot, '.extension-dev-browser.json');
const config = JSON.parse(await readFile(configPath, 'utf8'));
const runnerFingerprint = createHash('sha256')
  .update(await readFile(scriptPath))
  .digest('hex');
const stateRoot = path.join(projectRoot, '.extension-dev-browser');
const profileRoot = path.join(stateRoot, 'profile');
const statePath = path.join(stateRoot, 'state.json');
const temporaryStatePath = path.join(stateRoot, 'state.json.tmp');
const startLockPath = path.join(stateRoot, 'start.lock');
const logPath = path.join(stateRoot, 'dev-browser.log');
const extensionDiscoveryRoot = path.resolve(projectRoot, config.extensionDiscoveryRoot);
const cdpPort =
  43_000 +
  (Number.parseInt(createHash('sha256').update(projectRoot).digest('hex').slice(0, 8), 16) %
    6_000);
const cdpUrl = `http://127.0.0.1:${cdpPort}`;
const debounceMilliseconds = config.debounceMilliseconds ?? 250;
let shuttingDown = false;

const delay = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

function isProcessAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function readJson(filePath) {
  try {
    return JSON.parse(await readFile(filePath, 'utf8'));
  } catch (error) {
    if (error?.code === 'ENOENT' || error instanceof SyntaxError) return null;
    throw error;
  }
}

async function writeState(state) {
  await writeFile(temporaryStatePath, `${JSON.stringify(state, null, 2)}\n`);
  await rename(temporaryStatePath, statePath);
}

async function endpointIsAlive() {
  try {
    const response = await fetch(`${cdpUrl}/json/version`, {
      signal: AbortSignal.timeout(750),
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function inspectInstance() {
  const state = await readJson(statePath);
  if (!state) return { state: null, healthy: false };
  const daemonAlive = isProcessAlive(state.daemonPid);
  const browserAlive = await endpointIsAlive();
  const stateOwned = state.projectRoot === projectRoot;
  const runnerCurrent = state.runnerFingerprint === runnerFingerprint;
  return {
    state,
    daemonAlive,
    browserAlive,
    stateOwned,
    runnerCurrent,
    healthy: daemonAlive && browserAlive && stateOwned && runnerCurrent,
  };
}

async function run(command, args, environment = process.env) {
  return await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: projectRoot,
      env: environment,
      stdio: 'inherit',
    });
    child.on('error', reject);
    child.on('close', (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} failed ${signal ? `with ${signal}` : `with exit code ${code}`}.`));
    });
  });
}

async function buildExtension(reason) {
  const startedAt = new Date().toISOString();
  console.log(`[extension-dev-browser] Building (${reason})...`);
  const [command, ...args] = config.buildCommand;
  await run(command, args, { ...process.env, ...(config.buildEnvironment ?? {}) });
  const extensionRoots = [];
  for (const entry of await readdir(extensionDiscoveryRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const extensionRoot = path.join(extensionDiscoveryRoot, entry.name, 'dist');
    try {
      const manifest = JSON.parse(await readFile(path.join(extensionRoot, 'manifest.json'), 'utf8'));
      extensionRoots.push({ path: extensionRoot, name: manifest.name });
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
  }
  extensionRoots.sort((left, right) => left.path.localeCompare(right.path));
  if (extensionRoots.length === 0) throw new Error('Build produced no discoverable unpacked extensions.');
  const completedAt = new Date().toISOString();
  console.log(`[extension-dev-browser] Build completed at ${completedAt}.`);
  return { startedAt, completedAt, reason, extensionRoots };
}

async function loadExtensions(browser, extensionRoots) {
  const session = await browser.newBrowserCDPSession();
  try {
    const extensions = [];
    for (const expected of extensionRoots) {
      const loaded = await session.send('Extensions.loadUnpacked', { path: expected.path });
      const installed = await session.send('Extensions.getExtensions');
      const extension = installed.extensions.find((item) => item.id === loaded.id);
      if (!extension || path.resolve(extension.path) !== expected.path) {
        throw new Error(`Chromium did not report the expected unpacked extension path: ${expected.path}`);
      }
      extensions.push({
        id: extension.id,
        name: extension.name,
        path: expected.path,
        pageUrl: `chrome-extension://${extension.id}/popup.html`,
      });
    }
    return extensions;
  } finally {
    await session.detach();
  }
}

async function openPreview(context, extensionId) {
  if (!config.previewPath) return null;
  const normalized = String(config.previewPath).replace(/^\//, '');
  const url = `chrome-extension://${extensionId}/${normalized}`;
  let lastError;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const page =
      context.pages().find((candidate) => candidate.url() === url) ??
      context.pages().find((candidate) => candidate.url() === 'about:blank') ??
      (await context.newPage());
    try {
      if (page.url() === url) {
        await page.reload({ waitUntil: 'domcontentloaded', timeout: 5_000 });
      } else {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 5_000 });
      }
      // Reloading an unpacked extension invalidates its existing pages. Chrome
      // can briefly accept navigation on the old target and replace it with a
      // New Tab a moment later, especially in headless mode. Only reuse the
      // preview after its extension URL remains stable past that unload window.
      await delay(350);
      if (page.url() !== url) throw new Error('Extension preview target was replaced during reload.');
      return page;
    } catch (error) {
      lastError = error;
      await delay(250);
    }
  }
  throw lastError;
}

async function refreshHttpPages(context) {
  if (!config.refreshHttpTabs) return;
  for (const page of context.pages()) {
    if (/^https?:/.test(page.url())) {
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 15_000 }).catch(() => {});
    }
  }
}

async function reloadExtension(context, runtimeState) {
  const browser = context.browser();
  if (!browser) throw new Error('The dev browser disconnected.');
  runtimeState.extensions = await loadExtensions(browser, runtimeState.lastBuild.extensionRoots);
  await refreshHttpPages(context);
  console.log(`[extension-dev-browser] Reloaded ${runtimeState.extensions.length} discovered extensions.`);
}

async function launchBrowser(extensionRoots) {
  const headlessVariable = config.headlessEnvironmentVariable ?? 'EXTENSION_DEV_HEADLESS';
  const headlessOverride = process.env[headlessVariable];
  const headless = headlessOverride == null
    ? (config.headless ?? false)
    : headlessOverride === '1';
  return await chromium.launchPersistentContext(profileRoot, {
    executablePath: chromium.executablePath(),
    headless,
    viewport: null,
    args: [
      `--remote-debugging-port=${cdpPort}`,
      '--enable-unsafe-extension-debugging',
      `--disable-extensions-except=${extensionRoots.map((entry) => entry.path).join(',')}`,
      `--load-extension=${extensionRoots.map((entry) => entry.path).join(',')}`,
      '--window-size=1440,1000',
    ],
  });
}

async function acquireStartLock() {
  await mkdir(stateRoot, { recursive: true });
  try {
    const handle = await openFile(startLockPath, 'wx');
    await handle.writeFile(`${JSON.stringify({ pid: process.pid })}\n`);
    await handle.close();
  } catch (error) {
    if (error?.code !== 'EEXIST') throw error;
    const lock = await readJson(startLockPath);
    if (lock && !isProcessAlive(lock.pid)) {
      await unlink(startLockPath).catch(() => {});
      return await acquireStartLock();
    }
    throw new Error('Another dev-browser start is already in progress.');
  }
}

const releaseStartLock = () => unlink(startLockPath).catch(() => {});

function printState(state) {
  console.log(`  status:    ${state.status}`);
  console.log(`  daemon:    ${state.daemonPid}`);
  console.log(`  CDP:       ${state.cdpUrl}`);
  console.log(`  profile:   ${state.profileRoot}`);
  for (const extension of state.extensions ?? []) {
    console.log(`  extension: ${extension.name} ${extension.id}`);
  }
  if (state.lastBuild?.completedAt) console.log(`  build:     ${state.lastBuild.completedAt}`);
  if (state.lastError) console.log(`  error:     ${state.lastError}`);
}

async function stop() {
  const instance = await inspectInstance();
  if (!instance.state) {
    console.log('[extension-dev-browser] Already stopped.');
    return;
  }
  if (!instance.stateOwned) {
    throw new Error('Refusing to stop browser state owned by another project.');
  }
  if (instance.daemonAlive) {
    process.kill(instance.state.daemonPid, 'SIGTERM');
    const deadline = Date.now() + 15_000;
    while (Date.now() < deadline && isProcessAlive(instance.state.daemonPid)) await delay(100);
  }
  await rm(statePath, { force: true });
  await rm(temporaryStatePath, { force: true });
  await releaseStartLock();
  console.log('[extension-dev-browser] Stopped repo-owned browser; profile preserved.');
}

async function start() {
  const instance = await inspectInstance();
  if (instance.healthy) {
    console.log(`[extension-dev-browser] Reusing PID ${instance.state.daemonPid}.`);
    printState(instance.state);
    return;
  }
  if (instance.stateOwned && instance.daemonAlive && instance.browserAlive && !instance.runnerCurrent) {
    console.log('[extension-dev-browser] Restarting to activate an updated runner.');
    await stop();
  }
  await acquireStartLock();
  try {
    const afterLock = await inspectInstance();
    if (afterLock.healthy) return printState(afterLock.state);
    if (afterLock.browserAlive || (await endpointIsAlive())) {
      throw new Error(`CDP port ${cdpPort} belongs to an unverified browser.`);
    }
    const logHandle = await openFile(logPath, 'a');
    const child = spawn(process.execPath, [scriptPath, 'daemon'], {
      cwd: projectRoot,
      detached: true,
      env: process.env,
      stdio: ['ignore', logHandle.fd, logHandle.fd],
    });
    child.unref();
    await logHandle.close();
    const deadline = Date.now() + 30_000;
    while (Date.now() < deadline) {
      const started = await inspectInstance();
      if (started.healthy) {
        console.log('[extension-dev-browser] Ready.');
        return printState(started.state);
      }
      if (!isProcessAlive(child.pid)) break;
      await delay(250);
    }
    throw new Error(`Start failed; inspect ${logPath}.`);
  } finally {
    await releaseStartLock();
  }
}

function createBuildScheduler(context, runtimeState) {
  let timer;
  let building = false;
  let buildAgain = false;
  const changes = new Set();
  async function perform() {
    if (building) {
      buildAgain = true;
      return;
    }
    building = true;
    const reason = [...changes].sort().join(', ') || 'source change';
    changes.clear();
    try {
      runtimeState.status = 'building';
      runtimeState.lastError = null;
      await writeState(runtimeState);
      runtimeState.lastBuild = await buildExtension(reason);
      await reloadExtension(context, runtimeState);
      runtimeState.status = 'ready';
      await writeState(runtimeState);
    } catch (error) {
      runtimeState.status = 'build-failed';
      runtimeState.lastError = String(error?.stack ?? error);
      await writeState(runtimeState);
      console.error(runtimeState.lastError);
    } finally {
      building = false;
      if (buildAgain) {
        buildAgain = false;
        await perform();
      }
    }
  }
  return (changedPath) => {
    changes.add(path.relative(projectRoot, changedPath));
    clearTimeout(timer);
    timer = setTimeout(() => void perform(), debounceMilliseconds);
  };
}

async function installWatchers(onChange) {
  const controllers = [];
  const signatures = new Map();
  const signatureFor = async watchedPath => {
    try {
      const metadata = await stat(watchedPath);
      return `${metadata.mtimeMs}:${metadata.size}:${metadata.ino}`;
    } catch (error) {
      if (error?.code === 'ENOENT') return 'missing';
      throw error;
    }
  };
  for (const configuredPath of config.watch) {
    const watchedPath = path.resolve(projectRoot, configuredPath);
    const metadata = await stat(watchedPath);
    if (!metadata.isDirectory()) signatures.set(watchedPath, await signatureFor(watchedPath));
    const controller = new AbortController();
    controllers.push(controller);
    const events = watch(watchedPath, { recursive: metadata.isDirectory(), signal: controller.signal });
    void (async () => {
      try {
        for await (const event of events) {
          const filename = event.filename ? String(event.filename) : '';
          if (filename.endsWith('.swp') || filename.endsWith('~')) continue;
          const changedPath = metadata.isDirectory() && filename
            ? path.join(watchedPath, filename)
            : watchedPath;
          const relativeChangedPath = path.relative(projectRoot, changedPath);
          if (relativeChangedPath.split(path.sep).includes('dist')) continue;
          const signature = await signatureFor(changedPath);
          if (signatures.get(changedPath) === signature) continue;
          signatures.set(changedPath, signature);
          onChange(changedPath);
        }
      } catch (error) {
        if (!shuttingDown && error?.name !== 'AbortError') console.error(error);
      }
    })();
  }
  return controllers;
}

async function daemon() {
  await mkdir(stateRoot, { recursive: true });
  await appendFile(logPath, `\n[extension-dev-browser] Starting PID ${process.pid} at ${new Date().toISOString()}\n`);
  const initialBuild = await buildExtension('initial startup');
  const context = await launchBrowser(initialBuild.extensionRoots);
  const runtimeState = {
    schemaVersion: 1,
    runnerFingerprint,
    projectRoot,
    daemonPid: process.pid,
    cdpUrl,
    cdpPort,
    profileRoot,
    extensionDiscoveryRoot,
    extensions: [],
    startedAt: new Date().toISOString(),
    status: 'building',
    lastBuild: initialBuild,
    lastError: null,
  };
  try {
    await reloadExtension(context, runtimeState);
  } catch (error) {
    await context.close().catch(() => {});
    throw error;
  }
  runtimeState.status = 'ready';
  await writeState(runtimeState);
  const schedule = createBuildScheduler(context, runtimeState);
  const controllers = await installWatchers(schedule);
  async function shutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[extension-dev-browser] Shutting down after ${signal}.`);
    for (const controller of controllers) controller.abort();
    await context.close().catch(() => {});
    await rm(statePath, { force: true });
    await rm(temporaryStatePath, { force: true });
    process.exit(0);
  }
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
  context.on('close', () => void shutdown('browser close'));
  await new Promise(() => {});
}

async function status() {
  const instance = await inspectInstance();
  if (!instance.state) {
    console.log('[extension-dev-browser] Stopped.');
    process.exitCode = 1;
    return;
  }
  console.log(`[extension-dev-browser] ${instance.healthy ? 'Running' : 'Unhealthy'}.`);
  printState(instance.state);
  if (!instance.healthy) process.exitCode = 1;
}

async function openUrl(url) {
  if (!url) throw new Error('Pass a URL after --, for example npm run dev:browser:open -- https://example.com');
  const instance = await inspectInstance();
  if (!instance.healthy) throw new Error('Run npm run dev:browser first.');
  const response = await fetch(`${instance.state.cdpUrl}/json/new?${encodeURIComponent(url)}`, {
    method: 'PUT',
  });
  if (!response.ok) throw new Error(`Chromium rejected the new tab (${response.status}).`);
  const target = await response.json();
  console.log(`[extension-dev-browser] Opened ${target.url}`);
}

async function logs() {
  try {
    const contents = await readFile(logPath, 'utf8');
    console.log(contents.split('\n').slice(-120).join('\n'));
  } catch (error) {
    if (error?.code === 'ENOENT') console.log('[extension-dev-browser] No log yet.');
    else throw error;
  }
}

const command = process.argv[2] ?? 'start';
try {
  if (command === 'start') await start();
  else if (command === 'daemon') await daemon();
  else if (command === 'status') await status();
  else if (command === 'stop') await stop();
  else if (command === 'open') await openUrl(process.argv[3]);
  else if (command === 'logs') await logs();
  else throw new Error(`Unknown command: ${command}`);
} catch (error) {
  console.error(`[extension-dev-browser] ${error?.stack ?? error}`);
  process.exitCode = 1;
}
