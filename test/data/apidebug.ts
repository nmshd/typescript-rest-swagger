import { POST, Path } from "typescript-rest";

interface End {
  id: string;
}

export interface EndArrayRenamed extends Array<End> {}

interface Error {
  text: string;
}

interface Deep<C, D> {
  data: C;
  error: D;
}

interface GenericA<A, B = boolean> {
  d: Deep<string, string>;
  deep: A;
  error: B;
}

@Path("type")
export class TypeEndpoint {
  @Path("obj")
  @POST
  public testPostObject(data: GenericA<Deep<End[], Error>>) {
    return data;
  }
}
type Unpack<T> = {
  [K in keyof T]: T[K] extends object ? Unpack<T[K]> : T[K];
} & {};

type UnpackAlt<T> = {
  [K in keyof T]: UnpackAlt<T[K]>;
} & {};

type __Simplify<T> = { [KeyType in keyof T]: T[KeyType] } & {};

// type C = Unpack<GenericA<Deep<End[], Error>, Error>>;
