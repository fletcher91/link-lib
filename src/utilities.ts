/* global chrome */
import {
    BlankNode,
    NamedNamespace,
    NamedNode,
    Namespace,
    SomeTerm,
    Statement,
    TermIsh,
} from "rdflib";

import { ExtensionResponse, NamespaceMap, SomeNode } from "./types";

import Port = chrome.runtime.Port;

let termIndex = 0;
const termMap: Array<BlankNode|NamedNode> = [];
const nsMap: { [k: string]: NamedNode }  = {};
const bnMap: { [k: string]: BlankNode }  = {};

export function namedNodeByStoreIndex(un: number): NamedNode | undefined {
    const term = termMap[un];
    if (!term) {
        return undefined;
    }
    if (term.termType === "NamedNode") {
        return term;
    }

    return undefined;
}

export function nodeByStoreIndex(un: number): BlankNode | NamedNode | undefined {
    return termMap[un];
}

export function blankNodeById(id: string): BlankNode {
    const fromMap = bnMap[id];
    if (fromMap !== undefined) {
        return fromMap;
    }

    return addBn(new BlankNode(id));
}

export function namedNodeByIRI(iri: string): NamedNode {
    const fromMap = nsMap[iri];
    if (fromMap !== undefined) {
        return fromMap;
    }
    const ln = iri.split(/[\/#]/).pop()!.split("?").shift() || "";

    return add(new NamedNode(iri), ln);
}

function add(nn: NamedNode, ln: string): NamedNode {
    nn.sI = ++termIndex;
    nn.term = ln;
    termMap[nn.sI] = nsMap[nn.value] = nn;

    return nn;
}

function addBn(bn: BlankNode): BlankNode {
    bn.sI = ++termIndex;
    termMap[bn.sI] = bnMap[bn.value] = bn;

    return bn;
}

export function memoizedNamespace(nsIRI: string): (ns: string) => NamedNode {
    const ns = Namespace(nsIRI);

    return (ln: string): NamedNode => {
        const fullIRI = nsIRI + ln;
        if (nsMap[fullIRI] !== undefined) {
            return nsMap[fullIRI];
        }

        return add(ns(ln), ln);
    };
}

export const defaultNS: Readonly<NamespaceMap> = Object.freeze({
    argu: memoizedNamespace("https://argu.co/ns/core#"),
    as: memoizedNamespace("https://www.w3.org/ns/activitystreams#"),
    bibo: memoizedNamespace("http://purl.org/ontology/bibo/"),
    cc: memoizedNamespace("http://creativecommons.org/ns#"),
    dbo: memoizedNamespace("http://dbpedia.org/ontology/"),
    dbp: memoizedNamespace("http://dbpedia.org/property/"),
    dbpedia: memoizedNamespace("http://dbpedia.org/resource/"),
    dc: memoizedNamespace("http://purl.org/dc/terms/"),
    ex: memoizedNamespace("http://example.com/ns#"),
    example: memoizedNamespace("http://www.example.com/"),
    fhir: memoizedNamespace("http://hl7.org/fhir/"),
    fhir3: memoizedNamespace("http://hl7.org/fhir/STU3"),
    foaf: memoizedNamespace("http://xmlns.com/foaf/0.1/"),
    geo: memoizedNamespace("http://www.w3.org/2003/01/geo/wgs84_pos#"),
    http: memoizedNamespace("http://www.w3.org/2011/http#"),
    http07: memoizedNamespace("http://www.w3.org/2007/ont/http#"),
    httph: memoizedNamespace("http://www.w3.org/2007/ont/httph#"),
    hydra: memoizedNamespace("http://www.w3.org/ns/hydra/core#"),
    ianalr: memoizedNamespace("http://www.iana.org/assignments/link-relations/"),
    link: memoizedNamespace("http://www.w3.org/2007/ont/link#"),
    ll: memoizedNamespace("http://purl.org/link-lib/"),
    owl: memoizedNamespace("http://www.w3.org/2002/07/owl#"),
    p: memoizedNamespace("http://www.wikidata.org/prop/"),
    prov: memoizedNamespace("http://www.w3.org/ns/prov#"),
    rdf: memoizedNamespace("http://www.w3.org/1999/02/22-rdf-syntax-ns#"),
    rdfs: memoizedNamespace("http://www.w3.org/2000/01/rdf-schema#"),
    schema: memoizedNamespace("http://schema.org/"),
    sh: memoizedNamespace("http://www.w3.org/ns/shacl#"),
    skos: memoizedNamespace("http://www.w3.org/2004/02/skos/core#"),
    wd: memoizedNamespace("http://www.wikidata.org/entity/"),
    wdata: memoizedNamespace("https://www.wikidata.org/wiki/Special:EntityData/"),
    wdref: memoizedNamespace("http://www.wikidata.org/reference/"),
    wds: memoizedNamespace("http://www.wikidata.org/entity/statement/"),
    wdt: memoizedNamespace("http://www.wikidata.org/prop/direct/"),
    wdv: memoizedNamespace("http://www.wikidata.org/value/"),
    xmlns: memoizedNamespace("http://www.w3.org/2000/xmlns/"),
    xsd: memoizedNamespace("http://www.w3.org/2001/XMLSchema#"),
});

export const DEFAULT_TOPOLOGY: NamedNode = defaultNS.ll("defaultTopology");

/** Constant used to determine that a class is used to render a type rather than a property. */
export const RENDER_CLASS_NAME: NamedNode = defaultNS.ll("typeRenderClass");

/**
 * Filters {obj} to only include statements where the subject equals {predicate}.
 * @param obj The statements to filter.
 * @param predicate The subject to filter for.
 * @return A possibly empty filtered array of statements.
 */
export function allRDFPropertyStatements(obj: Statement[] | undefined, predicate: SomeNode): Statement[] {
    if (typeof obj === "undefined") {
        return [];
    }

    return obj.filter((s) => s.predicate.equals(predicate));
}

/**
 * Filters {obj} on subject {predicate} returning the resulting statements' objects.
 * @see allRDFPropertyStatements
 */
export function allRDFValues(obj: Statement[], predicate: SomeNode): SomeTerm[] {
    const props = allRDFPropertyStatements(obj, predicate);
    if (props.length === 0) {
        return [];
    }

    return props.map((s) => s.object);
}

/**
 * Resolve {predicate} to any value, if any. If present, additional values are ignored.
 */
export function anyRDFValue(obj: Statement[] | undefined, predicate: SomeNode): SomeTerm | undefined {
    if (!Array.isArray(obj)) {
        return undefined;
    }

    const match = obj.find((s) => s.predicate.equals(predicate));
    if (typeof match === "undefined") {
        return undefined;
    }

    return match.object;
}

const CI_MATCH_PREFIX = 0;
const CI_MATCH_SUFFIX = 1;

/**
 * Expands a property if it's in short-form while preserving long-form.
 * Note: The vocabulary needs to be present in the store prefix library
 * @param prop The short- or long-form property
 * @param namespaces Object of namespaces by their abbreviation.
 * @returns The (expanded) property
 */
export function expandProperty(prop: NamedNode | TermIsh | string | undefined,
                               namespaces: NamespaceMap = defaultNS): NamedNode | undefined {
    if (prop instanceof NamedNode || typeof prop === "undefined") {
        return prop;
    }
    if (typeof prop === "object") {
        if (prop.termType === "NamedNode") {
            return namedNodeByIRI(prop.value);
        }

        return undefined;
    }

    if (prop.indexOf("/") >= 1) {
        return namedNodeByIRI(prop);
    }
    const matches = prop.split(":");
    const constructor: NamedNamespace | undefined = namespaces[matches[CI_MATCH_PREFIX]];

    return constructor && constructor(matches[CI_MATCH_SUFFIX]);
}

export function getPropBestLang(rawProp: Statement | Statement[], langPrefs: string[]): SomeTerm {
    if (!Array.isArray(rawProp)) {
        return rawProp.object;
    }
    if (rawProp.length === 1) {
        return rawProp[0].object;
    }
    for (const lang of langPrefs) {
        const pIndex = rawProp.findIndex((p) => "language" in p.object && p.object.language === lang);
        if (pIndex >= 0) {
            return rawProp[pIndex].object;
        }
    }

    return rawProp[0].object;
}

export function getPropBestLangRaw(statements: Statement | Statement[], langPrefs: string[]): Statement {
    if (!Array.isArray(statements)) {
        return statements;
    }
    if (statements.length === 1) {
        return statements[0];
    }
    for (const lang of langPrefs) {
        const pIndex = statements.findIndex((s) => "language" in s.object && s.object.language === lang);
        if (pIndex >= 0) {
            return statements[pIndex];
        }
    }

    return statements[0];
}

export function getTermBestLang(rawTerm: SomeTerm | SomeTerm[], langPrefs: string[]): SomeTerm {
    if (!Array.isArray(rawTerm)) {
        return rawTerm;
    }
    if (rawTerm.length === 1) {
        return rawTerm[0];
    }
    for (const lang of langPrefs) {
        const pIndex = rawTerm.findIndex((p) => "language" in p && p.language === lang);
        if (pIndex >= 0) {
            return rawTerm[pIndex];
        }
    }

    return rawTerm[0];
}

export function fetchWithExtension(iri: SomeNode | string, formats: string): Promise<ExtensionResponse> {
    const c = getExtention();
    if (c !== undefined) {
        return new Promise((resolve): void => {
            c.onMessage.addListener((message: object, port: Port) => {
                port.disconnect();
                c.disconnect();
                resolve(message as ExtensionResponse);
            });
            c.postMessage({
                accept: formats,
                fetch: iri,
            });
        });
    }
    throw new Error("NoExtensionInstalledError");
}

/**
 * Tries to resolve the data extension.
 * @internal
 */
export function getExtention(): Port | undefined {
    // if (typeof chrome !== "undefined" && typeof chrome.runtime.connect !== "undefined") {
    //     return chrome.runtime.connect("kjgnkcpcclnlchifkbbnekmgmcefhagd");
    // }

    return undefined;
}

/**
 * Checks if the origin of {href} matches current origin from {window.location}
 * @returns `true` if matches, `false` otherwise.
 */
export function isDifferentOrigin(href: SomeNode | string): boolean {
    if (href instanceof BlankNode) {
        return false;
    }
    const origin = href instanceof NamedNode ? href.value : href;

    return !origin.startsWith(self.location.origin + "/");
}

export function normalizeType<T1>(type: T1 | T1[]): T1[] {
    return Array.isArray(type) ? type : [type];
}