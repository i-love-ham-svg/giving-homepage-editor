import { listSiteVersions, siteContentRouteError } from "../../../../../lib/site-content-server";

export async function GET(request: Request, context: { params: Promise<{ key: string }> }) {
  try { return await listSiteVersions(request, (await context.params).key); }
  catch (error) { return siteContentRouteError(error); }
}
