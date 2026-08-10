import { assertSameOrigin, json } from "../../../lib/board-server";
import { siteAssetRouteError, uploadSiteAsset } from "../../../lib/site-asset-server";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    return json({ item: await uploadSiteAsset(request) }, { status: 201 });
  } catch (error) {
    return siteAssetRouteError(error);
  }
}
