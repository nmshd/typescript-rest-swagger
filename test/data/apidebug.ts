import { POST, Path, QueryParam, Return } from "typescript-rest";
import { TestInterface } from "./TestInterface";


enum TestNumericEnum {
  Option1,
  Option2,
}

@Path("type")
export class TypeEndpoint {
  @Path("obj")
  @POST
  public testPostObject(
    // data: TestInterface,
    @QueryParam("query") query: TestNumericEnum,
  ) {
    return new Return.NewResource("location", query);
  }
}
type Unpack<T> = {
  [K in keyof T]: T[K] extends object ? Unpack<T[K]> : T[K];
} & {};

type UnpackAlt<T> = {
  [K in keyof T]: UnpackAlt<T[K]>;
} & {};

type __Simplify<T> = { [KeyType in keyof T]: T[KeyType] } & {};

type a = __Simplify<TestInterface>;

// type C = Unpack<GenericA<Deep<End[], Error>, Error>>;






class A {
  public a:string;
  private b:string;
  constructor(a:string){
    this.a = a;
  }
}

class B {
  public a:string;
  private b:string;
  constructor(a:string){
    this.a = a;
  }
}



function someFn(a:A):B{
  return a;
}


let paramA:A = new A("a");
let paramB:B = new B("b");

paramA = paramB;

paramA = someFn(paramA)