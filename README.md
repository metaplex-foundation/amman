# Amman

**A** **m** odern **man** datory toolbelt to help test solana SDK libraries and apps on a locally
running validator.

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->
**Table of Contents**  *generated with [DocToc](https://github.com/thlorenz/doctoc)*

- [CLI](#cli)
  - [Commands: validator](#commands-validator)
    - [Sample Validator Config](#sample-validator-config)
- [LICENSE](#license)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

## CLI

```sh
amman [command]

Commands:
  amman validator [config]  Launches a solana-test-validator

Options:
  --help     Show help                                                 [boolean]
  --version  Show version number                                       [boolean]
``` 

### Commands: validator

```sh
amman validator <config.js>
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

#### Sample Validator Config

Below is an example validator config with all values set to the defaults except for an added
program.

```js
import { LOCALHOST, tmpLedgerDir } from 'amman'

module.exports = {
  validator: {
    killRunningValidators: true,
    programs: [
      { programId: programIds.metadata, deployPath: localDeployPath('mpl_token_metadata') },
    ],
    jsonRpcUrl: LOCALHOST,
    websocketUrl: '',
    commitment: 'confirmed',
    ledgerDir: tmpLedgerDir(),
    resetLedger: true,
    verifyFees: false,
  }
}
```

## LICENSE

Apache-2.0
