import {
    FetchOpts,
    NamedNode,
    Statement,
} from "rdflib";

import { DataProcessor, DataProcessorOpts, emptyRequest } from "./processor/DataProcessor";
import {
    EmptyRequestStatus,
    FulfilledRequestStatus,
    ResponseTransformer,
    SomeNode,
} from "./types";

export interface LinkedDataAPIOpts {
    dataProcessorOpts?: DataProcessorOpts;
    processor?: DataProcessor;
}

export class LinkedDataAPI {
    private processor: DataProcessor;

    public constructor(opts: LinkedDataAPIOpts) {
        this.processor = opts.processor || new DataProcessor(opts.dataProcessorOpts);
    }

    /**
     * Loads a resource from the {iri}.
     * @param iri The SomeNode of the resource
     * @return The response from the server, or an response object from
     * the extension
     */
    public fetchResource(iri: NamedNode): Promise<Response | object> {
        return this.processor.fetchResource(iri);
    }

    /**
     * Gets an entity by its SomeNode.
     *
     * When data is already present for the SomeNode as a subject, the stored data is returned,
     * otherwise the SomeNode will be fetched and processed.
     * @param iri The SomeNode of the resource
     * @param opts The options for fetch-/processing the resource.
     * @return A promise with the resulting entity
     */
    public getEntity(iri: NamedNode, opts?: FetchOpts): Promise<Statement[]> {
        return this.processor.getEntity(iri, opts);
    }

    /**
     * Retrieve the (network) status for a resource.
     *
     * This API is still unstable, but only the latest status should be taken into account. So if a resource was
     * successfully fetched at some point, but a retry failed, the result will be failed.
     *
     * Some cases don't have proper HTTP status codes, but some (unstandardized) codes are very close.
     *
     * Special errors:
     * - Resources which are still loading are given status `202 Accepted`.
     * - Resources where fetching timed out are given status `408 - Request Timeout`.
     * - Resources where fetching failed due to browser and OS errors are given status `499 - Client Closed Request`.
     * - Resources which haven't been requested and aren't scheduled to be requested currently have no status code.
     *
     * @param {SomeNode} iri The resource to get the status on.
     * @return {EmptyRequestStatus | FulfilledRequestStatus}
     */
    public getStatus(iri: SomeNode): EmptyRequestStatus | FulfilledRequestStatus {
        if (iri.termType === "BlankNode") {
            return emptyRequest as EmptyRequestStatus;
        }

        return this.processor.getStatus(iri);
    }

    /** Register a transformer so it can be used to interact with API's. */
    public registerTransformer(processor: ResponseTransformer,
                               mediaType: string | string[],
                               acceptValue: number): void {
        const mediaTypes: string[] = Array.isArray(mediaType) ? mediaType : [mediaType];
        this.processor.registerTransformer(processor, mediaTypes, acceptValue);
    }

    /**
     * Overrides the `Accept` value for when a certain host doesn't respond well to multiple values.
     * @param origin The iri of the origin for the requests.
     * @param acceptValue The value to use for the `Accept` header.
     */
    public setAcceptForHost(origin: string, acceptValue: string): void {
        this.processor.setAcceptForHost(origin, acceptValue);
    }
}