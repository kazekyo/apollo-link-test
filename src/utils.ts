import { getMainDefinition } from "@apollo/client/utilities";
import { DocumentNode } from "graphql";

export const isSubscriptionOperation = (query: DocumentNode): boolean => {
  const mainDefinition = getMainDefinition(query);
  return (
    mainDefinition.kind === "OperationDefinition" &&
    mainDefinition.operation === "subscription"
  );
};
