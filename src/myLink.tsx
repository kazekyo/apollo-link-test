import { ApolloLink, FetchResult, Observable, Operation } from "@apollo/client";
import {
  DocumentNode,
  FieldNode,
  SelectionSetNode,
  visit,
} from "graphql/language";
import mergeWith from "lodash.mergewith";
import unionWith from "lodash.unionwith";
import { isSubscriptionOperation } from "./utils";

const CONNECTION_DIRECTIVE_NAME = "myConnection";

const pageInfoTemplateProperties = [
  "hasNextPage",
  "hasPreviousPage",
  "startCursor",
  "endCursor",
  "__typename",
];
const pageInfoTemplateNode: FieldNode = {
  kind: "Field",
  name: { kind: "Name", value: "pageInfo" },
  selectionSet: {
    kind: "SelectionSet",
    selections: pageInfoTemplateProperties.map((str) => ({
      kind: "Field",
      name: { kind: "Name", value: str },
    })),
  },
};

const edgesTemplateProperties = ["cursor", "__typename"];
const edgesTemplateNode: FieldNode = {
  kind: "Field",
  name: { kind: "Name", value: "edges" },
  selectionSet: {
    kind: "SelectionSet",
    selections: edgesTemplateProperties.map((str) => ({
      kind: "Field",
      name: { kind: "Name", value: str },
    })),
  },
};

const isFieldNode = (node: unknown): node is FieldNode => {
  return (
    typeof node === "object" &&
    !!node &&
    "kind" in node &&
    (node as FieldNode).kind === "Field"
  );
};

const mergeCustomeizer = (objValue: unknown, srcValue: unknown) => {
  if (Array.isArray(objValue) && Array.isArray(srcValue)) {
    return unionWith(
      objValue,
      srcValue,
      (a: FieldNode | unknown, b: FieldNode | unknown) => {
        if (isFieldNode(a) && isFieldNode(b)) {
          return a.name.value === b.name.value;
        }
        return false;
      }
    ) as unknown[];
  }
};

export const fillPaginationFields = (
  documentNode: DocumentNode
): DocumentNode => {
  const connectionFieldNames: Array<string> = [];
  let newDocumentNode = visit(documentNode, {
    Directive: {
      enter(node, _key, _parent, _path, ancestors) {
        const directiveName = node.name.value;
        if (directiveName !== CONNECTION_DIRECTIVE_NAME) return;
        const fieldNode = ancestors[ancestors.length - 1];
        if (!fieldNode || !("kind" in fieldNode) || fieldNode.kind !== "Field")
          return;

        connectionFieldNames.push(fieldNode.name.value);
        return null;
      },
    },
  }) as DocumentNode;

  newDocumentNode = visit(newDocumentNode, {
    Field: {
      enter(node) {
        const fieldName = node.name.value;
        if (!connectionFieldNames.includes(fieldName)) return;

        const selections = node.selectionSet?.selections || [];

        const existingEdgesFieldNode = selections.find(
          (selection): selection is FieldNode =>
            selection.kind === "Field" && selection.name.value === "edges"
        );
        const edgesFieldNode = mergeWith(
          existingEdgesFieldNode,
          edgesTemplateNode,
          mergeCustomeizer
        );

        const existingPageInfoFieldNode = selections.find(
          (selection) =>
            selection.kind === "Field" && selection.name.value === "pageInfo"
        );
        const pageInfoFieldNode = mergeWith(
          existingPageInfoFieldNode,
          pageInfoTemplateNode,
          mergeCustomeizer
        );

        const notIncludesEdgesAndPageInfoSelection = selections.filter(
          (selection) =>
            selection.kind !== "Field" ||
            !["edges", "pageInfo"].includes(selection.name.value)
        );
        const newSelectionSet: SelectionSetNode = {
          kind: "SelectionSet",
          selections: [
            ...notIncludesEdgesAndPageInfoSelection,
            edgesFieldNode,
            pageInfoFieldNode,
          ],
        };

        return { ...node, selectionSet: newSelectionSet };
      },
    },
  }) as DocumentNode;

  return newDocumentNode;
};

const transform = (operation: Operation): Operation => {
  operation.query = fillPaginationFields(operation.query);
  return operation;
};

const createApolloLink = (
  transform: (operation: Operation) => Operation
): ApolloLink => {
  return new ApolloLink((operation, forward) => {
    if (!forward) return null;

    const newOperation = transform(operation);
    if (isSubscriptionOperation(newOperation.query)) {
      return new Observable<FetchResult>((observer) =>
        forward(newOperation).subscribe((response) => observer.next(response))
      );
    }

    return forward(newOperation).map((response) => response);
  });
};

export const createMyLink = (): ApolloLink => {
  return createApolloLink((operation) => transform(operation));
};
