import { GET, Path, PathParam } from "typescript-rest";

type SomeDeepType = {
    name:string;
    value: {key:string};
  }
  type SomeDeepType2 = {
    name:string;
    value: {key:string};
  }
  


export type SimpleHelloType = {
    /**
     * Description for greeting property
     */
    // greeting: string;
    // arrayOfUnion: Array<string | number>;
    // arrayOfUnion2: (string | number)[];
    union: SomeDeepType2 | SomeDeepType;
    // arrayOfUnion3: Array<SomeDeepType2 | SomeDeepType>;
  
    // /**
    //  * Description for profile
    //  */
    // profile: {
    //   /**
    //    * Description for profile name
    //    */
    //   name: string;
    //   name2: "value";
    //   name3: { value: "value1" | "value2" };
    //   name4: 2;
    // };
  
    // comparePassword: (
    //   candidatePassword: string,
    //   cb: (err: any, isMatch: any) => {}
    // ) => void;
  };

@Path("type")
export class TypeEndpoint {
  @GET
  @Path(":param/2")
  public test2(@PathParam("param") param: string): Promise<SimpleHelloType> {
    return new Promise<SimpleHelloType>((resolve, reject) => {
      // content
    });
  }
}
