import { GET, POST, Path, Security } from "typescript-rest";

@Path("secure")
@Security(["ROLE_1", "ROLE_2"], "access_token")
export class SecureEndpoint {
  @GET
  public get(): string {
    return "Access Granted";
  }

  @POST
  @Security([], "user_email")
  public post(): string {
    return "Posted";
  }
}