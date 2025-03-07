import * as swc from "@swc/core";
import slash from "slash";
import { mkdirSync, writeFileSync } from "fs";
import { dirname, relative } from "path";


export async function transform(
  filename: string,
  code: string,
  opts: swc.Options,
  sync: boolean
): Promise<swc.Output> {
  opts = {
    filename,
    ...opts
  };

  if (sync) {
    return swc.transformSync(code, opts);
  }

  return swc.transform(code, opts);
}

export async function compile(
  filename: string,
  opts: swc.Options,
  sync: boolean
): Promise<swc.Output | void> {
  opts = {
    ...opts
  };

  try {
    const result = sync
      ? swc.transformFileSync(filename, opts)
      : await swc.transformFile(filename, opts);

    if (result.map) {
      // TODO: fix this in core
      // https://github.com/swc-project/swc/issues/1388
      const sourceMap = JSON.parse(result.map);
      if (opts.sourceFileName) {
        sourceMap['sources'][0] = opts.sourceFileName;
      }
      if (opts.sourceRoot) {
        sourceMap['sourceRoot'] = opts.sourceRoot;
      }
      result.map = JSON.stringify(sourceMap);
    }
    return result;
  } catch (err) {
    if (!err.message.includes("ignored by .swcrc")) {
      throw err;
    }
  }
}

export function outputFile(
  output: swc.Output,
  filename: string,
  sourceMaps: swc.Options['sourceMaps']
) {
  const destDir = dirname(filename);
  mkdirSync(destDir, { recursive: true });

  let code = output.code;
  if (output.map && sourceMaps && sourceMaps !== "inline") {
    // we've requested for a sourcemap to be written to disk
    const fileDirName = dirname(filename);
    const mapLoc = filename + ".map";
    code += "\n//# sourceMappingURL=" + slash(relative(fileDirName, mapLoc));
    writeFileSync(mapLoc, output.map);
  }

  writeFileSync(filename, code);
}


export function assertCompilationResult<T>(
  result: Map<string, Error | T>,
  quiet = false
): asserts result is Map<string, T> {
  let compiled = 0;
  let copied = 0;
  let failed = 0;
  for (const value of result.values()) {
    if (value instanceof Error) {
      failed++;
    } else if (value as unknown === 'copied') {
      copied++;
    } else if (value) {
      compiled++;
    }
  }
  if (!quiet && compiled + copied > 0) {
    const copyResult = copied === 0 ? " " : ` (copied ${copied}) `;
    console.info(
      `Successfully compiled ${compiled} ${compiled !== 1 ? "files" : "file"}${copyResult}with swc.`
    );
  }

  if (failed > 0) {
    throw new Error(
      `Failed to compile ${failed} ${failed !== 1 ? "files" : "file"} with swc.`
    );
  }
}
