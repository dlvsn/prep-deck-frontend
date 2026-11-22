// Side-effect stylesheet imports (fonts, global CSS). Kept apart from env.d.ts, which is a module:
// a wildcard module declaration only works in a script file like this one.
declare module '*.css'
