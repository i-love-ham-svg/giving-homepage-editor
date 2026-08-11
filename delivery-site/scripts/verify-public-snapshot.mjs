import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const DEFAULT_DOCUMENT_KEY = "songak-homepage";
export const DEFAULT_TIMEOUT_MS = 15_000;

export class DeploymentGateError extends Error {
  constructor(message, code = "DEPLOYMENT_GATE_FAILED") {
    super(message);
    this.name = "DeploymentGateError";
    this.code = code;
  }
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function validateHostingManifest(manifest) {
  if (!isRecord(manifest)) {
    throw new DeploymentGateError("배포 설정 파일은 JSON 객체여야 합니다.", "INVALID_HOSTING_MANIFEST");
  }
  if (typeof manifest.project_id !== "string" || !/^appgprj_[a-z0-9]+$/i.test(manifest.project_id)) {
    throw new DeploymentGateError("배포 설정에 올바른 project_id가 없습니다.", "INVALID_PROJECT_ID");
  }
  if (manifest.d1 !== "DB") {
    throw new DeploymentGateError("공개 홈페이지 저장소인 D1 바인딩(DB)이 없습니다.", "MISSING_D1_BINDING");
  }
  if (manifest.r2 !== "MEDIA") {
    throw new DeploymentGateError("홈페이지 이미지 저장소인 R2 바인딩(MEDIA)이 없습니다.", "MISSING_R2_BINDING");
  }
  return manifest;
}

export async function readHostingManifest(manifestPath) {
  let parsed;
  try {
    parsed = JSON.parse(await readFile(manifestPath, "utf8"));
  } catch (error) {
    throw new DeploymentGateError(`배포 설정 파일을 읽을 수 없습니다: ${error.message}`, "UNREADABLE_HOSTING_MANIFEST");
  }
  return validateHostingManifest(parsed);
}

export function validatePublishedSnapshotPayload(payload, documentKey = DEFAULT_DOCUMENT_KEY) {
  if (!isRecord(payload)) {
    throw new DeploymentGateError("공개 API 응답은 JSON 객체여야 합니다.", "INVALID_PUBLIC_PAYLOAD");
  }
  if (payload.key !== documentKey) {
    throw new DeploymentGateError(`공개 API 문서 키가 다릅니다: ${String(payload.key || "없음")}`, "WRONG_DOCUMENT_KEY");
  }
  if (!Number.isInteger(payload.revision) || payload.revision <= 0) {
    throw new DeploymentGateError(
      `공개 홈페이지가 게시되지 않았습니다(revision: ${String(payload.revision)}).`,
      "UNPUBLISHED_REVISION",
    );
  }
  if (!isRecord(payload.content) || Object.keys(payload.content).length === 0) {
    throw new DeploymentGateError("공개 홈페이지 데이터가 비어 있습니다(content가 null 또는 빈 객체).", "EMPTY_PUBLIC_CONTENT");
  }

  const documentSections = payload.content.document?.sections;
  const legacySectionOrder = payload.content.content?.sectionOrder;
  const hasCanonicalSections = Array.isArray(documentSections) && documentSections.length > 0;
  const hasLegacySections = Array.isArray(legacySectionOrder) && legacySectionOrder.length > 0;
  if (!hasCanonicalSections && !hasLegacySections) {
    throw new DeploymentGateError("공개 홈페이지 데이터에 표시할 섹션이 없습니다.", "EMPTY_PUBLIC_SECTIONS");
  }
  if (typeof payload.publishedAt !== "string" || Number.isNaN(Date.parse(payload.publishedAt))) {
    throw new DeploymentGateError("공개 홈페이지의 게시 시각을 확인할 수 없습니다.", "MISSING_PUBLISHED_AT");
  }

  return {
    key: payload.key,
    revision: payload.revision,
    publishedAt: payload.publishedAt,
    sectionCount: hasCanonicalSections ? documentSections.length : legacySectionOrder.length,
  };
}

export async function verifyPublicSnapshot({
  baseUrl,
  documentKey = DEFAULT_DOCUMENT_KEY,
  fetchImpl = globalThis.fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
} = {}) {
  if (typeof fetchImpl !== "function") {
    throw new DeploymentGateError("공개 API를 확인할 fetch 함수가 없습니다.", "FETCH_UNAVAILABLE");
  }

  let origin;
  try {
    const parsed = new URL(baseUrl);
    if (!/^https?:$/.test(parsed.protocol)) throw new Error("http 또는 https 주소가 아닙니다");
    origin = parsed.origin;
  } catch (error) {
    throw new DeploymentGateError(`확인할 사이트 주소가 올바르지 않습니다: ${error.message}`, "INVALID_BASE_URL");
  }

  const endpoint = new URL(`/api/site-content/${encodeURIComponent(documentKey)}`, origin);
  endpoint.searchParams.set("deployment_gate", String(Date.now()));
  let response;
  try {
    response = await fetchImpl(endpoint, {
      method: "GET",
      cache: "no-store",
      headers: {
        accept: "application/json",
        "cache-control": "no-cache",
      },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    throw new DeploymentGateError(`공개 API에 연결할 수 없습니다: ${error.message}`, "PUBLIC_API_UNREACHABLE");
  }

  if (!response.ok) {
    throw new DeploymentGateError(`공개 API 확인에 실패했습니다(HTTP ${response.status}).`, "PUBLIC_API_HTTP_ERROR");
  }
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("application/json")) {
    throw new DeploymentGateError(`공개 API가 JSON을 반환하지 않습니다(${contentType || "content-type 없음"}).`, "PUBLIC_API_NOT_JSON");
  }

  let payload;
  try {
    payload = await response.json();
  } catch (error) {
    throw new DeploymentGateError(`공개 API JSON을 해석할 수 없습니다: ${error.message}`, "INVALID_PUBLIC_JSON");
  }
  return validatePublishedSnapshotPayload(payload, documentKey);
}

function parseCliArguments(argv) {
  const options = {
    baseUrl: process.env.SONGAK_SITE_URL || "",
    documentKey: process.env.SONGAK_SITE_DOCUMENT_KEY || DEFAULT_DOCUMENT_KEY,
    manifestPath: process.env.SONGAK_HOSTING_MANIFEST || path.resolve(process.cwd(), ".openai", "hosting.json"),
  };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--base-url") options.baseUrl = argv[++index] || "";
    else if (value === "--document-key") options.documentKey = argv[++index] || "";
    else if (value === "--manifest") options.manifestPath = path.resolve(argv[++index] || "");
    else throw new DeploymentGateError(`알 수 없는 옵션입니다: ${value}`, "UNKNOWN_ARGUMENT");
  }
  if (!options.baseUrl) {
    throw new DeploymentGateError("--base-url 또는 SONGAK_SITE_URL로 배포 주소를 지정해 주세요.", "MISSING_BASE_URL");
  }
  return options;
}

async function main() {
  const options = parseCliArguments(process.argv.slice(2));
  await readHostingManifest(options.manifestPath);
  const result = await verifyPublicSnapshot(options);
  console.log(`배포 검증 통과: 공개 홈페이지 ${result.sectionCount}개 섹션, revision ${result.revision}`);
}

const isDirectExecution = process.argv[1]
  && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isDirectExecution) {
  main().catch((error) => {
    console.error(`배포 검증 실패: ${error.message}`);
    process.exitCode = 1;
  });
}
