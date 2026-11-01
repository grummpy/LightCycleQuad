import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

test("arcade.json is valid and points at files that exist", () => {
  const manifest = JSON.parse(read("arcade.json"));
  assert.equal(manifest.name, "Light Cycle Quad");
  assert.equal(manifest.id, "lightcyclequad");
  assert.equal(manifest.players, 4);
  assert.equal(manifest.minPlayers, 1);
  assert.equal(manifest.port, 8806);
  assert.equal(manifest.version, "1.0.0");
  assert.deepEqual(manifest.input, ["keyboard", "gamepad"]);
  assert.equal(manifest.icon, "assets/icon.jpg");
  assert.equal(manifest.cover, "assets/cover.jpg");
  assert.deepEqual(manifest.launch, {
    mac: "./launch-mac.command",
    windows: "launch-windows.bat",
    linux: "./launch-linux.sh",
    web: "index.html",
  });

  for (const rel of [manifest.icon, manifest.cover, manifest.launch.web]) {
    assert.equal(fs.existsSync(path.join(root, rel)), true, rel);
  }
  for (const rel of Object.values(manifest.launch)) {
    const file = rel.replace(/^\.\//, "");
    assert.equal(fs.existsSync(path.join(root, file)), true, file);
  }
});

test("launchers start server.py and explain a missing Python 3", () => {
  for (const file of ["launch-mac.command", "launch-linux.sh", "launch-windows.bat"]) {
    const text = read(file);
    assert.match(text, /server\.py/);
    assert.match(text, /Python 3/);
  }
  const server = read("server.py");
  assert.match(server, /127\.0\.0\.1/);
  assert.match(server, /8806/);
  assert.match(server, /no-browser/);
});

test("the page is a local canvas module with no CDN", () => {
  const html = read("index.html");
  assert.match(html, /<canvas/);
  assert.match(html, /src\/ui\/main\.js/);
  assert.match(html, /type="module"/);
  assert.doesNotMatch(html, /cdn\.|https?:\/\//);
});

test("core modules stay free of DOM and canvas", () => {
  const core = path.join(root, "src", "core");
  for (const name of fs.readdirSync(core)) {
    const text = fs.readFileSync(path.join(core, name), "utf8");
    assert.doesNotMatch(text, /\b(document|window|localStorage|HTMLCanvasElement)\b/, name);
  }
});
