import { publishSiteContent, siteContentRouteError } from "../../../../../lib/site-content-server";

export async function POST(request: Request, context: { params: Promise<{ key: string }> }) {
  try { return await publishSiteContent(request, (await context.params).key); }
  catch (error) { return siteContentRouteError(error); }
}
