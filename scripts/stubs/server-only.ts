// `server-only` throws on import outside a React Server Components bundle, by
// design. Scripts legitimately need the modules it guards, so they alias it to
// this no-op via tsconfig.scripts.json.
//
// Previously this was handled with `node --conditions=react-server`, which
// resolves the package to its own empty stub — but React 18's react-server
// entry point refuses to load outside experimental channels.
export {}
