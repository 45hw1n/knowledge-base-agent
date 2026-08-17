import { ApolloClient, InMemoryCache } from "@apollo/client";
import createUploadLink from "apollo-upload-client/createUploadLink.mjs";

import config from "@/lib/config";

// Drop-in replacement for HttpLink: sends a normal JSON POST for ordinary
// operations, and automatically switches to a GraphQL multipart request
// when File/Blob values are found in the operation's variables (e.g.
// uploadAttachments). No separate link/config is needed for either case.
const uploadLink = createUploadLink({
  uri: `${config.apiUrl}/graphql`,
  credentials: "include",
  // Apollo Server's CSRF-prevention plugin blocks any request whose
  // content-type is multipart/form-data (or urlencoded/text-plain) unless a
  // non-empty `apollo-require-preflight` (or `x-apollo-operation-name`)
  // header is present, since such requests don't trigger a CORS preflight.
  // apollo-upload-client's multipart requests need this header to pass.
  headers: { "apollo-require-preflight": "true" },
});

export const apolloClient = new ApolloClient({
  link: uploadLink,
  cache: new InMemoryCache(),
});
