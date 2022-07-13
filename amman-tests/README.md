## amman tests

This package contains integration tests for amman. Most leverage _amman-client_ to communicate
with amman once it is started up. Thus they are fully end-to-end.

## Running

Run tests simply via `yarn test` executed from the root folder of this test package.

It leverages `esbuild-runner` to run the TypeScript code directly (building on the fly) which
makes it easier to run them repeatedly as well as reach into nested modules of the packages it
is testing.

Additionally this allows quick navigation into the code of the respective package, i.e. instead
of showing the definition file we can jump directly to the project code.

## Caveats

Most tests depend on the fact that they are executed sequentially and in order, for
instance `./tasks/restart-validator.ts` first fetches the `pid` of the validator in one tests,
restarts it in the next test and fetches the updated `pid` in the test after.
