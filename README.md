# Amman

**A** **m** odern **man** datory toolbelt to help test solana SDK libraries and apps on a locally
running validator.

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->
**Table of Contents**  *generated with [DocToc](https://github.com/thlorenz/doctoc)*

- [API](#api)
- [CLI](#cli)
  - [Commands: start](#commands-start)
    - [Sample Validator/Relay/Storage Config](#sample-validatorrelaystorage-config)
- [LICENSE](#license)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

## API

Aside from providing a CLI for various tasks, amman also provides commonly used actions,
transactions, asserts and more via an API. Please find the [API docs here](https://metaplex-foundation.github.io/amman/docs/).

## CLI

```sh
amman [command]

Commands:
  amman start    Launches a solana-test-validator and the amman relay and/or
                    mock storage if so configured
  amman relay    Launches a server that relays messages to the amman-explorer
  amman stop     Stops the relay and kills the runnint solana test validator
  amman airdrop  Airdrops provided Sol to the payer
  amman label    Adds PublicKey labels to amman

Options:
  --help     Show help                                                 [boolean]
  --version  Show version number                                       [boolean]
``` 

### Commands: start

```sh
amman start <config.js>
```

If no `config.js` is provided _amman_ looks for an `.ammanrc.js` file in the current directory.
If that isn't found either it uses a default config.

The config should be a JavaScript module exporting 'validator' with any of the below
properties:

- killRunningValidators: if true will kill any solana-test-validators currently running on the system.
- programs: bpf programs which should be loaded into the test validator
- jsonRpcUrl: the URL at which the test validator should listen for JSON RPC requests
- websocketUrl: for the RPC websocket
- ledgerDir: where the solana test validator writes the ledger
- resetLedger: if true the ledger is reset to genesis at startup
- verifyFees: if true the validator is not considered fully started up until it charges transaction fees

#### Sample Validator/Relay/Storage Config

Below is an example config with all values set to the defaults except for an added
program and a `relay` and `storage` config.

A _amman-explorer relay_ is launched automatically with the validator unless it is running in a
_CI_ environment and if a relay is already running on the known _relay port_, it is killed
first.

```js
import { LOCALHOST, tmpLedgerDir } from '@metaplex-foundation/amman'

module.exports = {
  validator: {
    killRunningValidators: true,
    launchExplorerRelay: process.env.CI == null,
    programs: [
      { programId: programIds.metadata, deployPath: localDeployPath('mpl_token_metadata') },
    ],
    jsonRpcUrl: LOCALHOST,
    websocketUrl: '',
    commitment: 'singleGossip',
    ledgerDir: tmpLedgerDir(),
    resetLedger: true,
    verifyFees: false,
  },
  relay: {
    killlRunningRelay: true,
  },
  storage: {
    enabled: process.env.CI == null && process.env.NO_STORAGE == null,
    storageId: 'mock-storage',
    clearOnStart: true,
  },
}
```

## LICENSE

Apache-2.0
