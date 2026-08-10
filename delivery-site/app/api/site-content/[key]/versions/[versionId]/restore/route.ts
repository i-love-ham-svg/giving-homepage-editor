import { restoreSiteVersion, siteContentRouteError } from "../../../../../../../lib/site-content-server";

export async function POST(request: Request, context: { params: Promise<{ key: string; versionId: string }> }) {
  try {
    const { key, versionId } = await context.params;
    return await restoreSiteVersion(request, key, versionId);
  } catch (error) { return siteContentRouteError(error); }
}
