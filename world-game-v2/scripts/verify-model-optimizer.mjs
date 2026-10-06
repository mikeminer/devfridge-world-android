import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createModelIO, optimizeModel } from "./optimize-model.mjs";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const baselinePath = join(root, "../evidence/optimizer-cli-4.5.1-baseline.json");
const record = process.argv.includes("--record-baseline");
const fixtures = ["rugarugo", "gmgnocco", "moonzarella"];
const modes = [{ compress: "meshopt" }, { compress: "draco", textureFormat: "webp" }];
const run = promisify(execFile);
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const scratch = await mkdtemp(join(tmpdir(), "devfridge-optimizer-"));

async function describe(path) {
  const bytes = await readFile(path);
  const io = await createModelIO();
  const document = await io.read(path); // Decode each actual compressed output.
  const model = document.getRoot();
  return {
    bytes: bytes.length,
    sha256: sha256(bytes),
    meshes: model.listMeshes().length,
    primitives: model.listMeshes().flatMap((mesh) => mesh.listPrimitives()).length,
    vertices: model.listMeshes().flatMap((mesh) => mesh.listPrimitives())
      .reduce((count, primitive) => count + (primitive.getAttribute("POSITION")?.getCount() || 0), 0),
    materials: model.listMaterials().length,
    textures: model.listTextures().map((texture) => ({
      type: texture.getMimeType(), size: texture.getSize(), sha256: sha256(texture.getImage()),
    })),
    skins: model.listSkins().length,
    animations: model.listAnimations().length,
    extensions: model.listExtensionsUsed().map((extension) => extension.extensionName).sort(),
  };
}

try {
  const baseline = record ? { cliVersion: "4.5.1", fixtures: [] } : JSON.parse(await readFile(baselinePath, "utf8"));
  if (record) {
    const cliPackage = JSON.parse(await readFile(join(root, "node_modules/@gltf-transform/cli/package.json"), "utf8"));
    assert.equal(cliPackage.version, "4.5.1");
  }
  let verified = 0;
  for (const id of fixtures) {
    const input = join(root, "../scan/public/world/game-v2/models", `${id}.glb`);
    const inputHash = sha256(await readFile(input));
    for (const options of modes) {
      const name = `${id}-${options.compress}`;
      let expected;
      if (record) {
        const output = join(scratch, `${name}-cli.glb`);
        const args = [join(root, "node_modules/@gltf-transform/cli/bin/cli.js"), "optimize", input, output,
          "--compress", options.compress];
        if (options.textureFormat) args.push("--texture-compress", options.textureFormat);
        await run(process.execPath, args, { windowsHide: true, maxBuffer: 4 * 1024 * 1024 });
        expected = { id, options, inputHash, output: await describe(output) };
        baseline.fixtures.push(expected);
      } else {
        expected = baseline.fixtures.find((fixture) => fixture.id === id && fixture.options.compress === options.compress);
        assert.ok(expected, `Missing baseline: ${name}`);
        assert.equal(inputHash, expected.inputHash, `Input differs from pinned baseline: ${id}`);
      }
      const output = join(scratch, `${name}-api.glb`);
      await optimizeModel(input, output, options);
      const actual = await describe(output);
      assert.deepEqual(actual, expected.output, `API output differs from CLI 4.5.1: ${name}`);
      console.log(`PASS ${name}: decoded output and SHA-256 equal CLI 4.5.1 (${actual.bytes} bytes)`);
      verified++;
    }
  }
  if (record) {
    await mkdir(dirname(baselinePath), { recursive: true });
    await writeFile(baselinePath, JSON.stringify(baseline, null, 2) + "\n");
  }
  console.log(`Verified ${verified} optimizer outputs using ${fixtures.length} real pinned character assets.`);
} finally {
  assert.equal(dirname(resolve(scratch)), resolve(tmpdir()), "Temporary output escaped the system temp directory");
  assert.ok(basename(scratch).startsWith("devfridge-optimizer-"), "Unexpected temporary output directory");
  await rm(scratch, { recursive: true, force: true });
}
