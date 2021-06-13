import { gql, useQuery } from "@apollo/client";
import React from "react";
import "./App.css";

const APP_QUERY = gql`
  query AppQuery {
    viewer {
      id
      name
      robots(first: 2) @myConnection {
        edges {
          node {
            id
          }
          # cursor
        }
        # pageInfo {
        #   hasNextPage
        #   hasPreviousPage
        #   startCursor
        #   endCursor
        # }
      }
    }
  }
`;

function App() {
  const { loading, error, data } = useQuery(APP_QUERY);

  if (loading) return <p>Loading...</p>;
  if (error) return <p>Error :(</p>;

  return (
    <div className="App">
      <div>Viewer ID: {data.viewer?.id}</div>
      <div>hasNextPage: {data.viewer?.pageInfo?.hasNextPage}</div>
    </div>
  );
}

export default App;
