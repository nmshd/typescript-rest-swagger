import { POST, Path } from "typescript-rest";
import { TestInterface as Test } from "./TestInterface";

interface A<T> extends Test {
  c: T;
}

@Path("type")
export class TypeEndpoint<T extends Test> {
  @Path("obj")
  @POST
  public testPostObject(body: T) : A<string> {
    return {
      c: "test",
      a: body.a,
      b: body.b,
    } as A<string>;
  }
}
