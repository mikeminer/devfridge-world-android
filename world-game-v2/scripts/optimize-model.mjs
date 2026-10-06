import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import {
  dedup, instance, palette, flatten, join, weld, simplify, resample,
  prune, sparse, textureCompress, draco, meshopt, unpartition,
} from "@gltf-transform/functions";
import draco3d from "draco3dgltf";
import { ready as resampleReady, resample as resampleWASM } from "keyframe-resample";
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from "meshoptimizer";
import sharp from "sharp";

let dependencies;

/** Local-file I/O only. No CLI glob parser or HTTP fetch is registered. */
export async function createModelIO() {
  dependencies ??= Promise.all([
    draco3d.createDecoderModule(), draco3d.createEncoderModule(),
    MeshoptDecoder.ready, MeshoptEncoder.ready, MeshoptSimplifier.ready,
  ]).then(([decoder, encoder]) => ({
    "draco3d.decoder": decoder,
    "draco3d.encoder": encoder,
    "meshopt.decoder": MeshoptDecoder,
    "meshopt.encoder": MeshoptEncoder,
  }));
  return new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies(await dependencies);
}

/** Same optimization defaults as glTF Transform 4.5.1 CLI for these two workflows. */
export async function optimizeModel(input, output, { compress = "meshopt", textureFormat } = {}) {
  if (compress !== "meshopt" && compress !== "draco") {
    throw new Error(`Unsupported compression method: ${compress}`);
  }
  if (textureFormat !== undefined && textureFormat !== "webp") {
    throw new Error(`Unsupported texture format: ${textureFormat}`);
  }
  const io = await createModelIO();
  const document = await io.read(input);
  for (const extension of ["KHR_draco_mesh_compression", "EXT_meshopt_compression"]) {
    if (document.hasExtension(extension)) {
      document.disposeExtension(extension);
      console.warn(`Decoded ${extension}; recompression is lossy. Keep the original asset.`);
    }
  }
  await document.transform(
    dedup(), instance(), palette(), flatten(), join(), weld(),
    simplify({ simplifier: MeshoptSimplifier }),
    resample({ ready: resampleReady, resample: resampleWASM }),
    prune({ keepAttributes: false, keepIndices: false, keepLeaves: false, keepSolidTextures: false }),
    sparse(),
    textureCompress({ encoder: sharp, resize: [2048, 2048], targetFormat: textureFormat, limitInputPixels: true }),
    compress === "draco" ? draco() : meshopt({ encoder: MeshoptEncoder, level: "high" }),
    unpartition(),
  );
  await io.write(output, document);
}
