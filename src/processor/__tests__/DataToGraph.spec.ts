/* @globals set, generator, init */
import "../../__tests__/useHashFactory";

import rdfFactory, { TermType } from "@ontologies/core";
import rdf from "@ontologies/rdf";
import schema from "@ontologies/schema";
import xsd from "@ontologies/xsd";
import "jest";

import ex from "../../ontology/ex";
import example from "../../ontology/example";
import ll from "../../ontology/ll";
import { Node } from "../../rdf";
import RDFIndex from "../../store/RDFIndex";

import { dataToGraphTuple, list, processObject, seq, toGraph } from "../DataToGraph";

describe("DataToGraph", () => {
    const exampleMap = { example };

    it("returns empty objects without data", () => {
        const [graph, blobs] = dataToGraphTuple({});
        expect(graph.quads).toHaveLength(0);
        expect(blobs).toHaveLength(0);
    });

    describe("IRIs", () => {
        it("raises when only an IRI was given", () => {
            expect(() => {
                toGraph(example.ns("r"));
            }).toThrowError(TypeError);
        });

        it("raises when embedded is not a string", () => {
            expect(() => {
                toGraph({
                    "@id": 1,
                });
            }).toThrowError(TypeError);
        });

        it("parses an embedded iri", () => {
            const [iri] = toGraph({ "@id": "https://example.com/1" });

            expect(iri).toEqual(rdfFactory.namedNode("https://example.com/1"));
        });

        it("creates a blank node when no IRI was given", () => {
            const [iri] = toGraph({});

            expect(iri.termType).toEqual(TermType.BlankNode);
        });

        it("allows a custom graph to be passed", () => {
            const g = new RDFIndex();
            const [, graph] = toGraph({}, undefined, g);

            expect(graph).toEqual(g);
        });
    });

    describe("uri parsing", () => {
        it("handles uri strings", () => {
            const [graph, blobs] = dataToGraphTuple({ "http://schema.org/name": "Some name" });
            expect(graph.quads).toHaveLength(1);
            expect(blobs).toHaveLength(0);

            const name = graph.quads[0];
            expect(name).toBeTruthy();
            expect(name.subject).toEqual(ll.targetResource);
            expect(name.predicate).toEqual(schema.name);
            expect(name.object).toEqual(rdfFactory.literal("Some name"));
        });

        it("handles shortened strings", () => {
            const [graph, blobs] = dataToGraphTuple({ "schema:name": "Some name" }, { schema });
            expect(graph.quads).toHaveLength(1);
            expect(blobs).toHaveLength(0);

            const name = graph.quads[0];
            expect(name).toBeTruthy();
            expect(name.subject).toEqual(ll.targetResource);
            expect(name.predicate).toEqual(schema.name);
            expect(name.object).toEqual(rdfFactory.literal("Some name"));
        });

        it("raises on bad strings", () => {
            expect(() => {
                dataToGraphTuple({ schema_name: "Some name" });
            }).toThrow();
        });
    });

    describe("data type conversions", () => {
        it("handles arrays", () => {
            const data = { "example:property": [
                {
                    "@id": example.ns("nested"),
                    "example:nestedProp": "1",
                },
                2,
                schema.name,
            ]};
            const [graph] = dataToGraphTuple(data, exampleMap);

            const stmts = graph.match(ll.targetResource, example.ns("property"), null, null);
            expect(stmts).toHaveLength(3);

            const bn = stmts[0]!;
            expect(bn.subject).toEqual(ll.targetResource);
            expect(bn.predicate).toEqual(example.ns("property"));
            expect(bn.object).toEqual(example.ns("nested"));

            const nestedProp = graph.match(bn.object as Node, example.ns("nestedProp"), null, null);
            expect(nestedProp).toHaveLength(1);
            expect(nestedProp[0].object.termType).toEqual("Literal");
            expect(nestedProp[0].object.value).toEqual("1");

            const nn = stmts[2]!;
            expect(nn.subject).toEqual(ll.targetResource);
            expect(nn.predicate).toEqual(example.ns("property"));
            expect(nn.object.termType).toEqual("NamedNode");
            expect(nn.object.value).toEqual("http://schema.org/name");

            const lit = stmts[1]!;
            expect(lit.subject).toEqual(ll.targetResource);
            expect(lit.predicate).toEqual(example.ns("property"));
            expect(lit.object.termType).toEqual("Literal");
            expect(lit.object.value).toEqual("2");
        });

        it("handles booleans", () => {
            const data = { "example:property": true };
            const [graph] = dataToGraphTuple(data, exampleMap);
            const stmt = graph.quads[0];
            expect(stmt).toBeTruthy();
            expect(stmt.subject).toEqual(ll.targetResource);
            expect(stmt.predicate).toEqual(example.ns("property"));
            expect(stmt.object).toEqual(rdfFactory.literal(true));
        });

        it("handles dates", () => {
            const data = { "example:property": new Date() };
            const [graph] = dataToGraphTuple(data, exampleMap);
            const stmt = graph.quads[0];
            expect(stmt).toBeTruthy();
            expect(stmt.subject).toEqual(ll.targetResource);
            expect(stmt.predicate).toEqual(example.ns("property"));
            expect(stmt.object).toEqual(rdfFactory.literal(data["example:property"]));
        });

        it("handles decimals", () => {
            const data = { "example:property": 2.5 };
            const [graph] = dataToGraphTuple(data, exampleMap);
            const stmt = graph.quads[0];
            expect(stmt).toBeTruthy();
            expect(stmt.subject).toEqual(ll.targetResource);
            expect(stmt.predicate).toEqual(example.ns("property"));
            expect(stmt.object).toEqual(rdfFactory.literal(2.5));
        });

        it("handles files", () => {
            const data = { "example:property": new File([""], "test.txt") };
            const [graph, blobs] = dataToGraphTuple(data, exampleMap);
            expect(blobs).toHaveLength(1);
            const fileNode = blobs[0][0];

            const stmt = graph.quads[0];
            expect(stmt).toBeTruthy();
            expect(stmt.subject).toEqual(ll.targetResource);
            expect(stmt.predicate).toEqual(example.ns("property"));
            expect(stmt.object).toEqual(fileNode);
        });

        it("handles integers", () => {
            const data = { "example:property": 45 };
            const [graph] = dataToGraphTuple(data, exampleMap);
            const stmt = graph.quads[0];
            expect(stmt).toBeTruthy();
            expect(stmt.subject).toEqual(ll.targetResource);
            expect(stmt.predicate).toEqual(example.ns("property"));
            expect(stmt.object).toEqual(rdfFactory.literal(45));
        });

        it("handles bigints", () => {
            const value = "1000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000";
            const data = { "example:property": BigInt(value) as unknown as number };
            const [graph] = dataToGraphTuple(data, exampleMap);
            const stmt = graph.quads[0];
            expect(stmt).toBeTruthy();
            expect(stmt.subject).toEqual(ll.targetResource);
            expect(stmt.predicate).toEqual(example.ns("property"));
            expect(stmt.object).toEqual(rdfFactory.literal(value, xsd.integer));
        });

        it("handles nested resources", () => {
            const data = {
                "example:property": {
                    "example:file": new File([""], "test.txt"),
                    "schema:name": "Some string",
                },
            };
            const [graph, blobs] = dataToGraphTuple(data, { example, schema });
            expect(blobs).toHaveLength(1);
            expect(graph.quads).toHaveLength(3);

            const stmt = graph.match(ll.targetResource, example.ns("property"), null, null, true)?.[0];
            expect(stmt).toBeTruthy();
            expect(stmt!.subject).toEqual(ll.targetResource);
            expect(stmt!.predicate).toEqual(example.ns("property"));
            expect(stmt!.object.termType).toEqual("BlankNode");

            const match = rdfFactory.quad(
                (stmt!.object as Node),
                schema.name,
                rdfFactory.literal("Some string"),
            );
            expect(graph.holdsQuad(match)).toBeTruthy();
        });

        it("handles strings", () => {
            const data = { "example:property": "Some string" };
            const [graph] = dataToGraphTuple(data, exampleMap);
            const stmt = graph.quads[0];
            expect(stmt).toBeTruthy();
            expect(stmt.subject).toEqual(ll.targetResource);
            expect(stmt.predicate).toEqual(example.ns("property"));
            expect(stmt.object).toEqual(rdfFactory.literal("Some string"));
        });
    });

    describe("processObject", () => {
        it("handles undefined", () => {
            const g = new RDFIndex();
            processObject(example.ns("a"), example.ns("property"), null, g);
            expect(g.quads).toHaveLength(0);
        });

        it("handles null", () => {
            const g = new RDFIndex();
            processObject(example.ns("a"), example.ns("property"), null, g);
            expect(g.quads).toHaveLength(0);
        });

        it("handles rdf literals", () => {
            const g = new RDFIndex();
            processObject(example.ns("a"), example.ns("property"), rdfFactory.literal(1), g);
            expect(g.quads).toHaveLength(1);
            expect(g.quads[0].object).toEqual(rdfFactory.literal(1));
        });
    });

    describe("list", () => {
        it("returns an empty list for an empty array", () => {
            expect(list([])).toEqual(rdf.nil);
        });
    });

    describe("seq", () => {
        it("returns an empty sequence for an empty array", () => {
            expect(seq([])).toEqual({
                [rdf.type.toString()]: rdf.Seq,
            });
        });

        it("returns a sequence for an array", () => {
            const d = new Date();

            expect(seq([
                rdfFactory.literal(1),
                rdfFactory.literal("2"),
                rdfFactory.literal(d),
                ex.ns("t"),
            ])).toEqual({
                [rdf.type.toString()]: rdf.Seq,
                [rdf.ns("_0").toString()]: rdfFactory.literal(1),
                [rdf.ns("_1").toString()]: rdfFactory.literal("2"),
                [rdf.ns("_2").toString()]: rdfFactory.literal(d),
                [rdf.ns("_3").toString()]: ex.ns("t"),
            });
        });

        it("sets a given id", () => {
            const id = rdfFactory.blankNode();

            expect(seq([], id)).toHaveProperty("@id", id);
        });
    });
});
