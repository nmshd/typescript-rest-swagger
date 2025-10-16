import { Accept, FileParam, FormParam, POST, Path, Security } from "@nmshd/typescript-rest";

enum TestNumericEnum {
  First,
  Second,
  Third,
}

@Path("secure")
@Security(["ROLE_1", "ROLE_2"], "access_token")
export class SecureEndpoint {
    @POST
    @Path("/Own")
    @Accept("application/json")
    public uploadOwnFile(
        @FormParam("expiresAt") expiresAt: string,
        @FormParam("title") title?: string,
        @FileParam("file") file?: Express.Multer.File,
        @FormParam("description") description?: string,
        @FormParam("tags") tags?: string[]
    ): any {
        return {};
    }

  @POST
  @Security(["**"], "user_email")
  public post(): string {
    return "Posted";
  }
}
