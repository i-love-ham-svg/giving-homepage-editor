import { getSiteContent, saveSiteDraft, siteContentRouteError } from "../../../../lib/site-content-server";

export async function GET(request: Request, context: { params: Promise<{ key: string }> }) {
  try { return await getSiteContent(request, (await context.params).key); }
  catch (error) { return siteContentRouteError(error); }
}

export async function PUT(request: Request, context: { params: Promise<{ key: string }> }) {
  try { return await saveSiteDraft(request, (await context.params).key); }
  catch (error) { return siteContentRouteError(error); }
}
