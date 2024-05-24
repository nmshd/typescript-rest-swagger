import { POST, Path } from "typescript-rest";
import { TestInterface as Test } from "./TestInterface";

interface A<T> extends Test {
  c: T;
}

@Path("type")
export class TypeEndpoint {
  @Path("obj")
  @POST
  public testPostObject(body: Test) : A<string> {
    return {
      c: "test",
      a: body.a,
      b: body.b,
    } as A<string>;
  }
}
