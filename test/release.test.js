// Release-stamp guards.
//
// The service worker is cache-first from the snapshot it installed, and writes
// nothing back outside install. That is deliberate — it is what stops one page
// load mixing files from two releases — but it has a consequence that is easy
// to forget: a release only reaches an installed device if `sw.js` itself
// changes, because that is the only thing the browser re-checks.
//
// Three releases shipped clinical changes with `CACHE_NAME` untouched. Nothing
// failed, no test complained, and every device that had already installed kept
// serving the older content indefinitely. On a ward phone that means dosing
// guidance that was corrected upstream is still being read as current.
//
// So the cache stamp is the app version verbatim, and these assert that every
// place the version is written still agrees. If a change bumps the version and
// forgets the cache — or the reverse — the suite fails instead of the release
// silently reaching nobody.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

const SEMVER = String.raw`\d+\.\d+\.\d+`;

function extract(file, pattern, label) {
    const match = read(file).match(pattern);
    assert.ok(match, `${label} not found in ${file} — the guard cannot check what it cannot locate`);
    return match[1];
}

describe('release stamps agree', () => {
    const appVersion = extract('script.js', new RegExp(`const APP_VERSION = '(${SEMVER})'`), 'APP_VERSION');

    test('the service worker cache stamp is the app version', () => {
        const cacheVersion = extract(
            'sw.js', new RegExp(`const CACHE_NAME = 'withdrawal-app-cache-v(${SEMVER})'`), 'CACHE_NAME');
        assert.equal(cacheVersion, appVersion,
            'CACHE_NAME does not match APP_VERSION — an installed device would keep serving the previous '
            + 'release, because a cache-first worker only reinstalls when sw.js changes');
    });

    test('package.json matches', () => {
        assert.equal(JSON.parse(read('package.json')).version, appVersion,
            'package.json version has drifted from APP_VERSION');
    });

    test('the app-build meta tag matches', () => {
        const meta = extract(
            'index.html', new RegExp(`<meta name="app-build" content="(${SEMVER})"`), 'app-build meta tag');
        assert.equal(meta, appVersion, 'the app-build meta tag has drifted from APP_VERSION');
    });

    // The in-app changelog is what a clinician reads to find out whether the
    // thing in front of them is current. A release with no entry there is a
    // release nobody can identify.
    test('the current version has an in-app changelog entry', () => {
        assert.ok(read('index.html').includes(`<h4>${appVersion} - `),
            `no in-app changelog heading for ${appVersion}`);
    });

    test('the current version has a CHANGELOG.md entry, and nothing is left unreleased', () => {
        const changelog = read('CHANGELOG.md');
        assert.ok(changelog.includes(`## ${appVersion} - `),
            `no CHANGELOG.md section for ${appVersion}`);
        assert.ok(!/^## Unreleased/m.test(changelog),
            'CHANGELOG.md still has an Unreleased section — either it belongs in this release, or the '
            + 'version has not been bumped for it');
    });
});
