import { serveSiteAsset, siteAssetRouteError } from "../../../../lib/site-asset-server";

type Context = { params: Promise<{ assetId: string }> };

export async function GET(request: Request, context: Context) {
  try {
    const { assetId } = await context.params;
    return await serveSiteAsset(request, assetId);
  } catch (error) {
    return siteAssetRouteError(error);
  }
}

export async function HEAD(request: Request, context: Context) {
  try {
    const { assetId } = await context.params;
    return await serveSiteAsset(request, assetId, true);
  } catch (error) {
    return siteAssetRouteError(error);
  }
}
