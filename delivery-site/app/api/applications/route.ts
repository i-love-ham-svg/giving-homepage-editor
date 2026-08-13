import {
  applicationRouteError,
  listApplications,
  submitApplication,
} from "../../../lib/application-server";

export async function POST(request: Request) {
  try {
    return await submitApplication(request);
  } catch (error) {
    return applicationRouteError(error);
  }
}

export async function GET(request: Request) {
  try {
    return await listApplications(request);
  } catch (error) {
    return applicationRouteError(error);
  }
}
