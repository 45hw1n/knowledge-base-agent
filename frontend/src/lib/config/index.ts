import { ENV } from "./env";

const config = {
  apiUrl: ENV.apiUrl,
  env: ENV.type,
  isLocal: ENV.isLocal,
  host: ENV.host,
};

export default config;