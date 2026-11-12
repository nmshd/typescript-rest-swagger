import { GET, Path } from "@nmshd/typescript-rest";
import { FirstResponse } from "./firstResponse";
import { SecondResponse } from "./secondResponse";

class Envelope<T> {
    // Declaration output can retain this union even when the generator disables strict null checks.
    public constructor(public result?: T | undefined) {}
}

@Path("generic-responses")
export class GenericResponses {
    @GET
    @Path("first")
    public async first(): Promise<Envelope<FirstResponse>> {
        return { result: { isSuccess: false, code: "first", message: "first" } };
    }

    @GET
    @Path("second")
    public async second(): Promise<Envelope<SecondResponse>> {
        return { result: { isSuccess: false, code: "second", message: "second" } };
    }

    @GET
    @Path("string")
    public async stringResult(): Promise<Envelope<{ value: string }>> {
        return { result: { value: "test" } };
    }

    @GET
    @Path("number")
    public async numberResult(): Promise<Envelope<{ value: number }>> {
        return { result: { value: 42 } };
    }
}
