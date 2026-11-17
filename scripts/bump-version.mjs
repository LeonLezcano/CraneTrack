import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const versionPath = path.join(root, 'version.json');
const pkgPath = path.join(root, 'package.json');
const swPath = path.join(root, 'sw.js');
const indexPath = path.join(root, 'index.html');

const versionData = JSON.parse(fs.readFileSync(versionPath, 'utf8'));
const currentSemver = versionData.version.replace(/^v/, '');
const parts = currentSemver.split('.');
parts[2] = String(Number(parts[2]) + 1).padStart(2, '0');

const nextSemver = parts.join('.');
const nextTag = `v${nextSemver}`;

versionData.version = nextTag;
versionData.buildDate = new Date().toISOString();
fs.writeFileSync(versionPath, JSON.stringify(versionData, null, 2) + '\n', 'utf8');

const pkgData = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
pkgData.version = nextSemver;
fs.writeFileSync(pkgPath, JSON.stringify(pkgData, null, 2) + '\n', 'utf8');

const swContent = fs.readFileSync(swPath, 'utf8')
  .replace(/v\d+\.\d+\.\d+/g, nextTag)
  .replace(/cranetrack-v\d+\.\d+\.\d+/g, `cranetrack-${nextTag}`);
fs.writeFileSync(swPath, swContent, 'utf8');

const indexContent = fs.readFileSync(indexPath, 'utf8')
  .replace(/(id="appVersionMeta"[^>]*>)v\d+\.\d+\.\d+(<\/span>)/g, `$1${nextTag}$2`)
  .replace(/(id="footerVersionMeta"[^>]*>)v\d+\.\d+\.\d+(<\/span>)/g, `$1${nextTag}$2`);
fs.writeFileSync(indexPath, indexContent, 'utf8');

console.log(nextTag);
