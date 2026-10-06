import { copyFile, mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { optimizeModel } from "./optimize-model.mjs";

const root = dirname(fileURLToPath(import.meta.url));
const v2 = join(root, "../../scan/public/world/game-v2");
const decoderSrc = join(root, "../node_modules/three/examples/jsm/libs/meshopt_decoder.module.js");
const ids = [
  "rugarugo",
  "aperitivo",
  "friedfomo",
  "fudfusilli",
  "lambocello",
  "gmgnocco",
  "sersugo",
  "moonzarella",
  "bonkatino",
  "ciccia",
];

await mkdir(join(v2, "vendor"), { recursive: true });
await copyFile(decoderSrc, join(v2, "vendor", "meshopt_decoder.module.js"));

await Promise.all(
  ids.map(async (id) => {
    const src = join(v2, "models", `${id}.glb`);
    const tmp = join(v2, "models", `${id}.meshopt.glb`);
    await optimizeModel(src, tmp, { compress: "meshopt" });
    await copyFile(tmp, src);
    await unlink(tmp);
  }),
);

const jsPath = join(v2, "assets", "cold-storage.js");
let js = await readFile(jsPath, "utf8");
const old = "async load(e){let t=new oh,n=new Bu,";
const next = "async load(e){let t=new oh;if(self.__dfMeshopt)t.setMeshoptDecoder(self.__dfMeshopt);let n=new Bu,";
if (!js.includes(old)) throw new Error("load() start not found");
if (!js.includes("setMeshoptDecoder(self.__dfMeshopt)")) js = js.replace(old, next);
await writeFile(jsPath, js);
console.log("meshopt hooked");
