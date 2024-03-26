import { POST, Path } from "typescript-rest";

interface B {
  a: string;
}
interface D {
  a: string;
}

export interface A<K, T extends B = B> {
  c: T;
  // export interface A<K>{
  d: K;
}
@Path("type")
export class TypeEndpoint {
  @Path("obj")
  @POST
  public testPostObject(data: A<D>) {
    return data;
  }
}
