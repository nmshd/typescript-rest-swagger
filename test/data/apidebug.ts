import {
  PUT,
  Path,
  PathParam,
  QueryParam,
  Security
} from "@nmshd/typescript-rest";
import * as swagger from "../../src";

interface AddUsersToGroupRequest {
  userIds: string[];
  nanoChatIds: string[];
  name?: string;
}

@Path("secure")
@Security(["ROLE_1", "ROLE_2"], "access_token")
export class SecureEndpoint {


  @PUT
  @Path(":id/users")
  @swagger.Body<AddUsersToGroupRequest>()
  public async addUsersToGroup(
    @PathParam("id") id: string = "123",
    @QueryParam("id2") id2: string = "123",
    @QueryParam("notify") notify: boolean = true,
    body: any
  ): Promise<any> {
    return;
  }
}
