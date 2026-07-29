import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import vm from "node:vm";

const htmlPath = resolve("outputs", "representative-greeting-editor.html");
const html = readFileSync(htmlPath, "utf8");
const inlineScripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].map((match) => match[1]);

if (!inlineScripts.length) throw new Error("inline editor script was not found");
inlineScripts.forEach((source, index) => new vm.Script(source, { filename: `${htmlPath}#inline-${index + 1}` }));
console.log("editor HTML script syntax OK");
